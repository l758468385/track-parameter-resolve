import {
  isTargetEndpoint,
  findAndDecodeBase64,
  isBase64,
  decodeBase64UTF8,
  tryParseJSON,
  debounce,
  type DecodedItem
} from "./utils/decoder"

export interface RequestInfo {
  id: number
  timestamp: string
  url: string
  method: string
  requestData: string | null
  decodedData: DecodedItem[]
  isTargetAPI: boolean
}

let capturedRequestsByTab: Record<number, RequestInfo[]> = {}
let isCapturing = false

const STORAGE_KEY = "capturedRequestsByTab"
const storageArea = chrome.storage.session || chrome.storage.local

const stateReady = restoreCapturedRequests()

// 防抖持久化，避免高频写入
const debouncedPersist = debounce(() => {
  storageSet({ [STORAGE_KEY]: capturedRequestsByTab }).catch((error) => {
    console.error("无法缓存捕获数据", error)
  })
}, 300)

function storageGet(keys: string): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    storageArea.get(keys, (result) => {
      chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(result)
    })
  })
}

function storageSet(items: Record<string, any>): Promise<void> {
  return new Promise((resolve, reject) => {
    storageArea.set(items, () => {
      chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve()
    })
  })
}

async function restoreCapturedRequests() {
  try {
    const stored = await storageGet(STORAGE_KEY)
    if (stored && stored[STORAGE_KEY]) {
      capturedRequestsByTab = stored[STORAGE_KEY]
      Object.keys(capturedRequestsByTab).forEach((tabId) => {
        const numericId = Number(tabId)
        if (!Number.isNaN(numericId)) updateBadge(numericId)
      })
    }
  } catch (error) {
    console.error("无法恢复缓存数据", error)
  }
}

function updateBadge(tabId: number) {
  const count = (capturedRequestsByTab[tabId] || []).length
  chrome.action.setBadgeText({ text: count > 0 ? count.toString() : "", tabId })
  if (count > 0) chrome.action.setBadgeBackgroundColor({ color: "#1a73e8", tabId })
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await stateReady
  delete capturedRequestsByTab[tabId]
  debouncedPersist()
})

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  stateReady
    .then(() => handleRuntimeMessage(request, sender, sendResponse))
    .catch((error) => {
      console.error("处理消息失败:", error)
      sendResponse({ success: false, error: error?.message || "internal_error" })
    })
  return true
})

function handleRuntimeMessage(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
) {
  const { action, tabId } = request

  switch (action) {
    case "startCapture":
      startCapturing()
      sendResponse({ success: true })
      break
    case "stopCapture":
      stopCapturing()
      sendResponse({ success: true })
      break
    case "getCapturedRequests":
      if (!isCapturing) startCapturing()
      sendResponse({ requests: capturedRequestsByTab[tabId] || [] })
      break
    case "clearRequests":
      capturedRequestsByTab[tabId] = []
      updateBadge(tabId)
      debouncedPersist()
      sendResponse({ success: true })
      break
    case "interceptedRequest":
      handleInterceptedRequest(request.request, sender.tab?.id, sendResponse)
      break
    default:
      sendResponse({ success: false, error: "unsupported_action" })
  }
}

function handleInterceptedRequest(
  requestInfo: RequestInfo,
  tabId: number | undefined,
  sendResponse: (response: any) => void
) {
  if (!tabId) {
    sendResponse({ success: false, error: "No tab ID" })
    return
  }
  if (!capturedRequestsByTab[tabId]) capturedRequestsByTab[tabId] = []
  capturedRequestsByTab[tabId].unshift(requestInfo)
  if (capturedRequestsByTab[tabId].length > 100) {
    capturedRequestsByTab[tabId] = capturedRequestsByTab[tabId].slice(0, 100)
  }
  updateBadge(tabId)
  debouncedPersist()
  notifyDevtools(requestInfo, tabId)
  sendResponse({ success: true })
}

function notifyDevtools(requestInfo: RequestInfo, tabId: number) {
  chrome.runtime.sendMessage({
    action: "newRequest",
    request: requestInfo,
    tabId: tabId
  }).catch(() => {})
}

function handleRequest(details: chrome.webRequest.WebRequestBodyDetails) {
  stateReady.then(() => {
    try {
      if (details.method !== "POST") return
      const url = new URL(details.url)
      if (!isTargetEndpoint(url.pathname)) return

      const tabId = details.tabId
      if (tabId < 0) return

      let requestData: string | null = null
      let decodedData: DecodedItem[] = []

      if (details.requestBody) {
        if (details.requestBody.raw) {
          const rawData = details.requestBody.raw[0]
          if (rawData.bytes) {
            const bodyText = new TextDecoder().decode(rawData.bytes)
            requestData = bodyText
            try {
              decodedData = findAndDecodeBase64(JSON.parse(bodyText))
            } catch {
              if (isBase64(bodyText)) {
                try {
                  const decoded = decodeBase64UTF8(bodyText)
                  decodedData.push({
                    field: "request_body",
                    original: bodyText,
                    decoded: tryParseJSON(decoded)
                  })
                } catch (decodeError) {
                  console.warn("Base64 解码失败:", decodeError)
                }
              }
            }
          }
        } else if (details.requestBody.formData) {
          requestData = JSON.stringify(details.requestBody.formData)
          for (const [key, values] of Object.entries(details.requestBody.formData)) {
            values.forEach((value) => {
              if (typeof value === "string" && isBase64(value)) {
                try {
                  decodedData.push({
                    field: key,
                    original: value,
                    decoded: tryParseJSON(decodeBase64UTF8(value))
                  })
                } catch (decodeError) {
                  console.warn("Base64 解码失败:", decodeError)
                }
              }
            })
          }
        }
      }

      if (decodedData.length > 0 || isTargetEndpoint(url.pathname)) {
        const requestInfo: RequestInfo = {
          id: Date.now() + Math.random(),
          timestamp: new Date().toISOString(),
          url: details.url,
          method: details.method,
          requestData,
          decodedData,
          isTargetAPI: true
        }
        if (!capturedRequestsByTab[tabId]) capturedRequestsByTab[tabId] = []
        capturedRequestsByTab[tabId].unshift(requestInfo)
        if (capturedRequestsByTab[tabId].length > 100) {
          capturedRequestsByTab[tabId] = capturedRequestsByTab[tabId].slice(0, 100)
        }
        updateBadge(tabId)
        debouncedPersist()
        notifyDevtools(requestInfo, tabId)
      }
    } catch (error) {
      console.error("处理请求时出错:", error)
    }
  })
}

function startCapturing() {
  if (isCapturing) return
  isCapturing = true
  chrome.webRequest.onBeforeRequest.addListener(
    handleRequest,
    { urls: ["<all_urls>"] },
    ["requestBody"]
  )
  console.log("开始捕获网络请求...")
}

function stopCapturing() {
  if (!isCapturing) return
  isCapturing = false
  if (chrome.webRequest.onBeforeRequest.hasListener(handleRequest)) {
    chrome.webRequest.onBeforeRequest.removeListener(handleRequest)
  }
  console.log("停止捕获网络请求")
}

chrome.runtime.onStartup.addListener(() => startCapturing())
chrome.runtime.onInstalled.addListener(() => startCapturing())
try {
  startCapturing()
} catch {}

export {}

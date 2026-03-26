import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_start"
}

// 内容脚本 - 拦截 XHR 和 Fetch 请求
// 注意: content script 运行在页面沙箱中，工具函数需内联

const decodeBase64UTF8 = (base64Str: string): string => {
  const binaryStr = atob(base64Str)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
  return new TextDecoder("utf-8").decode(bytes)
}

const isBase64 = (str: string): boolean => {
  if (!str || typeof str !== "string" || str.length < 4) return false
  return /^[A-Za-z0-9+/]*={0,2}$/.test(str) && str.length % 4 === 0
}

const tryParseJSON = (str: string): any => {
  try {
    return JSON.parse(str)
  } catch {
    return str
  }
}

interface DecodedItem {
  field: string
  original: string
  decoded: any
}

const findAndDecodeBase64 = (obj: any, path = ""): DecodedItem[] => {
  const results: DecodedItem[] = []
  if (typeof obj === "object" && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key
      if (key === "data" && typeof value === "string" && isBase64(value)) {
        try {
          results.push({
            field: currentPath,
            original: value,
            decoded: tryParseJSON(decodeBase64UTF8(value))
          })
        } catch (e) {
          console.warn(`无法解码 ${currentPath}:`, e)
        }
      } else if (typeof value === "object") {
        results.push(...findAndDecodeBase64(value, currentPath))
      }
    }
  }
  return results
}

const isTargetAPI = (url: string): boolean => url.includes("/api/statistics/v2/track")

// 拦截 XMLHttpRequest
const originalXHROpen = XMLHttpRequest.prototype.open
const originalXHRSend = XMLHttpRequest.prototype.send

XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...args: any[]) {
  ;(this as any)._method = method
  ;(this as any)._url = url
  return originalXHROpen.apply(this, [method, url, ...args] as any)
}

XMLHttpRequest.prototype.send = function (data?: Document | XMLHttpRequestBodyInit | null) {
  if ((this as any)._method === "POST" && data) {
    interceptRequest((this as any)._url, (this as any)._method, data)
  }
  return originalXHRSend.apply(this, [data])
}

// 拦截 Fetch API
const originalFetch = window.fetch
window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === "string" ? input : (input as Request).url || input.toString()
  const method = init?.method || "GET"
  if (method.toUpperCase() === "POST" && init?.body) {
    interceptRequest(url, method, init.body)
  }
  return originalFetch.apply(this, [input, init] as [RequestInfo | URL, RequestInit?])
}

function interceptRequest(url: string, method: string, data: any) {
  try {
    if (!isTargetAPI(url)) return

    let requestData = data
    let decodedData: DecodedItem[] = []

    if (typeof data === "string") {
      requestData = data
      try {
        decodedData = findAndDecodeBase64(JSON.parse(data))
      } catch {
        if (isBase64(data)) {
          try {
            decodedData.push({
              field: "request_body",
              original: data,
              decoded: tryParseJSON(decodeBase64UTF8(data))
            })
          } catch (decodeError) {
            console.warn("Base64 解码失败:", decodeError)
          }
        }
      }
    } else if (data instanceof FormData) {
      const formObj: Record<string, string> = {}
      for (const [key, value] of data.entries()) {
        if (typeof value === "string") {
          formObj[key] = value
          if (isBase64(value)) {
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
        }
      }
      requestData = JSON.stringify(formObj)
    }

    if (decodedData.length > 0) {
      const requestInfo = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        url,
        method: method.toUpperCase(),
        requestData,
        decodedData,
        isTargetAPI: true,
        source: "content_script"
      }

      chrome.runtime.sendMessage({
        action: "interceptedRequest",
        request: requestInfo
      }).catch(() => {})

      console.group(`🔍 检测到 Base64 数据 - ${url}`)
      decodedData.forEach((item) => {
        console.log(`字段: ${item.field}`)
        console.log("原始数据:", item.original.substring(0, 100) + "...")
        console.log("解码结果:", item.decoded)
      })
      console.groupEnd()
    }
  } catch (error) {
    console.error("拦截请求时出错:", error)
  }
}

console.log("🔍 Network Request Base64 Decoder 已加载")

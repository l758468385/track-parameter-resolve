import React, { useEffect, useState } from "react"
import RequestList from "./components/RequestList"
import type { RequestInfo } from "./components/RequestList"
import "./styles/popup.css"

function Popup() {
  const [requests, setRequests] = useState<RequestInfo[]>([])
  const [currentTabId, setCurrentTabId] = useState<number | null>(null)

  useEffect(() => {
    async function init() {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab?.id) return
        setCurrentTabId(tab.id)

        const response = await chrome.runtime.sendMessage({
          action: "getCapturedRequests",
          tabId: tab.id
        })
        if (response?.requests?.length > 0) {
          setRequests([...response.requests].reverse())
        }

        await chrome.runtime.sendMessage({ action: "startCapture" })
      } catch (error) {
        console.error("初始化失败:", error)
      }
    }

    init()
  }, [])

  useEffect(() => {
    if (currentTabId === null) return

    const listener = (message: any) => {
      if (message.action === "newRequest" && message.tabId === currentTabId) {
        setRequests((prev) => [...prev, message.request])
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [currentTabId])

  const handleClear = async () => {
    if (currentTabId === null) return
    try {
      await chrome.runtime.sendMessage({
        action: "clearRequests",
        tabId: currentTabId
      })
      setRequests([])
    } catch (error) {
      console.error("清空请求失败:", error)
    }
  }

  const statusText = requests.length > 0 ? `已捕获 ${requests.length} 个请求` : "监控中..."

  return (
    <div className="popup-container">
      <div className="header">
        <div>
          <h2>Track API 解码器</h2>
          <div className="header-info">{statusText}</div>
        </div>
        <div>
          <button className="clear" onClick={handleClear}>
            清空列表
          </button>
        </div>
      </div>
      <div className="requests-list">
        <RequestList requests={requests} />
      </div>
    </div>
  )
}

export default Popup

import React, { useEffect, useState } from "react"
import RequestList from "./components/RequestList"
import type { RequestInfo } from "./components/RequestList"
import {
  DEFAULT_REQUEST_ORDER,
  getOrderedRequests,
  loadRequestOrder,
  saveRequestOrder,
  type RequestOrder
} from "./utils/requestOrder"
import "./styles/popup.css"

function Popup() {
  const [requests, setRequests] = useState<RequestInfo[]>([])
  const [currentTabId, setCurrentTabId] = useState<number | null>(null)
  const [requestOrder, setRequestOrder] = useState<RequestOrder>(DEFAULT_REQUEST_ORDER)

  useEffect(() => {
    async function init() {
      try {
        const [[tab], savedOrder] = await Promise.all([
          chrome.tabs.query({ active: true, currentWindow: true }),
          loadRequestOrder()
        ])

        setRequestOrder(savedOrder)
        if (!tab?.id) return
        setCurrentTabId(tab.id)

        const response = await chrome.runtime.sendMessage({
          action: "getCapturedRequests",
          tabId: tab.id
        })
        if (response?.requests?.length > 0) {
          setRequests(response.requests)
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
        setRequests((prev) => [message.request, ...prev])
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [currentTabId])

  const handleChangeOrder = async (nextOrder: RequestOrder) => {
    if (requestOrder === nextOrder) return
    setRequestOrder(nextOrder)
    try {
      await saveRequestOrder(nextOrder)
    } catch (error) {
      console.error("保存排序偏好失败:", error)
    }
  }

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

  const orderedRequests = getOrderedRequests(requests, requestOrder)
  const statusText = requests.length > 0 ? `已捕获 ${requests.length} 个请求` : "监控中..."

  return (
    <div className="popup-container">
      <div className="header">
        <div>
          <h2>Track API 解码器</h2>
          <div className="header-info">{statusText}</div>
        </div>
        <div className="header-actions">
          <div className="sort-control" aria-label="请求顺序">
            <span className="sort-label">排序</span>
            <div className="sort-segment">
              <button
                type="button"
                className={`sort-option${requestOrder === "newest-first" ? " active" : ""}`}
                onClick={() => handleChangeOrder("newest-first")}>
                最新在上
              </button>
              <button
                type="button"
                className={`sort-option${requestOrder === "oldest-first" ? " active" : ""}`}
                onClick={() => handleChangeOrder("oldest-first")}>
                最早在上
              </button>
            </div>
          </div>
          <button className="clear" onClick={handleClear}>
            清空列表
          </button>
        </div>
      </div>
      <div className="requests-list">
        <RequestList requests={orderedRequests} />
      </div>
    </div>
  )
}

export default Popup

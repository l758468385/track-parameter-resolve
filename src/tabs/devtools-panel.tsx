import React, { useEffect, useState, useCallback } from "react"
import JsonViewer from "../components/JsonViewer"
import CopyButton from "../components/CopyButton"
import { formatJSON, tryParseJSON } from "../utils/decoder"
import {
  DEFAULT_REQUEST_ORDER,
  getOrderedRequests,
  loadRequestOrder,
  saveRequestOrder,
  type RequestOrder
} from "../utils/requestOrder"
import type { DecodedItem } from "../utils/decoder"
import "../styles/devtools.css"

interface RequestInfo {
  id: number
  timestamp: string
  url: string
  method: string
  requestData: string | null
  decodedData: DecodedItem[]
  isTargetAPI: boolean
}

function DevToolsPanel() {
  const [requests, setRequests] = useState<RequestInfo[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [requestOrder, setRequestOrder] = useState<RequestOrder>(DEFAULT_REQUEST_ORDER)

  const currentTabId = chrome.devtools?.inspectedWindow?.tabId

  const refreshRequests = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getCapturedRequests",
        tabId: currentTabId
      })
      if (response?.requests) {
        setRequests(response.requests)
      }
    } catch (error) {
      console.error("获取请求失败:", error)
    }
  }, [currentTabId])

  useEffect(() => {
    loadRequestOrder().then(setRequestOrder).catch(console.error)
  }, [])

  useEffect(() => {
    try {
      chrome.runtime.sendMessage({ action: "startCapture" })
    } catch {}
    refreshRequests()
  }, [refreshRequests])

  useEffect(() => {
    if (!currentTabId) return

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
    try {
      await chrome.runtime.sendMessage({ action: "clearRequests", tabId: currentTabId })
      setRequests([])
      setSelectedId(null)
    } catch (error) {
      console.error("清空请求失败:", error)
    }
  }

  const orderedRequests = getOrderedRequests(requests, requestOrder)
  const selectedRequest = requests.find((r) => r.id === selectedId)
  const statusText = requests.length > 0 ? `已捕获 ${requests.length} 个请求` : "Track API 解码器"

  return (
    <div className="devtools-container">
      <div className="toolbar">
        <div className="toolbar-info">{statusText}</div>
        <div className="toolbar-actions">
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
          <button onClick={refreshRequests}>刷新</button>
          <button onClick={handleClear}>清空</button>
        </div>
      </div>

      <div className="requests-container">
        <div className="requests-list">
          {requests.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📡</div>
              <div className="empty-text">等待请求...</div>
            </div>
          ) : (
            orderedRequests.map((req) => {
              const date = new Date(req.timestamp)
              const time = date.toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false
              })
              let displayUrl: string
              try {
                const url = new URL(req.url)
                displayUrl = url.pathname + url.search
              } catch {
                displayUrl = req.url
              }

              return (
                <div
                  key={req.id}
                  className={`request-item${req.id === selectedId ? " selected" : ""}`}
                  onClick={() => setSelectedId(req.id)}>
                  <div className="request-path" title={req.url}>
                    {displayUrl}
                  </div>
                  <div className="request-time">{time}</div>
                </div>
              )
            })
          )}
        </div>

        <div className="details-panel">
          {selectedRequest ? (
            <RequestDetails request={selectedRequest} />
          ) : (
            <div className="no-selection">← 选择一个请求查看详情</div>
          )}
        </div>
      </div>
    </div>
  )
}

function RequestDetails({ request }: { request: RequestInfo }) {
  const dataField = request.decodedData?.find(
    (item) => item.field === "data" || item.field.endsWith(".data")
  )

  return (
    <>
      {dataField ? (
        <div className="section">
          <div className="section-title">解码后的 Data 字段</div>
          <JsonViewer data={dataField.decoded} />
          <CopyButton text={formatJSON(dataField.decoded)} />
        </div>
      ) : (
        <div className="section">
          <div style={{ color: "#5f6368", fontSize: "12px", fontStyle: "italic" }}>
            未找到 data 字段
          </div>
        </div>
      )}

      {request.requestData && (
        <div className="section">
          <div className="section-title">原始请求载荷</div>
          <details>
            <summary
              style={{
                cursor: "pointer",
                color: "#1a73e8",
                fontSize: "12px",
                marginBottom: "12px"
              }}>
              显示原始数据
            </summary>
            <JsonViewer data={tryParseJSON(request.requestData)} />
          </details>
        </div>
      )}

      <div className="section">
        <div className="section-title">请求信息</div>
        <div style={{ fontSize: "12px", color: "#333", lineHeight: 1.8 }}>
          <div>
            <strong>URL:</strong> {request.url}
          </div>
          <div>
            <strong>方法:</strong> {request.method}
          </div>
          <div>
            <strong>时间:</strong> {new Date(request.timestamp).toLocaleString("zh-CN")}
          </div>
        </div>
      </div>
    </>
  )
}

export default DevToolsPanel

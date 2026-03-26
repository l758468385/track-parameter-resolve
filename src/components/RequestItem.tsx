import React, { useState } from "react"
import JsonViewer from "./JsonViewer"
import CopyButton from "./CopyButton"
import { formatJSON, tryParseJSON } from "../utils/decoder"
import type { DecodedItem } from "../utils/decoder"

interface RequestInfo {
  id: number
  timestamp: string
  url: string
  method: string
  requestData: string | null
  decodedData: DecodedItem[]
  isTargetAPI: boolean
}

interface RequestItemProps {
  request: RequestInfo
}

export default function RequestItem({ request }: RequestItemProps) {
  const [expanded, setExpanded] = useState(false)

  const date = new Date(request.timestamp)
  const time = date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  })

  let displayUrl: string
  try {
    const url = new URL(request.url)
    displayUrl = url.pathname + url.search
  } catch {
    displayUrl = request.url
  }

  const dataField = request.decodedData?.find(
    (item) => item.field === "data" || item.field.endsWith(".data")
  )

  return (
    <div className={`request-item${expanded ? " expanded" : ""}`}>
      <div className="request-header" onClick={() => setExpanded(!expanded)}>
        <div className="request-info">
          <div className="request-url" title={request.url}>
            {displayUrl}
          </div>
        </div>
        <div className="request-time">{time}</div>
        <div className="expand-icon">▶</div>
      </div>
      {expanded && (
        <div className="request-details show">
          {dataField ? (
            <div className="section">
              <div className="section-title">解码后的 Data 字段</div>
              <JsonViewer data={dataField.decoded} id={`json-${request.id}`} />
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
                    marginBottom: "8px"
                  }}>
                  显示原始数据
                </summary>
                <JsonViewer data={tryParseJSON(request.requestData)} />
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

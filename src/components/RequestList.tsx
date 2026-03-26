import React from "react"
import RequestItem from "./RequestItem"
import type { DecodedItem } from "../utils/decoder"

export interface RequestInfo {
  id: number
  timestamp: string
  url: string
  method: string
  requestData: string | null
  decodedData: DecodedItem[]
  isTargetAPI: boolean
}

interface RequestListProps {
  requests: RequestInfo[]
  emptyText?: string
}

export default function RequestList({
  requests,
  emptyText = "等待 /api/statistics/v2/track 请求..."
}: RequestListProps) {
  if (requests.length === 0) {
    return (
      <div className="no-requests">
        <div className="no-requests-icon">📡</div>
        <div className="empty-state">{emptyText}</div>
      </div>
    )
  }

  return (
    <>
      {requests.map((req) => (
        <RequestItem key={req.id} request={req} />
      ))}
    </>
  )
}

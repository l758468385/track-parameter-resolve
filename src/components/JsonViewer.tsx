import React from "react"

/** JSON 语法高亮 - 将 JSON 数据渲染为带颜色的 HTML */
function highlightJSON(json: any): string {
  let str = typeof json !== "string" ? JSON.stringify(json, undefined, 2) : json
  if (!str) return ""
  str = str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return str.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match: string) => {
      let cls = "number"
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "key" : "string"
      } else if (/true|false/.test(match)) {
        cls = "boolean"
      } else if (/null/.test(match)) {
        cls = "null"
      }
      return `<span class="${cls}">${match}</span>`
    }
  )
}

interface JsonViewerProps {
  data: any
  id?: string
}

export default function JsonViewer({ data, id }: JsonViewerProps) {
  const html = highlightJSON(data)

  return (
    <div
      className="json-viewer"
      id={id}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

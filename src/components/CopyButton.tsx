import React, { useState, useCallback } from "react"

interface CopyButtonProps {
  text: string
  className?: string
}

export default function CopyButton({ text, className = "copy-btn" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // fallback
        const textarea = document.createElement("textarea")
        textarea.value = text
        textarea.style.cssText = "position:fixed;opacity:0"
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      alert("复制失败，请手动复制")
    }
  }, [text])

  return (
    <button
      className={className}
      onClick={handleCopy}
      style={copied ? { background: "#34a853" } : undefined}>
      {copied ? "已复制!" : "复制 JSON"}
    </button>
  )
}

// DevTools 入口 - 创建面板
// 注意：此文件不导出 React 组件，因为 devtools_page 是隐藏页面
// 面板的实际内容在 tabs/devtools-panel.tsx 中

chrome.devtools.panels.create(
  "Base64 Decoder",
  null,
  "tabs/devtools-panel.html",
  () => {
    console.log("Base64 Decoder DevTools 面板已创建")
  }
)

// Plasmo 要求 devtools 文件导出一个默认组件，但 devtools_page 是隐藏的
// 我们提供一个空组件，实际 UI 由 panel 页面承载
export default function DevToolsPage() {
  return null
}

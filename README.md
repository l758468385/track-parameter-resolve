# Network Request Base64 Decoder 浏览器插件

这个浏览器插件可以自动拦截和解码网络请求中的 base64 编码数据，特别适用于调试包含 base64 载荷的 API 请求。

## 功能特性

- 🚀 **自动拦截网络请求** - 实时监控所有 POST 请求
- 🎯 **智能目标检测** - 自动识别统计、追踪类 API 端点
- 🔍 **Base64 自动解码** - 智能检测并解码请求载荷中的 base64 数据
- 📊 **实时显示** - 在弹窗和 DevTools 中实时显示解码结果
- 🎨 **JSON 格式化** - 美观的 JSON 语法高亮显示
- 💾 **请求历史** - 保存最近 100 个包含 base64 的请求
- 🔧 **DevTools 集成** - 专门的 DevTools 面板用于深度调试

## 目标 API 检测

插件会自动检测以下类型的 API 端点：
- `/api/statistics/v2/track` (如你的示例)
- `/api/track`
- `/api/analytics` 
- `/api/events`
- `/track`
- `/analytics`
- `/statistics`

## 安装方法

1. 下载所有文件到一个文件夹
2. 打开 Chrome 浏览器，进入 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择包含插件文件的文件夹

## 使用方法

### 方法一：弹窗界面
1. 点击浏览器工具栏中的插件图标
2. 插件会自动开始捕获网络请求
3. 当检测到包含 base64 的请求时，会实时显示在列表中
4. 点击任意请求查看详细的解码结果

### 方法二：DevTools 面板
1. 打开浏览器开发者工具 (F12)
2. 切换到 "Base64 Decoder" 标签页
3. 查看所有捕获的请求和解码结果
4. 支持展开/收起详细信息

### 方法三：控制台输出
- 插件会在浏览器控制台输出检测到的 base64 数据
- 便于开发时快速查看解码结果

## 实际使用示例

当你访问包含以下请求的网页时：
```javascript
fetch('/api/statistics/v2/track', {
  method: 'POST',
  body: JSON.stringify({
    "api_version": "v2",
    "session_id": "c2768d73baaa41359482328edd8e5985Yxf8yo5c",
    "data": "eyJ0cyI6MTc1OTA0OTcxNDc1MywicmVmZXJlciI6Imh0dHBzOi8vbHJrNjY2LmV1Lm9yZy8iLCJ1cmwiOiJodHRwczovL2xyazY2Ni5ldS5vcmcvcHJvZHVjdHMvZGFuZ2Vyb3VzLXJ1YnkifQ=="
  })
});
```

插件会自动：
1. 检测到这是目标 API 请求
2. 识别 `data` 字段包含 base64 编码
3. 解码并显示为格式化的 JSON：
```json
{
  "ts": 1759049714753,
  "referer": "https://lrk666.eu.org/",
  "url": "https://lrk666.eu.org/products/dangerous-ruby"
}
```

## 文件结构

- `manifest.json` - 插件配置文件
- `background.js` - 后台脚本，拦截网络请求
- `popup.html/js` - 弹窗界面和逻辑
- `content.js` - 内容脚本，拦截页面请求
- `devtools.html/js` - DevTools 扩展
- `devtools-panel.html/js` - DevTools 面板

## 技术特点

- 使用 Manifest V3 规范
- 多层拦截：webRequest API + XHR/Fetch 拦截
- 智能 base64 检测算法
- 支持嵌套 JSON 对象中的 base64 字段
- 实时数据同步
- 内存优化（最多保存 100 个请求）
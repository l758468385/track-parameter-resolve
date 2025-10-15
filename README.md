# Track API 解码器

一个简洁实用的浏览器插件，专门用于解码 `/api/statistics/v2/track` 接口中 base64 编码的 `data` 字段。

## 为什么需要这个插件？

在调试统计追踪接口时，`data` 字段通常是 base64 编码的，要查看实际内容需要：
1. 打开 Network 面板
2. 找到请求
3. 复制 `data` 字段的值
4. 打开 base64 解码工具
5. 解码
6. 再用 JSON 格式化工具查看

**太麻烦了！**

这个插件让你**一键查看解码后的内容**，就像原本参数是透明的一样。

## 功能特点

- 🎯 **专注单一 API** - 只监控 `/api/statistics/v2/track`
- 🔍 **自动解码** - 自动识别并解码 `data` 字段
- 📋 **一键复制** - 点击按钮直接复制 JSON
- 🎨 **简洁界面** - 类似 Chrome DevTools 的设计风格
- ⚡ **实时监控** - 自动捕获新请求

## 安装方法

1. 下载所有文件到一个文件夹
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择包含插件文件的文件夹

## 使用方法

### 方式一：弹窗查看（推荐）
1. 点击浏览器工具栏中的插件图标
2. 查看请求列表
3. 点击任意请求展开查看解码后的 `data` 字段
4. 点击"复制 JSON"按钮一键复制

### 方式二：DevTools 面板
1. 打开浏览器开发者工具 (F12)
2. 切换到 "Base64 Decoder" 标签页
3. 左侧显示请求列表，右侧显示详细内容
4. 类似 Network 面板的使用体验

## 界面预览

**弹窗界面：**
- 简洁的请求列表
- 点击展开查看解码内容
- 一键复制 JSON

**DevTools 面板：**
- 左右分栏布局
- 左侧：请求列表（时间 + 路径）
- 右侧：解码后的 data 字段 + 原始载荷

## 实际效果

**原始请求：**
```json
{
  "api_version": "v2",
  "session_id": "c2768d73baaa41359482328edd8e5985Yxf8yo5c",
  "data": "eyJ0cyI6MTc1OTA0OTcxNDc1MywicmVmZXJlciI6Imh0dHBzOi8vbHJrNjY2LmV1Lm9yZy8iLCJ1cmwiOiJodHRwczovL2xyazY2Ni5ldS5vcmcvcHJvZHVjdHMvZGFuZ2Vyb3VzLXJ1YnkifQ=="
}
```

**插件自动解码 data 字段：**
```json
{
  "ts": 1759049714753,
  "referer": "https://lrk666.eu.org/",
  "url": "https://lrk666.eu.org/products/dangerous-ruby",
  "user_agent": "Mozilla/5.0...",
  "screen_width": 2486,
  "screen_height": 1399,
  "customer_id": 5,
  "event": "page_view",
  "parameters": {
    "url": "https://lrk666.eu.org/products/dangerous-ruby"
  },
  "resource_id": 7620,
  "path_type": "product"
}
```

## 技术实现

- **拦截方式**：webRequest API + XHR/Fetch 拦截
- **解码逻辑**：只解码名为 `data` 的字段
- **界面设计**：参考 Chrome DevTools 风格
- **数据存储**：内存中保存最近 100 个请求

## 文件说明

- `manifest.json` - 插件配置
- `background.js` - 后台脚本，拦截网络请求
- `popup.html/js` - 弹窗界面
- `content.js` - 内容脚本，拦截页面请求
- `devtools.html/js` - DevTools 扩展入口
- `devtools-panel.html/js` - DevTools 面板

## 自定义配置

如需监控其他 API 端点，修改以下文件中的 `isTargetEndpoint` 函数：
- `background.js`
- `content.js`

如需解码其他字段名，修改 `findAndDecodeBase64` 函数中的字段名判断。

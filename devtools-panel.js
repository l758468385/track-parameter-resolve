// DevTools 面板脚本
let capturedRequests = [];
let selectedRequestId = null;
let currentTabId = chrome.devtools.inspectedWindow.tabId; // 获取当前标签页 ID

document.addEventListener("DOMContentLoaded", function () {
  const refreshBtn = document.getElementById("refreshBtn");
  const clearBtn = document.getElementById("clearBtn");
  const requestsList = document.getElementById("requestsList");
  const detailsPanel = document.getElementById("detailsPanel");
  const status = document.getElementById("status");

  refreshBtn.addEventListener("click", refreshRequests);
  clearBtn.addEventListener("click", clearRequests);

  // 初始化
  refreshRequests();

  // 监听来自 background 的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 只处理当前标签页的请求
    if (request.action === "newRequest" && request.tabId === currentTabId) {
      addRequest(request.request);
    }
  });

  async function refreshRequests() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getCapturedRequests",
        tabId: currentTabId, // 传递当前标签页 ID
      });
      if (response && response.requests) {
        capturedRequests = response.requests;
        displayRequests();
        updateStatus();
      }
    } catch (error) {
      console.error("获取请求失败:", error);
      status.textContent = "获取请求失败";
    }
  }

  async function clearRequests() {
    try {
      await chrome.runtime.sendMessage({ 
        action: "clearRequests",
        tabId: currentTabId // 传递当前标签页 ID
      });
      capturedRequests = [];
      selectedRequestId = null;
      displayRequests();
      detailsPanel.innerHTML =
        '<div class="no-selection">← 选择一个请求查看详情</div>';
      updateStatus();
    } catch (error) {
      console.error("清空请求失败:", error);
    }
  }

  function addRequest(request) {
    capturedRequests.unshift(request);

    // 如果列表中有空状态提示，先清空
    const emptyState = requestsList.querySelector(".empty-state");
    if (emptyState) {
      requestsList.innerHTML = "";
    }

    // 新请求添加到最下面
    const requestElement = createRequestListItem(request);
    requestsList.appendChild(requestElement);
    updateStatus();
  }

  function updateStatus() {
    const count = capturedRequests.length;
    status.textContent =
      count > 0 ? `已捕获 ${count} 个请求` : "Track API 解码器";
  }

  function displayRequests() {
    if (capturedRequests.length === 0) {
      requestsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📡</div>
          <div class="empty-text">等待请求...</div>
        </div>
      `;
      return;
    }

    requestsList.innerHTML = "";
    // 反转数组，让最旧的在上面，最新的在下面（像聊天记录）
    const reversedRequests = [...capturedRequests].reverse();
    reversedRequests.forEach((request) => {
      const requestElement = createRequestListItem(request);
      requestsList.appendChild(requestElement);
    });
  }

  function createRequestListItem(request) {
    const div = document.createElement("div");
    div.className = "request-item";
    if (request.id === selectedRequestId) {
      div.classList.add("selected");
    }

    // 使用简洁的时间格式（只显示时:分:秒）
    const date = new Date(request.timestamp);
    const time = date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    // 解析 URL 获取路径和查询参数
    const url = new URL(request.url);
    const displayUrl = url.pathname + url.search;

    div.innerHTML = `
      <div class="request-path" title="${request.url}">${displayUrl}</div>
      <div class="request-time">${time}</div>
    `;

    div.addEventListener("click", () => {
      selectedRequestId = request.id;
      // 更新选中状态
      document.querySelectorAll(".request-item").forEach((item) => {
        item.classList.remove("selected");
      });
      div.classList.add("selected");
      // 显示详情
      showRequestDetails(request);
    });

    return div;
  }

  function showRequestDetails(request) {
    // 提取 data 字段
    const dataField = request.decodedData
      ? request.decodedData.find(
          (item) => item.field === "data" || item.field.endsWith(".data")
        )
      : null;

    let html = "";

    if (dataField) {
      const decodedJson = formatJSON(dataField.decoded);

      html += `
        <div class="section">
          <div class="section-title">解码后的 Data 字段</div>
          <div class="json-viewer">${decodedJson}</div>
          <button class="copy-btn" data-copy="${escapeForAttribute(
            decodedJson
          )}">复制 JSON</button>
        </div>
      `;
    } else {
      html += `
        <div class="section">
          <div style="color: #5f6368; font-size: 12px; font-style: italic;">未找到 data 字段</div>
        </div>
      `;
    }

    // 原始请求数据
    if (request.requestData) {
      html += `
        <div class="section">
          <div class="section-title">原始请求载荷</div>
          <details>
            <summary style="cursor: pointer; color: #1a73e8; font-size: 12px; margin-bottom: 12px;">显示原始数据</summary>
            <div class="json-viewer">${formatJSON(
              tryParseJSON(request.requestData)
            )}</div>
          </details>
        </div>
      `;
    }

    // 请求信息
    html += `
      <div class="section">
        <div class="section-title">请求信息</div>
        <div style="font-size: 12px; color: #333; line-height: 1.8;">
          <div><strong>URL:</strong> ${request.url}</div>
          <div><strong>方法:</strong> ${request.method}</div>
          <div><strong>时间:</strong> ${new Date(
            request.timestamp
          ).toLocaleString("zh-CN")}</div>
        </div>
      </div>
    `;

    detailsPanel.innerHTML = html;

    // 绑定复制按钮事件
    detailsPanel.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const text = this.getAttribute("data-copy");
        copyToClipboard(text, this);
      });
    });
  }

  function formatJSON(data) {
    if (typeof data === "object") {
      return JSON.stringify(data, null, 2);
    }
    return data;
  }

  function tryParseJSON(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return str;
    }
  }

  function escapeForAttribute(str) {
    return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function copyToClipboard(text, btn) {
    // 解码 HTML 实体
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    const decodedText = textarea.value;

    // 尝试使用 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(decodedText)
        .then(() => {
          const originalText = btn.textContent;
          btn.textContent = "已复制!";
          btn.style.background = "#34a853";
          setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = "#1a73e8";
          }, 1500);
        })
        .catch((err) => {
          console.error("Clipboard API 失败:", err);
          fallbackCopy(decodedText, btn);
        });
    } else {
      // 降级方案
      fallbackCopy(decodedText, btn);
    }
  }

  function fallbackCopy(text, btn) {
    // 使用 execCommand 降级方案
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      const successful = document.execCommand("copy");
      if (successful) {
        const originalText = btn.textContent;
        btn.textContent = "已复制!";
        btn.style.background = "#34a853";
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = "#1a73e8";
        }, 1500);
      } else {
        alert("复制失败，请手动复制");
      }
    } catch (err) {
      console.error("execCommand 失败:", err);
      alert("复制失败，请手动复制");
    }

    document.body.removeChild(textarea);
  }
});

let capturedRequests = [];
let selectedRequestId = null;
const currentTabId = chrome.devtools.inspectedWindow.tabId;

document.addEventListener("DOMContentLoaded", function () {
  const refreshBtn = document.getElementById("refreshBtn");
  const clearBtn = document.getElementById("clearBtn");
  const requestsList = document.getElementById("requestsList");
  const detailsPanel = document.getElementById("detailsPanel");
  const status = document.getElementById("status");

  refreshBtn.addEventListener("click", refreshRequests);
  clearBtn.addEventListener("click", clearRequests);

  try { chrome.runtime.sendMessage({ action: "startCapture" }); } catch (e) {}
  refreshRequests();

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "newRequest" && request.tabId === currentTabId) {
      addRequest(request.request);
    }
  });

  async function refreshRequests() {
    try {
      const response = await chrome.runtime.sendMessage({ action: "getCapturedRequests", tabId: currentTabId });
      if (response?.requests) {
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
      await chrome.runtime.sendMessage({ action: "clearRequests", tabId: currentTabId });
      capturedRequests = [];
      selectedRequestId = null;
      displayRequests();
      detailsPanel.innerHTML = '<div class="no-selection">← 选择一个请求查看详情</div>';
      updateStatus();
    } catch (error) {
      console.error("清空请求失败:", error);
    }
  }

  function addRequest(request) {
    capturedRequests.unshift(request);
    if (requestsList.querySelector(".empty-state")) requestsList.innerHTML = "";
    requestsList.appendChild(createRequestListItem(request));
    updateStatus();
  }

  function updateStatus() {
    const count = capturedRequests.length;
    status.textContent = count > 0 ? `已捕获 ${count} 个请求` : "Track API 解码器";
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
    [...capturedRequests].reverse().forEach((req) => requestsList.appendChild(createRequestListItem(req)));
  }

  function createRequestListItem(request) {
    const div = document.createElement("div");
    div.className = "request-item" + (request.id === selectedRequestId ? " selected" : "");

    const date = new Date(request.timestamp);
    const time = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const url = new URL(request.url);
    const displayUrl = url.pathname + url.search;

    div.innerHTML = `
      <div class="request-path" title="${request.url}">${displayUrl}</div>
      <div class="request-time">${time}</div>
    `;

    div.addEventListener("click", () => {
      selectedRequestId = request.id;
      document.querySelectorAll(".request-item").forEach((item) => item.classList.remove("selected"));
      div.classList.add("selected");
      showRequestDetails(request);
    });

    return div;
  }

  function showRequestDetails(request) {
    const dataField = request.decodedData?.find((item) => item.field === "data" || item.field.endsWith(".data"));
    let html = "";

    if (dataField) {
      const decodedJson = formatJSON(dataField.decoded);
      html += `
        <div class="section">
          <div class="section-title">解码后的 Data 字段</div>
          <div class="json-viewer">${decodedJson}</div>
          <button class="copy-btn" data-copy="${escapeForAttribute(decodedJson)}">复制 JSON</button>
        </div>
      `;
    } else {
      html += `<div class="section"><div style="color:#5f6368;font-size:12px;font-style:italic;">未找到 data 字段</div></div>`;
    }

    if (request.requestData) {
      html += `
        <div class="section">
          <div class="section-title">原始请求载荷</div>
          <details>
            <summary style="cursor:pointer;color:#1a73e8;font-size:12px;margin-bottom:12px;">显示原始数据</summary>
            <div class="json-viewer">${formatJSON(tryParseJSON(request.requestData))}</div>
          </details>
        </div>
      `;
    }

    html += `
      <div class="section">
        <div class="section-title">请求信息</div>
        <div style="font-size:12px;color:#333;line-height:1.8;">
          <div><strong>URL:</strong> ${request.url}</div>
          <div><strong>方法:</strong> ${request.method}</div>
          <div><strong>时间:</strong> ${new Date(request.timestamp).toLocaleString("zh-CN")}</div>
        </div>
      </div>
    `;

    detailsPanel.innerHTML = html;
    detailsPanel.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", () => copyToClipboard(btn.getAttribute("data-copy"), btn));
    });
  }

  function formatJSON(data) {
    return typeof data === "object" ? JSON.stringify(data, null, 2) : data;
  }

  function tryParseJSON(str) {
    try { return JSON.parse(str); } catch (e) { return str; }
  }

  function escapeForAttribute(str) {
    return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function copyToClipboard(text, btn) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    const decodedText = textarea.value;

    const showSuccess = () => {
      const originalText = btn.textContent;
      btn.textContent = "已复制!";
      btn.style.background = "#34a853";
      setTimeout(() => { btn.textContent = originalText; btn.style.background = "#1a73e8"; }, 1500);
    };

    const fallbackCopy = () => {
      const ta = document.createElement("textarea");
      ta.value = decodedText;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      try {
        if (document.execCommand("copy")) showSuccess();
        else alert("复制失败，请手动复制");
      } catch (err) { alert("复制失败，请手动复制"); }
      document.body.removeChild(ta);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(decodedText).then(showSuccess).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  }
});

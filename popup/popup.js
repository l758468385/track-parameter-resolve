document.addEventListener("DOMContentLoaded", function () {
  const clearBtn = document.getElementById("clearBtn");
  const status = document.getElementById("status");
  const requestsList = document.getElementById("requestsList");
  let currentTabId = null;

  init();
  clearBtn.addEventListener("click", clearRequests);

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "newRequest" && request.tabId === currentTabId) {
      addRequestToUI(request.request);
    }
  });

  async function init() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTabId = tab.id;
    } catch (error) {
      console.error("获取当前标签页失败:", error);
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: "getCapturedRequests",
        tabId: currentTabId,
      });
      if (response?.requests?.length > 0) displayRequests(response.requests);
    } catch (error) {
      console.error("获取请求失败:", error);
    }

    try {
      await chrome.runtime.sendMessage({ action: "startCapture" });
      updateStatus();
    } catch (error) {
      console.error("开始捕获失败:", error);
    }
  }

  async function clearRequests() {
    try {
      await chrome.runtime.sendMessage({ action: "clearRequests", tabId: currentTabId });
      requestsList.innerHTML = `
        <div class="no-requests">
          <div class="no-requests-icon">📡</div>
          <div class="empty-state">等待 /api/statistics/v2/track 请求...</div>
        </div>
      `;
      updateStatus();
    } catch (error) {
      console.error("清空请求失败:", error);
    }
  }

  function updateStatus() {
    const count = requestsList.querySelectorAll(".request-item").length;
    status.textContent = count > 0 ? `已捕获 ${count} 个请求` : "监控中...";
  }

  function displayRequests(requests) {
    if (!requests?.length) return;
    requestsList.innerHTML = "";
    [...requests].reverse().forEach((req) => requestsList.appendChild(createRequestElement(req)));
  }

  function addRequestToUI(request) {
    if (requestsList.querySelector(".no-requests")) requestsList.innerHTML = "";
    requestsList.appendChild(createRequestElement(request));
    updateStatus();
  }

  function createRequestElement(request) {
    const div = document.createElement("div");
    div.className = "request-item";

    const date = new Date(request.timestamp);
    const time = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const url = new URL(request.url);
    const displayUrl = url.pathname + url.search;
    const dataField = request.decodedData?.find((item) => item.field === "data" || item.field.endsWith(".data"));

    div.innerHTML = `
      <div class="request-header">
        <div class="request-info">
          <div class="request-url" title="${request.url}">${displayUrl}</div>
        </div>
        <div class="request-time">${time}</div>
        <div class="expand-icon">▶</div>
      </div>
      <div class="request-details">${createRequestDetailsHTML(request, dataField)}</div>
    `;

    const header = div.querySelector(".request-header");
    header.addEventListener("click", () => {
      const details = div.querySelector(".request-details");
      details.classList.toggle("show");
      div.classList.toggle("expanded");
    });

    const copyBtn = div.querySelector(".copy-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const jsonElement = document.getElementById(copyBtn.getAttribute("data-target"));
        if (jsonElement) copyToClipboard(jsonElement.textContent, copyBtn);
      });
    }

    return div;
  }

  function createRequestDetailsHTML(request, dataField) {
    let html = "";
    if (dataField) {
      const decodedJson = formatJSON(dataField.decoded);
      html += `
        <div class="section">
          <div class="section-title">解码后的 Data 字段</div>
          <div class="json-viewer" id="json-${request.id}">${syntaxHighlight(dataField.decoded)}</div>
          <button class="copy-btn" data-target="json-${request.id}">复制 JSON</button>
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
            <summary style="cursor:pointer;color:#1a73e8;font-size:12px;margin-bottom:8px;">显示原始数据</summary>
            <div class="json-viewer">${syntaxHighlight(tryParseJSON(request.requestData))}</div>
          </details>
        </div>
      `;
    }
    return html;
  }

  function formatJSON(data) {
    return typeof data === "object" ? JSON.stringify(data, null, 2) : data;
  }

  function syntaxHighlight(json) {
    if (typeof json !== 'string') {
      json = JSON.stringify(json, undefined, 2);
    }
    if (!json) return '';
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
      let cls = 'number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'key';
        } else {
          cls = 'string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'boolean';
      } else if (/null/.test(match)) {
        cls = 'null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    });
  }

  function tryParseJSON(str) {
    try { return JSON.parse(str); } catch (e) { return str; }
  }

  function copyToClipboard(text, btn) {
    const showSuccess = () => {
      const originalText = btn.textContent;
      const originalBg = btn.style.background;
      btn.textContent = "已复制!";
      btn.style.background = "#34a853";
      setTimeout(() => { btn.textContent = originalText; btn.style.background = originalBg; }, 1500);
    };

    const fallbackCopy = () => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        if (document.execCommand("copy")) showSuccess();
        else alert("复制失败，请手动复制");
      } catch (e) { alert("复制失败，请手动复制"); }
      document.body.removeChild(textarea);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(showSuccess).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  }
});

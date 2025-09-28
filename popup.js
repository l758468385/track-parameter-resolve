document.addEventListener("DOMContentLoaded", function () {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const clearBtn = document.getElementById("clearBtn");
  const status = document.getElementById("status");
  const requestsContainer = document.getElementById("requestsContainer");

  let isCapturing = false;

  // 初始化
  init();

  startBtn.addEventListener("click", startCapture);
  stopBtn.addEventListener("click", stopCapture);
  clearBtn.addEventListener("click", clearRequests);

  // 监听来自 background 的新请求消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "newRequest") {
      addRequestToUI(request.request);
    }
  });

  async function init() {
    // 获取已捕获的请求
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getCapturedRequests",
      });
      if (response && response.requests) {
        displayRequests(response.requests);
      }
    } catch (error) {
      console.error("获取请求失败:", error);
    }

    // 默认开始捕获
    startCapture();
  }

  async function startCapture() {
    try {
      await chrome.runtime.sendMessage({ action: "startCapture" });
      isCapturing = true;
      updateUI();
      status.textContent = "正在捕获网络请求...";
    } catch (error) {
      console.error("开始捕获失败:", error);
      status.textContent = "启动失败";
    }
  }

  async function stopCapture() {
    try {
      await chrome.runtime.sendMessage({ action: "stopCapture" });
      isCapturing = false;
      updateUI();
      status.textContent = "已停止捕获";
    } catch (error) {
      console.error("停止捕获失败:", error);
    }
  }

  async function clearRequests() {
    try {
      await chrome.runtime.sendMessage({ action: "clearRequests" });
      requestsContainer.innerHTML = '<div class="no-requests">请求已清空</div>';
      status.textContent = "请求已清空";
    } catch (error) {
      console.error("清空请求失败:", error);
    }
  }

  function updateUI() {
    startBtn.disabled = isCapturing;
    stopBtn.disabled = !isCapturing;

    if (isCapturing) {
      startBtn.style.opacity = "0.5";
      stopBtn.style.opacity = "1";
    } else {
      startBtn.style.opacity = "1";
      stopBtn.style.opacity = "0.5";
    }
  }

  function displayRequests(requests) {
    if (!requests || requests.length === 0) {
      requestsContainer.innerHTML =
        '<div class="no-requests">暂无捕获到的请求</div>';
      return;
    }

    requestsContainer.innerHTML = "";
    requests.forEach((request) => {
      addRequestToUI(request);
    });
  }

  function addRequestToUI(request) {
    // 如果容器显示"无请求"消息，先清空
    if (requestsContainer.querySelector(".no-requests")) {
      requestsContainer.innerHTML = "";
    }

    const requestElement = createRequestElement(request);
    requestsContainer.insertBefore(
      requestElement,
      requestsContainer.firstChild
    );
  }

  function createRequestElement(request) {
    const div = document.createElement("div");
    div.className = `request-item ${request.isTargetAPI ? "target-api" : ""}`;

    const url = new URL(request.url);
    const shortUrl = url.pathname + url.search;
    const time = new Date(request.timestamp).toLocaleTimeString();

    div.innerHTML = `
      <div class="request-header">
        <div>
          <span class="request-method">${request.method}</span>
          <span class="request-url" title="${request.url}">${shortUrl}</span>
          ${
            request.isTargetAPI
              ? '<span class="target-indicator">目标API</span>'
              : ""
          }
        </div>
        <div>
         
          <span class="request-time">${time}</span>
        </div>
      </div>
      <div class="request-details" id="details-${request.id}">
        ${createRequestDetailsHTML(request)}
      </div>
    `;

    // 点击展开/收起详情
    div.addEventListener("click", function (e) {
      if (e.target.closest(".request-details")) return;

      const details = div.querySelector(".request-details");
      details.classList.toggle("show");
    });

    return div;
  }

  function createRequestDetailsHTML(request) {
    let html = "";

    // 显示原始请求数据
    if (request.requestData) {
      html += `
        <div style="margin-bottom: 15px;">
          <div class="field-name">原始请求数据:</div>
          <div class="original-data">${request.requestData.substring(0, 500)}${
        request.requestData.length > 500 ? "..." : ""
      }</div>
        </div>
      `;
    }

    // 显示解码的数据 - 只显示 data 字段
    const dataFields = request.decodedData
      ? request.decodedData.filter(
          (item) => item.field === "data" || item.field.endsWith(".data")
        )
      : [];

    if (dataFields.length > 0) {
      html +=
        '<div style="margin-bottom: 10px;"><strong>解码的 data 字段:</strong></div>';

      dataFields.forEach((decoded, index) => {
        html += `
          <div class="decoded-item">
            <div style="margin-bottom: 8px;">
              <strong>原始 Base64:</strong>
              <div class="original-data">${decoded.original.substring(0, 200)}${
          decoded.original.length > 200 ? "..." : ""
        }</div>
            </div>
            <div>
              <strong>解码结果:</strong>
              <div class="decoded-data">${formatDecodedData(
                decoded.decoded
              )}</div>
            </div>
          </div>
        `;
      });
    } else {
      html +=
        '<div style="color: #999; font-style: italic;">此请求未包含 data 字段的 base64 编码数据</div>';
    }

    return html;
  }

  function formatDecodedData(data) {
    if (typeof data === "object") {
      return JSON.stringify(data, null, 2);
    }
    return data;
  }
});

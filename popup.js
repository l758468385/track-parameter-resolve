document.addEventListener('DOMContentLoaded', function () {
  const clearBtn = document.getElementById('clearBtn');
  const status = document.getElementById('status');
  const requestsList = document.getElementById('requestsList');

  // 初始化
  init();

  clearBtn.addEventListener('click', clearRequests);

  // 监听来自 background 的新请求消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'newRequest') {
      addRequestToUI(request.request);
    }
  });

  async function init() {
    // 获取已捕获的请求
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getCapturedRequests',
      });
      if (response && response.requests && response.requests.length > 0) {
        displayRequests(response.requests);
      }
    } catch (error) {
      console.error('获取请求失败:', error);
    }

    // 自动开始捕获
    try {
      await chrome.runtime.sendMessage({ action: 'startCapture' });
      updateStatus();
    } catch (error) {
      console.error('开始捕获失败:', error);
    }
  }

  async function clearRequests() {
    try {
      await chrome.runtime.sendMessage({ action: 'clearRequests' });
      requestsList.innerHTML = `
        <div class="no-requests">
          <div class="no-requests-icon">📡</div>
          <div class="empty-state">等待 /api/statistics/v2/track 请求...</div>
        </div>
      `;
      updateStatus();
    } catch (error) {
      console.error('清空请求失败:', error);
    }
  }

  function updateStatus() {
    const count = requestsList.querySelectorAll('.request-item').length;
    status.textContent = count > 0 ? `已捕获 ${count} 个请求` : '监控中...';
  }

  function displayRequests(requests) {
    if (!requests || requests.length === 0) return;

    requestsList.innerHTML = '';
    // 反转数组，让最旧的在上面，最新的在下面
    const reversedRequests = [...requests].reverse();
    reversedRequests.forEach((request) => {
      const requestElement = createRequestElement(request);
      requestsList.appendChild(requestElement, requestsList.firstChild);
    });
  }

  function addRequestToUI(request) {
    // 如果容器显示"无请求"消息，先清空
    if (requestsList.querySelector('.no-requests')) {
      requestsList.innerHTML = '';
    }

    const requestElement = createRequestElement(request);
    // 新请求添加到最下面（因为我们要最新的在下面）
    requestsList.appendChild(requestElement);
    updateStatus();
  }

  function createRequestElement(request) {
    const div = document.createElement('div');
    div.className = 'request-item';

    // 显示更精确的时间（包含毫秒）
    const date = new Date(request.timestamp);
    const time = date.toLocaleTimeString('zh-CN') + '.' + date.getMilliseconds().toString().padStart(3, '0');
    
    // 解析 URL 获取路径和查询参数
    const url = new URL(request.url);
    const displayUrl = url.pathname + url.search;

    // 提取 data 字段
    const dataField = request.decodedData
      ? request.decodedData.find(
          (item) => item.field === 'data' || item.field.endsWith('.data')
        )
      : null;

    div.innerHTML = `
      <div class="request-header">
        <div class="request-info">
          <div class="request-time">${time}</div>
          <div class="request-url" title="${request.url}">${displayUrl}</div>
        </div>
        <div class="expand-icon">▶</div>
      </div>
      <div class="request-details" id="details-${request.id}">
        ${createRequestDetailsHTML(request, dataField)}
      </div>
    `;

    // 点击展开/收起详情
    const header = div.querySelector('.request-header');
    header.addEventListener('click', function () {
      const details = div.querySelector('.request-details');
      const isExpanded = details.classList.contains('show');

      if (isExpanded) {
        details.classList.remove('show');
        div.classList.remove('expanded');
      } else {
        details.classList.add('show');
        div.classList.add('expanded');
      }
    });

    return div;
  }

  function createRequestDetailsHTML(request, dataField) {
    let html = '';

    // 显示解码后的 data 字段
    if (dataField) {
      const decodedJson = formatJSON(dataField.decoded);

      html += `
        <div class="section">
          <div class="section-title">解码后的 Data 字段</div>
          <div class="json-viewer">${decodedJson}</div>
          <button class="copy-btn" onclick="copyToClipboard('${escapeForAttribute(
            decodedJson
          )}')">复制 JSON</button>
        </div>
      `;
    } else {
      html += `
        <div class="section">
          <div style="color: #5f6368; font-size: 12px; font-style: italic;">未找到 data 字段</div>
        </div>
      `;
    }

    // 显示原始请求数据（可折叠）
    if (request.requestData) {
      html += `
        <div class="section">
          <div class="section-title">原始请求载荷</div>
          <details>
            <summary style="cursor: pointer; color: #1a73e8; font-size: 12px; margin-bottom: 8px;">显示原始数据</summary>
            <div class="json-viewer">${formatJSON(
              tryParseJSON(request.requestData)
            )}</div>
          </details>
        </div>
      `;
    }

    return html;
  }

  function formatJSON(data) {
    if (typeof data === 'object') {
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
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // 全局复制函数
  window.copyToClipboard = function (text) {
    // 解码 HTML 实体
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    const decodedText = textarea.value;

    navigator.clipboard
      .writeText(decodedText)
      .then(() => {
        // 显示复制成功提示
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '已复制!';
        btn.style.background = '#2d8e47';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '#34a853';
        }, 1500);
      })
      .catch((err) => {
        console.error('复制失败:', err);
        alert('复制失败，请手动复制');
      });
  };
});

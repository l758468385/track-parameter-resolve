// DevTools 面板脚本
let capturedRequests = [];

document.addEventListener('DOMContentLoaded', function() {
  const refreshBtn = document.getElementById('refreshBtn');
  const clearBtn = document.getElementById('clearBtn');
  const requestsList = document.getElementById('requestsList');
  const status = document.getElementById('status');

  refreshBtn.addEventListener('click', refreshRequests);
  clearBtn.addEventListener('click', clearRequests);

  // 初始化
  refreshRequests();

  // 监听来自 background 的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'newRequest') {
      addRequest(request.request);
    }
  });

  async function refreshRequests() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getCapturedRequests' });
      if (response && response.requests) {
        capturedRequests = response.requests;
        displayRequests();
        status.textContent = `已捕获 ${capturedRequests.length} 个请求`;
      }
    } catch (error) {
      console.error('获取请求失败:', error);
      status.textContent = '获取请求失败';
    }
  }

  async function clearRequests() {
    try {
      await chrome.runtime.sendMessage({ action: 'clearRequests' });
      capturedRequests = [];
      displayRequests();
      status.textContent = '请求已清空';
    } catch (error) {
      console.error('清空请求失败:', error);
    }
  }

  function addRequest(request) {
    capturedRequests.unshift(request);
    displayRequests();
    status.textContent = `已捕获 ${capturedRequests.length} 个请求`;
  }

  function displayRequests() {
    if (capturedRequests.length === 0) {
      requestsList.innerHTML = '<div class="no-data">暂无检测到包含 base64 数据的请求</div>';
      return;
    }

    requestsList.innerHTML = '';
    capturedRequests.forEach((request, index) => {
      const requestElement = createRequestElement(request, index);
      requestsList.appendChild(requestElement);
    });
  }

  function createRequestElement(request, index) {
    const div = document.createElement('div');
    div.className = 'request-item';
    
    const url = new URL(request.url);
    const time = new Date(request.timestamp).toLocaleString();
    
    div.innerHTML = `
      <div class="request-url">${request.method} ${url.pathname}${url.search}</div>
      <div class="request-time">${time} - ${request.decodedData ? request.decodedData.filter(item => item.field === 'data' || item.field.endsWith('.data')).length : 0} 个 data 字段</div>
      <div class="decoded-section" id="decoded-${index}">
        ${createDecodedHTML(request.decodedData)}
      </div>
    `;

    div.addEventListener('click', function() {
      const decodedSection = div.querySelector('.decoded-section');
      const isExpanded = decodedSection.classList.contains('show');
      
      // 收起所有其他项
      document.querySelectorAll('.decoded-section.show').forEach(section => {
        section.classList.remove('show');
      });
      document.querySelectorAll('.request-item.expanded').forEach(item => {
        item.classList.remove('expanded');
      });
      
      if (!isExpanded) {
        decodedSection.classList.add('show');
        div.classList.add('expanded');
      }
    });

    return div;
  }

  function createDecodedHTML(decodedData) {
    // 只显示 data 字段的解码数据
    const dataFields = decodedData ? decodedData.filter(item => item.field === 'data' || item.field.endsWith('.data')) : [];
    
    if (!dataFields || dataFields.length === 0) {
      return '<div style="color: #999;">无 data 字段的 base64 数据</div>';
    }

    let html = '';
    dataFields.forEach(item => {
      html += `
        <div class="decoded-item">
          <div class="field-name">字段: ${item.field}</div>
          <div style="margin-bottom: 10px;">
            <strong>原始 Base64:</strong>
            <div style="background: #f5f5f5; padding: 8px; border-radius: 3px; font-family: monospace; font-size: 11px; word-break: break-all; max-height: 60px; overflow-y: auto;">
              ${item.original}
            </div>
          </div>
          <div>
            <strong>解码结果:</strong>
            <div class="json-data">${formatData(item.decoded)}</div>
          </div>
        </div>
      `;
    });

    return html;
  }

  function formatData(data) {
    if (typeof data === 'object') {
      return JSON.stringify(data, null, 2);
    }
    return data;
  }
});
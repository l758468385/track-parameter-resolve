// 后台脚本 - 拦截网络请求
let capturedRequests = [];
let isCapturing = false;

// 监听来自 popup 和 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startCapture') {
    startCapturing();
    sendResponse({ success: true });
  } else if (request.action === 'stopCapture') {
    stopCapturing();
    sendResponse({ success: true });
  } else if (request.action === 'getCapturedRequests') {
    sendResponse({ requests: capturedRequests });
  } else if (request.action === 'clearRequests') {
    capturedRequests = [];
    sendResponse({ success: true });
  } else if (request.action === 'interceptedRequest') {
    // 处理来自 content script 的拦截请求
    const requestInfo = request.request;
    capturedRequests.unshift(requestInfo);
    
    // 限制保存的请求数量
    if (capturedRequests.length > 100) {
      capturedRequests = capturedRequests.slice(0, 100);
    }
    
    // 通知其他组件有新请求
    chrome.runtime.sendMessage({
      action: 'newRequest',
      request: requestInfo
    }).catch(() => {
      // 忽略错误
    });
    
    sendResponse({ success: true });
  }
});

// 开始捕获请求
function startCapturing() {
  if (isCapturing) return;
  
  isCapturing = true;
  capturedRequests = [];
  
  // 监听所有网络请求
  chrome.webRequest.onBeforeRequest.addListener(
    handleRequest,
    { urls: ["<all_urls>"] },
    ["requestBody"]
  );
  
  console.log('开始捕获网络请求...');
}

// 停止捕获请求
function stopCapturing() {
  if (!isCapturing) return;
  
  isCapturing = false;
  
  if (chrome.webRequest.onBeforeRequest.hasListener(handleRequest)) {
    chrome.webRequest.onBeforeRequest.removeListener(handleRequest);
  }
  
  console.log('停止捕获网络请求');
}

// 处理拦截到的请求
function handleRequest(details) {
  try {
    // 只处理 POST 请求
    if (details.method !== 'POST') return;
    
    // 检查是否是我们感兴趣的 API 端点
    const url = new URL(details.url);
    const isTargetAPI = isTargetEndpoint(url.pathname);
    
    if (!isTargetAPI) return;
    
    let requestData = null;
    let decodedData = [];
    
    // 解析请求体
    if (details.requestBody) {
      if (details.requestBody.raw) {
        // 处理原始数据
        const rawData = details.requestBody.raw[0];
        if (rawData.bytes) {
          const decoder = new TextDecoder();
          const bodyText = decoder.decode(rawData.bytes);
          requestData = bodyText;
          
          // 尝试解析 JSON 并查找 base64 数据
          try {
            const jsonData = JSON.parse(bodyText);
            decodedData = findAndDecodeBase64(jsonData);
          } catch (e) {
            // 不是 JSON 格式，尝试直接解码
            if (isBase64(bodyText)) {
              try {
                const decoded = atob(bodyText);
                decodedData.push({
                  field: 'request_body',
                  original: bodyText,
                  decoded: tryParseJSON(decoded)
                });
              } catch (decodeError) {
                console.warn('Base64 解码失败:', decodeError);
              }
            }
          }
        }
      } else if (details.requestBody.formData) {
        // 处理表单数据
        requestData = JSON.stringify(details.requestBody.formData);
        
        // 检查表单数据中的 base64
        for (const [key, values] of Object.entries(details.requestBody.formData)) {
          values.forEach(value => {
            if (isBase64(value)) {
              try {
                const decoded = atob(value);
                decodedData.push({
                  field: key,
                  original: value,
                  decoded: tryParseJSON(decoded)
                });
              } catch (decodeError) {
                console.warn('Base64 解码失败:', decodeError);
              }
            }
          });
        }
      }
    }
    
    // 只保存有 base64 数据的请求或目标 API
    if (decodedData.length > 0 || isTargetAPI) {
      const requestInfo = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        url: details.url,
        method: details.method,
        requestData: requestData,
        decodedData: decodedData,
        isTargetAPI: isTargetAPI
      };
      
      capturedRequests.unshift(requestInfo);
      
      // 限制保存的请求数量
      if (capturedRequests.length > 100) {
        capturedRequests = capturedRequests.slice(0, 100);
      }
      
      // 通知 popup 有新请求
      chrome.runtime.sendMessage({
        action: 'newRequest',
        request: requestInfo
      }).catch(() => {
        // popup 可能未打开，忽略错误
      });
    }
    
  } catch (error) {
    console.error('处理请求时出错:', error);
  }
}

// 检查是否是目标 API 端点
function isTargetEndpoint(pathname) {
  // 只监控这一个特定的 API 端点
  return pathname.includes('/api/statistics/v2/track');
}

// 查找并解码 JSON 对象中的 base64 数据
function findAndDecodeBase64(obj, path = '') {
  const results = [];
  
  if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (typeof value === 'string' && isBase64(value) && value.length > 20) {
        try {
          const decoded = atob(value);
          results.push({
            field: currentPath,
            original: value,
            decoded: tryParseJSON(decoded)
          });
        } catch (e) {
          console.warn(`无法解码 ${currentPath}:`, e);
        }
      } else if (typeof value === 'object') {
        results.push(...findAndDecodeBase64(value, currentPath));
      }
    }
  }
  
  return results;
}

// 检查字符串是否是 base64
function isBase64(str) {
  if (!str || typeof str !== 'string' || str.length < 4) return false;
  
  // Base64 正则表达式
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  return base64Regex.test(str) && str.length % 4 === 0;
}

// 尝试解析 JSON
function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
}

// 插件启动时自动开始捕获
chrome.runtime.onStartup.addListener(() => {
  startCapturing();
});

chrome.runtime.onInstalled.addListener(() => {
  startCapturing();
});
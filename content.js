// 内容脚本 - 拦截 XHR 和 Fetch 请求
(function () {
  "use strict";
    
  // 工具函数（content script 无法 import，需内联）
  const decodeBase64UTF8 = (base64Str) => {
    const binaryStr = atob(base64Str);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  };

  const isBase64 = (str) => {
    if (!str || typeof str !== "string" || str.length < 4) return false;
    return /^[A-Za-z0-9+/]*={0,2}$/.test(str) && str.length % 4 === 0;
  };

  const tryParseJSON = (str) => {
    try { return JSON.parse(str); } catch (e) { return str; }
  };

  const findAndDecodeBase64 = (obj, path = "") => {
    const results = [];
    if (typeof obj === "object" && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        if (key === "data" && typeof value === "string" && isBase64(value)) {
          try {
            results.push({
              field: currentPath,
              original: value,
              decoded: tryParseJSON(decodeBase64UTF8(value)),
            });
          } catch (e) {
            console.warn(`无法解码 ${currentPath}:`, e);
          }
        } else if (typeof value === "object") {
          results.push(...findAndDecodeBase64(value, currentPath));
        }
      }
    }
    return results;
  };

  const isTargetAPI = (url) => url.includes("/api/statistics/v2/track");

  // 拦截 XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    this._method = method;
    this._url = url;
    return originalXHROpen.apply(this, [method, url, ...args]);
  };

  XMLHttpRequest.prototype.send = function (data) {
    if (this._method === "POST" && data) interceptRequest(this._url, this._method, data);
    return originalXHRSend.apply(this, [data]);
  };

  // 拦截 Fetch API
  const originalFetch = window.fetch;
  window.fetch = function (input, init = {}) {
    const url = typeof input === "string" ? input : input.url;
    const method = init.method || "GET";
    if (method.toUpperCase() === "POST" && init.body) interceptRequest(url, method, init.body);
    return originalFetch.apply(this, arguments);
  };

  function interceptRequest(url, method, data) {
    try {
      if (!isTargetAPI(url)) return;

      let requestData = data;
      let decodedData = [];

      if (typeof data === "string") {
        requestData = data;
        try {
          decodedData = findAndDecodeBase64(JSON.parse(data));
        } catch (e) {
          if (isBase64(data)) {
            try {
              decodedData.push({
                field: "request_body",
                original: data,
                decoded: tryParseJSON(decodeBase64UTF8(data)),
              });
            } catch (decodeError) {
              console.warn("Base64 解码失败:", decodeError);
            }
          }
        }
      } else if (data instanceof FormData) {
        const formObj = {};
        for (const [key, value] of data.entries()) {
          formObj[key] = value;
          if (typeof value === "string" && isBase64(value)) {
            try {
              decodedData.push({
                field: key,
                original: value,
                decoded: tryParseJSON(decodeBase64UTF8(value)),
              });
            } catch (decodeError) {
              console.warn("Base64 解码失败:", decodeError);
            }
          }
        }
        requestData = JSON.stringify(formObj);
      }

      if (decodedData.length > 0) {
        const requestInfo = {
          id: Date.now() + Math.random(),
          timestamp: new Date().toISOString(),
          url,
          method: method.toUpperCase(),
          requestData,
          decodedData,
          isTargetAPI: true,
          source: "content_script",
        };

        chrome.runtime.sendMessage({ action: "interceptedRequest", request: requestInfo }).catch(() => {});

        console.group(`🔍 检测到 Base64 数据 - ${url}`);
        decodedData.forEach((item) => {
          console.log(`字段: ${item.field}`);
          console.log("原始数据:", item.original.substring(0, 100) + "...");
          console.log("解码结果:", item.decoded);
        });
        console.groupEnd();
      }
    } catch (error) {
      console.error("拦截请求时出错:", error);
    }
  }

  console.log("🔍 Network Request Base64 Decoder 已加载");
})();

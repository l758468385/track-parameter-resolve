// 内容脚本 - 拦截 XHR 和 Fetch 请求
(function () {
  "use strict";

  // 拦截 XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    this._method = method;
    this._url = url;
    return originalXHROpen.apply(this, [method, url, ...args]);
  };

  XMLHttpRequest.prototype.send = function (data) {
    if (this._method === "POST" && data) {
      interceptRequest(this._url, this._method, data);
    }
    return originalXHRSend.apply(this, [data]);
  };

  // 拦截 Fetch API
  const originalFetch = window.fetch;
  window.fetch = function (input, init = {}) {
    const url = typeof input === "string" ? input : input.url;
    const method = init.method || "GET";

    if (method.toUpperCase() === "POST" && init.body) {
      interceptRequest(url, method, init.body);
    }

    return originalFetch.apply(this, arguments);
  };

  // 处理拦截到的请求
  function interceptRequest(url, method, data) {
    try {
      // 检查是否是目标 API
      if (!isTargetAPI(url)) return;

      let requestData = data;
      let decodedData = [];

      // 处理不同类型的数据
      if (typeof data === "string") {
        requestData = data;

        // 尝试解析 JSON
        try {
          const jsonData = JSON.parse(data);
          decodedData = findAndDecodeBase64(jsonData);
        } catch (e) {
          // 不是 JSON，检查是否直接是 base64
          if (isBase64(data)) {
            try {
              const decoded = decodeBase64UTF8(data);
              decodedData.push({
                field: "request_body",
                original: data,
                decoded: tryParseJSON(decoded),
              });
            } catch (decodeError) {
              console.warn("Base64 解码失败:", decodeError);
            }
          }
        }
      } else if (data instanceof FormData) {
        // 处理 FormData
        const formObj = {};
        for (const [key, value] of data.entries()) {
          formObj[key] = value;

          if (typeof value === "string" && isBase64(value)) {
            try {
              const decoded = decodeBase64UTF8(value);
              decodedData.push({
                field: key,
                original: value,
                decoded: tryParseJSON(decoded),
              });
            } catch (decodeError) {
              console.warn("Base64 解码失败:", decodeError);
            }
          }
        }
        requestData = JSON.stringify(formObj);
      }

      // 如果找到了 base64 数据，发送给 background script
      if (decodedData.length > 0) {
        const requestInfo = {
          id: Date.now() + Math.random(),
          timestamp: new Date().toISOString(),
          url: url,
          method: method.toUpperCase(),
          requestData: requestData,
          decodedData: decodedData,
          isTargetAPI: true,
          source: "content_script",
        };

        // 发送给 background script
        chrome.runtime
          .sendMessage({
            action: "interceptedRequest",
            request: requestInfo,
          })
          .catch(() => {
            // 忽略错误，可能是 background script 未准备好
          });

        // 在控制台输出解码结果
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

  // 检查是否是目标 API
  function isTargetAPI(url) {
    const targetPatterns = ["/api/statistics/v2/track"];

    return targetPatterns.some((pattern) => url.includes(pattern));
  }

  // Base64 解码并正确处理 UTF-8
  function decodeBase64UTF8(base64Str) {
    // 先用 atob 解码 base64
    const binaryStr = atob(base64Str);
    // 将二进制字符串转换为字节数组
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    // 使用 TextDecoder 正确解码 UTF-8
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(bytes);
  }

  // 查找并解码 JSON 对象中的 data 字段
  function findAndDecodeBase64(obj, path = "") {
    const results = [];

    if (typeof obj === "object" && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;

        // 只处理名为 'data' 的字段
        if (key === "data" && typeof value === "string") {
          try {
            const decoded = decodeBase64UTF8(value);
            results.push({
              field: currentPath,
              original: value,
              decoded: tryParseJSON(decoded),
            });
          } catch (e) {
            console.warn(`无法解码 ${currentPath}:`, e);
          }
        } else if (typeof value === "object") {
          // 递归检查嵌套对象中的 data 字段
          results.push(...findAndDecodeBase64(value, currentPath));
        }
      }
    }

    return results;
  }

  // 检查字符串是否是 base64
  function isBase64(str) {
    if (!str || typeof str !== "string" || str.length < 4) return false;

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

  console.log("🔍 Network Request Base64 Decoder 已加载");
})();

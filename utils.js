// 公共工具函数
const Utils = {
  // Base64 解码并正确处理 UTF-8
  decodeBase64UTF8(base64Str) {
    const binaryStr = atob(base64Str);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return new TextDecoder("utf-8").decode(bytes);
  },

  // 检查字符串是否是 base64
  isBase64(str) {
    if (!str || typeof str !== "string" || str.length < 4) return false;
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    return base64Regex.test(str) && str.length % 4 === 0;
  },

  // 尝试解析 JSON
  tryParseJSON(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return str;
    }
  },

  // 查找并解码 JSON 对象中的 data 字段（统一只处理 data 字段）
  findAndDecodeBase64(obj, path = "") {
    const results = [];
    if (typeof obj === "object" && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        if (key === "data" && typeof value === "string" && this.isBase64(value)) {
          try {
            const decoded = this.decodeBase64UTF8(value);
            results.push({
              field: currentPath,
              original: value,
              decoded: this.tryParseJSON(decoded),
            });
          } catch (e) {
            console.warn(`无法解码 ${currentPath}:`, e);
          }
        } else if (typeof value === "object") {
          results.push(...this.findAndDecodeBase64(value, currentPath));
        }
      }
    }
    return results;
  },

  // 检查是否是目标 API 端点
  isTargetEndpoint(url) {
    return url.includes("/api/statistics/v2/track");
  },

  // 格式化 JSON
  formatJSON(data) {
    return typeof data === "object" ? JSON.stringify(data, null, 2) : data;
  },

  // 复制到剪贴板
  copyToClipboard(text, btn) {
    const doCopy = (copyText) => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(copyText);
      }
      return Promise.reject("no clipboard api");
    };

    const showSuccess = () => {
      const originalText = btn.textContent;
      const originalBg = btn.style.background;
      btn.textContent = "已复制!";
      btn.style.background = "#34a853";
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = originalBg;
      }, 1500);
    };

    const fallbackCopy = (copyText) => {
      const textarea = document.createElement("textarea");
      textarea.value = copyText;
      textarea.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        if (document.execCommand("copy")) {
          showSuccess();
        } else {
          alert("复制失败，请手动复制");
        }
      } catch (e) {
        alert("复制失败，请手动复制");
      }
      document.body.removeChild(textarea);
    };

    doCopy(text).then(showSuccess).catch(() => fallbackCopy(text));
  },

  // 防抖函数
  debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }
};

// 兼容不同环境
if (typeof module !== "undefined" && module.exports) {
  module.exports = Utils;
}

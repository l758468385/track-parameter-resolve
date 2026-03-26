// 公共工具函数

/** Base64 解码并正确处理 UTF-8 */
export function decodeBase64UTF8(base64Str: string): string {
  const binaryStr = atob(base64Str)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return new TextDecoder("utf-8").decode(bytes)
}

/** 检查字符串是否是 base64 */
export function isBase64(str: string): boolean {
  if (!str || typeof str !== "string" || str.length < 4) return false
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
  return base64Regex.test(str) && str.length % 4 === 0
}

/** 尝试解析 JSON */
export function tryParseJSON(str: string): any {
  try {
    return JSON.parse(str)
  } catch {
    return str
  }
}

export interface DecodedItem {
  field: string
  original: string
  decoded: any
}

/** 查找并解码 JSON 对象中的 data 字段 */
export function findAndDecodeBase64(obj: any, path = ""): DecodedItem[] {
  const results: DecodedItem[] = []
  if (typeof obj === "object" && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key
      if (key === "data" && typeof value === "string" && isBase64(value)) {
        try {
          const decoded = decodeBase64UTF8(value)
          results.push({
            field: currentPath,
            original: value,
            decoded: tryParseJSON(decoded)
          })
        } catch (e) {
          console.warn(`无法解码 ${currentPath}:`, e)
        }
      } else if (typeof value === "object") {
        results.push(...findAndDecodeBase64(value, currentPath))
      }
    }
  }
  return results
}

/** 检查是否是目标 API 端点 */
export function isTargetEndpoint(url: string): boolean {
  return url.includes("/api/statistics/v2/track")
}

/** 格式化 JSON */
export function formatJSON(data: any): string {
  return typeof data === "object" ? JSON.stringify(data, null, 2) : data
}

/** 防抖函数 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return function (...args: Parameters<T>) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export type RequestOrder = "newest-first" | "oldest-first"

export const DEFAULT_REQUEST_ORDER: RequestOrder = "oldest-first"

const REQUEST_ORDER_STORAGE_KEY = "requestOrder"

function getStorageArea() {
  return chrome.storage.local
}

export function getOrderedRequests<T>(requests: T[], order: RequestOrder): T[] {
  return order === "newest-first" ? requests : [...requests].reverse()
}

export function getRequestOrderLabel(order: RequestOrder): string {
  return order === "newest-first" ? "最新在上" : "最早在上"
}

export async function loadRequestOrder(): Promise<RequestOrder> {
  return new Promise((resolve) => {
    getStorageArea().get(REQUEST_ORDER_STORAGE_KEY, (result) => {
      if (chrome.runtime.lastError) {
        console.error("读取排序偏好失败:", chrome.runtime.lastError)
        resolve(DEFAULT_REQUEST_ORDER)
        return
      }

      const storedOrder = result[REQUEST_ORDER_STORAGE_KEY]
      resolve(storedOrder === "newest-first" ? storedOrder : DEFAULT_REQUEST_ORDER)
    })
  })
}

export async function saveRequestOrder(order: RequestOrder): Promise<void> {
  return new Promise((resolve, reject) => {
    getStorageArea().set({ [REQUEST_ORDER_STORAGE_KEY]: order }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError)
        return
      }

      resolve()
    })
  })
}

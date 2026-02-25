import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock crypto.randomUUID
if (!window.crypto?.randomUUID) {
  Object.defineProperty(window, 'crypto', {
    value: {
      randomUUID: () => Math.random().toString(36).substring(2) + Date.now().toString(36),
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256)
        return arr
      },
    },
  })
}

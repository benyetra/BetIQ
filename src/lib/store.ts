import { Bet, Upload, Strategy, ChatMessage, AIInsight } from '@/types/betting'

// --- IndexedDB for large data (bets) ---

const DB_NAME = 'betiq'
const DB_VERSION = 1
const BETS_STORE = 'bets'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(BETS_STORE)) {
        db.createObjectStore(BETS_STORE, { keyPath: 'bet_id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function idbGetAll(): Promise<Bet[]> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BETS_STORE, 'readonly')
      const req = tx.objectStore(BETS_STORE).getAll()
      req.onsuccess = () => resolve(req.result as Bet[])
      req.onerror = () => reject(req.error)
    })
  } catch {
    return []
  }
}

async function idbPutMany(bets: Bet[]): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(BETS_STORE, 'readwrite')
    const objectStore = tx.objectStore(BETS_STORE)
    for (const bet of bets) {
      objectStore.put(bet)
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (e) {
    console.error('IndexedDB put failed:', e)
  }
}

async function idbClear(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(BETS_STORE, 'readwrite')
    tx.objectStore(BETS_STORE).clear()
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (e) {
    console.error('IndexedDB clear failed:', e)
  }
}

// --- localStorage for small data ---

const STORAGE_KEYS = {
  UPLOADS: 'betiq_uploads',
  STRATEGIES: 'betiq_strategies',
  CHAT_HISTORY: 'betiq_chat_history',
  INSIGHTS: 'betiq_insights',
}

function getFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  } catch {
    return defaultValue
  }
}

function setToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error('localStorage write failed:', e)
  }
}

export const store = {
  // Bets — IndexedDB (async)
  getBets: (): Promise<Bet[]> => {
    if (typeof window === 'undefined') return Promise.resolve([])
    return idbGetAll()
  },
  setBets: async (bets: Bet[]): Promise<void> => {
    await idbClear()
    await idbPutMany(bets)
  },
  addBets: async (newBets: Bet[]): Promise<{ merged: Bet[]; total: number; new: number; duplicates: number }> => {
    const existing = await idbGetAll()
    const existingIds = new Set(existing.map(b => b.bet_id))
    const unique = newBets.filter(b => !existingIds.has(b.bet_id))
    const merged = [...existing, ...unique]
    await idbPutMany(unique)
    return { merged, total: merged.length, new: unique.length, duplicates: newBets.length - unique.length }
  },

  // Uploads — localStorage
  getUploads: (): Upload[] => getFromStorage(STORAGE_KEYS.UPLOADS, []),
  addUpload: (upload: Upload) => {
    const uploads = store.getUploads()
    uploads.push(upload)
    setToStorage(STORAGE_KEYS.UPLOADS, uploads)
  },

  // Strategies — localStorage
  getStrategies: (): Strategy[] => getFromStorage(STORAGE_KEYS.STRATEGIES, []),
  setStrategies: (strategies: Strategy[]) => setToStorage(STORAGE_KEYS.STRATEGIES, strategies),
  addStrategy: (strategy: Strategy) => {
    const strategies = store.getStrategies()
    strategies.push(strategy)
    store.setStrategies(strategies)
  },

  // Chat — localStorage
  getChatHistory: (): ChatMessage[] => getFromStorage(STORAGE_KEYS.CHAT_HISTORY, []),
  addChatMessage: (message: ChatMessage) => {
    const messages = store.getChatHistory()
    messages.push(message)
    setToStorage(STORAGE_KEYS.CHAT_HISTORY, messages)
  },
  clearChatHistory: () => setToStorage(STORAGE_KEYS.CHAT_HISTORY, []),

  // Insights — localStorage
  getInsights: (): AIInsight[] => getFromStorage(STORAGE_KEYS.INSIGHTS, []),
  setInsights: (insights: AIInsight[]) => setToStorage(STORAGE_KEYS.INSIGHTS, insights),

  clearAll: async () => {
    await idbClear()
    Object.values(STORAGE_KEYS).forEach(key => {
      if (typeof window !== 'undefined') localStorage.removeItem(key)
    })
    // Also remove legacy localStorage bets key
    if (typeof window !== 'undefined') localStorage.removeItem('betiq_bets')
  }
}

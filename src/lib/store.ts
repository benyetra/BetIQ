import { Bet, Upload, Strategy, ChatMessage, AIInsight } from '@/types/betting'

const STORAGE_KEYS = {
  BETS: 'betiq_bets',
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
    console.error('Failed to save to localStorage:', e)
  }
}

export const store = {
  getBets: (): Bet[] => getFromStorage(STORAGE_KEYS.BETS, []),
  setBets: (bets: Bet[]) => setToStorage(STORAGE_KEYS.BETS, bets),
  addBets: (newBets: Bet[]) => {
    const existing = store.getBets()
    const existingIds = new Set(existing.map(b => b.bet_id))
    const unique = newBets.filter(b => !existingIds.has(b.bet_id))
    const merged = [...existing, ...unique]
    store.setBets(merged)
    return { total: merged.length, new: unique.length, duplicates: newBets.length - unique.length }
  },

  getUploads: (): Upload[] => getFromStorage(STORAGE_KEYS.UPLOADS, []),
  addUpload: (upload: Upload) => {
    const uploads = store.getUploads()
    uploads.push(upload)
    setToStorage(STORAGE_KEYS.UPLOADS, uploads)
  },

  getStrategies: (): Strategy[] => getFromStorage(STORAGE_KEYS.STRATEGIES, []),
  setStrategies: (strategies: Strategy[]) => setToStorage(STORAGE_KEYS.STRATEGIES, strategies),
  addStrategy: (strategy: Strategy) => {
    const strategies = store.getStrategies()
    strategies.push(strategy)
    store.setStrategies(strategies)
  },

  getChatHistory: (): ChatMessage[] => getFromStorage(STORAGE_KEYS.CHAT_HISTORY, []),
  addChatMessage: (message: ChatMessage) => {
    const messages = store.getChatHistory()
    messages.push(message)
    setToStorage(STORAGE_KEYS.CHAT_HISTORY, messages)
  },
  clearChatHistory: () => setToStorage(STORAGE_KEYS.CHAT_HISTORY, []),

  getInsights: (): AIInsight[] => getFromStorage(STORAGE_KEYS.INSIGHTS, []),
  setInsights: (insights: AIInsight[]) => setToStorage(STORAGE_KEYS.INSIGHTS, insights),

  clearAll: () => {
    Object.values(STORAGE_KEYS).forEach(key => {
      if (typeof window !== 'undefined') localStorage.removeItem(key)
    })
  }
}

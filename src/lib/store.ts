import { Bet, Upload, Strategy, ChatMessage, AIInsight, BetLeg } from '@/types/betting'
import { createClient } from '@/lib/supabase/client'

// ============================================================
// Snake_case <-> camelCase transforms
// ============================================================

interface BetRow {
  id: string
  user_id: string
  bet_id: string
  sportsbook: string
  type: string
  status: string
  odds: number
  closing_line: number | null
  ev: number | null
  amount: number
  profit: number
  placed_at: string
  settled_at: string | null
  bet_info: string
  tags: string
  sports: string[]
  leagues: string[]
  legs: BetLeg[]
  leg_count: number
}

function betFromRow(row: BetRow): Bet {
  return {
    id: row.id,
    bet_id: row.bet_id,
    sportsbook: row.sportsbook,
    type: row.type as Bet['type'],
    status: row.status as Bet['status'],
    odds: Number(row.odds),
    closing_line: row.closing_line != null ? Number(row.closing_line) : null,
    ev: row.ev != null ? Number(row.ev) : null,
    amount: Number(row.amount),
    profit: Number(row.profit),
    placed_at: row.placed_at,
    settled_at: row.settled_at,
    bet_info: row.bet_info ?? '',
    tags: row.tags ?? '',
    sports: row.sports ?? [],
    leagues: row.leagues ?? [],
    legs: (row.legs ?? []) as BetLeg[],
    leg_count: row.leg_count ?? 1,
  }
}

function betToRow(bet: Bet, userId: string) {
  return {
    id: bet.id,
    user_id: userId,
    bet_id: bet.bet_id,
    sportsbook: bet.sportsbook,
    type: bet.type,
    status: bet.status,
    odds: bet.odds,
    closing_line: bet.closing_line,
    ev: bet.ev,
    amount: bet.amount,
    profit: bet.profit,
    placed_at: bet.placed_at,
    settled_at: bet.settled_at,
    bet_info: bet.bet_info,
    tags: bet.tags,
    sports: bet.sports,
    leagues: bet.leagues,
    legs: bet.legs as unknown as BetLeg[],
    leg_count: bet.leg_count,
  }
}

interface UploadRow {
  id: string
  filename: string
  uploaded_at: string
  row_count: number
  status: string
}

function uploadFromRow(row: UploadRow): Upload {
  return {
    id: row.id,
    filename: row.filename,
    uploaded_at: row.uploaded_at,
    row_count: row.row_count,
    status: row.status as Upload['status'],
  }
}

interface ChatRow {
  id: string
  role: string
  content: string
  timestamp: string
}

function chatFromRow(row: ChatRow): ChatMessage {
  return {
    id: row.id,
    role: row.role as ChatMessage['role'],
    content: row.content,
    timestamp: row.timestamp,
  }
}

interface StrategyRow {
  id: string
  name: string
  sport_focus: string[]
  market_selection: string[]
  staking_plan: string
  rules: string[]
  goals: string[]
  active: boolean
  created_at: string
}

function strategyFromRow(row: StrategyRow): Strategy {
  return {
    id: row.id,
    name: row.name,
    sportFocus: row.sport_focus ?? [],
    marketSelection: row.market_selection ?? [],
    stakingPlan: row.staking_plan ?? '',
    rules: row.rules ?? [],
    goals: row.goals ?? [],
    active: row.active ?? false,
    created_at: row.created_at,
  }
}

interface InsightRow {
  id: string
  title: string
  description: string
  impact: string
  recommendation: string
  severity: string
  category: string
  data_points: Record<string, string | number>
}

function insightFromRow(row: InsightRow): AIInsight {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    impact: row.impact ?? '',
    recommendation: row.recommendation ?? '',
    severity: row.severity as AIInsight['severity'],
    category: row.category,
    dataPoints: row.data_points ?? {},
  }
}

// ============================================================
// Store with user context
// ============================================================

let _userId: string | null = null

function getUserId(): string {
  if (!_userId) throw new Error('store.init(userId) must be called before using store')
  return _userId
}

export const store = {
  /** Initialize store with authenticated user ID. Call from AuthProvider. */
  init(userId: string) {
    _userId = userId
  },

  /** Reset store (on sign out) */
  reset() {
    _userId = null
  },

  // ---- Bets ----

  getBets: async (): Promise<Bet[]> => {
    if (!_userId) return []
    const supabase = createClient()
    const { data, error } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', _userId)
      .order('placed_at', { ascending: false })
    if (error) {
      console.error('Failed to fetch bets:', error.message)
      return []
    }
    return (data ?? []).map(betFromRow)
  },

  setBets: async (bets: Bet[]): Promise<void> => {
    const userId = getUserId()
    const supabase = createClient()
    // Delete existing bets for this user, then insert new ones
    await supabase.from('bets').delete().eq('user_id', userId)
    if (bets.length > 0) {
      const rows = bets.map(b => betToRow(b, userId))
      // Batch in chunks of 500 to avoid payload limits
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500)
        const { error } = await supabase.from('bets').insert(chunk)
        if (error) console.error('Failed to insert bets chunk:', error.message)
      }
    }
  },

  addBets: async (newBets: Bet[]): Promise<{ merged: Bet[]; total: number; new: number; duplicates: number }> => {
    const userId = getUserId()
    const supabase = createClient()

    // Upsert with conflict on (user_id, bet_id) — new bets insert, dupes are ignored
    const rows = newBets.map(b => betToRow(b, userId))
    let insertedCount = 0

    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500)
      const { data, error } = await supabase
        .from('bets')
        .upsert(chunk, { onConflict: 'user_id,bet_id', ignoreDuplicates: true })
        .select('id')
      if (error) {
        console.error('Failed to upsert bets chunk:', error.message)
      } else {
        insertedCount += (data?.length ?? 0)
      }
    }

    // Fetch all bets to return merged list
    const merged = await store.getBets()
    return {
      merged,
      total: merged.length,
      new: insertedCount,
      duplicates: newBets.length - insertedCount,
    }
  },

  // ---- Uploads ----

  getUploads: async (): Promise<Upload[]> => {
    if (!_userId) return []
    const supabase = createClient()
    const { data, error } = await supabase
      .from('uploads')
      .select('*')
      .eq('user_id', _userId)
      .order('uploaded_at', { ascending: false })
    if (error) {
      console.error('Failed to fetch uploads:', error.message)
      return []
    }
    return (data ?? []).map(uploadFromRow)
  },

  addUpload: async (upload: Upload): Promise<void> => {
    const userId = getUserId()
    const supabase = createClient()
    const { error } = await supabase.from('uploads').insert({
      id: upload.id,
      user_id: userId,
      filename: upload.filename,
      uploaded_at: upload.uploaded_at,
      row_count: upload.row_count,
      status: upload.status,
    })
    if (error) console.error('Failed to insert upload:', error.message)
  },

  // ---- Strategies ----

  getStrategies: async (): Promise<Strategy[]> => {
    if (!_userId) return []
    const supabase = createClient()
    const { data, error } = await supabase
      .from('strategies')
      .select('*')
      .eq('user_id', _userId)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Failed to fetch strategies:', error.message)
      return []
    }
    return (data ?? []).map(strategyFromRow)
  },

  setStrategies: async (strategies: Strategy[]): Promise<void> => {
    const userId = getUserId()
    const supabase = createClient()
    await supabase.from('strategies').delete().eq('user_id', userId)
    if (strategies.length > 0) {
      const rows = strategies.map(s => ({
        id: s.id,
        user_id: userId,
        name: s.name,
        sport_focus: s.sportFocus,
        market_selection: s.marketSelection,
        staking_plan: s.stakingPlan,
        rules: s.rules,
        goals: s.goals,
        active: s.active,
        created_at: s.created_at,
      }))
      const { error } = await supabase.from('strategies').insert(rows)
      if (error) console.error('Failed to insert strategies:', error.message)
    }
  },

  addStrategy: async (strategy: Strategy): Promise<void> => {
    const userId = getUserId()
    const supabase = createClient()
    const { error } = await supabase.from('strategies').insert({
      id: strategy.id,
      user_id: userId,
      name: strategy.name,
      sport_focus: strategy.sportFocus,
      market_selection: strategy.marketSelection,
      staking_plan: strategy.stakingPlan,
      rules: strategy.rules,
      goals: strategy.goals,
      active: strategy.active,
      created_at: strategy.created_at,
    })
    if (error) console.error('Failed to insert strategy:', error.message)
  },

  // ---- Chat ----

  getChatHistory: async (): Promise<ChatMessage[]> => {
    if (!_userId) return []
    const supabase = createClient()
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', _userId)
      .order('timestamp', { ascending: true })
    if (error) {
      console.error('Failed to fetch chat history:', error.message)
      return []
    }
    return (data ?? []).map(chatFromRow)
  },

  addChatMessage: async (message: ChatMessage): Promise<void> => {
    const userId = getUserId()
    const supabase = createClient()
    const { error } = await supabase.from('chat_messages').insert({
      id: message.id,
      user_id: userId,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
    })
    if (error) console.error('Failed to insert chat message:', error.message)
  },

  clearChatHistory: async (): Promise<void> => {
    if (!_userId) return
    const supabase = createClient()
    const { error } = await supabase.from('chat_messages').delete().eq('user_id', _userId)
    if (error) console.error('Failed to clear chat history:', error.message)
  },

  // ---- Insights ----

  getInsights: async (): Promise<AIInsight[]> => {
    if (!_userId) return []
    const supabase = createClient()
    const { data, error } = await supabase
      .from('insights')
      .select('*')
      .eq('user_id', _userId)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Failed to fetch insights:', error.message)
      return []
    }
    return (data ?? []).map(insightFromRow)
  },

  setInsights: async (insights: AIInsight[]): Promise<void> => {
    const userId = getUserId()
    const supabase = createClient()
    await supabase.from('insights').delete().eq('user_id', userId)
    if (insights.length > 0) {
      const rows = insights.map(i => ({
        id: i.id,
        user_id: userId,
        title: i.title,
        description: i.description,
        impact: i.impact,
        recommendation: i.recommendation,
        severity: i.severity,
        category: i.category,
        data_points: i.dataPoints,
      }))
      const { error } = await supabase.from('insights').insert(rows)
      if (error) console.error('Failed to insert insights:', error.message)
    }
  },

  // ---- Clear all ----

  clearAll: async (): Promise<void> => {
    if (!_userId) return
    const supabase = createClient()
    await Promise.all([
      supabase.from('bets').delete().eq('user_id', _userId),
      supabase.from('uploads').delete().eq('user_id', _userId),
      supabase.from('chat_messages').delete().eq('user_id', _userId),
      supabase.from('strategies').delete().eq('user_id', _userId),
      supabase.from('insights').delete().eq('user_id', _userId),
    ])
  },
}

// ============================================================
// Legacy local storage helpers (used only for migration)
// ============================================================

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

/** Check if there is any local data worth migrating */
export async function hasLocalData(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    // Check IndexedDB for bets
    const db = await openDB()
    const count = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(BETS_STORE, 'readonly')
      const req = tx.objectStore(BETS_STORE).count()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    if (count > 0) return true

    // Check localStorage
    for (const key of Object.values(STORAGE_KEYS)) {
      const stored = localStorage.getItem(key)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) return true
      }
    }
  } catch {
    // ignore
  }
  return false
}

/** Retrieve all local data for migration */
export async function getLocalData(): Promise<{
  bets: Bet[]
  uploads: Upload[]
  strategies: Strategy[]
  chatHistory: ChatMessage[]
  insights: AIInsight[]
}> {
  let bets: Bet[] = []
  try {
    const db = await openDB()
    bets = await new Promise<Bet[]>((resolve, reject) => {
      const tx = db.transaction(BETS_STORE, 'readonly')
      const req = tx.objectStore(BETS_STORE).getAll()
      req.onsuccess = () => resolve(req.result as Bet[])
      req.onerror = () => reject(req.error)
    })
  } catch {
    bets = []
  }

  return {
    bets,
    uploads: getFromStorage<Upload[]>(STORAGE_KEYS.UPLOADS, []),
    strategies: getFromStorage<Strategy[]>(STORAGE_KEYS.STRATEGIES, []),
    chatHistory: getFromStorage<ChatMessage[]>(STORAGE_KEYS.CHAT_HISTORY, []),
    insights: getFromStorage<AIInsight[]>(STORAGE_KEYS.INSIGHTS, []),
  }
}

/** Clear all local storage after successful migration */
export async function clearLocalData(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(BETS_STORE, 'readwrite')
    tx.objectStore(BETS_STORE).clear()
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // ignore
  }
  Object.values(STORAGE_KEYS).forEach(key => {
    try { localStorage.removeItem(key) } catch { /* ignore */ }
  })
  try { localStorage.removeItem('betiq_bets') } catch { /* ignore */ }
}

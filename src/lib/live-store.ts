// Store functions for tracked bets (live tracker feature)
import { TrackedBet, TrackedBetLeg, TrackedBetEvent } from '@/types/betting'
import { createClient } from '@/lib/supabase/client'

let _userId: string | null = null

function getUserId(): string {
  if (!_userId) throw new Error('liveStore.init(userId) must be called first')
  return _userId
}

// Row types matching Supabase schema
interface TrackedBetRow {
  id: string
  user_id: string
  bet_type: string
  tracking_status: string
  legs: TrackedBetLeg[]
  total_odds: number
  stake: number
  potential_payout: number
  sportsbook: string
  presentation_theme: string
  live_snapshot: Record<string, unknown> | null
  created_at: string
  settled_at: string | null
}

function trackedBetFromRow(row: TrackedBetRow): TrackedBet {
  return {
    id: row.id,
    user_id: row.user_id,
    bet_type: row.bet_type as TrackedBet['bet_type'],
    tracking_status: row.tracking_status as TrackedBet['tracking_status'],
    legs: row.legs ?? [],
    total_odds: Number(row.total_odds),
    stake: Number(row.stake),
    potential_payout: Number(row.potential_payout),
    sportsbook: row.sportsbook ?? '',
    presentation_theme: (row.presentation_theme as 'dark' | 'light') ?? 'dark',
    live_snapshot: row.live_snapshot as TrackedBet['live_snapshot'],
    created_at: row.created_at,
    settled_at: row.settled_at,
  }
}

export const liveStore = {
  init(userId: string) {
    _userId = userId
  },

  reset() {
    _userId = null
  },

  // Get all tracked bets (optionally filter by status)
  getTrackedBets: async (status?: string): Promise<TrackedBet[]> => {
    if (!_userId) return []
    const supabase = createClient()
    let query = supabase
      .from('tracked_bets')
      .select('*')
      .eq('user_id', _userId)
      .order('created_at', { ascending: false })
    if (status) {
      query = query.eq('tracking_status', status)
    }
    const { data, error } = await query
    if (error) {
      console.error('Failed to fetch tracked bets:', error.message)
      return []
    }
    return (data ?? []).map(trackedBetFromRow)
  },

  // Get a single tracked bet by ID
  getTrackedBet: async (betId: string): Promise<TrackedBet | null> => {
    if (!_userId) return null
    const supabase = createClient()
    const { data, error } = await supabase
      .from('tracked_bets')
      .select('*')
      .eq('id', betId)
      .eq('user_id', _userId)
      .single()
    if (error || !data) return null
    return trackedBetFromRow(data)
  },

  // Create a new tracked bet
  createTrackedBet: async (bet: Omit<TrackedBet, 'id' | 'user_id' | 'created_at' | 'settled_at'>): Promise<TrackedBet | null> => {
    const userId = getUserId()
    const supabase = createClient()
    const { data, error } = await supabase
      .from('tracked_bets')
      .insert({
        user_id: userId,
        bet_type: bet.bet_type,
        tracking_status: bet.tracking_status,
        legs: bet.legs,
        total_odds: bet.total_odds,
        stake: bet.stake,
        potential_payout: bet.potential_payout,
        sportsbook: bet.sportsbook,
        presentation_theme: bet.presentation_theme,
        live_snapshot: bet.live_snapshot,
      })
      .select('*')
      .single()
    if (error) {
      console.error('Failed to create tracked bet:', error.message)
      return null
    }
    return trackedBetFromRow(data)
  },

  // Update a tracked bet
  updateTrackedBet: async (betId: string, updates: Partial<TrackedBet>): Promise<TrackedBet | null> => {
    const userId = getUserId()
    const supabase = createClient()
    const row: Record<string, unknown> = {}
    if (updates.tracking_status !== undefined) row.tracking_status = updates.tracking_status
    if (updates.legs !== undefined) row.legs = updates.legs
    if (updates.live_snapshot !== undefined) row.live_snapshot = updates.live_snapshot
    if (updates.presentation_theme !== undefined) row.presentation_theme = updates.presentation_theme
    if (updates.settled_at !== undefined) row.settled_at = updates.settled_at
    if (updates.total_odds !== undefined) row.total_odds = updates.total_odds

    const { data, error } = await supabase
      .from('tracked_bets')
      .update(row)
      .eq('id', betId)
      .eq('user_id', userId)
      .select('*')
      .single()
    if (error) {
      console.error('Failed to update tracked bet:', error.message)
      return null
    }
    return trackedBetFromRow(data)
  },

  // Delete a tracked bet
  deleteTrackedBet: async (betId: string): Promise<boolean> => {
    const userId = getUserId()
    const supabase = createClient()
    const { error } = await supabase
      .from('tracked_bets')
      .delete()
      .eq('id', betId)
      .eq('user_id', userId)
    if (error) {
      console.error('Failed to delete tracked bet:', error.message)
      return false
    }
    return true
  },

  // Log a tracked bet event
  logEvent: async (betId: string, eventType: TrackedBetEvent['event_type'], payload: Record<string, unknown>): Promise<void> => {
    const supabase = createClient()
    const { error } = await supabase
      .from('tracked_bet_events')
      .insert({
        bet_id: betId,
        event_type: eventType,
        payload,
      })
    if (error) {
      console.error('Failed to log tracked bet event:', error.message)
    }
  },
}

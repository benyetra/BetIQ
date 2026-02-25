export type BetStatus = 'SETTLED_WIN' | 'SETTLED_LOSS' | 'SETTLED_PUSH' | 'SETTLED_VOID' | 'SETTLED_CASH_OUT' | 'PLACED' | 'SETTLED'

export type BetType = 'straight' | 'parlay' | 'round_robin'

export type MarketType = 'moneyline' | 'spread' | 'total' | 'player_prop' | 'first_scorer' | 'other'

export type OddsFormat = 'decimal' | 'american' | 'fractional'

export interface BetLeg {
  id: string
  market_type: MarketType
  player_name: string | null
  stat_category: string | null
  line: number | null
  direction: 'over' | 'under' | null
  matchup: string
  sport: string
  league: string
  raw: string
}

export interface Bet {
  id: string
  bet_id: string
  sportsbook: string
  type: BetType
  status: BetStatus
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

export interface Upload {
  id: string
  filename: string
  uploaded_at: string
  row_count: number
  status: 'processing' | 'complete' | 'error'
}

export interface DashboardFilters {
  dateRange: { start: string | null; end: string | null; preset: string }
  sports: string[]
  leagues: string[]
  sportsbooks: string[]
  betTypes: BetType[]
  markets: MarketType[]
  oddsRange: { min: number; max: number }
  stakeRange: { min: number; max: number }
  statuses: string[]
}

export interface SummaryStats {
  totalPL: number
  totalWagered: number
  roi: number
  winRate: number
  totalBets: number
  wins: number
  losses: number
  pushes: number
  avgBetSize: number
  avgOdds: number
  clv: number | null
  longestWinStreak: number
  longestLossStreak: number
}

export interface SportBreakdown {
  sport: string
  totalBets: number
  wins: number
  losses: number
  winRate: number
  totalWagered: number
  totalPL: number
  roi: number
  avgOdds: number
  clv: number | null
}

export interface BetTypeBreakdown {
  type: string
  totalBets: number
  wins: number
  losses: number
  winRate: number
  totalWagered: number
  totalPL: number
  roi: number
}

export interface MonthlyData {
  month: string
  bets: number
  wins: number
  winRate: number
  pl: number
  cumulativePL: number
  roi: number
  wagered: number
}

export interface TimePattern {
  hour: number
  bets: number
  winRate: number
  roi: number
  pl: number
}

export interface DayPattern {
  day: string
  bets: number
  winRate: number
  roi: number
  pl: number
}

export interface ParlayLegBreakdown {
  legs: string
  totalBets: number
  wins: number
  winRate: number
  totalPL: number
  roi: number
  avgOdds: number
}

export interface PlayerPropBreakdown {
  player: string
  totalBets: number
  wins: number
  winRate: number
  totalPL: number
  categories: string[]
}

export interface AIInsight {
  id: string
  title: string
  description: string
  impact: string
  recommendation: string
  severity: 'positive' | 'negative' | 'neutral'
  category: string
  dataPoints: Record<string, string | number>
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface Strategy {
  id: string
  name: string
  sportFocus: string[]
  marketSelection: string[]
  stakingPlan: string
  rules: string[]
  goals: string[]
  active: boolean
  created_at: string
}

export interface WhatIfScenario {
  id: string
  name: string
  description: string
  filter: {
    maxLegs?: number
    maxStake?: number
    flatUnit?: number
    evOnly?: boolean
    excludeSports?: string[]
    onlyTypes?: BetType[]
    onlyMarkets?: MarketType[]
  }
  actualPL: number
  hypotheticalPL: number
  difference: number
}

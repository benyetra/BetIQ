// Odds API utility functions for BetIQ Live Tracker
// Mirrors patterns from YetAI's optimized_odds_api_service

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4'

// Sport key mappings (matching YetAI conventions)
export const SPORT_KEYS: Record<string, string> = {
  'NFL': 'americanfootball_nfl',
  'NCAAF': 'americanfootball_ncaaf',
  'NBA': 'basketball_nba',
  'NCAAB': 'basketball_ncaab',
  'MLB': 'baseball_mlb',
  'NHL': 'icehockey_nhl',
  'MLS': 'soccer_usa_mls',
  'EPL': 'soccer_epl',
  'UFC': 'mma_mixed_martial_arts',
  'WNBA': 'basketball_wnba',
}

export const SPORT_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(SPORT_KEYS).map(([display, key]) => [key, display])
)

export const MARKET_KEYS: Record<string, string> = {
  'moneyline': 'h2h',
  'spread': 'spreads',
  'total': 'totals',
}

export interface OddsApiRequestConfig {
  apiKey: string
  endpoint: string
  params?: Record<string, string>
}

export interface OddsApiQuota {
  requestsRemaining: number | null
  requestsUsed: number | null
}

let _quota: OddsApiQuota = { requestsRemaining: null, requestsUsed: null }

export function getQuota(): OddsApiQuota {
  return { ..._quota }
}

export function updateQuota(headers: Headers): void {
  const remaining = headers.get('x-requests-remaining')
  const used = headers.get('x-requests-used')
  if (remaining !== null) _quota.requestsRemaining = parseInt(remaining, 10)
  if (used !== null) _quota.requestsUsed = parseInt(used, 10)
}

export function buildUrl(endpoint: string, params: Record<string, string> = {}): string {
  const url = new URL(`${ODDS_API_BASE}${endpoint}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

// Rate limiting: minimum 1s between requests
let _lastRequestTime = 0
const MIN_REQUEST_INTERVAL = 1100 // 1.1s to be safe

export async function rateLimitedFetch(url: string, init?: RequestInit): Promise<Response> {
  const now = Date.now()
  const timeSinceLastRequest = now - _lastRequestTime
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest))
  }
  _lastRequestTime = Date.now()
  return fetch(url, init)
}

// American odds to decimal conversion
export function americanToDecimal(american: number): number {
  if (american > 0) return (american / 100) + 1
  return (100 / Math.abs(american)) + 1
}

// Decimal odds to american conversion
export function decimalToAmerican(decimal: number): number {
  if (decimal >= 2.0) return Math.round((decimal - 1) * 100)
  return Math.round(-100 / (decimal - 1))
}

// Calculate combined parlay odds from individual decimal odds
export function calculateParlayOdds(legOdds: number[]): number {
  return legOdds.reduce((acc, odds) => acc * odds, 1)
}

// Calculate potential payout
export function calculatePayout(stake: number, decimalOdds: number): number {
  return stake * decimalOdds
}

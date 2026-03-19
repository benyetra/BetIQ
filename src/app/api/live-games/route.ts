import { NextRequest, NextResponse } from 'next/server'

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4'

// Server-side rate limiter
let lastOddsApiCall = 0
const MIN_INTERVAL_MS = 1500

// Cache: sport -> { data, timestamp }
const gamesCache = new Map<string, { data: unknown; quota: unknown; timestamp: number }>()
const CACHE_TTL_MS = 60000 // 60s cache for game listings

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.ODDS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Odds API key not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    const sport = searchParams.get('sport')

    if (!sport) {
      return NextResponse.json({ error: 'sport parameter required' }, { status: 400 })
    }

    // Check cache first
    const cached = gamesCache.get(sport)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({ games: cached.data, quota: cached.quota, cached: true })
    }

    // Enforce minimum interval
    const now = Date.now()
    const elapsed = now - lastOddsApiCall
    if (elapsed < MIN_INTERVAL_MS) {
      await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL_MS - elapsed))
    }
    lastOddsApiCall = Date.now()

    const url = new URL(`${ODDS_API_BASE}/sports/${sport}/odds`)
    url.searchParams.set('apiKey', apiKey)
    url.searchParams.set('regions', 'us')
    url.searchParams.set('markets', 'h2h,spreads,totals')
    url.searchParams.set('oddsFormat', 'american')

    const response = await fetch(url.toString())

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Odds API error:', errorText)
      if (response.status === 429 || errorText.includes('EXCEEDED_FREQ_LIMIT')) {
        if (cached) {
          return NextResponse.json({ games: cached.data, quota: cached.quota, cached: true, delayed: true })
        }
        return NextResponse.json({ error: 'Rate limit exceeded. Please wait before retrying.' }, { status: 429 })
      }
      return NextResponse.json({ error: 'Failed to fetch games' }, { status: 502 })
    }

    const data = await response.json()

    const quota = {
      requestsRemaining: response.headers.get('x-requests-remaining'),
      requestsUsed: response.headers.get('x-requests-used'),
    }

    // Cache
    gamesCache.set(sport, { data, quota, timestamp: Date.now() })

    return NextResponse.json({ games: data, quota })
  } catch (error) {
    console.error('Live games API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4'

// Server-side rate limiter: enforce minimum 1.5s between outbound Odds API calls
let lastOddsApiCall = 0
const MIN_INTERVAL_MS = 1500

// Simple in-memory cache: sport -> { data, timestamp }
const scoreCache = new Map<string, { data: unknown; quota: unknown; timestamp: number }>()
const CACHE_TTL_MS = 25000 // 25s cache (polling is 30s)

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.ODDS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Odds API key not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    const sportParam = searchParams.get('sport')
    const gameIdsParam = searchParams.get('game_ids')

    if (!sportParam) {
      return NextResponse.json({ error: 'sport parameter required' }, { status: 400 })
    }

    // Check cache first
    const cached = scoreCache.get(sportParam)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      let scores = cached.data as { id: string }[]
      if (gameIdsParam) {
        const gameIds = gameIdsParam.split(',')
        scores = scores.filter(game => gameIds.includes(game.id))
      }
      return NextResponse.json({ scores, quota: cached.quota, cached: true })
    }

    // Enforce minimum interval between Odds API calls
    const now = Date.now()
    const elapsed = now - lastOddsApiCall
    if (elapsed < MIN_INTERVAL_MS) {
      await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL_MS - elapsed))
    }
    lastOddsApiCall = Date.now()

    // Fetch scores for the sport
    const url = new URL(`${ODDS_API_BASE}/sports/${sportParam}/scores`)
    url.searchParams.set('apiKey', apiKey)
    url.searchParams.set('daysFrom', '3')

    const response = await fetch(url.toString())

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Odds API scores error:', errorText)
      if (response.status === 429 || errorText.includes('EXCEEDED_FREQ_LIMIT')) {
        // Return cached data if available, even if stale
        if (cached) {
          let scores = cached.data as { id: string }[]
          if (gameIdsParam) {
            const gameIds = gameIdsParam.split(',')
            scores = scores.filter(game => gameIds.includes(game.id))
          }
          return NextResponse.json({ scores, quota: cached.quota, cached: true, delayed: true })
        }
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
      }
      return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 502 })
    }

    const allScores = await response.json()

    const quota = {
      requestsRemaining: response.headers.get('x-requests-remaining'),
      requestsUsed: response.headers.get('x-requests-used'),
    }

    // Cache the full response
    scoreCache.set(sportParam, { data: allScores, quota, timestamp: Date.now() })

    // Filter to only requested game IDs if provided
    let scores = allScores
    if (gameIdsParam) {
      const gameIds = gameIdsParam.split(',')
      scores = allScores.filter((game: { id: string }) => gameIds.includes(game.id))
    }

    return NextResponse.json({ scores, quota })
  } catch (error) {
    console.error('Live scores API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

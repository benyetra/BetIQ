import { NextRequest, NextResponse } from 'next/server'
import { acquireSlot, getCached, setCache } from '@/lib/odds-api-queue'

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4'
const CACHE_TTL_MS = 30000 // 30s — matches polling interval

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

    const cacheKey = `scores:${sportParam}`

    // Check cache first
    const cached = getCached(cacheKey, CACHE_TTL_MS)
    if (cached) {
      let scores = cached.data as { id: string }[]
      if (gameIdsParam) {
        const gameIds = gameIdsParam.split(',')
        scores = scores.filter(game => gameIds.includes(game.id))
      }
      return NextResponse.json({
        scores,
        quota: { requestsRemaining: cached.headers['x-requests-remaining'], requestsUsed: cached.headers['x-requests-used'] },
        cached: true,
      })
    }

    // Wait for rate limiter slot
    await acquireSlot()

    const url = new URL(`${ODDS_API_BASE}/sports/${sportParam}/scores`)
    url.searchParams.set('apiKey', apiKey)
    url.searchParams.set('daysFrom', '3')

    const response = await fetch(url.toString())

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Odds API scores error:', errorText)

      // On rate limit, return stale cache if available
      const stale = getCached(cacheKey, 300000) // accept up to 5 min stale
      if (stale) {
        let scores = stale.data as { id: string }[]
        if (gameIdsParam) {
          const gameIds = gameIdsParam.split(',')
          scores = scores.filter(game => gameIds.includes(game.id))
        }
        return NextResponse.json({ scores, quota: { requestsRemaining: stale.headers['x-requests-remaining'], requestsUsed: stale.headers['x-requests-used'] }, cached: true, delayed: true })
      }
      if (response.status === 429) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
      }
      return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 502 })
    }

    const allScores = await response.json()
    const headers = {
      'x-requests-remaining': response.headers.get('x-requests-remaining'),
      'x-requests-used': response.headers.get('x-requests-used'),
    }

    // Cache full result
    setCache(cacheKey, allScores, headers)

    let scores = allScores
    if (gameIdsParam) {
      const gameIds = gameIdsParam.split(',')
      scores = allScores.filter((game: { id: string }) => gameIds.includes(game.id))
    }

    return NextResponse.json({
      scores,
      quota: { requestsRemaining: headers['x-requests-remaining'], requestsUsed: headers['x-requests-used'] },
    })
  } catch (error) {
    console.error('Live scores API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

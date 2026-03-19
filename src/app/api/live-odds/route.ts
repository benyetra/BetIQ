import { NextRequest, NextResponse } from 'next/server'
import { acquireSlot, getCached, setCache } from '@/lib/odds-api-queue'

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4'
const CACHE_TTL_MS = 60000 // 60s cache

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.ODDS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Odds API key not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    const sport = searchParams.get('sport')
    const markets = searchParams.get('markets') || 'h2h,spreads,totals'

    if (!sport) {
      return NextResponse.json({ error: 'sport parameter required' }, { status: 400 })
    }

    const cacheKey = `odds:${sport}:${markets}`

    const cached = getCached(cacheKey, CACHE_TTL_MS)
    if (cached) {
      return NextResponse.json({
        odds: cached.data,
        quota: { requestsRemaining: cached.headers['x-requests-remaining'], requestsUsed: cached.headers['x-requests-used'] },
        cached: true,
      })
    }

    await acquireSlot()

    const url = new URL(`${ODDS_API_BASE}/sports/${sport}/odds`)
    url.searchParams.set('apiKey', apiKey)
    url.searchParams.set('regions', 'us')
    url.searchParams.set('markets', markets)
    url.searchParams.set('oddsFormat', 'american')

    const response = await fetch(url.toString())

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Odds API odds error:', errorText)

      const stale = getCached(cacheKey, 300000)
      if (stale) {
        return NextResponse.json({ odds: stale.data, quota: { requestsRemaining: stale.headers['x-requests-remaining'], requestsUsed: stale.headers['x-requests-used'] }, cached: true, delayed: true })
      }
      if (response.status === 429) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
      }
      return NextResponse.json({ error: 'Failed to fetch odds' }, { status: 502 })
    }

    const data = await response.json()
    const headers = {
      'x-requests-remaining': response.headers.get('x-requests-remaining'),
      'x-requests-used': response.headers.get('x-requests-used'),
    }

    setCache(cacheKey, data, headers)

    return NextResponse.json({
      odds: data,
      quota: { requestsRemaining: headers['x-requests-remaining'], requestsUsed: headers['x-requests-used'] },
    })
  } catch (error) {
    console.error('Live odds API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

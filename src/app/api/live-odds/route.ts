import { NextRequest, NextResponse } from 'next/server'

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4'

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

    const url = new URL(`${ODDS_API_BASE}/sports/${sport}/odds`)
    url.searchParams.set('apiKey', apiKey)
    url.searchParams.set('regions', 'us')
    url.searchParams.set('markets', markets)
    url.searchParams.set('oddsFormat', 'american')

    const response = await fetch(url.toString())

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Odds API odds error:', errorText)
      if (response.status === 429) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
      }
      return NextResponse.json({ error: 'Failed to fetch odds' }, { status: 502 })
    }

    const data = await response.json()

    const quota = {
      requestsRemaining: response.headers.get('x-requests-remaining'),
      requestsUsed: response.headers.get('x-requests-used'),
    }

    return NextResponse.json({ odds: data, quota })
  } catch (error) {
    console.error('Live odds API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

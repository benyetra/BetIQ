import { NextRequest, NextResponse } from 'next/server'

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4'

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

    // Fetch scores for the sport
    const url = new URL(`${ODDS_API_BASE}/sports/${sportParam}/scores`)
    url.searchParams.set('apiKey', apiKey)
    // Only include recently completed games (3 days)
    url.searchParams.set('daysFrom', '3')

    const response = await fetch(url.toString())

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Odds API scores error:', errorText)
      if (response.status === 429) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
      }
      return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 502 })
    }

    const allScores = await response.json()

    // Filter to only requested game IDs if provided
    let scores = allScores
    if (gameIdsParam) {
      const gameIds = gameIdsParam.split(',')
      scores = allScores.filter((game: { id: string }) => gameIds.includes(game.id))
    }

    const quota = {
      requestsRemaining: response.headers.get('x-requests-remaining'),
      requestsUsed: response.headers.get('x-requests-used'),
    }

    return NextResponse.json({ scores, quota })
  } catch (error) {
    console.error('Live scores API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import Papa from 'papaparse'
import { v4 as uuidv4 } from 'uuid'
import { Bet, BetLeg, BetStatus, BetType, MarketType } from '@/types/betting'

interface RawCSVRow {
  bet_id: string
  sportsbook: string
  type: string
  status: string
  odds: string
  closing_line: string
  ev: string
  amount: string
  profit: string
  time_placed: string
  time_placed_iso: string
  time_settled: string
  time_settled_iso: string
  bet_info: string
  tags: string
  sports: string
  leagues: string
}

const SPORTSBOOK_NORMALIZATION: Record<string, string> = {
  'fanduel sportsbook': 'FanDuel',
  'fanduel': 'FanDuel',
  'draftkings': 'DraftKings',
  'draftkings sportsbook': 'DraftKings',
  'fanatics': 'Fanatics',
  'fanatics sportsbook': 'Fanatics',
  'caesars': 'Caesars',
  'caesars sportsbook': 'Caesars',
  'betmgm': 'BetMGM',
  'bet mgm': 'BetMGM',
  'sleeper': 'Sleeper',
  'espn bet': 'ESPN BET',
  'espnbet': 'ESPN BET',
  'hard rock': 'Hard Rock',
  'bet365': 'Bet365',
  'pointsbet': 'PointsBet',
  'barstool': 'Barstool',
  'fliff': 'Fliff',
}

function normalizeSportsbook(raw: string): string {
  const lower = raw.trim().toLowerCase()
  return SPORTSBOOK_NORMALIZATION[lower] || raw.trim()
}

function parseStatus(raw: string): BetStatus {
  const upper = raw.trim().toUpperCase()
  const mapping: Record<string, BetStatus> = {
    'SETTLED_WIN': 'SETTLED_WIN',
    'SETTLED_LOSS': 'SETTLED_LOSS',
    'SETTLED_PUSH': 'SETTLED_PUSH',
    'SETTLED_VOID': 'SETTLED_VOID',
    'SETTLED_CASH_OUT': 'SETTLED_CASH_OUT',
    'PLACED': 'PLACED',
    'SETTLED': 'SETTLED',
    'WIN': 'SETTLED_WIN',
    'LOSS': 'SETTLED_LOSS',
    'PUSH': 'SETTLED_PUSH',
    'VOID': 'SETTLED_VOID',
    'CASH_OUT': 'SETTLED_CASH_OUT',
    'CASHOUT': 'SETTLED_CASH_OUT',
  }
  return mapping[upper] || 'SETTLED'
}

function parseBetType(raw: string): BetType {
  const lower = raw.trim().toLowerCase()
  if (lower === 'straight' || lower === 'single') return 'straight'
  if (lower === 'parlay') return 'parlay'
  if (lower.startsWith('round_robin') || lower.startsWith('round robin')) return 'round_robin'
  return 'straight'
}

function parseMultiValue(raw: string): string[] {
  if (!raw || raw.trim() === '') return []
  return raw.split('|').map(s => s.trim()).filter(Boolean)
}

function detectMarketType(legText: string): MarketType {
  const lower = legText.toLowerCase()
  if (lower.includes(' ml') || lower.includes('moneyline') || lower.includes('money line')) return 'moneyline'
  if (lower.match(/[+-]\d+\.?\d*\s*(spread|pts|points)?/) && !lower.match(/\d+\+?\s+(pts|reb|ast|blk|stl|rec|rush|pass|td)/i)) {
    if (lower.includes('spread')) return 'spread'
  }
  if (lower.includes('over') || lower.includes('under') || lower.includes('o/u') || lower.includes('total')) {
    // Check if it's a player prop
    const propPatterns = [
      /\d+\+?\s*(pts|points|reb|rebounds|ast|assists|blk|blocks|stl|steals)/i,
      /\d+\+?\s*(rush|rushing|recv|receiving|pass|passing|rec|receptions)/i,
      /\d+\+?\s*(3pm|threes|three.?pointers|strikeouts|hits|hr|home.?runs|goals|shots)/i,
      /(pts|reb|ast|blk|stl|rush|recv|pass|rec|3pm|strikeouts|hits|hr|goals)\s*[+-]?\s*\d+/i,
    ]
    if (propPatterns.some(p => p.test(lower))) return 'player_prop'
    return 'total'
  }
  if (lower.match(/\d+\+?\s*(pts|points|reb|rebounds|ast|assists|blk|blocks|stl|steals|rush|rushing|recv|receiving|pass|passing|rec|receptions|3pm|td|touchdowns|strikeouts|hits|hr|goals|shots|saves)/i)) {
    return 'player_prop'
  }
  if (lower.includes('first scorer') || lower.includes('first td') || lower.includes('first goal') || lower.includes('anytime td') || lower.includes('anytime scorer')) return 'first_scorer'
  if (lower.includes('spread') || lower.match(/[+-]\d+\.5/)) return 'spread'
  return 'other'
}

function extractPlayerName(legText: string): string | null {
  // Try to extract player name from prop bet text patterns
  // Pattern: "Player Name Stat Category" or "Player Name O/U X.5 Category"
  const patterns = [
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z'.-]+)+)\s+(?:Over|Under|O|U|\d)/i,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z'.-]+)+)\s+\d+\+?\s*(?:pts|reb|ast|blk|stl|rush|recv|pass|rec|3pm|td|strikeouts|hits|hr|goals|shots|saves)/i,
    /^(.+?)\s+(?:Over|Under|O|U)\s+\d/i,
  ]
  for (const pattern of patterns) {
    const match = legText.match(pattern)
    if (match && match[1]) {
      const name = match[1].trim()
      // Filter out team names and common non-player patterns
      if (name.length > 3 && name.length < 40 && !name.match(/^(Over|Under|Total|Team|Game)/i)) {
        return name
      }
    }
  }
  return null
}

function extractStatCategory(legText: string): string | null {
  const lower = legText.toLowerCase()
  const categories: [RegExp, string][] = [
    [/\bpts\b|\bpoints\b/i, 'points'],
    [/\breb\b|\brebounds\b/i, 'rebounds'],
    [/\bast\b|\bassists\b/i, 'assists'],
    [/\bblk\b|\bblocks\b/i, 'blocks'],
    [/\bstl\b|\bsteals\b/i, 'steals'],
    [/\b3pm\b|\bthree.?pointers?\b|\bthrees\b/i, 'three_pointers'],
    [/\brush(?:ing)?\s*(?:yds|yards)\b/i, 'rushing_yards'],
    [/\brecv?(?:eiving)?\s*(?:yds|yards)\b/i, 'receiving_yards'],
    [/\bpass(?:ing)?\s*(?:yds|yards)\b/i, 'passing_yards'],
    [/\brec(?:eptions)?\b/i, 'receptions'],
    [/\btd\b|\btouchdowns?\b/i, 'touchdowns'],
    [/\bstrikeouts?\b|\bk\b/i, 'strikeouts'],
    [/\bhits?\b/i, 'hits'],
    [/\bhr\b|\bhome.?runs?\b/i, 'home_runs'],
    [/\bgoals?\b/i, 'goals'],
    [/\bshots?\b/i, 'shots'],
    [/\bsaves?\b/i, 'saves'],
    [/\bpra\b|\bpts\+reb\+ast\b/i, 'pts_reb_ast'],
  ]
  for (const [pattern, category] of categories) {
    if (pattern.test(lower)) return category
  }
  return null
}

function extractLine(legText: string): number | null {
  const match = legText.match(/(?:Over|Under|O|U)\s+(\d+\.?\d*)/i)
  if (match) return parseFloat(match[1])
  const spreadMatch = legText.match(/([+-]\d+\.?\d*)/)
  if (spreadMatch) return parseFloat(spreadMatch[1])
  return null
}

function extractDirection(legText: string): 'over' | 'under' | null {
  const lower = legText.toLowerCase()
  if (lower.includes('over') || lower.match(/\bO\s+\d/)) return 'over'
  if (lower.includes('under') || lower.match(/\bU\s+\d/)) return 'under'
  return null
}

function parseBetLegs(betInfo: string, sports: string[], leagues: string[]): BetLeg[] {
  if (!betInfo || betInfo.trim() === '') return []

  const legTexts = betInfo.split('|').map(s => s.trim()).filter(Boolean)

  return legTexts.map((legText, index) => {
    const market_type = detectMarketType(legText)
    const isPlayerProp = market_type === 'player_prop' || market_type === 'first_scorer'

    return {
      id: uuidv4(),
      market_type,
      player_name: isPlayerProp ? extractPlayerName(legText) : null,
      stat_category: isPlayerProp ? extractStatCategory(legText) : null,
      line: extractLine(legText),
      direction: extractDirection(legText),
      matchup: legText,
      sport: sports[index] || sports[0] || 'Unknown',
      league: leagues[index] || leagues[0] || 'Unknown',
      raw: legText,
    }
  })
}

export interface ParseResult {
  bets: Bet[]
  errors: { row: number; message: string; data?: Record<string, string> }[]
  totalRows: number
  parsedRows: number
  duplicates: number
}

export function parseCSV(csvContent: string, existingBetIds?: Set<string>): Promise<ParseResult> {
  return new Promise((resolve) => {
    const errors: ParseResult['errors'] = []
    const bets: Bet[] = []
    const seenIds = new Set<string>(existingBetIds || [])
    let duplicates = 0
    let totalRows = 0

    Papa.parse<RawCSVRow>(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: (results) => {
        totalRows = results.data.length

        results.data.forEach((row, index) => {
          try {
            // Skip if no bet_id
            if (!row.bet_id || row.bet_id.trim() === '') {
              errors.push({ row: index + 2, message: 'Missing bet_id', data: row as unknown as Record<string, string> })
              return
            }

            // Check for duplicates
            if (seenIds.has(row.bet_id.trim())) {
              duplicates++
              return
            }
            seenIds.add(row.bet_id.trim())

            const sports = parseMultiValue(row.sports || '')
            const leagues = parseMultiValue(row.leagues || '')
            const betInfo = row.bet_info || ''
            const legs = parseBetLegs(betInfo, sports, leagues)

            const bet: Bet = {
              id: uuidv4(),
              bet_id: row.bet_id.trim(),
              sportsbook: normalizeSportsbook(row.sportsbook || 'Unknown'),
              type: parseBetType(row.type || 'straight'),
              status: parseStatus(row.status || 'SETTLED'),
              odds: parseFloat(row.odds) || 1,
              closing_line: row.closing_line && row.closing_line.trim() !== '' ? parseFloat(row.closing_line) : null,
              ev: row.ev && row.ev.trim() !== '' ? parseFloat(row.ev) : null,
              amount: parseFloat(row.amount) || 0,
              profit: parseFloat(row.profit) || 0,
              placed_at: row.time_placed_iso || row.time_placed || '',
              settled_at: row.time_settled_iso || row.time_settled || null,
              bet_info: betInfo,
              tags: row.tags || '',
              sports,
              leagues,
              legs,
              leg_count: legs.length || 1,
            }

            bets.push(bet)
          } catch (err) {
            errors.push({
              row: index + 2,
              message: err instanceof Error ? err.message : 'Unknown error',
              data: row as unknown as Record<string, string>
            })
          }
        })

        resolve({
          bets,
          errors,
          totalRows,
          parsedRows: bets.length,
          duplicates,
        })
      },
      error: (error: Error) => {
        errors.push({ row: 0, message: `CSV parsing error: ${error.message}` })
        resolve({ bets: [], errors, totalRows: 0, parsedRows: 0, duplicates: 0 })
      }
    })
  })
}

export function generateSampleData(): Bet[] {
  const sportsbooks = ['FanDuel', 'DraftKings', 'Fanatics', 'Caesars', 'BetMGM', 'Sleeper', 'ESPN BET']
  const sports = ['Basketball', 'Football', 'Baseball', 'Hockey', 'Soccer']
  const leagues = ['NBA', 'NFL', 'MLB', 'NHL', 'EPL', 'NCAAM', 'NCAAFB']
  const betTypes: BetType[] = ['straight', 'parlay', 'parlay', 'straight', 'parlay', 'straight']
  const statuses: BetStatus[] = ['SETTLED_WIN', 'SETTLED_LOSS', 'SETTLED_LOSS', 'SETTLED_WIN', 'SETTLED_LOSS', 'SETTLED_PUSH']

  const bets: Bet[] = []
  const now = new Date()

  for (let i = 0; i < 500; i++) {
    const daysAgo = Math.floor(Math.random() * 365 * 2)
    const placedDate = new Date(now.getTime() - daysAgo * 86400000)
    const settledDate = new Date(placedDate.getTime() + Math.random() * 86400000 * 3)
    const sport = sports[Math.floor(Math.random() * sports.length)]
    const league = sport === 'Basketball' ? (Math.random() > 0.3 ? 'NBA' : 'NCAAM') :
                   sport === 'Football' ? (Math.random() > 0.4 ? 'NFL' : 'NCAAFB') :
                   sport === 'Baseball' ? 'MLB' : sport === 'Hockey' ? 'NHL' : 'EPL'
    const type = betTypes[Math.floor(Math.random() * betTypes.length)]
    const isParlay = type === 'parlay'
    const legCount = isParlay ? Math.floor(Math.random() * 8) + 2 : 1
    const odds = isParlay ? 1 + Math.random() * (Math.pow(2, legCount) - 1) : 1 + Math.random() * 2.5
    const amount = [5, 10, 15, 20, 25, 50, 100, 200][Math.floor(Math.random() * 8)]

    // Win probability based on odds and type
    const winProb = isParlay ? Math.max(0.03, 1 / odds * 0.85) : Math.max(0.35, 1 / odds * 0.95)
    const isWin = Math.random() < winProb
    const status = isWin ? 'SETTLED_WIN' : (Math.random() < 0.02 ? 'SETTLED_PUSH' : 'SETTLED_LOSS')
    const profit = status === 'SETTLED_WIN' ? amount * (odds - 1) : status === 'SETTLED_PUSH' ? 0 : -amount

    const hasClosingLine = Math.random() < 0.3
    const closing_line = hasClosingLine ? odds * (1 + (Math.random() - 0.48) * 0.1) : null
    const ev = hasClosingLine ? (Math.random() - 0.45) * 0.3 : null

    const playerNames = ['LeBron James', 'Luka Doncic', 'Jalen Brunson', 'Jayson Tatum', 'Nikola Jokic',
                          'Shai Gilgeous-Alexander', 'Anthony Edwards', 'Patrick Mahomes', 'Josh Allen',
                          'Lamar Jackson', 'Derrick Henry', 'Tyreek Hill', 'Cade Cunningham', 'Ja Morant']
    const statCats = ['points', 'rebounds', 'assists', 'three_pointers', 'rushing_yards', 'receiving_yards', 'touchdowns']

    const legs: BetLeg[] = []
    const betSports: string[] = []
    const betLeagues: string[] = []
    const legDescriptions: string[] = []

    for (let l = 0; l < legCount; l++) {
      const legSport = isParlay && l > 0 && Math.random() > 0.5 ? sports[Math.floor(Math.random() * sports.length)] : sport
      const legLeague = legSport === 'Basketball' ? (Math.random() > 0.3 ? 'NBA' : 'NCAAM') :
                        legSport === 'Football' ? (Math.random() > 0.4 ? 'NFL' : 'NCAAFB') :
                        legSport === 'Baseball' ? 'MLB' : legSport === 'Hockey' ? 'NHL' : 'EPL'

      const isPlayerProp = Math.random() > 0.4
      const marketType: MarketType = isPlayerProp ? 'player_prop' :
                                     Math.random() > 0.5 ? 'moneyline' :
                                     Math.random() > 0.5 ? 'spread' : 'total'

      const player = isPlayerProp ? playerNames[Math.floor(Math.random() * playerNames.length)] : null
      const stat = isPlayerProp ? statCats[Math.floor(Math.random() * statCats.length)] : null
      const line = isPlayerProp ? Math.floor(Math.random() * 30) + 5 + 0.5 :
                   marketType === 'spread' ? (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 14) + 0.5) :
                   marketType === 'total' ? Math.floor(Math.random() * 40) + 180 + 0.5 : null
      const direction: 'over' | 'under' | null = (marketType === 'player_prop' || marketType === 'total') ? (Math.random() > 0.5 ? 'over' : 'under') : null

      const legDesc = isPlayerProp ? `${player} ${direction === 'over' ? 'Over' : 'Under'} ${line} ${stat}` :
                      marketType === 'moneyline' ? `Team ${Math.floor(Math.random() * 30) + 1} ML` :
                      marketType === 'spread' ? `Team ${Math.floor(Math.random() * 30) + 1} ${(line || 0) > 0 ? '+' : ''}${line}` :
                      `${direction === 'over' ? 'Over' : 'Under'} ${line}`

      legDescriptions.push(legDesc)
      betSports.push(legSport)
      betLeagues.push(legLeague)

      legs.push({
        id: uuidv4(),
        market_type: marketType,
        player_name: player,
        stat_category: stat,
        line,
        direction,
        matchup: legDesc,
        sport: legSport,
        league: legLeague,
        raw: legDesc,
      })
    }

    bets.push({
      id: uuidv4(),
      bet_id: `sample_${i}_${Date.now()}`,
      sportsbook: sportsbooks[Math.floor(Math.random() * sportsbooks.length)],
      type,
      status: status as BetStatus,
      odds: parseFloat(odds.toFixed(2)),
      closing_line,
      ev,
      amount,
      profit: parseFloat(profit.toFixed(2)),
      placed_at: placedDate.toISOString(),
      settled_at: settledDate.toISOString(),
      bet_info: legDescriptions.join(' | '),
      tags: '',
      sports: [...new Set(betSports)],
      leagues: [...new Set(betLeagues)],
      legs,
      leg_count: legCount,
    })
  }

  return bets.sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime())
}

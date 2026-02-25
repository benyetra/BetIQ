import { describe, it, expect } from 'vitest'
import { parseCSV, generateSampleData } from '@/lib/parser'

describe('CSV Parser', () => {
  it('should parse a valid CSV with standard fields', async () => {
    const csv = `bet_id,sportsbook,type,status,odds,closing_line,ev,amount,profit,time_placed,time_placed_iso,time_settled,time_settled_iso,bet_info,tags,sports,leagues
BET001,FanDuel,straight,SETTLED_WIN,2.10,,0.05,100,110,02/24/2026 19:53:23 GMT,2026-02-24T19:53:23.751Z,02/25/2026 03:26:51 GMT,2026-02-25T03:26:51.000Z,Lakers ML,,Basketball,NBA
BET002,DraftKings,parlay,SETTLED_LOSS,6.89,3.46,0.15,50,-50,02/23/2026 15:30:00 GMT,2026-02-23T15:30:00.000Z,02/24/2026 02:00:00 GMT,2026-02-24T02:00:00.000Z,Lakers ML | Celtics -3.5,,Basketball | Basketball,NBA | NBA`

    const result = await parseCSV(csv)
    expect(result.parsedRows).toBe(2)
    expect(result.errors.length).toBe(0)
    expect(result.duplicates).toBe(0)

    const [bet1, bet2] = result.bets
    expect(bet1.bet_id).toBe('BET001')
    expect(bet1.sportsbook).toBe('FanDuel')
    expect(bet1.type).toBe('straight')
    expect(bet1.status).toBe('SETTLED_WIN')
    expect(bet1.odds).toBe(2.10)
    expect(bet1.amount).toBe(100)
    expect(bet1.profit).toBe(110)

    expect(bet2.type).toBe('parlay')
    expect(bet2.status).toBe('SETTLED_LOSS')
    expect(bet2.closing_line).toBe(3.46)
    expect(bet2.legs.length).toBe(2)
  })

  it('should detect duplicate bet_ids', async () => {
    const csv = `bet_id,sportsbook,type,status,odds,closing_line,ev,amount,profit,time_placed,time_placed_iso,time_settled,time_settled_iso,bet_info,tags,sports,leagues
BET001,FanDuel,straight,SETTLED_WIN,2.10,,,100,110,,2026-02-24T19:53:23.751Z,,,,Basketball,NBA
BET001,FanDuel,straight,SETTLED_WIN,2.10,,,100,110,,2026-02-24T19:53:23.751Z,,,,Basketball,NBA`

    const result = await parseCSV(csv)
    expect(result.parsedRows).toBe(1)
    expect(result.duplicates).toBe(1)
  })

  it('should detect duplicates against existing bet ids', async () => {
    const csv = `bet_id,sportsbook,type,status,odds,closing_line,ev,amount,profit,time_placed,time_placed_iso,time_settled,time_settled_iso,bet_info,tags,sports,leagues
BET_EXISTING,FanDuel,straight,SETTLED_WIN,2.10,,,100,110,,2026-02-24T19:53:23.751Z,,,,Basketball,NBA
BET_NEW,DraftKings,straight,SETTLED_LOSS,1.90,,,50,-50,,2026-02-23T15:30:00.000Z,,,,Football,NFL`

    const existing = new Set(['BET_EXISTING'])
    const result = await parseCSV(csv, existing)
    expect(result.parsedRows).toBe(1)
    expect(result.duplicates).toBe(1)
    expect(result.bets[0].bet_id).toBe('BET_NEW')
  })

  it('should normalize sportsbook names', async () => {
    const csv = `bet_id,sportsbook,type,status,odds,closing_line,ev,amount,profit,time_placed,time_placed_iso,time_settled,time_settled_iso,bet_info,tags,sports,leagues
B1,fanduel sportsbook,straight,SETTLED_WIN,2.0,,,10,10,,2026-01-01T00:00:00Z,,,,Basketball,NBA
B2,draftkings,straight,SETTLED_LOSS,2.0,,,10,-10,,2026-01-01T00:00:00Z,,,,Basketball,NBA
B3,bet mgm,straight,SETTLED_WIN,2.0,,,10,10,,2026-01-01T00:00:00Z,,,,Basketball,NBA`

    const result = await parseCSV(csv)
    expect(result.bets[0].sportsbook).toBe('FanDuel')
    expect(result.bets[1].sportsbook).toBe('DraftKings')
    expect(result.bets[2].sportsbook).toBe('BetMGM')
  })

  it('should parse multi-value sports and leagues', async () => {
    const csv = `bet_id,sportsbook,type,status,odds,closing_line,ev,amount,profit,time_placed,time_placed_iso,time_settled,time_settled_iso,bet_info,tags,sports,leagues
BET_MULTI,Fanatics,parlay,SETTLED_LOSS,12.0,,,25,-25,,2026-02-20T12:00:00Z,,,Celtics ML | Arsenal ML,,Basketball | Soccer,NBA | EPL`

    const result = await parseCSV(csv)
    expect(result.bets[0].sports).toEqual(['Basketball', 'Soccer'])
    expect(result.bets[0].leagues).toEqual(['NBA', 'EPL'])
    expect(result.bets[0].legs.length).toBe(2)
  })

  it('should handle rows with missing bet_id', async () => {
    const csv = `bet_id,sportsbook,type,status,odds,closing_line,ev,amount,profit,time_placed,time_placed_iso,time_settled,time_settled_iso,bet_info,tags,sports,leagues
,FanDuel,straight,SETTLED_WIN,2.0,,,10,10,,2026-01-01T00:00:00Z,,,,Basketball,NBA
BET_VALID,FanDuel,straight,SETTLED_WIN,2.0,,,10,10,,2026-01-01T00:00:00Z,,,,Basketball,NBA`

    const result = await parseCSV(csv)
    expect(result.parsedRows).toBe(1)
    expect(result.errors.length).toBe(1)
    expect(result.errors[0].message).toContain('Missing bet_id')
  })

  it('should map status variations correctly', async () => {
    const csv = `bet_id,sportsbook,type,status,odds,closing_line,ev,amount,profit,time_placed,time_placed_iso,time_settled,time_settled_iso,bet_info,tags,sports,leagues
B1,FanDuel,straight,WIN,2.0,,,10,10,,2026-01-01T00:00:00Z,,,,Basketball,NBA
B2,FanDuel,straight,LOSS,2.0,,,10,-10,,2026-01-01T00:00:00Z,,,,Basketball,NBA
B3,FanDuel,straight,PUSH,2.0,,,10,0,,2026-01-01T00:00:00Z,,,,Basketball,NBA`

    const result = await parseCSV(csv)
    expect(result.bets[0].status).toBe('SETTLED_WIN')
    expect(result.bets[1].status).toBe('SETTLED_LOSS')
    expect(result.bets[2].status).toBe('SETTLED_PUSH')
  })
})

describe('Sample Data Generator', () => {
  it('should generate 500 sample bets', () => {
    const bets = generateSampleData()
    expect(bets.length).toBe(500)
  })

  it('should include various bet types', () => {
    const bets = generateSampleData()
    const types = new Set(bets.map(b => b.type))
    expect(types.has('straight')).toBe(true)
    expect(types.has('parlay')).toBe(true)
  })

  it('should include multiple sportsbooks', () => {
    const bets = generateSampleData()
    const books = new Set(bets.map(b => b.sportsbook))
    expect(books.size).toBeGreaterThan(3)
  })

  it('should include multiple sports', () => {
    const bets = generateSampleData()
    const sports = new Set(bets.flatMap(b => b.sports))
    expect(sports.size).toBeGreaterThan(3)
  })

  it('should have structured legs for parlays', () => {
    const bets = generateSampleData()
    const parlays = bets.filter(b => b.type === 'parlay')
    expect(parlays.length).toBeGreaterThan(0)
    for (const parlay of parlays.slice(0, 10)) {
      expect(parlay.legs.length).toBeGreaterThanOrEqual(2)
      expect(parlay.leg_count).toBeGreaterThanOrEqual(2)
    }
  })

  it('should have properly calculated profits', () => {
    const bets = generateSampleData()
    for (const bet of bets.slice(0, 50)) {
      if (bet.status === 'SETTLED_WIN') {
        expect(bet.profit).toBeGreaterThan(0)
      } else if (bet.status === 'SETTLED_LOSS') {
        expect(bet.profit).toBeLessThan(0)
      }
    }
  })
})

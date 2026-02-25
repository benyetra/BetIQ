import { describe, it, expect } from 'vitest'
import { computeSummary, computeSportBreakdown, computeBetTypeBreakdown, computeMonthlyData, computeTimePatterns, computeDayPatterns, computeParlayBreakdown, computePlayerPropBreakdown, computeSportsbookBreakdown, applyFilters, generateInsights, runWhatIfScenario, DEFAULT_FILTERS } from '@/lib/analytics'
import { generateSampleData } from '@/lib/parser'
import { Bet } from '@/types/betting'

function createBet(overrides: Partial<Bet> = {}): Bet {
  return {
    id: 'test-' + Math.random(),
    bet_id: 'test-' + Math.random(),
    sportsbook: 'FanDuel',
    type: 'straight',
    status: 'SETTLED_WIN',
    odds: 2.0,
    closing_line: null,
    ev: null,
    amount: 100,
    profit: 100,
    placed_at: '2026-01-15T12:00:00Z',
    settled_at: '2026-01-15T15:00:00Z',
    bet_info: 'Lakers ML',
    tags: '',
    sports: ['Basketball'],
    leagues: ['NBA'],
    legs: [{ id: '1', market_type: 'moneyline', player_name: null, stat_category: null, line: null, direction: null, matchup: 'Lakers ML', sport: 'Basketball', league: 'NBA', raw: 'Lakers ML' }],
    leg_count: 1,
    ...overrides,
  }
}

describe('computeSummary', () => {
  it('should compute correct summary for a set of bets', () => {
    const bets = [
      createBet({ status: 'SETTLED_WIN', amount: 100, profit: 100 }),
      createBet({ status: 'SETTLED_WIN', amount: 50, profit: 50 }),
      createBet({ status: 'SETTLED_LOSS', amount: 100, profit: -100 }),
      createBet({ status: 'SETTLED_LOSS', amount: 75, profit: -75 }),
      createBet({ status: 'SETTLED_PUSH', amount: 50, profit: 0 }),
    ]
    const summary = computeSummary(bets)
    expect(summary.totalBets).toBe(5)
    expect(summary.wins).toBe(2)
    expect(summary.losses).toBe(2)
    expect(summary.pushes).toBe(1)
    expect(summary.totalPL).toBe(-25)
    expect(summary.totalWagered).toBe(375)
    expect(summary.winRate).toBeCloseTo(0.5)
    expect(summary.roi).toBeCloseTo(-25 / 375)
  })

  it('should handle empty bets array', () => {
    const summary = computeSummary([])
    expect(summary.totalBets).toBe(0)
    expect(summary.totalPL).toBe(0)
    expect(summary.winRate).toBe(0)
    expect(summary.roi).toBe(0)
  })

  it('should compute CLV when closing line data is available', () => {
    const bets = [
      createBet({ odds: 2.0, closing_line: 1.9 }),
      createBet({ odds: 2.0, closing_line: 2.1 }),
    ]
    const summary = computeSummary(bets)
    expect(summary.clv).not.toBeNull()
  })

  it('should return null CLV when no closing line data', () => {
    const bets = [
      createBet({ closing_line: null }),
    ]
    const summary = computeSummary(bets)
    expect(summary.clv).toBeNull()
  })

  it('should compute correct streaks', () => {
    const bets = [
      createBet({ status: 'SETTLED_WIN', placed_at: '2026-01-01T01:00:00Z' }),
      createBet({ status: 'SETTLED_WIN', placed_at: '2026-01-01T02:00:00Z' }),
      createBet({ status: 'SETTLED_WIN', placed_at: '2026-01-01T03:00:00Z' }),
      createBet({ status: 'SETTLED_LOSS', placed_at: '2026-01-01T04:00:00Z' }),
      createBet({ status: 'SETTLED_LOSS', placed_at: '2026-01-01T05:00:00Z' }),
    ]
    const summary = computeSummary(bets)
    expect(summary.longestWinStreak).toBe(3)
    expect(summary.longestLossStreak).toBe(2)
  })
})

describe('computeSportBreakdown', () => {
  it('should break down bets by sport', () => {
    const bets = [
      createBet({ sports: ['Basketball'], status: 'SETTLED_WIN', profit: 100 }),
      createBet({ sports: ['Basketball'], status: 'SETTLED_LOSS', profit: -50 }),
      createBet({ sports: ['Football'], status: 'SETTLED_WIN', profit: 200 }),
    ]
    const breakdown = computeSportBreakdown(bets)
    expect(breakdown.length).toBe(2)
    const basketball = breakdown.find(s => s.sport === 'Basketball')!
    expect(basketball.totalBets).toBe(2)
    expect(basketball.wins).toBe(1)
    expect(basketball.losses).toBe(1)
    expect(basketball.totalPL).toBe(50)
  })
})

describe('computeBetTypeBreakdown', () => {
  it('should break down by bet type', () => {
    const bets = [
      createBet({ type: 'straight', status: 'SETTLED_WIN', profit: 100 }),
      createBet({ type: 'parlay', status: 'SETTLED_LOSS', profit: -50 }),
      createBet({ type: 'parlay', status: 'SETTLED_LOSS', profit: -50 }),
    ]
    const breakdown = computeBetTypeBreakdown(bets)
    const straight = breakdown.find(b => b.type === 'straight')!
    const parlay = breakdown.find(b => b.type === 'parlay')!
    expect(straight.wins).toBe(1)
    expect(parlay.losses).toBe(2)
  })
})

describe('computeMonthlyData', () => {
  it('should aggregate by month with cumulative P/L', () => {
    const bets = [
      createBet({ placed_at: '2026-01-15T12:00:00Z', profit: 100 }),
      createBet({ placed_at: '2026-01-20T12:00:00Z', profit: -50 }),
      createBet({ placed_at: '2026-02-10T12:00:00Z', profit: 200 }),
    ]
    const monthly = computeMonthlyData(bets)
    expect(monthly.length).toBe(2)
    expect(monthly[0].month).toBe('2026-01')
    expect(monthly[0].pl).toBe(50)
    expect(monthly[0].cumulativePL).toBe(50)
    expect(monthly[1].month).toBe('2026-02')
    expect(monthly[1].cumulativePL).toBe(250)
  })
})

describe('applyFilters', () => {
  it('should filter by sport', () => {
    const bets = [
      createBet({ sports: ['Basketball'] }),
      createBet({ sports: ['Football'] }),
      createBet({ sports: ['Basketball', 'Football'] }),
    ]
    const filtered = applyFilters(bets, { ...DEFAULT_FILTERS, sports: ['Basketball'] })
    expect(filtered.length).toBe(2)
  })

  it('should filter by sportsbook', () => {
    const bets = [
      createBet({ sportsbook: 'FanDuel' }),
      createBet({ sportsbook: 'DraftKings' }),
    ]
    const filtered = applyFilters(bets, { ...DEFAULT_FILTERS, sportsbooks: ['FanDuel'] })
    expect(filtered.length).toBe(1)
  })

  it('should filter by bet type', () => {
    const bets = [
      createBet({ type: 'straight' }),
      createBet({ type: 'parlay' }),
      createBet({ type: 'straight' }),
    ]
    const filtered = applyFilters(bets, { ...DEFAULT_FILTERS, betTypes: ['parlay'] })
    expect(filtered.length).toBe(1)
  })

  it('should filter by date range', () => {
    const bets = [
      createBet({ placed_at: '2026-01-01T12:00:00Z' }),
      createBet({ placed_at: '2026-02-15T12:00:00Z' }),
      createBet({ placed_at: '2026-03-01T12:00:00Z' }),
    ]
    const filtered = applyFilters(bets, {
      ...DEFAULT_FILTERS,
      dateRange: { start: '2026-02-01T00:00:00Z', end: '2026-02-28T23:59:59Z', preset: 'custom' },
    })
    expect(filtered.length).toBe(1)
  })

  it('should combine filters with AND logic', () => {
    const bets = [
      createBet({ sports: ['Basketball'], sportsbook: 'FanDuel', type: 'straight' }),
      createBet({ sports: ['Basketball'], sportsbook: 'DraftKings', type: 'straight' }),
      createBet({ sports: ['Football'], sportsbook: 'FanDuel', type: 'parlay' }),
    ]
    const filtered = applyFilters(bets, {
      ...DEFAULT_FILTERS,
      sports: ['Basketball'],
      sportsbooks: ['FanDuel'],
    })
    expect(filtered.length).toBe(1)
  })
})

describe('generateInsights', () => {
  it('should generate insights for sample data', () => {
    const bets = generateSampleData()
    const insights = generateInsights(bets)
    expect(insights.length).toBeGreaterThan(0)
  })

  it('should not generate insights for too few bets', () => {
    const bets = [createBet(), createBet()]
    const insights = generateInsights(bets)
    expect(insights.length).toBe(0)
  })

  it('should include category and severity on each insight', () => {
    const bets = generateSampleData()
    const insights = generateInsights(bets)
    for (const insight of insights) {
      expect(insight.category).toBeTruthy()
      expect(['positive', 'negative', 'neutral']).toContain(insight.severity)
      expect(insight.title).toBeTruthy()
      expect(insight.description).toBeTruthy()
      expect(insight.recommendation).toBeTruthy()
    }
  })
})

describe('runWhatIfScenario', () => {
  it('should calculate difference with max legs filter', () => {
    const bets = [
      createBet({ type: 'parlay', leg_count: 6, status: 'SETTLED_LOSS', amount: 100, profit: -100 }),
      createBet({ type: 'parlay', leg_count: 3, status: 'SETTLED_WIN', amount: 50, profit: 100 }),
      createBet({ type: 'straight', leg_count: 1, status: 'SETTLED_WIN', amount: 100, profit: 100 }),
    ]
    const result = runWhatIfScenario(bets, { maxLegs: 4 })
    expect(result.actualPL).toBe(100)
    expect(result.hypotheticalPL).toBe(200) // Excluding the 6-leg parlay
  })

  it('should calculate flat unit scenario', () => {
    const bets = [
      createBet({ status: 'SETTLED_WIN', odds: 2.0, amount: 200, profit: 200 }),
      createBet({ status: 'SETTLED_LOSS', odds: 2.0, amount: 100, profit: -100 }),
    ]
    const result = runWhatIfScenario(bets, { flatUnit: 50 })
    expect(result.hypotheticalPL).toBe(0) // 50*(2-1) - 50 = 0
  })

  it('should calculate max stake scenario', () => {
    const bets = [
      createBet({ status: 'SETTLED_LOSS', amount: 500, profit: -500 }),
    ]
    const result = runWhatIfScenario(bets, { maxStake: 100 })
    expect(result.actualPL).toBe(-500)
    expect(result.hypotheticalPL).toBe(-100)
  })
})

describe('computeParlayBreakdown', () => {
  it('should break down parlays by leg count', () => {
    const bets = [
      createBet({ type: 'parlay', leg_count: 2, status: 'SETTLED_WIN' }),
      createBet({ type: 'parlay', leg_count: 2, status: 'SETTLED_LOSS' }),
      createBet({ type: 'parlay', leg_count: 5, status: 'SETTLED_LOSS' }),
      createBet({ type: 'straight', leg_count: 1, status: 'SETTLED_WIN' }),
    ]
    const breakdown = computeParlayBreakdown(bets)
    expect(breakdown.length).toBe(2)
    expect(breakdown[0].legs).toBe('2-leg')
    expect(breakdown[0].totalBets).toBe(2)
    expect(breakdown[1].legs).toBe('5-leg')
  })
})

describe('computeSportsbookBreakdown', () => {
  it('should break down by sportsbook', () => {
    const bets = [
      createBet({ sportsbook: 'FanDuel', profit: 100 }),
      createBet({ sportsbook: 'FanDuel', profit: -50 }),
      createBet({ sportsbook: 'DraftKings', profit: 200 }),
    ]
    const breakdown = computeSportsbookBreakdown(bets)
    expect(breakdown.length).toBe(2)
    const dk = breakdown.find(b => b.sportsbook === 'DraftKings')!
    expect(dk.totalPL).toBe(200)
  })
})

describe('Full pipeline with sample data', () => {
  it('should compute all analytics from sample data without errors', () => {
    const bets = generateSampleData()
    expect(() => {
      computeSummary(bets)
      computeSportBreakdown(bets)
      computeBetTypeBreakdown(bets)
      computeMonthlyData(bets)
      computeTimePatterns(bets)
      computeDayPatterns(bets)
      computeParlayBreakdown(bets)
      computePlayerPropBreakdown(bets)
      computeSportsbookBreakdown(bets)
      generateInsights(bets)
    }).not.toThrow()
  })
})

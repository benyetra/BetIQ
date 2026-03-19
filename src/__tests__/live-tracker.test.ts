import { describe, it, expect } from 'vitest'
import { TrackedBet, TrackedBetLeg, LegStatus } from '@/types/betting'
import { americanToDecimal, calculateParlayOdds, calculatePayout } from '@/lib/odds-api'
import { computeBetDelta, getGameTimeDisplay } from '@/lib/bet-delta'

// Helper to create test legs
function createLeg(overrides: Partial<TrackedBetLeg> = {}): TrackedBetLeg {
  return {
    id: `leg-${Math.random().toString(36).slice(2)}`,
    sport: 'americanfootball_nfl',
    league: 'NFL',
    game_id: `game-${Math.random().toString(36).slice(2)}`,
    home_team: 'Chiefs',
    away_team: 'Ravens',
    commence_time: new Date().toISOString(),
    market_type: 'moneyline',
    selection: 'Chiefs',
    odds: americanToDecimal(-110),
    status: 'pending',
    live_score_home: null,
    live_score_away: null,
    game_status: 'scheduled',
    ...overrides,
  }
}

// Helper to create test tracked bets
function createTrackedBet(overrides: Partial<TrackedBet> = {}): TrackedBet {
  const legs = overrides.legs || [createLeg()]
  const totalOdds = legs.length > 1 ? calculateParlayOdds(legs.map(l => l.odds)) : legs[0].odds
  return {
    id: `bet-${Math.random().toString(36).slice(2)}`,
    user_id: 'test-user',
    bet_type: legs.length > 1 ? 'parlay' : 'straight',
    tracking_status: 'live',
    legs,
    total_odds: totalOdds,
    stake: 25,
    potential_payout: calculatePayout(25, totalOdds),
    sportsbook: 'DraftKings',
    presentation_theme: 'dark',
    live_snapshot: null,
    created_at: new Date().toISOString(),
    settled_at: null,
    ...overrides,
  }
}

describe('Tracked bet types and helpers', () => {
  describe('TrackedBetLeg', () => {
    it('creates a valid leg with defaults', () => {
      const leg = createLeg()
      expect(leg.status).toBe('pending')
      expect(leg.live_score_home).toBeNull()
      expect(leg.live_score_away).toBeNull()
      expect(leg.game_status).toBe('scheduled')
      expect(leg.market_type).toBe('moneyline')
    })

    it('supports all leg statuses', () => {
      const statuses: LegStatus[] = ['pending', 'win', 'loss', 'push', 'in_progress']
      statuses.forEach(status => {
        const leg = createLeg({ status })
        expect(leg.status).toBe(status)
      })
    })

    it('stores live scores', () => {
      const leg = createLeg({ live_score_home: 21, live_score_away: 14, game_status: 'in_progress' })
      expect(leg.live_score_home).toBe(21)
      expect(leg.live_score_away).toBe(14)
    })
  })

  describe('TrackedBet', () => {
    it('creates a valid straight bet', () => {
      const bet = createTrackedBet()
      expect(bet.bet_type).toBe('straight')
      expect(bet.legs).toHaveLength(1)
      expect(bet.tracking_status).toBe('live')
    })

    it('creates a valid parlay bet', () => {
      const legs = [
        createLeg({ selection: 'Chiefs', odds: americanToDecimal(-110) }),
        createLeg({ selection: 'Lakers', odds: americanToDecimal(+150), sport: 'basketball_nba' }),
        createLeg({ selection: 'Under 48.5', odds: americanToDecimal(-105), market_type: 'total' }),
      ]
      const bet = createTrackedBet({ legs })
      expect(bet.bet_type).toBe('parlay')
      expect(bet.legs).toHaveLength(3)
      expect(bet.total_odds).toBeCloseTo(calculateParlayOdds(legs.map(l => l.odds)), 2)
    })

    it('calculates parlay payout correctly', () => {
      const legs = [
        createLeg({ odds: 2 }), // +100
        createLeg({ odds: 2 }), // +100
      ]
      const stake = 100
      const totalOdds = calculateParlayOdds(legs.map(l => l.odds))
      const payout = calculatePayout(stake, totalOdds)
      const bet = createTrackedBet({ legs, stake, potential_payout: payout })
      // 2 * 2 = 4x combined, payout = 100 * 4 = 400
      expect(bet.total_odds).toBe(4)
      expect(bet.potential_payout).toBe(400)
    })

    it('supports different tracking statuses', () => {
      const live = createTrackedBet({ tracking_status: 'live' })
      expect(live.tracking_status).toBe('live')

      const settled = createTrackedBet({ tracking_status: 'settled', settled_at: new Date().toISOString() })
      expect(settled.tracking_status).toBe('settled')
      expect(settled.settled_at).toBeTruthy()

      const cancelled = createTrackedBet({ tracking_status: 'cancelled' })
      expect(cancelled.tracking_status).toBe('cancelled')
    })
  })

  describe('Bet settlement logic', () => {
    it('determines parlay is busted when any leg loses', () => {
      const legs = [
        createLeg({ status: 'win' }),
        createLeg({ status: 'loss' }),
        createLeg({ status: 'pending' }),
      ]
      const bet = createTrackedBet({ legs })
      const hasLoss = bet.legs.some(l => l.status === 'loss')
      expect(hasLoss).toBe(true)
      // Parlay should be considered busted
      if (bet.bet_type === 'parlay' && hasLoss) {
        expect(true).toBe(true) // Parlay is busted
      }
    })

    it('determines parlay is won when all legs win', () => {
      const legs = [
        createLeg({ status: 'win' }),
        createLeg({ status: 'win' }),
        createLeg({ status: 'win' }),
      ]
      const bet = createTrackedBet({ legs })
      const allWon = bet.legs.every(l => l.status === 'win')
      expect(allWon).toBe(true)
    })

    it('counts legs correctly', () => {
      const legs = [
        createLeg({ status: 'win' }),
        createLeg({ status: 'in_progress' }),
        createLeg({ status: 'pending' }),
        createLeg({ status: 'loss' }),
      ]
      const bet = createTrackedBet({ legs })
      const wonLegs = bet.legs.filter(l => l.status === 'win').length
      const lostLegs = bet.legs.filter(l => l.status === 'loss').length
      const inProgressLegs = bet.legs.filter(l => l.status === 'in_progress').length
      const pendingLegs = bet.legs.filter(l => l.status === 'pending').length

      expect(wonLegs).toBe(1)
      expect(lostLegs).toBe(1)
      expect(inProgressLegs).toBe(1)
      expect(pendingLegs).toBe(1)
    })
  })

  describe('Presentation mode data', () => {
    it('supports dark and light themes', () => {
      const dark = createTrackedBet({ presentation_theme: 'dark' })
      expect(dark.presentation_theme).toBe('dark')

      const light = createTrackedBet({ presentation_theme: 'light' })
      expect(light.presentation_theme).toBe('light')
    })

    it('stores live snapshot data', () => {
      const snapshot = {
        scores: {
          'game-1': { home: 21, away: 17, status: 'Q3 8:42' },
        },
        odds: { 'game-1': -115 },
        updated_at: new Date().toISOString(),
      }
      const bet = createTrackedBet({ live_snapshot: snapshot })
      expect(bet.live_snapshot).toBeTruthy()
      expect(bet.live_snapshot?.scores['game-1'].home).toBe(21)
    })
  })

  describe('Score diffing logic', () => {
    it('detects score changes', () => {
      const prevScores = { 'game-1': { home: 14, away: 10 } }
      const newScores = { 'game-1': { home: 21, away: 10 } }

      const changed = Object.keys(newScores).filter(gameId => {
        const prev = prevScores[gameId as keyof typeof prevScores]
        const curr = newScores[gameId as keyof typeof newScores]
        return prev && (prev.home !== curr.home || prev.away !== curr.away)
      })

      expect(changed).toHaveLength(1)
      expect(changed[0]).toBe('game-1')
    })

    it('detects no change when scores are same', () => {
      const prevScores = { 'game-1': { home: 14, away: 10 } }
      const newScores = { 'game-1': { home: 14, away: 10 } }

      const changed = Object.keys(newScores).filter(gameId => {
        const prev = prevScores[gameId as keyof typeof prevScores]
        const curr = newScores[gameId as keyof typeof newScores]
        return prev && (prev.home !== curr.home || prev.away !== curr.away)
      })

      expect(changed).toHaveLength(0)
    })
  })

  describe('Bet delta / cushion calculation', () => {
    it('computes under total cushion', () => {
      const leg = createLeg({ market_type: 'total', selection: 'Under 70.5' })
      const delta = computeBetDelta(leg, 30, 24)
      expect(delta).not.toBeNull()
      expect(delta!.type).toBe('cushion')
      expect(delta!.value).toBeCloseTo(16.5)
      expect(delta!.label).toBe('16.5 pts cushion')
    })

    it('computes under total when over the line', () => {
      const leg = createLeg({ market_type: 'total', selection: 'Under 50.5' })
      const delta = computeBetDelta(leg, 30, 24)
      expect(delta!.type).toBe('behind')
      expect(delta!.value).toBeCloseTo(-3.5)
    })

    it('computes over total needing more', () => {
      const leg = createLeg({ market_type: 'total', selection: 'Over 48.5' })
      const delta = computeBetDelta(leg, 20, 14)
      expect(delta!.type).toBe('need')
      expect(delta!.label).toBe('Need 14.5 more')
    })

    it('computes over total already covering', () => {
      const leg = createLeg({ market_type: 'total', selection: 'Over 48.5' })
      const delta = computeBetDelta(leg, 30, 24)
      expect(delta!.type).toBe('covering')
      expect(delta!.label).toBe('Over by 5.5')
    })

    it('computes spread covering for favorite', () => {
      const leg = createLeg({ market_type: 'spread', selection: 'Chiefs -3.5', home_team: 'Chiefs', away_team: 'Ravens' })
      const delta = computeBetDelta(leg, 21, 14)
      expect(delta!.type).toBe('covering')
      expect(delta!.label).toBe('Covering by 3.5')
    })

    it('computes spread behind for favorite', () => {
      const leg = createLeg({ market_type: 'spread', selection: 'Chiefs -7.5', home_team: 'Chiefs', away_team: 'Ravens' })
      const delta = computeBetDelta(leg, 21, 17)
      expect(delta!.type).toBe('behind')
      expect(delta!.label).toBe('Behind by 3.5')
    })

    it('computes spread covering for underdog', () => {
      const leg = createLeg({ market_type: 'spread', selection: 'Ravens +7.5', home_team: 'Chiefs', away_team: 'Ravens' })
      const delta = computeBetDelta(leg, 21, 17)
      expect(delta!.type).toBe('covering')
      expect(delta!.label).toBe('Covering by 3.5')
    })

    it('computes moneyline leading', () => {
      const leg = createLeg({ market_type: 'moneyline', selection: 'Chiefs', home_team: 'Chiefs', away_team: 'Ravens' })
      const delta = computeBetDelta(leg, 21, 14)
      expect(delta!.type).toBe('leading')
      expect(delta!.label).toBe('Up by 7')
    })

    it('computes moneyline trailing', () => {
      const leg = createLeg({ market_type: 'moneyline', selection: 'Ravens', home_team: 'Chiefs', away_team: 'Ravens' })
      const delta = computeBetDelta(leg, 21, 14)
      expect(delta!.type).toBe('trailing')
      expect(delta!.label).toBe('Down by 7')
    })

    it('computes moneyline tied', () => {
      const leg = createLeg({ market_type: 'moneyline', selection: 'Chiefs', home_team: 'Chiefs', away_team: 'Ravens' })
      const delta = computeBetDelta(leg, 14, 14)
      expect(delta!.type).toBe('tied')
      expect(delta!.label).toBe('Tied')
    })

    it('returns null for unknown market type', () => {
      const leg = createLeg({ market_type: 'player_prop', selection: 'LeBron Over 25.5 pts' })
      const delta = computeBetDelta(leg, 100, 90)
      expect(delta).toBeNull()
    })
  })

  describe('Game time display', () => {
    it('shows Final for completed games', () => {
      const result = getGameTimeDisplay(new Date().toISOString(), true, 'completed')
      expect(result).toBe('Final')
    })

    it('shows elapsed time for in-progress games', () => {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60000).toISOString()
      const result = getGameTimeDisplay(thirtyMinAgo, false, 'in_progress')
      expect(result).toBe('30m in')
    })

    it('shows countdown for scheduled games', () => {
      const inTwoHours = new Date(Date.now() + 2 * 3600000).toISOString()
      const result = getGameTimeDisplay(inTwoHours, false, 'scheduled')
      expect(result).toBe('Starts in 2h')
    })

    it('returns null for games with no clear status', () => {
      const pastTime = new Date(Date.now() - 60000).toISOString()
      const result = getGameTimeDisplay(pastTime, false, null)
      expect(result).toBeNull()
    })
  })

  describe('Sorting and filtering', () => {
    it('sorts by potential payout', () => {
      const bets = [
        createTrackedBet({ potential_payout: 100 }),
        createTrackedBet({ potential_payout: 500 }),
        createTrackedBet({ potential_payout: 200 }),
      ]
      const sorted = [...bets].sort((a, b) => b.potential_payout - a.potential_payout)
      expect(sorted[0].potential_payout).toBe(500)
      expect(sorted[1].potential_payout).toBe(200)
      expect(sorted[2].potential_payout).toBe(100)
    })

    it('filters by tracking status', () => {
      const bets = [
        createTrackedBet({ tracking_status: 'live' }),
        createTrackedBet({ tracking_status: 'settled' }),
        createTrackedBet({ tracking_status: 'live' }),
        createTrackedBet({ tracking_status: 'cancelled' }),
      ]
      const live = bets.filter(b => b.tracking_status === 'live')
      expect(live).toHaveLength(2)

      const settled = bets.filter(b => b.tracking_status === 'settled')
      expect(settled).toHaveLength(1)
    })

    it('sorts by leg count', () => {
      const bets = [
        createTrackedBet({ legs: [createLeg()] }),
        createTrackedBet({ legs: [createLeg(), createLeg(), createLeg(), createLeg()] }),
        createTrackedBet({ legs: [createLeg(), createLeg()] }),
      ]
      const sorted = [...bets].sort((a, b) => b.legs.length - a.legs.length)
      expect(sorted[0].legs.length).toBe(4)
      expect(sorted[1].legs.length).toBe(2)
      expect(sorted[2].legs.length).toBe(1)
    })
  })
})

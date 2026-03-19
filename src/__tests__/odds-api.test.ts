import { describe, it, expect } from 'vitest'
import {
  americanToDecimal,
  decimalToAmerican,
  calculateParlayOdds,
  calculatePayout,
  SPORT_KEYS,
  SPORT_DISPLAY,
  buildUrl,
} from '@/lib/odds-api'

describe('odds-api utilities', () => {
  describe('americanToDecimal', () => {
    it('converts positive american odds', () => {
      expect(americanToDecimal(100)).toBe(2)
      expect(americanToDecimal(200)).toBe(3)
      expect(americanToDecimal(150)).toBe(2.5)
    })

    it('converts negative american odds', () => {
      expect(americanToDecimal(-100)).toBe(2)
      expect(americanToDecimal(-200)).toBe(1.5)
      expect(americanToDecimal(-110)).toBeCloseTo(1.909, 2)
    })
  })

  describe('decimalToAmerican', () => {
    it('converts decimal odds >= 2.0 to positive american', () => {
      expect(decimalToAmerican(2)).toBe(100)
      expect(decimalToAmerican(3)).toBe(200)
      expect(decimalToAmerican(2.5)).toBe(150)
    })

    it('converts decimal odds < 2.0 to negative american', () => {
      expect(decimalToAmerican(1.5)).toBe(-200)
    })
  })

  describe('calculateParlayOdds', () => {
    it('multiplies individual leg odds', () => {
      expect(calculateParlayOdds([2, 2])).toBe(4)
      expect(calculateParlayOdds([2, 3])).toBe(6)
      expect(calculateParlayOdds([1.5, 2, 3])).toBe(9)
    })

    it('handles single leg', () => {
      expect(calculateParlayOdds([2.5])).toBe(2.5)
    })

    it('handles empty array', () => {
      expect(calculateParlayOdds([])).toBe(1)
    })
  })

  describe('calculatePayout', () => {
    it('calculates potential payout correctly', () => {
      expect(calculatePayout(100, 2)).toBe(200)
      expect(calculatePayout(50, 3)).toBe(150)
      expect(calculatePayout(25, 4)).toBe(100)
    })
  })

  describe('SPORT_KEYS', () => {
    it('has expected sport mappings', () => {
      expect(SPORT_KEYS['NFL']).toBe('americanfootball_nfl')
      expect(SPORT_KEYS['NBA']).toBe('basketball_nba')
      expect(SPORT_KEYS['MLB']).toBe('baseball_mlb')
      expect(SPORT_KEYS['NHL']).toBe('icehockey_nhl')
    })
  })

  describe('SPORT_DISPLAY', () => {
    it('has reverse mappings', () => {
      expect(SPORT_DISPLAY['americanfootball_nfl']).toBe('NFL')
      expect(SPORT_DISPLAY['basketball_nba']).toBe('NBA')
    })
  })

  describe('buildUrl', () => {
    it('constructs API URL with params', () => {
      const url = buildUrl('/sports/basketball_nba/odds', { apiKey: 'test', markets: 'h2h' })
      expect(url).toContain('/sports/basketball_nba/odds')
      expect(url).toContain('apiKey=test')
      expect(url).toContain('markets=h2h')
    })

    it('constructs URL without params', () => {
      const url = buildUrl('/sports')
      expect(url).toContain('/sports')
    })
  })
})

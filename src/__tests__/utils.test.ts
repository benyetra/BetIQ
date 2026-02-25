import { describe, it, expect } from 'vitest'
import { formatCurrency, formatPercent, formatOddsAmerican, formatOddsDecimal, impliedProbability, formatNumber, cn } from '@/lib/utils'

describe('formatCurrency', () => {
  it('should format positive amounts', () => {
    expect(formatCurrency(1000)).toBe('$1,000')
    expect(formatCurrency(0)).toBe('$0')
    expect(formatCurrency(1234567)).toBe('$1,234,567')
  })

  it('should format negative amounts', () => {
    expect(formatCurrency(-500)).toBe('-$500')
    expect(formatCurrency(-42000)).toBe('-$42,000')
  })
})

describe('formatPercent', () => {
  it('should format decimal as percentage', () => {
    expect(formatPercent(0.5)).toBe('50.0%')
    expect(formatPercent(0.224)).toBe('22.4%')
    expect(formatPercent(0.062, 1)).toBe('6.2%')
  })

  it('should respect decimal places parameter', () => {
    expect(formatPercent(0.12345, 2)).toBe('12.35%')
    expect(formatPercent(0.5, 0)).toBe('50%')
  })
})

describe('formatOddsAmerican', () => {
  it('should format plus odds correctly', () => {
    expect(formatOddsAmerican(2.0)).toBe('+100')
    expect(formatOddsAmerican(3.0)).toBe('+200')
    expect(formatOddsAmerican(6.89)).toBe('+589')
  })

  it('should format minus odds correctly', () => {
    expect(formatOddsAmerican(1.5)).toBe('-200')
    expect(formatOddsAmerican(1.1)).toBe('-1000')
  })
})

describe('formatOddsDecimal', () => {
  it('should format to two decimal places', () => {
    expect(formatOddsDecimal(2.0)).toBe('2.00')
    expect(formatOddsDecimal(6.89)).toBe('6.89')
    expect(formatOddsDecimal(1.5)).toBe('1.50')
  })
})

describe('impliedProbability', () => {
  it('should calculate correctly', () => {
    expect(impliedProbability(2.0)).toBeCloseTo(0.5)
    expect(impliedProbability(4.0)).toBeCloseTo(0.25)
    expect(impliedProbability(1.0)).toBeCloseTo(1.0)
  })
})

describe('formatNumber', () => {
  it('should add commas to large numbers', () => {
    expect(formatNumber(1000)).toBe('1,000')
    expect(formatNumber(9000)).toBe('9,000')
  })
})

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2')
  })

  it('should handle conditional classes', () => {
    const result = cn('base', false && 'hidden', 'visible')
    expect(result).toBe('base visible')
  })

  it('should merge tailwind conflicts', () => {
    const result = cn('px-4', 'px-6')
    expect(result).toBe('px-6')
  })
})

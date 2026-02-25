import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  const abs = Math.abs(amount)
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(abs)
  return amount < 0 ? `-${formatted}` : formatted
}

export function formatCurrencyExact(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

export function formatOddsAmerican(decimalOdds: number): string {
  if (decimalOdds >= 2.0) {
    return `+${Math.round((decimalOdds - 1) * 100)}`
  } else {
    return `${Math.round(-100 / (decimalOdds - 1))}`
  }
}

export function formatOddsDecimal(decimalOdds: number): string {
  return decimalOdds.toFixed(2)
}

export function impliedProbability(decimalOdds: number): number {
  return 1 / decimalOdds
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

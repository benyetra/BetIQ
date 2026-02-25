"use client"
import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { SummaryStats } from '@/types/betting'
import { formatCurrency, formatPercent, formatNumber } from '@/lib/utils'
import { TrendingUp, TrendingDown, Target, DollarSign, BarChart3, Flame, Minus } from 'lucide-react'

interface SummaryCardsProps {
  stats: SummaryStats
}

export default function SummaryCards({ stats }: SummaryCardsProps) {
  const cards = [
    {
      label: 'Total P/L',
      value: formatCurrency(stats.totalPL),
      color: stats.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400',
      icon: stats.totalPL >= 0 ? TrendingUp : TrendingDown,
      sub: `${formatCurrency(stats.totalWagered)} wagered`,
    },
    {
      label: 'ROI',
      value: formatPercent(stats.roi),
      color: stats.roi >= 0 ? 'text-emerald-400' : 'text-red-400',
      icon: BarChart3,
      sub: `${formatNumber(stats.totalBets)} total bets`,
    },
    {
      label: 'Win Rate',
      value: formatPercent(stats.winRate),
      color: stats.winRate >= 0.5 ? 'text-emerald-400' : 'text-yellow-400',
      icon: Target,
      sub: `${stats.wins}W - ${stats.losses}L - ${stats.pushes}P`,
    },
    {
      label: 'CLV',
      value: stats.clv !== null ? `${(stats.clv * 100).toFixed(2)}%` : 'N/A',
      color: stats.clv !== null ? (stats.clv >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-zinc-500',
      icon: stats.clv !== null ? (stats.clv >= 0 ? TrendingUp : TrendingDown) : Minus,
      sub: 'Closing Line Value',
    },
    {
      label: 'Avg Bet',
      value: formatCurrency(stats.avgBetSize),
      color: 'text-blue-400',
      icon: DollarSign,
      sub: `Avg odds: ${stats.avgOdds.toFixed(2)}`,
    },
    {
      label: 'Streaks',
      value: `${stats.longestWinStreak}W / ${stats.longestLossStreak}L`,
      color: 'text-yellow-400',
      icon: Flame,
      sub: 'Longest win / loss',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.label} className="hover:border-zinc-700 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${card.color}`} />
                <span className="text-xs text-zinc-400 font-medium">{card.label}</span>
              </div>
              <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
              <div className="text-xs text-zinc-500 mt-1">{card.sub}</div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

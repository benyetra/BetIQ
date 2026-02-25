"use client"
import React, { useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bet, SummaryStats } from '@/types/betting'
import { computeSummary, computeParlayBreakdown, computeTimePatterns } from '@/lib/analytics'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { Bell, AlertTriangle, Trophy, TrendingDown, Clock, Target, CalendarDays, Phone } from 'lucide-react'

interface AlertsPanelProps {
  bets: Bet[]
}

interface Alert {
  id: string
  type: 'tilt' | 'milestone' | 'strategy' | 'digest' | 'reminder'
  severity: 'warning' | 'success' | 'info'
  title: string
  description: string
  action?: string
  icon: React.ReactNode
}

export default function AlertsPanel({ bets }: AlertsPanelProps) {
  const alerts = useMemo(() => {
    const result: Alert[] = []
    if (bets.length === 0) return result

    const summary = computeSummary(bets)
    const settled = bets.filter(b => b.status.startsWith('SETTLED'))
    const sorted = [...settled].sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime())

    // Tilt detection: look for rapid loss sequences with escalating stakes
    if (sorted.length >= 10) {
      const recent10 = sorted.slice(0, 10)
      const recentLosses = recent10.filter(b => b.status === 'SETTLED_LOSS')
      if (recentLosses.length >= 7) {
        const avgStake = recent10.reduce((s, b) => s + b.amount, 0) / 10
        const totalAvgStake = summary.avgBetSize
        if (avgStake > totalAvgStake * 1.3) {
          result.push({
            id: 'tilt-1', type: 'tilt', severity: 'warning',
            title: 'Possible Tilt Detected',
            description: `${recentLosses.length} of your last 10 bets are losses, and your recent average stake ($${avgStake.toFixed(0)}) is ${((avgStake / totalAvgStake - 1) * 100).toFixed(0)}% higher than your overall average. Consider taking a break.`,
            action: 'Take a break and review your strategy',
            icon: <AlertTriangle className="h-5 w-5 text-yellow-400" />,
          })
        }
      }
    }

    // Milestone celebrations
    if (summary.totalBets >= 100 && summary.totalBets < 110) {
      result.push({
        id: 'milestone-100', type: 'milestone', severity: 'success',
        title: '100 Bets Milestone!',
        description: `You've tracked 100+ bets in BetIQ. Your data is getting richer — insights are now more reliable.`,
        icon: <Trophy className="h-5 w-5 text-yellow-400" />,
      })
    }
    if (summary.totalBets >= 500 && summary.totalBets < 510) {
      result.push({
        id: 'milestone-500', type: 'milestone', severity: 'success',
        title: '500 Bets Milestone!',
        description: `Half a thousand bets tracked! Your statistical confidence is now very high.`,
        icon: <Trophy className="h-5 w-5 text-yellow-400" />,
      })
    }

    // Winning streak celebration
    if (summary.longestWinStreak >= 5) {
      result.push({
        id: 'streak-win', type: 'milestone', severity: 'success',
        title: `${summary.longestWinStreak}-Bet Win Streak!`,
        description: `Your longest winning streak is ${summary.longestWinStreak} bets. Keep your discipline — don't let a hot streak lead to oversized bets.`,
        icon: <Trophy className="h-5 w-5 text-emerald-400" />,
      })
    }

    // Strategy adherence: check if user is still doing 5+ leg parlays
    const parlays = computeParlayBreakdown(bets)
    const highLegParlays = parlays.filter(p => parseInt(p.legs) >= 5)
    const totalHighLeg = highLegParlays.reduce((s, p) => s + p.totalBets, 0)
    const recentHighLeg = sorted.slice(0, 50).filter(b => b.type === 'parlay' && b.leg_count >= 5).length
    if (totalHighLeg > 20 && recentHighLeg > 5) {
      const hlPL = highLegParlays.reduce((s, p) => s + p.totalPL, 0)
      if (hlPL < 0) {
        result.push({
          id: 'strategy-parlays', type: 'strategy', severity: 'warning',
          title: 'Still Placing 5+ Leg Parlays',
          description: `You've placed ${recentHighLeg} parlays with 5+ legs in your last 50 bets. These have cost you ${formatCurrency(Math.abs(hlPL))} overall. Consider sticking to 3-4 leg max.`,
          action: 'Review your parlay strategy',
          icon: <Target className="h-5 w-5 text-red-400" />,
        })
      }
    }

    // Late night betting warning
    const timePatterns = computeTimePatterns(bets)
    const lateNight = timePatterns.filter(t => t.hour >= 23 || t.hour <= 2)
    const lateNightTotal = lateNight.reduce((s, t) => s + t.bets, 0)
    const lateNightPL = lateNight.reduce((s, t) => s + t.pl, 0)
    if (lateNightTotal >= 20 && lateNightPL < 0) {
      result.push({
        id: 'behavior-latenight', type: 'strategy', severity: 'warning',
        title: 'Late Night Betting Hurting You',
        description: `You've placed ${lateNightTotal} bets after 11 PM, losing ${formatCurrency(Math.abs(lateNightPL))}. Consider setting a betting curfew.`,
        action: 'Set a betting curfew',
        icon: <Clock className="h-5 w-5 text-yellow-400" />,
      })
    }

    // Weekly digest
    const oneWeekAgo = new Date(Date.now() - 7 * 86400000)
    const weekBets = settled.filter(b => new Date(b.placed_at) >= oneWeekAgo)
    if (weekBets.length > 0) {
      const weekPL = weekBets.reduce((s, b) => s + b.profit, 0)
      const weekWins = weekBets.filter(b => b.status === 'SETTLED_WIN').length
      const weekLosses = weekBets.filter(b => b.status === 'SETTLED_LOSS').length
      result.push({
        id: 'digest-weekly', type: 'digest', severity: 'info',
        title: 'Weekly Performance Digest',
        description: `This week: ${weekBets.length} bets, ${weekWins}W-${weekLosses}L, ${formatCurrency(weekPL)} ${weekPL >= 0 ? 'profit' : 'loss'}. ${weekPL >= 0 ? 'Great week!' : 'Time to review and adjust.'}`,
        icon: <CalendarDays className="h-5 w-5 text-blue-400" />,
      })
    }

    // Upload reminder
    if (sorted.length > 0) {
      const lastBetDate = new Date(sorted[0].placed_at)
      const daysSinceLastBet = Math.floor((Date.now() - lastBetDate.getTime()) / 86400000)
      if (daysSinceLastBet > 14) {
        result.push({
          id: 'reminder-upload', type: 'reminder', severity: 'info',
          title: 'Time to Upload New Data',
          description: `Your latest bet is ${daysSinceLastBet} days old. Upload your recent exports for updated analysis and insights.`,
          action: 'Upload new CSV',
          icon: <Bell className="h-5 w-5 text-blue-400" />,
        })
      }
    }

    return result
  }, [bets])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Bell className="h-5 w-5 text-blue-400" />
        <h2 className="font-semibold text-white text-lg">Alerts & Notifications</h2>
        {alerts.length > 0 && <Badge variant="neutral">{alerts.length}</Badge>}
      </div>

      {alerts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Bell className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400">No alerts at this time. Keep betting smart!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <Card key={alert.id} className={`border-l-4 ${
              alert.severity === 'warning' ? 'border-l-yellow-500' :
              alert.severity === 'success' ? 'border-l-emerald-500' : 'border-l-blue-500'
            }`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {alert.icon}
                  <div className="flex-1">
                    <h3 className="font-medium text-white text-sm">{alert.title}</h3>
                    <p className="text-zinc-400 text-sm mt-1">{alert.description}</p>
                    {alert.action && (
                      <p className="text-emerald-400 text-xs mt-2 font-medium">{alert.action}</p>
                    )}
                  </div>
                  <Badge variant={alert.severity === 'warning' ? 'negative' : alert.severity === 'success' ? 'positive' : 'neutral'}>
                    {alert.type}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Responsible Gambling */}
      <Card className="border-zinc-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Phone className="h-4 w-4 text-zinc-400" />
            <span className="text-xs text-zinc-400 font-medium">Responsible Gambling</span>
          </div>
          <p className="text-xs text-zinc-500">
            If gambling is causing you stress or financial hardship, please reach out. National Council on Problem Gambling: 1-800-522-4700. You can also text &quot;HELP&quot; to 233-3112.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

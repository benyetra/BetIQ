"use client"
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TrackedBet } from '@/types/betting'
import { formatCurrency } from '@/lib/utils'
import ParlayLegList from '@/components/ParlayLegList'
import { cn } from '@/lib/utils'
import { Monitor, Trash2, CheckCircle, ChevronDown, ChevronUp, Clock, Zap } from 'lucide-react'

interface TrackedBetCardProps {
  bet: TrackedBet
  scores?: Record<string, { home: number; away: number; status: string }>
  onOpenPresentation?: (betId: string) => void
  onSettle?: (betId: string) => void
  onDelete?: (betId: string) => void
  isAnimating?: boolean
}

function formatOddsDisplay(odds: number): string {
  if (odds >= 2.0) return `+${Math.round((odds - 1) * 100)}`
  return `${Math.round(-100 / (odds - 1))}`
}

export default function TrackedBetCard({
  bet,
  scores,
  onOpenPresentation,
  onSettle,
  onDelete,
  isAnimating,
}: TrackedBetCardProps) {
  const [isExpanded, setIsExpanded] = useState(bet.bet_type === 'parlay')

  const isLive = bet.tracking_status === 'live'
  const isSettled = bet.tracking_status === 'settled'
  const wonLegs = bet.legs.filter(l => l.status === 'win').length
  const lostLegs = bet.legs.filter(l => l.status === 'loss').length
  const totalLegs = bet.legs.length
  const isParlay = bet.bet_type === 'parlay'

  // Determine overall bet status for styling
  const hasLoss = lostLegs > 0
  const allWon = wonLegs === totalLegs && totalLegs > 0
  const inProgress = bet.legs.some(l => l.status === 'in_progress')

  let statusColor = 'border-zinc-700'
  let statusBg = ''
  if (allWon) {
    statusColor = 'border-emerald-500/50'
    statusBg = 'bg-emerald-500/5'
  } else if (hasLoss && isParlay) {
    statusColor = 'border-red-500/30'
    statusBg = 'bg-red-500/5 opacity-75'
  } else if (inProgress) {
    statusColor = 'border-yellow-500/30'
  }

  // Single straight bet display values
  const leg = bet.legs[0]
  const scoreData = leg ? scores?.[leg.game_id] : undefined

  return (
    <Card className={cn(
      'transition-all duration-500',
      statusColor,
      statusBg,
      isAnimating && 'ring-2 ring-blue-400/50 animate-pulse'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">
              {isParlay ? `${totalLegs}-Leg Parlay` : leg?.home_team && leg?.away_team ? `${leg.home_team} vs ${leg.away_team}` : 'Straight Bet'}
            </CardTitle>
            {isLive && inProgress && (
              <Badge variant="neutral" className="bg-yellow-900/40 text-yellow-400 border-yellow-700 text-xs">
                <Zap className="h-3 w-3 mr-1" />
                LIVE
              </Badge>
            )}
            {isLive && !inProgress && (
              <Badge variant="default" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Pending
              </Badge>
            )}
            {isSettled && allWon && (
              <Badge variant="positive" className="text-xs">Won</Badge>
            )}
            {isSettled && hasLoss && (
              <Badge variant="negative" className="text-xs">Lost</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isLive && onOpenPresentation && (
              <Button variant="ghost" size="sm" onClick={() => onOpenPresentation(bet.id)} title="Presentation Mode">
                <Monitor className="h-4 w-4" />
              </Button>
            )}
            {isLive && onSettle && (
              <Button variant="ghost" size="sm" onClick={() => onSettle(bet.id)} title="Mark as Settled">
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" size="sm" onClick={() => onDelete(bet.id)} title="Delete">
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Bet details row */}
        <div className="flex items-center gap-4 text-sm mb-3">
          <div>
            <span className="text-zinc-400">Odds: </span>
            <span className="text-white font-medium">{formatOddsDisplay(bet.total_odds)}</span>
          </div>
          <div>
            <span className="text-zinc-400">Stake: </span>
            <span className="text-white font-medium">{formatCurrency(bet.stake)}</span>
          </div>
          <div>
            <span className="text-zinc-400">Payout: </span>
            <span className="text-emerald-400 font-medium">{formatCurrency(bet.potential_payout)}</span>
          </div>
          {bet.sportsbook && (
            <div>
              <span className="text-zinc-400">Book: </span>
              <span className="text-white">{bet.sportsbook}</span>
            </div>
          )}
        </div>

        {/* Straight bet: show score inline */}
        {!isParlay && leg && (
          <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-3 mb-2">
            <div>
              <div className="text-sm text-white font-medium">{leg.selection}</div>
              <div className="text-xs text-zinc-400">{leg.market_type} • {leg.league}</div>
            </div>
            {(scoreData || (leg.live_score_home !== null && leg.live_score_away !== null)) && (
              <div className="text-right">
                <div className="text-xl font-mono font-bold text-white tabular-nums">
                  {scoreData ? `${scoreData.home} - ${scoreData.away}` : `${leg.live_score_home} - ${leg.live_score_away}`}
                </div>
                <div className="text-xs text-zinc-400">
                  {scoreData?.status || leg.game_status || 'Scheduled'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Parlay: expandable leg list */}
        {isParlay && (
          <>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors mb-2"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {isExpanded ? 'Collapse legs' : `Show ${totalLegs} legs`}
              <span className="ml-2 text-xs">
                ({wonLegs}W - {lostLegs}L - {totalLegs - wonLegs - lostLegs}P)
              </span>
            </button>
            {isExpanded && (
              <ParlayLegList legs={bet.legs} variant="expanded" scores={scores} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

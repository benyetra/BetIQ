"use client"
import React from 'react'
import { TrackedBetLeg, LegStatus } from '@/types/betting'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { computeBetDelta, getGameTimeDisplay } from '@/lib/bet-delta'

interface ParlayLegListProps {
  legs: TrackedBetLeg[]
  variant?: 'compact' | 'expanded' | 'presentation'
  scores?: Record<string, { home: number; away: number; status: string }>
}

const statusConfig: Record<LegStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-zinc-400', bgColor: 'bg-zinc-800' },
  in_progress: { label: 'Live', color: 'text-yellow-400', bgColor: 'bg-yellow-900/30' },
  win: { label: 'Won', color: 'text-emerald-400', bgColor: 'bg-emerald-900/30' },
  loss: { label: 'Lost', color: 'text-red-400', bgColor: 'bg-red-900/30' },
  push: { label: 'Push', color: 'text-blue-400', bgColor: 'bg-blue-900/30' },
}

function formatOddsDisplay(odds: number): string {
  if (odds >= 2.0) return `+${Math.round((odds - 1) * 100)}`
  return `${Math.round(-100 / (odds - 1))}`
}

export default function ParlayLegList({ legs, variant = 'compact', scores }: ParlayLegListProps) {
  const isPresentation = variant === 'presentation'

  return (
    <div className={cn('space-y-2', isPresentation && 'space-y-3')}>
      {legs.map((leg, index) => {
        const config = statusConfig[leg.status]
        const scoreData = scores?.[leg.game_id]
        const isActive = leg.status === 'in_progress'

        return (
          <div
            key={leg.id}
            className={cn(
              'rounded-lg border p-3 transition-all duration-500',
              config.bgColor,
              isActive
                ? 'border-yellow-500/50 shadow-lg shadow-yellow-500/10'
                : leg.status === 'win'
                ? 'border-emerald-500/30'
                : leg.status === 'loss'
                ? 'border-red-500/30 opacity-60'
                : 'border-zinc-700/50',
              isPresentation && 'p-4',
              isActive && isPresentation && 'scale-[1.02] border-yellow-400/60'
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('text-xs font-medium', config.color)}>
                    Leg {index + 1}
                  </span>
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full font-medium',
                    config.bgColor, config.color
                  )}>
                    {config.label}
                  </span>
                  {leg.status === 'win' && <span className="text-emerald-400">✓</span>}
                  {leg.status === 'loss' && <span className="text-red-400">✗</span>}
                </div>
                <div className={cn(
                  'font-medium text-white',
                  isPresentation ? 'text-lg' : 'text-sm'
                )}>
                  {leg.home_team} vs {leg.away_team}
                </div>
                <div className={cn(
                  'text-zinc-400 mt-0.5',
                  isPresentation ? 'text-base' : 'text-xs'
                )}>
                  {leg.selection} • {formatOddsDisplay(leg.odds)} • {leg.market_type}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                {(() => {
                  const home = scoreData?.home ?? leg.live_score_home
                  const away = scoreData?.away ?? leg.live_score_away
                  const hasScore = home !== null && home !== undefined && away !== null && away !== undefined
                  const delta = hasScore ? computeBetDelta(leg, home, away) : null
                  const gameTime = getGameTimeDisplay(
                    leg.commence_time,
                    scoreData?.status === 'completed',
                    leg.game_status || scoreData?.status || null
                  )

                  return (
                    <>
                      {hasScore && (
                        <div className={cn(
                          'font-mono font-bold tabular-nums',
                          isPresentation ? 'text-2xl' : 'text-lg',
                          isActive ? 'text-yellow-400' : 'text-white'
                        )}>
                          {home} - {away}
                        </div>
                      )}
                      {delta && (
                        <div className={cn(
                          'font-medium rounded-full px-2 py-0.5',
                          isPresentation ? 'text-sm' : 'text-xs',
                          delta.type === 'cushion' || delta.type === 'covering' || delta.type === 'leading'
                            ? 'text-emerald-400 bg-emerald-900/30'
                            : delta.type === 'behind' || delta.type === 'trailing'
                            ? 'text-red-400 bg-red-900/30'
                            : delta.type === 'need'
                            ? 'text-amber-400 bg-amber-900/30'
                            : 'text-zinc-400 bg-zinc-800'
                        )}>
                          {delta.label}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        {gameTime && (
                          <span className={cn(
                            'text-xs text-zinc-500',
                            isActive && 'text-yellow-500/70'
                          )}>
                            {gameTime}
                          </span>
                        )}
                        <span className={cn('text-xs', config.color)}>
                          {leg.league}
                        </span>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>

            {/* Progress bar for the leg */}
            {variant !== 'compact' && (
              <div className="mt-2 h-1 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-1000',
                    leg.status === 'win' ? 'bg-emerald-500 w-full' :
                    leg.status === 'loss' ? 'bg-red-500 w-full' :
                    leg.status === 'in_progress' ? 'bg-yellow-500 w-1/2 animate-pulse' :
                    'bg-zinc-700 w-0'
                  )}
                />
              </div>
            )}
          </div>
        )
      })}

      {/* Parlay progress bar */}
      {legs.length > 1 && (
        <div className="mt-3 pt-3 border-t border-zinc-800">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span>Parlay Progress</span>
            <span>{legs.filter(l => l.status === 'win').length}/{legs.length} legs won</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden flex">
            {legs.map((leg, i) => (
              <div
                key={i}
                className={cn(
                  'h-full transition-all duration-500',
                  leg.status === 'win' ? 'bg-emerald-500' :
                  leg.status === 'loss' ? 'bg-red-500' :
                  leg.status === 'in_progress' ? 'bg-yellow-500' :
                  'bg-zinc-700'
                )}
                style={{ width: `${100 / legs.length}%` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

"use client"
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { TrackedBet } from '@/types/betting'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import ScoreDisplay from '@/components/ScoreDisplay'
import ProgressRing from '@/components/ProgressRing'
import ParlayLegList from '@/components/ParlayLegList'
import OddsSparkline from '@/components/OddsSparkline'
import LiveToast, { ToastMessage, useToasts } from '@/components/LiveToast'
import { X, ChevronLeft, ChevronRight, Sun, Moon, Pause, Play } from 'lucide-react'

interface PresentationViewProps {
  bets: TrackedBet[]
  initialBetId: string
  scores?: Record<string, { home: number; away: number; status: string }>
  onExit: () => void
  isPaused?: boolean
  onTogglePause?: () => void
}

function formatOddsDisplay(odds: number): string {
  if (odds >= 2.0) return `+${Math.round((odds - 1) * 100)}`
  return `${Math.round(-100 / (odds - 1))}`
}

export default function PresentationView({
  bets,
  initialBetId,
  scores,
  onExit,
  isPaused,
  onTogglePause,
}: PresentationViewProps) {
  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = bets.findIndex(b => b.id === initialBetId)
    return idx >= 0 ? idx : 0
  })
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [showControls, setShowControls] = useState(true)
  const controlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { toasts, addToast, dismissToast } = useToasts()

  const bet = bets[currentIndex]
  if (!bet) return null

  const isParlay = bet.bet_type === 'parlay'
  const leg = bet.legs[0]
  const scoreData = leg ? scores?.[leg.game_id] : undefined

  const wonLegs = bet.legs.filter(l => l.status === 'win').length
  const totalLegs = bet.legs.length
  const progress = totalLegs > 0 ? wonLegs / totalLegs : 0

  // Full-screen API
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    try {
      el.requestFullscreen?.()
    } catch {
      // Graceful fallback — component fills viewport anyway
    }
    return () => {
      try { document.exitFullscreen?.() } catch { /* ignore */ }
    }
  }, [])

  // Auto-hide controls
  const resetControlTimer = useCallback(() => {
    setShowControls(true)
    if (controlTimerRef.current) clearTimeout(controlTimerRef.current)
    controlTimerRef.current = setTimeout(() => setShowControls(false), 3000)
  }, [])

  useEffect(() => {
    resetControlTimer()
    return () => { if (controlTimerRef.current) clearTimeout(controlTimerRef.current) }
  }, [resetControlTimer])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onExit()
          break
        case 'ArrowLeft':
          setCurrentIndex(prev => (prev - 1 + bets.length) % bets.length)
          resetControlTimer()
          break
        case 'ArrowRight':
          setCurrentIndex(prev => (prev + 1) % bets.length)
          resetControlTimer()
          break
        case ' ':
          e.preventDefault()
          onTogglePause?.()
          resetControlTimer()
          break
        case 't':
        case 'T':
          setTheme(prev => prev === 'dark' ? 'light' : 'dark')
          resetControlTimer()
          break
        case 'p':
        case 'P':
          onExit()
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onExit, onTogglePause, bets.length, resetControlTimer])

  const isDark = theme === 'dark'
  const bg = isDark ? 'bg-zinc-950' : 'bg-white'
  const textPrimary = isDark ? 'text-white' : 'text-zinc-900'
  const textSecondary = isDark ? 'text-zinc-400' : 'text-zinc-500'
  const cardBg = isDark ? 'bg-zinc-900/50' : 'bg-zinc-100'
  const borderColor = isDark ? 'border-zinc-800' : 'border-zinc-200'

  // Determine status ribbon
  const hasLoss = bet.legs.some(l => l.status === 'loss')
  const allWon = wonLegs === totalLegs && totalLegs > 0
  const inProgress = bet.legs.some(l => l.status === 'in_progress')
  let ribbonBg = isDark ? 'bg-zinc-800' : 'bg-zinc-200'
  let ribbonText = textSecondary
  let ribbonLabel = 'TRACKING'
  if (allWon) {
    ribbonBg = 'bg-emerald-600'
    ribbonText = 'text-white'
    ribbonLabel = 'WINNER'
  } else if (hasLoss && isParlay) {
    ribbonBg = 'bg-red-600'
    ribbonText = 'text-white'
    ribbonLabel = 'BUSTED'
  } else if (hasLoss) {
    ribbonBg = 'bg-red-600/80'
    ribbonText = 'text-white'
    ribbonLabel = 'SETTLED'
  } else if (inProgress) {
    ribbonBg = isDark ? 'bg-yellow-600/20' : 'bg-yellow-100'
    ribbonText = 'text-yellow-400'
    ribbonLabel = 'LIVE'
  }

  return (
    <div
      ref={containerRef}
      className={cn('fixed inset-0 z-[200] flex flex-col', bg)}
      onMouseMove={resetControlTimer}
    >
      {/* Status Ribbon */}
      <div className={cn('w-full py-2 text-center font-bold text-lg tracking-widest transition-colors duration-500', ribbonBg, ribbonText)}>
        {ribbonLabel}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-8 overflow-hidden">
        {!isParlay ? (
          /* ===== STRAIGHT BET LAYOUT ===== */
          <>
            {/* Top: Matchup header (20%) */}
            <div className="flex-none h-[15%] flex items-center justify-center">
              <div className="text-center">
                <div className={cn('text-3xl md:text-4xl font-bold', textPrimary)}>
                  {leg?.away_team} <span className={textSecondary}>@</span> {leg?.home_team}
                </div>
                <div className={cn('text-lg mt-1', textSecondary)}>
                  {leg?.league} • {leg?.market_type}
                </div>
              </div>
            </div>

            {/* Center: Score (50%) */}
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                {scoreData ? (
                  <div className="flex items-center gap-8 md:gap-16">
                    <div>
                      <div className={cn('text-xl mb-2', textSecondary)}>{leg?.away_team}</div>
                      <ScoreDisplay score={scoreData.away} size="xl" className={textPrimary} />
                    </div>
                    <div className={cn('text-4xl font-light', textSecondary)}>-</div>
                    <div>
                      <div className={cn('text-xl mb-2', textSecondary)}>{leg?.home_team}</div>
                      <ScoreDisplay score={scoreData.home} size="xl" className={textPrimary} />
                    </div>
                  </div>
                ) : (
                  <div className={cn('text-6xl font-mono font-bold', textSecondary)}>
                    -- : --
                  </div>
                )}
                {scoreData?.status && (
                  <div className={cn('text-lg mt-4', inProgress ? 'text-yellow-400' : textSecondary)}>
                    {scoreData.status}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom: Details + Sparkline (30%) */}
            <div className="flex-none h-[25%] grid grid-cols-2 gap-6">
              <div className={cn('rounded-xl p-6', cardBg, 'border', borderColor)}>
                <div className={cn('text-sm mb-2', textSecondary)}>Bet Details</div>
                <div className={cn('text-xl font-medium', textPrimary)}>{leg?.selection}</div>
                <div className="flex gap-6 mt-3">
                  <div>
                    <div className={cn('text-xs', textSecondary)}>Odds</div>
                    <div className={cn('text-lg font-bold', textPrimary)}>{formatOddsDisplay(bet.total_odds)}</div>
                  </div>
                  <div>
                    <div className={cn('text-xs', textSecondary)}>Stake</div>
                    <div className={cn('text-lg font-bold', textPrimary)}>{formatCurrency(bet.stake)}</div>
                  </div>
                  <div>
                    <div className={cn('text-xs', textSecondary)}>To Win</div>
                    <div className="text-lg font-bold text-emerald-400">{formatCurrency(bet.potential_payout - bet.stake)}</div>
                  </div>
                </div>
              </div>
              <div className={cn('rounded-xl p-6 flex items-center justify-center', cardBg, 'border', borderColor)}>
                <OddsSparkline data={[bet.total_odds]} width={300} height={100} showCurrentValue />
              </div>
            </div>
          </>
        ) : (
          /* ===== PARLAY LAYOUT ===== */
          <>
            {/* Top: Parlay summary (15%) */}
            <div className="flex-none h-[12%] flex items-center justify-between px-4">
              <div>
                <div className={cn('text-2xl md:text-3xl font-bold', textPrimary)}>
                  {totalLegs}-Leg Parlay
                </div>
                <div className={cn('text-lg', textSecondary)}>
                  {bet.sportsbook && `${bet.sportsbook} • `}{formatOddsDisplay(bet.total_odds)}
                </div>
              </div>
              <div className="text-right">
                <div className={cn('text-sm', textSecondary)}>Potential Payout</div>
                <div className="text-3xl font-bold text-emerald-400">{formatCurrency(bet.potential_payout)}</div>
                <div className={cn('text-sm', textSecondary)}>Stake: {formatCurrency(bet.stake)}</div>
              </div>
            </div>

            {/* Center: Leg list (60%) */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <ParlayLegList legs={bet.legs} variant="presentation" scores={scores} />
            </div>

            {/* Bottom: Progress ring + payout (25%) */}
            <div className="flex-none h-[20%] flex items-center justify-around px-4">
              <ProgressRing
                progress={progress}
                total={totalLegs}
                completed={wonLegs}
                size={140}
                strokeWidth={10}
              />
              <div className="text-center">
                <div className={cn('text-sm', textSecondary)}>Payout Projection</div>
                <div className={cn(
                  'text-4xl font-bold',
                  hasLoss ? 'text-red-400 line-through' : 'text-emerald-400'
                )}>
                  {formatCurrency(bet.potential_payout)}
                </div>
                {hasLoss && (
                  <div className="text-xl text-red-400 mt-1">Parlay Busted</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Floating Controls */}
      <div
        className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-full transition-all duration-300',
          isDark ? 'bg-zinc-800/80 border-zinc-700' : 'bg-white/80 border-zinc-200',
          'border backdrop-blur-md shadow-lg',
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        )}
      >
        <button
          onClick={() => setCurrentIndex(prev => (prev - 1 + bets.length) % bets.length)}
          className={cn('p-2 rounded-full hover:bg-zinc-700/50 transition-colors', textSecondary)}
          title="Previous bet (←)"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Dot indicator */}
        <div className="flex gap-1.5 px-2">
          {bets.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                i === currentIndex
                  ? 'bg-emerald-400 scale-125'
                  : isDark ? 'bg-zinc-600' : 'bg-zinc-300'
              )}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrentIndex(prev => (prev + 1) % bets.length)}
          className={cn('p-2 rounded-full hover:bg-zinc-700/50 transition-colors', textSecondary)}
          title="Next bet (→)"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div className={cn('w-px h-6', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />

        <button
          onClick={onTogglePause}
          className={cn('p-2 rounded-full hover:bg-zinc-700/50 transition-colors', textSecondary)}
          title={isPaused ? 'Resume (Space)' : 'Pause (Space)'}
        >
          {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
        </button>

        <button
          onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
          className={cn('p-2 rounded-full hover:bg-zinc-700/50 transition-colors', textSecondary)}
          title="Toggle theme (T)"
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <button
          onClick={onExit}
          className={cn('p-2 rounded-full hover:bg-red-900/50 transition-colors text-red-400')}
          title="Exit (Escape)"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Toast notifications */}
      <LiveToast toasts={toasts} onDismiss={dismissToast} variant="presentation" />
    </div>
  )
}

"use client"
import React, { useState, useEffect, useCallback } from 'react'
import { TrackedBet } from '@/types/betting'
import { liveStore } from '@/lib/live-store'
import { useLiveScores } from '@/hooks/useLiveScores'
import TrackedBetCard from '@/components/TrackedBetCard'
import BetEntryModal from '@/components/BetEntryModal'
import PresentationView from '@/components/PresentationView'
import LiveToast, { useToasts } from '@/components/LiveToast'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { Plus, Activity, DollarSign, TrendingUp, Wifi, WifiOff, AlertTriangle } from 'lucide-react'

interface LiveTrackerTabProps {
  userId: string
}

type SortMode = 'time' | 'payout' | 'legs'
type FilterStatus = 'all' | 'live' | 'settled'

export default function LiveTrackerTab({ userId }: LiveTrackerTabProps) {
  const [trackedBets, setTrackedBets] = useState<TrackedBet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [presentationBetId, setPresentationBetId] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('time')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const { toasts, addToast, dismissToast } = useToasts()

  // Initialize store
  useEffect(() => {
    liveStore.init(userId)
  }, [userId])

  // Load tracked bets
  const loadBets = useCallback(async () => {
    setIsLoading(true)
    const bets = await liveStore.getTrackedBets()
    setTrackedBets(bets)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadBets()
  }, [loadBets])

  // Live scores hook
  const liveScoresData = useLiveScores(trackedBets)

  // Build scores map from live data
  const scoresMap: Record<string, { home: number; away: number; status: string }> = {}
  if (liveScoresData.scores) {
    for (const [gameId, scoreData] of Object.entries(liveScoresData.scores)) {
      if (scoreData.scores && scoreData.scores.length >= 2) {
        const homeScore = parseInt(scoreData.scores.find(s => s.name === scoreData.home_team)?.score || '0')
        const awayScore = parseInt(scoreData.scores.find(s => s.name === scoreData.away_team)?.score || '0')
        scoresMap[gameId] = {
          home: homeScore,
          away: awayScore,
          status: scoreData.completed ? 'Final' : 'In Progress',
        }
      }
    }
  }

  // Notify on score changes
  useEffect(() => {
    for (const change of liveScoresData.scoreChanges) {
      addToast(
        `SCORE UPDATE: ${change.homeTeam} ${change.newHome}, ${change.awayTeam} ${change.newAway}`,
        'score_update'
      )
    }
  }, [liveScoresData.scoreChanges, addToast])

  // Handle bet creation
  const handleCreateBet = async (betData: {
    bet_type: 'straight' | 'parlay'
    legs: TrackedBet['legs']
    total_odds: number
    stake: number
    potential_payout: number
    sportsbook: string
  }) => {
    const newBet = await liveStore.createTrackedBet({
      ...betData,
      tracking_status: 'live',
      presentation_theme: 'dark',
      live_snapshot: null,
    })
    if (newBet) {
      setTrackedBets(prev => [newBet, ...prev])
      addToast(`Bet tracked: ${betData.bet_type === 'parlay' ? `${betData.legs.length}-leg parlay` : betData.legs[0]?.selection || 'Straight bet'}`, 'info')
    }
  }

  // Handle bet settlement
  const handleSettle = async (betId: string) => {
    const updated = await liveStore.updateTrackedBet(betId, {
      tracking_status: 'settled',
      settled_at: new Date().toISOString(),
    })
    if (updated) {
      setTrackedBets(prev => prev.map(b => b.id === betId ? updated : b))
      addToast('Bet marked as settled', 'info')
    }
  }

  // Handle bet deletion
  const handleDelete = async (betId: string) => {
    const success = await liveStore.deleteTrackedBet(betId)
    if (success) {
      setTrackedBets(prev => prev.filter(b => b.id !== betId))
    }
  }

  // Filter and sort bets
  const filteredBets = trackedBets
    .filter(b => {
      if (filterStatus === 'live') return b.tracking_status === 'live'
      if (filterStatus === 'settled') return b.tracking_status === 'settled'
      return true
    })
    .sort((a, b) => {
      if (sortMode === 'payout') return b.potential_payout - a.potential_payout
      if (sortMode === 'legs') return b.legs.length - a.legs.length
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const liveBets = trackedBets.filter(b => b.tracking_status === 'live')
  const totalStakeAtRisk = liveBets.reduce((sum, b) => sum + b.stake, 0)
  const totalPotentialPayout = liveBets.reduce((sum, b) => sum + b.potential_payout, 0)

  // Presentation mode
  if (presentationBetId) {
    const presentationBets = liveBets.length > 0 ? liveBets : [trackedBets.find(b => b.id === presentationBetId)!]
    return (
      <PresentationView
        bets={presentationBets.filter(Boolean)}
        initialBetId={presentationBetId}
        scores={scoresMap}
        onExit={() => setPresentationBetId(null)}
        isPaused={liveScoresData.isPaused}
        onTogglePause={liveScoresData.togglePause}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-yellow-400" />
              <span className="text-xs text-zinc-400">Active Bets</span>
            </div>
            <div className="text-xl font-bold text-white">{liveBets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-red-400" />
              <span className="text-xs text-zinc-400">Stake at Risk</span>
            </div>
            <div className="text-xl font-bold text-red-400">{formatCurrency(totalStakeAtRisk)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-zinc-400">Potential Payout</span>
            </div>
            <div className="text-xl font-bold text-emerald-400">{formatCurrency(totalPotentialPayout)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              {liveScoresData.error ? (
                <WifiOff className="h-4 w-4 text-red-400" />
              ) : liveScoresData.isPolling ? (
                <Wifi className="h-4 w-4 text-emerald-400 animate-pulse" />
              ) : (
                <Wifi className="h-4 w-4 text-zinc-400" />
              )}
              <span className="text-xs text-zinc-400">Data Status</span>
            </div>
            <div className={cn('text-sm font-medium', liveScoresData.error ? 'text-red-400' : 'text-white')}>
              {liveScoresData.error || (liveScoresData.isPaused ? 'Paused' : liveScoresData.lastUpdate ? 'Live' : 'Ready')}
            </div>
            {liveScoresData.quota.requestsRemaining !== null && (
              <div className="flex items-center gap-1 mt-1">
                {liveScoresData.quota.requestsRemaining < 1000 && (
                  <AlertTriangle className="h-3 w-3 text-yellow-400" />
                )}
                <span className="text-xs text-zinc-500">
                  {liveScoresData.quota.requestsRemaining} API calls left
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Track Bet
          </Button>
          <div className="flex gap-1 ml-3">
            {(['all', 'live', 'settled'] as FilterStatus[]).map(status => (
              <Button
                key={status}
                variant={filterStatus === status ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilterStatus(status)}
                className="capitalize"
              >
                {status}
                {status === 'live' && liveBets.length > 0 && (
                  <Badge variant="neutral" className="ml-1 text-xs px-1.5 py-0">{liveBets.length}</Badge>
                )}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Sort:</span>
          {(['time', 'payout', 'legs'] as SortMode[]).map(mode => (
            <Button
              key={mode}
              variant={sortMode === mode ? 'outline' : 'ghost'}
              size="sm"
              onClick={() => setSortMode(mode)}
              className="capitalize text-xs"
            >
              {mode}
            </Button>
          ))}
        </div>
      </div>

      {/* Bet List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-zinc-400">Loading tracked bets...</div>
        </div>
      ) : filteredBets.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Activity className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No tracked bets yet</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Start tracking your live bets to see real-time scores and leg-by-leg progress.
            </p>
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Track Your First Bet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredBets.map(bet => (
            <TrackedBetCard
              key={bet.id}
              bet={bet}
              scores={scoresMap}
              onOpenPresentation={(id) => setPresentationBetId(id)}
              onSettle={handleSettle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Bet Entry Modal */}
      <BetEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateBet}
      />

      {/* Toast Notifications */}
      <LiveToast toasts={toasts} onDismiss={dismissToast} variant="tracker" />
    </div>
  )
}

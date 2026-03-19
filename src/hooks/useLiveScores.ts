"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import { TrackedBet, TrackedBetLeg, LegStatus } from '@/types/betting'
import { SPORT_DISPLAY } from '@/lib/odds-api'

interface ScoreData {
  id: string
  home_team: string
  away_team: string
  scores: { name: string; score: string }[] | null
  completed: boolean
  last_update: string | null
}

interface LiveScoreState {
  scores: Record<string, ScoreData>
  lastUpdate: string | null
  isPolling: boolean
  error: string | null
  quota: { requestsRemaining: number | null; requestsUsed: number | null }
  isPaused: boolean
}

interface ScoreChange {
  gameId: string
  homeTeam: string
  awayTeam: string
  oldHome: number | null
  oldAway: number | null
  newHome: number
  newAway: number
  status: string
}

interface LegStatusChange {
  legId: string
  betId: string
  oldStatus: LegStatus
  newStatus: LegStatus
  selection: string
}

export function useLiveScores(trackedBets: TrackedBet[]) {
  const [state, setState] = useState<LiveScoreState>({
    scores: {},
    lastUpdate: null,
    isPolling: false,
    error: null,
    quota: { requestsRemaining: null, requestsUsed: null },
    isPaused: false,
  })

  const [scoreChanges, setScoreChanges] = useState<ScoreChange[]>([])
  const [legStatusChanges, setLegStatusChanges] = useState<LegStatusChange[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevScoresRef = useRef<Record<string, ScoreData>>({})

  // Collect unique sport keys and game IDs from active bets
  const activeBets = trackedBets.filter(b => b.tracking_status === 'live')

  const gameInfoMap = useRef<Map<string, { sportKey: string; leg: TrackedBetLeg; betId: string }>>(new Map())

  // Build map of game_id -> sport_key for all active bets
  useEffect(() => {
    const map = new Map<string, { sportKey: string; leg: TrackedBetLeg; betId: string }>()
    for (const bet of activeBets) {
      for (const leg of bet.legs) {
        if (leg.game_id && leg.game_status !== 'completed') {
          map.set(leg.game_id, { sportKey: leg.sport, leg, betId: bet.id })
        }
      }
    }
    gameInfoMap.current = map
  }, [activeBets])

  const fetchScores = useCallback(async () => {
    if (activeBets.length === 0 || state.isPaused) return

    // Group game IDs by sport
    const sportGameIds = new Map<string, string[]>()
    for (const bet of activeBets) {
      for (const leg of bet.legs) {
        if (!leg.game_id || leg.game_status === 'completed') continue
        const sportKey = leg.sport
        const existing = sportGameIds.get(sportKey) || []
        if (!existing.includes(leg.game_id)) {
          existing.push(leg.game_id)
        }
        sportGameIds.set(sportKey, existing)
      }
    }

    if (sportGameIds.size === 0) return

    setState(prev => ({ ...prev, isPolling: true, error: null }))

    try {
      const allScores: Record<string, ScoreData> = {}
      let latestQuota = state.quota

      // Fetch scores for each sport (serialized with 1.5s gap to respect rate limits)
      const sportEntries = Array.from(sportGameIds.entries())
      for (let i = 0; i < sportEntries.length; i++) {
        const [sportKey, gameIds] = sportEntries[i]

        // Wait 1.5s between requests to respect Odds API freq limit
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1500))
        }

        const params = new URLSearchParams({
          sport: sportKey,
          game_ids: gameIds.join(','),
        })
        const response = await fetch(`/api/live-scores?${params}`)
        if (!response.ok) {
          if (response.status === 429) {
            setState(prev => ({ ...prev, error: 'Rate limit hit - data may be delayed', isPolling: false }))
            return
          }
          continue
        }
        const data = await response.json()
        for (const score of (data.scores || [])) {
          allScores[score.id] = score
        }
        if (data.quota) {
          latestQuota = {
            requestsRemaining: data.quota.requestsRemaining ? parseInt(data.quota.requestsRemaining) : null,
            requestsUsed: data.quota.requestsUsed ? parseInt(data.quota.requestsUsed) : null,
          }
        }
      }

      // Diff scores against previous state to detect changes
      const changes: ScoreChange[] = []
      const prevScores = prevScoresRef.current

      for (const [gameId, scoreData] of Object.entries(allScores)) {
        const prev = prevScores[gameId]
        if (scoreData.scores && scoreData.scores.length >= 2) {
          const homeScore = parseInt(scoreData.scores.find(s => s.name === scoreData.home_team)?.score || '0')
          const awayScore = parseInt(scoreData.scores.find(s => s.name === scoreData.away_team)?.score || '0')

          let prevHome: number | null = null
          let prevAway: number | null = null
          if (prev?.scores && prev.scores.length >= 2) {
            prevHome = parseInt(prev.scores.find(s => s.name === prev.home_team)?.score || '0')
            prevAway = parseInt(prev.scores.find(s => s.name === prev.away_team)?.score || '0')
          }

          if (prevHome !== null && prevAway !== null && (homeScore !== prevHome || awayScore !== prevAway)) {
            changes.push({
              gameId,
              homeTeam: scoreData.home_team,
              awayTeam: scoreData.away_team,
              oldHome: prevHome,
              oldAway: prevAway,
              newHome: homeScore,
              newAway: awayScore,
              status: scoreData.completed ? 'Final' : 'In Progress',
            })
          }
        }
      }

      if (changes.length > 0) {
        setScoreChanges(changes)
      }

      prevScoresRef.current = allScores
      setState(prev => ({
        ...prev,
        scores: allScores,
        lastUpdate: new Date().toISOString(),
        isPolling: false,
        quota: latestQuota,
      }))
    } catch (err) {
      console.error('Failed to fetch live scores:', err)
      setState(prev => ({ ...prev, error: 'Failed to fetch scores', isPolling: false }))
    }
  }, [activeBets, state.isPaused, state.quota])

  // Set up polling interval
  useEffect(() => {
    if (activeBets.length === 0 || state.isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Initial fetch
    fetchScores()

    // Determine polling interval based on quota
    let pollInterval = 30000 // 30s default
    if (state.quota.requestsRemaining !== null) {
      if (state.quota.requestsRemaining < 200) {
        pollInterval = 60000 // 60s when low on quota
      } else if (state.quota.requestsRemaining < 1000) {
        pollInterval = 45000 // 45s when getting lower
      }
    }

    intervalRef.current = setInterval(fetchScores, pollInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [activeBets.length, state.isPaused, fetchScores])

  const togglePause = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: !prev.isPaused }))
  }, [])

  const clearChanges = useCallback(() => {
    setScoreChanges([])
    setLegStatusChanges([])
  }, [])

  return {
    ...state,
    scoreChanges,
    legStatusChanges,
    togglePause,
    clearChanges,
    refetch: fetchScores,
  }
}

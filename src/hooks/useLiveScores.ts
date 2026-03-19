"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import { TrackedBet, LegStatus } from '@/types/betting'

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevScoresRef = useRef<Record<string, ScoreData>>({})
  const isFetchingRef = useRef(false)

  // Use refs for values accessed inside fetchScores to avoid re-creating the callback
  const trackedBetsRef = useRef(trackedBets)
  trackedBetsRef.current = trackedBets

  const isPausedRef = useRef(state.isPaused)
  isPausedRef.current = state.isPaused

  // Stable fetchScores that reads from refs — never changes identity
  const fetchScores = useCallback(async () => {
    const bets = trackedBetsRef.current
    const activeBets = bets.filter(b => b.tracking_status === 'live')

    if (activeBets.length === 0 || isPausedRef.current) return

    // Prevent concurrent fetches
    if (isFetchingRef.current) return
    isFetchingRef.current = true

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

    if (sportGameIds.size === 0) {
      isFetchingRef.current = false
      return
    }

    setState(prev => ({ ...prev, isPolling: true, error: null }))

    try {
      const allScores: Record<string, ScoreData> = {}
      let latestQuota = { requestsRemaining: null as number | null, requestsUsed: null as number | null }

      // Fetch one sport at a time — server handles rate limiting,
      // but we still space requests 2s apart client-side as defense-in-depth
      const sportEntries = Array.from(sportGameIds.entries())
      for (let i = 0; i < sportEntries.length; i++) {
        const [sportKey, gameIds] = sportEntries[i]

        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }

        const params = new URLSearchParams({
          sport: sportKey,
          game_ids: gameIds.join(','),
        })

        try {
          const response = await fetch(`/api/live-scores?${params}`)
          if (!response.ok) {
            if (response.status === 429) {
              setState(prev => ({ ...prev, error: 'Rate limit hit - data may be delayed', isPolling: false }))
              isFetchingRef.current = false
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
        } catch {
          // Individual sport fetch failed, continue with others
          continue
        }
      }

      // Diff scores against previous state
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
    } finally {
      isFetchingRef.current = false
    }
  }, []) // Empty deps — reads from refs

  // Count active bets to decide whether to poll
  const activeBetCount = trackedBets.filter(b => b.tracking_status === 'live').length

  // Set up polling — only restarts when activeBetCount or isPaused changes
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (activeBetCount === 0 || state.isPaused) return

    // Delay initial fetch by 1s to avoid hammering on mount
    const initialTimer = setTimeout(() => {
      fetchScores()
      // Then poll every 30s
      intervalRef.current = setInterval(fetchScores, 30000)
    }, 1000)

    return () => {
      clearTimeout(initialTimer)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [activeBetCount, state.isPaused, fetchScores])

  const togglePause = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: !prev.isPaused }))
  }, [])

  const clearChanges = useCallback(() => {
    setScoreChanges([])
  }, [])

  return {
    ...state,
    scoreChanges,
    togglePause,
    clearChanges,
    refetch: fetchScores,
  }
}

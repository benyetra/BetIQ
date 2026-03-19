"use client"
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrackedBetLeg, BetType, MarketType, OddsApiGame } from '@/types/betting'
import { SPORT_KEYS, americanToDecimal, calculateParlayOdds, calculatePayout } from '@/lib/odds-api'
import { cn } from '@/lib/utils'
import { v4 as uuidv4 } from 'uuid'
import { X, Plus, Trash2, ChevronRight, Loader2 } from 'lucide-react'

interface BetEntryModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (bet: {
    bet_type: 'straight' | 'parlay'
    legs: TrackedBetLeg[]
    total_odds: number
    stake: number
    potential_payout: number
    sportsbook: string
  }) => void
}

interface GameOption {
  id: string
  home_team: string
  away_team: string
  commence_time: string
  sport_key: string
  sport_title: string
  bookmakers?: {
    key: string
    title: string
    markets: { key: string; outcomes: { name: string; price: number; point?: number }[] }[]
  }[]
}

type Step = 'type' | 'sport' | 'game' | 'market' | 'details' | 'confirm'

const SPORTSBOOKS = [
  'DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'PointsBet',
  'BetRivers', 'Hard Rock', 'ESPN BET', 'Fanatics', 'Other'
]

function formatAmericanOdds(price: number): string {
  return price > 0 ? `+${price}` : `${price}`
}

function LegBuilder({
  onAddLeg,
  existingLegs,
}: {
  onAddLeg: (leg: TrackedBetLeg) => void
  existingLegs: TrackedBetLeg[]
}) {
  const [step, setStep] = useState<Step>('sport')
  const [selectedSport, setSelectedSport] = useState<string>('')
  const [selectedGame, setSelectedGame] = useState<GameOption | null>(null)
  const [selectedMarket, setSelectedMarket] = useState<MarketType>('moneyline')
  const [selection, setSelection] = useState('')
  const [oddsInput, setOddsInput] = useState('')
  const [games, setGames] = useState<GameOption[]>([])
  const [isLoadingGames, setIsLoadingGames] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sportEntries = Object.entries(SPORT_KEYS)

  const fetchGames = async (sportKey: string) => {
    setIsLoadingGames(true)
    setError(null)
    try {
      const response = await fetch(`/api/live-games?sport=${sportKey}`)
      if (!response.ok) throw new Error('Failed to fetch games')
      const data = await response.json()
      setGames(data.games || [])
    } catch (err) {
      setError('Failed to load games. You can still enter bet details manually.')
      setGames([])
    } finally {
      setIsLoadingGames(false)
    }
  }

  const handleSelectSport = (sportKey: string) => {
    setSelectedSport(sportKey)
    fetchGames(sportKey)
    setStep('game')
  }

  const handleSelectGame = (game: GameOption) => {
    setSelectedGame(game)
    setStep('market')
  }

  const handleSelectMarket = (market: MarketType) => {
    setSelectedMarket(market)
    setStep('details')
  }

  const handleAddLeg = () => {
    if (!selectedGame || !selection || !oddsInput) return

    const americanOdds = parseInt(oddsInput)
    if (isNaN(americanOdds)) return

    const decimalOdds = americanToDecimal(americanOdds)
    const sportDisplay = Object.entries(SPORT_KEYS).find(([, v]) => v === selectedSport)?.[0] || selectedSport

    const leg: TrackedBetLeg = {
      id: uuidv4(),
      sport: selectedSport,
      league: sportDisplay,
      game_id: selectedGame.id,
      home_team: selectedGame.home_team,
      away_team: selectedGame.away_team,
      commence_time: selectedGame.commence_time,
      market_type: selectedMarket,
      selection,
      odds: decimalOdds,
      status: 'pending',
      live_score_home: null,
      live_score_away: null,
      game_status: 'scheduled',
    }

    onAddLeg(leg)
    // Reset for next leg
    setStep('sport')
    setSelectedSport('')
    setSelectedGame(null)
    setSelectedMarket('moneyline')
    setSelection('')
    setOddsInput('')
  }

  const getMarketOutcomes = () => {
    if (!selectedGame?.bookmakers?.length) return []
    const marketKey = selectedMarket === 'moneyline' ? 'h2h' : selectedMarket === 'spread' ? 'spreads' : 'totals'
    for (const bm of selectedGame.bookmakers) {
      const market = bm.markets.find(m => m.key === marketKey)
      if (market) return market.outcomes
    }
    return []
  }

  return (
    <div className="space-y-4">
      {/* Step: Sport Selection */}
      {step === 'sport' && (
        <div>
          <h3 className="text-sm font-medium text-zinc-400 mb-2">Select Sport</h3>
          <div className="grid grid-cols-2 gap-2">
            {sportEntries.map(([display, key]) => (
              <button
                key={key}
                onClick={() => handleSelectSport(key)}
                className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm transition-colors text-left"
              >
                {display}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: Game Selection */}
      {step === 'game' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-zinc-400">Select Game</h3>
            <Button variant="ghost" size="sm" onClick={() => setStep('sport')}>
              ← Back
            </Button>
          </div>
          {isLoadingGames ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : error ? (
            <div className="text-sm text-yellow-400 mb-3">{error}</div>
          ) : games.length === 0 ? (
            <div className="text-sm text-zinc-400 py-4 text-center">No games found for this sport.</div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {games.map(game => (
                <button
                  key={game.id}
                  onClick={() => handleSelectGame(game)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-left transition-colors"
                >
                  <div className="text-sm text-white font-medium">
                    {game.away_team} @ {game.home_team}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {new Date(game.commence_time).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          )}
          {/* Manual entry fallback */}
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <button
              onClick={() => {
                setSelectedGame({
                  id: `manual-${uuidv4()}`,
                  home_team: '',
                  away_team: '',
                  commence_time: new Date().toISOString(),
                  sport_key: selectedSport,
                  sport_title: '',
                })
                setStep('details')
              }}
              className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              + Enter game details manually
            </button>
          </div>
        </div>
      )}

      {/* Step: Market Selection */}
      {step === 'market' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-zinc-400">Select Market</h3>
            <Button variant="ghost" size="sm" onClick={() => setStep('game')}>
              ← Back
            </Button>
          </div>
          {selectedGame && (
            <div className="text-sm text-white mb-3">
              {selectedGame.away_team} @ {selectedGame.home_team}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {(['moneyline', 'spread', 'total', 'player_prop'] as MarketType[]).map(market => (
              <button
                key={market}
                onClick={() => handleSelectMarket(market)}
                className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm transition-colors capitalize"
              >
                {market === 'player_prop' ? 'Player Prop' : market === 'total' ? 'Over/Under' : market}
              </button>
            ))}
          </div>

          {/* Quick picks from API data */}
          {selectedGame?.bookmakers && selectedGame.bookmakers.length > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-800">
              <h4 className="text-xs text-zinc-400 mb-2">Quick picks from odds:</h4>
              {getMarketOutcomes().map((outcome, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelection(outcome.name + (outcome.point ? ` ${outcome.point > 0 ? '+' : ''}${outcome.point}` : ''))
                    setOddsInput(String(outcome.price))
                    setStep('details')
                  }}
                  className="block w-full px-3 py-1.5 text-left text-sm bg-zinc-800/50 hover:bg-zinc-700 rounded mb-1 transition-colors"
                >
                  <span className="text-white">{outcome.name}</span>
                  {outcome.point !== undefined && <span className="text-zinc-400"> {outcome.point > 0 ? '+' : ''}{outcome.point}</span>}
                  <span className="text-emerald-400 ml-2">{formatAmericanOdds(outcome.price)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step: Details */}
      {step === 'details' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-zinc-400">Bet Details</h3>
            <Button variant="ghost" size="sm" onClick={() => setStep('market')}>
              ← Back
            </Button>
          </div>

          {/* If manual entry, allow team names */}
          {selectedGame && selectedGame.id.startsWith('manual') && (
            <div className="space-y-2 mb-3">
              <input
                type="text"
                placeholder="Home Team"
                value={selectedGame.home_team}
                onChange={(e) => setSelectedGame({ ...selectedGame, home_team: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:border-emerald-500 outline-none"
              />
              <input
                type="text"
                placeholder="Away Team"
                value={selectedGame.away_team}
                onChange={(e) => setSelectedGame({ ...selectedGame, away_team: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:border-emerald-500 outline-none"
              />
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Selection (e.g., "Chiefs -3.5", "Over 48.5")</label>
              <input
                type="text"
                value={selection}
                onChange={(e) => setSelection(e.target.value)}
                placeholder="Your pick..."
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Odds (American format, e.g., -110, +200)</label>
              <input
                type="text"
                value={oddsInput}
                onChange={(e) => setOddsInput(e.target.value)}
                placeholder="-110"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:border-emerald-500 outline-none"
              />
            </div>
            <Button
              onClick={handleAddLeg}
              disabled={!selection || !oddsInput}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Leg
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BetEntryModal({ isOpen, onClose, onSubmit }: BetEntryModalProps) {
  const [betType, setBetType] = useState<'straight' | 'parlay'>('straight')
  const [legs, setLegs] = useState<TrackedBetLeg[]>([])
  const [stakeInput, setStakeInput] = useState('')
  const [sportsbook, setSportsbook] = useState('')

  if (!isOpen) return null

  const totalOdds = legs.length > 0
    ? betType === 'parlay'
      ? calculateParlayOdds(legs.map(l => l.odds))
      : legs[0].odds
    : 1

  const stake = parseFloat(stakeInput) || 0
  const potentialPayout = calculatePayout(stake, totalOdds)

  const handleAddLeg = (leg: TrackedBetLeg) => {
    if (betType === 'straight') {
      setLegs([leg])
    } else {
      setLegs(prev => [...prev, leg])
    }
  }

  const handleRemoveLeg = (legId: string) => {
    setLegs(prev => prev.filter(l => l.id !== legId))
  }

  const handleSubmit = () => {
    if (legs.length === 0 || stake <= 0) return
    onSubmit({
      bet_type: betType,
      legs,
      total_odds: totalOdds,
      stake,
      potential_payout: potentialPayout,
      sportsbook,
    })
    // Reset
    setLegs([])
    setStakeInput('')
    setSportsbook('')
    setBetType('straight')
    onClose()
  }

  const canSubmit = legs.length > 0 && stake > 0 && (betType === 'straight' ? legs.length === 1 : legs.length >= 2)

  function formatOddsDisplay(odds: number): string {
    if (odds >= 2.0) return `+${Math.round((odds - 1) * 100)}`
    return `${Math.round(-100 / (odds - 1))}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white">Track New Bet</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Bet Type Selector */}
          <div>
            <label className="text-xs text-zinc-400 mb-2 block">Bet Type</label>
            <div className="flex gap-2">
              {(['straight', 'parlay'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => { setBetType(type); setLegs([]) }}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize',
                    betType === type
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Current Legs */}
          {legs.length > 0 && (
            <div>
              <label className="text-xs text-zinc-400 mb-2 block">
                {betType === 'parlay' ? `Legs (${legs.length})` : 'Selection'}
              </label>
              <div className="space-y-2">
                {legs.map((leg, i) => (
                  <div key={leg.id} className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2">
                    <div className="flex-1">
                      <div className="text-sm text-white">
                        {betType === 'parlay' && <span className="text-zinc-400 mr-1">#{i + 1}</span>}
                        {leg.selection}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {leg.home_team} vs {leg.away_team} • {formatOddsDisplay(leg.odds)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveLeg(leg.id)}
                      className="text-zinc-500 hover:text-red-400 transition-colors ml-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              {betType === 'parlay' && legs.length >= 2 && (
                <div className="mt-2 text-sm text-emerald-400 font-medium">
                  Combined Odds: {formatOddsDisplay(totalOdds)}
                </div>
              )}
            </div>
          )}

          {/* Add Leg section */}
          {(betType === 'straight' && legs.length === 0) || (betType === 'parlay') ? (
            <Card className="border-dashed">
              <CardContent className="p-4">
                <LegBuilder onAddLeg={handleAddLeg} existingLegs={legs} />
              </CardContent>
            </Card>
          ) : null}

          {/* Stake and Sportsbook */}
          {legs.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-zinc-800">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Stake ($)</label>
                <input
                  type="number"
                  value={stakeInput}
                  onChange={(e) => setStakeInput(e.target.value)}
                  placeholder="25.00"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Sportsbook (optional)</label>
                <select
                  value={sportsbook}
                  onChange={(e) => setSportsbook(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:border-emerald-500 outline-none"
                >
                  <option value="">Select sportsbook...</option>
                  {SPORTSBOOKS.map(book => (
                    <option key={book} value={book}>{book}</option>
                  ))}
                </select>
              </div>

              {stake > 0 && (
                <div className="bg-zinc-800/50 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-zinc-400 text-sm">Potential Payout</span>
                  <span className="text-emerald-400 font-bold text-lg">
                    ${potentialPayout.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-800">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            Track Bet
          </Button>
        </div>
      </div>
    </div>
  )
}

"use client"
import React, { useState, useMemo, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bet, Strategy, WhatIfScenario } from '@/types/betting'
import { computeSummary, computeSportBreakdown, computeBetTypeBreakdown, computeParlayBreakdown, runWhatIfScenario } from '@/lib/analytics'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { store } from '@/lib/store'
import { v4 as uuidv4 } from 'uuid'
import { Wand2, PlayCircle, Save, ArrowRight, TrendingUp, TrendingDown, Sliders, Loader2 } from 'lucide-react'

interface StrategyBuilderProps {
  bets: Bet[]
}

const PRESET_SCENARIOS: { name: string; description: string; filter: WhatIfScenario['filter'] }[] = [
  { name: 'No 5+ Leg Parlays', description: 'What if you never bet parlays with 5 or more legs?', filter: { maxLegs: 4 } },
  { name: 'Straights Only', description: 'What if you only bet straights?', filter: { onlyTypes: ['straight'] } },
  { name: 'Max $100 Stakes', description: 'What if you capped every bet at $100?', filter: { maxStake: 100 } },
  { name: 'Flat $50 Units', description: 'What if you used flat $50 units on every bet?', filter: { flatUnit: 50 } },
  { name: '+EV Bets Only', description: 'What if you only bet when expected value was positive?', filter: { evOnly: true } },
  { name: 'No 3+ Leg Parlays', description: 'What if you capped parlays at 2 legs max?', filter: { maxLegs: 2 } },
]

function WhatIfCard({ scenario, bets }: { scenario: typeof PRESET_SCENARIOS[0]; bets: Bet[] }) {
  const [result, setResult] = useState<{ actualPL: number; hypotheticalPL: number } | null>(null)

  const run = () => {
    const res = runWhatIfScenario(bets, scenario.filter)
    setResult(res)
  }

  const diff = result ? result.hypotheticalPL - result.actualPL : 0

  return (
    <Card className="hover:border-zinc-700 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-medium text-white text-sm">{scenario.name}</h3>
            <p className="text-xs text-zinc-400 mt-0.5">{scenario.description}</p>
          </div>
          {!result && (
            <Button variant="outline" size="sm" onClick={run}>
              <PlayCircle className="h-3 w-3 mr-1" />
              Run
            </Button>
          )}
        </div>
        {result && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
              <div className="text-xs text-zinc-400">Actual</div>
              <div className={`text-sm font-bold ${result.actualPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(result.actualPL)}
              </div>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
              <div className="text-xs text-zinc-400">Hypothetical</div>
              <div className={`text-sm font-bold ${result.hypotheticalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(result.hypotheticalPL)}
              </div>
            </div>
            <div className="col-span-3 text-center mt-1">
              <Badge variant={diff >= 0 ? 'positive' : 'negative'}>
                {diff >= 0 ? '+' : ''}{formatCurrency(diff)} difference
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function StrategyBuilder({ bets }: StrategyBuilderProps) {
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Load strategies asynchronously
  useEffect(() => {
    store.getStrategies().then(saved => {
      setStrategies(saved)
      setIsInitialized(true)
    })
  }, [])

  const autoStrategy = useMemo(() => {
    if (bets.length < 20) return null
    const sports = computeSportBreakdown(bets)
    const betTypes = computeBetTypeBreakdown(bets)
    const parlays = computeParlayBreakdown(bets)
    const summary = computeSummary(bets)

    const profitableSports = sports.filter(s => s.roi > 0 && s.totalBets >= 10)
    const bestType = betTypes.sort((a, b) => b.roi - a.roi)[0]
    const goodParlays = parlays.filter(p => p.roi > -0.1)
    const maxGoodLegs = goodParlays.length > 0 ? Math.max(...goodParlays.map(p => parseInt(p.legs))) : 3

    const rules: string[] = []
    const goals: string[] = []

    if (maxGoodLegs < 6) rules.push(`Cap parlays at ${maxGoodLegs} legs maximum`)
    if (summary.avgBetSize > 100) rules.push(`Set unit size at $${Math.round(summary.avgBetSize * 0.5)} (50% of current average)`)
    else rules.push(`Keep unit size at $${Math.round(summary.avgBetSize)}`)
    rules.push('Max 3 units on any single bet')
    rules.push('No betting after 11 PM')
    if (profitableSports.length > 0) rules.push(`Focus on ${profitableSports.map(s => s.sport).join(', ')}`)

    const parlayBets = betTypes.find(b => b.type === 'parlay')
    const straightBets = betTypes.find(b => b.type === 'straight')
    if (parlayBets && straightBets) {
      const parlayPct = parlayBets.totalBets / (parlayBets.totalBets + straightBets.totalBets)
      if (parlayPct > 0.5) goals.push(`Reduce parlay mix from ${(parlayPct * 100).toFixed(0)}% to 30% of total bets`)
    }
    goals.push(`Target ${formatPercent(Math.max(summary.roi + 0.05, 0))} ROI over next 90 days`)
    goals.push('Track all bets for CLV analysis')

    return {
      id: uuidv4(),
      name: 'AI-Generated Strategy',
      sportFocus: profitableSports.map(s => s.sport),
      marketSelection: [bestType?.type || 'straight'],
      stakingPlan: `Flat ${Math.round(summary.avgBetSize * 0.75)} per unit`,
      rules,
      goals,
      active: false,
      created_at: new Date().toISOString(),
    } as Strategy
  }, [bets])

  const saveStrategy = async (strategy: Strategy) => {
    strategy.active = true
    await store.addStrategy(strategy)
    setStrategies([...strategies, strategy])
  }

  return (
    <div className="space-y-6">
      {/* What-If Simulator */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="h-5 w-5 text-blue-400" />
          <h2 className="font-semibold text-white text-lg">What-If Simulator</h2>
        </div>
        <p className="text-zinc-400 text-sm mb-4">
          Replay your betting history with different parameters to see how outcomes would have changed.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PRESET_SCENARIOS.map(scenario => (
            <WhatIfCard key={scenario.name} scenario={scenario} bets={bets} />
          ))}
        </div>
      </div>

      {/* Auto-Generated Strategy */}
      {autoStrategy && (
        <Card className="border-emerald-800/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-emerald-400" />
                <CardTitle className="text-lg">AI-Generated Strategy</CardTitle>
              </div>
              <Button size="sm" onClick={() => saveStrategy(autoStrategy)}>
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
            <CardDescription>Personalized strategy based on your betting data analysis.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-xs text-zinc-400 font-medium mb-2">SPORT FOCUS</h4>
              <div className="flex gap-2">
                {autoStrategy.sportFocus.map(sport => (
                  <Badge key={sport} variant="positive">{sport}</Badge>
                ))}
                {autoStrategy.sportFocus.length === 0 && <span className="text-zinc-500 text-sm">Diversified approach</span>}
              </div>
            </div>
            <div>
              <h4 className="text-xs text-zinc-400 font-medium mb-2">STAKING PLAN</h4>
              <p className="text-sm text-white">{autoStrategy.stakingPlan}</p>
            </div>
            <div>
              <h4 className="text-xs text-zinc-400 font-medium mb-2">RULES & GUARDRAILS</h4>
              <ul className="space-y-1">
                {autoStrategy.rules.map((rule, i) => (
                  <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                    <span className="text-emerald-400 mt-1">•</span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs text-zinc-400 font-medium mb-2">30/60/90 DAY GOALS</h4>
              <ul className="space-y-1">
                {autoStrategy.goals.map((goal, i) => (
                  <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    {goal}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saved Strategies */}
      {strategies.length > 0 && (
        <div>
          <h3 className="font-semibold text-white mb-3">Saved Strategies</h3>
          <div className="space-y-3">
            {strategies.map(strategy => (
              <Card key={strategy.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-white">{strategy.name}</h4>
                    <Badge variant={strategy.active ? 'positive' : 'default'}>
                      {strategy.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-400">{strategy.rules.join(' | ')}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

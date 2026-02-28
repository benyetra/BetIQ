"use client"
import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bet, DashboardFilters } from '@/types/betting'
import { store, hasLocalData, getLocalData, clearLocalData } from '@/lib/store'
import { useAuth } from '@/components/AuthProvider'
import UserMenu from '@/components/UserMenu'
import { computeSummary, computeSportBreakdown, computeBetTypeBreakdown, computeMonthlyData, computeTimePatterns, computeDayPatterns, computeParlayBreakdown, applyFilters, generateInsights, getFilterOptions, DEFAULT_FILTERS } from '@/lib/analytics'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import UploadPanel from '@/components/UploadPanel'
import SummaryCards from '@/components/SummaryCards'
import FilterBar from '@/components/FilterBar'
import { CumulativePLChart, MonthlyWinRateChart, MonthlyPLChart, SportBreakdownChart, BetTypeChart, ParlayLegChart, TimePatternChart, DayPatternChart, SportLeaderboard } from '@/components/Charts'
import InsightsPanel from '@/components/InsightsPanel'
import ChatCoach from '@/components/ChatCoach'
import StrategyBuilder from '@/components/StrategyBuilder'
import AlertsPanel from '@/components/AlertsPanel'
import PricingPanel from '@/components/PricingPanel'
import { BarChart3, Upload, Brain, MessageCircle, Target, TrendingUp, Trash2, Phone, Bell, CreditCard, CloudUpload, Loader2 } from 'lucide-react'

export default function Home() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [bets, setBets] = useState<Bet[]>([])
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS)
  const [isLoaded, setIsLoaded] = useState(false)
  const [showMigrationBanner, setShowMigrationBanner] = useState(false)
  const [localBetCount, setLocalBetCount] = useState(0)
  const [isMigrating, setIsMigrating] = useState(false)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  // Initialize store with user ID and load data
  useEffect(() => {
    if (!user) return
    store.init(user.id)

    store.getBets().then(savedBets => {
      if (savedBets.length > 0) setBets(savedBets)
      setIsLoaded(true)
    })

    // Check for local data to migrate
    hasLocalData().then(has => {
      if (has) {
        getLocalData().then(local => {
          setLocalBetCount(local.bets.length)
          setShowMigrationBanner(true)
        })
      }
    })
  }, [user])

  const handleMigrate = async () => {
    setIsMigrating(true)
    try {
      const local = await getLocalData()

      // Migrate bets
      if (local.bets.length > 0) {
        const result = await store.addBets(local.bets)
        setBets(result.merged)
      }

      // Migrate chat history
      for (const msg of local.chatHistory) {
        await store.addChatMessage(msg)
      }

      // Migrate strategies
      for (const strat of local.strategies) {
        await store.addStrategy(strat)
      }

      // Migrate insights
      if (local.insights.length > 0) {
        await store.setInsights(local.insights)
      }

      // Clear local storage
      await clearLocalData()
      setShowMigrationBanner(false)
    } catch (err) {
      console.error('Migration failed:', err)
    } finally {
      setIsMigrating(false)
    }
  }

  const handleDismissMigration = () => {
    setShowMigrationBanner(false)
  }

  const handleDataLoaded = useCallback((newBets: Bet[]) => {
    setBets(newBets)
  }, [])

  const filteredBets = useMemo(() => applyFilters(bets, filters), [bets, filters])
  const filterOptions = useMemo(() => getFilterOptions(bets), [bets])
  const summary = useMemo(() => computeSummary(filteredBets), [filteredBets])
  const sportBreakdown = useMemo(() => computeSportBreakdown(filteredBets), [filteredBets])
  const betTypeBreakdown = useMemo(() => computeBetTypeBreakdown(filteredBets), [filteredBets])
  const monthlyData = useMemo(() => computeMonthlyData(filteredBets), [filteredBets])
  const timePatterns = useMemo(() => computeTimePatterns(filteredBets), [filteredBets])
  const dayPatterns = useMemo(() => computeDayPatterns(filteredBets), [filteredBets])
  const parlayBreakdown = useMemo(() => computeParlayBreakdown(filteredBets), [filteredBets])
  const insights = useMemo(() => generateInsights(filteredBets), [filteredBets])

  const clearData = async () => {
    await store.clearAll()
    setBets([])
    setFilters(DEFAULT_FILTERS)
  }

  // Show loading while checking auth
  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-zinc-400">Loading BetIQ...</div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-zinc-400">Loading your data...</div>
      </div>
    )
  }

  const hasData = bets.length > 0

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">BetIQ</span>
            <span className="text-xs bg-emerald-600/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">AI Analytics</span>
          </div>
          <div className="flex items-center gap-2">
            {hasData && (
              <>
                <span className="text-xs text-zinc-400">{bets.length} bets loaded</span>
                <Button variant="ghost" size="sm" onClick={clearData}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </>
            )}
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Migration Banner */}
      {showMigrationBanner && (
        <div className="bg-blue-900/30 border-b border-blue-800">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CloudUpload className="h-5 w-5 text-blue-400" />
              <p className="text-sm text-blue-200">
                Found <span className="font-semibold">{localBetCount} bets</span> in browser storage. Sync to your cloud account?
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismissMigration}
                disabled={isMigrating}
                className="text-blue-300 hover:text-white"
              >
                Dismiss
              </Button>
              <Button
                size="sm"
                onClick={handleMigrate}
                disabled={isMigrating}
                className="bg-blue-600 hover:bg-blue-500"
              >
                {isMigrating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    Migrating...
                  </>
                ) : (
                  'Sync to Cloud'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {!hasData ? (
          <div className="py-12">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Know Your Betting Edge
              </h1>
              <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
                Upload your sportsbook data and let AI uncover your winning patterns, expose your leaks, and coach you toward profitability.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 max-w-3xl mx-auto">
              {[
                { icon: BarChart3, title: 'Deep Analytics', desc: 'Performance dashboards with 20+ interactive charts and filters' },
                { icon: Brain, title: 'AI Insights', desc: 'Personalized coaching powered by analysis of your betting patterns' },
                { icon: Target, title: 'Strategy Builder', desc: 'What-if simulations and AI-generated betting strategies' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-center">
                  <Icon className="h-8 w-8 text-emerald-400 mx-auto mb-3" />
                  <h3 className="font-semibold text-white mb-1">{title}</h3>
                  <p className="text-sm text-zinc-400">{desc}</p>
                </div>
              ))}
            </div>
            <UploadPanel onDataLoaded={handleDataLoaded} />
            <div className="mt-12 max-w-2xl mx-auto text-center">
              <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Phone className="h-4 w-4 text-zinc-400" />
                  <span className="text-sm text-zinc-400 font-medium">Responsible Gambling Resources</span>
                </div>
                <p className="text-xs text-zinc-500">
                  If you or someone you know has a gambling problem, call the National Council on Problem Gambling helpline: 1-800-522-4700.
                  BetIQ is an educational analytics tool and does not guarantee profits.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="dashboard">
                <BarChart3 className="h-4 w-4 mr-1.5" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="insights">
                <Brain className="h-4 w-4 mr-1.5" />
                AI Insights
              </TabsTrigger>
              <TabsTrigger value="coach">
                <MessageCircle className="h-4 w-4 mr-1.5" />
                AI Coach
              </TabsTrigger>
              <TabsTrigger value="strategy">
                <Target className="h-4 w-4 mr-1.5" />
                Strategy
              </TabsTrigger>
              <TabsTrigger value="alerts">
                <Bell className="h-4 w-4 mr-1.5" />
                Alerts
              </TabsTrigger>
              <TabsTrigger value="pricing">
                <CreditCard className="h-4 w-4 mr-1.5" />
                Plans
              </TabsTrigger>
              <TabsTrigger value="upload">
                <Upload className="h-4 w-4 mr-1.5" />
                Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-6">
              <FilterBar filters={filters} onFiltersChange={setFilters} options={filterOptions} />
              <SummaryCards stats={summary} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <CumulativePLChart data={monthlyData} />
                <MonthlyPLChart data={monthlyData} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <MonthlyWinRateChart data={monthlyData} />
                <SportBreakdownChart data={sportBreakdown} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <BetTypeChart data={betTypeBreakdown} />
                <ParlayLegChart data={parlayBreakdown} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TimePatternChart data={timePatterns} />
                <DayPatternChart data={dayPatterns} />
              </div>
              <SportLeaderboard data={sportBreakdown} />
            </TabsContent>

            <TabsContent value="insights">
              <InsightsPanel insights={insights} />
            </TabsContent>

            <TabsContent value="coach">
              <ChatCoach bets={filteredBets} />
            </TabsContent>

            <TabsContent value="strategy">
              <StrategyBuilder bets={filteredBets} />
            </TabsContent>

            <TabsContent value="alerts">
              <AlertsPanel bets={filteredBets} />
            </TabsContent>

            <TabsContent value="pricing">
              <PricingPanel />
            </TabsContent>

            <TabsContent value="upload">
              <UploadPanel onDataLoaded={handleDataLoaded} />
            </TabsContent>
          </Tabs>
        )}
      </main>

      <footer className="border-t border-zinc-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span className="text-sm text-zinc-400">BetIQ v1.0</span>
          </div>
          <div className="text-xs text-zinc-500">
            Gambling problem? Call 1-800-522-4700 | BetIQ does not guarantee profitability
          </div>
        </div>
      </footer>
    </div>
  )
}

import { Bet, SummaryStats, SportBreakdown, BetTypeBreakdown, MonthlyData, TimePattern, DayPattern, ParlayLegBreakdown, PlayerPropBreakdown, DashboardFilters, AIInsight, WhatIfScenario } from '@/types/betting'
import { v4 as uuidv4 } from 'uuid'

function isWin(b: Bet) { return b.status === 'SETTLED_WIN' }
function isLoss(b: Bet) { return b.status === 'SETTLED_LOSS' }
function isPush(b: Bet) { return b.status === 'SETTLED_PUSH' }
function isSettled(b: Bet) { return b.status.startsWith('SETTLED') && b.status !== 'SETTLED_VOID' }

export function applyFilters(bets: Bet[], filters: DashboardFilters): Bet[] {
  return bets.filter(b => {
    if (filters.dateRange.start && new Date(b.placed_at) < new Date(filters.dateRange.start)) return false
    if (filters.dateRange.end && new Date(b.placed_at) > new Date(filters.dateRange.end)) return false
    if (filters.sports.length > 0 && !b.sports.some(s => filters.sports.includes(s))) return false
    if (filters.leagues.length > 0 && !b.leagues.some(l => filters.leagues.includes(l))) return false
    if (filters.sportsbooks.length > 0 && !filters.sportsbooks.includes(b.sportsbook)) return false
    if (filters.betTypes.length > 0 && !filters.betTypes.includes(b.type)) return false
    if (filters.markets.length > 0 && !b.legs.some(l => filters.markets.includes(l.market_type))) return false
    if (b.odds < filters.oddsRange.min || b.odds > filters.oddsRange.max) return false
    if (b.amount < filters.stakeRange.min || b.amount > filters.stakeRange.max) return false
    if (filters.statuses.length > 0 && !filters.statuses.includes(b.status)) return false
    return true
  })
}

export function computeSummary(bets: Bet[]): SummaryStats {
  const settled = bets.filter(isSettled)
  const wins = settled.filter(isWin).length
  const losses = settled.filter(isLoss).length
  const pushes = settled.filter(isPush).length
  const totalWagered = settled.reduce((sum, b) => sum + b.amount, 0)
  const totalPL = settled.reduce((sum, b) => sum + b.profit, 0)
  const roi = totalWagered > 0 ? totalPL / totalWagered : 0
  const winRate = (wins + losses) > 0 ? wins / (wins + losses) : 0
  const avgBetSize = settled.length > 0 ? totalWagered / settled.length : 0
  const avgOdds = settled.length > 0 ? settled.reduce((sum, b) => sum + b.odds, 0) / settled.length : 0

  const betsWithCLV = settled.filter(b => b.closing_line !== null && b.closing_line > 0)
  const clv = betsWithCLV.length > 0
    ? betsWithCLV.reduce((sum, b) => sum + ((b.closing_line! - b.odds) / b.odds), 0) / betsWithCLV.length
    : null

  const sorted = settled.sort((a, b) => new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime())
  let winStreak = 0, lossStreak = 0, maxWin = 0, maxLoss = 0
  for (const bet of sorted) {
    if (isWin(bet)) { winStreak++; lossStreak = 0; maxWin = Math.max(maxWin, winStreak) }
    else if (isLoss(bet)) { lossStreak++; winStreak = 0; maxLoss = Math.max(maxLoss, lossStreak) }
    else { winStreak = 0; lossStreak = 0 }
  }

  return { totalPL, totalWagered, roi, winRate, totalBets: settled.length, wins, losses, pushes, avgBetSize, avgOdds, clv, longestWinStreak: maxWin, longestLossStreak: maxLoss }
}

export function computeSportBreakdown(bets: Bet[]): SportBreakdown[] {
  const settled = bets.filter(isSettled)
  const byGroup = new Map<string, Bet[]>()
  for (const bet of settled) {
    for (const sport of (bet.sports.length > 0 ? bet.sports : ['Unknown'])) {
      const existing = byGroup.get(sport) || []
      existing.push(bet)
      byGroup.set(sport, existing)
    }
  }
  return Array.from(byGroup.entries()).map(([sport, sportBets]) => {
    const wins = sportBets.filter(isWin).length
    const losses = sportBets.filter(isLoss).length
    const wagered = sportBets.reduce((s, b) => s + b.amount, 0)
    const pl = sportBets.reduce((s, b) => s + b.profit, 0)
    const withCLV = sportBets.filter(b => b.closing_line !== null && b.closing_line > 0)
    return {
      sport, totalBets: sportBets.length, wins, losses,
      winRate: (wins + losses) > 0 ? wins / (wins + losses) : 0,
      totalWagered: wagered, totalPL: pl,
      roi: wagered > 0 ? pl / wagered : 0,
      avgOdds: sportBets.reduce((s, b) => s + b.odds, 0) / sportBets.length,
      clv: withCLV.length > 0 ? withCLV.reduce((s, b) => s + ((b.closing_line! - b.odds) / b.odds), 0) / withCLV.length : null,
    }
  }).sort((a, b) => b.totalPL - a.totalPL)
}

export function computeBetTypeBreakdown(bets: Bet[]): BetTypeBreakdown[] {
  const settled = bets.filter(isSettled)
  const types = ['straight', 'parlay', 'round_robin'] as const
  const results: BetTypeBreakdown[] = []
  for (const type of types) {
    const typeBets = settled.filter(b => b.type === type)
    if (typeBets.length === 0) continue
    const wins = typeBets.filter(isWin).length
    const losses = typeBets.filter(isLoss).length
    const wagered = typeBets.reduce((s, b) => s + b.amount, 0)
    const pl = typeBets.reduce((s, b) => s + b.profit, 0)
    results.push({
      type, totalBets: typeBets.length, wins, losses,
      winRate: (wins + losses) > 0 ? wins / (wins + losses) : 0,
      totalWagered: wagered, totalPL: pl,
      roi: wagered > 0 ? pl / wagered : 0,
    })
  }
  return results
}

export function computeMonthlyData(bets: Bet[]): MonthlyData[] {
  const settled = bets.filter(isSettled).sort((a, b) => new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime())
  const byMonth = new Map<string, Bet[]>()
  for (const bet of settled) {
    const d = new Date(bet.placed_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const existing = byMonth.get(key) || []
    existing.push(bet)
    byMonth.set(key, existing)
  }
  let cumPL = 0
  return Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, monthBets]) => {
    const wins = monthBets.filter(isWin).length
    const losses = monthBets.filter(isLoss).length
    const pl = monthBets.reduce((s, b) => s + b.profit, 0)
    const wagered = monthBets.reduce((s, b) => s + b.amount, 0)
    cumPL += pl
    return {
      month, bets: monthBets.length, wins,
      winRate: (wins + losses) > 0 ? wins / (wins + losses) : 0,
      pl, cumulativePL: cumPL, roi: wagered > 0 ? pl / wagered : 0, wagered,
    }
  })
}

export function computeTimePatterns(bets: Bet[]): TimePattern[] {
  const settled = bets.filter(isSettled)
  const byHour = new Map<number, Bet[]>()
  for (const bet of settled) {
    const hour = new Date(bet.placed_at).getHours()
    const existing = byHour.get(hour) || []
    existing.push(bet)
    byHour.set(hour, existing)
  }
  return Array.from({ length: 24 }, (_, hour) => {
    const hourBets = byHour.get(hour) || []
    const wins = hourBets.filter(isWin).length
    const losses = hourBets.filter(isLoss).length
    const wagered = hourBets.reduce((s, b) => s + b.amount, 0)
    const pl = hourBets.reduce((s, b) => s + b.profit, 0)
    return { hour, bets: hourBets.length, winRate: (wins + losses) > 0 ? wins / (wins + losses) : 0, roi: wagered > 0 ? pl / wagered : 0, pl }
  })
}

export function computeDayPatterns(bets: Bet[]): DayPattern[] {
  const settled = bets.filter(isSettled)
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const byDay = new Map<number, Bet[]>()
  for (const bet of settled) {
    const day = new Date(bet.placed_at).getDay()
    const existing = byDay.get(day) || []
    existing.push(bet)
    byDay.set(day, existing)
  }
  return days.map((day, i) => {
    const dayBets = byDay.get(i) || []
    const wins = dayBets.filter(isWin).length
    const losses = dayBets.filter(isLoss).length
    const wagered = dayBets.reduce((s, b) => s + b.amount, 0)
    const pl = dayBets.reduce((s, b) => s + b.profit, 0)
    return { day, bets: dayBets.length, winRate: (wins + losses) > 0 ? wins / (wins + losses) : 0, roi: wagered > 0 ? pl / wagered : 0, pl }
  })
}

export function computeParlayBreakdown(bets: Bet[]): ParlayLegBreakdown[] {
  const parlays = bets.filter(b => b.type === 'parlay' && isSettled(b))
  const byLegs = new Map<number, Bet[]>()
  for (const bet of parlays) {
    const lc = bet.leg_count
    const existing = byLegs.get(lc) || []
    existing.push(bet)
    byLegs.set(lc, existing)
  }
  return Array.from(byLegs.entries()).sort(([a], [b]) => a - b).map(([legCount, legBets]) => {
    const wins = legBets.filter(isWin).length
    const losses = legBets.filter(isLoss).length
    const wagered = legBets.reduce((s, b) => s + b.amount, 0)
    const pl = legBets.reduce((s, b) => s + b.profit, 0)
    return {
      legs: `${legCount}-leg`, totalBets: legBets.length, wins,
      winRate: (wins + losses) > 0 ? wins / (wins + losses) : 0,
      totalPL: pl, roi: wagered > 0 ? pl / wagered : 0,
      avgOdds: legBets.reduce((s, b) => s + b.odds, 0) / legBets.length,
    }
  })
}

export function computePlayerPropBreakdown(bets: Bet[]): PlayerPropBreakdown[] {
  const settled = bets.filter(isSettled)
  const byPlayer = new Map<string, { bets: Bet[], categories: Set<string> }>()
  for (const bet of settled) {
    for (const leg of bet.legs) {
      if (leg.player_name && leg.market_type === 'player_prop') {
        const existing = byPlayer.get(leg.player_name) || { bets: [], categories: new Set() }
        existing.bets.push(bet)
        if (leg.stat_category) existing.categories.add(leg.stat_category)
        byPlayer.set(leg.player_name, existing)
      }
    }
  }
  return Array.from(byPlayer.entries())
    .map(([player, data]) => {
      const wins = data.bets.filter(isWin).length
      const losses = data.bets.filter(isLoss).length
      return {
        player, totalBets: data.bets.length, wins,
        winRate: (wins + losses) > 0 ? wins / (wins + losses) : 0,
        totalPL: data.bets.reduce((s, b) => s + b.profit, 0),
        categories: Array.from(data.categories),
      }
    })
    .filter(p => p.totalBets >= 3)
    .sort((a, b) => b.totalBets - a.totalBets)
    .slice(0, 30)
}

export function computeSportsbookBreakdown(bets: Bet[]) {
  const settled = bets.filter(isSettled)
  const byBook = new Map<string, Bet[]>()
  for (const bet of settled) {
    const existing = byBook.get(bet.sportsbook) || []
    existing.push(bet)
    byBook.set(bet.sportsbook, existing)
  }
  return Array.from(byBook.entries()).map(([book, bookBets]) => {
    const wins = bookBets.filter(isWin).length
    const losses = bookBets.filter(isLoss).length
    const wagered = bookBets.reduce((s, b) => s + b.amount, 0)
    const pl = bookBets.reduce((s, b) => s + b.profit, 0)
    return {
      sportsbook: book, totalBets: bookBets.length, wins, losses,
      winRate: (wins + losses) > 0 ? wins / (wins + losses) : 0,
      totalWagered: wagered, totalPL: pl,
      roi: wagered > 0 ? pl / wagered : 0,
      avgOdds: bookBets.reduce((s, b) => s + b.odds, 0) / bookBets.length,
    }
  }).sort((a, b) => b.totalPL - a.totalPL)
}

export function generateInsights(bets: Bet[]): AIInsight[] {
  const insights: AIInsight[] = []
  const settled = bets.filter(isSettled)
  if (settled.length < 10) return insights

  const summary = computeSummary(settled)
  const sportBreakdown = computeSportBreakdown(settled)
  const betTypeBreakdown = computeBetTypeBreakdown(settled)
  const parlayBreakdown = computeParlayBreakdown(settled)
  const timePatterns = computeTimePatterns(settled)
  const playerProps = computePlayerPropBreakdown(settled)
  const bookBreakdown = computeSportsbookBreakdown(settled)

  // Parlay analysis
  const parlays = betTypeBreakdown.find(b => b.type === 'parlay')
  const straights = betTypeBreakdown.find(b => b.type === 'straight')
  if (parlays && straights && parlays.totalBets >= 10) {
    const parlayWR = (parlays.winRate * 100).toFixed(1)
    const straightWR = (straights.winRate * 100).toFixed(1)
    insights.push({
      id: uuidv4(), category: 'bet_type',
      title: `Parlays vs Straights: A ${(parlays.roi * 100).toFixed(1)}% ROI Gap`,
      description: `Your parlays hit at ${parlayWR}% (${parlays.wins}/${parlays.totalBets}) vs ${straightWR}% on straights. Parlays have cost you ${Math.abs(parlays.totalPL).toFixed(0)} while straights ${straights.totalPL >= 0 ? 'earned' : 'lost'} ${Math.abs(straights.totalPL).toFixed(0)}.`,
      impact: `$${Math.abs(parlays.totalPL - straights.totalPL).toFixed(0)} P/L difference`,
      recommendation: straights.roi > parlays.roi
        ? 'Consider shifting more volume to straight bets where your edge is stronger. If you enjoy parlays, cap them at 2-3 legs where hit rates are more sustainable.'
        : 'Your parlay game is actually solid. Focus on leg count optimization to maximize ROI.',
      severity: parlays.totalPL < 0 ? 'negative' : 'positive',
      dataPoints: { parlayWinRate: parlayWR + '%', straightWinRate: straightWR + '%', parlayPL: parlays.totalPL, straightPL: straights.totalPL },
    })
  }

  // High-leg parlay warning
  const highLeg = parlayBreakdown.filter(p => parseInt(p.legs) >= 5)
  if (highLeg.length > 0) {
    const totalHL = highLeg.reduce((s, p) => s + p.totalBets, 0)
    const plHL = highLeg.reduce((s, p) => s + p.totalPL, 0)
    const wrHL = highLeg.reduce((s, p) => s + p.wins, 0) / Math.max(1, totalHL)
    if (totalHL >= 5) {
      insights.push({
        id: uuidv4(), category: 'parlay_legs',
        title: `5+ Leg Parlays: ${(wrHL * 100).toFixed(1)}% Win Rate`,
        description: `You've placed ${totalHL} parlays with 5+ legs at a ${(wrHL * 100).toFixed(1)}% win rate, resulting in $${Math.abs(plHL).toFixed(0)} ${plHL < 0 ? 'lost' : 'won'}.`,
        impact: `$${Math.abs(plHL).toFixed(0)} impact`,
        recommendation: plHL < 0 ? 'Cap parlay legs at 3-4 max. Redirect the saved bankroll to straight bets or low-leg parlays where your hit rate is significantly higher.' : 'You\'re beating the odds on high-leg parlays. Consider if this edge is sustainable long-term.',
        severity: plHL < 0 ? 'negative' : 'positive',
        dataPoints: { bets: totalHL, winRate: (wrHL * 100).toFixed(1) + '%', pl: plHL },
      })
    }
  }

  // Best sport
  const bestSport = sportBreakdown.find(s => s.roi > 0 && s.totalBets >= 10)
  if (bestSport) {
    insights.push({
      id: uuidv4(), category: 'sport',
      title: `${bestSport.sport}: Your Most Profitable Sport (+${(bestSport.roi * 100).toFixed(1)}% ROI)`,
      description: `You're ${(bestSport.winRate * 100).toFixed(1)}% win rate on ${bestSport.sport} with $${bestSport.totalPL.toFixed(0)} in profit across ${bestSport.totalBets} bets.`,
      impact: `$${bestSport.totalPL.toFixed(0)} profit`,
      recommendation: `This is a genuine edge. Consider increasing unit size on ${bestSport.sport} by 25-50% and tracking CLV to confirm the edge persists.`,
      severity: 'positive',
      dataPoints: { sport: bestSport.sport, winRate: (bestSport.winRate * 100).toFixed(1) + '%', roi: (bestSport.roi * 100).toFixed(1) + '%', pl: bestSport.totalPL },
    })
  }

  // Worst sport
  const worstSport = [...sportBreakdown].reverse().find(s => s.roi < -0.05 && s.totalBets >= 10)
  if (worstSport) {
    insights.push({
      id: uuidv4(), category: 'sport',
      title: `${worstSport.sport}: Costing You ${(Math.abs(worstSport.roi) * 100).toFixed(1)}% ROI`,
      description: `Your ${worstSport.sport} bets have a ${(worstSport.winRate * 100).toFixed(1)}% win rate with $${Math.abs(worstSport.totalPL).toFixed(0)} in losses across ${worstSport.totalBets} bets.`,
      impact: `$${Math.abs(worstSport.totalPL).toFixed(0)} lost`,
      recommendation: `Consider reducing volume on ${worstSport.sport} or switching to different markets within the sport. Analyze which bet types within ${worstSport.sport} are performing worst.`,
      severity: 'negative',
      dataPoints: { sport: worstSport.sport, winRate: (worstSport.winRate * 100).toFixed(1) + '%', roi: (worstSport.roi * 100).toFixed(1) + '%', pl: worstSport.totalPL },
    })
  }

  // Late night betting
  const lateNight = timePatterns.filter(t => t.hour >= 23 || t.hour <= 2)
  const daytime = timePatterns.filter(t => t.hour >= 10 && t.hour <= 18)
  const lateNightBets = lateNight.reduce((s, t) => s + t.bets, 0)
  const lateNightROI = lateNight.reduce((s, t) => s + t.pl, 0) / Math.max(1, lateNight.reduce((s, t) => s + t.bets, 0) * summary.avgBetSize)
  const daytimeROI = daytime.reduce((s, t) => s + t.pl, 0) / Math.max(1, daytime.reduce((s, t) => s + t.bets, 0) * summary.avgBetSize)
  if (lateNightBets >= 10 && lateNightROI < daytimeROI - 0.05) {
    insights.push({
      id: uuidv4(), category: 'behavior',
      title: `Late-Night Bets Underperform by ${((daytimeROI - lateNightROI) * 100).toFixed(0)}% ROI`,
      description: `Your bets placed after 11 PM have a ${(lateNightROI * 100).toFixed(1)}% ROI compared to ${(daytimeROI * 100).toFixed(1)}% during daytime hours.`,
      impact: `${((daytimeROI - lateNightROI) * 100).toFixed(0)}% ROI gap`,
      recommendation: 'Set a self-imposed betting curfew or use sportsbook deposit limits during late hours. Decision quality degrades when tired.',
      severity: 'negative',
      dataPoints: { lateNightROI: (lateNightROI * 100).toFixed(1) + '%', daytimeROI: (daytimeROI * 100).toFixed(1) + '%', lateNightBets },
    })
  }

  // Sportsbook comparison
  if (bookBreakdown.length >= 2) {
    const bestBook = bookBreakdown[0]
    const worstBook = bookBreakdown[bookBreakdown.length - 1]
    if (bestBook.totalBets >= 10 && worstBook.totalBets >= 10) {
      insights.push({
        id: uuidv4(), category: 'sportsbook',
        title: `${bestBook.sportsbook} is Your Best Book (+${(bestBook.roi * 100).toFixed(1)}% ROI)`,
        description: `${bestBook.sportsbook} gives you the best results with ${(bestBook.winRate * 100).toFixed(1)}% win rate and $${bestBook.totalPL.toFixed(0)} profit. ${worstBook.sportsbook} is your worst at ${(worstBook.roi * 100).toFixed(1)}% ROI.`,
        impact: `$${(bestBook.totalPL - worstBook.totalPL).toFixed(0)} difference between best and worst book`,
        recommendation: `Line shop more aggressively. Use ${bestBook.sportsbook} as your primary book and consider reducing volume on ${worstBook.sportsbook}.`,
        severity: 'neutral',
        dataPoints: { bestBook: bestBook.sportsbook, bestROI: (bestBook.roi * 100).toFixed(1) + '%', worstBook: worstBook.sportsbook, worstROI: (worstBook.roi * 100).toFixed(1) + '%' },
      })
    }
  }

  // Player prop insights
  const profitablePlayers = playerProps.filter(p => p.totalPL > 0 && p.totalBets >= 5)
  const unprofitablePlayers = playerProps.filter(p => p.totalPL < -50 && p.totalBets >= 5)
  if (profitablePlayers.length > 0) {
    const best = profitablePlayers[0]
    insights.push({
      id: uuidv4(), category: 'props',
      title: `${best.player}: Your Best Player Prop Pick`,
      description: `You've hit ${best.wins}/${best.totalBets} (${(best.winRate * 100).toFixed(1)}%) on ${best.player} props for $${best.totalPL.toFixed(0)} profit. Categories: ${best.categories.join(', ')}.`,
      impact: `$${best.totalPL.toFixed(0)} profit`,
      recommendation: `You have a real edge on ${best.player} props. Consider increasing exposure in the ${best.categories[0]} market.`,
      severity: 'positive',
      dataPoints: { player: best.player, bets: best.totalBets, winRate: (best.winRate * 100).toFixed(1) + '%', pl: best.totalPL },
    })
  }
  if (unprofitablePlayers.length > 0) {
    const worst = unprofitablePlayers[unprofitablePlayers.length - 1]
    insights.push({
      id: uuidv4(), category: 'props',
      title: `${worst.player}: Costing You $${Math.abs(worst.totalPL).toFixed(0)}`,
      description: `You've bet ${worst.player} props ${worst.totalBets} times at ${(worst.winRate * 100).toFixed(1)}% hit rate, losing $${Math.abs(worst.totalPL).toFixed(0)}.`,
      impact: `$${Math.abs(worst.totalPL).toFixed(0)} lost`,
      recommendation: `Your conviction on ${worst.player} exceeds your edge. Consider reducing exposure or shifting to different stat categories.`,
      severity: 'negative',
      dataPoints: { player: worst.player, bets: worst.totalBets, winRate: (worst.winRate * 100).toFixed(1) + '%', pl: worst.totalPL },
    })
  }

  // CLV analysis
  if (summary.clv !== null) {
    const clvPercent = (summary.clv * 100).toFixed(2)
    insights.push({
      id: uuidv4(), category: 'clv',
      title: `Closing Line Value: ${summary.clv >= 0 ? '+' : ''}${clvPercent}%`,
      description: summary.clv >= 0
        ? `You're beating closing lines by an average of ${clvPercent}%. This is a strong indicator of sharp betting.`
        : `You're getting ${clvPercent}% worse odds than closing lines on average. This suggests room for improvement in timing.`,
      impact: 'Long-term profitability indicator',
      recommendation: summary.clv >= 0
        ? 'Keep doing what you\'re doing. Consistently beating closing lines is the hallmark of a sharp bettor.'
        : 'Try placing bets earlier when lines first open, or focus on markets where you show positive CLV.',
      severity: summary.clv >= 0 ? 'positive' : 'negative',
      dataPoints: { clv: clvPercent + '%' },
    })
  }

  return insights
}

export function runWhatIfScenario(bets: Bet[], scenario: WhatIfScenario['filter']): { actualPL: number; hypotheticalPL: number } {
  const settled = bets.filter(isSettled)
  const actualPL = settled.reduce((s, b) => s + b.profit, 0)

  let filtered = [...settled]
  if (scenario.maxLegs) {
    filtered = filtered.filter(b => b.leg_count <= scenario.maxLegs!)
  }
  if (scenario.excludeSports) {
    filtered = filtered.filter(b => !b.sports.some(s => scenario.excludeSports!.includes(s)))
  }
  if (scenario.onlyTypes) {
    filtered = filtered.filter(b => scenario.onlyTypes!.includes(b.type))
  }
  if (scenario.evOnly) {
    filtered = filtered.filter(b => b.ev !== null && b.ev > 0)
  }

  let hypotheticalPL: number
  if (scenario.maxStake) {
    hypotheticalPL = filtered.reduce((s, b) => {
      const cappedAmount = Math.min(b.amount, scenario.maxStake!)
      const ratio = cappedAmount / b.amount
      return s + b.profit * ratio
    }, 0)
  } else if (scenario.flatUnit) {
    hypotheticalPL = filtered.reduce((s, b) => {
      if (b.status === 'SETTLED_WIN') return s + scenario.flatUnit! * (b.odds - 1)
      if (b.status === 'SETTLED_LOSS') return s - scenario.flatUnit!
      return s
    }, 0)
  } else {
    hypotheticalPL = filtered.reduce((s, b) => s + b.profit, 0)
  }

  return { actualPL, hypotheticalPL }
}

export function getFilterOptions(bets: Bet[]) {
  const sports = new Set<string>()
  const leagues = new Set<string>()
  const sportsbooks = new Set<string>()
  for (const bet of bets) {
    bet.sports.forEach(s => sports.add(s))
    bet.leagues.forEach(l => leagues.add(l))
    sportsbooks.add(bet.sportsbook)
  }
  return {
    sports: Array.from(sports).sort(),
    leagues: Array.from(leagues).sort(),
    sportsbooks: Array.from(sportsbooks).sort(),
  }
}

export const DEFAULT_FILTERS: DashboardFilters = {
  dateRange: { start: null, end: null, preset: 'all' },
  sports: [],
  leagues: [],
  sportsbooks: [],
  betTypes: [],
  markets: [],
  oddsRange: { min: 1, max: 1000 },
  stakeRange: { min: 0, max: 100000 },
  statuses: [],
}

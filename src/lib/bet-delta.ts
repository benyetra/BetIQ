// Compute delta/cushion for a bet leg against live scores
// and estimate game elapsed time from commence_time

export interface DeltaInfo {
  label: string
  value: number
  type: 'cushion' | 'need' | 'covering' | 'behind' | 'leading' | 'trailing' | 'tied'
}

/**
 * Fuzzy-match a selection team name against a full team name.
 * E.g., "Chiefs" matches "Kansas City Chiefs", "Louisville" matches "Louisville Cardinals"
 */
function teamMatches(selectionName: string, fullName: string): boolean {
  const sel = selectionName.toLowerCase().trim()
  const full = fullName.toLowerCase().trim()
  return full === sel || full.includes(sel) || sel.includes(full)
}

/**
 * Compute the delta/cushion for a bet leg given the current scores.
 *
 * - Totals (Over/Under): Shows how much cushion remains or how far over the line
 * - Spreads: Shows if covering or behind the spread
 * - Moneyline: Shows score margin (leading/trailing)
 */
export function computeBetDelta(
  leg: { market_type: string; selection: string; home_team: string; away_team: string },
  homeScore: number,
  awayScore: number
): DeltaInfo | null {
  const totalScore = homeScore + awayScore

  // Total (Over/Under)
  if (leg.market_type === 'total') {
    const match = leg.selection.match(/^(Over|Under)\s+([\d.]+)$/i)
    if (!match) return null
    const direction = match[1].toLowerCase()
    const line = parseFloat(match[2])

    if (direction === 'under') {
      const cushion = line - totalScore
      if (cushion > 0) {
        return { label: `${fmt(cushion)} pts cushion`, value: cushion, type: 'cushion' }
      }
      return { label: `Over by ${fmt(Math.abs(cushion))}`, value: cushion, type: 'behind' }
    } else {
      const needed = line - totalScore
      if (needed > 0) {
        return { label: `Need ${fmt(needed)} more`, value: -needed, type: 'need' }
      }
      return { label: `Over by ${fmt(Math.abs(needed))}`, value: Math.abs(needed), type: 'covering' }
    }
  }

  // Spread
  if (leg.market_type === 'spread') {
    const match = leg.selection.match(/^(.+?)\s+([+-][\d.]+)$/)
    if (!match) return null
    const teamName = match[1].trim()
    const spread = parseFloat(match[2])

    const isHome = teamMatches(teamName, leg.home_team)
    const teamScore = isHome ? homeScore : awayScore
    const oppScore = isHome ? awayScore : homeScore

    // Adjusted margin: teamScore + spread - oppScore
    const margin = teamScore + spread - oppScore
    if (margin > 0) {
      return { label: `Covering by ${fmt(margin)}`, value: margin, type: 'covering' }
    }
    if (margin === 0) {
      return { label: 'On the number', value: 0, type: 'tied' }
    }
    return { label: `Behind by ${fmt(Math.abs(margin))}`, value: margin, type: 'behind' }
  }

  // Moneyline
  if (leg.market_type === 'moneyline') {
    const teamName = leg.selection.trim()
    const isHome = teamMatches(teamName, leg.home_team)
    const teamScore = isHome ? homeScore : awayScore
    const oppScore = isHome ? awayScore : homeScore
    const margin = teamScore - oppScore

    if (margin > 0) return { label: `Up by ${margin}`, value: margin, type: 'leading' }
    if (margin < 0) return { label: `Down by ${Math.abs(margin)}`, value: margin, type: 'trailing' }
    return { label: 'Tied', value: 0, type: 'tied' }
  }

  return null
}

/** Format a number, dropping ".0" for whole numbers */
function fmt(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

/**
 * Get a display string for game elapsed time.
 * Returns null if no meaningful display is available.
 */
export function getGameTimeDisplay(
  commenceTime: string,
  completed: boolean | undefined,
  gameStatus: string | null | undefined
): string | null {
  if (completed || gameStatus === 'completed') return 'Final'

  const start = new Date(commenceTime)
  const now = new Date()

  if (gameStatus === 'in_progress') {
    const elapsedMs = now.getTime() - start.getTime()
    if (elapsedMs < 0) return 'Live'
    const elapsedMin = Math.floor(elapsedMs / 60000)
    if (elapsedMin < 60) return `${elapsedMin}m in`
    const hours = Math.floor(elapsedMin / 60)
    const mins = elapsedMin % 60
    return `${hours}h ${mins}m in`
  }

  // Scheduled — show countdown
  const diffMs = start.getTime() - now.getTime()
  if (diffMs <= 0) return null // started but status not updated yet
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `Starts in ${diffMin}m`
  const hours = Math.floor(diffMin / 60)
  if (hours < 24) return `Starts in ${hours}h`
  return `${Math.floor(hours / 24)}d away`
}

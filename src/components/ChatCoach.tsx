"use client"
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChatMessage, Bet, SummaryStats, SportBreakdown, BetTypeBreakdown } from '@/types/betting'
import { store } from '@/lib/store'
import { computeSummary, computeSportBreakdown, computeBetTypeBreakdown, computeParlayBreakdown, computePlayerPropBreakdown, computeSportsbookBreakdown } from '@/lib/analytics'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { MessageCircle, Send, Loader2, Trash2, Bot, User } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

interface ChatCoachProps {
  bets: Bet[]
}

function buildAnalyticsContext(bets: Bet[]): string {
  const summary = computeSummary(bets)
  const sports = computeSportBreakdown(bets)
  const betTypes = computeBetTypeBreakdown(bets)
  const parlays = computeParlayBreakdown(bets)
  const props = computePlayerPropBreakdown(bets)
  const books = computeSportsbookBreakdown(bets)

  return `You are BetIQ's AI Betting Coach. You analyze users' betting data and provide personalized, data-driven coaching.

CORE PRINCIPLES:
- Be honest but encouraging. Lead with what's working, then address what's not.
- EVERY recommendation MUST cite specific numbers from the user's data. Never give generic advice.
- If a user loves parlays, don't tell them to stop. Show them how to build smarter parlays.
- Include responsible gambling awareness when appropriate.

USER'S BETTING DATA SUMMARY:
- Total Bets: ${summary.totalBets}
- Total P/L: ${formatCurrency(summary.totalPL)}
- Total Wagered: ${formatCurrency(summary.totalWagered)}
- ROI: ${formatPercent(summary.roi)}
- Win Rate: ${formatPercent(summary.winRate)} (${summary.wins}W - ${summary.losses}L - ${summary.pushes}P)
- Average Bet Size: ${formatCurrency(summary.avgBetSize)}
- Average Odds: ${summary.avgOdds.toFixed(2)}
- CLV: ${summary.clv !== null ? (summary.clv * 100).toFixed(2) + '%' : 'N/A'}
- Longest Win Streak: ${summary.longestWinStreak}
- Longest Loss Streak: ${summary.longestLossStreak}

SPORT BREAKDOWN:
${sports.map(s => `- ${s.sport}: ${s.totalBets} bets, ${formatPercent(s.winRate)} win rate, ${formatPercent(s.roi)} ROI, ${formatCurrency(s.totalPL)} P/L`).join('\n')}

BET TYPE BREAKDOWN:
${betTypes.map(b => `- ${b.type}: ${b.totalBets} bets, ${formatPercent(b.winRate)} win rate, ${formatPercent(b.roi)} ROI, ${formatCurrency(b.totalPL)} P/L`).join('\n')}

PARLAY BREAKDOWN BY LEGS:
${parlays.map(p => `- ${p.legs}: ${p.totalBets} bets, ${formatPercent(p.winRate)} win rate, ${formatCurrency(p.totalPL)} P/L, avg odds ${p.avgOdds.toFixed(2)}`).join('\n')}

TOP PLAYER PROP PICKS:
${props.slice(0, 10).map(p => `- ${p.player}: ${p.totalBets} bets, ${formatPercent(p.winRate)} win rate, ${formatCurrency(p.totalPL)} P/L (${p.categories.join(', ')})`).join('\n')}

SPORTSBOOK BREAKDOWN:
${books.map(b => `- ${b.sportsbook}: ${b.totalBets} bets, ${formatPercent(b.winRate)} win rate, ${formatPercent(b.roi)} ROI, ${formatCurrency(b.totalPL)} P/L`).join('\n')}

Answer the user's question using ONLY the data above. Be specific, cite numbers, and give actionable advice. Keep responses concise but thorough. Use markdown formatting.`
}

function generateLocalResponse(question: string, bets: Bet[]): string {
  const lower = question.toLowerCase()
  const summary = computeSummary(bets)
  const sports = computeSportBreakdown(bets)
  const betTypes = computeBetTypeBreakdown(bets)
  const parlays = computeParlayBreakdown(bets)
  const props = computePlayerPropBreakdown(bets)
  const books = computeSportsbookBreakdown(bets)

  if (lower.includes('best sport') || lower.includes('most profitable sport')) {
    const best = sports[0]
    if (!best) return "I don't have enough data to determine your best sport yet."
    return `**Your best sport is ${best.sport}** with ${formatPercent(best.roi)} ROI and ${formatCurrency(best.totalPL)} profit across ${best.totalBets} bets.\n\nHere's your full sport ranking:\n${sports.map((s, i) => `${i + 1}. **${s.sport}**: ${formatPercent(s.roi)} ROI, ${formatPercent(s.winRate)} win rate, ${formatCurrency(s.totalPL)}`).join('\n')}\n\nConsider focusing more volume on ${best.sport} where you clearly have an edge.`
  }

  if (lower.includes('parlay') || lower.includes('should i') && lower.includes('parlay')) {
    const parlayType = betTypes.find(b => b.type === 'parlay')
    const straightType = betTypes.find(b => b.type === 'straight')
    if (!parlayType) return "You haven't placed enough parlays for me to analyze."
    let response = `**Parlay Analysis:**\n- Win rate: ${formatPercent(parlayType.winRate)} on ${parlayType.totalBets} parlays\n- P/L: ${formatCurrency(parlayType.totalPL)} (${formatPercent(parlayType.roi)} ROI)\n\n**By leg count:**\n`
    response += parlays.map(p => `- ${p.legs}: ${formatPercent(p.winRate)} win rate, ${formatCurrency(p.totalPL)} P/L`).join('\n')
    if (straightType) {
      response += `\n\n**For comparison**, your straights hit at ${formatPercent(straightType.winRate)} with ${formatPercent(straightType.roi)} ROI.`
    }
    const badParlays = parlays.filter(p => parseInt(p.legs) >= 5 && p.totalPL < 0)
    if (badParlays.length > 0) {
      response += `\n\n**Recommendation:** Your 5+ leg parlays are costing you. Consider capping at 3-4 legs where your win rate is significantly higher.`
    }
    return response
  }

  if (lower.includes('player prop') || lower.includes('props')) {
    if (props.length === 0) return "I don't have enough player prop data to analyze yet."
    const profitable = props.filter(p => p.totalPL > 0)
    const unprofitable = props.filter(p => p.totalPL < 0)
    let response = `**Player Prop Analysis:**\n\n`
    if (profitable.length > 0) {
      response += `**Profitable picks:**\n${profitable.slice(0, 5).map(p => `- ${p.player}: ${formatPercent(p.winRate)} win rate, ${formatCurrency(p.totalPL)} profit (${p.categories.join(', ')})`).join('\n')}\n\n`
    }
    if (unprofitable.length > 0) {
      response += `**Losing picks:**\n${unprofitable.slice(-5).map(p => `- ${p.player}: ${formatPercent(p.winRate)} win rate, ${formatCurrency(p.totalPL)} (${p.categories.join(', ')})`).join('\n')}\n\n`
    }
    response += `Focus on the players and categories where you show genuine edge.`
    return response
  }

  if (lower.includes('size') || lower.includes('staking') || lower.includes('bankroll') || lower.includes('unit')) {
    return `**Staking Analysis:**\n\n- Average bet: ${formatCurrency(summary.avgBetSize)}\n- Total wagered: ${formatCurrency(summary.totalWagered)}\n- ROI: ${formatPercent(summary.roi)}\n\n**Recommendation:** Based on your current results, consider a flat-unit approach:\n1. Set your unit size at 1-2% of your bankroll\n2. Bet 1 unit on standard plays, max 3 units on highest-conviction plays\n3. Never risk more than 5% of bankroll on a single bet\n\nThis smooths out variance and prevents tilt-driven oversizing.`
  }

  if (lower.includes('worst month') || lower.includes('bad month')) {
    return `**Performance Summary:**\n\nYour overall record is ${summary.wins}W-${summary.losses}L-${summary.pushes}P with ${formatCurrency(summary.totalPL)} total P/L.\n\nYour ${summary.roi >= 0 ? 'profitable' : 'losing'} areas:\n${sports.slice(0, 3).map(s => `- ${s.sport}: ${formatCurrency(s.totalPL)}`).join('\n')}\n\nFocus on cutting losses in your weakest sports and doubling down on your strengths.`
  }

  if (lower.includes('sportsbook') || lower.includes('book') || lower.includes('line shop')) {
    return `**Sportsbook Comparison:**\n\n${books.map(b => `- **${b.sportsbook}**: ${b.totalBets} bets, ${formatPercent(b.roi)} ROI, ${formatCurrency(b.totalPL)} P/L`).join('\n')}\n\n**Recommendation:** ${books[0]?.sportsbook || 'N/A'} is your best-performing book. Consider using it as your primary and line-shopping the rest.`
  }

  // Default response
  return `**Here's your quick summary:**\n\n- **Total P/L:** ${formatCurrency(summary.totalPL)} across ${summary.totalBets} bets\n- **ROI:** ${formatPercent(summary.roi)}\n- **Win Rate:** ${formatPercent(summary.winRate)}\n- **Best Sport:** ${sports[0]?.sport || 'N/A'} (${sports[0] ? formatPercent(sports[0].roi) + ' ROI' : ''})\n\nAsk me about specific topics like:\n- "What's my best sport?"\n- "Should I keep betting parlays?"\n- "How should I size my bets?"\n- "Analyze my player props"\n- "Compare my sportsbooks"`
}

export default function ChatCoach({ bets }: ChatCoachProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => store.getChatHistory())
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMsg])
    store.addChatMessage(userMsg)
    setInput('')
    setIsLoading(true)

    // Try API first, fall back to local
    let responseText: string
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input.trim(),
          context: buildAnalyticsContext(bets),
          history: messages.slice(-10),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        responseText = data.response
      } else {
        responseText = generateLocalResponse(input.trim(), bets)
      }
    } catch {
      responseText = generateLocalResponse(input.trim(), bets)
    }

    const assistantMsg: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, assistantMsg])
    store.addChatMessage(assistantMsg)
    setIsLoading(false)
  }, [input, isLoading, bets, messages])

  const clearChat = () => {
    setMessages([])
    store.clearChatHistory()
  }

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="flex-shrink-0 flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-emerald-400" />
          <CardTitle className="text-lg">AI Betting Coach</CardTitle>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearChat}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <MessageCircle className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400">Ask your AI coach anything about your betting data.</p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {["What's my best sport?", "Analyze my parlays", "How should I size my bets?", "Compare my sportsbooks"].map(q => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); }}
                    className="px-3 py-1.5 bg-zinc-800 rounded-full text-xs text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800 text-zinc-200'
              }`}>
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-zinc-700 flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-zinc-800 rounded-2xl px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              </div>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 border-t border-zinc-800 p-4">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask about your betting data..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
            <Button onClick={sendMessage} disabled={!input.trim() || isLoading} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

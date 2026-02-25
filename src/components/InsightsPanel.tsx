"use client"
import React from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AIInsight } from '@/types/betting'
import { Lightbulb, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react'

interface InsightsPanelProps {
  insights: AIInsight[]
}

function InsightCard({ insight }: { insight: AIInsight }) {
  const [expanded, setExpanded] = React.useState(false)
  const Icon = insight.severity === 'positive' ? TrendingUp : insight.severity === 'negative' ? TrendingDown : Minus
  const iconColor = insight.severity === 'positive' ? 'text-emerald-400' : insight.severity === 'negative' ? 'text-red-400' : 'text-blue-400'

  return (
    <Card className="hover:border-zinc-700 transition-colors">
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-3">
          <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${iconColor}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-white text-sm">{insight.title}</h3>
              <Badge variant={insight.severity}>{insight.category}</Badge>
            </div>
            <p className="text-zinc-400 text-sm">{insight.description}</p>
            {expanded && (
              <div className="mt-3 space-y-2">
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-xs text-zinc-400 font-medium mb-1">Impact</p>
                  <p className="text-sm text-white">{insight.impact}</p>
                </div>
                <div className="bg-emerald-900/20 border border-emerald-800/30 rounded-lg p-3">
                  <p className="text-xs text-emerald-400 font-medium mb-1">Recommendation</p>
                  <p className="text-sm text-zinc-300">{insight.recommendation}</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex-shrink-0">
            {expanded ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function InsightsPanel({ insights }: InsightsPanelProps) {
  if (insights.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Lightbulb className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">Upload more betting data to unlock AI-powered insights.</p>
          <p className="text-zinc-500 text-sm mt-1">We need at least 10 settled bets to generate insights.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="h-5 w-5 text-yellow-400" />
        <h2 className="font-semibold text-white">AI Insights</h2>
        <Badge variant="neutral">{insights.length} findings</Badge>
      </div>
      {insights.map(insight => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </div>
  )
}

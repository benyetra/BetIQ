"use client"
import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { MonthlyData, SportBreakdown, BetTypeBreakdown, ParlayLegBreakdown, TimePattern, DayPattern } from '@/types/betting'
import { formatCurrency, formatPercent } from '@/lib/utils'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, AreaChart, Area,
} from 'recharts'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-xl">
      <p className="text-zinc-400 text-xs mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? (p.name.includes('Rate') || p.name.includes('ROI') ? formatPercent(p.value) : formatCurrency(p.value)) : p.value}
        </p>
      ))}
    </div>
  )
}

export function CumulativePLChart({ data }: { data: MonthlyData[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-zinc-300">Cumulative P/L Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="plGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 11 }} />
            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={0} stroke="#52525b" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="cumulativePL" stroke="#10b981" fill="url(#plGradient)" name="Cumulative P/L" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function MonthlyWinRateChart({ data }: { data: MonthlyData[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-zinc-300">Win Rate by Month</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 11 }} />
            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={0.5} stroke="#52525b" strokeDasharray="3 3" />
            <Bar dataKey="winRate" name="Win Rate" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.winRate >= 0.5 ? '#10b981' : entry.winRate >= 0.4 ? '#f59e0b' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function MonthlyPLChart({ data }: { data: MonthlyData[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-zinc-300">Monthly P/L</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 11 }} />
            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={0} stroke="#52525b" />
            <Bar dataKey="pl" name="P/L" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.pl >= 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function SportBreakdownChart({ data }: { data: SportBreakdown[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-zinc-300">P/L by Sport</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
            <YAxis type="category" dataKey="sport" tick={{ fill: '#71717a', fontSize: 11 }} width={80} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine x={0} stroke="#52525b" />
            <Bar dataKey="totalPL" name="P/L" radius={[0, 4, 4, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.totalPL >= 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function BetTypeChart({ data }: { data: BetTypeBreakdown[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-zinc-300">Performance by Bet Type</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((bt, i) => (
            <div key={bt.type} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-300 capitalize">{bt.type}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-zinc-400">{bt.totalBets} bets</span>
                  <span className={`text-sm font-bold ${bt.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(bt.totalPL)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${bt.winRate * 100}%`, backgroundColor: COLORS[i % COLORS.length] }}
                  />
                </div>
                <span className="text-xs text-zinc-400 w-12 text-right">{formatPercent(bt.winRate)}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function ParlayLegChart({ data }: { data: ParlayLegBreakdown[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-zinc-300">Parlay Performance by Leg Count</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="legs" tick={{ fill: '#71717a', fontSize: 11 }} />
            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="winRate" name="Win Rate" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.winRate >= 0.15 ? '#10b981' : entry.winRate >= 0.08 ? '#f59e0b' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function TimePatternChart({ data }: { data: TimePattern[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-zinc-300">Betting Volume by Hour</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="hour" tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(h) => `${h}:00`} />
            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="bets" name="Bets" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function DayPatternChart({ data }: { data: DayPattern[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-zinc-300">ROI by Day of Week</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(d) => d.slice(0, 3)} />
            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={0} stroke="#52525b" />
            <Bar dataKey="roi" name="ROI" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.roi >= 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function SportLeaderboard({ data }: { data: SportBreakdown[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-zinc-300">Sport Leaderboard</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left text-zinc-400 font-medium py-2 pr-4">Sport</th>
                <th className="text-right text-zinc-400 font-medium py-2 px-2">Bets</th>
                <th className="text-right text-zinc-400 font-medium py-2 px-2">Win%</th>
                <th className="text-right text-zinc-400 font-medium py-2 px-2">ROI</th>
                <th className="text-right text-zinc-400 font-medium py-2 pl-2">P/L</th>
              </tr>
            </thead>
            <tbody>
              {data.map((sport) => (
                <tr key={sport.sport} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="py-2 pr-4 font-medium text-white">{sport.sport}</td>
                  <td className="text-right py-2 px-2 text-zinc-400">{sport.totalBets}</td>
                  <td className="text-right py-2 px-2 text-zinc-300">{formatPercent(sport.winRate)}</td>
                  <td className={`text-right py-2 px-2 ${sport.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatPercent(sport.roi)}
                  </td>
                  <td className={`text-right py-2 pl-2 font-medium ${sport.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(sport.totalPL)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

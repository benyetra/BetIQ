"use client"
import React from 'react'
import { cn } from '@/lib/utils'

interface OddsSparklineProps {
  data: number[]
  width?: number
  height?: number
  className?: string
  showCurrentValue?: boolean
}

export default function OddsSparkline({
  data,
  width = 200,
  height = 60,
  className,
  showCurrentValue = true,
}: OddsSparklineProps) {
  if (data.length < 2) {
    return (
      <div className={cn('flex items-center justify-center text-zinc-500 text-sm', className)} style={{ width, height }}>
        Waiting for data...
      </div>
    )
  }

  const padding = 4
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data.map((value, i) => {
    const x = padding + (i / (data.length - 1)) * chartWidth
    const y = padding + chartHeight - ((value - min) / range) * chartHeight
    return `${x},${y}`
  }).join(' ')

  const lastValue = data[data.length - 1]
  const prevValue = data[data.length - 2]
  const isUp = lastValue >= prevValue
  const strokeColor = isUp ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)'

  // Create fill path
  const fillPoints = `${padding},${padding + chartHeight} ${points} ${padding + chartWidth},${padding + chartHeight}`

  return (
    <div className={cn('relative', className)}>
      <svg width={width} height={height}>
        {/* Fill gradient */}
        <defs>
          <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={fillPoints} fill="url(#sparkline-gradient)" />
        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Current value dot */}
        {data.length > 0 && (
          <circle
            cx={padding + chartWidth}
            cy={padding + chartHeight - ((lastValue - min) / range) * chartHeight}
            r="3"
            fill={strokeColor}
            className="animate-pulse"
          />
        )}
      </svg>
      {showCurrentValue && (
        <div className={cn('text-xs font-medium mt-1', isUp ? 'text-emerald-400' : 'text-red-400')}>
          {isUp ? '▲' : '▼'} {lastValue > 0 ? '+' : ''}{lastValue}
        </div>
      )}
    </div>
  )
}

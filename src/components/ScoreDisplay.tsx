"use client"
import React, { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface ScoreDisplayProps {
  score: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  animate?: boolean
}

// Odometer-style animated digit
function AnimatedDigit({ digit, size }: { digit: string; size: string }) {
  const [currentDigit, setCurrentDigit] = useState(digit)
  const [isAnimating, setIsAnimating] = useState(false)
  const prevDigitRef = useRef(digit)

  useEffect(() => {
    if (digit !== prevDigitRef.current) {
      setIsAnimating(true)
      const timer = setTimeout(() => {
        setCurrentDigit(digit)
        setIsAnimating(false)
      }, 300)
      prevDigitRef.current = digit
      return () => clearTimeout(timer)
    }
  }, [digit])

  const sizeClasses = {
    sm: 'text-2xl h-8',
    md: 'text-4xl h-12',
    lg: 'text-6xl h-16',
    xl: 'text-8xl h-24',
  }[size]

  return (
    <span className={cn('inline-block overflow-hidden relative font-mono font-bold tabular-nums', sizeClasses)}>
      <span
        className={cn(
          'inline-block transition-transform duration-300 ease-out',
          isAnimating ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'
        )}
      >
        {currentDigit}
      </span>
    </span>
  )
}

export default function ScoreDisplay({ score, size = 'lg', className, animate = true }: ScoreDisplayProps) {
  const digits = String(score).split('')

  if (!animate) {
    const textSize = { sm: 'text-2xl', md: 'text-4xl', lg: 'text-6xl', xl: 'text-8xl' }[size]
    return (
      <span className={cn('font-mono font-bold tabular-nums', textSize, className)}>
        {score}
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center', className)}>
      {digits.map((digit, i) => (
        <AnimatedDigit key={`${i}-${digits.length}`} digit={digit} size={size} />
      ))}
    </span>
  )
}

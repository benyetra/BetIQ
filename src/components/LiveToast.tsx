"use client"
import React, { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

export interface ToastMessage {
  id: string
  message: string
  type: 'score_update' | 'leg_won' | 'leg_lost' | 'bet_won' | 'bet_lost' | 'info'
  duration?: number
}

interface LiveToastProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
  variant?: 'tracker' | 'presentation'
}

const typeStyles = {
  score_update: 'border-blue-500/30 bg-blue-950/80',
  leg_won: 'border-emerald-500/30 bg-emerald-950/80',
  leg_lost: 'border-red-500/30 bg-red-950/80',
  bet_won: 'border-emerald-400/50 bg-emerald-900/90',
  bet_lost: 'border-red-400/50 bg-red-900/90',
  info: 'border-zinc-500/30 bg-zinc-900/80',
}

const typeIcons = {
  score_update: '📊',
  leg_won: '✅',
  leg_lost: '❌',
  bet_won: '🎉',
  bet_lost: '📉',
  info: 'ℹ️',
}

function Toast({ toast, onDismiss, variant }: { toast: ToastMessage; onDismiss: (id: string) => void; variant: 'tracker' | 'presentation' }) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const duration = toast.duration || (variant === 'presentation' ? 8000 : 5000)
    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onDismiss(toast.id), 300)
    }, duration)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onDismiss, variant])

  const isPresentation = variant === 'presentation'

  return (
    <div
      className={cn(
        'border rounded-lg backdrop-blur-sm shadow-lg transition-all duration-300',
        typeStyles[toast.type],
        isExiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0',
        isPresentation
          ? 'px-6 py-4 text-lg w-full max-w-4xl'
          : 'px-4 py-3 text-sm w-80'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={isPresentation ? 'text-2xl' : 'text-base'}>{typeIcons[toast.type]}</span>
          <span className={cn('text-white font-medium', isPresentation ? 'text-xl' : 'text-sm')}>
            {toast.message}
          </span>
        </div>
        <button
          onClick={() => { setIsExiting(true); setTimeout(() => onDismiss(toast.id), 300) }}
          className="text-zinc-400 hover:text-white transition-colors"
        >
          <X className={isPresentation ? 'h-6 w-6' : 'h-4 w-4'} />
        </button>
      </div>
    </div>
  )
}

export default function LiveToast({ toasts, onDismiss, variant = 'tracker' }: LiveToastProps) {
  const visibleToasts = toasts.slice(-3)

  return (
    <div
      className={cn(
        'fixed z-[100] flex flex-col gap-2',
        variant === 'presentation'
          ? 'bottom-8 left-1/2 -translate-x-1/2 items-center w-full px-8'
          : 'top-20 right-4 items-end'
      )}
    >
      {visibleToasts.map(toast => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} variant={variant} />
      ))}
    </div>
  )
}

// Hook for managing toast state
export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  let counter = 0

  const addToast = useCallback((message: string, type: ToastMessage['type'], duration?: number) => {
    const id = `toast-${Date.now()}-${counter++}`
    setToasts(prev => [...prev, { id, message, type, duration }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, addToast, dismissToast }
}

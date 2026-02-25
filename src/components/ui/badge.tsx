import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'positive' | 'negative' | 'neutral'
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-zinc-800 text-zinc-300',
    positive: 'bg-emerald-900/50 text-emerald-400 border-emerald-800',
    negative: 'bg-red-900/50 text-red-400 border-red-800',
    neutral: 'bg-blue-900/50 text-blue-400 border-blue-800',
  }
  return (
    <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors", variants[variant], className)} {...props} />
  )
}

export { Badge }

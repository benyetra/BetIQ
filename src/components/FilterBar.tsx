"use client"
import React from 'react'
import { Button } from '@/components/ui/button'
import { DashboardFilters, BetType } from '@/types/betting'
import { DEFAULT_FILTERS } from '@/lib/analytics'
import { Filter, X } from 'lucide-react'

interface FilterBarProps {
  filters: DashboardFilters
  onFiltersChange: (filters: DashboardFilters) => void
  options: { sports: string[]; leagues: string[]; sportsbooks: string[] }
}

function MultiSelect({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-zinc-400 font-medium">{label}</label>
      <div className="flex flex-wrap gap-1">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              selected.includes(opt)
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function FilterBar({ filters, onFiltersChange, options }: FilterBarProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const activeCount = [
    filters.sports.length > 0,
    filters.leagues.length > 0,
    filters.sportsbooks.length > 0,
    filters.betTypes.length > 0,
    filters.dateRange.preset !== 'all',
  ].filter(Boolean).length

  const setDatePreset = (preset: string) => {
    const now = new Date()
    let start: string | null = null
    if (preset === '7d') start = new Date(now.getTime() - 7 * 86400000).toISOString()
    else if (preset === '30d') start = new Date(now.getTime() - 30 * 86400000).toISOString()
    else if (preset === '90d') start = new Date(now.getTime() - 90 * 86400000).toISOString()
    else if (preset === 'ytd') start = new Date(now.getFullYear(), 0, 1).toISOString()
    onFiltersChange({ ...filters, dateRange: { start, end: null, preset } })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setIsOpen(!isOpen)}>
          <Filter className="h-4 w-4 mr-1" />
          Filters
          {activeCount > 0 && (
            <span className="ml-1 bg-emerald-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">{activeCount}</span>
          )}
        </Button>

        <div className="flex gap-1">
          {['all', '7d', '30d', '90d', 'ytd'].map(preset => (
            <Button
              key={preset}
              variant={filters.dateRange.preset === preset ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setDatePreset(preset)}
            >
              {preset === 'all' ? 'All Time' : preset.toUpperCase()}
            </Button>
          ))}
        </div>

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onFiltersChange(DEFAULT_FILTERS)}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 space-y-4">
          <MultiSelect label="Sports" options={options.sports} selected={filters.sports} onChange={(v) => onFiltersChange({ ...filters, sports: v })} />
          <MultiSelect label="Leagues" options={options.leagues} selected={filters.leagues} onChange={(v) => onFiltersChange({ ...filters, leagues: v })} />
          <MultiSelect label="Sportsbooks" options={options.sportsbooks} selected={filters.sportsbooks} onChange={(v) => onFiltersChange({ ...filters, sportsbooks: v })} />
          <MultiSelect
            label="Bet Type"
            options={['straight', 'parlay', 'round_robin']}
            selected={filters.betTypes}
            onChange={(v) => onFiltersChange({ ...filters, betTypes: v as BetType[] })}
          />
        </div>
      )}
    </div>
  )
}

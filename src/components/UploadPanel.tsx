"use client"
import React, { useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { parseCSV, generateSampleData, ParseResult } from '@/lib/parser'
import { store } from '@/lib/store'
import { Bet } from '@/types/betting'
import { Upload, CloudUpload, FileText, CheckCircle, AlertCircle, Loader2, Database } from 'lucide-react'

interface UploadPanelProps {
  onDataLoaded: (bets: Bet[]) => void
}

export default function UploadPanel({ onDataLoaded }: UploadPanelProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true)
    setError(null)
    setResult(null)

    try {
      const text = await file.text()
      const existing = await store.getBets()
      const existingIds = new Set(existing.map(b => b.bet_id))
      const parseResult = await parseCSV(text, existingIds)

      if (parseResult.bets.length > 0) {
        const mergeResult = await store.addBets(parseResult.bets)
        parseResult.duplicates += mergeResult.duplicates
        store.addUpload({
          id: crypto.randomUUID(),
          filename: file.name,
          uploaded_at: new Date().toISOString(),
          row_count: parseResult.parsedRows,
          status: 'complete',
        })
        // Pass the in-memory merged array directly — don't round-trip through storage
        onDataLoaded(mergeResult.merged)
      }
      setResult(parseResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV')
    } finally {
      setIsProcessing(false)
    }
  }, [onDataLoaded])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.csv')) {
      processFile(file)
    } else {
      setError('Please upload a CSV file')
    }
  }, [processFile])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  const handleLoadSampleData = useCallback(async () => {
    setIsProcessing(true)
    setError(null)
    setResult(null)
    const sampleBets = generateSampleData()
    await store.setBets(sampleBets)
    setResult({ bets: sampleBets, errors: [], totalRows: sampleBets.length, parsedRows: sampleBets.length, duplicates: 0 })
    onDataLoaded(sampleBets)
    setIsProcessing(false)
  }, [onDataLoaded])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <CloudUpload className="h-6 w-6 text-emerald-500" />
            Upload Your Betting Data
          </CardTitle>
          <CardDescription>
            Upload CSV exports from any major sportsbook or aggregation platform. We support all standard formats.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
              isDragging ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-700 hover:border-zinc-600'
            }`}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              {isProcessing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-12 w-12 text-emerald-500 animate-spin" />
                  <p className="text-zinc-300">Processing your data...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="h-12 w-12 text-zinc-500" />
                  <p className="text-zinc-300 text-lg">Drop your CSV here or click to browse</p>
                  <p className="text-zinc-500 text-sm">Supports exports from FanDuel, DraftKings, Fanatics, Caesars, BetMGM, and more</p>
                </div>
              )}
            </label>
          </div>

          {result && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Upload successful!</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">{result.parsedRows}</div>
                  <div className="text-xs text-zinc-400">Bets Parsed</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{result.duplicates}</div>
                  <div className="text-xs text-zinc-400">Duplicates Skipped</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-400">{result.errors.length}</div>
                  <div className="text-xs text-zinc-400">Errors</div>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                  <p className="text-red-400 text-sm font-medium mb-2">Parse Errors:</p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {result.errors.slice(0, 10).map((err, i) => (
                      <p key={i} className="text-red-300/70 text-xs">Row {err.row}: {err.message}</p>
                    ))}
                    {result.errors.length > 10 && (
                      <p className="text-red-300/70 text-xs">...and {result.errors.length - 10} more</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-400">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5 text-blue-400" />
            Try With Sample Data
          </CardTitle>
          <CardDescription>
            Don&apos;t have a CSV handy? Load 500 simulated bets to explore all BetIQ features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleLoadSampleData} variant="outline" className="w-full" disabled={isProcessing}>
            <FileText className="h-4 w-4 mr-2" />
            Load Sample Data (500 bets)
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"
import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Mail, Loader2, CheckCircle } from 'lucide-react'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
    } else {
      setIsSent(true)
      setIsLoading(false)
    }
  }

  if (isSent) {
    return (
      <div className="text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-emerald-600/20 flex items-center justify-center mx-auto">
          <CheckCircle className="h-6 w-6 text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold text-white">Check your inbox</h2>
        <p className="text-zinc-400 text-sm max-w-sm mx-auto">
          We sent a magic link to <span className="text-white font-medium">{email}</span>. Click the link in your email to sign in.
        </p>
        <button
          onClick={() => { setIsSent(false); setEmail('') }}
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm mx-auto">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-400 mb-1.5">
          Email address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          />
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={isLoading || !email.trim()}>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Mail className="h-4 w-4 mr-2" />
        )}
        Send Magic Link
      </Button>

      <p className="text-xs text-zinc-500 text-center">
        No password needed. We&apos;ll send you a sign-in link.
      </p>
    </form>
  )
}

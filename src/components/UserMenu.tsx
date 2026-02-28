"use client"
import React from 'react'
import { useAuth } from '@/components/AuthProvider'
import { Button } from '@/components/ui/button'
import { LogOut, User } from 'lucide-react'

export default function UserMenu() {
  const { user, signOut } = useAuth()

  if (!user) return null

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <User className="h-4 w-4" />
        <span className="hidden sm:inline max-w-[160px] truncate">{user.email}</span>
      </div>
      <Button variant="ghost" size="sm" onClick={signOut}>
        <LogOut className="h-4 w-4 mr-1" />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </div>
  )
}

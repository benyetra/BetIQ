import LoginForm from '@/components/LoginForm'
import { TrendingUp } from 'lucide-react'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-emerald-600 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">BetIQ</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome back</h1>
          <p className="text-zinc-400">
            Sign in to access your betting analytics across all your devices.
          </p>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <LoginForm />
        </div>

        <p className="text-xs text-zinc-600 text-center">
          By signing in, you agree to use BetIQ responsibly. If you have a gambling problem, call 1-800-522-4700.
        </p>
      </div>
    </div>
  )
}

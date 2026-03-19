// Global server-side request queue for The Odds API
// Ensures minimum 2s between ANY outbound request to the Odds API,
// regardless of which route triggers it.

let lastRequestTime = 0
const MIN_INTERVAL_MS = 2000 // 2s floor (API requires 1s min, we add buffer)
let pendingPromise: Promise<void> | null = null

/**
 * Acquire a slot to make an Odds API request.
 * Resolves only when it's safe to send the next request.
 * Serializes all callers so only one request is in-flight at a time.
 */
export async function acquireSlot(): Promise<void> {
  // Chain onto any pending wait so requests serialize
  while (pendingPromise) {
    await pendingPromise
  }

  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < MIN_INTERVAL_MS) {
    const delay = MIN_INTERVAL_MS - elapsed
    pendingPromise = new Promise(resolve => setTimeout(resolve, delay))
    await pendingPromise
    pendingPromise = null
  }

  lastRequestTime = Date.now()
}

// In-memory cache shared across all routes
const cache = new Map<string, { data: unknown; headers: Record<string, string | null>; timestamp: number }>()

export function getCached(key: string, ttlMs: number): { data: unknown; headers: Record<string, string | null> } | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.timestamp < ttlMs) {
    return { data: entry.data, headers: entry.headers }
  }
  return null
}

export function setCache(key: string, data: unknown, headers: Record<string, string | null>): void {
  cache.set(key, { data, headers, timestamp: Date.now() })
}

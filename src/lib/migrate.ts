import { store, hasLocalData, getLocalData, clearLocalData } from '@/lib/store'

export interface MigrationResult {
  betsCount: number
  chatCount: number
  strategiesCount: number
  insightsCount: number
  success: boolean
  error?: string
}

/**
 * Check whether there is any local data (IndexedDB/localStorage) to migrate.
 */
export { hasLocalData }

/**
 * Migrate all local browser data to the user's Supabase account.
 * Returns a summary of what was migrated.
 */
export async function migrateLocalData(): Promise<MigrationResult> {
  try {
    const local = await getLocalData()

    let betsCount = 0
    let chatCount = 0
    let strategiesCount = 0
    let insightsCount = 0

    // Migrate bets
    if (local.bets.length > 0) {
      const result = await store.addBets(local.bets)
      betsCount = result.new
    }

    // Migrate chat history
    for (const msg of local.chatHistory) {
      await store.addChatMessage(msg)
      chatCount++
    }

    // Migrate strategies
    for (const strat of local.strategies) {
      await store.addStrategy(strat)
      strategiesCount++
    }

    // Migrate insights
    if (local.insights.length > 0) {
      await store.setInsights(local.insights)
      insightsCount = local.insights.length
    }

    // Clear local data after successful migration
    await clearLocalData()

    return {
      betsCount,
      chatCount,
      strategiesCount,
      insightsCount,
      success: true,
    }
  } catch (err) {
    return {
      betsCount: 0,
      chatCount: 0,
      strategiesCount: 0,
      insightsCount: 0,
      success: false,
      error: err instanceof Error ? err.message : 'Migration failed',
    }
  }
}

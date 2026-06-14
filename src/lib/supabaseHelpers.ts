/**
 * Shared Supabase helper utilities used across all stores.
 * Consolidates the duplicated `configuredClient()` pattern.
 */
import { getSupabase, isSupabaseConfigured } from './supabaseClient.js'

export { isSupabaseConfigured }

/**
 * Returns a configured Supabase client or throws.
 * Replaces the identical `configuredClient()` functions duplicated across
 * DrillLog, Patterns, Weeks, Operators, Rigs, and UserAccess stores.
 */
export function configuredClient() {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  return sb
}

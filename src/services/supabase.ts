import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient.js'

export { isSupabaseConfigured }

export const supabase = getSupabase()

export default supabase

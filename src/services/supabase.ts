/**
 * Supabase Client — HOLOCRON SWU
 * Cloud backend for auth, profiles, stats and sync
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing env vars. Cloud features disabled.')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

/** Check if Supabase is configured */
export function isSupabaseReady(): boolean {
  return !!supabaseUrl && !!supabaseAnonKey
}

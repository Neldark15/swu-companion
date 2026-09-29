/**
 * Supabase Client — HOLOCRON SWU
 * Cloud backend for auth, profiles, stats and sync
 */

import { createClient } from '@supabase/supabase-js'
import { esRutaCuenta } from '../features/cuenta/autoridadMemento'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing env vars. Cloud features disabled.')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    // La autoridad confirma token_hash con una acción explícita. El flujo
    // implicit histórico de SWU conserva su comportamiento en todas sus rutas.
    detectSessionInUrl: typeof window === 'undefined' || !esRutaCuenta(window.location.pathname),
  },
})

/** Check if Supabase is configured */
export function isSupabaseReady(): boolean {
  return !!supabaseUrl && !!supabaseAnonKey
}

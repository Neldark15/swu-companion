/**
 * Player Search — Search registered profiles by name
 */

import { supabase, isSupabaseReady } from './supabase'

export interface SearchableProfile {
  id: string
  name: string
  avatar: string
}

/**
 * Search Supabase profiles by name (fuzzy match)
 * Returns max 8 matches. Existing callers receive [] on errors; the visual
 * counter opts into real errors and cancellation to show a retry action.
 */
export async function searchProfiles(query: string, opciones?: {
  signal?: AbortSignal
  throwOnError?: boolean
}): Promise<SearchableProfile[]> {
  if (query.trim().length < 2) return []
  if (!isSupabaseReady()) {
    if (opciones?.throwOnError) throw new Error('La búsqueda de jugadores no está disponible.')
    return []
  }

  try {
    const peticion = supabase
      .from('profiles')
      .select('id, name, avatar')
      .ilike('name', `%${query.trim()}%`)
      .limit(8)
    if (opciones?.signal) peticion.abortSignal(opciones.signal)
    const { data, error } = await peticion

    if (error) {
      if (opciones?.throwOnError) throw error
      return []
    }
    if (!data) return []

    return data.map(p => ({
      id: p.id,
      name: p.name || 'Jugador',
      avatar: p.avatar || '🎯',
    }))
  } catch (error) {
    if (opciones?.throwOnError) throw error
    return []
  }
}

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
 * Returns max 8 results, ordered by relevance
 */
export async function searchProfiles(query: string): Promise<SearchableProfile[]> {
  if (!isSupabaseReady() || query.trim().length < 2) return []

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, avatar')
      .ilike('name', `%${query.trim()}%`)
      .limit(8)

    if (error || !data) return []

    return data.map(p => ({
      id: p.id,
      name: p.name || 'Jugador',
      avatar: p.avatar || '🎯',
    }))
  } catch {
    return []
  }
}

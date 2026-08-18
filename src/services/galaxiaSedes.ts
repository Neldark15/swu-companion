/**
 * Las tiendas de una persona: dónde ha jugado un torneo.
 *
 * Es lo que abre la sala de tienda, y la puerta es haber jugado ahí. Sin esa
 * puerta, «tienda» sería un chat global con otro nombre.
 *
 * Vive aparte de `galaxiaChat.ts` porque toca tablas de torneos, no de chat, y
 * mezclarlas haría que un cambio en el esquema de torneos rompiera el chat.
 */

import { supabase, isSupabaseReady } from './supabase'

export interface TiendaPropia {
  id: string
  nombre: string
}

export async function misSedes(userId: string): Promise<TiendaPropia[]> {
  if (!isSupabaseReady() || !userId) return []

  const { data, error } = await supabase
    .from('tournament_standings')
    .select('official_events!inner(venue_id, venues!inner(id, name))')
    .eq('user_id', userId)
    .not('official_events.venue_id', 'is', null)

  // Gotcha 2f: sin mirar el error, «no tengo tiendas» y «falló la consulta» se
  // ven igual — y la primera hace desaparecer una sala sin decir por qué.
  if (error) {
    console.warn('[galaxia] no se pudieron leer las sedes:', error.message)
    return []
  }

  // Gotcha 1: los joins de Supabase llegan como ARRAY aunque la relación sea
  // 1:1. Sin aplanar, `venues.name` es siempre undefined y sin ningún error.
  const vistas = new Map<string, string>()
  for (const fila of data ?? []) {
    const ev = fila.official_events as unknown
    const eventos = Array.isArray(ev) ? ev : [ev]
    for (const e of eventos) {
      const v = (e as { venues?: unknown })?.venues
      const sedes = Array.isArray(v) ? v : [v]
      for (const sede of sedes) {
        const s = sede as { id?: string; name?: string } | null
        if (s?.id && s.name) vistas.set(s.id, s.name)
      }
    }
  }
  return [...vistas.entries()].map(([id, nombre]) => ({ id, nombre }))
}

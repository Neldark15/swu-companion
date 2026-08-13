/**
 * profileCustomService — personalizar el perfil público con elementos del juego.
 *
 * ── Por qué aspectos y no «colores favoritos» libres ──────────────────
 *
 * En SWU la identidad se dice con ASPECTOS: uno es rojo/amarillo, otro es azul
 * de Vigilancia. Un selector de color arbitrario diría menos y además dejaría
 * perfiles ilegibles sobre el fondo oscuro. Los aspectos son del juego, ya
 * tienen color asignado en la app, y significan algo para quien los lee.
 *
 * ── Y la vitrina son cartas de verdad ─────────────────────────────────
 *
 * Hasta seis, elegidas entre las FAVORITAS que ya marcó la persona: así la
 * personalización reusa algo que la app ya sabe en vez de pedir que se
 * construya una lista nueva desde cero.
 */

import type { FamiliaPlaneta } from '../features/planeta/semilla'
import { supabase, isSupabaseReady } from './supabase'
import { db } from './db'
import type { Card } from '../types'

export type Aspecto =
  | 'Vigilance' | 'Command' | 'Aggression' | 'Cunning' | 'Heroism' | 'Villainy'

export const ASPECTOS: { valor: Aspecto; label: string; punto: string; texto: string }[] = [
  { valor: 'Vigilance',  label: 'Vigilancia', punto: 'bg-blue-400',   texto: 'text-blue-400' },
  { valor: 'Command',    label: 'Mando',      punto: 'bg-green-400',  texto: 'text-green-400' },
  { valor: 'Aggression', label: 'Agresión',   punto: 'bg-red-400',    texto: 'text-red-400' },
  { valor: 'Cunning',    label: 'Astucia',    punto: 'bg-yellow-400', texto: 'text-yellow-400' },
  { valor: 'Heroism',    label: 'Heroísmo',   punto: 'bg-slate-200',  texto: 'text-slate-200' },
  { valor: 'Villainy',   label: 'Villanía',   punto: 'bg-zinc-500',   texto: 'text-zinc-400' },
]

export const MAX_VITRINA = 6
export const MAX_ASPECTOS = 2

export type AcentoPerfil = 'cyan' | 'amber' | 'green' | 'red' | 'purple'

export interface Personalizacion {
  showcase_cards: string[]
  favorite_aspects: Aspecto[]
  banner_card_id: string | null
  accent: AcentoPerfil
  /** Cómo se llama tu planeta en /galaxia. `null` = todavía sin bautizar. */
  planet_name: string | null
  /* Los tres de abajo admiten `null` a propósito: `null` no es «vacío», es
     «usá el que corresponda». La familia se hereda del acento del perfil y el
     resto sale de la semilla del id, así que una cuenta que nunca abrió el
     panel tiene su mundo igual. */
  planet_family: FamiliaPlaneta | null
  planet_seas: number | null
  planet_craters: number | null
}

export const VACIA: Personalizacion = {
  showcase_cards: [], favorite_aspects: [], banner_card_id: null, accent: 'cyan',
  planet_name: null, planet_family: null, planet_seas: null, planet_craters: null,
}

/**
 * Columnas NOMBRADAS, nunca `*`.
 *
 * `profiles` no tiene grant de tabla: son listas explícitas por columna. Un
 * `select('*')` pide todas y PostgREST responde «permission denied for table
 * profiles», tumbando la pantalla entera. Ya pasó una vez.
 */
const COLUMNAS = 'showcase_cards, favorite_aspects, banner_card_id, accent, planet_name, planet_family, planet_seas, planet_craters'

/** Normaliza lo que venga de la base: columnas nuevas pueden llegar nulas. */
function normalizar(row: Partial<Personalizacion> | null): Personalizacion {
  if (!row) return { ...VACIA }
  return {
    showcase_cards: (row.showcase_cards ?? []).slice(0, MAX_VITRINA),
    favorite_aspects: (row.favorite_aspects ?? []).slice(0, MAX_ASPECTOS) as Aspecto[],
    banner_card_id: row.banner_card_id ?? null,
    accent: (row.accent ?? 'cyan') as AcentoPerfil,
    planet_name: row.planet_name ?? null,
    planet_family: row.planet_family ?? null,
    planet_seas: row.planet_seas ?? null,
    planet_craters: row.planet_craters ?? null,
  }
}

export async function getPersonalizacion(userId: string): Promise<Personalizacion> {
  if (!isSupabaseReady() || !userId) return { ...VACIA }
  const { data, error } = await supabase
    .from('profiles').select(COLUMNAS).eq('id', userId).maybeSingle()
  if (error) {
    console.warn('[Perfil] getPersonalizacion:', error.message)
    return { ...VACIA }
  }
  return normalizar(data as Partial<Personalizacion> | null)
}

export async function guardarPersonalizacion(
  userId: string,
  p: Partial<Personalizacion>,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión con el servidor.' }
  const datos: Record<string, unknown> = {}
  if (p.showcase_cards) datos.showcase_cards = p.showcase_cards.slice(0, MAX_VITRINA)
  if (p.favorite_aspects) datos.favorite_aspects = p.favorite_aspects.slice(0, MAX_ASPECTOS)
  if (p.banner_card_id !== undefined) datos.banner_card_id = p.banner_card_id
  if (p.accent) datos.accent = p.accent
  // `!== undefined` y no truthy: `null` es un valor legítimo — es como se
  // borra el nombre del planeta y se vuelve al genérico.
  if (p.planet_name !== undefined) {
    const limpio = p.planet_name?.trim() ?? ''
    datos.planet_name = limpio === '' ? null : limpio
  }
  // `!== undefined` en los tres: `null` es un valor que se guarda —significa
  // «volvé al automático»— y con un chequeo por verdadero nunca podrías
  // deshacer una elección.
  if (p.planet_family !== undefined) datos.planet_family = p.planet_family
  if (p.planet_seas !== undefined) {
    datos.planet_seas = p.planet_seas == null ? null : Math.round(Math.min(100, Math.max(0, p.planet_seas)))
  }
  if (p.planet_craters !== undefined) {
    datos.planet_craters = p.planet_craters == null ? null : Math.round(Math.min(100, Math.max(0, p.planet_craters)))
  }

  const { error } = await supabase.from('profiles').update(datos).eq('id', userId)
  if (error) {
    // Los CHECK de la base son el límite real; acá solo se traduce.
    // Los CHECK y el índice único de la base son el límite real; acá se
    // traducen a algo que se pueda leer.
    if (error.code === '23505') {
      return { ok: false, error: 'Ese nombre de planeta ya lo tiene otro jugador.' }
    }
    if (error.code === '23514') {
      return { ok: false, error: 'Revisá: máximo 6 cartas, 2 aspectos y 24 letras para el planeta.' }
    }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/**
 * Resuelve ids a cartas de nuestra base local, conservando el ORDEN elegido.
 *
 * `bulkGet` respeta el orden pedido, pero puede devolver huecos si una carta
 * ya no está: se filtran para no romper la vitrina con espacios vacíos.
 */
export async function cartasDeVitrina(ids: string[]): Promise<Card[]> {
  if (ids.length === 0) return []
  try {
    const cartas = await db.cards.bulkGet(ids)
    return cartas.filter((c): c is Card => !!c)
  } catch {
    return []
  }
}

/** Las favoritas de quien está usando la app, para elegir la vitrina. */
export async function misFavoritas(profileId?: string): Promise<Card[]> {
  try {
    const favs = await db.favoriteCards.toArray()
    const ids = favs
      .filter(f => !profileId || !('profileId' in f) || f.profileId === profileId)
      .map(f => f.cardId)
    if (ids.length === 0) return []
    const cartas = await db.cards.bulkGet(ids)
    return cartas.filter((c): c is Card => !!c)
  } catch {
    return []
  }
}

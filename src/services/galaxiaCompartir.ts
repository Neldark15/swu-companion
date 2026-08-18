/**
 * Compartir una carta o un mazo en el chat.
 *
 * Los dos adjuntos se resuelven en sitios distintos y por buenas razones:
 *
 * - **La carta vive en Dexie**, en el navegador de cada quien. No hay tabla de
 *   cartas en Supabase, así que compartir una carta es compartir su uuid y que
 *   el aparato de enfrente lo resuelva contra su propio catálogo. Sale gratis y
 *   funciona sin conexión.
 *
 * - **El mazo vive en Supabase**, y ahí está la trampa: su política de lectura
 *   es `auth.uid() = user_id OR data->>'isPublic' = true`. Un mazo PRIVADO
 *   compartido en una sala es invisible para todos menos para su dueño — que
 *   lo ve perfecto y cree que lo compartió. Medido: 24 de 25 mazos son
 *   públicos, así que el caso es raro, y por eso mismo sería el que nadie
 *   entiende cuando pase. Se avisa antes de mandar y se ofrece publicarlo.
 */

import { supabase, isSupabaseReady } from './supabase'
import type { Deck } from '../types'

export interface MazoCompartible {
  id: string
  nombre: string
  /** Si es `false`, quien lo reciba NO va a poder abrirlo. */
  publico: boolean
  lider: string | null
  base: string | null
  cartas: number
}

interface FilaDeck {
  id: string
  name: string
  user_id: string
  data: Partial<Deck> & { isPublic?: boolean }
}

/** Cuenta las cartas del mazo como se cuentan en una lista: sumando copias. */
function totalCartas(d: Partial<Deck>): number {
  const suma = (xs?: Array<{ quantity?: number }>) =>
    (xs ?? []).reduce((n, c) => n + (c.quantity ?? 1), 0)
  return suma(d.mainDeck) + suma(d.sideboard)
}

function resumen(f: FilaDeck): MazoCompartible {
  const d = f.data ?? {}
  return {
    id: f.id,
    nombre: f.name || 'Mazo sin nombre',
    publico: d.isPublic === true,
    // El líder y la base son lo que identifica un mazo de un vistazo; el
    // nombre que la gente le pone suele ser una broma interna.
    lider: d.leaders?.[0]?.cardId ?? null,
    base: d.base?.cardId ?? null,
    cartas: totalCartas(d),
  }
}

/** Mis mazos, para elegir cuál compartir. */
export async function misMazos(userId: string): Promise<MazoCompartible[]> {
  if (!isSupabaseReady() || !userId) return []
  const { data, error } = await supabase
    .from('decks')
    .select('id, name, user_id, data')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('[compartir] no se pudieron leer los mazos:', error.message)
    return []
  }
  return ((data ?? []) as FilaDeck[]).map(resumen)
}

/**
 * Un mazo compartido, visto por quien lo recibe.
 *
 * `null` cubre DOS casos que para quien mira son el mismo —no puedo verlo— y
 * que por eso se tratan igual en pantalla: el mazo se borró, o es privado y la
 * RLS no lo devuelve. Distinguirlos exigiría una consulta con permisos de
 * servidor y no cambiaría lo que se puede hacer al respecto.
 */
export async function verMazoCompartido(id: string): Promise<MazoCompartible | null> {
  if (!isSupabaseReady()) return null
  const { data, error } = await supabase
    .from('decks')
    .select('id, name, user_id, data')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.warn('[compartir] no se pudo leer el mazo compartido:', error.message)
    return null
  }
  return data ? resumen(data as FilaDeck) : null
}

/**
 * Publica un mazo para que se pueda compartir.
 *
 * Se escribe el jsonb completo con `isPublic` cambiado, porque `isPublic` vive
 * DENTRO de `data` y no como columna. Se relee antes para no pisar cambios que
 * el mazo haya tenido desde que se cargó la lista.
 */
export async function publicarMazo(id: string): Promise<boolean> {
  if (!isSupabaseReady()) return false

  const { data, error } = await supabase
    .from('decks').select('data').eq('id', id).maybeSingle()
  if (error || !data) {
    console.warn('[compartir] no se pudo releer el mazo:', error?.message)
    return false
  }

  const nuevo = { ...(data.data as Record<string, unknown>), isPublic: true }
  const { error: e2 } = await supabase.from('decks').update({ data: nuevo }).eq('id', id)
  if (e2) {
    console.warn('[compartir] no se pudo publicar el mazo:', e2.message)
    return false
  }
  return true
}

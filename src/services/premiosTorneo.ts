/**
 * Los premios de un torneo: los que da el sistema y los que pone la tienda.
 *
 * ── Dos clases, y solo una se guarda ─────────────────────────────────
 *
 * · **Virtuales** — sobres y XP. Los decide el sistema y se acreditan solos al
 *   cerrar. La escala se PREGUNTA (`escala_de_premios`), no se copia acá:
 *   copiarla sería tener dos verdades, y el día que cambie el podio
 *   anunciaría una cosa y el cierre repartiría otra.
 * · **Físicos** — sobres de verdad, playmats, efectivo. El sistema no puede
 *   saberlos: los escribe quien organiza.
 *
 * El podio es público: anunciar los premios es como se llena un torneo. Solo
 * escribirlos pide permiso.
 */

import { supabase, isSupabaseReady } from './supabase'

export interface PremioFisico {
  id: string
  event_id: string
  /** `null` = no es de un puesto: rifa, mejor mazo, participación. */
  puesto: number | null
  descripcion: string
  valor: number | null
  orden: number
}

export interface EscalonVirtual {
  puesto: number
  sobres: number
  xp: number
}

export async function getPremiosFisicos(eventId: string): Promise<PremioFisico[] | null> {
  if (!isSupabaseReady()) return null
  const { data, error } = await supabase
    .from('torneo_premios')
    .select('id, event_id, puesto, descripcion, valor, orden')
    .eq('event_id', eventId)
    .order('puesto', { ascending: true, nullsFirst: false })
    .order('orden', { ascending: true })
  // §2f: `null` = no se pudo saber. Devolver [] haría que un fallo se leyera
  // como «este torneo no da premios», que es lo contrario de lo que se quiere
  // anunciar.
  if (error) { console.warn('[premios] no se pudieron leer:', error.message); return null }
  return (data ?? []) as PremioFisico[]
}

/**
 * La escala de sobres DE ESTE torneo.
 *
 * Un torneo puede tener la suya —el Twin Suns de 9 da 3 al campeón, 1 al 2º y
 * 3º, 1 al ganador de cada mesa de abajo y nada a los otros cuatro— y si no
 * la tiene, se usa la de siempre. El podio pregunta la MISMA que el cierre
 * acredita: si el podio anunciara una y el cierre diera otra, la app estaría
 * mintiendo sobre el premio.
 */
export async function getEscalaVirtual(eventId: string, hasta = 4): Promise<EscalonVirtual[]> {
  if (!isSupabaseReady()) return []
  const { data, error } = await supabase.rpc('escala_de_premios_de', {
    p_evento: eventId, p_hasta: hasta,
  })
  if (error) { console.warn('[premios] no se pudo leer la escala:', error.message); return [] }
  return (data ?? []) as EscalonVirtual[]
}

export async function agregarPremio(
  eventId: string,
  premio: { puesto: number | null; descripcion: string; valor: number | null },
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }
  const { error } = await supabase.from('torneo_premios').insert({
    event_id: eventId,
    puesto: premio.puesto,
    descripcion: premio.descripcion.trim(),
    valor: premio.valor,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function borrarPremio(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }
  const { data, error } = await supabase
    .from('torneo_premios').delete().eq('id', id).select('id')
  if (error) return { ok: false, error: error.message }
  // §2u: un DELETE frenado por RLS toca 0 filas SIN error. Sin esto, no tener
  // permiso se vería igual que haberlo borrado.
  if (!data || data.length === 0) return { ok: false, error: 'No se pudo borrar: sin permiso.' }
  return { ok: true }
}

/** Los premios llegan solos: el organizador los carga mientras la sala mira. */
export function escucharPremios(eventId: string, alCambiar: () => void): () => void {
  if (!isSupabaseReady() || !eventId) return () => {}
  const canal = supabase
    .channel(`premios-${eventId}`)
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'torneo_premios', filter: `event_id=eq.${eventId}` },
        () => alCambiar())
    .subscribe(estado => {
      if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') {
        console.warn('[premios] el canal no quedó:', estado)
      }
    })
  return () => { void supabase.removeChannel(canal) }
}

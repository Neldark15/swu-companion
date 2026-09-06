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

/* ── La escala de sobres, editable ─────────────────────────────────────
 *
 * `torneo_escala_sobres` existía y NO se escribía desde ningún lado: cero
 * referencias en `src/`. La escala especial del Twin Suns la puso una persona
 * a mano en el SQL Editor a partir de un mensaje.
 *
 * Eso es exactamente por qué el 4º de la final se quedó con CERO sobres: la
 * escala se escribió cuando la final todavía era de tres, y cuando creció a
 * cuatro nadie volvió a tocarla. Un premio que solo se puede cambiar
 * escribiendo SQL se queda viejo entre el mensaje y el torneo — y en ese
 * torneo los premios cambiaron TRES veces en una tarde (9, 10 y 11
 * inscritos, cada uno con un reparto distinto).
 *
 * El premio de un torneo lo decide quien lo organiza, y esa decisión no puede
 * necesitar a un programador.
 */

/** Un peldaño de la escala tal como lo edita el organizador. */
export interface PeldañoEscala {
  puesto: number
  sobres: number
}

/**
 * Reemplaza la escala del torneo por la que se pasa.
 *
 * Se borra y se vuelve a escribir en vez de hacer upsert peldaño a peldaño:
 * quitar un puesto de la lista tiene que QUITARLO, y con upsert el puesto
 * viejo sobreviviría anunciando un premio que ya nadie decidió dar.
 *
 * Con la lista vacía, el torneo vuelve a la escala de siempre.
 */
export async function fijarEscalaSobres(
  eventId: string,
  peldaños: PeldañoEscala[],
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  const { error: eBorrar } = await supabase
    .from('torneo_escala_sobres').delete().eq('event_id', eventId)
  if (eBorrar) return { ok: false, error: eBorrar.message }

  const limpios = peldaños
    .filter(p => Number.isFinite(p.puesto) && p.puesto >= 1 && p.sobres >= 0)
    .map(p => ({ event_id: eventId, puesto: p.puesto, sobres: p.sobres }))

  if (limpios.length === 0) return { ok: true }

  const { data, error } = await supabase
    .from('torneo_escala_sobres').insert(limpios).select('puesto')
  if (error) return { ok: false, error: error.message }

  /* §2u: una escritura frenada por RLS afecta 0 filas y NO da error. Sin
     contar lo que volvió, la pantalla diría «guardado» con la escala vieja
     intacta — y el podio seguiría anunciando otra cosa que la que se reparte. */
  if (!data || data.length !== limpios.length) {
    return { ok: false, error: 'No tenés permiso para cambiar los premios de este torneo.' }
  }
  return { ok: true }
}

/** Lo que hay guardado como escala PROPIA, sin la de por defecto detrás. */
export async function getEscalaPropia(eventId: string): Promise<PeldañoEscala[] | null> {
  if (!isSupabaseReady()) return null
  const { data, error } = await supabase
    .from('torneo_escala_sobres')
    .select('puesto, sobres')
    .eq('event_id', eventId)
    .order('puesto')
  if (error) { console.warn('[premios] escala propia:', error.message); return null }
  return (data ?? []) as PeldañoEscala[]
}

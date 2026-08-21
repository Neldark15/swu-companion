/**
 * El chat de a dos, montado sobre la misma sala que el resto del chat.
 *
 * ── Lo que ya existía y NO se rehizo ─────────────────────────────────
 *
 * Los mensajes, los adjuntos de carta y de mazo, el borrado suave, la
 * moderación de admin, el tiempo real y las marcas de leído viven en
 * `galaxiaChat.ts` y en `galaxia_mensajes`. Una conversación privada es un
 * ALCANCE más (`dm`), no un sistema aparte.
 *
 * ── Por qué la conversación tiene fila propia ────────────────────────
 *
 * Porque el ámbito no da: el CHECK `ambito_coherente` lo topa en 64 caracteres
 * y un par de uuids con separador son 73. Medido.
 *
 * Y salió mejor: la fila es donde cuelga el bloqueo, y es lo que permite listar
 * «mis conversaciones» sin recorrer todos los mensajes.
 *
 * ── El otro NO se puede deducir del ámbito ───────────────────────────
 *
 * El ámbito es el uuid OPACO de la sala, así que el cliente no puede sacar de
 * ahí con quién está hablando. Por eso `misConversaciones` resuelve el nombre y
 * el avatar y los devuelve ya puestos.
 */

import { supabase, isSupabaseReady } from './supabase'
import type { Sala } from './galaxiaChat'

export interface Conversacion {
  id: string
  /** La otra persona, ya resuelta. */
  otro: { id: string; name: string; avatar: string | null }
  /** Quién cortó, si alguien cortó. */
  bloqueadaPor: string | null
  creadaEn: string
}

export type Resultado<T> = { ok: true; datos: T } | { ok: false; mensaje: string }

/** La sala que entiende `SalaChat`, a partir de una conversación. */
export function salaDe(c: Conversacion): Sala {
  return {
    alcance: 'dm',
    ambito: c.id,
    titulo: c.otro.name,
    detalle: 'Conversación privada',
  }
}

/** La sala del chat de un PEDIDO. Mismo mecanismo, otro alcance. */
export function salaDePedido(pedidoId: string, conQuien: string): Sala {
  return {
    alcance: 'pedido',
    ambito: pedidoId,
    titulo: conQuien,
    detalle: 'Sobre este pedido',
  }
}

/**
 * Mis conversaciones, con la otra persona ya resuelta.
 *
 * La RLS ya limita a las mías (`a = auth.uid() or b = auth.uid()`), así que acá
 * no se filtra nada: filtrar en el cliente lo que la base ya filtró es cómo se
 * escriben dos reglas que un día dejan de coincidir.
 */
export async function misConversaciones(miId: string): Promise<Resultado<Conversacion[]>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }
  if (!miId) return { ok: true, datos: [] }

  const { data, error } = await supabase
    .from('conversaciones')
    .select('id, a, b, bloqueada_por, creada_en')
    .order('creada_en', { ascending: false })
  // `supabase-js` no lanza en errores de PostgREST: hay que mirar `error`.
  if (error) return { ok: false, mensaje: error.message }

  const filas = (data ?? []) as { id: string; a: string; b: string; bloqueada_por: string | null; creada_en: string }[]
  if (filas.length === 0) return { ok: true, datos: [] }

  const otros = [...new Set(filas.map(f => (f.a === miId ? f.b : f.a)))]
  const { data: perfiles } = await supabase
    .from('profiles').select('id, name, avatar').in('id', otros)
  const mapa = new Map((perfiles ?? []).map(p => [p.id as string, p as Conversacion['otro']]))

  return {
    ok: true,
    datos: filas.map(f => {
      const otroId = f.a === miId ? f.b : f.a
      return {
        id: f.id,
        otro: mapa.get(otroId) ?? { id: otroId, name: 'Alguien', avatar: null },
        bloqueadaPor: f.bloqueada_por,
        creadaEn: f.creada_en,
      }
    }),
  }
}

/**
 * Abre (o recupera) la conversación con alguien.
 *
 * Idempotente del lado del servidor por el único del par ordenado: llamarla dos
 * veces, o que la abran los dos a la vez, devuelve LA MISMA.
 */
export async function abrirConversacion(otroId: string): Promise<Resultado<string>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }
  const { data, error } = await supabase.rpc('abrir_conversacion', { p_otro: otroId })
  if (error) return { ok: false, mensaje: error.message }
  return { ok: true, datos: data as string }
}

/**
 * Corta o reabre una conversación.
 *
 * Cortar NO borra el historial: el bloqueado sigue leyendo lo que ya se
 * dijeron. Borrárselo le quitaría a quien bloquea la prueba de lo que pasó.
 */
export async function bloquearConversacion(
  convId: string, bloquear: boolean,
): Promise<Resultado<null>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }
  const { error } = await supabase.rpc('bloquear_conversacion', {
    p_conv: convId, p_bloquear: bloquear,
  })
  if (error) return { ok: false, mensaje: error.message }
  return { ok: true, datos: null }
}

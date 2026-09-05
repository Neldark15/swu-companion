/**
 * mesasService — leer y escribir un torneo de MESAS.
 *
 * Va aparte de `tournamentCloud.ts` (45 KB) porque es otro modelo: ahí todo
 * gira alrededor de `tournament_pairings`, que es 1v1 por construcción, y
 * acá la unidad es el ASIENTO.
 *
 * ── Nada se escribe desde el cliente ──────────────────────────────────
 *
 * `tournament_mesas` no tiene policies de escritura: solo lectura pública.
 * Todo pasa por RPC `security definer` con `puede_operar_torneo()`, que es
 * admin **o** curador del Centro. Hacía falta: `tournament_standings` es
 * admin-only para escribir, así que un curador que no fuera admin no podía
 * ni tocar la clasificación.
 *
 * ── El servidor valida, no recalcula ──────────────────────────────────
 *
 * El reparto en mesas lo calcula `services/mesas.ts` (puro, probado sobre
 * 3..32 jugadores) y `armar_mesas()` comprueba que sea legal: que se siente
 * exactamente la gente activa, que nadie esté dos veces, que toda mesa
 * quede con 3 o 4 y que estén numeradas sin saltos. Validar en vez de
 * recalcular evita tener dos algoritmos de siembra que se separen.
 */

import { supabase, isSupabaseReady } from './supabase'

export type Resultado<T> = { ok: true; datos: T } | { ok: false; mensaje: string }

export interface AsientoMesa {
  id: string
  event_id: string
  round_id: string
  mesa: number
  /** `null` para quien juega sin cuenta. En la sala real es un tercio. */
  user_id: string | null
  player_name: string
  puesto: number | null
  /** Derivado del puesto en la base (3/2/1/0). Nunca se escribe. */
  puntos: number | null
}

export interface MesaArmada {
  mesa: number
  jugadores: AsientoMesa[]
  /** `true` cuando ya tiene todos los puestos anotados. */
  anotada: boolean
}

const SIN_CONEXION = 'Sin conexión al servidor'

/** Lo que se manda a `armar_mesas`. */
export interface AsientoPropuesto {
  user_id: string | null
  player_name: string
  mesa: number
}

interface RespuestaRPC {
  ok: boolean
  error?: string
  ronda?: number
  mesas?: number
  asientos?: number
  jugadores?: number
}

export async function armarMesas(
  eventId: string,
  asientos: AsientoPropuesto[],
): Promise<Resultado<{ ronda: number; mesas: number }>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: SIN_CONEXION }

  const { data, error } = await supabase.rpc('armar_mesas', {
    p_evento: eventId,
    p_asientos: asientos,
  })
  // §2f: supabase-js NO lanza ante un error de PostgREST.
  if (error) return { ok: false, mensaje: error.message }

  const r = data as RespuestaRPC | null
  if (!r?.ok) return { ok: false, mensaje: r?.error ?? 'No se pudieron armar las mesas.' }

  /* El aviso dentro de la app.
   *
   * Armar las mesas no dejaba rastro en `tournament_broadcasts`, así que quien
   * tuviera la app abierta —en Inicio, en su colección— no se enteraba de que
   * ya estaban repartidas. Y en un torneo de mesas el push tampoco avisaba,
   * porque leía la tabla de emparejamientos, que está vacía. O sea: nadie.
   *
   * Es best-effort —que falle el aviso no puede tumbar la rifa— pero el error
   * se MIRA: este mismo canal estuvo con cero filas en su historia por un
   * `catch` vacío.
   */
  const { data: ev } = await supabase
    .from('official_events').select('name, code').eq('id', eventId).maybeSingle()
  const { error: errAviso } = await supabase.from('tournament_broadcasts').insert({
    event_id: eventId,
    event_name: ev?.name ?? null,
    event_code: ev?.code ?? null,
    type: 'pairing_set',
    message: `Ya salieron las mesas de la ronda ${r.ronda ?? ''}`.trim(),
    payload: { ronda: r.ronda ?? 0, mesas: r.mesas ?? 0 },
  })
  if (errAviso) console.warn('[mesas] el aviso in-app no se guardó:', errAviso.message)

  return { ok: true, datos: { ronda: r.ronda ?? 0, mesas: r.mesas ?? 0 } }
}

export async function guardarPuestosMesa(
  roundId: string,
  mesa: number,
  puestos: { player_name: string; puesto: number }[],
): Promise<Resultado<true>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: SIN_CONEXION }

  const { data, error } = await supabase.rpc('guardar_puestos_mesa', {
    p_ronda: roundId,
    p_mesa: mesa,
    p_puestos: puestos,
  })
  if (error) return { ok: false, mensaje: error.message }

  const r = data as RespuestaRPC | null
  if (!r?.ok) return { ok: false, mensaje: r?.error ?? 'No se guardaron los puestos.' }
  return { ok: true, datos: true }
}

/**
 * Escribe la clasificación final (`tournament_standings.puesto`).
 *
 * Hay que llamarla ANTES de cerrar: si `puesto` queda en NULL,
 * `temporada_tabla()` filtra por `puesto is not null` y el torneo entero
 * desaparece de la tabla de la temporada **sin un solo error**.
 */
export async function fijarPuestosFinales(eventId: string): Promise<Resultado<number>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: SIN_CONEXION }

  const { data, error } = await supabase.rpc('fijar_puestos_finales', { p_evento: eventId })
  if (error) return { ok: false, mensaje: error.message }

  const r = data as RespuestaRPC | null
  if (!r?.ok) return { ok: false, mensaje: r?.error ?? 'No se pudo fijar la clasificación.' }
  return { ok: true, datos: r.jugadores ?? 0 }
}

/** Los asientos de una ronda, agrupados por mesa. */
export async function getMesasDeRonda(roundId: string): Promise<MesaArmada[]> {
  if (!isSupabaseReady()) return []

  const { data, error } = await supabase
    .from('tournament_mesas')
    .select('id, event_id, round_id, mesa, user_id, player_name, puesto, puntos')
    .eq('round_id', roundId)
    .order('mesa')
    .order('puesto', { nullsFirst: false })

  if (error || !data) return []

  const porMesa = new Map<number, AsientoMesa[]>()
  for (const a of data as AsientoMesa[]) {
    const lista = porMesa.get(a.mesa) ?? []
    lista.push(a)
    porMesa.set(a.mesa, lista)
  }

  return [...porMesa.entries()]
    .sort((x, y) => x[0] - y[0])
    .map(([mesa, jugadores]) => ({
      mesa,
      jugadores,
      anotada: jugadores.every(j => j.puesto !== null),
    }))
}

/** La última ronda de un torneo de mesas, o `null` si todavía no hay. */
export async function ultimaRonda(
  eventId: string,
): Promise<{ id: string; numero: number } | null> {
  if (!isSupabaseReady()) return null
  const { data, error } = await supabase
    .from('tournament_rounds')
    .select('id, round_number')
    .eq('event_id', eventId)
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  const f = data as { id: string; round_number: number }
  return { id: f.id, numero: f.round_number }
}

/**
 * La mesa de UNA persona en una ronda.
 *
 * Existe porque `getMyPairing()` no puede encontrarla: busca con
 * `.or(player1_id.eq.X, player2_id.eq.X)` sobre `tournament_pairings`, y
 * quien está en el asiento 3 o 4 de una mesa no aparece en ninguna de esas
 * dos columnas. Sin esta función, esa persona vería «Esperando
 * emparejamientos…» toda la ronda.
 */
export async function getMiMesa(
  roundId: string,
  userId: string,
): Promise<MesaArmada | null> {
  if (!isSupabaseReady()) return null

  const { data, error } = await supabase
    .from('tournament_mesas')
    .select('mesa')
    .eq('round_id', roundId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null
  const mesa = (data as { mesa: number }).mesa

  const todas = await getMesasDeRonda(roundId)
  return todas.find(m => m.mesa === mesa) ?? null
}

/**
 * Convierte un torneo ya creado a otro tipo (p. ej. suizo → mesas).
 *
 * Hacía falta porque la pestaña de Mesas solo tiene sentido en un torneo de
 * ese tipo, y los del sábado ya estaban creados como suizos: sin esto había
 * que borrarlos y rehacerlos, perdiendo el código, los inscritos y la sede.
 *
 * El servidor solo lo permite ANTES de sembrar. Convertir un torneo en marcha
 * dejaría huérfanos los pareos 1v1 ya escritos y las pantallas leerían una
 * estructura que ya no corresponde al tipo.
 */
export async function cambiarTipoTorneo(
  eventId: string,
  tipo: 'swiss' | 'elimination' | 'mesas',
): Promise<Resultado<true>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: SIN_CONEXION }
  const { data, error } = await supabase.rpc('cambiar_tipo_torneo', {
    p_evento: eventId,
    p_tipo: tipo,
  })
  if (error) return { ok: false, mensaje: error.message }
  const r = data as RespuestaRPC | null
  if (!r?.ok) return { ok: false, mensaje: r?.error ?? 'No se pudo cambiar el tipo.' }
  return { ok: true, datos: true }
}

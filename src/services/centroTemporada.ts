/**
 * centroTemporada — la capa de datos del Centro de Temporada.
 *
 * ── Qué es una «temporada competitiva» ────────────────────────────────
 *
 * Varias fechas de torneo que se suman a una sola tabla, más una final
 * entre los mejores. NO es lo mismo que la tabla `temporadas`, que es la
 * rotación de sets: son dos cosas con el mismo nombre y por eso las tablas
 * nuevas llevan el sufijo `_competitivas` (§3c empieza justo así).
 *
 * ── Los puntos NO se guardan ──────────────────────────────────────────
 *
 * `temporada_tabla()` los deriva de `tournament_standings.puesto` en cada
 * lectura. Un ledger sería una segunda copia de una verdad que ya existe, y
 * dos copias se separan: corregir un puesto tendría que acordarse de
 * recalcular el ledger, y el día que alguien lo olvide la tabla miente sin
 * un solo error. Derivado no puede quedar viejo.
 *
 * ── La clave de jugador no es `user_id` ───────────────────────────────
 *
 * Medido en producción: de los 8 jugadores del torneo del 15 de agosto,
 * **3 no tienen cuenta — y uno de ellos lo ganó**. Una tabla con clave
 * `user_id` abre sin su campeón. Se agrupa por nombre normalizado igual que
 * `ranking_unificado()`, así el día que se registran su historial se une
 * solo.
 */

import type { TipoTorneo } from './tipoTorneo'
import { supabase, isSupabaseReady } from './supabase'

export type Resultado<T> = { ok: true; datos: T } | { ok: false; mensaje: string }

export type EstadoTemporada = 'borrador' | 'activa' | 'cerrada'

export interface TemporadaCompetitiva {
  id: string
  nombre: string
  empieza: string
  termina: string
  /** Cuántos clasifican a la final. */
  corte_final: number
  /** Cuántas fechas cuentan para el total. `null` = todas, sin descarte. */
  cuentan: number | null
  /** Con 8 jugadores o menos, el peldaño 5.º-8.º paga 6 en vez de 8. */
  ajuste_sala_chica: boolean
  estado: EstadoTemporada
  creada_en: string
}

/** El torneo real que materializa una fecha, si ya existe. */
export interface EventoDeFecha {
  id: string
  name: string
  code: string
  status: 'open' | 'active' | 'finished' | 'cancelled'
  date: string | null
  tournament_type: TipoTorneo
  current_round: number
  max_rounds: number | null
}

export interface FechaTemporada {
  id: string
  temporada_id: string
  numero: number
  fecha: string
  formato: string
  event_id: string | null
  es_final: boolean
  nota: string | null
  evento: EventoDeFecha | null
  /** Cuántos hay inscritos. `null` = no se pudo saber, que NO es cero. */
  inscritos: number | null
}

/** Una fecha dentro del desglose de un jugador. */
export interface DetalleFecha {
  numero: number
  formato: string
  puesto: number
  jugadores: number
  sp: number
  /** `false` si esta fecha quedó descartada por la regla de «mejores N». */
  cuenta: boolean
}

export interface FilaTemporada {
  clave: string
  /** `null` para quien jugó sin cuenta. No es un error: es un tercio de la sala. */
  user_id: string | null
  nombre: string
  avatar: string | null
  fechas_jugadas: number
  sp_total: number
  mejor_puesto: number
  victorias_fecha: number
  detalle: DetalleFecha[]
}

const SIN_CONEXION = 'Sin conexión al servidor'

/**
 * ¿Quien mira es curador del Centro?
 *
 * Devuelve `null` cuando **no se pudo averiguar** —red caída, 5xx—, y eso NO
 * es lo mismo que `false`. La pantalla tiene que distinguirlos: ante `null`
 * se ofrece reintentar, nunca se deja pasar. Dar el beneficio de la duda acá
 * es exactamente lo que este módulo no puede hacer.
 */
export async function soyCurador(): Promise<boolean | null> {
  if (!isSupabaseReady()) return null
  const { data, error } = await supabase.rpc('es_curador')
  if (error) return null
  return data === true
}

export async function listarTemporadas(): Promise<Resultado<TemporadaCompetitiva[]>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: SIN_CONEXION }
  const { data, error } = await supabase
    .from('temporadas_competitivas')
    .select('*')
    .order('empieza', { ascending: false })
  if (error) return { ok: false, mensaje: error.message }
  return { ok: true, datos: (data ?? []) as TemporadaCompetitiva[] }
}

export async function crearTemporada(t: {
  nombre: string
  empieza: string
  termina: string
  corte_final: number
  cuentan: number | null
  ajuste_sala_chica: boolean
}): Promise<Resultado<TemporadaCompetitiva>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: SIN_CONEXION }
  const { data, error } = await supabase
    .from('temporadas_competitivas')
    .insert(t)
    .select()
    .single()
  if (error) return { ok: false, mensaje: error.message }
  return { ok: true, datos: data as TemporadaCompetitiva }
}

export async function actualizarTemporada(
  id: string,
  cambios: Partial<Omit<TemporadaCompetitiva, 'id' | 'creada_en'>>,
): Promise<Resultado<true>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: SIN_CONEXION }
  const { error } = await supabase.from('temporadas_competitivas').update(cambios).eq('id', id)
  if (error) return { ok: false, mensaje: error.message }
  return { ok: true, datos: true }
}

export async function borrarTemporada(id: string): Promise<Resultado<true>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: SIN_CONEXION }
  const { error } = await supabase.from('temporadas_competitivas').delete().eq('id', id)
  if (error) return { ok: false, mensaje: error.message }
  return { ok: true, datos: true }
}

/** Forma cruda de la fila con el evento unido; PostgREST devuelve el join anidado. */
interface FilaFechaCruda {
  id: string
  temporada_id: string
  numero: number
  fecha: string
  formato: string
  event_id: string | null
  es_final: boolean
  nota: string | null
  official_events: EventoDeFecha | EventoDeFecha[] | null
}

/**
 * Un join uno-a-uno de PostgREST puede llegar como ARRAY (§1). El helper
 * canónico del proyecto vive en galaxyService; acá se repite en tres líneas
 * para no arrastrar ese módulo entero a un servicio que no lo necesita.
 */
function uno<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export async function leerFechas(temporadaId: string): Promise<Resultado<FechaTemporada[]>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: SIN_CONEXION }

  const { data, error } = await supabase
    .from('temporada_fechas')
    .select(
      'id, temporada_id, numero, fecha, formato, event_id, es_final, nota, ' +
        'official_events(id, name, code, status, date, tournament_type, current_round, max_rounds)',
    )
    .eq('temporada_id', temporadaId)
    .order('numero')

  if (error) return { ok: false, mensaje: error.message }

  const filas = (data ?? []) as unknown as FilaFechaCruda[]
  const ids = filas.map(f => f.event_id).filter((x): x is string => !!x)
  const conteo = await contarInscritos(ids)

  return {
    ok: true,
    datos: filas.map(f => ({
      id: f.id,
      temporada_id: f.temporada_id,
      numero: f.numero,
      fecha: f.fecha,
      formato: f.formato,
      event_id: f.event_id,
      es_final: f.es_final,
      nota: f.nota,
      evento: uno(f.official_events),
      inscritos: f.event_id ? (conteo.get(f.event_id) ?? null) : null,
    })),
  }
}

/**
 * Inscritos por evento. Un `Map` vacío significa «no se pudo saber», y la UI
 * pinta «—»: un 0 ahí anuncia un torneo vacío que puede tener 12 inscritos.
 */
async function contarInscritos(eventIds: string[]): Promise<Map<string, number>> {
  const m = new Map<string, number>()
  if (eventIds.length === 0 || !isSupabaseReady()) return m

  const { data, error } = await supabase
    .from('event_registrations')
    .select('event_id')
    .in('event_id', eventIds)

  if (error || !data) return m
  for (const fila of data as { event_id: string }[]) {
    m.set(fila.event_id, (m.get(fila.event_id) ?? 0) + 1)
  }
  // Un evento sin filas sí es cero, no «no se sabe»: la consulta respondió.
  for (const id of eventIds) if (!m.has(id)) m.set(id, 0)
  return m
}

export async function guardarFecha(f: {
  id?: string
  temporada_id: string
  numero: number
  fecha: string
  formato: string
  es_final: boolean
  event_id?: string | null
  nota?: string | null
}): Promise<Resultado<true>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: SIN_CONEXION }

  const fila = {
    temporada_id: f.temporada_id,
    numero: f.numero,
    fecha: f.fecha,
    formato: f.formato,
    es_final: f.es_final,
    event_id: f.event_id ?? null,
    nota: f.nota ?? null,
  }

  const { error } = f.id
    ? await supabase.from('temporada_fechas').update(fila).eq('id', f.id)
    : await supabase.from('temporada_fechas').insert(fila)

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        mensaje: error.message.includes('ux_temporada_fechas_evento')
          ? 'Ese torneo ya está enlazado a otra fecha de la temporada.'
          : 'Ya existe una fecha con ese número.',
      }
    }
    return { ok: false, mensaje: error.message }
  }
  return { ok: true, datos: true }
}

export async function borrarFecha(id: string): Promise<Resultado<true>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: SIN_CONEXION }
  const { error } = await supabase.from('temporada_fechas').delete().eq('id', id)
  if (error) return { ok: false, mensaje: error.message }
  return { ok: true, datos: true }
}

/**
 * La tabla de la temporada, calculada en el servidor.
 *
 * Solo cuenta torneos en estado `finished`: un torneo a medias tiene puestos
 * provisionales y publicarlos como temporada sería publicar un resultado que
 * todavía puede cambiar.
 */
export async function tablaTemporada(temporadaId: string): Promise<Resultado<FilaTemporada[]>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: SIN_CONEXION }
  const { data, error } = await supabase.rpc('temporada_tabla', { p_temporada: temporadaId })
  if (error) return { ok: false, mensaje: error.message }
  return { ok: true, datos: (data ?? []) as FilaTemporada[] }
}

/**
 * Torneos que todavía no están enlazados a ninguna fecha, para poder elegirlos.
 * Se excluyen los cancelados: enlazar uno cancelado no aporta nada.
 */
export async function torneosLibres(): Promise<Resultado<EventoDeFecha[]>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: SIN_CONEXION }

  const { data: usados, error: e1 } = await supabase
    .from('temporada_fechas')
    .select('event_id')
    .not('event_id', 'is', null)
  if (e1) return { ok: false, mensaje: e1.message }

  const tomados = new Set((usados ?? []).map(u => (u as { event_id: string }).event_id))

  const { data, error } = await supabase
    .from('official_events')
    .select('id, name, code, status, date, tournament_type, current_round, max_rounds')
    .neq('status', 'cancelled')
    .order('date', { ascending: false })
    .limit(60)
  if (error) return { ok: false, mensaje: error.message }

  return {
    ok: true,
    datos: ((data ?? []) as EventoDeFecha[]).filter(e => !tomados.has(e.id)),
  }
}

/**
 * Fija el orden de siembra de un torneo de eliminación.
 *
 * Hace falta porque `initializeTournament()` siembra con el ORDEN DE
 * INSCRIPCIÓN (`seed: idx + 1`), que para un cuadro no significa nada: el
 * 1.º de la temporada tiene que cruzar con el último clasificado, no con
 * quien se inscribió segundo.
 */
export async function fijarSemillas(
  eventId: string,
  ordenUserIds: string[],
): Promise<Resultado<number>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: SIN_CONEXION }

  let hechas = 0
  for (let i = 0; i < ordenUserIds.length; i++) {
    const { error } = await supabase
      .from('tournament_standings')
      .update({ seed: i + 1 })
      .eq('event_id', eventId)
      .eq('user_id', ordenUserIds[i])
    if (error) return { ok: false, mensaje: `Semilla ${i + 1}: ${error.message}` }
    hechas++
  }
  return { ok: true, datos: hechas }
}

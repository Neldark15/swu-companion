/**
 * EL ranking. Uno solo, y mide jugar.
 *
 * ── Por qué existe este archivo ──────────────────────────────────────
 *
 * Había CATORCE tablas de posiciones repartidas por la app y SEIS sistemas de
 * puntos que no hablaban entre sí. Peor: la tabla que se llamaba «ranking»
 * ordenaba por usar la app. Medido en producción antes de tocar nada:
 *
 *   - El primero tenía 3180 puntos con CERO partidas jugadas (2900 cartas
 *     registradas y 8 logros).
 *   - El que ganó el torneo real 3-0 no aparecía en el top 6.
 *   - La suma de `matches_played` de los 25 perfiles era 2.
 *
 * O sea que el «ranking» ordenaba por coleccionar. Este ordena por jugar.
 *
 * ── De dónde salen los puntos ────────────────────────────────────────
 *
 * De las dos únicas fuentes donde hay partidas de verdad:
 *   - `tournament_standings`: los standings de cada torneo.
 *   - `duelos_amistosos` en estado `confirmada`: las amistosas que las DOS
 *     personas aceptaron publicar.
 *
 * 3 por victoria en torneo, 1 por empate, 1 por victoria en amistosa. La
 * amistosa vale menos a propósito: la anota el propio jugador. Vale algo
 * porque el rival tiene que confirmarla; no vale lo mismo porque un torneo es
 * otra cosa.
 *
 * ── Los que no tienen cuenta también entran ──────────────────────────
 *
 * En el torneo real, 3 de 8 jugadores no estaban enlazados a un perfil — entre
 * ellos EL GANADOR. Un ranking que solo mirara `user_id` se comería al
 * campeón, que es la peor manera posible de perder credibilidad. Se agrupan
 * por nombre normalizado y el día que se registren, su historial se une solo.
 */

import { supabase, isSupabaseReady } from './supabase'

export interface FilaRanking {
  /** `user_id` si tiene cuenta; si no, `nombre:<normalizado>`. */
  clave: string
  nombre: string
  /** Null = jugó pero no tiene cuenta en la app. */
  userId: string | null
  avatar: string | null
  puntos: number
  victorias: number
  derrotas: number
  empates: number
  torneos: number
  amistosas: number
}

export type Resultado<T> = { ok: true; datos: T } | { ok: false; mensaje: string }

/** La leyenda que se enseña al lado de la tabla. Una línea, o no se lee. */
export const REGLA_PUNTOS = '3 por victoria en torneo · 1 por empate · 1 por victoria en amistosa'

/**
 * @param dias  Ventana. `null` = de siempre.
 * @param sede  Id de la tienda. `null` = todas.
 *
 * Con SEDE puesta el ranking es SOLO de torneos: una amistosa se juega en la
 * casa de cualquiera y no tiene sede. Repartirlas entre tiendas sería
 * inventar dónde se jugaron, y ponerlas en todas haría que la suma de los
 * rankings por sede no diera nunca el global. La pantalla lo dice.
 */
export async function getRankingUnificado(
  dias: number | null = null,
  sede: string | null = null,
): Promise<Resultado<FilaRanking[]>> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }

  const desde = dias === null
    ? '2000-01-01T00:00:00Z'
    : new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase.rpc('ranking_unificado', {
    p_desde: desde,
    p_sede: sede,
  })

  // Gotcha 2f: supabase-js no lanza ante un error de PostgREST. Sin mirar
  // `error`, un fallo se ve igual que «todavía nadie jugó».
  if (error) {
    console.warn('[ranking] no se pudo leer:', error.message)
    return { ok: false, mensaje: 'No se pudo cargar el ranking.' }
  }

  const filas = (data ?? []) as Array<{
    clave: string; nombre: string; user_id: string | null; avatar: string | null
    puntos: number; victorias: number; derrotas: number; empates: number
    torneos: number; amistosas: number
  }>

  return {
    ok: true,
    datos: filas.map((f) => ({
      clave: f.clave,
      nombre: f.nombre,
      userId: f.user_id,
      avatar: f.avatar,
      puntos: Number(f.puntos),
      victorias: Number(f.victorias),
      derrotas: Number(f.derrotas),
      empates: Number(f.empates),
      torneos: Number(f.torneos),
      amistosas: Number(f.amistosas),
    })),
  }
}

/** El récord como se escribe en cualquier torneo: 2-1 o 2-1-1 si hubo empates. */
export function recordDe(f: FilaRanking): string {
  return f.empates > 0
    ? `${f.victorias}-${f.derrotas}-${f.empates}`
    : `${f.victorias}-${f.derrotas}`
}

/** Dónde estoy yo. `null` si todavía no jugué nada que cuente. */
export function miPosicion(filas: FilaRanking[], miId: string): { puesto: number; fila: FilaRanking } | null {
  const i = filas.findIndex((f) => f.userId === miId)
  return i === -1 ? null : { puesto: i + 1, fila: filas[i] }
}

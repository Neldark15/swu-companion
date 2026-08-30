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
import type { FilaRanking } from './rankingFuentes'

// Se re-exporta todo lo puro: quien ya importaba de acá no tiene que cambiar.
export {
  NOMBRE_FUENTE, REGLA_PUNTOS, REGLA_DE, recordDe, miPosicion, porFuente,
} from './rankingFuentes'
export type { FilaRanking, Fuente } from './rankingFuentes'

export type Resultado<T> = { ok: true; datos: T } | { ok: false; mensaje: string }


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
    puntos_torneo: number; victorias_torneo: number
    derrotas_torneo: number; empates_torneo: number
    puntos_amistosa: number; victorias_amistosa: number; derrotas_amistosa: number
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
      puntosTorneo: Number(f.puntos_torneo ?? 0),
      victoriasTorneo: Number(f.victorias_torneo ?? 0),
      derrotasTorneo: Number(f.derrotas_torneo ?? 0),
      empatesTorneo: Number(f.empates_torneo ?? 0),
      puntosAmistosa: Number(f.puntos_amistosa ?? 0),
      victoriasAmistosa: Number(f.victorias_amistosa ?? 0),
      derrotasAmistosa: Number(f.derrotas_amistosa ?? 0),
    })),
  }
}




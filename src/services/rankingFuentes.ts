/**
 * El ranking, sin servidor: los tipos, las reglas y la reproyección por fuente.
 *
 * Vive aparte de `rankingUnificado.ts` por una razón concreta: ese archivo
 * importa el cliente de Supabase, y cualquier prueba que lo toque revienta
 * antes de correr una línea (`import.meta.env` no existe fuera de Vite). Lo
 * que se puede probar en seco tiene que poder importarse en seco.
 */

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
  /** El desglose por fuente. Viene del MISMO viaje que el total. */
  puntosTorneo: number
  victoriasTorneo: number
  derrotasTorneo: number
  empatesTorneo: number
  puntosAmistosa: number
  victoriasAmistosa: number
  derrotasAmistosa: number
}

/**
 * Qué se está midiendo.
 *
 * `todo` es lo de siempre —las dos fuentes sumadas—; las otras dos miran una
 * sola. No es un adorno: medido el día que se separó, quien encabezaba tenía
 * 27 puntos con 6 salidos de 10 amistosas, mientras la que ganó el torneo
 * invicta tenía 12 de puro torneo. Mezclado, el ranking premia el volumen;
 * separado, cada tabla responde una pregunta distinta.
 */
export type Fuente = 'todo' | 'torneo' | 'amistosa'

export const NOMBRE_FUENTE: Record<Fuente, string> = {
  todo: 'Todo', torneo: 'Torneos', amistosa: 'Amistosas',
}

/** La leyenda que se enseña al lado de la tabla. Una línea, o no se lee. */
export const REGLA_PUNTOS = '3 por victoria en torneo · 1 por empate · 1 por victoria en amistosa'

/** La misma leyenda, según lo que se esté mirando. */
export const REGLA_DE: Record<Fuente, string> = {
  todo: REGLA_PUNTOS,
  torneo: '3 por victoria en torneo · 1 por empate',
  amistosa: '1 por victoria en amistosa, y solo si el rival la confirmó',
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

/**
 * La misma tabla, mirada por una sola fuente.
 *
 * Se REPROYECTA lo ya traído en vez de pedirle otra consulta al servidor. Dos
 * consultas distintas para la misma pregunta es como se llega a que el total
 * no cuadre con las partes: acá el desglose viene del mismo `union all` que el
 * total, y esta función solo elige qué columna mirar.
 *
 * Quien no jugó NADA de esa fuente sale de la tabla. Dejarlo con 0 puntos
 * diría «jugó torneos y perdió todo», que es una cosa distinta a no haber
 * jugado ninguno.
 *
 * El orden se replica del servidor —puntos, victorias, nombre— para que las
 * tres vistas se lean igual.
 */
export function porFuente(filas: FilaRanking[], fuente: Fuente): FilaRanking[] {
  if (fuente === 'todo') return filas

  const esTorneo = fuente === 'torneo'
  return filas
    .map((f) => ({
      ...f,
      puntos: esTorneo ? f.puntosTorneo : f.puntosAmistosa,
      victorias: esTorneo ? f.victoriasTorneo : f.victoriasAmistosa,
      derrotas: esTorneo ? f.derrotasTorneo : f.derrotasAmistosa,
      // Una amistosa no puede empatar: se anota con marcador y el que tiene
      // más juegos gana. Por eso el empate solo existe del lado de torneo.
      empates: esTorneo ? f.empatesTorneo : 0,
      torneos: esTorneo ? f.torneos : 0,
      amistosas: esTorneo ? 0 : f.amistosas,
    }))
    .filter((f) => f.victorias + f.derrotas + f.empates > 0)
    .sort((a, b) =>
      b.puntos - a.puntos || b.victorias - a.victorias || a.nombre.localeCompare(b.nombre))
}

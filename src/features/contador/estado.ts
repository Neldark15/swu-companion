/**
 * estado — lo que comparten el Contador de dos y el de mesa.
 *
 * Va aparte de `piezas.tsx` porque ahí viven COMPONENTES y acá tipos y
 * funciones: un archivo que exporta las dos cosas rompe el Fast Refresh de
 * Vite (`react-refresh/only-export-components`), que es el mismo motivo por
 * el que `hudTones.ts` y `sintaxisEstadistica.ts` están separados de sus
 * componentes.
 */

/** Un lado de la mesa: su base, su vida y con qué líder juega. */
export interface LadoDuelo {
  /** 'a' es quien sostiene el teléfono; 'b' quien está enfrente. */
  baseNombre: string
  baseImg: string | null
  vidaInicial: number
  vida: number
  /** Partidas ganadas del duelo (mejor de 3). */
  victorias: number
  /** Nombre y arte del líder, si el lado vino de un mazo. */
  liderNombre: string | null
  liderImg: string | null
  /** Desplegado = el líder bajó a la mesa. Es el momento clave de una partida. */
  liderDesplegado: boolean
  /** La FOTO de perfil: la del dueño del teléfono o la del rival elegido. */
  avatar: string | null
  etiqueta: string
}

/** Vibración corta al tocar. Silenciosa donde no exista (iOS Safari). */
export function vibrar(ms = 12) {
  try { navigator.vibrate?.(ms) } catch { /* sin soporte */ }
}

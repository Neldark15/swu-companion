/**
 * Las lentes de la Galaxia: qué magnitud dibuja la órbita y el tamaño.
 *
 * Una lente re-mapea el sistema entero: la ÓRBITA (quién queda más cerca del
 * sol) y el TAMAÑO del planeta salen de la magnitud elegida. El color se queda
 * SIEMPRE en el rango — es la identidad del jugador y cambiarla por lente
 * volvería la escena ilegible («¿por qué Rodo ahora es azul?»).
 *
 * Solo hay lentes sobre magnitudes con varianza real en la base (contado el
 * 2026-08-08: nivel 6 valores, cartas 7, mazos 5, logros 1-9 en las 20
 * cuentas). Torneos, racha y duelos están en CERO para todos: una lente ahí
 * son 20 planetas idénticos, y eso no es una vista, es un adorno.
 *
 * Vive en su propio archivo y no en GalaxiaPage por la regla de fast refresh
 * (un archivo de componentes solo puede exportar componentes) — y de paso
 * el banco de pruebas importa EXACTAMENTE estas funciones: si la pantalla y
 * el banco divergieran, el banco mentiría.
 */

import type { PlanetaJugador } from '../../services/galaxiaService'

export type Lente = 'nivel' | 'coleccion' | 'mazos' | 'logros'

export const LENTES: { id: Lente; rotulo: string; leyenda: string }[] = [
  { id: 'nivel', rotulo: 'Nivel', leyenda: 'nivel' },
  { id: 'coleccion', rotulo: 'Colección', leyenda: 'cartas coleccionadas' },
  { id: 'mazos', rotulo: 'Mazos', leyenda: 'mazos creados' },
  { id: 'logros', rotulo: 'Logros', leyenda: 'logros desbloqueados' },
]

export function metricaDe(p: PlanetaJugador, lente: Lente): number {
  switch (lente) {
    case 'nivel': return p.nivel
    case 'coleccion': return p.cartas
    case 'mazos': return p.mazos
    case 'logros': return p.logros
  }
}

/**
 * Magnitud 0..1 para el radio del planeta.
 *
 * La colección va en log: el máximo real es 2.900 cartas contra colecciones de
 * decenas — en lineal, todos menos uno serían puntos invisibles al lado de una
 * bola. El resto de las lentes tiene rangos cortos (1-26, 0-6, 0-9) y el
 * lineal les alcanza; el nivel conserva su compresión log de siempre para que
 * la vista por defecto se vea idéntica a la de antes de las lentes.
 */
export function magnitudDe(p: PlanetaJugador, lente: Lente, max: number): number {
  if (lente === 'nivel') return p.magnitud
  const v = metricaDe(p, lente)
  if (max <= 0) return 0
  if (lente === 'coleccion') return Math.log1p(v) / Math.log1p(max)
  return v / max
}

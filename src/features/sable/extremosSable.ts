import type { PiezaSuelta, Punto } from './partesSable'

/** Fondo del iris, medido hacia abajo desde el extremo de la empuñadura. */
export const PROFUNDIDAD_IRIS = 1.15
/** El segundo iris queda en la cavidad inferior del pomo Gemelo. */
export const PROFUNDIDAD_IRIS_GEMELO = .20

/** El hueco es parte de la propia malla torneada. El contorno de catálogo
 * sigue describiendo la carcasa exterior y los asientos de los herrajes. */
export function perfilConCavidad(pieza: PiezaSuelta): Punto[] {
  const { puntos, alto } = pieza
  if (pieza.clave === 'emisor') {
    const boca = pieza.perfil.at(-1)![0]
    return [...puntos.slice(0, -1), [boca * .94, alto - .06],
      [boca * .94, alto - 1.18], [boca * .82, alto - 1.30], [0, alto - 1.30]]
  }
  if (pieza.clave === 'pomo') {
    const extremos = puntos.slice(0, -1)
    if (pieza.perfil[1][1] === 0) {
      const radio = pieza.perfil[1][0]
      extremos.splice(0, 1, [0, .24], [radio * .69, .24], [radio * .77, .18],
        [radio * .77, .045], [radio * .80, 0])
    }
    const cuello = pieza.perfil.at(-1)![0]
    return [...extremos, [cuello * .75, alto], [cuello * .69, alto - .10],
      [cuello * .69, alto - .18], [0, alto - .18]]
  }
  return puntos
}

/** El bisel empieza sobre el herraje más alto. Rebajar la camisa bajo la
 * abrazadera dejaba el aro negro de Faro suspendido en el lado bajo. */
export function alturaLibreBoca(pieza: PiezaSuelta): number {
  let libre = 1.18
  for (const h of pieza.herrajes) {
    const medio = h.tipo === 'aleta' || h.tipo === 'caja' ? h.alto / 2
      : h.tipo === 'anillo' || h.tipo === 'cable' ? h.grosor : h.radio
    libre = Math.min(libre, pieza.alto * (1 - h.y) - medio - .09)
  }
  return Math.max(0, libre)
}

/** Recorte asimétrico del borde. La forma cambia entre visor inclinado,
 * horquilla y corona según el emisor del catálogo. El punto alto permanece
 * en la altura nominal del borde de la carcasa. */
export function recorteBoca(id: string, angulo: number): number {
  switch (id) {
    case 'emi_horquilla': return .74 * Math.sin(angulo) ** 4
    case 'emi_dentado': return .53 * Math.sin(angulo * 2) ** 6
    case 'emi_corona': return .63 * Math.sin(angulo * 3) ** 4
    case 'emi_estandar': case 'emi_conico': case 'emi_faro':
      return .49 * (1 - Math.cos(angulo))
    default: return 0
  }
}

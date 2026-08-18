/**
 * SublineaAurebesh — el renglón de Aurebesh que va debajo de cada texto de la
 * credencial.
 *
 * Los GLIFOS viven en `aurebeshGlifos.ts` y no acá: son DATOS, no un
 * componente, y mezclarlos rompía el refresco en caliente del desarrollo
 * (misma regla que obligó a separar `colorDePersona` del componente Avatar).
 * Además el traductor los usa sin necesitar este componente.
 */

import { GLIFOS, GLIFO_ALTO, GLIFO_ANCHO, GROSOR, sinAcentos } from './aurebeshGlifos'

interface SublineaProps {
  /** El texto en latino: acá se translitera letra por letra a Aurebesh. */
  texto: string
  x: number
  y: number
  /** Altura del glifo en unidades del viewBox (el ancho sale de la caja). */
  alto?: number
  color: string
  opacidad?: number
  /** Ancho máximo: los glifos que no quepan se omiten (no se encogen). */
  maxAncho?: number
}

/**
 * La sublínea en Aurebesh que va DEBAJO de cada texto legible de la credencial.
 * Va como grupo de <path> con trazo, no como <text>: no hay fuente que cargar.
 */
export function SublineaAurebesh({ texto, x, y, alto = 6, color, opacidad = 0.35, maxAncho }: SublineaProps) {
  const escala = alto / GLIFO_ALTO
  // Avance fijo: 10 de glifo + 3 de aire. Un carácter sin glifo avanza menos,
  // pero AVANZA — si no, «S. Vera» pegaría la S con la V y quedaría ilegible.
  const avance = (GLIFO_ANCHO + 3) * escala
  const espacioBlanco = GLIFO_ANCHO * 0.7 * escala

  const elementos: React.ReactElement[] = []
  let cursor = 0
  let i = 0
  for (const crudo of sinAcentos(texto).toUpperCase()) {
    const camino = GLIFOS[crudo]
    if (camino === undefined) {
      // Espacio, coma, guion, apóstrofo: no se dibujan (la lámina tiene sus
      // signos, pero la sublínea es un renglón de letras, no una copia fiel).
      cursor += espacioBlanco
      continue
    }
    if (maxAncho !== undefined && cursor + avance > maxAncho) break
    elementos.push(
      <path
        key={i}
        d={camino}
        transform={`translate(${cursor} 0) scale(${escala})`}
        fill="none"
        stroke={color}
        strokeWidth={GROSOR}
        strokeLinecap="square"
        strokeLinejoin="miter"
        // El trazo NO se escala con el glifo: a 5px de alto, un trazo escalado
        // desaparecía; así queda siempre de ~1px, como grabado.
        vectorEffect="non-scaling-stroke"
      />,
    )
    cursor += avance
    i++
  }

  if (elementos.length === 0) return null
  return <g transform={`translate(${x} ${y})`} opacity={opacidad} aria-hidden="true">{elementos}</g>
}

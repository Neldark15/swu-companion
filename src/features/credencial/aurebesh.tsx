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

/**
 * Por debajo de esto el renglón deja de leerse y encoger más no sirve de nada:
 * ahí sí se recorta. En unidades del viewBox de la credencial (512×320), 5
 * equivalen a ~3,4 px en un teléfono de 390 px de ancho.
 */
const ALTO_MINIMO = 5

interface SublineaProps {
  /** El texto en latino: acá se translitera letra por letra a Aurebesh. */
  texto: string
  x: number
  y: number
  /** Altura del glifo en unidades del viewBox (el ancho sale de la caja). */
  alto?: number
  color: string
  opacidad?: number
  /**
   * Ancho máximo. La línea se ENCOGE para caber; solo si tuviera que bajar del
   * piso legible se recorta.
   */
  maxAncho?: number
}

/**
 * La sublínea en Aurebesh que va DEBAJO de cada texto legible de la credencial.
 * Va como grupo de <path> con trazo, no como <text>: no hay fuente que cargar.
 */
export function SublineaAurebesh({ texto, x, y, alto = 6, color, opacidad = 0.45, maxAncho }: SublineaProps) {
  // ── Encoger antes que recortar ──
  //
  // Antes esto cortaba en seco: `if (cursor + avance > maxAncho) break`, sin
  // aviso ninguno. Medido sobre los rangos reales, «Iniciado del Borde
  // Exterior» perdía 7 de sus 24 glifos — y como los glifos que quedan son
  // Aurebesh legítimo, no se leía como un texto cortado sino como OTRA
  // palabra. Quien sabe leer Aurebesh (que es justamente para quien está la
  // sublínea) veía un error, no una abreviatura.
  //
  // Ahora se mide el ancho natural y, si no cabe, se reduce la altura del
  // glifo hasta que entre. Solo cuando haría falta bajar de ALTO_MINIMO —donde
  // el renglón dejaría de leerse— se vuelve a recortar.
  const limpio = sinAcentos(texto).toUpperCase()
  const nLetras = [...limpio].filter((c) => GLIFOS[c] !== undefined).length
  const nHuecos = [...limpio].length - nLetras
  const natural = nLetras * (GLIFO_ANCHO + 3) + nHuecos * GLIFO_ANCHO * 0.7
  const altoUtil =
    maxAncho !== undefined && natural > 0 && (natural * alto) / GLIFO_ALTO > maxAncho
      ? Math.max(ALTO_MINIMO, (maxAncho * GLIFO_ALTO) / natural)
      : alto

  const escala = altoUtil / GLIFO_ALTO
  // El trazo no se escala con el glifo (`vectorEffect`), así que a tamaños
  // grandes el mismo 1,1 px se ve DEBILUCHO: letras el doble de altas con el
  // mismo hilo. Se engorda un poco con la altura para que el renglón conserve
  // su peso, sin llegar a emborronarse en pantallas chicas.
  const grosor = GROSOR * (1 + Math.max(0, altoUtil - 4.5) * 0.055)
  // Avance fijo: 10 de glifo + 3 de aire. Un carácter sin glifo avanza menos,
  // pero AVANZA — si no, «S. Vera» pegaría la S con la V y quedaría ilegible.
  const avance = (GLIFO_ANCHO + 3) * escala
  const espacioBlanco = GLIFO_ANCHO * 0.7 * escala

  const elementos: React.ReactElement[] = []
  let cursor = 0
  let i = 0
  for (const crudo of limpio) {
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
        strokeWidth={grosor}
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

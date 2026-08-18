/**
 * «Aurebesh» PROCEDURAL — la escritura galáctica de la credencial.
 *
 * NO es la fuente Aurebesh de los fans (licencia dudosa): es un alfabeto
 * nuestro, generado. Por cada carácter A-Z/0-9 se dibujan 3-4 trazos rectos
 * o diagonales elegidos con un hash DETERMINISTA del propio carácter, así
 * que el mismo carácter produce siempre el mismo glifo — parece un sistema
 * de escritura de verdad y no ruido, que es lo que lo hace creíble.
 *
 * El texto legible va SIEMPRE en latino arriba; esta sublínea es decoración
 * translúcida. Por eso los glifos no necesitan distinguirse a simple vista
 * entre sí tanto como parecer «letras angulares» en conjunto.
 */

// Caja de diseño de cada glifo: 10 de ancho × 14 de alto.
const GLIFO_ANCHO = 10
const GLIFO_ALTO = 14

/** Memoria: 36 glifos posibles, se calculan una vez y se reusan siempre. */
const memoria = new Map<string, string>()

/**
 * El camino SVG del glifo de un carácter. Determinista: xorshift32 sembrado
 * con el código del carácter — sin Math.random, para que la credencial
 * impresa hoy y la de mañana digan exactamente lo mismo.
 */
function caminoGlifo(caracter: string): string {
  const guardado = memoria.get(caracter)
  if (guardado !== undefined) return guardado

  const codigo = caracter.charCodeAt(0)
  // Multiplicador de Knuth para separar códigos consecutivos (A=65, B=66…
  // sin esto, letras vecinas producían glifos casi idénticos).
  let h = (codigo * 2654435761) >>> 0
  const azar = (): number => {
    h ^= h << 13; h >>>= 0
    h ^= h >> 17
    h ^= h << 5; h >>>= 0
    return h / 4294967296
  }

  // Rejilla de 3×3 anclas: todos los trazos van de ancla a ancla, por eso
  // salen rectos u oblicuos a 35°/55°, nunca curvas — el look angular.
  const xs = [0, GLIFO_ANCHO / 2, GLIFO_ANCHO]
  const ys = [0, GLIFO_ALTO / 2, GLIFO_ALTO]
  const trazos = 3 + (codigo % 2) // 3 o 4 trazos, según el carácter

  let px = xs[Math.floor(azar() * 3)]
  let py = ys[Math.floor(azar() * 3)]
  let d = `M${px} ${py}`
  for (let i = 0; i < trazos; i++) {
    let nx = px
    let ny = py
    // Nunca repetir el ancla actual: un trazo de largo cero es invisible.
    while (nx === px && ny === py) {
      nx = xs[Math.floor(azar() * 3)]
      ny = ys[Math.floor(azar() * 3)]
    }
    d += ` L${nx} ${ny}`
    px = nx
    py = ny
  }

  memoria.set(caracter, d)
  return d
}

interface SublineaProps {
  /** El texto en latino: acá se filtra a A-Z0-9 y se convierte en glifos. */
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
 * La sublínea decorativa en glifos que va DEBAJO de cada texto legible.
 * Va como grupo de <path> con trazo, no como <text>: no hay fuente que
 * cargar y se imprime idéntico en cualquier aparato.
 */
export function SublineaAurebesh({ texto, x, y, alto = 6, color, opacidad = 0.35, maxAncho }: SublineaProps) {
  const escala = alto / GLIFO_ALTO
  const avance = (GLIFO_ANCHO + 4) * escala
  const espacioBlanco = GLIFO_ANCHO * 0.7 * escala

  const elementos: React.ReactElement[] = []
  let cursor = 0
  let i = 0
  for (const crudo of texto.toUpperCase()) {
    if (maxAncho !== undefined && cursor + avance > maxAncho) break
    if (/[A-Z0-9]/.test(crudo)) {
      elementos.push(
        <path
          key={i}
          d={caminoGlifo(crudo)}
          transform={`translate(${cursor} 0) scale(${escala})`}
          fill="none"
          stroke={color}
          strokeWidth={1.1}
          strokeLinecap="square"
          strokeLinejoin="miter"
          // El trazo NO se escala con el glifo: a 5px de alto, un trazo
          // escalado desaparecía; así queda siempre de ~1px, como grabado.
          vectorEffect="non-scaling-stroke"
        />,
      )
      cursor += avance
      i++
    } else if (crudo === ' ') {
      cursor += espacioBlanco
    }
    // Cualquier otro carácter (tildes, comillas, guiones) se salta sin
    // avanzar: los glifos son decoración, no una transliteración fiel.
  }

  if (elementos.length === 0) return null
  return <g transform={`translate(${x} ${y})`} opacity={opacidad} aria-hidden="true">{elementos}</g>
}

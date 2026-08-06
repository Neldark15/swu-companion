/**
 * sintaxisEstadistica — el parseo de los bloques de datos del blog.
 *
 * Va separado de BloquesEstadisticos.tsx a propósito: un archivo que exporta
 * componentes Y funciones rompe el Fast Refresh de Vite
 * (react-refresh/only-export-components) — mismo motivo que hudTones.ts.
 *
 * ── La sintaxis, completa ─────────────────────────────────────────────
 *
 * Un análisis de mazo serio viene con datos: winrate contra cada rival,
 * curva de coste, estructura. Pegarlos como texto los vuelve ilegibles y
 * pegarlos como captura los vuelve inaccesibles y borrosos. Estos bloques
 * se escriben A MANO en el textarea del editor:
 *
 *     [[barras: Winrate contra el meta]]      ← barras horizontales con %
 *     Cad Bane — campeón: 79.7
 *     Lando Calrissian: 37.7
 *     fuente: 600 partidas por rival, SWUSIM
 *
 *     [[curva: Curva de coste]]               ← barras verticales
 *     1:3 2:15 3:20 4:12 5:9 6:2              ← pares coste:cantidad
 *
 *     [[ficha: El mazo en números]]           ← rejilla de etiqueta:valor
 *     Unidades: 57
 *     Con Restore: 5 · Vida de base: 33
 *
 * Cada bloque termina en la primera línea en blanco. El título tras el `:`
 * del marcador y la línea `fuente:` son opcionales. La fuente se pinta en
 * chico debajo del bloque: los bloques muestran LO QUE EL AUTOR ESCRIBE
 * —son visualización, no cálculo— y rotular de dónde salió el número es la
 * diferencia entre un dato y un rumor.
 *
 * ── Por qué el parseo es todo-o-nada ──────────────────────────────────
 *
 * Si UNA línea del bloque no cumple el formato, se devuelve null y el
 * artículo muestra el texto crudo tal cual (lo mismo que hacía antes de que
 * esta sintaxis existiera). Saltarse la línea rota y dibujar el resto sería
 * peor: una gráfica a la que le falta una fila en silencio es una gráfica
 * que miente, y el autor no se enteraría ni en la vista previa. Con el
 * fallback a texto el error se VE y se corrige. Jamás se lanza.
 */

export type TipoBloqueEstadistico = 'barras' | 'curva' | 'ficha'

export interface FilaBarra { etiqueta: string; valor: number; texto: string }
export interface ColumnaCurva { coste: string; cantidad: number }
export interface DatoFicha { etiqueta: string; valor: string }

export type DatosBloque =
  | { tipo: 'barras'; filas: FilaBarra[] }
  | { tipo: 'curva'; columnas: ColumnaCurva[] }
  | { tipo: 'ficha'; datos: DatoFicha[] }

// Topes de cordura: por encima de esto ya no es una gráfica legible y lo más
// probable es que el autor pegó otra cosa. Se cae al texto crudo, no se recorta.
const MAX_BARRAS = 40
const MAX_COLUMNAS = 20
const MAX_DATOS = 24

/**
 * Un porcentaje escrito a mano: `79.7`, `79,7`, `80 %`. Se guarda el texto
 * tal como vino —el bloque muestra lo que el autor escribió, no un redondeo
 * nuestro— y el número solo se usa para el ancho de la barra y el umbral.
 */
function porcentaje(s: string): { valor: number; texto: string } | null {
  const t = s.trim().replace(/\s*%$/, '')
  if (!/^\d{1,3}(?:[.,]\d+)?$/.test(t)) return null
  const valor = Number(t.replace(',', '.'))
  if (!Number.isFinite(valor) || valor > 100) return null
  return { valor, texto: t }
}

/** `Etiqueta: 79.7` — se parte por el ÚLTIMO `:` para que la etiqueta pueda llevar dos puntos. */
function parsearBarras(lineas: string[]): FilaBarra[] | null {
  if (lineas.length === 0 || lineas.length > MAX_BARRAS) return null
  const filas: FilaBarra[] = []
  for (const l of lineas) {
    const corte = l.lastIndexOf(':')
    if (corte <= 0) return null
    const etiqueta = l.slice(0, corte).trim()
    const num = porcentaje(l.slice(corte + 1))
    if (!etiqueta || !num) return null
    filas.push({ etiqueta, ...num })
  }
  return filas
}

/** Pares `coste:cantidad` separados por espacios, en una o varias líneas. `6+:2` también vale. */
function parsearCurva(lineas: string[]): ColumnaCurva[] | null {
  const tokens = lineas.join(' ').split(/\s+/).filter(Boolean)
  if (tokens.length === 0 || tokens.length > MAX_COLUMNAS) return null
  const columnas: ColumnaCurva[] = []
  for (const t of tokens) {
    const m = /^(\d{1,2}\+?):(\d{1,3})$/.exec(t)
    if (!m) return null
    columnas.push({ coste: m[1], cantidad: Number(m[2]) })
  }
  return columnas
}

/**
 * `Etiqueta: valor`, uno por línea o varios en una separados por `·` o `|`.
 * Acá se parte por el PRIMER `:` —al revés que en barras— porque el valor es
 * texto libre y puede llevar dos puntos («Récord: 3:1»).
 */
function parsearFicha(lineas: string[]): DatoFicha[] | null {
  const datos: DatoFicha[] = []
  for (const l of lineas) {
    for (const frag of l.split(/\s*[·|]\s*/).filter(Boolean)) {
      const corte = frag.indexOf(':')
      if (corte <= 0) return null
      const etiqueta = frag.slice(0, corte).trim()
      const valor = frag.slice(corte + 1).trim()
      if (!etiqueta || !valor) return null
      datos.push({ etiqueta, valor })
    }
  }
  if (datos.length === 0 || datos.length > MAX_DATOS) return null
  return datos
}

/** Parsea las líneas de un bloque, o devuelve null si no cumplen el formato. Nunca lanza. */
export function parsearBloqueEstadistico(
  tipo: TipoBloqueEstadistico,
  lineas: string[],
): DatosBloque | null {
  if (tipo === 'barras') {
    const filas = parsearBarras(lineas)
    return filas && { tipo, filas }
  }
  if (tipo === 'curva') {
    const columnas = parsearCurva(lineas)
    return columnas && { tipo, columnas }
  }
  const datos = parsearFicha(lineas)
  return datos && { tipo, datos }
}

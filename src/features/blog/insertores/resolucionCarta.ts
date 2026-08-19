/**
 * resolucionCarta — resolver un `Nombre|SET-NUM` contra la base local EXACTAMENTE
 * como lo hace el renderizador, para poder comprobar lo que se va a escribir.
 *
 * ── Por qué existe ────────────────────────────────────────────────────
 *
 * El nombre NO identifica una carta («Cad Bane» son cinco, «Han Solo» son 40
 * filas). El insertor elige una carta concreta, pero lo que escribe en el
 * artículo es un NOMBRE y un código de impresión — y el resolvedor puede
 * quedarse con otra fila: dos cartas con el mismo nombre, distinto subtítulo y
 * el mismo número dentro del set (cada serie de variantes tiene su propia
 * numeración, CLAUDE.md §2d) resuelven las dos por `ASH-11` y gana la Standard.
 *
 * Por eso el insertor hace un VIAJE DE IDA Y VUELTA: escribe la referencia, la
 * resuelve con esta función y comprueba que salga la carta que se eligió. Si
 * no, avisa y no inserta. Es la única forma de cerrar la corrupción silenciosa
 * que ni el parser ni el fallback a texto plano pueden ver.
 *
 * ── Deuda declarada ───────────────────────────────────────────────────
 *
 * `elegirImpresion` es la TERCERA copia de la misma cadena de preferencia
 * (Articulo.tsx:138-156 y BloqueMazo.tsx:80-100 tienen las otras dos). Lo
 * correcto es que las tres importen esta, igual que los avatares dejaron de
 * tener tres despachos propios (§2x). Mientras eso no pase, un cambio en la
 * preferencia hay que hacerlo en TRES sitios o el insertor empieza a mentir.
 */

import { db } from '../../../services/db'
import type { Card } from '../../../types'

/** Articulo.tsx:134 y BloqueMazo.tsx:83 — el mismo troceo del código. */
const CODIGO = /^([A-Za-z0-9]{2,5})(?:-(\d+))?$/

/** La misma cadena de preferencia del renderizador: set → número → Standard → canónica → la primera. */
export function elegirImpresion(candidatas: Card[], set: string | null): Card | undefined {
  let todas = candidatas
  const m = set ? CODIGO.exec(set.trim()) : null
  const setCode = m ? m[1].toUpperCase() : null
  const setNum = m?.[2] ?? null

  if (setCode) {
    const delSet = todas.filter(c => (c.setCode ?? '').toUpperCase() === setCode)
    if (delSet.length === 0) return undefined
    todas = delSet
  }
  if (setNum) {
    const exacta = todas.filter(c => String(c.setNumber ?? '') === setNum)
    if (exacta.length > 0) todas = exacta
  }
  return todas.find(c => c.variantType === 'Standard')
    ?? todas.find(c => c.isCanonical)
    ?? todas[0]
}

/**
 * Todas las filas de esos nombres, en UNA consulta indexada más UN barrido de
 * rescate. Es `traerPorNombre` de BloqueMazo.tsx:110, y por el mismo motivo
 * medido: un `filter` por nombre dentro de un bucle son N barridos de 9.057
 * filas en el hilo principal.
 */
export async function traerPorNombre(nombres: string[]): Promise<Map<string, Card[]>> {
  const porNombre = new Map<string, Card[]>()
  if (nombres.length === 0) return porNombre

  const meter = (c: Card) => {
    const k = c.name.toLowerCase()
    const lista = porNombre.get(k)
    if (lista) lista.push(c)
    else porNombre.set(k, [c])
  }

  for (const c of await db.cards.where('name').anyOfIgnoreCase(nombres).toArray()) meter(c)

  // `anyOfIgnoreCase` solo permuta mayúsculas ASCII: los nombres con acento se
  // rescatan en UN solo barrido, nunca uno por nombre.
  const faltan = new Set(nombres.map(n => n.toLowerCase()).filter(k => !porNombre.has(k)))
  if (faltan.size > 0) {
    for (const c of await db.cards.filter(c => faltan.has(c.name.toLowerCase())).toArray()) meter(c)
  }
  return porNombre
}

/** Todas las impresiones de ESA carta (mismo nombre y mismo subtítulo). */
export async function impresionesDe(carta: Card): Promise<Card[]> {
  const porNombre = await traerPorNombre([carta.name])
  const hermanas = porNombre.get(carta.name.toLowerCase()) ?? [carta]
  const sub = carta.subtitle ?? null
  const mismas = hermanas.filter(c => (c.subtitle ?? null) === sub)
  return (mismas.length > 0 ? mismas : hermanas).sort((a, b) => {
    // La Standard primero: es la que la gente reconoce y la que gana al resolver.
    const pa = a.variantType === 'Standard' ? 0 : a.isCanonical ? 1 : 2
    const pb = b.variantType === 'Standard' ? 0 : b.isCanonical ? 1 : 2
    if (pa !== pb) return pa - pb
    if (a.setCode !== b.setCode) return a.setCode.localeCompare(b.setCode)
    return a.setNumber - b.setNumber
  })
}

export interface Referencia {
  nombre: string
  set: string | null
  /** La carta que el autor eligió. */
  esperada: Card
}

export interface Desvio {
  referencia: Referencia
  /** La carta que de verdad va a dibujar el artículo, o null si no resuelve ninguna. */
  obtenida: Card | null
}

/**
 * Comprueba que cada referencia resuelva a la carta elegida. Devuelve solo las
 * que NO cuadran. Una consulta para todas.
 */
export async function verificarReferencias(refs: Referencia[]): Promise<Desvio[]> {
  if (refs.length === 0) return []
  const porNombre = await traerPorNombre([...new Set(refs.map(r => r.nombre))])
  const desvios: Desvio[] = []
  for (const r of refs) {
    const candidatas = porNombre.get(r.nombre.toLowerCase()) ?? []
    const obtenida = elegirImpresion(candidatas, r.set)
    if (!obtenida || obtenida.id !== r.esperada.id) {
      desvios.push({ referencia: r, obtenida: obtenida ?? null })
    }
  }
  return desvios
}

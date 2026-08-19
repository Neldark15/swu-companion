/**
 * mazoDesdeLista — el puente que faltaba entre el importador de mazos y el
 * bloque `[[mazo:]]` del blog.
 *
 * `importDeckFromText` (services/deckImportExport.ts:509) ya come SWUDB JSON,
 * SWUDB CSV, texto de Melee y «3x Nombre», y ya resuelve cada línea contra la
 * base local sin inventar coincidencias. Lo único que le falta al blog es
 * pasar de su `Partial<Deck>` —que lleva `cardId` pero NO `setNumber`— al
 * modelo del formulario, con la impresión de cada carta.
 *
 * Con esto, pegar la lista de un torneo genera el bloque entero: el artículo
 * de Berlín tiene DOS bloques de mazo de 40 y 34 líneas escritas a mano.
 */

import { importDeckFromText } from '../../../services/deckImportExport'
import { db } from '../../../services/db'
import { elegirImpresion, traerPorNombre } from './resolucionCarta'
import {
  FORMATOS_MAZO, diagnosticarCuerpo, fundirRepetidas,
  type FormMazo, type FormatoMazo, type Problema, type RefMazoForm,
} from './sintaxisSalida'
import type { Card, DeckCard } from '../../../types'

export interface MazoPegado {
  /** Lo que se puede volcar al formulario. Null si no se reconoció nada. */
  campos: Pick<FormMazo, 'lider' | 'base' | 'main' | 'banquillo'> | null
  avisos: string[]
  errores: string[]
}

export async function mazoDesdeLista(texto: string): Promise<MazoPegado> {
  const crudo = texto.trim()
  if (!crudo) return { campos: null, avisos: [], errores: ['Pegá una lista primero.'] }

  const r = await importDeckFromText(crudo)
  const avisos = [...r.warnings]
  const errores = [...r.errors]

  if (!r.deck) {
    if (errores.length === 0) errores.push('No se reconoció ninguna carta en esa lista.')
    return { campos: null, avisos, errores }
  }

  const d = r.deck
  const ids = new Set<string>()
  const anotar = (c: DeckCard) => ids.add(c.cardId)
  d.leaders?.forEach(anotar)
  if (d.base) anotar(d.base)
  d.mainDeck?.forEach(anotar)
  d.sideboard?.forEach(anotar)

  // UNA consulta indexada para todas las cartas, igual que `exportDeckAsSwudbJson`.
  const filas = await db.cards.where('id').anyOf([...ids]).toArray()
  const porId = new Map<string, Card>(filas.map(c => [c.id, c]))

  const sinFila: string[] = []
  const aRef = (dc: DeckCard): RefMazoForm | null => {
    const carta = porId.get(dc.cardId)
    if (!carta) { sinFila.push(dc.name); return null }
    return { carta, cantidad: Math.max(1, dc.quantity) }
  }

  const lideres = (d.leaders ?? []).map(aRef).filter((x): x is RefMazoForm => x !== null)
  if (lideres.length > 1) {
    avisos.push(
      `El bloque de mazo tiene UNA ranura de líder: se tomó «${lideres[0].carta.name}» y ` +
      `quedaron fuera ${lideres.slice(1).map(l => `«${l.carta.name}»`).join(', ')}.`,
    )
  }

  const baseRef = d.base ? aRef(d.base) : null
  const main = fundirRepetidas((d.mainDeck ?? []).map(aRef).filter((x): x is RefMazoForm => x !== null))
  const banquillo = fundirRepetidas((d.sideboard ?? []).map(aRef).filter((x): x is RefMazoForm => x !== null))

  if (sinFila.length > 0) {
    avisos.push(`Sin ficha en la base local (no entran al bloque): ${[...new Set(sinFila)].join(', ')}.`)
  }
  if (!lideres[0]) avisos.push('La lista no traía líder: elegilo a mano.')
  if (!baseRef) avisos.push('La lista no traía base: elegila a mano.')

  return {
    campos: {
      lider: lideres[0]?.carta ?? null,
      base: baseRef?.carta ?? null,
      main,
      banquillo,
    },
    avisos,
    errores,
  }
}

// ── Volver a cargar un bloque YA escrito ─────────────────────────────

export interface MazoHidratado {
  campos: Pick<FormMazo, 'lider' | 'base' | 'main' | 'banquillo'>
  formato: FormatoMazo
  /** Por qué el bloque no parsea, línea por línea. Vacío = está sano. */
  problemas: Problema[]
  /** Nombres que la base local no supo resolver. */
  sinResolver: string[]
}

interface Cruda {
  destino: 'lider' | 'base' | 'main' | 'banquillo'
  nombre: string
  set: string | null
  cantidad: number
}

/**
 * Rellena el formulario desde un bloque `[[mazo:]]` ya escrito, aunque esté
 * roto: se parsea línea por línea (no todo-o-nada) para poder mostrar CUÁL
 * línea falla y no perder las 39 que sí están bien.
 */
export async function hidratarMazoEscrito(lineas: string[]): Promise<MazoHidratado> {
  const problemas = diagnosticarCuerpo('mazo', lineas)
  let formato: FormatoMazo = 'premier'
  let destino: 'main' | 'banquillo' = 'main'
  const crudas: Cruda[] = []

  const partirRef = (texto: string): { nombre: string; set: string | null } | null => {
    const s = texto.trim()
    if (!s) return null
    const corte = s.lastIndexOf('|')
    if (corte < 0) return s.includes('|') ? null : { nombre: s, set: null }
    const nombre = s.slice(0, corte).trim()
    const set = s.slice(corte + 1).trim()
    if (!nombre || nombre.includes('|')) return null
    return /^[A-Za-z0-9]{2,5}(?:-\d+)?$/.test(set)
      ? { nombre, set: set.toUpperCase() }
      : { nombre: s, set: null }
  }

  for (const linea of lineas) {
    const l = linea.trim()
    if (!l) continue
    if (/^(banquillo|sideboard|reserva)\s*:?$/i.test(l)) { destino = 'banquillo'; continue }

    const etiqueta = /^(formato|l[ií]der|leader|base)\s*:\s*(.+)$/i.exec(l)
    if (etiqueta) {
      const clave = etiqueta[1].toLowerCase()
      if (clave === 'formato') {
        const v = etiqueta[2].trim().toLowerCase().replace(/[\s-]+/g, '_')
        const f = FORMATOS_MAZO.find(x => x === v)
        if (f) formato = f
        continue
      }
      const ref = partirRef(etiqueta[2])
      if (ref) crudas.push({ destino: clave === 'base' ? 'base' : 'lider', ...ref, cantidad: 1 })
      continue
    }

    const fila = /^(\d{1,2})\s*x\s+(.+)$/i.exec(l)
    if (!fila) continue
    const ref = partirRef(fila[2])
    if (ref) crudas.push({ destino, ...ref, cantidad: Number(fila[1]) || 1 })
  }

  // UNA consulta para todos los nombres, nunca una por carta.
  const porNombre = await traerPorNombre([...new Set(crudas.map(c => c.nombre))])
  const sinResolver: string[] = []
  const campos: Pick<FormMazo, 'lider' | 'base' | 'main' | 'banquillo'> = {
    lider: null, base: null, main: [], banquillo: [],
  }

  for (const c of crudas) {
    const carta = elegirImpresion(porNombre.get(c.nombre.toLowerCase()) ?? [], c.set)
    if (!carta) { sinResolver.push(c.set ? `${c.nombre} (${c.set})` : c.nombre); continue }
    if (c.destino === 'lider') campos.lider ??= carta
    else if (c.destino === 'base') campos.base ??= carta
    else campos[c.destino].push({ carta, cantidad: c.cantidad })
  }
  campos.main = fundirRepetidas(campos.main)
  campos.banquillo = fundirRepetidas(campos.banquillo)

  return { campos, formato, problemas, sinResolver }
}

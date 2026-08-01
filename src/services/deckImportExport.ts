/**
 * Deck Import/Export Service
 *
 * Supports:
 * - SWUDB JSON format: { metadata, leader, base, deck, sideboard }
 *   Card IDs: "SET_NUMBER" e.g. "SOR_017"
 *
 * - SWUDB CSV format: Set,CardNumber,Count,IsFoil,Stamp
 *   Example: SOR,017,1,False,
 *
 * - Melee text format:
 *   Leader\n1 | Name | Subtitle\nBase\n1 | Name\nMainDeck\n3 | Name\nSideboard\n...
 *
 * - Plain text: "3x Card Name" or "3 Card Name"
 */

import { db } from './db'
import { searchCards, loadFullDatabase } from './swuApi'
import type { Deck, DeckCard, Card } from '../types'

// ─── Types ───────────────────────────────────────────────

interface SwudbDeckJson {
  metadata?: { name?: string; author?: string }
  leader?: { id: string; count: number }
  base?: { id: string; count: number }
  deck?: { id: string; count: number }[]
  sideboard?: { id: string; count: number }[]
}

export interface DeckImportResult {
  success: boolean
  deck?: Partial<Deck>
  errors: string[]
  warnings: string[]
  matchedCards: number
  totalCards: number
}

// ─── Helpers ─────────────────────────────────────────────

/** Parse SWUDB card id "SOR_017" → { setCode: "SOR", setNumber: 17 } */
function parseSwudbId(id: string): { setCode: string; setNumber: number } | null {
  const match = id.match(/^([A-Za-z]{2,5})_(\d{1,4})$/)
  if (!match) return null
  return { setCode: match[1].toUpperCase(), setNumber: parseInt(match[2], 10) }
}

/** Look up a card by setCode + setNumber from local DB */
async function findCardBySetNumber(setCode: string, setNumber: number): Promise<Card | null> {
  const cards = await db.cards
    .where('setCode').equals(setCode)
    .filter(c => c.setNumber === setNumber)
    .first()
  return cards || null
}

function toDeckCard(card: Card, quantity: number): DeckCard {
  return {
    cardId: card.id,
    name: card.name,
    subtitle: card.subtitle,
    quantity,
    setCode: card.setCode,
  }
}

// ─── SWUDB JSON Import ───────────────────────────────────

async function importSwudbJson(text: string): Promise<DeckImportResult> {
  const result: DeckImportResult = {
    success: false, errors: [], warnings: [], matchedCards: 0, totalCards: 0,
  }

  let data: SwudbDeckJson
  try {
    data = JSON.parse(text)
  } catch {
    result.errors.push('JSON inválido')
    return result
  }

  // Preload full database for local lookups
  await loadFullDatabase().catch(() => {})

  // Ensure we have some deck structure
  if (!data.leader && !data.deck) {
    result.errors.push('El JSON no tiene estructura de deck válida (necesita leader y/o deck)')
    return result
  }

  const deck: Partial<Deck> = {
    name: data.metadata?.name || 'Deck Importado',
    leaders: [],
    base: null,
    mainDeck: [],
    sideboard: [],
  }

  // Resolve leader
  if (data.leader?.id) {
    result.totalCards++
    const parsed = parseSwudbId(data.leader.id)
    if (parsed) {
      const card = await findCardBySetNumber(parsed.setCode, parsed.setNumber)
      if (card) {
        deck.leaders = [toDeckCard(card, 1)]
        result.matchedCards++
      } else {
        result.warnings.push(`Líder no encontrado: ${data.leader.id}`)
      }
    }
  }

  // Resolve base
  if (data.base?.id) {
    result.totalCards++
    const parsed = parseSwudbId(data.base.id)
    if (parsed) {
      const card = await findCardBySetNumber(parsed.setCode, parsed.setNumber)
      if (card) {
        deck.base = toDeckCard(card, 1)
        result.matchedCards++
      } else {
        result.warnings.push(`Base no encontrada: ${data.base.id}`)
      }
    }
  }

  // Resolve main deck
  if (data.deck) {
    for (const entry of data.deck) {
      result.totalCards++
      const parsed = parseSwudbId(entry.id)
      if (!parsed) { result.warnings.push(`ID inválido: ${entry.id}`); continue }
      const card = await findCardBySetNumber(parsed.setCode, parsed.setNumber)
      if (card) {
        deck.mainDeck!.push(toDeckCard(card, entry.count || 1))
        result.matchedCards++
      } else {
        result.warnings.push(`No encontrada: ${entry.id}`)
      }
    }
  }

  // Resolve sideboard
  if (data.sideboard) {
    for (const entry of data.sideboard) {
      result.totalCards++
      const parsed = parseSwudbId(entry.id)
      if (!parsed) continue
      const card = await findCardBySetNumber(parsed.setCode, parsed.setNumber)
      if (card) {
        deck.sideboard!.push(toDeckCard(card, entry.count || 1))
        result.matchedCards++
      } else {
        result.warnings.push(`No encontrada (side): ${entry.id}`)
      }
    }
  }

  result.success = result.matchedCards > 0
  result.deck = deck
  return result
}

// ─── Melee Text Import ───────────────────────────────────

/** Sin acentos y en minúsculas, para comparar "Caídos" con "caidos". */
function norm(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .toLowerCase().trim()
}

interface NameLookup {
  /** "nombre|subtítulo" → carta */
  byExact: Map<string, Card>
  /** nombre → TODAS las cartas con ese nombre. */
  byName: Map<string, Card[]>
}

/**
 * Índices para resolver nombres contra la base local.
 *
 * `byName` guarda TODAS las cartas de cada nombre, no la primera.
 * 549 de las 2,089 cartas jugables (26%) comparten nombre con otra —
 * Luke Skywalker tiene 8 versiones, Pre Vizsla 3— así que quedarse con la
 * primera en el orden de Dexie metía silenciosamente una carta al azar
 * entre las que comparten nombre.
 */
async function buildNameLookup(): Promise<NameLookup> {
  const allCards = await db.cards.toArray()
  const byExact = new Map<string, Card>()
  const byName = new Map<string, Card[]>()

  for (const c of allCards) {
    // Solo la impresión normal: las variantes duplican cada nombre y no
    // aportan nada a un mazo.
    if (c.isCanonical === false) continue

    const n = norm(c.name)
    if (c.subtitle) byExact.set(`${n}|${norm(c.subtitle)}`, c)
    else byExact.set(n, c)

    const list = byName.get(n)
    if (list) list.push(c)
    else byName.set(n, [c])
  }

  return { byExact, byName }
}

type MatchResult =
  | { card: Card }
  /** El nombre existe pero hay varias cartas y el subtítulo no desempató. */
  | { ambiguous: Card[] }
  | { none: true }

/**
 * Resuelve una línea de lista contra la base local.
 *
 * Reglas, en orden:
 *  1. nombre + subtítulo exactos → esa carta.
 *  2. el nombre existe y es ÚNICO → esa carta, aunque el subtítulo no haya
 *     casado. Esto es lo que rescata las listas en español con nombres
 *     propios: "BT-1 | droide blastomecánico" encuentra a BT-1 porque BT-1
 *     es único, aunque su subtítulo en la base sea "Blastomech".
 *  3. el nombre existe pero hay VARIAS → ambiguo. NO se elige ninguna.
 *     Antes se tomaba la primera en el orden de Dexie, así que un
 *     "Luke Skywalker" sin subtítulo válido podía traer cualquiera de las 8.
 *
 * Nunca se hace un match aproximado por parecido: meter una carta que no es
 * en el mazo de alguien es peor que no importarla.
 */
async function findCardFast(
  name: string,
  subtitle: string | undefined,
  lookup: NameLookup,
): Promise<MatchResult> {
  const n = norm(name)
  const sub = subtitle ? norm(subtitle) : ''

  if (sub) {
    const exact = lookup.byExact.get(`${n}|${sub}`)
    if (exact) return { card: exact }
  }

  const sameName = lookup.byName.get(n)
  if (sameName && sameName.length === 1) return { card: sameName[0] }
  if (sameName && sameName.length > 1) {
    // Compartir nombre no siempre significa ser cartas distintas. De los 196
    // nombres repetidos, 45 son REIMPRESIONES: la misma carta en dos sets, con
    // el mismo subtítulo (Vanquish está en SOR y en TWI). Ahí da igual cuál se
    // elija y tratarlo como ambiguo rompería la importación de eventos comunes.
    const subs = new Set(sameName.map(c => norm(c.subtitle ?? '')))
    if (subs.size === 1) return { card: sameName[0] }

    // Subtítulos distintos = cartas distintas de verdad (Luke Skywalker tiene
    // 8). Sin un subtítulo que desempate no se elige ninguna.
    return { ambiguous: sameName }
  }

  // Red de seguridad por si la base local está incompleta.
  try {
    const { cards } = await searchCards({ query: subtitle ? `${name} ${subtitle}` : name, limit: 10 })
    const exact = cards.find(c =>
      norm(c.name) === n && (!sub || (c.subtitle ? norm(c.subtitle) === sub : false)))
    if (exact) return { card: exact }
    const sameNameRemote = cards.filter(c => norm(c.name) === n)
    if (sameNameRemote.length === 1) return { card: sameNameRemote[0] }
    if (sameNameRemote.length > 1) return { ambiguous: sameNameRemote }
  } catch {
    // sin red: se reporta como no encontrada
  }

  return { none: true }
}

async function importMeleeText(text: string): Promise<DeckImportResult> {
  const result: DeckImportResult = {
    success: false, errors: [], warnings: [], matchedCards: 0, totalCards: 0,
  }

  // Preload full card database for fast local lookups
  await loadFullDatabase().catch(() => {})
  const lookup = await buildNameLookup()

  const lines = text.trim().split(/\r?\n/)
  let section: 'none' | 'leader' | 'base' | 'maindeck' | 'sideboard' = 'none'
  /** Para poder explicar DESPUÉS por qué falló, en vez de 26 líneas opacas. */
  const unmatchedNames: string[] = []

  const deck: Partial<Deck> = {
    name: 'Deck Importado',
    leaders: [],
    base: null,
    mainDeck: [],
    sideboard: [],
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    // Detect section headers
    const lower = line.toLowerCase()
    if (lower === 'leader' || lower === 'leaders') { section = 'leader'; continue }
    if (lower === 'base') { section = 'base'; continue }
    if (lower === 'maindeck' || lower === 'main deck' || lower === 'deck') { section = 'maindeck'; continue }
    if (lower === 'sideboard' || lower === 'side board' || lower === 'side') { section = 'sideboard'; continue }

    // ── Parseo de la línea ────────────────────────────────────────────
    //
    // Se separa en dos pasos —primero la cantidad, después las barras— en vez
    // de intentarlo con una sola expresión.
    //
    // El bug que esto arregla: la rama genérica se quedaba con TODA la línea
    // como nombre, barra incluida. Melee exporta "3 BT-1 | Blastomech" (la
    // barra va después del nombre, no después del número), así que el
    // buscador terminaba preguntando por la carta llamada literalmente
    // "BT-1 | Blastomech" y no encontraba NADA. Fallaba igual en inglés.
    let quantity = 1
    let rest = line

    const qtyMatch = line.match(/^(\d+)\s*[x×]?\s*[|.]?\s+(.+)$/i)
    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1], 10) || 1
      rest = qtyMatch[2].trim()
    }

    // Lo que quede se parte por barras: "Nombre | Subtítulo".
    const parts = rest.split('|').map(p => p.trim()).filter(Boolean)
    const cardName = parts[0] ?? ''
    const subtitle = parts.slice(1).join(' | ')

    if (!cardName) continue

    result.totalCards++
    const match = await findCardFast(cardName, subtitle || undefined, lookup)

    if ('none' in match) {
      result.warnings.push(`No encontrada: ${cardName}${subtitle ? ` | ${subtitle}` : ''}`)
      unmatchedNames.push(cardName)
      continue
    }
    if ('ambiguous' in match) {
      // NO se elige una al azar: hay hasta 8 cartas con el mismo nombre.
      const opciones = match.ambiguous
        .map(c => c.subtitle ?? c.setCode)
        .slice(0, 4).join(', ')
      result.warnings.push(
        `Ambigua: "${cardName}" existe en ${match.ambiguous.length} versiones (${opciones}). Falta el subtítulo correcto.`,
      )
      unmatchedNames.push(cardName)
      continue
    }
    const card = match.card

    result.matchedCards++
    const dc = toDeckCard(card, quantity)

    switch (section) {
      case 'leader':
        deck.leaders!.push(toDeckCard(card, 1))
        break
      case 'base':
        deck.base = toDeckCard(card, 1)
        break
      case 'sideboard':
        deck.sideboard!.push(dc)
        break
      default:
        // maindeck or no section specified
        if (card.type === 'Leader') deck.leaders!.push(toDeckCard(card, 1))
        else if (card.type === 'Base') deck.base = toDeckCard(card, 1)
        else deck.mainDeck!.push(dc)
        break
    }
  }

  // ── Explicar el fallo, no solo listarlo ──────────────────────────────
  //
  // Ver 26 líneas de "No encontrada" no dice NADA sobre qué hacer. Si la
  // lista está en otro idioma, eso es una sola causa con una sola solución,
  // y hay que decirla una vez arriba en vez de repetir el síntoma.
  if (result.totalCards > 0 && result.matchedCards < result.totalCards) {
    if (looksTranslated(unmatchedNames)) {
      result.errors.push(
        'La lista parece estar en español y la base de cartas está en inglés. ' +
        'Exportala de nuevo con el idioma en inglés (en swudb.com o Melee, ' +
        'cambiá el idioma antes de copiar) y volvé a intentar.',
      )
    }
  }

  result.success = result.matchedCards > 0
  result.deck = deck
  return result
}

/**
 * ¿Los nombres que no casaron parecen estar en otro idioma?
 *
 * El API de cartas solo publica nombres en inglés — probado con `lang`,
 * `language` y `locale`, los tres se ignoran. Así que una lista en español no
 * se puede resolver, y adivinar la traducción sería peor: meteríamos una
 * carta parecida pero DISTINTA en el mazo de alguien.
 *
 * Se pide más de un indicio y una proporción alta antes de afirmarlo: un solo
 * nombre raro no alcanza para culpar al idioma.
 */
function looksTranslated(names: string[]): boolean {
  if (names.length < 3) return false
  const SPANISH = /[áéíóúñ¿¡]|\b(de|del|la|los|las|el|en|con|por|para|un|una)\b/i
  const hits = names.filter(n => SPANISH.test(n)).length
  return hits / names.length >= 0.5
}

// ─── SWUDB CSV Import ────────────────────────────────────

/** Detect if text looks like SWUDB CSV: header with Set,CardNumber,Count columns */
function isSwudbCsv(text: string): boolean {
  const firstLine = text.split(/\r?\n/)[0]?.toLowerCase().replace(/['"]/g, '') || ''
  const cols = firstLine.split(',').map(c => c.trim())
  return cols.some(c => /^set$/i.test(c)) && cols.some(c => /^cardnumber$/i.test(c))
}

async function importSwudbCsv(text: string): Promise<DeckImportResult> {
  const result: DeckImportResult = {
    success: false, errors: [], warnings: [], matchedCards: 0, totalCards: 0,
  }

  // Preload full database
  await loadFullDatabase().catch(() => {})

  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) {
    result.errors.push('CSV vacío o sin datos')
    return result
  }

  // Parse header
  const header = lines[0].toLowerCase().replace(/['"]/g, '')
  const cols = header.split(',').map(c => c.trim())
  const setIdx = cols.findIndex(c => /^set$/i.test(c))
  const numIdx = cols.findIndex(c => /^cardnumber$/i.test(c))
  const countIdx = cols.findIndex(c => /^count$/i.test(c))

  if (setIdx < 0 || numIdx < 0) {
    result.errors.push('CSV no tiene columnas Set y CardNumber')
    return result
  }

  const deck: Partial<Deck> = {
    name: 'Deck Importado (CSV)',
    leaders: [],
    base: null,
    mainDeck: [],
    sideboard: [],
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const parts = line.split(',').map(p => p.trim().replace(/^['"]|['"]$/g, ''))
    const setCode = (parts[setIdx] || '').toUpperCase()
    const cardNumber = parseInt((parts[numIdx] || '').replace(/^0+/, ''), 10)
    const quantity = countIdx >= 0 ? (parseInt(parts[countIdx] || '1', 10) || 1) : 1

    if (!setCode || !cardNumber || cardNumber <= 0) continue

    result.totalCards++
    const card = await findCardBySetNumber(setCode, cardNumber)

    if (!card) {
      result.warnings.push(`No encontrada: ${setCode} #${String(cardNumber).padStart(3, '0')}`)
      continue
    }

    result.matchedCards++

    // Auto-classify by card type
    if (card.type === 'Leader') {
      deck.leaders!.push(toDeckCard(card, 1))
    } else if (card.type === 'Base') {
      deck.base = toDeckCard(card, 1)
    } else {
      // Check if already in mainDeck (consolidate duplicates)
      const existing = deck.mainDeck!.find(dc => dc.cardId === card.id)
      if (existing) {
        existing.quantity += quantity
      } else {
        deck.mainDeck!.push(toDeckCard(card, quantity))
      }
    }
  }

  result.success = result.matchedCards > 0
  result.deck = deck
  return result
}

// ─── Main Import ─────────────────────────────────────────

/** Detect format and import deck from text/clipboard */
export async function importDeckFromText(text: string): Promise<DeckImportResult> {
  const trimmed = text.trim()

  // Detect JSON
  if (trimmed.startsWith('{')) {
    return importSwudbJson(trimmed)
  }

  // Detect SWUDB CSV (header: Set,CardNumber,Count,...)
  if (isSwudbCsv(trimmed)) {
    return importSwudbCsv(trimmed)
  }

  // Otherwise treat as Melee/text format
  return importMeleeText(trimmed)
}

// ─── EXPORT ──────────────────────────────────────────────

/** Export deck to SWUDB JSON format */
export async function exportDeckAsSwudbJson(deck: Deck): Promise<string> {
  // We need to look up each card to get setCode_setNumber
  const allCardIds = new Set<string>()
  deck.leaders.forEach(c => allCardIds.add(c.cardId))
  if (deck.base) allCardIds.add(deck.base.cardId)
  deck.mainDeck.forEach(c => allCardIds.add(c.cardId))
  deck.sideboard.forEach(c => allCardIds.add(c.cardId))

  // Load all cards from Dexie
  const cardMap = new Map<string, { setCode: string; setNumber: number }>()
  const cards = await db.cards.where('id').anyOf([...allCardIds]).toArray()
  for (const c of cards) {
    cardMap.set(c.id, { setCode: c.setCode, setNumber: c.setNumber })
  }

  function toSwudbId(cardId: string): string {
    const info = cardMap.get(cardId)
    if (!info) return cardId
    return `${info.setCode}_${String(info.setNumber).padStart(3, '0')}`
  }

  const json: SwudbDeckJson = {
    metadata: { name: deck.name },
    leader: deck.leaders[0]
      ? { id: toSwudbId(deck.leaders[0].cardId), count: 1 }
      : undefined,
    base: deck.base
      ? { id: toSwudbId(deck.base.cardId), count: 1 }
      : undefined,
    deck: deck.mainDeck.map(c => ({
      id: toSwudbId(c.cardId),
      count: c.quantity,
    })),
    sideboard: deck.sideboard.length > 0
      ? deck.sideboard.map(c => ({ id: toSwudbId(c.cardId), count: c.quantity }))
      : undefined,
  }

  return JSON.stringify(json, null, 2)
}

/** Export deck in SWUDB CSV format: Set,CardNumber,Count,IsFoil,Stamp */
export async function exportDeckAsSwudbCsv(deck: Deck): Promise<string> {
  const allCardIds = new Set<string>()
  deck.leaders.forEach(c => allCardIds.add(c.cardId))
  if (deck.base) allCardIds.add(deck.base.cardId)
  deck.mainDeck.forEach(c => allCardIds.add(c.cardId))
  deck.sideboard.forEach(c => allCardIds.add(c.cardId))

  const cardMap = new Map<string, { setCode: string; setNumber: number }>()
  const cards = await db.cards.where('id').anyOf([...allCardIds]).toArray()
  for (const c of cards) {
    cardMap.set(c.id, { setCode: c.setCode, setNumber: c.setNumber })
  }

  const lines: string[] = ['Set,CardNumber,Count,IsFoil,Stamp']

  function addLine(cardId: string, qty: number) {
    const info = cardMap.get(cardId)
    if (!info) return
    const num = String(info.setNumber).padStart(3, '0')
    lines.push(`${info.setCode},${num},${qty},False,`)
  }

  // Leaders
  for (const l of deck.leaders) addLine(l.cardId, 1)
  // Base
  if (deck.base) addLine(deck.base.cardId, 1)
  // Main deck
  for (const c of deck.mainDeck) addLine(c.cardId, c.quantity)
  // Sideboard
  for (const c of deck.sideboard) addLine(c.cardId, c.quantity)

  return lines.join('\n')
}

/** Export deck in Melee text format */
export function exportDeckAsMeleeText(deck: Deck): string {
  const lines: string[] = []

  // Leader
  if (deck.leaders.length > 0) {
    lines.push('Leader')
    for (const l of deck.leaders) {
      lines.push(`1 | ${l.name}${l.subtitle ? ` | ${l.subtitle}` : ''}`)
    }
    lines.push('')
  }

  // Base
  if (deck.base) {
    lines.push('Base')
    lines.push(`1 | ${deck.base.name}${deck.base.subtitle ? ` | ${deck.base.subtitle}` : ''}`)
    lines.push('')
  }

  // Main Deck
  if (deck.mainDeck.length > 0) {
    lines.push('MainDeck')
    for (const c of deck.mainDeck) {
      lines.push(`${c.quantity} | ${c.name}${c.subtitle ? ` | ${c.subtitle}` : ''}`)
    }
    lines.push('')
  }

  // Sideboard
  if (deck.sideboard.length > 0) {
    lines.push('Sideboard')
    for (const c of deck.sideboard) {
      lines.push(`${c.quantity} | ${c.name}${c.subtitle ? ` | ${c.subtitle}` : ''}`)
    }
  }

  return lines.join('\n').trim()
}

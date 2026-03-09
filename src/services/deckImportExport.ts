/**
 * Deck Import/Export Service
 *
 * Supports:
 * - SWUDB JSON format: { metadata, leader, base, deck, sideboard }
 *   Card IDs: "SET_NUMBER" e.g. "SOR_017"
 *
 * - Melee text format:
 *   Leader\n1 | Name | Subtitle\nBase\n1 | Name\nMainDeck\n3 | Name\nSideboard\n...
 *
 * - Plain text: "3x Card Name" or "3 Card Name"
 */

import { db } from './db'
import { searchCards } from './swuApi'
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

/** Look up card by name (fuzzy) — used for Melee text format */
async function findCardByName(name: string, subtitle?: string): Promise<Card | null> {
  const fullName = subtitle ? `${name}, ${subtitle}` : name
  // Try exact search first
  const { cards } = await searchCards({ query: fullName, limit: 5 })
  if (cards.length === 0) return null

  // Prefer exact name match
  const exact = cards.find(c => {
    const cName = c.subtitle ? `${c.name}, ${c.subtitle}` : c.name
    return cName.toLowerCase() === fullName.toLowerCase()
  })
  if (exact) return exact

  // Try name-only match
  const nameMatch = cards.find(c => c.name.toLowerCase() === name.toLowerCase())
  if (nameMatch) return nameMatch

  // Return first result as fallback
  return cards[0]
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

async function importMeleeText(text: string): Promise<DeckImportResult> {
  const result: DeckImportResult = {
    success: false, errors: [], warnings: [], matchedCards: 0, totalCards: 0,
  }

  const lines = text.trim().split(/\r?\n/)
  let section: 'none' | 'leader' | 'base' | 'maindeck' | 'sideboard' = 'none'

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

    // Parse card line: "3 | Card Name | Subtitle" or "3x Card Name" or "3 Card Name"
    let quantity = 1
    let cardName = ''
    let subtitle = ''

    // Melee format: "3 | Name | Subtitle"
    const pipeMatch = line.match(/^(\d+)\s*\|\s*(.+?)(?:\s*\|\s*(.+))?$/)
    if (pipeMatch) {
      quantity = parseInt(pipeMatch[1], 10) || 1
      cardName = pipeMatch[2].trim()
      subtitle = (pipeMatch[3] || '').trim()
    } else {
      // Generic: "3x Card Name" or "3 Card Name"
      const genericMatch = line.match(/^(\d+)\s*x?\s+(.+)$/)
      if (genericMatch) {
        quantity = parseInt(genericMatch[1], 10) || 1
        cardName = genericMatch[2].trim()
      } else {
        // Just a card name
        cardName = line
      }
    }

    if (!cardName) continue

    result.totalCards++
    const card = await findCardByName(cardName, subtitle)

    if (!card) {
      result.warnings.push(`No encontrada: ${cardName}${subtitle ? ` | ${subtitle}` : ''}`)
      continue
    }

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

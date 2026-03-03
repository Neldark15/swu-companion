/**
 * Deck Validation for Star Wars: Unlimited
 * Rules:
 * - 1 Leader (2 for Twin Suns)
 * - 1 Base
 * - Main deck: minimum card count varies by format (no maximum)
 * - Sideboard: up to 10 cards (Premier / Twin Suns)
 * - Max 3 copies of any non-unique card (1 in Twin Suns)
 * - Max 1 copy of any unique card
 *
 * Some bases modify the minimum deck size:
 *   - Data Vault (JTL-024): +10
 */

import type { Deck, DeckCard } from '../types'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  stats: DeckStats
}

export interface DeckStats {
  leaderCount: number
  baseCount: number
  mainDeckSize: number
  sideboardSize: number
  totalCards: number
  aspectBreakdown: Record<string, number>
  costCurve: Record<number, number>
  typeBreakdown: Record<string, number>
}

const FORMAT_RULES: Record<string, { leaders: number; mainDeck: number; sideboard: number; maxCopies: number }> = {
  premier: { leaders: 1, mainDeck: 50, sideboard: 10, maxCopies: 3 },
  twin_suns: { leaders: 2, mainDeck: 80, sideboard: 10, maxCopies: 1 },
  sealed: { leaders: 1, mainDeck: 30, sideboard: 0, maxCopies: 3 },
  draft: { leaders: 1, mainDeck: 30, sideboard: 0, maxCopies: 3 },
  limited: { leaders: 1, mainDeck: 30, sideboard: 0, maxCopies: 3 },
}

/**
 * Patterns that match base card text modifying deck size.
 * Returns a positive number to increase, negative to decrease.
 */
const DECK_SIZE_MODIFIERS: { pattern: RegExp; delta: number }[] = [
  // "Your minimum deck size is increased by 10"
  { pattern: /minimum deck size is increased by (\d+)/i, delta: 10 },
  // Future-proof: "Your minimum deck size is decreased by X"
  { pattern: /minimum deck size is decreased by (\d+)/i, delta: -10 },
]

/**
 * Given a base card's text, calculate how much it modifies the minimum deck size.
 */
export function getBaseDeckSizeModifier(baseText: string): number {
  for (const mod of DECK_SIZE_MODIFIERS) {
    const match = baseText.match(mod.pattern)
    if (match) {
      const num = parseInt(match[1], 10)
      return mod.delta > 0 ? num : -num
    }
  }
  return 0
}

/**
 * Calculate the effective minimum deck size for a given format and base text.
 */
export function getEffectiveMinDeckSize(format: string, baseText?: string): number {
  const rules = FORMAT_RULES[format] || FORMAT_RULES.premier
  const baseMod = baseText ? getBaseDeckSizeModifier(baseText) : 0
  return Math.max(1, rules.mainDeck + baseMod)
}

function countCards(cards: DeckCard[]): number {
  return cards.reduce((sum, c) => sum + c.quantity, 0)
}

export function validateDeck(deck: Deck, baseText?: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const rules = FORMAT_RULES[deck.format] || FORMAT_RULES.premier
  const minDeckSize = getEffectiveMinDeckSize(deck.format, baseText)

  const leaderCount = countCards(deck.leaders)
  const baseCount = deck.base ? 1 : 0
  const mainDeckSize = countCards(deck.mainDeck)
  const sideboardSize = countCards(deck.sideboard)

  // Leader validation
  if (leaderCount < rules.leaders) {
    errors.push(`Se necesita${rules.leaders > 1 ? 'n' : ''} ${rules.leaders} Leader${rules.leaders > 1 ? 's' : ''} (tiene ${leaderCount})`)
  } else if (leaderCount > rules.leaders) {
    errors.push(`Máximo ${rules.leaders} Leader${rules.leaders > 1 ? 's' : ''} (tiene ${leaderCount})`)
  }

  // Base validation
  if (baseCount === 0) {
    errors.push('Se necesita 1 Base')
  }

  // Main deck size — minimum only, NO maximum
  if (mainDeckSize < minDeckSize) {
    errors.push(`El mazo necesita mínimo ${minDeckSize} cartas (tiene ${mainDeckSize})`)
  }

  // Sideboard
  if (sideboardSize > rules.sideboard) {
    errors.push(`El sideboard tiene ${sideboardSize} cartas (máximo ${rules.sideboard})`)
  }

  // Copy limits in main deck
  for (const card of deck.mainDeck) {
    if (card.quantity > rules.maxCopies) {
      errors.push(`${card.name}: máximo ${rules.maxCopies} copias (tiene ${card.quantity})`)
    }
  }

  // Warnings
  if (mainDeckSize > 0 && mainDeckSize < minDeckSize) {
    warnings.push(`Faltan ${minDeckSize - mainDeckSize} cartas en el mazo principal`)
  }

  // Cost curve stats
  const costCurve: Record<number, number> = {}
  const typeBreakdown: Record<string, number> = {}
  const aspectBreakdown: Record<string, number> = {}

  void deck.mainDeck

  const stats: DeckStats = {
    leaderCount,
    baseCount,
    mainDeckSize,
    sideboardSize,
    totalCards: leaderCount + baseCount + mainDeckSize + sideboardSize,
    aspectBreakdown,
    costCurve,
    typeBreakdown,
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats,
  }
}

export function canAddCard(
  deck: Deck,
  cardId: string,
  _cardName: string,
  isUnique: boolean,
  target: 'mainDeck' | 'sideboard',
): { allowed: boolean; reason?: string } {
  const rules = FORMAT_RULES[deck.format] || FORMAT_RULES.premier
  const list = target === 'mainDeck' ? deck.mainDeck : deck.sideboard

  const existing = list.find((c) => c.cardId === cardId)
  const currentQty = existing?.quantity ?? 0

  if (isUnique && currentQty >= 1) {
    return { allowed: false, reason: 'Carta única: máximo 1 copia' }
  }

  if (currentQty >= rules.maxCopies) {
    return { allowed: false, reason: `Máximo ${rules.maxCopies} copias permitidas` }
  }

  // Main deck has NO maximum — only minimum is enforced at validation time
  // Users can add as many cards as they want above the minimum

  if (target === 'sideboard') {
    const totalSide = countCards(deck.sideboard)
    if (totalSide >= rules.sideboard) {
      return { allowed: false, reason: `Sideboard lleno (${rules.sideboard} cartas)` }
    }
  }

  return { allowed: true }
}

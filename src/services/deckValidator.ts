/**
 * Deck Validation for Star Wars: Unlimited
 * Premier format rules:
 * - Exactly 1 Leader (or 2 for Twin Suns)
 * - Exactly 1 Base
 * - Main deck: exactly 50 cards (Premier) or 50 (Twin Suns)
 * - Sideboard: up to 10 cards
 * - Max 3 copies of any non-unique card
 * - Max 1 copy of any unique card
 * - No duplicate unique names across the deck
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
  twin_suns: { leaders: 2, mainDeck: 50, sideboard: 10, maxCopies: 1 },
  sealed: { leaders: 1, mainDeck: 30, sideboard: 0, maxCopies: 3 },
  draft: { leaders: 1, mainDeck: 30, sideboard: 0, maxCopies: 3 },
  limited: { leaders: 1, mainDeck: 30, sideboard: 0, maxCopies: 3 },
}

function countCards(cards: DeckCard[]): number {
  return cards.reduce((sum, c) => sum + c.quantity, 0)
}

export function validateDeck(deck: Deck): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const rules = FORMAT_RULES[deck.format] || FORMAT_RULES.premier

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

  // Main deck size
  if (mainDeckSize < rules.mainDeck) {
    errors.push(`El mazo necesita ${rules.mainDeck} cartas (tiene ${mainDeckSize})`)
  } else if (mainDeckSize > rules.mainDeck) {
    errors.push(`El mazo tiene ${mainDeckSize} cartas (máximo ${rules.mainDeck})`)
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
  if (mainDeckSize > 0 && mainDeckSize < rules.mainDeck) {
    warnings.push(`Faltan ${rules.mainDeck - mainDeckSize} cartas en el mazo principal`)
  }

  // Cost curve stats
  const costCurve: Record<number, number> = {}
  const typeBreakdown: Record<string, number> = {}
  const aspectBreakdown: Record<string, number> = {}

  // Stats would require full card data; populated by UI when available
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

  if (target === 'mainDeck') {
    const totalMain = countCards(deck.mainDeck)
    if (totalMain >= rules.mainDeck) {
      return { allowed: false, reason: `Mazo principal lleno (${rules.mainDeck} cartas)` }
    }
  }

  if (target === 'sideboard') {
    const totalSide = countCards(deck.sideboard)
    if (totalSide >= rules.sideboard) {
      return { allowed: false, reason: `Sideboard lleno (${rules.sideboard} cartas)` }
    }
  }

  return { allowed: true }
}

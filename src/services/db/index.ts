import Dexie, { type Table } from 'dexie'
import type { MatchState, Tournament, Deck, Card } from '../../types'

export class SWUDatabase extends Dexie {
  matches!: Table<MatchState, string>
  tournaments!: Table<Tournament, string>
  decks!: Table<Deck, string>
  cards!: Table<Card, string>
  favoriteCards!: Table<{ cardId: string }, string>
  collection!: Table<{ cardId: string; quantity: number }, string>
  wishlist!: Table<{ cardId: string }, string>

  constructor() {
    super('swu-companion')

    this.version(1).stores({
      matches: 'id, mode, isActive, createdAt',
      tournaments: 'id, status, createdAt',
      decks: 'id, name, format, createdAt',
      cards: 'id, name, type, rarity, setCode, *aspects, *keywords, *traits',
      favoriteCards: 'cardId',
      collection: 'cardId',
      wishlist: 'cardId',
    })
  }
}

export const db = new SWUDatabase()

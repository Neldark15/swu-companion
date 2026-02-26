import Dexie, { type Table } from 'dexie'
import type { MatchState, Tournament, Deck, Card } from '../../types'

export interface UserProfile {
  id: string
  name: string
  pin: string
  avatar: string
  createdAt: number
}

export class SWUDatabase extends Dexie {
  matches!: Table<MatchState, string>
  tournaments!: Table<Tournament, string>
  decks!: Table<Deck, string>
  cards!: Table<Card, string>
  favoriteCards!: Table<{ cardId: string; profileId?: string }, string>
  collection!: Table<{ cardId: string; quantity: number; profileId?: string }, string>
  wishlist!: Table<{ cardId: string; profileId?: string }, string>
  profiles!: Table<UserProfile, string>

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

    this.version(2).stores({
      matches: 'id, mode, isActive, createdAt, profileId',
      tournaments: 'id, status, createdAt, profileId',
      decks: 'id, name, format, createdAt, profileId',
      cards: 'id, name, type, rarity, setCode, *aspects, *keywords, *traits',
      favoriteCards: 'cardId, profileId',
      collection: 'cardId, profileId',
      wishlist: 'cardId, profileId',
      profiles: 'id, name',
    })
  }
}

export const db = new SWUDatabase()

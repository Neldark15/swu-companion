import Dexie, { type Table } from 'dexie'
import type { MatchState, Tournament, Deck, Card, MatchLog } from '../../types'
import type { PlayerStats } from '../gamification'

export interface UserProfile {
  id: string
  name: string
  email?: string
  pin?: string               // PBKDF2 hash (migrated from plaintext)
  pinSalt?: string           // Salt for PBKDF2
  pinPlain?: string          // Legacy plaintext PIN (migrated on login)
  avatar: string
  credentialId?: string      // WebAuthn credential ID (base64)
  credentialPublicKey?: string // WebAuthn public key (base64)
  createdAt: number
}

export interface CardPrice {
  cardId: string
  marketPrice: number | null
  lowPrice: number | null
  highPrice: number | null
  source: string             // 'swudb' | 'tcgapi' | 'manual'
  lastUpdated: number
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
  playerStats!: Table<PlayerStats, string>
  cardPrices!: Table<CardPrice, string>
  matchLogs!: Table<MatchLog, string>

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

    // v3: Add email, pinSalt, credentialId fields to profiles
    this.version(3).stores({
      matches: 'id, mode, isActive, createdAt, profileId',
      tournaments: 'id, status, createdAt, profileId',
      decks: 'id, name, format, createdAt, profileId',
      cards: 'id, name, type, rarity, setCode, *aspects, *keywords, *traits',
      favoriteCards: 'cardId, profileId',
      collection: 'cardId, profileId',
      wishlist: 'cardId, profileId',
      profiles: 'id, name, email, credentialId',
    }).upgrade(async (tx) => {
      const profiles = tx.table('profiles')
      await profiles.toCollection().modify((profile: UserProfile) => {
        if (profile.pin && !profile.pinSalt) {
          profile.pinPlain = profile.pin
          profile.pin = undefined
          profile.pinSalt = undefined
        }
      })
    })

    // v4: Add playerStats table for gamification
    this.version(4).stores({
      matches: 'id, mode, isActive, createdAt, profileId',
      tournaments: 'id, status, createdAt, profileId',
      decks: 'id, name, format, createdAt, profileId',
      cards: 'id, name, type, rarity, setCode, *aspects, *keywords, *traits',
      favoriteCards: 'cardId, profileId',
      collection: 'cardId, profileId',
      wishlist: 'cardId, profileId',
      profiles: 'id, name, email, credentialId',
      playerStats: 'profileId',
    })

    // v5: Add cardPrices table for price caching
    this.version(5).stores({
      matches: 'id, mode, isActive, createdAt, profileId',
      tournaments: 'id, status, createdAt, profileId',
      decks: 'id, name, format, createdAt, profileId',
      cards: 'id, name, type, rarity, setCode, *aspects, *keywords, *traits',
      favoriteCards: 'cardId, profileId',
      collection: 'cardId, profileId',
      wishlist: 'cardId, profileId',
      profiles: 'id, name, email, credentialId',
      playerStats: 'profileId',
      cardPrices: 'cardId',
    })

    // v6: Add matchLogs table for Holocrón de Duelos
    this.version(6).stores({
      matches: 'id, mode, isActive, createdAt, profileId',
      tournaments: 'id, status, createdAt, profileId',
      decks: 'id, name, format, createdAt, profileId',
      cards: 'id, name, type, rarity, setCode, *aspects, *keywords, *traits',
      favoriteCards: 'cardId, profileId',
      collection: 'cardId, profileId',
      wishlist: 'cardId, profileId',
      profiles: 'id, name, email, credentialId',
      playerStats: 'profileId',
      cardPrices: 'cardId',
      matchLogs: 'id, userId, recordedAt, gameMode',
    })
  }
}

export const db = new SWUDatabase()

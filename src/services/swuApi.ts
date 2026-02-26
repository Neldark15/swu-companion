/**
 * SWU API Client — api.swuapi.com
 * Handles card search, set listing, and offline caching via Dexie
 */

import { db } from './db'
import type { Card, SetInfo } from '../types'

const API_BASE = 'https://api.swuapi.com'
const PAGE_SIZE = 50

interface ApiCard {
  id: string
  name: string
  subtitle: string | null
  set_code: string
  card_number: string
  type: string
  rarity: string
  cost: number | null
  power: number | null
  hp: number | null
  arena: string | null
  aspects: string[]
  traits: string[]
  keywords: string[]
  text: string | null
  epic_action: string | null
  deploy_box: string | null
  is_leader: boolean
  is_base: boolean
  is_unique: boolean
  front_image_url: string | null
  back_image_url: string | null
  thumbnail_url: string | null
  artist: string | null
  variant_type: string | null
}

interface ApiResponse {
  cards: ApiCard[]
  pagination: {
    limit: number
    offset: number
    total: number
  }
}

interface ApiSetResponse {
  sets: {
    code: string
    name: string
    card_count: number
    release_date: string | null
  }[]
}

function mapApiCard(c: ApiCard): Card {
  return {
    id: c.id,
    name: c.name,
    subtitle: c.subtitle,
    type: c.type as Card['type'],
    rarity: c.rarity as Card['rarity'],
    cost: c.cost,
    power: c.power,
    hp: c.hp,
    aspects: c.aspects || [],
    traits: c.traits || [],
    keywords: c.keywords || [],
    arena: (c.arena as Card['arena']) || null,
    text: c.text || '',
    deployBox: c.deploy_box,
    epicAction: c.epic_action,
    setCode: c.set_code,
    setNumber: parseInt(c.card_number, 10) || 0,
    artist: c.artist || '',
    imageUrl: c.front_image_url || c.thumbnail_url || '',
    backImageUrl: c.back_image_url,
    isUnique: c.is_unique,
    isLeader: c.is_leader,
    isBase: c.is_base,
  }
}

export interface SearchParams {
  query?: string
  set?: string
  type?: string
  aspect?: string
  rarity?: string
  cost?: number | null
  arena?: string
  keyword?: string
  trait?: string
  offset?: number
  limit?: number
}

function buildQueryString(params: SearchParams): string {
  const qs = new URLSearchParams()
  if (params.query) qs.set('search', params.query)
  if (params.set) qs.set('set', params.set)
  if (params.type) qs.set('type', params.type)
  if (params.aspect) qs.set('aspect', params.aspect)
  if (params.rarity) qs.set('rarity', params.rarity)
  if (params.cost !== undefined && params.cost !== null) qs.set('cost', String(params.cost))
  if (params.arena) qs.set('arena', params.arena)
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.trait) qs.set('trait', params.trait)
  qs.set('limit', String(params.limit ?? PAGE_SIZE))
  qs.set('offset', String(params.offset ?? 0))
  qs.set('format', 'json')
  return qs.toString()
}

export async function searchCards(params: SearchParams): Promise<{ cards: Card[]; total: number }> {
  const url = `${API_BASE}/cards?${buildQueryString(params)}`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`API ${res.status}`)
    const data: ApiResponse = await res.json()
    const cards = data.cards.map(mapApiCard)

    // Cache cards in IndexedDB
    if (cards.length > 0) {
      await db.cards.bulkPut(cards).catch(() => {})
    }

    return { cards, total: data.pagination.total }
  } catch (err) {
    // Fallback to offline cache
    console.warn('API offline, searching local cache:', err)
    return searchLocalCards(params)
  }
}

async function searchLocalCards(params: SearchParams): Promise<{ cards: Card[]; total: number }> {
  let collection = db.cards.toCollection()

  if (params.set) {
    collection = db.cards.where('setCode').equals(params.set)
  } else if (params.type) {
    collection = db.cards.where('type').equals(params.type)
  } else if (params.rarity) {
    collection = db.cards.where('rarity').equals(params.rarity)
  }

  let results = await collection.toArray()

  // Text search filter
  if (params.query) {
    const q = params.query.toLowerCase()
    results = results.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.subtitle && c.subtitle.toLowerCase().includes(q)) ||
        c.text.toLowerCase().includes(q),
    )
  }

  // Additional filters
  if (params.aspect) {
    results = results.filter((c) => c.aspects.includes(params.aspect!))
  }
  if (params.arena) {
    results = results.filter((c) => c.arena === params.arena)
  }
  if (params.cost !== undefined && params.cost !== null) {
    results = results.filter((c) => c.cost === params.cost)
  }

  const total = results.length
  const offset = params.offset ?? 0
  const limit = params.limit ?? PAGE_SIZE
  const paged = results.slice(offset, offset + limit)

  return { cards: paged, total }
}

export async function getCardById(id: string): Promise<Card | null> {
  // Try API first
  try {
    const res = await fetch(`${API_BASE}/cards/${id}?format=json`)
    if (res.ok) {
      const data = await res.json()
      if (data.card) {
        const card = mapApiCard(data.card)
        await db.cards.put(card).catch(() => {})
        return card
      }
    }
  } catch {
    // fallback
  }

  // Fallback to cache
  return (await db.cards.get(id)) || null
}

export async function getSets(): Promise<SetInfo[]> {
  try {
    const res = await fetch(`${API_BASE}/sets?format=json`)
    if (!res.ok) throw new Error(`API ${res.status}`)
    const data: ApiSetResponse = await res.json()
    return data.sets.map((s) => ({
      code: s.code,
      name: s.name,
      cardCount: s.card_count,
      releaseDate: s.release_date || '',
    }))
  } catch {
    // Return hardcoded main sets as fallback
    return [
      { code: 'SOR', name: 'Spark of Rebellion', cardCount: 252, releaseDate: '2024-03-08' },
      { code: 'SHD', name: 'Shadows of the Galaxy', cardCount: 262, releaseDate: '2024-07-12' },
      { code: 'TWI', name: 'Twilight of the Republic', cardCount: 264, releaseDate: '2024-11-08' },
      { code: 'JTL', name: 'Jump to Lightspeed', cardCount: 262, releaseDate: '2025-03-14' },
      { code: 'LOF', name: 'Legends of the Force', cardCount: 260, releaseDate: '2025-07-11' },
      { code: 'SEC', name: 'Secrets of Power', cardCount: 260, releaseDate: '2025-11-07' },
      { code: 'LAW', name: 'A Lawless Time', cardCount: 0, releaseDate: '2026-03-13' },
    ]
  }
}

// Preload a set's cards into cache
export async function preloadSet(setCode: string): Promise<number> {
  let offset = 0
  let total = 0
  let loaded = 0

  do {
    const { cards, total: t } = await searchCards({ set: setCode, offset, limit: 100 })
    total = t
    loaded += cards.length
    offset += 100
  } while (loaded < total)

  return loaded
}

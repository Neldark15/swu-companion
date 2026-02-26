/**
 * SWU API Client — api.swuapi.com
 * Uses /export/all for full card database + local search via Dexie
 * The API doesn't support text search, so we download everything once
 * and search locally in IndexedDB for instant results.
 */

import { db } from './db'
import type { Card, SetInfo } from '../types'

const API_BASE = 'https://api.swuapi.com'

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

// ─── Card Database Management ───

let _dbReady = false
let _dbLoading = false
let _dbLoadPromise: Promise<void> | null = null

/** Check if we have cards cached locally */
async function getLocalCardCount(): Promise<number> {
  return db.cards.count()
}

/** Download ALL cards from the export endpoint and cache locally */
export async function loadFullDatabase(): Promise<number> {
  if (_dbReady) return db.cards.count()
  if (_dbLoading && _dbLoadPromise) {
    await _dbLoadPromise
    return db.cards.count()
  }

  _dbLoading = true
  _dbLoadPromise = (async () => {
    try {
      // Check if we already have a substantial cache
      const existing = await getLocalCardCount()
      if (existing > 5000) {
        _dbReady = true
        _dbLoading = false
        return
      }

      const res = await fetch(`${API_BASE}/export/all`)
      if (!res.ok) throw new Error(`Export API ${res.status}`)
      const data = await res.json()

      const allCards: ApiCard[] = data.cards || data
      if (!Array.isArray(allCards) || allCards.length === 0) throw new Error('No cards in export')

      const mapped = allCards.map(mapApiCard)

      // Batch insert into IndexedDB (chunks of 500)
      for (let i = 0; i < mapped.length; i += 500) {
        const chunk = mapped.slice(i, i + 500)
        await db.cards.bulkPut(chunk).catch(() => {})
      }

      _dbReady = true
    } catch (err) {
      console.error('Failed to load full card database:', err)
      // If we have some cached cards, still mark as ready
      const count = await getLocalCardCount()
      if (count > 0) _dbReady = true
    } finally {
      _dbLoading = false
    }
  })()

  await _dbLoadPromise
  return db.cards.count()
}

/** Get database loading status */
export function isDatabaseReady(): boolean {
  return _dbReady
}

// ─── Search (always local) ───

export async function searchCards(params: SearchParams): Promise<{ cards: Card[]; total: number }> {
  // Ensure database is loaded
  if (!_dbReady) {
    await loadFullDatabase()
  }

  return searchLocalCards(params)
}

async function searchLocalCards(params: SearchParams): Promise<{ cards: Card[]; total: number }> {
  let results: Card[]

  // Start with indexed queries when possible
  if (params.set && params.type) {
    results = await db.cards.where('setCode').equals(params.set).toArray()
    results = results.filter(c => c.type === params.type)
  } else if (params.type) {
    results = await db.cards.where('type').equals(params.type).toArray()
  } else if (params.set) {
    results = await db.cards.where('setCode').equals(params.set).toArray()
  } else if (params.rarity) {
    results = await db.cards.where('rarity').equals(params.rarity).toArray()
  } else {
    results = await db.cards.toArray()
  }

  // Text search filter (name, subtitle, text, traits)
  if (params.query) {
    const q = params.query.toLowerCase().trim()
    const words = q.split(/\s+/)

    results = results.filter((c) => {
      const searchable = [
        c.name.toLowerCase(),
        c.subtitle?.toLowerCase() || '',
        c.text.toLowerCase(),
        ...c.traits.map(t => t.toLowerCase()),
        ...c.keywords.map(k => k.toLowerCase()),
      ].join(' ')

      // All words must match somewhere
      return words.every(w => searchable.includes(w))
    })
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
  if (params.keyword) {
    results = results.filter((c) => c.keywords.includes(params.keyword!))
  }
  if (params.trait) {
    results = results.filter((c) => c.traits.includes(params.trait!))
  }

  // Sort: Leaders/Bases first, then by name
  results.sort((a, b) => {
    // Leaders first
    if (a.isLeader && !b.isLeader) return -1
    if (!a.isLeader && b.isLeader) return 1
    // Bases second
    if (a.isBase && !b.isBase) return -1
    if (!a.isBase && b.isBase) return 1
    // Then alphabetical
    return a.name.localeCompare(b.name)
  })

  const total = results.length
  const offset = params.offset ?? 0
  const limit = params.limit ?? 50
  const paged = results.slice(offset, offset + limit)

  return { cards: paged, total }
}

// ─── Single card ───

export async function getCardById(id: string): Promise<Card | null> {
  // Try local first
  const local = await db.cards.get(id)
  if (local) return local

  // Fallback to API
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
    // no-op
  }

  return null
}

// ─── Sets ───

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
    return [
      { code: 'SOR', name: 'Spark of Rebellion', cardCount: 252, releaseDate: '2024-03-08' },
      { code: 'SHD', name: 'Shadows of the Galaxy', cardCount: 262, releaseDate: '2024-07-12' },
      { code: 'TWI', name: 'Twilight of the Republic', cardCount: 264, releaseDate: '2024-11-08' },
      { code: 'JTL', name: 'Jump to Lightspeed', cardCount: 262, releaseDate: '2025-03-14' },
      { code: 'LOF', name: 'Legends of the Force', cardCount: 260, releaseDate: '2025-07-11' },
      { code: 'SEC', name: 'Secrets of Power', cardCount: 260, releaseDate: '2025-11-07' },
      { code: 'LAW', name: 'A Lawless Time', cardCount: 260, releaseDate: '2026-03-13' },
    ]
  }
}

// ─── Preload (now uses export/all) ───

export async function preloadSet(_setCode: string): Promise<number> {
  return loadFullDatabase()
}

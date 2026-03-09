/**
 * SWU API Client — api.swuapi.com
 *
 * Hybrid search strategy:
 * - Filter-based browsing (set, type, rarity) → API with pagination
 * - Text search (name, traits, keywords) → Local IndexedDB search
 * - Every card fetched from API gets cached locally for offline + text search
 * - No upfront mass download required
 *
 * IMPORTANT: /cards endpoint returns snake_case (front_image_url)
 *            /export/all returns camelCase (frontImageUrl)
 */

import { db } from './db'
import type { Card, SetInfo } from '../types'

const API_BASE = 'https://api.swuapi.com'

interface ApiCardSnake {
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

interface ApiCardCamel {
  id: string
  cardUid?: string
  name: string
  subtitle: string | null
  setCode: string
  cardNumber: string
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
  epicAction: string | null
  deployBox: string | null
  isLeader: boolean
  isBase: boolean
  isUnique: boolean
  frontImageUrl: string | null
  backImageUrl: string | null
  thumbnailUrl: string | null
  artist: string | null
  variantType: string | null
}

type ApiCard = ApiCardSnake | ApiCardCamel

interface ApiSetResponse {
  sets: {
    code: string
    name: string
    card_count: number
    release_date: string | null
  }[]
}

function mapApiCard(c: ApiCard): Card {
  // Detect format: camelCase (export/all) vs snake_case (/cards)
  const isCamel = 'setCode' in c && typeof (c as ApiCardCamel).setCode === 'string'

  if (isCamel) {
    const cc = c as ApiCardCamel
    return {
      id: cc.id,
      name: cc.name,
      subtitle: cc.subtitle,
      type: cc.type as Card['type'],
      rarity: cc.rarity as Card['rarity'],
      cost: cc.cost,
      power: cc.power,
      hp: cc.hp,
      aspects: cc.aspects || [],
      traits: cc.traits || [],
      keywords: cc.keywords || [],
      arena: (cc.arena as Card['arena']) || null,
      text: cc.text || '',
      deployBox: cc.deployBox,
      epicAction: cc.epicAction,
      setCode: cc.setCode,
      setNumber: parseInt(cc.cardNumber, 10) || 0,
      artist: cc.artist || '',
      imageUrl: cc.frontImageUrl || cc.thumbnailUrl || '',
      backImageUrl: cc.backImageUrl,
      isUnique: cc.isUnique,
      isLeader: cc.isLeader,
      isBase: cc.isBase,
    }
  } else {
    const sc = c as ApiCardSnake
    return {
      id: sc.id,
      name: sc.name,
      subtitle: sc.subtitle,
      type: sc.type as Card['type'],
      rarity: sc.rarity as Card['rarity'],
      cost: sc.cost,
      power: sc.power,
      hp: sc.hp,
      aspects: sc.aspects || [],
      traits: sc.traits || [],
      keywords: sc.keywords || [],
      arena: (sc.arena as Card['arena']) || null,
      text: sc.text || '',
      deployBox: sc.deploy_box,
      epicAction: sc.epic_action,
      setCode: sc.set_code,
      setNumber: parseInt(sc.card_number, 10) || 0,
      artist: sc.artist || '',
      imageUrl: sc.front_image_url || sc.thumbnail_url || '',
      backImageUrl: sc.back_image_url,
      isUnique: sc.is_unique,
      isLeader: sc.is_leader,
      isBase: sc.is_base,
    }
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

// ─── Cache helpers ───

/** Cache cards to IndexedDB (non-blocking) */
async function cacheCards(cards: Card[]): Promise<void> {
  if (cards.length === 0) return
  try {
    await db.cards.bulkPut(cards).catch(() => {})
  } catch {
    // silent
  }
}

/** Get count of locally cached cards */
export async function getLocalCardCount(): Promise<number> {
  return db.cards.count()
}

// ─── Legacy compatibility flags ───
let _dbReady = false

export function isDatabaseReady(): boolean {
  return _dbReady
}

/**
 * Load full database (kept for compatibility but now optional).
 * Other modules can call this to force a full download if needed.
 */
let _dbLoadPromise: Promise<number> | null = null

export async function loadFullDatabase(): Promise<number> {
  if (_dbReady) return db.cards.count()
  if (_dbLoadPromise) return _dbLoadPromise

  _dbLoadPromise = (async () => {
    try {
      const existing = await db.cards.count()
      if (existing > 5000) {
        _dbReady = true
        return existing
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000)
      const res = await fetch(`${API_BASE}/export/all`, { signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) throw new Error(`Export API ${res.status}`)
      const data = await res.json()

      const allCards: ApiCard[] = data.cards || data
      if (!Array.isArray(allCards) || allCards.length === 0) throw new Error('No cards in export')

      const mapped = allCards.map(mapApiCard)
      for (let i = 0; i < mapped.length; i += 500) {
        await db.cards.bulkPut(mapped.slice(i, i + 500)).catch(() => {})
      }

      _dbReady = true
      return mapped.length
    } catch (err) {
      console.error('Failed to load full card database:', err)
      const count = await db.cards.count()
      if (count > 0) _dbReady = true
      return count
    } finally {
      _dbLoadPromise = null
    }
  })()

  return _dbLoadPromise
}

// ─── Hybrid Search ───

/**
 * Search cards using hybrid strategy:
 * - If text query present → search locally in cached cards
 * - If only filters (set/type/rarity) → fetch from API with pagination
 * - Results are cached locally for future text searches
 */
export async function searchCards(params: SearchParams): Promise<{ cards: Card[]; total: number }> {
  const hasTextQuery = !!params.query?.trim()
  const hasApiFilters = !!(params.set || params.type || params.rarity)

  // Text search → must search locally (API doesn't support it)
  if (hasTextQuery) {
    // If we have local data, search it
    const localCount = await db.cards.count()
    if (localCount > 0) {
      return searchLocalCards(params)
    }
    // No local data and text query → can't do much, try loading from API with filters first
    if (hasApiFilters) {
      await fetchAndCacheFromApi(params)
      return searchLocalCards(params)
    }
    // No data at all — return empty
    return { cards: [], total: 0 }
  }

  // Filter-only or no-filter → use API
  if (hasApiFilters) {
    return searchFromApi(params)
  }

  // No query, no filters → browse mode: fetch from API
  return searchFromApi(params)
}

/**
 * Fetch cards from API with filters and pagination.
 * Each result page gets cached locally.
 */
async function searchFromApi(params: SearchParams): Promise<{ cards: Card[]; total: number }> {
  try {
    const queryParts: string[] = ['format=json']
    if (params.set) queryParts.push(`set=${params.set}`)
    if (params.type) queryParts.push(`type=${params.type}`)
    if (params.rarity) queryParts.push(`rarity=${params.rarity}`)
    queryParts.push(`limit=${params.limit ?? 30}`)
    queryParts.push(`offset=${params.offset ?? 0}`)

    const url = `${API_BASE}/cards?${queryParts.join('&')}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`API ${res.status}`)

    const data = await res.json()
    const apiCards: ApiCardSnake[] = data.cards || []
    const total: number = data.pagination?.total ?? apiCards.length

    const mapped = apiCards.map(mapApiCard)

    // Cache to IndexedDB (background)
    cacheCards(mapped)

    // Apply additional filters that API doesn't support
    let filtered = mapped
    if (params.aspect) {
      filtered = filtered.filter(c => c.aspects.includes(params.aspect!))
    }
    if (params.arena) {
      filtered = filtered.filter(c => c.arena === params.arena)
    }

    return { cards: filtered, total }
  } catch {
    // Fallback to local search if offline
    return searchLocalCards(params)
  }
}

/**
 * Fetch cards from API and cache them, without returning results.
 * Used to pre-populate cache before a local text search.
 */
async function fetchAndCacheFromApi(params: SearchParams): Promise<void> {
  try {
    const queryParts: string[] = ['format=json']
    if (params.set) queryParts.push(`set=${params.set}`)
    if (params.type) queryParts.push(`type=${params.type}`)
    if (params.rarity) queryParts.push(`rarity=${params.rarity}`)
    queryParts.push('limit=300') // Fetch a big page to populate cache

    const url = `${API_BASE}/cards?${queryParts.join('&')}`
    const res = await fetch(url)
    if (!res.ok) return
    const data = await res.json()
    const apiCards: ApiCardSnake[] = data.cards || []
    const mapped = apiCards.map(mapApiCard)
    await cacheCards(mapped)
  } catch {
    // silent
  }
}

// ─── Local Search (in IndexedDB cache) ───

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

  // Sort: Leaders first → Bases second → then by setCode + setNumber
  results.sort((a, b) => {
    const typeOrder = (c: Card) => c.type === 'Leader' || c.isLeader ? 0 : c.type === 'Base' || c.isBase ? 1 : 2
    const ta = typeOrder(a)
    const tb = typeOrder(b)
    if (ta !== tb) return ta - tb
    if (a.setCode !== b.setCode) return a.setCode.localeCompare(b.setCode)
    return a.setNumber - b.setNumber
  })

  const total = results.length
  const offset = params.offset ?? 0
  const limit = params.limit ?? 50
  const paged = results.slice(offset, offset + limit)

  return { cards: paged, total }
}

// ─── In-memory card cache (avoids repeated Dexie lookups) ───

const _cardMemCache = new Map<string, Card>()

// ─── Single card ───

export async function getCardById(id: string): Promise<Card | null> {
  // 1. Memory cache (instant)
  const mem = _cardMemCache.get(id)
  if (mem) return mem

  // 2. IndexedDB
  const local = await db.cards.get(id)
  if (local) {
    _cardMemCache.set(id, local)
    return local
  }

  // 3. Network fallback
  try {
    const res = await fetch(`${API_BASE}/cards/${id}?format=json`)
    if (res.ok) {
      const data = await res.json()
      if (data.card) {
        const card = mapApiCard(data.card)
        _cardMemCache.set(id, card)
        await db.cards.put(card).catch(() => {})
        return card
      }
    }
  } catch {
    // no-op
  }

  return null
}

/**
 * Batch load multiple cards at once (single Dexie query).
 * Much faster than calling getCardById() in a loop.
 */
export async function getCardsByIds(ids: string[]): Promise<Map<string, Card>> {
  const result = new Map<string, Card>()
  if (ids.length === 0) return result

  // Check memory cache first
  const missing: string[] = []
  for (const id of ids) {
    const mem = _cardMemCache.get(id)
    if (mem) {
      result.set(id, mem)
    } else {
      missing.push(id)
    }
  }

  if (missing.length === 0) return result

  // Single Dexie batch query
  try {
    const cards = await db.cards.where('id').anyOf(missing).toArray()
    for (const card of cards) {
      _cardMemCache.set(card.id, card)
      result.set(card.id, card)
    }
  } catch {
    // fallback: individual lookups
    for (const id of missing) {
      if (!result.has(id)) {
        const card = await getCardById(id)
        if (card) result.set(id, card)
      }
    }
  }

  return result
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

// ─── Preload (optional — user can trigger manually) ───

export async function preloadSet(_setCode: string): Promise<number> {
  return loadFullDatabase()
}

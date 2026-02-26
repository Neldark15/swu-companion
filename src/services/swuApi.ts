/**
 * SWU API Client — api.swuapi.com
 * Uses /export/all for full card database + local search via Dexie
 * The API doesn't support text search, so we download everything once
 * and search locally in IndexedDB for instant results.
 *
 * IMPORTANT: /export/all returns camelCase fields (frontImageUrl)
 *            /cards endpoint returns snake_case (front_image_url)
 */

import { db } from './db'
import type { Card, SetInfo } from '../types'

const API_BASE = 'https://api.swuapi.com'

// DB version to force re-download when mapping changes
const DB_VERSION = 2

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

// ─── Card Database Management ───

let _dbReady = false
let _dbLoading = false
let _dbLoadPromise: Promise<void> | null = null

async function getLocalCardCount(): Promise<number> {
  return db.cards.count()
}

/** Check if our local DB has images (i.e. was loaded with correct mapping) */
async function hasValidImages(): Promise<boolean> {
  const sample = await db.cards.limit(5).toArray()
  if (sample.length === 0) return false
  // If most cards have empty imageUrl, the DB is stale
  const withImages = sample.filter(c => c.imageUrl && c.imageUrl.startsWith('http'))
  return withImages.length >= sample.length * 0.8
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
      // Check if we already have a valid cache with images
      const existing = await getLocalCardCount()
      const validImages = existing > 5000 ? await hasValidImages() : false

      if (existing > 5000 && validImages) {
        _dbReady = true
        _dbLoading = false
        return
      }

      // Clear old data without images
      if (existing > 0 && !validImages) {
        await db.cards.clear()
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

      // Save version marker
      localStorage.setItem('swu-db-version', String(DB_VERSION))

      _dbReady = true
    } catch (err) {
      console.error('Failed to load full card database:', err)
      const count = await getLocalCardCount()
      if (count > 0) _dbReady = true
    } finally {
      _dbLoading = false
    }
  })()

  await _dbLoadPromise
  return db.cards.count()
}

export function isDatabaseReady(): boolean {
  return _dbReady
}

// ─── Search (always local) ───

export async function searchCards(params: SearchParams): Promise<{ cards: Card[]; total: number }> {
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
    // Type priority: Leader=0, Base=1, others=2
    const typeOrder = (c: Card) => c.type === 'Leader' || c.isLeader ? 0 : c.type === 'Base' || c.isBase ? 1 : 2
    const ta = typeOrder(a)
    const tb = typeOrder(b)
    if (ta !== tb) return ta - tb

    // Then by set code (alphabetical)
    if (a.setCode !== b.setCode) return a.setCode.localeCompare(b.setCode)

    // Then by collection number
    return a.setNumber - b.setNumber
  })

  const total = results.length
  const offset = params.offset ?? 0
  const limit = params.limit ?? 50
  const paged = results.slice(offset, offset + limit)

  return { cards: paged, total }
}

// ─── Single card ───

export async function getCardById(id: string): Promise<Card | null> {
  const local = await db.cards.get(id)
  if (local) return local

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

// ─── Preload ───

export async function preloadSet(_setCode: string): Promise<number> {
  return loadFullDatabase()
}

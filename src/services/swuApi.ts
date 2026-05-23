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

/**
 * Shape unificado del API. La realidad es que api.swuapi.com tiene dos endpoints:
 * - /cards (paginado) usa snake_case + a partir de 2026 cambió a 'uuid', 'front_text',
 *   'back_text', 'unique_flag', 'collector_number' en vez de los nombres viejos.
 * - /export/all (bulk) usa camelCase y mantiene los nombres viejos: id, text, isUnique.
 *
 * En vez de pelearnos con dos types separados, hacemos un type permisivo con TODOS
 * los campos posibles opcionales, y el mapper toma el primero que exista.
 */
type ApiCard = Record<string, unknown> & {
  // identifiers
  id?: string
  uuid?: string
  // numbers/text
  set_code?: string
  setCode?: string
  card_number?: string | number
  cardNumber?: string | number
  collector_number?: string
  // booleans
  is_leader?: boolean
  isLeader?: boolean
  is_base?: boolean
  isBase?: boolean
  is_unique?: boolean
  isUnique?: boolean
  unique_flag?: boolean | null
  // text body
  text?: string | null
  front_text?: string | null
  frontText?: string | null
  back_text?: string | null
  backText?: string | null
  // images
  front_image_url?: string | null
  frontImageUrl?: string | null
  back_image_url?: string | null
  backImageUrl?: string | null
  thumbnail_url?: string | null
  thumbnailUrl?: string | null
  // misc
  epic_action?: string | null
  epicAction?: string | null
  deploy_box?: string | null
  deployBox?: string | null
}

interface ApiSetResponse {
  sets: {
    code: string
    name: string
    card_count: number
    release_date: string | null
  }[]
}

/**
 * Picks the first defined value from a list. Used to handle the API field
 * variants (snake/camel, old/new). Returns the fallback if none defined.
 */
function pick<T>(vals: Array<T | null | undefined>, fallback: T): T {
  for (const v of vals) if (v !== undefined && v !== null) return v
  return fallback
}

function mapApiCard(c: ApiCard): Card {
  // ID: prefer 'id' (camel/export), fallback to 'uuid' (new /cards endpoint)
  const id = (c.id ?? c.uuid ?? '') as string

  // Combine front_text + back_text from new API into one body, fallback to legacy text
  const bodyText =
    typeof c.text === 'string'
      ? c.text
      : [c.front_text, c.back_text, c.frontText, c.backText]
          .filter((t): t is string => typeof t === 'string' && t.length > 0)
          .join(' / ')

  const cardNumberRaw = c.card_number ?? c.cardNumber ?? c.collector_number ?? '0'
  const cardNumStr = typeof cardNumberRaw === 'number' ? String(cardNumberRaw) : cardNumberRaw
  // collector_number can be like "C24_001" — extract the trailing digits
  const numMatch = cardNumStr.match(/(\d+)$/)
  const setNumber = numMatch ? parseInt(numMatch[1], 10) : 0

  return {
    id,
    name: pick([c.name as string], ''),
    subtitle: (c.subtitle as string | null) ?? null,
    type: ((c.type as string) || 'Unit') as Card['type'],
    rarity: ((c.rarity as string) || 'Common') as Card['rarity'],
    cost: (c.cost as number | null) ?? null,
    power: (c.power as number | null) ?? null,
    hp: (c.hp as number | null) ?? null,
    aspects: Array.isArray(c.aspects) ? (c.aspects as string[]) : [],
    traits: Array.isArray(c.traits) ? (c.traits as string[]) : [],
    keywords: Array.isArray(c.keywords) ? (c.keywords as string[]) : [],
    arena: ((c.arena as string | null) ?? null) as Card['arena'],
    text: bodyText,
    deployBox: (c.deploy_box ?? c.deployBox ?? null) as string | null,
    epicAction: (c.epic_action ?? c.epicAction ?? null) as string | null,
    setCode: pick([c.set_code as string, c.setCode as string], ''),
    setNumber,
    artist: pick([c.artist as string], ''),
    imageUrl: pick(
      [
        c.front_image_url as string,
        c.frontImageUrl as string,
        c.thumbnail_url as string,
        c.thumbnailUrl as string,
      ],
      ''
    ),
    backImageUrl: (c.back_image_url ?? c.backImageUrl ?? null) as string | null,
    isUnique: Boolean(c.is_unique ?? c.isUnique ?? c.unique_flag),
    isLeader: Boolean(c.is_leader ?? c.isLeader),
    isBase: Boolean(c.is_base ?? c.isBase),
  }
}

/** Validate that a mapped card has the minimum required fields to be cached. */
function isValidCard(c: Card): boolean {
  return Boolean(c.id) && Boolean(c.name) && Boolean(c.setCode)
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

/** Cache cards to IndexedDB. Filters out invalid (no id) before writing. */
async function cacheCards(cards: Card[]): Promise<void> {
  if (cards.length === 0) return
  const valid = cards.filter(isValidCard)
  if (valid.length === 0) return
  try {
    await db.cards.bulkPut(valid).catch(() => {})
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

// ─── Progress subscribers (UI can listen to download status) ─────

export interface DbLoadProgress {
  phase: 'idle' | 'downloading' | 'parsing' | 'saving' | 'done' | 'error'
  message: string
  /** Bytes downloaded so far, only set during download phase */
  bytesLoaded?: number
  /** Total bytes if known (server may not send Content-Length on compressed) */
  bytesTotal?: number
  /** Card writes done / total during saving */
  saved?: number
  totalToSave?: number
  /** Final cards in DB after success */
  finalCount?: number
  error?: string
}

type ProgressListener = (p: DbLoadProgress) => void
const _progressListeners = new Set<ProgressListener>()

export function subscribeDbLoadProgress(listener: ProgressListener): () => void {
  _progressListeners.add(listener)
  return () => { _progressListeners.delete(listener) }
}

function emitProgress(p: DbLoadProgress): void {
  for (const l of _progressListeners) {
    try { l(p) } catch { /* ignore subscriber errors */ }
  }
}

/**
 * Loads the full card database from /export/all into IndexedDB.
 * Idempotent: if cache already has > 5000 cards, returns immediately.
 * Supports progress reporting via subscribeDbLoadProgress.
 *
 * Returns the final card count in the DB. Throws nothing — on failure,
 * emits an 'error' phase and returns whatever count we have.
 */
let _dbLoadPromise: Promise<number> | null = null

export async function loadFullDatabase(opts?: { force?: boolean }): Promise<number> {
  const force = opts?.force ?? false
  if (!force && _dbReady) return db.cards.count()
  if (_dbLoadPromise) return _dbLoadPromise

  _dbLoadPromise = (async () => {
    try {
      const existing = await db.cards.count()
      if (!force && existing > 5000) {
        _dbReady = true
        emitProgress({ phase: 'done', message: `Cache válida (${existing} cartas)`, finalCount: existing })
        return existing
      }

      // ── Phase 1: download ──
      emitProgress({ phase: 'downloading', message: 'Descargando base de cartas…' })
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 90_000) // 90s — export is ~12s but be lenient

      let res: Response
      try {
        res = await fetch(`${API_BASE}/export/all`, { signal: controller.signal })
      } catch (e) {
        clearTimeout(timeout)
        const err = e instanceof Error ? e.message : 'Network error'
        emitProgress({ phase: 'error', message: `Sin conexión al servidor de cartas`, error: err })
        return existing
      }
      clearTimeout(timeout)
      if (!res.ok) {
        emitProgress({ phase: 'error', message: `Servidor de cartas devolvió ${res.status}`, error: `HTTP ${res.status}` })
        return existing
      }

      // ── Phase 2: parse ──
      emitProgress({ phase: 'parsing', message: 'Procesando datos…' })
      let data: unknown
      try {
        data = await res.json()
      } catch (e) {
        const err = e instanceof Error ? e.message : 'JSON parse error'
        emitProgress({ phase: 'error', message: 'Datos del servidor inválidos', error: err })
        return existing
      }

      const rawCards: ApiCard[] = Array.isArray(data)
        ? (data as ApiCard[])
        : ((data as { cards?: ApiCard[] }).cards ?? [])
      if (!Array.isArray(rawCards) || rawCards.length === 0) {
        emitProgress({ phase: 'error', message: 'El servidor no devolvió ninguna carta', error: 'Empty response' })
        return existing
      }

      const mapped = rawCards.map(mapApiCard).filter(isValidCard)
      if (mapped.length === 0) {
        emitProgress({ phase: 'error', message: 'Las cartas recibidas no tienen formato válido', error: 'No valid cards' })
        return existing
      }

      // ── Phase 3: save in chunks ──
      const chunkSize = 500
      const totalToSave = mapped.length
      let saved = 0
      for (let i = 0; i < totalToSave; i += chunkSize) {
        const chunk = mapped.slice(i, i + chunkSize)
        await db.cards.bulkPut(chunk).catch(() => { /* skip chunk error, keep going */ })
        saved += chunk.length
        emitProgress({
          phase: 'saving',
          message: `Guardando cartas (${saved}/${totalToSave})…`,
          saved,
          totalToSave,
        })
      }

      _dbReady = true
      const finalCount = await db.cards.count()
      emitProgress({ phase: 'done', message: `Listo — ${finalCount} cartas`, finalCount })
      return finalCount
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('Failed to load full card database:', err)
      emitProgress({ phase: 'error', message: 'Error inesperado durante la carga', error: msg })
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
    const apiCards: ApiCard[] = data.cards || []
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
    const apiCards: ApiCard[] = data.cards || []
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
  const notInLocal: string[] = []
  try {
    const cards = await db.cards.where('id').anyOf(missing).toArray()
    const foundIds = new Set<string>()
    for (const card of cards) {
      _cardMemCache.set(card.id, card)
      result.set(card.id, card)
      foundIds.add(card.id)
    }
    // Collect IDs not found locally — will need network fetch
    for (const id of missing) {
      if (!foundIds.has(id)) notInLocal.push(id)
    }
  } catch {
    // If Dexie throws, all missing need network fetch
    for (const id of missing) {
      if (!result.has(id)) notInLocal.push(id)
    }
  }

  // Network fallback for cards not cached locally (e.g. promo sets like JTLP, new sets)
  if (notInLocal.length > 0) {
    const CHUNK = 8 // limit concurrency to avoid flooding the API
    for (let i = 0; i < notInLocal.length; i += CHUNK) {
      await Promise.all(
        notInLocal.slice(i, i + CHUNK).map(async (id) => {
          const card = await getCardById(id)
          if (card) result.set(id, card)
        }),
      )
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

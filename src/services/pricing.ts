/**
 * Card Pricing Service
 * Fetches, caches and serves card prices for Star Wars: Unlimited.
 *
 * Strategy:
 * 1. Check local cache (Dexie cardPrices table) — instant, works offline
 * 2. Check cloud cache (Supabase card_prices table) — shared across users
 * 3. If both miss or expired (>7 days), attempt external API fetch
 *
 * External sources tried in order:
 *   - swu-db.com card data (free, no key) — currently no prices
 *   - tcgcsv.com bulk CSV export (free) — TCGPlayer sourced prices
 *   - Manual fallback: prices can be entered by users (crowd-sourced)
 */

import { db, type CardPrice } from './db'
import { supabase, isSupabaseReady } from './supabase'

const PRICE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

// In-memory price cache to avoid repeated Dexie lookups
const _priceMemCache = new Map<string, PriceInfo>()

export interface PriceInfo {
  cardId: string
  market: number | null
  low: number | null
  high: number | null
  source: string
  updatedAt: number
}

// ─── Local Cache ──────────────────────────────────────────

/** Get price from local Dexie cache (with in-memory layer) */
export async function getLocalPrice(cardId: string): Promise<PriceInfo | null> {
  // Check memory first
  const mem = _priceMemCache.get(cardId)
  if (mem) return mem

  try {
    const cached = await db.cardPrices.get(cardId)
    if (!cached) return null
    const info: PriceInfo = {
      cardId: cached.cardId,
      market: cached.marketPrice,
      low: cached.lowPrice,
      high: cached.highPrice,
      source: cached.source,
      updatedAt: cached.lastUpdated,
    }
    _priceMemCache.set(cardId, info)
    return info
  } catch {
    return null
  }
}

/** Get prices for multiple cards from local cache (with in-memory layer) */
export async function getLocalPrices(cardIds: string[]): Promise<Map<string, PriceInfo>> {
  const result = new Map<string, PriceInfo>()
  const missing: string[] = []

  // Check memory first
  for (const id of cardIds) {
    const mem = _priceMemCache.get(id)
    if (mem) {
      result.set(id, mem)
    } else {
      missing.push(id)
    }
  }

  if (missing.length === 0) return result

  try {
    const all = await db.cardPrices.where('cardId').anyOf(missing).toArray()
    for (const p of all) {
      const info: PriceInfo = {
        cardId: p.cardId,
        market: p.marketPrice,
        low: p.lowPrice,
        high: p.highPrice,
        source: p.source,
        updatedAt: p.lastUpdated,
      }
      result.set(p.cardId, info)
      _priceMemCache.set(p.cardId, info)
    }
  } catch {
    // ignore errors, return what we have
  }
  return result
}

/** Save prices to local Dexie cache */
async function saveLocalPrices(prices: CardPrice[]): Promise<void> {
  try {
    await db.cardPrices.bulkPut(prices)
  } catch (e) {
    console.warn('[Pricing] Failed to save local prices:', e)
  }
}

// ─── Cloud Cache ──────────────────────────────────────────

/** Get prices from Supabase cloud cache */
export async function getCloudPrices(cardIds: string[]): Promise<Map<string, PriceInfo>> {
  const result = new Map<string, PriceInfo>()
  if (!isSupabaseReady()) return result

  try {
    // Supabase IN filter has a limit, batch in chunks of 100
    for (let i = 0; i < cardIds.length; i += 100) {
      const chunk = cardIds.slice(i, i + 100)
      const { data } = await supabase
        .from('card_prices')
        .select('card_id, market_price, low_price, high_price, source, last_updated')
        .in('card_id', chunk)

      if (data) {
        for (const row of data) {
          result.set(row.card_id, {
            cardId: row.card_id,
            market: row.market_price,
            low: row.low_price,
            high: row.high_price,
            source: row.source || 'cloud',
            updatedAt: new Date(row.last_updated).getTime(),
          })
        }
      }
    }
  } catch (e) {
    console.warn('[Pricing] Failed to fetch cloud prices:', e)
  }

  return result
}

/** Save prices to Supabase cloud cache */
export async function saveCloudPrices(prices: PriceInfo[]): Promise<void> {
  if (!isSupabaseReady() || prices.length === 0) return

  try {
    const rows = prices.map(p => ({
      card_id: p.cardId,
      market_price: p.market,
      low_price: p.low,
      high_price: p.high,
      source: p.source,
      last_updated: new Date(p.updatedAt).toISOString(),
    }))
    await supabase.from('card_prices').upsert(rows)
  } catch (e) {
    console.warn('[Pricing] Failed to save cloud prices:', e)
  }
}

// ─── Main API ─────────────────────────────────────────────

function isCacheExpired(updatedAt: number): boolean {
  return Date.now() - updatedAt > PRICE_CACHE_TTL
}

/**
 * Get prices for a list of card IDs.
 * Checks local cache → cloud cache → returns what's available.
 */
export async function getPricesForCards(cardIds: string[]): Promise<Map<string, PriceInfo>> {
  const result = new Map<string, PriceInfo>()
  if (cardIds.length === 0) return result

  // 1. Check local cache
  const local = await getLocalPrices(cardIds)
  const missing: string[] = []

  for (const id of cardIds) {
    const cached = local.get(id)
    if (cached && !isCacheExpired(cached.updatedAt)) {
      result.set(id, cached)
    } else {
      missing.push(id)
    }
  }

  if (missing.length === 0) return result

  // 2. Check cloud cache for missing ones
  const cloud = await getCloudPrices(missing)
  const toSaveLocally: CardPrice[] = []

  for (const id of missing) {
    const cloudPrice = cloud.get(id)
    if (cloudPrice) {
      result.set(id, cloudPrice)
      toSaveLocally.push({
        cardId: id,
        marketPrice: cloudPrice.market,
        lowPrice: cloudPrice.low,
        highPrice: cloudPrice.high,
        source: cloudPrice.source,
        lastUpdated: cloudPrice.updatedAt,
      })
    }
  }

  // Save cloud prices to local cache
  if (toSaveLocally.length > 0) {
    saveLocalPrices(toSaveLocally).catch(() => {})
  }

  return result
}

/**
 * Set price manually for a card (crowd-sourced pricing).
 * Saves to both local and cloud.
 */
export async function setCardPrice(
  cardId: string,
  market: number | null,
  low?: number | null,
  high?: number | null,
): Promise<void> {
  const now = Date.now()
  const price: CardPrice = {
    cardId,
    marketPrice: market,
    lowPrice: low ?? null,
    highPrice: high ?? null,
    source: 'manual',
    lastUpdated: now,
  }

  await saveLocalPrices([price])
  await saveCloudPrices([{
    cardId,
    market,
    low: low ?? null,
    high: high ?? null,
    source: 'manual',
    updatedAt: now,
  }])
}

/**
 * Pull all prices from cloud and save locally (for initial sync).
 */
export async function pullAllPricesFromCloud(): Promise<number> {
  if (!isSupabaseReady()) return 0

  try {
    const { data } = await supabase
      .from('card_prices')
      .select('card_id, market_price, low_price, high_price, source, last_updated')

    if (!data || data.length === 0) return 0

    const localPrices: CardPrice[] = data.map(row => ({
      cardId: row.card_id,
      marketPrice: row.market_price,
      lowPrice: row.low_price,
      highPrice: row.high_price,
      source: row.source || 'cloud',
      lastUpdated: new Date(row.last_updated).getTime(),
    }))

    await saveLocalPrices(localPrices)
    return localPrices.length
  } catch (e) {
    console.warn('[Pricing] Failed to pull all prices from cloud:', e)
    return 0
  }
}

// ─── TCGPlayer Price Fetching (via tcgcsv.com) ──────────

const SWU_CATEGORY_ID = 79

/** Map our set codes to tcgcsv.com group IDs */
const SET_GROUP_MAP: Record<string, number> = {
  SOR: 23405,  // Spark of Rebellion
  SHD: 23488,  // Shadows of the Galaxy
  TWI: 23597,  // Twilight of the Republic
  JTL: 23956,  // Jump to Lightspeed
  LOF: 24279,  // Legends of the Force (tentative)
  SOP: 24387,  // Secrets of Power (tentative)
  ALT: 24572,  // A Lawless Time (tentative)
}

interface TCGProduct {
  productId: number
  name: string
  cleanName: string
  groupId: number
}

interface TCGPrice {
  productId: number
  marketPrice: number | null
  lowPrice: number | null
  highPrice: number | null
  subTypeName: string
}

/**
 * Normalize a card name for fuzzy matching.
 * Removes accents, punctuation, extra spaces, lowercases.
 */
function normalizeName(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Fetch prices from tcgcsv.com for cards in a specific set.
 * Returns a map of our cardId → PriceInfo.
 */
async function fetchSetPrices(
  groupId: number,
  cardsInSet: { id: string; name: string; subtitle: string | null }[],
): Promise<PriceInfo[]> {
  const results: PriceInfo[] = []

  try {
    // 1. Fetch products for this set group
    const prodResp = await fetch(
      `https://tcgcsv.com/tcgplayer/${SWU_CATEGORY_ID}/${groupId}/products`,
    )
    if (!prodResp.ok) return results
    const prodData = await prodResp.json()
    const products: TCGProduct[] = prodData.results || prodData || []

    // 2. Fetch prices for this set group
    const priceResp = await fetch(
      `https://tcgcsv.com/tcgplayer/${SWU_CATEGORY_ID}/${groupId}/prices`,
    )
    if (!priceResp.ok) return results
    const priceData = await priceResp.json()
    const prices: TCGPrice[] = priceData.results || priceData || []

    // 3. Build product name → price map (prefer "Normal" subtype)
    const priceByProductId = new Map<number, TCGPrice>()
    for (const p of prices) {
      const existing = priceByProductId.get(p.productId)
      // Prefer Normal over Foil/Hyperspace
      if (!existing || p.subTypeName === 'Normal') {
        priceByProductId.set(p.productId, p)
      }
    }

    // 4. Build normalized product name → { productId, cleanName }
    const prodByName = new Map<string, TCGProduct>()
    for (const prod of products) {
      const key = normalizeName(prod.cleanName || prod.name)
      prodByName.set(key, prod)
    }

    // 5. Match our cards to products by name
    for (const card of cardsInSet) {
      // Try exact name match first
      let matchKey = normalizeName(card.name)
      let prod = prodByName.get(matchKey)

      // Try with subtitle: "Name - Subtitle"
      if (!prod && card.subtitle) {
        matchKey = normalizeName(`${card.name} ${card.subtitle}`)
        prod = prodByName.get(matchKey)
      }

      if (prod) {
        const price = priceByProductId.get(prod.productId)
        if (price) {
          results.push({
            cardId: card.id,
            market: price.marketPrice,
            low: price.lowPrice,
            high: price.highPrice,
            source: 'tcgplayer',
            updatedAt: Date.now(),
          })
        }
      }
    }
  } catch (e) {
    console.warn(`[Pricing] Failed to fetch TCGPlayer prices for group ${groupId}:`, e)
  }

  return results
}

/**
 * Fetch and cache prices for a list of cards from tcgcsv.com (TCGPlayer).
 * Groups cards by set, fetches prices per set, saves to local + cloud cache.
 * Returns the number of prices fetched.
 *
 * @param cards - Array of { id, name, subtitle, setCode } for cards to price
 * @param onProgress - Optional callback (setCode, fetched, total)
 */
export async function fetchTCGPrices(
  cards: { id: string; name: string; subtitle: string | null; setCode: string }[],
  onProgress?: (setCode: string, fetched: number, total: number) => void,
): Promise<number> {
  // Group cards by setCode
  const bySet = new Map<string, typeof cards>()
  for (const c of cards) {
    const group = bySet.get(c.setCode) || []
    group.push(c)
    bySet.set(c.setCode, group)
  }

  let totalFetched = 0
  const totalSets = bySet.size
  let setsProcessed = 0

  for (const [setCode, setCards] of bySet) {
    const groupId = SET_GROUP_MAP[setCode]
    if (!groupId) {
      setsProcessed++
      continue
    }

    const prices = await fetchSetPrices(groupId, setCards)
    totalFetched += prices.length

    // Save to local cache
    if (prices.length > 0) {
      const localPrices: CardPrice[] = prices.map(p => ({
        cardId: p.cardId,
        marketPrice: p.market,
        lowPrice: p.low,
        highPrice: p.high,
        source: p.source,
        lastUpdated: p.updatedAt,
      }))
      await saveLocalPrices(localPrices)

      // Update memory cache
      for (const p of prices) {
        _priceMemCache.set(p.cardId, p)
      }

      // Save to cloud
      saveCloudPrices(prices).catch(() => {})
    }

    setsProcessed++
    onProgress?.(setCode, totalFetched, totalSets)
  }

  return totalFetched
}

/**
 * Format price for display.
 */
export function formatPrice(price: number | null | undefined): string {
  if (price == null || price === 0) return '—'
  return `$${price.toFixed(2)}`
}

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

export interface PriceInfo {
  cardId: string
  market: number | null
  low: number | null
  high: number | null
  source: string
  updatedAt: number
}

// ─── Local Cache ──────────────────────────────────────────

/** Get price from local Dexie cache */
export async function getLocalPrice(cardId: string): Promise<PriceInfo | null> {
  try {
    const cached = await db.cardPrices.get(cardId)
    if (!cached) return null
    return {
      cardId: cached.cardId,
      market: cached.marketPrice,
      low: cached.lowPrice,
      high: cached.highPrice,
      source: cached.source,
      updatedAt: cached.lastUpdated,
    }
  } catch {
    return null
  }
}

/** Get prices for multiple cards from local cache */
export async function getLocalPrices(cardIds: string[]): Promise<Map<string, PriceInfo>> {
  const result = new Map<string, PriceInfo>()
  try {
    const all = await db.cardPrices.where('cardId').anyOf(cardIds).toArray()
    for (const p of all) {
      result.set(p.cardId, {
        cardId: p.cardId,
        market: p.marketPrice,
        low: p.lowPrice,
        high: p.highPrice,
        source: p.source,
        updatedAt: p.lastUpdated,
      })
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

/**
 * Format price for display.
 */
export function formatPrice(price: number | null | undefined): string {
  if (price == null || price === 0) return '—'
  return `$${price.toFixed(2)}`
}

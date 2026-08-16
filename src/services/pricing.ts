/**
 * Card Pricing Service
 * Fetches, caches and serves card prices for Star Wars: Unlimited.
 *
 * Strategy:
 * 1. Check local cache (Dexie cardPrices table) — instant, works offline
 * 2. Check cloud cache (Supabase card_prices table) — shared across users
 * 3. If both miss or expired (>7 days), fetch from TCGPlayer via tcgcsv.com
 *
 * Source: TCGPlayer prices via tcgcsv.com (free bulk API)
 * Matching: Multi-strategy (name, name+subtitle, set number, partial name)
 */

import { db, type CardPrice, type PriceVariant } from './db'
import { supabase, isSupabaseReady } from './supabase'

const PRICE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

// In-memory price cache to avoid repeated Dexie lookups
const _priceMemCache = new Map<string, PriceInfo>()

export type { PriceVariant }

export interface PriceInfo {
  cardId: string
  market: number | null   // Normal market price
  mid: number | null      // Mid price (≈ Most Recent Sale)
  low: number | null
  high: number | null
  directLow: number | null
  source: string
  updatedAt: number
  /** Price variants by subtype: Normal, Foil, Hyperspace, etc. */
  variants?: Record<string, PriceVariant>
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
      mid: cached.midPrice ?? null,
      low: cached.lowPrice,
      high: cached.highPrice,
      directLow: cached.directLowPrice ?? null,
      source: cached.source,
      updatedAt: cached.lastUpdated,
      variants: cached.variants ? JSON.parse(cached.variants) : undefined,
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
        mid: p.midPrice ?? null,
        low: p.lowPrice,
        high: p.highPrice,
        directLow: p.directLowPrice ?? null,
        source: p.source,
        updatedAt: p.lastUpdated,
        variants: p.variants ? JSON.parse(p.variants) : undefined,
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
      // `error` se tiene que mirar a mano: supabase-js NO lanza excepción ante
      // un error de PostgREST, así que el try/catch de abajo nunca se activaba
      // y un fallo se veía igual que "no hay precios en la nube". Así estuvo
      // rota la caché compartida sin que nadie lo notara.
      const { data, error } = await supabase
        .from('card_prices')
        .select('card_id, market_price, mid_price, low_price, high_price, direct_low_price, source, last_updated, variants')
        .in('card_id', chunk)

      if (error) {
        console.warn('[Pricing] getCloudPrices:', error.message)
        break
      }

      if (data) {
        for (const row of data) {
          result.set(row.card_id, {
            cardId: row.card_id,
            market: row.market_price,
            mid: row.mid_price ?? null,
            low: row.low_price,
            high: row.high_price,
            directLow: row.direct_low_price ?? null,
            source: row.source || 'cloud',
            updatedAt: new Date(row.last_updated).getTime(),
            variants: row.variants ? (typeof row.variants === 'string' ? JSON.parse(row.variants) : row.variants) : undefined,
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
      mid_price: p.mid,
      low_price: p.low,
      high_price: p.high,
      direct_low_price: p.directLow,
      source: p.source,
      last_updated: new Date(p.updatedAt).toISOString(),
      variants: p.variants ? JSON.stringify(p.variants) : null,
    }))
    const { error } = await supabase.from('card_prices').upsert(rows)
    if (error) console.warn('[Pricing] saveCloudPrices:', error.message)
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
        midPrice: cloudPrice.mid,
        lowPrice: cloudPrice.low,
        highPrice: cloudPrice.high,
        directLowPrice: cloudPrice.directLow,
        source: cloudPrice.source,
        lastUpdated: cloudPrice.updatedAt,
        // Sin esto, el desglose por subtipo (Normal/Foil/Hyperspace) se perdía
        // al bajar un precio de la nube a la caché local.
        variants: cloudPrice.variants ? JSON.stringify(cloudPrice.variants) : undefined,
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
    midPrice: null,
    lowPrice: low ?? null,
    highPrice: high ?? null,
    directLowPrice: null,
    source: 'manual',
    lastUpdated: now,
  }

  await saveLocalPrices([price])
  await saveCloudPrices([{
    cardId,
    market,
    mid: null,
    low: low ?? null,
    high: high ?? null,
    directLow: null,
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
    const { data, error } = await supabase
      .from('card_prices')
      .select('card_id, market_price, mid_price, low_price, high_price, direct_low_price, source, last_updated')

    if (error) {
      console.warn('[Pricing] pullAllPricesFromCloud:', error.message)
      return 0
    }
    if (!data || data.length === 0) return 0

    const localPrices: CardPrice[] = data.map(row => ({
      cardId: row.card_id,
      marketPrice: row.market_price,
      midPrice: row.mid_price ?? null,
      lowPrice: row.low_price,
      highPrice: row.high_price,
      directLowPrice: row.direct_low_price ?? null,
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

// La categoría (79 = SWU) ahora la fija el proxy en api/tcg-prices.ts, que es
// donde se arma la URL real. Acá ya no hace falta.

/**
 * Nuestros códigos de set → group IDs de tcgcsv.com.
 *
 * OJO: las claves tienen que ser el `setCode` que devuelve api.swuapi.com,
 * porque es con eso que se busca acá (`SET_GROUP_MAP[setCode]`). Estaban
 * escritas 'SOP' y 'ALT' — siglas inventadas de "Secrets Of Power" y
 * "A Lawless Time" que no existen ni en swuapi ni en TCGplayer. Como un set
 * que no está en el mapa se salta en SILENCIO (`if (!groupId) continue`, sin
 * warn ni error), SEC y LAW nunca recibieron precio y nadie lo notó. ASH
 * directamente faltaba.
 *
 * Los groupId ya eran correctos; solo estaban bajo la clave equivocada.
 * Verificado contra https://tcgcsv.com/tcgplayer/79/groups, cuyas
 * abreviaturas oficiales son justamente SEC (24387), LAW (24572) y ASH (24660).
 *
 * Impacto: 3,041 cartas (SEC 1,197 + ASH 931 + LAW 913) pasan de no tener
 * precio a tenerlo — el 33.6% de la base, y los sets que se están comprando hoy.
 */
const SET_GROUP_MAP: Record<string, number> = {
  SOR: 23405,  // Spark of Rebellion
  SHD: 23488,  // Shadows of the Galaxy
  TWI: 23597,  // Twilight of the Republic
  JTL: 23956,  // Jump to Lightspeed
  LOF: 24279,  // Legends of the Force
  SEC: 24387,  // Secrets of Power
  LAW: 24572,  // A Lawless Time
  ASH: 24660,  // Ashes of the Empire
  TS26: 24622, // Twin Suns
}

interface TCGProduct {
  productId: number
  name: string
  cleanName: string
  groupId: number
}

interface TCGPrice {
  productId: number
  lowPrice: number | null
  midPrice: number | null
  highPrice: number | null
  marketPrice: number | null
  directLowPrice: number | null
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
 * Extract the card number from a TCGPlayer product name.
 * TCGPlayer often appends " - 123" or " (123/250)" etc.
 */
function extractTCGNumber(prodName: string): string | null {
  // Match patterns like "- 042" or "- 42/252" at end
  const dashMatch = prodName.match(/[-–]\s*0*(\d+)(?:\s*\/\s*\d+)?\s*$/)
  if (dashMatch) return dashMatch[1]
  // Match "(042/252)" or "(42)"
  const parenMatch = prodName.match(/\(0*(\d+)(?:\s*\/\s*\d+)?\)\s*$/)
  if (parenMatch) return parenMatch[1]
  return null
}

/**
 * Fetch prices from tcgcsv.com for cards in a specific set.
 * Uses multi-strategy matching: name, name+subtitle, card number.
 * Returns a map of our cardId → PriceInfo.
 */
async function fetchSetPrices(
  groupId: number,
  cardsInSet: { id: string; name: string; subtitle: string | null; setNumber?: string | number }[],
): Promise<PriceInfo[]> {
  const results: PriceInfo[] = []

  try {
    // 1. Fetch products for this set group
    // Vía /api/tcg-prices y NO directo a tcgcsv.com: ese origen responde 200
    // pero no manda cabecera CORS, así que desde el navegador daba
    // "Failed to fetch". Por eso los precios nunca funcionaron para ningún
    // set y card_prices quedó en 0 filas desde su creación.
    const prodResp = await fetch(`/api/tcg-prices?group=${groupId}&resource=products`)
    if (!prodResp.ok) return results
    const prodData = await prodResp.json()
    const products: TCGProduct[] = prodData.results || prodData || []

    // 2. Fetch prices for this set group
    const priceResp = await fetch(`/api/tcg-prices?group=${groupId}&resource=prices`)
    if (!priceResp.ok) return results
    const priceData = await priceResp.json()
    const prices: TCGPrice[] = priceData.results || priceData || []

    // 3. Build product → ALL price subtypes map
    const allPricesByProductId = new Map<number, TCGPrice[]>()
    for (const p of prices) {
      const list = allPricesByProductId.get(p.productId) || []
      list.push(p)
      allPricesByProductId.set(p.productId, list)
    }

    // 4. Build multiple lookup maps for better matching
    const prodByName = new Map<string, TCGProduct>()
    const prodByNumber = new Map<string, TCGProduct>()
    const prodByPartialName = new Map<string, TCGProduct[]>()
    for (const prod of products) {
      const key = normalizeName(prod.cleanName || prod.name)
      prodByName.set(key, prod)

      // Extract card number from product name for number-based matching
      const num = extractTCGNumber(prod.name)
      if (num) prodByNumber.set(num, prod)

      // Build partial name index (first 2+ words) for fuzzy matching
      const words = key.split(' ')
      if (words.length >= 2) {
        const partial = words.slice(0, 2).join(' ')
        const list = prodByPartialName.get(partial) || []
        list.push(prod)
        prodByPartialName.set(partial, list)
      }
    }

    // 5. Match our cards to products using multiple strategies
    for (const card of cardsInSet) {
      let prod: TCGProduct | undefined

      // Strategy 1: Exact normalized name
      const nameKey = normalizeName(card.name)
      prod = prodByName.get(nameKey)

      // Strategy 2: Name + Subtitle (TCGPlayer often uses "Name - Subtitle")
      if (!prod && card.subtitle) {
        prod = prodByName.get(normalizeName(`${card.name} ${card.subtitle}`))
      }

      // Strategy 3: Match by card set number (most reliable for edge cases)
      if (!prod && card.setNumber) {
        const cardNum = String(Number(card.setNumber)) // strip leading zeros
        prod = prodByNumber.get(cardNum)
      }

      // Strategy 4: Partial name match (first 2 words + subtitle check)
      if (!prod) {
        const words = nameKey.split(' ')
        if (words.length >= 2) {
          const partial = words.slice(0, 2).join(' ')
          const candidates = prodByPartialName.get(partial)
          if (candidates && candidates.length === 1) {
            prod = candidates[0] // unambiguous partial match
          } else if (candidates && card.subtitle) {
            // Disambiguate with subtitle
            const subKey = normalizeName(card.subtitle)
            prod = candidates.find(c => normalizeName(c.cleanName || c.name).includes(subKey))
          }
        }
      }

      if (prod) {
        const prodPrices = allPricesByProductId.get(prod.productId)
        if (prodPrices && prodPrices.length > 0) {
          // Build variants map from all subtypes
          const variants: Record<string, PriceVariant> = {}
          let normalPrice: TCGPrice | undefined

          for (const pp of prodPrices) {
            const subName = pp.subTypeName || 'Normal'
            variants[subName] = {
              market: pp.marketPrice,
              mid: pp.midPrice,
              low: pp.lowPrice,
              high: pp.highPrice,
              directLow: pp.directLowPrice,
            }
            if (subName === 'Normal') normalPrice = pp
          }

          // Use Normal as primary, fall back to first available
          const primary = normalPrice || prodPrices[0]

          results.push({
            cardId: card.id,
            market: primary.marketPrice,
            mid: primary.midPrice,
            low: primary.lowPrice,
            high: primary.highPrice,
            directLow: primary.directLowPrice,
            source: 'tcgplayer',
            updatedAt: Date.now(),
            variants: Object.keys(variants).length > 1 ? variants : undefined,
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
  cards: { id: string; name: string; subtitle: string | null; setCode: string; setNumber?: string | number }[],
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

  for (const [setCode, setCards] of bySet) {
    const groupId = SET_GROUP_MAP[setCode]
    if (!groupId) {
      // Antes esto era silencio absoluto: por eso SEC/LAW/ASH quedaron sin
      // precio durante meses sin que apareciera ninguna señal.
      console.warn(`[Pricing] Sin grupo de TCGPlayer para el set "${setCode}" (${setCards.length} cartas sin precio)`)
      continue
    }

    const prices = await fetchSetPrices(groupId, setCards)
    totalFetched += prices.length

    // Save to local cache
    if (prices.length > 0) {
      const localPrices: CardPrice[] = prices.map(p => ({
        cardId: p.cardId,
        marketPrice: p.market,
        midPrice: p.mid,
        lowPrice: p.low,
        highPrice: p.high,
        directLowPrice: p.directLow,
        source: p.source,
        variants: p.variants ? JSON.stringify(p.variants) : undefined,
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

/**
 * El precio de referencia que se MUESTRA: el promedio entre el más bajo y el
 * más alto de TCGplayer.
 *
 * Antes se mostraba el `market` (el precio al que se vende de verdad), que en
 * SWU suele quedar pegado al piso y se leía como «el más barato». Pedido de
 * Nel: mostrar el punto medio entre `low` y `high`, que refleja mejor cuánto
 * vale una carta y no solo la oferta más agresiva.
 *
 * Cuidado con el sesgo: si `high` es un anuncio disparatado (alguien lista una
 * común a $999) el promedio se infla. Por eso, cuando existe `market`, se usa
 * como TECHO del `high` que entra al promedio — un anuncio muy por encima del
 * mercado real no arrastra la referencia. Si no hay `low` o `high`, se cae a lo
 * de siempre: market → mid → lo que haya.
 */
/** Núcleo del promedio, sobre los campos crudos. Lo usan tanto el precio base
 *  como cada variante (foil/hyperspace), que tienen los mismos campos. */
function promedioDe(
  low: number | null, high: number | null, market: number | null, mid: number | null,
): number | null {
  if (low != null && high != null) {
    let h = high
    // Recorta el `high` a lo sumo al doble del `market` real, para que un
    // outlier no distorsione. Si no hay market, se usa el high tal cual.
    if (market != null && market > 0) h = Math.min(h, market * 2)
    // Nunca por debajo del piso real: el promedio recortado podría quedar
    // apenas bajo `low` en casos raros.
    return Math.max((low + h) / 2, low)
  }
  return market ?? mid ?? low ?? high ?? null
}

export function precioPromedio(p: PriceInfo | null | undefined): number | null {
  if (!p) return null
  return promedioDe(p.low, p.high, p.market, p.mid)
}

/**
 * El precio promedio PARA UNA IMPRESIÓN concreta: normal, foil o hyperspace.
 *
 * TCGplayer separa el precio por subtipo (`variants`): la misma carta vale muy
 * distinto en Normal que en Foil o Hyperspace. Con el modificador, el precio
 * aproximado de un mazo se acerca al real según cómo lo tenga armado la persona.
 *
 * Si la carta no tiene esa variante (una común quizá solo existe Normal), se cae
 * al precio base — no se inventa un recargo.
 */
export function precioVariante(
  p: PriceInfo | null | undefined,
  variante: 'normal' | 'foil' | 'hyperspace',
): number | null {
  if (!p) return null
  if (variante !== 'normal' && p.variants) {
    const entrada = Object.entries(p.variants).find(([clave]) =>
      variante === 'hyperspace'
        ? /hyperspace/i.test(clave)
        // «Foil» a secas, no «Hyperspace Foil» — esa es hyperspace.
        : /foil/i.test(clave) && !/hyperspace/i.test(clave),
    )
    if (entrada) {
      const v = entrada[1]
      const prom = promedioDe(v.low, v.high, v.market, v.mid)
      if (prom != null) return prom
    }
  }
  return precioPromedio(p)
}

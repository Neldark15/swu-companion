/**
 * Collection Import Service
 * Parses collection exports from swudb.com and other SWU tools.
 *
 * Supported formats:
 * 1. SWUDB CSV:  Set,CardNumber,Count,IsFoil
 *    Example:    SOR,001,2,FALSE
 *
 * 2. SWUDB JSON: Array of { Set, CardNumber, Count, IsFoil } or deck JSON
 *
 * 3. Generic CSV: Any CSV with columns matching set/number/quantity patterns
 *
 * 4. Plain text:  "2x SOR 001" or "SOR_001 x2" style lines
 */

import { db } from './db'
import { supabase, isSupabaseReady } from './supabase'
import { loadFullDatabase } from './swuApi'

export interface ImportedCard {
  setCode: string
  cardNumber: number
  quantity: number
  isFoil: boolean
}

export interface ImportResult {
  total: number
  matched: number
  added: number
  updated: number
  notFound: string[]
  errors: string[]
}

// ─── File Reading ────────────────────────────────────────

/** Read file as text */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsText(file)
  })
}

// ─── SWUDB → API Set Code Mapping ───────────────────────
// SWUDB uses different set codes than the swuapi.com API for many sub-sets.
// This maps SWUDB codes to their API equivalents.

/** Direct alias: SWUDB code → API code (when the same cards exist under a different code) */
const SWUDB_SET_ALIASES: Record<string, string> = {
  // Convention exclusives
  CE24: 'C24', CE25: 'C25',
  // Gamegenic
  GGTS: 'GG',
  // A Lawless Time (SWUDB uses ALT sometimes)
  ALT: 'LAW',
}

/**
 * Extract the base set code from a SWUDB variant code.
 * SWUDB appends suffixes for sub-sets:
 *   OP = Organized Play, PR = Prerelease Promos, SH = Store Showdown,
 *   PQ = Planetary Qualifier, P = Weekly Play (some sets)
 *   T prefix = Tokens (TSOR, TSHD, TTWI, TJTL, TLOF, TSEC, TLAW)
 *   EE24 / GC23 = Event promos (special cases)
 */
function getBaseSetCode(code: string): string | null {
  // Special event promo codes → parent set
  const eventPromoMap: Record<string, string> = {
    EE24: 'SHD', GC23: 'SOR',
  }
  if (eventPromoMap[code]) return eventPromoMap[code]

  // Token sets: T prefix + base code (TSOR→SOR, TSHD→SHD, TTWI→TWI, etc.)
  if (/^T[A-Z]{2,4}$/.test(code) && code.length >= 4) {
    return code.slice(1)
  }

  // Suffix-based variants: strip OP, PR, SH, PQ from end
  const suffixMatch = code.match(/^([A-Z]{2,4})(OP|PR|SH|PQ)$/)
  if (suffixMatch) return suffixMatch[1]

  // Weekly Play suffix: LAWP→LAW (but JTLP, SECP, LOFP exist in API so don't strip those)
  // Only strip P if the resulting base is a known main set
  const knownMainSets = ['SOR', 'SHD', 'TWI', 'JTL', 'LOF', 'SEC', 'LAW']
  if (code.endsWith('P') && code.length >= 4) {
    const base = code.slice(0, -1)
    if (knownMainSets.includes(base)) return base
  }

  return null
}

// ─── Parsers ─────────────────────────────────────────────

/** Normalize set code: uppercase, trim, apply alias mapping */
function normalizeSetCode(raw: string): string {
  const code = raw.trim().toUpperCase()
  return SWUDB_SET_ALIASES[code] || code
}

/** Parse card number: remove leading zeros, handle "001" → 1 */
function parseCardNumber(raw: string): number {
  return parseInt(raw.trim().replace(/^0+/, ''), 10) || 0
}

/**
 * Parse SWUDB-style CSV: Set,CardNumber,Count,IsFoil
 * Also handles variations with different column names/order.
 */
function parseCSV(text: string): ImportedCard[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const results: ImportedCard[] = []

  // Detect header
  const header = lines[0].toLowerCase().replace(/['"]/g, '')
  const cols = header.split(',').map(c => c.trim())

  // Find column indices by matching patterns
  const setIdx = cols.findIndex(c => /^(set|set_?code|expansion)$/i.test(c))
  const numIdx = cols.findIndex(c => /^(card_?number|number|card_?num|cardno|#)$/i.test(c))
  const countIdx = cols.findIndex(c => /^(count|quantity|qty|copies|amount)$/i.test(c))
  const foilIdx = cols.findIndex(c => /^(is_?foil|foil|variant)$/i.test(c))

  // If no header detected, try fixed positions (Set,CardNumber,Count,IsFoil)
  const hasHeader = setIdx >= 0 || numIdx >= 0
  const startLine = hasHeader ? 1 : 0

  const si = setIdx >= 0 ? setIdx : 0
  const ni = numIdx >= 0 ? numIdx : 1
  const ci = countIdx >= 0 ? countIdx : 2
  const fi = foilIdx >= 0 ? foilIdx : 3

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const parts = line.split(',').map(p => p.trim().replace(/^['"]|['"]$/g, ''))
    if (parts.length < 2) continue

    const setCode = normalizeSetCode(parts[si] || '')
    const cardNumber = parseCardNumber(parts[ni] || '')
    const quantity = parseInt(parts[ci] || '1', 10) || 1
    const isFoil = /^(true|yes|1|foil)$/i.test(parts[fi] || '')

    if (setCode && cardNumber > 0) {
      results.push({ setCode, cardNumber, quantity, isFoil })
    }
  }

  return results
}

/**
 * Parse JSON format:
 * - Array: [{ Set: "SOR", CardNumber: "001", Count: 2, IsFoil: false }]
 * - SWUDB deck: { cards: [...], leader: {...}, base: {...} }
 */
function parseJSON(text: string): ImportedCard[] {
  try {
    const data = JSON.parse(text)
    const results: ImportedCard[] = []

    // If it's an array, parse each item
    const items: Record<string, unknown>[] = Array.isArray(data) ? data
      : data.cards ? [...(data.cards || []), ...(data.leader ? [data.leader] : []), ...(data.base ? [data.base] : [])]
      : []

    for (const item of items) {
      // Try various key names
      const setCode = normalizeSetCode(
        String(item.Set || item.set || item.setCode || item.set_code || item.expansion || ''),
      )
      const cardNumber = parseCardNumber(
        String(item.CardNumber || item.cardNumber || item.card_number || item.number || item.cardNo || ''),
      )
      const quantity = parseInt(
        String(item.Count || item.count || item.quantity || item.qty || item.copies || '1'), 10,
      ) || 1
      const isFoil = Boolean(item.IsFoil || item.isFoil || item.is_foil || item.foil)

      if (setCode && cardNumber > 0) {
        results.push({ setCode, cardNumber, quantity, isFoil })
      }
    }

    return results
  } catch {
    return []
  }
}

/**
 * Parse plain text format (line by line):
 * "2x SOR 001", "SOR 001 x2", "SOR_001 2", "2 SOR-001"
 */
function parsePlainText(text: string): ImportedCard[] {
  const lines = text.trim().split(/\r?\n/)
  const results: ImportedCard[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue

    // Pattern: optional quantity, set code, card number
    // "2x SOR 001" | "SOR 001 x2" | "SOR_001" | "2 SOR-001"
    const match = trimmed.match(
      /^(?:(\d+)\s*x?\s+)?([A-Za-z]{2,5})[\s_\-]?(\d{1,4})(?:\s*x?\s*(\d+))?/i,
    )

    if (match) {
      const qty1 = parseInt(match[1] || '0', 10)
      const setCode = normalizeSetCode(match[2])
      const cardNumber = parseCardNumber(match[3])
      const qty2 = parseInt(match[4] || '0', 10)
      const quantity = qty1 || qty2 || 1

      if (setCode && cardNumber > 0) {
        results.push({ setCode, cardNumber, quantity, isFoil: false })
      }
    }
  }

  return results
}

// ─── Main Import Logic ───────────────────────────────────

/** Detect format and parse file */
export function parseCollectionFile(text: string, filename: string): ImportedCard[] {
  const lower = filename.toLowerCase()

  // JSON file
  if (lower.endsWith('.json') || text.trimStart().startsWith('[') || text.trimStart().startsWith('{')) {
    const jsonResult = parseJSON(text)
    if (jsonResult.length > 0) return jsonResult
  }

  // CSV file
  if (lower.endsWith('.csv') || text.includes(',')) {
    const csvResult = parseCSV(text)
    if (csvResult.length > 0) return csvResult
  }

  // Plain text fallback
  return parsePlainText(text)
}

/**
 * Import parsed cards into the user's collection.
 * Matches set code + card number to find actual card IDs in our database.
 * Merges quantities with existing collection (adds to current count).
 */
export async function importToCollection(
  cards: ImportedCard[],
  userId?: string,
  mode: 'merge' | 'replace' = 'merge',
  onProgress?: (processed: number, total: number) => void,
  profileId?: string,
): Promise<ImportResult> {
  const result: ImportResult = {
    total: cards.length,
    matched: 0,
    added: 0,
    updated: 0,
    notFound: [],
    errors: [],
  }

  if (cards.length === 0) return result

  // If replace mode, clear existing collection first
  if (mode === 'replace') {
    try {
      // Only clear cards for the current profile, not the entire table
      if (profileId) {
        const toDelete = await db.collection.where('profileId').equals(profileId).primaryKeys()
        await db.collection.bulkDelete(toDelete)
      } else {
        await db.collection.clear()
      }
      if (userId && isSupabaseReady()) {
        await supabase.from('collection').delete().eq('user_id', userId)
      }
    } catch (e) {
      result.errors.push('Error al limpiar colección existente')
    }
  }

  // Group by setCode+cardNumber to consolidate duplicates
  const consolidated = new Map<string, ImportedCard>()
  for (const card of cards) {
    const key = `${card.setCode}_${card.cardNumber}`
    const existing = consolidated.get(key)
    if (existing) {
      existing.quantity += card.quantity
    } else {
      consolidated.set(key, { ...card })
    }
  }

  // Ensure local card database is loaded before matching
  onProgress?.(0, consolidated.size)
  try {
    await loadFullDatabase()
  } catch {
    // If full DB load fails, we'll still try with whatever we have locally
  }

  // Look up card IDs from our local Dexie cards table
  const allCards = await db.cards.toArray()
  const cardLookup = new Map<string, string>() // "SOR_1" → cardId

  for (const c of allCards) {
    const key = `${c.setCode}_${c.setNumber}`
    cardLookup.set(key, c.id)
  }

  // Helper: try to find card locally by set+number
  function tryLocalLookup(set: string, num: number): string | null {
    const key = `${set}_${num}`
    return cardLookup.get(key) ?? null
  }

  // Resolve card ID: try exact set code, then try base set code (strip SWUDB variant suffixes)
  function resolveCardId(setCode: string, cardNumber: number): string | null {
    // 1. Try exact set code (already normalized via alias map)
    const local = tryLocalLookup(setCode, cardNumber)
    if (local) return local

    // 2. Try with base set code (strip SWUDB variant suffixes like OP, PR, SH, PQ, tokens)
    const baseSet = getBaseSetCode(setCode)
    if (baseSet && baseSet !== setCode) {
      const localBase = tryLocalLookup(baseSet, cardNumber)
      if (localBase) return localBase
    }

    return null
  }

  // Process each consolidated card
  let processed = 0
  const batchCloud: { user_id: string; card_id: string; quantity: number }[] = []

  for (const [, card] of consolidated) {
    const cardId = resolveCardId(card.setCode, card.cardNumber)

    if (!cardId) {
      result.notFound.push(`${card.setCode} #${String(card.cardNumber).padStart(3, '0')}`)
      processed++
      onProgress?.(processed, consolidated.size)
      continue
    }

    result.matched++

    try {
      if (mode === 'merge') {
        // Get existing quantity and add — filter by profileId if present
        const existing = profileId
          ? await db.collection.where({ cardId, profileId }).first() as { quantity?: number } | undefined
          : await db.collection.get(cardId) as { quantity?: number } | undefined
        const newQty = (existing?.quantity ?? 0) + card.quantity

        await db.collection.put({ cardId, quantity: newQty, ...(profileId ? { profileId } : {}) })

        if (userId && isSupabaseReady()) {
          batchCloud.push({ user_id: userId, card_id: cardId, quantity: newQty })
        }

        if (existing) {
          result.updated++
        } else {
          result.added++
        }
      } else {
        // Replace mode: just set the quantity
        await db.collection.put({ cardId, quantity: card.quantity, ...(profileId ? { profileId } : {}) })

        if (userId && isSupabaseReady()) {
          batchCloud.push({ user_id: userId, card_id: cardId, quantity: card.quantity })
        }
        result.added++
      }
    } catch (e) {
      result.errors.push(`Error con ${card.setCode} #${card.cardNumber}: ${e}`)
    }

    processed++
    if (processed % 20 === 0) {
      onProgress?.(processed, consolidated.size)
    }
  }

  // Batch sync to cloud
  if (batchCloud.length > 0 && userId && isSupabaseReady()) {
    try {
      // Upsert in chunks of 100
      for (let i = 0; i < batchCloud.length; i += 100) {
        const chunk = batchCloud.slice(i, i + 100)
        await supabase.from('collection').upsert(chunk)
      }
    } catch (e) {
      result.errors.push('Error al sincronizar con la nube')
    }
  }

  onProgress?.(consolidated.size, consolidated.size)
  return result
}

/**
 * Parse and import a File object in one step.
 */
export async function importCollectionFromFile(
  file: File,
  userId?: string,
  mode: 'merge' | 'replace' = 'merge',
  onProgress?: (processed: number, total: number) => void,
  profileId?: string,
): Promise<ImportResult> {
  const text = await readFileAsText(file)
  const cards = parseCollectionFile(text, file.name)

  if (cards.length === 0) {
    return {
      total: 0, matched: 0, added: 0, updated: 0,
      notFound: [],
      errors: ['No se encontraron cartas válidas en el archivo. Verifique el formato (CSV, JSON o texto).'],
    }
  }

  return importToCollection(cards, userId, mode, onProgress, profileId)
}

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
import { compareCardsCanonical } from './cardSort'
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
    // The API renamed this field at some point — accept both spellings
    card_count?: number
    total_cards?: number
    release_date: string | null
  }[]
}

/**
 * Human-readable labels for the MAIN expansions (used by set filters across
 * the app). Promos/weekly-play/judge sets are excluded on purpose — they're
 * identified dynamically by cardCount < MAIN_SET_MIN_CARDS.
 */
export const MAIN_SET_LABELS: Record<string, string> = {
  SOR: 'Spark of Rebellion',
  SHD: 'Shadows of the Galaxy',
  TWI: 'Twilight of the Republic',
  JTL: 'Jump to Lightspeed',
  LOF: 'Legends of the Force',
  SEC: 'Secrets of Power',
  LAW: 'A Lawless Time',
  ASH: 'Ashes of the Empire',
}

/** Threshold that separates main expansions (~900-1200 cards incl. variants) from promos. */
export const MAIN_SET_MIN_CARDS = 500

/** El último chip de coste es "7+": agrupa todo de 7 para arriba. */
export const COST_MAX_BUCKET = 7

/** Un mazo legal admite 3 copias; más que eso es una repetida real. */
export const PLAYSET_SIZE = 3

/**
 * Picks the first defined value from a list. Used to handle the API field
 * variants (snake/camel, old/new). Returns the fallback if none defined.
 */
function pick<T>(vals: Array<T | null | undefined>, fallback: T): T {
  for (const v of vals) if (v !== undefined && v !== null) return v
  return fallback
}

/**
 * Orden de preferencia entre impresiones de una misma carta. Cuando varias
 * comparten el id heredado `SET_NNN`, la primera de esta lista es la que se
 * queda con ese id — es la impresión "de juego", la que un jugador
 * realmente tiene y la que las colecciones viejas querían referenciar.
 */
const VARIANT_PRIORITY = [
  'Standard', 'Standard Foil', 'Hyperspace', 'Hyperspace Foil',
  'Standard Prestige', 'Foil Prestige', 'Serialized Prestige',
  'Weekly Play', 'Weekly Play Foil',
]

function variantRank(c: ApiCard): number {
  const v = (c.variant_type ?? c.variantType ?? 'Standard') as string
  const i = VARIANT_PRIORITY.indexOf(v)
  return i === -1 ? VARIANT_PRIORITY.length : i
}

/**
 * Normaliza texto para buscar: minúsculas, sin acentos y sin apóstrofes.
 *
 * El índice de cartas viene en inglés crudo mientras la app está en español,
 * así que "padme" no encontraba a Padmé Amidala ni "imwe" a Chirrut Îmwe.
 * Se aplica a AMBOS lados (índice y consulta), de modo que escribir con o sin
 * acento funciona igual.
 */
export function normalizeSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // marcas diacríticas
    .replace(/['’ʼ]/g, '')            // apóstrofes rectos y tipográficos
    .toLowerCase()
    .trim()
}

/** Texto sobre el que corre la búsqueda local, precalculado al ingerir. */
function buildSearchBlob(c: Card): string {
  return normalizeSearch(
    [c.name, c.subtitle ?? '', c.text, ...c.traits, ...c.keywords].join(' '),
  )
}

function mapApiCard(c: ApiCard): Card {
  // El UUID es la identidad real: único y estable entre endpoints.
  //
  // El campo `id` del API (`SOR_001`) NO es único — el mismo valor apunta a
  // varias impresiones e incluso a cartas distintas (SOR_001 son SEIS cartas:
  // Director Krennic, Darth Vader promo, Takedown…). Usarlo como clave hacía
  // que Dexie sobrescribiera 1,465 de las 9,057 cartas. Se conserva como
  // `legacyId` para resolver referencias guardadas antes de este cambio.
  const uuid = (c.uuid ?? c.id ?? '') as string
  const id = uuid
  const legacyId = typeof c.id === 'string' && c.id !== uuid ? c.id : undefined

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
    legacyId,
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
    variantType: (c.variant_type ?? c.variantType ?? undefined) as string | undefined,
  }
}

/** Validate that a mapped card has the minimum required fields to be cached. */
function isValidCard(c: Card): boolean {
  return Boolean(c.id) && Boolean(c.name) && Boolean(c.setCode)
}

/** Sin dato de variante se asume la normal — nunca se esconde una carta. */
function isStandardPrinting(c: Card): boolean {
  return (c.variantType ?? 'Standard') === 'Standard'
}

function cardVariantRank(c: Card): number {
  const i = VARIANT_PRIORITY.indexOf(c.variantType ?? 'Standard')
  return i === -1 ? VARIANT_PRIORITY.length : i
}

/**
 * Marca qué impresión REPRESENTA a cada carta, para que el buscador pueda
 * mostrar una fila por carta en vez de una por impresión.
 *
 * Medido sobre las 9,057 filas del export:
 * - 2,314 son 'Standard' → canónicas.
 * - De los 309 grupos sin ninguna Standard, 307 ya existen como Standard en un
 *   set principal (son promos de una carta que ya está); solo 2 son cartas
 *   genuinamente exclusivas y esas rescatan su mejor impresión.
 * → 2,316 canónicas (25.6%), y CERO cartas de los 8 sets principales quedan
 *   sin representante.
 *
 * El agrupamiento es por (nombre, subtítulo) a nivel global y no por set, para
 * que una promo no se cuele como carta aparte de la que ya existe.
 */
function markCanonical(cards: Card[]): Card[] {
  const key = (c: Card) => `${c.name} ${c.subtitle ?? ''}`

  const hasStandard = new Set<string>()
  for (const c of cards) if (isStandardPrinting(c)) hasStandard.add(key(c))

  const rescued = new Map<string, Card>()
  for (const c of cards) {
    const k = key(c)
    if (hasStandard.has(k)) continue
    const prev = rescued.get(k)
    // Desempate estable: rango de variante, luego set y número.
    if (
      !prev ||
      cardVariantRank(c) < cardVariantRank(prev) ||
      (cardVariantRank(c) === cardVariantRank(prev) &&
        `${c.setCode}${String(c.setNumber).padStart(4, '0')}` <
          `${prev.setCode}${String(prev.setNumber).padStart(4, '0')}`)
    ) {
      rescued.set(k, c)
    }
  }

  return cards.map(c => ({
    ...c,
    isCanonical: isStandardPrinting(c) || rescued.get(key(c))?.id === c.id,
    searchBlob: buildSearchBlob(c),
  }))
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
  /**
   * Mostrar solo la impresión que representa a cada carta (por defecto).
   * En falso salen las 9,057 filas con todas las variantes.
   */
  canonicalOnly?: boolean
  /** Cruce con la colección del usuario: qué tengo, qué me falta, repetidas. */
  owned?: OwnedFilter
  /** Mapa cardId → cantidad. Lo pasa la pantalla; el servicio no lee la colección. */
  ownedQuantities?: Map<string, number>
  /**
   * Solo estas cartas (favoritos del dispositivo). Tiene que filtrarse ACÁ y
   * no en la pantalla: recortando después de paginar, "Mis favoritas" solo
   * miraba las 30 filas de la primera página y el total quedaba mal.
   */
  favoriteIds?: Set<string>
}

/** Estados del cruce con la colección. */
export type OwnedFilter = 'all' | 'owned' | 'missing' | 'duplicates'

/**
 * Cuántas copias tiene el usuario de esta carta y BAJO QUÉ CLAVE están guardadas.
 *
 * Las colecciones creadas antes de la migración a uuid guardaron el id
 * heredado (`SOR_001`). Leer solo por uuid hacía que la fila mostrara 0
 * aunque la carta estuviera en la colección — y peor: al tocar "+" se
 * escribía una fila NUEVA bajo el uuid, dejando la carta duplicada con dos
 * claves distintas. Por eso hay que devolver también la clave: se escribe
 * sobre la que ya existe.
 */
export function collectionEntry(c: Card, qtys: Map<string, number>): { qty: number; key: string } {
  const byUuid = qtys.get(c.id)
  if (byUuid !== undefined) return { qty: byUuid, key: c.id }
  if (c.legacyId) {
    const byLegacy = qtys.get(c.legacyId)
    if (byLegacy !== undefined) return { qty: byLegacy, key: c.legacyId }
  }
  return { qty: 0, key: c.id }
}

// ─── Cache helpers ───

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

/**
 * Forma de los datos guardados. Se sube cuando el ingesta empieza a calcular
 * un campo nuevo (acá: `isCanonical` y `searchBlob`), para que las cachés
 * viejas se reconstruyan solas sin tener que tocar el esquema de Dexie ni
 * borrarle nada al usuario.
 */
const DB_DATA_VERSION = 3
const LS_DATA_VERSION = 'swu_db_data_version'
const LS_EXPECTED_TOTAL = 'swu_db_expected_total'

function readLS(key: string): number {
  try { return Number(localStorage.getItem(key) || 0) } catch { return 0 }
}

/**
 * Espejo en memoria del sello. Sin esto, un navegador que no puede ESCRIBIR
 * en localStorage (modo privado de Safari, cuota llena) nunca vería el sello
 * recién guardado: `isDatabaseComplete()` daría false para siempre y CADA
 * búsqueda re-descargaría los 10 MB del catálogo.
 */
let _sealMemory: { version: number; expected: number } | null = null

/**
 * ¿La base local está COMPLETA y con la forma actual?
 *
 * El control anterior era `count < 2000`, así que una descarga abortada en
 * 4,500 cartas lo pasaba y el buscador mostraba media base con un contador
 * que se veía honesto. Ahora se compara contra el total que la última carga
 * exitosa dijo haber guardado.
 */
export async function isDatabaseComplete(): Promise<boolean> {
  const version = _sealMemory?.version ?? readLS(LS_DATA_VERSION)
  const expected = _sealMemory?.expected ?? readLS(LS_EXPECTED_TOTAL)
  if (version !== DB_DATA_VERSION) return false
  if (expected <= 0) return false
  const count = await db.cards.count()
  return count >= expected
}

export async function loadFullDatabase(opts?: { force?: boolean }): Promise<number> {
  const force = opts?.force ?? false
  if (!force && _dbReady) return db.cards.count()
  if (_dbLoadPromise) return _dbLoadPromise

  _dbLoadPromise = (async () => {
    try {
      const existing = await db.cards.count()
      const complete = await isDatabaseComplete()
      if (!force && complete && existing > 5000) {
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

      // Ordenar por prioridad de variante ANTES de mapear: así, cuando
      // varias impresiones comparten el mismo `legacyId`, la canónica
      // (Standard) es la primera y se queda con él.
      const ordered = [...rawCards].sort((a, b) => variantRank(a) - variantRank(b))
      const seenLegacy = new Set<string>()
      const mapped = ordered
        .map(mapApiCard)
        .filter(isValidCard)
        .map(card => {
          if (!card.legacyId) return card
          if (seenLegacy.has(card.legacyId)) {
            // Otra impresión ya reclamó este id heredado — esta lo suelta
            // para que el índice `legacyId` resuelva a una sola carta.
            return { ...card, legacyId: undefined }
          }
          seenLegacy.add(card.legacyId)
          return card
        })

      if (mapped.length === 0) {
        emitProgress({ phase: 'error', message: 'Las cartas recibidas no tienen formato válido', error: 'No valid cards' })
        return existing
      }

      // Se calcula UNA vez, acá, qué impresión representa a cada carta y el
      // texto normalizado de búsqueda. Hacerlo por consulta costaría recorrer
      // 9,057 cartas en cada tecla.
      const enriched = markCanonical(mapped)

      // ── Phase 3: save in chunks ──
      const chunkSize = 500
      const totalToSave = enriched.length
      let saved = 0
      // Si un chunk falla al escribir, la base queda incompleta: NO se puede
      // sellar como buena o el centinela quedaría mintiendo igual que antes.
      let writeFailed = false
      for (let i = 0; i < totalToSave; i += chunkSize) {
        const chunk = enriched.slice(i, i + chunkSize)
        await db.cards.bulkPut(chunk).catch(() => { writeFailed = true })
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

      if (writeFailed || finalCount < totalToSave) {
        // Sin sello: la próxima apertura vuelve a intentar en vez de servir
        // media base con un contador que se ve honesto.
        emitProgress({
          phase: 'error',
          message: `Se guardaron ${finalCount} de ${totalToSave} cartas`,
          error: 'Escritura incompleta en IndexedDB',
        })
        return finalCount
      }

      // Sello de completitud: cuántas cartas DEBERÍA haber y con qué forma se
      // guardaron. Sin esto, una descarga cortada a la mitad dejaba una base
      // parcial que el control viejo (`< 2000`) daba por buena.
      _sealMemory = { version: DB_DATA_VERSION, expected: totalToSave }
      try {
        localStorage.setItem('swu_db_last_sync', String(Date.now()))
        localStorage.setItem(LS_EXPECTED_TOTAL, String(totalToSave))
        localStorage.setItem(LS_DATA_VERSION, String(DB_DATA_VERSION))
      } catch { /* modo privado — queda el espejo en memoria */ }
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

// ─── Freshness ───────────────────────────────────────────────

const DB_SYNC_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 1 semana

/**
 * Garantiza que la base local exista y no esté vieja.
 * - Cache vacía/escasa (< 2000) → descarga completa (bloquea hasta terminar
 *   si `await`eás; los llamadores UI suelen hacerlo void + banner de progreso).
 * - Cache poblada pero sin sync hace > 7 días → re-descarga en background
 *   (así las expansiones nuevas — p.ej. Ashes of the Empire — aparecen solas).
 *
 * Llamar al montar las pantallas que dependen de la base (Cartas, DeckBuilder).
 */
export async function ensureFreshDatabase(): Promise<number> {
  const count = await db.cards.count()
  // Incompleta o con forma vieja → se reconstruye BLOQUEANDO. El buscador
  // ahora depende de esta base como única fuente de verdad, así que no puede
  // servir resultados sobre media base.
  if (!(await isDatabaseComplete())) {
    return loadFullDatabase({ force: true })
  }
  const last = readLS('swu_db_last_sync')
  if (Date.now() - last > DB_SYNC_MAX_AGE_MS) {
    // Refresh en background — el usuario sigue trabajando con la cache actual
    void loadFullDatabase({ force: true })
  }
  return count
}

// ─── Hybrid Search ───

/**
 * Busca cartas SIEMPRE contra la base local.
 *
 * Antes había una ruta al API para el modo "explorar" (sin texto escrito), y
 * mentía de dos formas al mismo tiempo:
 *
 * 1. El API ignora por completo aspecto, arena y coste — verificado: la
 *    respuesta de `/cards?aspect=Vigilance` es BYTE A BYTE idéntica a la de
 *    `/cards` sin filtro, e incluso acepta valores inventados sin error. Esos
 *    filtros se aplicaban en el cliente sobre la página de 30 ya traída, pero
 *    el total que se mostraba era el del API: la pantalla decía "9,057 cartas
 *    encontradas" con 3 filas debajo.
 * 2. "Cargar más" mandaba como offset la cantidad de cartas YA filtradas, así
 *    que volvía a pedir cartas ya vistas: filas duplicadas y orden en sierra.
 *
 * Localmente se resuelve todo — aspecto, arena, coste, keyword, trait — sobre
 * las 9,057 cartas que ya están en el teléfono, el contador coincide con las
 * filas y la paginación es sobre el resultado ya ordenado.
 */
export async function searchCards(params: SearchParams): Promise<{ cards: Card[]; total: number }> {
  // NO se espera a `_dbLoadPromise` acá. El refresco semanal corre en segundo
  // plano con la base YA completa: esperarlo dejaba el buscador congelado
  // hasta 90 s mostrando cartas que ya estaban listas para servir.
  // Si la base está incompleta, `loadFullDatabase` se engancha a la descarga
  // en curso en vez de arrancar otra, así que la espera sigue cubierta.
  if (!(await isDatabaseComplete())) {
    await loadFullDatabase({ force: true })
  }

  return searchLocalCards(params)
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

  // Una fila por carta, salvo que se pidan todas las impresiones.
  // `isCanonical === undefined` son cartas de una caché vieja: se dejan pasar
  // en vez de esconderlas mientras se reconstruye la base.
  if (params.canonicalOnly !== false) {
    results = results.filter(c => c.isCanonical !== false)
  }

  // Text search filter (name, subtitle, text, traits, keywords)
  if (params.query) {
    // Se normalizan los DOS lados, así "padme" encuentra a Padmé Amidala y
    // "imwe" a Chirrut Îmwe — que antes devolvían cero.
    const words = normalizeSearch(params.query).split(/\s+/).filter(Boolean)
    if (words.length > 0) {
      results = results.filter((c) => {
        const blob = c.searchBlob ?? buildSearchBlob(c)
        return words.every(w => blob.includes(w))
      })
    }
  }

  // Additional filters
  if (params.aspect) {
    results = results.filter((c) => c.aspects.includes(params.aspect!))
  }
  if (params.arena) {
    results = results.filter((c) => c.arena === params.arena)
  }
  if (params.cost !== undefined && params.cost !== null) {
    // El chip de coste más alto es "7+": agrupa todo de 7 para arriba.
    const cost = params.cost
    results = cost >= COST_MAX_BUCKET
      ? results.filter((c) => c.cost !== null && c.cost >= COST_MAX_BUCKET)
      : results.filter((c) => c.cost === cost)
  }
  if (params.keyword) {
    results = results.filter((c) => c.keywords.includes(params.keyword!))
  }
  if (params.trait) {
    results = results.filter((c) => c.traits.includes(params.trait!))
  }
  // La rareza NO puede quedarse solo en la rama indexada de arriba: ese
  // if/else es mutuamente excluyente, así que con un set o un tipo elegido
  // la rama `else if (params.rarity)` nunca se alcanzaba y el filtro se
  // ignoraba en silencio. Acá es idempotente cuando ya vino por índice.
  if (params.rarity) {
    results = results.filter((c) => c.rarity === params.rarity)
  }
  // Favoritos: se resuelve por uuid y también por el id heredado.
  if (params.favoriteIds && params.favoriteIds.size > 0) {
    const favs = params.favoriteIds
    results = results.filter(c => favs.has(c.id) || (c.legacyId ? favs.has(c.legacyId) : false))
  }

  // Cruce con la colección: "qué tengo", "qué me falta", "cuáles repetidas".
  // La cantidad se resuelve por uuid y también por el id heredado, porque las
  // colecciones viejas guardaron referencias con formato `SOR_001`.
  if (params.owned && params.owned !== 'all' && params.ownedQuantities) {
    const qtys = params.ownedQuantities
    const qtyOf = (c: Card) => collectionEntry(c, qtys).qty
    if (params.owned === 'owned') results = results.filter(c => qtyOf(c) > 0)
    else if (params.owned === 'missing') results = results.filter(c => qtyOf(c) === 0)
    else if (params.owned === 'duplicates') results = results.filter(c => qtyOf(c) > PLAYSET_SIZE)
  }

  // Sort: Leaders first → Bases second → then by setCode + setNumber
  // Orden de binder: Líderes → Bases → Unidades → Mejoras → Eventos,
  // por aspecto, set de lanzamiento y número de carta.
  results.sort(compareCardsCanonical)

  const total = results.length
  const offset = params.offset ?? 0
  const limit = params.limit ?? 50
  const paged = results.slice(offset, offset + limit)

  return { cards: paged, total }
}

// ─── In-memory card cache (avoids repeated Dexie lookups) ───

const _cardMemCache = new Map<string, Card>()

// ─── Single card ───

/** ¿Es un id heredado con formato `SET_NNN` (y no un uuid)? */
function isLegacyId(id: string): boolean {
  return /^[A-Z0-9]{2,5}_\d+$/.test(id)
}

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

  // 2b. Referencia vieja (`SOR_001`) guardada en una colección o mazo de
  // antes del cambio a uuid: se resuelve por el índice legacyId.
  if (isLegacyId(id)) {
    const byLegacy = await db.cards.where('legacyId').equals(id).first()
    if (byLegacy) {
      _cardMemCache.set(id, byLegacy)
      return byLegacy
    }
  }

  // 3. Network fallback. The API has historically returned different shapes
  // for this endpoint — sometimes wrapped as { card: {...} } and sometimes the
  // card object directly at the root. Handle both.
  try {
    const res = await fetch(`${API_BASE}/cards/${id}?format=json`)
    if (res.ok) {
      const data = await res.json() as ApiCard | { card?: ApiCard }
      const raw: ApiCard | undefined = 'card' in data && data.card
        ? (data.card as ApiCard)
        : (data as ApiCard)
      // A valid raw response must have at least an id/uuid + name
      if (raw && (raw.id || raw.uuid) && raw.name) {
        const mapped = mapApiCard(raw)
        // Se le calcula el blob de búsqueda para que quede igual que las que
        // entran por la carga completa. `isCanonical` se deja sin definir a
        // propósito: una carta pedida por id siempre se muestra.
        const card: Card = { ...mapped, searchBlob: buildSearchBlob(mapped) }
        if (card.id) {
          _cardMemCache.set(id, card)
          await db.cards.put(card).catch(() => {})
          return card
        }
      }
    }
  } catch {
    // no-op
  }

  return null
}

/**
 * Batch load multiple cards at once.
 *
 * Strategy (optimized for perf):
 * 1. Hit memory cache
 * 2. Single Dexie batch query for what's left
 * 3. For misses: if many (> BULK_THRESHOLD), download the full DB in one
 *    request (5 MB / ~12s) instead of N individual HTTP requests. Then
 *    re-query Dexie for the missing IDs.
 * 4. For small misses: fall back to per-card HTTP in concurrent chunks.
 */
const BULK_FALLBACK_THRESHOLD = 30

export async function getCardsByIds(ids: string[]): Promise<Map<string, Card>> {
  const result = new Map<string, Card>()
  if (ids.length === 0) return result

  // 1. Memory cache
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

  // 2. Dexie batch query
  let notInLocal: string[] = []
  try {
    const cards = await db.cards.where('id').anyOf(missing).toArray()
    const foundIds = new Set<string>()
    for (const card of cards) {
      _cardMemCache.set(card.id, card)
      result.set(card.id, card)
      foundIds.add(card.id)
    }
    for (const id of missing) if (!foundIds.has(id)) notInLocal.push(id)
  } catch {
    for (const id of missing) if (!result.has(id)) notInLocal.push(id)
  }

  // 2b. Los que quedan y tienen formato viejo (`SOR_001`) se resuelven por
  // el índice legacyId — colecciones y mazos guardados antes del uuid.
  const legacyPending = notInLocal.filter(isLegacyId)
  if (legacyPending.length > 0) {
    try {
      const byLegacy = await db.cards.where('legacyId').anyOf(legacyPending).toArray()
      const resolved = new Set<string>()
      for (const card of byLegacy) {
        if (!card.legacyId) continue
        // Se indexa bajo el id con el que preguntaron, para que el llamador
        // encuentre lo que pidió.
        _cardMemCache.set(card.legacyId, card)
        result.set(card.legacyId, card)
        resolved.add(card.legacyId)
      }
      if (resolved.size > 0) notInLocal = notInLocal.filter(id => !resolved.has(id))
    } catch {
      // sigue al fallback de red
    }
  }

  if (notInLocal.length === 0) return result

  // 3. Bulk fallback: if many cards are missing, download the full DB once
  //    (~5 MB / ~12s) — much faster than N sequential HTTPs
  if (notInLocal.length >= BULK_FALLBACK_THRESHOLD) {
    try {
      await loadFullDatabase()
      // Retry from Dexie now that the full DB is loaded — por uuid y por
      // legacyId, que es como vienen las referencias de colecciones viejas.
      const [retryCards, retryLegacy] = await Promise.all([
        db.cards.where('id').anyOf(notInLocal).toArray(),
        db.cards.where('legacyId').anyOf(notInLocal.filter(isLegacyId)).toArray(),
      ])
      const foundIds = new Set<string>()
      for (const card of retryCards) {
        _cardMemCache.set(card.id, card)
        result.set(card.id, card)
        foundIds.add(card.id)
      }
      for (const card of retryLegacy) {
        if (!card.legacyId) continue
        _cardMemCache.set(card.legacyId, card)
        result.set(card.legacyId, card)
        foundIds.add(card.legacyId)
      }
      notInLocal = notInLocal.filter(id => !foundIds.has(id))
    } catch {
      // loadFullDatabase failed — fall through to per-card fetches
    }
    if (notInLocal.length === 0) return result
  }

  // 4. Per-card HTTP fallback for the few remaining
  const CHUNK = 8
  for (let i = 0; i < notInLocal.length; i += CHUNK) {
    await Promise.all(
      notInLocal.slice(i, i + CHUNK).map(async (id) => {
        const card = await getCardById(id)
        if (card) result.set(id, card)
      }),
    )
  }

  return result
}

// ─── Sets ───

let _setsCache: SetInfo[] | null = null

export async function getSets(): Promise<SetInfo[]> {
  if (_setsCache) return _setsCache
  try {
    const res = await fetch(`${API_BASE}/sets?format=json`)
    if (!res.ok) throw new Error(`API ${res.status}`)
    const data: ApiSetResponse = await res.json()
    const sets = data.sets
      .map((s) => ({
        code: s.code,
        name: s.name,
        // API renamed card_count → total_cards; accept both
        cardCount: s.total_cards ?? s.card_count ?? 0,
        releaseDate: s.release_date || '',
      }))
      // Main sets first (newest-by-created last in API, so keep stable order:
      // big sets by our known chronology, then the rest alphabetically)
      .sort((a, b) => {
        const mainOrder = Object.keys(MAIN_SET_LABELS)
        const ia = mainOrder.indexOf(a.code)
        const ib = mainOrder.indexOf(b.code)
        if (ia !== -1 && ib !== -1) return ia - ib
        if (ia !== -1) return -1
        if (ib !== -1) return 1
        return a.code.localeCompare(b.code)
      })
    _setsCache = sets
    return sets
  } catch {
    // Offline fallback: the 8 main expansions with correct codes
    return Object.entries(MAIN_SET_LABELS).map(([code, name]) => ({
      code,
      name,
      cardCount: 1000,
      releaseDate: '',
    }))
  }
}

/** Only the main expansions (excludes promos/weekly-play/judge sets). */
export async function getMainSets(): Promise<SetInfo[]> {
  const sets = await getSets()
  return sets.filter(s => s.cardCount >= MAIN_SET_MIN_CARDS)
}

// ─── Preload (optional — user can trigger manually) ───

export async function preloadSet(_setCode: string): Promise<number> {
  return loadFullDatabase()
}

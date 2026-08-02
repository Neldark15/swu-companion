/**
 * tournamentsService — últimos torneos y sus tops, desde SWU Competitive Hub.
 *
 * Los datos vienen por `/api/swu-events` (proxy propio; el sitio sirve HTML,
 * no una API). Acá se hacen tres cosas que el proxy no puede hacer:
 *
 * 1. Cachear en el navegador, para no consultar en cada visita.
 * 2. Mapear los nombres ajenos a NUESTRAS cartas, y así mostrar nuestra propia
 *    imagen en vez de hotlinkear las del sitio de otro.
 * 3. Agregar el conteo de títulos, que es lo que convierte una lista de
 *    torneos en una lectura del meta.
 *
 * ── Lo que este módulo NO afirma, a propósito ─────────────────────────
 *
 * - Un título NO es cuota de meta. Contamos torneos GANADOS, que es lo único
 *   que la lista publica. Cuántos jugaron cada mazo no está en la fuente, así
 *   que no se estima.
 * - La mitad de las «bases» que publica la fuente no son cartas sino CLASES
 *   («Blue», «Red Force», «Blue 27hp Multiaspect»): agrupan bases
 *   funcionalmente idénticas. Para esas mostramos un representante y lo
 *   rotulamos como clase; decir el nombre de una carta concreta sería
 *   inventar cuál de catorce se jugó.
 * - Los torneos que no publicaron mazo ganador (19 de 165 al escribir esto)
 *   se muestran como «sin publicar», nunca rellenados.
 */

import { db } from './db'
import { normalizeSearch, loadFullDatabase } from './swuApi'
import type { Card } from '../types'

export interface HubTournament {
  slug: string
  name: string
  date: string
  level: string
  country: string
  players: number
  set: string
  leader: string | null
  base: string | null
}

export interface HubStanding {
  place: number
  player: string
  leader: string | null
  base: string | null
  decklistUrl: string | null
}

export interface HubSource {
  name: string
  url: string
}

export type HubRange = '3' | '6'
export type HubCategory = 'todas' | 'premier' | 'limited' | 'eternal'

export const SOURCE: HubSource = {
  name: 'SWU Competitive Hub',
  url: 'https://www.swu-competitivehub.com',
}

// ─── Caché en el navegador ────────────────────────────────────────────

/** Subir esto invalida lo guardado si cambia la forma de los datos. */
const CACHE_VERSION = 1
const TTL = 6 * 60 * 60 * 1000 // igual que la CDN: la fuente se actualiza a mano, día a día

interface Cached<T> { data: T; at: number; fresh: boolean }

/**
 * Devuelve también lo VENCIDO, marcado como tal. Un dato de ayer sirve para
 * decidir qué llevar a un torneo; un mensaje de error, no. Quien llama decide
 * si lo usa directo (fresco) o solo como red de contención si falla la
 * consulta (vencido).
 */
function readCache<T>(key: string): Cached<T> | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { v, at, data } = JSON.parse(raw) as { v: number; at: number; data: T }
    if (v !== CACHE_VERSION) return null
    return { data, at, fresh: Date.now() - at <= TTL }
  } catch {
    return null
  }
}

function writeCache(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify({ v: CACHE_VERSION, at: Date.now(), data }))
  } catch {
    // Cuota llena o modo privado: la caché es un lujo, no un requisito.
  }
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) {
    let msg = `error ${res.status}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body?.error) msg = body.error
    } catch { /* el cuerpo puede no ser JSON */ }
    throw new Error(msg)
  }
  return res.json()
}

export interface TournamentsResult {
  tournaments: HubTournament[]
  /** Momento del dato. Null = recién traído. Se usa para avisar que está viejo. */
  cachedAt: number | null
}

/** Últimos torneos. `force` salta la caché (botón de recargar). */
export async function getTournaments(
  range: HubRange,
  category: HubCategory,
  force = false,
): Promise<TournamentsResult> {
  const key = `swu_hub_list_${range}_${category}`
  const hit = readCache<HubTournament[]>(key)
  if (!force && hit?.fresh) return { tournaments: hit.data, cachedAt: null }

  try {
    const data = (await getJson(`/api/swu-events?mode=lista&range=${range}&category=${category}`)) as {
      tournaments?: HubTournament[]
    }
    const list = data.tournaments ?? []
    writeCache(key, list)
    return { tournaments: list, cachedAt: null }
  } catch (e) {
    // Sin red pero con algo guardado, se muestra lo viejo diciendo que es viejo.
    if (hit) return { tournaments: hit.data, cachedAt: hit.at }
    throw e
  }
}

/** Top de un torneo. Se pide solo cuando alguien lo abre. */
export async function getStandings(slug: string): Promise<HubStanding[]> {
  const key = `swu_hub_ev_${slug}`
  const hit = readCache<HubStanding[]>(key)
  // Un torneo que ya terminó no cambia, así que un top guardado sirve aunque
  // haya vencido el plazo. Pero un top VACÍO no es una verdad que valga la
  // pena congelar: significa «todavía no lo publicaron», y si se guardara ese
  // torneo quedaría sin top de por vida en ese dispositivo.
  if (hit && hit.data.length > 0) return hit.data

  const data = (await getJson(`/api/swu-events?mode=evento&slug=${encodeURIComponent(slug)}`)) as {
    standings?: HubStanding[]
  }
  const list = data.standings ?? []
  if (list.length > 0) writeCache(key, list)
  return list
}

// ─── Mapeo de nombres ajenos a nuestras cartas ────────────────────────

/**
 * Aspecto de cada color, tal como los nombra la fuente. Verificado contra
 * nuestras propias cartas: no es una convención inventada acá.
 */
const COLOR_ASPECT: Record<string, string> = {
  blue: 'Vigilance',
  green: 'Command',
  red: 'Aggression',
  yellow: 'Cunning',
  white: 'Heroism',
  black: 'Villainy',
}

/** Abreviaturas que usa la fuente y no son el nombre de la carta. */
const BASE_ALIAS: Record<string, string> = {
  ecl: 'energy conversion lab',
}

/** Del set más nuevo al más viejo: al elegir representante de una clase, gana
 *  el más reciente, que es el que la gente tiene en la mano. */
const SET_RECENCY = ['ASH', 'LAW', 'SEC', 'LOF', 'JTL', 'TWI', 'SHD', 'SOR']

const recency = (c: Card) => {
  const i = SET_RECENCY.indexOf(c.setCode)
  return i === -1 ? SET_RECENCY.length : i
}

/** Entre impresiones de la misma carta, la Standard manda. */
const printingRank = (c: Card) => (c.variantType === 'Standard' ? 0 : c.isCanonical ? 1 : 2)

function pickPrinting(cards: Card[]): Card | null {
  if (cards.length === 0) return null
  return [...cards].sort(
    (a, b) => printingRank(a) - printingRank(b) || recency(a) - recency(b) || a.setNumber - b.setNumber,
  )[0]
}

interface CardIndex {
  /** `nombre normalizado|SET` → impresiones. El par es único: 0 colisiones. */
  leaderByNameSet: Map<string, Card[]>
  leadersBySet: Map<string, Card[]>
  baseByName: Map<string, Card[]>
  bases: Card[]
}

function pushTo<K, V>(m: Map<K, V[]>, k: K, v: V): void {
  const cur = m.get(k)
  if (cur) cur.push(v)
  else m.set(k, [v])
}

const EMPTY_INDEX: CardIndex = {
  leaderByNameSet: new Map(), leadersBySet: new Map(), baseByName: new Map(), bases: [],
}

let indexPromise: Promise<CardIndex> | null = null
/** Cuántas cartas había cuando se construyó el índice memoizado. */
let indexBuiltFor = -1

/**
 * Índice de líderes y bases, memoizado pero NO congelado.
 *
 * Se re-valida contra el número de cartas en Dexie. Sin eso hay dos formas de
 * quedarse pegado, las dos reales: `/meta` es pública y no exige que la base
 * esté cargada, así que quien entra directo acá construiría un índice vacío;
 * y quien la tuviera desactualizada seguiría sin ver los líderes del set nuevo
 * aunque la base se completara en la misma sesión. Es el mismo centinela por
 * conteo que ya usa `collectionProgress`.
 */
async function getIndex(): Promise<CardIndex> {
  const total = await db.cards.count()
  if (total === 0) return EMPTY_INDEX
  if (indexPromise && indexBuiltFor === total) return indexPromise

  const attempt: Promise<CardIndex> = (async () => {
    const [leaders, bases] = await Promise.all([
      db.cards.where('type').equals('Leader').toArray(),
      db.cards.where('type').equals('Base').toArray(),
    ])
    if (leaders.length === 0) return EMPTY_INDEX

    const leaderByNameSet = new Map<string, Card[]>()
    const leadersBySet = new Map<string, Card[]>()
    for (const c of leaders) {
      pushTo(leaderByNameSet, `${normalizeSearch(c.name)}|${c.setCode}`, c)
      pushTo(leadersBySet, c.setCode, c)
    }

    const baseByName = new Map<string, Card[]>()
    for (const c of bases) pushTo(baseByName, normalizeSearch(c.name), c)

    return { leaderByNameSet, leadersBySet, baseByName, bases }
  })()

  indexPromise = attempt
  indexBuiltFor = total
  // Una promesa rechazada memoizada dejaría la sección rota hasta recargar.
  void attempt.catch(() => {
    if (indexPromise === attempt) { indexPromise = null; indexBuiltFor = -1 }
  })
  return attempt
}

/** «Boba Fett (JTL)» → nombre + set. */
function splitLeader(raw: string): { name: string; set: string } | null {
  const m = /^(.+?)\s*\(([A-Za-z0-9]{2,6})\)\s*$/.exec(raw.trim())
  return m ? { name: m[1].trim(), set: m[2].toUpperCase() } : null
}

function matchLeader(idx: CardIndex, raw: string): Card | null {
  const parsed = splitLeader(raw)
  if (!parsed) return null

  const exact = idx.leaderByNameSet.get(`${normalizeSearch(parsed.name)}|${parsed.set}`)
  if (exact) return pickPrinting(exact)

  // La fuente a veces abrevia («Sabine (SOR)» por «Sabine Wren»). Solo se
  // acepta si dentro del set queda UN candidato: adivinar entre varios pondría
  // el líder equivocado en pantalla.
  const q = normalizeSearch(parsed.name)
  const inSet = idx.leadersBySet.get(parsed.set) ?? []
  const seen = new Map<string, Card[]>()
  for (const c of inSet) {
    const n = normalizeSearch(c.name)
    if (n === q || n.startsWith(`${q} `) || q.startsWith(`${n} `)) {
      pushTo(seen, `${c.name}|${c.subtitle ?? ''}`, c)
    }
  }
  return seen.size === 1 ? pickPrinting([...seen.values()][0]) : null
}

export interface ResolvedBase {
  card: Card | null
  /** Rótulo a mostrar. Para una clase describe el grupo, no una carta. */
  label: string
  /** true = la fuente dio una CLASE de bases, y la carta es solo un ejemplo. */
  isClass: boolean
}

const CLASS_RE = /^(blue|green|red|yellow|white|black)(?:\s+(force)|\s+(\d+)hp\s+multiaspect)?$/i

const COLOR_ES: Record<string, string> = {
  blue: 'azul', green: 'verde', red: 'roja', yellow: 'amarilla',
  white: 'blanca', black: 'negra',
}

function matchBase(idx: CardIndex, raw: string): ResolvedBase {
  const trimmed = raw.trim()
  const norm = normalizeSearch(BASE_ALIAS[trimmed.toLowerCase()] ?? trimmed)

  const exact = idx.baseByName.get(norm)
  if (exact) return { card: pickPrinting(exact), label: trimmed, isClass: false }

  const m = CLASS_RE.exec(trimmed)
  if (m) {
    const color = m[1].toLowerCase()
    const aspect = COLOR_ASPECT[color]
    const isForce = !!m[2]
    const hp = m[3] ? parseInt(m[3], 10) : isForce ? 28 : 30

    const candidates = idx.bases.filter(c => {
      if (c.aspects.length !== 1 || c.aspects[0] !== aspect || c.hp !== hp) return false
      const t = c.text.toLowerCase()
      if (isForce) return t.includes('force is with you')
      if (m[3]) return t.includes('ignoring 1 of its')
      return t.trim() === ''
    })

    const es = COLOR_ES[color] ?? color
    const label = isForce
      ? `Base ${es} de la Fuerza`
      : m[3]
        ? `Base ${es} multiaspecto ${hp} PV`
        : `Base ${es} ${hp} PV`

    return { card: pickPrinting(candidates), label, isClass: true }
  }

  return { card: null, label: trimmed, isClass: false }
}

export interface ResolvedDeck {
  leaderRaw: string | null
  baseRaw: string | null
  leaderCard: Card | null
  base: ResolvedBase | null
  /** La fuente no publicó el mazo. No es un fallo de mapeo. */
  unpublished: boolean
}

/** Identidad estable de arquetipo: líder + base tal como los da la fuente. */
export function archetypeKey(leader: string | null, base: string | null): string | null {
  return leader ? `${leader} / ${base ?? '—'}` : null
}

export async function resolveDecks(
  entries: { leader: string | null; base: string | null }[],
): Promise<ResolvedDeck[]> {
  const idx = await getIndex()
  return entries.map(e => {
    if (!e.leader) {
      return { leaderRaw: null, baseRaw: null, leaderCard: null, base: null, unpublished: true }
    }
    return {
      leaderRaw: e.leader,
      baseRaw: e.base,
      leaderCard: matchLeader(idx, e.leader),
      base: e.base ? matchBase(idx, e.base) : null,
      unpublished: false,
    }
  })
}

// ─── Lectura del meta ─────────────────────────────────────────────────

export interface TitleCount {
  key: string
  leader: string
  base: string | null
  /** Torneos ganados. NO es cuota de meta: la fuente no publica cuántos lo jugaron. */
  titles: number
  /** Jugadores sumados de los torneos que ganó — da idea del peso del título. */
  players: number
  lastDate: string
}

/**
 * Cuenta títulos por arquetipo. Los torneos sin mazo publicado no entran ni
 * como cero ni repartidos: simplemente no se cuentan, y la UI dice cuántos son.
 */
export function countTitles(tournaments: HubTournament[]): TitleCount[] {
  const map = new Map<string, TitleCount>()
  for (const t of tournaments) {
    const key = archetypeKey(t.leader, t.base)
    if (!key || !t.leader) continue
    const cur = map.get(key)
    if (cur) {
      cur.titles += 1
      cur.players += t.players
      if (t.date > cur.lastDate) cur.lastDate = t.date
    } else {
      map.set(key, {
        key, leader: t.leader, base: t.base,
        titles: 1, players: t.players, lastDate: t.date,
      })
    }
  }
  return [...map.values()].sort(
    (a, b) => b.titles - a.titles || b.players - a.players || b.lastDate.localeCompare(a.lastDate),
  )
}

export const countUnpublished = (tournaments: HubTournament[]) =>
  tournaments.filter(t => !t.leader).length

// ─── Base de cartas ───────────────────────────────────────────────────

let cardsPromise: Promise<boolean> | null = null

/**
 * Baja la base de cartas si falta, para poder mostrar los líderes con NUESTRAS
 * imágenes en vez de hotlinkear las del sitio ajeno.
 *
 * Hace falta porque `/meta` es pública y ninguna otra pantalla de esa ruta la
 * carga: quien entra directo no vería ni una carta. Devuelve `true` solo si
 * hizo falta cargarla —así quien llama sabe si tiene que volver a mapear— y
 * nunca lanza: sin imágenes la pantalla sigue siendo útil.
 */
export function ensureCards(): Promise<boolean> {
  if (cardsPromise) return cardsPromise
  cardsPromise = (async () => {
    try {
      if ((await db.cards.count()) > 0) return false
      await loadFullDatabase()
      return (await db.cards.count()) > 0
    } catch {
      cardsPromise = null // que un fallo de red no lo deje descartado para siempre
      return false
    }
  })()
  return cardsPromise
}

/**
 * Orden canónico de cartas — HOLOCRON SWU
 *
 * Replica el orden en que el juego numera sus propios sets, que es el que
 * un jugador espera al hojear su colección o un binder:
 *
 *   Líderes → Bases → Unidades → Mejoras → Eventos → Tokens
 *
 * y dentro de cada tipo, por aspecto (Vigilancia, Mando, Agresión, Astucia,
 * luego Villanía, Heroísmo y por último Neutral), después por set en orden
 * de lanzamiento y finalmente por número de carta.
 *
 * Verificado contra la numeración real de SOR, LOF y ASH: el número de carta
 * ya codifica exactamente esta secuencia dentro de cada set.
 */

import type { Card } from '../types'

// ─── Sets en orden de lanzamiento ────────────────────────

const SET_ORDER = ['SOR', 'SHD', 'TWI', 'JTL', 'LOF', 'SEC', 'LAW', 'ASH']

/** Los sets principales van primero; promos y especiales después, alfabéticos. */
export function setRank(setCode: string): number {
  const i = SET_ORDER.indexOf(setCode)
  return i === -1 ? SET_ORDER.length : i
}

// ─── Tipos ───────────────────────────────────────────────

const TYPE_ORDER: Record<string, number> = {
  Leader: 0,
  Base: 1,
  Unit: 2,
  Upgrade: 3,
  Event: 4,
}

function typeRank(card: Card): number {
  // isLeader/isBase mandan sobre el string: hay impresiones donde el tipo
  // viene como "Leader Unit" o similar.
  if (card.isLeader) return 0
  if (card.isBase) return 1
  const t = card.type ?? ''
  if (t in TYPE_ORDER) return TYPE_ORDER[t]
  // Tokens (Token Unit, Token Upgrade, Credit Token, Force Token) al final
  if (t.includes('Token')) return 6
  return 5
}

// ─── Aspectos ────────────────────────────────────────────

const ASPECT_ORDER: Record<string, number> = {
  Vigilance: 0,
  Command: 1,
  Aggression: 2,
  Cunning: 3,
  Villainy: 4,
  Heroism: 5,
}

/**
 * Compara aspectos como el juego los ordena: primero el aspecto principal;
 * dentro de él, las combinaciones antes que el mono-aspecto
 * (Vigilancia/Villanía → Vigilancia/Heroísmo → Vigilancia sola).
 */
function compareAspects(a: Card, b: Card): number {
  const ra = (a.aspects ?? []).map(x => ASPECT_ORDER[x] ?? 9).sort((x, y) => x - y)
  const rb = (b.aspects ?? []).map(x => ASPECT_ORDER[x] ?? 9).sort((x, y) => x - y)
  const len = Math.max(ra.length, rb.length)
  for (let i = 0; i < len; i++) {
    // Sin aspecto en esa posición = va después (el mono cierra su grupo,
    // y las cartas Neutral cierran todo).
    const va = ra[i] ?? Infinity
    const vb = rb[i] ?? Infinity
    if (va !== vb) return va - vb
  }
  return 0
}

// ─── Comparador canónico ─────────────────────────────────

/** Orden de binder: tipo → aspecto → set → número de carta. */
export function compareCardsCanonical(a: Card, b: Card): number {
  const ta = typeRank(a)
  const tb = typeRank(b)
  if (ta !== tb) return ta - tb

  const asp = compareAspects(a, b)
  if (asp !== 0) return asp

  const sa = setRank(a.setCode ?? '')
  const sb = setRank(b.setCode ?? '')
  if (sa !== sb) return sa - sb

  if ((a.setCode ?? '') !== (b.setCode ?? '')) {
    return (a.setCode ?? '').localeCompare(b.setCode ?? '')
  }

  const na = a.setNumber ?? 0
  const nb = b.setNumber ?? 0
  if (na !== nb) return na - nb

  // Mismo número: son series de variantes distintas (cada una numera desde 1).
  // La impresión normal manda; las promos y foils van después.
  const va = variantRank(a)
  const vb = variantRank(b)
  if (va !== vb) return va - vb

  return (a.name ?? '').localeCompare(b.name ?? '')
}

// ─── Variantes ───────────────────────────────────────────

const VARIANT_ORDER = [
  'Standard', 'Standard Foil', 'Hyperspace', 'Hyperspace Foil',
  'Showcase', 'Standard Prestige', 'Foil Prestige', 'Serialized Prestige',
  'Weekly Play', 'Weekly Play Foil',
]

function variantRank(card: Card): number {
  const v = card.variantType
  if (!v) return 0 // sin dato = se asume la normal
  const i = VARIANT_ORDER.indexOf(v)
  return i === -1 ? VARIANT_ORDER.length : i
}

/**
 * Igual que el canónico pero para listas de un solo set: respeta la
 * numeración tal cual, que ya trae el orden oficial.
 */
export function compareCardsBySetNumber(a: Card, b: Card): number {
  const sa = setRank(a.setCode ?? '')
  const sb = setRank(b.setCode ?? '')
  if (sa !== sb) return sa - sb
  if ((a.setCode ?? '') !== (b.setCode ?? '')) {
    return (a.setCode ?? '').localeCompare(b.setCode ?? '')
  }
  return (a.setNumber ?? 0) - (b.setNumber ?? 0)
}

/**
 * Comparador para listas que envuelven una carta (colección, resultados con
 * precio, etc.). Devuelve el orden canónico usando el accessor dado.
 */
export function byCanonicalCard<T>(getCard: (item: T) => Card | null | undefined) {
  return (a: T, b: T): number => {
    const ca = getCard(a)
    const cb = getCard(b)
    // Las que aún no hidrataron van al final, para que la lista no salte
    // mientras se cargan los detalles.
    if (!ca && !cb) return 0
    if (!ca) return 1
    if (!cb) return -1
    return compareCardsCanonical(ca, cb)
  }
}

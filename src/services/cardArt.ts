/**
 * Presentación del arte de carta — HOLOCRON SWU
 *
 * En SWU no todas las cartas tienen la misma forma:
 * - Unidades, mejoras y eventos son VERTICALES (~400x559).
 * - Líderes y bases son APAISADAS (~400x287).
 *
 * Las listas de la app dibujan una caja vertical (w-12 h-16). Metiendo una
 * imagen apaisada ahí con `object-cover` se recorta el centro y queda un
 * fragmento irreconocible — que es exactamente lo que pasaba en Mi Botín y
 * en Contrabando.
 *
 * Las dos salidas de este módulo resuelven eso de una sola forma para todas
 * las pantallas, en vez de que cada una improvise su propia convención:
 *
 * - Los líderes tienen una cara vertical (el lado de unidad desplegada) en
 *   `backImageUrl`: se usa esa, que llena la caja sin recortar.
 * - Las bases no tienen cara vertical, así que se muestran completas con
 *   bandas ('contain').
 */

import type { Card } from '../types'

/**
 * La cara que conviene mostrar en una lista vertical.
 * Para líderes devuelve el lado de unidad (vertical) si existe.
 */
export function listFaceUrl(card: Card | null | undefined): string | null {
  if (!card) return null
  if (card.isLeader && card.backImageUrl) return card.backImageUrl
  return card.imageUrl || null
}

/**
 * Cómo encajar esa cara. Solo las bases necesitan 'contain': son apaisadas
 * y no tienen alternativa vertical.
 */
export function listFaceFit(card: Card | null | undefined): 'cover' | 'contain' {
  if (!card) return 'cover'
  if (isLandscapeArt(card)) return 'contain'
  // Un líder SIN cara trasera cae al frente apaisado — mismo caso que la base.
  if (card.isLeader && !card.backImageUrl) return 'contain'
  return 'cover'
}

/**
 * Cartas apaisadas que NO son líderes ni bases.
 *
 * "The Force" (LOF #3) es tipo `Force Token` con `isLeader:false` e
 * `isBase:false`, pero su arte es apaisado igual que una base. Mirando solo
 * las banderas se recortaba/deformaba.
 */
function isLandscapeArt(card: Card): boolean {
  if (card.isBase) return true
  return (card.type as string) === 'Force Token'
}

/**
 * ¿Esta imagen concreta es apaisada? Se usa en el detalle y en el zoom, donde
 * sí se muestra la cara real elegida por el usuario (frente o reverso) y no
 * se puede deducir solo del tipo de carta.
 *
 * El frente de un líder y el de una base son apaisados; el reverso de un
 * líder es vertical.
 */
export function isLandscapeFace(card: Card, showingBack: boolean): boolean {
  if (isLandscapeArt(card)) return true
  if (card.isLeader) return !showingBack
  return false
}

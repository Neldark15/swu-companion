/**
 * Progreso de colección — HOLOCRON SWU
 *
 * La app no tenía ninguna noción de COMPLETITUD. Las cuatro métricas de Mi
 * Botín eran Únicas, Copias, Valor y Con precio: tres de cuatro son dinero o
 * conteo, ninguna es progreso. Y la lista de sets del filtro se derivaba de lo
 * que ya tenías, así que un set del que tenés 0 cartas ni siquiera aparecía —
 * el hueco era literalmente invisible.
 *
 * ── Por qué el denominador se calcula acá y no se toma del API ──
 *
 * `/sets` trae un `total_cards` que (a) cuenta TODAS las impresiones —991 para
 * SOR, cuando las cartas jugables son 252— así que toparía cada barra en ~25%
 * para siempre, y (b) además está mal: verificado contra el export, SOR/SHD/TWI
 * vienen +10 de más y LAW -6.
 *
 * El denominador correcto se cuenta sobre la base local con tres condiciones:
 * impresión canónica + set principal + sin tokens. Da exactamente
 * 252/262/257/262/264/264/264/264 = 2,089 cartas.
 */

import { db } from './db'
import { MAIN_SET_LABELS, ensureFreshDatabase } from './swuApi'
import type { Card } from '../types'

/** Fichas de juego: no se coleccionan, vienen en cada sobre. */
const TOKEN_TYPES = new Set(['Token Upgrade', 'Token Unit', 'Credit Token', 'Force Token'])

export interface SetProgress {
  code: string
  label: string
  /** Cartas distintas que el usuario tiene de este set. */
  owned: number
  /** Cartas coleccionables del set (impresión canónica, sin tokens). */
  total: number
  /** 0-100, redondeado. */
  pct: number
}

/**
 * ¿Cuenta para el progreso de colección?
 *
 * OJO — acá se pide 'Standard' y NO se reutiliza `isCanonical`, aunque se
 * parezcan. Son dos preguntas distintas:
 *
 * - `isCanonical` (buscador): "¿es la fila que representa a esta carta?".
 *   Rescata las 2 cartas que no tienen ninguna impresión Standard, para que
 *   ninguna desaparezca de la búsqueda.
 * - `isCollectible` (progreso): "¿es parte del set oficial que se completa?".
 *
 * La diferencia son las cartas exclusivas de Weekly Play, como el R2-D2
 * "Full Of Solutions" de TWI. Contándola, el denominador de TWI da 258 y un
 * playset completo de la expansión se quedaría en 99% PARA SIEMPRE — que es
 * justo la sensación que esta barra tiene que evitar. Pidiendo 'Standard' da
 * 252/262/257/262/264/264/264/264 = 2,089, que es el playset completo real.
 */
export function isCollectible(c: Card): boolean {
  if ((c.variantType ?? 'Standard') !== 'Standard') return false
  if (!(c.setCode in MAIN_SET_LABELS)) return false
  if (TOKEN_TYPES.has(c.type)) return false
  return true
}

/**
 * El denominador solo cambia cuando cambia la base de cartas, así que se
 * calcula una vez y se guarda.
 *
 * La caché se invalida SOLA comparando el conteo de cartas: si llega una
 * expansión nueva y la base se re-descarga, el conteo cambia y se recalcula.
 * Se hace así, y no llamando a una función de invalidación desde swuApi, para
 * no crear un import circular (este módulo ya importa de swuApi) — y sobre
 * todo para que no exista la posibilidad de olvidarse de llamarla.
 */
/**
 * Caché de las cartas coleccionables en versión flaca (id, legacyId, setCode).
 *
 * Sin esto, `getSetProgress` releía las 9,057 filas de IndexedDB en CADA
 * toque de +/- de Mi Botín — la pantalla que justamente estamos arreglando
 * para que no trabe. Con la caché, la tabla se lee UNA vez por sesión y los
 * toques siguientes solo recorren ~2,089 objetos en memoria.
 */
type Collectible = { id: string; legacyId?: string; setCode: string }
let _denomCache: {
  cardCount: number
  total: number
  bySet: Map<string, number>
  collectibles: Collectible[]
} | null = null

/**
 * Progreso por expansión.
 *
 * @param quantities cardId → cantidad. Acepta uuids y también ids heredados
 *   (`SOR_001`), que es como quedaron guardadas las colecciones viejas.
 */
export async function getSetProgress(
  quantities: Map<string, number>,
): Promise<{ sets: SetProgress[]; ownedTotal: number; grandTotal: number }> {
  // Si la base está incompleta o hay una descarga en vuelo, esperar: si no,
  // las barras se calcularían contra un denominador parcial y mostrarían un
  // porcentaje inflado que se "corrige" solo unos segundos después.
  await ensureFreshDatabase().catch(() => {})

  const cardCount = await db.cards.count()
  if (!_denomCache || _denomCache.cardCount !== cardCount) {
    const bySet = new Map<string, number>()
    const collectibles: Collectible[] = []
    // ÚNICA lectura de la tabla completa.
    const all = await db.cards.toArray()
    for (const c of all) {
      if (!isCollectible(c)) continue
      bySet.set(c.setCode, (bySet.get(c.setCode) ?? 0) + 1)
      collectibles.push({ id: c.id, legacyId: c.legacyId, setCode: c.setCode })
    }
    _denomCache = { cardCount, total: collectibles.length, bySet, collectibles }
  }
  const { total: grandTotal, bySet, collectibles } = _denomCache

  const ownedBySet = new Map<string, number>()
  let ownedTotal = 0
  for (const c of collectibles) {
    const qty = quantities.get(c.id) ?? (c.legacyId ? quantities.get(c.legacyId) ?? 0 : 0)
    if (qty > 0) {
      ownedBySet.set(c.setCode, (ownedBySet.get(c.setCode) ?? 0) + 1)
      ownedTotal++
    }
  }

  // Se recorren los 8 sets SIEMPRE, en orden de lanzamiento — incluidos
  // aquellos de los que el usuario no tiene ni una carta. Ese cero es
  // justamente la información que faltaba.
  const sets: SetProgress[] = Object.entries(MAIN_SET_LABELS).map(([code, label]) => {
    const total = bySet.get(code) ?? 0
    const owned = ownedBySet.get(code) ?? 0
    return {
      code,
      label,
      owned,
      total,
      pct: total > 0 ? Math.round((owned / total) * 100) : 0,
    }
  })

  return { sets, ownedTotal, grandTotal }
}

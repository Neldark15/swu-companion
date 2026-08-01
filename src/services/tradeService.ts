/**
 * Intercambios — HOLOCRON SWU
 *
 * La app sabía qué TIENE cada uno (`collection`) pero nunca qué QUIERE. Con
 * la tabla `wishlist` se puede cruzar en las dos direcciones:
 *
 *   - "Esa persona tiene lo que buscás"  → mi wishlist × la oferta ajena
 *   - "Vos tenés lo que esa persona busca" → mi oferta × la wishlist ajena
 *
 * ── Qué cuenta como OFERTA, y por qué importa ──────────────────────────
 *
 * Se ofrece una carta si está publicada (`for_sale`) o si tenés MÁS de un
 * playset (`quantity > 3`). No alcanza con "tenerla".
 *
 * Esto es deliberado y cuesta coincidencias: hoy da cero. Pero la colección
 * más grande de la base son 2,089 filas con `quantity = 3` uniforme, cargadas
 * de una importación. Si "tener" contara como "ofrecer", el cruce diría
 * "Nelson tiene todo lo que buscás" para siempre, y una coincidencia falsa
 * en un grupo de seis personas que se conocen quema la función entera.
 *
 * Mejor un cero honesto que se llena solo cuando alguien marca sus repetidas.
 */

import { supabase, isSupabaseReady } from './supabase'
import { PLAYSET_SIZE } from './swuApi'

// ─── Wishlist ─────────────────────────────────────────────────────────

export interface WishlistEntry {
  cardId: string
  priority: number
  maxPrice: number | null
  note: string | null
}

export async function getMyWishlist(userId: string): Promise<WishlistEntry[]> {
  if (!isSupabaseReady()) return []
  const { data, error } = await supabase
    .from('wishlist')
    .select('card_id, priority, max_price, note')
    .eq('user_id', userId)
  if (error) {
    console.warn('[Trade] getMyWishlist:', error.message)
    return []
  }
  return (data ?? []).map(r => ({
    cardId: r.card_id,
    priority: r.priority,
    maxPrice: r.max_price,
    note: r.note,
  }))
}

export async function addToWishlist(
  userId: string,
  cardId: string,
  opts?: { priority?: number; maxPrice?: number | null; note?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }
  const { error } = await supabase.from('wishlist').upsert({
    user_id: userId,
    card_id: cardId,
    priority: opts?.priority ?? 2,
    max_price: opts?.maxPrice ?? null,
    note: opts?.note ?? null,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function removeFromWishlist(userId: string, cardId: string): Promise<boolean> {
  if (!isSupabaseReady()) return false
  const { error } = await supabase
    .from('wishlist').delete().eq('user_id', userId).eq('card_id', cardId)
  if (error) {
    console.warn('[Trade] removeFromWishlist:', error.message)
    return false
  }
  return true
}

// ─── Cruce ────────────────────────────────────────────────────────────

export interface TraderSummary {
  userId: string
  name: string
  avatar: string
}

export interface CardMatch {
  cardId: string
  /** Copias que la otra persona puede soltar (cantidad menos un playset). */
  spare?: number
  /** Está publicada en el mercado. */
  listed?: boolean
  price?: number | null
}

export interface TradeMatch {
  trader: TraderSummary
  /** Cartas que ESA persona ofrece y yo busco. */
  theyOffer: CardMatch[]
  /** Cartas que YO ofrezco y esa persona busca. */
  iOffer: CardMatch[]
}

interface CollectionRow {
  user_id: string
  card_id: string
  quantity: number
  for_sale: boolean
  sale_price: number | null
}

/** Copias realmente disponibles para cambiar. */
function spareOf(row: CollectionRow): number {
  const over = row.quantity - PLAYSET_SIZE
  if (over > 0) return over
  // Publicada explícitamente: cuenta como una, aunque no le sobre.
  return row.for_sale ? 1 : 0
}

function isOffered(row: CollectionRow): boolean {
  return spareOf(row) > 0
}

/**
 * Coincidencias de intercambio con el resto de la comunidad.
 *
 * Devuelve una entrada por persona con las dos direcciones juntas: un cruce
 * que va en ambos sentidos es un trato que se cierra solo, y separarlos en
 * dos listas obligaba a cruzarlos a ojo.
 *
 * Con RLS, `wishlist` y `collection` ajenas solo se leen si esa persona tiene
 * el perfil público, así que quien se pone en privado desaparece del cruce.
 */
export async function getTradeMatches(userId: string): Promise<TradeMatch[]> {
  if (!isSupabaseReady()) return []

  // 1. Lo que YO busco y lo que YO ofrezco.
  const [myWishRes, myCollRes] = await Promise.all([
    supabase.from('wishlist').select('card_id').eq('user_id', userId),
    supabase.from('collection')
      .select('user_id, card_id, quantity, for_sale, sale_price')
      .eq('user_id', userId),
  ])

  if (myWishRes.error) console.warn('[Trade] wishlist propia:', myWishRes.error.message)
  if (myCollRes.error) console.warn('[Trade] colección propia:', myCollRes.error.message)

  const myWants = new Set((myWishRes.data ?? []).map(r => r.card_id))
  const myOffers = new Map<string, CollectionRow>()
  for (const row of (myCollRes.data ?? []) as CollectionRow[]) {
    if (isOffered(row)) myOffers.set(row.card_id, row)
  }

  if (myWants.size === 0 && myOffers.size === 0) return []

  // 2. Las wishlists ajenas se traen ENTERAS y se cruzan en memoria: son
  //    listas curadas a mano (chicas), y así se evita un `in(...)` con miles
  //    de ids que reventaría el largo de la URL de PostgREST.
  const { data: othersWish, error: wErr } = await supabase
    .from('wishlist')
    .select('user_id, card_id')
    .neq('user_id', userId)
  if (wErr) console.warn('[Trade] wishlists ajenas:', wErr.message)

  // 3. De la colección ajena solo hacen falta las cartas que YO busco.
  //
  //    En lotes: PostgREST manda el `in(...)` en la URL y cada uuid ocupa 37
  //    caracteres. Con una wishlist de 500 cartas serían ~18 KB de URL y el
  //    servidor la rechazaría — el cruce fallaría en silencio justo para
  //    quien más lo usa.
  const othersColl: CollectionRow[] = []
  const wants = Array.from(myWants)
  const CHUNK = 100
  for (let i = 0; i < wants.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('collection')
      .select('user_id, card_id, quantity, for_sale, sale_price')
      .neq('user_id', userId)
      .in('card_id', wants.slice(i, i + CHUNK))
    if (error) {
      console.warn('[Trade] colecciones ajenas:', error.message)
      break
    }
    othersColl.push(...((data ?? []) as CollectionRow[]))
  }

  // 4. Agrupar por persona.
  const byUser = new Map<string, { theyOffer: CardMatch[]; iOffer: CardMatch[] }>()
  const bucket = (uid: string) => {
    let b = byUser.get(uid)
    if (!b) { b = { theyOffer: [], iOffer: [] }; byUser.set(uid, b) }
    return b
  }

  for (const row of othersColl) {
    if (!isOffered(row)) continue
    bucket(row.user_id).theyOffer.push({
      cardId: row.card_id,
      spare: spareOf(row),
      listed: row.for_sale,
      price: row.sale_price,
    })
  }

  for (const row of (othersWish ?? []) as { user_id: string; card_id: string }[]) {
    const mine = myOffers.get(row.card_id)
    if (!mine) continue
    bucket(row.user_id).iOffer.push({
      cardId: row.card_id,
      spare: spareOf(mine),
      listed: mine.for_sale,
      price: mine.sale_price,
    })
  }

  if (byUser.size === 0) return []

  // 5. Hidratar los perfiles en UNA consulta.
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, name, avatar')
    .in('id', Array.from(byUser.keys()))
  if (pErr) console.warn('[Trade] perfiles:', pErr.message)

  const profileOf = new Map(
    (profiles ?? []).map(p => [p.id, { userId: p.id, name: p.name, avatar: p.avatar }]),
  )

  return Array.from(byUser.entries())
    .map(([uid, m]) => {
      const trader = profileOf.get(uid)
      if (!trader) return null
      return { trader, theyOffer: m.theyOffer, iOffer: m.iOffer }
    })
    .filter((m): m is TradeMatch => m !== null)
    // Los cruces que van en AMBAS direcciones primero: son los que se cierran
    // sin que nadie tenga que ceder.
    .sort((a, b) => {
      const bothA = a.theyOffer.length > 0 && a.iOffer.length > 0 ? 1 : 0
      const bothB = b.theyOffer.length > 0 && b.iOffer.length > 0 ? 1 : 0
      if (bothA !== bothB) return bothB - bothA
      return (b.theyOffer.length + b.iOffer.length) - (a.theyOffer.length + a.iOffer.length)
    })
}

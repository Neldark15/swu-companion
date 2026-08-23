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
import { updateMissionProgress } from './missionService'
import { PLAYSET_SIZE, getCardsByIds } from './swuApi'

/**
 * PostgREST corta cualquier SELECT en 1000 filas. `collection` ya tiene 4,049,
 * así que sin paginar el cruce miraría una cuarta parte de los datos y
 * devolvería menos coincidencias sin ninguna señal.
 */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<{ rows: T[]; ok: boolean }> {
  const PAGE = 1000
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) {
      console.warn(`[Trade] ${label}:`, error.message)
      return { rows, ok: false }
    }
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return { rows, ok: true }
}

/**
 * La colección vive en DOS espacios de ids: 2,089 filas con uuid y 1,960 con
 * el id heredado (`LOF_205`), de antes de la migración. Y las 291 filas con
 * sobrantes son TODAS heredadas.
 *
 * O sea que comparar los ids tal cual da cero garantizado: la wishlist guarda
 * uuids y la oferta está del otro lado. Todo se pasa al uuid canónico antes de
 * cruzar; `getCardsByIds` ya resuelve las dos formas contra la base local.
 */
async function canonicalIds(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (ids.length === 0) return out
  try {
    const cards = await getCardsByIds(ids)
    for (const [raw, card] of cards) out.set(raw, card.id)
  } catch { /* sin base local, se cae al id crudo */ }
  for (const id of ids) if (!out.has(id)) out.set(id, id)
  return out
}

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

  /* ¿Ya la tenía marcada? El upsert no lo dice, y sin preguntarlo volver a
   * guardar la MISMA carta contaría de nuevo: la misión se cumpliría tocando
   * el corazón de una sola carta las veces que hagan falta. */
  const { data: yaEstaba } = await supabase
    .from('wishlist').select('card_id')
    .eq('user_id', userId).eq('card_id', cardId).maybeSingle()

  const { error } = await supabase.from('wishlist').upsert({
    user_id: userId,
    card_id: cardId,
    priority: opts?.priority ?? 2,
    max_price: opts?.maxPrice ?? null,
    note: opts?.note ?? null,
  })
  if (error) return { ok: false, error: error.message }

  if (!yaEstaba) void updateMissionProgress(userId, 'carta_deseada').catch(() => {})
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

// ─── WhatsApp (opcional) ──────────────────────────────────────────────

/** Código de país de El Salvador, que es de donde es toda la comunidad. */
const DEFAULT_COUNTRY_CODE = '503'

/**
 * Deja el número como lo quiere wa.me: solo dígitos, con código de país.
 *
 * La gente escribe "7123-4567", "+503 7123 4567" o "50371234567" y las tres
 * tienen que terminar igual. Un número local de 8 dígitos se asume salvadoreño.
 * Devuelve null si no parece un teléfono.
 */
export function normalizeWhatsapp(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, '')
  if (digits.length === 0) return null
  const withCode = digits.length === 8 ? `${DEFAULT_COUNTRY_CODE}${digits}` : digits
  if (withCode.length < 8 || withCode.length > 15) return null
  return withCode
}

/** Cómo se ve en el campo de edición — nunca se muestra en otro lado. */
export function formatWhatsappForInput(value: string | null): string {
  return value ? `+${value}` : ''
}

export async function getMyWhatsapp(userId: string): Promise<string | null> {
  if (!isSupabaseReady()) return null
  const { data, error } = await supabase
    .from('profiles').select('whatsapp').eq('id', userId).single()
  if (error) {
    console.warn('[Trade] getMyWhatsapp:', error.message)
    return null
  }
  return data?.whatsapp ?? null
}

/** Guardar `null` (o vacío) lo borra: es la forma de retirar el consentimiento. */
export async function setMyWhatsapp(
  userId: string,
  raw: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }
  const value = raw.trim() === '' ? null : normalizeWhatsapp(raw)
  if (raw.trim() !== '' && value === null) {
    return { ok: false, error: 'Ese número no parece válido' }
  }
  const { error } = await supabase.from('profiles').update({ whatsapp: value }).eq('id', userId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ─── Cruce ────────────────────────────────────────────────────────────

export interface TraderSummary {
  userId: string
  name: string
  avatar: string
  /**
   * Solo si esa persona lo compartió. La app NUNCA lo dibuja como texto: se
   * usa para armar el enlace wa.me y nada más.
   */
  whatsapp?: string | null
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
/**
 * ¿Hay siquiera UN deseo en toda la base?
 *
 * Un cruce necesita las dos patas: alguien que BUSCA y alguien que OFRECE. La
 * oferta está poblada (203 publicaciones y 493 filas con repetidas de 8
 * personas), pero `wishlist` está en CERO — nadie ha marcado nunca una carta.
 *
 * Con la tabla vacía NINGÚN cruce es posible para nadie, así que preguntarlo
 * primero —una cuenta con `head`, sin traer una sola fila— ahorra leer las 667
 * filas de oferta en cada visita al Mercado para cruzarlas contra nada.
 *
 * No se mira solo MI lista: el cruce va en las dos direcciones, y «vos tenés lo
 * que esa persona busca» depende de la lista de ELLA.
 */
async function hayDeseos(): Promise<boolean> {
  if (!isSupabaseReady()) return false
  const { count, error } = await supabase
    .from('wishlist').select('*', { count: 'exact', head: true })
  // `supabase-js` no lanza en errores de PostgREST: hay que mirar `error`.
  if (error) return true // Ante la duda se cruza: mejor gastar que ocultar.
  return (count ?? 0) > 0
}

export async function getTradeMatches(userId: string): Promise<TradeMatch[]> {
  if (!(await hayDeseos())) return []

  if (!isSupabaseReady()) return []

  // 1. Lo que YO busco y lo que YO ofrezco.
  const [myWish, myColl] = await Promise.all([
    fetchAll<{ card_id: string }>(
      (a, b) => supabase.from('wishlist').select('card_id').eq('user_id', userId).range(a, b),
      'wishlist propia',
    ),
    fetchAll<CollectionRow>(
      (a, b) => supabase.from('collection')
        .select('user_id, card_id, quantity, for_sale, sale_price')
        .eq('user_id', userId).range(a, b),
      'colección propia',
    ),
  ])

  const myOfferRows = myColl.rows.filter(isOffered)
  if (myWish.rows.length === 0 && myOfferRows.length === 0) return []

  // 2. Todo al uuid canónico antes de cruzar. Sin esto, la wishlist (uuids)
  //    nunca casaría con las filas de colección heredadas — y las 291 filas
  //    con sobrantes que hay hoy son TODAS heredadas.
  const myIds = [...myWish.rows.map(r => r.card_id), ...myOfferRows.map(r => r.card_id)]
  const myCanon = await canonicalIds(myIds)

  const myWants = new Set(myWish.rows.map(r => myCanon.get(r.card_id) ?? r.card_id))
  const myOffers = new Map<string, CollectionRow>()
  for (const row of myOfferRows) {
    myOffers.set(myCanon.get(row.card_id) ?? row.card_id, row)
  }

  // 3. Las wishlists ajenas se traen ENTERAS y se cruzan en memoria: son
  //    listas curadas a mano (chicas), y así se evita un `in(...)` con miles
  //    de ids que reventaría el largo de la URL de PostgREST.
  const othersWish = await fetchAll<{ user_id: string; card_id: string }>(
    (a, b) => supabase.from('wishlist').select('user_id, card_id').neq('user_id', userId).range(a, b),
    'wishlists ajenas',
  )

  // 4. De la colección ajena solo hacen falta las cartas que yo busco — pero
  //    hay que pedirlas en LOS DOS espacios de id, porque la fila del otro
  //    puede estar guardada con el id heredado.
  const wantVariants = new Set<string>()
  for (const raw of myWish.rows.map(r => r.card_id)) {
    wantVariants.add(raw)
    const canon = myCanon.get(raw)
    if (canon) wantVariants.add(canon)
  }
  if (wantVariants.size > 0) {
    try {
      const cards = await getCardsByIds(Array.from(wantVariants))
      for (const card of cards.values()) if (card.legacyId) wantVariants.add(card.legacyId)
    } catch { /* sin base local se busca solo con lo que hay */ }
  }

  // En lotes: PostgREST manda el `in(...)` en la URL y cada uuid ocupa 37
  // caracteres; con una wishlist grande el servidor rechazaría la petición.
  const othersColl: CollectionRow[] = []
  let othersCollOk = true
  const wants = Array.from(wantVariants)
  const CHUNK = 100
  for (let i = 0; i < wants.length; i += CHUNK) {
    const page = await fetchAll<CollectionRow>(
      (a, b) => supabase.from('collection')
        .select('user_id, card_id, quantity, for_sale, sale_price')
        .neq('user_id', userId)
        .in('card_id', wants.slice(i, i + CHUNK))
        .range(a, b),
      'colecciones ajenas',
    )
    othersColl.push(...page.rows)
    if (!page.ok) { othersCollOk = false; break }
  }

  // 5. Agrupar por persona, siempre con ids canónicos.
  const otherIds = [...othersColl.map(r => r.card_id), ...othersWish.rows.map(r => r.card_id)]
  const otherCanon = await canonicalIds(otherIds)

  const byUser = new Map<string, { theyOffer: CardMatch[]; iOffer: CardMatch[] }>()
  const bucket = (uid: string) => {
    let b = byUser.get(uid)
    if (!b) { b = { theyOffer: [], iOffer: [] }; byUser.set(uid, b) }
    return b
  }

  const seenOffer = new Set<string>()
  for (const row of othersColl) {
    if (!isOffered(row)) continue
    const canon = otherCanon.get(row.card_id) ?? row.card_id
    if (!myWants.has(canon)) continue
    // Una misma carta puede venir dos veces (uuid y heredado) por la búsqueda
    // en ambos espacios: se cuenta una sola.
    const key = `${row.user_id}|${canon}`
    if (seenOffer.has(key)) continue
    seenOffer.add(key)
    bucket(row.user_id).theyOffer.push({
      cardId: canon,
      spare: spareOf(row),
      listed: row.for_sale,
      price: row.sale_price,
    })
  }

  for (const row of othersWish.rows) {
    const canon = otherCanon.get(row.card_id) ?? row.card_id
    const mine = myOffers.get(canon)
    if (!mine) continue
    bucket(row.user_id).iOffer.push({
      cardId: canon,
      spare: spareOf(mine),
      listed: mine.for_sale,
      price: mine.sale_price,
    })
  }

  // Un fallo de red no puede verse igual que "no hay cruces": si algo se cayó
  // y no quedó NADA, se avisa en vez de mentir con una lista vacía.
  if (byUser.size === 0 && (!myWish.ok || !myColl.ok || !othersWish.ok || !othersCollOk)) {
    throw new Error('No se pudo consultar el cruce de intercambios')
  }

  if (byUser.size === 0) return []

  // 5. Hidratar los perfiles en UNA consulta.
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, name, avatar, whatsapp')
    .in('id', Array.from(byUser.keys()))
  if (pErr) console.warn('[Trade] perfiles:', pErr.message)

  const profileOf = new Map<string, TraderSummary>(
    (profiles ?? []).map(p => [
      p.id,
      { userId: p.id, name: p.name, avatar: p.avatar, whatsapp: p.whatsapp ?? null },
    ]),
  )

  return Array.from(byUser.entries())
    .map(([uid, m]): TradeMatch | null => {
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

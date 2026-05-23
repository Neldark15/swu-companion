/**
 * Collection Service
 * Manages user card collections with public/private profiles.
 *
 * Features:
 * - Get collection with prices joined
 * - Public profile browsing (explore)
 * - Collection stats (total cards, value, rarities)
 * - Toggle profile visibility
 */

import { db } from './db'
import { supabase, isSupabaseReady } from './supabase'
import { getPricesForCards, type PriceInfo, formatPrice } from './pricing'

// ─── Types ───────────────────────────────────────────────

export interface CollectionItem {
  cardId: string
  quantity: number
  profileId?: string
}

export interface CollectionCardWithPrice {
  cardId: string
  quantity: number
  price: PriceInfo | null
}

export interface CollectionStats {
  uniqueCards: number
  totalCopies: number
  estimatedValue: number
  formattedValue: string
  byRarity: Record<string, number>
}

export interface PublicProfile {
  id: string
  name: string
  avatar: string
  bio: string | null
  isPublic: boolean
  cardCount: number
  estimatedValue: number
}

// ─── Local Collection ────────────────────────────────────

/** Get all collection items for the active local profile */
export async function getMyCollection(profileId?: string): Promise<CollectionItem[]> {
  try {
    if (profileId) {
      return await db.collection
        .where('profileId')
        .equals(profileId)
        .toArray() as CollectionItem[]
    }
    return await db.collection.toArray() as CollectionItem[]
  } catch {
    return []
  }
}

/** Get collection items with prices joined */
export async function getMyCollectionWithPrices(profileId?: string): Promise<CollectionCardWithPrice[]> {
  const items = await getMyCollection(profileId)
  if (items.length === 0) return []

  const cardIds = items.map(i => i.cardId)
  const prices = await getPricesForCards(cardIds)

  return items.map(item => ({
    cardId: item.cardId,
    quantity: item.quantity,
    price: prices.get(item.cardId) ?? null,
  }))
}

/** Update quantity for a card in collection (local + cloud) */
export async function updateCollectionQuantity(
  cardId: string,
  quantity: number,
  profileId?: string,
  userId?: string,
): Promise<void> {
  try {
    if (quantity <= 0) {
      // Remove from collection
      await db.collection.delete(cardId)
    } else {
      await db.collection.put({
        cardId,
        quantity,
        ...(profileId ? { profileId } : {}),
      })
    }

    // Sync to cloud if logged in
    if (userId && isSupabaseReady()) {
      if (quantity <= 0) {
        await supabase
          .from('collection')
          .delete()
          .eq('user_id', userId)
          .eq('card_id', cardId)
      } else {
        await supabase
          .from('collection')
          .upsert({
            user_id: userId,
            card_id: cardId,
            quantity,
          })
      }
    }
  } catch (e) {
    console.warn('[Collection] Failed to update quantity:', e)
  }
}

/** Get the quantity of a specific card in collection */
export async function getCardQuantity(cardId: string): Promise<number> {
  try {
    const item = await db.collection.get(cardId) as CollectionItem | undefined
    return item?.quantity ?? 0
  } catch {
    return 0
  }
}

// ─── Collection Stats ────────────────────────────────────

/** Calculate collection statistics */
export function calculateCollectionStats(
  items: CollectionCardWithPrice[],
): CollectionStats {
  let totalCopies = 0
  let estimatedValue = 0
  const byRarity: Record<string, number> = {}

  for (const item of items) {
    totalCopies += item.quantity
    if (item.price?.market) {
      estimatedValue += item.price.market * item.quantity
    }
  }

  return {
    uniqueCards: items.length,
    totalCopies,
    estimatedValue,
    formattedValue: formatPrice(estimatedValue),
    byRarity,
  }
}

// ─── Public Profiles ─────────────────────────────────────

/** Toggle profile public/private */
export async function toggleProfilePublic(
  userId: string,
  isPublic: boolean,
): Promise<boolean> {
  if (!isSupabaseReady()) return false

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ is_public: isPublic })
      .eq('id', userId)

    if (error) {
      console.warn('[Collection] Failed to toggle public:', error)
      return false
    }
    return true
  } catch (e) {
    console.warn('[Collection] Failed to toggle public:', e)
    return false
  }
}

/** Update profile bio */
export async function updateProfileBio(
  userId: string,
  bio: string,
): Promise<boolean> {
  if (!isSupabaseReady()) return false

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ bio })
      .eq('id', userId)

    return !error
  } catch {
    return false
  }
}

/** Get a public user's profile */
export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  if (!isSupabaseReady()) return null

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, avatar, bio, is_public')
      .eq('id', userId)
      .single()

    if (!profile) return null

    // Get collection count
    const { count } = await supabase
      .from('collection')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    return {
      id: profile.id,
      name: profile.name,
      avatar: profile.avatar || '👤',
      bio: profile.bio || null,
      isPublic: profile.is_public ?? true,
      cardCount: count ?? 0,
      estimatedValue: 0, // calculated client-side when viewing
    }
  } catch (e) {
    console.warn('[Collection] Failed to get public profile:', e)
    return null
  }
}

/** Get a public user's collection */
export async function getPublicCollection(
  userId: string,
): Promise<{ cardId: string; quantity: number }[]> {
  if (!isSupabaseReady()) return []

  try {
    const { data } = await supabase
      .from('collection')
      .select('card_id, quantity')
      .eq('user_id', userId)

    if (!data) return []

    return data.map(row => ({
      cardId: row.card_id,
      quantity: row.quantity,
    }))
  } catch (e) {
    console.warn('[Collection] Failed to get public collection:', e)
    return []
  }
}

/** Search ALL profiles by name (contrabando = all users visible) */
export async function searchPublicProfiles(query: string): Promise<PublicProfile[]> {
  if (!isSupabaseReady() || !query.trim()) return []

  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, avatar, bio, is_public')
      .ilike('name', `%${query}%`)
      .limit(30)

    if (!data) return []

    // Get collection counts for all matched users in parallel
    const profilesWithCounts = await Promise.all(
      data.map(async (p) => {
        const { count } = await supabase
          .from('collection')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', p.id)

        return {
          id: p.id,
          name: p.name,
          avatar: p.avatar || '👤',
          bio: p.bio || null,
          isPublic: p.is_public ?? true,
          cardCount: count ?? 0,
          estimatedValue: 0,
        }
      }),
    )

    return profilesWithCounts
  } catch (e) {
    console.warn('[Collection] Failed to search profiles:', e)
    return []
  }
}

/** Get ALL profiles for the contrabando page (all users, sorted by recent) */
export async function getExploreProfiles(limit = 50): Promise<PublicProfile[]> {
  if (!isSupabaseReady()) return []

  try {
    // Try updated_at first, fall back to created_at
    let { data, error } = await supabase
      .from('profiles')
      .select('id, name, avatar, bio, is_public')
      .order('updated_at', { ascending: false })
      .limit(limit)

    // If updated_at doesn't exist yet, try created_at
    if (error || !data) {
      const fallback = await supabase
        .from('profiles')
        .select('id, name, avatar, bio, is_public')
        .order('created_at', { ascending: false })
        .limit(limit)
      data = fallback.data
    }

    if (!data) return []

    // Get collection counts for all users in parallel
    const profilesWithCounts = await Promise.all(
      data.map(async (p) => {
        const { count } = await supabase
          .from('collection')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', p.id)

        return {
          id: p.id,
          name: p.name,
          avatar: p.avatar || '👤',
          bio: p.bio || null,
          isPublic: p.is_public ?? true,
          cardCount: count ?? 0,
          estimatedValue: 0,
        }
      }),
    )

    return profilesWithCounts
  } catch (e) {
    console.warn('[Collection] Failed to get explore profiles:', e)
    return []
  }
}

/** Get my profile's public status */
export async function getMyPublicStatus(userId: string): Promise<{ isPublic: boolean; bio: string | null }> {
  if (!isSupabaseReady()) return { isPublic: true, bio: null }

  try {
    const { data } = await supabase
      .from('profiles')
      .select('is_public, bio')
      .eq('id', userId)
      .single()

    return {
      isPublic: data?.is_public ?? true,
      bio: data?.bio ?? null,
    }
  } catch {
    return { isPublic: true, bio: null }
  }
}

// ─── Marketplace / Mercancía ─────────────────────────────────
//
// Cualquier carta de la collection puede marcarse en venta (for_sale=true)
// con un precio y notas opcionales. La RLS existente (collection_public_read)
// ya expone collection a quien sea, así que las listings son visibles para
// todos sin políticas extra.

export interface MarketplaceListing {
  userId: string
  cardId: string
  quantity: number
  price: number | null
  notes: string | null
  listedAt: string
  // Joined seller info
  sellerName: string
  sellerAvatar: string
}

export interface MyListingSummary {
  cardId: string
  quantity: number
  price: number | null
  notes: string | null
  listedAt: string
}

/**
 * Marca una carta de la colección como "en venta" con precio + notas opcionales.
 * Requiere que la carta ya esté en la colección con quantity > 0.
 */
export async function markCardForSale(
  cardId: string,
  userId: string,
  opts: { price?: number | null; notes?: string | null } = {}
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión al servidor' }

  // Verify the card is owned with qty > 0
  const { data: existing } = await supabase
    .from('collection')
    .select('quantity')
    .eq('user_id', userId)
    .eq('card_id', cardId)
    .single()

  if (!existing || !existing.quantity || existing.quantity <= 0) {
    return { ok: false, error: 'No tienes esta carta en tu colección' }
  }

  const { error } = await supabase
    .from('collection')
    .update({
      for_sale: true,
      sale_price: opts.price ?? null,
      sale_notes: opts.notes?.trim() || null,
      listed_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('card_id', cardId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function unmarkCardForSale(
  cardId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión al servidor' }

  const { error } = await supabase
    .from('collection')
    .update({
      for_sale: false,
      sale_price: null,
      sale_notes: null,
      listed_at: null,
    })
    .eq('user_id', userId)
    .eq('card_id', cardId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Returns my listings (cards I have for sale).
 */
export async function getMyListings(userId: string): Promise<MyListingSummary[]> {
  if (!isSupabaseReady()) return []
  const { data } = await supabase
    .from('collection')
    .select('card_id, quantity, sale_price, sale_notes, listed_at')
    .eq('user_id', userId)
    .eq('for_sale', true)
    .order('listed_at', { ascending: false })
  if (!data) return []
  return data.map(r => ({
    cardId: r.card_id,
    quantity: r.quantity ?? 0,
    price: r.sale_price !== null ? Number(r.sale_price) : null,
    notes: r.sale_notes,
    listedAt: r.listed_at,
  }))
}

/**
 * Global marketplace: cards on sale across all users.
 * RLS gates by seller's profile being public (existing collection_public_read).
 */
export async function getMarketplaceListings(opts?: { limit?: number; cardId?: string }): Promise<MarketplaceListing[]> {
  if (!isSupabaseReady()) return []
  const limit = opts?.limit ?? 100

  let query = supabase
    .from('collection')
    .select('user_id, card_id, quantity, sale_price, sale_notes, listed_at')
    .eq('for_sale', true)
    .order('listed_at', { ascending: false })
    .limit(limit)

  if (opts?.cardId) query = query.eq('card_id', opts.cardId)

  const { data: rows } = await query
  if (!rows || rows.length === 0) return []

  // Hydrate sellers in one batch
  const userIds = Array.from(new Set(rows.map(r => r.user_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, avatar')
    .in('id', userIds)
  const sellerMap = new Map((profiles || []).map(p => [p.id, p]))

  return rows.map(r => {
    const seller = sellerMap.get(r.user_id)
    return {
      userId: r.user_id,
      cardId: r.card_id,
      quantity: r.quantity ?? 0,
      price: r.sale_price !== null ? Number(r.sale_price) : null,
      notes: r.sale_notes,
      listedAt: r.listed_at,
      sellerName: seller?.name ?? 'Vendedor',
      sellerAvatar: seller?.avatar ?? '👤',
    } as MarketplaceListing
  })
}

/**
 * Listings of a specific user (visible on their public profile).
 */
export async function getUserListings(userId: string): Promise<MarketplaceListing[]> {
  if (!isSupabaseReady()) return []
  const { data: rows } = await supabase
    .from('collection')
    .select('user_id, card_id, quantity, sale_price, sale_notes, listed_at')
    .eq('user_id', userId)
    .eq('for_sale', true)
    .order('listed_at', { ascending: false })
  if (!rows || rows.length === 0) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, avatar')
    .eq('id', userId)
    .single()

  return rows.map(r => ({
    userId: r.user_id,
    cardId: r.card_id,
    quantity: r.quantity ?? 0,
    price: r.sale_price !== null ? Number(r.sale_price) : null,
    notes: r.sale_notes,
    listedAt: r.listed_at,
    sellerName: profile?.name ?? 'Vendedor',
    sellerAvatar: profile?.avatar ?? '👤',
  }))
}

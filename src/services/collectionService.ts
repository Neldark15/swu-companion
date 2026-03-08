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

/** Search public profiles by name */
export async function searchPublicProfiles(query: string): Promise<PublicProfile[]> {
  if (!isSupabaseReady() || !query.trim()) return []

  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, avatar, bio, is_public')
      .eq('is_public', true)
      .ilike('name', `%${query}%`)
      .limit(20)

    if (!data) return []

    return data.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar || '👤',
      bio: p.bio || null,
      isPublic: true,
      cardCount: 0,
      estimatedValue: 0,
    }))
  } catch (e) {
    console.warn('[Collection] Failed to search profiles:', e)
    return []
  }
}

/** Get recent public profiles for explore page */
export async function getExploreProfiles(limit = 20): Promise<PublicProfile[]> {
  if (!isSupabaseReady()) return []

  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, avatar, bio, is_public')
      .eq('is_public', true)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (!data) return []

    return data.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar || '👤',
      bio: p.bio || null,
      isPublic: true,
      cardCount: 0,
      estimatedValue: 0,
    }))
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

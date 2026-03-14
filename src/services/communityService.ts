/**
 * Community Service — HOLOCRON SWU
 * Queries profiles by country/region and manages community feed posts.
 * Country/continent are stored in the profiles.settings JSON column.
 */

import { supabase, isSupabaseReady } from './supabase'

// ─── Types ───────────────────────────────────────────────

export interface CommunityMember {
  id: string
  name: string
  avatar: string
  country: string
  continent: string
  level?: number
  xp?: number
}

export interface CommunityStats {
  countryCode: string
  playerCount: number
}

export interface CommunityPost {
  id: string
  userId: string
  userName: string
  userAvatar: string
  userCountry: string
  content: string
  type: 'message' | 'achievement' | 'tournament' | 'trade'
  countryCode: string
  likes: number
  likedByMe: boolean
  createdAt: string
}

// ─── Community Queries ─────────────────────────────────────

/**
 * Get all profiles with a country set, grouped by country.
 * Returns community stats (player count per country).
 */
export async function getCommunityStats(): Promise<CommunityStats[]> {
  if (!isSupabaseReady()) return []

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('settings')
      .not('settings', 'is', null)

    if (error || !data) return []

    // Count players per country
    const countMap = new Map<string, number>()
    for (const row of data) {
      const settings = row.settings as Record<string, unknown> | null
      const country = settings?.country as string | undefined
      if (country) {
        countMap.set(country, (countMap.get(country) || 0) + 1)
      }
    }

    return Array.from(countMap.entries())
      .map(([countryCode, playerCount]) => ({ countryCode, playerCount }))
      .sort((a, b) => b.playerCount - a.playerCount)
  } catch {
    return []
  }
}

/**
 * Get members of a specific country community.
 */
export async function getCommunityMembers(countryCode: string): Promise<CommunityMember[]> {
  if (!isSupabaseReady()) return []

  try {
    // Get profiles where settings->country matches
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, name, avatar, settings')
      .not('settings', 'is', null)

    if (error || !profiles) return []

    // Filter client-side for country match and get stats
    const members: CommunityMember[] = []
    const matchingProfiles = profiles.filter(p => {
      const s = p.settings as Record<string, unknown> | null
      return s?.country === countryCode
    })

    // Get stats for all matching users in one query
    const userIds = matchingProfiles.map(p => p.id)
    const { data: statsData } = userIds.length > 0
      ? await supabase
          .from('player_stats')
          .select('user_id, xp, level')
          .in('user_id', userIds)
      : { data: [] }

    const statsMap = new Map<string, { xp: number; level: number }>()
    if (statsData) {
      for (const s of statsData) {
        statsMap.set(s.user_id as string, { xp: s.xp as number, level: s.level as number })
      }
    }

    for (const p of matchingProfiles) {
      const settings = p.settings as Record<string, unknown>
      const stats = statsMap.get(p.id)
      members.push({
        id: p.id,
        name: (p.name as string) || 'Jugador',
        avatar: (p.avatar as string) || '🎮',
        country: countryCode,
        continent: (settings.continent as string) || '',
        level: stats?.level,
        xp: stats?.xp,
      })
    }

    // Sort by XP descending
    members.sort((a, b) => (b.xp || 0) - (a.xp || 0))
    return members
  } catch {
    return []
  }
}

// ─── Community Feed ─────────────────────────────────────────

/**
 * Get community posts for a country.
 * Posts are stored in community_posts table in Supabase.
 */
export async function getCommunityPosts(countryCode: string, limit = 30): Promise<CommunityPost[]> {
  if (!isSupabaseReady()) return []

  try {
    const { data, error } = await supabase
      .from('community_posts')
      .select('*')
      .eq('country_code', countryCode)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []

    return data.map(row => ({
      id: row.id as string,
      userId: row.user_id as string,
      userName: row.user_name as string,
      userAvatar: row.user_avatar as string,
      userCountry: row.country_code as string,
      content: row.content as string,
      type: (row.type as CommunityPost['type']) || 'message',
      countryCode: row.country_code as string,
      likes: (row.likes as number) || 0,
      likedByMe: false, // Will be updated client-side
      createdAt: row.created_at as string,
    }))
  } catch {
    return []
  }
}

/**
 * Create a new community post.
 */
export async function createCommunityPost(
  userId: string,
  userName: string,
  userAvatar: string,
  countryCode: string,
  content: string,
  type: CommunityPost['type'] = 'message',
): Promise<CommunityPost | null> {
  if (!isSupabaseReady()) return null

  try {
    const { data, error } = await supabase
      .from('community_posts')
      .insert({
        user_id: userId,
        user_name: userName,
        user_avatar: userAvatar,
        country_code: countryCode,
        content: content.trim(),
        type,
        likes: 0,
      })
      .select()
      .single()

    if (error || !data) {
      console.warn('[Community] Failed to create post:', error?.message)
      return null
    }

    return {
      id: data.id as string,
      userId: data.user_id as string,
      userName: data.user_name as string,
      userAvatar: data.user_avatar as string,
      userCountry: data.country_code as string,
      content: data.content as string,
      type: (data.type as CommunityPost['type']) || 'message',
      countryCode: data.country_code as string,
      likes: 0,
      likedByMe: false,
      createdAt: data.created_at as string,
    }
  } catch {
    return null
  }
}

/**
 * Like a community post (increment likes).
 */
export async function likeCommunityPost(postId: string): Promise<boolean> {
  if (!isSupabaseReady()) return false

  try {
    // Use RPC to atomically increment if available, fallback to select+update
    const { data } = await supabase
      .from('community_posts')
      .select('likes')
      .eq('id', postId)
      .single()

    if (!data) return false

    const newLikes = ((data.likes as number) || 0) + 1
    const { error } = await supabase
      .from('community_posts')
      .update({ likes: newLikes })
      .eq('id', postId)

    return !error
  } catch {
    return false
  }
}

/**
 * Delete a community post (only the author can delete).
 */
export async function deleteCommunityPost(postId: string): Promise<boolean> {
  if (!isSupabaseReady()) return false

  try {
    const { error } = await supabase
      .from('community_posts')
      .delete()
      .eq('id', postId)

    return !error
  } catch {
    return false
  }
}

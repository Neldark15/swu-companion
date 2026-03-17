/**
 * Galaxy Service — La Galaxia
 * Global player explorer, rankings by category, and activity feed.
 */

import { supabase, isSupabaseReady } from './supabase'

// ─── Types ───────────────────────────────────────────────

export interface GalaxyPlayer {
  userId: string
  name: string
  avatar: string
  country: string
  continent: string
  level: number
  xp: number
  wins: number
  losses: number
  matchesPlayed: number
  tournamentsFinished: number
  decksCreated: number
  bestStreak: number
  cardsCollected: number
  unlockedAchievements: string[]
  activeTitle: string
  socialReputation: number
}

export type RankingCategory = 'xp' | 'wins' | 'tournaments' | 'streak' | 'collection' | 'achievements'

export interface RankingEntry {
  rank: number
  userId: string
  name: string
  avatar: string
  country: string
  value: number
  level: number
  xp: number
}

export interface GalaxyActivity {
  id: string
  type: 'post' | 'achievement' | 'welcome'
  userId: string
  userName: string
  userAvatar: string
  userCountry: string
  message: string
  detail?: string
  createdAt: string
}

export interface GalaxyStats {
  totalPlayers: number
  countriesRepresented: number
  topCountry: string
  topCountryCount: number
}

// ─── Helpers ─────────────────────────────────────────────

function sanitizeName(name: string | null | undefined): string {
  if (!name) return 'Comandante'
  if (name.length >= 20 && !/\s/.test(name) && /^[a-zA-Z0-9_\-]+$/.test(name)) return 'Comandante'
  return name
}

/**
 * Supabase returns embedded relations as ARRAY (one-to-many) or object (many-to-one).
 * This helper normalises to always get a single record, handling both cases.
 */
function single<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null
  if (Array.isArray(val)) return val[0] ?? null
  return val
}

// ─── Main queries ────────────────────────────────────────

/**
 * Fetch players with stats using the same approach as getGlobalLeaderboard.
 * Uses !inner so only profiles that have stats are returned.
 */
export async function getGalaxyPlayers(limit = 150): Promise<GalaxyPlayer[]> {
  if (!isSupabaseReady()) return []

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        avatar,
        settings,
        player_stats!inner(
          level, xp, wins, losses, matches_played,
          tournaments_finished, decks_created, best_streak,
          cards_collected, unlocked_achievements,
          active_title, social_reputation
        )
      `)
      .limit(limit)

    if (error || !data) {
      console.warn('[Galaxy] getGalaxyPlayers error:', error)
      return []
    }

    const players: GalaxyPlayer[] = []
    for (const row of data) {
      const r = row as Record<string, unknown>
      // player_stats can be array (one-to-many) or object (if Supabase detects 1:1)
      const stats = single(r.player_stats as Record<string, unknown> | Record<string, unknown>[] | null)
      if (!stats) continue

      const settings = r.settings as Record<string, unknown> | null

      players.push({
        userId: r.id as string,
        name: sanitizeName(r.name as string),
        avatar: (r.avatar as string) || '🎯',
        country: (settings?.country as string) || '',
        continent: (settings?.continent as string) || '',
        level: (stats.level as number) || 1,
        xp: (stats.xp as number) || 0,
        wins: (stats.wins as number) || 0,
        losses: (stats.losses as number) || 0,
        matchesPlayed: (stats.matches_played as number) || 0,
        tournamentsFinished: (stats.tournaments_finished as number) || 0,
        decksCreated: (stats.decks_created as number) || 0,
        bestStreak: (stats.best_streak as number) || 0,
        cardsCollected: (stats.cards_collected as number) || 0,
        unlockedAchievements: (stats.unlocked_achievements as string[]) || [],
        activeTitle: (stats.active_title as string) || '',
        socialReputation: (stats.social_reputation as number) || 0,
      })
    }

    return players
  } catch (e) {
    console.warn('[Galaxy] getGalaxyPlayers exception:', e)
    return []
  }
}

/**
 * Get ranked players by category.
 * Queries from player_stats side to use ordering by stat column directly.
 */
export async function getGalaxyRanking(
  category: RankingCategory,
  limit = 20,
): Promise<RankingEntry[]> {
  if (!isSupabaseReady()) return []

  const statColumn: Record<RankingCategory, string> = {
    xp: 'xp',
    wins: 'wins',
    tournaments: 'tournaments_finished',
    streak: 'best_streak',
    collection: 'cards_collected',
    achievements: 'xp', // re-sorted client-side by achievement count
  }

  try {
    const { data, error } = await supabase
      .from('player_stats')
      .select(`
        user_id,
        xp, level, wins,
        tournaments_finished, best_streak, cards_collected,
        unlocked_achievements,
        profiles!inner(name, avatar, settings)
      `)
      .order(statColumn[category], { ascending: false })
      .limit(limit * 2)

    if (error || !data) {
      console.warn('[Galaxy] getGalaxyRanking error:', error)
      return []
    }

    let entries: RankingEntry[] = data.map((row) => {
      const r = row as Record<string, unknown>
      // From player_stats side, profiles is many-to-one → single object, but use single() to be safe
      const profile = single(r.profiles as Record<string, unknown> | Record<string, unknown>[] | null)
      const settings = (profile?.settings as Record<string, unknown> | null)
      const achievements = (r.unlocked_achievements as string[]) || []

      const valueMap: Record<RankingCategory, number> = {
        xp: (r.xp as number) || 0,
        wins: (r.wins as number) || 0,
        tournaments: (r.tournaments_finished as number) || 0,
        streak: (r.best_streak as number) || 0,
        collection: (r.cards_collected as number) || 0,
        achievements: achievements.length,
      }

      return {
        rank: 0,
        userId: r.user_id as string,
        name: sanitizeName(profile?.name as string),
        avatar: (profile?.avatar as string) || '🎯',
        country: (settings?.country as string) || '',
        value: valueMap[category],
        level: (r.level as number) || 1,
        xp: (r.xp as number) || 0,
      }
    })

    if (category === 'achievements') {
      entries.sort((a, b) => b.value - a.value)
    }

    entries = entries.slice(0, limit)
    entries.forEach((e, i) => { e.rank = i + 1 })

    return entries
  } catch (e) {
    console.warn('[Galaxy] getGalaxyRanking exception:', e)
    return []
  }
}

/**
 * Get recent community posts from any country as the galaxy activity feed.
 */
export async function getGalaxyActivity(limit = 30): Promise<GalaxyActivity[]> {
  if (!isSupabaseReady()) return []

  try {
    const { data, error } = await supabase
      .from('community_posts')
      .select('id, user_id, user_name, user_avatar, country_code, content, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !data) {
      console.warn('[Galaxy] getGalaxyActivity error:', error)
      return []
    }

    return data.map((row) => ({
      id: row.id as string,
      type: 'post' as const,
      userId: row.user_id as string,
      userName: sanitizeName(row.user_name as string),
      userAvatar: (row.user_avatar as string) || '🎯',
      userCountry: (row.country_code as string) || '',
      message: (row.content as string) || '',
      detail: undefined,
      createdAt: row.created_at as string,
    }))
  } catch (e) {
    console.warn('[Galaxy] getGalaxyActivity exception:', e)
    return []
  }
}

/**
 * Get high-level galaxy stats: total players, countries, top country.
 */
export async function getGalaxyStats(): Promise<GalaxyStats> {
  if (!isSupabaseReady()) {
    return { totalPlayers: 0, countriesRepresented: 0, topCountry: '', topCountryCount: 0 }
  }

  try {
    // Total players: count all profiles that have stats
    const { count: totalCount } = await supabase
      .from('player_stats')
      .select('user_id', { count: 'exact', head: true })

    // Get settings to extract country data (limit to 500 to avoid huge payloads)
    const { data } = await supabase
      .from('profiles')
      .select('settings')
      .not('settings', 'is', null)
      .limit(500)

    const countMap = new Map<string, number>()
    if (data) {
      for (const row of data) {
        const settings = row.settings as Record<string, unknown> | null
        const country = (settings?.country as string) || ''
        if (country) {
          countMap.set(country, (countMap.get(country) || 0) + 1)
        }
      }
    }

    const countries = Array.from(countMap.entries()).sort((a, b) => b[1] - a[1])
    const topEntry = countries[0]

    return {
      totalPlayers: totalCount ?? 0,
      countriesRepresented: countries.length,
      topCountry: topEntry?.[0] || '',
      topCountryCount: topEntry?.[1] || 0,
    }
  } catch (e) {
    console.warn('[Galaxy] getGalaxyStats exception:', e)
    return { totalPlayers: 0, countriesRepresented: 0, topCountry: '', topCountryCount: 0 }
  }
}

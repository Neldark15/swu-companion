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

// ─── Main queries ────────────────────────────────────────

/**
 * Fetch all players with stats for the galaxy explorer.
 * Limit is applied server-side; client can search/filter the result.
 */
export async function getGalaxyPlayers(limit = 100): Promise<GalaxyPlayer[]> {
  if (!isSupabaseReady()) return []

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        avatar,
        settings,
        player_stats(
          level, xp, wins, losses, matches_played,
          tournaments_finished, decks_created, best_streak,
          cards_collected, unlocked_achievements,
          active_title, social_reputation
        )
      `)
      .limit(limit)

    if (error || !data) return []

    const players: GalaxyPlayer[] = []
    for (const row of data) {
      const r = row as Record<string, unknown>
      const stats = r.player_stats as Record<string, unknown> | null
      if (!stats) continue // skip users with no stats

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
  } catch {
    return []
  }
}

/**
 * Get ranked players by category.
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
    achievements: 'xp', // computed client-side from unlocked_achievements length
  }

  try {
    let query = supabase
      .from('player_stats')
      .select(`
        user_id,
        xp, level, wins, losses,
        tournaments_finished, best_streak, cards_collected,
        unlocked_achievements,
        profiles!inner(name, avatar, settings)
      `)

    if (category !== 'achievements') {
      query = query.order(statColumn[category], { ascending: false })
    } else {
      query = query.order('xp', { ascending: false })
    }

    query = query.limit(limit * 2) // fetch more to allow for achievement-based re-sort

    const { data, error } = await query
    if (error || !data) return []

    let entries: RankingEntry[] = data.map((row) => {
      const r = row as Record<string, unknown>
      const profile = r.profiles as Record<string, unknown>
      const settings = profile?.settings as Record<string, unknown> | null
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
  } catch {
    return []
  }
}

/**
 * Get recent community posts from any country as galaxy activity.
 */
export async function getGalaxyActivity(limit = 30): Promise<GalaxyActivity[]> {
  if (!isSupabaseReady()) return []

  try {
    const { data, error } = await supabase
      .from('community_posts')
      .select('id, user_id, user_name, user_avatar, country_code, content, type, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []

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
  } catch {
    return []
  }
}

/**
 * Get high-level galaxy stats.
 */
export async function getGalaxyStats(): Promise<GalaxyStats> {
  if (!isSupabaseReady()) {
    return { totalPlayers: 0, countriesRepresented: 0, topCountry: '', topCountryCount: 0 }
  }

  try {
    const { data, count } = await supabase
      .from('profiles')
      .select('settings', { count: 'exact' })
      .not('settings', 'is', null)

    const total = count ?? 0
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

    const countries = Array.from(countMap.entries())
    const topEntry = countries.sort((a, b) => b[1] - a[1])[0]

    return {
      totalPlayers: total,
      countriesRepresented: countries.length,
      topCountry: topEntry?.[0] || '',
      topCountryCount: topEntry?.[1] || 0,
    }
  } catch {
    return { totalPlayers: 0, countriesRepresented: 0, topCountry: '', topCountryCount: 0 }
  }
}

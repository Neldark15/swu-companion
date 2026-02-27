/**
 * Sync Service — Supabase ↔ Dexie
 * Supabase = source of truth, Dexie = offline cache
 */

import { supabase, isSupabaseReady } from './supabase'
import { db } from './db'
import type { PlayerStats } from './gamification'

// ─── HELPERS ────────────────────────────────────────────────────

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Convert camelCase PlayerStats to snake_case for Supabase */
function statsToSnake(stats: PlayerStats, userId: string) {
  return {
    user_id: userId,
    xp: stats.xp,
    level: stats.level,
    wins: stats.wins,
    losses: stats.losses,
    matches_played: stats.matchesPlayed,
    tournaments_created: stats.tournamentsCreated,
    tournaments_finished: stats.tournamentsFinished,
    decks_created: stats.decksCreated,
    decks_valid: stats.decksValid,
    cards_collected: stats.cardsCollected,
    cards_favorited: stats.cardsFavorited,
    current_streak: stats.currentStreak,
    best_streak: stats.bestStreak,
    login_days: stats.loginDays,
    last_login_date: stats.lastLoginDate,
    modes_played: stats.modesPlayed,
    unlocked_achievements: stats.unlockedAchievements,
    achievement_dates: stats.achievementDates,
    updated_at: new Date().toISOString(),
  }
}

/** Convert snake_case from Supabase to camelCase PlayerStats */
function statsFromSnake(row: Record<string, unknown>, profileId: string): PlayerStats {
  return {
    profileId,
    xp: (row.xp as number) || 0,
    level: (row.level as number) || 1,
    wins: (row.wins as number) || 0,
    losses: (row.losses as number) || 0,
    matchesPlayed: (row.matches_played as number) || 0,
    tournamentsCreated: (row.tournaments_created as number) || 0,
    tournamentsFinished: (row.tournaments_finished as number) || 0,
    decksCreated: (row.decks_created as number) || 0,
    decksValid: (row.decks_valid as number) || 0,
    cardsCollected: (row.cards_collected as number) || 0,
    cardsFavorited: (row.cards_favorited as number) || 0,
    currentStreak: (row.current_streak as number) || 0,
    bestStreak: (row.best_streak as number) || 0,
    loginDays: (row.login_days as number) || 1,
    lastLoginDate: (row.last_login_date as string) || new Date().toISOString().split('T')[0],
    modesPlayed: (row.modes_played as string[]) || [],
    unlockedAchievements: (row.unlocked_achievements as string[]) || ['vil_1'],
    achievementDates: (row.achievement_dates as Record<string, number>) || {},
  }
}

// ─── PROFILE SYNC ───────────────────────────────────────────────

export async function syncProfileToCloud(userId: string, name: string, avatar: string) {
  if (!isSupabaseReady()) return
  try {
    await supabase.from('profiles').upsert({
      id: userId,
      name,
      avatar,
    })
  } catch (e) {
    console.warn('[Sync] Failed to sync profile:', e)
  }
}

// ─── STATS SYNC ─────────────────────────────────────────────────

export async function syncStatsToCloud(userId: string, stats: PlayerStats) {
  if (!isSupabaseReady()) return
  try {
    await supabase.from('player_stats').upsert(statsToSnake(stats, userId))
  } catch (e) {
    console.warn('[Sync] Failed to sync stats:', e)
  }
}

export async function pullStatsFromCloud(userId: string, localProfileId: string): Promise<PlayerStats | null> {
  if (!isSupabaseReady()) return null
  try {
    const { data, error } = await supabase
      .from('player_stats')
      .select('*')
      .eq('user_id', userId)
      .single()
    if (error || !data) return null
    return statsFromSnake(data, localProfileId)
  } catch {
    return null
  }
}

// ─── MONTHLY XP (RANK DEL MES) ─────────────────────────────────

export async function addMonthlyXp(userId: string, xpAmount: number) {
  if (!isSupabaseReady()) return
  const month = getCurrentMonth()
  try {
    // Try to increment existing record
    const { data } = await supabase
      .from('monthly_xp')
      .select('xp_gained')
      .eq('user_id', userId)
      .eq('month', month)
      .single()

    if (data) {
      await supabase
        .from('monthly_xp')
        .update({ xp_gained: data.xp_gained + xpAmount, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('month', month)
    } else {
      await supabase
        .from('monthly_xp')
        .insert({ user_id: userId, month, xp_gained: xpAmount })
    }
  } catch (e) {
    console.warn('[Sync] Failed to add monthly XP:', e)
  }
}

export interface LeaderboardEntry {
  userId: string
  name: string
  avatar: string
  xpGained: number
  level: number
  rank: number
}

export async function getMonthlyLeaderboard(month?: string): Promise<LeaderboardEntry[]> {
  if (!isSupabaseReady()) return []
  const targetMonth = month || getCurrentMonth()
  try {
    const { data, error } = await supabase
      .from('monthly_xp')
      .select(`
        user_id,
        xp_gained,
        profiles!inner(name, avatar),
        player_stats!inner(level)
      `)
      .eq('month', targetMonth)
      .order('xp_gained', { ascending: false })
      .limit(20)

    if (error || !data) return []

    return data.map((row: Record<string, unknown>, index: number) => {
      const profile = row.profiles as Record<string, unknown>
      const stats = row.player_stats as Record<string, unknown>
      return {
        userId: row.user_id as string,
        name: (profile?.name as string) || 'Jugador',
        avatar: (profile?.avatar as string) || '🎯',
        xpGained: (row.xp_gained as number) || 0,
        level: (stats?.level as number) || 1,
        rank: index + 1,
      }
    })
  } catch {
    return []
  }
}

export async function getMyMonthlyXp(userId: string, month?: string): Promise<number> {
  if (!isSupabaseReady()) return 0
  const targetMonth = month || getCurrentMonth()
  try {
    const { data } = await supabase
      .from('monthly_xp')
      .select('xp_gained')
      .eq('user_id', userId)
      .eq('month', targetMonth)
      .single()
    return data?.xp_gained || 0
  } catch {
    return 0
  }
}

// ─── FULL PULL (on login) ───────────────────────────────────────

export async function pullAllFromCloud(userId: string, localProfileId: string) {
  if (!isSupabaseReady()) return

  // Pull stats
  const cloudStats = await pullStatsFromCloud(userId, localProfileId)
  if (cloudStats) {
    await db.playerStats.put(cloudStats)
  }

  // Pull matches
  try {
    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .eq('user_id', userId)
    if (matches) {
      for (const m of matches) {
        const localMatch = { ...m.data, id: m.id, profileId: localProfileId }
        await db.matches.put(localMatch)
      }
    }
  } catch { /* offline */ }

  // Pull decks
  try {
    const { data: decks } = await supabase
      .from('decks')
      .select('*')
      .eq('user_id', userId)
    if (decks) {
      for (const d of decks) {
        const localDeck = { ...d.data, id: d.id, name: d.name, format: d.format, profileId: localProfileId }
        await db.decks.put(localDeck)
      }
    }
  } catch { /* offline */ }

  // Pull collection
  try {
    const { data: coll } = await supabase
      .from('collection')
      .select('*')
      .eq('user_id', userId)
    if (coll) {
      for (const c of coll) {
        await db.collection.put({ cardId: c.card_id, quantity: c.quantity, profileId: localProfileId })
      }
    }
  } catch { /* offline */ }

  // Pull favorites
  try {
    const { data: favs } = await supabase
      .from('favorite_cards')
      .select('*')
      .eq('user_id', userId)
    if (favs) {
      for (const f of favs) {
        await db.favoriteCards.put({ cardId: f.card_id, profileId: localProfileId })
      }
    }
  } catch { /* offline */ }
}

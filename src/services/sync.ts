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
    tournament_wins: stats.tournamentWins,
    tournament_top_placements: stats.tournamentTopPlacements,
    decks_created: stats.decksCreated,
    decks_valid: stats.decksValid,
    cards_collected: stats.cardsCollected,
    cards_favorited: stats.cardsFavorited,
    legendary_cards: stats.legendaryCards,
    rare_cards: stats.rareCards,
    current_streak: stats.currentStreak,
    best_streak: stats.bestStreak,
    login_days: stats.loginDays,
    last_login_date: stats.lastLoginDate,
    modes_played: stats.modesPlayed,
    arena_matches_logged: stats.arenaMatchesLogged,
    gifts_received: stats.giftsReceived,
    gifts_sent: stats.giftsSent,
    lecciones_jedi_received: stats.leccionesJediReceived,
    creditos_imperiales_received: stats.creditosImperialesReceived,
    beskar_received: stats.beskarReceived,
    holocron_received: stats.holocronReceived,
    cristal_kyber_received: stats.cristalKyberReceived,
    daily_missions_completed: stats.dailyMissionsCompleted,
    weekly_missions_completed: stats.weeklyMissionsCompleted,
    social_reputation: stats.socialReputation,
    active_title: stats.activeTitle,
    unlocked_titles: stats.unlockedTitles,
    mission_streak: stats.missionStreak,
    best_mission_streak: stats.bestMissionStreak,
    relationship_count: stats.relationshipCount,
    unlocked_achievements: stats.unlockedAchievements,
    achievement_dates: stats.achievementDates,
    updated_at: new Date().toISOString(),
  }
}

/** Convert snake_case from Supabase to camelCase PlayerStats */
export function statsFromSnake(row: Record<string, unknown>, profileId: string): PlayerStats {
  return {
    profileId,
    xp: (row.xp as number) || 0,
    level: (row.level as number) || 1,
    wins: (row.wins as number) || 0,
    losses: (row.losses as number) || 0,
    matchesPlayed: (row.matches_played as number) || 0,
    tournamentsCreated: (row.tournaments_created as number) || 0,
    tournamentsFinished: (row.tournaments_finished as number) || 0,
    tournamentWins: (row.tournament_wins as number) || 0,
    tournamentTopPlacements: (row.tournament_top_placements as number) || 0,
    decksCreated: (row.decks_created as number) || 0,
    decksValid: (row.decks_valid as number) || 0,
    cardsCollected: (row.cards_collected as number) || 0,
    cardsFavorited: (row.cards_favorited as number) || 0,
    legendaryCards: (row.legendary_cards as number) || 0,
    rareCards: (row.rare_cards as number) || 0,
    currentStreak: (row.current_streak as number) || 0,
    bestStreak: (row.best_streak as number) || 0,
    loginDays: (row.login_days as number) || 1,
    lastLoginDate: (row.last_login_date as string) || new Date().toISOString().split('T')[0],
    modesPlayed: (row.modes_played as string[]) || [],
    arenaMatchesLogged: (row.arena_matches_logged as number) || 0,
    giftsReceived: (row.gifts_received as number) || 0,
    giftsSent: (row.gifts_sent as number) || 0,
    leccionesJediReceived: (row.lecciones_jedi_received as number) || 0,
    creditosImperialesReceived: (row.creditos_imperiales_received as number) || 0,
    beskarReceived: (row.beskar_received as number) || 0,
    holocronReceived: (row.holocron_received as number) || 0,
    cristalKyberReceived: (row.cristal_kyber_received as number) || 0,
    dailyMissionsCompleted: (row.daily_missions_completed as number) || 0,
    weeklyMissionsCompleted: (row.weekly_missions_completed as number) || 0,
    socialReputation: (row.social_reputation as number) || 0,
    activeTitle: (row.active_title as string) || '',
    unlockedTitles: (row.unlocked_titles as string[]) || [],
    missionStreak: (row.mission_streak as number) || 0,
    bestMissionStreak: (row.best_mission_streak as number) || 0,
    relationshipCount: (row.relationship_count as number) || 0,
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

// ─── DECK SYNC ─────────────────────────────────────────────────

import type { Deck } from '../types'

export async function syncDeckToCloud(userId: string, deck: Deck) {
  if (!isSupabaseReady()) return
  try {
    const payload = {
      id: deck.id,
      user_id: userId,
      name: deck.name,
      format: deck.format,
      data: {
        leaders: deck.leaders,
        base: deck.base,
        mainDeck: deck.mainDeck,
        sideboard: deck.sideboard,
        isValid: deck.isValid,
        validationErrors: deck.validationErrors,
        isPublic: deck.isPublic ?? true,
        createdAt: deck.createdAt,
        updatedAt: deck.updatedAt,
      },
    }
    const { error } = await supabase.from('decks').upsert(payload)
    if (error) {
      console.error('[Sync] Deck upsert error:', error.code, error.message, error.details, error.hint)
    } else {
      console.log('[Sync] Deck synced OK:', deck.id, deck.name)
    }
  } catch (e) {
    console.error('[Sync] Failed to sync deck (exception):', e)
  }
}

/** Pull decks from Supabase and merge into local IndexedDB */
export async function pullDecksFromCloud(userId: string): Promise<boolean> {
  if (!isSupabaseReady()) return false
  try {
    const { data: decks, error } = await supabase
      .from('decks')
      .select('*')
      .eq('user_id', userId)
    if (error) {
      console.error('[Sync] Pull decks error:', error.code, error.message)
      return false
    }
    if (!decks) return false
    console.log(`[Sync] Pulled ${decks.length} decks from cloud`)

    const localDecks = decks.map(d => ({
      ...d.data,
      id: d.id,
      name: d.name,
      format: d.format,
      isPublic: d.data?.isPublic ?? true,
    }))
    await db.decks.bulkPut(localDecks)
    return true
  } catch (e) {
    console.error('[Sync] Pull decks exception:', e)
    return false
  }
}

/** DeckCard shape for visual viewer */
export interface PublicDeckCard {
  cardId: string
  name: string
  subtitle: string | null
  quantity: number
  setCode: string
}

/** Full public deck info including all cards */
export interface PublicDeck {
  id: string
  name: string
  format: string
  isValid: boolean
  leaderName: string
  leaderCardId: string
  baseName: string
  baseCardId: string
  mainDeckCount: number
  leaders: PublicDeckCard[]
  base: PublicDeckCard | null
  mainDeck: PublicDeckCard[]
  sideboard: PublicDeckCard[]
}

/** Get public decks for a user (for spy profile).
 *  Reads isPublic from the `data` JSON column since the table may not have
 *  a dedicated `is_public` column yet. Filters client-side. */
export async function getPublicDecks(userId: string): Promise<PublicDeck[]> {
  if (!isSupabaseReady()) return []
  try {
    const { data, error } = await supabase
      .from('decks')
      .select('id, name, format, data')
      .eq('user_id', userId)
    if (error) {
      console.error('[Sync] Public decks query error:', error.code, error.message)
      return []
    }
    if (!data) return []
    console.log(`[Sync] Found ${data.length} decks for spy profile, userId=${userId}`)

    return data
      .filter(d => {
        const deck = d.data as Record<string, unknown> | null
        return deck ? (deck.isPublic !== false) : true
      })
      .map(d => {
        const deck = d.data as Record<string, unknown> || {}
        const leaders = (deck.leaders as PublicDeckCard[]) || []
        const base = deck.base as PublicDeckCard | null
        const mainDeck = (deck.mainDeck as PublicDeckCard[]) || []
        const sideboard = (deck.sideboard as PublicDeckCard[]) || []
        const mainCount = mainDeck.reduce((s, c) => s + (c.quantity || 1), 0)
        return {
          id: d.id,
          name: d.name,
          format: d.format,
          isValid: (deck.isValid as boolean) ?? false,
          leaderName: leaders[0]?.name || '',
          leaderCardId: leaders[0]?.cardId || '',
          baseName: base?.name || '',
          baseCardId: base?.cardId || '',
          mainDeckCount: mainCount,
          leaders,
          base,
          mainDeck,
          sideboard,
        }
      })
  } catch (e) {
    console.warn('[Sync] Failed to get public decks:', e)
    return []
  }
}

export async function deleteDeckFromCloud(deckId: string) {
  if (!isSupabaseReady()) return
  try {
    await supabase.from('decks').delete().eq('id', deckId)
  } catch (e) {
    console.warn('[Sync] Failed to delete deck from cloud:', e)
  }
}

// ─── GLOBAL LEADERBOARD ──────────────────────────────────────────

export interface GlobalLeaderboardEntry {
  userId: string
  name: string
  avatar: string
  level: number
  xp: number
  wins: number
  losses: number
  matchesPlayed: number
  tournamentsFinished: number
  tournamentsCreated: number
  decksCreated: number
  bestStreak: number
  unlockedAchievements: string[]
}

export async function getGlobalLeaderboard(): Promise<GlobalLeaderboardEntry[]> {
  if (!isSupabaseReady()) return []
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        avatar,
        player_stats!inner(
          level, xp, wins, losses, matches_played,
          tournaments_finished, tournaments_created,
          decks_created, best_streak, unlocked_achievements
        )
      `)
      .order('name')

    if (error || !data) return []

    return data.map((row: Record<string, unknown>) => {
      const stats = row.player_stats as Record<string, unknown>
      return {
        userId: row.id as string,
        name: (row.name as string) || 'Jugador',
        avatar: (row.avatar as string) || '🎯',
        level: (stats?.level as number) || 1,
        xp: (stats?.xp as number) || 0,
        wins: (stats?.wins as number) || 0,
        losses: (stats?.losses as number) || 0,
        matchesPlayed: (stats?.matches_played as number) || 0,
        tournamentsFinished: (stats?.tournaments_finished as number) || 0,
        tournamentsCreated: (stats?.tournaments_created as number) || 0,
        decksCreated: (stats?.decks_created as number) || 0,
        bestStreak: (stats?.best_streak as number) || 0,
        unlockedAchievements: (stats?.unlocked_achievements as string[]) || [],
      }
    })
      // Sort: tournaments finished DESC, then wins DESC, then XP DESC
      .sort((a, b) =>
        b.tournamentsFinished - a.tournamentsFinished ||
        b.wins - a.wins ||
        b.xp - a.xp
      )
  } catch {
    return []
  }
}

// ─── COLLECTION SYNC ────────────────────────────────────────────

export async function syncCollectionItemToCloud(userId: string, cardId: string, quantity: number) {
  if (!isSupabaseReady()) return
  try {
    if (quantity <= 0) {
      await supabase.from('collection').delete()
        .eq('user_id', userId)
        .eq('card_id', cardId)
    } else {
      await supabase.from('collection').upsert({
        user_id: userId,
        card_id: cardId,
        quantity,
      })
    }
  } catch (e) {
    console.warn('[Sync] Failed to sync collection item:', e)
  }
}

export async function syncFullCollectionToCloud(userId: string) {
  if (!isSupabaseReady()) return
  try {
    const items = await db.collection.toArray()
    if (items.length === 0) return

    // Batch upsert
    const rows = items.map(c => ({
      user_id: userId,
      card_id: c.cardId,
      quantity: c.quantity || 1,
    }))
    await supabase.from('collection').upsert(rows)
  } catch (e) {
    console.warn('[Sync] Failed to sync full collection:', e)
  }
}

// ─── FAVORITES SYNC ─────────────────────────────────────────────

export async function syncFavoriteToCloud(userId: string, cardId: string, isFavorite: boolean) {
  if (!isSupabaseReady()) return
  try {
    if (isFavorite) {
      await supabase.from('favorite_cards').upsert({
        user_id: userId,
        card_id: cardId,
      })
    } else {
      await supabase.from('favorite_cards').delete()
        .eq('user_id', userId)
        .eq('card_id', cardId)
    }
  } catch (e) {
    console.warn('[Sync] Failed to sync favorite:', e)
  }
}

export async function syncAllFavoritesToCloud(userId: string) {
  if (!isSupabaseReady()) return
  try {
    const favs = await db.favoriteCards.toArray()
    if (favs.length === 0) return

    const rows = favs.map(f => ({
      user_id: userId,
      card_id: f.cardId,
    }))
    await supabase.from('favorite_cards').upsert(rows)
  } catch (e) {
    console.warn('[Sync] Failed to sync all favorites:', e)
  }
}

// ─── SETTINGS SYNC ──────────────────────────────────────────────

export async function syncSettingsToCloud(userId: string, settings: Record<string, unknown>) {
  if (!isSupabaseReady()) return
  try {
    await supabase.from('profiles').update({
      settings,
    }).eq('id', userId)
  } catch (e) {
    console.warn('[Sync] Failed to sync settings:', e)
  }
}

export async function pullSettingsFromCloud(userId: string): Promise<Record<string, unknown> | null> {
  if (!isSupabaseReady()) return null
  try {
    const { data } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', userId)
      .single()
    return (data?.settings as Record<string, unknown>) || null
  } catch {
    return null
  }
}

// ─── FULL PULL (on login) ───────────────────────────────────────

export async function pullAllFromCloud(userId: string, localProfileId: string) {
  if (!isSupabaseReady()) return

  console.log('[Sync] Starting full pull from cloud for user:', userId)

  // Pull profile (name, avatar, settings) — ensures new devices get the latest
  try {
    const { data: cloudProfile } = await supabase
      .from('profiles')
      .select('name, avatar, settings')
      .eq('id', userId)
      .single()
    if (cloudProfile) {
      const localProfile = await db.profiles.get(localProfileId)
      if (localProfile) {
        const updated = {
          ...localProfile,
          name: cloudProfile.name || localProfile.name,
          avatar: cloudProfile.avatar || localProfile.avatar,
        }
        await db.profiles.put(updated)
      }

      // Restore settings to localStorage if cloud has them
      if (cloudProfile.settings && typeof cloudProfile.settings === 'object') {
        const settings = cloudProfile.settings as Record<string, unknown>
        if (Object.keys(settings).length > 0) {
          const existing = localStorage.getItem('swu-settings')
          if (!existing || existing === '{}') {
            localStorage.setItem('swu-settings', JSON.stringify({ state: settings, version: 0 }))
            console.log('[Sync] Restored settings from cloud')
          }
        }
      }
    }
  } catch { /* offline */ }

  // Pull stats
  const cloudStats = await pullStatsFromCloud(userId, localProfileId)
  if (cloudStats) {
    // Merge: keep higher values (cloud wins if XP/wins are higher)
    const localStats = await db.playerStats.get(localProfileId)
    if (localStats) {
      const merged = {
        ...cloudStats,
        xp: Math.max(cloudStats.xp, localStats.xp),
        wins: Math.max(cloudStats.wins, localStats.wins),
        losses: Math.max(cloudStats.losses, localStats.losses),
        matchesPlayed: Math.max(cloudStats.matchesPlayed, localStats.matchesPlayed),
        bestStreak: Math.max(cloudStats.bestStreak, localStats.bestStreak),
        decksCreated: Math.max(cloudStats.decksCreated, localStats.decksCreated),
        tournamentsFinished: Math.max(cloudStats.tournamentsFinished, localStats.tournamentsFinished),
        tournamentWins: Math.max(cloudStats.tournamentWins, localStats.tournamentWins),
        tournamentTopPlacements: Math.max(cloudStats.tournamentTopPlacements, localStats.tournamentTopPlacements),
        legendaryCards: Math.max(cloudStats.legendaryCards, localStats.legendaryCards),
        rareCards: Math.max(cloudStats.rareCards, localStats.rareCards),
        arenaMatchesLogged: Math.max(cloudStats.arenaMatchesLogged, localStats.arenaMatchesLogged),
        giftsReceived: Math.max(cloudStats.giftsReceived, localStats.giftsReceived),
        giftsSent: Math.max(cloudStats.giftsSent, localStats.giftsSent),
        leccionesJediReceived: Math.max(cloudStats.leccionesJediReceived, localStats.leccionesJediReceived),
        creditosImperialesReceived: Math.max(cloudStats.creditosImperialesReceived, localStats.creditosImperialesReceived),
        beskarReceived: Math.max(cloudStats.beskarReceived, localStats.beskarReceived),
        holocronReceived: Math.max(cloudStats.holocronReceived, localStats.holocronReceived),
        cristalKyberReceived: Math.max(cloudStats.cristalKyberReceived, localStats.cristalKyberReceived),
        dailyMissionsCompleted: Math.max(cloudStats.dailyMissionsCompleted, localStats.dailyMissionsCompleted),
        weeklyMissionsCompleted: Math.max(cloudStats.weeklyMissionsCompleted, localStats.weeklyMissionsCompleted),
        socialReputation: Math.max(cloudStats.socialReputation, localStats.socialReputation),
        missionStreak: Math.max(cloudStats.missionStreak, localStats.missionStreak),
        bestMissionStreak: Math.max(cloudStats.bestMissionStreak, localStats.bestMissionStreak),
        relationshipCount: Math.max(cloudStats.relationshipCount, localStats.relationshipCount),
        // Non-numeric fields: keep the more complete/recent value
        currentStreak: Math.max(cloudStats.currentStreak, localStats.currentStreak),
        loginDays: Math.max(cloudStats.loginDays, localStats.loginDays),
        lastLoginDate: cloudStats.lastLoginDate > localStats.lastLoginDate ? cloudStats.lastLoginDate : localStats.lastLoginDate,
        modesPlayed: Array.from(new Set([...cloudStats.modesPlayed, ...localStats.modesPlayed])),
        activeTitle: cloudStats.activeTitle || localStats.activeTitle,
        unlockedTitles: Array.from(new Set([...cloudStats.unlockedTitles, ...localStats.unlockedTitles])),
        unlockedAchievements: Array.from(new Set([...cloudStats.unlockedAchievements, ...localStats.unlockedAchievements])),
        achievementDates: { ...localStats.achievementDates, ...cloudStats.achievementDates },
      }
      await db.playerStats.put(merged)
      // Push merged stats back to cloud so both sides stay in sync
      syncStatsToCloud(userId, merged).catch(() => {})
    } else {
      await db.playerStats.put(cloudStats)
    }
    console.log('[Sync] Stats pulled from cloud')
  }

  // Pull matches, decks, collection, favorites — ALL IN PARALLEL with bulkPut
  const results = await Promise.allSettled([
    // Matches
    supabase.from('matches').select('*').eq('user_id', userId).then(({ data }) => {
      if (data && data.length > 0) {
        const items = data.map(m => ({ ...m.data, id: m.id, profileId: localProfileId }))
        return db.matches.bulkPut(items).then(() => console.log(`[Sync] Pulled ${data.length} matches`))
      }
    }),
    // Decks
    supabase.from('decks').select('*').eq('user_id', userId).then(({ data }) => {
      if (data && data.length > 0) {
        const items = data.map(d => ({ ...d.data, id: d.id, name: d.name, format: d.format, isPublic: d.data?.isPublic ?? true, profileId: localProfileId }))
        return db.decks.bulkPut(items).then(() => console.log(`[Sync] Pulled ${data.length} decks`))
      }
    }),
    // Collection
    supabase.from('collection').select('*').eq('user_id', userId).then(({ data }) => {
      if (data && data.length > 0) {
        const items = data.map(c => ({ cardId: c.card_id, quantity: c.quantity, profileId: localProfileId }))
        return db.collection.bulkPut(items).then(() => console.log(`[Sync] Pulled ${data.length} collection items`))
      }
    }),
    // Favorites
    supabase.from('favorite_cards').select('*').eq('user_id', userId).then(({ data }) => {
      if (data && data.length > 0) {
        const items = data.map(f => ({ cardId: f.card_id, profileId: localProfileId }))
        return db.favoriteCards.bulkPut(items).then(() => console.log(`[Sync] Pulled ${data.length} favorites`))
      }
    }),
  ])

  // Log any failures
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.warn(`[Sync] Pull #${i} failed:`, r.reason)
  })

  console.log('[Sync] Full pull complete')
}

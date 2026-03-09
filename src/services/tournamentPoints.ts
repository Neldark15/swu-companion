/**
 * Tournament Points — Awards XP, stats, and ranking points
 * to linked Supabase accounts from local tournaments
 */

import { supabase, isSupabaseReady } from './supabase'
import { addMonthlyXp } from './sync'
import { XP_VALUES, calculateLevel } from './gamification'
import { db } from './db'

/** Detect names that look like UIDs/tokens and return 'Jugador' instead */
function sanitizeDisplayName(name: string | null | undefined): string {
  if (!name) return 'Jugador'
  if (name.length >= 20 && !/\s/.test(name) && /^[a-zA-Z0-9_\-]+$/.test(name)) return 'Jugador'
  return name
}

// Position-based tournament points (mixto system)
const POSITION_POINTS: Record<number, number> = {
  1: 10,
  2: 7,
  3: 5,
  4: 3,
}
const PARTICIPATION_POINTS = 1

// ─── Award Match Result ─────────────────────────────────────

/**
 * Award XP and stats to a linked player after a match result
 * Called immediately when a result is reported
 */
export async function awardMatchResult(
  supabaseUserId: string,
  isWinner: boolean,
  isDraw: boolean,
  _gameScore: [number, number] // [myGames, oppGames]
): Promise<void> {
  if (!isSupabaseReady()) return

  try {
    // Pull current stats
    const { data: current } = await supabase
      .from('player_stats')
      .select('*')
      .eq('user_id', supabaseUserId)
      .single()

    if (!current) return

    // Calculate XP earned
    let xpEarned = XP_VALUES.match_played
    if (isWinner) xpEarned += XP_VALUES.match_won

    // Update stats
    const updates: Record<string, number | string> = {
      xp: (current.xp || 0) + xpEarned,
      matches_played: (current.matches_played || 0) + 1,
      updated_at: new Date().toISOString() as unknown as number,
    }

    if (isWinner) {
      updates.wins = (current.wins || 0) + 1
    } else if (!isDraw) {
      updates.losses = (current.losses || 0) + 1
    }

    // Recalculate level
    updates.level = calculateLevel(updates.xp as number).level

    await supabase
      .from('player_stats')
      .update(updates)
      .eq('user_id', supabaseUserId)

    // Add monthly XP
    await addMonthlyXp(supabaseUserId, xpEarned)

    // Also update local Dexie cache if this user has a local profile
    try {
      const allStats = await db.playerStats.toArray()
      // Find local stats that might correspond (by checking linked profiles)
      for (const localStats of allStats) {
        const profile = await db.profiles.get(localStats.profileId)
        if (profile?.email) {
          // Profile exists, update if it's the same user
          const localUpdate = { ...localStats }
          localUpdate.xp = (localUpdate.xp || 0) + xpEarned
          localUpdate.matchesPlayed = (localUpdate.matchesPlayed || 0) + 1
          if (isWinner) localUpdate.wins = (localUpdate.wins || 0) + 1
          else if (!isDraw) localUpdate.losses = (localUpdate.losses || 0) + 1
          localUpdate.level = calculateLevel(localUpdate.xp).level
          await db.playerStats.put(localUpdate)
          break
        }
      }
    } catch {
      // Local update is best-effort
    }
  } catch (e) {
    console.warn('[TournamentPoints] Failed to award match result:', e)
  }
}

// ─── Award Tournament Finish ────────────────────────────────

/**
 * Award tournament completion points and save result
 * Called when the tournament is finalized
 */
export async function awardTournamentFinish(
  supabaseUserId: string,
  position: number,
  totalPlayers: number,
  tournamentName: string,
  matchWins: number,
  matchDraws: number
): Promise<void> {
  if (!isSupabaseReady()) return

  try {
    // Calculate position points (mixto)
    const positionPts = POSITION_POINTS[position] || PARTICIPATION_POINTS
    // Victory bonus: 3 per win, 1 per draw
    const victoryBonus = (matchWins * 3) + (matchDraws * 1)
    const totalRankingPoints = positionPts + victoryBonus

    // XP for finishing a tournament
    const xpEarned = XP_VALUES.tournament_finished

    // Update player_stats
    const { data: current } = await supabase
      .from('player_stats')
      .select('xp, tournaments_finished, level')
      .eq('user_id', supabaseUserId)
      .single()

    if (current) {
      const newXp = (current.xp || 0) + xpEarned
      await supabase
        .from('player_stats')
        .update({
          xp: newXp,
          level: calculateLevel(newXp).level,
          tournaments_finished: (current.tournaments_finished || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', supabaseUserId)
    }

    // Save tournament result for ranking history
    await supabase.from('tournament_results').insert({
      user_id: supabaseUserId,
      tournament_name: tournamentName,
      position,
      total_players: totalPlayers,
      ranking_points: totalRankingPoints,
      match_wins: matchWins,
      match_draws: matchDraws,
      xp_earned: xpEarned,
    })

    // Monthly XP
    await addMonthlyXp(supabaseUserId, xpEarned)
  } catch (e) {
    console.warn('[TournamentPoints] Failed to award tournament finish:', e)
  }
}

// ─── Get Ranking Points ─────────────────────────────────────

export interface RankingEntry {
  userId: string
  name: string
  avatar: string
  totalRankingPoints: number
  tournamentCount: number
  bestPosition: number
  totalWins: number
}

/**
 * Get global ranking based on tournament results (mixto system)
 */
export async function getGlobalTournamentRanking(): Promise<RankingEntry[]> {
  if (!isSupabaseReady()) return []

  try {
    const { data, error } = await supabase
      .from('tournament_results')
      .select(`
        user_id,
        ranking_points,
        position,
        match_wins,
        profiles!inner(name, avatar)
      `)

    if (error || !data) return []

    // Aggregate by user
    const userMap = new Map<string, RankingEntry>()
    for (const row of data) {
      const profile = row.profiles as unknown as { name: string; avatar: string }
      const existing = userMap.get(row.user_id)
      if (existing) {
        existing.totalRankingPoints += row.ranking_points || 0
        existing.tournamentCount += 1
        existing.bestPosition = Math.min(existing.bestPosition, row.position || 999)
        existing.totalWins += row.match_wins || 0
      } else {
        userMap.set(row.user_id, {
          userId: row.user_id,
          name: sanitizeDisplayName(profile?.name),
          avatar: profile?.avatar || '🎯',
          totalRankingPoints: row.ranking_points || 0,
          tournamentCount: 1,
          bestPosition: row.position || 999,
          totalWins: row.match_wins || 0,
        })
      }
    }

    return [...userMap.values()].sort(
      (a, b) => b.totalRankingPoints - a.totalRankingPoints || b.totalWins - a.totalWins
    )
  } catch {
    return []
  }
}

/**
 * Get monthly tournament ranking
 */
export async function getMonthlyTournamentRanking(month?: string): Promise<RankingEntry[]> {
  if (!isSupabaseReady()) return []

  const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const startDate = `${targetMonth}-01`
  const [y, m] = targetMonth.split('-').map(Number)
  const endDate = `${y}-${String(m + 1).padStart(2, '0')}-01`

  try {
    const { data, error } = await supabase
      .from('tournament_results')
      .select(`
        user_id,
        ranking_points,
        position,
        match_wins,
        profiles!inner(name, avatar)
      `)
      .gte('played_at', startDate)
      .lt('played_at', endDate)

    if (error || !data) return []

    const userMap = new Map<string, RankingEntry>()
    for (const row of data) {
      const profile = row.profiles as unknown as { name: string; avatar: string }
      const existing = userMap.get(row.user_id)
      if (existing) {
        existing.totalRankingPoints += row.ranking_points || 0
        existing.tournamentCount += 1
        existing.bestPosition = Math.min(existing.bestPosition, row.position || 999)
        existing.totalWins += row.match_wins || 0
      } else {
        userMap.set(row.user_id, {
          userId: row.user_id,
          name: sanitizeDisplayName(profile?.name),
          avatar: profile?.avatar || '🎯',
          totalRankingPoints: row.ranking_points || 0,
          tournamentCount: 1,
          bestPosition: row.position || 999,
          totalWins: row.match_wins || 0,
        })
      }
    }

    return [...userMap.values()].sort(
      (a, b) => b.totalRankingPoints - a.totalRankingPoints || b.totalWins - a.totalWins
    )
  } catch {
    return []
  }
}

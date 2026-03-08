/**
 * Arena Service — Holocrón de Duelos
 * Business logic for match logging, stats calculation, and public feed
 */

import { db } from './db'
import { supabase, isSupabaseReady } from './supabase'
import type { MatchLog, ArenaStats, GameMode } from '../types'

function generateId(): string {
  return `ml_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/* ── Log a match ── */
export async function logMatch(
  data: Omit<MatchLog, 'id' | 'createdAt'>,
  userId?: string,
): Promise<MatchLog> {
  const log: MatchLog = {
    ...data,
    id: generateId(),
    userId: userId || data.userId,
    createdAt: Date.now(),
  }

  // Save locally
  await db.matchLogs.put(log)

  // Sync to Supabase if ready
  if (isSupabaseReady() && userId) {
    try {
      await supabase.from('match_logs').upsert({
        id: log.id,
        user_id: userId,
        player1_name: log.player1Name,
        player2_name: log.player2Name,
        player1_profile_id: log.player1ProfileId || null,
        player2_profile_id: log.player2ProfileId || null,
        player1_deck_name: log.player1DeckName || null,
        player2_deck_name: log.player2DeckName || null,
        game_mode: log.gameMode,
        winner_player: log.winnerPlayer,
        game_results: log.gameResults || null,
        final_score: log.finalScore,
        notes: log.notes || null,
        recorded_at: new Date(log.recordedAt).toISOString(),
        created_at: new Date(log.createdAt).toISOString(),
      })
    } catch (err) {
      console.warn('[Arena] Cloud sync failed:', err)
    }
  }

  return log
}

/* ── Get my match logs (local) ── */
export async function getMyMatchLogs(
  limit = 50,
  offset = 0,
  filters?: { mode?: GameMode; result?: 'win' | 'loss'; search?: string },
): Promise<{ logs: MatchLog[]; total: number }> {
  let collection = db.matchLogs.orderBy('recordedAt').reverse()
  let all = await collection.toArray()

  if (filters?.mode) {
    all = all.filter((l) => l.gameMode === filters.mode)
  }
  if (filters?.result === 'win') {
    all = all.filter((l) => l.winnerPlayer === 1)
  }
  if (filters?.result === 'loss') {
    all = all.filter((l) => l.winnerPlayer === 2)
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase()
    all = all.filter(
      (l) =>
        l.player1Name.toLowerCase().includes(q) ||
        l.player2Name.toLowerCase().includes(q) ||
        (l.player1DeckName && l.player1DeckName.toLowerCase().includes(q)) ||
        (l.player2DeckName && l.player2DeckName.toLowerCase().includes(q)),
    )
  }

  return {
    logs: all.slice(offset, offset + limit),
    total: all.length,
  }
}

/* ── Delete match log ── */
export async function deleteMatchLog(id: string, userId?: string): Promise<void> {
  await db.matchLogs.delete(id)

  if (isSupabaseReady() && userId) {
    try {
      await supabase.from('match_logs').delete().eq('id', id).eq('user_id', userId)
    } catch (err) {
      console.warn('[Arena] Cloud delete failed:', err)
    }
  }
}

/* ── Calculate stats from logs ── */
export function calculateArenaStats(logs: MatchLog[], _myName?: string): ArenaStats {
  const stats: ArenaStats = {
    matchesPlayed: logs.length,
    wins: 0,
    losses: 0,
    winrate: 0,
    currentStreak: 0,
    bestStreak: 0,
    byMode: {},
    topDecks: [],
    recentOpponents: [],
  }

  if (logs.length === 0) return stats

  // Sort by recorded date DESC for streak calculation
  const sorted = [...logs].sort((a, b) => b.recordedAt - a.recordedAt)

  const deckMap = new Map<string, { wins: number; losses: number }>()
  const oppMap = new Map<string, { name: string; profileId?: string; count: number }>()
  let streak = 0
  let bestStreak = 0
  let streakActive = true

  for (const log of sorted) {
    const isWin = log.winnerPlayer === 1
    if (isWin) {
      stats.wins++
    } else {
      stats.losses++
    }

    // Streak
    if (streakActive) {
      if (isWin) {
        streak++
        bestStreak = Math.max(bestStreak, streak)
      } else {
        streakActive = false
      }
    }

    // By mode
    const mode = log.gameMode
    if (!stats.byMode[mode]) stats.byMode[mode] = { wins: 0, losses: 0 }
    if (isWin) stats.byMode[mode].wins++
    else stats.byMode[mode].losses++

    // Decks
    const deckName = log.player1DeckName || 'Sin Deck'
    if (!deckMap.has(deckName)) deckMap.set(deckName, { wins: 0, losses: 0 })
    const d = deckMap.get(deckName)!
    if (isWin) d.wins++
    else d.losses++

    // Opponents
    const oppName = log.player2Name
    const oppKey = log.player2ProfileId || oppName
    if (!oppMap.has(oppKey)) {
      oppMap.set(oppKey, { name: oppName, profileId: log.player2ProfileId, count: 0 })
    }
    oppMap.get(oppKey)!.count++
  }

  // Check for loss streak
  if (streak === 0) {
    streakActive = true
    for (const log of sorted) {
      if (streakActive && log.winnerPlayer !== 1) {
        streak--
      } else {
        break
      }
    }
  }

  stats.currentStreak = streak
  stats.bestStreak = bestStreak
  stats.winrate = stats.matchesPlayed > 0 ? Math.round((stats.wins / stats.matchesPlayed) * 100) : 0

  stats.topDecks = Array.from(deckMap.entries())
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
    .slice(0, 5)

  stats.recentOpponents = Array.from(oppMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return stats
}

/* ── Public feed (Supabase) ── */
export async function getPublicMatchFeed(
  limit = 20,
  offset = 0,
): Promise<MatchLog[]> {
  if (!isSupabaseReady()) return []

  try {
    const { data, error } = await supabase
      .from('match_logs')
      .select('*')
      .order('recorded_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    if (!data) return []

    return data.map(mapSupabaseLog)
  } catch {
    return []
  }
}

/* ── Get logs for a specific user (Supabase) ── */
export async function getUserMatchLogs(
  userId: string,
  limit = 20,
): Promise<MatchLog[]> {
  if (!isSupabaseReady()) return []

  try {
    const { data, error } = await supabase
      .from('match_logs')
      .select('*')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    if (!data) return []

    return data.map(mapSupabaseLog)
  } catch {
    return []
  }
}

/* ── Map Supabase row → MatchLog ── */
function mapSupabaseLog(row: Record<string, unknown>): MatchLog {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    player1Name: row.player1_name as string,
    player2Name: row.player2_name as string,
    player1ProfileId: row.player1_profile_id as string | undefined,
    player2ProfileId: row.player2_profile_id as string | undefined,
    player1DeckName: row.player1_deck_name as string | undefined,
    player2DeckName: row.player2_deck_name as string | undefined,
    gameMode: row.game_mode as GameMode,
    winnerPlayer: row.winner_player as 1 | 2,
    gameResults: row.game_results as { winner: number }[] | undefined,
    finalScore: row.final_score as [number, number],
    notes: row.notes as string | undefined,
    recordedAt: new Date(row.recorded_at as string).getTime(),
    createdAt: new Date(row.created_at as string).getTime(),
  }
}

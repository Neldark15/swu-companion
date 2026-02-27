// ═══════════════════════════════════════════════════
// Game Progress — Supabase persistence
// ═══════════════════════════════════════════════════

import { supabase, isSupabaseReady } from './supabase'

export interface GameScore {
  id: string
  userId: string
  date: string
  gameNumber: number
  waveReached: number
  score: number
  xpEarned: number
  durationSeconds: number
}

export interface TowerDefenseStats {
  totalGames: number
  totalXpEarned: number
  bestWave: number
  bestScore: number
}

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

// Count how many games played today (for diminishing returns)
export async function getTodayGameCount(userId: string): Promise<number> {
  if (!isSupabaseReady()) return 0
  const { data, error } = await supabase
    .from('game_scores')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .eq('date', getToday())

  if (error) {
    console.error('[gameProgress] getTodayGameCount error:', error)
    return 0
  }
  return data?.length || 0
}

// Save a game result
export async function saveGameScore(
  userId: string,
  waveReached: number,
  score: number,
  xpEarned: number,
  durationSeconds: number
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Supabase no configurado' }

  const today = getToday()
  const gameNumber = (await getTodayGameCount(userId)) + 1

  const { error } = await supabase
    .from('game_scores')
    .insert({
      user_id: userId,
      date: today,
      game_number: gameNumber,
      wave_reached: waveReached,
      score,
      xp_earned: xpEarned,
      duration_seconds: durationSeconds,
    })

  if (error) {
    console.error('[gameProgress] saveGameScore error:', error)
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

// Get all-time stats
export async function getTowerDefenseStats(userId: string): Promise<TowerDefenseStats> {
  const defaults: TowerDefenseStats = {
    totalGames: 0,
    totalXpEarned: 0,
    bestWave: 0,
    bestScore: 0,
  }

  if (!isSupabaseReady()) return defaults

  const { data, error } = await supabase
    .from('game_scores')
    .select('wave_reached, score, xp_earned')
    .eq('user_id', userId)

  if (error || !data) return defaults

  return {
    totalGames: data.length,
    totalXpEarned: data.reduce((sum, r) => sum + (r.xp_earned || 0), 0),
    bestWave: Math.max(0, ...data.map(r => r.wave_reached || 0)),
    bestScore: Math.max(0, ...data.map(r => r.score || 0)),
  }
}

// Get today's XP earned from games
export async function getTodayGameXP(userId: string): Promise<number> {
  if (!isSupabaseReady()) return 0
  const { data, error } = await supabase
    .from('game_scores')
    .select('xp_earned')
    .eq('user_id', userId)
    .eq('date', getToday())

  if (error || !data) return 0
  return data.reduce((sum, r) => sum + (r.xp_earned || 0), 0)
}

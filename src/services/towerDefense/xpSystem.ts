// ═══════════════════════════════════════════════════
// XP System with Diminishing Returns
// ═══════════════════════════════════════════════════

// Formula: baseXP * (0.7 ^ (gameNumber - 1))
// Game 1: full XP, Game 2: 70%, Game 3: 49%, etc.
// Floor: 1 XP, Ceiling: 50 XP

export function calculateGameXP(waveReached: number, gamesPlayedToday: number): number {
  const baseXP = waveReached * 2
  const multiplier = Math.pow(0.7, Math.max(0, gamesPlayedToday - 1))
  const raw = Math.round(baseXP * multiplier)
  return Math.max(1, Math.min(50, raw))
}

export function getXPMultiplier(gameNumber: number): number {
  return Math.pow(0.7, Math.max(0, gameNumber - 1))
}

export interface XPBreakdown {
  baseXP: number
  multiplier: number
  finalXP: number
  gameNumber: number
}

export function explainXP(waveReached: number, gameNumber: number): XPBreakdown {
  const baseXP = waveReached * 2
  const multiplier = getXPMultiplier(gameNumber)
  const finalXP = calculateGameXP(waveReached, gameNumber)
  return { baseXP, multiplier, finalXP, gameNumber }
}

/**
 * Progression Service — announces player milestones.
 *
 * The gamification engine already computes achievements, levels, aspect tiers
 * and titles; until now nothing told the player when any of it happened.
 * This module diffs a "before" snapshot against the current stats and fires
 * the matching notification for each milestone crossed.
 *
 * All notify* helpers dedup by a stable key, so calling this repeatedly with
 * the same stats is harmless — safe to run on every profile load.
 */

import {
  ACHIEVEMENTS,
  calculateLevel,
  getAspectBars,
  type PlayerStats,
} from './gamification'
import { checkNewTitles } from './cosmeticsService'
import {
  notifyAchievement,
  notifyLevelUp,
  notifyTierUp,
  notifyTitleUnlocked,
} from './notificationService'

/** Minimal snapshot needed to detect what changed. */
export interface ProgressionSnapshot {
  xp: number
  unlockedAchievements: string[]
  tierIndexByAspect: Record<string, number>
}

export function takeProgressionSnapshot(stats: PlayerStats): ProgressionSnapshot {
  const tierIndexByAspect: Record<string, number> = {}
  for (const bar of getAspectBars(stats)) {
    tierIndexByAspect[bar.aspect] = bar.tierIndex
  }
  return {
    xp: stats.xp,
    unlockedAchievements: [...stats.unlockedAchievements],
    tierIndexByAspect,
  }
}

/**
 * Compares `before` with the current stats and notifies every milestone
 * crossed. Returns the list of titles newly earned so the caller can persist
 * them (titles were computed but never stored before).
 */
export function announceProgression(
  before: ProgressionSnapshot | null,
  stats: PlayerStats,
): { newTitleIds: string[] } {
  // ── Achievements ──
  const knownBefore = new Set(before?.unlockedAchievements ?? [])
  for (const id of stats.unlockedAchievements) {
    if (knownBefore.has(id)) continue
    const ach = ACHIEVEMENTS.find(a => a.id === id)
    if (ach) notifyAchievement(ach.name, ach.icon, ach.id)
  }

  // ── Level ──
  const levelNow = calculateLevel(stats.xp)
  const levelBefore = before ? calculateLevel(before.xp).level : levelNow.level
  if (levelNow.level > levelBefore) {
    notifyLevelUp(levelNow.level, levelNow.rank.name)
  }

  // ── Aspect tiers ──
  for (const bar of getAspectBars(stats)) {
    const prevIndex = before?.tierIndexByAspect[bar.aspect]
    if (prevIndex === undefined) continue // no baseline — don't spam on first run
    if (bar.tierIndex > prevIndex) {
      notifyTierUp(bar.label, bar.tier)
    }
  }

  // ── Titles (computed by cosmeticsService, never persisted until now) ──
  const newTitles = checkNewTitles(stats)
  for (const t of newTitles) {
    notifyTitleUnlocked(t.name, t.id)
  }

  return { newTitleIds: newTitles.map(t => t.id) }
}

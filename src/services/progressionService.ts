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
import { publishAutoPost } from './communityService'

/** Identidad del jugador para publicar en el feed del hub. */
export interface FeedAuthor {
  userId: string
  userName: string
  userAvatar: string
}

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
  author?: FeedAuthor | null,
): { newTitleIds: string[] } {
  // ── Achievements ──
  const knownBefore = new Set(before?.unlockedAchievements ?? [])
  for (const id of stats.unlockedAchievements) {
    if (knownBefore.has(id)) continue
    const ach = ACHIEVEMENTS.find(a => a.id === id)
    if (!ach) continue
    notifyAchievement(ach.name, ach.icon, ach.id)
    // El sistema publica: el logro aparece en el feed del hub sin que
    // nadie tenga que escribir un post.
    if (author && !ach.isHidden) {
      void publishAutoPost({
        ...author,
        type: 'achievement',
        content: `desbloqueó "${ach.name}" — ${ach.description}`,
        metadata: { icon: ach.icon, achievementId: ach.id, aspect: ach.aspect },
        dedupKey: `ach:${ach.id}`,
      })
    }
  }

  // ── Level ──
  const levelNow = calculateLevel(stats.xp)
  const levelBefore = before ? calculateLevel(before.xp).level : levelNow.level
  if (levelNow.level > levelBefore) {
    notifyLevelUp(levelNow.level, levelNow.rank.name)
    // Solo publicamos saltos de rango: un post por cada nivel sería ruido.
    const rankChanged = calculateLevel(before?.xp ?? 0).rank.name !== levelNow.rank.name
    if (author && rankChanged) {
      void publishAutoPost({
        ...author,
        type: 'level_up',
        content: `alcanzó el rango ${levelNow.rank.name} (nivel ${levelNow.level})`,
        metadata: { level: levelNow.level, rank: levelNow.rank.name },
        dedupKey: `rank:${levelNow.rank.name}`,
      })
    }
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

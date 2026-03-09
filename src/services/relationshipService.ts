/**
 * Relationship Service — Vínculos entre usuarios
 * Tracks bond level between player pairs based on interactions.
 *
 * Levels:
 *   0: "Contacto del Borde Exterior" (0-9 pts)
 *   1: "Aliado de Escuadrón"         (10-29 pts)
 *   2: "Compañero de Campaña"        (30-59 pts)
 *   3: "Vínculo de Holocrón"         (60-99 pts)
 *   4: "Leyenda Compartida"          (100+ pts)
 */

import { supabase, isSupabaseReady } from './supabase'
import { notifyBondLevelUp } from './notificationService'

// ─── TYPES ──────────────────────────────────────────────────────────

export interface RelationshipLevel {
  level: number
  name: string
  color: string
  icon: string
  minPoints: number
}

export interface Relationship {
  partnerUserId: string
  partnerName: string
  partnerAvatar: string
  points: number
  level: number
  levelInfo: RelationshipLevel
}

// ─── CONSTANTS ──────────────────────────────────────────────────────

export const RELATIONSHIP_LEVELS: RelationshipLevel[] = [
  { level: 0, name: 'Contacto del Borde Exterior', color: 'text-gray-400', icon: '🌑', minPoints: 0 },
  { level: 1, name: 'Aliado de Escuadrón', color: 'text-blue-400', icon: '🤝', minPoints: 10 },
  { level: 2, name: 'Compañero de Campaña', color: 'text-green-400', icon: '⚔️', minPoints: 30 },
  { level: 3, name: 'Vínculo de Holocrón', color: 'text-purple-400', icon: '🔮', minPoints: 60 },
  { level: 4, name: 'Leyenda Compartida', color: 'text-yellow-400', icon: '🌟', minPoints: 100 },
]

// ─── HELPERS ────────────────────────────────────────────────────────

/** Always store the pair with the smaller UUID first */
function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

/** Get relationship level info from points */
export function getRelationshipLevelInfo(points: number): RelationshipLevel {
  for (let i = RELATIONSHIP_LEVELS.length - 1; i >= 0; i--) {
    if (points >= RELATIONSHIP_LEVELS[i].minPoints) {
      return RELATIONSHIP_LEVELS[i]
    }
  }
  return RELATIONSHIP_LEVELS[0]
}

// ─── FUNCTIONS ──────────────────────────────────────────────────────

/** Get the relationship between two users */
export async function getRelationship(userA: string, userB: string): Promise<{ points: number; level: number; levelInfo: RelationshipLevel } | null> {
  if (!isSupabaseReady()) return null

  const [idA, idB] = orderedPair(userA, userB)
  try {
    const { data } = await supabase
      .from('user_relationships')
      .select('points, level')
      .eq('user_id_a', idA)
      .eq('user_id_b', idB)
      .single()

    if (!data) return { points: 0, level: 0, levelInfo: RELATIONSHIP_LEVELS[0] }

    const levelInfo = getRelationshipLevelInfo(data.points || 0)
    return { points: data.points || 0, level: levelInfo.level, levelInfo }
  } catch {
    return { points: 0, level: 0, levelInfo: RELATIONSHIP_LEVELS[0] }
  }
}

/** Add relationship points between two users */
export async function addRelationshipPoints(
  userA: string,
  userB: string,
  pts: number,
  _reason?: string,
): Promise<void> {
  if (!isSupabaseReady() || userA === userB) return

  const [idA, idB] = orderedPair(userA, userB)

  try {
    const { data: existing } = await supabase
      .from('user_relationships')
      .select('points, level')
      .eq('user_id_a', idA)
      .eq('user_id_b', idB)
      .single()

    const oldPoints = existing?.points || 0
    const newPoints = oldPoints + pts
    const oldLevel = getRelationshipLevelInfo(oldPoints).level
    const newLevelInfo = getRelationshipLevelInfo(newPoints)

    if (existing) {
      await supabase
        .from('user_relationships')
        .update({
          points: newPoints,
          level: newLevelInfo.level,
          last_interaction_at: new Date().toISOString(),
        })
        .eq('user_id_a', idA)
        .eq('user_id_b', idB)
    } else {
      await supabase.from('user_relationships').insert({
        user_id_a: idA,
        user_id_b: idB,
        points: newPoints,
        level: newLevelInfo.level,
        last_interaction_at: new Date().toISOString(),
      })
    }

    // Notify if level increased
    if (newLevelInfo.level > oldLevel) {
      // Get partner name for notification
      const partnerId = userA === idA ? idB : idA
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', partnerId)
          .single()
        const partnerName = profile?.name || 'Jugador'
        notifyBondLevelUp(partnerName, newLevelInfo.name)
      } catch { /* silently fail */ }
    }
  } catch (e) {
    console.warn('[Relationship] Failed to add points:', e)
  }
}

/** Get top relationships for a user */
export async function getTopRelationships(userId: string, limit = 10): Promise<Relationship[]> {
  if (!isSupabaseReady()) return []

  try {
    // Query where user is either user_id_a or user_id_b
    const [resA, resB] = await Promise.all([
      supabase
        .from('user_relationships')
        .select('user_id_b, points, level')
        .eq('user_id_a', userId)
        .order('points', { ascending: false })
        .limit(limit),
      supabase
        .from('user_relationships')
        .select('user_id_a, points, level')
        .eq('user_id_b', userId)
        .order('points', { ascending: false })
        .limit(limit),
    ])

    const pairs: { partnerId: string; points: number }[] = []

    if (resA.data) {
      for (const row of resA.data) {
        pairs.push({ partnerId: row.user_id_b, points: row.points || 0 })
      }
    }
    if (resB.data) {
      for (const row of resB.data) {
        pairs.push({ partnerId: row.user_id_a, points: row.points || 0 })
      }
    }

    // Sort by points descending, take top N
    pairs.sort((a, b) => b.points - a.points)
    const top = pairs.slice(0, limit)

    if (top.length === 0) return []

    // Fetch partner profiles
    const partnerIds = top.map(p => p.partnerId)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, avatar')
      .in('id', partnerIds)

    const profileMap = new Map<string, { name: string; avatar: string }>()
    if (profiles) {
      for (const p of profiles) {
        profileMap.set(p.id, { name: p.name || 'Jugador', avatar: p.avatar || '🎯' })
      }
    }

    return top.map(p => {
      const profile = profileMap.get(p.partnerId)
      const levelInfo = getRelationshipLevelInfo(p.points)
      return {
        partnerUserId: p.partnerId,
        partnerName: profile?.name || 'Jugador',
        partnerAvatar: profile?.avatar || '🎯',
        points: p.points,
        level: levelInfo.level,
        levelInfo,
      }
    })
  } catch {
    return []
  }
}

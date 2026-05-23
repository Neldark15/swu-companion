/**
 * Admin Service — operaciones administrativas + audit
 *
 * Todas las funciones requieren que el caller sea admin (profiles.role='admin').
 * RLS en Supabase también lo enforza para audit_logs.
 *
 * NOTA: `audit_logs` puede no existir aún en producción si la migración
 * supabase/migrations/audit-logs-migration.sql no se ha aplicado. Las funciones
 * que la usan capturan el error y siguen funcionando (no bloquean al admin).
 */

import { supabase, isSupabaseReady } from './supabase'
import { db } from './db'

// ─── Types ───────────────────────────────────────────────────

export interface AdminUserRow {
  id: string
  name: string
  avatar: string
  email?: string
  role: 'user' | 'admin'
  country: string | null
  created_at: string | null
  // Joined from player_stats
  xp: number
  level: number
  wins: number
  losses: number
  matches_played: number
}

export interface SystemStats {
  totalUsers: number
  adminCount: number
  usersWithCountry: number
  totalPlayerStats: number
  activeEvents: number
  openEvents: number
  finishedEvents: number
  totalNewsPosts: number
  totalCommunityPosts: number
  totalAchievementsUnlocked: number
}

export interface AuditLog {
  id: string
  actor_id: string | null
  actor_name: string | null
  action: string
  target_type: string | null
  target_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

// ─── Audit logging (fire-and-forget) ─────────────────────────

/**
 * Registra una acción administrativa. No bloquea — si falla por RLS
 * o porque la tabla no existe aún, simplemente se ignora.
 */
export function logAdminAction(
  action: string,
  opts: {
    actorId?: string | null
    actorName?: string | null
    targetType?: string
    targetId?: string
    metadata?: Record<string, unknown>
  } = {}
): void {
  if (!isSupabaseReady()) return
  supabase
    .from('audit_logs')
    .insert({
      actor_id: opts.actorId ?? null,
      actor_name: opts.actorName ?? null,
      action,
      target_type: opts.targetType ?? null,
      target_id: opts.targetId ?? null,
      metadata: opts.metadata ?? {},
    })
    .then(() => undefined, () => undefined)
}

export async function getAuditLogs(limit = 100): Promise<AuditLog[]> {
  if (!isSupabaseReady()) return []
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data as AuditLog[]
}

// ─── Users management ────────────────────────────────────────

export async function getAllUsers(): Promise<AdminUserRow[]> {
  if (!isSupabaseReady()) return []

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, name, avatar, role, settings, created_at')
    .order('created_at', { ascending: false })

  if (error || !profiles) return []

  // Player stats por separado (left join via second query)
  const { data: stats } = await supabase
    .from('player_stats')
    .select('user_id, xp, level, wins, losses, matches_played')

  const statsByUser = new Map<string, { xp: number; level: number; wins: number; losses: number; matches_played: number }>()
  for (const s of stats || []) {
    statsByUser.set(s.user_id, {
      xp: s.xp ?? 0,
      level: s.level ?? 1,
      wins: s.wins ?? 0,
      losses: s.losses ?? 0,
      matches_played: s.matches_played ?? 0,
    })
  }

  return profiles.map(p => {
    const s = statsByUser.get(p.id)
    const settings = (p.settings as Record<string, unknown> | null) || {}
    return {
      id: p.id,
      name: p.name ?? 'Jugador',
      avatar: p.avatar ?? 'darth-vader',
      role: (p.role as 'user' | 'admin') ?? 'user',
      country: (settings.country as string) || null,
      created_at: p.created_at,
      xp: s?.xp ?? 0,
      level: s?.level ?? 1,
      wins: s?.wins ?? 0,
      losses: s?.losses ?? 0,
      matches_played: s?.matches_played ?? 0,
    }
  })
}

export async function updateUserRole(
  userId: string,
  role: 'user' | 'admin',
  actor: { id: string; name: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)

  if (error) return { ok: false, error: error.message }

  logAdminAction('role.change', {
    actorId: actor.id,
    actorName: actor.name,
    targetType: 'user',
    targetId: userId,
    metadata: { newRole: role },
  })

  return { ok: true }
}

// ─── System stats ────────────────────────────────────────────

export async function getSystemStats(): Promise<SystemStats> {
  const empty: SystemStats = {
    totalUsers: 0,
    adminCount: 0,
    usersWithCountry: 0,
    totalPlayerStats: 0,
    activeEvents: 0,
    openEvents: 0,
    finishedEvents: 0,
    totalNewsPosts: 0,
    totalCommunityPosts: 0,
    totalAchievementsUnlocked: 0,
  }
  if (!isSupabaseReady()) return empty

  // Lanzar todo en paralelo
  const [
    profilesRes,
    adminsRes,
    statsRes,
    eventsActive,
    eventsOpen,
    eventsFinished,
    newsRes,
    communityRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
    supabase.from('player_stats').select('*', { count: 'exact', head: true }),
    supabase.from('official_events').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('official_events').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('official_events').select('*', { count: 'exact', head: true }).eq('status', 'finished'),
    supabase.from('news').select('*', { count: 'exact', head: true }),
    supabase.from('community_posts').select('*', { count: 'exact', head: true }),
  ])

  // Country count requiere fetch real (filter por JSONB no triggerea count rápido)
  let usersWithCountry = 0
  try {
    const { data: withCountry } = await supabase
      .from('profiles')
      .select('id, settings')
      .not('settings->country', 'is', null)
    usersWithCountry = withCountry?.filter(p => {
      const s = p.settings as Record<string, unknown> | null
      return s && typeof s.country === 'string' && s.country.length > 0
    }).length ?? 0
  } catch {
    // tabla schema may differ — fall through
  }

  // Achievements desbloqueados (suma de longitudes del array)
  let totalAchievementsUnlocked = 0
  try {
    const { data: ach } = await supabase
      .from('player_stats')
      .select('unlocked_achievements')
    totalAchievementsUnlocked = (ach || []).reduce((sum, row) => {
      const arr = row.unlocked_achievements as unknown[] | null
      return sum + (Array.isArray(arr) ? arr.length : 0)
    }, 0)
  } catch {
    // ignore
  }

  return {
    totalUsers: profilesRes.count ?? 0,
    adminCount: adminsRes.count ?? 0,
    usersWithCountry,
    totalPlayerStats: statsRes.count ?? 0,
    activeEvents: eventsActive.count ?? 0,
    openEvents: eventsOpen.count ?? 0,
    finishedEvents: eventsFinished.count ?? 0,
    totalNewsPosts: newsRes.count ?? 0,
    totalCommunityPosts: communityRes.count ?? 0,
    totalAchievementsUnlocked,
  }
}

// ─── Cards DB management ─────────────────────────────────────

/**
 * Limpia la cache local de cartas (Dexie). El siguiente fetch repobla
 * desde el API. Solo afecta el device del admin.
 */
export async function clearLocalCardsCache(actor: { id: string; name: string }): Promise<{ ok: boolean; cleared: number }> {
  const before = await db.cards.count()
  await db.cards.clear()
  logAdminAction('cards.clear-local', {
    actorId: actor.id,
    actorName: actor.name,
    metadata: { cleared: before },
  })
  return { ok: true, cleared: before }
}

export async function getLocalCardsCount(): Promise<number> {
  return db.cards.count()
}

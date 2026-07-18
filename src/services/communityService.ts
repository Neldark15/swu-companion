/**
 * Community Service — HOLOCRON SWU
 *
 * Un solo hub: la comunidad de El Salvador. (Antes esto navegaba
 * continentes → países → feed: 66 cubetas para 14 jugadores que viven en
 * la misma ciudad, y ninguna llegó a tener un solo post.)
 *
 * Principio del feed: **el sistema publica, los usuarios reaccionan.**
 * La mayoría de las entradas se generan solas desde lo que el grupo ya
 * hace (logros, podios de torneo, cartas puestas en venta, jugadores
 * nuevos). El post manual existe, pero es la acción secundaria.
 */

import { supabase, isSupabaseReady } from './supabase'

// ─── Constantes ──────────────────────────────────────────

/** La comunidad vive en un solo lugar. El país deja de ser navegación. */
export const HOME_COUNTRY = 'SV'
export const HOME_COUNTRY_LABEL = 'El Salvador'

// ─── Types ───────────────────────────────────────────────

export interface CommunityMember {
  id: string
  name: string
  avatar: string
  level?: number
  xp?: number
}

export type PostType = 'message' | 'achievement' | 'tournament' | 'trade' | 'welcome' | 'level_up'

export interface CommunityPost {
  id: string
  userId: string
  userName: string
  userAvatar: string
  content: string
  type: PostType
  likes: number
  likedByMe: boolean
  createdAt: string
  metadata: Record<string, unknown>
}

// ─── Miembros del hub ────────────────────────────────────

/**
 * Todos los jugadores del hub, ordenados por XP.
 * Ya no filtra por `settings.country` — con 1 de 15 perfiles con país
 * configurado, ese filtro dejaba la comunidad vacía. Todos pertenecen
 * al hub por defecto; el país queda como dato de perfil, no como gate.
 */
export async function getHubMembers(limit = 50): Promise<CommunityMember[]> {
  if (!isSupabaseReady()) return []

  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, name, avatar')
      .limit(limit)

    if (error || !profiles || profiles.length === 0) return []

    const { data: statsRows } = await supabase
      .from('player_stats')
      .select('user_id, xp, level')
      .in('user_id', profiles.map(p => p.id))

    const statsMap = new Map<string, { xp: number; level: number }>()
    for (const s of statsRows ?? []) {
      statsMap.set(s.user_id as string, {
        xp: (s.xp as number) ?? 0,
        level: (s.level as number) ?? 1,
      })
    }

    return profiles
      .map(p => {
        const stats = statsMap.get(p.id)
        return {
          id: p.id,
          name: (p.name as string) || 'Jugador',
          avatar: (p.avatar as string) || '🎮',
          level: stats?.level ?? 1,
          xp: stats?.xp ?? 0,
        }
      })
      .sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0))
  } catch {
    return []
  }
}

/**
 * Códigos de país presentes entre los perfiles. Lo usa el filtro del
 * leaderboard. (El hub ya no navega por país, pero el ranking global sí
 * puede filtrarse si algún día hay jugadores de otros países.)
 */
export async function getActiveCountries(): Promise<string[]> {
  if (!isSupabaseReady()) return []
  try {
    const { data } = await supabase
      .from('profiles')
      .select('settings')
      .not('settings', 'is', null)
    if (!data) return []
    const codes = new Set<string>()
    for (const row of data) {
      const country = (row.settings as Record<string, unknown> | null)?.country
      if (typeof country === 'string' && country) codes.add(country)
    }
    return Array.from(codes).sort()
  } catch {
    return []
  }
}

// ─── Feed ────────────────────────────────────────────────

function mapPost(row: Record<string, unknown>, likedIds: Set<string>): CommunityPost {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    userName: (row.user_name as string) || 'Jugador',
    userAvatar: (row.user_avatar as string) || '🎮',
    content: row.content as string,
    type: ((row.type as PostType) || 'message'),
    likes: (row.likes as number) || 0,
    likedByMe: likedIds.has(row.id as string),
    createdAt: row.created_at as string,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}

/** Feed del hub, con el estado de "me gusta" del usuario ya resuelto. */
export async function getHubFeed(viewerId?: string | null, limit = 40): Promise<CommunityPost[]> {
  if (!isSupabaseReady()) return []

  try {
    const { data, error } = await supabase
      .from('community_posts')
      .select('*')
      .eq('country_code', HOME_COUNTRY)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !data || data.length === 0) return []

    // Qué posts de este lote ya likeó el usuario (una sola consulta)
    const likedIds = new Set<string>()
    if (viewerId) {
      const { data: likes } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', viewerId)
        .in('post_id', data.map(r => r.id as string))
      for (const l of likes ?? []) likedIds.add(l.post_id as string)
    }

    return data.map(row => mapPost(row, likedIds))
  } catch {
    return []
  }
}

/** Post manual del usuario (acción secundaria del hub). */
export async function createCommunityPost(
  userId: string,
  userName: string,
  userAvatar: string,
  content: string,
): Promise<CommunityPost | null> {
  if (!isSupabaseReady()) return null
  const trimmed = content.trim()
  if (!trimmed) return null

  try {
    const { data, error } = await supabase
      .from('community_posts')
      .insert({
        user_id: userId,
        user_name: userName,
        user_avatar: userAvatar,
        country_code: HOME_COUNTRY,
        content: trimmed.slice(0, 280),
        type: 'message',
        likes: 0,
      })
      .select()
      .single()

    if (error || !data) {
      console.warn('[Community] Failed to create post:', error?.message)
      return null
    }
    return mapPost(data, new Set())
  } catch {
    return null
  }
}

/**
 * Publica una entrada AUTO-GENERADA en el feed.
 *
 * Best-effort y silencioso: si falla, el usuario nunca lo nota — el hito
 * en sí (logro, torneo, venta) ya ocurrió y no debe bloquearse por esto.
 * `dedupKey` evita duplicados cuando el productor corre varias veces
 * (p. ej. el perfil recalcula logros en cada carga).
 */
export async function publishAutoPost(opts: {
  userId: string
  userName: string
  userAvatar: string
  type: Exclude<PostType, 'message'>
  content: string
  metadata?: Record<string, unknown>
  dedupKey?: string
}): Promise<void> {
  if (!isSupabaseReady()) return

  try {
    if (opts.dedupKey) {
      const { data: existing } = await supabase
        .from('community_posts')
        .select('id')
        .eq('user_id', opts.userId)
        .eq('type', opts.type)
        .contains('metadata', { dedupKey: opts.dedupKey })
        .limit(1)
      if (existing && existing.length > 0) return
    }

    await supabase.from('community_posts').insert({
      user_id: opts.userId,
      user_name: opts.userName,
      user_avatar: opts.userAvatar,
      country_code: HOME_COUNTRY,
      content: opts.content.slice(0, 280),
      type: opts.type,
      likes: 0,
      metadata: { ...(opts.metadata ?? {}), ...(opts.dedupKey ? { dedupKey: opts.dedupKey } : {}) },
    })
  } catch {
    // silencioso a propósito
  }
}

/** Alterna el "me gusta" del usuario actual. Atómico, sin duplicados. */
export async function togglePostLike(
  postId: string,
): Promise<{ liked: boolean; likes: number } | null> {
  if (!isSupabaseReady()) return null
  try {
    const { data, error } = await supabase.rpc('toggle_post_like', { p_post_id: postId })
    if (error || !data) return null
    const row = Array.isArray(data) ? data[0] : data
    return { liked: Boolean(row.liked), likes: Number(row.like_count) || 0 }
  } catch {
    return null
  }
}

/** Borra un post. La RLS ya garantiza que solo el autor puede. */
export async function deleteCommunityPost(postId: string, userId: string): Promise<boolean> {
  if (!isSupabaseReady()) return false
  try {
    const { error } = await supabase
      .from('community_posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', userId)
    return !error
  } catch {
    return false
  }
}

/** Realtime: avisa cuando entra un post nuevo al hub. */
export function subscribeToHubFeed(onNewPost: (post: CommunityPost) => void): () => void {
  if (!isSupabaseReady()) return () => undefined
  const ch = supabase
    .channel('community-hub-feed')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'community_posts', filter: `country_code=eq.${HOME_COUNTRY}` },
      (payload) => onNewPost(mapPost(payload.new as Record<string, unknown>, new Set())),
    )
    .subscribe()
  return () => { supabase.removeChannel(ch) }
}

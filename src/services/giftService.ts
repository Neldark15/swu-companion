/**
 * Gift Service — Espionaje Module
 * Send/receive gifts between players: Lección Jedi, Créditos Imperiales, Beskar
 * Limit: 5 gifts per sender per day
 */

import { supabase, isSupabaseReady } from './supabase'
import { updateMissionProgress } from './missionService'
import { addRelationshipPoints } from './relationshipService'

// ─── TYPES ──────────────────────────────────────────────────────────

export type GiftType = 'leccion_jedi' | 'creditos_imperiales' | 'beskar' | 'holocron' | 'cristal_kyber'

export interface Gift {
  id: string
  senderId: string
  recipientId: string
  type: GiftType
  xpAmount: number
  createdAt: string
  senderName?: string
  senderAvatar?: string
}

export interface GiftTypeInfo {
  type: GiftType
  label: string
  description: string
  xp: number
  icon: string
  color: string
  bgColor: string
}

export const GIFT_TYPES: GiftTypeInfo[] = [
  {
    type: 'leccion_jedi',
    label: 'Lección Jedi',
    description: 'Transmite sabiduría de la Fuerza. Otorga XP al receptor.',
    xp: 15,
    icon: '📖',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  {
    type: 'creditos_imperiales',
    label: 'Créditos Imperiales',
    description: 'Moneda del Imperio. Otorga XP y cuenta para logros.',
    xp: 15,
    icon: '🪙',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
  },
  {
    type: 'beskar',
    label: 'Beskar',
    description: 'El metal más valioso de Mandalore. Regalo premium.',
    xp: 30,
    icon: '🛡️',
    color: 'text-cyan-300',
    bgColor: 'bg-cyan-500/20',
  },
  {
    type: 'holocron',
    label: 'Holocrón de Reconocimiento',
    description: 'Gesto de respeto entre jugadores. Otorga XP al receptor.',
    xp: 10,
    icon: '🔮',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
  },
  {
    type: 'cristal_kyber',
    label: 'Cristal Kyber',
    description: 'Cristal de energía raro y poderoso. Regalo de élite.',
    xp: 20,
    icon: '💎',
    color: 'text-sky-300',
    bgColor: 'bg-sky-500/20',
  },
]

const DAILY_LIMIT = 5

// ─── FUNCTIONS ──────────────────────────────────────────────────────

/** Get how many gifts the sender has sent today. Returns count 0-5. */
export async function getSentTodayCount(senderId: string): Promise<number> {
  if (!isSupabaseReady()) return 0
  try {
    const today = new Date().toISOString().split('T')[0]
    const { count, error } = await supabase
      .from('gifts')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', senderId)
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lt('created_at', `${today}T23:59:59.999Z`)

    if (error) return 0
    return count || 0
  } catch {
    return 0
  }
}

/** Check remaining gifts the sender can send today */
export async function getRemainingGifts(senderId: string): Promise<number> {
  const sent = await getSentTodayCount(senderId)
  return Math.max(0, DAILY_LIMIT - sent)
}

/** Get diminishing returns multiplier for gifts between same pair in last 7 days */
async function getDiminishingMultiplier(senderId: string, recipientId: string): Promise<number> {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('gifts')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', senderId)
      .eq('recipient_id', recipientId)
      .gte('created_at', weekAgo)

    const previousGifts = count || 0
    if (previousGifts === 0) return 1.0   // 100%
    if (previousGifts === 1) return 0.5   // 50%
    return 0.25                            // 25% (3rd+ gift)
  } catch {
    return 1.0
  }
}

/** Send a gift from sender to recipient */
export async function sendGift(
  senderId: string,
  recipientId: string,
  giftType: GiftType,
): Promise<{ success: boolean; error?: string; diminished?: boolean }> {
  if (!isSupabaseReady()) return { success: false, error: 'Sin conexión a la nube' }

  // Validate: no self-gifting
  if (senderId === recipientId) {
    return { success: false, error: 'No puedes enviarte regalos a ti mismo' }
  }

  // Check daily limit
  const remaining = await getRemainingGifts(senderId)
  if (remaining <= 0) {
    return { success: false, error: 'Límite diario alcanzado (5/5). Intenta mañana.' }
  }

  // Get XP amount for this gift type
  const giftInfo = GIFT_TYPES.find(g => g.type === giftType)
  if (!giftInfo) return { success: false, error: 'Tipo de regalo inválido' }

  try {
    // Apply diminishing returns
    const multiplier = await getDiminishingMultiplier(senderId, recipientId)
    const effectiveXp = Math.max(1, Math.round(giftInfo.xp * multiplier))
    const diminished = multiplier < 1.0

    // Insert gift record with effective XP.
    // El crédito al RECEPTOR (xp + contadores + reputación) lo aplica el
    // trigger trg_gift_credit en la base (SECURITY DEFINER) — el cliente no
    // puede tocar player_stats ajeno por RLS. La validación de límite diario
    // y no-self-gift también se enforza server-side (trg_gift_validate).
    const { error: insertError } = await supabase.from('gifts').insert({
      sender_id: senderId,
      recipient_id: recipientId,
      gift_type: giftType,
      xp_amount: effectiveXp,
    })
    if (insertError) {
      console.warn('[Gift] Insert error:', insertError)
      const msg = insertError.message.includes('Límite diario')
        ? 'Límite diario alcanzado (5/5). Intenta mañana.'
        : insertError.message.includes('ti mismo')
          ? 'No puedes enviarte regalos a ti mismo'
          : 'Error al enviar el regalo'
      return { success: false, error: msg }
    }

    // Update sender stats (increment gifts_sent + small xp + reputation)
    await updateSenderStats(senderId)

    // Update mission progress for gift_sent objective (Diplomacia Galáctica)
    await updateMissionProgress(senderId, 'gift_sent').catch(() => {})

    // Add relationship points between sender and recipient
    await addRelationshipPoints(senderId, recipientId, 3, 'gift').catch(() => {})

    return { success: true, diminished }
  } catch (e) {
    console.warn('[Gift] Failed to send gift:', e)
    return { success: false, error: 'Error inesperado al enviar el regalo' }
  }
}

/** Update sender's player_stats after sending a gift (+5 XP bonus + reputation) */
async function updateSenderStats(senderId: string) {
  try {
    const { data } = await supabase
      .from('player_stats')
      .select('xp, gifts_sent, social_reputation')
      .eq('user_id', senderId)
      .single()

    if (!data) return

    await supabase
      .from('player_stats')
      .update({
        xp: (data.xp || 0) + 5,
        gifts_sent: (data.gifts_sent || 0) + 1,
        social_reputation: (data.social_reputation || 0) + 2, // +2 rep for sending
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', senderId)
  } catch (e) {
    console.warn('[Gift] Failed to update sender stats:', e)
  }
}

/**
 * Realtime: subscribe to gifts arriving for this user.
 * Fires the callback with sender name + gift info already resolved.
 * Returns an unsubscribe function.
 */
export function subscribeToIncomingGifts(
  userId: string,
  onGift: (info: {
    id: string
    senderName: string
    giftLabel: string
    giftIcon: string
    xp: number
    createdAt: number
  }) => void
): () => void {
  if (!isSupabaseReady()) return () => undefined
  const ch = supabase
    .channel(`gifts-inbox-${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'gifts', filter: `recipient_id=eq.${userId}` },
      async (payload) => {
        const row = payload.new as {
          id: string
          sender_id: string
          gift_type: GiftType
          xp_amount: number
          created_at: string
        }
        const info = GIFT_TYPES.find(g => g.type === row.gift_type)
        let senderName = 'Alguien'
        try {
          const { data } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', row.sender_id)
            .single()
          if (data?.name) senderName = data.name
        } catch { /* keep fallback */ }
        onGift({
          id: row.id,
          senderName,
          giftLabel: info?.label ?? 'un regalo',
          giftIcon: info?.icon ?? '🎁',
          xp: row.xp_amount ?? 0,
          createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        })
      }
    )
    .subscribe()
  return () => { supabase.removeChannel(ch) }
}

/** Get gifts received by a user, with sender info */
export async function getReceivedGifts(userId: string, limit = 30): Promise<Gift[]> {
  if (!isSupabaseReady()) return []
  try {
    const { data, error } = await supabase
      .from('gifts')
      .select(`
        id, sender_id, recipient_id, gift_type, xp_amount, created_at,
        profiles!gifts_sender_id_fkey(name, avatar)
      `)
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []

    return data.map((row: Record<string, unknown>) => {
      const profile = row.profiles as Record<string, unknown> | null
      return {
        id: row.id as string,
        senderId: row.sender_id as string,
        recipientId: row.recipient_id as string,
        type: row.gift_type as GiftType,
        xpAmount: (row.xp_amount as number) || 0,
        createdAt: row.created_at as string,
        senderName: (profile?.name as string) || 'Desconocido',
        senderAvatar: (profile?.avatar as string) || '🎯',
      }
    })
  } catch {
    return []
  }
}

/** Get gifts sent by a user */
export async function getSentGifts(userId: string, limit = 30): Promise<Gift[]> {
  if (!isSupabaseReady()) return []
  try {
    const { data, error } = await supabase
      .from('gifts')
      .select('id, sender_id, recipient_id, gift_type, xp_amount, created_at')
      .eq('sender_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []

    return data.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      senderId: row.sender_id as string,
      recipientId: row.recipient_id as string,
      type: row.gift_type as GiftType,
      xpAmount: (row.xp_amount as number) || 0,
      createdAt: row.created_at as string,
    }))
  } catch {
    return []
  }
}

/** Get a target player's public stats for the spy profile view */
export async function getPlayerPublicStats(userId: string): Promise<{
  profile: { name: string; avatar: string; bio: string } | null
  stats: Record<string, unknown> | null
}> {
  if (!isSupabaseReady()) return { profile: null, stats: null }
  try {
    const [profileRes, statsRes] = await Promise.all([
      supabase.from('profiles').select('name, avatar, bio').eq('id', userId).single(),
      supabase.from('player_stats').select('*').eq('user_id', userId).single(),
    ])

    return {
      profile: profileRes.data ? {
        name: (profileRes.data.name as string) || 'Jugador',
        avatar: (profileRes.data.avatar as string) || '🎯',
        bio: (profileRes.data.bio as string) || '',
      } : null,
      stats: statsRes.data || null,
    }
  } catch {
    return { profile: null, stats: null }
  }
}

/** Search players for the Espionaje module (public profiles with stats) */
export async function searchSpyProfiles(query?: string, limit = 30): Promise<Array<{
  id: string; name: string; avatar: string; level: number; xp: number; wins: number
}>> {
  if (!isSupabaseReady()) return []
  try {
    let q = supabase
      .from('profiles')
      .select(`
        id, name, avatar,
        player_stats!inner(level, xp, wins)
      `)
      .order('name')
      .limit(limit)

    if (query && query.trim()) {
      q = q.ilike('name', `%${query.trim()}%`)
    }

    const { data, error } = await q
    if (error || !data) return []

    return data.map((row: Record<string, unknown>) => {
      const stats = row.player_stats as Record<string, unknown>
      return {
        id: row.id as string,
        name: (row.name as string) || 'Jugador',
        avatar: (row.avatar as string) || '🎯',
        level: (stats?.level as number) || 1,
        xp: (stats?.xp as number) || 0,
        wins: (stats?.wins as number) || 0,
      }
    })
  } catch {
    return []
  }
}

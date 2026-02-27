import { supabase, isSupabaseReady } from './supabase'

// ─── Types ───────────────────────────────────────────────────

export interface OfficialEvent {
  id: string
  organizer_id: string
  name: string
  description: string | null
  format: string
  match_type: string
  code: string
  max_players: number
  date: string | null
  location: string | null
  status: 'open' | 'active' | 'finished' | 'cancelled'
  created_at: string
  updated_at: string
  // Joined data
  organizer_name?: string
  organizer_avatar?: string
  registered_count?: number
  is_registered?: boolean
}

export interface EventRegistration {
  id: string
  event_id: string
  user_id: string
  status: 'registered' | 'checked_in' | 'dropped'
  registered_at: string
  // Joined
  player_name?: string
  player_avatar?: string
}

// ─── Code Generator ──────────────────────────────────────────

function generateEventCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // No I, O, 0, 1 to avoid confusion
  let code = 'SWU'
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// ─── Admin Check ─────────────────────────────────────────────

export async function getUserRole(userId: string): Promise<string> {
  if (!isSupabaseReady()) return 'user'

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  return data?.role || 'user'
}

export async function checkIsAdmin(userId: string): Promise<boolean> {
  const role = await getUserRole(userId)
  return role === 'admin'
}

// ─── Events CRUD ─────────────────────────────────────────────

export async function createOfficialEvent(data: {
  name: string
  description?: string
  format: string
  matchType: string
  maxPlayers: number
  date?: string
  location?: string
  organizerId: string
}): Promise<{ ok: boolean; event?: OfficialEvent; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión al servidor' }

  // Generate unique code (retry if collision)
  let code = generateEventCode()
  let attempts = 0
  while (attempts < 5) {
    const { data: existing } = await supabase
      .from('official_events')
      .select('id')
      .eq('code', code)
      .single()
    if (!existing) break
    code = generateEventCode()
    attempts++
  }

  const { data: event, error } = await supabase
    .from('official_events')
    .insert({
      organizer_id: data.organizerId,
      name: data.name,
      description: data.description || null,
      format: data.format,
      match_type: data.matchType,
      code,
      max_players: data.maxPlayers,
      date: data.date || null,
      location: data.location || null,
    })
    .select()
    .single()

  if (error) {
    if (error.message.includes('policy')) {
      return { ok: false, error: 'No tiene permisos para crear eventos' }
    }
    return { ok: false, error: error.message }
  }

  return { ok: true, event }
}

export async function getOfficialEvents(userId?: string): Promise<OfficialEvent[]> {
  if (!isSupabaseReady()) return []

  // Fetch events
  const { data: events, error } = await supabase
    .from('official_events')
    .select('*')
    .in('status', ['open', 'active'])
    .order('created_at', { ascending: false })

  if (error || !events || events.length === 0) return []

  // Fetch organizer profiles separately (organizer_id refs auth.users, profiles.id = auth.users.id)
  const organizerIds = [...new Set(events.map(e => e.organizer_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, avatar')
    .in('id', organizerIds)
  const profileMap = new Map((profiles || []).map(p => [p.id, p]))

  // Get registration counts
  const eventIds = events.map(e => e.id)
  const { data: regCounts } = await supabase
    .from('event_registrations')
    .select('event_id')
    .in('event_id', eventIds)

  // Get user's registrations
  let userRegs: string[] = []
  if (userId) {
    const { data: myRegs } = await supabase
      .from('event_registrations')
      .select('event_id')
      .eq('user_id', userId)
      .in('event_id', eventIds)
    userRegs = (myRegs || []).map(r => r.event_id)
  }

  return events.map(e => {
    const profile = profileMap.get(e.organizer_id)
    const count = (regCounts || []).filter(r => r.event_id === e.id).length
    return {
      ...e,
      organizer_name: profile?.name || 'Organizador',
      organizer_avatar: profile?.avatar || '🎯',
      registered_count: count,
      is_registered: userRegs.includes(e.id),
    } as OfficialEvent
  })
}

export async function getEventByCode(code: string): Promise<OfficialEvent | null> {
  if (!isSupabaseReady()) return null

  const { data, error } = await supabase
    .from('official_events')
    .select('*')
    .eq('code', code.toUpperCase())
    .in('status', ['open', 'active'])
    .single()

  if (error || !data) return null

  // Get organizer profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, avatar')
    .eq('id', data.organizer_id)
    .single()

  // Get registration count
  const { count } = await supabase
    .from('event_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', data.id)

  return {
    ...data,
    organizer_name: profile?.name || 'Organizador',
    organizer_avatar: profile?.avatar || '🎯',
    registered_count: count || 0,
  } as OfficialEvent
}

export async function joinOfficialEvent(eventId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  const { error } = await supabase
    .from('event_registrations')
    .insert({ event_id: eventId, user_id: userId })

  if (error) {
    if (error.message.includes('duplicate')) {
      return { ok: false, error: 'Ya está inscrito en este evento' }
    }
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

export async function leaveOfficialEvent(eventId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  const { error } = await supabase
    .from('event_registrations')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function getEventRegistrations(eventId: string): Promise<EventRegistration[]> {
  if (!isSupabaseReady()) return []

  const { data, error } = await supabase
    .from('event_registrations')
    .select(`
      *,
      profiles!event_registrations_user_id_fkey (name, avatar)
    `)
    .eq('event_id', eventId)
    .order('registered_at', { ascending: true })

  if (error || !data) return []

  return data.map(r => {
    const profile = r.profiles as unknown as { name: string; avatar: string } | null
    return {
      ...r,
      profiles: undefined,
      player_name: profile?.name || 'Jugador',
      player_avatar: profile?.avatar || '🎯',
    } as EventRegistration
  })
}

export async function updateEventStatus(
  eventId: string,
  status: 'open' | 'active' | 'finished' | 'cancelled'
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  const { error } = await supabase
    .from('official_events')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', eventId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deleteOfficialEvent(eventId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  // CASCADE on event_registrations handles cleanup automatically
  const { error } = await supabase
    .from('official_events')
    .delete()
    .eq('id', eventId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

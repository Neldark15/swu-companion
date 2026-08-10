import { supabase, isSupabaseReady } from './supabase'
import { inicioDelDiaSVenUTC } from './horaSV'

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
  /**
   * Cuánta gente se inscribió. **`undefined` significa «sin dato»**, no cero:
   * si la consulta de inscripciones falla (RLS, red, 5xx de PostgREST) o llega
   * recortada, este campo NO viaja y la UI tiene que decir «—». Pintar un 0
   * ahí es anunciar un torneo vacío que tiene 12 inscritos.
   */
  registered_count?: number
  is_registered?: boolean
}

/**
 * Cuántos inscritos tiene cada evento. `null` = no se pudo saber.
 *
 * Dos defectos que tapaba la versión de una línea (`(regCounts || []).filter…`):
 *
 * 1. **Sin `error`.** Un fallo dejaba `regCounts` en `null` y `.length` daba
 *    **0** — el gotcha 2f exacto, en la pantalla que ve todo el mundo.
 * 2. **Sin tope.** PostgREST corta en 1.000 filas EN SILENCIO, así que en
 *    cuanto la suma de inscripciones de los eventos listados pasara de 1.000
 *    todos los contadores empezaban a mentir hacia abajo sin aviso.
 *
 * Se pide una fila de más que el tope: si vuelven `TOPE + 1`, hay recorte y se
 * devuelve `null` en vez de un conteo bajo que parece cierto.
 */
const TOPE_INSCRIPCIONES = 2000

async function contarInscritos(eventIds: string[]): Promise<Map<string, number> | null> {
  if (eventIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('event_registrations')
    .select('event_id')
    .in('event_id', eventIds)
    .limit(TOPE_INSCRIPCIONES + 1)

  if (error || !data) {
    console.warn('[eventos] inscritos:', error?.message)
    return null
  }
  if (data.length > TOPE_INSCRIPCIONES) {
    console.warn('[eventos] inscritos: más de', TOPE_INSCRIPCIONES, '— el conteo sería parcial')
    return null
  }

  const mapa = new Map<string, number>()
  for (const r of data) {
    const id = r.event_id as string
    mapa.set(id, (mapa.get(id) ?? 0) + 1)
  }
  // Un evento sin inscripciones sí es un 0 de verdad.
  for (const id of eventIds) if (!mapa.has(id)) mapa.set(id, 0)
  return mapa
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

/**
 * El rol del usuario, o `null` cuando NO SE PUDO AVERIGUAR.
 *
 * Antes esto devolvía `'user'` en los dos casos: cuando efectivamente no sos
 * admin, y cuando la consulta falló por red mala, timeout o RLS. Como
 * `initAuth` pisa con el resultado el `isAdmin` que ya venía persistido —el
 * último dato bueno—, un admin con mala señal se degradaba a usuario normal y
 * `AdminLayout` lo expulsaba con `navigate('/', { replace: true })`; con
 * `replace` ni el botón Atrás lo devolvía.
 *
 * A quién le pasa: los organizadores. Y por el gotcha 2u organizador ⇒ admin,
 * o sea que es justo la persona corriendo el torneo en el local con la señal
 * peor la que perdía el panel del torneo en curso.
 *
 * Distinguir «no sé» permite conservar lo persistido. No es escalada de
 * privilegios: el rol en el cliente es cosmético, el servidor valida por RLS y
 * por `set_user_role()` / `cerrar_torneo()`.
 */
export async function getUserRole(userId: string): Promise<string | null> {
  if (!isSupabaseReady()) return 'user'

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (error) return null

  return data?.role || 'user'
}

export async function checkIsAdmin(userId: string): Promise<boolean> {
  const role = await getUserRole(userId)
  // `null === 'admin'` daría false y reintroduciría el bug entero por la puerta
  // de atrás, así que el «no sé» se trata acá con el mismo criterio que arriba:
  // no afirmar que NO es admin cuando no se pudo comprobar.
  if (role === null) return false
  return role === 'admin'
}

// ─── Events CRUD ─────────────────────────────────────────────

export async function createOfficialEvent(data: {
  name: string
  description?: string
  format: string
  matchType: string
  tournamentType?: 'swiss' | 'elimination'
  maxPlayers: number
  date?: string
  location?: string
  /** Sede donde se juega. Liga el torneo a su página pública. */
  venueId?: string | null
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
      tournament_type: data.tournamentType || 'swiss',
      code,
      max_players: data.maxPlayers,
      date: data.date || null,
      location: data.location || null,
      venue_id: data.venueId || null,
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
  const inscritos = await contarInscritos(eventIds)

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
    return {
      ...e,
      organizer_name: profile?.name || 'Organizador',
      organizer_avatar: profile?.avatar || '🎯',
      // `undefined` cuando no se pudo contar: ver `contarInscritos`.
      registered_count: inscritos?.get(e.id),
      is_registered: userRegs.includes(e.id),
    } as OfficialEvent
  })
}

/**
 * Los eventos que todavía no pasaron, para anunciarlos en el Inicio.
 *
 * ── Cuándo deja de verse un evento ────────────────────────────────────
 *
 * El corte NO es «cuando empieza» sino **el final de su día**: un torneo que
 * arranca a las 9 de la mañana se sigue anunciando toda esa tarde —la gente
 * llega tarde, pregunta, se suma a la siguiente ronda— y recién desaparece al
 * día siguiente. Es lo que pidió Nel y además es lo correcto: un evento en
 * curso es justo el que más interesa ver.
 *
 * El límite es la medianoche de EL SALVADOR, mandada en UTC (las 06:00Z de
 * ese mismo día). Con un corte fijo en UTC, acá —seis horas detrás— los
 * eventos se caerían del Inicio a las 6 de la tarde del día anterior.
 *
 * Y tampoco puede ser la medianoche de quien mira: `setHours(0,0,0,0)` usa la
 * zona del DISPOSITIVO. Medido corriendo el mismo cálculo con el reloj en
 * otras zonas, para un instante que en SV es el 8 de agosto a las 23:30:
 *
 *     El Salvador → 2026-08-08T06:00:00.000Z   ← el correcto
 *     Asia/Tokyo  → 2026-08-08T15:00:00.000Z   ← 9 h tarde
 *     UTC         → 2026-08-09T00:00:00.000Z   ← el día equivocado
 *
 * Con el corte de Tokio, un torneo de esa mañana desaparece del Inicio; con el
 * de UTC desaparecen todos los del día. El torneo se juega en la tienda, así
 * que el día que cuenta es el de la tienda.
 *
 * Se excluyen los `finished` y `cancelled`: un evento cancelado no se anuncia
 * aunque su fecha no haya llegado.
 */
export async function getUpcomingOfficialEvents(limite = 3): Promise<OfficialEvent[]> {
  if (!isSupabaseReady()) return []

  const medianocheDeHoy = inicioDelDiaSVenUTC()

  const { data: events, error } = await supabase
    .from('official_events')
    .select('*')
    .in('status', ['open', 'active'])
    .not('date', 'is', null)
    .gte('date', medianocheDeHoy.toISOString())
    // Por cuándo EMPIEZA, no por cuándo se creó: en una lista de «lo que
    // viene», lo más cercano va primero.
    .order('date', { ascending: true })
    .limit(limite)

  // Gotcha 2f: sin mirar `error`, un fallo de RLS se vería igual que «no hay
  // eventos» y el Inicio se quedaría mudo sin que nadie se entere.
  if (error) {
    console.warn('[eventos] próximos:', error.message)
    return []
  }
  if (!events || events.length === 0) return []

  const organizerIds = [...new Set(events.map(e => e.organizer_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, avatar')
    .in('id', organizerIds)
  const profileMap = new Map((profiles || []).map(p => [p.id, p]))

  const inscritos = await contarInscritos(events.map(e => e.id))

  return events.map(e => ({
    ...e,
    organizer_name: profileMap.get(e.organizer_id)?.name || 'Organizador',
    organizer_avatar: profileMap.get(e.organizer_id)?.avatar || '🎯',
    registered_count: inscritos?.get(e.id),
  } as OfficialEvent))
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

export async function updateOfficialEvent(
  eventId: string,
  updates: { date?: string | null; location?: string | null; name?: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Supabase no configurado' }

  // Verify we have an authenticated session
  const { data: session } = await supabase.auth.getSession()
  if (!session?.session) {
    return { ok: false, error: 'No hay sesión activa. Cierre sesión y vuelva a iniciar.' }
  }

  console.log('[updateEvent] eventId:', eventId, 'updates:', updates, 'userId:', session.session.user.id)

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.date !== undefined) payload.date = updates.date
  if (updates.location !== undefined) payload.location = updates.location
  if (updates.name !== undefined) payload.name = updates.name

  const { data, error, status, statusText } = await supabase
    .from('official_events')
    .update(payload)
    .eq('id', eventId)
    .select()

  console.log('[updateEvent] response:', { data, error, status, statusText })

  if (error) return { ok: false, error: `Error ${status}: ${error.message}` }
  if (!data || data.length === 0) {
    return { ok: false, error: `Sin permiso (RLS). Status: ${status}. Verifique que ejecutó el SQL fix en Supabase Dashboard.` }
  }
  return { ok: true }
}

export async function deleteOfficialEvent(eventId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  // CASCADE on event_registrations handles cleanup automatically
  const { data, error } = await supabase
    .from('official_events')
    .delete()
    .eq('id', eventId)
    .select()

  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Sin permiso para eliminar este evento' }
  }
  return { ok: true }
}

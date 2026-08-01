import { supabase, isSupabaseReady } from './supabase'

// ─── Types ───────────────────────────────────────────────────

/** Qué clase de ítem es. `news` es el suelto de siempre. */
export type NewsKind = 'news' | 'event' | 'release'

/** Nomenclatura real del programa de juego organizado de SWU. */
export type EventType =
  | 'galactic' | 'planetary' | 'sector' | 'regional'
  | 'showdown' | 'prerelease' | 'weekly' | 'other'

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  galactic: 'Galactic Championship',
  planetary: 'Planetary Qualifier',
  sector: 'Sector Qualifier',
  regional: 'Regional Qualifier',
  showdown: 'Store Showdown',
  prerelease: 'Prerelease',
  weekly: 'Weekly Play',
  other: 'Evento',
}

/** De mayor a menor jerarquía, que es como el jugador los ordena mentalmente. */
export const EVENT_TYPE_ORDER: EventType[] = [
  'galactic', 'planetary', 'sector', 'regional', 'showdown', 'prerelease', 'weekly', 'other',
]

export interface NewsItem {
  id: string
  author_id: string
  title: string
  summary: string
  tag: string
  tag_color: string
  url: string | null
  image_url: string | null
  pinned: boolean
  published: boolean
  created_at: string
  updated_at: string
  // ── Estructura de evento (opcional; solo con kind='event') ──
  kind: NewsKind
  event_type: EventType | null
  event_date: string | null
  event_location: string | null
  event_format: string | null
  registration_url: string | null
  // Joined
  author_name?: string
}

// ─── Read ────────────────────────────────────────────────────

export async function getNews(limit = 20): Promise<NewsItem[]> {
  if (!isSupabaseReady()) return []

  const { data, error } = await supabase
    .from('news')
    .select('*')
    .eq('published', true)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  // Fetch author names
  const authorIds = [...new Set(data.map(n => n.author_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', authorIds)
  const profileMap = new Map((profiles || []).map(p => [p.id, p.name]))

  return data.map(n => ({
    ...n,
    author_name: profileMap.get(n.author_id) || 'Admin',
  }))
}

// ─── Admin: All news (including drafts) ──────────────────────

export async function getAllNewsAdmin(): Promise<NewsItem[]> {
  if (!isSupabaseReady()) return []

  // Admin needs to see unpublished too — but RLS only allows published=true for SELECT
  // So we use a workaround: fetch published + use service role or just fetch all we can
  // Actually since RLS policy is published=true, admin can't see drafts via client...
  // We'll adjust: admin will only manage published items from client
  // For drafts, they'd need to publish first (or we'd need an RPC function)

  const { data, error } = await supabase
    .from('news')
    .select('*')
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data
}

// ─── Create ──────────────────────────────────────────────────

export async function createNews(item: {
  title: string
  summary: string
  tag: string
  tagColor: string
  url?: string
  imageUrl?: string
  pinned?: boolean
  authorId: string
  // ── Estructura de evento ──
  kind?: NewsKind
  eventType?: EventType | null
  eventDate?: string | null
  eventLocation?: string | null
  eventFormat?: string | null
  registrationUrl?: string | null
}): Promise<{ ok: boolean; news?: NewsItem; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión al servidor' }

  const kind = item.kind ?? 'news'
  // La base lo exige con un CHECK; se avisa acá para no mostrar un error de
  // Postgres crudo en la pantalla del editor.
  if (kind === 'event' && !item.eventDate) {
    return { ok: false, error: 'Un evento necesita fecha' }
  }

  const { data, error } = await supabase
    .from('news')
    .insert({
      author_id: item.authorId,
      title: item.title,
      summary: item.summary,
      tag: item.tag,
      tag_color: item.tagColor,
      url: item.url || null,
      image_url: item.imageUrl || null,
      pinned: item.pinned || false,
      published: true,
      kind,
      event_type: kind === 'event' ? (item.eventType ?? 'other') : null,
      event_date: item.eventDate || null,
      event_location: item.eventLocation || null,
      event_format: item.eventFormat || null,
      registration_url: item.registrationUrl || null,
    })
    .select()
    .single()

  if (error) {
    if (error.message.includes('policy')) {
      return { ok: false, error: 'No tiene permisos para crear noticias' }
    }
    return { ok: false, error: error.message }
  }

  return { ok: true, news: data }
}

// ─── Update ──────────────────────────────────────────────────

export async function updateNews(
  id: string,
  updates: Partial<{
    title: string
    summary: string
    tag: string
    tag_color: string
    url: string | null
    image_url: string | null
    pinned: boolean
    published: boolean
    kind: NewsKind
    event_type: EventType | null
    event_date: string | null
    event_location: string | null
    event_format: string | null
    registration_url: string | null
  }>
): Promise<{ ok: boolean; error?: string }> {
  if (updates.kind === 'event' && updates.event_date === null) {
    return { ok: false, error: 'Un evento necesita fecha' }
  }
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  const { error } = await supabase
    .from('news')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ─── Delete ──────────────────────────────────────────────────

export async function deleteNews(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión' }

  const { error } = await supabase
    .from('news')
    .delete()
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ─── Agenda de eventos oficiales ─────────────────────────────

/**
 * Los eventos oficiales, separados en los que vienen y los que ya pasaron.
 *
 * Se piden a la base ordenados por `event_date` (hay un índice parcial para
 * eso) en vez de traer todo y ordenar en el cliente: la agenda crece sola con
 * cada temporada y no tiene sentido bajarla entera para mostrar los próximos
 * cinco.
 *
 * "Ya pasó" se decide contra el DÍA, no contra la hora: un torneo que empezó
 * esta mañana sigue siendo el evento de hoy hasta que termine el día.
 */
export async function getOfficialEvents(opts?: { limit?: number }): Promise<{
  upcoming: NewsItem[]
  past: NewsItem[]
}> {
  if (!isSupabaseReady()) return { upcoming: [], past: [] }

  const limit = opts?.limit ?? 20
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const cutoff = startOfToday.toISOString()

  const [up, old] = await Promise.all([
    supabase.from('news').select('*')
      .eq('published', true).eq('kind', 'event')
      .gte('event_date', cutoff)
      .order('event_date', { ascending: true })
      .limit(limit),
    supabase.from('news').select('*')
      .eq('published', true).eq('kind', 'event')
      .lt('event_date', cutoff)
      .order('event_date', { ascending: false })
      .limit(limit),
  ])

  if (up.error) console.warn('[News] próximos eventos:', up.error.message)
  if (old.error) console.warn('[News] eventos pasados:', old.error.message)

  return {
    upcoming: (up.data ?? []) as NewsItem[],
    past: (old.data ?? []) as NewsItem[],
  }
}

/** Solo los anuncios sueltos: la agenda tiene su propia consulta. */
export async function getAnnouncements(limit = 20): Promise<NewsItem[]> {
  if (!isSupabaseReady()) return []
  const { data, error } = await supabase
    .from('news').select('*')
    .eq('published', true).neq('kind', 'event')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('[News] anuncios:', error.message)
    return []
  }
  return (data ?? []) as NewsItem[]
}

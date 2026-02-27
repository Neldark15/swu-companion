import { supabase, isSupabaseReady } from './supabase'

// ─── Types ───────────────────────────────────────────────────

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
}): Promise<{ ok: boolean; news?: NewsItem; error?: string }> {
  if (!isSupabaseReady()) return { ok: false, error: 'Sin conexión al servidor' }

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
  }>
): Promise<{ ok: boolean; error?: string }> {
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

/**
 * Announcement Service — orquesta el envío de anuncios a múltiples canales:
 *   - Web Push (a usuarios con push activado)
 *   - In-app toast (broadcast realtime para usuarios con app abierta)
 *   - Noticia en home (entrada permanente en news table)
 *
 * El admin usa esto desde /admin/announcements para anuncios genéricos
 * (mercadería, eventos, comunidad, etc.).
 */

import { supabase, isSupabaseReady } from './supabase'
import { logAdminAction } from './adminService'
import { createNews } from './news'

export interface AnnouncementChannels {
  push: boolean        // Web Push (PWA cerrada o abierta)
  toast: boolean       // In-app broadcast (toast realtime — app abierta)
  news: boolean        // Entrada permanente en home news feed
  newsPinned?: boolean // Si news=true, también pinear arriba
}

export type AnnouncementAudienceMode = 'all_subscribers' | 'event' | 'specific_user'

export interface AnnouncementAudience {
  mode: AnnouncementAudienceMode
  eventCode?: string   // si mode='event'
  userId?: string      // si mode='specific_user'
}

export interface AnnouncementInput {
  title: string
  body: string
  imageUrl?: string
  ctaLabel?: string
  ctaUrl?: string
  tag?: string         // 'Merch' | 'Evento' | 'Noticia' | 'Comunidad' | custom
  tagColor?: string
  icon?: string        // emoji
  channels: AnnouncementChannels
  audience: AnnouncementAudience
}

export interface AnnouncementResult {
  ok: boolean
  channelResults: {
    push?: { ok: boolean; sent?: number; failed?: number; error?: string }
    toast?: { ok: boolean; error?: string }
    news?: { ok: boolean; newsId?: string; error?: string }
  }
  error?: string
}

/**
 * Sends an announcement across the selected channels in parallel.
 * Best-effort per channel — a failure in one doesn't block the others.
 * Logs to audit_logs with action='announcement.send'.
 */
export async function createAnnouncement(
  input: AnnouncementInput,
  actor: { id: string; name: string }
): Promise<AnnouncementResult> {
  if (!isSupabaseReady()) {
    return { ok: false, channelResults: {}, error: 'Sin conexión al servidor' }
  }

  const { title, body, channels, audience } = input
  if (!title.trim() || !body.trim()) {
    return { ok: false, channelResults: {}, error: 'Título y cuerpo son obligatorios' }
  }
  if (!channels.push && !channels.toast && !channels.news) {
    return { ok: false, channelResults: {}, error: 'Selecciona al menos un canal' }
  }

  const channelResults: AnnouncementResult['channelResults'] = {}

  // ── Toast (in-app realtime) ──
  if (channels.toast) {
    try {
      const { error } = await supabase.from('tournament_broadcasts').insert({
        event_id: null,
        event_name: input.tag || 'HOLOCRON SWU',
        event_code: null,
        type: 'announcement',
        message: title,
        payload: {
          body,
          icon: input.icon,
          imageUrl: input.imageUrl,
          ctaLabel: input.ctaLabel,
          ctaUrl: input.ctaUrl,
          tag: input.tag,
        },
      })
      channelResults.toast = { ok: !error, error: error?.message }
    } catch (e) {
      channelResults.toast = { ok: false, error: e instanceof Error ? e.message : 'Error en broadcast' }
    }
  }

  // ── News (persistent home feed) ──
  if (channels.news) {
    try {
      const newsResult = await createNews({
        title,
        summary: body,
        tag: input.tag || 'General',
        tagColor: input.tagColor || 'default',
        url: input.ctaUrl,
        imageUrl: input.imageUrl,
        pinned: input.channels.newsPinned ?? false,
        authorId: actor.id,
      })
      channelResults.news = {
        ok: newsResult.ok,
        newsId: newsResult.news?.id,
        error: newsResult.error,
      }
    } catch (e) {
      channelResults.news = { ok: false, error: e instanceof Error ? e.message : 'Error creando noticia' }
    }
  }

  // ── Push (Web Push to subscribers) ──
  if (channels.push) {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        channelResults.push = { ok: false, error: 'Sin sesión activa para autenticar push' }
      } else {
        // Resolve eventId from code if needed
        let targets: { userIds?: string[]; eventId?: string; allSubscribers?: boolean } = {}
        if (audience.mode === 'all_subscribers') {
          targets = { allSubscribers: true }
        } else if (audience.mode === 'event' && audience.eventCode) {
          const { data: ev } = await supabase
            .from('official_events')
            .select('id')
            .eq('code', audience.eventCode.toUpperCase())
            .single()
          if (ev) targets = { eventId: ev.id }
          else {
            channelResults.push = { ok: false, error: `Evento ${audience.eventCode} no encontrado` }
          }
        } else if (audience.mode === 'specific_user' && audience.userId) {
          targets = { userIds: [audience.userId] }
        }

        if (Object.keys(targets).length > 0) {
          const res = await fetch('/api/send-push', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              title: input.icon ? `${input.icon} ${title}` : title,
              body,
              link: input.ctaUrl || '/',
              tag: `announcement-${Date.now()}`,
              type: 'announcement',
              targets,
            }),
          })
          const json = await res.json()
          if (!res.ok) {
            channelResults.push = { ok: false, error: json.error || `HTTP ${res.status}` }
          } else {
            channelResults.push = {
              ok: true,
              sent: json.sent ?? 0,
              failed: json.failed ?? 0,
            }
          }
        }
      }
    } catch (e) {
      channelResults.push = { ok: false, error: e instanceof Error ? e.message : 'Error enviando push' }
    }
  }

  // ── Audit log ──
  logAdminAction('announcement.send', {
    actorId: actor.id,
    actorName: actor.name,
    targetType: 'announcement',
    metadata: {
      title,
      tag: input.tag,
      channels,
      audience,
      results: channelResults,
    },
  })

  // Overall ok: at least one channel succeeded
  const anyOk = Object.values(channelResults).some(r => r?.ok)
  return { ok: anyOk, channelResults }
}

// ─── History (from audit_logs) ─────────────────────────────

export interface AnnouncementHistoryEntry {
  id: string
  created_at: string
  actor_name: string | null
  title: string
  tag: string | null
  channels: AnnouncementChannels
  results: AnnouncementResult['channelResults']
}

export async function getAnnouncementHistory(limit = 20): Promise<AnnouncementHistoryEntry[]> {
  if (!isSupabaseReady()) return []
  const { data } = await supabase
    .from('audit_logs')
    .select('id, created_at, actor_name, metadata')
    .eq('action', 'announcement.send')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!data) return []

  return data.map(row => {
    const meta = (row.metadata as Record<string, unknown>) || {}
    return {
      id: row.id,
      created_at: row.created_at,
      actor_name: row.actor_name,
      title: (meta.title as string) || '(sin título)',
      tag: (meta.tag as string) || null,
      channels: (meta.channels as AnnouncementChannels) || { push: false, toast: false, news: false },
      results: (meta.results as AnnouncementResult['channelResults']) || {},
    }
  })
}

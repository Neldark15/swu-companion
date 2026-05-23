/**
 * AdminAnnouncementsPage — Centro de Comunicaciones del admin.
 * Route: /admin/announcements
 *
 * Composer multi-canal para crear anuncios (mercadería, eventos, comunidad,
 * lo que sea) y enviarlos por: Push, In-app toast, Noticia en home.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  Megaphone, Send, Loader2, CheckCircle2, AlertTriangle, History,
  Bell, MessageSquare, Newspaper, Image as ImageIcon, Link as LinkIcon,
  Globe, Users, UserPlus, Smile, Tag, Sparkles, Pin, Eye, EyeOff,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  createAnnouncement,
  getAnnouncementHistory,
  type AnnouncementChannels,
  type AnnouncementAudience,
  type AnnouncementAudienceMode,
  type AnnouncementHistoryEntry,
} from '../../services/announcementService'
import { getAllUsers, type AdminUserRow } from '../../services/adminService'

// ─── Tag presets ─────────────────────────────────────────

const TAG_PRESETS = [
  { label: 'Mercadería', color: 'amber', icon: '🛒' },
  { label: 'Nuevo Set', color: 'amber', icon: '🃏' },
  { label: 'Evento', color: 'green', icon: '🏆' },
  { label: 'Torneo', color: 'green', icon: '⚔️' },
  { label: 'Comunidad', color: 'accent', icon: '🌌' },
  { label: 'Anuncio', color: 'accent', icon: '📣' },
  { label: 'Urgente', color: 'red', icon: '🚨' },
  { label: 'Noticia', color: 'default', icon: '📰' },
]

// ─── Templates (plantillas listas para usar) ─────────────

interface Template {
  name: string
  icon: string
  tag: string
  tagColor: string
  emoji: string
  title: string
  body: string
  ctaLabel?: string
  channels: AnnouncementChannels
}

const TEMPLATES: Template[] = [
  {
    name: 'Mercadería nueva',
    icon: '🛒',
    tag: 'Mercadería',
    tagColor: 'amber',
    emoji: '🛒',
    title: 'Nueva mercadería disponible',
    body: 'Acabamos de recibir nueva mercadería oficial. Stock limitado — pasa a verla.',
    ctaLabel: 'Ver tienda',
    channels: { push: true, toast: true, news: true, newsPinned: false },
  },
  {
    name: 'Torneo próximo',
    icon: '🏆',
    tag: 'Torneo',
    tagColor: 'green',
    emoji: '🏆',
    title: 'Próximo torneo SWU',
    body: 'Inscripciones abiertas. Lugar, fecha y formato en el siguiente link.',
    ctaLabel: 'Inscribirse',
    channels: { push: true, toast: true, news: true, newsPinned: true },
  },
  {
    name: 'Nuevo set',
    icon: '🃏',
    tag: 'Nuevo Set',
    tagColor: 'amber',
    emoji: '🃏',
    title: 'Nuevo set lanzado',
    body: 'Las cartas del nuevo set ya están disponibles en la base de datos.',
    ctaLabel: 'Ver cartas',
    channels: { push: true, toast: true, news: true, newsPinned: false },
  },
  {
    name: 'Anuncio urgente',
    icon: '🚨',
    tag: 'Urgente',
    tagColor: 'red',
    emoji: '🚨',
    title: '',
    body: '',
    channels: { push: true, toast: true, news: false },
  },
  {
    name: 'En blanco',
    icon: '✏️',
    tag: '',
    tagColor: 'default',
    emoji: '',
    title: '',
    body: '',
    channels: { push: false, toast: true, news: true, newsPinned: false },
  },
]

export function AdminAnnouncementsPage() {
  const { supabaseUser, currentProfile } = useAuth()

  // ── Form state ──
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [ctaLabel, setCtaLabel] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [tag, setTag] = useState('')
  const [tagColor, setTagColor] = useState('default')
  const [icon, setIcon] = useState('')

  const [channels, setChannels] = useState<AnnouncementChannels>({
    push: true,
    toast: true,
    news: true,
    newsPinned: false,
  })

  const [audienceMode, setAudienceMode] = useState<AnnouncementAudienceMode>('all_subscribers')
  const [eventCode, setEventCode] = useState('')
  const [userId, setUserId] = useState('')
  const [users, setUsers] = useState<AdminUserRow[]>([])

  // ── UI state ──
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [history, setHistory] = useState<AnnouncementHistoryEntry[]>([])

  // ── Load users for picker + history on mount ──
  useEffect(() => {
    getAllUsers().then(setUsers)
    refreshHistory()
  }, [])

  const refreshHistory = async () => {
    setHistory(await getAnnouncementHistory(20))
  }

  const applyTemplate = (t: Template) => {
    setTag(t.tag)
    setTagColor(t.tagColor)
    setIcon(t.emoji)
    setTitle(t.title)
    setBody(t.body)
    setCtaLabel(t.ctaLabel || '')
    setChannels(t.channels)
    setResult(null)
  }

  const reset = () => {
    setTitle('')
    setBody('')
    setImageUrl('')
    setCtaLabel('')
    setCtaUrl('')
    setTag('')
    setTagColor('default')
    setIcon('')
    setChannels({ push: true, toast: true, news: true, newsPinned: false })
    setAudienceMode('all_subscribers')
    setEventCode('')
    setUserId('')
    setResult(null)
  }

  const canSend = useMemo(() => {
    if (!title.trim() || !body.trim()) return false
    if (!channels.push && !channels.toast && !channels.news) return false
    if (audienceMode === 'event' && !eventCode.trim()) return false
    if (audienceMode === 'specific_user' && !userId) return false
    return true
  }, [title, body, channels, audienceMode, eventCode, userId])

  const send = async () => {
    if (!supabaseUser || !currentProfile) {
      setResult({ ok: false, msg: 'Sin sesión activa' })
      return
    }
    setSending(true)
    setResult(null)

    const audience: AnnouncementAudience = {
      mode: audienceMode,
      eventCode: audienceMode === 'event' ? eventCode : undefined,
      userId: audienceMode === 'specific_user' ? userId : undefined,
    }

    const r = await createAnnouncement(
      {
        title: title.trim(),
        body: body.trim(),
        imageUrl: imageUrl.trim() || undefined,
        ctaLabel: ctaLabel.trim() || undefined,
        ctaUrl: ctaUrl.trim() || undefined,
        tag: tag.trim() || undefined,
        tagColor,
        icon: icon || undefined,
        channels,
        audience,
      },
      { id: supabaseUser.id, name: currentProfile.name }
    )

    setSending(false)
    if (!r.ok) {
      setResult({ ok: false, msg: r.error || 'Error en todos los canales' })
    } else {
      const parts: string[] = []
      if (r.channelResults.push) parts.push(r.channelResults.push.ok ? `push ✓ (${r.channelResults.push.sent ?? 0})` : `push ✗`)
      if (r.channelResults.toast) parts.push(r.channelResults.toast.ok ? `toast ✓` : `toast ✗`)
      if (r.channelResults.news) parts.push(r.channelResults.news.ok ? `news ✓` : `news ✗`)
      setResult({ ok: true, msg: `Enviado — ${parts.join(' · ')}` })
      reset()
      await refreshHistory()
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-swu-text flex items-center gap-2">
            <Megaphone size={22} className="text-swu-accent" />
            Centro de Comunicaciones
          </h1>
          <p className="text-sm text-swu-muted mt-1">
            Componé y enviá anuncios por push, in-app y home feed
          </p>
        </div>
      </header>

      {/* ── Plantillas ── */}
      <section>
        <h3 className="text-[10px] uppercase tracking-wider text-swu-muted font-bold mb-2 flex items-center gap-1.5">
          <Sparkles size={11} /> Plantillas rápidas
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {TEMPLATES.map(t => (
            <button
              key={t.name}
              onClick={() => applyTemplate(t)}
              className="bg-swu-surface border border-swu-border rounded-xl p-3 text-left hover:border-swu-accent/40 transition-colors"
            >
              <div className="text-2xl mb-1">{t.icon}</div>
              <p className="text-[11px] font-semibold text-swu-text">{t.name}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ── Composer ── */}
      <section className="bg-swu-surface rounded-xl border border-swu-border p-4 space-y-4">
        {/* Tag + emoji */}
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div>
            <Label icon={Tag}>Tag / Categoría</Label>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {TAG_PRESETS.map(t => (
                <button
                  key={t.label}
                  onClick={() => { setTag(t.label); setTagColor(t.color); if (!icon) setIcon(t.icon) }}
                  className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                    tag === t.label
                      ? 'bg-swu-accent/15 border-swu-accent text-swu-accent'
                      : 'bg-swu-bg border-swu-border text-swu-muted hover:text-swu-text'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="o custom…"
                className="text-[11px] px-2 py-1 rounded-md bg-swu-bg border border-swu-border text-swu-text w-24"
              />
            </div>
          </div>
          <div>
            <Label icon={Smile}>Emoji</Label>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value.slice(0, 4))}
              placeholder="📣"
              className="w-14 mt-1.5 px-2 py-1.5 text-center text-xl bg-swu-bg border border-swu-border rounded-md"
            />
          </div>
        </div>

        {/* Title */}
        <div>
          <Label>Título</Label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="Nueva mercadería oficial disponible"
            className="w-full mt-1 px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text"
          />
          <p className="text-[10px] text-swu-muted/60 mt-0.5">{title.length}/100</p>
        </div>

        {/* Body */}
        <div>
          <Label>Cuerpo del mensaje</Label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={400}
            rows={3}
            placeholder="Detalle del anuncio. Aparece en push, toast y home feed."
            className="w-full mt-1 px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text resize-none"
          />
          <p className="text-[10px] text-swu-muted/60 mt-0.5">{body.length}/400</p>
        </div>

        {/* Image + CTA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label icon={ImageIcon}>URL de imagen (opcional)</Label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://… (banner o foto de producto)"
              className="w-full mt-1 px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label icon={LinkIcon}>Texto del botón</Label>
              <input
                type="text"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="Comprar"
                className="w-full mt-1 px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text"
              />
            </div>
            <div>
              <Label>URL del CTA</Label>
              <input
                type="text"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://… o /events"
                className="w-full mt-1 px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text font-mono"
              />
            </div>
          </div>
        </div>

        {/* Channels */}
        <div>
          <Label>Canales (multi-select)</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1.5">
            <ChannelCard
              icon={Bell}
              label="Push notification"
              desc="A todos los que activaron push"
              active={channels.push}
              onToggle={() => setChannels(c => ({ ...c, push: !c.push }))}
            />
            <ChannelCard
              icon={MessageSquare}
              label="Toast in-app"
              desc="Aparece si tienen la app abierta"
              active={channels.toast}
              onToggle={() => setChannels(c => ({ ...c, toast: !c.toast }))}
            />
            <ChannelCard
              icon={Newspaper}
              label="Noticia en home"
              desc="Queda permanente en el feed"
              active={channels.news}
              onToggle={() => setChannels(c => ({ ...c, news: !c.news }))}
            />
          </div>
          {channels.news && (
            <label className="flex items-center gap-2 mt-2 cursor-pointer text-[11px] text-swu-muted">
              <input
                type="checkbox"
                checked={channels.newsPinned ?? false}
                onChange={(e) => setChannels(c => ({ ...c, newsPinned: e.target.checked }))}
                className="accent-swu-accent"
              />
              <Pin size={11} /> Anclar la noticia arriba del feed
            </label>
          )}
        </div>

        {/* Audience */}
        <div>
          <Label>Audiencia</Label>
          <div className="grid grid-cols-3 gap-2 mt-1.5">
            <AudienceCard
              icon={Globe}
              label="Todos"
              active={audienceMode === 'all_subscribers'}
              onClick={() => setAudienceMode('all_subscribers')}
            />
            <AudienceCard
              icon={Users}
              label="Por evento"
              active={audienceMode === 'event'}
              onClick={() => setAudienceMode('event')}
            />
            <AudienceCard
              icon={UserPlus}
              label="Usuario"
              active={audienceMode === 'specific_user'}
              onClick={() => setAudienceMode('specific_user')}
            />
          </div>

          {audienceMode === 'event' && (
            <input
              type="text"
              value={eventCode}
              onChange={(e) => setEventCode(e.target.value.toUpperCase())}
              placeholder="SWUXXXX"
              className="w-full mt-2 px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text font-mono"
            />
          )}
          {audienceMode === 'specific_user' && (
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full mt-2 px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text"
            >
              <option value="">Seleccionar usuario…</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.role === 'admin' ? '(admin)' : ''} — {u.id.slice(0, 8)}…
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Preview toggle + send */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => setPreviewOpen(p => !p)}
            className="px-3 py-2 rounded-lg bg-swu-surface border border-swu-border text-xs text-swu-muted hover:text-swu-text flex items-center gap-1.5"
          >
            {previewOpen ? <EyeOff size={12} /> : <Eye size={12} />}
            {previewOpen ? 'Ocultar preview' : 'Ver preview'}
          </button>
          <button
            onClick={send}
            disabled={!canSend || sending}
            className="flex-1 py-2.5 rounded-lg bg-swu-accent text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? 'Enviando…' : 'Enviar anuncio'}
          </button>
        </div>

        {result && (
          <div className={`rounded-lg p-2.5 text-[11px] flex items-start gap-2 ${
            result.ok
              ? 'bg-swu-green/10 border border-swu-green/30 text-swu-green'
              : 'bg-swu-red/10 border border-swu-red/30 text-swu-red'
          }`}>
            {result.ok ? <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0" /> : <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />}
            <span>{result.msg}</span>
          </div>
        )}
      </section>

      {/* ── Preview ── */}
      {previewOpen && (title.trim() || body.trim()) && (
        <section className="bg-swu-surface/50 rounded-xl border border-swu-border/60 p-4 space-y-3">
          <h3 className="text-[10px] uppercase tracking-wider text-swu-muted font-bold">Preview por canal</h3>

          {channels.push && (
            <PreviewBlock label="Web Push (PWA cerrada o abierta)">
              <div className="bg-black/40 rounded-lg p-3 border border-swu-border/40 flex gap-3 max-w-md">
                <img src="/icon-192.png" alt="" className="w-10 h-10 rounded-md flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-swu-text/80 font-semibold">HOLOCRON SWU</p>
                  <p className="text-sm text-swu-text font-bold truncate">{icon} {title || '(título)'}</p>
                  <p className="text-[11px] text-swu-muted line-clamp-2">{body || '(cuerpo)'}</p>
                </div>
              </div>
            </PreviewBlock>
          )}

          {channels.toast && (
            <PreviewBlock label="Toast in-app">
              <div className="bg-swu-surface rounded-lg p-3 border border-swu-accent/30 max-w-sm">
                <div className="flex items-start gap-2">
                  <span className="text-xl">{icon || '📣'}</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-swu-text">{title || '(título)'}</p>
                    <p className="text-[11px] text-swu-muted">{body || '(cuerpo)'}</p>
                  </div>
                </div>
              </div>
            </PreviewBlock>
          )}

          {channels.news && (
            <PreviewBlock label="Entrada en home feed">
              <div className="bg-swu-surface rounded-lg p-3 border border-swu-border max-w-md">
                {tag && (
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    tagColor === 'amber' ? 'bg-swu-amber/15 text-swu-amber'
                      : tagColor === 'green' ? 'bg-swu-green/15 text-swu-green'
                      : tagColor === 'red' ? 'bg-swu-red/15 text-swu-red'
                      : tagColor === 'accent' ? 'bg-swu-accent/15 text-swu-accent'
                      : 'bg-swu-muted/15 text-swu-muted'
                  }`}>{tag}</span>
                )}
                <h4 className="text-sm font-extrabold text-swu-text mt-1.5">{title || '(título)'}</h4>
                <p className="text-[11px] text-swu-muted mt-0.5 line-clamp-2">{body || '(cuerpo)'}</p>
                {imageUrl && (
                  <img src={imageUrl} alt="" className="mt-2 w-full h-32 object-cover rounded-md" />
                )}
                {ctaLabel && ctaUrl && (
                  <button className="mt-2 px-3 py-1.5 bg-swu-accent/15 text-swu-accent text-xs font-bold rounded-md">
                    {ctaLabel} →
                  </button>
                )}
              </div>
            </PreviewBlock>
          )}
        </section>
      )}

      {/* ── History ── */}
      <section>
        <h3 className="text-[10px] uppercase tracking-wider text-swu-muted font-bold mb-2 flex items-center gap-1.5">
          <History size={11} /> Últimos enviados ({history.length})
        </h3>
        {history.length === 0 ? (
          <p className="text-[12px] text-swu-muted">Aún no enviaste ningún anuncio.</p>
        ) : (
          <div className="space-y-2">
            {history.map(h => (
              <HistoryRow key={h.id} entry={h} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ─── Subcomponents ────────────────────────────────────────

function Label({ icon: Icon, children }: { icon?: typeof Bell; children: React.ReactNode }) {
  return (
    <label className="text-[10px] uppercase tracking-wider text-swu-muted font-medium flex items-center gap-1">
      {Icon && <Icon size={10} />}
      {children}
    </label>
  )
}

function ChannelCard({
  icon: Icon, label, desc, active, onToggle,
}: {
  icon: typeof Bell
  label: string
  desc: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={`text-left p-3 rounded-lg border transition-colors ${
        active
          ? 'bg-swu-accent/10 border-swu-accent'
          : 'bg-swu-bg border-swu-border hover:border-swu-accent/30'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Icon size={14} className={active ? 'text-swu-accent' : 'text-swu-muted'} />
        <p className={`text-sm font-bold ${active ? 'text-swu-accent' : 'text-swu-text'}`}>{label}</p>
      </div>
      <p className="text-[10px] text-swu-muted mt-0.5">{desc}</p>
    </button>
  )
}

function AudienceCard({
  icon: Icon, label, active, onClick,
}: {
  icon: typeof Globe
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-colors ${
        active
          ? 'bg-swu-accent/15 border-swu-accent text-swu-accent'
          : 'bg-swu-bg border-swu-border text-swu-muted hover:text-swu-text'
      }`}
    >
      <Icon size={16} />
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  )
}

function PreviewBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-swu-amber font-mono uppercase tracking-wider mb-1.5">{label}</p>
      {children}
    </div>
  )
}

function HistoryRow({ entry }: { entry: AnnouncementHistoryEntry }) {
  const time = new Date(entry.created_at)
  const ago = relativeTime(time)
  const channelTags: string[] = []
  if (entry.channels.push) channelTags.push('Push')
  if (entry.channels.toast) channelTags.push('Toast')
  if (entry.channels.news) channelTags.push('News')

  return (
    <div className="bg-swu-surface rounded-lg border border-swu-border p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-swu-text truncate">{entry.title}</p>
        <div className="text-[10px] text-swu-muted flex items-center gap-2 mt-0.5 flex-wrap">
          {entry.tag && <span className="font-mono">{entry.tag}</span>}
          <span>·</span>
          <span>{channelTags.join(' + ') || 'sin canales'}</span>
          <span>·</span>
          <span title={time.toLocaleString('es')}>hace {ago}</span>
          {entry.actor_name && (<><span>·</span><span>{entry.actor_name}</span></>)}
        </div>
      </div>
      <ChannelMiniStatus res={entry.results} />
    </div>
  )
}

function ChannelMiniStatus({ res }: { res: AnnouncementHistoryEntry['results'] }) {
  return (
    <div className="flex gap-1">
      {res.push && (
        <span title={res.push.ok ? `Push enviado a ${res.push.sent ?? 0}` : `Push falló: ${res.push.error}`}
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${res.push.ok ? 'bg-swu-green/15 text-swu-green' : 'bg-swu-red/15 text-swu-red'}`}>
          Push {res.push.ok ? '✓' : '✗'}
        </span>
      )}
      {res.toast && (
        <span title={res.toast.ok ? 'Toast OK' : `Toast falló: ${res.toast.error}`}
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${res.toast.ok ? 'bg-swu-green/15 text-swu-green' : 'bg-swu-red/15 text-swu-red'}`}>
          Toast {res.toast.ok ? '✓' : '✗'}
        </span>
      )}
      {res.news && (
        <span title={res.news.ok ? 'News OK' : `News falló: ${res.news.error}`}
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${res.news.ok ? 'bg-swu-green/15 text-swu-green' : 'bg-swu-red/15 text-swu-red'}`}>
          News {res.news.ok ? '✓' : '✗'}
        </span>
      )}
    </div>
  )
}

function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const days = Math.floor(hr / 24)
  return `${days}d`
}

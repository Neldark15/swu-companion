import { useEffect, useState } from 'react'
import { Bell, Send, Loader2, CheckCircle2, AlertTriangle, Globe, Users, UserPlus } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { getAllUsers, type AdminUserRow } from '../../services/adminService'

type TargetMode = 'all_subscribers' | 'event' | 'specific_user'

export function AdminPushPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [link, setLink] = useState('')
  const [targetMode, setTargetMode] = useState<TargetMode>('all_subscribers')
  const [eventCode, setEventCode] = useState('')
  const [userId, setUserId] = useState('')
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [subCount, setSubCount] = useState<number | null>(null)

  useEffect(() => {
    // Count of active push subscriptions
    supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => setSubCount(count ?? 0))

    // Load users for "specific user" picker
    getAllUsers().then(setUsers)
  }, [])

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      setResult({ ok: false, msg: 'Título y cuerpo son obligatorios' })
      return
    }
    setSending(true)
    setResult(null)

    // Resolve targets
    let targets: { userIds?: string[]; eventId?: string; allSubscribers?: boolean } = {}
    if (targetMode === 'all_subscribers') {
      targets = { allSubscribers: true }
    } else if (targetMode === 'event') {
      // Need to lookup the event_id from code
      const { data: ev } = await supabase
        .from('official_events')
        .select('id')
        .eq('code', eventCode.toUpperCase())
        .single()
      if (!ev) {
        setSending(false)
        setResult({ ok: false, msg: 'Código de evento no encontrado' })
        return
      }
      targets = { eventId: ev.id }
    } else {
      if (!userId) {
        setSending(false)
        setResult({ ok: false, msg: 'Selecciona un usuario' })
        return
      }
      targets = { userIds: [userId] }
    }

    // Get auth token
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) {
      setSending(false)
      setResult({ ok: false, msg: 'No hay sesión activa' })
      return
    }

    try {
      const res = await fetch('/api/send-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          link: link.trim() || '/',
          tag: 'admin-broadcast',
          type: 'admin',
          targets,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setResult({ ok: false, msg: json.error || `Error ${res.status}` })
      } else {
        setResult({
          ok: true,
          msg: `Enviado a ${json.sent} de ${json.targeted} suscripciones${json.removed > 0 ? `, ${json.removed} muertas eliminadas` : ''}`,
        })
        setTitle('')
        setBody('')
        setLink('')
      }
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : 'Error de red' })
    }
    setSending(false)
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-swu-text">Notificaciones Push</h1>
        <p className="text-sm text-swu-muted mt-1">Envía notificaciones Web Push a usuarios con la PWA instalada</p>
      </header>

      {/* Stats */}
      <div className="bg-swu-surface rounded-xl border border-swu-border p-3 flex items-center gap-3">
        <Bell size={20} className="text-swu-accent" />
        <div>
          <p className="text-xl font-extrabold font-mono text-swu-text">{subCount ?? '…'}</p>
          <p className="text-[10px] text-swu-muted">suscripciones activas</p>
        </div>
      </div>

      {/* Composer */}
      <div className="bg-swu-surface rounded-xl border border-swu-border p-4 space-y-4">
        <h2 className="text-sm font-semibold text-swu-text">Componer mensaje</h2>

        {/* Target mode */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-swu-muted mb-2">Destinatarios</p>
          <div className="grid grid-cols-3 gap-1.5">
            <TargetButton
              icon={Globe}
              label="Todos"
              active={targetMode === 'all_subscribers'}
              onClick={() => setTargetMode('all_subscribers')}
            />
            <TargetButton
              icon={Users}
              label="Por evento"
              active={targetMode === 'event'}
              onClick={() => setTargetMode('event')}
            />
            <TargetButton
              icon={UserPlus}
              label="Usuario"
              active={targetMode === 'specific_user'}
              onClick={() => setTargetMode('specific_user')}
            />
          </div>
        </div>

        {targetMode === 'event' && (
          <div>
            <label className="text-[10px] uppercase tracking-wider text-swu-muted">Código de evento</label>
            <input
              type="text"
              value={eventCode}
              onChange={(e) => setEventCode(e.target.value.toUpperCase())}
              placeholder="SWUXXXX"
              className="w-full mt-1 px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text font-mono"
            />
          </div>
        )}

        {targetMode === 'specific_user' && (
          <div>
            <label className="text-[10px] uppercase tracking-wider text-swu-muted">Usuario</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text"
            >
              <option value="">Selecciona…</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.role === 'admin' ? '(admin)' : ''} — {u.id.slice(0, 8)}…
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-swu-muted">Título</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="Nuevo torneo este sábado"
            className="w-full mt-1 px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text"
          />
          <p className="text-[10px] text-swu-muted/60 mt-1">{title.length}/100</p>
        </div>

        {/* Body */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-swu-muted">Cuerpo del mensaje</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Inscripciones abiertas. ¡Te esperamos!"
            className="w-full mt-1 px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text resize-none"
          />
          <p className="text-[10px] text-swu-muted/60 mt-1">{body.length}/300</p>
        </div>

        {/* Link */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-swu-muted">Link al hacer click (opcional)</label>
          <input
            type="text"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="/events"
            className="w-full mt-1 px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text font-mono"
          />
        </div>

        {/* Send */}
        <button
          onClick={send}
          disabled={sending || !title.trim() || !body.trim()}
          className="w-full py-2.5 rounded-lg bg-swu-accent text-white text-sm font-bold active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {sending ? 'Enviando…' : 'Enviar notificación'}
        </button>

        {result && (
          <div className={`rounded-lg p-2.5 text-[11px] flex items-center gap-2 ${
            result.ok
              ? 'bg-swu-green/10 border border-swu-green/30 text-swu-green'
              : 'bg-swu-red/10 border border-swu-red/30 text-swu-red'
          }`}>
            {result.ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
            {result.msg}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-swu-surface/50 rounded-xl border border-swu-border/40 p-4 text-[11px] text-swu-muted space-y-2 leading-relaxed">
        <p className="font-semibold text-swu-text">Notas</p>
        <p>• Solo usuarios que activaron Push en Settings reciben la notificación.</p>
        <p>• En iOS, Push solo funciona con la PWA instalada desde Safari (Añadir a Inicio).</p>
        <p>• Suscripciones muertas (410/404) se limpian automáticamente.</p>
        <p>• Los broadcasts de torneos (pairings/rondas/finales) ya disparan push automático — esto es para mensajes manuales.</p>
      </div>
    </div>
  )
}

function TargetButton({ icon: Icon, label, active, onClick }: { icon: typeof Globe; label: string; active: boolean; onClick: () => void }) {
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

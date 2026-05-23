import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Loader2, Plus, Trash2, Play, Square, X, ExternalLink } from 'lucide-react'
import {
  getOfficialEvents,
  updateEventStatus,
  deleteOfficialEvent,
  type OfficialEvent,
} from '../../services/events'
import { logAdminAction } from '../../services/adminService'
import { useAuth } from '../../hooks/useAuth'

type Filter = 'all' | 'open' | 'active' | 'finished' | 'cancelled'

export function AdminEventsPage() {
  const { currentProfile } = useAuth()
  const [events, setEvents] = useState<OfficialEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [actingId, setActingId] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    setEvents(await getOfficialEvents())
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  const filtered = useMemo(
    () => filter === 'all' ? events : events.filter(e => e.status === filter),
    [events, filter]
  )

  const changeStatus = async (e: OfficialEvent, newStatus: OfficialEvent['status']) => {
    if (!currentProfile) return
    if (!confirm(`¿Cambiar "${e.name}" a estado "${newStatus}"?`)) return
    setActingId(e.id)
    const result = await updateEventStatus(e.id, newStatus)
    if (result.ok) {
      logAdminAction('event.status', {
        actorId: currentProfile.id,
        actorName: currentProfile.name,
        targetType: 'event',
        targetId: e.id,
        metadata: { from: e.status, to: newStatus, name: e.name },
      })
      setEvents(prev => prev.map(x => x.id === e.id ? { ...x, status: newStatus } : x))
    } else {
      alert(`Error: ${result.error}`)
    }
    setActingId(null)
  }

  const deleteEvent = async (e: OfficialEvent) => {
    if (!currentProfile) return
    if (!confirm(`¿BORRAR "${e.name}" permanentemente? Esto elimina registros e historial.`)) return
    setActingId(e.id)
    const result = await deleteOfficialEvent(e.id)
    if (result.ok) {
      logAdminAction('event.delete', {
        actorId: currentProfile.id,
        actorName: currentProfile.name,
        targetType: 'event',
        targetId: e.id,
        metadata: { name: e.name, code: e.code },
      })
      setEvents(prev => prev.filter(x => x.id !== e.id))
    } else {
      alert(`Error: ${result.error}`)
    }
    setActingId(null)
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-swu-text">Eventos</h1>
          <p className="text-sm text-swu-muted mt-1">{filtered.length} de {events.length} eventos</p>
        </div>
        <Link
          to="/admin/events/new"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-swu-accent text-white text-sm font-semibold hover:bg-swu-accent/90 transition-colors"
        >
          <Plus size={14} /> Nuevo evento
        </Link>
      </header>

      <div className="flex bg-swu-surface rounded-lg p-0.5 border border-swu-border w-fit">
        {(['all', 'open', 'active', 'finished', 'cancelled'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === f ? 'bg-swu-accent/20 text-swu-accent' : 'text-swu-muted hover:text-swu-text'
            }`}
          >
            {f === 'all' ? 'Todos' : f === 'open' ? 'Abiertos' : f === 'active' ? 'Activos' : f === 'finished' ? 'Terminados' : 'Cancelados'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-swu-muted text-sm">
          <Loader2 size={16} className="animate-spin" /> Cargando…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-swu-surface rounded-xl p-8 text-center border border-swu-border">
          <Trophy size={32} className="mx-auto text-swu-muted/40 mb-2" />
          <p className="text-sm text-swu-muted">Sin eventos en este filtro</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => (
            <div key={e.id} className="bg-swu-surface rounded-xl border border-swu-border p-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-swu-text">{e.name}</span>
                  <StatusBadge status={e.status} />
                </div>
                <div className="text-[11px] text-swu-muted mt-0.5 flex items-center gap-2 flex-wrap">
                  <span className="font-mono">{e.code}</span>
                  <span>·</span>
                  <span>{e.format}</span>
                  <span>·</span>
                  <span>{e.registered_count ?? '?'}/{e.max_players}</span>
                  {e.organizer_name && (<><span>·</span><span>por {e.organizer_name}</span></>)}
                </div>
              </div>

              <Link
                to={`/events/lobby/${e.code}`}
                className="text-[11px] text-swu-muted hover:text-swu-accent flex items-center gap-1"
                title="Abrir lobby"
              >
                <ExternalLink size={12} /> Lobby
              </Link>

              {/* Status actions */}
              <div className="flex gap-1">
                {e.status !== 'active' && (
                  <ActionBtn
                    icon={Play}
                    label="Activar"
                    color="green"
                    disabled={actingId === e.id}
                    onClick={() => changeStatus(e, 'active')}
                  />
                )}
                {e.status !== 'finished' && (
                  <ActionBtn
                    icon={Square}
                    label="Terminar"
                    disabled={actingId === e.id}
                    onClick={() => changeStatus(e, 'finished')}
                  />
                )}
                {e.status !== 'cancelled' && (
                  <ActionBtn
                    icon={X}
                    label="Cancelar"
                    color="red"
                    disabled={actingId === e.id}
                    onClick={() => changeStatus(e, 'cancelled')}
                  />
                )}
                <ActionBtn
                  icon={Trash2}
                  label="Borrar"
                  color="red"
                  disabled={actingId === e.id}
                  onClick={() => deleteEvent(e)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: OfficialEvent['status'] }) {
  const styles = {
    open: 'bg-blue-500/15 text-blue-400',
    active: 'bg-swu-green/15 text-swu-green',
    finished: 'bg-swu-muted/15 text-swu-muted',
    cancelled: 'bg-swu-red/15 text-swu-red',
  }[status]
  return <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${styles}`}>{status}</span>
}

function ActionBtn({
  icon: Icon, label, color, disabled, onClick,
}: {
  icon: typeof Play
  label: string
  color?: 'green' | 'red'
  disabled?: boolean
  onClick: () => void
}) {
  const colorClass = color === 'green'
    ? 'text-swu-green hover:bg-swu-green/10'
    : color === 'red'
    ? 'text-swu-red hover:bg-swu-red/10'
    : 'text-swu-muted hover:bg-swu-surface'
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`text-[11px] px-2 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${colorClass} disabled:opacity-40 disabled:cursor-not-allowed`}
      title={label}
    >
      <Icon size={11} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

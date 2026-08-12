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
import {
  getTorneosPendientes,
  repartirPremios,
  type TorneoPendiente,
} from '../../services/tournamentCloud'
import { fechaCortaYHora } from '../../services/horaSV'
import { useAuth } from '../../hooks/useAuth'

type Filter = 'all' | 'open' | 'active' | 'finished' | 'cancelled'

export function AdminEventsPage() {
  const { currentProfile } = useAuth()
  const [events, setEvents] = useState<OfficialEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [actingId, setActingId] = useState<string | null>(null)
  /** Torneos vencidos que necesitan una mano: ver `TorneoPendiente.motivo`. */
  const [pendientes, setPendientes] = useState<TorneoPendiente[]>([])
  const [repartiendo, setRepartiendo] = useState<string | null>(null)

  // Cargar al montar.
  //
  // El `setState` va DESPUÉS del await, dentro de una función asíncrona: si se
  // llama de forma síncrona en el cuerpo del efecto, React vuelve a renderizar
  // encadenado antes de pintar. Y el centinela evita escribir estado sobre un
  // componente que ya se desmontó.
  useEffect(() => {
    let vivo = true
    void (async () => {
      const [datos, pend] = await Promise.all([getOfficialEvents(), getTorneosPendientes()])
      if (!vivo) return
      setEvents(datos)
      setPendientes(pend)
      setLoading(false)
    })()
    return () => { vivo = false }
  }, [])

  const confirmarReparto = async (t: TorneoPendiente) => {
    if (!currentProfile) return
    if (!confirm(
      `¿Repartir premios de "${t.name}"?\n\n` +
      `${t.clasificados} jugadores reciben XP, puntos de ranking y posible subida de nivel.\n` +
      `Esto NO se puede deshacer.`
    )) return
    setRepartiendo(t.id)
    const r = await repartirPremios(t.id)
    if (r.ok) {
      logAdminAction('event.rewards', {
        actorId: currentProfile.id,
        actorName: currentProfile.name,
        targetType: 'event',
        targetId: t.id,
        metadata: { name: t.name, premiados: r.premiados },
      })
      setPendientes(prev => prev.filter(x => x.id !== t.id))
      alert(`Listo: ${r.premiados} jugadores premiados.`)
    } else {
      alert(`Error: ${r.error}`)
    }
    setRepartiendo(null)
  }

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

      {/* Torneos vencidos que quedaron a medias.
       *
       * Va ARRIBA de la lista y de los filtros a propósito: son las dos cosas
       * que se pierden solas si nadie las mira. Un torneo sin clasificación
       * cargada no se cierra nunca —el cron lo deja tranquilo justamente para
       * que aparezca acá— y uno cerrado sin repartir deja a sus jugadores sin
       * el XP que ganaron. */}
      {pendientes.length > 0 && (
        <section className="rounded-xl border border-swu-amber/40 bg-swu-amber/5 p-4 space-y-3">
          <h2 className="text-sm font-bold text-swu-amber flex items-center gap-2">
            <Trophy size={15} /> Torneos vencidos que necesitan algo ({pendientes.length})
          </h2>
          <ul className="space-y-2">
            {pendientes.map(t => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-swu-border bg-swu-bg px-3 py-2.5"
              >
                <div className="flex-1 min-w-[180px]">
                  <p className="text-sm font-semibold text-swu-text">{t.name}</p>
                  <p className="text-[11px] text-swu-muted">
                    {fechaCortaYHora(t.date)} · {t.inscritos} inscritos
                    {t.clasificados > 0 && ` · ${t.clasificados} clasificados`}
                  </p>
                </div>

                {t.motivo === 'faltan_resultados' ? (
                  <>
                    <span className="text-[11px] text-swu-coral font-semibold">
                      Sin resultados cargados
                    </span>
                    {/* No hay botón de «cerrar»: cerrarlo así lo dejaría en
                        «Finalizado» sin nada que mostrar y los inscritos
                        desaparecerían. Lo que hace falta es llevar el torneo
                        desde el panel para que quede la clasificación. */}
                    <Link
                      to={`/events/dashboard/${t.code}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-swu-border text-xs font-semibold text-swu-text"
                    >
                      <ExternalLink size={12} /> Cargar resultados
                    </Link>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] text-swu-amber font-semibold">
                      Cerrado, falta repartir
                    </span>
                    <button
                      onClick={() => confirmarReparto(t)}
                      disabled={repartiendo === t.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-swu-amber text-black text-xs font-bold disabled:opacity-50"
                    >
                      {repartiendo === t.id
                        ? <><Loader2 size={12} className="animate-spin" /> Repartiendo…</>
                        : <><Trophy size={12} /> Repartir premios</>}
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-swu-muted">
            El cierre por fecha corre solo cada madrugada; el reparto de XP lo confirmás vos.
          </p>
        </section>
      )}

      <div className="flex bg-swu-surface rounded-lg p-0.5 border border-swu-border w-fit">
        {(['all', 'open', 'active', 'finished', 'cancelled'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === f ? 'bg-swu-accent/20 text-swu-accent-texto' : 'text-swu-muted hover:text-swu-text'
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
                className="text-[11px] text-swu-muted hover:text-swu-accent-texto flex items-center gap-1"
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
    cancelled: 'bg-swu-red/15 text-swu-red-texto',
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
    ? 'text-swu-red-texto hover:bg-swu-red/10'
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

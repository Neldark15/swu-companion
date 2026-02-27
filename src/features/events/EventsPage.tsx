import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  QrCode, Trophy, Calendar, Swords, Crown, Users,
  MapPin, Loader2, CheckCircle2, LogIn, ChevronRight, Trash2,
  Pencil, X, Save,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { db } from '../../services/db'
import { useAuth } from '../../hooks/useAuth'
import { getOfficialEvents, joinOfficialEvent, leaveOfficialEvent, deleteOfficialEvent, updateOfficialEvent, type OfficialEvent } from '../../services/events'
import type { Tournament } from '../../types'

/** Parse an ISO date string into separate date + time values for inputs */
function parseDateTime(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` }
}

export function EventsPage() {
  const navigate = useNavigate()
  const auth = useAuth()
  const [recentTournaments, setRecentTournaments] = useState<Tournament[]>([])
  const [officialEvents, setOfficialEvents] = useState<OfficialEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null)
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Edit state (admin only)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Load local tournaments
  useEffect(() => {
    db.tournaments
      .orderBy('createdAt')
      .reverse()
      .limit(10)
      .toArray()
      .then(setRecentTournaments)
      .catch(() => {})
  }, [])

  // Load official events from Supabase
  useEffect(() => {
    if (!auth.supabaseUser) {
      setLoadingEvents(false)
      return
    }
    loadEvents()
  }, [auth.supabaseUser])

  const loadEvents = async () => {
    setLoadingEvents(true)
    const events = await getOfficialEvents(auth.supabaseUser?.id)
    setOfficialEvents(events)
    setLoadingEvents(false)
  }

  const handleJoinEvent = async (event: OfficialEvent) => {
    if (!auth.supabaseUser) return
    setJoiningEventId(event.id)

    if (event.is_registered) {
      await leaveOfficialEvent(event.id, auth.supabaseUser.id)
    } else {
      await joinOfficialEvent(event.id, auth.supabaseUser.id)
    }

    await loadEvents()
    setJoiningEventId(null)
  }

  const handleDeleteEvent = async (eventId: string) => {
    setDeletingEventId(eventId)
    const result = await deleteOfficialEvent(eventId)
    if (result.ok) {
      setOfficialEvents(prev => prev.filter(e => e.id !== eventId))
    }
    setDeletingEventId(null)
    setConfirmDeleteId(null)
  }

  const startEditing = (event: OfficialEvent) => {
    const { date, time } = parseDateTime(event.date)
    setEditDate(date)
    setEditTime(time)
    setEditError('')
    setEditingEventId(event.id)
  }

  const cancelEditing = () => {
    setEditingEventId(null)
    setEditError('')
  }

  const saveEditing = async () => {
    if (!editingEventId) return
    setEditSaving(true)
    setEditError('')

    try {
      // Build ISO date string — use full ISO 8601 format
      let newDate: string | null = null
      if (editDate) {
        const timeStr = editTime || '00:00'
        newDate = new Date(`${editDate}T${timeStr}:00`).toISOString()
      }

      console.log('[saveEditing] eventId:', editingEventId, 'newDate:', newDate, 'editDate:', editDate, 'editTime:', editTime)

      const result = await updateOfficialEvent(editingEventId, { date: newDate })

      if (!result.ok) {
        setEditError(result.error || 'Error desconocido al guardar')
        setEditSaving(false)
        return
      }

      // Success - reload and close
      await loadEvents()
      setEditingEventId(null)
      setEditSaving(false)
    } catch (err) {
      console.error('[saveEditing] exception:', err)
      setEditError(`Excepción: ${err instanceof Error ? err.message : String(err)}`)
      setEditSaving(false)
    }
  }

  const formatDate = (ts: number | string) => {
    const d = typeof ts === 'string' ? new Date(ts) : new Date(ts)
    return d.toLocaleDateString('es-SV', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString('es-SV', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="p-4 space-y-5 pb-24">
      {/* Header with SWU logo */}
      <div className="flex items-center gap-3">
        <img src="/swu-logo-sm.png" alt="SWU" className="w-12 h-14 object-contain" />
        <div>
          <h2 className="text-lg font-bold text-swu-text leading-tight">Eventos</h2>
          <p className="text-[9px] text-swu-muted font-mono tracking-[0.2em] uppercase">Star Wars Unlimited</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => navigate('/events/join')}
          className="flex-1 bg-swu-accent/10 border-2 border-swu-accent/30 rounded-2xl p-5 text-center active:scale-[0.97] transition-transform"
        >
          <QrCode size={28} className="mx-auto text-swu-accent mb-2" />
          <p className="font-bold text-swu-accent">Unirse a Evento</p>
          <p className="text-[11px] text-swu-muted mt-1">Código o QR</p>
        </button>
        <button
          onClick={() => navigate('/events/tournament/new')}
          className="flex-1 bg-swu-amber/10 border-2 border-swu-amber/30 rounded-2xl p-5 text-center active:scale-[0.97] transition-transform"
        >
          <Trophy size={28} className="mx-auto text-swu-amber mb-2" />
          <p className="font-bold text-swu-amber">Torneo Casero</p>
          <p className="text-[11px] text-swu-muted mt-1">Swiss offline</p>
        </button>
      </div>

      {/* Admin: Create Event button */}
      {auth.isAdmin && (
        <button
          onClick={() => navigate('/events/create')}
          className="w-full bg-gradient-to-r from-swu-amber/20 to-swu-accent/10 border-2 border-swu-amber/40 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="w-12 h-12 rounded-full bg-swu-amber/20 flex items-center justify-center flex-shrink-0">
            <Crown size={24} className="text-swu-amber" />
          </div>
          <div className="text-left flex-1">
            <p className="font-bold text-swu-amber">Crear Evento Oficial</p>
            <p className="text-[11px] text-swu-muted">Visible para todos los jugadores registrados</p>
          </div>
          <ChevronRight size={18} className="text-swu-amber" />
        </button>
      )}

      {/* Official Events Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Crown size={14} className="text-swu-amber" />
          <h3 className="text-sm font-bold text-swu-text">Eventos Oficiales</h3>
        </div>

        {!auth.supabaseUser ? (
          <div className="bg-swu-surface rounded-2xl border border-swu-border p-6 text-center space-y-3">
            <LogIn size={32} className="mx-auto text-swu-muted/30" />
            <p className="text-sm text-swu-muted">Inicie sesión para ver eventos oficiales</p>
            <button
              onClick={() => navigate('/profile')}
              className="text-sm font-bold text-swu-accent"
            >
              Ir a Perfil →
            </button>
          </div>
        ) : loadingEvents ? (
          <div className="bg-swu-surface rounded-2xl border border-swu-border p-8 flex items-center justify-center gap-2">
            <Loader2 size={18} className="text-swu-accent animate-spin" />
            <span className="text-sm text-swu-muted">Cargando eventos...</span>
          </div>
        ) : officialEvents.length === 0 ? (
          <div className="bg-swu-surface rounded-2xl border border-swu-border p-6 text-center space-y-2">
            <Swords size={32} className="mx-auto text-swu-muted/30" />
            <p className="text-sm text-swu-muted">No hay eventos oficiales activos</p>
            <p className="text-xs text-swu-muted/70">Los eventos aparecerán aquí cuando un organizador los cree</p>
          </div>
        ) : (
          <div className="space-y-3">
            {officialEvents.map((event) => (
              <div
                key={event.id}
                className={`bg-swu-surface rounded-2xl border p-4 space-y-3 ${
                  event.is_registered ? 'border-swu-green/40' : 'border-swu-border'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-bold text-swu-text">{event.name}</h4>
                    {event.description && (
                      <p className="text-xs text-swu-muted mt-0.5 line-clamp-2">{event.description}</p>
                    )}
                  </div>
                  <Badge variant={event.status === 'active' ? 'accent' : 'green'}>
                    {event.status === 'active' ? 'En Curso' : 'Abierto'}
                  </Badge>
                </div>

                {/* Details */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-swu-muted">
                  <span className="flex items-center gap-1">
                    <Swords size={12} />
                    <span className="capitalize">{event.format}</span> · <span className="uppercase">{event.match_type}</span>
                  </span>
                  {event.date && (
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {formatDate(event.date)} {formatTime(event.date)}
                    </span>
                  )}
                  {event.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} />
                      {event.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    {event.registered_count || 0}/{event.max_players}
                  </span>
                </div>

                {/* ── Admin Edit Panel (inline) ── */}
                {auth.isAdmin && editingEventId === event.id && (
                  <div className="bg-swu-bg rounded-xl p-3 border border-swu-accent/20 space-y-3">
                    <p className="text-[11px] font-bold text-swu-accent tracking-wider uppercase">Editar Fecha / Hora</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-swu-muted block mb-1">Fecha</label>
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="w-full bg-swu-surface border border-swu-border rounded-lg px-2.5 py-2 text-sm text-swu-text outline-none focus:border-swu-accent"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-swu-muted block mb-1">Hora</label>
                        <input
                          type="time"
                          value={editTime}
                          onChange={(e) => setEditTime(e.target.value)}
                          className="w-full bg-swu-surface border border-swu-border rounded-lg px-2.5 py-2 text-sm text-swu-text outline-none focus:border-swu-accent"
                        />
                      </div>
                    </div>
                    {editError && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                        <p className="text-[11px] text-red-400 font-medium">{editError}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={saveEditing}
                        disabled={editSaving}
                        className="flex-1 py-2 rounded-lg bg-swu-accent text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform disabled:opacity-50"
                      >
                        {editSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        {editSaving ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="px-4 py-2 rounded-lg bg-swu-border text-swu-muted text-xs font-bold flex items-center gap-1.5 active:scale-[0.97] transition-transform"
                      >
                        <X size={12} /> Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Organizer + Code + Admin Actions */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-swu-muted">
                    Org: <span className="text-swu-text font-medium">{event.organizer_avatar} {event.organizer_name}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-swu-accent bg-swu-accent/10 px-2 py-0.5 rounded">
                      {event.code}
                    </span>
                    {auth.isAdmin && editingEventId !== event.id && (
                      <>
                        {/* Edit button */}
                        <button
                          onClick={() => startEditing(event)}
                          className="p-1 rounded-lg bg-swu-accent/10 text-swu-accent active:scale-95 transition-transform"
                          title="Editar fecha/hora"
                        >
                          <Pencil size={14} />
                        </button>
                        {/* Delete button */}
                        {confirmDeleteId === event.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeleteEvent(event.id)}
                              disabled={deletingEventId === event.id}
                              className="text-[10px] bg-red-500/20 text-red-400 px-2 py-1 rounded font-bold"
                            >
                              {deletingEventId === event.id ? '...' : 'Sí, eliminar'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[10px] bg-swu-border text-swu-muted px-2 py-1 rounded font-bold"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(event.id)}
                            className="p-1 rounded-lg bg-red-500/10 text-red-400 active:scale-95 transition-transform"
                            title="Eliminar evento"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Join/Leave button */}
                {event.status === 'open' && (
                  <button
                    onClick={() => handleJoinEvent(event)}
                    disabled={joiningEventId === event.id}
                    className={`w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                      event.is_registered
                        ? 'bg-swu-green/10 border border-swu-green/30 text-swu-green'
                        : 'bg-swu-accent text-white active:scale-[0.98]'
                    }`}
                  >
                    {joiningEventId === event.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : event.is_registered ? (
                      <><CheckCircle2 size={16} /> Inscrito — Toque para salir</>
                    ) : (
                      'Inscribirse'
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Local Tournaments */}
      <div>
        <h3 className="text-sm font-bold text-swu-text mb-3">Torneos Caseros</h3>
        {recentTournaments.length === 0 ? (
          <div className="bg-swu-surface rounded-2xl border border-swu-border p-6 text-center space-y-2">
            <Trophy size={28} className="mx-auto text-swu-muted/30" />
            <p className="text-sm text-swu-muted">No hay torneos caseros aún</p>
            <p className="text-xs text-swu-muted/70">Cree un torneo Swiss offline para jugar con amigos</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTournaments.map((t) => (
              <div
                key={t.id}
                onClick={() => navigate(`/events/tournament/${t.id}`)}
                className="bg-swu-surface rounded-xl p-3 border border-swu-border active:bg-swu-border/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-swu-text">{t.name}</span>
                  <Badge variant={t.status === 'finished' ? 'green' : t.status === 'active' ? 'accent' : 'default'}>
                    {t.status === 'finished' ? 'Finalizado' : t.status === 'active' ? 'Activo' : 'Pendiente'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-swu-muted mt-1">
                  <Calendar size={12} />
                  <span>{formatDate(t.createdAt)}</span>
                  <span>·</span>
                  <span>{t.players.length} jugadores</span>
                  <span>·</span>
                  <span>Ronda {t.rounds.length}/{t.maxRounds}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

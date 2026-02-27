import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  QrCode, Trophy, Calendar, Swords, Crown, Users,
  MapPin, Loader2, CheckCircle2, LogIn, ChevronRight,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { db } from '../../services/db'
import { useAuth } from '../../hooks/useAuth'
import { getOfficialEvents, joinOfficialEvent, leaveOfficialEvent, type OfficialEvent } from '../../services/events'
import type { Tournament } from '../../types'

export function EventsPage() {
  const navigate = useNavigate()
  const auth = useAuth()
  const [recentTournaments, setRecentTournaments] = useState<Tournament[]>([])
  const [officialEvents, setOfficialEvents] = useState<OfficialEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null)

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
      <h2 className="text-lg font-bold text-swu-text">Eventos</h2>

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

                {/* Organizer + Code */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-swu-muted">
                    Org: <span className="text-swu-text font-medium">{event.organizer_avatar} {event.organizer_name}</span>
                  </span>
                  <span className="font-mono text-xs font-bold text-swu-accent bg-swu-accent/10 px-2 py-0.5 rounded">
                    {event.code}
                  </span>
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

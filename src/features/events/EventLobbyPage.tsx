import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  Users,
  Megaphone,
  Clock,
  CheckCircle2,
  Trophy,
  Swords,
  LogOut,
  Loader2,
  Wifi,
  Copy,
  Check,
  SearchX,
} from 'lucide-react'
import { supabase, isSupabaseReady } from '../../services/supabase'

interface LobbyPlayer {
  id: string
  name: string
  joinedAt: number
  ready: boolean
}

interface Announcement {
  id: string
  message: string
  timestamp: number
  priority: 'info' | 'warning' | 'urgent'
}

interface EventData {
  name: string
  format: string
  organizer: string
  maxPlayers: number
  status: 'waiting' | 'starting' | 'active'
}

export function EventLobbyPage() {
  const navigate = useNavigate()
  const { code } = useParams<{ code: string }>()

  const [event, setEvent] = useState<EventData | null>(null)
  const [players, setPlayers] = useState<LobbyPlayer[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isReady, setIsReady] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'players' | 'announcements'>('players')
  const [loading, setLoading] = useState(true)

  // Fetch event data from Supabase
  useEffect(() => {
    if (!code || !isSupabaseReady()) {
      setLoading(false)
      return
    }

    const fetchEvent = async () => {
      try {
        const { data, error } = await supabase
          .from('tournaments')
          .select('*')
          .eq('code', code)
          .single()

        if (error || !data) {
          setLoading(false)
          return
        }

        setEvent({
          name: data.name,
          format: data.format,
          organizer: data.organizer_name,
          maxPlayers: data.max_players,
          status: data.status || 'waiting',
        })

        // Add self as player
        setPlayers([{
          id: 'self',
          name: 'Tú',
          joinedAt: Date.now(),
          ready: false,
        }])

        setAnnouncements([{
          id: 'a0',
          message: 'Bienvenido al evento. El torneo comenzará cuando todos estén listos.',
          timestamp: Date.now(),
          priority: 'info',
        }])
      } catch {
        // Error fetching
      } finally {
        setLoading(false)
      }
    }

    fetchEvent()

    // TODO: Subscribe to realtime changes for players joining/leaving
  }, [code])

  // Update self ready status
  useEffect(() => {
    setPlayers(prev => prev.map(p =>
      p.id === 'self' ? { ...p, ready: isReady } : p
    ))
  }, [isReady])

  const copyCode = () => {
    if (code) {
      navigator.clipboard?.writeText(code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    }
  }

  const handleLeave = () => {
    navigate('/events')
  }

  if (loading) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 size={32} className="text-swu-accent animate-spin" />
        <p className="text-sm text-swu-muted">Cargando evento...</p>
      </div>
    )
  }

  if (!event || !code) {
    return (
      <div className="p-4 space-y-5">
        <button onClick={() => navigate('/events')} className="flex items-center gap-1 text-sm text-swu-muted">
          <ChevronLeft size={18} /> Volver
        </button>
        <div className="bg-swu-surface rounded-2xl border border-swu-border p-8 text-center space-y-3">
          <SearchX size={40} className="mx-auto text-swu-muted/40" />
          <p className="text-swu-red font-bold">Evento no encontrado</p>
          <p className="text-xs text-swu-muted">El código "{code}" no corresponde a ningún evento activo.</p>
        </div>
      </div>
    )
  }

  const readyCount = players.filter(p => p.ready).length
  const totalCount = players.length

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-8 max-w-5xl mx-auto">
      {/* Header */}
      <button onClick={handleLeave} className="flex items-center gap-1 text-sm text-swu-muted">
        <ChevronLeft size={18} /> Salir del Lobby
      </button>

      {/* Event info card */}
      <div className="bg-gradient-to-br from-swu-accent/20 to-swu-green/10 rounded-2xl p-4 border border-swu-accent/30 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold text-swu-accent uppercase tracking-widest">Lobby del Evento</p>
            <h2 className="text-lg font-extrabold text-swu-text mt-0.5">{event.name}</h2>
          </div>
          <div className="flex items-center gap-1.5 bg-swu-green/20 px-2.5 py-1 rounded-full">
            <Wifi size={12} className="text-swu-green" />
            <span className="text-[11px] font-bold text-swu-green">Conectado</span>
          </div>
        </div>

        <div className="flex gap-4 text-xs text-swu-muted">
          <span>Formato: <span className="text-swu-text font-semibold">{event.format}</span></span>
          <span>Org: <span className="text-swu-text font-semibold">{event.organizer}</span></span>
        </div>

        {/* Event code share */}
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-swu-bg/60 rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-swu-muted">Código:</span>
            <span className="font-mono font-bold text-swu-accent tracking-wider">{code}</span>
          </div>
          <button
            onClick={copyCode}
            className="w-10 h-10 rounded-lg bg-swu-bg/60 flex items-center justify-center active:bg-swu-border transition-colors"
          >
            {codeCopied ? <Check size={16} className="text-swu-green" /> : <Copy size={16} className="text-swu-muted" />}
          </button>
        </div>

        {/* Players count bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-swu-muted">
              <span className="font-bold text-swu-green">{readyCount}</span> listos de{' '}
              <span className="font-bold text-swu-text">{totalCount}</span> jugadores
            </span>
            <span className="text-swu-muted font-mono">{totalCount}/{event.maxPlayers}</span>
          </div>
          <div className="h-2 bg-swu-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-swu-green rounded-full transition-all duration-500"
              style={{ width: `${(readyCount / event.maxPlayers) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('players')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'players'
              ? 'bg-swu-accent text-white'
              : 'bg-swu-surface text-swu-muted border border-swu-border'
          }`}
        >
          <Users size={16} /> Jugadores ({totalCount})
        </button>
        <button
          onClick={() => setActiveTab('announcements')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'announcements'
              ? 'bg-swu-accent text-white'
              : 'bg-swu-surface text-swu-muted border border-swu-border'
          }`}
        >
          <Megaphone size={16} /> Anuncios ({announcements.length})
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'players' ? (
        <div className="space-y-1.5">
          {players.length === 0 ? (
            <div className="text-center py-8 text-swu-muted">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Esperando jugadores...</p>
            </div>
          ) : (
            players.map(p => (
              <div
                key={p.id}
                className={`bg-swu-surface rounded-xl px-4 py-3 border flex items-center justify-between transition-colors ${
                  p.id === 'self'
                    ? 'border-swu-accent/50 bg-swu-accent/5'
                    : 'border-swu-border'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    p.id === 'self'
                      ? 'bg-swu-accent text-white'
                      : 'bg-swu-bg text-swu-muted'
                  }`}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${p.id === 'self' ? 'text-swu-accent' : 'text-swu-text'}`}>
                      {p.name} {p.id === 'self' && <span className="text-[10px] text-swu-accent/60">(tú)</span>}
                    </p>
                    <p className="text-[11px] text-swu-muted">
                      {timeAgo(p.joinedAt)}
                    </p>
                  </div>
                </div>
                {p.ready ? (
                  <div className="flex items-center gap-1 text-swu-green">
                    <CheckCircle2 size={16} />
                    <span className="text-[11px] font-bold">Listo</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-swu-muted">
                    <Clock size={14} />
                    <span className="text-[11px]">Esperando</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {announcements.slice().reverse().map(a => (
            <div
              key={a.id}
              className={`rounded-xl p-3.5 border ${
                a.priority === 'urgent'
                  ? 'bg-swu-red/10 border-swu-red/30'
                  : a.priority === 'warning'
                  ? 'bg-swu-amber/10 border-swu-amber/30'
                  : 'bg-swu-surface border-swu-border'
              }`}
            >
              <div className="flex items-start gap-2">
                <Megaphone size={14} className={
                  a.priority === 'urgent' ? 'text-swu-red mt-0.5' :
                  a.priority === 'warning' ? 'text-swu-amber mt-0.5' :
                  'text-swu-muted mt-0.5'
                } />
                <div className="flex-1">
                  <p className="text-sm text-swu-text">{a.message}</p>
                  <p className="text-[11px] text-swu-muted mt-1">{timeAgo(a.timestamp)}</p>
                </div>
              </div>
            </div>
          ))}

          {announcements.length === 0 && (
            <div className="text-center py-8 text-swu-muted">
              <Megaphone size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin anuncios aún</p>
            </div>
          )}
        </div>
      )}

      {/* Bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-swu-bg/95 backdrop-blur-md border-t border-swu-border p-4 space-y-2 z-30">
        {event.status === 'waiting' && (
          <>
            <button
              onClick={() => setIsReady(!isReady)}
              className={`w-full py-3.5 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
                isReady
                  ? 'bg-swu-surface border-2 border-swu-green text-swu-green'
                  : 'bg-swu-green text-white active:scale-[0.98]'
              }`}
            >
              {isReady ? (
                <><CheckCircle2 size={20} /> Listo — Toque para cancelar</>
              ) : (
                <><Swords size={20} /> Estoy Listo</>
              )}
            </button>

            <button
              onClick={handleLeave}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-swu-muted flex items-center justify-center gap-2"
            >
              <LogOut size={16} /> Abandonar Evento
            </button>
          </>
        )}

        {event.status === 'starting' && (
          <div className="py-3.5 rounded-xl bg-swu-amber/10 border border-swu-amber/30 text-center">
            <div className="flex items-center justify-center gap-2">
              <Loader2 size={18} className="text-swu-amber animate-spin" />
              <span className="font-bold text-swu-amber">El torneo está por comenzar...</span>
            </div>
          </div>
        )}

        {event.status === 'active' && (
          <button
            onClick={() => navigate('/events/tournament/live')}
            className="w-full py-3.5 rounded-xl bg-swu-green text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <Trophy size={20} /> Ir al Torneo
          </button>
        )}
      </div>
    </div>
  )
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return 'ahora mismo'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  return `hace ${hrs}h`
}

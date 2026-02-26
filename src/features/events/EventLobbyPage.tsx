import { useState, useEffect, useRef } from 'react'
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
} from 'lucide-react'

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

// Mock data generator
function generateMockPlayers(count: number): LobbyPlayer[] {
  const names = [
    'Carlos M.', 'María R.', 'Pedro H.', 'Ana L.', 'Luis G.',
    'Sofia V.', 'Jorge T.', 'Elena P.', 'Marco D.', 'Isabella C.',
    'Diego F.', 'Valentina S.', 'Andrés B.', 'Camila R.', 'Fernando M.',
  ]
  return names.slice(0, count).map((name, i) => ({
    id: `p${i}`,
    name,
    joinedAt: Date.now() - Math.random() * 3600000,
    ready: Math.random() > 0.3,
  }))
}

const MOCK_EVENTS: Record<string, {
  name: string; format: string; organizer: string;
  players: number; maxPlayers: number; status: 'waiting' | 'starting' | 'active'
}> = {
  'SWU2026A': { name: 'FNM - Tienda El Refugio', format: 'Premier', organizer: 'Carlos M.', players: 8, maxPlayers: 16, status: 'waiting' },
  'NOVA001': { name: 'Torneo NOVA #1', format: 'Premier', organizer: 'Nel', players: 5, maxPlayers: 8, status: 'waiting' },
  'DRAFT42': { name: 'Draft Night', format: 'Draft', organizer: 'Liga SWU SV', players: 6, maxPlayers: 8, status: 'waiting' },
  'TEST123': { name: 'Evento de Prueba', format: 'Sealed', organizer: 'Admin', players: 2, maxPlayers: 32, status: 'waiting' },
}

export function EventLobbyPage() {
  const navigate = useNavigate()
  const { code } = useParams<{ code: string }>()
  const event = code ? MOCK_EVENTS[code] : null

  const [players, setPlayers] = useState<LobbyPlayer[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isReady, setIsReady] = useState(false)
  const [eventStatus] = useState<'waiting' | 'starting' | 'active'>('waiting')
  const [codeCopied, setCodeCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'players' | 'announcements'>('players')
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined)

  // Initialize mock data
  useEffect(() => {
    if (!event) return

    const mockPlayers = generateMockPlayers(event.players)
    // Add self
    mockPlayers.push({
      id: 'self',
      name: 'Tú',
      joinedAt: Date.now(),
      ready: false,
    })
    setPlayers(mockPlayers)

    // Initial announcement
    setAnnouncements([{
      id: 'a0',
      message: 'Bienvenido al evento. El torneo comenzará cuando todos estén listos.',
      timestamp: Date.now(),
      priority: 'info',
    }])
  }, [event])

  // Simulate players joining & announcements over time
  useEffect(() => {
    if (!event) return

    let tick = 0
    timerRef.current = setInterval(() => {
      tick++

      // Simulate a new player joining occasionally
      if (tick % 8 === 0 && players.length < (event.maxPlayers - 1)) {
        const extraNames = ['Roberto K.', 'Patricia M.', 'Oscar N.', 'Lucía Q.']
        const newName = extraNames[Math.floor(Math.random() * extraNames.length)]
        setPlayers(prev => {
          if (prev.find(p => p.name === newName)) return prev
          return [...prev, {
            id: `px${tick}`,
            name: newName,
            joinedAt: Date.now(),
            ready: false,
          }]
        })
      }

      // Simulate players becoming ready
      if (tick % 5 === 0) {
        setPlayers(prev => prev.map(p =>
          p.id !== 'self' && !p.ready && Math.random() > 0.5
            ? { ...p, ready: true }
            : p
        ))
      }

      // Simulate announcements
      if (tick === 10) {
        setAnnouncements(prev => [...prev, {
          id: `a${tick}`,
          message: 'Recuerden traer sus deck lists impresas.',
          timestamp: Date.now(),
          priority: 'info',
        }])
      }

      if (tick === 20) {
        setAnnouncements(prev => [...prev, {
          id: `a${tick}`,
          message: 'El torneo iniciará en aproximadamente 5 minutos.',
          timestamp: Date.now(),
          priority: 'warning',
        }])
      }
    }, 3000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [event, players.length])

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
    if (timerRef.current) clearInterval(timerRef.current)
    navigate('/events')
  }

  if (!event || !code) {
    return (
      <div className="p-4 space-y-5">
        <button onClick={() => navigate('/events')} className="flex items-center gap-1 text-sm text-swu-muted">
          <ChevronLeft size={18} /> Volver
        </button>
        <div className="bg-swu-surface rounded-2xl border border-swu-border p-8 text-center">
          <p className="text-swu-red font-bold">Evento no encontrado</p>
          <p className="text-xs text-swu-muted mt-1">El código "{code}" no corresponde a ningún evento activo.</p>
        </div>
      </div>
    )
  }

  const readyCount = players.filter(p => p.ready).length
  const totalCount = players.length

  return (
    <div className="p-4 space-y-4 pb-24">
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
          {players.map(p => (
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
          ))}
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
        {eventStatus === 'waiting' && (
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

        {eventStatus === 'starting' && (
          <div className="py-3.5 rounded-xl bg-swu-amber/10 border border-swu-amber/30 text-center">
            <div className="flex items-center justify-center gap-2">
              <Loader2 size={18} className="text-swu-amber animate-spin" />
              <span className="font-bold text-swu-amber">El torneo está por comenzar...</span>
            </div>
          </div>
        )}

        {eventStatus === 'active' && (
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

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
// (navigate to /events/play/:code when status flips to 'active' — see useEffect below)
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
import { getEventByCode, getEventRegistrations, leaveOfficialEvent, marcarLlegada, type EventRegistration } from '../../services/events'
import { ultimaRonda, getMesasDeRonda, type MesaArmada } from '../../services/mesasService'
import { escucharPresenciaTorneo, type Mirando } from '../../services/presenciaTorneo'
import { declararMazo } from '../../services/events'
import { DeclararMazo } from './DeclararMazo'
import { esDeMesas } from '../../services/tipoTorneo'
import { RifaDeMesas } from './RifaDeMesas'
import { useAuth } from '../../hooks/useAuth'

interface LobbyPlayer {
  id: string
  name: string
  joinedAt: number
  ready: boolean
  isSelf?: boolean
  /** El mazo declarado al inscribirse. Vacío mientras no lo haya dicho. */
  lideres: string[]
  base: string | null
}

function registrationsToPlayers(regs: EventRegistration[], selfUserId: string | null): LobbyPlayer[] {
  return regs.map(r => ({
    id: r.user_id,
    name: r.user_id === selfUserId ? 'Tú' : (r.player_name || 'Jugador'),
    joinedAt: new Date(r.registered_at).getTime(),
    ready: r.status === 'checked_in',
    isSelf: r.user_id === selfUserId,
    // Un líder vacío se filtra: en un Premier el segundo no existe, y pintar
    // un hueco por él diría que falta un dato que nunca hubo.
    lideres: [r.leader_1, r.leader_2].filter((x): x is string => !!x),
    base: r.base_carta ?? null,
  }))
}

interface Announcement {
  id: string
  message: string
  timestamp: number
  priority: 'info' | 'warning' | 'urgent'
}

interface EventData {
  /** Hace falta para poder darse de baja de verdad: la baja va por id. */
  id: string
  /** Un torneo de mesas no se sigue en la pantalla de emparejamientos. */
  deMesas: boolean
  name: string
  format: string
  organizer: string
  maxPlayers: number
  status: 'waiting' | 'starting' | 'active'
}

export function EventLobbyPage() {
  const navigate = useNavigate()
  const { code } = useParams<{ code: string }>()
  const auth = useAuth()
  const selfUserId = auth.supabaseUser?.id ?? null

  const [event, setEvent] = useState<EventData | null>(null)
  const [players, setPlayers] = useState<LobbyPlayer[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [editandoMazo, setEditandoMazo] = useState(false)
  const [guardandoMazo, setGuardandoMazo] = useState(false)
  const [marcando, setMarcando] = useState(false)
  const [falloLlegada, setFalloLlegada] = useState<string | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'players' | 'announcements'>('players')
  const [loading, setLoading] = useState(true)
  const [mesas, setMesas] = useState<MesaArmada[]>([])
  const [conectados, setConectados] = useState<Mirando[]>([])

  // Fetch event + initial registrations, then subscribe to realtime player changes
  useEffect(() => {
    if (!code || !isSupabaseReady()) {
      setLoading(false)
      return
    }

    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const refreshPlayers = async (id: string) => {
      const regs = await getEventRegistrations(id)
      if (cancelled) return
      /* `null` = no se pudo saber. Se deja la lista como estaba en vez de
         vaciarla: pintar cero acá diría «no llegó nadie» en una sala llena,
         que es el error que este lobby cometía desde siempre. */
      if (regs === null) return
      setPlayers(registrationsToPlayers(regs, selfUserId))
    }

    const init = async () => {
      try {
        const officialEvent = await getEventByCode(code)
        if (cancelled) return

        if (!officialEvent) {
          setLoading(false)
          return
        }

        setEvent({
          id: officialEvent.id,
          deMesas: esDeMesas(officialEvent.tournament_type),
          name: officialEvent.name,
          format: officialEvent.format,
          organizer: officialEvent.organizer_name || 'Organizador',
          maxPlayers: officialEvent.max_players,
          status: (officialEvent.status === 'finished' || officialEvent.status === 'cancelled')
            ? 'active'
            : (officialEvent.status === 'active' ? 'active' : 'waiting'),
        })
        await refreshPlayers(officialEvent.id)

        if (cancelled) return

        setAnnouncements([{
          id: 'a0',
          message: 'Bienvenido al evento. El torneo comenzará cuando todos estén listos.',
          timestamp: Date.now(),
          priority: 'info',
        }])

        // Subscribe to live player join/leave/status changes
        channel = supabase
          .channel(`event-lobby-${officialEvent.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'event_registrations', filter: `event_id=eq.${officialEvent.id}` },
            () => { refreshPlayers(officialEvent.id) }
          )
          .subscribe()
      } catch {
        // Silently ignore — UI shows "Evento no encontrado" if event is null
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [code, selfUserId])

  /* La rifa de mesas, en vivo.
     `tournament_mesas` ya publica sus cambios, así que el reparto llega solo
     a todos los que estén mirando el lobby — que es el punto: la rifa se ve
     en grupo. */
  useEffect(() => {
    const id = event?.id
    if (!id || !isSupabaseReady()) return
    let vivo = true

    const traer = async () => {
      const ronda = await ultimaRonda(id)
      if (!vivo) return
      setMesas(ronda ? await getMesasDeRonda(ronda.id) : [])
    }
    void traer()

    const canal = supabase
      .channel(`lobby-mesas-${id}`)
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'tournament_mesas', filter: `event_id=eq.${id}` },
          () => { void traer() })
      .subscribe(estado => {
        // Un canal roto se ve igual que uno sano si nadie mira el estado.
        if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') {
          console.warn('[lobby] el canal de mesas no quedó:', estado)
        }
      })

    return () => { vivo = false; void supabase.removeChannel(canal) }
  }, [event?.id])

  /* Quién está mirando el lobby ahora. Cada quien se anuncia: si no lo hace,
     nadie puede saber que está. */
  useEffect(() => {
    if (!event?.id) return
    return escucharPresenciaTorneo(
      event.id,
      selfUserId ? {
        id: selfUserId,
        nombre: auth.currentProfile?.name ?? 'Jugador',
        avatar: auth.currentProfile?.avatar ?? null,
      } : null,
      setConectados,
    )
  }, [event?.id, selfUserId, auth.currentProfile?.name, auth.currentProfile?.avatar])

  /* Ya no hay estado local de «listo».
     Antes el botón pintaba TU fila y nada más: era un espejo de tu propio
     toque, no un dato. Ahora la verdad es `status = 'checked_in'` en la fila,
     y como la tabla publica sus cambios, tu llegada aparece en la pantalla
     del organizador y en la de todos los demás. */

  // When event transitions to active and the user is a registered player,
  // forward to the player view (where they can report/confirm scores).
  /* Al arrancar el torneo se manda a la pantalla del jugador… salvo en un
     torneo de MESAS.
     Ahí la pantalla de emparejamientos no tiene nada que mostrar —no hay uno
     contra uno— y además sacaría a la gente del lobby JUSTO cuando sale la
     rifa, que es lo que se juntaron a mirar. */
  useEffect(() => {
    if (event?.status !== 'active' || !code || !selfUserId) return
    if (event.deMesas) return
    if (players.some(p => p.isSelf)) navigate(`/events/play/${code}`, { replace: true })
  }, [event?.status, event?.deMesas, code, selfUserId, players, navigate])

  /* Se DERIVAN de la lista, que es la que llega del servidor. Un estado
     local aparte volvería a ser un espejo del propio toque. */
  const yoInscrito = players.some(p => p.isSelf)
  const yoLlegue = players.some(p => p.isSelf && p.ready)

  const alternarLlegada = async () => {
    if (!event?.id || !selfUserId) return
    setMarcando(true); setFalloLlegada(null)
    const r = await marcarLlegada(event.id, selfUserId, !yoLlegue)
    setMarcando(false)
    if (!r.ok) setFalloLlegada(r.error ?? 'No se pudo marcar.')
    // No se toca nada más: el cambio vuelve por el canal de inscripciones y
    // repinta la lista para todos, no solo para quien tocó.
  }

  /* Declarar el mazo DESPUÉS de inscribirse.
     Hace falta por dos razones reales: quien se anotó antes de que esto
     existiera no tiene mazo declarado, y quien se anota una semana antes
     decide con qué juega la noche anterior. Sin esto tendría que darse de baja
     y volver a entrar — y en un torneo con cupo eso le cuesta el lugar. */
  const miFila = players.find(p => p.isSelf)
  const guardarMazo = async (m: Parameters<typeof declararMazo>[2]) => {
    if (!event?.id || !selfUserId) return
    setGuardandoMazo(true)
    const r = await declararMazo(event.id, selfUserId, m)
    setGuardandoMazo(false)
    if (!r.ok) { setFalloLlegada(r.error ?? 'No se pudo guardar el mazo.'); return }
    setEditandoMazo(false)
  }

  const copyCode = () => {
    if (code) {
      navigator.clipboard?.writeText(code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    }
  }

  /* Salir de la pantalla NO es salir del torneo. Eran el mismo botón: el de
     abajo decía «Abandonar Evento» y solo navegaba, así que la persona se iba
     a su casa creyendo que se había dado de baja — y seguía inscrita. Cuando
     el organizador armaba los pareos, su rival esperaba en una mesa a alguien
     que ya no estaba. */
  const handleLeave = () => {
    navigate('/torneos')
  }

  const [saliendo, setSaliendo] = useState(false)
  const [confirmarSalida, setConfirmarSalida] = useState(false)
  const [fallaSalida, setFallaSalida] = useState<string | null>(null)

  const abandonarDeVerdad = async () => {
    if (!event?.id || !selfUserId) return
    setSaliendo(true); setFallaSalida(null)
    const r = await leaveOfficialEvent(event.id, selfUserId)
    setSaliendo(false)
    if (!r.ok) { setFallaSalida(r.error ?? 'No se pudo dar de baja.'); return }
    navigate('/torneos')
  }

  if (loading) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 size={32} className="text-swu-accent-texto animate-spin" />
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
          <p className="text-swu-red-texto font-bold">Evento no encontrado</p>
          <p className="text-xs text-swu-muted">El código "{code}" no corresponde a ningún evento activo.</p>
        </div>
      </div>
    )
  }

  const readyCount = players.filter(p => p.ready).length
  const totalCount = players.length

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-8 lg:pb-8 max-w-5xl mx-auto">
      {/* Header */}
      <button onClick={handleLeave} className="flex items-center gap-1 text-sm text-swu-muted">
        <ChevronLeft size={18} /> Volver
      </button>

      {/* Event info card */}
      <div className="bg-gradient-to-br from-swu-accent/20 to-swu-green/10 rounded-2xl p-4 border border-swu-accent/30 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold text-swu-accent-texto uppercase tracking-widest">Lobby del Evento</p>
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
            <span className="font-mono font-bold text-swu-accent-texto tracking-wider">{code}</span>
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
              <span className="font-bold text-swu-green">{readyCount}</span> llegaron de{' '}
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
          {conectados.length > 0 && (
            <span className="ml-1 inline-flex items-center gap-1 text-[10px] text-swu-green">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-swu-green" />
              {conectados.length}
            </span>
          )}
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

      {/* La rifa, arriba de todo. Cuando sale es lo único que importa en esta
          pantalla, y el resto puede esperar a que se termine de mirar. */}
      {mesas.length > 0 && (
        <div className="mb-4">
          <RifaDeMesas mesas={mesas} miId={selfUserId} />
        </div>
      )}

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
                    <p className={`text-sm font-semibold ${p.id === 'self' ? 'text-swu-accent-texto' : 'text-swu-text'}`}>
                      {p.name} {p.id === 'self' && <span className="text-[10px] text-swu-accent-texto/60">(tú)</span>}
                    </p>
                    <p className="text-[11px] text-swu-muted">
                      {timeAgo(p.joinedAt)}
                    </p>
                    {/* El mazo declarado. Es la razón por la que se pregunta al
                        inscribirse: acá se ve sin tener que preguntarle a nadie. */}
                    {(p.lideres.length > 0 || p.base) && (
                      <p className="mt-0.5 truncate text-[11px] text-swu-accent-texto/80">
                        {p.lideres.map(l => l.split(' — ')[0]).join(' + ')}
                        {p.base && <span className="text-swu-muted"> · {p.base}</span>}
                      </p>
                    )}
                  </div>
                </div>
                {p.ready ? (
                  <div className="flex items-center gap-1 text-swu-green">
                    <CheckCircle2 size={16} />
                    <span className="text-[11px] font-bold">Llegó</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-swu-muted">
                    <Clock size={14} />
                    <span className="text-[11px]">Anotado</span>
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
                  a.priority === 'urgent' ? 'text-swu-red-texto mt-0.5' :
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
            {/* «Ya llegué» y no «Estoy listo»: dice lo que de verdad significa
                —estoy en el local— y no se confunde con estar inscrito, que
                es otra cosa y ya pasó. Solo se ofrece a quien está inscrito:
                marcar llegada sin estar anotado no querría decir nada. */}
            {yoInscrito && (editandoMazo ? (
              <div className="rounded-xl border border-swu-accent/30 bg-swu-surface p-3">
                <DeclararMazo
                  dosLideres={event.deMesas}
                  inicial={{
                    leader_1: miFila?.lideres[0] ?? null,
                    leader_2: miFila?.lideres[1] ?? null,
                    base_carta: miFila?.base ?? null,
                  }}
                  etiquetaAceptar="Guardar mi mazo"
                  ocupado={guardandoMazo}
                  onAceptar={(m) => void guardarMazo(m)}
                  onCancelar={() => setEditandoMazo(false)}
                />
              </div>
            ) : (
              <button
                onClick={() => setEditandoMazo(true)}
                className="w-full rounded-xl border border-swu-border py-2.5 text-sm font-semibold text-swu-text"
              >
                {miFila && (miFila.lideres.length > 0 || miFila.base)
                  ? 'Cambiar mi mazo'
                  : 'Declarar con qué voy a jugar'}
              </button>
            ))}

            {yoInscrito && !editandoMazo && (
              <button
                onClick={() => void alternarLlegada()}
                disabled={marcando}
                className={`w-full py-3.5 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${
                  yoLlegue
                    ? 'bg-swu-surface border-2 border-swu-green text-swu-green'
                    : 'bg-swu-green text-white active:scale-[0.98]'
                }`}
              >
                {yoLlegue ? (
                  <><CheckCircle2 size={20} /> Llegaste — tocá para deshacer</>
                ) : (
                  <><Swords size={20} /> Ya llegué</>
                )}
              </button>
            )}
            {falloLlegada && (
              <p className="text-center text-[11px] text-red-400">{falloLlegada}</p>
            )}

            {confirmarSalida ? (
              <div className="space-y-2">
                <p className="text-center text-[11px] text-swu-muted">
                  Te vas a dar de baja del torneo. Si después querés volver a
                  entrar, tendrás que inscribirte de nuevo.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => void abandonarDeVerdad()}
                    disabled={saliendo}
                    className="flex-1 rounded-xl bg-red-500/20 py-2.5 text-sm font-bold text-red-400 disabled:opacity-60"
                  >
                    {saliendo ? 'Dando de baja…' : 'Sí, darme de baja'}
                  </button>
                  <button
                    onClick={() => setConfirmarSalida(false)}
                    className="flex-1 rounded-xl bg-swu-border py-2.5 text-sm font-bold text-swu-muted"
                  >
                    Seguir inscrito
                  </button>
                </div>
                {fallaSalida && (
                  <p className="text-center text-[11px] text-red-400">{fallaSalida}</p>
                )}
              </div>
            ) : (
              <button
                onClick={() => setConfirmarSalida(true)}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-swu-muted flex items-center justify-center gap-2"
              >
                <LogOut size={16} /> Darme de baja del torneo
              </button>
            )}
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
            /* Iba a `/events/tournament/live`, que cae en la ruta del motor
               LOCAL (`/events/tournament/:id` con id='live') y muestra «Torneo
               no encontrado». La vista del jugador en la nube es ésta. */
            onClick={() => navigate(`/events/play/${code}`)}
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

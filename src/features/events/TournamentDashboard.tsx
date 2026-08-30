/**
 * TournamentDashboard — Admin control panel for cloud tournaments
 * Route: /events/tournament/:code
 */

import { esDeMesas, etiquetaTipo } from '../../services/tipoTorneo'
import { MesasPanel } from './MesasPanel'
import {
  getMesasDeRonda, ultimaRonda, cambiarTipoTorneo, type MesaArmada,
} from '../../services/mesasService'
import { useState, useEffect, useCallback} from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, SkipForward, Clock, Users, Trophy, GitBranch, UserMinus, LayoutGrid, Bell } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  getEventTournamentInfo,
  getStandings,
  getRoundPairings,
  getAllRounds,
  initializeTournament,
  generateSwissPairings,
  generateEliminationBracket,
  advanceEliminationRound,
  reportResult,
  startRoundTimer,
  extendTimer,
  stopTimer,
  dropPlayer,
  finishTournament,
  subscribeToEvent,
  type CloudEvent,
  type CloudStanding,
  type CloudPairing,
  type CloudRound,
} from '../../services/tournamentCloud'
import { StandingsTable } from './components/StandingsTable'
import { PairingsView } from './components/PairingsView'
import { avisarEmparejamientos, type ResultadoAviso } from '../../services/avisarEmparejamientos'
import { avisarResultados, type ResultadoAvisoFinal } from '../../services/avisarResultados'
import { escucharPresenciaTorneo, escucharInscripciones, type Mirando } from '../../services/presenciaTorneo'
import { getEventRegistrations, type EventRegistration } from '../../services/events'
import { Avatar } from '../../components/ui/Avatar'
import { BracketView } from './components/BracketView'
import { RoundTimer } from './components/RoundTimer'

type Tab = 'rounds' | 'pairings' | 'standings' | 'timer' | 'bracket' | 'mesas'

export default function TournamentDashboard() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { supabaseUser, isAdmin } = useAuth()

  const [event, setEvent] = useState<CloudEvent | null>(null)
  const [standings, setStandings] = useState<CloudStanding[]>([])
  const [pairings, setPairings] = useState<CloudPairing[]>([])
  const [rounds, setRounds] = useState<CloudRound[]>([])
  /* Un torneo de MESAS (Twin Suns) se opera desde acá, que es el tablero de
     torneos. Estuvo un rato dentro del Centro de Temporada y estaba mal: llevar
     un torneo multijugador es una funcion de TORNEOS, no de temporada — y el
     Centro lo ve una sola persona, asi que ningun otro organizador podia. */
  const [mesas, setMesas] = useState<MesaArmada[]>([])
  const [rondaMesas, setRondaMesas] = useState<{ id: string; numero: number } | null>(null)
  /* Un torneo de MESAS abre en su propia pestaña.
   *
   * El tablero abría siempre en «Rondas», que lee `tournament_pairings` — y un
   * torneo de mesas no tiene ni uno. El organizador entraba en pleno torneo,
   * leía «no hay emparejamientos» y no tenía forma de saber que sus mesas
   * estaban en otra pestaña.
   *
   * Se DERIVA en vez de moverla con un efecto: `null` es «todavía no eligió»,
   * y ahí manda el tipo del torneo. En cuanto toca una pestaña, manda ella.
   * Un efecto que escribe estado dispara renders en cascada y además pelearía
   * con el clic. */
  const [tabElegida, setActiveTab] = useState<Tab | null>(null)
  const [selectedRound, setSelectedRound] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!code) return
    const ev = await getEventTournamentInfo(code)
    if (!ev) {
      setError('Evento no encontrado')
      setLoading(false)
      return
    }
    setEvent(ev)
    const [s, r] = await Promise.all([
      getStandings(ev.id),
      getAllRounds(ev.id),
    ])
    setStandings(s)
    setRounds(r)

    // Las mesas solo se piden si el torneo es de ese tipo: en un suizo la
    // consulta traeria siempre cero y seria un viaje de red por nada.
    if (esDeMesas(ev.tournament_type)) {
      const ronda = await ultimaRonda(ev.id)
      setRondaMesas(ronda)
      setMesas(ronda ? await getMesasDeRonda(ronda.id) : [])
    } else {
      setRondaMesas(null)
      setMesas([])
    }

    const roundToShow = selectedRound || ev.current_round
    if (roundToShow > 0) {
      const p = await getRoundPairings(ev.id, roundToShow)
      setPairings(p)
      setSelectedRound(roundToShow)
    }
    setLoading(false)
  }, [code, selectedRound])

  useEffect(() => {
    // Envuelto en una función asíncrona a propósito: llamarlo en seco desde
    // el cuerpo del efecto encadena un render antes de que React pinte.
    void (async () => { await fetchData() })()
  }, [fetchData])

  // Realtime subscriptions
  useEffect(() => {
    if (!event?.id) return
    /* Las mesas no tienen canal propio de tiempo real, y no hace falta abrirlo:
     * `guardar_puestos_mesa` recalcula `tournament_standings` y `armar_mesas`
     * toca `official_events.current_round`, así que las dos acciones ya
     * disparan uno de estos callbacks. Sin esto, el segundo organizador
     * seguía viendo la ronda anterior y anotaba encima de ella. */
    const refrescarMesas = async () => {
      if (!esDeMesas(event.tournament_type)) return
      const ronda = await ultimaRonda(event.id)
      setRondaMesas(ronda)
      setMesas(ronda ? await getMesasDeRonda(ronda.id) : [])
    }

    const unsub = subscribeToEvent(event.id, {
      onStandingsChange: () => {
        getStandings(event.id).then(setStandings)
        void refrescarMesas()
      },
      onPairingsChange: () => {
        if (selectedRound > 0) {
          getRoundPairings(event.id, selectedRound).then(setPairings)
        }
      },
      onEventChange: () => {
        if (code) getEventTournamentInfo(code).then(ev => ev && setEvent(ev))
        void refrescarMesas()
      },
    })
    return unsub
  }, [event?.id, event?.tournament_type, selectedRound, code])

  // Load pairings when selected round changes
  useEffect(() => {
    if (event?.id && selectedRound > 0) {
      getRoundPairings(event.id, selectedRound).then(setPairings)
    }
  }, [event?.id, selectedRound])

  const showMessage = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(null), 4000) }
    else { setSuccess(msg); setTimeout(() => setSuccess(null), 3000) }
  }

  // ─── Actions ──────────────────────────────────────────────

  const handleInitialize = async () => {
    if (!event) return
    setActionLoading(true)
    const res = await initializeTournament(event.id)
    if (res.ok) {
      showMessage('Torneo inicializado')
      fetchData()
    } else {
      showMessage(res.error || 'Error', true)
    }
    setActionLoading(false)
  }

  const handleGeneratePairings = async () => {
    if (!event) return

    /* Un torneo de MESAS no se opera desde acá.
     *
     * Esto era un ternario binario, así que cualquier tipo que no fuera
     * 'elimination' caía en la rama suiza: apretar «Generar ronda» en un
     * torneo de mesas escribía pareos 1v1 en `tournament_pairings`, decía
     * «Ronda N generada» en verde y no dejaba ni un error. Un torneo
     * multijugador partido en parejas, y nadie se enteraba hasta mirar las
     * mesas. Es el único else de todo el sistema que ESCRIBE. */
    if (esDeMesas(event.tournament_type)) {
      showMessage('Este torneo es de mesas: se arma en la pestaña «Mesas».')
      setActiveTab('mesas')
      return
    }

    setActionLoading(true)
    const nextRound = event.current_round + 1
    const res = event.tournament_type === 'elimination'
      ? event.current_round === 0
        ? await generateEliminationBracket(event.id)
        : await advanceEliminationRound(event.id, event.current_round)
      : await generateSwissPairings(event.id, nextRound)

    if (res.ok) {
      showMessage(`Ronda ${nextRound} generada`)
      await fetchData()
      setSelectedRound(nextRound)
      setActiveTab('pairings')
    } else {
      showMessage(res.error || 'Error', true)
    }
    setActionLoading(false)
  }

  const handleReport = async (pairingId: string, winnerId: string | null, score: string) => {
    if (!supabaseUser) return
    const res = await reportResult(pairingId, winnerId, score, supabaseUser.id)
    if (res.ok) {
      showMessage('Resultado guardado')
      fetchData()
    } else {
      showMessage(res.error || 'Error', true)
    }
  }

  const handleStartTimer = async (mins: number) => {
    if (!event) return
    const res = await startRoundTimer(event.id, mins)
    if (res.ok) {
      showMessage(`Timer ${mins}min iniciado`)
      fetchData()
    } else showMessage(res.error || 'Error', true)
  }

  const handleExtendTimer = async () => {
    if (!event) return
    const res = await extendTimer(event.id, 5)
    if (res.ok) {
      showMessage('+5 min')
      fetchData()
    } else showMessage(res.error || 'Error', true)
  }

  const handleStopTimer = async () => {
    if (!event) return
    const res = await stopTimer(event.id)
    if (res.ok) fetchData()
  }

  const handleDropPlayer = async (userId: string) => {
    if (!event) return
    if (!confirm('¿Seguro que desea retirar a este jugador?')) return
    const res = await dropPlayer(event.id, userId)
    if (res.ok) {
      showMessage('Jugador retirado')
      fetchData()
    } else showMessage(res.error || 'Error', true)
  }

  const handleFinish = async () => {
    if (!event) return
    // Se dice QUÉ hace el botón: finalizar ya no es solo cambiar un estado,
    // reparte XP y puntos de ranking a todos, y no se puede repetir.
    if (!confirm(
      'Al finalizar se reparten XP y puntos de ranking a los jugadores de la ' +
      'clasificación. Es definitivo: no se puede volver a repartir. ¿Finalizar?'
    )) return
    const res = await finishTournament(event.id)
    if (res.ok) {
      // El aviso llega cuando el torneo se cierra SIN clasificación: se cerró,
      // pero no hubo a quién premiar y hay que decirlo en vez de festejar.
      showMessage(res.aviso
        ? res.aviso
        : `Torneo finalizado · estadísticas repartidas a ${res.premiados} jugador${res.premiados === 1 ? '' : 'es'}`)
      fetchData()
    } else {
      // Antes esta rama NO existía: si el cierre fallaba, el botón no decía
      // nada y quedaba la impresión de que había funcionado.
      showMessage(res.error || 'No se pudo finalizar el torneo', true)
    }
  }

  // ─── Guards ───────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-swu-bg flex items-center justify-center p-4">
        <div className="text-swu-muted text-center">
          <p className="text-lg">Acceso denegado</p>
          <p className="text-sm mt-2">Solo administradores pueden acceder al dashboard</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-swu-bg flex items-center justify-center">
        <div className="text-swu-muted animate-pulse">Cargando torneo...</div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-swu-bg flex items-center justify-center p-4">
        <div className="text-swu-muted text-center">
          <p>Evento no encontrado</p>
          <button onClick={() => navigate('/events')} className="text-swu-accent-texto mt-2">
            Volver a Eventos
          </button>
        </div>
      </div>
    )
  }

  const activeTab: Tab = tabElegida ?? (esDeMesas(event.tournament_type) ? 'mesas' : 'rounds')

  /* `sembrado` reemplazó a `isNotStarted`, que mezclaba estado y datos y
     por eso trababa el arranque. Ver el comentario del botón. */
  const sembrado = standings.length > 0
  const isFinished = event.status === 'finished'
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'rounds', label: 'Rondas', icon: <Play size={16} /> },
    { id: 'pairings', label: 'Pairings', icon: <Users size={16} /> },
    { id: 'standings', label: 'Standings', icon: <Trophy size={16} /> },
    { id: 'timer', label: 'Timer', icon: <Clock size={16} /> },
  ]
  if (event.tournament_type === 'elimination') {
    tabs.push({ id: 'bracket', label: 'Bracket', icon: <GitBranch size={16} /> })
  }
  /* La pestaña de Mesas se ofrece SIEMPRE, no solo si el torneo ya es de ese
     tipo: escondida detras del tipo, la herramienta existia y no aparecia en
     ningun lado para quien no hubiera acertado al crear el torneo. Adentro se
     ofrece convertir. */
  // Ícono propio: 'pairings' ya usa Users, y en móvil el rótulo va oculto,
  // así que dos pestañas con el mismo dibujo son indistinguibles.
  tabs.push({ id: 'mesas', label: 'Mesas', icon: <LayoutGrid size={16} /> })

  // Build player name map for bracket
  /* Llaveado por la FILA de clasificación (`s.id`), que es lo que ahora
   * lleva el pareo. Con `user_id` los invitados colapsaban en la clave `null`
   * y el cuadro les ponía el nombre de otro — o «TBD». Por `id` entran todos. */
  const playerNames = new Map<string, string>()
  standings.forEach(s => playerNames.set(s.id, s.player_name))

  return (
    <div className="min-h-screen bg-swu-bg pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-swu-surface border-b border-swu-border">
        <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/torneos?t=organizar')} className="text-swu-muted">
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-swu-text truncate">{event.name}</h1>
              <div className="flex items-center gap-2 text-xs text-swu-muted">
                <span className="uppercase">{etiquetaTipo(event.tournament_type)}</span>
                <span>·</span>
                <span>Ronda {event.current_round}/{event.max_rounds || '?'}</span>
                <span>·</span>
                <span className={event.status === 'active' ? 'text-green-400' : event.status === 'finished' ? 'text-yellow-400' : 'text-swu-muted'}>
                  {event.status === 'active' ? 'EN CURSO' : event.status === 'finished' ? 'FINALIZADO' : 'ABIERTO'}
                </span>
              </div>
            </div>
            {/* Public link */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/events/live/${event.code}`)
                showMessage('Link copiado')
              }}
              className="text-xs px-2 py-1 bg-swu-accent/20 text-swu-accent-texto rounded"
            >
              📋 Link
            </button>
          </div>
        </div>
      </div>

      {/* La sala de espera del organizador. Antes de arrancar es lo único que
          importa: quién se anotó y quién está de verdad ahí. */}
      {event.status !== 'finished' && (
        <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 mt-2">
          <SalaDeEspera eventId={event.id} />
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 mt-2">
          <div className="bg-red-500/20 text-red-400 text-xs p-2 rounded">{error}</div>
        </div>
      )}
      {success && (
        <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 mt-2">
          <div className="bg-green-500/20 text-green-400 text-xs p-2 rounded">{success}</div>
        </div>
      )}

      {/* Timer bar */}
      {event.round_timer_end && (
        <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 mt-3">
          <div className="bg-swu-surface border border-swu-border rounded-lg p-3 text-center">
            <RoundTimer endTime={event.round_timer_end} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 mt-3">
        <div className="flex gap-1 bg-swu-surface rounded-lg p-1 border border-swu-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs rounded transition-colors ${
                activeTab === tab.id
                  ? 'bg-swu-accent/20 text-swu-accent-texto font-bold'
                  : 'text-swu-muted hover:text-swu-text'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 mt-4">
        {/* En un torneo de mesas, Rondas y Pairings leen `tournament_pairings`,
            que está vacía por construcción. Decir «no hay emparejamientos»
            es cierto y aun así engaña: parece que falta algo. */}
        {(activeTab === 'rounds' || activeTab === 'pairings') && esDeMesas(event.tournament_type) && (
          <div className="rounded-xl border border-swu-amber/40 bg-swu-amber/10 p-4 space-y-2">
            <p className="text-sm font-bold text-swu-text">Este torneo es de mesas</p>
            <p className="text-xs leading-relaxed text-swu-muted">
              Se juega en mesas de 3 o 4, así que no hay emparejamientos uno contra
              uno que mostrar acá. Las mesas y los puestos están en la pestaña
              «Mesas».
            </p>
            <button
              onClick={() => setActiveTab('mesas')}
              className="min-h-[44px] rounded-lg bg-swu-accent px-4 text-sm font-semibold text-white"
            >
              Ir a Mesas
            </button>
          </div>
        )}

        {/* ── Rounds Tab ── */}
        {activeTab === 'rounds' && !esDeMesas(event.tournament_type) && (
          <div className="space-y-3">
            {/* Initialize button */}
            {/* El botón se decide contra los DATOS, no contra el estado.
              *
              * Estaba gateado por `status === 'open'`, y «Activar» desde
              * /admin/events cambia la columna SIN sembrar la clasificación:
              * el torneo quedaba en 'active' con cero standings y el único
              * botón que podía arrancarlo ya no se dibujaba. Candado circular.
              *
              * Y NO se puede relajar a `current_round === 0`:
              * `initializeTournament` termina dejando `current_round: 0`, así
              * que el botón reaparecería justo después de sembrar y un segundo
              * toque insertaría la clasificación DOS veces. `standings.length`
              * es lo único que no miente. */}
            {!sembrado && !isFinished && (
              <button
                onClick={handleInitialize}
                disabled={actionLoading}
                className="w-full py-3 bg-swu-accent text-white rounded-lg font-bold disabled:opacity-50"
              >
                {actionLoading ? 'Inicializando...' : '🚀 Iniciar Torneo'}
              </button>
            )}

            {/* Generate next round */}
            {!isFinished && event.status === 'active' && (
              <div className="flex gap-2">
                <button
                  onClick={handleGeneratePairings}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-swu-accent/20 text-swu-accent-texto rounded-lg font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Play size={16} />
                  {event.current_round === 0 ? 'Generar Ronda 1' : 'Siguiente Ronda'}
                </button>
                {event.current_round > 0 && (
                  <button
                    onClick={handleFinish}
                    className="px-4 py-2.5 bg-red-500/20 text-red-400 rounded-lg text-sm"
                  >
                    Finalizar
                  </button>
                )}
              </div>
            )}

            {/* Round list */}
            <div className="space-y-2">
              {rounds.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelectedRound(r.round_number)
                    setActiveTab('pairings')
                  }}
                  className={`w-full flex items-center justify-between p-3 bg-swu-surface border rounded-lg text-sm ${
                    r.round_number === event.current_round
                      ? 'border-swu-accent/50'
                      : 'border-swu-border'
                  }`}
                >
                  <span className="text-swu-text font-medium">
                    Ronda {r.round_number}
                  </span>
                  <span className={`text-xs ${r.completed_at ? 'text-green-400' : 'text-yellow-400'}`}>
                    {r.completed_at ? '✓ Completada' : '● En curso'}
                  </span>
                </button>
              ))}
              {rounds.length === 0 && (
                <div className="text-center text-swu-muted py-6 text-sm">
                  {event.status === 'open' ? 'Inicie el torneo para comenzar' : 'No hay rondas aún'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Pairings Tab ── */}
        {activeTab === 'pairings' && !esDeMesas(event.tournament_type) && (
          <div>
            {/* Round selector */}
            {rounds.length > 1 && (
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                {rounds.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRound(r.round_number)}
                    className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${
                      selectedRound === r.round_number
                        ? 'bg-swu-accent text-white'
                        : 'bg-swu-surface text-swu-muted border border-swu-border'
                    }`}
                  >
                    R{r.round_number}
                  </button>
                ))}
              </div>
            )}
            <BotonAvisarPareos code={event.code} />
            <PairingsView
              pairings={pairings}
              canReport={!isFinished}
              onReport={handleReport}
            />
          </div>
        )}

        {/* ── Standings Tab ── */}
        {activeTab === 'standings' && (
          <div>
            {isFinished && <BotonAvisarResultados code={event.code} />}
            <StandingsTable standings={standings} />
            {/* Drop player controls */}
            {!isFinished && standings.length > 0 && (
              <div className="mt-4 space-y-1">
                <p className="text-xs text-swu-muted mb-2">Retirar jugador:</p>
                {/* La llave es `s.id` (la fila de clasificación) y no `s.user_id`:
                    con dos invitados, dos `key={null}` son la misma llave y React
                    reusa la fila equivocada al reordenar. */}
                {standings.filter(s => !s.dropped).map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-1">
                    <span className="text-xs text-swu-text">{s.player_name}</span>
                    <button
                      // Retirar a un invitado todavía no se puede: la baja se
                      // escribe por `user_id`. Se desactiva en vez de fallar.
                      disabled={!s.user_id}
                      onClick={() => { if (s.user_id) void handleDropPlayer(s.user_id) }}
                      className="text-xs px-2 py-0.5 text-red-400 hover:bg-red-500/10 rounded"
                    >
                      <UserMinus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Timer Tab ── */}
        {activeTab === 'timer' && (
          <div className="space-y-4">
            <div className="bg-swu-surface border border-swu-border rounded-lg p-6 text-center">
              <RoundTimer endTime={event.round_timer_end} large />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[50, 55, 60].map((mins) => (
                <button
                  key={mins}
                  onClick={() => handleStartTimer(mins)}
                  className="py-3 bg-swu-surface border border-swu-border rounded-lg text-sm text-swu-text hover:border-swu-accent transition-colors"
                >
                  {mins} min
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleExtendTimer}
                className="flex-1 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm flex items-center justify-center gap-1"
              >
                <SkipForward size={14} /> +5 min
              </button>
              <button
                onClick={handleStopTimer}
                className="flex-1 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm"
              >
                Detener
              </button>
            </div>
          </div>
        )}

        {/* ── Bracket Tab ── */}
        {/* ── Mesas Tab ── */}
        {activeTab === 'mesas' && (
          <div>
            {esDeMesas(event.tournament_type) ? (
              <MesasPanel
                eventId={event.id}
                /*
                 * Un torneo cerrado SIN resultados sigue siendo anotable.
                 *
                 * El del 22/8 se cerró con las 2 mesas armadas y los 8 puestos
                 * en NULL: la partida se jugó y el resultado no entró nunca.
                 * Con `cerrado = status === 'finished'` a secas, la pantalla
                 * tapaba la única forma de recuperarlo — y el servidor sí lo
                 * permite (`guardar_puestos_mesa` solo pide permiso de
                 * organizador, no mira el estado).
                 *
                 * Se abre SOLO mientras no haya un puesto anotado: en cuanto
                 * hay uno, el torneo vuelve a estar cerrado de verdad y nadie
                 * puede reescribir un podio ya repartido.
                 */
                cerrado={event.status === 'finished' && standings.some(s => s.puesto != null)}
                standings={standings}
                ronda={rondaMesas}
                mesas={mesas}
                ocupado={actionLoading}
                onCambio={() => { void fetchData() }}
                onAviso={showMessage}
                /* `showMessage(m, true)` y no `setError` crudo: es el único que
                   programa el borrado a los 4 s. Con setError el rojo quedaba
                   pegado toda la sesión, incluso después de que la acción
                   siguiente saliera bien. */
                onError={m => showMessage(m, true)}
              />
            ) : (
              <ConvertirAMesas
                event={event}
                sembrado={standings.length > 0}
                onHecho={() => { showMessage('Torneo convertido a mesas'); void fetchData() }}
                onError={m => showMessage(m, true)}
              />
            )}
          </div>
        )}

        {activeTab === 'bracket' && event.tournament_type === 'elimination' && (
          <BracketViewLoader
            eventId={event.id}
            rounds={rounds}
            playerNames={playerNames}
          />
        )}
      </div>
    </div>
  )
}

// Bracket loader subcomponent
function BracketViewLoader({
  eventId,
  rounds,
  playerNames,
}: {
  eventId: string
  rounds: CloudRound[]
  playerNames: Map<string, string>
}) {
  const [pairingsByRound, setPairingsByRound] = useState<Map<number, CloudPairing[]>>(new Map())

  useEffect(() => {
    async function loadAll() {
      const map = new Map<number, CloudPairing[]>()
      for (const r of rounds) {
        const p = await getRoundPairings(eventId, r.round_number)
        map.set(r.round_number, p)
      }
      setPairingsByRound(map)
    }
    loadAll()
  }, [eventId, rounds])

  return (
    <BracketView
      rounds={rounds}
      pairingsByRound={pairingsByRound}
      playerNames={playerNames}
    />
  )
}

/* ── Convertir un torneo a mesas ───────────────────────────────────── */

function ConvertirAMesas({
  event, sembrado, onHecho, onError,
}: {
  event: CloudEvent
  /** Si ya hay clasificación. El servidor rechaza la conversión con una sola fila. */
  sembrado: boolean
  onHecho: () => void
  onError: (m: string) => void
}) {
  const [yendo, setYendo] = useState(false)
  /* La MISMA regla que el servidor.
   *
   * Miraba solo `current_round > 0`, pero `cambiar_tipo_torneo` rechaza en
   * cuanto hay UNA fila de clasificación — y `initializeTournament` siembra
   * las standings dejando `current_round` en 0. En esa ventana el panel
   * afirmaba «todavía no sembró la clasificación» siendo falso, y el botón
   * fallaba contra el servidor. */
  const arrancado = event.status === 'finished' || event.current_round > 0 || sembrado

  return (
    <div className="rounded-xl border border-swu-border bg-swu-surface p-4 space-y-2.5">
      <p className="text-sm font-bold text-swu-text">
        Este torneo es de tipo «{etiquetaTipo(event.tournament_type)}»
      </p>
      <p className="text-xs leading-relaxed text-swu-muted">
        Twin Suns se juega en mesas de 3 o 4, no uno contra uno. Para llevarlo
        desde acá el torneo tiene que ser de tipo <strong>Mesas</strong>.
      </p>
      {arrancado ? (
        <p className="text-xs text-swu-muted">
          Ya arrancó, así que el tipo no se puede cambiar: los pareos que ya tiene
          escritos no corresponderían a una estructura de mesas. Para un torneo de
          Twin Suns, creá uno nuevo eligiendo «Mesas».
        </p>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-swu-muted">
            Todavía no sembró la clasificación, así que se puede convertir sin
            perder el código, los inscritos ni la sede. <strong>Es de una sola
            dirección</strong>: para volver a suizo habría que borrar el torneo
            y crearlo otra vez.
          </p>
          <button
            onClick={async () => {
              /* Confirmación obligatoria: desde la app NO hay vuelta.
               *
               * `cambiarTipoTorneo` solo se llama con 'mesas' en toda la app;
               * ningún sitio la llama con 'swiss'. Una vez convertido, este
               * panel deja de renderizarse y la única marcha atrás es el SQL
               * Editor o borrar el torneo. En la misma pantalla, retirar a un
               * jugador y finalizar el torneo SÍ confirman — esto era el único
               * acto irreversible que no preguntaba nada. */
              if (!confirm(
                `Convertir «${event.name}» a torneo de MESAS (Twin Suns).\n\n` +
                'Desde la app no se puede volver a suizo: habría que borrar el ' +
                'torneo y crearlo de nuevo.\n\n¿Seguro?'
              )) return
              setYendo(true)
              const r = await cambiarTipoTorneo(event.id, 'mesas')
              setYendo(false)
              if (r.ok) onHecho(); else onError(r.mensaje)
            }}
            disabled={yendo}
            className="flex min-h-[44px] items-center gap-2 rounded-lg bg-swu-accent px-4 text-sm
                       font-semibold text-white disabled:opacity-50"
          >
            <Users size={15} /> {yendo ? 'Convirtiendo…' : 'Convertir a torneo de mesas'}
          </button>
        </>
      )}
    </div>
  )
}


/**
 * «Avisar los emparejamientos» — le manda a cada jugador SU rival y SU mesa.
 *
 * Va pegado a los pareos, que es donde la organización ya está mirando cuando
 * decide anunciarlos. Un botón para esto en otra pantalla es un botón que
 * nadie encuentra (§3l).
 *
 * ── El resultado dice A QUIÉN NO LE LLEGÓ, y eso es lo importante ────
 *
 * El push solo alcanza a quien lo tenga activado: en el primer torneo, 3 de
 * 12. Un «enviados: 12» sería exactamente el fallo que se ve como éxito — la
 * organización cree que avisó y en la mesa nadie sabe contra quién juega. Por
 * eso se listan por nombre los que van a tener que abrir la app.
 */
function BotonAvisarPareos({ code }: { code: string }) {
  const [enviando, setEnviando] = useState(false)
  const [res, setRes] = useState<ResultadoAviso | null>(null)

  return (
    <div className="mb-3 rounded-xl border border-swu-border bg-swu-surface p-3">
      <button
        onClick={() => {
          setEnviando(true)
          void avisarEmparejamientos(code).then(r => { setRes(r); setEnviando(false) })
        }}
        disabled={enviando}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border
                   border-swu-accent/40 bg-swu-accent/10 text-xs font-bold uppercase
                   tracking-wider text-swu-accent-texto disabled:opacity-60"
      >
        <Bell size={14} />
        {enviando ? 'Avisando…' : 'Avisar los emparejamientos'}
      </button>

      {res && !res.ok && (
        <p className="mt-2 text-[11px] text-swu-red-texto">{res.mensaje}</p>
      )}

      {res?.ok && (
        <div className="mt-2.5 text-[11px] leading-relaxed">
          <p className="text-swu-text">
            Ronda {res.ronda}: le llegó a <strong>{res.llegaron}</strong> de {res.avisos.length}.
          </p>
          {res.sinPush > 0 && (
            <p className="mt-1 text-swu-muted">
              Sin avisos activados —lo van a ver al abrir la app—:{' '}
              {res.avisos.filter(a => !a.alcanzado).map(a => a.nombre).join(', ')}.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * El aviso del cierre. Aparece solo con el torneo terminado: antes de repartir
 * no hay puesto final que contar, y mandarlo a media ronda diria un puesto que
 * todavia se mueve.
 */
function BotonAvisarResultados({ code }: { code: string }) {
  const [enviando, setEnviando] = useState(false)
  const [res, setRes] = useState<ResultadoAvisoFinal | null>(null)

  return (
    <div className="mb-3 rounded-xl border border-swu-border bg-swu-surface p-3">
      <button
        onClick={() => {
          setEnviando(true)
          void avisarResultados(code).then(r => { setRes(r); setEnviando(false) })
        }}
        disabled={enviando}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border
                   border-swu-amber/40 bg-swu-amber/10 text-xs font-bold uppercase
                   tracking-wider text-swu-amber disabled:opacity-60"
      >
        <Trophy size={14} />
        {enviando ? 'Avisando…' : 'Avisar los resultados'}
      </button>

      {res && !res.ok && (
        <p className="mt-2 text-[11px] text-swu-red-texto">{res.mensaje}</p>
      )}

      {res?.ok && (
        <div className="mt-2.5 space-y-1 text-[11px] leading-relaxed">
          <p className="text-swu-text">
            Le llegó a <strong>{res.llegaron}</strong> de{' '}
            {res.avisos.length - res.sinCuenta.length} con cuenta.
          </p>
          {res.sinPush > 0 && (
            <p className="text-swu-muted">
              Sin avisos activados —lo ven al abrir la app—:{' '}
              {res.avisos.filter(a => a.userId && !a.alcanzado).map(a => a.nombre).join(', ')}.
            </p>
          )}
          {res.sinCuenta.length > 0 && (
            <p className="text-swu-amber">
              Sin cuenta, no recibieron sobres ni aviso: {res.sinCuenta.join(', ')}.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * La sala: quién se anotó y quién está conectado AHORA.
 *
 * Son dos preguntas distintas y las dos hacen falta antes de tirar la ronda 1.
 * Los inscritos son quienes se anotaron alguna vez —sobrevive a que se les
 * apague el teléfono—; los conectados son quienes tienen la app abierta en
 * este momento. Un celular en el bolsillo se desconecta y la persona sigue
 * parada en la tienda, así que la presencia NO reemplaza a la lista.
 *
 * Las dos llegan solas: `event_registrations` ya publica cambios, así que una
 * inscripción nueva repinta esto sin que nadie recargue. Antes el organizador
 * armaba la ronda 1 con el conteo del momento en que había abierto la
 * pantalla, y dejaba gente afuera.
 */
function SalaDeEspera({ eventId }: { eventId: string }) {
  const { supabaseUser, currentProfile } = useAuth()
  const [inscritos, setInscritos] = useState<EventRegistration[] | null>(null)
  const [conectados, setConectados] = useState<Mirando[]>([])
  const [abierta, setAbierta] = useState(false)

  const cargar = useCallback(async () => {
    const filas = await getEventRegistrations(eventId)
    setInscritos(filas)
  }, [eventId])

  /* Envuelto en una función asíncrona a propósito: llamarlo en seco desde el
     cuerpo del efecto encadena un render antes de que React pinte, y el lint
     del compilador lo veta (mismo patrón que en RankingPage). */
  useEffect(() => { void (async () => { await cargar() })() }, [cargar])

  useEffect(() => escucharInscripciones(eventId, () => { void cargar() }), [eventId, cargar])

  useEffect(() => escucharPresenciaTorneo(
    eventId,
    supabaseUser ? {
      id: supabaseUser.id,
      nombre: currentProfile?.name ?? 'Organizador',
      avatar: currentProfile?.avatar ?? null,
    } : null,
    setConectados,
  ), [eventId, supabaseUser, currentProfile?.name, currentProfile?.avatar])

  const enLinea = new Set(conectados.map(c => c.userId))

  return (
    <div className="rounded-xl border border-swu-border bg-swu-surface p-3">
      <button onClick={() => setAbierta(v => !v)} className="flex w-full items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-bold text-swu-text">
          <Users size={14} className="text-swu-accent-texto" />
          {/* «—» y no 0: si la consulta falla, no se sabe. */}
          {inscritos === null ? '—' : inscritos.length} inscritos
          <span className="flex items-center gap-1 text-swu-green">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-swu-green" />
            {conectados.length} con la app abierta
          </span>
        </span>
        <span className="text-[10px] text-swu-muted">{abierta ? 'ocultar' : 'ver'}</span>
      </button>

      {abierta && (
        <div className="mt-2.5 space-y-1">
          {inscritos !== null && inscritos.length === 0 && (
            <p className="text-[11px] text-swu-muted">Todavía no se anotó nadie.</p>
          )}
          {(inscritos ?? []).map(r => (
            <div key={r.id} className="flex items-center gap-2 text-[11px]">
              <Avatar avatar={r.player_avatar} size={18} escalaEmoji={0.7} anillo={r.user_id} />
              <span className="min-w-0 flex-1 truncate text-swu-text">{r.player_name ?? 'Jugador'}</span>
              {enLinea.has(r.user_id) ? (
                <span className="shrink-0 text-swu-green">conectado</span>
              ) : (
                <span className="shrink-0 text-swu-muted">sin abrir</span>
              )}
            </div>
          ))}
          {/* Alguien conectado que NO está inscrito: mira el torneo pero no
              juega. Decirlo evita que el organizador lo cuente para la ronda. */}
          {conectados.filter(c => !(inscritos ?? []).some(r => r.user_id === c.userId)).map(c => (
            <div key={c.userId} className="flex items-center gap-2 text-[11px] opacity-70">
              <Avatar avatar={c.avatar} size={18} escalaEmoji={0.7} anillo={c.userId} />
              <span className="min-w-0 flex-1 truncate text-swu-muted">{c.nombre}</span>
              <span className="shrink-0 text-swu-muted">mirando, no inscrito</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

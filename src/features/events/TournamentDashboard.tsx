/**
 * TournamentDashboard — Admin control panel for cloud tournaments
 * Route: /events/tournament/:code
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, SkipForward, Clock, Users, Trophy, GitBranch, UserMinus } from 'lucide-react'
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
import { BracketView } from './components/BracketView'
import { RoundTimer } from './components/RoundTimer'

type Tab = 'rounds' | 'pairings' | 'standings' | 'timer' | 'bracket'

export default function TournamentDashboard() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { supabaseUser, isAdmin } = useAuth()

  const [event, setEvent] = useState<CloudEvent | null>(null)
  const [standings, setStandings] = useState<CloudStanding[]>([])
  const [pairings, setPairings] = useState<CloudPairing[]>([])
  const [rounds, setRounds] = useState<CloudRound[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('rounds')
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

    const roundToShow = selectedRound || ev.current_round
    if (roundToShow > 0) {
      const p = await getRoundPairings(ev.id, roundToShow)
      setPairings(p)
      setSelectedRound(roundToShow)
    }
    setLoading(false)
  }, [code, selectedRound])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Realtime subscriptions
  useEffect(() => {
    if (!event?.id) return
    const unsub = subscribeToEvent(event.id, {
      onStandingsChange: () => getStandings(event.id).then(setStandings),
      onPairingsChange: () => {
        if (selectedRound > 0) {
          getRoundPairings(event.id, selectedRound).then(setPairings)
        }
      },
      onEventChange: () => {
        if (code) getEventTournamentInfo(code).then(ev => ev && setEvent(ev))
      },
    })
    return unsub
  }, [event?.id, selectedRound, code])

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
    if (!confirm('¿Finalizar el torneo?')) return
    const res = await finishTournament(event.id)
    if (res.ok) {
      showMessage('Torneo finalizado')
      fetchData()
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
          <button onClick={() => navigate('/events')} className="text-swu-accent mt-2">
            Volver a Eventos
          </button>
        </div>
      </div>
    )
  }

  const isNotStarted = event.status === 'open' || event.current_round === 0
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

  // Build player name map for bracket
  const playerNames = new Map<string, string>()
  standings.forEach(s => playerNames.set(s.user_id, s.player_name))

  return (
    <div className="min-h-screen bg-swu-bg pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-swu-surface border-b border-swu-border">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/events')} className="text-swu-muted">
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-swu-text truncate">{event.name}</h1>
              <div className="flex items-center gap-2 text-xs text-swu-muted">
                <span className="uppercase">{event.tournament_type}</span>
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
              className="text-xs px-2 py-1 bg-swu-accent/20 text-swu-accent rounded"
            >
              📋 Link
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="max-w-lg mx-auto px-4 mt-2">
          <div className="bg-red-500/20 text-red-400 text-xs p-2 rounded">{error}</div>
        </div>
      )}
      {success && (
        <div className="max-w-lg mx-auto px-4 mt-2">
          <div className="bg-green-500/20 text-green-400 text-xs p-2 rounded">{success}</div>
        </div>
      )}

      {/* Timer bar */}
      {event.round_timer_end && (
        <div className="max-w-lg mx-auto px-4 mt-3">
          <div className="bg-swu-surface border border-swu-border rounded-lg p-3 text-center">
            <RoundTimer endTime={event.round_timer_end} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-lg mx-auto px-4 mt-3">
        <div className="flex gap-1 bg-swu-surface rounded-lg p-1 border border-swu-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs rounded transition-colors ${
                activeTab === tab.id
                  ? 'bg-swu-accent/20 text-swu-accent font-bold'
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
      <div className="max-w-lg mx-auto px-4 mt-4">
        {/* ── Rounds Tab ── */}
        {activeTab === 'rounds' && (
          <div className="space-y-3">
            {/* Initialize button */}
            {isNotStarted && event.status === 'open' && (
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
                  className="flex-1 py-2.5 bg-swu-accent/20 text-swu-accent rounded-lg font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
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
        {activeTab === 'pairings' && (
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
            <StandingsTable standings={standings} />
            {/* Drop player controls */}
            {!isFinished && standings.length > 0 && (
              <div className="mt-4 space-y-1">
                <p className="text-xs text-swu-muted mb-2">Retirar jugador:</p>
                {standings.filter(s => !s.dropped).map((s) => (
                  <div key={s.user_id} className="flex items-center justify-between py-1">
                    <span className="text-xs text-swu-text">{s.player_name}</span>
                    <button
                      onClick={() => handleDropPlayer(s.user_id)}
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

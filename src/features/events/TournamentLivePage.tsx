import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Play, Check, Trophy, Users, BarChart3, AlertCircle } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { db } from '../../services/db'
import {
  generatePairings,
  applyResult,
  isRoundComplete,
  sortStandings,
} from '../../services/swiss'
import type { Tournament, TournamentPairing } from '../../types'

type TabKey = 'pairings' | 'standings'

export function TournamentLivePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('pairings')
  const [resultModal, setResultModal] = useState<{
    roundIdx: number
    pairingIdx: number
    pairing: TournamentPairing
  } | null>(null)
  const [modalScore, setModalScore] = useState<[number, number]>([0, 0])

  const loadTournament = useCallback(async () => {
    if (!id) return
    const t = await db.tournaments.get(id)
    if (t) setTournament(t)
    setLoading(false)
  }, [id])

  useEffect(() => {
    loadTournament()
  }, [loadTournament])

  const saveTournament = async (t: Tournament) => {
    const updated = { ...t, updatedAt: Date.now() }
    await db.tournaments.put(updated)
    setTournament(updated)
  }

  const startNextRound = async () => {
    if (!tournament) return
    const pairings = generatePairings(tournament.players, tournament.avoidRematches)

    // Auto-resolve byes
    let updatedPlayers = [...tournament.players]
    const resolvedPairings = pairings.map((p) => {
      if (p.player2Id === null) {
        updatedPlayers = applyResult(updatedPlayers, p, p.player1Id, [2, 0])
        return { ...p, result: { winnerId: p.player1Id, score: [2, 0] as [number, number] } }
      }
      return p
    })

    const newRound = {
      number: tournament.rounds.length + 1,
      pairings: resolvedPairings,
      completed: isRoundComplete({ number: 0, pairings: resolvedPairings, completed: false }),
    }

    const updated: Tournament = {
      ...tournament,
      players: updatedPlayers,
      rounds: [...tournament.rounds, newRound],
    }

    await saveTournament(updated)
  }

  const openResultModal = (roundIdx: number, pairingIdx: number, pairing: TournamentPairing) => {
    if (pairing.result || !pairing.player2Id) return
    setModalScore([0, 0])
    setResultModal({ roundIdx, pairingIdx, pairing })
  }

  const submitResult = async () => {
    if (!tournament || !resultModal) return

    const { roundIdx, pairingIdx, pairing } = resultModal
    const [s1, s2] = modalScore

    let winnerId: string | null = null
    if (s1 > s2) winnerId = pairing.player1Id
    else if (s2 > s1) winnerId = pairing.player2Id

    const updatedPairing: TournamentPairing = {
      ...pairing,
      result: { winnerId, score: modalScore },
    }

    const newRounds = tournament.rounds.map((r, ri) => {
      if (ri !== roundIdx) return r
      const newPairings = r.pairings.map((p, pi) => (pi === pairingIdx ? updatedPairing : p))
      return { ...r, pairings: newPairings, completed: isRoundComplete({ ...r, pairings: newPairings }) }
    })

    const newPlayers = applyResult(tournament.players, pairing, winnerId, modalScore)

    const updated: Tournament = { ...tournament, rounds: newRounds, players: newPlayers }
    await saveTournament(updated)
    setResultModal(null)
  }

  const finishTournament = async () => {
    if (!tournament) return
    if (!confirm('¿Finalizar torneo? No se podrán agregar más rondas.')) return
    await saveTournament({ ...tournament, status: 'finished' })
  }

  const getPlayerName = (playerId: string | null): string => {
    if (!playerId || !tournament) return 'BYE'
    return tournament.players.find((p) => p.id === playerId)?.name ?? '?'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-swu-muted">Cargando torneo...</div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="p-4 text-center">
        <AlertCircle size={32} className="mx-auto text-swu-red mb-2" />
        <p className="text-swu-text font-bold">Torneo no encontrado</p>
        <button onClick={() => navigate('/events')} className="mt-3 text-sm text-swu-accent">
          Volver a Eventos
        </button>
      </div>
    )
  }

  const currentRound = tournament.rounds[tournament.rounds.length - 1]
  const canStartNext =
    tournament.status === 'active' &&
    (tournament.rounds.length === 0 || currentRound?.completed) &&
    tournament.rounds.length < tournament.maxRounds
  const allRoundsComplete =
    tournament.rounds.length >= tournament.maxRounds && (currentRound?.completed ?? true)
  const isFinished = tournament.status === 'finished'

  const standings = sortStandings(tournament.players, tournament.players)

  return (
    <div className="p-4 space-y-4 pb-24">
      <button onClick={() => navigate('/events')} className="flex items-center gap-1 text-sm text-swu-muted">
        <ChevronLeft size={18} /> Eventos
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-swu-text">{tournament.name}</h2>
          <p className="text-xs text-swu-muted">
            {tournament.format.toUpperCase()} · {tournament.matchType.toUpperCase()} · {tournament.players.length} jugadores
          </p>
        </div>
        {isFinished ? (
          <Badge variant="default">FINALIZADO</Badge>
        ) : (
          <Badge variant="green">ACTIVO</Badge>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-swu-surface rounded-xl border border-swu-border overflow-hidden">
        {([
          { key: 'pairings' as TabKey, label: 'Emparejamientos', icon: Users },
          { key: 'standings' as TabKey, label: 'Standings', icon: BarChart3 },
        ]).map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${
                tab === t.key ? 'bg-swu-accent text-white' : 'text-swu-muted'
              }`}
            >
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {/* Pairings Tab */}
      {tab === 'pairings' && (
        <div className="space-y-4">
          {tournament.rounds.length === 0 ? (
            <div className="text-center py-8">
              <Trophy size={40} className="mx-auto text-swu-amber/40 mb-3" />
              <p className="text-sm text-swu-muted">Torneo listo. Inicie la primera ronda.</p>
            </div>
          ) : (
            [...tournament.rounds].reverse().map((round, revIdx) => {
              const roundIdx = tournament.rounds.length - 1 - revIdx
              return (
                <div key={round.number}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-swu-text">Ronda {round.number}</h3>
                    {round.completed ? (
                      <Badge variant="green">Completa</Badge>
                    ) : (
                      <Badge variant="amber">En curso</Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    {round.pairings.map((pairing, pi) => {
                      const isBye = pairing.player2Id === null
                      const hasResult = pairing.result !== null

                      return (
                        <button
                          key={pi}
                          onClick={() => openResultModal(roundIdx, pi, pairing)}
                          disabled={isBye || hasResult}
                          className={`w-full bg-swu-surface rounded-xl border p-3 text-left transition-colors ${
                            hasResult || isBye ? 'border-swu-border' : 'border-swu-amber/40 active:bg-swu-amber/5'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className={`text-sm font-bold ${pairing.result?.winnerId === pairing.player1Id ? 'text-swu-green' : 'text-swu-text'}`}>
                                {getPlayerName(pairing.player1Id)}
                              </p>
                            </div>

                            <div className="px-3">
                              {hasResult ? (
                                <span className="text-sm font-extrabold font-mono text-swu-text">
                                  {pairing.result!.score[0]} — {pairing.result!.score[1]}
                                </span>
                              ) : isBye ? (
                                <span className="text-xs text-swu-muted">BYE</span>
                              ) : (
                                <span className="text-xs text-swu-amber font-bold">Reportar</span>
                              )}
                            </div>

                            <div className="flex-1 text-right">
                              <p className={`text-sm font-bold ${pairing.result?.winnerId === pairing.player2Id ? 'text-swu-green' : isBye ? 'text-swu-muted' : 'text-swu-text'}`}>
                                {isBye ? 'BYE' : getPlayerName(pairing.player2Id)}
                              </p>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}

          {/* Action buttons */}
          <div className="space-y-2">
            {canStartNext && (
              <button
                onClick={startNextRound}
                className="w-full py-3.5 rounded-xl bg-swu-amber text-black font-extrabold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
              >
                <Play size={18} /> Iniciar Ronda {tournament.rounds.length + 1}
              </button>
            )}

            {allRoundsComplete && !isFinished && (
              <button
                onClick={finishTournament}
                className="w-full py-3.5 rounded-xl bg-swu-green text-white font-extrabold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
              >
                <Trophy size={18} /> Finalizar Torneo
              </button>
            )}

            {tournament.rounds.length > 0 && !allRoundsComplete && !canStartNext && !isFinished && (
              <p className="text-xs text-center text-swu-muted">Complete todos los resultados para continuar</p>
            )}
          </div>
        </div>
      )}

      {/* Standings Tab */}
      {tab === 'standings' && (
        <div className="space-y-1">
          {/* Header row */}
          <div className="grid grid-cols-[2rem_1fr_3rem_3rem_3rem] gap-1 px-3 py-2 text-[10px] font-bold text-swu-muted">
            <span>#</span>
            <span>Jugador</span>
            <span className="text-center">Pts</span>
            <span className="text-center">W-L-D</span>
            <span className="text-center">GW%</span>
          </div>

          {standings.map((player, idx) => {
            const gTotal = player.gameWins + player.gameLosses
            const gwPct = gTotal > 0 ? Math.round((player.gameWins / gTotal) * 100) : 0
            const isTop = idx === 0 && tournament.rounds.length > 0

            return (
              <div
                key={player.id}
                className={`grid grid-cols-[2rem_1fr_3rem_3rem_3rem] gap-1 px-3 py-2.5 rounded-lg items-center ${
                  isTop ? 'bg-swu-amber/10 border border-swu-amber/30' : 'bg-swu-surface border border-swu-border'
                }`}
              >
                <span className={`text-sm font-bold ${isTop ? 'text-swu-amber' : 'text-swu-muted'}`}>
                  {idx + 1}
                </span>
                <span className="text-sm font-bold text-swu-text truncate flex items-center gap-1">
                  {isTop && <Trophy size={12} className="text-swu-amber flex-shrink-0" />}
                  {player.name}
                </span>
                <span className="text-sm font-extrabold text-swu-accent text-center font-mono">
                  {player.points}
                </span>
                <span className="text-[10px] text-swu-text text-center font-mono">
                  {player.matchWins}-{player.matchLosses}-{player.matchDraws}
                </span>
                <span className="text-[10px] text-swu-muted text-center font-mono">
                  {gwPct}%
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Result Modal */}
      {resultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-swu-bg rounded-2xl border border-swu-border p-5 w-full max-w-sm space-y-4">
            <h3 className="text-base font-bold text-swu-text text-center">Reportar Resultado</h3>

            <div className="flex items-center justify-between">
              <div className="flex-1 text-center">
                <p className="text-sm font-bold text-swu-accent">
                  {getPlayerName(resultModal.pairing.player1Id)}
                </p>
                <div className="flex items-center justify-center gap-3 mt-2">
                  <button
                    onClick={() => setModalScore(([s1, s2]) => [Math.max(0, s1 - 1), s2])}
                    className="w-10 h-10 rounded-lg bg-swu-red/10 border border-swu-red/30 text-swu-red font-bold text-lg"
                  >
                    −
                  </button>
                  <span className="text-3xl font-extrabold font-mono text-swu-text">{modalScore[0]}</span>
                  <button
                    onClick={() => setModalScore(([s1, s2]) => [Math.min(9, s1 + 1), s2])}
                    className="w-10 h-10 rounded-lg bg-swu-green/10 border border-swu-green/30 text-swu-green font-bold text-lg"
                  >
                    +
                  </button>
                </div>
              </div>

              <span className="text-swu-muted font-bold mx-2">vs</span>

              <div className="flex-1 text-center">
                <p className="text-sm font-bold text-swu-red">
                  {getPlayerName(resultModal.pairing.player2Id)}
                </p>
                <div className="flex items-center justify-center gap-3 mt-2">
                  <button
                    onClick={() => setModalScore(([s1, s2]) => [s1, Math.max(0, s2 - 1)])}
                    className="w-10 h-10 rounded-lg bg-swu-red/10 border border-swu-red/30 text-swu-red font-bold text-lg"
                  >
                    −
                  </button>
                  <span className="text-3xl font-extrabold font-mono text-swu-text">{modalScore[1]}</span>
                  <button
                    onClick={() => setModalScore(([s1, s2]) => [s1, Math.min(9, s2 + 1)])}
                    className="w-10 h-10 rounded-lg bg-swu-green/10 border border-swu-green/30 text-swu-green font-bold text-lg"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {modalScore[0] === 0 && modalScore[1] === 0 && (
              <p className="text-[10px] text-swu-amber text-center">Empate: ambos reciben 1 punto</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setResultModal(null)}
                className="flex-1 py-3 rounded-xl bg-swu-surface border border-swu-border text-swu-text font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={submitResult}
                className="flex-1 py-3 rounded-xl bg-swu-accent text-white font-bold text-sm flex items-center justify-center gap-1"
              >
                <Check size={16} /> Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

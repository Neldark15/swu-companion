import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Play, Check, Trophy, Users, BarChart3,
  AlertCircle, Share2, GitBranch, Link2, Swords,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { EventShareSheet } from './EventShareSheet'
import { db } from '../../services/db'
import {
  generatePairings,
  applyResult,
  isRoundComplete,
  sortStandings,
} from '../../services/swiss'
import {
  generateEliminationPairings,
  generateNextRoundPairings,
  eliminationRounds,
  type BracketPlayer,
} from '../../services/elimination'
import { awardMatchResult, awardTournamentFinish } from '../../services/tournamentPoints'
import { isSupabaseReady } from '../../services/supabase'
import type { Tournament, TournamentPairing, TournamentPlayer } from '../../types'

type TabKey = 'pairings' | 'standings' | 'bracket'

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
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [syncingXp, setSyncingXp] = useState(false)

  const isElimination = tournament?.tournamentType === 'elimination'

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

  // ─── Swiss: start next round ──────────────────────────────
  const startNextSwissRound = async () => {
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

  // ─── Elimination: start next round ────────────────────────
  const startNextEliminationRound = async () => {
    if (!tournament) return

    let pairings: Array<{ player1Id: string | null; player2Id: string | null; isBye: boolean }>

    if (tournament.rounds.length === 0) {
      // First round: seed players by order, generate bracket
      const bracketPlayers: BracketPlayer[] = tournament.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        seed: i + 1,
      }))
      pairings = generateEliminationPairings(bracketPlayers)
    } else {
      // Subsequent rounds: gather winners from previous round
      const prevRound = tournament.rounds[tournament.rounds.length - 1]
      const winnerIds: string[] = []
      for (const p of prevRound.pairings) {
        if (p.result?.winnerId) {
          winnerIds.push(p.result.winnerId)
        } else if (p.player2Id === null && p.player1Id) {
          // BYE auto-advance
          winnerIds.push(p.player1Id)
        }
      }
      pairings = generateNextRoundPairings(winnerIds)
    }

    // Convert to TournamentPairing format + auto-resolve byes
    let updatedPlayers = [...tournament.players]
    const tournamentPairings: TournamentPairing[] = pairings.map((p) => {
      const tp: TournamentPairing = {
        player1Id: p.player1Id || '',
        player2Id: p.player2Id,
        result: null,
      }
      if (p.isBye && p.player1Id) {
        // Auto-win for player with bye
        updatedPlayers = applyResult(updatedPlayers, tp, p.player1Id, [2, 0])
        tp.result = { winnerId: p.player1Id, score: [2, 0] }
      }
      return tp
    })

    const newRound = {
      number: tournament.rounds.length + 1,
      pairings: tournamentPairings,
      completed: tournamentPairings.every(p => p.result !== null),
    }

    const updated: Tournament = {
      ...tournament,
      players: updatedPlayers,
      rounds: [...tournament.rounds, newRound],
    }

    await saveTournament(updated)
  }

  const startNextRound = () => {
    if (isElimination) return startNextEliminationRound()
    return startNextSwissRound()
  }

  const openResultModal = (roundIdx: number, pairingIdx: number, pairing: TournamentPairing) => {
    if (pairing.result || !pairing.player2Id) return
    setModalScore([0, 0])
    setResultModal({ roundIdx, pairingIdx, pairing })
  }

  // ─── Sync XP for linked players ───────────────────────────
  const syncMatchXp = async (
    pairing: TournamentPairing,
    winnerId: string | null,
    score: [number, number],
    players: TournamentPlayer[]
  ) => {
    if (!isSupabaseReady()) return

    const p1 = players.find(p => p.id === pairing.player1Id)
    const p2 = pairing.player2Id ? players.find(p => p.id === pairing.player2Id) : null
    const isDraw = winnerId === null

    // Award XP to player 1 if linked
    if (p1?.supabaseUserId) {
      try {
        await awardMatchResult(
          p1.supabaseUserId,
          winnerId === p1.id,
          isDraw,
          score
        )
      } catch { /* best effort */ }
    }

    // Award XP to player 2 if linked
    if (p2?.supabaseUserId) {
      try {
        await awardMatchResult(
          p2.supabaseUserId,
          winnerId === p2.id,
          isDraw,
          [score[1], score[0]] // reverse score for p2 perspective
        )
      } catch { /* best effort */ }
    }
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

    // Sync XP in background for linked players
    syncMatchXp(pairing, winnerId, modalScore, tournament.players)
  }

  const finishTournament = async () => {
    if (!tournament) return
    if (!confirm('¿Finalizar torneo? No se podrán agregar más rondas.')) return

    setSyncingXp(true)
    await saveTournament({ ...tournament, status: 'finished' })

    // Award tournament finish XP to all linked players
    if (isSupabaseReady()) {
      const standings = sortStandings(tournament.players, tournament.players)
      for (let i = 0; i < standings.length; i++) {
        const player = standings[i]
        if (player.supabaseUserId) {
          try {
            await awardTournamentFinish(
              player.supabaseUserId,
              i + 1, // position (1-indexed)
              standings.length,
              tournament.name,
              player.matchWins,
              player.matchDraws
            )
          } catch { /* best effort */ }
        }
      }
    }
    setSyncingXp(false)
  }

  const getPlayerName = (playerId: string | null): string => {
    if (!playerId || !tournament) return 'BYE'
    return tournament.players.find((p) => p.id === playerId)?.name ?? '?'
  }

  const getPlayerLinked = (playerId: string | null): boolean => {
    if (!playerId || !tournament) return false
    return !!tournament.players.find((p) => p.id === playerId)?.supabaseUserId
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
  const isFinished = tournament.status === 'finished'

  // ─── Determine if next round can start ────────────────────
  let canStartNext = false
  let allRoundsComplete = false

  if (isElimination) {
    // Elimination: can start next if current round is complete and not final
    const totalElimRounds = eliminationRounds(tournament.players.length)
    const roundsDone = tournament.rounds.length
    const currentComplete = roundsDone === 0 || currentRound?.completed
    canStartNext = tournament.status === 'active' && !!currentComplete && roundsDone < totalElimRounds
    allRoundsComplete = roundsDone >= totalElimRounds && (currentRound?.completed ?? true)
  } else {
    // Swiss
    canStartNext =
      tournament.status === 'active' &&
      (tournament.rounds.length === 0 || currentRound?.completed) &&
      tournament.rounds.length < tournament.maxRounds
    allRoundsComplete =
      tournament.rounds.length >= tournament.maxRounds && (currentRound?.completed ?? true)
  }

  const standings = sortStandings(tournament.players, tournament.players)

  // Count linked players
  const linkedCount = tournament.players.filter(p => p.supabaseUserId).length

  // ─── Tab list ─────────────────────────────────────────────
  const tabs: Array<{ key: TabKey; label: string; icon: typeof Users }> = [
    { key: 'pairings', label: 'Emparejamientos', icon: Users },
    { key: 'standings', label: 'Standings', icon: BarChart3 },
  ]
  if (isElimination) {
    tabs.push({ key: 'bracket', label: 'Bracket', icon: GitBranch })
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-8 max-w-5xl mx-auto">
      <button onClick={() => navigate('/events')} className="flex items-center gap-1 text-sm text-swu-muted">
        <ChevronLeft size={18} /> Eventos
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-swu-text">{tournament.name}</h2>
          <p className="text-xs text-swu-muted">
            {tournament.format.toUpperCase()} · {tournament.matchType.toUpperCase()} · {tournament.players.length} jugadores
            {isElimination && ' · Eliminación'}
          </p>
          {linkedCount > 0 && (
            <p className="text-[10px] text-swu-green flex items-center gap-1 mt-0.5">
              <Link2 size={10} /> {linkedCount} cuenta{linkedCount !== 1 ? 's' : ''} vinculada{linkedCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isFinished && (
            <button
              onClick={() => setShowShareSheet(true)}
              className="w-9 h-9 rounded-lg bg-swu-accent/10 flex items-center justify-center active:bg-swu-accent/20 transition-colors"
              title="Compartir evento"
            >
              <Share2 size={16} className="text-swu-accent" />
            </button>
          )}
          {isFinished ? (
            <Badge variant="default">FINALIZADO</Badge>
          ) : (
            <Badge variant="green">ACTIVO</Badge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-swu-surface rounded-xl border border-swu-border overflow-hidden">
        {tabs.map((t) => {
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
              <p className="text-sm text-swu-muted">
                Torneo listo. Inicie la primera ronda.
              </p>
            </div>
          ) : (
            [...tournament.rounds].reverse().map((round, revIdx) => {
              const roundIdx = tournament.rounds.length - 1 - revIdx
              const roundLabel = isElimination
                ? getRoundLabel(round.number, eliminationRounds(tournament.players.length))
                : `Ronda ${round.number}`

              return (
                <div key={round.number}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-swu-text">{roundLabel}</h3>
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
                              <p className={`text-sm font-bold flex items-center gap-1 ${pairing.result?.winnerId === pairing.player1Id ? 'text-swu-green' : 'text-swu-text'}`}>
                                {getPlayerLinked(pairing.player1Id) && <Link2 size={10} className="text-swu-green flex-shrink-0" />}
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
                              <p className={`text-sm font-bold flex items-center justify-end gap-1 ${pairing.result?.winnerId === pairing.player2Id ? 'text-swu-green' : isBye ? 'text-swu-muted' : 'text-swu-text'}`}>
                                {isBye ? 'BYE' : getPlayerName(pairing.player2Id)}
                                {getPlayerLinked(pairing.player2Id) && <Link2 size={10} className="text-swu-green flex-shrink-0" />}
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
                <Play size={18} />
                {tournament.rounds.length === 0
                  ? 'Iniciar Ronda 1'
                  : isElimination
                    ? `Siguiente Ronda`
                    : `Iniciar Ronda ${tournament.rounds.length + 1}`
                }
              </button>
            )}

            {allRoundsComplete && !isFinished && (
              <button
                onClick={finishTournament}
                disabled={syncingXp}
                className="w-full py-3.5 rounded-xl bg-swu-green text-white font-extrabold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-60"
              >
                {syncingXp ? (
                  <>Sincronizando puntos...</>
                ) : (
                  <><Trophy size={18} /> Finalizar Torneo</>
                )}
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
            const isLinked = !!player.supabaseUserId

            // For elimination, check if player was eliminated
            const isEliminatedPlayer = isElimination && tournament.rounds.length > 0 && isPlayerEliminated(tournament, player.id)

            return (
              <div
                key={player.id}
                className={`grid grid-cols-[2rem_1fr_3rem_3rem_3rem] gap-1 px-3 py-2.5 rounded-lg items-center ${
                  isEliminatedPlayer ? 'opacity-40' :
                  isTop ? 'bg-swu-amber/10 border border-swu-amber/30' : 'bg-swu-surface border border-swu-border'
                }`}
              >
                <span className={`text-sm font-bold ${isTop ? 'text-swu-amber' : 'text-swu-muted'}`}>
                  {idx + 1}
                </span>
                <span className="text-sm font-bold text-swu-text truncate flex items-center gap-1">
                  {isTop && <Trophy size={12} className="text-swu-amber flex-shrink-0" />}
                  {isLinked && <Link2 size={10} className="text-swu-green flex-shrink-0" />}
                  {player.name}
                  {isEliminatedPlayer && <span className="text-[9px] text-swu-red ml-1">ELIMINADO</span>}
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

      {/* Bracket Tab (Elimination only) */}
      {tab === 'bracket' && isElimination && (
        <div className="space-y-4">
          {tournament.rounds.length === 0 ? (
            <div className="text-center py-8">
              <GitBranch size={40} className="mx-auto text-swu-accent/40 mb-3" />
              <p className="text-sm text-swu-muted">El bracket se generará al iniciar la primera ronda.</p>
            </div>
          ) : (
            tournament.rounds.map((round) => {
              const totalElimRnds = eliminationRounds(tournament.players.length)
              const label = getRoundLabel(round.number, totalElimRnds)
              return (
                <div key={round.number} className="space-y-2">
                  <h3 className="text-xs font-bold text-swu-accent uppercase tracking-wider">{label}</h3>
                  {round.pairings.map((p, pi) => {
                    const isBye = !p.player2Id
                    const p1Won = p.result?.winnerId === p.player1Id
                    const p2Won = p.result?.winnerId === p.player2Id

                    return (
                      <div key={pi} className="bg-swu-surface rounded-lg border border-swu-border overflow-hidden">
                        <div className={`flex items-center justify-between px-3 py-2 border-b border-swu-border/30 ${p1Won ? 'bg-swu-green/10' : ''}`}>
                          <span className={`text-sm font-bold truncate ${p1Won ? 'text-swu-green' : 'text-swu-text'}`}>
                            {p1Won && <Swords size={10} className="inline mr-1" />}
                            {getPlayerName(p.player1Id)}
                          </span>
                          <span className="text-xs font-mono text-swu-muted ml-2">
                            {p.result ? p.result.score[0] : ''}
                          </span>
                        </div>
                        <div className={`flex items-center justify-between px-3 py-2 ${p2Won ? 'bg-swu-green/10' : ''}`}>
                          <span className={`text-sm font-bold truncate ${p2Won ? 'text-swu-green' : isBye ? 'text-swu-muted italic' : 'text-swu-text'}`}>
                            {p2Won && <Swords size={10} className="inline mr-1" />}
                            {isBye ? 'BYE' : getPlayerName(p.player2Id)}
                          </span>
                          <span className="text-xs font-mono text-swu-muted ml-2">
                            {p.result && !isBye ? p.result.score[1] : ''}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Share Sheet */}
      {showShareSheet && tournament && (
        <EventShareSheet
          eventCode={tournament.eventCode || tournament.id.slice(0, 8).toUpperCase()}
          eventName={tournament.name}
          onClose={() => setShowShareSheet(false)}
        />
      )}

      {/* Result Modal */}
      {resultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-swu-bg rounded-2xl border border-swu-border p-5 w-full max-w-sm space-y-4">
            <h3 className="text-base font-bold text-swu-text text-center">Reportar Resultado</h3>

            <div className="flex items-center justify-between">
              <div className="flex-1 text-center">
                <p className="text-sm font-bold text-swu-accent flex items-center justify-center gap-1">
                  {getPlayerLinked(resultModal.pairing.player1Id) && <Link2 size={10} className="text-swu-green" />}
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
                <p className="text-sm font-bold text-swu-red flex items-center justify-center gap-1">
                  {getPlayerName(resultModal.pairing.player2Id)}
                  {getPlayerLinked(resultModal.pairing.player2Id) && <Link2 size={10} className="text-swu-green" />}
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

// ─── Helper: Round label for elimination ─────────────────────
function getRoundLabel(roundNumber: number, totalRounds: number): string {
  const remaining = totalRounds - roundNumber + 1
  if (remaining === 0) return 'Final'
  if (remaining === 1) return 'Final'
  if (remaining === 2) return 'Semifinal'
  if (remaining === 3) return 'Cuartos de Final'
  return `Ronda ${roundNumber}`
}

// ─── Helper: Check if player was eliminated ──────────────────
function isPlayerEliminated(tournament: Tournament, playerId: string): boolean {
  for (const round of tournament.rounds) {
    for (const pairing of round.pairings) {
      if (pairing.result && pairing.result.winnerId !== null) {
        // This match has a result — if the player was in it and lost, they're eliminated
        const wasInMatch = pairing.player1Id === playerId || pairing.player2Id === playerId
        const lost = wasInMatch && pairing.result.winnerId !== playerId
        if (lost) return true
      }
    }
  }
  return false
}

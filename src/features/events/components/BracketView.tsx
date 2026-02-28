/**
 * BracketView — Single elimination bracket visualization
 */

import type { CloudPairing, CloudRound } from '../../../services/tournamentCloud'

interface Props {
  rounds: CloudRound[]
  pairingsByRound: Map<number, CloudPairing[]>
  playerNames: Map<string, string>
}

export function BracketView({ rounds, pairingsByRound, playerNames }: Props) {
  if (rounds.length === 0) {
    return (
      <div className="text-center text-swu-muted py-8">
        No hay bracket disponible
      </div>
    )
  }

  const getName = (id: string | null) => {
    if (!id) return 'TBD'
    return playerNames.get(id) || 'Jugador'
  }

  const getRoundLabel = (roundNum: number, totalRounds: number) => {
    const remaining = totalRounds - roundNum
    if (remaining === 0) return 'Final'
    if (remaining === 1) return 'Semifinal'
    if (remaining === 2) return 'Cuartos'
    return `Ronda ${roundNum}`
  }

  const totalRounds = rounds.length > 0
    ? Math.max(...rounds.map(r => r.round_number))
    : 0

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {rounds.map((round) => {
          const pairings = pairingsByRound.get(round.round_number) || []
          return (
            <div key={round.id} className="flex flex-col gap-2 min-w-[160px]">
              {/* Round header */}
              <div className="text-center text-xs text-swu-accent font-bold uppercase tracking-wider mb-1">
                {getRoundLabel(round.round_number, totalRounds)}
              </div>

              {/* Matches */}
              <div className="flex flex-col justify-around flex-1 gap-3">
                {pairings.map((p) => (
                  <BracketMatch
                    key={p.id}
                    pairing={p}
                    getName={getName}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BracketMatch({
  pairing,
  getName,
}: {
  pairing: CloudPairing
  getName: (id: string | null) => string
}) {
  const hasResult = !!pairing.winner_id
  const isBye = pairing.score === 'BYE'

  return (
    <div className="border border-swu-border rounded-lg overflow-hidden bg-swu-surface">
      {/* Player 1 */}
      <div
        className={`px-3 py-2 text-xs border-b border-swu-border/50 flex justify-between items-center ${
          hasResult && pairing.winner_id === pairing.player1_id
            ? 'bg-green-500/10 text-green-400 font-bold'
            : 'text-swu-text'
        }`}
      >
        <span className="truncate max-w-[100px]">{getName(pairing.player1_id)}</span>
        {hasResult && pairing.score && !isBye && (
          <span className="text-swu-muted ml-1">{pairing.score.split('-')[0]}</span>
        )}
      </div>

      {/* Player 2 */}
      <div
        className={`px-3 py-2 text-xs flex justify-between items-center ${
          hasResult && pairing.winner_id === pairing.player2_id
            ? 'bg-green-500/10 text-green-400 font-bold'
            : isBye
            ? 'text-swu-muted italic'
            : 'text-swu-text'
        }`}
      >
        <span className="truncate max-w-[100px]">
          {isBye ? 'BYE' : getName(pairing.player2_id)}
        </span>
        {hasResult && pairing.score && !isBye && (
          <span className="text-swu-muted ml-1">{pairing.score.split('-')[1]}</span>
        )}
      </div>
    </div>
  )
}

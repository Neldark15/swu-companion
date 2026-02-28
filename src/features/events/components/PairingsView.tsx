/**
 * PairingsView — Round pairings with optional result reporting
 */

import { useState } from 'react'
import type { CloudPairing } from '../../../services/tournamentCloud'

interface Props {
  pairings: CloudPairing[]
  canReport?: boolean
  onReport?: (pairingId: string, winnerId: string | null, score: string) => void
  currentUserId?: string
}

export function PairingsView({ pairings, canReport, onReport, currentUserId }: Props) {
  if (pairings.length === 0) {
    return (
      <div className="text-center text-swu-muted py-8">
        No hay emparejamientos
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {pairings.map((p) => (
        <PairingCard
          key={p.id}
          pairing={p}
          canReport={canReport && !p.winner_id}
          onReport={onReport}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  )
}

function PairingCard({
  pairing,
  canReport,
  onReport,
  currentUserId,
}: {
  pairing: CloudPairing
  canReport?: boolean
  onReport?: (pairingId: string, winnerId: string | null, score: string) => void
  currentUserId?: string
}) {
  const [reporting, setReporting] = useState(false)
  const [score1, setScore1] = useState(0)
  const [score2, setScore2] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const isBye = !pairing.player2_id
  const isMyMatch =
    currentUserId === pairing.player1_id || currentUserId === pairing.player2_id
  const hasResult = !!pairing.winner_id || !!pairing.score

  const handleSubmit = async (winnerId: string | null) => {
    if (!onReport) return
    setSubmitting(true)
    const score = `${score1}-${score2}`
    await onReport(pairing.id, winnerId, score)
    setSubmitting(false)
    setReporting(false)
  }

  return (
    <div
      className={`bg-swu-surface border rounded-lg p-3 ${
        isMyMatch ? 'border-swu-accent/50' : 'border-swu-border'
      } ${hasResult ? 'opacity-80' : ''}`}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-swu-muted">
          Mesa {pairing.table_number || '—'}
        </span>
        {hasResult && (
          <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
            {pairing.score || 'Completado'}
          </span>
        )}
        {isBye && (
          <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full">
            BYE
          </span>
        )}
      </div>

      {/* Players */}
      <div className="flex items-center justify-between gap-2">
        <div
          className={`flex-1 text-center py-1.5 rounded ${
            pairing.winner_id === pairing.player1_id
              ? 'bg-green-500/10 text-green-400 font-bold'
              : 'text-swu-text'
          }`}
        >
          <span className="text-sm truncate block">
            {pairing.player1_name || 'TBD'}
          </span>
        </div>

        <span className="text-swu-muted text-xs font-bold px-2">VS</span>

        <div
          className={`flex-1 text-center py-1.5 rounded ${
            pairing.winner_id === pairing.player2_id
              ? 'bg-green-500/10 text-green-400 font-bold'
              : 'text-swu-text'
          }`}
        >
          <span className="text-sm truncate block">
            {isBye ? 'BYE' : pairing.player2_name || 'TBD'}
          </span>
        </div>
      </div>

      {/* Report UI */}
      {canReport && (isMyMatch || !currentUserId) && !reporting && (
        <button
          onClick={() => setReporting(true)}
          className="mt-2 w-full text-xs py-1.5 bg-swu-accent/20 text-swu-accent rounded hover:bg-swu-accent/30 transition-colors"
        >
          Reportar Resultado
        </button>
      )}

      {reporting && (
        <div className="mt-3 space-y-2">
          {/* Score inputs */}
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-swu-muted truncate max-w-[60px]">
                {pairing.player1_name?.split(' ')[0]}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setScore1(Math.max(0, score1 - 1))}
                  className="w-7 h-7 rounded bg-swu-bg text-swu-text text-sm"
                >
                  -
                </button>
                <span className="w-6 text-center font-bold text-swu-accent">{score1}</span>
                <button
                  onClick={() => setScore1(Math.min(3, score1 + 1))}
                  className="w-7 h-7 rounded bg-swu-bg text-swu-text text-sm"
                >
                  +
                </button>
              </div>
            </div>

            <span className="text-swu-muted text-xs">—</span>

            <div className="flex items-center gap-1">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setScore2(Math.max(0, score2 - 1))}
                  className="w-7 h-7 rounded bg-swu-bg text-swu-text text-sm"
                >
                  -
                </button>
                <span className="w-6 text-center font-bold text-swu-accent">{score2}</span>
                <button
                  onClick={() => setScore2(Math.min(3, score2 + 1))}
                  className="w-7 h-7 rounded bg-swu-bg text-swu-text text-sm"
                >
                  +
                </button>
              </div>
              <span className="text-xs text-swu-muted truncate max-w-[60px]">
                {pairing.player2_name?.split(' ')[0]}
              </span>
            </div>
          </div>

          {/* Winner buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => handleSubmit(pairing.player1_id)}
              disabled={submitting}
              className="flex-1 text-xs py-1.5 bg-green-600/20 text-green-400 rounded hover:bg-green-600/30 disabled:opacity-50"
            >
              Gana {pairing.player1_name?.split(' ')[0]}
            </button>
            <button
              onClick={() => handleSubmit(null)}
              disabled={submitting}
              className="px-3 text-xs py-1.5 bg-yellow-600/20 text-yellow-400 rounded hover:bg-yellow-600/30 disabled:opacity-50"
            >
              Empate
            </button>
            <button
              onClick={() => handleSubmit(pairing.player2_id)}
              disabled={submitting}
              className="flex-1 text-xs py-1.5 bg-green-600/20 text-green-400 rounded hover:bg-green-600/30 disabled:opacity-50"
            >
              Gana {pairing.player2_name?.split(' ')[0]}
            </button>
          </div>

          <button
            onClick={() => setReporting(false)}
            className="w-full text-xs py-1 text-swu-muted"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * StandingsTable — Tournament standings with tiebreakers
 */

import type { CloudStanding } from '../../../services/tournamentCloud'

interface Props {
  standings: CloudStanding[]
  highlightUserId?: string
  compact?: boolean
}

export function StandingsTable({ standings, highlightUserId, compact }: Props) {
  if (standings.length === 0) {
    return (
      <div className="text-center text-swu-muted py-8">
        No hay standings disponibles
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-swu-muted text-xs border-b border-swu-border">
            <th className="py-2 px-2 text-left">#</th>
            <th className="py-2 px-2 text-left">Jugador</th>
            <th className="py-2 px-2 text-center">Pts</th>
            <th className="py-2 px-2 text-center">W-L-D</th>
            {!compact && (
              <>
                <th className="py-2 px-2 text-center">GW%</th>
                <th className="py-2 px-2 text-center">OMW%</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {standings.map((s, idx) => {
            const isHighlighted = s.user_id === highlightUserId
            const isDropped = s.dropped
            return (
              <tr
                key={s.user_id}
                className={`border-b border-swu-border/30 transition-colors ${
                  isHighlighted ? 'bg-swu-accent/10' : ''
                } ${isDropped ? 'opacity-40' : ''}`}
              >
                <td className="py-2 px-2 text-swu-muted font-mono">{idx + 1}</td>
                <td className="py-2 px-2 font-medium text-swu-text truncate max-w-[140px]">
                  {s.player_name}
                  {isDropped && <span className="ml-1 text-red-400 text-xs">(DROP)</span>}
                </td>
                <td className="py-2 px-2 text-center font-bold text-swu-accent">{s.points}</td>
                <td className="py-2 px-2 text-center text-swu-text">
                  {s.match_wins}-{s.match_losses}-{s.match_draws}
                </td>
                {!compact && (
                  <>
                    <td className="py-2 px-2 text-center text-swu-muted">
                      {(s.gw_pct * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 px-2 text-center text-swu-muted">
                      {(s.omw_pct * 100).toFixed(0)}%
                    </td>
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Trash2, Play, Swords, Users, Settings2, Trophy } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { useMatchPersistence } from '../../hooks/useMatchPersistence'
import type { MatchState } from '../../types'

const modeIcons: Record<string, typeof Swords> = {
  premier: Swords,
  twin_suns: Users,
  custom: Settings2,
}

const modeLabels: Record<string, string> = {
  premier: 'Premier',
  twin_suns: 'Twin Suns',
  custom: 'Custom',
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `Hace ${days}d`
}

export function SavedMatchesPage() {
  const navigate = useNavigate()
  const { getSavedMatches, deleteMatch } = useMatchPersistence(null)
  const [matches, setMatches] = useState<MatchState[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'finished'>('all')

  useEffect(() => {
    getSavedMatches().then((m) => {
      setMatches(m)
      setLoading(false)
    })
  }, [getSavedMatches])

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar esta partida?')) {
      await deleteMatch(id)
      setMatches((prev) => prev.filter((m) => m.id !== id))
    }
  }

  const handleResume = (match: MatchState) => {
    navigate(`/play/tracker/${match.mode}?resume=${match.id}`)
  }

  const filtered = matches.filter((m) => {
    if (filter === 'active') return m.isActive
    if (filter === 'finished') return !m.isActive
    return true
  })

  const activeCount = matches.filter((m) => m.isActive).length
  const finishedCount = matches.filter((m) => !m.isActive).length

  return (
    <div className="p-4 space-y-4">
      <button onClick={() => navigate('/play')} className="flex items-center gap-1 text-sm text-swu-muted">
        <ChevronLeft size={18} /> Modos
      </button>

      <h2 className="text-lg font-bold text-swu-text">Partidas Guardadas</h2>

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { key: 'all' as const, label: 'Todas', count: matches.length },
          { key: 'active' as const, label: 'En curso', count: activeCount },
          { key: 'finished' as const, label: 'Terminadas', count: finishedCount },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              filter === f.key ? 'bg-swu-accent text-white' : 'bg-swu-surface text-swu-muted border border-swu-border'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-pulse text-swu-muted">Cargando...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-swu-muted gap-2">
          <Swords size={32} className="opacity-40" />
          <p className="text-sm">No hay partidas guardadas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((match) => {
            const Icon = modeIcons[match.mode] || Swords
            const p1 = match.players[0]
            const p2 = match.players[1]
            const [s1, s2] = match.gameScore.finalScore

            return (
              <div
                key={match.id}
                className="bg-swu-surface rounded-xl border border-swu-border p-3 space-y-2"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className="text-swu-accent" />
                    <span className="text-xs font-bold text-swu-text">{modeLabels[match.mode]}</span>
                    {match.isActive ? (
                      <Badge variant="green">En curso</Badge>
                    ) : (
                      <Badge variant="default">Terminada</Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-swu-muted">{timeAgo(match.updatedAt)}</span>
                </div>

                {/* Score */}
                <div className="flex items-center justify-between bg-swu-bg rounded-lg px-3 py-2">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-swu-text">{p1?.name || 'P1'}</p>
                    {match.isActive && <p className="text-[10px] text-swu-muted">HP: {p1?.baseHp}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-extrabold text-swu-accent font-mono">{s1}</span>
                    <span className="text-swu-muted text-xs">—</span>
                    <span className="text-lg font-extrabold text-swu-red font-mono">{s2}</span>
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-xs font-bold text-swu-text">{p2?.name || 'P2'}</p>
                    {match.isActive && <p className="text-[10px] text-swu-muted">HP: {p2?.baseHp}</p>}
                  </div>
                </div>

                {/* Winner (if finished) */}
                {!match.isActive && (
                  <div className="flex items-center gap-1.5 justify-center">
                    <Trophy size={12} className="text-swu-amber" />
                    <span className="text-xs font-bold text-swu-amber">
                      {s1 >= 2 ? p1?.name : p2?.name}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {match.isActive && (
                    <button
                      onClick={() => handleResume(match)}
                      className="flex-1 py-2 rounded-lg bg-swu-accent/20 border border-swu-accent/40 text-swu-accent text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform"
                    >
                      <Play size={14} /> Reanudar
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(match.id)}
                    className="py-2 px-4 rounded-lg bg-swu-red/10 border border-swu-red/30 text-swu-red text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

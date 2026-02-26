import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, Trophy, Trash2 } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { db } from '../../services/db'
import type { Tournament } from '../../types'

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

export function TournamentListPage() {
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.tournaments
      .orderBy('updatedAt')
      .reverse()
      .toArray()
      .then((t) => {
        setTournaments(t)
        setLoading(false)
      })
  }, [])

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar este torneo?')) {
      await db.tournaments.delete(id)
      setTournaments((prev) => prev.filter((t) => t.id !== id))
    }
  }

  return (
    <div className="p-4 space-y-4">
      <button onClick={() => navigate('/events')} className="flex items-center gap-1 text-sm text-swu-muted">
        <ChevronLeft size={18} /> Eventos
      </button>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-swu-text">Torneos Caseros</h2>
        <button
          onClick={() => navigate('/events/tournament/new')}
          className="p-2 rounded-lg bg-swu-amber/10 border border-swu-amber/30 text-swu-amber"
        >
          <Plus size={18} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-pulse text-swu-muted">Cargando...</div>
        </div>
      ) : tournaments.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-swu-muted gap-3">
          <Trophy size={36} className="opacity-40" />
          <p className="text-sm">No hay torneos aún</p>
          <button
            onClick={() => navigate('/events/tournament/new')}
            className="px-4 py-2 rounded-xl bg-swu-amber text-black font-bold text-sm"
          >
            Crear Primer Torneo
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {tournaments.map((t) => {
            const roundsPlayed = t.rounds.length
            return (
              <div
                key={t.id}
                className="bg-swu-surface rounded-xl border border-swu-border p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy size={16} className="text-swu-amber" />
                    <span className="text-sm font-bold text-swu-text">{t.name}</span>
                  </div>
                  {t.status === 'active' ? (
                    <Badge variant="green">Activo</Badge>
                  ) : (
                    <Badge variant="default">Finalizado</Badge>
                  )}
                </div>

                <p className="text-[10px] text-swu-muted">
                  {t.format.toUpperCase()} · {t.players.length} jugadores · Ronda {roundsPlayed}/{t.maxRounds} · {timeAgo(t.updatedAt)}
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/events/tournament/${t.id}`)}
                    className="flex-1 py-2 rounded-lg bg-swu-accent/20 border border-swu-accent/40 text-swu-accent text-xs font-bold active:scale-95 transition-transform"
                  >
                    {t.status === 'active' ? 'Continuar' : 'Ver Resultados'}
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="py-2 px-4 rounded-lg bg-swu-red/10 border border-swu-red/30 text-swu-red text-xs font-bold active:scale-95 transition-transform"
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

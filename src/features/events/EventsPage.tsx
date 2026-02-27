import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { QrCode, Trophy, Calendar, Swords } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { db } from '../../services/db'
import type { Tournament } from '../../types'

export function EventsPage() {
  const navigate = useNavigate()
  const [recentTournaments, setRecentTournaments] = useState<Tournament[]>([])

  useEffect(() => {
    db.tournaments
      .orderBy('createdAt')
      .reverse()
      .limit(10)
      .toArray()
      .then(setRecentTournaments)
      .catch(() => {})
  }, [])

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString('es-SV', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="p-4 space-y-5">
      <h2 className="text-lg font-bold text-swu-text">Eventos</h2>

      <div className="flex gap-3">
        <button
          onClick={() => navigate('/events/join')}
          className="flex-1 bg-swu-accent/10 border-2 border-swu-accent/30 rounded-2xl p-5 text-center active:scale-[0.97] transition-transform"
        >
          <QrCode size={28} className="mx-auto text-swu-accent mb-2" />
          <p className="font-bold text-swu-accent">Unirse a Evento</p>
          <p className="text-[11px] text-swu-muted mt-1">Código o QR</p>
        </button>
        <button
          onClick={() => navigate('/events/tournament/new')}
          className="flex-1 bg-swu-amber/10 border-2 border-swu-amber/30 rounded-2xl p-5 text-center active:scale-[0.97] transition-transform"
        >
          <Trophy size={28} className="mx-auto text-swu-amber mb-2" />
          <p className="font-bold text-swu-amber">Torneo Casero</p>
          <p className="text-[11px] text-swu-muted mt-1">Swiss offline</p>
        </button>
      </div>

      <div>
        <h3 className="text-sm font-bold text-swu-text mb-3">Torneos Recientes</h3>
        {recentTournaments.length === 0 ? (
          <div className="bg-swu-surface rounded-2xl border border-swu-border p-8 text-center space-y-2">
            <Swords size={32} className="mx-auto text-swu-muted/30" />
            <p className="text-sm text-swu-muted">No hay torneos registrados aún</p>
            <p className="text-xs text-swu-muted/70">Cree un torneo casero o únase a un evento para comenzar</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTournaments.map((t) => (
              <div key={t.id} className="bg-swu-surface rounded-xl p-3 border border-swu-border">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-swu-text">{t.name}</span>
                  <Badge variant={t.status === 'finished' ? 'green' : t.status === 'active' ? 'accent' : 'default'}>
                    {t.status === 'finished' ? 'Finalizado' : t.status === 'active' ? 'Activo' : 'Pendiente'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-swu-muted mt-1">
                  <Calendar size={12} />
                  <span>{formatDate(t.createdAt)}</span>
                  <span>·</span>
                  <span>{t.players.length} jugadores</span>
                  <span>·</span>
                  <span>Ronda {t.rounds.length}/{t.maxRounds}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

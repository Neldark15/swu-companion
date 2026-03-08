import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, ExternalLink, Trash2, Edit3, Trophy, Calendar,
  MapPin, Users, Swords, Bookmark,
} from 'lucide-react'
import {
  getMeleeTournament,
  deleteMeleeTournament,
  buildMeleeUrl,
  FORMAT_LABELS,
} from '../../services/meleeService'
import type { MeleeTournament } from '../../types'

export function MeleeDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [tournament, setTournament] = useState<MeleeTournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!id) return
    getMeleeTournament(id).then(t => {
      setTournament(t ?? null)
      setLoading(false)
    })
  }, [id])

  const handleDelete = useCallback(async () => {
    if (!id) return
    await deleteMeleeTournament(id)
    navigate('/melee', { replace: true })
  }, [id, navigate])

  const standingLabel = (s?: number) => {
    if (s == null) return '—'
    if (s === 1) return '🥇 1°'
    if (s === 2) return '🥈 2°'
    if (s === 3) return '🥉 3°'
    return `${s}°`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-swu-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-swu-accent border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-swu-bg flex items-center justify-center text-swu-muted">
        Torneo no encontrado
      </div>
    )
  }

  const t = tournament
  const winrate = t.wins + t.losses > 0
    ? Math.round((t.wins / (t.wins + t.losses)) * 100)
    : 0

  return (
    <div className="min-h-screen bg-swu-bg pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-swu-bg/95 backdrop-blur border-b border-swu-border">
        <div className="max-w-lg lg:max-w-3xl mx-auto px-4 lg:px-6 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/melee')} className="text-swu-muted">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold text-swu-text flex-1 truncate">{t.name}</h1>
          {t.meleeUrl && (
            <a
              href={t.meleeId ? buildMeleeUrl(t.meleeId) : t.meleeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-swu-amber p-2"
            >
              <ExternalLink size={18} />
            </a>
          )}
        </div>
      </div>

      <div className="max-w-lg lg:max-w-3xl mx-auto px-4 lg:px-6 py-4 space-y-4">
        {/* Standing Hero */}
        <div className={`rounded-xl p-6 text-center border ${
          t.standing === 1
            ? 'bg-gradient-to-b from-swu-amber/15 to-swu-surface border-swu-amber/30'
            : t.standing != null && t.standing <= 4
              ? 'bg-gradient-to-b from-swu-accent/15 to-swu-surface border-swu-accent/30'
              : 'bg-swu-surface border-swu-border'
        }`}>
          <div className={`text-4xl font-extrabold mb-1 ${
            t.standing === 1 ? 'text-swu-amber' : 'text-swu-text'
          }`}>
            {standingLabel(t.standing)}
          </div>
          <div className="text-xs text-swu-muted">
            {t.playerCount ? `de ${t.playerCount} jugadores` : 'Posición final'}
          </div>

          {/* Record bar */}
          <div className="mt-4 flex items-center justify-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-swu-green">{t.wins}</div>
              <div className="text-[10px] text-swu-muted">Victorias</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">{t.losses}</div>
              <div className="text-[10px] text-swu-muted">Derrotas</div>
            </div>
            {t.draws > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-swu-muted">{t.draws}</div>
                <div className="text-[10px] text-swu-muted">Empates</div>
              </div>
            )}
            <div className="text-center">
              <div className="text-2xl font-bold text-swu-accent">{winrate}%</div>
              <div className="text-[10px] text-swu-muted">Winrate</div>
            </div>
          </div>
        </div>

        {/* Event Details */}
        <div className="bg-swu-surface rounded-xl border border-swu-border p-4 space-y-3">
          <div className="text-xs text-swu-muted font-mono tracking-wider">DETALLES DEL EVENTO</div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Calendar size={14} className="text-swu-muted flex-shrink-0" />
              <span className="text-sm text-swu-text">{t.date}</span>
            </div>

            <div className="flex items-center gap-3">
              <Trophy size={14} className="text-swu-muted flex-shrink-0" />
              <span className="text-sm text-swu-text">
                {FORMAT_LABELS[t.format] || t.format}
              </span>
            </div>

            {t.location && (
              <div className="flex items-center gap-3">
                <MapPin size={14} className="text-swu-muted flex-shrink-0" />
                <span className="text-sm text-swu-text">{t.location}</span>
              </div>
            )}

            {t.organizer && (
              <div className="flex items-center gap-3">
                <Users size={14} className="text-swu-muted flex-shrink-0" />
                <span className="text-sm text-swu-text">{t.organizer}</span>
              </div>
            )}

            {t.playerCount && (
              <div className="flex items-center gap-3">
                <Users size={14} className="text-swu-muted flex-shrink-0" />
                <span className="text-sm text-swu-text">{t.playerCount} jugadores</span>
              </div>
            )}

            {t.meleeUrl && (
              <a
                href={t.meleeId ? buildMeleeUrl(t.meleeId) : t.meleeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-swu-amber hover:underline"
              >
                <ExternalLink size={14} />
                Ver en Melee.gg
              </a>
            )}
          </div>

          {/* Tags */}
          {t.tags && t.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {t.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full bg-swu-amber/15 text-swu-amber text-[10px] font-medium flex items-center gap-1"
                >
                  <Bookmark size={10} /> {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Deck */}
        {(t.deckName || t.deckLeader || t.deckBase) && (
          <div className="bg-swu-surface rounded-xl border border-swu-border p-4 space-y-2">
            <div className="text-xs text-swu-muted font-mono tracking-wider flex items-center gap-2">
              <Swords size={12} /> DECK UTILIZADO
            </div>
            {t.deckName && (
              <div className="text-sm font-bold text-swu-text">{t.deckName}</div>
            )}
            <div className="flex gap-4 text-xs text-swu-muted">
              {t.deckLeader && <span>Líder: <span className="text-swu-text">{t.deckLeader}</span></span>}
              {t.deckBase && <span>Base: <span className="text-swu-text">{t.deckBase}</span></span>}
            </div>
          </div>
        )}

        {/* Notes */}
        {t.notes && (
          <div className="bg-swu-surface rounded-xl border border-swu-border p-4">
            <div className="text-xs text-swu-muted font-mono tracking-wider mb-2">NOTAS</div>
            <p className="text-sm text-swu-text whitespace-pre-wrap">{t.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/melee/edit/${t.id}`)}
            className="flex-1 py-2.5 rounded-xl text-xs font-medium border border-swu-border
                       bg-swu-surface text-swu-muted flex items-center justify-center gap-1.5"
          >
            <Edit3 size={14} /> Editar
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="py-2.5 px-4 rounded-xl text-xs font-medium border border-red-500/30
                         bg-red-500/10 text-red-400 flex items-center gap-1.5"
            >
              <Trash2 size={14} />
            </button>
          ) : (
            <button
              onClick={handleDelete}
              className="py-2.5 px-4 rounded-xl text-xs font-bold border border-red-500
                         bg-red-500 text-white flex items-center gap-1.5 animate-pulse"
            >
              <Trash2 size={14} /> Confirmar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

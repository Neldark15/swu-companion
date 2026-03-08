import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trophy, Target, TrendingUp, Award,
  ExternalLink, Calendar, Search, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  getMyMeleeTournaments,
  calculateMeleeStats,
  FORMAT_LABELS,
} from '../../services/meleeService'
import type { MeleeTournament, MeleeTournamentStats } from '../../types'

export function MeleeHubPage() {
  const navigate = useNavigate()
  const { supabaseUser } = useAuth()

  const [tournaments, setTournaments] = useState<MeleeTournament[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await getMyMeleeTournaments(supabaseUser?.id)
        setTournaments(data)
      } catch (e) {
        console.warn('[Melee] Load failed:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabaseUser])

  const stats: MeleeTournamentStats = useMemo(
    () => calculateMeleeStats(tournaments),
    [tournaments],
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return tournaments
    const q = search.toLowerCase()
    return tournaments.filter(
      t =>
        t.name.toLowerCase().includes(q) ||
        t.deckName?.toLowerCase().includes(q) ||
        t.organizer?.toLowerCase().includes(q) ||
        t.location?.toLowerCase().includes(q),
    )
  }, [tournaments, search])

  const standingLabel = (s?: number) => {
    if (s == null) return '—'
    if (s === 1) return '🥇 1°'
    if (s === 2) return '🥈 2°'
    if (s === 3) return '🥉 3°'
    return `${s}°`
  }

  return (
    <div className="min-h-screen bg-swu-bg pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-swu-bg/95 backdrop-blur border-b border-swu-border">
        <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-swu-muted">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-swu-text">Circuito Melee</h1>
            <p className="text-[10px] text-swu-muted font-mono tracking-wider">HISTORIAL COMPETITIVO</p>
          </div>
          <button
            onClick={() => navigate('/melee/add')}
            className="bg-swu-accent/15 text-swu-accent p-2 rounded-lg"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 py-4 space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-swu-surface rounded-xl p-3 text-center border border-swu-border">
            <Trophy size={16} className="mx-auto text-swu-amber mb-1" />
            <div className="text-lg font-bold text-swu-text">{stats.totalEvents}</div>
            <div className="text-[10px] text-swu-muted">Torneos</div>
          </div>
          <div className="bg-swu-surface rounded-xl p-3 text-center border border-swu-border">
            <Target size={16} className="mx-auto text-swu-green mb-1" />
            <div className="text-lg font-bold text-swu-text">
              {stats.totalWins}-{stats.totalLosses}
              {stats.totalDraws > 0 && <span className="text-xs text-swu-muted">-{stats.totalDraws}</span>}
            </div>
            <div className="text-[10px] text-swu-muted">Record</div>
          </div>
          <div className="bg-swu-surface rounded-xl p-3 text-center border border-swu-border">
            <TrendingUp size={16} className="mx-auto text-swu-accent mb-1" />
            <div className="text-lg font-bold text-swu-text">
              {stats.avgStanding != null ? `${stats.avgStanding}°` : '—'}
            </div>
            <div className="text-[10px] text-swu-muted">Promedio</div>
          </div>
          <div className="bg-swu-surface rounded-xl p-3 text-center border border-swu-border">
            <Award size={16} className="mx-auto text-purple-400 mb-1" />
            <div className="text-lg font-bold text-swu-text">
              {stats.bestStanding != null ? standingLabel(stats.bestStanding) : '—'}
            </div>
            <div className="text-[10px] text-swu-muted">Mejor</div>
          </div>
        </div>

        {/* Top Decks summary */}
        {stats.topDecks.length > 0 && (
          <div className="bg-swu-surface rounded-xl border border-swu-border p-3">
            <div className="text-xs text-swu-muted mb-2 font-mono tracking-wider">DECKS MÁS USADOS</div>
            <div className="space-y-1.5">
              {stats.topDecks.slice(0, 3).map((d, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-swu-text font-medium truncate flex-1">{d.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-swu-muted">{d.count} torneos</span>
                    {d.avgStanding != null && (
                      <span className="text-xs text-swu-amber font-medium">~{d.avgStanding}°</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Button (prominent) */}
        <button
          onClick={() => navigate('/melee/add')}
          className="w-full bg-gradient-to-r from-swu-accent/15 to-swu-amber/15 border border-swu-accent/30
                     rounded-xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="w-10 h-10 rounded-lg bg-swu-accent/20 border border-swu-accent/40 flex items-center justify-center">
            <Plus size={20} className="text-swu-accent" />
          </div>
          <div className="text-left flex-1">
            <p className="text-sm font-bold text-swu-accent">Registrar Torneo</p>
            <p className="text-[10px] text-swu-muted">Pegue su link de Melee o ingrese manual</p>
          </div>
        </button>

        {/* Search */}
        {tournaments.length > 3 && (
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
            <input
              type="text"
              placeholder="Buscar torneos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-swu-surface border border-swu-border rounded-xl pl-9 pr-3 py-2.5
                         text-sm text-swu-text placeholder:text-swu-muted focus:border-swu-accent outline-none"
            />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12 text-swu-muted">
            <div className="animate-spin w-8 h-8 border-2 border-swu-accent border-t-transparent rounded-full mx-auto mb-3" />
            Cargando historial...
          </div>
        )}

        {/* Empty */}
        {!loading && tournaments.length === 0 && (
          <div className="text-center py-12">
            <Trophy size={48} className="mx-auto text-swu-muted/30 mb-4" />
            <p className="text-swu-muted mb-2">No hay torneos registrados</p>
            <p className="text-xs text-swu-muted/60 mb-4">
              Registre sus resultados de torneos de Melee.gg aquí
            </p>
            <button
              onClick={() => navigate('/melee/add')}
              className="bg-swu-accent text-white px-4 py-2 rounded-xl text-sm font-medium"
            >
              Agregar Primer Torneo
            </button>
          </div>
        )}

        {/* Tournament List */}
        {!loading && filtered.length > 0 && (
          <div>
            <div className="text-xs text-swu-muted px-1 mb-1.5">
              {filtered.length} torneo{filtered.length !== 1 ? 's' : ''}
            </div>
            <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
              {filtered.map(t => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/melee/${t.id}`)}
                  className="w-full bg-swu-surface rounded-xl border border-swu-border p-3 text-left
                             active:scale-[0.98] transition-transform flex items-center gap-3"
                >
                  {/* Standing badge */}
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                    t.standing === 1
                      ? 'bg-swu-amber/15 border-swu-amber/30 text-swu-amber'
                      : t.standing != null && t.standing <= 4
                        ? 'bg-swu-accent/15 border-swu-accent/30 text-swu-accent'
                        : 'bg-swu-bg border-swu-border text-swu-muted'
                  }`}>
                    <span className="text-sm font-bold">{standingLabel(t.standing)}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-swu-text truncate">{t.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-swu-muted flex items-center gap-1">
                        <Calendar size={10} /> {t.date}
                      </span>
                      <span className="text-[10px] text-swu-accent font-medium">
                        {FORMAT_LABELS[t.format] || t.format}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-medium ${
                        t.wins > t.losses ? 'text-swu-green' : t.wins < t.losses ? 'text-red-400' : 'text-swu-muted'
                      }`}>
                        {t.wins}W-{t.losses}L{t.draws > 0 ? `-${t.draws}D` : ''}
                      </span>
                      {t.deckName && (
                        <span className="text-[10px] text-swu-muted truncate">· {t.deckName}</span>
                      )}
                    </div>
                  </div>

                  {/* Melee link indicator + chevron */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {t.meleeUrl && (
                      <ExternalLink size={12} className="text-swu-amber" />
                    )}
                    <ChevronRight size={16} className="text-swu-muted" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

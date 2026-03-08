import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Trophy, TrendingUp, Swords, Target, BarChart3, Loader2 } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { useAuth } from '../../hooks/useAuth'
import { getMyMatchLogs, calculateArenaStats } from '../../services/arenaService'
import type { ArenaStats } from '../../types'

export function ArenaStatsPage() {
  const navigate = useNavigate()
  const { currentProfile } = useAuth()
  const [stats, setStats] = useState<ArenaStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyMatchLogs(9999).then(({ logs }) => {
      setStats(calculateArenaStats(logs, currentProfile?.name))
      setLoading(false)
    })
  }, [currentProfile?.name])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="text-swu-accent animate-spin" />
      </div>
    )
  }

  if (!stats || stats.matchesPlayed === 0) {
    return (
      <div className="p-4 lg:p-6 pb-8 lg:pb-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/arena')} className="text-swu-muted">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-extrabold text-swu-text">Estadísticas</h2>
        </div>
        <div className="text-center py-12">
          <BarChart3 size={40} className="mx-auto text-swu-muted/30 mb-3" />
          <p className="text-sm text-swu-muted">Sin datos todavía</p>
          <p className="text-xs text-swu-muted mt-1">Registre combates para ver estadísticas</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 pb-8 lg:pb-8 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/arena')} className="text-swu-muted">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h2 className="text-lg font-extrabold text-swu-text">Estadísticas</h2>
          <p className="text-[10px] text-swu-muted font-mono tracking-wider">HOLOCRÓN DE DUELOS</p>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="bg-swu-surface rounded-xl p-4 border border-swu-border text-center">
          <Trophy size={20} className="mx-auto text-swu-amber mb-2" />
          <p className="text-2xl font-extrabold text-swu-amber font-mono">{stats.wins}</p>
          <p className="text-[10px] text-swu-muted font-mono tracking-wider">VICTORIAS</p>
        </div>
        <div className="bg-swu-surface rounded-xl p-4 border border-swu-border text-center">
          <Swords size={20} className="mx-auto text-swu-red mb-2" />
          <p className="text-2xl font-extrabold text-swu-red font-mono">{stats.losses}</p>
          <p className="text-[10px] text-swu-muted font-mono tracking-wider">DERROTAS</p>
        </div>
        <div className="bg-swu-surface rounded-xl p-4 border border-swu-border text-center">
          <TrendingUp size={20} className="mx-auto text-swu-accent mb-2" />
          <p className="text-2xl font-extrabold text-swu-accent font-mono">{stats.winrate}%</p>
          <p className="text-[10px] text-swu-muted font-mono tracking-wider">WINRATE</p>
        </div>
        <div className="bg-swu-surface rounded-xl p-4 border border-swu-border text-center">
          <Target size={20} className="mx-auto text-swu-green mb-2" />
          <p className="text-2xl font-extrabold text-swu-green font-mono">
            {stats.currentStreak > 0 ? `${stats.currentStreak}W` : stats.currentStreak < 0 ? `${Math.abs(stats.currentStreak)}L` : '0'}
          </p>
          <p className="text-[10px] text-swu-muted font-mono tracking-wider">RACHA</p>
        </div>
      </div>

      {/* Record bar */}
      <div className="bg-swu-surface rounded-xl p-4 border border-swu-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-swu-muted font-mono">Récord General</span>
          <span className="text-sm font-bold text-swu-text">
            {stats.wins}W — {stats.losses}L
          </span>
        </div>
        <div className="w-full h-3 bg-swu-bg rounded-full overflow-hidden flex">
          {stats.matchesPlayed > 0 && (
            <>
              <div
                className="h-full bg-swu-green rounded-l-full transition-all"
                style={{ width: `${stats.winrate}%` }}
              />
              <div
                className="h-full bg-swu-red rounded-r-full transition-all"
                style={{ width: `${100 - stats.winrate}%` }}
              />
            </>
          )}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-swu-green">{stats.winrate}% Win</span>
          <span className="text-[10px] text-swu-red">{100 - stats.winrate}% Loss</span>
        </div>
      </div>

      {/* By Mode */}
      {Object.keys(stats.byMode).length > 0 && (
        <div className="bg-swu-surface rounded-xl p-4 border border-swu-border space-y-3">
          <h3 className="text-xs text-swu-muted font-mono tracking-widest uppercase">Por Modo</h3>
          {Object.entries(stats.byMode).map(([mode, data]) => {
            const total = data.wins + data.losses
            const wr = total > 0 ? Math.round((data.wins / total) * 100) : 0
            return (
              <div key={mode} className="flex items-center gap-3">
                <Badge variant={mode === 'premier' ? 'accent' : 'amber'}>{mode}</Badge>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-swu-text font-medium">{data.wins}W - {data.losses}L</span>
                    <span className="text-swu-muted">{wr}%</span>
                  </div>
                  <div className="w-full h-2 bg-swu-bg rounded-full overflow-hidden flex">
                    <div className="h-full bg-swu-green" style={{ width: `${wr}%` }} />
                    <div className="h-full bg-swu-red" style={{ width: `${100 - wr}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Top Decks */}
      {stats.topDecks.length > 0 && (
        <div className="bg-swu-surface rounded-xl p-4 border border-swu-border space-y-2">
          <h3 className="text-xs text-swu-muted font-mono tracking-widest uppercase">Mis Decks</h3>
          {stats.topDecks.map((deck, i) => {
            const total = deck.wins + deck.losses
            const wr = total > 0 ? Math.round((deck.wins / total) * 100) : 0
            return (
              <div key={i} className="flex items-center gap-3 py-1">
                <span className="text-[10px] text-swu-muted w-4 text-right">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-swu-text truncate">{deck.name}</p>
                  <p className="text-[10px] text-swu-muted">
                    {deck.wins}W - {deck.losses}L · {wr}% WR
                  </p>
                </div>
                <div className="w-16 h-2 bg-swu-bg rounded-full overflow-hidden flex flex-shrink-0">
                  <div className="h-full bg-swu-green" style={{ width: `${wr}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Top Opponents */}
      {stats.recentOpponents.length > 0 && (
        <div className="bg-swu-surface rounded-xl p-4 border border-swu-border space-y-2">
          <h3 className="text-xs text-swu-muted font-mono tracking-widest uppercase">Oponentes Frecuentes</h3>
          {stats.recentOpponents.map((opp, i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-swu-muted w-4 text-right">#{i + 1}</span>
                <p className="text-sm font-medium text-swu-text">{opp.name}</p>
              </div>
              <Badge>{opp.count} partidas</Badge>
            </div>
          ))}
        </div>
      )}

      {/* Best Streak */}
      <div className="bg-swu-surface rounded-xl p-4 border border-swu-border flex items-center justify-between">
        <span className="text-xs text-swu-muted">Mejor racha de victorias</span>
        <span className="text-lg font-extrabold text-swu-amber font-mono">{stats.bestStreak}W</span>
      </div>
    </div>
  )
}

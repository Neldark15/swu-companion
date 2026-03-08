import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Swords, ScrollText, BarChart3, Radio, History, Users, Trophy, TrendingUp, Minus } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { getMyMatchLogs, calculateArenaStats } from '../../services/arenaService'
import type { MatchLog, ArenaStats } from '../../types'

const actions = [
  {
    icon: Swords,
    label: 'Tracker en Vivo',
    sub: 'Contadores de combate',
    color: 'text-swu-green',
    bg: 'bg-swu-green/10 border-swu-green/20',
    to: '/play',
  },
  {
    icon: ScrollText,
    label: 'Registrar Combate',
    sub: 'Log de partida casual',
    color: 'text-swu-accent',
    bg: 'bg-swu-accent/10 border-swu-accent/20',
    to: '/arena/log',
  },
  {
    icon: History,
    label: 'Archivo de Combate',
    sub: 'Mi historial',
    color: 'text-swu-amber',
    bg: 'bg-swu-amber/10 border-swu-amber/20',
    to: '/arena/history',
  },
  {
    icon: BarChart3,
    label: 'Estadísticas',
    sub: 'Win/Loss y más',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-400/20',
    to: '/arena/stats',
  },
  {
    icon: Radio,
    label: 'Transmisiones',
    sub: 'Feed galáctico',
    color: 'text-swu-red',
    bg: 'bg-swu-red/10 border-swu-red/20',
    to: '/arena/feed',
  },
]

export function ArenaPage() {
  const navigate = useNavigate()
  const { currentProfile } = useAuth()
  const [stats, setStats] = useState<ArenaStats | null>(null)
  const [recentLogs, setRecentLogs] = useState<MatchLog[]>([])

  useEffect(() => {
    getMyMatchLogs(3).then(({ logs }) => {
      setRecentLogs(logs)
      // Get all for stats
      getMyMatchLogs(1000).then(({ logs: all }) => {
        setStats(calculateArenaStats(all, currentProfile?.name))
      })
    })
  }, [currentProfile?.name])

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    const days = Math.floor(hrs / 24)
    return `${days}d`
  }

  return (
    <div className="p-4 lg:p-6 pb-8 lg:pb-8 max-w-5xl mx-auto space-y-4">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-swu-amber/20 bg-gradient-to-br from-swu-surface via-swu-surface to-swu-amber/5 p-5">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.06) 2px, rgba(255,255,255,0.06) 4px)',
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-swu-amber animate-pulse" />
            <span className="text-[9px] text-swu-amber font-mono tracking-[0.3em] uppercase font-bold">
              Sistema Activo
            </span>
          </div>
          <h1 className="text-xl font-extrabold text-swu-text">Holocrón de Duelos</h1>
          <p className="text-xs text-swu-muted mt-0.5 font-mono">
            Registro de combate · Estadísticas · Feed galáctico
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      {stats && stats.matchesPlayed > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-swu-surface rounded-xl p-3 border border-swu-border text-center">
            <Trophy size={14} className="mx-auto text-swu-amber mb-1" />
            <p className="text-lg font-extrabold text-swu-amber font-mono">{stats.wins}</p>
            <p className="text-[9px] text-swu-muted font-mono">WINS</p>
          </div>
          <div className="bg-swu-surface rounded-xl p-3 border border-swu-border text-center">
            <Minus size={14} className="mx-auto text-swu-red mb-1" />
            <p className="text-lg font-extrabold text-swu-red font-mono">{stats.losses}</p>
            <p className="text-[9px] text-swu-muted font-mono">LOSSES</p>
          </div>
          <div className="bg-swu-surface rounded-xl p-3 border border-swu-border text-center">
            <TrendingUp size={14} className="mx-auto text-swu-accent mb-1" />
            <p className="text-lg font-extrabold text-swu-accent font-mono">{stats.winrate}%</p>
            <p className="text-[9px] text-swu-muted font-mono">WINRATE</p>
          </div>
          <div className="bg-swu-surface rounded-xl p-3 border border-swu-border text-center">
            <Swords size={14} className="mx-auto text-swu-green mb-1" />
            <p className="text-lg font-extrabold text-swu-green font-mono">
              {stats.currentStreak > 0 ? `${stats.currentStreak}W` : stats.currentStreak < 0 ? `${Math.abs(stats.currentStreak)}L` : '—'}
            </p>
            <p className="text-[9px] text-swu-muted font-mono">RACHA</p>
          </div>
        </div>
      )}

      {/* Actions Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {actions.map((a) => {
          const Icon = a.icon
          return (
            <button
              key={a.label}
              onClick={() => navigate(a.to)}
              className="bg-swu-surface rounded-xl p-4 border border-swu-border text-left active:scale-[0.97] transition-transform"
            >
              <div className={`w-9 h-9 rounded-lg border flex items-center justify-center mb-2 ${a.bg}`}>
                <Icon size={18} className={a.color} />
              </div>
              <p className={`text-sm font-bold ${a.color}`}>{a.label}</p>
              <p className="text-[10px] text-swu-muted font-mono tracking-wider">{a.sub}</p>
            </button>
          )
        })}
      </div>

      {/* Recent Matches Preview */}
      {recentLogs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs text-swu-muted font-mono tracking-widest uppercase">Últimos Combates</h3>
            <button onClick={() => navigate('/arena/history')} className="text-[10px] text-swu-accent font-bold">
              Ver todo →
            </button>
          </div>
          <div className="space-y-1.5 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
            {recentLogs.map((log) => {
              const isWin = log.winnerPlayer === 1
              return (
                <div
                  key={log.id}
                  className={`bg-swu-surface rounded-xl p-3 border flex items-center gap-3 ${
                    isWin ? 'border-swu-green/30' : 'border-swu-red/30'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold ${
                    isWin ? 'bg-swu-green/15 text-swu-green' : 'bg-swu-red/15 text-swu-red'
                  }`}>
                    {isWin ? 'W' : 'L'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-swu-text truncate">
                      vs {log.player2Name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-swu-muted font-mono">
                        {log.finalScore[0]}-{log.finalScore[1]}
                      </span>
                      <span className="text-[10px] text-swu-muted">{log.gameMode}</span>
                      {log.player1DeckName && (
                        <span className="text-[10px] text-swu-muted truncate">{log.player1DeckName}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-swu-muted font-mono">{timeAgo(log.recordedAt)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {recentLogs.length === 0 && (!stats || stats.matchesPlayed === 0) && (
        <div className="text-center py-8">
          <Users size={40} className="mx-auto text-swu-muted/30 mb-3" />
          <p className="text-sm text-swu-muted">Sin combates registrados</p>
          <p className="text-xs text-swu-muted mt-1">Registre su primera partida para ver estadísticas</p>
          <button
            onClick={() => navigate('/arena/log')}
            className="mt-4 px-5 py-2.5 rounded-xl bg-swu-accent text-white font-bold text-sm active:scale-95 transition-transform"
          >
            Registrar Combate
          </button>
        </div>
      )}
    </div>
  )
}

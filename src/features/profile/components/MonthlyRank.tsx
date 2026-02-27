import { useState, useEffect } from 'react'
import { Trophy, ChevronLeft, ChevronRight, Crown, Medal, Award } from 'lucide-react'
import { getMonthlyLeaderboard, getMyMonthlyXp, type LeaderboardEntry } from '../../../services/sync'
import { IconXp } from '../../../components/icons/SWUIcons'

interface MonthlyRankProps {
  userId: string | null
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-')
  const idx = parseInt(month) - 1
  return `${MONTH_NAMES[idx] || month} ${year}`
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function prevMonth(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nextMonth(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function MonthlyRank({ userId }: MonthlyRankProps) {
  const [month, setMonth] = useState(getCurrentMonth)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [myXp, setMyXp] = useState(0)
  const [loading, setLoading] = useState(true)

  const isCurrentMonth = month === getCurrentMonth()

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function load() {
      const [lb, xp] = await Promise.all([
        getMonthlyLeaderboard(month),
        userId ? getMyMonthlyXp(userId, month) : Promise.resolve(0),
      ])
      if (!cancelled) {
        setLeaderboard(lb)
        setMyXp(xp)
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [month, userId])

  // Find my position
  const myPos = userId ? leaderboard.findIndex(e => e.userId === userId) + 1 : 0

  const podiumIcons = [
    { icon: Crown, color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/40', label: '1°' },
    { icon: Medal, color: 'text-gray-300', bg: 'bg-gray-400/20', border: 'border-gray-400/40', label: '2°' },
    { icon: Award, color: 'text-amber-600', bg: 'bg-amber-700/20', border: 'border-amber-700/40', label: '3°' },
  ]

  return (
    <div className="space-y-3">
      {/* Header + Month nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-amber-400" />
          <p className="text-xs font-bold text-swu-muted uppercase tracking-widest">Rank del Mes</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth(prevMonth(month))} className="p-1 text-swu-muted active:scale-90">
            <ChevronLeft size={16} />
          </button>
          <span className="text-[11px] font-bold text-swu-text min-w-[100px] text-center">
            {formatMonth(month)}
          </span>
          <button
            onClick={() => !isCurrentMonth && setMonth(nextMonth(month))}
            className={`p-1 active:scale-90 ${isCurrentMonth ? 'text-swu-border' : 'text-swu-muted'}`}
            disabled={isCurrentMonth}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-6">
          <div className="w-6 h-6 border-2 border-swu-accent border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[11px] text-swu-muted mt-2">Cargando ranking...</p>
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-6 bg-swu-bg/50 rounded-xl border border-swu-border/50">
          <Trophy size={28} className="mx-auto text-swu-muted mb-2 opacity-40" />
          <p className="text-sm text-swu-muted">Sin datos este mes</p>
          <p className="text-[10px] text-swu-muted mt-0.5">
            {isCurrentMonth ? 'Juegue partidas para aparecer en el ranking' : 'No hubo actividad registrada'}
          </p>
        </div>
      ) : (
        <>
          {/* Podium (top 3) */}
          {leaderboard.length >= 1 && (
            <div className="flex items-end justify-center gap-2 pt-2">
              {/* 2nd place */}
              {leaderboard[1] && (
                <div className={`flex-1 max-w-[90px] rounded-xl p-2 border ${podiumIcons[1].bg} ${podiumIcons[1].border} text-center`}>
                  <div className="text-2xl mb-0.5">{leaderboard[1].avatar}</div>
                  <p className="text-[10px] font-bold text-swu-text truncate">{leaderboard[1].name}</p>
                  <div className="flex items-center justify-center gap-0.5 mt-0.5">
                    <IconXp size={10} className={podiumIcons[1].color} />
                    <span className={`text-[10px] font-bold ${podiumIcons[1].color}`}>{leaderboard[1].xpGained}</span>
                  </div>
                  <span className={`text-[9px] ${podiumIcons[1].color}`}>2°</span>
                </div>
              )}

              {/* 1st place (taller) */}
              <div className={`flex-1 max-w-[100px] rounded-xl p-3 border-2 ${podiumIcons[0].bg} ${podiumIcons[0].border} text-center relative`}>
                <Crown size={16} className="text-amber-400 mx-auto mb-1" />
                <div className="text-3xl mb-0.5">{leaderboard[0].avatar}</div>
                <p className="text-[11px] font-bold text-swu-text truncate">{leaderboard[0].name}</p>
                <div className="flex items-center justify-center gap-0.5 mt-0.5">
                  <IconXp size={12} className="text-amber-400" />
                  <span className="text-xs font-bold text-amber-400">{leaderboard[0].xpGained}</span>
                </div>
                <span className="text-[10px] text-amber-400 font-bold">1°</span>
              </div>

              {/* 3rd place */}
              {leaderboard[2] && (
                <div className={`flex-1 max-w-[90px] rounded-xl p-2 border ${podiumIcons[2].bg} ${podiumIcons[2].border} text-center`}>
                  <div className="text-2xl mb-0.5">{leaderboard[2].avatar}</div>
                  <p className="text-[10px] font-bold text-swu-text truncate">{leaderboard[2].name}</p>
                  <div className="flex items-center justify-center gap-0.5 mt-0.5">
                    <IconXp size={10} className={podiumIcons[2].color} />
                    <span className={`text-[10px] font-bold ${podiumIcons[2].color}`}>{leaderboard[2].xpGained}</span>
                  </div>
                  <span className={`text-[9px] ${podiumIcons[2].color}`}>3°</span>
                </div>
              )}
            </div>
          )}

          {/* Rest of leaderboard (4th+) */}
          {leaderboard.length > 3 && (
            <div className="space-y-1">
              {leaderboard.slice(3).map((entry) => {
                const isMe = userId && entry.userId === userId
                return (
                  <div key={entry.userId}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 ${isMe ? 'bg-swu-accent/10 border border-swu-accent/30' : 'bg-swu-bg/50'}`}
                  >
                    <span className="text-[11px] font-mono text-swu-muted w-5 text-right">{entry.rank}</span>
                    <span className="text-lg">{entry.avatar}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-bold truncate ${isMe ? 'text-swu-accent' : 'text-swu-text'}`}>
                        {entry.name} {isMe && '(Tú)'}
                      </p>
                      <p className="text-[9px] text-swu-muted">Nv. {entry.level}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <IconXp size={12} className="text-amber-400" />
                      <span className="text-[11px] font-bold text-amber-400 font-mono">{entry.xpGained}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* My position summary */}
          {userId && myPos > 0 && (
            <div className="bg-swu-accent/10 rounded-lg px-3 py-2 border border-swu-accent/20 flex items-center justify-between">
              <span className="text-[11px] text-swu-accent font-bold">Tu posición: #{myPos}</span>
              <div className="flex items-center gap-1">
                <IconXp size={12} className="text-amber-400" />
                <span className="text-[11px] font-bold text-amber-400">{myXp} XP este mes</span>
              </div>
            </div>
          )}
          {userId && myPos === 0 && myXp === 0 && isCurrentMonth && (
            <p className="text-[10px] text-swu-muted text-center">Gane XP para aparecer en el ranking</p>
          )}
        </>
      )}
    </div>
  )
}

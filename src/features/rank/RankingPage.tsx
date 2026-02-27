import { useState, useEffect } from 'react'
import { Trophy, Crown, Medal, Award, Swords, Flame, Layers, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { getGlobalLeaderboard, getMonthlyLeaderboard, getMyMonthlyXp, type GlobalLeaderboardEntry, type LeaderboardEntry } from '../../services/sync'
import { ACHIEVEMENTS } from '../../services/gamification'
import { useAuth } from '../../hooks/useAuth'
import { IconXp } from '../../components/icons/SWUIcons'

/* ── Avatar helper ── */
const swAvatarIds = ['chewbacca','r2d2','c3po','bb8','pilot','boba-fett','stormtrooper','darth-vader','phasma','kylo-ren','jedi-order','phoenix','rebel-alliance','galactic-empire','first-order']

function AvatarImg({ avatar, size = 'md' }: { avatar: string; size?: 'sm' | 'md' | 'lg' }) {
  const cls = { sm: 'w-8 h-8', md: 'w-11 h-11', lg: 'w-16 h-16' }
  const txtCls = { sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl' }
  if (swAvatarIds.includes(avatar)) {
    return <img src={`/avatars/${avatar}.png`} alt="" className={`${cls[size]} object-contain`} />
  }
  return <span className={txtCls[size]}>{avatar || '🎯'}</span>
}

/* ── Important achievements to display as badges ── */
const BADGE_IDS = [
  'cmd_2', 'cmd_3', 'cmd_5',  // Comandante, General, Mariscal (torneos)
  'agg_1', 'agg_2', 'agg_3', 'agg_5', // Victorias
  'vil_5',                      // Maestro Oscuro
]
const BADGE_MAP = new Map(ACHIEVEMENTS.filter(a => BADGE_IDS.includes(a.id)).map(a => [a.id, a]))

/* ── Month utilities ── */
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
function formatMonth(m: string) {
  const [y, mo] = m.split('-')
  return `${MONTH_NAMES[parseInt(mo) - 1]} ${y}`
}
function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

type Tab = 'global' | 'monthly'

export function RankingPage() {
  const { supabaseUser } = useAuth()
  const [tab, setTab] = useState<Tab>('global')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Global
  const [globalBoard, setGlobalBoard] = useState<GlobalLeaderboardEntry[]>([])

  // Monthly
  const [month, setMonth] = useState(getCurrentMonth)
  const [monthlyBoard, setMonthlyBoard] = useState<LeaderboardEntry[]>([])
  const [myXp, setMyXp] = useState(0)

  const isCurrentMonth = month === getCurrentMonth()

  const loadGlobal = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    const data = await getGlobalLeaderboard()
    setGlobalBoard(data)
    setLoading(false)
    setRefreshing(false)
  }

  const loadMonthly = async () => {
    setLoading(true)
    const [lb, xp] = await Promise.all([
      getMonthlyLeaderboard(month),
      supabaseUser ? getMyMonthlyXp(supabaseUser.id, month) : Promise.resolve(0),
    ])
    setMonthlyBoard(lb)
    setMyXp(xp)
    setLoading(false)
  }

  useEffect(() => {
    if (tab === 'global') loadGlobal()
    else loadMonthly()
  }, [tab, month])

  const podiumColors = [
    { border: 'border-amber-400/50', bg: 'bg-amber-500/10', text: 'text-amber-400', label: '1°' },
    { border: 'border-gray-400/50', bg: 'bg-gray-400/10', text: 'text-gray-300', label: '2°' },
    { border: 'border-amber-600/50', bg: 'bg-amber-700/10', text: 'text-amber-600', label: '3°' },
  ]

  const PodiumIcon = ({ rank }: { rank: number }) => {
    if (rank === 0) return <Crown size={14} className="text-amber-400" />
    if (rank === 1) return <Medal size={14} className="text-gray-300" />
    return <Award size={14} className="text-amber-600" />
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={20} className="text-amber-400" />
          <h2 className="text-lg font-extrabold text-swu-text">Ranking</h2>
        </div>
        {tab === 'global' && (
          <button
            onClick={() => loadGlobal(true)}
            disabled={refreshing}
            className="p-2 rounded-lg bg-swu-surface border border-swu-border text-swu-muted active:scale-95 transition-transform"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex bg-swu-surface rounded-xl border border-swu-border p-1">
        <button
          onClick={() => setTab('global')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${tab === 'global' ? 'bg-swu-accent/20 text-swu-accent' : 'text-swu-muted'}`}
        >
          Global
        </button>
        <button
          onClick={() => setTab('monthly')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${tab === 'monthly' ? 'bg-swu-accent/20 text-swu-accent' : 'text-swu-muted'}`}
        >
          Mensual
        </button>
      </div>

      {/* Monthly controls */}
      {tab === 'monthly' && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setMonth(prevMonth(month))} className="p-1.5 text-swu-muted active:scale-90">
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-bold text-swu-text min-w-[120px] text-center">{formatMonth(month)}</span>
          <button
            onClick={() => !isCurrentMonth && setMonth(nextMonth(month))}
            className={`p-1.5 active:scale-90 ${isCurrentMonth ? 'text-swu-border' : 'text-swu-muted'}`}
            disabled={isCurrentMonth}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-swu-accent border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-swu-muted mt-3">Cargando ranking...</p>
        </div>
      ) : tab === 'global' ? (
        /* ═══ GLOBAL RANKING ═══ */
        globalBoard.length === 0 ? (
          <div className="text-center py-12 bg-swu-surface rounded-xl border border-swu-border">
            <Trophy size={36} className="mx-auto text-swu-muted/30 mb-3" />
            <p className="text-sm text-swu-muted">No hay jugadores registrados aún</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Podium (top 3) */}
            {globalBoard.length >= 1 && (
              <div className="flex items-end justify-center gap-2 pt-2 pb-3">
                {/* 2nd */}
                {globalBoard[1] && (
                  <div className={`flex-1 max-w-[100px] rounded-xl p-2.5 border ${podiumColors[1].border} ${podiumColors[1].bg} text-center`}>
                    <PodiumIcon rank={1} />
                    <div className="flex justify-center my-1.5">
                      <AvatarImg avatar={globalBoard[1].avatar} size="md" />
                    </div>
                    <p className="text-[10px] font-bold text-swu-text truncate">{globalBoard[1].name}</p>
                    <p className="text-[9px] text-swu-muted">Nv. {globalBoard[1].level}</p>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Trophy size={9} className="text-swu-green" />
                      <span className="text-[9px] font-bold text-swu-green">{globalBoard[1].tournamentsFinished}</span>
                      <Swords size={9} className="text-swu-accent ml-1" />
                      <span className="text-[9px] font-bold text-swu-accent">{globalBoard[1].wins}W</span>
                    </div>
                    {/* Badges */}
                    <div className="flex flex-wrap justify-center gap-0.5 mt-1.5">
                      {globalBoard[1].unlockedAchievements
                        .filter(id => BADGE_MAP.has(id))
                        .slice(0, 3)
                        .map(id => (
                          <span key={id} className="text-[10px]" title={BADGE_MAP.get(id)!.name}>
                            {BADGE_MAP.get(id)!.icon}
                          </span>
                        ))}
                    </div>
                    <span className={`text-[9px] font-bold ${podiumColors[1].text}`}>2°</span>
                  </div>
                )}

                {/* 1st (taller) */}
                <div className={`flex-1 max-w-[110px] rounded-xl p-3 border-2 ${podiumColors[0].border} ${podiumColors[0].bg} text-center relative`}>
                  <Crown size={18} className="text-amber-400 mx-auto" />
                  <div className="flex justify-center my-2">
                    <AvatarImg avatar={globalBoard[0].avatar} size="lg" />
                  </div>
                  <p className="text-[11px] font-bold text-swu-text truncate">{globalBoard[0].name}</p>
                  <p className="text-[9px] text-swu-muted">Nv. {globalBoard[0].level}</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Trophy size={10} className="text-swu-green" />
                    <span className="text-[10px] font-bold text-swu-green">{globalBoard[0].tournamentsFinished}</span>
                    <Swords size={10} className="text-swu-accent ml-1" />
                    <span className="text-[10px] font-bold text-swu-accent">{globalBoard[0].wins}W</span>
                  </div>
                  {/* Badges */}
                  <div className="flex flex-wrap justify-center gap-0.5 mt-1.5">
                    {globalBoard[0].unlockedAchievements
                      .filter(id => BADGE_MAP.has(id))
                      .slice(0, 4)
                      .map(id => (
                        <span key={id} className="text-xs" title={BADGE_MAP.get(id)!.name}>
                          {BADGE_MAP.get(id)!.icon}
                        </span>
                      ))}
                  </div>
                  <span className="text-[10px] font-bold text-amber-400">1°</span>
                </div>

                {/* 3rd */}
                {globalBoard[2] && (
                  <div className={`flex-1 max-w-[100px] rounded-xl p-2.5 border ${podiumColors[2].border} ${podiumColors[2].bg} text-center`}>
                    <PodiumIcon rank={2} />
                    <div className="flex justify-center my-1.5">
                      <AvatarImg avatar={globalBoard[2].avatar} size="md" />
                    </div>
                    <p className="text-[10px] font-bold text-swu-text truncate">{globalBoard[2].name}</p>
                    <p className="text-[9px] text-swu-muted">Nv. {globalBoard[2].level}</p>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Trophy size={9} className="text-swu-green" />
                      <span className="text-[9px] font-bold text-swu-green">{globalBoard[2].tournamentsFinished}</span>
                      <Swords size={9} className="text-swu-accent ml-1" />
                      <span className="text-[9px] font-bold text-swu-accent">{globalBoard[2].wins}W</span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-0.5 mt-1.5">
                      {globalBoard[2].unlockedAchievements
                        .filter(id => BADGE_MAP.has(id))
                        .slice(0, 3)
                        .map(id => (
                          <span key={id} className="text-[10px]" title={BADGE_MAP.get(id)!.name}>
                            {BADGE_MAP.get(id)!.icon}
                          </span>
                        ))}
                    </div>
                    <span className={`text-[9px] font-bold ${podiumColors[2].text}`}>3°</span>
                  </div>
                )}
              </div>
            )}

            {/* Stats legend */}
            <div className="flex items-center justify-center gap-4 text-[9px] text-swu-muted">
              <span className="flex items-center gap-1"><Trophy size={9} className="text-swu-green" /> Torneos</span>
              <span className="flex items-center gap-1"><Swords size={9} className="text-swu-accent" /> Victorias</span>
              <span className="flex items-center gap-1"><Flame size={9} className="text-amber-400" /> Racha</span>
              <span className="flex items-center gap-1"><Layers size={9} className="text-purple-400" /> Decks</span>
            </div>

            {/* Full list (all players from 4th onwards) */}
            <div className="space-y-1.5">
              {globalBoard.slice(3).map((entry, i) => {
                const rank = i + 4
                const isMe = supabaseUser?.id === entry.userId
                const badges = entry.unlockedAchievements.filter(id => BADGE_MAP.has(id))

                return (
                  <div
                    key={entry.userId}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 border transition-colors ${
                      isMe ? 'bg-swu-accent/10 border-swu-accent/30' : 'bg-swu-surface border-swu-border'
                    }`}
                  >
                    {/* Rank # */}
                    <span className="text-xs font-mono font-bold text-swu-muted w-6 text-right">#{rank}</span>

                    {/* Avatar */}
                    <div className="shrink-0">
                      <AvatarImg avatar={entry.avatar} size="sm" />
                    </div>

                    {/* Name + level + badges */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate ${isMe ? 'text-swu-accent' : 'text-swu-text'}`}>
                        {entry.name} {isMe && '(Tú)'}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-swu-muted">Nv. {entry.level}</span>
                        {badges.length > 0 && (
                          <div className="flex gap-0.5">
                            {badges.slice(0, 3).map(id => (
                              <span key={id} className="text-[9px]" title={BADGE_MAP.get(id)!.name}>
                                {BADGE_MAP.get(id)!.icon}
                              </span>
                            ))}
                            {badges.length > 3 && (
                              <span className="text-[8px] text-swu-muted">+{badges.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-swu-green font-mono">{entry.tournamentsFinished}</p>
                        <p className="text-[7px] text-swu-muted">TOR</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-swu-accent font-mono">{entry.wins}</p>
                        <p className="text-[7px] text-swu-muted">WIN</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-amber-400 font-mono">{entry.bestStreak}</p>
                        <p className="text-[7px] text-swu-muted">STR</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* My position */}
            {supabaseUser && (() => {
              const myIdx = globalBoard.findIndex(e => e.userId === supabaseUser.id)
              if (myIdx >= 0) {
                return (
                  <div className="bg-swu-accent/10 rounded-xl px-3 py-2 border border-swu-accent/20 flex items-center justify-between">
                    <span className="text-[11px] text-swu-accent font-bold">Tu posición: #{myIdx + 1} de {globalBoard.length}</span>
                    <span className="text-[11px] text-swu-muted">{globalBoard[myIdx].xp} XP total</span>
                  </div>
                )
              }
              return null
            })()}
          </div>
        )
      ) : (
        /* ═══ MONTHLY RANKING ═══ */
        monthlyBoard.length === 0 ? (
          <div className="text-center py-12 bg-swu-surface rounded-xl border border-swu-border">
            <Trophy size={36} className="mx-auto text-swu-muted/30 mb-3" />
            <p className="text-sm text-swu-muted">Sin datos este mes</p>
            <p className="text-[10px] text-swu-muted mt-1">
              {isCurrentMonth ? 'Juegue partidas para aparecer en el ranking' : 'No hubo actividad registrada'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Podium monthly */}
            {monthlyBoard.length >= 1 && (
              <div className="flex items-end justify-center gap-2 pt-2 pb-3">
                {/* 2nd */}
                {monthlyBoard[1] && (
                  <div className={`flex-1 max-w-[100px] rounded-xl p-2.5 border ${podiumColors[1].border} ${podiumColors[1].bg} text-center`}>
                    <PodiumIcon rank={1} />
                    <div className="flex justify-center my-1.5">
                      <AvatarImg avatar={monthlyBoard[1].avatar} size="md" />
                    </div>
                    <p className="text-[10px] font-bold text-swu-text truncate">{monthlyBoard[1].name}</p>
                    <div className="flex items-center justify-center gap-0.5 mt-0.5">
                      <IconXp size={10} className={podiumColors[1].text} />
                      <span className={`text-[10px] font-bold ${podiumColors[1].text}`}>{monthlyBoard[1].xpGained}</span>
                    </div>
                    <span className={`text-[9px] font-bold ${podiumColors[1].text}`}>2°</span>
                  </div>
                )}

                {/* 1st */}
                <div className={`flex-1 max-w-[110px] rounded-xl p-3 border-2 ${podiumColors[0].border} ${podiumColors[0].bg} text-center`}>
                  <Crown size={18} className="text-amber-400 mx-auto" />
                  <div className="flex justify-center my-2">
                    <AvatarImg avatar={monthlyBoard[0].avatar} size="lg" />
                  </div>
                  <p className="text-[11px] font-bold text-swu-text truncate">{monthlyBoard[0].name}</p>
                  <div className="flex items-center justify-center gap-0.5 mt-0.5">
                    <IconXp size={12} className="text-amber-400" />
                    <span className="text-xs font-bold text-amber-400">{monthlyBoard[0].xpGained}</span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-400">1°</span>
                </div>

                {/* 3rd */}
                {monthlyBoard[2] && (
                  <div className={`flex-1 max-w-[100px] rounded-xl p-2.5 border ${podiumColors[2].border} ${podiumColors[2].bg} text-center`}>
                    <PodiumIcon rank={2} />
                    <div className="flex justify-center my-1.5">
                      <AvatarImg avatar={monthlyBoard[2].avatar} size="md" />
                    </div>
                    <p className="text-[10px] font-bold text-swu-text truncate">{monthlyBoard[2].name}</p>
                    <div className="flex items-center justify-center gap-0.5 mt-0.5">
                      <IconXp size={10} className={podiumColors[2].text} />
                      <span className={`text-[10px] font-bold ${podiumColors[2].text}`}>{monthlyBoard[2].xpGained}</span>
                    </div>
                    <span className={`text-[9px] font-bold ${podiumColors[2].text}`}>3°</span>
                  </div>
                )}
              </div>
            )}

            {/* Rest of monthly list */}
            {monthlyBoard.length > 3 && (
              <div className="space-y-1.5">
                {monthlyBoard.slice(3).map((entry) => {
                  const isMe = supabaseUser?.id === entry.userId
                  return (
                    <div
                      key={entry.userId}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 border ${
                        isMe ? 'bg-swu-accent/10 border-swu-accent/30' : 'bg-swu-surface border-swu-border'
                      }`}
                    >
                      <span className="text-xs font-mono font-bold text-swu-muted w-6 text-right">#{entry.rank}</span>
                      <div className="shrink-0">
                        <AvatarImg avatar={entry.avatar} size="sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold truncate ${isMe ? 'text-swu-accent' : 'text-swu-text'}`}>
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

            {/* My summary */}
            {supabaseUser && (() => {
              const myPos = monthlyBoard.findIndex(e => e.userId === supabaseUser.id) + 1
              if (myPos > 0) {
                return (
                  <div className="bg-swu-accent/10 rounded-xl px-3 py-2 border border-swu-accent/20 flex items-center justify-between">
                    <span className="text-[11px] text-swu-accent font-bold">Tu posición: #{myPos}</span>
                    <div className="flex items-center gap-1">
                      <IconXp size={12} className="text-amber-400" />
                      <span className="text-[11px] font-bold text-amber-400">{myXp} XP</span>
                    </div>
                  </div>
                )
              }
              if (myXp === 0 && isCurrentMonth) {
                return <p className="text-[10px] text-swu-muted text-center">Gane XP para aparecer en el ranking</p>
              }
              return null
            })()}
          </div>
        )
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Trophy, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { getGlobalLeaderboard, getMonthlyLeaderboard, getMyMonthlyXp, type GlobalLeaderboardEntry, type LeaderboardEntry } from '../../services/sync'
import { ACHIEVEMENTS } from '../../services/gamification'
import { useAuth } from '../../hooks/useAuth'
import { IconXp } from '../../components/icons/SWUIcons'

/* ── Avatar helper ── */
const swAvatarIds = ['chewbacca','r2d2','c3po','bb8','pilot','boba-fett','stormtrooper','darth-vader','phasma','kylo-ren','jedi-order','phoenix','rebel-alliance','galactic-empire','first-order','first-order-2','starfighter','sith-empire','rebel-alliance-2','jedi-order-2','new-republic','empire-gear','separatist','galactic-republic']

function AvatarImg({ avatar, size = 'md' }: { avatar: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const cls = { sm: 'w-8 h-8', md: 'w-12 h-12', lg: 'w-16 h-16', xl: 'w-20 h-20' }
  const txtCls = { sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl', xl: 'text-5xl' }
  if (swAvatarIds.includes(avatar)) {
    return <img src={`/avatars/${avatar}.png`} alt="" className={`${cls[size]} object-contain`} />
  }
  return <span className={txtCls[size]}>{avatar || '🎯'}</span>
}

/* ── Important achievements to display as badges ── */
const BADGE_IDS = [
  'cmd_2', 'cmd_3', 'cmd_5',
  'agg_1', 'agg_2', 'agg_3', 'agg_5',
  'vil_5',
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

/* ── Decorative diagonal lines SVG (Star Wars style) ── */
function DiagonalLines() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="diag" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
          <line x1="0" y1="0" x2="0" y2="40" stroke="#ef4444" strokeWidth="2" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#diag)" />
    </svg>
  )
}

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

  /* ── Podium ring colors ── */
  const podiumRing = [
    'ring-amber-400 ring-[3px]',    // 1st - gold
    'ring-gray-400 ring-2',          // 2nd - silver
    'ring-amber-700 ring-2',         // 3rd - bronze
  ]
  const podiumLabel = [
    'bg-amber-400 text-black',
    'bg-gray-400 text-black',
    'bg-amber-700 text-black',
  ]

  /* ── Shared podium card renderer ── */
  function PodiumCard({ entry, idx, avatarSize }: { entry: GlobalLeaderboardEntry | LeaderboardEntry; idx: number; avatarSize: 'md' | 'lg' | 'xl' }) {
    const badges = 'unlockedAchievements' in entry
      ? (entry as GlobalLeaderboardEntry).unlockedAchievements.filter(id => BADGE_MAP.has(id))
      : []
    const isGlobal = 'tournamentsFinished' in entry

    return (
      <div className="flex flex-col items-center gap-1">
        {/* Rank badge */}
        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${podiumLabel[idx]}`}>
          #{idx + 1}
        </span>

        {/* Avatar with ring */}
        <div className={`rounded-full ${podiumRing[idx]} p-0.5 bg-gray-900`}>
          <div className="rounded-full bg-gray-800 flex items-center justify-center overflow-hidden p-1">
            <AvatarImg avatar={entry.avatar} size={avatarSize} />
          </div>
        </div>

        {/* Name */}
        <p className="text-[11px] font-bold text-gray-100 max-w-[90px] truncate text-center">
          {entry.name}
        </p>

        {/* Level */}
        <span className="text-[9px] text-red-400/80 font-mono">Nv. {entry.level}</span>

        {/* Stats */}
        {isGlobal ? (
          <div className="flex items-center gap-1.5 text-[9px]">
            <span className="text-red-400 font-bold">{(entry as GlobalLeaderboardEntry).tournamentsFinished}T</span>
            <span className="text-gray-500">|</span>
            <span className="text-red-300/70 font-bold">{(entry as GlobalLeaderboardEntry).wins}W</span>
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            <IconXp size={10} className="text-red-400" />
            <span className="text-[10px] font-bold text-red-400">{(entry as LeaderboardEntry).xpGained}</span>
          </div>
        )}

        {/* Badges (global only) */}
        {badges.length > 0 && (
          <div className="flex gap-0.5">
            {badges.slice(0, 3).map(id => (
              <span key={id} className="text-[10px]" title={BADGE_MAP.get(id)!.name}>
                {BADGE_MAP.get(id)!.icon}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  /* ── List row renderer ── */
  function ListRow({ entry, rank, isMe, isGlobal }: { entry: GlobalLeaderboardEntry | LeaderboardEntry; rank: number; isMe: boolean; isGlobal: boolean }) {
    const badges = 'unlockedAchievements' in entry
      ? (entry as GlobalLeaderboardEntry).unlockedAchievements.filter(id => BADGE_MAP.has(id))
      : []

    return (
      <div
        className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors ${
          isMe
            ? 'bg-red-500/10 border border-red-500/30'
            : 'bg-gray-800/60 border border-gray-700/40'
        }`}
      >
        {/* Rank number */}
        <span className="text-sm font-extrabold text-red-500/70 font-mono w-8 text-center">#{rank}</span>

        {/* Avatar */}
        <div className="shrink-0 rounded-full ring-1 ring-gray-600 p-0.5 bg-gray-900">
          <div className="rounded-full bg-gray-800 flex items-center justify-center overflow-hidden p-0.5">
            <AvatarImg avatar={entry.avatar} size="sm" />
          </div>
        </div>

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold truncate ${isMe ? 'text-red-400' : 'text-gray-200'}`}>
            {entry.name} {isMe && <span className="text-red-500/60 text-[9px]">(Tú)</span>}
          </p>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-gray-500 font-mono">Nv.{entry.level}</span>
            {badges.length > 0 && (
              <div className="flex gap-0.5 ml-0.5">
                {badges.slice(0, 2).map(id => (
                  <span key={id} className="text-[9px]">{BADGE_MAP.get(id)!.icon}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Score */}
        {isGlobal ? (
          <span className="text-sm font-extrabold text-red-400 font-mono">
            {(entry as GlobalLeaderboardEntry).tournamentsFinished * 1000 + (entry as GlobalLeaderboardEntry).wins * 100 + (entry as GlobalLeaderboardEntry).xp}
          </span>
        ) : (
          <div className="flex items-center gap-1">
            <IconXp size={12} className="text-red-400" />
            <span className="text-sm font-extrabold text-red-400 font-mono">{(entry as LeaderboardEntry).xpGained}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950" />
      <DiagonalLines />

      {/* Scan line overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,0,0,0.1) 2px, rgba(255,0,0,0.1) 4px)',
        }}
      />

      <div className="relative z-10 px-4 pt-5 space-y-5">
        {/* ═══ HEADER ═══ */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-black tracking-[0.25em] text-gray-100 uppercase"
            style={{ textShadow: '0 0 20px rgba(239,68,68,0.3), 0 0 40px rgba(239,68,68,0.1)' }}
          >
            RANKING
          </h1>
          <p className="text-[10px] tracking-[0.3em] text-red-500/50 uppercase font-mono">
            Mejores Jugadores del Juego
          </p>
          {/* Decorative line */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-red-500/40" />
            <div className="w-1.5 h-1.5 rotate-45 bg-red-500/50" />
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-red-500/40" />
          </div>
        </div>

        {/* ═══ TAB SWITCHER ═══ */}
        <div className="flex bg-gray-900/80 rounded-xl border border-red-900/20 p-1 backdrop-blur-sm">
          <button
            onClick={() => setTab('global')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-extrabold tracking-wider uppercase transition-all ${
              tab === 'global'
                ? 'bg-red-500/15 text-red-400 border border-red-500/20 shadow-lg shadow-red-500/5'
                : 'text-gray-500 border border-transparent'
            }`}
          >
            Global
          </button>
          <button
            onClick={() => setTab('monthly')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-extrabold tracking-wider uppercase transition-all ${
              tab === 'monthly'
                ? 'bg-red-500/15 text-red-400 border border-red-500/20 shadow-lg shadow-red-500/5'
                : 'text-gray-500 border border-transparent'
            }`}
          >
            Mensual
          </button>
          {/* Refresh button */}
          <button
            onClick={() => tab === 'global' ? loadGlobal(true) : loadMonthly()}
            disabled={refreshing}
            className="px-3 py-2 rounded-lg text-gray-500 active:scale-90 transition-transform"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-red-400' : ''} />
          </button>
        </div>

        {/* ═══ MONTHLY CONTROLS ═══ */}
        {tab === 'monthly' && (
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setMonth(prevMonth(month))} className="p-1.5 text-red-500/60 active:scale-90 active:text-red-400">
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs font-bold text-gray-300 min-w-[130px] text-center tracking-wider uppercase font-mono">
              {formatMonth(month)}
            </span>
            <button
              onClick={() => !isCurrentMonth && setMonth(nextMonth(month))}
              className={`p-1.5 active:scale-90 ${isCurrentMonth ? 'text-gray-700' : 'text-red-500/60 active:text-red-400'}`}
              disabled={isCurrentMonth}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* ═══ LOADING ═══ */}
        {loading ? (
          <div className="text-center py-16">
            <div className="w-10 h-10 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto" />
            <p className="text-[10px] text-red-500/40 mt-4 font-mono tracking-wider">CARGANDO DATOS...</p>
          </div>
        ) : tab === 'global' ? (
          /* ═══════════════════════════════════════ GLOBAL RANKING ═══ */
          globalBoard.length === 0 ? (
            <div className="text-center py-16">
              <Trophy size={40} className="mx-auto text-gray-700 mb-3" />
              <p className="text-sm text-gray-500">No hay jugadores registrados aún</p>
              <p className="text-[10px] text-gray-600 mt-1 font-mono">LA GALAXIA ESPERA...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* ── PODIUM ── */}
              <div className="relative bg-gray-900/50 rounded-2xl border border-red-900/15 p-4 pt-3 backdrop-blur-sm">
                {/* Subtle glow behind podium */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="relative flex items-end justify-center gap-3">
                  {/* 2nd place */}
                  <div className="flex-1 flex justify-center pt-6">
                    {globalBoard[1] ? (
                      <PodiumCard entry={globalBoard[1]} idx={1} avatarSize="md" />
                    ) : (
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 mx-auto" />
                        <p className="text-[9px] text-gray-600 mt-1">---</p>
                      </div>
                    )}
                  </div>

                  {/* 1st place (raised) */}
                  <div className="flex-1 flex justify-center">
                    {globalBoard[0] && (
                      <PodiumCard entry={globalBoard[0]} idx={0} avatarSize="xl" />
                    )}
                  </div>

                  {/* 3rd place */}
                  <div className="flex-1 flex justify-center pt-8">
                    {globalBoard[2] ? (
                      <PodiumCard entry={globalBoard[2]} idx={2} avatarSize="md" />
                    ) : (
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 mx-auto" />
                        <p className="text-[9px] text-gray-600 mt-1">---</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Podium base */}
                <div className="mt-3 h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />
              </div>

              {/* ── FULL LIST (#4+) ── */}
              {globalBoard.length > 3 && (
                <div className="space-y-2">
                  {globalBoard.slice(3).map((entry, i) => (
                    <ListRow
                      key={entry.userId}
                      entry={entry}
                      rank={i + 4}
                      isMe={supabaseUser?.id === entry.userId}
                      isGlobal={true}
                    />
                  ))}
                </div>
              )}

              {/* ── MY POSITION ── */}
              {supabaseUser && (() => {
                const myIdx = globalBoard.findIndex(e => e.userId === supabaseUser.id)
                if (myIdx >= 0) {
                  return (
                    <div className="bg-red-500/8 rounded-2xl px-4 py-3 border border-red-500/15 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-red-500/50 font-mono uppercase tracking-wider">Tu Posición</p>
                        <p className="text-lg font-extrabold text-red-400">#{myIdx + 1} <span className="text-xs text-gray-500 font-normal">de {globalBoard.length}</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-red-500/50 font-mono uppercase tracking-wider">XP Total</p>
                        <p className="text-lg font-extrabold text-gray-300 font-mono">{globalBoard[myIdx].xp}</p>
                      </div>
                    </div>
                  )
                }
                return null
              })()}
            </div>
          )
        ) : (
          /* ═══════════════════════════════════════ MONTHLY RANKING ═══ */
          monthlyBoard.length === 0 ? (
            <div className="text-center py-16">
              <Trophy size={40} className="mx-auto text-gray-700 mb-3" />
              <p className="text-sm text-gray-500">Sin datos este mes</p>
              <p className="text-[10px] text-gray-600 mt-1 font-mono">
                {isCurrentMonth ? 'JUEGUE PARTIDAS PARA APARECER' : 'SIN ACTIVIDAD REGISTRADA'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* ── PODIUM MONTHLY ── */}
              <div className="relative bg-gray-900/50 rounded-2xl border border-red-900/15 p-4 pt-3 backdrop-blur-sm">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="relative flex items-end justify-center gap-3">
                  {/* 2nd */}
                  <div className="flex-1 flex justify-center pt-6">
                    {monthlyBoard[1] ? (
                      <PodiumCard entry={monthlyBoard[1]} idx={1} avatarSize="md" />
                    ) : (
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 mx-auto" />
                        <p className="text-[9px] text-gray-600 mt-1">---</p>
                      </div>
                    )}
                  </div>

                  {/* 1st */}
                  <div className="flex-1 flex justify-center">
                    {monthlyBoard[0] && (
                      <PodiumCard entry={monthlyBoard[0]} idx={0} avatarSize="xl" />
                    )}
                  </div>

                  {/* 3rd */}
                  <div className="flex-1 flex justify-center pt-8">
                    {monthlyBoard[2] ? (
                      <PodiumCard entry={monthlyBoard[2]} idx={2} avatarSize="md" />
                    ) : (
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 mx-auto" />
                        <p className="text-[9px] text-gray-600 mt-1">---</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />
              </div>

              {/* ── REST OF LIST ── */}
              {monthlyBoard.length > 3 && (
                <div className="space-y-2">
                  {monthlyBoard.slice(3).map((entry) => (
                    <ListRow
                      key={entry.userId}
                      entry={entry}
                      rank={entry.rank}
                      isMe={supabaseUser?.id === entry.userId}
                      isGlobal={false}
                    />
                  ))}
                </div>
              )}

              {/* ── MY SUMMARY ── */}
              {supabaseUser && (() => {
                const myPos = monthlyBoard.findIndex(e => e.userId === supabaseUser.id) + 1
                if (myPos > 0) {
                  return (
                    <div className="bg-red-500/8 rounded-2xl px-4 py-3 border border-red-500/15 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-red-500/50 font-mono uppercase tracking-wider">Tu Posición</p>
                        <p className="text-lg font-extrabold text-red-400">#{myPos}</p>
                      </div>
                      <div className="text-right flex items-center gap-1.5">
                        <IconXp size={14} className="text-red-400" />
                        <span className="text-lg font-extrabold text-gray-300 font-mono">{myXp} XP</span>
                      </div>
                    </div>
                  )
                }
                if (myXp === 0 && isCurrentMonth) {
                  return (
                    <p className="text-[10px] text-gray-600 text-center font-mono tracking-wider">
                      GANE XP PARA APARECER EN EL RANKING
                    </p>
                  )
                }
                return null
              })()}
            </div>
          )
        )}

        {/* Footer decoration */}
        <div className="flex items-center justify-center gap-2 pt-2 pb-4">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-red-900/30" />
          <span className="text-[8px] text-red-900/40 font-mono tracking-[0.4em]">SWU COMPANION</span>
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-red-900/30" />
        </div>
      </div>
    </div>
  )
}

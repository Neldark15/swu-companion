/**
 * La Galaxia — Global Player Explorer
 * Browse players worldwide, category rankings, and activity feed.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Search, Users, Trophy, Zap, Swords,
  Star, Globe, Flame, Layers, Activity, TrendingUp,
} from 'lucide-react'
import {
  getGalaxyPlayers, getGalaxyRanking, getGalaxyActivity, getGalaxyStats,
  type GalaxyPlayer, type RankingCategory, type RankingEntry, type GalaxyActivity,
  type GalaxyStats,
} from '../../services/galaxyService'
import { RANKS } from '../../services/gamification'
import { getCountryByCode } from '../../data/regions'

// ─── Helpers ─────────────────────────────────────────────

function getRankForLevel(level: number) {
  return RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || RANKS[0]
}

function countryFlag(code: string): string {
  const c = getCountryByCode(code)
  return c?.flag || '🌐'
}

function countryName(code: string): string {
  const c = getCountryByCode(code)
  return c?.name || code
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// ─── Sub-components ───────────────────────────────────────

type TabId = 'explorer' | 'rankings' | 'activity' | 'map'

interface TabButtonProps {
  id: TabId
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}

function TabButton({ label, icon, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
        active
          ? 'bg-swu-accent/15 text-swu-accent border border-swu-accent/30'
          : 'text-swu-muted hover:text-swu-text border border-transparent'
      }`}
    >
      {icon}
      <span className="hidden sm:block">{label}</span>
    </button>
  )
}

// ─── Player Card ──────────────────────────────────────────

interface PlayerCardProps {
  player: GalaxyPlayer
  rank?: number
  onView: (userId: string) => void
}

function PlayerCard({ player, rank, onView }: PlayerCardProps) {
  const rankInfo = getRankForLevel(player.level)
  const winRate = player.matchesPlayed > 0
    ? Math.round((player.wins / player.matchesPlayed) * 100)
    : 0

  return (
    <button
      onClick={() => onView(player.userId)}
      className="bg-swu-surface rounded-xl p-3 border border-swu-border hover:border-swu-accent/30
                 transition-all text-left w-full group"
    >
      <div className="flex items-start gap-3">
        {/* Rank badge */}
        {rank !== undefined && (
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-1
            ${rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
              rank === 2 ? 'bg-gray-400/20 text-gray-300' :
              rank === 3 ? 'bg-amber-600/20 text-amber-500' :
              'bg-swu-bg text-swu-muted'}`}
          >
            {rank}
          </div>
        )}

        {/* Avatar */}
        <div className="text-2xl flex-shrink-0 w-10 h-10 bg-swu-bg rounded-xl flex items-center justify-center">
          {player.avatar}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-swu-text truncate">{player.name}</span>
            {player.country && (
              <span className="text-base leading-none" title={countryName(player.country)}>
                {countryFlag(player.country)}
              </span>
            )}
          </div>

          {/* Title */}
          {player.activeTitle && (
            <div className="text-[10px] text-swu-amber font-mono truncate">{player.activeTitle}</div>
          )}

          {/* Rank */}
          <div className={`text-[10px] font-medium ${rankInfo.color} mt-0.5`}>
            Nv.{player.level} · {rankInfo.name}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-swu-muted">
            <span className="flex items-center gap-0.5">
              <Zap size={9} className="text-swu-amber" />
              {player.xp.toLocaleString()} XP
            </span>
            <span className="flex items-center gap-0.5">
              <Swords size={9} className="text-swu-green" />
              {player.wins}V {winRate}%
            </span>
            {player.unlockedAchievements.length > 0 && (
              <span className="flex items-center gap-0.5">
                <Star size={9} className="text-yellow-400" />
                {player.unlockedAchievements.length}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ─── Ranking Entry Row ────────────────────────────────────

interface RankingRowProps {
  entry: RankingEntry
  category: RankingCategory
  onView: (userId: string) => void
}

function RankingRow({ entry, category, onView }: RankingRowProps) {
  const rankInfo = getRankForLevel(entry.level)

  const valueLabel: Record<RankingCategory, string> = {
    xp: `${entry.value.toLocaleString()} XP`,
    wins: `${entry.value} victorias`,
    tournaments: `${entry.value} torneos`,
    streak: `${entry.value} racha`,
    collection: `${entry.value} cartas`,
    achievements: `${entry.value} logros`,
  }

  return (
    <button
      onClick={() => onView(entry.userId)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-swu-surface border border-swu-border
                 hover:border-swu-accent/30 transition-all text-left"
    >
      {/* Position */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
        ${entry.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
          entry.rank === 2 ? 'bg-gray-400/20 text-gray-300' :
          entry.rank === 3 ? 'bg-amber-700/20 text-amber-500' :
          'bg-swu-bg text-swu-muted'}`}
      >
        {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}
      </div>

      {/* Avatar */}
      <div className="text-xl w-8 h-8 bg-swu-bg rounded-lg flex items-center justify-center flex-shrink-0">
        {entry.avatar}
      </div>

      {/* Name + rank */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-swu-text truncate">{entry.name}</span>
          {entry.country && (
            <span className="text-sm leading-none">{countryFlag(entry.country)}</span>
          )}
        </div>
        <div className={`text-[10px] ${rankInfo.color}`}>Nv.{entry.level} · {rankInfo.name}</div>
      </div>

      {/* Value */}
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-bold text-swu-accent">{valueLabel[category]}</div>
      </div>
    </button>
  )
}

// ─── Activity Item ────────────────────────────────────────

interface ActivityItemProps {
  item: GalaxyActivity
}

function ActivityItem({ item }: ActivityItemProps) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 bg-swu-surface rounded-xl border border-swu-border">
      <div className="text-xl w-9 h-9 bg-swu-bg rounded-lg flex items-center justify-center flex-shrink-0">
        {item.userAvatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-swu-text">{item.userName}</span>
          {item.userCountry && (
            <span className="text-sm leading-none">{countryFlag(item.userCountry)}</span>
          )}
          <span className="text-[10px] text-swu-muted ml-auto flex-shrink-0">{timeAgo(item.createdAt)}</span>
        </div>
        <p className="text-xs text-swu-muted mt-0.5 line-clamp-2">{item.message}</p>
      </div>
    </div>
  )
}

// ─── Map / Stats tab ─────────────────────────────────────

interface MapTabProps {
  players: GalaxyPlayer[]
  stats: GalaxyStats
}

function MapTab({ players, stats }: MapTabProps) {
  // Count by country
  const countryCount = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of players) {
      if (p.country) map.set(p.country, (map.get(p.country) || 0) + 1)
    }
    return Array.from(map.entries())
      .map(([code, count]) => ({ code, count, flag: countryFlag(code), name: countryName(code) }))
      .sort((a, b) => b.count - a.count)
  }, [players])

  // Count by continent
  const continentCount = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of players) {
      const cont = p.continent || 'Unknown'
      map.set(cont, (map.get(cont) || 0) + 1)
    }
    return Array.from(map.entries())
      .filter(([k]) => k !== 'Unknown')
      .sort((a, b) => b[1] - a[1])
  }, [players])

  const max = countryCount[0]?.count || 1

  return (
    <div className="space-y-4">
      {/* Global Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-swu-surface rounded-xl p-3 border border-swu-border text-center">
          <Users size={18} className="mx-auto text-swu-accent mb-1" />
          <div className="text-xl font-bold text-swu-text">{stats.totalPlayers}</div>
          <div className="text-[10px] text-swu-muted">Comandantes</div>
        </div>
        <div className="bg-swu-surface rounded-xl p-3 border border-swu-border text-center">
          <Globe size={18} className="mx-auto text-blue-400 mb-1" />
          <div className="text-xl font-bold text-swu-text">{stats.countriesRepresented}</div>
          <div className="text-[10px] text-swu-muted">Planetas</div>
        </div>
      </div>

      {/* Continents */}
      {continentCount.length > 0 && (
        <div className="bg-swu-surface rounded-xl border border-swu-border p-3">
          <h3 className="text-xs font-bold text-swu-muted mb-2 uppercase tracking-wider">Por Sector Galáctico</h3>
          <div className="space-y-1.5">
            {continentCount.map(([cont, count]) => (
              <div key={cont} className="flex items-center gap-2">
                <span className="text-xs text-swu-text w-24 truncate">{cont}</span>
                <div className="flex-1 bg-swu-bg rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-swu-accent/60 rounded-full"
                    style={{ width: `${(count / (players.length || 1)) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-swu-muted w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Countries */}
      <div>
        <h3 className="text-xs font-bold text-swu-muted mb-2 uppercase tracking-wider">Planetas con más Comandantes</h3>
        <div className="space-y-1.5">
          {countryCount.slice(0, 15).map(({ code, count, flag, name }) => (
            <div key={code} className="flex items-center gap-2 bg-swu-surface rounded-lg px-3 py-2 border border-swu-border">
              <span className="text-base leading-none w-6">{flag}</span>
              <span className="text-xs text-swu-text flex-1 truncate">{name}</span>
              <div className="flex-shrink-0 w-24 bg-swu-bg rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-swu-accent/50 rounded-full"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
              <span className="text-xs font-bold text-swu-accent w-8 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────

const RANKING_TABS: { id: RankingCategory; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'xp', label: 'XP Total', icon: <Zap size={13} />, description: 'Experiencia acumulada' },
  { id: 'wins', label: 'Victorias', icon: <Swords size={13} />, description: 'Duelos ganados' },
  { id: 'tournaments', label: 'Torneos', icon: <Trophy size={13} />, description: 'Torneos completados' },
  { id: 'streak', label: 'Racha', icon: <Flame size={13} />, description: 'Mejor racha de victorias' },
  { id: 'collection', label: 'Colección', icon: <Layers size={13} />, description: 'Cartas únicas' },
  { id: 'achievements', label: 'Logros', icon: <Star size={13} />, description: 'Logros desbloqueados' },
]

export function GalaxyPage() {
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<TabId>('explorer')
  const [rankingCategory, setRankingCategory] = useState<RankingCategory>('xp')

  const [players, setPlayers] = useState<GalaxyPlayer[]>([])
  const [rankings, setRankings] = useState<Map<RankingCategory, RankingEntry[]>>(new Map())
  const [activity, setActivity] = useState<GalaxyActivity[]>([])
  const [stats, setStats] = useState<GalaxyStats>({
    totalPlayers: 0, countriesRepresented: 0, topCountry: '', topCountryCount: 0,
  })

  const [loadingPlayers, setLoadingPlayers] = useState(true)
  const [loadingRanking, setLoadingRanking] = useState(false)
  const [loadingActivity, setLoadingActivity] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [filterContinent, setFilterContinent] = useState('')

  // Load players + stats on mount
  useEffect(() => {
    let cancelled = false
    async function init() {
      setLoadingPlayers(true)
      const [ps, st] = await Promise.all([getGalaxyPlayers(150), getGalaxyStats()])
      if (!cancelled) {
        setPlayers(ps)
        setStats(st)
        setLoadingPlayers(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  // Load activity when tab selected
  useEffect(() => {
    if (activeTab !== 'activity') return
    if (activity.length > 0) return
    let cancelled = false
    setLoadingActivity(true)
    getGalaxyActivity(40).then(items => {
      if (!cancelled) {
        setActivity(items)
        setLoadingActivity(false)
      }
    })
    return () => { cancelled = true }
  }, [activeTab, activity.length])

  // Load ranking when category changes
  const loadRanking = useCallback(async (cat: RankingCategory) => {
    if (rankings.has(cat)) return // already loaded
    setLoadingRanking(true)
    const data = await getGalaxyRanking(cat, 20)
    setRankings(prev => new Map(prev).set(cat, data))
    setLoadingRanking(false)
  }, [rankings])

  useEffect(() => {
    if (activeTab === 'rankings') {
      loadRanking(rankingCategory)
    }
  }, [activeTab, rankingCategory, loadRanking])

  const handleView = useCallback((userId: string) => {
    navigate(`/espionaje/${userId}`)
  }, [navigate])

  // Filtered players for explorer
  const filteredPlayers = useMemo(() => {
    let list = [...players]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q)
      )
    }
    if (filterContinent) {
      list = list.filter(p => p.continent === filterContinent)
    }
    return list
  }, [players, searchQuery, filterContinent])

  // Get unique continents from players
  const continents = useMemo(() => {
    const set = new Set<string>()
    for (const p of players) { if (p.continent) set.add(p.continent) }
    return Array.from(set).sort()
  }, [players])

  const currentRanking = rankings.get(rankingCategory) || []

  return (
    <div className="min-h-screen bg-swu-bg">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-swu-bg/95 backdrop-blur border-b border-swu-border">
        <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 py-3">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => navigate(-1)} className="text-swu-muted">
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-swu-text">
                🌌 La Galaxia
              </h1>
              <p className="text-[10px] text-swu-muted font-mono tracking-wider">
                {stats.totalPlayers > 0 ? `${stats.totalPlayers} Comandantes · ${stats.countriesRepresented} Planetas` : 'Explorador Global'}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <TabButton id="explorer" label="Explorador" icon={<Users size={15} />}
              active={activeTab === 'explorer'} onClick={() => setActiveTab('explorer')} />
            <TabButton id="rankings" label="Rankings" icon={<Trophy size={15} />}
              active={activeTab === 'rankings'} onClick={() => setActiveTab('rankings')} />
            <TabButton id="activity" label="Actividad" icon={<Activity size={15} />}
              active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} />
            <TabButton id="map" label="Mapa" icon={<Globe size={15} />}
              active={activeTab === 'map'} onClick={() => setActiveTab('map')} />
          </div>
        </div>
      </div>

      <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 py-4">

        {/* ── EXPLORER TAB ── */}
        {activeTab === 'explorer' && (
          <div className="space-y-3">
            {/* Search + Filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar comandante o país…"
                  className="w-full pl-9 pr-3 py-2.5 bg-swu-surface border border-swu-border rounded-xl
                             text-sm text-swu-text placeholder:text-swu-muted/60 focus:outline-none
                             focus:border-swu-accent/50"
                />
              </div>
              {continents.length > 0 && (
                <select
                  value={filterContinent}
                  onChange={e => setFilterContinent(e.target.value)}
                  className="bg-swu-surface border border-swu-border rounded-xl px-2 py-2 text-xs text-swu-text
                             focus:outline-none focus:border-swu-accent/50 min-w-[90px]"
                >
                  <option value="">Todos</option>
                  {continents.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Count */}
            <div className="text-[11px] text-swu-muted">
              {loadingPlayers ? 'Cargando comandantes…' : `${filteredPlayers.length} comandante${filteredPlayers.length !== 1 ? 's' : ''} encontrado${filteredPlayers.length !== 1 ? 's' : ''}`}
            </div>

            {/* Players grid */}
            {loadingPlayers ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-16 bg-swu-surface rounded-xl animate-pulse border border-swu-border" />
                ))}
              </div>
            ) : filteredPlayers.length === 0 ? (
              <div className="text-center py-16 text-swu-muted">
                <Users size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No se encontraron comandantes</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {filteredPlayers.map((player, i) => (
                  <PlayerCard
                    key={player.userId}
                    player={player}
                    rank={i + 1}
                    onView={handleView}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── RANKINGS TAB ── */}
        {activeTab === 'rankings' && (
          <div className="space-y-3">
            {/* Category selector */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {RANKING_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setRankingCategory(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold
                               whitespace-nowrap transition-all border ${
                    rankingCategory === tab.id
                      ? 'bg-swu-accent/15 text-swu-accent border-swu-accent/30'
                      : 'bg-swu-surface text-swu-muted border-swu-border hover:text-swu-text'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Description */}
            <div className="flex items-center gap-2 text-[11px] text-swu-muted">
              <TrendingUp size={12} />
              <span>{RANKING_TABS.find(t => t.id === rankingCategory)?.description}</span>
            </div>

            {/* List */}
            {loadingRanking ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="h-14 bg-swu-surface rounded-xl animate-pulse border border-swu-border" />
                ))}
              </div>
            ) : currentRanking.length === 0 ? (
              <div className="text-center py-16 text-swu-muted">
                <Trophy size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Sin datos en esta categoría</p>
              </div>
            ) : (
              <div className="space-y-2">
                {currentRanking.map(entry => (
                  <RankingRow
                    key={entry.userId}
                    entry={entry}
                    category={rankingCategory}
                    onView={handleView}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVITY TAB ── */}
        {activeTab === 'activity' && (
          <div className="space-y-2">
            {loadingActivity ? (
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-16 bg-swu-surface rounded-xl animate-pulse border border-swu-border" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <div className="text-center py-16 text-swu-muted">
                <Activity size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Sin actividad reciente</p>
                <p className="text-[11px] mt-1">Las transmisiones de la comunidad aparecerán aquí</p>
              </div>
            ) : (
              activity.map(item => (
                <ActivityItem key={item.id} item={item} />
              ))
            )}
          </div>
        )}

        {/* ── MAP TAB ── */}
        {activeTab === 'map' && (
          <MapTab players={players} stats={stats} />
        )}

      </div>
    </div>
  )
}

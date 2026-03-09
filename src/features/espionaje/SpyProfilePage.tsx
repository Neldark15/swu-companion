import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, Send, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  getPlayerPublicStats,
  sendGift,
  getRemainingGifts,
  GIFT_TYPES,
  type GiftType,
} from '../../services/giftService'
import {
  calculateLevel,
  getAspectBars,
  ACHIEVEMENTS,
  ASPECT_CONFIG,
  TIER_CONFIG,
  type PlayerStats,
} from '../../services/gamification'
import { AspectIcon } from '../../components/icons/AspectIcon'

const swAvatarIds = ['chewbacca','r2d2','c3po','bb8','pilot','boba-fett','stormtrooper','darth-vader','phasma','kylo-ren','jedi-order','phoenix','rebel-alliance','galactic-empire','first-order','first-order-2','starfighter','sith-empire','rebel-alliance-2','jedi-order-2','new-republic','empire-gear','separatist','galactic-republic']

/** Convert Supabase snake_case stats to PlayerStats for display */
function statsFromRow(row: Record<string, unknown>): PlayerStats {
  return {
    profileId: '',
    xp: (row.xp as number) || 0,
    level: (row.level as number) || 1,
    wins: (row.wins as number) || 0,
    losses: (row.losses as number) || 0,
    matchesPlayed: (row.matches_played as number) || 0,
    tournamentsCreated: (row.tournaments_created as number) || 0,
    tournamentsFinished: (row.tournaments_finished as number) || 0,
    tournamentWins: (row.tournament_wins as number) || 0,
    tournamentTopPlacements: (row.tournament_top_placements as number) || 0,
    decksCreated: (row.decks_created as number) || 0,
    decksValid: (row.decks_valid as number) || 0,
    cardsCollected: (row.cards_collected as number) || 0,
    cardsFavorited: (row.cards_favorited as number) || 0,
    legendaryCards: (row.legendary_cards as number) || 0,
    rareCards: (row.rare_cards as number) || 0,
    currentStreak: (row.current_streak as number) || 0,
    bestStreak: (row.best_streak as number) || 0,
    loginDays: (row.login_days as number) || 1,
    lastLoginDate: (row.last_login_date as string) || '',
    modesPlayed: (row.modes_played as string[]) || [],
    arenaMatchesLogged: (row.arena_matches_logged as number) || 0,
    giftsReceived: (row.gifts_received as number) || 0,
    giftsSent: (row.gifts_sent as number) || 0,
    leccionesJediReceived: (row.lecciones_jedi_received as number) || 0,
    creditosImperialesReceived: (row.creditos_imperiales_received as number) || 0,
    beskarReceived: (row.beskar_received as number) || 0,
    unlockedAchievements: (row.unlocked_achievements as string[]) || [],
    achievementDates: (row.achievement_dates as Record<string, number>) || {},
  }
}

export function SpyProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { supabaseUser } = useAuth()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<{ name: string; avatar: string; bio: string } | null>(null)
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null)
  const [remaining, setRemaining] = useState(5)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [selectedGift, setSelectedGift] = useState<GiftType | null>(null)

  // Load target player data
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { profile: p, stats } = await getPlayerPublicStats(userId!)
        if (cancelled) return
        setProfile(p)
        if (stats) setPlayerStats(statsFromRow(stats))

        // Check remaining gifts for current user
        if (supabaseUser?.id) {
          const rem = await getRemainingGifts(supabaseUser.id)
          if (!cancelled) setRemaining(rem)
        }
      } catch (e) {
        console.warn('[SpyProfile] Load error:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [userId, supabaseUser?.id])

  const handleSendGift = async (giftType: GiftType) => {
    if (!supabaseUser?.id || !userId || sending) return
    setSending(true)
    setToast(null)

    const result = await sendGift(supabaseUser.id, userId, giftType)

    if (result.success) {
      setToast({ type: 'success', message: `¡Regalo enviado con éxito!` })
      setRemaining(prev => Math.max(0, prev - 1))
      setSelectedGift(null)
    } else {
      setToast({ type: 'error', message: result.error || 'Error al enviar' })
    }

    setSending(false)
    setTimeout(() => setToast(null), 4000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-swu-bg flex items-center justify-center">
        <Loader2 size={28} className="text-indigo-400 animate-spin" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-swu-bg flex flex-col items-center justify-center gap-4">
        <p className="text-swu-muted">Jugador no encontrado</p>
        <button onClick={() => navigate(-1)} className="text-indigo-400 text-sm">Volver</button>
      </div>
    )
  }

  const levelInfo = playerStats ? calculateLevel(playerStats.xp) : null
  const aspectBars = playerStats ? getAspectBars(playerStats) : []
  const unlockedIds = playerStats?.unlockedAchievements || []
  const isSelf = supabaseUser?.id === userId

  return (
    <div className="min-h-screen bg-swu-bg pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-swu-bg/95 backdrop-blur border-b border-swu-border">
        <div className="max-w-lg lg:max-w-3xl mx-auto px-4 lg:px-6 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-swu-muted">
            <ArrowLeft size={20} />
          </button>
          <Eye size={18} className="text-indigo-400" />
          <h1 className="text-base font-bold text-swu-text flex-1 truncate">Perfil de {profile.name}</h1>
        </div>
      </div>

      <div className="max-w-lg lg:max-w-3xl mx-auto px-4 lg:px-6 py-4 space-y-5">
        {/* Player card */}
        <div className="bg-swu-surface rounded-2xl border border-swu-border p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-swu-bg flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden border-2 border-indigo-500/30">
              {swAvatarIds.includes(profile.avatar)
                ? <img src={`/avatars/${profile.avatar}.png`} alt="" className="w-12 h-12 object-contain" />
                : <span>{profile.avatar}</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-swu-text truncate">{profile.name}</h2>
              {profile.bio && <p className="text-xs text-swu-muted mt-0.5 line-clamp-2">{profile.bio}</p>}
              {levelInfo && (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-xs font-bold ${levelInfo.rank.color}`}>
                    Nv.{levelInfo.level}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${levelInfo.rank.bgColor} ${levelInfo.rank.color} font-bold`}>
                    {levelInfo.rank.name}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quick stats */}
          {playerStats && (
            <div className="grid grid-cols-4 gap-2 mt-4">
              {[
                { label: 'XP', value: playerStats.xp, color: 'text-amber-400' },
                { label: 'Victorias', value: playerStats.wins, color: 'text-green-400' },
                { label: 'Partidas', value: playerStats.matchesPlayed, color: 'text-blue-400' },
                { label: 'Logros', value: unlockedIds.length, color: 'text-purple-400' },
              ].map(s => (
                <div key={s.label} className="bg-swu-bg rounded-lg p-2 text-center">
                  <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[9px] text-swu-muted uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gift section — only if logged in and not self */}
        {supabaseUser && !isSelf && (
          <div className="bg-swu-surface rounded-2xl border border-indigo-500/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send size={16} className="text-indigo-400" />
                <h3 className="text-sm font-bold text-indigo-300">Enviar Transmisión</h3>
              </div>
              <span className="text-[10px] font-mono text-swu-muted">
                {remaining}/5 restantes hoy
              </span>
            </div>

            {/* Gift type buttons */}
            <div className="grid grid-cols-3 gap-2">
              {GIFT_TYPES.map(gift => (
                <button
                  key={gift.type}
                  onClick={() => setSelectedGift(selectedGift === gift.type ? null : gift.type)}
                  disabled={remaining <= 0 || sending}
                  className={`rounded-xl p-3 border text-center transition-all ${
                    selectedGift === gift.type
                      ? `${gift.bgColor} border-indigo-400/50`
                      : 'bg-swu-bg border-swu-border hover:border-swu-border/60'
                  } ${remaining <= 0 ? 'opacity-40 cursor-not-allowed' : 'active:scale-95'}`}
                >
                  <span className="text-2xl block mb-1">{gift.icon}</span>
                  <p className={`text-[10px] font-bold ${gift.color}`}>{gift.label}</p>
                  <p className="text-[9px] text-swu-muted">+{gift.xp} XP</p>
                </button>
              ))}
            </div>

            {/* Confirmation */}
            {selectedGift && remaining > 0 && (
              <div className="bg-indigo-500/10 rounded-xl p-3 border border-indigo-500/20">
                <p className="text-xs text-indigo-200 mb-2">
                  {GIFT_TYPES.find(g => g.type === selectedGift)?.description}
                </p>
                <button
                  onClick={() => handleSendGift(selectedGift)}
                  disabled={sending}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold py-2 rounded-lg
                             transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  {sending ? 'Enviando...' : `Enviar a ${profile.name}`}
                </button>
              </div>
            )}

            {/* Toast */}
            {toast && (
              <div className={`flex items-center gap-2 rounded-lg p-2.5 text-xs font-medium ${
                toast.type === 'success'
                  ? 'bg-green-500/15 text-green-300 border border-green-500/20'
                  : 'bg-red-500/15 text-red-300 border border-red-500/20'
              }`}>
                {toast.type === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {toast.message}
              </div>
            )}
          </div>
        )}

        {/* Aspect Bars */}
        {aspectBars.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-swu-muted uppercase tracking-widest">Barras de Aspecto</p>
            <div className="space-y-2">
              {aspectBars.map(bar => (
                <div key={bar.aspect} className="bg-swu-surface rounded-xl p-3 border border-swu-border">
                  <div className="flex items-center gap-2 mb-1.5">
                    <AspectIcon aspect={bar.aspect} size={18} />
                    <span className={`text-xs font-bold ${bar.textColor}`}>{bar.label}</span>
                    <span className="text-[9px] text-swu-muted font-mono ml-auto">
                      {bar.displayValue}
                    </span>
                    <span className="text-[9px] font-bold" style={{ color: TIER_CONFIG[bar.tier].borderColor }}>
                      {TIER_CONFIG[bar.tier].label}
                    </span>
                  </div>
                  <div className="h-2 bg-swu-bg rounded-full overflow-hidden"
                    style={{ borderColor: TIER_CONFIG[bar.tier].borderColor, borderWidth: '1px' }}>
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${bar.color} transition-all duration-500`}
                      style={{ width: `${bar.tierProgress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements */}
        {playerStats && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-swu-muted uppercase tracking-widest">Logros</p>
              <span className="text-[11px] text-swu-muted font-mono">
                {unlockedIds.length}/{ACHIEVEMENTS.length}
              </span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
              {ACHIEVEMENTS.filter(a => unlockedIds.includes(a.id)).map(ach => {
                const config = ASPECT_CONFIG[ach.aspect]
                return (
                  <div
                    key={ach.id}
                    className={`rounded-lg p-2 border text-center ${config.bgColor} ${config.borderColor}`}
                    title={`${ach.name}: ${ach.description}`}
                  >
                    <span className="text-lg block">{ach.icon}</span>
                    <p className={`text-[8px] font-bold ${config.textColor} truncate`}>{ach.name}</p>
                  </div>
                )
              })}
            </div>
            {unlockedIds.length === 0 && (
              <p className="text-center text-swu-muted text-xs py-4">Este jugador aún no tiene logros</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, Send, Loader2, CheckCircle, XCircle, Swords, BookOpen, CheckCircle2, AlertTriangle } from 'lucide-react'
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
import { getRelationship, type RelationshipLevel } from '../../services/relationshipService'
import { getTitleById, getTitleRarity } from '../../services/cosmeticsService'
import { statsFromSnake, getPublicDecks } from '../../services/sync'
import { getCardById } from '../../services/swuApi'
import { GiftIcon } from '../../components/icons/GiftIcon'

const swAvatarIds = ['chewbacca','r2d2','c3po','bb8','pilot','boba-fett','stormtrooper','darth-vader','phasma','kylo-ren','jedi-order','phoenix','rebel-alliance','galactic-empire','first-order','first-order-2','starfighter','sith-empire','rebel-alliance-2','jedi-order-2','new-republic','empire-gear','separatist','galactic-republic']

/** Convert Supabase snake_case stats to PlayerStats for display */
function statsFromRow(row: Record<string, unknown>): PlayerStats {
  return statsFromSnake(row, '')
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
  const [bond, setBond] = useState<{ points: number; level: number; levelInfo: RelationshipLevel } | null>(null)
  const [publicDecks, setPublicDecks] = useState<{
    id: string; name: string; format: string; isValid: boolean
    leaderName: string; leaderCardId: string; baseName: string; baseCardId: string; mainDeckCount: number
  }[]>([])
  const [deckImages, setDeckImages] = useState<Map<string, string>>(new Map())

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

        // Load public decks
        const decks = await getPublicDecks(userId!)
        if (!cancelled) {
          setPublicDecks(decks)
          // Load leader/base images
          const cardIds = new Set<string>()
          decks.forEach(d => {
            if (d.leaderCardId) cardIds.add(d.leaderCardId)
            if (d.baseCardId) cardIds.add(d.baseCardId)
          })
          const imgs = new Map<string, string>()
          await Promise.all([...cardIds].map(async cid => {
            const card = await getCardById(cid)
            if (card?.imageUrl) imgs.set(cid, card.imageUrl)
          }))
          if (!cancelled) setDeckImages(imgs)
        }

        // Check remaining gifts + bond for current user
        if (supabaseUser?.id) {
          const [rem, rel] = await Promise.all([
            getRemainingGifts(supabaseUser.id),
            getRelationship(supabaseUser.id, userId!),
          ])
          if (!cancelled) {
            setRemaining(rem)
            setBond(rel)
          }
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
              {/* Active title */}
              {playerStats?.activeTitle && (() => {
                const t = getTitleById(playerStats.activeTitle)
                if (!t) return null
                const r = getTitleRarity(playerStats.activeTitle)
                return <p className={`text-[10px] font-bold ${r.color} mt-0.5`}>{t.name}</p>
              })()}
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

        {/* Bond level — only if logged in and not self */}
        {bond && !isSelf && bond.points > 0 && (
          <div className="bg-swu-surface rounded-2xl border border-swu-border p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{bond.levelInfo.icon}</span>
              <div className="flex-1">
                <p className={`text-sm font-bold ${bond.levelInfo.color}`}>{bond.levelInfo.name}</p>
                <p className="text-[10px] text-swu-muted">Vínculo · {bond.points} pts</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-swu-muted">Nivel {bond.level}/4</p>
              </div>
            </div>
            {/* Bond progress bar */}
            <div className="mt-2 h-1.5 bg-swu-bg rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                style={{ width: `${Math.min((bond.points / 100) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Reputation */}
        {playerStats && playerStats.socialReputation > 0 && (
          <div className="bg-swu-surface rounded-2xl border border-swu-border p-4">
            <div className="flex items-center gap-2">
              <span className="text-base">⭐</span>
              <span className="text-xs font-bold text-swu-muted uppercase tracking-wider">Reputación</span>
              <span className="text-sm font-bold text-amber-400 ml-auto">{playerStats.socialReputation}</span>
              <span className="text-amber-400 text-xs">
                {'★'.repeat(Math.min(Math.floor(playerStats.socialReputation / 20) + 1, 5))}
                {'☆'.repeat(Math.max(5 - Math.floor(playerStats.socialReputation / 20) - 1, 0))}
              </span>
            </div>
          </div>
        )}

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
                  <span className="block mb-1 flex justify-center"><GiftIcon type={gift.type} size={36} /></span>
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

        {/* Public Decks — always visible */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Swords size={14} className="text-indigo-400" />
              <p className="text-xs font-bold text-swu-muted uppercase tracking-widest">Decks Públicos</p>
            </div>
            <span className="text-[11px] text-swu-muted font-mono">{publicDecks.length}</span>
          </div>

          {publicDecks.length === 0 ? (
            <div className="bg-swu-surface rounded-xl border border-dashed border-swu-border/50 p-6 flex flex-col items-center justify-center gap-2">
              <Swords size={24} className="text-swu-muted/20" />
              <p className="text-xs text-swu-muted text-center">Este jugador no tiene decks públicos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {publicDecks.map(d => {
                const leaderImg = deckImages.get(d.leaderCardId)
                const baseImg = deckImages.get(d.baseCardId)
                return (
                  <div key={d.id} className="bg-swu-surface rounded-xl border border-swu-border overflow-hidden">
                    <div className="flex h-16 bg-swu-bg relative">
                      {/* Leader thumbnail */}
                      <div className="flex-1 relative overflow-hidden">
                        {leaderImg ? (
                          <img src={leaderImg} alt={d.leaderName} className="w-full h-full object-cover object-top" loading="lazy"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Swords size={16} className="text-swu-muted/20" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-0.5">
                          <p className="text-[8px] text-swu-amber font-bold">LÍDER</p>
                          <p className="text-[9px] text-white font-medium truncate">{d.leaderName || '—'}</p>
                        </div>
                      </div>
                      <div className="w-px bg-swu-border" />
                      {/* Base thumbnail */}
                      <div className="flex-1 relative overflow-hidden">
                        {baseImg ? (
                          <img src={baseImg} alt={d.baseName} className="w-full h-full object-cover object-top" loading="lazy"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen size={16} className="text-swu-muted/20" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-0.5">
                          <p className="text-[8px] text-swu-green font-bold">BASE</p>
                          <p className="text-[9px] text-white font-medium truncate">{d.baseName || '—'}</p>
                        </div>
                      </div>
                      {/* Validity badge */}
                      <div className="absolute top-1 right-1">
                        {d.isValid ? (
                          <div className="bg-swu-green/90 rounded-full p-0.5"><CheckCircle2 size={10} className="text-white" /></div>
                        ) : (
                          <div className="bg-swu-amber/90 rounded-full p-0.5"><AlertTriangle size={10} className="text-white" /></div>
                        )}
                      </div>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-swu-text truncate">{d.name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] font-mono text-swu-accent font-bold">{d.mainDeckCount} cartas</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 font-bold">
                          {d.format === 'twin_suns' ? 'Twin Suns' : d.format.charAt(0).toUpperCase() + d.format.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

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

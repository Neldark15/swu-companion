import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Globe, Users, Search, ChevronRight, Crown,
  MessageCircle, Send, Heart, Trash2, Trophy, ArrowUpRight,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  getCommunityStats,
  getCommunityMembers,
  getCommunityPosts,
  createCommunityPost,
  likeCommunityPost,
  deleteCommunityPost,
  type CommunityMember,
  type CommunityStats,
  type CommunityPost,
} from '../../services/communityService'
import {
  CONTINENTS,
  getCountryByCode,
  getContinentByCountryCode,
  type Country,
} from '../../data/regions'
import { ProfileFrame } from '../profile/components/ProfileFrame'
import { calculateLevel } from '../../services/gamification'

type View = 'continents' | 'countries' | 'community'

const swAvatarIds = [
  'chewbacca', 'r2d2', 'c3po', 'bb8', 'pilot', 'boba-fett', 'stormtrooper',
  'darth-vader', 'phasma', 'kylo-ren', 'jedi-order', 'phoenix', 'rebel-alliance',
  'galactic-empire', 'first-order', 'first-order-2', 'starfighter', 'sith-empire',
  'rebel-alliance-2', 'jedi-order-2', 'new-republic', 'empire-gear', 'separatist', 'galactic-republic',
]

function MemberAvatar({ avatar, level, size = 40 }: { avatar: string; level?: number; size?: number }) {
  const frameSize = size + 16
  return (
    <ProfileFrame level={level ?? 1} size={frameSize}>
      <div className="w-full h-full flex items-center justify-center bg-swu-bg overflow-hidden">
        {avatar.startsWith('data:image/')
          ? <img src={avatar} alt="" className="w-full h-full object-cover rounded-full" />
          : swAvatarIds.includes(avatar)
            ? <img src={`/avatars/${avatar}.png`} alt="" className="object-contain" style={{ width: size * 0.75, height: size * 0.75 }} />
            : <span style={{ fontSize: size * 0.5 }}>{avatar}</span>
        }
      </div>
    </ProfileFrame>
  )
}

function PostAvatar({ avatar }: { avatar: string }) {
  if (avatar.startsWith('data:image/')) {
    return <img src={avatar} alt="" className="w-8 h-8 object-cover rounded-full" />
  }
  if (swAvatarIds.includes(avatar)) {
    return <img src={`/avatars/${avatar}.png`} alt="" className="w-6 h-6 object-contain" />
  }
  return <span className="text-lg">{avatar}</span>
}

export function CommunityPage() {
  const navigate = useNavigate()
  const { currentProfile, supabaseUser } = useAuth()

  const [view, setView] = useState<View>('continents')
  const [selectedContinent, setSelectedContinent] = useState('')
  const [selectedCountry, setSelectedCountry] = useState('')
  const [search, setSearch] = useState('')

  // Data
  const [stats, setStats] = useState<CommunityStats[]>([])
  const [members, setMembers] = useState<CommunityMember[]>([])
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)

  // Post creation
  const [newPostContent, setNewPostContent] = useState('')
  const [posting, setPosting] = useState(false)

  // Load community stats on mount
  useEffect(() => {
    setLoading(true)
    getCommunityStats().then(s => {
      setStats(s)
      setLoading(false)
    })
  }, [])

  // Load members when entering a country community
  useEffect(() => {
    if (view === 'community' && selectedCountry) {
      setLoading(true)
      Promise.all([
        getCommunityMembers(selectedCountry),
        getCommunityPosts(selectedCountry),
      ]).then(([m, p]) => {
        setMembers(m)
        setPosts(p)
        setLoading(false)
      })
    }
  }, [view, selectedCountry])

  const handleSelectContinent = (continentId: string) => {
    setSelectedContinent(continentId)
    setView('countries')
  }

  const handleSelectCountry = (countryCode: string) => {
    setSelectedCountry(countryCode)
    setView('community')
  }

  const handleBack = () => {
    if (view === 'community') {
      setView('countries')
      setMembers([])
      setPosts([])
    } else if (view === 'countries') {
      setView('continents')
      setSelectedContinent('')
    } else {
      navigate(-1)
    }
  }

  const handlePost = useCallback(async () => {
    if (!supabaseUser || !currentProfile || !newPostContent.trim() || posting) return
    setPosting(true)
    const post = await createCommunityPost(
      supabaseUser.id,
      currentProfile.name,
      currentProfile.avatar,
      selectedCountry,
      newPostContent.trim(),
    )
    if (post) {
      setPosts(prev => [post, ...prev])
      setNewPostContent('')
    }
    setPosting(false)
  }, [supabaseUser, currentProfile, newPostContent, posting, selectedCountry])

  const handleLike = useCallback(async (postId: string) => {
    const ok = await likeCommunityPost(postId)
    if (ok) {
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, likes: p.likes + 1, likedByMe: true } : p,
      ))
    }
  }, [])

  const handleDeletePost = useCallback(async (postId: string) => {
    const ok = await deleteCommunityPost(postId)
    if (ok) {
      setPosts(prev => prev.filter(p => p.id !== postId))
    }
  }, [])

  const getPlayerCount = (code: string) => stats.find(s => s.countryCode === code)?.playerCount || 0

  const myCountry = currentProfile?.country

  // Title based on view
  const title = view === 'community'
    ? `${getCountryByCode(selectedCountry)?.flag || ''} ${getCountryByCode(selectedCountry)?.name || selectedCountry}`
    : view === 'countries'
      ? CONTINENTS.find(c => c.id === selectedContinent)?.name || 'Región'
      : 'Comunidades Galácticas'

  return (
    <div className="min-h-screen bg-swu-bg pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-swu-bg/95 backdrop-blur border-b border-swu-border">
        <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 py-3 flex items-center gap-3">
          <button onClick={handleBack} className="text-swu-muted">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-swu-text truncate">{title}</h1>
            {view === 'community' && (
              <p className="text-[10px] text-swu-muted">{members.length} jugadores registrados</p>
            )}
          </div>
          {view === 'continents' && myCountry && (
            <button
              onClick={() => handleSelectCountry(myCountry)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-swu-accent/15 text-swu-accent text-xs font-medium"
            >
              {getCountryByCode(myCountry)?.flag} Mi comunidad
            </button>
          )}
        </div>
      </div>

      <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 py-4 space-y-4">
        {/* Loading */}
        {loading && (
          <div className="text-center py-12 text-swu-muted">
            <div className="animate-spin w-8 h-8 border-2 border-swu-accent border-t-transparent rounded-full mx-auto mb-3" />
            Cargando comunidades...
          </div>
        )}

        {/* ═══ CONTINENT LIST ═══ */}
        {!loading && view === 'continents' && (
          <>
            {/* Hero banner */}
            <div className="bg-gradient-to-br from-swu-accent/20 to-purple-500/10 rounded-2xl p-5 border border-swu-accent/20 text-center">
              <Globe size={36} className="mx-auto text-swu-accent mb-2" />
              <h2 className="text-base font-extrabold text-swu-text mb-1">Comunidades Galácticas</h2>
              <p className="text-xs text-swu-muted">
                Conecte con jugadores de Star Wars Unlimited de todo el mundo.
                {!myCountry && (
                  <button
                    onClick={() => navigate('/profile')}
                    className="text-swu-accent font-bold ml-1 underline"
                  >
                    Configure su región en su perfil
                  </button>
                )}
              </p>
              {stats.length > 0 && (
                <p className="text-[10px] text-swu-accent mt-2 font-mono">
                  {stats.reduce((s, c) => s + c.playerCount, 0)} jugadores en {stats.length} países
                </p>
              )}
            </div>

            {/* Continent cards */}
            <div className="space-y-2">
              {CONTINENTS.map(cont => {
                const countryCount = cont.countries.reduce((s, c) => s + getPlayerCount(c.code), 0)
                const activeCountries = cont.countries.filter(c => getPlayerCount(c.code) > 0)

                return (
                  <button
                    key={cont.id}
                    onClick={() => handleSelectContinent(cont.id)}
                    className="w-full bg-swu-surface rounded-xl p-4 border border-swu-border flex items-center gap-3 active:scale-[0.99] transition-all hover:border-swu-accent/30 text-left"
                  >
                    <span className="text-3xl">{cont.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-swu-text">{cont.name}</p>
                      <p className="text-[10px] text-swu-muted">
                        {cont.countries.length} países
                        {countryCount > 0 && ` · ${countryCount} jugadores`}
                        {activeCountries.length > 0 && (
                          <span className="text-swu-accent ml-1">
                            ({activeCountries.length} activos)
                          </span>
                        )}
                      </p>
                    </div>
                    <ChevronRight size={18} className="text-swu-muted" />
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* ═══ COUNTRY LIST ═══ */}
        {!loading && view === 'countries' && (
          <>
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
              <input
                type="text"
                placeholder="Buscar país..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-swu-surface border border-swu-border rounded-xl pl-9 pr-3 py-2.5
                           text-sm text-swu-text placeholder:text-swu-muted focus:border-swu-accent outline-none"
              />
            </div>

            {/* Country list */}
            <div className="space-y-1.5">
              {(CONTINENTS.find(c => c.id === selectedContinent)?.countries || [])
                .filter(c => {
                  if (!search.trim()) return true
                  const q = search.toLowerCase()
                  return c.name.toLowerCase().includes(q) || c.nameEn.toLowerCase().includes(q)
                })
                .sort((a, b) => getPlayerCount(b.code) - getPlayerCount(a.code))
                .map(country => {
                  const count = getPlayerCount(country.code)
                  const isMine = country.code === myCountry

                  return (
                    <button
                      key={country.code}
                      onClick={() => handleSelectCountry(country.code)}
                      className={`w-full bg-swu-surface rounded-xl p-3.5 border flex items-center gap-3 active:scale-[0.99] transition-all text-left ${
                        isMine ? 'border-swu-accent/40 bg-swu-accent/5' : 'border-swu-border hover:border-swu-accent/20'
                      }`}
                    >
                      <span className="text-2xl">{country.flag}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-swu-text">
                          {country.name}
                          {isMine && <span className="text-swu-accent text-[10px] ml-2">★ Mi país</span>}
                        </p>
                        <p className="text-[10px] text-swu-muted">
                          {count > 0 ? `${count} jugador${count !== 1 ? 'es' : ''}` : 'Sin jugadores aún'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {count > 0 && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-swu-accent/10 text-swu-accent text-[10px] font-bold">
                            <Users size={10} /> {count}
                          </span>
                        )}
                        <ChevronRight size={16} className="text-swu-muted" />
                      </div>
                    </button>
                  )
                })}
            </div>
          </>
        )}

        {/* ═══ COMMUNITY VIEW ═══ */}
        {!loading && view === 'community' && (
          <>
            {/* Country banner */}
            <div className="bg-gradient-to-br from-swu-accent/15 to-amber-500/10 rounded-2xl p-4 border border-swu-accent/20 text-center">
              <span className="text-4xl block mb-1">{getCountryByCode(selectedCountry)?.flag}</span>
              <h2 className="text-base font-extrabold text-swu-text">
                {getCountryByCode(selectedCountry)?.name}
              </h2>
              <p className="text-[10px] text-swu-muted mt-1">
                {getContinentByCountryCode(selectedCountry)?.name || ''}
                {' · '}
                {members.length} jugador{members.length !== 1 ? 'es' : ''}
              </p>
            </div>

            {/* Members ranking */}
            {members.length > 0 && (
              <div className="bg-swu-surface rounded-xl border border-swu-border p-4">
                <h3 className="text-xs font-bold text-swu-muted mb-3 flex items-center gap-2">
                  <Crown size={14} className="text-swu-amber" /> Jugadores
                </h3>
                <div className="space-y-2">
                  {members.slice(0, 20).map((member, idx) => {
                    const lvl = member.level || (member.xp ? calculateLevel(member.xp).level : 1)
                    return (
                      <button
                        key={member.id}
                        onClick={() => navigate(`/espionaje/${member.id}`)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-swu-bg/50 transition-colors text-left"
                      >
                        <span className={`w-5 text-center text-xs font-bold ${
                          idx === 0 ? 'text-swu-amber' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-amber-700' : 'text-swu-muted'
                        }`}>
                          {idx + 1}
                        </span>
                        <MemberAvatar avatar={member.avatar} level={lvl} size={32} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-swu-text truncate">{member.name}</p>
                          <p className="text-[10px] text-swu-muted">
                            Nivel {lvl} · {member.xp?.toLocaleString() || 0} XP
                          </p>
                        </div>
                        <ArrowUpRight size={14} className="text-swu-muted" />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Community Feed */}
            <div className="bg-swu-surface rounded-xl border border-swu-border p-4">
              <h3 className="text-xs font-bold text-swu-muted mb-3 flex items-center gap-2">
                <MessageCircle size={14} className="text-swu-accent" /> Transmisiones de la Comunidad
              </h3>

              {/* New post input */}
              {supabaseUser && currentProfile?.country === selectedCountry && (
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Comparta algo con su comunidad..."
                    value={newPostContent}
                    onChange={e => setNewPostContent(e.target.value)}
                    maxLength={280}
                    onKeyDown={e => e.key === 'Enter' && handlePost()}
                    className="flex-1 bg-swu-bg border border-swu-border rounded-xl px-3 py-2.5
                               text-sm text-swu-text placeholder:text-swu-muted focus:border-swu-accent outline-none"
                  />
                  <button
                    onClick={handlePost}
                    disabled={posting || !newPostContent.trim()}
                    className="px-3 py-2.5 rounded-xl bg-swu-accent text-white font-medium active:scale-[0.95] disabled:opacity-40"
                  >
                    <Send size={16} />
                  </button>
                </div>
              )}

              {/* If not a member of this community */}
              {supabaseUser && currentProfile?.country !== selectedCountry && (
                <div className="bg-swu-bg rounded-xl p-3 mb-4 text-center">
                  <p className="text-[11px] text-swu-muted">
                    Únase a esta comunidad configurando su país en{' '}
                    <button onClick={() => navigate('/profile')} className="text-swu-accent underline font-medium">
                      su perfil
                    </button>
                  </p>
                </div>
              )}

              {/* Posts list */}
              {posts.length > 0 ? (
                <div className="space-y-3">
                  {posts.map(post => {
                    const isAuthor = post.userId === supabaseUser?.id
                    const timeAgo = getTimeAgo(post.createdAt)

                    return (
                      <div key={post.id} className="bg-swu-bg rounded-xl p-3 border border-swu-border/50">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-swu-surface flex items-center justify-center flex-shrink-0 overflow-hidden">
                            <PostAvatar avatar={post.userAvatar} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-swu-text truncate">{post.userName}</span>
                              <span className="text-[9px] text-swu-muted">{timeAgo}</span>
                              {post.type !== 'message' && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                  post.type === 'achievement' ? 'bg-swu-amber/15 text-swu-amber'
                                    : post.type === 'tournament' ? 'bg-purple-500/15 text-purple-400'
                                      : 'bg-swu-green/15 text-swu-green'
                                }`}>
                                  {post.type === 'achievement' ? '🏆 Logro'
                                    : post.type === 'tournament' ? '⚔️ Torneo'
                                      : '🔄 Trade'}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-swu-text leading-relaxed">{post.content}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <button
                                onClick={() => !post.likedByMe && handleLike(post.id)}
                                className={`flex items-center gap-1 text-[10px] font-medium ${
                                  post.likedByMe ? 'text-red-400' : 'text-swu-muted hover:text-red-400'
                                } transition-colors`}
                              >
                                <Heart size={12} fill={post.likedByMe ? 'currentColor' : 'none'} />
                                {post.likes > 0 && post.likes}
                              </button>
                              {isAuthor && (
                                <button
                                  onClick={() => handleDeletePost(post.id)}
                                  className="flex items-center gap-1 text-[10px] text-swu-muted hover:text-swu-red transition-colors"
                                >
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <MessageCircle size={32} className="mx-auto text-swu-muted/30 mb-2" />
                  <p className="text-xs text-swu-muted">
                    Aún no hay transmisiones en esta comunidad.
                    {currentProfile?.country === selectedCountry && ' ¡Sea el primero en publicar!'}
                  </p>
                </div>
              )}
            </div>

            {/* Empty community */}
            {members.length === 0 && (
              <div className="text-center py-8">
                <Users size={40} className="mx-auto text-swu-muted/30 mb-3" />
                <p className="text-sm text-swu-muted mb-2">Aún no hay jugadores en esta comunidad</p>
                <p className="text-xs text-swu-muted">
                  Sea el primero en unirse configurando su país en{' '}
                  <button onClick={() => navigate('/profile')} className="text-swu-accent underline">
                    su perfil
                  </button>
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────

function getTimeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then

  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}m`

  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`

  const months = Math.floor(days / 30)
  return `${months}mes${months !== 1 ? 'es' : ''}`
}

/**
 * Comunidad El Salvador — un solo hub.
 *
 * Antes esto era continentes → países → feed: 66 cubetas para 14 jugadores
 * que viven en la misma ciudad, y ninguna llegó a tener un post. Ahora es
 * una sola página donde están todos, con un feed que se llena solo desde
 * lo que el grupo ya hace (logros, torneos, cartas en venta) y donde los
 * usuarios sobre todo REACCIONAN en vez de tener que escribir.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { updateMissionProgress } from '../../services/missionService'
import { getRankingUnificado, recordDe, REGLA_PUNTOS, type FilaRanking } from '../../services/rankingUnificado'
import { useNavigate } from 'react-router-dom'
import {
  Users, Send, Heart, Trash2, Trophy, Award, Tag, Sparkles,
  MessageCircle, Loader2, ChevronRight, Rss,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  getHubMembers,
  getHubFeed,
  createCommunityPost,
  togglePostLike,
  deleteCommunityPost,
  subscribeToHubFeed,
  HOME_COUNTRY_LABEL,
  type CommunityMember,
  type CommunityPost,
  type PostType,
} from '../../services/communityService'
import { ProfileFrame } from '../profile/components/ProfileFrame'
import { diaMes } from '../../services/horaSV'
import { Avatar } from '../../components/ui/Avatar'

function MemberAvatar({ avatar, level, size = 40 }: { avatar: string; level?: number; size?: number }) {
  return (
    // Marco 'auto' por nivel: la elección de marco de otra persona no está
    // disponible en esta lista. La foto ya no es redonda: el marco recorta.
    <ProfileFrame level={level ?? 1} size={size + 16}>
      <Avatar avatar={avatar} size={size} caja="marco" />
    </ProfileFrame>
  )
}

function PostAvatar({ avatar, anillo }: { avatar: string; anillo?: string }) {
  // emoji de 18px (text-lg) para una caja de 36
  return <Avatar avatar={avatar} size={36} caja="circulo" escalaEmoji={18 / 36} anillo={anillo} />
}

/** Estilo por tipo de post — el feed se lee de un vistazo por color/icono. */
const POST_STYLE: Record<PostType, { icon: typeof Trophy; label: string; cls: string }> = {
  achievement: { icon: Award, label: 'Logro', cls: 'text-swu-amber bg-swu-amber/10 border-swu-amber/25' },
  tournament: { icon: Trophy, label: 'Torneo', cls: 'text-swu-green bg-swu-green/10 border-swu-green/25' },
  trade: { icon: Tag, label: 'Venta', cls: 'text-red-400 bg-red-500/10 border-red-500/25' },
  level_up: { icon: Sparkles, label: 'Rango', cls: 'text-swu-accent-texto bg-swu-accent/10 border-swu-accent/25' },
  welcome: { icon: Users, label: 'Nuevo', cls: 'text-purple-400 bg-purple-500/10 border-purple-500/25' },
  message: { icon: MessageCircle, label: '', cls: 'text-swu-muted bg-swu-surface border-swu-border' },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const d = Math.floor(hr / 24)
  if (d < 7) return `${d}d`
  // Arriba son duraciones («3h»), que no tienen zona. Acá ya es una fecha
  // del calendario y la comunidad está en El Salvador.
  return diaMes(iso)
}

export function CommunityPage() {
  const navigate = useNavigate()
  const { currentProfile, supabaseUser } = useAuth()

  const [members, setMembers] = useState<CommunityMember[]>([])
  /** El top del ranking REAL, la misma fuente que /rank. */
  const [ranking, setRanking] = useState<FilaRanking[]>([])
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [composerOpen, setComposerOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const seenIds = useRef(new Set<string>())

  const load = useCallback(async () => {
    setLoading(true)
    const [m, p] = await Promise.all([
      getHubMembers(),
      getHubFeed(supabaseUser?.id ?? null),
    ])
    setMembers(m)
    setPosts(p)
    p.forEach(post => seenIds.current.add(post.id))
    setLoading(false)
  }, [supabaseUser?.id])

  useEffect(() => {
    // Envuelto en una función asíncrona a propósito: llamarlo en seco desde
    // el cuerpo del efecto encadena un render antes de que React pinte.
    void (async () => { await load() })()
  }, [load])

  // El top del ranking, de la misma fuente que /rank.
  useEffect(() => {
    let vivo = true
    void (async () => {
      const r = await getRankingUnificado(null)
      if (vivo && r.ok) setRanking(r.datos)
    })()
    return () => { vivo = false }
  }, [])

  // Realtime: los posts nuevos entran solos, sin recargar
  useEffect(() => {
    const unsub = subscribeToHubFeed((post) => {
      if (seenIds.current.has(post.id)) return
      seenIds.current.add(post.id)
      setPosts(prev => [post, ...prev])
    })
    return unsub
  }, [])

  const handlePost = async () => {
    if (!supabaseUser || !currentProfile || !draft.trim()) return
    setPosting(true)
    const created = await createCommunityPost(
      supabaseUser.id,
      currentProfile.name,
      currentProfile.avatar,
      draft,
    )
    setPosting(false)
    if (created) {
      // Realtime también lo entregará; seenIds evita el duplicado
      if (!seenIds.current.has(created.id)) {
        seenIds.current.add(created.id)
        setPosts(prev => [created, ...prev])
      }
      setDraft('')
      setComposerOpen(false)
    }
  }

  const handleLike = async (postId: string) => {
    if (!supabaseUser) return
    // Optimista
    setPosts(prev => prev.map(p => p.id === postId
      ? { ...p, likedByMe: !p.likedByMe, likes: p.likes + (p.likedByMe ? -1 : 1) }
      : p))
    const res = await togglePostLike(postId)
    if (res) {
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, likedByMe: res.liked, likes: res.likes }
        : p))
      /* SOLO al poner el corazón, nunca al quitarlo: es un TOGGLE, y contar
         las dos direcciones convertiría dar-y-quitar en un contador que sube
         solo. Con `res.liked` la llamada sale del hecho, no del toque. */
      if (res.liked) void updateMissionProgress(supabaseUser.id, 'post_apoyado').catch(() => {})
    }
  }

  const handleDelete = async (postId: string) => {
    if (!supabaseUser) return
    if (!confirm('¿Borrar esta publicación?')) return
    const ok = await deleteCommunityPost(postId, supabaseUser.id)
    if (ok) setPosts(prev => prev.filter(p => p.id !== postId))
  }

  const topRanking = ranking.slice(0, 5)

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-8 max-w-5xl mx-auto">
      {/* ── Cabecera ── */}
      <header>
        <h1 className="text-xl font-extrabold text-swu-text flex items-center gap-2">
          <Users size={20} className="text-swu-accent-texto" />
          Comunidad {HOME_COUNTRY_LABEL}
        </h1>
        <p className="text-[11px] text-swu-muted mt-0.5">
          {members.length} jugadores · todo lo que pasa en el grupo, en un solo lugar
        </p>
      </header>

      {/* ── Top del ranking ──
          ANTES ACÁ HABÍA OTRO «CONSEJO JEDI» y ordenaba por XP, mientras que
          el «Consejo Jedi» del menú (/rank) ordenaba por torneos. Mismo
          nombre, mismos jugadores, distinto orden — y un botón «Ranking
          completo» que hacía creer que uno era la versión larga del otro.
          Ahora los dos leen la MISMA fuente: `ranking_unificado()`. */}
      {topRanking.length > 0 && (
        <section className="bg-swu-surface rounded-2xl border border-swu-border p-3">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] uppercase tracking-wider text-swu-muted font-bold flex items-center gap-1.5">
              <Trophy size={11} className="text-swu-amber" /> Consejo Jedi
            </span>
            <button
              onClick={() => navigate('/rank')}
              className="text-[10px] text-swu-accent-texto flex items-center gap-0.5"
            >
              Ranking completo <ChevronRight size={10} />
            </button>
          </div>
          <div className="space-y-1">
            {topRanking.map((f, i) => {
              const isMe = f.userId != null && f.userId === supabaseUser?.id
              return (
                <button
                  key={f.clave}
                  onClick={() => { if (f.userId) navigate(`/u/${f.userId}`) }}
                  disabled={!f.userId}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors ${
                    isMe ? 'bg-swu-accent/10 border border-swu-accent/25' : 'hover:bg-swu-bg/60'
                  } ${f.userId ? '' : 'cursor-default'}`}
                >
                  <span className={`w-5 text-center text-xs font-extrabold font-mono ${
                    i === 0 ? 'text-swu-amber' : i === 1 ? 'text-swu-muted' : i === 2 ? 'text-orange-400' : 'text-swu-muted/50'
                  }`}>{i + 1}</span>
                  <MemberAvatar avatar={f.avatar ?? ''} level={1} size={28} />
                  <span className="flex-1 min-w-0 text-sm text-swu-text truncate">
                    {f.nombre}{isMe && <span className="text-[10px] text-swu-accent-texto ml-1">(vos)</span>}
                  </span>
                  <span className="text-[10px] text-swu-muted font-mono">{recordDe(f)}</span>
                  <span className="text-xs font-bold text-swu-accent-texto font-mono w-10 text-right">
                    {f.puntos}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[9px] text-swu-muted">{REGLA_PUNTOS}</p>
        </section>
      )}

      {/* ── Composer (acción secundaria) ── */}
      {supabaseUser && currentProfile && (
        composerOpen ? (
          <section className="bg-swu-surface rounded-2xl border border-swu-accent/30 p-3 space-y-2">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="¿Algo que contarle al grupo?"
              className="w-full px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text resize-none outline-none focus:border-swu-accent"
            />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-swu-muted/60 flex-1">{draft.length}/280</span>
              <button
                onClick={() => { setComposerOpen(false); setDraft('') }}
                className="px-3 py-1.5 rounded-lg text-xs text-swu-muted"
              >
                Cancelar
              </button>
              <button
                onClick={handlePost}
                disabled={posting || !draft.trim()}
                className="px-3 py-1.5 rounded-lg bg-swu-accent text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                {posting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Publicar
              </button>
            </div>
          </section>
        ) : (
          <button
            onClick={() => setComposerOpen(true)}
            className="w-full flex items-center gap-2.5 bg-swu-surface/60 rounded-xl border border-swu-border px-3 py-2.5 text-left"
          >
            <PostAvatar avatar={currentProfile.avatar} anillo={currentProfile.id} />
            <span className="text-xs text-swu-muted flex-1">Escribir al grupo…</span>
            <Send size={13} className="text-swu-muted" />
          </button>
        )
      )}

      {/* ── Feed ── */}
      <section className="space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-swu-muted font-bold px-1">
          <Rss size={11} /> Actividad
        </div>

        {loading && (
          <div className="flex items-center justify-center py-10 text-swu-muted gap-2 text-sm">
            <Loader2 size={16} className="animate-spin" /> Cargando…
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="bg-swu-surface rounded-2xl border border-swu-border p-8 text-center space-y-2">
            <Rss size={32} className="mx-auto text-swu-muted/30" />
            <p className="text-sm text-swu-text font-semibold">El feed se llena solo</p>
            <p className="text-[11px] text-swu-muted max-w-xs mx-auto leading-relaxed">
              Cuando alguien desbloquee un logro, gane un torneo o ponga una carta
              en venta, aparecerá acá automáticamente.
            </p>
          </div>
        )}

        {!loading && posts.map(post => {
          const style = POST_STYLE[post.type] ?? POST_STYLE.message
          const Icon = style.icon
          const isAuto = post.type !== 'message'
          const isMine = post.userId === supabaseUser?.id
          const icon = (post.metadata?.icon as string) || null

          return (
            <article
              key={post.id}
              className={`rounded-xl border p-3 ${isAuto ? style.cls : 'bg-swu-surface border-swu-border'}`}
            >
              <div className="flex items-start gap-2.5">
                <button
                  onClick={() => navigate(`/u/${post.userId}`)}
                  className="flex-shrink-0"
                >
                  <PostAvatar avatar={post.userAvatar} anillo={post.userId} />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-swu-text">{post.userName}</span>
                    {isAuto && style.label && (
                      <span className="text-[9px] font-bold uppercase tracking-wider inline-flex items-center gap-0.5 opacity-80">
                        <Icon size={9} /> {style.label}
                      </span>
                    )}
                    <span className="text-[10px] text-swu-muted/60">· {timeAgo(post.createdAt)}</span>
                  </div>

                  <p className="text-sm text-swu-text/90 mt-0.5 break-words">
                    {icon && <span className="mr-1">{icon}</span>}
                    {post.content}
                  </p>

                  <div className="flex items-center gap-3 mt-1.5">
                    <button
                      onClick={() => handleLike(post.id)}
                      disabled={!supabaseUser}
                      className={`flex items-center gap-1 text-[11px] transition-colors disabled:opacity-40 ${
                        post.likedByMe ? 'text-red-400' : 'text-swu-muted hover:text-red-400'
                      }`}
                    >
                      <Heart size={12} fill={post.likedByMe ? 'currentColor' : 'none'} />
                      {post.likes > 0 && post.likes}
                    </button>

                    {isMine && (
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="text-[11px] text-swu-muted hover:text-swu-red-texto"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </section>
    </div>
  )
}

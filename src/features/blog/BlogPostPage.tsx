/**
 * BlogPostPage — leer un artículo.
 *
 * Se lee sin cuenta. La columna es angosta a propósito (66 caracteres) y la
 * tipografía es serif: es lo que separa «leer un artículo» de «mirar una
 * pantalla». El resto de la app puede seguir siendo un HUD.
 */

import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Eye, Share2, PenLine, EyeOff } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { Articulo } from './Articulo'
import {
  leerPorSlug, sumarVista, minutosDeLectura, KIND_LABEL, KIND_TONE, type BlogPost,
} from '../../services/blogService'
import { fechaLarga } from '../../services/horaSV'

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { isAdmin, esAutorBlog } = useAuth()
  /* Escribir NO es administrar. Un autor publica lo suyo sin que se le abra el
     panel de admin, que en esta app son 13 tablas y 5 funciones —torneos,
     sedes, avisos push y `set_user_role`—. Ver `blog-autor-permiso-acotado.sql`. */
  const puedeEscribir = isAdmin || esAutorBlog
  const [post, setPost] = useState<BlogPost | null>(null)
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'no-esta'>('cargando')
  const [compartido, setCompartido] = useState(false)

  useEffect(() => {
    if (!slug) return
    let vivo = true
    void leerPorSlug(slug).then(p => {
      if (!vivo) return
      if (!p) { setEstado('no-esta'); return }
      setPost(p)
      setEstado('listo')
      // La lectura se cuenta una sola vez por carga y sin bloquear el pintado.
      if (p.published) void sumarVista(slug)
    })
    return () => { vivo = false }
  }, [slug])

  const compartir = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: post?.title, url })
      else {
        await navigator.clipboard.writeText(url)
        setCompartido(true)
        setTimeout(() => setCompartido(false), 2000)
      }
    } catch {
      // Cancelar el diálogo de compartir no es un error que haya que gritar.
    }
  }

  if (estado === 'cargando') {
    return (
      <div className="max-w-3xl mx-auto px-5 py-10 space-y-4">
        <div className="h-4 w-32 rounded carta-esqueleto" />
        <div className="h-10 w-4/5 rounded carta-esqueleto" />
        <div className="h-56 rounded-xl carta-esqueleto" />
        <div className="h-3 rounded carta-esqueleto" />
        <div className="h-3 w-11/12 rounded carta-esqueleto" />
      </div>
    )
  }

  if (estado === 'no-esta' || !post) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-20 text-center">
        <p className="blog-serif text-3xl text-swu-text/70 italic">Ese artículo no existe.</p>
        <Link to="/blog" className="inline-block mt-5 text-sm text-swu-cyan">Volver al blog</Link>
      </div>
    )
  }

  return (
    <article className="min-h-screen bg-swu-bg pb-20">
      <div className="max-w-3xl mx-auto px-5">
        <div className="flex items-center justify-between py-4">
          <button
            onClick={() => navigate('/blog')}
            className="flex items-center gap-1.5 text-[12px] text-swu-muted hover:text-swu-text"
          >
            <ArrowLeft size={14} aria-hidden /> Blog
          </button>
          <div className="flex items-center gap-3">
            {puedeEscribir && (
              <Link to={`/blog/editar/${post.id}`} className="text-swu-muted hover:text-swu-amber" aria-label="Editar">
                <PenLine size={15} aria-hidden />
              </Link>
            )}
            <button onClick={() => void compartir()} className="text-swu-muted hover:text-swu-cyan" aria-label="Compartir">
              <Share2 size={15} aria-hidden />
            </button>
          </div>
        </div>

        {/* Un borrador tiene que verse como borrador: si no, se comparte sin
            querer un texto a medio escribir. */}
        {!post.published && (
          <p className="flex items-center gap-1.5 text-[11px] text-swu-amber border border-swu-amber/40 rounded-lg px-3 py-2 mb-4">
            <EyeOff size={12} aria-hidden /> Borrador — todavía no lo ve nadie más.
          </p>
        )}

        <header className="blog-medida mx-auto pt-3 pb-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-swu-muted mb-3">
            <span className={`font-bold uppercase tracking-widest text-[10px] ${KIND_TONE[post.kind]}`}>
              {KIND_LABEL[post.kind]}
            </span>
            {post.published_at && (
              <span>{fechaLarga(post.published_at)}</span>
            )}
            <span className="flex items-center gap-1">
              <Clock size={10} aria-hidden /> {minutosDeLectura(post.content)} min de lectura
            </span>
            {post.views > 0 && (
              <span className="flex items-center gap-1"><Eye size={10} aria-hidden /> {post.views}</span>
            )}
          </div>

          <h1 className="blog-serif text-[34px] sm:text-[44px] font-bold text-swu-text leading-[1.08] tracking-tight">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="blog-serif text-[18px] text-swu-text/65 leading-relaxed mt-4 italic">
              {post.excerpt}
            </p>
          )}

          {post.author && (
            <p className="text-[12px] text-swu-muted mt-5 pt-4 border-t border-swu-border">
              Por <span className="text-swu-text font-medium">{post.author.name}</span>
            </p>
          )}
        </header>

        {post.cover_url && (
          <figure className="-mx-5 sm:mx-0 mb-8">
            <img src={post.cover_url} alt="" className="w-full aspect-[16/9] object-cover sm:rounded-xl" />
          </figure>
        )}

        <div className="blog-medida mx-auto blog-prosa">
          <Articulo contenido={post.content} />
        </div>

        {post.tags.length > 0 && (
          <div className="blog-medida mx-auto mt-10 pt-5 border-t border-swu-border flex flex-wrap gap-1.5">
            {post.tags.map(t => (
              <span key={t} className="text-[10px] text-swu-muted border border-swu-border rounded-full px-2.5 py-1">
                {t}
              </span>
            ))}
          </div>
        )}

        {compartido && (
          <p className="blog-medida mx-auto mt-4 text-[11px] text-swu-green">Enlace copiado.</p>
        )}
      </div>
    </article>
  )
}

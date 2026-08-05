/**
 * BlogPage — el índice del blog.
 *
 * Se lee sin cuenta: es la única pantalla pública de la app además de los
 * perfiles. Por eso no va detrás de AuthGate y por eso el aspecto es de
 * revista y no de panel de control — es lo primero que va a ver alguien que
 * llega desde un enlace compartido.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PenLine, Clock, Eye } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  listarPublicados, minutosDeLectura, KIND_LABEL, KIND_TONE, type BlogPost,
} from '../../services/blogService'

function fecha(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-SV', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function Meta({ p }: { p: BlogPost }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-swu-muted">
      <span className={`font-bold uppercase tracking-widest text-[10px] ${KIND_TONE[p.kind]}`}>
        {KIND_LABEL[p.kind]}
      </span>
      {p.published_at && <span>{fecha(p.published_at)}</span>}
      <span className="flex items-center gap-1">
        <Clock size={10} aria-hidden /> {minutosDeLectura(p.content)} min
      </span>
      {p.views > 0 && (
        <span className="flex items-center gap-1">
          <Eye size={10} aria-hidden /> {p.views}
        </span>
      )}
    </div>
  )
}

export function BlogPage() {
  const { isAdmin } = useAuth()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [estado, setEstado] = useState<'cargando' | 'listo'>('cargando')

  useEffect(() => {
    let vivo = true
    void listarPublicados().then(p => {
      if (!vivo) return
      setPosts(p)
      setEstado('listo')
    })
    return () => { vivo = false }
  }, [])

  const [destacado, ...resto] = posts

  return (
    <div className="min-h-screen bg-swu-bg">
      {/* Cabecera de revista: una regla, el nombre en serif y nada más. */}
      <header className="border-b border-swu-border">
        <div className="max-w-3xl mx-auto px-5 py-8 sm:py-12">
          <p className="text-[10px] uppercase tracking-[0.35em] text-swu-muted mb-2">
            Holocrón SWU
          </p>
          <div className="flex items-end justify-between gap-4">
            <h1 className="blog-serif text-4xl sm:text-5xl font-bold text-swu-text tracking-tight leading-none">
              Blog
            </h1>
            {isAdmin && (
              <Link
                to="/blog/nuevo"
                className="flex items-center gap-1.5 text-[11px] text-swu-amber border border-swu-amber/40 rounded-full px-3 py-1.5 hover:bg-swu-amber/10 transition-colors"
              >
                <PenLine size={12} aria-hidden /> Escribir
              </Link>
            )}
          </div>
          <p className="blog-serif text-base text-swu-muted mt-3 italic">
            Análisis de mazos, de cartas y del meta salvadoreño.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8">
        {estado === 'cargando' ? (
          <div className="space-y-8">
            {[0, 1, 2].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-40 rounded-lg carta-esqueleto" />
                <div className="h-5 w-2/3 rounded carta-esqueleto" />
                <div className="h-3 w-1/3 rounded carta-esqueleto" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="blog-serif text-2xl text-swu-text/70 italic">Todavía no hay artículos.</p>
            <p className="text-sm text-swu-muted mt-2">
              {isAdmin
                ? 'Escribí el primero: análisis de un mazo, de una carta o de cómo está el meta.'
                : 'Pronto vas a encontrar acá análisis de mazos y de cartas.'}
            </p>
            {isAdmin && (
              <Link
                to="/blog/nuevo"
                className="inline-flex items-center gap-1.5 mt-5 text-sm text-swu-amber border border-swu-amber/40 rounded-full px-4 py-2"
              >
                <PenLine size={14} aria-hidden /> Escribir el primero
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* El primero grande: en una revista la portada manda. */}
            <Link to={`/blog/${destacado.slug}`} className="block group mb-12">
              {destacado.cover_url && (
                <div className="-mx-5 sm:mx-0 mb-4 overflow-hidden sm:rounded-xl">
                  <img
                    src={destacado.cover_url}
                    alt=""
                    className="w-full aspect-[16/9] object-cover group-hover:scale-[1.02] transition-transform duration-500"
                  />
                </div>
              )}
              <Meta p={destacado} />
              <h2 className="blog-serif text-3xl sm:text-4xl font-bold text-swu-text leading-[1.1] mt-2 group-hover:text-swu-amber transition-colors">
                {destacado.title}
              </h2>
              {destacado.excerpt && (
                <p className="blog-serif text-[17px] text-swu-text/70 leading-relaxed mt-3">
                  {destacado.excerpt}
                </p>
              )}
              {destacado.author && (
                <p className="text-[11px] text-swu-muted mt-3">Por {destacado.author.name}</p>
              )}
            </Link>

            <ul className="divide-y divide-swu-border">
              {resto.map(p => (
                <li key={p.id}>
                  <Link to={`/blog/${p.slug}`} className="group flex gap-4 py-6">
                    <div className="min-w-0 flex-1">
                      <Meta p={p} />
                      <h3 className="blog-serif text-xl font-bold text-swu-text leading-snug mt-1.5 group-hover:text-swu-amber transition-colors">
                        {p.title}
                      </h3>
                      {p.excerpt && (
                        <p className="text-[13px] text-swu-muted leading-relaxed mt-1.5 line-clamp-2">
                          {p.excerpt}
                        </p>
                      )}
                      {p.author && (
                        <p className="text-[11px] text-swu-muted/70 mt-2">Por {p.author.name}</p>
                      )}
                    </div>
                    {p.cover_url && (
                      <img
                        src={p.cover_url}
                        alt=""
                        loading="lazy"
                        className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  )
}

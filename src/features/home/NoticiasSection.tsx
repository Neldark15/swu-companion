/**
 * NoticiasSection — las novedades del juego, en Inicio.
 *
 * ── Por qué es curada y no automática ─────────────────────────────────
 *
 * La fuente natural sería la cuenta oficial `@unlimitedffg`, pero el
 * `robots.txt` de Instagram lo prohíbe con todas las letras:
 *
 *   «Collection of data on Instagram through automated means is prohibited
 *    unless you have express written permission from Instagram»
 *
 * Y aunque no lo prohibiera, tampoco se podría: la página del perfil devuelve
 * ~609 KB de armazón SIN un solo dato de publicación —comprobado— porque todo
 * lo carga JavaScript con sesión iniciada.
 *
 * La web oficial sí es legible, pero su sección de artículos quedó congelada
 * en abril de 2024, así que tampoco sirve como fuente viva.
 *
 * Lo que sí es legítimo es el **incrustado oficial** de Instagram
 * (`/p/{código}/embed/`), que existe justo para esto. O sea: un administrador
 * pega el enlace de la publicación que vale la pena y acá se muestra
 * entera. «Las mejores noticias» es un juicio humano de todas formas.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Newspaper, ExternalLink, Instagram, Plus, Pin } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { getNews, type NewsItem } from '../../services/news'
import { diaMes } from '../../services/horaSV'

const CUENTA_OFICIAL = 'https://www.instagram.com/unlimitedffg/'

/**
 * Código de una publicación de Instagram, si el enlace es de una.
 *
 * Sirven `/p/`, `/reel/` y `/tv/`. Un enlace de PERFIL no: no hay nada que
 * incrustar y quedaría un recuadro con el armazón vacío.
 */
function codigoInstagram(url: string | null): string | null {
  if (!url) return null
  const m = /^https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]{5,20})/.exec(url.trim())
  return m ? m[1] : null
}

function EmbedInstagram({ codigo }: { codigo: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-swu-border bg-white">
      {/* El incrustado oficial. Se carga en diferido: son ~400 KB de Instagram
          y no tienen por qué pesar en la primera pintada de Inicio. */}
      <iframe
        src={`https://www.instagram.com/p/${codigo}/embed/`}
        title="Publicación de Star Wars: Unlimited en Instagram"
        loading="lazy"
        scrolling="no"
        allowTransparency
        className="w-full block"
        style={{ height: 520, border: 0 }}
      />
    </div>
  )
}

function Tarjeta({ n }: { n: NewsItem }) {
  const ig = codigoInstagram(n.url)
  if (ig) return <EmbedInstagram codigo={ig} />

  const contenido = (
    <>
      {n.image_url && (
        <img
          src={n.image_url}
          alt=""
          loading="lazy"
          className="w-full aspect-[16/9] object-cover"
        />
      )}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          {n.pinned && <Pin size={11} className="text-swu-amber flex-shrink-0" aria-hidden />}
          <span
            className="text-[9px] font-bold uppercase tracking-widest"
            style={{ color: n.tag_color || undefined }}
          >
            {n.tag}
          </span>
          <span className="text-[10px] text-swu-muted ml-auto">
            {diaMes(n.created_at)}
          </span>
        </div>
        <p className="text-sm font-bold text-swu-text leading-snug">{n.title}</p>
        {n.summary && (
          <p className="text-[12px] text-swu-muted leading-relaxed mt-1">{n.summary}</p>
        )}
        {n.url && (
          <span className="inline-flex items-center gap-1 text-[11px] text-swu-cyan mt-2">
            Leer más <ExternalLink size={9} aria-hidden />
          </span>
        )}
      </div>
    </>
  )

  const clases = 'block bg-swu-surface border border-swu-border rounded-xl overflow-hidden'

  if (!n.url) return <div className={clases}>{contenido}</div>

  // Un enlace interno se navega sin salir de la app; uno externo abre aparte.
  if (n.url.startsWith('/')) {
    return <Link to={n.url} className={`${clases} active:scale-[0.99] transition-transform`}>{contenido}</Link>
  }
  return (
    <a href={n.url} target="_blank" rel="noopener noreferrer" className={clases}>
      {contenido}
    </a>
  )
}

export function NoticiasSection() {
  const { isAdmin } = useAuth()
  const [items, setItems] = useState<NewsItem[]>([])
  const [estado, setEstado] = useState<'cargando' | 'listo'>('cargando')

  useEffect(() => {
    let vivo = true
    void getNews(6).then(n => {
      if (!vivo) return
      setItems(n)
      setEstado('listo')
    })
    return () => { vivo = false }
  }, [])

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Newspaper size={15} className="text-swu-amber flex-shrink-0" aria-hidden />
        <h2 className="text-sm font-bold text-swu-text tracking-wide uppercase flex-1">Noticias</h2>
        {isAdmin && (
          <Link
            to="/news/manage"
            className="flex items-center gap-1 text-[10px] text-swu-amber border border-swu-amber/40 rounded-full px-2 py-0.5"
          >
            <Plus size={10} aria-hidden /> Agregar
          </Link>
        )}
      </div>

      {estado === 'cargando' ? (
        <div className="space-y-3">
          {[0, 1].map(i => <div key={i} className="h-28 rounded-xl carta-esqueleto" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-[12px] text-swu-muted">
          Todavía no hay noticias.
          {isAdmin && ' Pegá el enlace de una publicación de la cuenta oficial y se muestra entera acá.'}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map(n => <Tarjeta key={n.id} n={n} />)}
        </div>
      )}

      {/* La fuente de verdad de las novedades es su cuenta. Se enlaza siempre,
          haya o no noticias cargadas: seguirla directo es mejor que esperar a
          que alguien acá la copie. */}
      <a
        href={CUENTA_OFICIAL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 bg-swu-surface border border-swu-border rounded-xl px-3 py-2.5 active:scale-[0.99] transition-transform"
      >
        <Instagram size={16} className="text-swu-coral flex-shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-swu-text">@unlimitedffg</p>
          <p className="text-[10px] text-swu-muted">La cuenta oficial del juego</p>
        </div>
        <ExternalLink size={12} className="text-swu-muted flex-shrink-0" aria-hidden />
      </a>
    </section>
  )
}

/**
 * PreviaArticuloPage — lo que se carga DENTRO del iframe del estudio.
 *
 * Va fuera de `AppLayout`, igual que `/overlay/:code`: si estuviera adentro, el
 * marco de 390 px mostraría la TabBar y el Header de la app, y encima
 * `AppLayout` mete un caparazón de `100dvh` con su propio contenedor de scroll
 * (`ID_SCROLL`), que dentro del iframe mediría el alto del iframe y no el del
 * teléfono. Acá se pinta solo el artículo.
 *
 * Es una copia FIEL de la cabecera de BlogPostPage a propósito: la previa de
 * hoy tiene su propia cabecera y ya divergió (title `text-4xl` contra
 * `text-[34px] sm:text-[44px]`). Si esto vuelve a divergir, la previa miente.
 * Lo correcto a mediano plazo es extraer `<CabeceraArticulo>` y que las dos
 * pantallas la usen; mientras tanto, esta copia es la MISMA cadena de clases,
 * verificable con un diff.
 *
 * No lleva `AuthGate`: el artículo se lee sin cuenta, y fuera de AppLayout
 * `initAuth()` no corre (el comentario de App.tsx sobre `/estudio` lo explica).
 */

import { useState, useEffect } from 'react'
import { Clock, EyeOff } from 'lucide-react'
import { Articulo } from '../Articulo'
import { KIND_LABEL, KIND_TONE, minutosDeLectura, type BlogKind } from '../../../services/blogService'
import { CANAL, esSobre, type Sobre } from './puentePrevia'

const VACIO: Sobre = {
  canal: CANAL, contenido: '', titulo: '', excerpt: '', portada: null,
  kind: 'articulo', tags: [], autor: null,
}

export function PreviaArticuloPage() {
  const [dato, setDato] = useState<Sobre>(VACIO)

  useEffect(() => {
    const alRecibir = (e: MessageEvent) => {
      // El origen se comprueba SIEMPRE, aunque el iframe sea nuestro: cualquier
      // página puede tener una referencia a esta ventana y mandarle mensajes.
      if (e.origin !== window.location.origin) return
      if (esSobre(e.data)) setDato(e.data)
    }
    window.addEventListener('message', alRecibir)
    // El saludo va DESPUÉS de enganchar el listener, si no el estudio podría
    // contestar antes de que haya quién escuche y el primer sobre se pierde.
    window.parent.postMessage({ canal: CANAL, listo: true }, window.location.origin)
    return () => window.removeEventListener('message', alRecibir)
  }, [])

  const kind = (Object.keys(KIND_LABEL) as BlogKind[]).includes(dato.kind as BlogKind)
    ? (dato.kind as BlogKind)
    : 'articulo'

  return (
    <article className="min-h-dvh bg-swu-bg pb-20">
      <div className="max-w-3xl mx-auto px-5">
        <p className="flex items-center gap-1.5 text-[11px] text-swu-amber border border-swu-amber/40 rounded-lg px-3 py-2 my-4">
          <EyeOff size={12} aria-hidden /> Vista previa — así se vería en el teléfono.
        </p>

        <header className="blog-medida mx-auto pt-3 pb-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-swu-muted mb-3">
            <span className={`font-bold uppercase tracking-widest text-[10px] ${KIND_TONE[kind]}`}>
              {KIND_LABEL[kind]}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={10} aria-hidden /> {minutosDeLectura(dato.contenido)} min de lectura
            </span>
          </div>

          <h1 className="blog-serif text-[34px] sm:text-[44px] font-bold text-swu-text leading-[1.08] tracking-tight">
            {dato.titulo || 'Sin título'}
          </h1>

          {dato.excerpt && (
            <p className="blog-serif text-[18px] text-swu-text/65 leading-relaxed mt-4 italic">{dato.excerpt}</p>
          )}

          {dato.autor && (
            <p className="text-[12px] text-swu-muted mt-5 pt-4 border-t border-swu-border">
              Por <span className="text-swu-text font-medium">{dato.autor}</span>
            </p>
          )}
        </header>

        {dato.portada && (
          <figure className="-mx-5 sm:mx-0 mb-8">
            <img src={dato.portada} alt="" className="w-full aspect-[16/9] object-cover sm:rounded-xl" />
          </figure>
        )}

        <div className="blog-medida mx-auto blog-prosa">
          <Articulo contenido={dato.contenido} />
        </div>

        {dato.tags.length > 0 && (
          <div className="blog-medida mx-auto mt-10 pt-5 border-t border-swu-border flex flex-wrap gap-1.5">
            {dato.tags.map(t => (
              <span key={t} className="text-[10px] text-swu-muted border border-swu-border rounded-full px-2.5 py-1">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

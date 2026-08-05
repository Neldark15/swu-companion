/**
 * Articulo — convierte el texto del artículo en elementos React.
 *
 * ── Por qué está escrito a mano ───────────────────────────────────────
 *
 * Se podría meter una librería de markdown, pero casi todas devuelven HTML y
 * eso obliga a `dangerouslySetInnerHTML`, que es una superficie de XSS abierta
 * en una app donde el contenido lo escribe una persona y lo leen todas. Acá se
 * arman **elementos React**: no hay forma de que el texto se convierta en
 * etiquetas. El precio es soportar menos sintaxis, y alcanza de sobra.
 *
 * ── Lo que entiende ───────────────────────────────────────────────────
 *
 *     # Título        ## Subtítulo      ### Apartado
 *     **negrita**     *cursiva*         `código`
 *     > cita
 *     - lista         1. lista numerada
 *     ---             (separador)
 *     [texto](url)    ![pie](url-de-imagen)
 *     [[carta:Bo-Katan Kryze]]     ← la carta, incrustada de verdad
 *
 * Esa última es la razón de ser del blog: un análisis de mazo sin las cartas a
 * la vista obliga a ir a buscarlas a otra pantalla y se pierde el hilo.
 */

import { useState, useEffect, type ReactNode } from 'react'
import { CardImage } from '../../components/CardImage'
import { Carta3D } from '../../components/Carta3D'
import { CardPreviewSheet } from '../../components/CardPreviewSheet'
import { listFaceUrl, listFaceIsLandscape } from '../../services/cardArt'
import type { Card } from '../../types'

/** Solo http(s). Un `javascript:` en un enlace es ejecución de código. */
function urlSegura(u: string): string | null {
  try {
    const p = new URL(u, window.location.origin)
    return p.protocol === 'http:' || p.protocol === 'https:' ? p.href : null
  } catch {
    return null
  }
}

// ── Texto en línea ───────────────────────────────────────────────────

const EN_LINEA = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g

function inline(texto: string, clave: string): ReactNode[] {
  return texto.split(EN_LINEA).filter(Boolean).map((t, i) => {
    const k = `${clave}-${i}`
    if (t.startsWith('**') && t.endsWith('**')) {
      return <strong key={k} className="font-bold text-swu-text">{t.slice(2, -2)}</strong>
    }
    if (t.startsWith('*') && t.endsWith('*') && t.length > 2) {
      return <em key={k} className="italic">{t.slice(1, -1)}</em>
    }
    if (t.startsWith('`') && t.endsWith('`')) {
      return (
        <code key={k} className="font-mono text-[0.9em] bg-swu-surface border border-swu-border rounded px-1 py-0.5 text-swu-cyan">
          {t.slice(1, -1)}
        </code>
      )
    }
    const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t)
    if (m) {
      const href = urlSegura(m[2])
      if (!href) return <span key={k}>{m[1]}</span>
      const externo = !href.startsWith(window.location.origin)
      return (
        <a
          key={k}
          href={href}
          {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="text-swu-cyan underline underline-offset-2 decoration-swu-cyan/40 hover:decoration-swu-cyan"
        >
          {m[1]}
        </a>
      )
    }
    return <span key={k}>{t}</span>
  })
}

// ── Carta incrustada ─────────────────────────────────────────────────

function CartaIncrustada({ nombre, onAbrir }: { nombre: string; onAbrir: (id: string) => void }) {
  const [carta, setCarta] = useState<Card | null | 'no-esta'>(null)

  useEffect(() => {
    let vivo = true
    void (async () => {
      const { db } = await import('../../services/db')
      const n = nombre.trim().toLowerCase()
      // Entre varias impresiones se prefiere la canónica: es la que la gente
      // reconoce y la que el buscador muestra.
      const buscar = async () => {
        const todas = await db.cards.filter(c => c.name.toLowerCase() === n).toArray()
        return todas.find(c => c.isCanonical) ?? todas[0]
      }

      let elegida = await buscar()

      // El blog se lee SIN cuenta, y es la página a la que llega alguien desde
      // un enlace compartido: su base local está vacía y todas las cartas
      // incrustadas degradaban a texto pelado. Solo se paga la descarga si de
      // verdad no hay nada guardado —si la base ya está, no cuesta nada—.
      if (!elegida && (await db.cards.count()) === 0) {
        const { ensureCards } = await import('../../services/swuApi')
        await ensureCards()
        if (!vivo) return
        elegida = await buscar()
      }

      if (!vivo) return
      setCarta(elegida ?? 'no-esta')
    })()
    return () => { vivo = false }
  }, [nombre])

  // Si la carta no existe se deja el NOMBRE, que sigue siendo información.
  // Borrarlo dejaría un hueco y el párrafo perdería sentido.
  if (carta === 'no-esta') {
    return <span className="text-swu-amber font-semibold">{nombre}</span>
  }
  if (!carta) {
    return <span className="inline-block w-20 h-28 align-middle radio-carta carta-esqueleto" />
  }

  const apaisada = listFaceIsLandscape(carta)
  return (
    <button
      onClick={() => onAbrir(carta.id)}
      aria-label={`Ver ${carta.name}`}
      className={`inline-block align-middle mx-1 my-2 ${apaisada ? 'w-48' : 'w-28'}`}
    >
      <Carta3D brillo intensidad={9}>
        <CardImage
          src={listFaceUrl(carta)}
          orientacion={apaisada ? 'apaisada' : 'vertical'}
          fit="cover"
          elevacion="realce"
          alt={carta.name}
          className={`w-full ${apaisada ? 'aspect-[400/286]' : 'aspect-[286/400]'}`}
        />
      </Carta3D>
    </button>
  )
}

/** Divide un párrafo en texto y fichas `[[carta:Nombre]]`. */
function conCartas(texto: string, clave: string, onAbrir: (id: string) => void): ReactNode[] {
  const partes = texto.split(/(\[\[carta:[^\]]+\]\])/g).filter(Boolean)
  const salida: ReactNode[] = []
  partes.forEach((p, i) => {
    const m = /^\[\[carta:([^\]]+)\]\]$/.exec(p)
    if (m) salida.push(<CartaIncrustada key={`${clave}-c${i}`} nombre={m[1]} onAbrir={onAbrir} />)
    else salida.push(...inline(p, `${clave}-t${i}`))
  })
  return salida
}

// ── Bloques ──────────────────────────────────────────────────────────

export function Articulo({ contenido }: { contenido: string }) {
  const [abierta, setAbierta] = useState<string | null>(null)
  const lineas = contenido.replace(/\r\n/g, '\n').split('\n')
  const bloques: ReactNode[] = []

  let parrafo: string[] = []
  let lista: { orden: boolean; items: string[] } | null = null

  const cerrarParrafo = (i: number) => {
    if (parrafo.length === 0) return
    bloques.push(
      <p key={`p${i}`} className="mb-5 leading-[1.75] text-[15px] text-swu-text/85">
        {conCartas(parrafo.join(' '), `p${i}`, setAbierta)}
      </p>,
    )
    parrafo = []
  }

  const cerrarLista = (i: number) => {
    if (!lista) return
    const L = lista.orden ? 'ol' : 'ul'
    bloques.push(
      <L
        key={`l${i}`}
        className={`mb-5 pl-5 space-y-1.5 text-[15px] leading-[1.7] text-swu-text/85 ${
          lista.orden ? 'list-decimal' : 'list-disc'
        } marker:text-swu-cyan/60`}
      >
        {lista.items.map((t, j) => <li key={j}>{conCartas(t, `l${i}-${j}`, setAbierta)}</li>)}
      </L>,
    )
    lista = null
  }

  lineas.forEach((linea, i) => {
    const l = linea.trim()

    if (l === '') { cerrarParrafo(i); cerrarLista(i); return }

    if (/^---+$/.test(l)) {
      cerrarParrafo(i); cerrarLista(i)
      bloques.push(<hr key={`hr${i}`} className="my-8 border-swu-border" />)
      return
    }

    const enc = /^(#{1,3})\s+(.*)$/.exec(l)
    if (enc) {
      cerrarParrafo(i); cerrarLista(i)
      const n = enc[1].length
      const clases = [
        'text-2xl font-extrabold mt-9 mb-4 text-swu-text tracking-tight',
        'text-xl font-bold mt-8 mb-3 text-swu-text tracking-tight',
        'text-base font-bold mt-6 mb-2 text-swu-amber uppercase tracking-wider',
      ][n - 1]
      const H = (`h${n + 1}`) as 'h2' | 'h3' | 'h4'
      bloques.push(<H key={`h${i}`} className={clases}>{inline(enc[2], `h${i}`)}</H>)
      return
    }

    const img = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(l)
    if (img) {
      cerrarParrafo(i); cerrarLista(i)
      const src = urlSegura(img[2])
      if (src) {
        bloques.push(
          <figure key={`f${i}`} className="my-7 -mx-4 sm:mx-0">
            <img src={src} alt={img[1]} loading="lazy" className="w-full sm:rounded-xl" />
            {img[1] && (
              <figcaption className="text-[11px] text-swu-muted text-center mt-2 px-4">{img[1]}</figcaption>
            )}
          </figure>,
        )
      }
      return
    }

    if (l.startsWith('> ')) {
      cerrarParrafo(i); cerrarLista(i)
      bloques.push(
        <blockquote
          key={`q${i}`}
          className="my-6 pl-4 border-l-2 border-swu-amber/60 text-[15px] italic text-swu-text/75 leading-relaxed"
        >
          {conCartas(l.slice(2), `q${i}`, setAbierta)}
        </blockquote>,
      )
      return
    }

    const li = /^[-*]\s+(.*)$/.exec(l)
    const oli = /^\d+[.)]\s+(.*)$/.exec(l)
    if (li || oli) {
      cerrarParrafo(i)
      const orden = !!oli
      if (!lista || lista.orden !== orden) { cerrarLista(i); lista = { orden, items: [] } }
      lista.items.push((li ?? oli)![1])
      return
    }

    cerrarLista(i)
    parrafo.push(l)
  })
  cerrarParrafo(lineas.length)
  cerrarLista(lineas.length)

  return (
    <div className="blog-prosa">
      {bloques}
      <CardPreviewSheet cardId={abierta} onClose={() => setAbierta(null)} />
    </div>
  )
}

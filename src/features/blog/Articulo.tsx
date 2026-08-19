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
 *     [[carta:Bo-Katan Kryze]]          ← la carta, incrustada de verdad
 *     [[carta:Cad Bane|ASH-11]]        ← una impresión CONCRETA
 *
 * Esa última es la razón de ser del blog: un análisis de mazo sin las cartas a
 * la vista obliga a ir a buscarlas a otra pantalla y se pierde el hilo.
 *
 * Y tres bloques de datos para los análisis con números (la sintaxis y el
 * porqué viven en sintaxisEstadistica.ts):
 *
 *     [[barras: Título]]   ← winrates en barras horizontales
 *     [[curva: Título]]    ← curva de coste en barras verticales
 *     [[ficha: Título]]    ← rejilla de etiqueta:valor
 *
 * Y un cuarto bloque que es el mazo entero (sintaxisMazo.ts):
 *
 *     [[mazo: Título]]     ← líder, base, lista… y «Copiar a Mis Decks»
 *
 * Ese último es el que cierra el circuito del blog: se lee el análisis, se
 * copia el mazo y se prueba en el laboratorio sin salir del artículo.
 *
 * Un bloque que no parsea se muestra como texto plano —igual que si esta
 * sintaxis no existiera—, así que ningún artículo viejo puede romperse.
 */

import { useState, useEffect, type ReactNode } from 'react'
import { CardImage } from '../../components/CardImage'
import { Carta3D } from '../../components/Carta3D'
import { CardPreviewSheet } from '../../components/CardPreviewSheet'
import { listFaceUrl, listFaceIsLandscape } from '../../services/cardArt'
import { BloqueEstadistico } from './BloquesEstadisticos'
import { BloqueMazo } from './BloqueMazo'
import { CompartirArticulo, type MazoDestacado } from './CompartirArticulo'
import { parsearBloqueEstadistico, type TipoBloqueEstadistico } from './sintaxisEstadistica'
import { parsearMazo } from './sintaxisMazo'
import type { Card } from '../../types'

/** Los cuatro bloques de línea propia. Todos se cierran con una línea en blanco. */
type TipoBloque = TipoBloqueEstadistico | 'mazo'

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
      // Por ORIGEN real, no por prefijo: `https://swusv.com.evil.example`
      // empieza con nuestro origen como string pero es otro dominio.
      const externo = new URL(href).origin !== window.location.origin
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

/**
 * Una carta dentro del texto.
 *
 * El `set` NO es un adorno: **el nombre no identifica una carta**. Medido
 * sobre el export, «Cad Bane» son CINCO cartas distintas —dos de ellas
 * líderes, con habilidades que no se parecen en nada— y «Pre Vizsla» son
 * cuatro. Sin fijar la impresión, un análisis de mazo muestra la carta
 * equivocada y dice cualquier cosa. Por eso se escribe `[[carta:Cad
 * Bane|ASH-11]]` cuando importa cuál es.
 */
function CartaIncrustada(
  { nombre, set, onAbrir }: { nombre: string; set: string | null; onAbrir: (id: string) => void },
) {
  const [carta, setCarta] = useState<Card | null | 'no-esta'>(null)

  useEffect(() => {
    let vivo = true
    void (async () => {
      const { db } = await import('../../services/db')
      const n = nombre.trim().toLowerCase()
      // `ASH-11` fija set y número; `ASH` solo el set.
      const m = set ? /^([A-Za-z0-9]{2,5})(?:-(\d+))?$/.exec(set.trim()) : null
      const setCode = m ? m[1].toUpperCase() : null
      const setNum = m?.[2] ?? null

      const buscar = async () => {
        let todas = await db.cards.filter(c => c.name.toLowerCase() === n).toArray()
        if (setCode) {
          const delSet = todas.filter(c => (c.setCode ?? '').toUpperCase() === setCode)
          // Si se pidió un set que no existe se avisa mostrando el nombre, en
          // vez de dibujar en silencio una carta distinta a la pedida.
          if (delSet.length === 0) return undefined
          todas = delSet
        }
        if (setNum) {
          const exacta = todas.filter(c => String(c.setNumber ?? '') === setNum)
          if (exacta.length > 0) todas = exacta
        }
        // Entre impresiones de la misma carta se prefiere la Standard: es la
        // que la gente reconoce.
        return todas.find(c => c.variantType === 'Standard')
          ?? todas.find(c => c.isCanonical)
          ?? todas[0]
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
    })().catch(() => {
      // Sin red con la base vacía, o IndexedDB bloqueado (navegación privada
      // de Firefox): degradar al nombre, no dejar el esqueleto para siempre.
      if (vivo) setCarta('no-esta')
    })
    return () => { vivo = false }
  }, [nombre, set])

  // Si la carta no existe se deja el NOMBRE, que sigue siendo información.
  // Borrarlo dejaría un hueco y el párrafo perdería sentido.
  if (carta === 'no-esta') {
    return <span className="text-swu-amber font-semibold">{nombre}</span>
  }
  if (!carta) {
    return <span className="inline-block w-20 h-28 align-middle radio-carta carta-esqueleto" />
  }

  // En un artículo el líder se muestra por su FRENTE, que es la cara donde
  // está la habilidad de la que se habla. `listFaceUrl` devuelve el reverso
  // —el lado de unidad desplegada— porque en una lista conviene una carta
  // vertical; acá eso sería mostrar la cara equivocada.
  const esLider = !!carta.isLeader
  const src = esLider ? carta.imageUrl : listFaceUrl(carta)
  const apaisada = esLider ? true : listFaceIsLandscape(carta)
  return (
    <button
      onClick={() => onAbrir(carta.id)}
      aria-label={`Ver ${carta.name}`}
      className={`inline-block align-middle mx-1 my-2 ${apaisada ? 'w-48' : 'w-28'}`}
    >
      <Carta3D brillo intensidad={9}>
        <CardImage
          src={src}
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
    const m = /^\[\[carta:([^\]|]+)(?:\|([^\]]+))?\]\]$/.exec(p)
    if (m) {
      salida.push(
        <CartaIncrustada
          key={`${clave}-c${i}`}
          nombre={m[1]}
          set={m[2] ?? null}
          onAbrir={onAbrir}
        />,
      )
    } else salida.push(...inline(p, `${clave}-t${i}`))
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

  /**
   * El primer bloque de mazo que SÍ parsea. Lo usa la miniatura de Instagram
   * para poner el líder, la base y el puesto/torneo del artículo.
   *
   * Va en un objeto y no en un `let` suelto porque se rellena dentro de
   * `cerrarStats` —una función anidada— y TypeScript no sigue la asignación
   * a través de la clausura: leerlo después daría siempre `null`.
   */
  const destacado: { mazo: MazoDestacado | null } = { mazo: null }

  /**
   * Bloque a medio capturar. `crudas` guarda las líneas TAL CUAL (marcador
   * incluido): si al cerrar el bloque el contenido no parsea, esas líneas
   * vuelven al párrafo y se leen como texto plano — exactamente lo que este
   * parser hacía con ellas antes de conocer la sintaxis. Así un error de
   * formato se VE en la vista previa en vez de tragarse medio artículo.
   */
  let stats: {
    tipo: TipoBloque
    titulo: string | null
    fuente: string | null
    lineas: string[]
    crudas: string[]
  } | null = null

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

  const cerrarStats = (i: number) => {
    if (!stats) return
    const b = stats
    stats = null

    if (b.tipo === 'mazo') {
      const mazo = parsearMazo(b.lineas)
      if (mazo) {
        // Solo el PRIMERO: un artículo que compara tres mazos tiene tres
        // bloques, y la miniatura no puede afirmar que el tercero es «el» mazo.
        if (!destacado.mazo) destacado.mazo = { mazo, titulo: b.titulo, fuente: b.fuente }
        bloques.push(
          <BloqueMazo key={`bm${i}`} titulo={b.titulo} fuente={b.fuente} mazo={mazo} onAbrir={setAbierta} />,
        )
      } else parrafo.push(...b.crudas)
      return
    }

    const datos = parsearBloqueEstadistico(b.tipo, b.lineas)
    if (datos) {
      bloques.push(
        <BloqueEstadistico key={`be${i}`} titulo={b.titulo} fuente={b.fuente} datos={datos} />,
      )
    } else parrafo.push(...b.crudas)
  }

  lineas.forEach((linea, i) => {
    const l = linea.trim()

    // Dentro de un bloque TODA línea es dato, sin importar a qué otra sintaxis
    // se parezca; solo la línea en blanco lo cierra.
    if (stats) {
      if (l === '') { cerrarStats(i); cerrarParrafo(i); cerrarLista(i); return }
      stats.crudas.push(l)
      const f = /^fuente\s*:\s*(.+)$/i.exec(l)
      if (f) stats.fuente = f[1].trim()
      else stats.lineas.push(l)
      return
    }

    if (l === '') { cerrarParrafo(i); cerrarLista(i); return }

    const be = /^\[\[(barras|curva|ficha|mazo)(?::([^\]]*))?\]\]$/.exec(l)
    if (be) {
      cerrarParrafo(i); cerrarLista(i)
      stats = {
        tipo: be[1] as TipoBloque,
        titulo: be[2]?.trim() || null,
        fuente: null,
        lineas: [],
        crudas: [l],
      }
      return
    }

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
            {/* `max-w-full` y NO `w-full`: con `w-full` toda imagen se estira
                al ancho del artículo, y una que sea más chica —un logo de 170
                px, un ícono, un recorte— se agranda 3 o 4 veces y sale
                borrosa. Así una imagen grande sigue encogiéndose para caber y
                una chica se queda en su tamaño real, centrada. */}
            <img
              src={src} alt={img[1]} loading="lazy"
              className="mx-auto block h-auto max-w-full sm:rounded-xl"
            />
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
  cerrarStats(lineas.length)
  cerrarParrafo(lineas.length)
  cerrarLista(lineas.length)

  return (
    <div className="blog-prosa">
      {bloques}
      <CompartirArticulo contenido={contenido} destacado={destacado.mazo} />
      <CardPreviewSheet cardId={abierta} onClose={() => setAbierta(null)} />
    </div>
  )
}

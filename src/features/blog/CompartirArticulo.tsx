/**
 * CompartirArticulo — llevar el análisis a WhatsApp e Instagram.
 *
 * ── La verdad técnica primero, porque es la que decide el diseño ──────
 *
 * **Instagram no tiene API de compartir desde la web.** No existe un
 * `instagram://` que acepte una imagen desde una página, ni un intent web, ni
 * nada equivalente al `wa.me` de WhatsApp. Lo único que de verdad funciona es
 * la **Web Share API nivel 2** (`navigator.share({ files })`): abre la hoja
 * del sistema operativo, e Instagram aparece ahí **si está instalado**. Eso
 * solo existe en el teléfono.
 *
 * En escritorio no hay camino: `navigator.canShare({ files })` devuelve false
 * y no queda más que **descargar el PNG y subirlo a mano**. Así que este
 * componente programa los DOS caminos y pregunta cuál tiene, en vez de
 * prometer un botón que en la mitad de los aparatos no haría nada.
 *
 * ── Por qué la miniatura se genera en DOS pasos ───────────────────────
 *
 * Primero se genera y se ve; después se comparte. No es un capricho de UX:
 * Safari exige que `navigator.share()` salga de una **activación del
 * usuario**, y entre el clic y la llamada hay que descargar el arte del CDN.
 * Encadenando todo en un solo botón, Safari tira `NotAllowedError` justo en
 * el aparato donde el camino de Instagram es el único que sirve. Separado, el
 * segundo clic es una activación nueva y la llamada sale sincrónica.
 *
 * De paso se gana lo obvio: se VE cómo quedó antes de publicarla.
 *
 * ── La trampa del canvas, medida ──────────────────────────────────────
 *
 * Dibujar una imagen de otro origen **ensucia** el canvas y `toBlob` lanza
 * `SecurityError`. El arte de las cartas viene de `cdn.starwarsunlimited.com`,
 * así que esto no es teórico. Medido en el navegador (no supuesto):
 *
 *   - `<img>` SIN `crossOrigin` → `getImageData` lanza **SecurityError**.
 *   - `<img>` CON `crossOrigin="anonymous"` → `toBlob` OK, 234 KB.
 *
 * Se puede porque **el CDN sí manda CORS**: con `Origin` en la petición
 * responde `access-control-allow-origin: *` (verificado desde swusv.com,
 * desde localhost y desde un origen cualquiera, con y sin acierto de caché).
 *
 * Y la trampa de segundo orden tampoco muerde: la misma URL que la página ya
 * cargó SIN CORS —`CardImage` la pinta así en el bloque de mazo— se vuelve a
 * pedir bien porque el CDN manda `vary: Origin`, así que la entrada cacheada
 * sin cabeceras no satisface la petición con CORS. Medido: tras precargar sin
 * `crossOrigin`, el `toBlob` posterior sigue dando 234 KB.
 *
 * Aun así, si el arte NO carga (sin red, CDN caído, un día que quiten CORS)
 * **la miniatura se hace igual, sin arte**: fondo, tipografía y aspectos. Una
 * miniatura sin arte es mejor que un botón que revienta.
 *
 * ── Tamaños ──────────────────────────────────────────────────────────
 *
 * 1080×1080 para el feed y 1080×1920 para historias. La tipografía está
 * dimensionada para leerse en la rejilla de Instagram: el título nunca baja
 * de 54px sobre 1080 de ancho, que es ~5% del lado.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Share2, Image as ImageIcon, Download, Loader2, Link2, Check, AlertTriangle } from 'lucide-react'
import { ASPECTOS } from '../../services/profileCustomService'
import type { MazoDelArticulo, RefCarta } from './sintaxisMazo'
import type { Card } from '../../types'

/** Lo que el artículo sabe de su propio mazo, si es que tiene uno. */
export interface MazoDestacado {
  mazo: MazoDelArticulo
  /** El título del bloque: `The Armorer — 2.º en el PQ de Cambridgeshire`. */
  titulo: string | null
  /** La línea `fuente:` del bloque: el torneo, normalmente. */
  fuente: string | null
}

type Formato = 'feed' | 'historia'

const LIENZOS: Record<Formato, { w: number; h: number; label: string; alt: string }> = {
  feed: { w: 1080, h: 1080, label: 'Feed 1:1', alt: 'cuadrada, 1080 × 1080' },
  historia: { w: 1080, h: 1920, label: 'Historia 9:16', alt: 'vertical, 1080 × 1920' },
}

/**
 * El enlace SIEMPRE es el de producción. `window.location.href` en local
 * comparte `http://localhost:5173/...`, que no le sirve a nadie.
 */
const ORIGEN = 'https://swusv.com'

// Los mismos colores que los puntos de aspecto del perfil, en hex porque el
// canvas no entiende clases de Tailwind. Las etiquetas se leen de ASPECTOS
// para que no haya dos listas de nombres que se puedan desincronizar.
const HEX_ASPECTO: Record<string, string> = {
  Vigilance: '#60A5FA',
  Command: '#4ADE80',
  Aggression: '#F87171',
  Cunning: '#FACC15',
  Heroism: '#E2E8F0',
  Villainy: '#A1A1AA',
}

const COLOR = {
  texto: '#E2E8F0',
  tenue: '#7C8BA1',
  ambar: '#F59E0B',
  cyan: '#22D3EE',
}

const SERIF = 'Georgia, "Iowan Old Style", "Times New Roman", Times, serif'
const SANS = '"Inter Variable", Inter, system-ui, -apple-system, sans-serif'

// ── Datos ────────────────────────────────────────────────────────────

/**
 * La URL canónica del artículo, o null si esta pantalla no es un artículo
 * publicado (la vista previa del editor vive en `/blog/editar/:id`).
 *
 * Sin URL no se ofrece compartir el enlace —compartir `/blog/editar/…` sería
 * mandar a la gente a una pantalla que ni siquiera puede abrir— pero la
 * miniatura se sigue pudiendo generar, que es justo lo que el autor quiere
 * mirar antes de publicar.
 */
function urlDelArticulo(): string | null {
  if (typeof window === 'undefined') return null
  const m = /^\/blog\/([^/]+)\/?$/.exec(window.location.pathname)
  if (!m || m[1] === 'nuevo') return null
  return `${ORIGEN}/blog/${m[1]}`
}

/** Quita los marcadores en línea: en una imagen `**esto**` se lee literal. */
function limpiar(texto: string): string {
  return texto
    .replace(/\[\[carta:([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * El título del artículo.
 *
 * `Articulo` recibe el cuerpo, no el título —lo pinta `BlogPostPage` en su
 * propio `<h1>`— así que se lee del documento. Si no hubiera, se cae al
 * primer `# Encabezado` del texto, y por último a la marca: nunca se genera
 * una imagen sin nada escrito.
 */
function tituloDelArticulo(contenido: string): string {
  if (typeof document !== 'undefined') {
    const h1 = document.querySelector('article h1') ?? document.querySelector('h1')
    const t = h1?.textContent?.trim()
    if (t) return t
  }
  for (const linea of contenido.split('\n')) {
    const m = /^#\s+(.+)$/.exec(linea.trim())
    if (m) return limpiar(m[1])
  }
  return 'HOLOCRON SWU'
}

/**
 * Resuelve líder y base contra la base local. Misma cadena de preferencia que
 * `[[carta:…]]` y que el bloque de mazo: Standard → canónica → la que haya.
 *
 * NO dispara `ensureCards()`. Si el artículo tiene bloque de mazo, ese bloque
 * ya la descargó; y si no la tiene, bajar 9.000 cartas por un botón de
 * compartir sería cobrarle a alguien una descarga entera por una imagen que
 * se hace igual sin arte.
 */
async function resolverCartas(mazo: MazoDelArticulo): Promise<{ lider: Card | null; base: Card | null }> {
  const { db } = await import('../../services/db')
  const refs = [mazo.lider, mazo.base]
  const nombres = [...new Set(refs.map(r => r.nombre))]
  const filas = await db.cards.where('name').anyOfIgnoreCase(nombres).toArray()

  const porNombre = new Map<string, Card[]>()
  for (const c of filas) {
    const k = c.name.toLowerCase()
    const lista = porNombre.get(k)
    if (lista) lista.push(c)
    else porNombre.set(k, [c])
  }
  // `anyOfIgnoreCase` solo permuta mayúsculas ASCII; para lo demás se barre —
  // pero UNA sola vez para todos los faltantes, no una por nombre. Ver el
  // mismo arreglo en `BloqueMazo.traerPorNombre`.
  const faltantes = new Set(nombres.map(n => n.toLowerCase()).filter(k => !porNombre.has(k)))
  if (faltantes.size > 0) {
    const lentas = await db.cards.filter(c => faltantes.has(c.name.toLowerCase())).toArray()
    for (const c of lentas) {
      const k = c.name.toLowerCase()
      const lista = porNombre.get(k)
      if (lista) lista.push(c)
      else porNombre.set(k, [c])
    }
  }

  const elegir = (ref: RefCarta): Card | null => {
    let todas = porNombre.get(ref.nombre.toLowerCase()) ?? []
    const m = ref.set ? /^([A-Za-z0-9]{2,5})(?:-(\d+))?$/.exec(ref.set) : null
    if (m) {
      const delSet = todas.filter(c => (c.setCode ?? '').toUpperCase() === m[1].toUpperCase())
      if (delSet.length === 0) return null
      todas = delSet
      if (m[2]) {
        const exacta = todas.filter(c => String(c.setNumber ?? '') === m[2])
        if (exacta.length > 0) todas = exacta
      }
    }
    return todas.find(c => c.variantType === 'Standard')
      ?? todas.find(c => c.isCanonical)
      ?? todas[0]
      ?? null
  }

  return { lider: elegir(mazo.lider), base: elegir(mazo.base) }
}

/**
 * Carga una imagen APTA PARA EL CANVAS.
 *
 * `crossOrigin = 'anonymous'` es lo que evita el `SecurityError` de `toBlob`.
 * Un fallo NO se propaga: devuelve null y la miniatura se dibuja sin arte.
 */
function cargarArte(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    let listo = false
    const fin = (v: HTMLImageElement | null) => {
      if (listo) return
      listo = true
      clearTimeout(reloj)
      resolve(v)
    }
    // Sin tope, un CDN que no responde deja el botón girando para siempre.
    const reloj = setTimeout(() => fin(null), 9000)
    img.onload = () => fin(img.naturalWidth > 0 ? img : null)
    img.onerror = () => fin(null)
    img.src = url
  })
}

// ── Dibujo ───────────────────────────────────────────────────────────

/** Parte el texto en líneas que caben, con puntos suspensivos si sobra. */
function envolver(ctx: CanvasRenderingContext2D, texto: string, ancho: number, maxLineas: number): string[] {
  const palabras = texto.split(' ').filter(Boolean)
  const lineas: string[] = []
  let actual = ''
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p
    if (ctx.measureText(prueba).width <= ancho || !actual) {
      actual = prueba
      continue
    }
    lineas.push(actual)
    actual = p
    if (lineas.length === maxLineas) break
  }
  if (lineas.length < maxLineas && actual) lineas.push(actual)

  if (lineas.length === maxLineas) {
    // ¿Quedó texto afuera? Se marca con «…» en vez de cortar en seco.
    const armado = lineas.join(' ')
    if (armado.length < texto.length) {
      let ultima = lineas[maxLineas - 1]
      while (ultima.length > 1 && ctx.measureText(`${ultima}…`).width > ancho) {
        ultima = ultima.slice(0, -1)
      }
      lineas[maxLineas - 1] = `${ultima}…`
    }
  }
  return lineas
}

/** Una línea que cabe sí o sí: si no entra, se le come el final con «…». */
function recorte(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string {
  if (ctx.measureText(texto).width <= ancho) return texto
  let t = texto
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1)
  return `${t}…`
}

/** Ancho de un texto dibujado con `espaciado`. */
function anchoEspaciado(ctx: CanvasRenderingContext2D, texto: string, sep: number): number {
  const letras = [...texto]
  return letras.reduce((n, c) => n + ctx.measureText(c).width, 0) + sep * Math.max(0, letras.length - 1)
}

/**
 * Texto con espaciado entre letras, a mano, empezando en `x`.
 *
 * `ctx.letterSpacing` no existe en todos los navegadores y esto se dibuja en
 * el del lector: carácter a carácter da igual en todos. Fija `textAlign` en
 * 'left' porque si no, con el 'center' del resto del dibujo, cada letra se
 * centraría sobre el mismo punto y saldría una pila ilegible.
 */
function espaciado(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, sep: number) {
  ctx.save()
  ctx.textAlign = 'left'
  let cursor = x
  for (const c of [...texto]) {
    ctx.fillText(c, cursor, y)
    cursor += ctx.measureText(c).width + sep
  }
  ctx.restore()
}

function fondo(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#12121C')
  g.addColorStop(0.55, '#181825')
  g.addColorStop(1, '#0D0D15')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const halo = ctx.createRadialGradient(W * 0.5, H * 0.32, 0, W * 0.5, H * 0.32, W * 0.9)
  halo.addColorStop(0, 'rgba(245,158,11,0.15)')
  halo.addColorStop(0.6, 'rgba(245,158,11,0.03)')
  halo.addColorStop(1, 'rgba(245,158,11,0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = 'rgba(34,211,238,0.045)'
  ctx.lineWidth = 2
  for (let x = 0; x <= W; x += 72) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }
  for (let y = 0; y <= H; y += 72) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(226,232,240,0.10)'
  ctx.lineWidth = 3
  ctx.strokeRect(26, 26, W - 52, H - 52)
}

/** Una carta con su sombra. El PNG ya trae las esquinas recortadas en alfa,
 *  y la sombra del canvas sigue el alfa: queda con la silueta de la carta. */
function carta(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.65)'
  ctx.shadowBlur = 44
  ctx.shadowOffsetY = 18
  ctx.drawImage(img, x, y, w, h)
  ctx.restore()
}

interface Contenido {
  titulo: string
  /** Puesto y torneo, si el artículo los dice. */
  gesta: string | null
  fuente: string | null
  lider: { nombre: string; subtitulo: string | null; img: HTMLImageElement | null } | null
  base: { nombre: string; img: HTMLImageElement | null } | null
  aspectos: string[]
  enlace: string | null
}

/**
 * Dibuja la miniatura completa.
 *
 * ── Por qué el acomodo se AJUSTA en vez de estar puesto a mano ────────
 *
 * Dos lienzos con proporciones muy distintas (1:1 y 9:16) y un título que
 * puede ser de seis palabras o de veinte. Con posiciones fijas, la primera
 * miniatura medida se salía 400px por abajo: se comía el puesto, los aspectos
 * y el enlace. Y no era un número mal puesto — es que el contenido no cabe
 * siempre.
 *
 * Así que se mide todo, se suma, y si no entra se cede en este orden:
 *
 *   1. el título baja de cuerpo (la lista `TAMS`, de mayor a menor),
 *   2. el arte se encoge hasta `ESCALA_MINIMA`,
 *   3. y recién entonces el título se corta con «…».
 *
 * El enlace y la marca no ceden nunca: una miniatura sin el enlace no lleva
 * a nadie al artículo, que es lo único que la miniatura tiene que lograr.
 */
function dibujar(ctx: CanvasRenderingContext2D, W: number, H: number, c: Contenido, formato: Formato) {
  const M = 72
  const CW = W - M * 2
  const historia = formato === 'historia'
  const RATIO = 286 / 400 // líderes y bases son apaisados

  fondo(ctx, W, H)
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  // ── el arte ──
  //
  // Apiladas y solapadas quedaban preciosas y se comían 700 de los 1080 px del
  // feed. En 1:1 van LADO A LADO: el bloque mide lo que la carta más alta, las
  // dos se ven enteras y sobra sitio para el texto.
  //
  // En 9:16 pasa lo contrario: lado a lado, el ancho las limita y quedaba un
  // tercio de la historia en negro. Ahí van APILADAS, que es la forma de que
  // el alto de sobra se convierta en cartas más grandes.
  const hayLider = !!c.lider?.img
  const hayBase = !!c.base?.img
  const apilado = historia && hayLider && hayBase
  const HUECO = 26
  let anchoLider = 0
  let anchoBase = 0
  if (apilado) {
    anchoLider = CW * 0.86
    anchoBase = CW * 0.64
  } else if (hayLider && hayBase) {
    anchoLider = (CW - HUECO) * 0.56
    anchoBase = (CW - HUECO) * 0.44
  } else if (hayLider) {
    anchoLider = CW * (historia ? 0.86 : 0.72)
  } else if (hayBase) {
    anchoBase = CW * (historia ? 0.74 : 0.62)
  }
  const arteDeseado = apilado
    ? (anchoLider + anchoBase) * RATIO
    : Math.max(anchoLider, anchoBase) * RATIO
  // La franja de nombres: el nombre IMPRESO en la carta queda en ~10px sobre
  // 1080, o sea ilegible en el teléfono de quien lo mire. Apiladas hay dos
  // franjas, y la de en medio hace además de separación entre las cartas.
  const altoNombres = apilado ? 156 : (hayLider || hayBase ? 78 : 0)

  // ── los bloques que no ceden ──
  const altoMarca = 88
  const HUECO_TITULO = 34
  const tamGesta = historia ? 40 : 34
  let lineasGesta: string[] = []
  if (c.gesta) {
    ctx.font = `600 ${tamGesta}px ${SANS}`
    lineasGesta = envolver(ctx, c.gesta, CW, 2)
  }
  const altoGesta = lineasGesta.length ? lineasGesta.length * Math.round(tamGesta * 1.3) + 24 : 0
  // Los aspectos son el PLAN B: cuando el arte no carga son lo único que dice
  // de qué color es el mazo. Con las cartas a la vista sobran, y el espacio
  // que liberan se lo queda el arte.
  const conAspectos = c.aspectos.length > 0 && !hayLider && !hayBase
  const altoAspectos = conAspectos ? 90 : 0
  const altoPie = 76 + (c.fuente ? 42 : 0)

  // ── ajustar hasta que entre ──
  const TAMS = historia ? [80, 72, 64, 56, 50] : [64, 58, 52, 46, 42]
  const MAX_LINEAS = historia ? 5 : 4
  const ESCALA_MINIMA = 0.5
  const disponible = H - M * 2

  let tamTitulo = TAMS[TAMS.length - 1]
  let lineasTitulo: string[] = []
  let altoTitulo = 0
  let escalaArte = 1

  for (const tam of TAMS) {
    ctx.font = `700 ${tam}px ${SERIF}`
    const lineas = envolver(ctx, c.titulo, CW, MAX_LINEAS)
    const alto = lineas.length * Math.round(tam * 1.18)
    const fijo = altoMarca + altoNombres + HUECO_TITULO + alto + altoGesta + altoAspectos + altoPie
    const sobra = disponible - fijo
    const escala = arteDeseado > 0 ? Math.min(1, Math.max(0, sobra) / arteDeseado) : 1

    tamTitulo = tam
    lineasTitulo = lineas
    altoTitulo = alto
    escalaArte = escala
    // El primer cuerpo con el que el arte no queda ridículo gana; si ninguno
    // lo consigue, se queda el último —el más chico— con lo que haya.
    if (escala >= ESCALA_MINIMA) break
  }

  anchoLider *= escalaArte
  anchoBase *= escalaArte
  const altoLider = anchoLider * RATIO
  const altoBase = anchoBase * RATIO
  // Apiladas SUMAN; lado a lado el bloque mide lo que la más alta. Tenerlo
  // como `max` en los dos casos hacía que la historia se midiera una carta
  // más corta de lo que dibujaba, y el enlace del pie caía fuera del lienzo.
  const altoArte = apilado ? altoLider + altoBase : Math.max(altoLider, altoBase)

  const total = altoMarca + altoArte + altoNombres + HUECO_TITULO
    + altoTitulo + altoGesta + altoAspectos + altoPie
  let y = M + Math.max(0, (disponible - total) / 2)

  // ── marca ──
  ctx.font = `800 38px ${SANS}`
  const SEP = 9
  const aHolocron = anchoEspaciado(ctx, 'HOLOCRON', SEP)
  const aSwu = anchoEspaciado(ctx, 'SWU', SEP)
  const separacion = 24
  let cursorMarca = (W - (aHolocron + separacion + aSwu)) / 2
  ctx.fillStyle = COLOR.texto
  espaciado(ctx, 'HOLOCRON', cursorMarca, y, SEP)
  cursorMarca += aHolocron + separacion
  ctx.fillStyle = COLOR.ambar
  espaciado(ctx, 'SWU', cursorMarca, y, SEP)
  ctx.fillStyle = 'rgba(34,211,238,0.55)'
  ctx.fillRect(W / 2 - 58, y + 62, 116, 4)
  y += altoMarca

  // ── arte y nombres ──
  /** El nombre bajo una carta, con su segunda línea. Devuelve lo que ocupa. */
  const nombrar = (
    centro: number, ancho: number, nombre: string, pie: string | null, alto: number,
  ): number => {
    ctx.textAlign = 'center'
    ctx.font = `700 32px ${SANS}`
    ctx.fillStyle = COLOR.texto
    ctx.fillText(recorte(ctx, nombre, ancho + 40), centro, y + 12)
    if (pie) {
      ctx.font = `500 25px ${SANS}`
      ctx.fillStyle = COLOR.tenue
      ctx.fillText(recorte(ctx, pie, ancho + 40), centro, y + 50)
    }
    return alto
  }

  if (altoArte > 0) {
    if (apilado) {
      // Apiladas: cada carta con su nombre debajo, y ese nombre hace de
      // separación con la de abajo.
      if (c.lider?.img) {
        carta(ctx, c.lider.img, (W - anchoLider) / 2, y, anchoLider, altoLider)
        y += altoLider
        y += nombrar(W / 2, anchoLider, c.lider.nombre, c.lider.subtitulo, 84)
      }
      if (c.base?.img) {
        carta(ctx, c.base.img, (W - anchoBase) / 2, y, anchoBase, altoBase)
        y += altoBase
        y += nombrar(W / 2, anchoBase, c.base.nombre, 'BASE', altoNombres - 84)
      }
    } else {
      const anchoTotal = anchoLider + (anchoLider > 0 && anchoBase > 0 ? HUECO : 0) + anchoBase
      let x = (W - anchoTotal) / 2
      // Alineadas por abajo: así los dos nombres caen en el mismo renglón.
      let centroLider = 0
      let centroBase = 0
      if (anchoLider > 0 && c.lider?.img) {
        carta(ctx, c.lider.img, x, y + altoArte - altoLider, anchoLider, altoLider)
        centroLider = x + anchoLider / 2
        x += anchoLider + HUECO
      }
      if (anchoBase > 0 && c.base?.img) {
        carta(ctx, c.base.img, x, y + altoArte - altoBase, anchoBase, altoBase)
        centroBase = x + anchoBase / 2
      }
      y += altoArte
      if (centroLider > 0 && c.lider) nombrar(centroLider, anchoLider, c.lider.nombre, c.lider.subtitulo, 0)
      if (centroBase > 0 && c.base) nombrar(centroBase, anchoBase, c.base.nombre, 'BASE', 0)
      y += altoNombres
    }
  }
  y += HUECO_TITULO

  // ── título ──
  ctx.textAlign = 'center'
  ctx.font = `700 ${tamTitulo}px ${SERIF}`
  ctx.fillStyle = COLOR.texto
  const salto = Math.round(tamTitulo * 1.18)
  for (const linea of lineasTitulo) {
    ctx.fillText(linea, W / 2, y)
    y += salto
  }

  // ── puesto y torneo ──
  if (lineasGesta.length) {
    y += 24
    ctx.font = `600 ${tamGesta}px ${SANS}`
    ctx.fillStyle = COLOR.ambar
    for (const linea of lineasGesta) {
      ctx.fillText(linea, W / 2, y)
      y += Math.round(tamGesta * 1.3)
    }
  }

  // ── aspectos (solo sin arte) ──
  if (conAspectos) {
    y += 20
    ctx.font = `600 26px ${SANS}`
    const etiquetas = c.aspectos.map(a => ASPECTOS.find(x => x.valor === a)?.label ?? a)
    const anchos = etiquetas.map(t => ctx.measureText(t).width + 74)
    const sep = 18
    let cursor = (W - (anchos.reduce((a, b) => a + b, 0) + sep * (anchos.length - 1))) / 2
    etiquetas.forEach((t, i) => {
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.beginPath()
      ctx.roundRect(cursor, y, anchos[i], 52, 26)
      ctx.fill()
      ctx.fillStyle = HEX_ASPECTO[c.aspectos[i]] ?? COLOR.tenue
      ctx.beginPath()
      ctx.arc(cursor + 30, y + 26, 12, 0, Math.PI * 2)
      ctx.fill()
      ctx.textAlign = 'left'
      ctx.fillStyle = COLOR.texto
      ctx.fillText(t, cursor + 52, y + 13)
      cursor += anchos[i] + sep
    })
    ctx.textAlign = 'center'
    y += altoAspectos - 20
  }

  // ── pie ──
  y += 30
  ctx.textAlign = 'center'
  ctx.font = `700 30px ${SANS}`
  ctx.fillStyle = COLOR.cyan
  const pie = c.enlace ? c.enlace.replace(/^https?:\/\//, '') : 'swusv.com/blog'
  espaciado(ctx, pie, (W - anchoEspaciado(ctx, pie, 2)) / 2, y, 2)
  if (c.fuente) {
    ctx.font = `400 24px ${SANS}`
    ctx.fillStyle = COLOR.tenue
    ctx.fillText(recorte(ctx, c.fuente, CW), W / 2, y + 44)
  }
}

// ── Componente ───────────────────────────────────────────────────────

type Estado =
  | { tipo: 'reposo' }
  | { tipo: 'generando'; formato: Formato }
  | { tipo: 'aviso'; texto: string }
  | { tipo: 'error'; texto: string }

export function CompartirArticulo({
  contenido,
  destacado,
}: {
  contenido: string
  destacado: MazoDestacado | null
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'reposo' })
  const [copiado, setCopiado] = useState(false)
  const [mini, setMini] = useState<
    { url: string; archivo: File; formato: Formato; para: string } | null
  >(null)
  const urlViva = useRef<string | null>(null)

  /**
   * Se lee en cada render y no se memoriza: navegar de `/blog/a` a `/blog/b`
   * NO desmonta este componente —solo le cambia la prop— así que un enlace
   * calculado una sola vez al montar seguiría apuntando al artículo anterior.
   * Es un regex sobre `location.pathname`; recalcularlo no cuesta nada.
   */
  const enlace = urlDelArticulo()

  /**
   * Y por lo mismo, una miniatura del artículo ANTERIOR no vale: se compara
   * contra el contenido con el que se generó. El blob viejo lo suelta el
   * próximo `generar` (revoca `urlViva`) o el desmontaje.
   */
  const miniVigente = mini && mini.para === contenido ? mini : null

  /**
   * ¿Este navegador sabe compartir ARCHIVOS? Se pregunta con un archivo de
   * mentira, que es la única forma: `canShare` sin `files` responde otra cosa.
   * De esta respuesta depende que el botón diga «Compartir» o «Descargar» —
   * es exactamente la diferencia entre teléfono y escritorio.
   */
  const [puedeArchivos] = useState(() => {
    try {
      if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false
      return navigator.canShare({ files: [new File([new Uint8Array([0])], 'p.png', { type: 'image/png' })] })
    } catch {
      return false
    }
  })

  /**
   * El título se lee EN EL MOMENTO de usarlo, no al montar.
   *
   * Sale del `<h1>` que pinta `BlogPostPage`, y ese `<h1>` se confirma en el
   * DOM en la misma pasada que este componente: durante el primer render
   * todavía no existe —o peor, existe el del artículo anterior—. Al pulsar un
   * botón el documento ya está al día y la lectura es correcta siempre.
   */
  const leerTitulo = useCallback(() => tituloDelArticulo(contenido), [contenido])

  // Una miniatura vieja es un blob retenido: se suelta al cambiar y al salir.
  useEffect(() => () => {
    if (urlViva.current) URL.revokeObjectURL(urlViva.current)
  }, [])

  const generar = useCallback(async (formato: Formato) => {
    setEstado({ tipo: 'generando', formato })
    try {
      const { w, h } = LIENZOS[formato]
      // Se relee, no se toma el de la clausura: el `enlace` del render podría
      // ser el del artículo anterior si la ruta cambió entre el pintado y el
      // clic, y el pie de la imagen es lo único que lleva al lector al texto.
      const url = urlDelArticulo()

      let lider: Contenido['lider'] = null
      let base: Contenido['base'] = null
      const aspectos: string[] = []

      if (destacado) {
        const { lider: cl, base: cb } = await resolverCartas(destacado.mazo)
        const [artL, artB] = await Promise.all([
          cargarArte(cl?.imageUrl),
          cargarArte(cb?.imageUrl),
        ])
        if (cl) lider = { nombre: cl.name, subtitulo: cl.subtitle ?? null, img: artL }
        if (cb) base = { nombre: cb.name, img: artB }
        for (const a of [...(cl?.aspects ?? []), ...(cb?.aspects ?? [])]) {
          if (!aspectos.includes(a)) aspectos.push(a)
        }
      }

      // Las fuentes tienen que estar cargadas ANTES de medir: midiendo con la
      // de reserva, el título se acomoda para una tipografía y se pinta con
      // otra, y las líneas quedan cortas o desbordadas.
      if (typeof document !== 'undefined' && document.fonts) {
        try {
          await Promise.all([
            document.fonts.load(`700 62px ${SERIF}`),
            document.fonts.load(`800 38px ${SANS}`),
            document.fonts.load(`600 35px ${SANS}`),
          ])
          await document.fonts.ready
        } catch {
          // Sin la fuente exacta se dibuja con la de reserva. No es motivo
          // para no generar nada.
        }
      }

      const lienzo = document.createElement('canvas')
      lienzo.width = w
      lienzo.height = h
      const ctx = lienzo.getContext('2d')
      if (!ctx) {
        setEstado({ tipo: 'error', texto: 'Este navegador no da un contexto 2D para dibujar la imagen.' })
        return
      }

      dibujar(ctx, w, h, {
        titulo: leerTitulo(),
        gesta: gestaDe(destacado, lider?.nombre ?? null),
        fuente: destacado?.fuente ?? null,
        lider,
        base,
        aspectos: ASPECTOS.map(a => a.valor).filter(v => aspectos.includes(v)),
        enlace: url,
      }, formato)

      const blob = await new Promise<Blob | null>(r => lienzo.toBlob(r, 'image/png'))
      if (!blob) {
        setEstado({ tipo: 'error', texto: 'No se pudo exportar la imagen.' })
        return
      }

      if (urlViva.current) URL.revokeObjectURL(urlViva.current)
      const objeto = URL.createObjectURL(blob)
      urlViva.current = objeto
      const nombre = `holocron-${(url ?? 'articulo').split('/').pop() || 'articulo'}-${formato}.png`
      setMini({ url: objeto, archivo: new File([blob], nombre, { type: 'image/png' }), formato, para: contenido })
      setEstado({ tipo: 'reposo' })
    } catch (e) {
      // El único fallo que quedaría acá es el canvas sucio, y el arte se carga
      // con `crossOrigin`; aun así se dice qué pasó en vez de callar.
      const nombre = e instanceof Error ? e.name : ''
      setEstado({
        tipo: 'error',
        texto: nombre === 'SecurityError'
          ? 'El arte de las cartas bloqueó la exportación. Probá de nuevo: la miniatura se puede generar sin arte.'
          : 'No se pudo generar la miniatura.',
      })
    }
  }, [destacado, contenido, leerTitulo])

  /**
   * Sin un solo `await` antes de `navigator.share`: Safari exige que la
   * llamada salga de la activación del usuario, y por eso la imagen ya está
   * hecha desde el paso anterior.
   */
  const compartirImagen = () => {
    if (!miniVigente || typeof navigator.share !== 'function') return
    navigator.share({ files: [miniVigente.archivo], title: leerTitulo() })
      .then(() => setEstado({ tipo: 'aviso', texto: 'Elegí Instagram en el menú del sistema.' }))
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return
        setEstado({ tipo: 'error', texto: 'El sistema no aceptó compartir la imagen. Podés descargarla.' })
      })
  }

  const descargar = () => {
    if (!miniVigente) return
    const a = document.createElement('a')
    a.href = miniVigente.url
    a.download = miniVigente.archivo.name
    a.click()
    setEstado({
      tipo: 'aviso',
      texto: 'Imagen descargada. Instagram no deja publicar desde el navegador: subila desde la app del teléfono.',
    })
  }

  /**
   * WhatsApp. Con `navigator.share` se prefiere la hoja del sistema: deja
   * elegir el contacto dentro de la propia app. Sin ella —escritorio— se va a
   * `wa.me`, que abre WhatsApp Web o el de escritorio.
   */
  const compartirEnlace = () => {
    const url = urlDelArticulo()
    if (!url) return
    const titulo = leerTitulo()
    const texto = `${titulo} — HOLOCRON SWU`
    const aWa = () => {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`${texto}\n${url}`)}`,
        '_blank',
        'noopener,noreferrer',
      )
    }
    // `navigator.share` primero porque la hoja del sistema deja elegir el
    // contacto DENTRO de WhatsApp; `wa.me` obliga a pegar el número. Si no
    // existe —escritorio— se cae a wa.me, que abre WhatsApp Web.
    if (typeof navigator.share !== 'function') { aWa(); return }
    navigator.share({ title: titulo, text: texto, url }).catch((e: unknown) => {
      if (e instanceof Error && e.name === 'AbortError') return
      aWa()
    })
  }

  const copiar = () => {
    const url = urlDelArticulo()
    if (!url) return
    void navigator.clipboard.writeText(url).then(
      () => { setCopiado(true); setTimeout(() => setCopiado(false), 2000) },
      () => setEstado({ tipo: 'error', texto: 'El navegador no dejó copiar al portapapeles.' }),
    )
  }

  const enCurso: Formato | null = estado.tipo === 'generando' ? estado.formato : null

  return (
    <section
      aria-labelledby="compartir-articulo"
      className="mt-12 pt-6 border-t border-swu-border"
    >
      <h2
        id="compartir-articulo"
        className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-swu-muted mb-4"
      >
        <Share2 size={13} aria-hidden /> Compartir
      </h2>

      {enlace && (
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={compartirEnlace}
            aria-label="Compartir el enlace del artículo por WhatsApp"
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold bg-swu-surface border border-swu-border text-swu-text hover:border-swu-green/60 hover:text-swu-green transition-colors"
          >
            <IconoWhatsApp /> WhatsApp
          </button>
          <button
            onClick={copiar}
            aria-label="Copiar el enlace del artículo"
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold bg-swu-surface border border-swu-border text-swu-muted hover:text-swu-cyan hover:border-swu-cyan/60 transition-colors"
          >
            {copiado ? <Check size={15} aria-hidden /> : <Link2 size={15} aria-hidden />}
            {copiado ? 'Copiado' : 'Copiar enlace'}
          </button>
        </div>
      )}

      <p className="text-[12px] text-swu-muted leading-relaxed mb-3">
        Para Instagram hace falta una imagen: Instagram no acepta publicaciones desde el navegador.
        Generá la miniatura y {puedeArchivos ? 'compartila con la app' : 'subila desde el teléfono'}.
      </p>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(LIENZOS) as Formato[]).map(f => (
          <button
            key={f}
            onClick={() => void generar(f)}
            disabled={enCurso !== null}
            aria-busy={enCurso === f}
            aria-label={`Generar miniatura ${LIENZOS[f].alt} para Instagram`}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold bg-swu-surface border border-swu-border text-swu-text hover:border-swu-amber/60 hover:text-swu-amber disabled:opacity-50 disabled:cursor-wait transition-colors"
          >
            {enCurso === f
              ? <Loader2 size={15} className="animate-spin" aria-hidden />
              : <ImageIcon size={15} aria-hidden />}
            {LIENZOS[f].label}
          </button>
        ))}
      </div>

      {miniVigente && (
        <div className="mt-5">
          <img
            src={miniVigente.url}
            alt={`Miniatura ${LIENZOS[miniVigente.formato].alt} del artículo, lista para Instagram`}
            className={`rounded-xl border border-swu-border ${miniVigente.formato === 'feed' ? 'w-full max-w-[320px]' : 'w-full max-w-[220px]'}`}
          />
          <div className="flex flex-wrap gap-2 mt-3">
            {puedeArchivos && (
              <button
                onClick={compartirImagen}
                aria-label="Compartir la miniatura con otra aplicación, por ejemplo Instagram"
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold bg-swu-amber/15 border border-swu-amber/50 text-swu-amber hover:bg-swu-amber/25 transition-colors"
              >
                <Share2 size={15} aria-hidden /> Compartir imagen
              </button>
            )}
            <button
              onClick={descargar}
              aria-label="Descargar la miniatura como PNG"
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold bg-swu-surface border border-swu-border text-swu-text hover:border-swu-cyan/60 hover:text-swu-cyan transition-colors"
            >
              <Download size={15} aria-hidden /> Descargar PNG
            </button>
          </div>
        </div>
      )}

      {/* Un solo sitio para todo lo que el componente tenga que decir, y que
          el lector de pantalla lo anuncie sin robar el foco. */}
      <p role="status" aria-live="polite" className="mt-3 text-[12px] leading-relaxed min-h-[1em]">
        {estado.tipo === 'generando' && <span className="text-swu-muted">Generando la miniatura…</span>}
        {estado.tipo === 'aviso' && <span className="text-swu-green">{estado.texto}</span>}
        {estado.tipo === 'error' && (
          <span className="flex items-center gap-1.5 text-swu-amber">
            <AlertTriangle size={13} aria-hidden /> {estado.texto}
          </span>
        )}
      </p>
    </section>
  )
}

/**
 * El puesto y el torneo salen del título del bloque de mazo, que se escribe
 * `The Armorer — 2.º en el PQ de Cambridgeshire`.
 *
 * Si empieza EXACTAMENTE con el nombre del líder, esa parte se quita: el arte
 * del líder ya está arriba y repetirlo gasta una línea. Es una comprobación
 * exacta, no una adivinanza — si no coincide, se deja el título entero.
 */
function gestaDe(destacado: MazoDestacado | null, nombreLider: string | null): string | null {
  const t = destacado?.titulo?.trim()
  if (!t) return null
  if (!nombreLider) return limpiar(t)
  const resto = t.slice(nombreLider.length).trim()
  if (t.toLowerCase().startsWith(nombreLider.toLowerCase()) && /^[—–-]/.test(resto)) {
    return limpiar(resto.replace(/^[—–-]\s*/, '')) || null
  }
  return limpiar(t)
}

/** lucide no trae la de WhatsApp y el botón sin su marca no se reconoce. */
function IconoWhatsApp() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.23-8.24 8.23zm4.52-6.16c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.19-.53.06-.25-.12-1.05-.38-1.99-1.23-.74-.65-1.23-1.46-1.38-1.71-.14-.24-.01-.38.11-.5.11-.11.25-.29.37-.44.13-.15.17-.25.25-.41.09-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.84-.2-.49-.4-.42-.55-.43h-.48c-.16 0-.43.06-.65.31-.22.24-.85.83-.85 2.03s.87 2.35.99 2.51c.13.16 1.71 2.61 4.15 3.66.58.25 1.03.4 1.38.51.58.19 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.56.2-1.05.14-1.15-.06-.11-.22-.17-.46-.29z" />
    </svg>
  )
}

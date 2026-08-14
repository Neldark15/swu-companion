import { db } from './db'
import { artUrlOptimizada, listFaceUrl, listFaceIsLandscape } from './cardArt'
import type { Deck, DeckCard, Card } from '../types'

/**
 * Exportar un mazo como UNA imagen con todas las cartas.
 *
 * Es la hoja de mazo que se manda por WhatsApp: se ve el mazo entero de un
 * vistazo, sin que el otro tenga que abrir nada ni tener la app.
 *
 * ── Lo que hace posible todo esto ────────────────────────────────────
 *
 * Que el arte venga por `/api/img`, que es MISMO ORIGEN. Un lienzo que dibuja
 * una imagen de otro dominio queda «contaminado» y `toBlob()` lanza
 * `SecurityError`: no se puede leer de vuelta lo que se dibujó. Es la misma
 * pared con la que se choca al intentar medir el color del arte de una carta
 * desde el CDN. Como `cardArt.ts` ya manda todo por el proxy propio, el lienzo
 * queda limpio y la imagen se puede sacar.
 *
 * Si algún día alguien «optimiza» esto apuntando al CDN directo, la exportación
 * deja de funcionar y el error no va a decir nada de CORS.
 *
 * ── Por qué las cantidades y no repetir la carta ─────────────────────
 *
 * Un mazo de 52 cartas con tres copias de varias serían ~30 imágenes distintas
 * pero 52 huecos. Se dibuja UNA por carta con su número en la esquina, como
 * hace cualquier hoja de mazo: se lee mejor y baja a un tercio la descarga.
 */

/** Ancho de cada carta en la imagen final. Coincide con un ancho de `/api/img`. */
const ANCHO_CARTA = 224
/** Alto del hueco. Las cartas de SWU son ~1:1,4; las apaisadas se centran adentro. */
const ALTO_CARTA = Math.round(ANCHO_CARTA * 1.4)
const HUECO = 14
const MARGEN = 34
const ALTO_CABECERA = 132
const ALTO_PIE = 46
/** Cuántas por fila. Diez entra cómodo y da una imagen que se lee en el teléfono. */
const POR_FILA = 10

const COLOR_FONDO = '#0d1117'
const COLOR_TEXTO = '#e6edf3'
const COLOR_TENUE = '#8b949e'
const COLOR_ACENTO = '#22d3ee'

/** Una carta ya resuelta y lista para dibujar. */
interface Pieza {
  nombre: string
  cantidad: number
  img: HTMLImageElement | null
  apaisada: boolean
}

/**
 * Carga una imagen para el lienzo.
 *
 * Nunca rechaza: una carta sin arte se dibuja como hueco con su nombre, y la
 * hoja sale igual. Fallar entera por una imagen sería lo peor posible para
 * algo que se usa antes de un torneo.
 */
function cargarImagen(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolver => {
    const im = new Image()
    // Aunque `/api/img` sea mismo origen, pedirlo explícito no cuesta nada y
    // deja el lienzo limpio si algún día el proxy se mueve a otro host CON CORS.
    im.crossOrigin = 'anonymous'
    im.onload = () => resolver(im)
    im.onerror = () => resolver(null)
    im.src = src
  })
}

/** Resuelve las cartas del mazo contra la base local y baja su arte. */
async function prepararPiezas(cartas: DeckCard[]): Promise<Pieza[]> {
  if (cartas.length === 0) return []
  const fichas = await db.cards.bulkGet(cartas.map(c => c.cardId))
  const porId = new Map<string, Card>()
  for (const f of fichas) if (f) porId.set(f.id, f)

  return Promise.all(cartas.map(async c => {
    const ficha = porId.get(c.cardId)
    const url = artUrlOptimizada(listFaceUrl(ficha), ANCHO_CARTA)
    return {
      nombre: c.name,
      cantidad: c.quantity,
      img: url ? await cargarImagen(url) : null,
      apaisada: listFaceIsLandscape(ficha),
    }
  }))
}

/** Dibuja una carta en su hueco, con el número de copias si son más de una. */
function dibujarPieza(ctx: CanvasRenderingContext2D, p: Pieza, x: number, y: number) {
  ctx.save()
  ctx.beginPath()
  // El radio es el de las cartas reales a esta escala; sin él se ven como
  // recortes rectangulares pegados y la hoja parece un collage.
  const r = 12
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + ANCHO_CARTA, y, x + ANCHO_CARTA, y + ALTO_CARTA, r)
  ctx.arcTo(x + ANCHO_CARTA, y + ALTO_CARTA, x, y + ALTO_CARTA, r)
  ctx.arcTo(x, y + ALTO_CARTA, x, y, r)
  ctx.arcTo(x, y, x + ANCHO_CARTA, y, r)
  ctx.closePath()
  ctx.clip()

  ctx.fillStyle = '#161b22'
  ctx.fillRect(x, y, ANCHO_CARTA, ALTO_CARTA)

  if (p.img) {
    if (p.apaisada) {
      // Líderes y bases vienen apaisados: se escalan al ancho del hueco y se
      // centran en vertical, en vez de estirarse a un alto que no les toca.
      const alto = (p.img.height / p.img.width) * ANCHO_CARTA
      ctx.drawImage(p.img, x, y + (ALTO_CARTA - alto) / 2, ANCHO_CARTA, alto)
    } else {
      ctx.drawImage(p.img, x, y, ANCHO_CARTA, ALTO_CARTA)
    }
  } else {
    // Sin arte: el nombre, para que la hoja siga siendo legible.
    ctx.fillStyle = COLOR_TENUE
    ctx.font = '600 17px system-ui, sans-serif'
    ctx.textAlign = 'center'
    const palabras = p.nombre.split(' ')
    let linea = ''
    let ln = 0
    for (const w of palabras) {
      const prueba = linea ? `${linea} ${w}` : w
      if (ctx.measureText(prueba).width > ANCHO_CARTA - 24 && linea) {
        ctx.fillText(linea, x + ANCHO_CARTA / 2, y + ALTO_CARTA / 2 + ln * 22)
        linea = w; ln++
      } else linea = prueba
    }
    if (linea) ctx.fillText(linea, x + ANCHO_CARTA / 2, y + ALTO_CARTA / 2 + ln * 22)
  }
  ctx.restore()

  if (p.cantidad > 1) {
    const cx = x + ANCHO_CARTA - 26
    const cy = y + 26
    ctx.beginPath()
    ctx.arc(cx, cy, 20, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.82)'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = COLOR_ACENTO
    ctx.stroke()
    ctx.fillStyle = COLOR_ACENTO
    ctx.font = '800 22px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(p.cantidad), cx, cy + 1)
    ctx.textBaseline = 'alphabetic'
  }
}

/** Rótulo de sección, con una línea que llega hasta el borde. */
function dibujarSeccion(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, ancho: number) {
  ctx.fillStyle = COLOR_TENUE
  ctx.font = '700 20px ui-monospace, monospace'
  ctx.textAlign = 'left'
  ctx.fillText(texto.toUpperCase(), x, y)
  const w = ctx.measureText(texto.toUpperCase()).width
  ctx.strokeStyle = 'rgba(139,148,158,0.28)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x + w + 14, y - 6)
  ctx.lineTo(x + ancho, y - 6)
  ctx.stroke()
}

/**
 * La hoja del mazo como PNG.
 *
 * @param nombreJugador quién lo lleva. Vacío = no se dibuja la línea.
 */
export async function generarImagenMazo(deck: Deck, nombreJugador = ''): Promise<Blob> {
  // El líder y la base van juntos arriba: son lo primero que alguien mira para
  // saber de qué va el mazo.
  const cabeza = [...deck.leaders, ...(deck.base ? [deck.base] : [])]
  const [pCabeza, pPrincipal, pBanquillo] = await Promise.all([
    prepararPiezas(cabeza),
    prepararPiezas(deck.mainDeck),
    prepararPiezas(deck.sideboard),
  ])

  const filas = (n: number) => Math.max(0, Math.ceil(n / POR_FILA))
  const altoBloque = (n: number) => filas(n) * ALTO_CARTA + Math.max(0, filas(n) - 1) * HUECO

  const ALTO_ROTULO = 44
  let alto = ALTO_CABECERA
  if (pCabeza.length) alto += ALTO_ROTULO + altoBloque(pCabeza.length) + HUECO * 2
  if (pPrincipal.length) alto += ALTO_ROTULO + altoBloque(pPrincipal.length) + HUECO * 2
  if (pBanquillo.length) alto += ALTO_ROTULO + altoBloque(pBanquillo.length) + HUECO * 2
  alto += ALTO_PIE

  const ancho = MARGEN * 2 + POR_FILA * ANCHO_CARTA + (POR_FILA - 1) * HUECO

  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const ctx = lienzo.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear el lienzo.')

  ctx.fillStyle = COLOR_FONDO
  ctx.fillRect(0, 0, ancho, alto)

  // ── cabecera ──
  const lider = deck.leaders[0]
  ctx.fillStyle = COLOR_TEXTO
  ctx.font = '800 44px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(deck.name || 'Mazo sin nombre', MARGEN, 62)

  ctx.fillStyle = COLOR_ACENTO
  ctx.font = '600 24px system-ui, sans-serif'
  const subtitulo = [
    lider ? `${lider.name}${lider.subtitle ? `, ${lider.subtitle}` : ''}` : null,
    deck.base ? `${deck.base.name}${deck.base.subtitle ? `, ${deck.base.subtitle}` : ''}` : null,
  ].filter(Boolean).join('  ·  ')
  if (subtitulo) ctx.fillText(subtitulo, MARGEN, 96)

  const totalPrincipal = deck.mainDeck.reduce((a, c) => a + c.quantity, 0)
  const totalBanquillo = deck.sideboard.reduce((a, c) => a + c.quantity, 0)
  ctx.fillStyle = COLOR_TENUE
  ctx.font = '500 19px system-ui, sans-serif'
  const meta = [
    nombreJugador || null,
    `Formato: ${deck.format}`,
    `${totalPrincipal} cartas`,
    totalBanquillo ? `Banquillo: ${totalBanquillo}` : null,
  ].filter(Boolean).join('  ·  ')
  ctx.fillText(meta, MARGEN, 124)

  // ── bloques ──
  let y = ALTO_CABECERA
  const anchoUtil = ancho - MARGEN * 2

  const bloque = (titulo: string, piezas: Pieza[]) => {
    if (!piezas.length) return
    dibujarSeccion(ctx, titulo, MARGEN, y + 22, anchoUtil)
    y += ALTO_ROTULO
    piezas.forEach((p, i) => {
      const col = i % POR_FILA
      const fil = Math.floor(i / POR_FILA)
      dibujarPieza(ctx, p, MARGEN + col * (ANCHO_CARTA + HUECO), y + fil * (ALTO_CARTA + HUECO))
    })
    y += altoBloque(piezas.length) + HUECO * 2
  }

  bloque('Líder y base', pCabeza)
  bloque(`Mazo principal · ${totalPrincipal}`, pPrincipal)
  bloque(`Banquillo · ${totalBanquillo}`, pBanquillo)

  // ── pie ──
  ctx.fillStyle = COLOR_TENUE
  ctx.font = '500 17px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('HOLOCRON SWU · swusv.com', MARGEN, alto - 18)
  ctx.textAlign = 'right'
  ctx.fillText(
    new Date().toLocaleDateString('es-SV', { day: 'numeric', month: 'long', year: 'numeric' }),
    ancho - MARGEN, alto - 18,
  )

  return new Promise((resolver, rechazar) => {
    lienzo.toBlob(
      b => b ? resolver(b) : rechazar(new Error('El navegador no pudo generar la imagen.')),
      'image/png',
    )
  })
}

/** Nombre de archivo sin sorpresas en ningún sistema. */
export function nombreArchivoMazo(deck: Deck): string {
  const limpio = (deck.name || 'mazo')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'mazo'
  return `${limpio}.png`
}

/**
 * Entrega la imagen: compartir si el aparato sabe, y si no, descargar.
 *
 * En el teléfono —que es donde se usa— compartir es lo que la gente quiere:
 * abre WhatsApp directo. `canShare` con el archivo se consulta ANTES porque
 * varios navegadores tienen `share` pero rechazan archivos, y ahí hay que caer
 * a la descarga en vez de fallar.
 */
export async function entregarImagen(blob: Blob, nombre: string, titulo: string): Promise<'compartida' | 'descargada'> {
  const archivo = new File([blob], nombre, { type: 'image/png' })
  const nav = navigator as Navigator & {
    canShare?: (d: { files?: File[] }) => boolean
    share?: (d: { files?: File[]; title?: string }) => Promise<void>
  }
  if (nav.canShare?.({ files: [archivo] }) && nav.share) {
    try {
      await nav.share({ files: [archivo], title: titulo })
      return 'compartida'
    } catch {
      // Cancelar el diálogo también llega acá; caer a descarga es inofensivo.
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  // Sin esto, el blob queda retenido hasta que se cierre la pestaña; una hoja
  // de mazo son varios MB.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'descargada'
}

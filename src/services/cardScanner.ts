/**
 * cardScanner — identificar una carta física con la cámara.
 *
 * ── Qué se lee, y por qué eso y no el arte ────────────────────────────
 *
 * Reconocer la ilustración exigiría comparar contra 9,057 imágenes y sigue
 * fallando con reflejos, fundas y ángulos. Pero toda carta de SWU imprime su
 * identidad en la franja de abajo:
 *
 *     RENO        © LFL & FFG        ASH·EN        1/264
 *
 * Set y número. Ese par es ÚNICO y ya está en nuestra base (`setCode` +
 * `setNumber`), así que leerlo con OCR da una respuesta determinista en vez de
 * un parecido. Se lee solo esa franja: menos píxeles, más rápido y sin que el
 * texto de reglas ensucie el resultado.
 *
 * ── Lo que este módulo NO hace ────────────────────────────────────────
 *
 * No adivina. Si el OCR no deja un set y un número claros, devuelve «no se
 * pudo leer» y la pantalla ofrece escribir el número a mano. Meter una carta
 * equivocada en la colección de alguien es peor que pedirle que la teclee.
 */

import { db } from './db'
import type { Card } from '../types'

/**
 * La banda que se lee, en fracciones del fotograma.
 *
 * ES LA MISMA que dibuja la guía en pantalla, y por eso vive acá y se exporta:
 * cuando cada lado tenía su propio número, la persona alineaba el código con
 * un rectángulo y el OCR leía otro pedazo del fotograma. Si se toca esto, se
 * mueve la guía sola.
 *
 * OJO: para que la cuenta cierre, el <video> tiene que ir con `object-contain`.
 * Con `object-cover` el navegador recorta el vídeo para llenar la caja y lo que
 * se ve deja de corresponder con las coordenadas del fotograma.
 */
export const BANDA = { x: 0.05, y: 0.60, w: 0.90, h: 0.22 } as const

/** Solo lo que puede aparecer en el código: mayúsculas, dígitos y separadores. */
const LISTA_BLANCA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/·.- '

export interface CodigoLeido {
  setCode: string | null
  numero: number | null
  /** Texto crudo del OCR, para poder diagnosticar cuando falla. */
  crudo: string
}

/**
 * Saca set y número del texto de la franja.
 *
 * El OCR confunde de forma sistemática caracteres parecidos, así que el número
 * se normaliza antes de convertirlo: O→0, I/l→1, S→5, B→8. Se hace SOLO sobre
 * el número —donde únicamente puede haber dígitos—, nunca sobre el set, que sí
 * lleva letras de verdad.
 */
export function parseCodigo(texto: string): CodigoLeido {
  const t = texto.toUpperCase().replace(/\s+/g, ' ')

  const arreglaDigitos = (s: string) =>
    s.replace(/[OQD]/g, '0').replace(/[IL|]/g, '1').replace(/S/g, '5').replace(/B/g, '8')

  // «1/264», «001 / 264». Se toma el numerador.
  //
  // Ojo con la clase de caracteres: tiene que EXCLUIR el espacio y exigir que
  // antes venga algo que no sea letra ni dígito. Si no, en «ASH·ES 7/264» el
  // numerador se comía la «S» de «ES» —porque S es una confusión válida de 5—
  // y la carta 7 se leía como la 57.
  const mNum = /(?:^|[^A-Z0-9])([0-9OQDILSB]{1,3})\s*\/\s*([0-9OQDILSB]{2,4})/.exec(t)
  let numero: number | null = null
  if (mNum) {
    const n = parseInt(arreglaDigitos(mNum[1].replace(/\s/g, '')), 10)
    if (Number.isFinite(n) && n > 0 && n < 1000) numero = n
  }

  // «ASH·EN», «ASH EN», «ASHEN». El idioma varía (EN, ES, FR…), así que se
  // acepta cualquier par de letras después del set.
  let setCode: string | null = null
  const mSet = /\b([A-Z]{2,4})\s*[·•.-]?\s*(EN|ES|FR|DE|IT|PT|JP|ZH)\b/.exec(t)
  if (mSet) setCode = mSet[1]

  return { setCode, numero, crudo: texto.trim() }
}

export interface Coincidencia {
  card: Card
  /** Otras impresiones con el mismo set y número (foil, hyperspace…). */
  alternativas: Card[]
}

/**
 * Busca la carta por set + número.
 *
 * Con el set leído la consulta es exacta. Si el OCR no lo sacó pero sí el
 * número, se busca en TODOS los sets: si cae en uno solo sirve igual, y si cae
 * en varios se devuelven como alternativas para que la persona elija — nunca
 * se elige por ella.
 */
export async function buscarPorCodigo(codigo: CodigoLeido): Promise<Coincidencia | null> {
  if (codigo.numero == null) return null

  const candidatas = codigo.setCode
    ? await db.cards.where('setCode').equals(codigo.setCode).toArray()
    : await db.cards.toArray()

  const iguales = candidatas.filter(c => c.setNumber === codigo.numero)
  if (iguales.length === 0) return null

  // La impresión Standard manda; el resto quedan como alternativas.
  const orden = [...iguales].sort((a, b) => {
    const rank = (c: Card) => (c.variantType === 'Standard' ? 0 : c.isCanonical ? 1 : 2)
    return rank(a) - rank(b) || a.setCode.localeCompare(b.setCode)
  })

  // Sin set leído, un número que aparece en varios sets es ambiguo de verdad:
  // se devuelve la lista entera para que elija la persona.
  const distintosSets = new Set(orden.map(c => c.setCode)).size
  if (!codigo.setCode && distintosSets > 1) {
    return { card: orden[0], alternativas: orden }
  }

  return { card: orden[0], alternativas: orden.slice(1) }
}

// ─── OCR ──────────────────────────────────────────────────────────────

type Worker = { recognize: (img: unknown) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> }
let worker: Worker | null = null
let cargando: Promise<Worker> | null = null

/**
 * Arranca el motor de OCR. Se carga una sola vez y solo al abrir el escáner,
 * nunca en el arranque de la app: en el bundle esto son 11 KB.
 *
 * OJO CON EL OFFLINE: tesseract.js baja su worker, el wasm y los datos del
 * idioma de un CDN la primera vez, varios MB. O sea que **escanear necesita
 * internet**, aunque el resto de la app funcione sin él. Por eso la pantalla
 * siempre ofrece escribir el número a mano: eso es una consulta a Dexie y
 * funciona sin conexión.
 */
export function iniciarOCR(): Promise<Worker> {
  if (worker) return Promise.resolve(worker)
  if (cargando) return cargando
  cargando = (async () => {
    try {
      const { createWorker } = await import('tesseract.js')
      const w = await createWorker('eng')
      await w.setParameters({
        tessedit_char_whitelist: LISTA_BLANCA,
        // Una sola línea de texto: es lo que hay en la banda.
        tessedit_pageseg_mode: '7' as unknown as never,
      })
      worker = w as unknown as Worker
      return worker
    } catch (e) {
      // Que un fallo de descarga se pueda REINTENTAR y, sobre todo, que se
      // pueda MOSTRAR: mientras esto se tragaba en silencio, quedarse sin
      // motor se veía igual que una carta que no engancha, y no había forma
      // de distinguir «no hay internet» de «acercá más la carta».
      cargando = null
      throw new Error(
        `No se pudo cargar el lector de texto: ${e instanceof Error ? e.message : 'error de red'}`,
      )
    }
  })()
  return cargando
}

/** ¿El motor ya está cargado y listo para leer? */
export const ocrListo = () => worker !== null

export async function detenerOCR(): Promise<void> {
  const w = worker
  worker = null
  cargando = null
  if (w) await w.terminate().catch(() => {})
}

/** Alto al que se lleva la franja antes de leerla, en píxeles. */
const ALTO_OBJETIVO = 140

/**
 * Techo de ancho del recorte.
 *
 * Existe por RENDIMIENTO, no por calidad. Sin él, una banda de 1280×158
 * escalada ×2 daba un lienzo de 2560×316: 800.000 píxeles que el umbral
 * recorría entero en el hilo principal, cada segundo y medio. Eso es lo que
 * trababa la vista previa y hacía imposible encuadrar. A 900 px de ancho el
 * OCR sigue leyendo igual —el texto ya entra de sobra— con casi 10 veces
 * menos trabajo.
 */
const ANCHO_MAX = 900

/**
 * Lienzo reutilizado.
 *
 * Crear un canvas nuevo por fotograma obliga al recolector de basura a liberar
 * varios MB por segundo, y esos tirones también se ven en la cámara.
 */
let lienzo: HTMLCanvasElement | null = null

/**
 * Recorta la franja del código y la prepara para el OCR.
 *
 * Decisiones, todas medidas y no supuestas:
 *
 * - **Se lee la BANDA de la guía, no «el fondo del fotograma».** Al principio
 *   recortaba el 16% inferior del vídeo dando por hecho que la carta llenaba
 *   la pantalla. No la llena: la carta está en el medio, así que se leía el
 *   escritorio. Ahora el recorte y la guía comparten la constante `BANDA`.
 * - **Se toma la banda ANCHA, no solo la derecha.** Recortar donde está el
 *   código parecía lo obvio, pero a 800 px se perdía la barra de «1/264» y el
 *   número salía como 1264.
 * - **Se escala a un alto fijo**, no ×3: así una cámara de 720p y una de 4K
 *   llegan al OCR con el mismo tamaño de letra.
 * - **El umbral es la media del recorte**, no 128: el pie es una barra oscura
 *   con texto claro, y un umbral fijo se comía el texto en las cartas de fondo
 *   más oscuro. Invertir resultó indiferente —Tesseract lee bien claro sobre
 *   oscuro— así que no se invierte.
 */
export function recortarFranja(
  fuente: HTMLVideoElement | HTMLCanvasElement,
  ancho: number,
  alto: number,
  /** Rectángulo a leer, en fracciones. Por defecto, la banda de la guía. */
  banda: { x: number; y: number; w: number; h: number } = BANDA,
  /**
   * ¿Se puede REDUCIR el recorte?
   *
   * En vivo sí: hay una guía, el encuadre es predecible y bajar de tamaño es
   * lo que mantiene fluida la vista previa. En una FOTO no: la carta puede
   * ocupar poco y la franja salir muy alta, con lo que reducirla encoge el
   * texto y el OCR se queda sin nada que leer. Una foto se lee una vez, así
   * que ahí conviene gastar píxeles.
   */
  permitirReducir = true,
): HTMLCanvasElement {
  const sx = Math.round(ancho * banda.x)
  const sy = Math.round(alto * banda.y)
  const sw = Math.max(1, Math.round(ancho * banda.w))
  const sh = Math.max(20, Math.round(alto * banda.h))

  // La escala sube hasta el alto objetivo, pero el ancho manda: pasado
  // ANCHO_MAX el coste crece sin que el OCR lea mejor.
  const bruta = Math.min(ALTO_OBJETIVO / sh, ANCHO_MAX / sw)
  const escala = permitirReducir ? bruta : Math.max(1, bruta)
  const cw = Math.max(60, Math.round(sw * escala))
  const ch = Math.max(20, Math.round(sh * escala))

  const canvas = lienzo ?? (lienzo = document.createElement('canvas'))
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw
    canvas.height = ch
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'medium'
  ctx.drawImage(fuente, sx, sy, sw, sh, 0, 0, cw, ch)

  const img = ctx.getImageData(0, 0, cw, ch)
  const px = img.data

  // El umbral se estima MUESTREANDO 1 de cada 16 píxeles. Recorrerlos todos
  // dos veces era el grueso del trabajo, y para una media no aporta nada:
  // sobre 100.000 píxeles, 6.000 muestras dan el mismo número.
  let suma = 0
  let n = 0
  for (let i = 0; i < px.length; i += 64) {
    suma += px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114
    n++
  }
  const umbral = n > 0 ? suma / n : 128

  for (let i = 0; i < px.length; i += 4) {
    const gris = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114
    const v = gris > umbral ? 255 : 0
    px[i] = px[i + 1] = px[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

/** Lee la franja de un fotograma y devuelve lo que haya podido interpretar. */
export async function leerCodigo(
  fuente: HTMLVideoElement | HTMLCanvasElement,
  ancho: number,
  alto: number,
): Promise<CodigoLeido> {
  const w = await iniciarOCR()
  const franja = recortarFranja(fuente, ancho, alto)
  const { data } = await w.recognize(franja)
  return parseCodigo(data.text ?? '')
}

/**
 * Bandas que se prueban en una FOTO, en orden.
 *
 * Con la cámara en vivo hay una guía y la persona pone el código donde se le
 * pide. En una foto no: cada quien encuadra como puede —la carta entera, solo
 * el pie, torcida—, así que se prueban varias zonas y gana la primera que deje
 * un número. Es más trabajo, pero una foto se lee UNA vez, no cada dos
 * segundos.
 */
const BANDAS_FOTO = (() => {
  // Franjas FINAS que barren la mitad inferior, solapadas para que el código
  // no caiga justo en una costura.
  //
  // Antes había dos bandas grandes («mitad inferior», «foto entera») y no
  // funcionaban: el recorte se escala a un alto fijo, así que una banda muy
  // alta ENCOGE el texto en vez de agrandarlo y el OCR se queda sin nada que
  // leer. Con una foto vertical de 900×1600 fallaba justo por eso.
  const franjas: { x: number; y: number; w: number; h: number }[] = []
  const alto = 0.13
  for (let y = 0.86; y >= 0.40; y -= 0.065) {
    franjas.push({ x: 0, y: Math.max(0, y), w: 1, h: alto })
  }
  return franjas
})()

/**
 * Lee el código de una imagen ya tomada.
 *
 * Es la vía de compatibilidad: funciona en cualquier dispositivo —incluso sin
 * permiso de cámara en el navegador— porque la foto la saca la app de cámara
 * del teléfono, que enfoca, hace zoom y tiene flash mucho mejor que nosotros.
 */
export async function leerCodigoDeImagen(archivo: File | Blob): Promise<CodigoLeido> {
  const w = await iniciarOCR()
  const url = URL.createObjectURL(archivo)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('No se pudo abrir la imagen.'))
      i.src = url
    })

    // La foto se lleva a un ancho de trabajo acotado. Una de 4K sin reducir
    // hacía que cada franja fuera enorme y leerla entera se pasaba de treinta
    // segundos; a 1800 px el código sigue nítido y el barrido termina rápido.
    const MAX_ANCHO_FOTO = 1800
    const escalaFoto = Math.min(1, MAX_ANCHO_FOTO / img.naturalWidth)
    const lienzoFoto = document.createElement('canvas')
    lienzoFoto.width = Math.round(img.naturalWidth * escalaFoto)
    lienzoFoto.height = Math.round(img.naturalHeight * escalaFoto)
    const ctxFoto = lienzoFoto.getContext('2d')!
    ctxFoto.imageSmoothingQuality = 'high'
    ctxFoto.drawImage(img, 0, 0, lienzoFoto.width, lienzoFoto.height)

    let ultimo: CodigoLeido = { setCode: null, numero: null, crudo: '' }
    for (const banda of BANDAS_FOTO) {
      const recorte = recortarFranja(lienzoFoto, lienzoFoto.width, lienzoFoto.height, banda, false)
      const { data } = await w.recognize(recorte)
      const leido = parseCodigo(data.text ?? '')
      if (leido.numero != null) return leido
      if (leido.crudo.length > ultimo.crudo.length) ultimo = leido
    }
    return ultimo
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ─── Compatibilidad de la cámara ──────────────────────────────────────

export interface Camara {
  stream: MediaStream
  /** La linterna ayuda MUCHO con letra tan chica; no todos la exponen. */
  tieneLinterna: boolean
}

/**
 * Abre la cámara probando de la mejor opción a la más básica.
 *
 * Pedir `facingMode: environment` con resolución ideal falla en varios
 * navegadores de escritorio y en algunos Android viejos: si se pide todo junto
 * y no se puede, no se abre NADA. Bajando de a poco, siempre queda algo.
 */
export async function abrirCamara(): Promise<Camara> {
  if (!window.isSecureContext) {
    throw new Error('La cámara solo funciona con conexión segura (https).')
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este navegador no permite usar la cámara. Podés subir una foto.')
  }

  const intentos: MediaStreamConstraints[] = [
    { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } } },
    { video: { facingMode: { ideal: 'environment' } } },
    { video: { facingMode: 'environment' } },
    { video: true },
  ]

  let ultimo: unknown = null
  for (const c of intentos) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(c)
      const track = stream.getVideoTracks()[0]
      const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean }
      return { stream, tieneLinterna: caps.torch === true }
    } catch (e) {
      ultimo = e
      // Si negaron el permiso, insistir con otras restricciones no sirve.
      if (e instanceof Error && e.name === 'NotAllowedError') break
    }
  }

  const nombre = ultimo instanceof Error ? ultimo.name : ''
  if (nombre === 'NotAllowedError') {
    throw new Error('No diste permiso de cámara. Podés subir una foto en su lugar.')
  }
  if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') {
    throw new Error('No se encontró una cámara utilizable. Podés subir una foto.')
  }
  throw new Error('No se pudo abrir la cámara. Podés subir una foto.')
}

/** Enciende o apaga la linterna, si el dispositivo la expone. */
export async function linterna(stream: MediaStream | null, encendida: boolean): Promise<void> {
  const track = stream?.getVideoTracks()[0]
  if (!track) return
  try {
    // `torch` no está en los tipos estándar todavía, pero es lo que
    // usan Chrome y Edge en Android para la linterna.
    await track.applyConstraints({ advanced: [{ torch: encendida }] } as unknown as MediaTrackConstraints)
  } catch {
    // No todos la soportan; que falle no debe romper el escaneo.
  }
}

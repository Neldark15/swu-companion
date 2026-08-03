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

/** Alto de la franja inferior donde va el código, como fracción de la imagen. */
const FRANJA = 0.16

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
    const { createWorker } = await import('tesseract.js')
    const w = await createWorker('eng')
    await w.setParameters({
      tessedit_char_whitelist: LISTA_BLANCA,
      // Una sola línea de texto: es lo que hay en la franja.
      tessedit_pageseg_mode: '7' as unknown as never,
    })
    worker = w as unknown as Worker
    return worker
  })()
  return cargando
}

export async function detenerOCR(): Promise<void> {
  const w = worker
  worker = null
  cargando = null
  if (w) await w.terminate().catch(() => {})
}

/** Alto al que se lleva la franja antes de leerla, en píxeles. */
const ALTO_OBJETIVO = 200

/**
 * Recorta la franja del código y la prepara para el OCR.
 *
 * Tres decisiones, las tres medidas contra un pie de carta simulado a la
 * resolución que da una cámara:
 *
 * - **Se toma la franja ENTERA, no solo la derecha.** Recortar donde está el
 *   código parecía lo obvio, pero a 800 px se perdía la barra de «1/264» y el
 *   número salía como 1264. Con la franja completa lee
 *   `RENO OLFL E FFG ASH-EN 1/264` y acierta.
 * - **Se escala a un alto fijo**, no ×3: así una cámara de 720p y una de 4K
 *   llegan al OCR con el mismo tamaño de letra.
 * - **El umbral es la media de la franja**, no 128: el pie es una barra oscura
 *   con texto claro, y un umbral fijo se comía el texto en las cartas de fondo
 *   más oscuro. Invertir resultó indiferente —Tesseract lee bien claro sobre
 *   oscuro— así que no se invierte.
 */
export function recortarFranja(
  fuente: HTMLVideoElement | HTMLCanvasElement,
  ancho: number,
  alto: number,
): HTMLCanvasElement {
  const hFranja = Math.max(20, Math.round(alto * FRANJA))
  const escala = Math.max(2, ALTO_OBJETIVO / hFranja)

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(ancho * escala)
  canvas.height = Math.round(hFranja * escala)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(fuente, 0, alto - hFranja, ancho, hFranja, 0, 0, canvas.width, canvas.height)

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = img.data
  let suma = 0
  for (let i = 0; i < px.length; i += 4) {
    suma += px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114
  }
  const umbral = suma / (px.length / 4)
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

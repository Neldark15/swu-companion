/**
 * exportarTabla — sacar una tabla de puntos de la app para publicarla.
 *
 * Tres salidas, porque tres destinos distintos:
 *   · **CSV** para hoja de cálculo
 *   · **texto** para pegar en WhatsApp
 *   · **PNG** para subir a historias o feed
 *
 * ── Por qué el CSV se escribe acá y no se reusa ───────────────────────
 *
 * La app ya genera CSV en dos sitios (`collectionExport` y
 * `deckImportExport`) y **ninguno de los dos escapa comas ni comillas**.
 * Funcionan porque sus campos son códigos de set y números. Una tabla de
 * puntos lleva nombres escritos por personas: el primer «Vara, Christian»
 * parte la fila en dos y el archivo queda mal SIN UN SOLO ERROR. Acá se
 * escapa según RFC 4180 y punto.
 *
 * ── Por qué el lienzo se dibuja acá ───────────────────────────────────
 *
 * `CompartirArticulo` tiene primitivas de canvas equivalentes (envolver,
 * espaciado, placa) pero **no las exporta**, y sacarlas de ahí obliga a
 * tocar una pantalla viva por un módulo que todavía está oculto. Se
 * duplican a propósito y acotado: son ayudas de dibujo genéricas, no
 * lógica de negocio, así que no hay una verdad que se pueda separar en
 * dos. El día que el Centro se publique, se unifican en `services/lienzo`.
 */

import { entregarImagen } from '../../services/deckImagen'
import { downloadFile } from '../../services/collectionExport'
import { diaCalendarioSV } from '../../services/horaSV'

/** Una fila lista para publicar. El Centro la arma; esto solo la pinta. */
export interface FilaPublicable {
  puesto: number
  nombre: string
  /** `true` si jugó sin cuenta. Se marca porque es un tercio de la sala. */
  invitado: boolean
  /** Columnas de números, en orden. Cada una con su encabezado en `columnas`. */
  valores: (string | number)[]
}

export interface TablaPublicable {
  titulo: string
  subtitulo: string
  columnas: string[]
  filas: FilaPublicable[]
  /** El pie: de dónde salen los números. Sin esto es un rumor, no un dato. */
  nota: string
}

// ── CSV ──────────────────────────────────────────────────────────────

/**
 * Un campo de CSV según RFC 4182: si lleva coma, comilla o salto de línea va
 * entre comillas, y las comillas de adentro se duplican.
 */
function campo(v: string | number): string {
  const s = String(v ?? '')
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function aCSV(t: TablaPublicable): string {
  const lineas = [
    ['Puesto', 'Jugador', 'Cuenta', ...t.columnas].map(campo).join(','),
    ...t.filas.map(f =>
      [f.puesto, f.nombre, f.invitado ? 'invitado' : 'registrado', ...f.valores]
        .map(campo)
        .join(','),
    ),
  ]
  // \r\n es lo que pide el RFC y lo que Excel espera en Windows.
  return lineas.join('\r\n')
}

// ── Texto plano ──────────────────────────────────────────────────────

/**
 * Para pegar en WhatsApp. Sin tabla ASCII a propósito: WhatsApp no usa fuente
 * monoespaciada y las columnas alineadas con espacios se descuadran solas.
 */
export function aTexto(t: TablaPublicable): string {
  const cuerpo = t.filas
    .map(f => {
      const nums = f.valores.map((v, i) => `${t.columnas[i]} ${v}`).join(' · ')
      return `${f.puesto}. ${f.nombre}${f.invitado ? ' *' : ''} — ${nums}`
    })
    .join('\n')
  const asterisco = t.filas.some(f => f.invitado) ? '\n* jugó sin cuenta en la app' : ''
  return `${t.titulo}\n${t.subtitulo}\n\n${cuerpo}\n\n${t.nota}${asterisco}`
}

// ── Lienzo ───────────────────────────────────────────────────────────

const ANCHO = 1080
const MARGEN = 64
const ALTO_FILA = 74

/** Espaciado entre letras: el canvas no tiene `letter-spacing`. */
function espaciado(ctx: CanvasRenderingContext2D, txt: string, x: number, y: number, sep: number) {
  let cursor = x
  for (const ch of txt) {
    ctx.fillText(ch, cursor, y)
    cursor += ctx.measureText(ch).width + sep
  }
}

function anchoEspaciado(ctx: CanvasRenderingContext2D, txt: string, sep: number): number {
  let w = 0
  for (const ch of txt) w += ctx.measureText(ch).width + sep
  return Math.max(0, w - sep)
}

/** Recorta con puntos suspensivos al ancho dado. */
function recorte(ctx: CanvasRenderingContext2D, txt: string, max: number): string {
  if (ctx.measureText(txt).width <= max) return txt
  let s = txt
  while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1)
  return s + '…'
}

/**
 * La silueta escalonada de la placa. La gramática se REDIBUJA a esta escala,
 * no se escala: a 1080 px una muesca de 10 unidades del viewBox de la
 * credencial mediría 2 px y se leería como un redondeo.
 */
function placa(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const m = 34 // muesca superior derecha
  const c = 20 // chaflán
  ctx.beginPath()
  ctx.moveTo(x + c, y)
  ctx.lineTo(x + w - m - c, y)
  ctx.lineTo(x + w - m, y + c)
  ctx.lineTo(x + w - c, y + c)
  ctx.lineTo(x + w, y + c * 2)
  ctx.lineTo(x + w, y + h - c)
  ctx.lineTo(x + w - c, y + h)
  ctx.lineTo(x + c, y + h)
  ctx.lineTo(x, y + h - c)
  ctx.lineTo(x, y + c)
  ctx.closePath()
}

/**
 * Dibuja la tabla y devuelve el PNG.
 *
 * Todo se dibuja: no se carga NINGUNA imagen externa. El lienzo se mantiene
 * limpio y `toBlob` nunca lanza `SecurityError` — el CDN de las cartas no
 * manda CORS y contaminaría el canvas (§3b).
 */
export async function aImagen(t: TablaPublicable): Promise<Blob> {
  const alto = 300 + t.filas.length * ALTO_FILA + 150
  const cv = document.createElement('canvas')
  cv.width = ANCHO
  cv.height = alto
  const ctx = cv.getContext('2d')
  if (!ctx) throw new Error('Este navegador no puede dibujar la tabla.')

  // Fondo
  const cielo = ctx.createLinearGradient(0, 0, 0, alto)
  cielo.addColorStop(0, '#1e1e2e')
  cielo.addColorStop(1, '#12121c')
  ctx.fillStyle = cielo
  ctx.fillRect(0, 0, ANCHO, alto)

  // Cabecera
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#22D3EE'
  ctx.font = '600 26px "JetBrains Mono", ui-monospace, monospace'
  espaciado(ctx, t.subtitulo.toUpperCase(), MARGEN, 96, 4)

  ctx.fillStyle = '#E2E8F0'
  ctx.font = '800 62px Inter, system-ui, sans-serif'
  ctx.fillText(recorte(ctx, t.titulo, ANCHO - MARGEN * 2), MARGEN, 172)

  ctx.strokeStyle = 'rgba(34,211,238,0.45)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(MARGEN, 200)
  ctx.lineTo(ANCHO - MARGEN, 200)
  ctx.stroke()

  // Encabezados de columna, alineados a la derecha desde el borde
  const anchoCol = 116
  const derecha = ANCHO - MARGEN
  ctx.font = '600 20px "JetBrains Mono", ui-monospace, monospace'
  ctx.fillStyle = '#8B9BB2'
  t.columnas.forEach((col, i) => {
    const cx = derecha - (t.columnas.length - 1 - i) * anchoCol
    const etiqueta = col.toUpperCase()
    espaciado(ctx, etiqueta, cx - anchoEspaciado(ctx, etiqueta, 3), 250, 3)
  })

  // Filas
  let y = 274
  for (const f of t.filas) {
    const podio = f.puesto <= 3

    placa(ctx, MARGEN, y, ANCHO - MARGEN * 2, ALTO_FILA - 12)
    ctx.fillStyle = podio ? 'rgba(245,158,11,0.10)' : 'rgba(255,255,255,0.035)'
    ctx.fill()
    ctx.strokeStyle = podio ? 'rgba(245,158,11,0.45)' : 'rgba(255,255,255,0.09)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    const centro = y + (ALTO_FILA - 12) / 2 + 11

    ctx.fillStyle = podio ? '#F59E0B' : '#8B9BB2'
    ctx.font = '700 34px "JetBrains Mono", ui-monospace, monospace'
    const p = String(f.puesto)
    ctx.fillText(p, MARGEN + 44 - ctx.measureText(p).width, centro)

    ctx.fillStyle = '#E2E8F0'
    ctx.font = `${podio ? 700 : 500} 34px Inter, system-ui, sans-serif`
    const anchoNombre = ANCHO - MARGEN * 2 - 80 - t.columnas.length * anchoCol
    ctx.fillText(recorte(ctx, f.nombre, anchoNombre), MARGEN + 68, centro)

    // El asterisco de invitado va pegado al nombre, no en una columna: una
    // columna entera para una marca de tres filas es ruido.
    if (f.invitado) {
      const w = ctx.measureText(recorte(ctx, f.nombre, anchoNombre)).width
      ctx.fillStyle = '#8B9BB2'
      ctx.font = '500 26px Inter, system-ui, sans-serif'
      ctx.fillText('*', MARGEN + 76 + w, centro - 8)
    }

    ctx.font = '600 34px "JetBrains Mono", ui-monospace, monospace'
    f.valores.forEach((v, i) => {
      const cx = derecha - (t.columnas.length - 1 - i) * anchoCol
      const s = String(v)
      ctx.fillStyle = i === f.valores.length - 1 ? (podio ? '#F59E0B' : '#E2E8F0') : '#8B9BB2'
      ctx.fillText(s, cx - ctx.measureText(s).width, centro)
    })

    y += ALTO_FILA
  }

  // Pie
  ctx.fillStyle = '#8B9BB2'
  ctx.font = '400 22px Inter, system-ui, sans-serif'
  const pie = t.filas.some(f => f.invitado)
    ? `${t.nota} · * jugó sin cuenta`
    : t.nota
  ctx.fillText(recorte(ctx, pie, ANCHO - MARGEN * 2), MARGEN, y + 46)

  ctx.fillStyle = '#22D3EE'
  ctx.font = '600 22px "JetBrains Mono", ui-monospace, monospace'
  espaciado(ctx, 'SWUSV.COM', MARGEN, y + 86, 4)

  return await new Promise<Blob>((res, rej) => {
    cv.toBlob(b => (b ? res(b) : rej(new Error('No se pudo generar la imagen.'))), 'image/png')
  })
}

// ── Entrega ──────────────────────────────────────────────────────────

/** Nombre de archivo sin acentos ni espacios, fechado con el día de El Salvador. */
export function nombreArchivo(titulo: string, ext: string): string {
  const base = titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 50)
  return `${base || 'tabla'}-${diaCalendarioSV(new Date())}.${ext}`
}

export function descargarCSV(t: TablaPublicable) {
  downloadFile(aCSV(t), nombreArchivo(t.titulo, 'csv'), 'text/csv')
}

export async function compartirImagen(t: TablaPublicable): Promise<'compartida' | 'descargada'> {
  const blob = await aImagen(t)
  return entregarImagen(blob, nombreArchivo(t.titulo, 'png'), t.titulo)
}

/**
 * Copiar al portapapeles con red de respaldo: `navigator.clipboard` no existe
 * fuera de contextos seguros ni en algunos navegadores embebidos.
 */
export async function copiarTexto(txt: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(txt)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = txt
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

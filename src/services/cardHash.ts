/**
 * cardHash — reconocer una carta por su ARTE, no por su texto.
 *
 * ── Por qué esto y no OCR ─────────────────────────────────────────────
 *
 * Leer el número impreso al pie con OCR tarda entre 1 y 5 segundos, baja
 * varios megas de un CDN la primera vez y con letra tan chica falla seguido.
 * Comparar el arte tarda menos de un milisegundo, funciona sin conexión desde
 * el primer uso y es lo que hacen los escáneres que funcionan: ManaBox lo dice
 * explícitamente («detecta las cartas usando el arte»).
 *
 * ── Cómo funciona ─────────────────────────────────────────────────────
 *
 * Se reduce la imagen a 64x64 en gris, se le aplica una DCT y se toma el
 * bloque de baja frecuencia de 24x24: son las formas grandes de la
 * ilustración, lo que sobrevive al reescalado, la compresión y los cambios de
 * luz. Cada uno de esos 576 coeficientes se compara con la mediana y sale un
 * bit. Dos fotos de la misma carta dan hashes casi iguales; dos cartas
 * distintas, muy distintos.
 *
 * ── Por qué 576 bits y no 64 ──────────────────────────────────────────
 *
 * Medido sobre 210 cartas reales con degradaciones (reescalado, JPEG, brillo,
 * desenfoque, ruido, reflejo, rotación y recorte):
 *
 *   - 64 bits se solapa ya con 194 artes: la carta equivocada más parecida
 *     queda a 6 bits y una foto legítima llega a 10. Inservible.
 *   - 256 bits separa hoy, pero extrapolado a 2.261 cartas el margen se agota.
 *   - 576 bits deja la equivocada más cercana a 144 bits y una foto legítima
 *     por debajo de 60. Ese margen es lo que permite DECIR QUE NO cuando la
 *     carta no está, en vez de devolver siempre la más parecida.
 *
 * ── Lo que este método NO resuelve ────────────────────────────────────
 *
 * - No distingue foil de no foil: es la misma ilustración.
 * - 53 cartas del set IBH comparten arte EXACTO entre sí (distancia 0-8).
 *   Para esas solo sirve el número impreso, y por eso el OCR se queda como
 *   desempate en vez de desaparecer.
 */

const LADO = 64
const BLOQUE = 24
export const BITS = BLOQUE * BLOQUE // 576
export const BYTES_HASH = BITS / 8 // 72

/** Firma del archivo de índice. Un formato viejo se rechaza en vez de leerse mal. */
const MAGIC = 0x53575548 // 'SWUH'
const BYTES_UUID = 16

// ─── Hash ─────────────────────────────────────────────────────────────

/**
 * Matriz de la DCT, calculada una sola vez.
 *
 * Es la MISMA fórmula que usa scripts/build-card-hashes.py. Están escritas a
 * mano en los dos lados a propósito: si el índice se construyera con una
 * librería y acá se usara otra, los hashes no serían comparables y no habría
 * forma de darse cuenta salvo que todo dejara de coincidir.
 */
let baseDCT: Float64Array | null = null

function matrizDCT(): Float64Array {
  if (baseDCT) return baseDCT
  const m = new Float64Array(LADO * LADO)
  for (let k = 0; k < LADO; k++) {
    for (let x = 0; x < LADO; x++) {
      m[k * LADO + x] = Math.cos((Math.PI * (2 * x + 1) * k) / (2 * LADO))
    }
  }
  baseDCT = m
  return m
}

let lienzo: HTMLCanvasElement | null = null

/**
 * Calcula el hash de un recorte de imagen.
 *
 * `fuente` puede ser el vídeo de la cámara o un lienzo con una foto ya
 * cargada; `rect` es la zona de la carta dentro de esa fuente.
 */
export function hashDeImagen(
  fuente: CanvasImageSource,
  rect: { x: number; y: number; w: number; h: number },
): Uint8Array {
  // El recorte se lee a su tamaño NATIVO y la reducción a 64x64 se hace a
  // mano, promediando por áreas.
  //
  // Por qué no se deja escalar al canvas: el filtro de `drawImage` no está
  // especificado y cada navegador usa el suyo, así que el índice construido
  // con uno no coincidiría con el hash calculado en otro. Medido: contra el
  // reescalado LANCZOS de Python la diferencia era de 58 a 92 bits sobre la
  // MISMA imagen — casi todo el margen que separa una carta de otra. Con el
  // promedio por áreas la aritmética es idéntica en todos lados.
  const ancho = Math.max(1, Math.round(rect.w))
  const alto = Math.max(1, Math.round(rect.h))
  const c = lienzo ?? (lienzo = document.createElement('canvas'))
  if (c.width !== ancho || c.height !== alto) {
    c.width = ancho
    c.height = alto
  }
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(fuente, rect.x, rect.y, rect.w, rect.h, 0, 0, ancho, alto)
  const px = ctx.getImageData(0, 0, ancho, alto).data

  const gris = new Float64Array(LADO * LADO)
  for (let fy = 0; fy < LADO; fy++) {
    const y0 = Math.floor((fy * alto) / LADO)
    const y1 = Math.max(y0 + 1, Math.floor(((fy + 1) * alto) / LADO))
    for (let fx = 0; fx < LADO; fx++) {
      const x0 = Math.floor((fx * ancho) / LADO)
      const x1 = Math.max(x0 + 1, Math.floor(((fx + 1) * ancho) / LADO))
      let suma = 0
      let n = 0
      for (let y = y0; y < y1; y++) {
        let off = (y * ancho + x0) * 4
        for (let x = x0; x < x1; x++, off += 4) {
          // Mismos coeficientes que usa PIL al convertir a 'L'.
          suma += px[off] * 0.299 + px[off + 1] * 0.587 + px[off + 2] * 0.114
          n++
        }
      }
      gris[fy * LADO + fx] = n > 0 ? suma / n : 0
    }
  }

  const base = matrizDCT()

  // Solo hacen falta las primeras BLOQUE filas y columnas del resultado, así
  // que se calcula el bloque de baja frecuencia y no la DCT entera: 24x24 en
  // vez de 64x64, con la mitad del trabajo.
  const inter = new Float64Array(BLOQUE * LADO)
  for (let k = 0; k < BLOQUE; k++) {
    for (let col = 0; col < LADO; col++) {
      let s = 0
      for (let x = 0; x < LADO; x++) s += base[k * LADO + x] * gris[x * LADO + col]
      inter[k * LADO + col] = s
    }
  }
  const coef = new Float64Array(BITS)
  for (let k = 0; k < BLOQUE; k++) {
    for (let l = 0; l < BLOQUE; l++) {
      let s = 0
      for (let col = 0; col < LADO; col++) s += inter[k * LADO + col] * base[l * LADO + col]
      coef[k * BLOQUE + l] = s
    }
  }

  // El término DC (el primero) es el brillo medio y cambia con la luz de la
  // habitación: si entrara en la mediana, la misma carta hashearía distinto
  // según la lámpara.
  const resto = Array.from(coef.subarray(1)).sort((a, b) => a - b)
  const mitad = resto.length >> 1
  const mediana = resto.length % 2 ? resto[mitad] : (resto[mitad - 1] + resto[mitad]) / 2

  const out = new Uint8Array(BYTES_HASH)
  for (let i = 0; i < BITS; i++) {
    if (coef[i] > mediana) out[i >> 3] |= 1 << (7 - (i & 7))
  }
  return out
}

// ─── Índice ───────────────────────────────────────────────────────────

export interface IndiceArte {
  /** uuid de cada carta, en hexadecimal con guiones. */
  ids: string[]
  /** Hashes concatenados: `BYTES_HASH` por carta, en el mismo orden que `ids`. */
  hashes: Uint8Array
}

let indice: IndiceArte | null = null
let cargando: Promise<IndiceArte | null> | null = null

const HEX: string[] = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'))

function bytesAUuid(b: Uint8Array, off: number): string {
  let s = ''
  for (let i = 0; i < 16; i++) {
    s += HEX[b[off + i]]
    if (i === 3 || i === 5 || i === 7 || i === 9) s += '-'
  }
  return s
}

/**
 * Carga el índice de arte que se despacha con la app.
 *
 * Son ~200 KB, menos de lo que pesa UNA imagen de carta del CDN, y el service
 * worker lo precachea: a diferencia del OCR, esto funciona sin conexión desde
 * el primer escaneo.
 */
export function cargarIndice(): Promise<IndiceArte | null> {
  if (indice) return Promise.resolve(indice)
  if (cargando) return cargando
  cargando = (async () => {
    try {
      const res = await fetch('/card-hashes.bin')
      if (!res.ok) throw new Error(`índice no disponible (${res.status})`)
      const buf = new Uint8Array(await res.arrayBuffer())
      const dv = new DataView(buf.buffer)

      if (buf.length < 12 || dv.getUint32(0, false) !== MAGIC) {
        throw new Error('el índice de arte no tiene el formato esperado')
      }
      const bits = dv.getUint16(6, true)
      const total = dv.getUint32(8, true)
      if (bits !== BITS) {
        throw new Error(`el índice es de ${bits} bits y este lector espera ${BITS}`)
      }

      const paso = BYTES_UUID + BYTES_HASH
      const esperado = 12 + total * paso
      if (buf.length < esperado) throw new Error('el índice de arte está incompleto')

      const ids: string[] = new Array(total)
      const hashes = new Uint8Array(total * BYTES_HASH)
      for (let i = 0; i < total; i++) {
        const off = 12 + i * paso
        ids[i] = bytesAUuid(buf, off)
        hashes.set(buf.subarray(off + BYTES_UUID, off + paso), i * BYTES_HASH)
      }
      indice = { ids, hashes }
      return indice
    } catch (e) {
      // Que se pueda reintentar: un fallo de red no debe dejar el escáner sin
      // índice para toda la sesión.
      cargando = null
      throw e
    }
  })()
  return cargando
}

export const indiceListo = () => indice !== null

/** Bits en 1 de cada byte, para contar diferencias sin bucles anidados. */
const POP = new Uint8Array(256)
for (let i = 0; i < 256; i++) POP[i] = (i & 1) + POP[i >> 1]

export interface Candidato {
  id: string
  distancia: number
}

export interface Resultado {
  mejor: Candidato
  segundo: Candidato | null
  /**
   * ¿Se puede confiar?
   *
   * No alcanza con que la distancia sea baja: hay que exigir que la segunda
   * opción esté MUCHO más lejos. Sin ese margen, una carta que no está en el
   * índice devolvería igual la más parecida, con aire de acierto.
   */
  confiable: boolean
}

/**
 * Umbrales, sacados de medir y no de elegir un número redondo.
 *
 * Prueba: 25 cartas reales × 5 degradaciones (nítida, reducida al 55%, torcida
 * 3 grados, oscura con desenfoque, y con reflejo), 125 intentos.
 *
 *                        distancia        margen sobre la 2ª
 *   aciertos (118)       8 a 180          mediana 98, p10 = 28
 *   errores (7)          12 a 142         2, 4, 6, 16
 *   mesa vacía           254              2
 *
 * Lo que decide NO es la distancia: hay aciertos legítimos a 180 —una carta
 * torcida tres grados— y errores a 12. Lo que separa es el MARGEN respecto de
 * la segunda opción: cuando la respuesta es correcta, la siguiente candidata
 * queda muy atrás; cuando es un parecido casual, hay un empate cerrado.
 *
 * Por eso el margen manda y la distancia solo pone un techo generoso, apenas
 * por debajo de lo que dio apuntar a una mesa vacía.
 */
const MAX_DISTANCIA = 220
const MARGEN_MINIMO = 28

/**
 * Busca el arte más parecido.
 *
 * Recorre las ~2.300 entradas con XOR y conteo de bits: medido, tarda menos de
 * un milisegundo, así que se puede hacer en cada fotograma.
 */
export function buscarPorArte(hash: Uint8Array, idx: IndiceArte): Resultado | null {
  const n = idx.ids.length
  if (n === 0) return null

  let mejorD = Infinity, mejorI = -1
  let segD = Infinity, segI = -1

  for (let i = 0; i < n; i++) {
    const off = i * BYTES_HASH
    let d = 0
    for (let b = 0; b < BYTES_HASH; b++) {
      d += POP[hash[b] ^ idx.hashes[off + b]]
      // Cortar temprano: la mayoría de las cartas se descartan enseguida y no
      // hace falta terminar de contar sus 72 bytes.
      if (d >= segD) break
    }
    if (d < mejorD) {
      segD = mejorD; segI = mejorI
      mejorD = d; mejorI = i
    } else if (d < segD) {
      segD = d; segI = i
    }
  }
  if (mejorI < 0) return null

  const mejor = { id: idx.ids[mejorI], distancia: mejorD }
  const segundo = segI >= 0 && Number.isFinite(segD) ? { id: idx.ids[segI], distancia: segD } : null
  // Un EMPATE EXACTO no es duda, es arte repetido: hay cartas publicadas con
  // la misma ilustración y números distintos. Rechazarlas sería descartar una
  // lectura correcta; quien llama las ofrece a elegir.
  const empate = segundo !== null && segundo.distancia === mejorD
  const margen = segundo ? segundo.distancia - mejorD : Infinity

  return {
    mejor,
    segundo,
    confiable: mejorD <= MAX_DISTANCIA && (empate || margen >= MARGEN_MINIMO),
  }
}

/**
 * /api/img — redimensionador de arte de carta
 *
 * ── Por qué existe ────────────────────────────────────────────────────
 *
 * El arte oficial vive en `cdn.starwarsunlimited.com`, que es un CloudFront
 * pelado por delante de un bucket S3: **no transforma nada**. Medido contra
 * el origen, las ocho convenciones habituales de redimensionado devuelven la
 * MISMA respuesta byte a byte:
 *
 *   ?width=160  ?w=160  ?format=webp  ?fm=webp&w=160
 *   ?tr=w-160   ?resize=160  ?width=160&format=webp  ?d=160x224
 *   → los ocho: 200, image/png, 204.214 bytes idénticos
 *
 * Tampoco existen las miniaturas de Strapi (`thumbnail_`, `small_`,
 * `medium_`, `large_` dan 403), ni el API de cartas expone ningún campo de
 * miniatura: `front_image_url` y `back_image_url` son los únicos, y los dos
 * apuntan al PNG entero.
 *
 * Y el desperdicio es de dos órdenes de magnitud. Medido en la app:
 *
 *   pantalla              se pinta a      se descargaba   sobra
 *   /collection lista     112x156 (dpr2)  286x400 PNG     85 %
 *   /collection binder    218x304         286x400 PNG     40 %
 *
 * Una carta suelta pesa 202.233 bytes. La misma a 128 px de ancho en WebP con
 * calidad 80 pesa **5.124** — 39 veces menos. Sobre la lista de 200 cartas eso
 * son 45 MB contra poco menos de 1 MB. En datos móviles salvadoreños esa
 * diferencia no es una métrica de laboratorio.
 *
 * ── Por qué es un proxy CERRADO ───────────────────────────────────────
 *
 * Misma disciplina que `tcg-prices.ts` y `swu-events.ts`: un proxy que
 * reenvía cualquier URL sirve para atacar a terceros desde nuestro dominio o
 * para alcanzar la red interna. Acá:
 *
 * - el host tiene que ser EXACTAMENTE el CDN del juego;
 * - la ruta tiene que ser un archivo de carta (`/card_*.png`) — verificado
 *   sobre 431 URLs reales del API: 431 de 431 cumplen esa forma;
 * - el ancho sale de una escalera FIJA de cuatro peldaños.
 *
 * Lo último no es capricho: la CDN cachea por URL completa, así que un ancho
 * libre daría claves de caché ilimitadas y cada una un viaje al origen ajeno.
 * Cualquier parámetro inesperado, repetido o vacío es 400 sin tocar la red.
 *
 * ── Por qué WebP y no AVIF ────────────────────────────────────────────
 *
 * AVIF comprime algo mejor, pero lo que clava los fotogramas de 100-150 ms al
 * desplazar la rejilla es la DECODIFICACIÓN en el hilo principal, y AVIF se
 * decodifica bastante más lento que WebP en teléfonos de gama baja. Acá el
 * objetivo es justo ese fotograma, así que gana WebP.
 *
 * El alfa se conserva (`alphaQuality: 100`). No es un detalle: el arte llega
 * con las esquinas ya recortadas y toda la presentación de la app depende de
 * eso — `drop-shadow` sigue la silueta y `radio-carta` recorta sobre la
 * esquina transparente. Aplanar el alfa dejaría un rectángulo con picos.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import sharp from 'sharp'

/**
 * La función no puede quedarse colgada del origen ajeno.
 *
 * Sin esto el `fetch` al CDN no tenía plazo NI la lambda tope, así que un
 * CloudFront lento sostenía la invocación hasta el corte de plataforma. Lo
 * mismo que ya hacen `sim.ts` (25 s) y `melee-profile.ts` (15 s).
 */
export const config = { maxDuration: 20 }

/** Único origen admitido. */
const CDN = 'cdn.starwarsunlimited.com'

/**
 * Forma de un archivo de arte. Las barras iniciales van en plural a propósito:
 * la clave del objeto en el bucket EMPIEZA con `/`, así que las URL reales
 * traen doble barra (`https://cdn…//card_…png`). Con una sola el CDN responde
 * 403 — comprobado.
 *
 * El largo va acotado: el sufijo real es `<nombre>_<hash de Strapi>`, y sin
 * techo un nombre de 4 KB seguía siendo una clave de caché válida.
 */
const RUTA_CARTA = /^\/{1,2}card_[A-Za-z0-9_-]{1,96}\.png$/

/**
 * Cubo de tokens por instancia — la defensa que faltaba.
 *
 * La ruta se valida por FORMA, no por existencia: `card_zzz1.png`,
 * `card_zzz2.png`… pasan el regex, no están en la CDN de Vercel (MISS), gastan
 * una invocación y provocan un GET real al CloudFront de FFG desde nuestro
 * dominio. Medido en producción: 8 nombres inventados = 8 MISS y 8 fetch
 * salientes en 4,8 s, sin sesión y sin tope.
 *
 * Es el mismo razonamiento que la nota 2l aplica a `swu-events.ts` («el regex
 * solo no frena la amplificación, porque un slug inventado válido igual
 * provoca un GET»). Allá se contrasta contra la lista publicada; acá no hay
 * lista que traer sin pagarla, así que la puerta es el ritmo.
 *
 * 240/minuto deja de sobra para el caso real —una pantalla pinta 20-60 cartas
 * y a partir de la segunda visita las sirve la CDN sin invocar nada— y le pone
 * techo a la amplificación.
 */
const RITMO_MAX = 240
const cubo = { fichas: RITMO_MAX, en: Date.now() }

function tomarFicha(): boolean {
  const ahora = Date.now()
  cubo.fichas = Math.min(RITMO_MAX, cubo.fichas + ((ahora - cubo.en) / 60_000) * RITMO_MAX)
  cubo.en = ahora
  if (cubo.fichas < 1) return false
  cubo.fichas -= 1
  return true
}

/**
 * Un PNG de carta pesa 150-210 KB. 4 MB es diez veces el mayor y sigue siendo
 * un techo real: sin él entraba a memoria lo que el origen quisiera mandar.
 */
const MAX_BYTES = 4_000_000

/**
 * Bomba de descompresión: un PNG de 30 KB puede declarar 50.000×50.000 px.
 * sharp trae su propio tope, pero dejarlo implícito es dejarlo a merced de la
 * versión. El arte real es 286×400.
 */
const MAX_PIXELES = 4_000_000

/**
 * Los errores también se cachean.
 *
 * Antes salían con `max-age=0, must-revalidate`, así que cada repetición de la
 * MISMA URL inválida volvía a invocar la función y —en el caso del 502— volvía
 * a golpear el origen ajeno. Medido: 8 de 8 `x-vercel-cache: MISS`. Con esto,
 * un nombre inventado cuesta UN viaje y después lo sirve la CDN.
 *
 * El plazo es corto a propósito: un 502 puede ser un tropiezo del origen, y
 * congelar una carta buena como rota durante horas sería peor que el gasto.
 */
const CACHE_ERROR = 'public, max-age=60, s-maxage=600'

function fallo(res: VercelResponse, codigo: number, error: string) {
  res.setHeader('Cache-Control', CACHE_ERROR)
  return res.status(codigo).json({ error })
}

/**
 * Escalera de anchos. Cuatro peldaños que cubren los tamaños que la app pinta
 * de verdad (medidos a dpr 2):
 *
 *   128 → lista de Mi Botín      (necesita 112)
 *   224 → binder                 (necesita 218)
 *   288 → vitrina y Mercancía    (necesita 296, tope el nativo 286)
 *   448 → detalle y zoom         (tope el nativo: 286 vertical, 400 apaisada)
 *
 * Nunca se amplía (`withoutEnlargement`): pedir 448 de una carta de 286 no
 * inventa píxeles, devuelve los 286 que hay.
 */
const ANCHOS = new Set([128, 224, 288, 448])

/** Medido: q80 conserva el arte legible y pesa 39x menos que el PNG. */
const CALIDAD = 80

/** Un solo valor de query, o `null` si viene repetido, vacío o ausente. */
function unico(v: string | string[] | undefined): string | null {
  if (typeof v !== 'string') return null // ausente o repetido
  const s = v.trim()
  return s === '' ? null : s
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Solo GET' })
  }

  // Rechazar, no degradar: cualquier parámetro de más es una clave de caché
  // nueva, y por lo tanto un viaje al origen ajeno.
  const claves = Object.keys(req.query)
  if (claves.some(k => k !== 'u' && k !== 'w')) {
    return fallo(res, 400, 'Parámetro no admitido')
  }

  const crudo = unico(req.query.u)
  const anchoTxt = unico(req.query.w)
  if (!crudo || !anchoTxt) {
    return fallo(res, 400, 'Faltan u y w')
  }

  const ancho = Number(anchoTxt)
  if (!Number.isInteger(ancho) || !ANCHOS.has(ancho)) {
    return fallo(res, 400, 'Ancho no admitido')
  }

  let origen: URL
  try {
    origen = new URL(crudo)
  } catch {
    return fallo(res, 400, 'URL inválida')
  }
  /*
   * `host`, no `hostname`: `hostname` EXCLUYE el puerto, así que
   * `https://cdn.starwarsunlimited.com:8443//card_a.png` pasaba el filtro y el
   * proxy salía a hablar al 8443 de ese host. Con `:1` encima quedaba colgado
   * (no había plazo, ver `config.maxDuration`). Y cada puerto es una clave de
   * caché distinta en la CDN de Vercel: una invocación nueva por cada uno.
   *
   * `username`/`password`: `https://evil.com@cdn.starwarsunlimited.com//card_a.png`
   * tiene `hostname` correcto —el userinfo no es el host— pero `toString()`
   * conserva el `evil.com@`, así que lo que se enviaba al cable no era lo que
   * se había validado. Los dos casos medidos en node antes del arreglo.
   */
  if (origen.protocol !== 'https:' || origen.host !== CDN || origen.username || origen.password) {
    return fallo(res, 400, 'Origen no admitido')
  }
  // `origen.search` es '' con un `?` pelado, así que la comprobación se hace
  // también sobre la cadena cruda: `…card_a.png?` colaba como clave nueva.
  if (!RUTA_CARTA.test(origen.pathname) || origen.search || origen.hash ||
      crudo.includes('?') || crudo.includes('#')) {
    return fallo(res, 400, 'Ruta no admitida')
  }

  // El token se cobra DESPUÉS de validar la forma (un 400 no toca la red) y
  // ANTES de salir al origen ajeno.
  if (!tomarFicha()) {
    res.setHeader('Retry-After', '30')
    return fallo(res, 429, 'Demasiadas imágenes a la vez. Reintenta en un momento.')
  }

  const control = new AbortController()
  const plazo = setTimeout(() => control.abort(), 12_000)
  try {
    const upstream = await fetch(origen.toString(), {
      // Un redirect a otro host convertiría esto en un proxy abierto — la
      // misma razón que documenta `melee-profile.ts`. `fetch` sigue los 3xx
      // por defecto, y el destino lo elegiría la respuesta ajena.
      redirect: 'manual',
      signal: control.signal,
    })
    if (upstream.status >= 300 && upstream.status < 400) {
      return fallo(res, 502, 'El origen redirigió')
    }
    if (!upstream.ok) {
      // El fallo del origen se transmite tal cual: así el cliente sabe que
      // tiene que caer a la URL original en vez de reintentar acá.
      return fallo(res, 502, `Origen respondió ${upstream.status}`)
    }

    // Lo que el origen dice que manda, antes de traérselo a memoria.
    const tipo = upstream.headers.get('content-type') ?? ''
    if (!tipo.startsWith('image/')) {
      return fallo(res, 502, 'El origen no devolvió una imagen')
    }
    const declarado = Number(upstream.headers.get('content-length'))
    if (Number.isFinite(declarado) && declarado > MAX_BYTES) {
      return fallo(res, 502, 'La imagen del origen es demasiado grande')
    }

    const png = Buffer.from(await upstream.arrayBuffer())
    // Y lo que de verdad llegó: `content-length` es del origen, no nuestro.
    if (png.length > MAX_BYTES) {
      return fallo(res, 502, 'La imagen del origen es demasiado grande')
    }

    const webp = await sharp(png, { limitInputPixels: MAX_PIXELES })
      .resize({ width: ancho, withoutEnlargement: true })
      .webp({ quality: CALIDAD, alphaQuality: 100, effort: 4 })
      .toBuffer()

    // El arte de una carta impresa no cambia nunca: se puede cachear para
    // siempre. Con esto la CDN de Vercel sirve las repeticiones sin volver a
    // invocar la función, así que el coste es una transformación por
    // (carta, ancho) y después nada.
    res.setHeader('Content-Type', 'image/webp')
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable')
    res.setHeader('Content-Length', String(webp.length))
    return res.status(200).send(webp)
  } catch (e) {
    const abortado = e instanceof Error && e.name === 'AbortError'
    return fallo(res, abortado ? 504 : 502,
      abortado ? 'El origen tardó demasiado' : 'Fallo al transformar')
  } finally {
    clearTimeout(plazo)
  }
}

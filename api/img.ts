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

/** Único origen admitido. */
const CDN = 'cdn.starwarsunlimited.com'

/**
 * Forma de un archivo de arte. Las barras iniciales van en plural a propósito:
 * la clave del objeto en el bucket EMPIEZA con `/`, así que las URL reales
 * traen doble barra (`https://cdn…//card_…png`). Con una sola el CDN responde
 * 403 — comprobado.
 */
const RUTA_CARTA = /^\/+card_[A-Za-z0-9_-]+\.png$/

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
    return res.status(400).json({ error: 'Parámetro no admitido' })
  }

  const crudo = unico(req.query.u)
  const anchoTxt = unico(req.query.w)
  if (!crudo || !anchoTxt) {
    return res.status(400).json({ error: 'Faltan u y w' })
  }

  const ancho = Number(anchoTxt)
  if (!Number.isInteger(ancho) || !ANCHOS.has(ancho)) {
    return res.status(400).json({ error: 'Ancho no admitido' })
  }

  let origen: URL
  try {
    origen = new URL(crudo)
  } catch {
    return res.status(400).json({ error: 'URL inválida' })
  }
  if (origen.protocol !== 'https:' || origen.hostname !== CDN) {
    return res.status(400).json({ error: 'Origen no admitido' })
  }
  if (!RUTA_CARTA.test(origen.pathname) || origen.search || origen.hash) {
    return res.status(400).json({ error: 'Ruta no admitida' })
  }

  try {
    const upstream = await fetch(origen.toString())
    if (!upstream.ok) {
      // El fallo del origen se transmite tal cual: así el cliente sabe que
      // tiene que caer a la URL original en vez de reintentar acá.
      return res.status(502).json({ error: `Origen respondió ${upstream.status}` })
    }

    const png = Buffer.from(await upstream.arrayBuffer())
    const webp = await sharp(png)
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
    return res.status(502).json({ error: e instanceof Error ? e.message : 'Fallo al transformar' })
  }
}

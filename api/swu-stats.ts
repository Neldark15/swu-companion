/**
 * /api/swu-stats — proxy de solo lectura a swumetastats.com
 *
 * Estadísticas del meta y la «receta» de cada arquetipo. La fuente publica una
 * API REST pública, sin autenticación y documentada con OpenAPI, cuya propia
 * documentación invita a construir sobre ella. Aun así se pasa por un proxy
 * propio por dos razones: **no manda cabeceras CORS** (el navegador no puede
 * llamarla directo) y así una comunidad entera cuesta una descarga, no una por
 * persona.
 *
 * ── Atribución ────────────────────────────────────────────────────────
 *
 * Los datos son de SWU Meta Stats. Toda vista que los use enlaza de vuelta; el
 * campo `source` viaja en cada respuesta justamente para eso.
 *
 * ── Cortesía, aprendida a la mala ─────────────────────────────────────
 *
 * Midiendo límites de paginación se le pidió `take=1000` a `/api/decklists` y
 * ese endpoint dejó de responder desde nuestra IP: tienen protección
 * anti-abuso y la activamos. Por eso acá NO se expone `/api/decklists` —no
 * hace falta: el detalle de arquetipo ya trae los mazos con su guid— y todo va
 * con lista blanca, cubo de tokens y caché larga.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

const HOST = 'swumetastats.com'
const SITE = `https://${HOST}`
const UA = 'swu-companion/1.0 (+https://www.swusv.com; PWA comunitaria de El Salvador)'

const MODES = new Set(['ventanas', 'arquetipos', 'tierlist', 'detalle'])
const PARAMS_POR_MODO: Record<string, Set<string>> = {
  ventanas: new Set(['mode']),
  arquetipos: new Set(['mode']),
  tierlist: new Set(['mode']),
  detalle: new Set(['mode', 'leader', 'base']),
}

/**
 * Nombres de carta y rótulos de base. Llevan espacios, barras verticales,
 * apóstrofes y acentos («Cad Bane | Still Faster Than You», «Daimyo's Palace»,
 * «Vigilance 30 HP»), así que la lista blanca es de CARACTERES y no un patrón
 * rígido: prohíbe por construcción `/`, `?`, `#`, `%`, `\`, `..` y los saltos
 * de línea, que es lo que permitiría salirse de la ruta.
 */
const NOMBRE_RE = /^[\p{L}\p{N} |'’\-,.:!()&]+$/u
const MAX_NOMBRE = 120

/**
 * Un nombre real siempre tiene al menos una letra o dígito.
 *
 * Hace falta además del regex porque el punto SÍ está permitido —hay cartas
 * con punto— y `encodeURIComponent('..')` devuelve `..` tal cual: sin este
 * chequeo, `leader=..` construía `/api/archetypes/../base`, que el servidor
 * de la fuente colapsa a otra ruta. Es traversal, aunque sea dentro de su
 * propio host.
 */
const tieneContenido = (s: string) => /[\p{L}\p{N}]/u.test(s) && !s.split(/[|\s]/).includes('..')

/** Tope de bytes decodificados. El detalle medido pesa 225 KB. */
const MAX_BYTES = 3_000_000

const RATE_MAX = 40
const bucket = { tokens: RATE_MAX, at: Date.now() }

function takeToken(): boolean {
  const now = Date.now()
  bucket.tokens = Math.min(RATE_MAX, bucket.tokens + ((now - bucket.at) / 60_000) * RATE_MAX)
  bucket.at = now
  if (bucket.tokens < 1) return false
  bucket.tokens -= 1
  return true
}

class FuenteError extends Error {
  constructor(readonly status: number, msg: string) { super(msg) }
}

async function pedir(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'manual',
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    })
    if (res.status >= 300 && res.status < 400) throw new FuenteError(502, 'redirección inesperada')
    if (res.status === 404) throw new FuenteError(404, 'no existe en la fuente')
    if (res.status === 429) throw new FuenteError(429, 'la fuente pidió esperar')
    if (!res.ok) throw new FuenteError(502, `la fuente respondió ${res.status}`)
    if (!res.body) throw new FuenteError(502, 'respuesta sin cuerpo')

    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BYTES) {
        await reader.cancel()
        throw new FuenteError(502, 'respuesta demasiado grande')
      }
      chunks.push(value)
    }
    const buf = new Uint8Array(total)
    let off = 0
    for (const c of chunks) { buf.set(c, off); off += c.byteLength }
    return JSON.parse(new TextDecoder('utf-8').decode(buf))
  } finally {
    clearTimeout(timeout)
  }
}

const SOURCE = { name: 'SWU Meta Stats', url: SITE }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Solo GET' })
  }

  const rawMode = req.query.mode
  if (typeof rawMode !== 'string' || !MODES.has(rawMode)) {
    return bad(res, 'mode debe ser ventanas, arquetipos, tierlist o detalle')
  }
  const mode = rawMode

  // Igual que en el proxy de torneos: rechazar, no degradar, y POR MODO. Cada
  // forma que se acepte de más es otra clave de CDN y otro viaje a la fuente.
  const permitidos = PARAMS_POR_MODO[mode]
  for (const [k, v] of Object.entries(req.query)) {
    if (!permitidos.has(k)) return bad(res, `parámetro no permitido en modo ${mode}: ${k}`)
    if (typeof v !== 'string' || v === '') return bad(res, `valor inválido para ${k}`)
  }
  const q = req.query as Record<string, string | undefined>

  try {
    let url: string
    // La ventana meta NO se manda: sin fechas la fuente ya devuelve la
    // vigente. Fijar una fecha dejaría la app mostrando el meta viejo en
    // silencio el día que salga el set siguiente.
    if (mode === 'ventanas') url = `${SITE}/api/meta-boundaries`
    else if (mode === 'arquetipos') url = `${SITE}/api/archetypes`
    else if (mode === 'tierlist') url = `${SITE}/api/tierlist?mode=kyberscore`
    else {
      const leader = q.leader ?? ''
      const base = q.base ?? ''
      if (leader.length > MAX_NOMBRE || !NOMBRE_RE.test(leader) || !tieneContenido(leader)) return bad(res, 'leader inválido')
      if (base.length > MAX_NOMBRE || !NOMBRE_RE.test(base) || !tieneContenido(base)) return bad(res, 'base inválida')
      // Concatenación con host fijo y cada segmento codificado entero.
      url = `${SITE}/api/archetypes/${encodeURIComponent(leader)}/${encodeURIComponent(base)}`
    }

    if (!takeToken()) {
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Retry-After', '30')
      return res.status(429).json({ error: 'demasiadas consultas, probá en un momento' })
    }

    const data = await pedir(url)

    // Las ventanas casi no cambian; el resto se recalcula a diario. La fuente
    // ya cachea 1 h, así que estirarlo de nuestro lado la alivia sin que el
    // dato deje de ser del día.
    const largo = mode === 'ventanas'
    res.setHeader('Cache-Control', `public, max-age=${largo ? 3600 : 600}`)
    res.setHeader(
      'Vercel-CDN-Cache-Control',
      largo
        ? 'public, s-maxage=86400, stale-while-revalidate=604800'
        : 'public, s-maxage=21600, stale-while-revalidate=86400',
    )
    return res.status(200).json({ source: SOURCE, data })
  } catch (e) {
    if (e instanceof FuenteError) {
      res.setHeader('Cache-Control', e.status === 404 ? 'public, s-maxage=3600' : 'public, s-maxage=60')
      if (e.status === 429) res.setHeader('Retry-After', '120')
      return res.status(e.status).json({ error: e.message })
    }
    const msg = e instanceof Error ? e.message : 'error desconocido'
    res.setHeader('Cache-Control', 'public, s-maxage=60')
    return res.status(502).json({ error: `no se pudo consultar la fuente: ${msg}` })
  }
}

function bad(res: VercelResponse, error: string) {
  res.setHeader('Cache-Control', 'no-store')
  return res.status(400).json({ error })
}

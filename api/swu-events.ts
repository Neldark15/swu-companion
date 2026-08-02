/**
 * /api/swu-events — proxy de solo lectura a swu-competitivehub.com
 *
 * Devuelve JSON ya parseado con los últimos torneos y el top de cada uno.
 * La fuente es un WordPress comunitario que sirve HTML; acá se traduce a datos
 * y se cachea fuerte, para que 16 personas mirando el meta produzcan UNA
 * descarga y no dieciséis.
 *
 * ── Atribución ────────────────────────────────────────────────────────
 *
 * Los datos son de SWU Competitive Hub (Charles «Noxm» y Vincent
 * «vincineuze», Francia). Toda vista que los use tiene que enlazar de vuelta
 * al sitio; el campo `source` de la respuesta viaja justamente para eso y la
 * UI lo muestra. No presentar esto como una API propia.
 *
 * ── Por qué es un proxy CERRADO ───────────────────────────────────────
 *
 * Un proxy que acepta una URL o un path libre es un arma: sirve para atacar a
 * terceros desde nuestro dominio. Acá el host está fijo en el código, el slug
 * pasa por una gramática de lista blanca y CUALQUIER parámetro inesperado es
 * 400. Ver el bloque de defensas más abajo: cada una responde a un abuso
 * concreto y medido, no a una precaución genérica.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

const HOST = 'www.swu-competitivehub.com'
const SITE = `https://${HOST}`

/** Identificarnos permite que los dueños del sitio nos escriban en vez de bloquearnos a ciegas. */
const UA = 'swu-companion/1.0 (+https://www.swusv.com; PWA comunitaria de El Salvador)'

// ── Lista blanca de entrada ──────────────────────────────────────────

/**
 * Parámetros válidos POR MODO, no en general.
 *
 * Una lista global no alcanza: `?slug=basura` en modo lista pasaba el filtro,
 * nunca se validaba (el slug solo se mira dentro de la rama de evento) y, como
 * la CDN cachea por URL completa, cada valor inventado era una clave nueva y
 * por lo tanto una descarga real contra el WordPress ajeno. Lo mismo al revés
 * con `range`/`category` en modo evento.
 */
const MODES = new Set(['lista', 'evento'])
const PARAMS_POR_MODO: Record<string, Set<string>> = {
  lista: new Set(['mode', 'range', 'category']),
  evento: new Set(['mode', 'slug']),
}

/**
 * Meses hacia atrás. El sitio también acepta 12 y 0 (= histórico completo),
 * y a propósito NO los exponemos: `range=0` es un único documento de ~1.5 MB
 * sin paginar, y bajarse el histórico entero de la base ajena es justo lo que
 * no queremos hacer. Tres y seis meses cubren «qué está ganando ahora», que
 * es para lo que sirve la pantalla.
 */
const RANGES = new Set(['3', '6'])
const CATEGORIES = new Set(['premier', 'limited', 'eternal', 'todas'])

/**
 * Gramática del slug: <nivel-en-kebab>-<YYYY-MM-DD>-<tienda-ciudad>.
 *
 * Es una lista blanca de caracteres, no una lista negra: así quedan fuera por
 * construcción `/`, `.`, `%`, `\`, `:`, `@`, los nulos y los CR/LF. Sin esto,
 * `slug=..%2f..%2fwp-admin` llega decodificado y `fetch` normaliza los `..`,
 * dando acceso a cualquier endpoint del WordPress (xmlrpc.php está expuesto).
 *
 * Usa \p{Ll}\p{Lo} con flag `u` y NO [a-z]: hay dos eventos reales con CJK en
 * el slug (Taiwán y Beijing) que un [a-z0-9-]+ dejaría afuera.
 *
 * NO se valida contra la lista de los 13 niveles que existen hoy: el sitio va
 * a agregar niveles y romperíamos eventos válidos en silencio — el mismo error
 * que documenta la nota 2k para ALLOWED_GROUPS.
 */
const SEG = '[\\p{Ll}\\p{Lo}\\p{N}]+'
const DATE = '20\\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])'
export const SLUG_RE = new RegExp(`^${SEG}(?:-${SEG})*-${DATE}-${SEG}(?:-${SEG})*$`, 'u')
const MAX_SLUG = 120 // el más largo real mide 91

/**
 * Techo de bytes DECODIFICADOS. `Content-Length` no sirve como guarda: el HTML
 * comprime 11:1, así que 400 KB en el cable pueden ser 4.4 MB en memoria.
 */
const MAX_BYTES_LIST = 2_000_000
const MAX_BYTES_EVENT = 512_000

// ── Cortesía con la fuente ───────────────────────────────────────────

/**
 * Cubo de tokens por instancia. Segunda línea de defensa contra la
 * amplificación: aunque alguien invente slugs válidos, el WordPress ajeno
 * nunca recibe más de este ritmo desde una instancia nuestra.
 */
const RATE_MAX = 30
const bucket = { tokens: RATE_MAX, at: Date.now() }

function takeToken(): boolean {
  const now = Date.now()
  bucket.tokens = Math.min(RATE_MAX, bucket.tokens + ((now - bucket.at) / 60_000) * RATE_MAX)
  bucket.at = now
  if (bucket.tokens < 1) return false
  bucket.tokens -= 1
  return true
}

/**
 * Slugs conocidos, en memoria del contenedor.
 *
 * Primera línea contra la amplificación: el regex solo no alcanza, porque
 * `x-2026-01-01-loquesea` lo pasa, no está en la CDN y provoca un GET al
 * origen que devuelve una página 404 de 48 KB. Contrastando contra los slugs
 * que la propia lista publica, un slug inventado cuesta CERO peticiones a la
 * fuente. Si la lista no se puede cargar se sigue de largo (con token), para
 * no volver un incidente de red en una caída total de la sección.
 */
const SLUG_TTL = 10 * 60 * 1000
/** Tras un fallo se espera antes de reintentar: si la fuente está caída, insistir la hunde. */
const SLUG_FAIL_TTL = 60 * 1000

let slugCache: { set: Set<string>; at: number } | null = null
let slugFailAt = 0
/** Petición en vuelo compartida: sin esto, N invocaciones simultáneas eran N descargas. */
let slugInflight: Promise<Set<string> | null> | null = null

async function knownSlugs(): Promise<Set<string> | null> {
  const now = Date.now()
  if (slugCache && now - slugCache.at < SLUG_TTL) return slugCache.set
  if (now - slugFailAt < SLUG_FAIL_TTL) return null
  if (slugInflight) return slugInflight

  // Esta descarga es tan cara como cualquier otra y también va contra el sitio
  // ajeno: tiene que pagar token. Antes se colaba gratis y ANTES del cubo, así
  // que el 429 que veía el cliente ya había costado la petición.
  if (!takeToken()) return null

  slugInflight = (async () => {
    try {
      const { tournaments } = parseList(await fetchHub(listUrl('6', 'todas'), MAX_BYTES_LIST))
      if (tournaments.length === 0) {
        slugFailAt = Date.now()
        return null
      }
      slugCache = { set: new Set(tournaments.map(t => t.slug)), at: Date.now() }
      return slugCache.set
    } catch {
      slugFailAt = Date.now()
      return null
    } finally {
      slugInflight = null
    }
  })()
  return slugInflight
}

// ── Construcción de URLs ─────────────────────────────────────────────

function listUrl(range: string, category: string): string {
  // `todas` omite el parámetro: el sitio emite `?range=3&category` sin valor,
  // y omitirlo da la misma respuesta con una clave de caché más limpia.
  const cat = category === 'todas' ? '' : `&category=${category}`
  return `${SITE}/tournaments-results/?range=${range}${cat}`
}

/**
 * Reproduce byte a byte la forma que emite el sitio, incluido el hex en
 * minúscula de los slugs con CJK (`%e5%a1%94`, no `%E5%A1%94`). Verificado
 * contra los 165 slugs reales.
 */
function encodeSlug(slug: string): string {
  return slug
    .split('-')
    .map(part => encodeURIComponent(part).replace(/%[0-9A-F]{2}/g, m => m.toLowerCase()))
    .join('-')
}

// Siempre por concatenación con el host fijo. `new URL(slug, BASE)` permitiría
// escapar con `//evil.com`.
const eventUrl = (slug: string) => `${SITE}/event/${encodeSlug(slug)}/`

// ── Descarga ─────────────────────────────────────────────────────────

class HubError extends Error {
  constructor(readonly status: number, msg: string) {
    super(msg)
  }
}

async function fetchHub(url: string, maxBytes: number): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // Sin esto, un 301 del sitio o un open-redirect de plugin convertiría el
      // proxy en un fetcher de terceros que devuelve cuerpo ajeno como propio.
      redirect: 'manual',
      headers: { 'User-Agent': UA, Accept: 'text/html' },
    })

    if (res.status >= 300 && res.status < 400) throw new HubError(502, 'redirección inesperada')
    if (res.status === 404) throw new HubError(404, 'no existe en la fuente')
    if (!res.ok) throw new HubError(502, `la fuente respondió ${res.status}`)
    if (!res.body) throw new HubError(502, 'respuesta sin cuerpo')

    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        throw new HubError(502, 'respuesta demasiado grande')
      }
      chunks.push(value)
    }

    const buf = new Uint8Array(total)
    let off = 0
    for (const c of chunks) { buf.set(c, off); off += c.byteLength }
    return new TextDecoder('utf-8').decode(buf)
  } finally {
    clearTimeout(timeout)
  }
}

// ── Parseo del HTML ──────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#039;': "'", '&#39;': "'", '&nbsp;': ' ', '&#038;': '&',
}

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, m => ENTITIES[m.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

/** Los `alt` de las dos imágenes son la fuente fiable: existen incluso en las
 *  filas centinela, donde el texto visible cambia de forma entre páginas. */
function alts(cell: string): string[] {
  return [...cell.matchAll(/<img\b[^>]*\balt="([^"]*)"/gi)].map(m => text(m[1]))
}

/** El sitio escribe «Unknow», sin la n final, y lo usa cuando el evento no
 *  publicó el mazo. No es un fallo nuestro de parseo: es ausencia de dato. */
const isUnknown = (s: string) => /unknow/i.test(s)

function tbody(html: string, tableId: string): string {
  const table = new RegExp(`<table\\b[^>]*\\bid="${tableId}"[\\s\\S]*?</table>`, 'i').exec(html)
  const scope = table ? table[0] : html
  const body = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i.exec(scope)
  return body ? body[1] : ''
}

// Tolerante a atributos: 5 de las 165 filas son `<tr class="highlight-event">`
// y un /<tr>/ pelado las perdería en silencio.
const rowsOf = (html: string) => [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1])
const cellsOf = (row: string) => [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1])

export interface HubTournament {
  slug: string
  name: string
  date: string
  level: string
  country: string
  players: number
  set: string
  /** Líder del ganador tal como lo publica la fuente, ej. «Boba Fett (JTL)». */
  leader: string | null
  /** Base del ganador. Ojo: la fuente a veces pone una CLASE («Blue»), no una carta. */
  base: string | null
}

/**
 * `filas` es cuántos `<tr>` traía la tabla. Sirve para distinguir «la fuente
 * no tiene torneos» de «la fuente cambió de formato y descartamos todo»: sin
 * ese dato, un rediseño del sitio se serviría como un 200 con lista vacía y se
 * quedaría 6 h en la CDN.
 */
export function parseList(html: string): { tournaments: HubTournament[]; filas: number } {
  const out: HubTournament[] = []
  const filas = rowsOf(tbody(html, 'tableTournaments'))
  for (const row of filas) {
    const c = cellsOf(row)
    if (c.length !== 8) continue // fila con forma inesperada: se descarta entera

    const href = /href="https?:\/\/[^"]*\/event\/([^"/]+)\/?"/i.exec(c[1])
    if (!href) continue
    // Se devuelve DECODIFICADO. Dos eventos reales (Taiwán y Beijing) llevan
    // CJK percent-encodeado en el href; si se publicara así, el cliente lo
    // volvería a codificar, Vercel lo decodificaría una sola vez y el `%`
    // sobreviviente haría fallar la gramática del slug. `encodeSlug` lo
    // reconstruye tal cual para consultar a la fuente.
    let slug: string
    try {
      slug = decodeURIComponent(text(href[1]))
    } catch {
      continue // percent-encoding roto: no es un evento que podamos pedir
    }
    if (!slug) continue

    const win = alts(c[2])
    const players = parseInt(text(c[5]), 10)

    out.push({
      slug,
      name: text(c[1]),
      date: text(c[0]),
      level: text(c[4]),
      // `||` y no `??`: un alt presente pero VACÍO tiene que caer al texto de
      // la celda, y `??` solo cubre undefined.
      country: alts(c[3])[0] || text(c[3]),
      players: Number.isFinite(players) ? players : 0,
      set: text(c[6]),
      leader: win[0] && !isUnknown(win[0]) ? win[0] : null,
      base: win[1] && !isUnknown(win[1]) ? win[1] : null,
    })
  }
  return { tournaments: out, filas: filas.length }
}

export interface HubStanding {
  place: number
  player: string
  leader: string | null
  base: string | null
  decklistUrl: string | null
}

export function parseEvent(html: string): { standings: HubStanding[]; filas: number } {
  const out: HubStanding[] = []
  const filas = rowsOf(tbody(html, 'tableResults'))
  for (const row of filas) {
    const c = cellsOf(row)
    if (c.length !== 4) continue

    const place = parseInt(text(c[0]), 10)
    if (!Number.isFinite(place)) continue

    const id = alts(c[1])
    const href = /href="(https:\/\/melee\.gg\/Decklist\/View\/[0-9a-f-]{36})"/i.exec(c[2])

    out.push({
      place,
      player: text(c[3]),
      leader: id[0] && !isUnknown(id[0]) ? id[0] : null,
      base: id[1] && !isUnknown(id[1]) ? id[1] : null,
      decklistUrl: href ? href[1] : null,
    })
  }
  // La fuente los emite de peor a mejor: la primera fila es el último puesto y
  // la última es el campeón. Ordenar acá evita que la UI corone al equivocado.
  return { standings: out.sort((a, b) => a.place - b.place), filas: filas.length }
}

// ── Handler ──────────────────────────────────────────────────────────

const SOURCE = { name: 'SWU Competitive Hub', url: SITE }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Solo GET' })
  }

  // El modo se resuelve primero, porque de él depende qué parámetros son
  // legítimos.
  const rawMode = req.query.mode
  if (rawMode !== undefined && (typeof rawMode !== 'string' || rawMode === '')) {
    return bad(res, 'valor inválido para mode')
  }
  const mode = rawMode ?? 'lista'
  if (!MODES.has(mode)) return bad(res, 'mode debe ser lista o evento')

  // La CDN cachea por URL COMPLETA, así que toda forma que no rechacemos es
  // una clave de caché más y, por lo tanto, otro viaje al sitio ajeno.
  // Rechazar —en vez de ignorar o degradar a un valor por defecto— es lo que
  // mantiene acotado el universo de URLs.
  const permitidos = PARAMS_POR_MODO[mode]
  for (const [k, v] of Object.entries(req.query)) {
    if (!permitidos.has(k)) return bad(res, `parámetro no permitido en modo ${mode}: ${k}`)
    // `?range=3&range=6` llega como array; `?range=` llega vacío. Ninguna de
    // las dos es una petición legítima del cliente, y ambas serían URLs
    // distintas que devuelven exactamente el mismo contenido.
    if (typeof v !== 'string' || v === '') return bad(res, `valor inválido para ${k}`)
  }
  // Tras el bucle, todo parámetro presente es un string no vacío.
  const q = req.query as Record<string, string | undefined>

  try {
    if (mode === 'lista') {
      const range = q.range ?? '3'
      const category = q.category ?? 'todas'
      // Comparación como STRING contra el Set, nunca Number(): `Number('')` da
      // 0, y 0 es justo el valor de «histórico completo» del sitio. La
      // coerción numérica convertiría un parámetro vacío en la consulta más
      // cara que existe.
      if (!RANGES.has(range)) return bad(res, 'range debe ser 3 o 6')
      if (!CATEGORIES.has(category)) return bad(res, 'category no permitida')

      if (!takeToken()) return busy(res)
      const { tournaments, filas } = parseList(await fetchHub(listUrl(range, category), MAX_BYTES_LIST))

      // Había filas y no entendimos NINGUNA: la fuente cambió de formato. Es un
      // error nuestro que hay que ver, no «no hay torneos» — y sobre todo no
      // se puede cachear 6 h, porque congelaría la sección vacía.
      if (filas > 0 && tournaments.length === 0) {
        throw new HubError(502, 'la fuente cambió de formato')
      }

      // 6 h fresco + 24 h sirviendo lo viejo mientras revalida. Una lista
      // legítimamente vacía (una categoría sin eventos) se cachea poco, para
      // que se llene sola en cuanto haya alguno.
      const vacia = tournaments.length === 0
      res.setHeader('Cache-Control', `public, max-age=${vacia ? 60 : 300}`)
      res.setHeader(
        'Vercel-CDN-Cache-Control',
        vacia
          ? 'public, s-maxage=600, stale-while-revalidate=3600'
          : 'public, s-maxage=21600, stale-while-revalidate=86400',
      )
      return res.status(200).json({ source: SOURCE, range, category, tournaments })
    }

    const slug = q.slug ?? ''
    if (!slug || slug.length > MAX_SLUG || !SLUG_RE.test(slug)) {
      return bad(res, 'slug inválido')
    }

    const known = await knownSlugs()
    if (known && !known.has(slug)) {
      // Se cachea el 404 para no repreguntar por un slug muerto: la página de
      // error de la fuente pesa 48 KB, no es gratis.
      res.setHeader('Cache-Control', 'public, s-maxage=3600')
      return res.status(404).json({ error: 'ese torneo no está en la lista' })
    }

    if (!takeToken()) return busy(res)
    const ev = parseEvent(await fetchHub(eventUrl(slug), MAX_BYTES_EVENT))
    if (ev.filas > 0 && ev.standings.length === 0) {
      throw new HubError(502, 'la fuente cambió de formato')
    }
    const standings = ev.standings

    // Un torneo que ya pasó no cambia; solo el del día se puede corregir.
    const day = /20\d{2}-\d{2}-\d{2}/.exec(slug)?.[0] ?? ''
    const cerrado = day !== '' && day < new Date().toISOString().slice(0, 10)
    res.setHeader('Cache-Control', `public, max-age=${cerrado ? 86400 : 300}`)
    res.setHeader(
      'Vercel-CDN-Cache-Control',
      cerrado
        ? 'public, s-maxage=604800, stale-while-revalidate=2592000'
        : 'public, s-maxage=3600, stale-while-revalidate=86400',
    )
    return res.status(200).json({ source: SOURCE, slug, standings })
  } catch (e) {
    if (e instanceof HubError) {
      res.setHeader('Cache-Control', e.status === 404 ? 'public, s-maxage=3600' : 'public, s-maxage=60')
      return res.status(e.status).json({ error: e.message })
    }
    const msg = e instanceof Error ? e.message : 'error desconocido'
    res.setHeader('Cache-Control', 'public, s-maxage=60')
    res.setHeader('Retry-After', '60')
    return res.status(502).json({ error: `no se pudo consultar la fuente: ${msg}` })
  }
}

function bad(res: VercelResponse, error: string) {
  res.setHeader('Cache-Control', 'no-store')
  return res.status(400).json({ error })
}

function busy(res: VercelResponse) {
  // Preferimos negarnos nosotros antes que castigar al sitio de la fuente.
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Retry-After', '30')
  return res.status(429).json({ error: 'demasiadas consultas, probá en un momento' })
}

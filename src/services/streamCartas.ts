/**
 * Catálogo de líderes y bases para el panel de transmisión.
 *
 * NO usa Dexie ni `swuApi.ts` a propósito. El panel tiene que funcionar en
 * CUALQUIER aparato prestado, recién abierto, sin haber precargado las 9.057
 * cartas por el WiFi de la tienda. Son dos peticiones y quedan en localStorage.
 *
 * El overlay no toca nada de esto: el panel resuelve nombre, imagen, HP y
 * aspectos, y escribe esos valores YA RESUELTOS en el estado. Así el overlay no
 * depende de la API — si api.swuapi.com está caída a las 9 AM, ni se entera.
 */

const API = 'https://api.swuapi.com'
const CLAVE = 'swu_stream_cartas_v1'
/** Una semana. Los sets nuevos no salen a mitad de torneo. */
const VIGENCIA_MS = 7 * 24 * 60 * 60 * 1000

export interface CartaStream {
  id: string
  nombre: string
  subtitulo: string
  /** 'Leader' | 'Base' */
  tipo: string
  aspectos: string[]
  /** HP impreso. Solo las bases lo traen; va de 24 a 35 según la carta. */
  hp: number | null
  img: string
  setCode: string
}

interface Cache {
  guardado: number
  lideres: CartaStream[]
  bases: CartaStream[]
}

type Cruda = Record<string, unknown>

function texto(x: unknown): string {
  return typeof x === 'string' ? x : ''
}

function mapear(c: Cruda): CartaStream {
  return {
    id: texto(c.uuid) || texto(c.id),
    nombre: texto(c.name),
    subtitulo: texto(c.subtitle),
    tipo: texto(c.type),
    aspectos: Array.isArray(c.aspects) ? (c.aspects as unknown[]).filter((a): a is string => typeof a === 'string') : [],
    hp: typeof c.hp === 'number' ? c.hp : null,
    img:
      texto(c.front_image_url) ||
      texto(c.frontImageUrl) ||
      texto(c.thumbnail_url) ||
      texto(c.thumbnailUrl),
    setCode: texto(c.set_code) || texto(c.setCode),
  }
}

/**
 * Deduplica por nombre+subtítulo.
 *
 * El 74% de las filas del API son impresiones alternativas de la misma carta
 * (CLAUDE.md §2d). Para un buscador de dos campos, mostrar «Luke Skywalker»
 * catorce veces es ruido puro. Se prefiere la impresión canónica y, entre
 * iguales, la que tenga imagen.
 */
function deduplicar(filas: Cruda[]): CartaStream[] {
  const porClave = new Map<string, { carta: CartaStream; canonica: boolean }>()

  for (const fila of filas) {
    const carta = mapear(fila)
    if (!carta.nombre || !carta.img) continue

    const clave = `${carta.nombre}|${carta.subtitulo}`.toLowerCase()
    const canonica = fila.is_canonical === true || fila.isCanonical === true
    const previo = porClave.get(clave)

    if (!previo || (canonica && !previo.canonica)) {
      porClave.set(clave, { carta, canonica })
    }
  }

  return [...porClave.values()]
    .map(v => v.carta)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/**
 * Catálogo COMPLETO para la carta jugada — cualquier tipo, no solo líderes y
 * bases. Va por `/export/all` (el mismo bulk que usa la app) porque el API
 * ignora los filtros de nombre: hay que traerlo todo y buscar en local.
 *
 * Medido: 9.185 filas → 2.190 únicas con imagen → 313 KB en localStorage.
 * Se guarda aparte de líderes/bases para no reconstruir ese caché, que es el
 * que se usa al empezar cada partida y tiene que estar siempre listo.
 */
const CLAVE_TODAS = 'swu_stream_todas_v1'

interface CacheTodas {
  guardado: number
  cartas: CartaStream[]
}

let enVueloTodas: Promise<CartaStream[]> | null = null

export async function cargarTodasLasCartas(): Promise<CartaStream[]> {
  try {
    const crudo = localStorage.getItem(CLAVE_TODAS)
    if (crudo) {
      const c = JSON.parse(crudo) as CacheTodas
      if (c && Array.isArray(c.cartas) && Date.now() - c.guardado <= VIGENCIA_MS) return c.cartas
    }
  } catch {
    /* caché ilegible: se vuelve a bajar */
  }

  if (!enVueloTodas) {
    enVueloTodas = (async () => {
      const resp = await fetch(`${API}/export/all`)
      if (!resp.ok) throw new Error(`API de cartas: ${resp.status}`)
      const json: unknown = await resp.json()
      const datos = (json ?? {}) as Record<string, unknown>
      const filas = datos.data ?? datos.cards ?? json
      const cartas = deduplicar(Array.isArray(filas) ? (filas as Cruda[]) : [])

      try {
        localStorage.setItem(CLAVE_TODAS, JSON.stringify({ guardado: Date.now(), cartas }))
      } catch {
        /* Cuota llena: se sigue igual, solo que la próxima vez se vuelve a bajar. */
      }
      return cartas
    })().finally(() => {
      enVueloTodas = null
    })
  }

  return enVueloTodas
}

async function bajarTipo(tipo: 'Leader' | 'Base'): Promise<Cruda[]> {
  // `type` es uno de los tres filtros que el API SÍ respeta (§2b: aspect, trait
  // y los demás los ignora en silencio). Con `limit` alto alcanza en una sola
  // petición: hay ~150 líderes y ~250 bases contando impresiones.
  const resp = await fetch(`${API}/cards?type=${tipo}&limit=400`)
  if (!resp.ok) throw new Error(`API de cartas: ${resp.status}`)

  const json: unknown = await resp.json()
  const datos = (json ?? {}) as Record<string, unknown>
  const filas = datos.data ?? datos.cards ?? json

  return Array.isArray(filas) ? (filas as Cruda[]) : []
}

function leerCache(): Cache | null {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return null
    const c = JSON.parse(crudo) as Cache
    if (!c || !Array.isArray(c.lideres) || !Array.isArray(c.bases)) return null
    if (Date.now() - c.guardado > VIGENCIA_MS) return null
    return c
  } catch {
    return null
  }
}

let enVuelo: Promise<Cache> | null = null

/**
 * Líderes y bases, de la caché o de la red.
 *
 * La promesa se comparte: si el panel monta dos buscadores a la vez, se baja
 * una sola vez.
 */
export async function cargarCartasStream(): Promise<{ lideres: CartaStream[]; bases: CartaStream[] }> {
  const cache = leerCache()
  if (cache) return { lideres: cache.lideres, bases: cache.bases }

  if (!enVuelo) {
    enVuelo = (async () => {
      const [crudosLideres, crudosBases] = await Promise.all([bajarTipo('Leader'), bajarTipo('Base')])
      const resultado: Cache = {
        guardado: Date.now(),
        lideres: deduplicar(crudosLideres),
        bases: deduplicar(crudosBases),
      }
      try {
        localStorage.setItem(CLAVE, JSON.stringify(resultado))
      } catch {
        // Cuota llena: se sigue igual, solo que la próxima vez se vuelve a bajar.
      }
      return resultado
    })().finally(() => {
      enVuelo = null
    })
  }

  const c = await enVuelo
  return { lideres: c.lideres, bases: c.bases }
}

/** Filtra por nombre o subtítulo, sin acentos ni mayúsculas. */
export function buscarCartas(cartas: CartaStream[], termino: string, limite = 12): CartaStream[] {
  const t = normalizar(termino.trim())
  if (!t) return cartas.slice(0, limite)

  return cartas
    .filter(c => normalizar(`${c.nombre} ${c.subtitulo}`).includes(t))
    .slice(0, limite)
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Escalera fija del proxy — cualquier otro ancho es 400 sin tocar la red (§2t). */
export type AnchoCarta = 128 | 224 | 288 | 448

/**
 * URL de imagen por el proxy propio.
 *
 * Nunca al CDN directo: `/api/img` devuelve WebP con el alfa intacto y
 * `Cache-Control: immutable` por un año, así que cada carta se convierte UNA
 * vez para toda la comunidad.
 */
export function imgCarta(url: string, ancho: AnchoCarta = 448): string {
  if (!url) return ''
  return `/api/img?u=${encodeURIComponent(url)}&w=${ancho}`
}

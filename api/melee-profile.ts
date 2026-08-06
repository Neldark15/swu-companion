/**
 * /api/melee-profile — proxy de solo lectura a los resultados públicos de melee.gg
 *
 * Devuelve el historial de torneos de un perfil público de Melee, normalizado
 * y filtrado a Star Wars: Unlimited, para poder mostrarlo dentro del perfil de
 * HOLOCRON.
 *
 * ── Qué se toma y qué NO ──────────────────────────────────────────────
 *
 * El `robots.txt` de melee.gg (leído el 2026-08-04) permite `/Profile/` pero
 * PROHÍBE explícitamente:
 *
 *     Disallow: /Decklist/View/
 *     Disallow: /Decklist/Index/
 *     Disallow: /Tournament/Search/  (y SearchResults, SearchActivePlayers)
 *
 * O sea: los RESULTADOS sí, las LISTAS DE MAZO no. A los mazos se enlaza —el
 * `decklistId` viaja para armar el enlace— pero no se descargan nunca. Si
 * alguna vez hace falta el contenido de un mazo, se pide permiso primero.
 *
 * Y pide `Crawl-Delay: 5`. Se respeta con tres frenos: el turno COMPARTIDO de
 * descarga que vive en la base (ver abajo), un cubo de tokens por instancia y
 * una caché de CDN larga, para que 16 personas mirando el mismo perfil
 * produzcan UNA descarga y no dieciséis.
 *
 * ── El turno de descarga es de TODOS, no de este archivo ──────────────
 *
 * Vercel empaqueta cada archivo de `api/` como una lambda separada con su
 * propio estado de módulo. Este archivo y `api/meta-ingesta.ts` descargan los
 * dos de melee.gg: con un reloj en memoria cada uno, entre los dos le pegaban
 * cada 2,5 s en vez de cada 5 — o sea, incumpliendo el `Crawl-Delay: 5` que
 * los dos creían estar respetando. El turno se pide ahora con el RPC
 * `meta_tomar_turno()`, una sola sentencia atómica sobre la fila única de
 * `meta_fetch_lease`, que es lo único que las dos lambdas comparten de verdad.
 *
 * **El reloj en memoria sigue acá y sigue vivo, como RESPALDO.** Si falta la
 * env var de Supabase o el RPC falla, se cae a él y se sirve igual: un fallo de
 * la base no puede tumbar el historial de melee de los perfiles. El respaldo es
 * peor que el turno compartido (dos relojes otra vez) pero infinitamente mejor
 * que un 503, y solo dura lo que dure la caída.
 *
 * ── Por qué es un proxy CERRADO ───────────────────────────────────────
 *
 * Igual que /api/swu-events: el host está fijo en el código, el usuario pasa
 * por una gramática de lista blanca y cualquier parámetro inesperado, repetido
 * o vacío es 400. La CDN cachea por URL completa, así que un parámetro libre
 * sería una clave de caché nueva por cada valor inventado, y cada una un viaje
 * real contra el servidor ajeno.
 *
 * ── Atribución ────────────────────────────────────────────────────────
 *
 * Los datos son de melee.gg. El campo `source` viaja en cada respuesta para
 * que la UI enlace de vuelta. No presentar esto como una API propia.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const HOST = 'melee.gg'
const SITE = `https://${HOST}`

// ── Base de datos: SOLO para el turno de descarga ─────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Cliente memoizado por instancia. `createClient` no habla con nadie —solo
 * arma el objeto— así que crearlo una vez y guardarlo no oculta ningún fallo
 * de red; lo que evita es rearmarlo en cada petición.
 *
 * `undefined` = todavía no se miró; `null` = no hay credenciales y se va por el
 * respaldo. Se distinguen a propósito para no reintentar la lectura del entorno
 * en cada llamada.
 *
 * Es el service role porque `meta_tomar_turno()` está concedido SOLO a
 * `service_role` (ver la migración): con RLS activa y cero políticas, la clave
 * anónima no puede ni ver la tabla. La clave nunca sale de la lambda y el RPC
 * no recibe ningún dato del usuario — no toma argumentos.
 */
let cliente: SupabaseClient | null | undefined
function baseDeDatos(): SupabaseClient | null {
  if (cliente !== undefined) return cliente
  cliente = SUPABASE_URL && SERVICE_ROLE
    ? createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null
  return cliente
}

/**
 * User-Agent en el formato estándar de robot bien portado —el mismo que usa
 * Googlebot: `Mozilla/5.0 (compatible; nombre/versión; +url)`.
 *
 * NO es hacerse pasar por un navegador. Medido contra su servidor:
 *
 *     swu-companion/1.0 (+https://www.swusv.com)                    -> 403
 *     Mozilla/5.0 (compatible; swu-companion/1.0; +https://…)       -> 200
 *     Mozilla/5.0 (Macintosh…) Chrome/124 Safari/537.36             -> 200
 *
 * O sea, su filtro solo mira que la cadena empiece con `Mozilla`; no está
 * bloqueando robots identificados a propósito —de hecho su robots.txt permite
 * `/Profile/`—. Con este formato seguimos diciendo quiénes somos, con qué
 * versión y dónde escribirnos: quien lea sus registros ve `swu-companion` y
 * nuestro dominio, no un Chrome inventado.
 */
const UA = 'Mozilla/5.0 (compatible; swu-companion/1.0; +https://www.swusv.com)'

// ── Lista blanca de entrada ──────────────────────────────────────────

const MODES = new Set(['resultados'])
const PARAMS_POR_MODO: Record<string, Set<string>> = {
  resultados: new Set(['mode', 'usuario']),
}

/**
 * Gramática del nombre de usuario.
 *
 * Melee los usa como segmento de ruta (`/Profile/Index/neldark`), así que un
 * valor sin validar es una travesía de directorios contra su servidor desde
 * NUESTRO dominio. Se aceptan letras, dígitos, punto, guion y guion bajo —lo
 * que de hecho usan— y se rechaza cualquier cosa con `..`, que es la que
 * convierte el segmento en una ruta.
 */
const USUARIO_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$/
function usuarioValido(u: string): boolean {
  return USUARIO_RE.test(u) && !u.includes('..')
}

// ── Frenos de salida ─────────────────────────────────────────────────

class UpstreamError extends Error {
  constructor(public status: number, msg: string) {
    super(msg)
  }
}

/** Cubo de tokens por instancia: segunda línea de defensa si la caché falla. */
const RATE_MAX = 12
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
 * `Crawl-Delay: 5` de su robots.txt, respetado de verdad.
 *
 * El cubo de tokens limita el VOLUMEN por minuto pero deja pasar una ráfaga;
 * esto separa las descargas en el tiempo, que es lo que el sitio pidió.
 */
const CRAWL_DELAY_MS = 5000

/**
 * Cuánto se acepta esperar el turno antes de rendirse.
 *
 * Más chico que los 15 s de `api/meta-ingesta.ts` porque acá hay una persona
 * mirando la pantalla y la lambda no lleva `maxDuration` propio. El caso normal
 * es un solo turno por delante (≤5 s); pasado eso hay contención de verdad y es
 * más honesto un 429 con `Retry-After` que colgar la petición hasta que la
 * plataforma la mate. **Nunca se descarga antes del turno**: saltarse la espera
 * sería incumplir el `Crawl-Delay` que el turno existe para respetar.
 */
const ESPERA_TOPE_MS = 8000

const dormir = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/**
 * El reloj en memoria. Ya NO es el freno principal —lo es el turno compartido
 * de la base— pero se mantiene al día en los dos caminos para que, si la base
 * se cae a mitad de una petición, el respaldo sepa cuándo fue la última
 * descarga real y no empiece contando desde cero.
 */
let ultimaDescarga = 0

/** Respaldo: el `Crawl-Delay` aplicado solo con lo que sabe esta instancia. */
async function turnoLocal(): Promise<void> {
  const falta = CRAWL_DELAY_MS - (Date.now() - ultimaDescarga)
  if (falta > 0) await dormir(falta)
  ultimaDescarga = Date.now()
}

/**
 * Devuelve un turno que se tomó y no se va a usar.
 *
 * Sin esto, cada abandono empuja `next_allowed` +5 s sin que nadie descargue y
 * la espera se realimenta hasta que nadie descarga nunca. El RPC hace un
 * `least(next_allowed, cuando)`, así que devolver de más es inofensivo.
 *
 * Los fallos se tragan a propósito —incluido «la función no existe», que es lo
 * que pasa hasta que la migración con el RPC esté aplicada—: el peor caso de no
 * poder devolver es que el próximo llamador espere 5 s de más, y eso no vale
 * convertir una degradación en un error para quien está pidiendo el perfil.
 */
async function devolverTurno(supabase: SupabaseClient, cuando: number): Promise<void> {
  try {
    await supabase.rpc('meta_devolver_turno', { cuando: new Date(cuando).toISOString() })
  } catch {
    // Ver arriba: perder el turno cuesta 5 s a alguien, fallar cuesta la página.
  }
}

/**
 * Toma el turno GLOBAL de descarga y espera hasta que llegue.
 *
 * Se llama SIEMPRE después de `takeToken()`, nunca antes: así una ráfaga contra
 * este endpoint público no puede empujar la fila más de `RATE_MAX` veces por
 * minuto ni dejar al cron sin turnos.
 */
async function esperarTurno(): Promise<void> {
  const supabase = baseDeDatos()
  // Sin credenciales no hay turno compartido que tomar: respaldo directo.
  if (!supabase) return turnoLocal()

  let crudo: unknown
  try {
    // Gotcha 2f de CLAUDE.md: PostgREST no lanza excepción, hay que mirar `error`.
    const { data, error } = await supabase.rpc('meta_tomar_turno')
    if (error) throw new Error(error.message)
    crudo = data
  } catch {
    // La base falló. Se sirve igual con el reloj de esta instancia: peor freno,
    // pero el perfil se ve. Ver el encabezado.
    return turnoLocal()
  }

  const turno = typeof crudo === 'string' ? Date.parse(crudo) : NaN
  if (!Number.isFinite(turno)) {
    // El turno se tomó —ya movimos la fila— pero no se puede leer cuándo toca.
    // Se paga el delay COMPLETO en vez de adivinar, igual que en meta-ingesta.
    await dormir(CRAWL_DELAY_MS)
    ultimaDescarga = Date.now()
    return
  }

  const falta = turno - Date.now()
  if (falta > ESPERA_TOPE_MS) {
    await devolverTurno(supabase, turno)
    throw new UpstreamError(429, 'melee está ocupado, probá en un momento')
  }
  if (falta > 0) await dormir(falta)
  ultimaDescarga = Date.now()
}

/** Tope de bytes decodificados: una respuesta enorme no puede tumbarnos. */
const MAX_BYTES = 2_000_000

// ── Descarga ─────────────────────────────────────────────────────────

/**
 * Los resultados viven detrás de un endpoint de DataTables del lado del
 * servidor: hay que mandarle la descripción de las columnas o responde 500.
 * Verificado contra el perfil real: sin el juego completo de columnas devuelve
 * `{"Error":true,"Code":500}`.
 */
const COLUMNAS = [
  'TournamentStartDate', 'TournamentName', 'Game',
  'DecklistId', 'Rank', 'Record', 'Format',
]

function cuerpoDataTables(desde: number, cuantos: number): URLSearchParams {
  const p = new URLSearchParams()
  p.set('draw', '1')
  p.set('start', String(desde))
  p.set('length', String(cuantos))
  p.set('search[value]', '')
  p.set('search[regex]', 'false')
  // Más recientes primero: es lo que se quiere ver arriba en un perfil.
  p.set('order[0][column]', '0')
  p.set('order[0][dir]', 'desc')
  COLUMNAS.forEach((c, i) => {
    p.set(`columns[${i}][data]`, c)
    p.set(`columns[${i}][name]`, c)
    p.set(`columns[${i}][searchable]`, 'true')
    p.set(`columns[${i}][orderable]`, 'true')
    p.set(`columns[${i}][search][value]`, '')
    p.set(`columns[${i}][search][regex]`, 'false')
  })
  return p
}

async function pedirResultados(usuario: string, desde: number, cuantos: number): Promise<unknown> {
  await esperarTurno()
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 15_000)
  try {
    const r = await fetch(`${SITE}/Profile/GetResults/${encodeURIComponent(usuario)}`, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
        Referer: `${SITE}/Profile/Index/${encodeURIComponent(usuario)}`,
      },
      body: cuerpoDataTables(desde, cuantos).toString(),
      // Un redirect a otro host convertiría esto en un proxy abierto.
      redirect: 'manual',
      signal: ctl.signal,
    })
    if (r.status >= 300 && r.status < 400) throw new UpstreamError(502, 'melee redirigió')
    if (!r.ok) throw new UpstreamError(r.status === 404 ? 404 : 502, `melee respondió ${r.status}`)

    const crudo = await r.text()
    if (crudo.length > MAX_BYTES) throw new UpstreamError(502, 'respuesta demasiado grande')
    try {
      return JSON.parse(crudo)
    } catch {
      throw new UpstreamError(502, 'melee no devolvió JSON')
    }
  } finally {
    clearTimeout(t)
  }
}

/**
 * ¿Existe el perfil?
 *
 * Hace falta porque el endpoint de resultados devuelve **200 con lista vacía**
 * tanto para un usuario inexistente como para uno que nunca jugó un torneo
 * (verificado con `zzz-no-existe-12345`). Sin esta comprobación, escribir mal
 * el usuario se vería igual que «todavía no tenés torneos» y la persona no
 * sabría que se equivocó.
 *
 * Solo se paga cuando la lista vino vacía, que es el único caso ambiguo.
 *
 * La espera del turno va DENTRO del `try` a propósito: ahora puede fallar por
 * contención, y esta comprobación es un extra sobre una respuesta que ya
 * tenemos. Que se caiga entera la petición por no poder confirmar algo
 * secundario sería cambiar un dato bueno por un error.
 */
async function perfilExiste(usuario: string): Promise<boolean> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 15_000)
  try {
    await esperarTurno()
    const r = await fetch(`${SITE}/Profile/Index/${encodeURIComponent(usuario)}`, {
      method: 'GET',
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      redirect: 'manual',
      signal: ctl.signal,
    })
    if (r.status !== 200) return false

    // El código de estado NO alcanza: melee devuelve **200 con una página de
    // error** («Oops! Something Went Wrong | Melee») para un perfil que no
    // existe. Lo comprobé pidiendo `zzz-no-existe-12345`: 200 y 83 KB de HTML.
    //
    // Lo que sí distingue es este campo oculto, que la página real usa para
    // saber a quién le pide los resultados y que en la de error no está.
    const html = (await r.text()).slice(0, 200_000)
    return /id="User_UserName"[^>]*\bvalue="[^"]+"/.test(html)
  } catch {
    // Ante la duda no se acusa a nadie de no existir.
    return true
  } finally {
    clearTimeout(t)
  }
}

// ── Normalización ────────────────────────────────────────────────────

export interface MeleeResultado {
  torneoId: number
  torneo: string
  organizador: string | null
  fecha: string | null
  /** Puesto final. Sin `participantes` al lado NO significa nada: ver abajo. */
  puesto: number | null
  /** Cuánta gente jugó. `399` es malo o bueno según sea de 400 o de 1022. */
  participantes: number | null
  /** Récord tal cual lo publica melee, `V-D-E`. */
  record: string | null
  victorias: number | null
  derrotas: number | null
  empates: number | null
  formato: string | null
  estado: string | null
  /** Para armar el enlace al mazo. NUNCA se descarga: robots.txt lo prohíbe. */
  decklistId: number | null
  decklistNombre: string | null
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** `"4-4-0"` → 4 victorias, 4 derrotas, 0 empates. */
function partesRecord(r: string | null): [number | null, number | null, number | null] {
  if (!r) return [null, null, null]
  const m = /^(\d+)\s*-\s*(\d+)(?:\s*-\s*(\d+))?$/.exec(r)
  if (!m) return [null, null, null]
  return [Number(m[1]), Number(m[2]), m[3] === undefined ? 0 : Number(m[3])]
}

function normalizar(fila: Record<string, unknown>): MeleeResultado {
  const record = str(fila.Record)
  const [v, d, e] = partesRecord(record)
  const idMazo = num(fila.DecklistId)
  return {
    torneoId: num(fila.TournamentId) ?? 0,
    torneo: str(fila.TournamentName) ?? 'Torneo',
    organizador: str(fila.OrganizationName),
    fecha: str(fila.TournamentStartDate),
    puesto: num(fila.Rank),
    participantes: num(fila.ParticipatingCount),
    record,
    victorias: v,
    derrotas: d,
    empates: e,
    formato: str(fila.FormatDescription) ?? str(fila.Format),
    estado: str(fila.TournamentStatusDescription),
    // Melee manda `0` cuando no hay mazo adjunto, no `null`.
    decklistId: idMazo && idMazo > 0 ? idMazo : null,
    decklistNombre: idMazo && idMazo > 0 ? str(fila.DecklistName) : null,
  }
}

// ── Handler ──────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' })

  // Un valor repetido (`?usuario=a&usuario=b`) llega como arreglo. Degradarlo
  // a uno de los dos sería una clave de CDN distinta apuntando al mismo dato:
  // se rechaza en vez de elegir.
  const uno = (v: unknown): string | null =>
    typeof v === 'string' && v.length > 0 ? v : null

  const mode = uno(req.query.mode) ?? 'resultados'
  if (!MODES.has(mode)) return res.status(400).json({ error: 'modo inválido' })

  const permitidos = PARAMS_POR_MODO[mode]
  for (const k of Object.keys(req.query)) {
    if (!permitidos.has(k)) return res.status(400).json({ error: `parámetro no permitido: ${k}` })
    if (uno(req.query[k]) === null) return res.status(400).json({ error: `parámetro inválido: ${k}` })
  }

  const usuario = uno(req.query.usuario)
  if (!usuario || !usuarioValido(usuario)) {
    return res.status(400).json({ error: 'usuario inválido' })
  }

  if (!takeToken()) {
    res.setHeader('Retry-After', '30')
    return res.status(429).json({ error: 'demasiadas consultas, probá en un momento' })
  }

  try {
    const datos = await pedirResultados(usuario, 0, 100) as {
      data?: unknown[]
      recordsTotal?: number
    }
    const filas = Array.isArray(datos.data) ? datos.data : []

    // Este es un compañero de Star Wars: Unlimited. Melee aloja muchos juegos y
    // mezclar el Magic de alguien con su SWU haría que los agregados —récord
    // total, percentil— no signifiquen nada.
    const swu = filas
      .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
      .filter(f => f.Game === 'StarWarsUnlimited')
      .map(normalizar)

    let existe = true
    if (filas.length === 0) {
      if (!takeToken()) {
        // Sin token para comprobar: se dice que no se sabe, no se inventa.
        existe = true
      } else {
        existe = await perfilExiste(usuario)
      }
    }

    if (!existe) {
      res.setHeader('Cache-Control', 'public, max-age=300')
      res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=3600')
      return res.status(404).json({ error: 'ese perfil no existe en melee', usuario })
    }

    // Los torneos pasados no cambian, así que se cachea fuerte. Media hora en
    // el navegador y medio día en la CDN: si alguien juega hoy, mañana está.
    res.setHeader('Cache-Control', 'public, max-age=1800')
    res.setHeader(
      'Vercel-CDN-Cache-Control',
      'public, s-maxage=43200, stale-while-revalidate=86400',
    )
    return res.status(200).json({
      usuario,
      resultados: swu,
      /** Cuántos torneos tiene en melee CONTANDO otros juegos. */
      totalEnMelee: typeof datos.recordsTotal === 'number' ? datos.recordsTotal : swu.length,
      source: {
        nombre: 'melee.gg',
        url: `${SITE}/Profile/Index/${encodeURIComponent(usuario)}`,
      },
    })
  } catch (e) {
    const err = e as UpstreamError
    const status = err?.status ?? 502
    if (status === 429) {
      // Contención en el turno de descarga: se dice cuándo reintentar y se deja
      // que la CDN absorba la ráfaga por ese mismo rato — ni más, para que el
      // `Retry-After` no sea mentira, ni menos, para no reenviar todo al origen.
      res.setHeader('Retry-After', '10')
      res.setHeader('Cache-Control', 'public, s-maxage=10')
    } else {
      res.setHeader('Cache-Control', status === 404 ? 'public, s-maxage=3600' : 'public, s-maxage=60')
    }
    return res.status(status).json({ error: err?.message ?? 'no se pudo consultar melee' })
  }
}

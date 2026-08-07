/**
 * /api/meta-ingesta — descubre torneos en melee.gg y baja su clasificación final.
 *
 * Es el motor del meta nacional: lee los perfiles de melee que la gente enlazó
 * en HOLOCRON, se entera de en qué torneos jugaron, y guarda la clasificación
 * FINAL de cada uno en `meta_tournaments` / `meta_standings`. Después el
 * cliente arma con eso «Acá» (torneos locales) y «Los nuestros» (nuestras filas
 * en cualquier torneo). Los dos ámbitos son honestos por separado y NUNCA se
 * mezclan: dos salvadoreños en un Galactic Open de 1022 no vuelven nacionales a
 * esos 1022.
 *
 * ── Por qué GET ───────────────────────────────────────────────────────
 *
 * Porque el cron de Vercel **solo sabe hacer GET**. Sí, escribe en la base, así
 * que no es el GET puro de un libro de texto; la alternativa era mantener dos
 * caminos —POST para el usuario, GET para el cron— y duplicar la puerta de
 * autorización. Se elige uno solo, autenticado, y se marca `no-store` para que
 * ni el navegador ni la CDN lo guarden. Cualquier otro verbo es 405.
 *
 * ── Las dos puertas, que son dos MODOS distintos ──────────────────────
 *
 * 1. **Cron** — `Authorization: Bearer ${CRON_SECRET}`. Si `CRON_SECRET` no
 *    está definida la puerta NO existe: no se compara contra `undefined`, se
 *    rechaza. Fallar abierto acá sería dejar que cualquiera dispare descargas
 *    contra melee desde nuestro dominio. Es el único modo que toca la **cola**:
 *    descubre torneos Y baja clasificaciones.
 * 2. **Usuario** — `Authorization: Bearer <JWT>` verificado con
 *    `supabase.auth.getUser()`. Existe para que enlazar la cuenta de melee
 *    traiga los torneos en el momento y no «mañana cuando corra el cron». Hace
 *    SOLO eso: mira UN perfil —el suyo—, encola lo que encuentre y devuelve.
 *    Nunca reclama un lote ni pagina clasificaciones.
 *
 * Que el modo usuario no toque la cola no es una limitación: es lo que lo hace
 * seguro. Cuando la tocaba, tres cosas salían mal a la vez. (a) Reclamaba un
 * lote y lo devolvía sin usar por falta de presupuesto; como reclamar SUMA un
 * intento, un botón apretado unas cuantas veces empujaba torneos sanos a
 * `fallido` sin haberle pegado nunca a melee. (b) Esas filas quedaban
 * `en_curso` y el cron —el único que tiene presupuesto para bajarlas— se las
 * encontraba tomadas. (c) Cada apretón costaba una tanda de descargas contra
 * un servidor ajeno. Ahora enlazar melee cuesta UNA descarga y no puede
 * envenenar nada.
 *
 * El header `x-vercel-cron` NO autentica nada —cualquiera puede escribirlo— así
 * que ni se mira.
 *
 * ── El turno de descarga vive en la BASE, no en memoria ───────────────
 *
 * `melee.gg` pide `Crawl-Delay: 5`. `api/melee-profile.ts` lo respeta con una
 * variable de módulo (`ultimaDescarga`), y eso alcanza mientras haya UNA sola
 * función. Pero Vercel empaqueta cada archivo de `api/` como una lambda
 * separada con su propio estado de módulo: dos relojes independientes de 5 s
 * significan una petición cada 2.5 s ENTRE LAS DOS, que es incumplir el pedido
 * del sitio. Por eso acá el turno se toma con el RPC `meta_tomar_turno()`, que
 * es una sola sentencia atómica sobre la fila única de `meta_fetch_lease`: lo
 * único que las dos lambdas comparten de verdad. **No agregar una variable de
 * módulo para esto.**
 *
 * Y el que toma un turno y decide no usarlo lo **devuelve**
 * (`meta_devolver_turno`). Sin eso, cada abandono deja `next_allowed` 5 s más
 * adelante sin que nadie haya descargado: bajo contención el turno se aleja
 * solo, cada vez más lambdas se rinden, y cada rendición lo aleja otro poco.
 * El único final de esa realimentación es que nadie descargue nunca más.
 *
 * ── El orden de escritura no es un detalle ────────────────────────────
 *
 * Primero las filas de `meta_standings`, después la marca `listo` en la cola.
 * Morir entre las dos cosas en ese orden se recupera solo (se vuelve a bajar y
 * el upsert es idempotente). Al revés se perdería el torneo para siempre: la
 * cola diría «listo» y no habría datos.
 *
 * ── Acá NO se parsean arquetipos, y es a propósito ────────────────────
 *
 * El parseo de `DecklistName` → líder/base vive en
 * `src/services/meleeArchetype.ts` y necesita la base de cartas entera (9.057
 * filas en Dexie) para resolver los nombres contra cartas REALES. Meterla en
 * una lambda sería duplicar la base de cartas del lado del servidor y, peor,
 * arriesgar que las dos copias se desincronicen y el mismo torneo resuelva a
 * dos uuids distintos. Así que acá se guarda `decklist_name` CRUDO y el cliente
 * resuelve el arquetipo con el índice que ya tiene.
 *
 * `meta_standings` ya NO tiene `leader_card_id` / `base_card_id` /
 * `archetype_confidence`: se escribían siempre en `null` y no las leía nadie.
 * Un esquema con columnas que mienten es peor que uno más chico. Si alguna vez
 * el parseo se mueve al servidor, se agregan de nuevo con la migración que las
 * llene — no antes.
 *
 * Lo único que sí se hace acá es elegir CUÁL de los mazos guardar cuando melee
 * manda más de uno, y para eso alcanza con la FORMA del nombre, sin conocer
 * ninguna carta.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Techo duro de la plataforma. El presupuesto de más abajo corta MUCHO antes:
 * este número solo evita que nos maten a mitad de un torneo. Si el plan no
 * llegara a 300 s la ingesta sigue siendo correcta —la cola queda como estaba—
 * pero avanzaría de a menos torneos por corrida.
 */
export const config = { maxDuration: 300 }

// ── Entorno ──────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const CRON_SECRET = process.env.CRON_SECRET

// ── melee.gg ─────────────────────────────────────────────────────────

const HOST = 'melee.gg'
const SITE = `https://${HOST}`

/**
 * Mismo User-Agent que `api/melee-profile.ts`, y por la misma razón medida: su
 * filtro solo mira que la cadena empiece con `Mozilla` (`swu-companion/1.0
 * (+url)` da 403). Con este formato —el estándar de robot bien portado, el de
 * Googlebot— seguimos diciendo quiénes somos y dónde escribirnos. **No
 * cambiarlo por un UA de navegador inventado.**
 */
const UA = 'Mozilla/5.0 (compatible; swu-companion/1.0; +https://www.swusv.com)'

/** Tope de bytes por respuesta. 500 filas de clasificación pesan ~652 KB. */
const MAX_BYTES = 2_000_000
const FETCH_TIMEOUT_MS = 15_000

/** `Crawl-Delay: 5` de su robots.txt. El RPC lo aplica; esto es para la cuenta. */
const CRAWL_DELAY_MS = 5_000

/**
 * Cuánto se acepta esperar un turno antes de rendirse.
 *
 * El turno lo reparte la base, así que bajo contención puede caer legítimamente
 * a 10 o 15 s. Más que eso ya no es «esperar mi lugar», es otra lambda larga
 * ocupando la fila: se corta la corrida y todo queda en la cola. **Nunca se
 * descarga antes del turno**: saltarse la espera sería incumplir el
 * `Crawl-Delay` que es justo lo que el turno existe para respetar.
 */
const ESPERA_TOPE_MS = 15_000

/**
 * `length` topa en **500 exactos** y el servidor recorta EN SILENCIO: pedir
 * 2000 devuelve 500 con una respuesta byte a byte idéntica. Hay que paginar con
 * `start` hasta `recordsTotal`.
 */
const PAGINA = 500
/** 4.000 jugadores. Si algún torneo lo supera, mejor un error visible que un bucle. */
const MAX_PAGINAS = 8

// ── Presupuesto de tiempo ────────────────────────────────────────────

/** Corrida del cron: 240 s de los 300 que da la plataforma. */
const PRESUPUESTO_MS = 240_000
/**
 * Corrida disparada por una persona. Mucho más chico porque es interactiva y
 * porque no hay nada largo que hacer: una sola descarga —el perfil de quien
 * apretó— y los upserts. Bajar clasificaciones es trabajo del cron.
 */
const PRESUPUESTO_USUARIO_MS = 60_000

const LOTE_MAX = 12

/**
 * Lo que puede costar el torneo TÍPICO: dos peticiones (la vista del torneo y
 * una sola página de clasificación), cada una con lo peor de los dos frenos —
 * los 15 s del AbortController MÁS los 15 s de espera del turno.
 *
 * Un torneo de 1022 jugadores necesita dos páginas más y puede pasarse de esta
 * cuenta; para ese caso está el corte DURO de adentro del bucle, que devuelve
 * la fila a `pendiente` sin marcar nada. Este número es para no EMPEZAR lo que
 * seguro no termina, no para adivinar el futuro.
 */
const PEOR_CASO_MS = 2 * (FETCH_TIMEOUT_MS + ESPERA_TOPE_MS)

/**
 * Qué parte del presupuesto del CRON puede comerse el descubrimiento.
 *
 * Descubrir sin dejar tiempo para procesar solo engorda la cola. 40% alcanza
 * para varios perfiles y deja el resto para bajar clasificaciones, que es lo
 * que produce datos. En el modo usuario no aplica: ahí descubrir es TODO lo
 * que se hace, así que se le da el presupuesto entero.
 */
const FRACCION_DESCUBRIMIENTO = 0.4

/**
 * Cubo de tokens del modo usuario.
 *
 * No es el freno que respeta el `Crawl-Delay` —ese es el turno de
 * `meta_fetch_lease`, que es global y vive en la base—, sino un tope de
 * VOLUMEN por persona: cada corrida de usuario cuesta una descarga contra
 * melee, y sin esto un botón apretado en bucle las encadena. Vive en la memoria
 * de la instancia, así que con varias lambdas el tope real es más laxo; por eso
 * es la segunda línea y no la única.
 */
const CUBO_MAX = 4
/** Un token cada 5 minutos. Cuatro actualizaciones seguidas y después a ritmo. */
const CUBO_RELLENO_MS = 5 * 60_000
/** Techo de la tabla en memoria, para que no crezca sin fin. */
const CUBO_ENTRADAS_MAX = 500

// ── Otros topes ──────────────────────────────────────────────────────

/** Cuántos perfiles enlazados se miran como mucho en una corrida. */
const MAX_PERFILES = 200
/** Torneos recientes que se piden por perfil. Los viejos ya están en la cola. */
const RESULTADOS_POR_PERFIL = 100
/**
 * Si melee no publica el estado del torneo, se lo da por terminado recién
 * después de esta gracia. Ingerir un torneo EN CURSO es peor que esperar: se
 * guardaría la clasificación de la ronda 3 de 5 como si fuera la final y la
 * cola no volvería a mirarlo nunca.
 */
const GRACIA_SIN_ESTADO_MS = 48 * 60 * 60 * 1000
/** Errores que se devuelven en la respuesta. El resto se cuenta pero no se lista. */
const MAX_ERRORES = 20

/**
 * Estados con los que melee marca un torneo CERRADO. El contrato medido dice
 * `Ended`; los otros dos están por si su UI usa otra palabra en algún torneo
 * local.
 */
const ESTADOS_TERMINADOS = new Set(['ended', 'completed', 'finished'])

/**
 * Estados que sabemos que NO son finales: el torneo sigue vivo, o se canceló y
 * su clasificación no vale como resultado.
 *
 * Existe esta segunda lista porque una lista blanca sola no alcanzaba. Con solo
 * `ESTADOS_TERMINADOS`, cualquier palabra que melee no haya usado todavía caía
 * en «no terminó» PARA SIEMPRE —el estado se refresca en cada corrida, pero la
 * respuesta es la misma— y el torneo no se encolaba nunca, sin error, sin fila
 * en la cola y sin nada que mirar. Un fallo silencioso disparado por un valor
 * que no controlamos.
 *
 * Con las dos listas hay tres respuestas en vez de dos: terminó, no terminó, y
 * **no sé**. Lo que no está en ninguna es «no sé» y cae en la gracia por tiempo
 * —el mismo camino que un torneo sin estado— y queda anotado en la respuesta
 * para poder agregarlo acá con conocimiento.
 */
const ESTADOS_NO_TERMINADOS = new Set([
  'notstarted', 'not started', 'scheduled', 'upcoming',
  'registration', 'registrationopen', 'registration open',
  'inprogress', 'in progress', 'started', 'running', 'active', 'live',
  'paused', 'suspended', 'cancelled', 'canceled', 'draft',
])

// ── Errores ──────────────────────────────────────────────────────────

/** Algo salió mal del lado de melee (o de la red hacia melee). */
class ErrorDeMelee extends Error {
  readonly status: number
  constructor(status: number, msg: string) {
    super(msg)
    this.status = status
  }
}

/** Se acabó el presupuesto. No es un fallo: es el corte limpio. */
class ErrorDeTiempo extends Error {}

/**
 * Melee reconoce el torneo pero no publica su clasificación.
 *
 * Medido en producción con el Last Chance Qualifier 2026 (id 403891): la vista
 * del torneo declara **1.486 jugadores** y **8 rondas cerradas**, y aun así
 * `/Standing/GetRoundStandings` sobre la última ronda devuelve
 * `recordsTotal: 0` — 73 bytes, sin una sola fila.
 *
 * No es un fallo nuestro ni de melee: hay eventos cuya clasificación
 * simplemente no se publica. Pero tampoco es un éxito. Sin esta distinción,
 * `desde (0) >= total (0)` daba «completa» y el torneo quedaba marcado `listo`
 * con cero puestos: un evento de 1.486 personas archivado como ingerido, que
 * nadie iba a volver a mirar y que la app mostraría con un top vacío.
 *
 * Se separa de un error normal porque **no se debe reintentar**: reintentar
 * cinco veces algo que melee no publica es gastar cortesía contra su servidor
 * para llegar siempre al mismo cero. Va a `descartado`, con el motivo escrito.
 */
class SinClasificacion extends Error {}

// ── Utilidades ───────────────────────────────────────────────────────

const dormir = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}
function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}
/** Melee manda los ids como número o como texto según el endpoint. */
function idComoTexto(v: unknown): string | null {
  const s = str(v)
  if (s) return s
  const n = num(v)
  return n === null ? null : String(n)
}

/** `"4-4-0"` → 4 victorias, 4 derrotas, 0 empates. Igual que en melee-profile.ts. */
function partesRecord(r: string | null): [number | null, number | null, number | null] {
  if (!r) return [null, null, null]
  const m = /^(\d+)\s*-\s*(\d+)(?:\s*-\s*(\d+))?$/.exec(r)
  if (!m) return [null, null, null]
  return [Number(m[1]), Number(m[2]), m[3] === undefined ? 0 : Number(m[3])]
}

/**
 * Compara dos secretos sin filtrar por tiempo cuánto coincidía el prefijo. Se
 * hashean antes para que `timingSafeEqual` reciba siempre dos búferes del mismo
 * largo: si no, la propia diferencia de longitud sería el filtrado.
 */
function igualSeguro(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

/**
 * Fisher-Yates. Hace falta de verdad: el descubrimiento se corta por
 * presupuesto, y con un orden fijo los últimos perfiles de la lista no se
 * mirarían NUNCA. Barajando, cada corrida cubre a otros y en unas cuantas se
 * cubre a todos.
 */
function barajar<T>(xs: T[]): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Cubo de tokens del modo usuario ──────────────────────────────────

const cubos = new Map<string, { tokens: number; at: number }>()

/** ¿Puede esta persona disparar otra corrida? Consume un token si sí. */
function tomarToken(usuarioId: string): boolean {
  const ahora = Date.now()
  const existía = cubos.has(usuarioId)
  const cubo = cubos.get(usuarioId) ?? { tokens: CUBO_MAX, at: ahora }
  cubo.tokens = Math.min(CUBO_MAX, cubo.tokens + (ahora - cubo.at) / CUBO_RELLENO_MS)
  cubo.at = ahora

  // La tabla crecería con cada usuario nuevo que pase por esta instancia. Al
  // llegar al techo se vacía entera: es un freno best-effort —no un contador
  // que haya que conservar— y vaciar cuesta O(1) contra el O(n) de elegir a
  // quién echar. Lo peor que pasa es que unos cuantos recuperen sus tokens
  // antes de tiempo.
  if (!existía && cubos.size >= CUBO_ENTRADAS_MAX) cubos.clear()
  cubos.set(usuarioId, cubo)

  if (cubo.tokens < 1) return false
  cubo.tokens -= 1
  return true
}

// ── Turno compartido ─────────────────────────────────────────────────

/**
 * Devuelve un turno que se tomó y no se usó.
 *
 * `meta_tomar_turno` empuja `next_allowed` 5 s hacia adelante ANTES de saber si
 * el que llamó va a descargar. Si se rinde y no devuelve nada, esos 5 s quedan
 * cobrados por una descarga que nunca ocurrió: bajo contención el turno se
 * aleja, más lambdas se rinden por `ESPERA_TOPE_MS`, y cada una lo aleja otro
 * poco. Es una realimentación cuyo único final es que nadie descargue más.
 *
 * El RPC hace `least(next_allowed, cuando)`, así que devolver nunca EMPUJA el
 * turno hacia adelante: en el peor caso lo deja donde estaba.
 *
 * Lo que sí puede pasar, y se acepta a sabiendas: si el que devuelve no era el
 * último de la fila, `next_allowed` retrocede por detrás de turnos que otras
 * lambdas ya se llevaron, y un llamador nuevo puede recibir un instante que ya
 * tenía dueño. Eso es, como mucho, DOS descargas en la misma ventana de 5 s en
 * un momento de contención alta. Lo que se evita a cambio es que el turno se
 * aleje sin techo y no se descargue nunca más. Entre incumplir el crawl-delay
 * una vez y dejar de ingerir para siempre, se elige lo primero.
 *
 * Best-effort a propósito: si esto falla, lo peor que queda es el turno 5 s
 * adelantado, que es exactamente donde estaría sin esta función. No se
 * convierte el fallo del llamador en otro error distinto.
 */
async function devolverTurno(supabase: SupabaseClient, turno: number): Promise<void> {
  const { error } = await supabase.rpc('meta_devolver_turno', {
    cuando: new Date(turno).toISOString(),
  })
  if (error) console.warn('meta-ingesta: no se pudo devolver el turno:', error.message)
}

/**
 * Toma el turno GLOBAL de descarga y espera hasta que llegue.
 *
 * El RPC avanza `next_allowed` de forma atómica y devuelve el instante que nos
 * tocó. La espera se calcula contra el reloj de la base, no contra el nuestro;
 * el desfase entre ambos es de milisegundos (los dos con NTP) pero el tope de
 * `ESPERA_TOPE_MS` está justamente para que un reloj enfermo no nos deje
 * durmiendo hasta que la plataforma nos mate.
 */
async function tomarTurno(supabase: SupabaseClient): Promise<void> {
  // Gotcha 2f de CLAUDE.md: PostgREST no lanza excepción, hay que mirar `error`.
  const { data, error } = await supabase.rpc('meta_tomar_turno')
  if (error) throw new ErrorDeMelee(503, `no se pudo tomar el turno: ${error.message}`)

  const turno = typeof data === 'string' ? Date.parse(data) : NaN
  if (!Number.isFinite(turno)) {
    // Sin turno legible no se descarga a ciegas: se paga el delay completo.
    await dormir(CRAWL_DELAY_MS)
    return
  }

  const falta = turno - Date.now()
  if (falta > ESPERA_TOPE_MS) {
    // Se abandona: hay que devolverlo. Ver `devolverTurno`.
    await devolverTurno(supabase, turno)
    throw new ErrorDeTiempo(`el turno de descarga está a ${Math.round(falta / 1000)} s`)
  }
  if (falta > 0) await dormir(falta)
}

// ── Descarga ─────────────────────────────────────────────────────────

/**
 * Un solo camino de salida hacia melee, con los cuatro frenos de
 * `melee-profile.ts`: host fijo, `redirect: 'manual'` (un 301 a otro host nos
 * convertiría en proxy abierto), AbortController y tope de bytes leído del
 * stream —no del string ya materializado, que sería tragarse primero la
 * respuesta enorme y quejarse después.
 */
async function descargar(url: string, init: RequestInit): Promise<string> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS)
  try {
    const r = await fetch(url, {
      ...init,
      redirect: 'manual',
      signal: ctl.signal,
    })
    if (r.status >= 300 && r.status < 400) throw new ErrorDeMelee(502, 'melee redirigió')
    if (r.status === 404) throw new ErrorDeMelee(404, 'melee dice que no existe')
    if (!r.ok) throw new ErrorDeMelee(502, `melee respondió ${r.status}`)
    if (!r.body) throw new ErrorDeMelee(502, 'respuesta sin cuerpo')

    const reader = r.body.getReader()
    const trozos: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BYTES) {
        await reader.cancel()
        throw new ErrorDeMelee(502, 'respuesta demasiado grande')
      }
      trozos.push(value)
    }
    const buf = new Uint8Array(total)
    let off = 0
    for (const c of trozos) {
      buf.set(c, off)
      off += c.byteLength
    }
    return new TextDecoder('utf-8').decode(buf)
  } finally {
    clearTimeout(t)
  }
}

/**
 * Cuerpo de DataTables del lado del servidor.
 *
 * Sin la descripción COMPLETA de las columnas melee devuelve
 * `{"Error":true,"Code":500}`. Está medido contra los dos endpoints y no es
 * negociable: si falta una sola columna, no hay datos.
 */
function cuerpoDataTables(
  columnas: string[],
  desde: number,
  cuantos: number,
  orden: { columna: number; dir: 'asc' | 'desc' },
): URLSearchParams {
  const p = new URLSearchParams()
  p.set('draw', '1')
  p.set('start', String(desde))
  p.set('length', String(cuantos))
  p.set('search[value]', '')
  p.set('search[regex]', 'false')
  p.set('order[0][column]', String(orden.columna))
  p.set('order[0][dir]', orden.dir)
  columnas.forEach((c, i) => {
    p.set(`columns[${i}][data]`, c)
    p.set(`columns[${i}][name]`, c)
    p.set(`columns[${i}][searchable]`, 'true')
    p.set(`columns[${i}][orderable]`, 'true')
    p.set(`columns[${i}][search][value]`, '')
    p.set(`columns[${i}][search][regex]`, 'false')
  })
  return p
}

function comoJson(crudo: string): Record<string, unknown> {
  try {
    const v = JSON.parse(crudo)
    const o = obj(v)
    if (!o) throw new Error('no es objeto')
    return o
  } catch {
    throw new ErrorDeMelee(502, 'melee no devolvió JSON')
  }
}

// ── Perfiles: qué torneos jugó cada quien ────────────────────────────

/**
 * Las 7 columnas de `/Profile/GetResults`, copiadas VERBATIM de
 * `api/melee-profile.ts`.
 *
 * Se duplican porque aquel archivo no exporta sus ayudantes y esta tarea no
 * puede tocarlo. **Si allá cambian, acá también**: son el mismo contrato con el
 * mismo servidor, y una lista incompleta no degrada, devuelve 500.
 */
const COLUMNAS_PERFIL = [
  'TournamentStartDate', 'TournamentName', 'Game',
  'DecklistId', 'Rank', 'Record', 'Format',
]

/** Gramática del usuario de melee: la misma que valida `profiles.melee_username`. */
const USUARIO_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$/
const usuarioValido = (u: string) => USUARIO_RE.test(u) && !u.includes('..')

/** Los ids de torneo de melee son numéricos aunque acá se guarden como texto. */
const TORNEO_RE = /^[0-9]{1,20}$/

/** Lo que nos interesa de una fila de resultados de un perfil. */
interface TorneoVisto {
  id: string
  name: string
  organizer: string | null
  date: string | null
  player_count: number | null
  format: string | null
  status: string | null
}

async function torneosDelPerfil(
  supabase: SupabaseClient,
  usuario: string,
): Promise<TorneoVisto[]> {
  await tomarTurno(supabase)
  const crudo = await descargar(`${SITE}/Profile/GetResults/${encodeURIComponent(usuario)}`, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json',
      Referer: `${SITE}/Profile/Index/${encodeURIComponent(usuario)}`,
    },
    // Más recientes primero: son los que todavía no están en la cola.
    body: cuerpoDataTables(COLUMNAS_PERFIL, 0, RESULTADOS_POR_PERFIL, {
      columna: 0,
      dir: 'desc',
    }).toString(),
  })

  const datos = comoJson(crudo)
  const filas = Array.isArray(datos.data) ? datos.data : []
  const out: TorneoVisto[] = []

  for (const cruda of filas) {
    const f = obj(cruda)
    if (!f) continue
    // Melee aloja muchos juegos. Mezclar el Magic de alguien con su SWU haría
    // que el meta no signifique nada.
    if (f.Game !== 'StarWarsUnlimited') continue

    const id = num(f.TournamentId)
    if (!id || id <= 0) continue

    // `TournamentStartDate` viene sin desfase (`2026-08-01T09:00:00`) y se toma
    // como **UTC**, que es lo que melee publica ahí. Se guarda normalizada para
    // que la base no dependa de dónde corrió la lambda.
    //
    // Ojo con el porqué, porque tiene consecuencias: NO se toma como UTC
    // «porque la lambda corre en UTC» —eso sería acertar de casualidad—, sino
    // porque el valor ES un instante. Medido contra las filas ya ingeridas: los
    // tres «Weekly Play» de Decks & Dice llegan como 01:00 y 01:30, que leídos
    // en UTC son las 19:00 y 19:30 —hora de weekly— y leídos como reloj local
    // serían torneos que empiezan a la una de la madrugada. Y el Galactic
    // Championship Day One llega 17:00, o sea media mañana en su huso.
    //
    // De ahí que `meta_tournaments.date` sea un instante de verdad y se muestre
    // con `fechaCompacta` (hora SV), y NO una fecha sin zona de las que hay que
    // leer tal cual vienen escritas (`diaMesSinZona` en src/services/horaSV).
    // Confundir las dos cosas es lo que tenía la pestaña «SV» mostrando tres de
    // ocho torneos un día tarde.
    const fechaCruda = str(f.TournamentStartDate)
    const ms = fechaCruda ? Date.parse(fechaCruda) : NaN

    out.push({
      id: String(id),
      name: str(f.TournamentName) ?? 'Torneo',
      organizer: str(f.OrganizationName),
      date: Number.isFinite(ms) ? new Date(ms).toISOString() : null,
      player_count: num(f.ParticipatingCount),
      format: str(f.FormatDescription) ?? str(f.Format),
      status: str(f.TournamentStatusDescription),
    })
  }
  return out
}

/**
 * ¿Se puede bajar ya la clasificación FINAL?
 *
 * Un torneo en curso tiene «clasificación» —la de la ronda que va— y bajarla
 * la escribiría como definitiva para siempre, porque la cola no vuelve sobre lo
 * que ya marcó `listo`. Así que:
 *
 * - estado terminal conocido        → sí;
 * - estado NO terminal conocido     → no, y se reintenta en la próxima corrida
 *   porque los metadatos se refrescan siempre;
 * - estado desconocido, o sin estado → se espera la gracia por tiempo. Si
 *   tampoco hay fecha no hay nada que esperar: la ausencia de las dos cosas no
 *   es prueba de que siga vivo.
 *
 * Lo desconocido cae en la gracia y NO en «todavía no» porque «todavía no» es
 * permanente para un valor que nunca va a cambiar: el torneo desaparecería en
 * silencio. La gracia, en cambio, se resuelve sola en 48 h y deja el estado
 * raro anotado en la respuesta para poder clasificarlo a mano.
 */
function yaTerminó(t: TorneoVisto, anotarDesconocido: (estado: string, torneoId: string) => void): boolean {
  const estado = t.status?.toLowerCase() ?? null
  if (estado) {
    if (ESTADOS_TERMINADOS.has(estado)) return true
    if (ESTADOS_NO_TERMINADOS.has(estado)) return false
    anotarDesconocido(t.status ?? estado, t.id)
  }
  const ms = t.date ? Date.parse(t.date) : NaN
  if (!Number.isFinite(ms)) return true
  return Date.now() - ms > GRACIA_SIN_ESTADO_MS
}

// ── La vista del torneo: cuál es la ronda FINAL ──────────────────────

/**
 * Devuelve el interior del elemento con ese `id`, contando apertura y cierre de
 * su propia etiqueta.
 *
 * Un `[\s\S]*?</div>` cortaría en el primer `</div>` ANIDADO y se llevaría
 * medio contenedor. Los comentarios se quitan antes porque un `<div` comentado
 * descuadraría la cuenta.
 */
function bloquePorId(html: string, id: string): string | null {
  const limpio = html.replace(/<!--[\s\S]*?-->/g, ' ')
  const apertura = new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*\\bid=["']${id}["'][^>]*>`, 'i')
  const m = apertura.exec(limpio)
  if (!m) return null

  const etiqueta = m[1].toLowerCase()
  const desde = m.index + m[0].length
  const re = new RegExp(`<(/?)${etiqueta}\\b[^>]*>`, 'gi')
  re.lastIndex = desde

  let profundidad = 1
  for (let x = re.exec(limpio); x; x = re.exec(limpio)) {
    profundidad += x[1] ? -1 : 1
    if (profundidad === 0) return limpio.slice(desde, x.index)
  }
  // HTML sin cerrar: mejor lo que hay que nada.
  return limpio.slice(desde)
}

/** Cada botón/opción de ronda. El id puede venir en `data-id` o en un `roundId=`. */
const SELECTOR_RONDA = /<[a-z][a-z0-9]*\b[^>]*\bclass=["'][^"']*\bround-selector\b[^"']*["'][^>]*>/gi
const ID_RONDA = /\bdata-(?:round-)?id=["']([0-9]{1,20})["']/i
const ID_EN_URL = /\broundId=([0-9]{1,20})\b/i

/**
 * La ronda cuya clasificación es la FINAL.
 *
 * Tres trampas medidas, las tres evitadas acá:
 *
 * 1. La página tiene DOS contenedores de rondas —`#standings-…` y
 *    `#pairings-round-selector-container`— que repiten los mismos ids. Sin
 *    acotar al de standings se puede terminar leyendo el de emparejamientos.
 * 2. `roundId` **NO es monotónico**: en un torneo real la Round 11 es 1420227 y
 *    la Finals es 1419188. Ordenar por id daría la ronda equivocada. El orden
 *    bueno es el del DOM, y la final es la ÚLTIMA.
 * 3. Tampoco se detecta por nombre: los torneos locales no terminan en
 *    «Finals», terminan en «Round 3».
 */
function rondaFinal(html: string): string | null {
  const bloque = bloquePorId(html, 'standings-round-selector-container')
  if (!bloque) return null

  let ultima: string | null = null
  for (const m of bloque.matchAll(SELECTOR_RONDA)) {
    const etiqueta = m[0]
    const id = ID_RONDA.exec(etiqueta)?.[1] ?? ID_EN_URL.exec(etiqueta)?.[1]
    if (id) ultima = id
  }
  return ultima
}

async function vistaDelTorneo(supabase: SupabaseClient, torneoId: string): Promise<string> {
  await tomarTurno(supabase)
  return descargar(`${SITE}/Tournament/View/${torneoId}`, {
    method: 'GET',
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  })
}

// ── La clasificación ─────────────────────────────────────────────────

/**
 * Las 9 columnas obligatorias de `/Standing/GetRoundStandings`. Medido: con
 * menos, 500.
 */
const COLUMNAS_STANDINGS = [
  'Rank', 'Player', 'Decklists', 'MatchRecord', 'GamePoints',
  'OpponentMatchWinPercentage', 'TeamGameWinPercentage',
  'OpponentGameWinPercentage', 'FinalTiebreaker',
]

/**
 * Una fila lista para `meta_standings`.
 *
 * No hay `leader_card_id` / `base_card_id` / `archetype_confidence`: esas
 * columnas ya no existen en la tabla. El arquetipo se resuelve en el cliente
 * desde `decklist_name`. Ver el encabezado.
 */
interface FilaStanding {
  melee_tournament_id: string
  round_id: string
  rank: number
  player_name: string
  player_melee_id: string | null
  record: string | null
  wins: number | null
  losses: number | null
  draws: number | null
  decklist_name: string | null
  decklist_id: string | null
}

/**
 * Elige QUÉ mazo guardar cuando melee manda más de uno (medido: 1 fila de 500).
 *
 * No se parsea el arquetipo acá —eso necesita la base de cartas, ver el
 * encabezado— pero sí se puede mirar la FORMA del nombre autogenerado:
 * `"Líder, Subtítulo - Base"`. Si exactamente uno de los mazos tiene esa forma,
 * ese es el del torneo. Si hay dos o ninguno queda ambiguo y se guarda `null`:
 * un arquetipo inventado envenena el meta, y una fila sin mazo es un dato
 * honesto —de hecho muchas vienen así (en un local de 8, los 8 sin lista).
 *
 * El separador lleva los DOS espacios, igual que en `meleeArchetype.ts`: nueve
 * nombres de líder traen un guion pegado —Bo-Katan Kryze, C-3PO, IG-88,
 * Obi-Wan Kenobi, Qui-Gon Jinn— y una forma que prohíba guiones a la izquierda
 * los descartaría a todos. La coma tiene que estar ANTES del separador, que es
 * donde va el subtítulo del líder; a la derecha puede haber comas y son parte
 * del nombre de la base («Nevarro City, Restored»).
 */
function pareceArquetipo(nombre: string): boolean {
  const i = nombre.indexOf(' - ')
  return i > 0 && nombre.slice(0, i).includes(',') && nombre.length > i + 3
}

function mazoDeLaFila(v: unknown): { nombre: string | null; id: string | null } {
  const mazos = Array.isArray(v) ? v : []
  const utiles = mazos
    .map(m => obj(m))
    .filter((m): m is Record<string, unknown> => !!m)
    .map(m => ({ nombre: str(m.DecklistName), id: idComoTexto(m.DecklistId) }))
    .filter(m => m.nombre || m.id)

  if (utiles.length === 0) return { nombre: null, id: null }
  if (utiles.length === 1) return utiles[0]

  const conForma = utiles.filter(m => m.nombre && pareceArquetipo(m.nombre))
  return conForma.length === 1 ? conForma[0] : { nombre: null, id: null }
}

/** El nombre del jugador. SWU es 1v1: si viniera un equipo, manda el primero. */
function nombreDelEquipo(fila: Record<string, unknown>): { nombre: string | null; id: string | null } {
  const equipo = obj(fila.Team)
  const jugadores = Array.isArray(equipo?.Players) ? equipo.Players : []
  for (const crudo of jugadores) {
    const p = obj(crudo)
    if (!p) continue
    const nombre = str(p.DisplayName)
    if (!nombre) continue
    // El id del jugador NO está en el contrato medido. Si melee lo manda se
    // guarda; si no, queda null y el cruce con `profiles` se hace por nombre.
    const id =
      idComoTexto(p.ID) ?? idComoTexto(p.Id) ??
      idComoTexto(p.UserId) ?? idComoTexto(p.PlayerId)
    return { nombre, id }
  }
  // Respaldo: algunas respuestas traen el nombre plano. Solo si es texto limpio;
  // si viene con HTML adentro no se adivina.
  const plano = str(fila.Player)
  if (plano && !plano.includes('<')) return { nombre: plano, id: null }
  return { nombre: null, id: null }
}

async function paginaDeClasificacion(
  supabase: SupabaseClient,
  torneoId: string,
  rondaId: string,
  desde: number,
): Promise<{ filas: FilaStanding[]; total: number; crudas: number }> {
  await tomarTurno(supabase)
  const cuerpo = cuerpoDataTables(COLUMNAS_STANDINGS, desde, PAGINA, {
    // Por `Rank`, que es ÚNICO por ronda (el último desempate es TeamId).
    // **Nunca por `Points`**: en playoffs el campeón puede tener menos puntos
    // que alguien eliminado antes.
    columna: 0,
    dir: 'asc',
  })
  cuerpo.set('roundId', rondaId)

  const crudo = await descargar(`${SITE}/Standing/GetRoundStandings`, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json',
      Referer: `${SITE}/Tournament/View/${torneoId}`,
    },
    body: cuerpo.toString(),
  })

  const datos = comoJson(crudo)
  const crudas = Array.isArray(datos.data) ? datos.data : []
  const total = num(datos.recordsTotal) ?? crudas.length

  const filas: FilaStanding[] = []
  for (const c of crudas) {
    const f = obj(c)
    if (!f) continue
    const rank = num(f.Rank)
    if (!rank || rank < 1 || !Number.isInteger(rank)) continue

    const jugador = nombreDelEquipo(f)
    // Sin nombre la fila no se le puede atribuir a nadie: no sirve ni para
    // «Acá» ni para «Los nuestros». Se descarta entera.
    if (!jugador.nombre) continue

    const record = str(f.MatchRecord)
    const [v, d, e] = partesRecord(record)
    const mazo = mazoDeLaFila(f.Decklists)

    filas.push({
      melee_tournament_id: torneoId,
      round_id: rondaId,
      rank,
      player_name: jugador.nombre,
      player_melee_id: jugador.id,
      record,
      wins: v,
      losses: d,
      draws: e,
      decklist_name: mazo.nombre,
      decklist_id: mazo.id,
    })
  }
  return { filas, total, crudas: crudas.length }
}

// ── Descubrimiento ───────────────────────────────────────────────────

interface ResumenDescubrimiento {
  descubiertos: number
  encolados: number
  /** Perfiles que se leyeron BIEN. */
  perfiles: number
  /**
   * Perfiles con un usuario de melee utilizable, se hayan podido leer o no.
   *
   * Va aparte de `perfiles` porque son dos cosas distintas y el mensaje que ve
   * la persona depende de cuál: `candidatos === 0` es «no enlazaste melee»,
   * pero `candidatos > 0 && perfiles === 0` es «melee no contestó», y decirle
   * lo primero cuando pasó lo segundo la manda a arreglar algo que no está roto.
   */
  candidatos: number
}

async function descubrir(
  supabase: SupabaseClient,
  usuarioId: string | null,
  hasta: number,
  anotarError: (donde: string, detalle: string) => void,
): Promise<ResumenDescubrimiento> {
  let q = supabase
    .from('profiles')
    .select('id, melee_username')
    .not('melee_username', 'is', null)
    .limit(MAX_PERFILES)
  // Corrida de una persona: solo SU perfil. Los demás son trabajo del cron, y
  // así enlazar la cuenta cuesta una descarga y no dieciséis.
  if (usuarioId) q = q.eq('id', usuarioId)

  const { data: perfiles, error } = await q
  if (error) {
    anotarError('perfiles', error.message)
    return { descubiertos: 0, encolados: 0, perfiles: 0, candidatos: 0 }
  }

  const enlazados = (perfiles ?? [])
    .map(p => ({ id: String(p.id), usuario: str(p.melee_username) }))
    .filter((p): p is { id: string; usuario: string } => !!p.usuario && usuarioValido(p.usuario))

  const vistos = new Map<string, TorneoVisto & { discovered_from: string }>()
  let leidos = 0

  for (const perfil of barajar(enlazados)) {
    if (Date.now() > hasta) break
    try {
      for (const t of await torneosDelPerfil(supabase, perfil.usuario)) {
        // El primero que lo trae se queda como descubridor; los metadatos, en
        // cambio, se pisan con lo último que se leyó (el conteo de jugadores y
        // el estado cambian mientras el torneo vive).
        const previo = vistos.get(t.id)
        vistos.set(t.id, { ...t, discovered_from: previo?.discovered_from ?? perfil.id })
      }
      leidos++
    } catch (e) {
      if (e instanceof ErrorDeTiempo) break
      anotarError(`perfil ${perfil.usuario}`, (e as Error).message)
    }
  }

  const torneos = [...vistos.values()]
  if (torneos.length === 0) {
    return { descubiertos: 0, encolados: 0, perfiles: leidos, candidatos: enlazados.length }
  }

  const ahora = new Date().toISOString()

  // 1. Alta. `ignoreDuplicates` = `on conflict do nothing`, así que
  //    `discovered_from` conserva a quien lo trajo primero.
  const { error: eAlta } = await supabase
    .from('meta_tournaments')
    .upsert(
      torneos.map(t => ({
        melee_tournament_id: t.id,
        name: t.name,
        organizer: t.organizer,
        date: t.date,
        player_count: t.player_count,
        format: t.format,
        status: t.status,
        discovered_from: t.discovered_from,
      })),
      { onConflict: 'melee_tournament_id', ignoreDuplicates: true },
    )
  if (eAlta) anotarError('alta de torneos', eAlta.message)

  // 2. Refresco de metadatos SIN tocar `discovered_from` ni lo que escribe la
  //    ingesta (`final_round_id`, `standings_fetched_at`): un upsert parcial
  //    solo actualiza las columnas que se le pasan. Hace falta porque el estado
  //    pasa de «en curso» a «Ended» y el conteo de jugadores crece.
  const { error: eMeta } = await supabase
    .from('meta_tournaments')
    .upsert(
      torneos.map(t => ({
        melee_tournament_id: t.id,
        name: t.name,
        organizer: t.organizer,
        date: t.date,
        player_count: t.player_count,
        format: t.format,
        status: t.status,
        updated_at: ahora,
      })),
      { onConflict: 'melee_tournament_id' },
    )
  if (eMeta) anotarError('metadatos de torneos', eMeta.message)

  // 3. A la cola, solo los terminados. La clave natural ES la idempotencia: un
  //    torneo ya procesado tiene su fila y este insert no hace nada.
  //
  //    Un estado que melee no había usado nunca no puede hacer desaparecer el
  //    torneo en silencio: cae en la gracia por tiempo y se anota UNA vez por
  //    valor distinto (no una por torneo, que llenaría los 20 huecos de la
  //    respuesta con la misma línea repetida).
  const estadosRaros = new Set<string>()
  const paraEncolar = torneos.filter(t =>
    yaTerminó(t, (estado, torneoId) => {
      if (estadosRaros.has(estado)) return
      estadosRaros.add(estado)
      anotarError(
        'estado desconocido de melee',
        `"${estado}" (p. ej. torneo ${torneoId}): no está en ninguna de las dos listas, se decide por la gracia de ${GRACIA_SIN_ESTADO_MS / 3_600_000} h`,
      )
    }),
  )
  let encolados = 0
  if (paraEncolar.length > 0) {
    const { data: nuevos, error: eCola } = await supabase
      .from('meta_ingest_queue')
      .upsert(
        paraEncolar.map(t => ({ melee_tournament_id: t.id })),
        { onConflict: 'melee_tournament_id', ignoreDuplicates: true },
      )
      .select('melee_tournament_id')
    if (eCola) anotarError('cola', eCola.message)
    encolados = nuevos?.length ?? 0
  }

  return {
    descubiertos: torneos.length,
    encolados,
    perfiles: leidos,
    candidatos: enlazados.length,
  }
}

// ── ¿Es de acá? ──────────────────────────────────────────────────────

/** Cuántas filas se leen de una vez al recorrer `meta_tournaments`. */
const PAGINA_LECTURA = 1_000
/** Cuántos ids entran en un `.in(...)`. Van en la URL: una lista enorme es un 414. */
const LOTE_UPDATE = 200
/** Techo de vueltas de lectura. 50.000 torneos; si se llega, es un error visible. */
const MAX_VUELTAS_LECTURA = 50

/**
 * Sincroniza `is_local` con la lista curada de organizadores salvadoreños.
 *
 * Se recalcula ENTERO en cada corrida, no solo para los torneos recién
 * insertados: cuando un admin agrega un organizador a `meta_sv_organizers`,
 * todos los torneos suyos que ya estaban guardados tienen que volverse locales
 * solos. Y al revés —si lo saca, dejan de serlo— porque `is_local` significa
 * exactamente «su organizador está en esa tabla» y no puede quedar diciendo
 * otra cosa.
 *
 * ── Por qué las DOS direcciones se calculan en JS ─────────────────────
 *
 * Porque ningún nombre de organizador puede viajar dentro de un filtro de
 * PostgREST. `supabase-js` entrecomilla los valores de `.in()` que contienen
 * `,`, `(` o `)`, pero **no escapa la comilla doble ni la barra invertida**: un
 * organizador que se llame `Nel "Dark" Cantina` corta el valor a la mitad y el
 * filtro pasa a decir otra cosa —no falla, MARCA OTRAS FILAS—. La baja ya se
 * calculaba acá por ese motivo; el alta seguía yendo con `.in('organizer', …)`
 * y tenía el agujero entero. Ahora se lee la tabla, se compara con un `Set` en
 * memoria y a la base solo se le mandan **ids**, que son numéricos y no pueden
 * romper nada (se comprueba con `TORNEO_RE` antes de mandarlos, por si acaso).
 */
async function sincronizarLocales(
  supabase: SupabaseClient,
  anotarError: (donde: string, detalle: string) => void,
): Promise<void> {
  const { data: orgs, error } = await supabase.from('meta_sv_organizers').select('organizer')
  if (error) {
    anotarError('organizadores', error.message)
    return
  }
  const curados = new Set(
    (orgs ?? []).map(o => str(o.organizer)).filter((s): s is string => !!s),
  )

  const aMarcar: string[] = []
  const aDesmarcar: string[] = []

  // Se avanza por la cantidad REALMENTE devuelta, no por `PAGINA_LECTURA`: si
  // el proyecto tiene un `max-rows` más bajo que el pedido, dar por terminada
  // la lectura al recibir menos de lo pedido se saltaría el resto de la tabla
  // en silencio. Es el mismo error que D5 arregla en la paginación de melee.
  //
  // Se pagina por posición (`range`) y no por clave (`gt`) a propósito: `range`
  // solo manda enteros, así que ningún valor de la base entra en un filtro. Lo
  // que se paga es que una inserción concurrente puede correr una fila entre
  // página y página; es inofensivo, porque esto se recalcula ENTERO en cada
  // corrida y la de la próxima hora la agarra.
  let desde = 0
  let completo = false
  for (let vuelta = 0; vuelta < MAX_VUELTAS_LECTURA; vuelta++) {
    const { data, error: eLee } = await supabase
      .from('meta_tournaments')
      .select('melee_tournament_id, organizer, is_local')
      // Orden estable: sin él, dos páginas pueden repetir y saltarse filas.
      .order('melee_tournament_id', { ascending: true })
      .range(desde, desde + PAGINA_LECTURA - 1)
    if (eLee) {
      anotarError('leer torneos', eLee.message)
      return
    }
    const filas = data ?? []
    if (filas.length === 0) {
      completo = true
      break
    }
    for (const f of filas) {
      const id = String(f.melee_tournament_id)
      if (!TORNEO_RE.test(id)) continue
      const local = curados.has(str(f.organizer) ?? '')
      if (local && f.is_local !== true) aMarcar.push(id)
      else if (!local && f.is_local === true) aDesmarcar.push(id)
    }
    desde += filas.length
  }
  if (!completo) {
    anotarError(
      'leer torneos',
      `se cortó la lectura en ${desde} filas (tope de ${MAX_VUELTAS_LECTURA} vueltas): is_local puede haber quedado sin recalcular`,
    )
  }

  const ahora = new Date().toISOString()
  await cambiarLocal(supabase, aMarcar, true, ahora, anotarError)
  await cambiarLocal(supabase, aDesmarcar, false, ahora, anotarError)
}

/** Escribe `is_local` de a lotes, porque los ids viajan en la URL del PATCH. */
async function cambiarLocal(
  supabase: SupabaseClient,
  ids: string[],
  valor: boolean,
  ahora: string,
  anotarError: (donde: string, detalle: string) => void,
): Promise<void> {
  const donde = valor ? 'marcar locales' : 'desmarcar locales'
  for (let i = 0; i < ids.length; i += LOTE_UPDATE) {
    const { error } = await supabase
      .from('meta_tournaments')
      .update({ is_local: valor, updated_at: ahora })
      .in('melee_tournament_id', ids.slice(i, i + LOTE_UPDATE))
    if (error) anotarError(donde, error.message)
  }
}

// ── Proceso de un torneo ─────────────────────────────────────────────

/**
 * Baja la clasificación final de un torneo y la guarda. Devuelve cuántas filas
 * escribió. NO marca la cola: eso lo hace el que llama, y DESPUÉS.
 */
async function procesarTorneo(
  supabase: SupabaseClient,
  torneoId: string,
  vence: number,
): Promise<number> {
  // Viene de nuestra base, pero igual se valida antes de meterlo en una URL:
  // sin esto, un id con `../` sería una travesía de rutas contra melee desde
  // nuestro dominio.
  if (!TORNEO_RE.test(torneoId)) throw new ErrorDeMelee(400, 'id de torneo inválido')

  const html = await vistaDelTorneo(supabase, torneoId)
  const ronda = rondaFinal(html)
  if (!ronda) throw new ErrorDeMelee(502, 'no se encontró la ronda final en la vista del torneo')

  let escritas = 0
  let desde = 0
  let leidas = 0
  /** ¿Se llegó hasta el final de la clasificación, o se cortó a mitad? */
  let completa = false
  /** Por qué se cortó, si se cortó. Cambia el mensaje del error de abajo. */
  let corte: 'paginas' | 'vacia' = 'paginas'

  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    // Corte DURO: mejor abandonar el torneo a medias —el upsert es idempotente
    // y la fila vuelve a `pendiente`— que morir por reloj sin dejar rastro.
    if (Date.now() > vence) throw new ErrorDeTiempo('presupuesto agotado paginando')

    const { filas, total, crudas } = await paginaDeClasificacion(supabase, torneoId, ronda, desde)
    leidas = total

    if (filas.length > 0) {
      const { error } = await supabase
        .from('meta_standings')
        .upsert(filas, { onConflict: 'melee_tournament_id,round_id,rank' })
      // Gotcha 2f: sin mirar `error`, un fallo de RLS o de esquema se vería
      // igual que «este torneo no tenía filas» y marcaríamos `listo` en vano.
      if (error) throw new Error(`no se pudieron guardar las filas: ${error.message}`)
      escritas += filas.length
    }

    // Se avanza por lo que VINO, no por lo que se pidió. Una página corta que
    // no es la última —melee recorta en silencio, está medido— dejaría un hueco
    // de puestos que nadie volvería a mirar: la cola no revisita lo que ya
    // marcó `listo`. Con `crudas` el próximo `start` cae exactamente donde
    // terminó el anterior, aunque el servidor haya devuelto de menos.
    desde += crudas

    // Melee no publica la clasificación de este evento. Ojo con el orden: esto
    // TIENE que mirarse antes que `desde >= total`, porque con total en 0 esa
    // comparación es `0 >= 0` y daría el torneo por completo y vacío.
    if (total === 0 && escritas === 0) {
      throw new SinClasificacion(
        'melee no publica la clasificación de este torneo (recordsTotal: 0)',
      )
    }

    if (desde >= total) {
      completa = true
      break
    }
    // Página vacía sin haber llegado al total declarado: no hay con qué seguir
    // paginando y lo que hay está incompleto. Sale del bucle SIN marcar
    // `completa`, que es lo que hace que abajo esto se trate como error.
    if (crudas === 0) {
      corte = 'vacia'
      break
    }
  }

  // Truncar es un ERROR, no un éxito. Antes se salía por la condición del `for`
  // y el torneo quedaba marcado como ingerido con 4.000 de 4.500 puestos: un
  // dato mutilado, indistinguible de uno completo, que nadie iba a volver a
  // mirar nunca. Lanzar deja la fila en la cola con `last_error`, y si el caso
  // es real y no un fallo pasajero, tras cinco intentos aparece en `fallido`
  // con el motivo escrito. Un error visible que se puede arreglar (subir
  // `MAX_PAGINAS`) es mejor que un silencio que no.
  //
  // Las filas ya escritas se quedan, y está bien: `final_round_id` NO se
  // escribe abajo, así que para el cliente ese torneo sigue sin clasificación
  // final. Cuando se reintente, el upsert las pisa por clave natural.
  if (!completa) {
    throw new Error(
      corte === 'vacia'
        ? `melee cortó la clasificación: devolvió una página vacía en el puesto ${desde} de ${leidas}`
        : `la clasificación no cabe en ${MAX_PAGINAS} páginas: ${desde} de ${leidas} puestos`,
    )
  }

  // Recién ahora el torneo tiene clasificación. `final_round_id` es lo que
  // convierte a esas filas en «las finales»: sin él, quien consulte no puede
  // distinguirlas de una ronda intermedia que se hubiera bajado antes.
  const { error } = await supabase
    .from('meta_tournaments')
    .update({
      final_round_id: ronda,
      standings_fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('melee_tournament_id', torneoId)
  if (error) throw new Error(`no se pudo cerrar el torneo: ${error.message}`)

  return escritas
}

// ── Handler ──────────────────────────────────────────────────────────

/** Fila de `meta_ingest_queue` tal como la devuelve `meta_reclamar_lote`. */
interface FilaCola {
  melee_tournament_id: string
  intentos: number
  last_error: string | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const t0 = Date.now()
  const transcurrido = () => Date.now() - t0

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Solo GET' })
  }
  // Esto escribe en la base: no lo guarda nadie, ni el navegador ni la CDN.
  res.setHeader('Cache-Control', 'no-store')

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return res.status(503).json({ error: 'Supabase service role no configurado' })
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── Puerta ──
  const cabecera = req.headers.authorization || ''
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : null
  if (!token) return res.status(401).json({ error: 'No autorizado' })

  // Unión discriminada en vez de dos variables sueltas: así el compilador
  // garantiza que no hay «modo usuario sin usuario» ni al revés.
  let sesion: { modo: 'cron' } | { modo: 'usuario'; usuarioId: string }

  if (CRON_SECRET && igualSeguro(token, CRON_SECRET)) {
    sesion = { modo: 'cron' }
  } else {
    // Sin CRON_SECRET definida la puerta del cron simplemente no existe —no se
    // compara contra `undefined`, se cae acá— y esta otra tiene su propia
    // autenticación real, así que la falta de la variable no abre nada.
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) return res.status(401).json({ error: 'No autorizado' })
    sesion = { modo: 'usuario', usuarioId: data.user.id }
  }

  const errores: { donde: string; detalle: string }[] = []
  let erroresTotales = 0
  const anotarError = (donde: string, detalle: string) => {
    erroresTotales++
    if (errores.length < MAX_ERRORES) errores.push({ donde, detalle: detalle.slice(0, 300) })
  }

  // ══ Modo usuario: descubrir SU perfil, encolar y devolver ══
  //
  // No se reclama lote, no se pagina ninguna clasificación, no se toca la cola
  // más que para insertar. Ver el encabezado: cuando lo hacía, gastaba los
  // intentos de torneos sanos, se los escondía al cron y costaba una tanda de
  // descargas por apretón. Bajar clasificaciones es trabajo del cron, que tiene
  // presupuesto para terminarlas.
  if (sesion.modo === 'usuario') {
    if (!tomarToken(sesion.usuarioId)) {
      res.setHeader('Retry-After', '300')
      return res.status(429).json({
        error: 'Ya pediste una actualización hace poco. Probá en unos minutos.',
      })
    }

    // Todo el presupuesto para descubrir: es lo único que se hace acá.
    const hallazgo = await descubrir(
      supabase,
      sesion.usuarioId,
      t0 + PRESUPUESTO_USUARIO_MS,
      anotarError,
    )
    // Sí se sincroniza `is_local`: no cuesta ni una descarga contra melee —es
    // nuestra propia base— y sin esto los torneos recién descubiertos no
    // aparecerían en «Acá» hasta la próxima corrida del cron.
    await sincronizarLocales(supabase, anotarError)

    return res.status(200).json({
      modo: sesion.modo,
      mensaje: mensajeDeUsuario(hallazgo),
      descubiertos: hallazgo.descubiertos,
      encolados: hallazgo.encolados,
      perfilesLeidos: hallazgo.perfiles,
      // El modo usuario nunca procesa: van en cero para que la forma de la
      // respuesta sea la misma en los dos modos y el cliente no ramifique.
      procesados: 0,
      filas: 0,
      cortadoPorTiempo: false,
      pendientesDelLote: 0,
      errores,
      erroresTotales,
      ms: transcurrido(),
    })
  }

  // ══ Modo cron: descubrir Y vaciar la cola ══
  const presupuesto = PRESUPUESTO_MS
  const lote = LOTE_MAX
  const vence = t0 + presupuesto

  let cortadoPorTiempo = false
  let procesados = 0
  let filas = 0
  /** Torneos cuya clasificación melee no publica. Se cuentan aparte de los
   *  procesados: sumarlos ahí diría «6 de 6» sobre un torneo del que no se
   *  guardó nada, que es justo el silencio que esto viene a romper. */
  let descartados = 0

  // ── 1. Descubrir ──
  const hallazgo = await descubrir(
    supabase,
    null,
    t0 + presupuesto * FRACCION_DESCUBRIMIENTO,
    anotarError,
  )
  await sincronizarLocales(supabase, anotarError)

  // ── 2. Vaciar la cola ──
  const { data: reclamados, error: eLote } = await supabase.rpc('meta_reclamar_lote', {
    cuantos: lote,
  })
  if (eLote) anotarError('reclamar lote', eLote.message)

  const cola = (Array.isArray(reclamados) ? reclamados : []) as FilaCola[]

  /**
   * Una vez que se corta NO se sale del bucle con `break`: las filas que ya
   * reclamamos quedarían en `en_curso` esperando a que alguien las venza. Se
   * sigue recorriendo para devolverlas todas a `pendiente`, que cuesta un
   * UPDATE cada una y cero peticiones a melee.
   */
  let cortar = false

  for (const fila of cola) {
    const id = String(fila.melee_tournament_id)

    // No empezar lo que no se puede terminar. Lo que no se empieza vuelve a la
    // cola con su intento devuelto, que es exactamente donde tiene que quedar:
    // reclamarlo ya le sumó uno y no se le pegó a melee ni una vez.
    if (cortar || transcurrido() > presupuesto - PEOR_CASO_MS) {
      cortadoPorTiempo = true
      await devolverALaCola(supabase, fila, null, anotarError)
      continue
    }

    try {
      const escritas = await procesarTorneo(supabase, id, vence)
      filas += escritas
      procesados++

      // PRIMERO los datos (arriba), DESPUÉS la marca. Nunca al revés.
      const { error } = await supabase
        .from('meta_ingest_queue')
        .update({ status: 'listo', last_error: null, updated_at: new Date().toISOString() })
        .eq('melee_tournament_id', id)
      if (error) anotarError(`cerrar ${id}`, error.message)
    } catch (e) {
      const err = e as Error
      if (err instanceof ErrorDeTiempo) {
        // No es culpa del torneo: se devuelve intacto y se le DEVUELVE el
        // intento que costó reclamarlo (ver `devolverALaCola`). No se empieza
        // ninguno más.
        cortadoPorTiempo = true
        cortar = true
        await devolverALaCola(supabase, fila, null, anotarError)
        continue
      }
      if (err instanceof SinClasificacion) {
        // No se reintenta: melee no la publica y volver a preguntar cinco veces
        // da siempre el mismo cero. Queda en `descartado` con el motivo a la
        // vista, que es la diferencia entre «no hay dato» y «no lo buscamos».
        descartados++
        const { error } = await supabase
          .from('meta_ingest_queue')
          .update({
            status: 'descartado',
            last_error: err.message,
            updated_at: new Date().toISOString(),
          })
          .eq('melee_tournament_id', id)
        if (error) anotarError(`descartar ${id}`, error.message)
        continue
      }
      anotarError(`torneo ${id}`, err.message)
      await devolverALaCola(supabase, fila, err.message, anotarError)
    }
  }

  return res.status(200).json({
    modo: sesion.modo,
    mensaje:
      `Se procesaron ${procesados} de ${cola.length} torneos de la cola (${filas} puestos guardados).`
      + (descartados > 0
        ? ` ${descartados} sin clasificación publicada por melee.`
        : ''),
    /** Torneos de SWU vistos en los perfiles de esta corrida (nuevos o no). */
    descubiertos: hallazgo.descubiertos,
    /** De esos, los que entraron a la cola por primera vez. */
    encolados: hallazgo.encolados,
    perfilesLeidos: hallazgo.perfiles,
    procesados,
    filas,
    /** Torneos que melee reconoce pero cuya clasificación no publica. */
    descartados,
    cortadoPorTiempo,
    pendientesDelLote: Math.max(0, cola.length - procesados - descartados),
    errores,
    erroresTotales,
    ms: transcurrido(),
  })
}

/**
 * Qué decirle a la persona que apretó el botón.
 *
 * Encolar no es tener el dato: lo que se descubre lo baja el cron después. El
 * mensaje lo dice así en vez de prometer que el meta ya cambió, porque no
 * cambió — y una promesa que no se cumple en la siguiente pantalla es peor que
 * un «va en camino».
 */
function mensajeDeUsuario(h: ResumenDescubrimiento): string {
  if (h.candidatos === 0) {
    return 'No hay ningún usuario de melee enlazado en tu perfil, así que no había dónde buscar.'
  }
  if (h.perfiles === 0) {
    return 'No se pudo leer tu perfil de melee en este momento. Probá de nuevo en un rato.'
  }
  if (h.descubiertos === 0) {
    return 'No se encontraron torneos de Star Wars: Unlimited en tu perfil de melee.'
  }
  if (h.encolados === 0) {
    return `Se revisaron ${h.descubiertos} torneos tuyos: ya estaban todos registrados.`
  }
  return `Se encontraron ${h.encolados} torneos nuevos (de ${h.descubiertos} revisados). Sus clasificaciones se bajan en la próxima corrida.`
}

/**
 * Devuelve una fila reclamada a la cola.
 *
 * Se hace explícito en vez de confiar en que alguien recoja las `en_curso`
 * abandonadas: un torneo que se quedó a mitad tiene que poder reintentarse en
 * la corrida siguiente sin esperar ninguna regla de vencimiento. (Si la lambda
 * muere de golpe la fila SÍ queda en `en_curso`; ESE caso lo recupera la regla
 * de vencimiento de `meta_reclamar_lote`.)
 *
 * ── Quién cuenta los intentos, y quién los DEVUELVE ───────────────────
 *
 * `intentos` lo incrementa `meta_reclamar_lote` AL RECLAMAR, que es lo correcto:
 * así una lambda que muere sin llegar hasta acá igual deja el intento contado y
 * un torneo imposible no se reclama para siempre.
 *
 * Pero eso significa que reclamar y NO usar la fila también cuenta. `fallo ===
 * null` es exactamente ese caso —se cortó por reloj sin haberle pegado a
 * melee—, así que hay que **restar** el incremento. Sin esto, unas cuantas
 * corridas que se corten temprano empujan a `fallido` a torneos sanos a los que
 * nunca se intentó bajar; y el comentario que estaba acá decía «sin gastarle un
 * intento» mientras el código lo conservaba.
 *
 * Con un fallo real NO se suma nada: el reclamo ya lo contó. Sumar acá era
 * contar doble y rendirse a la mitad de los intentos que dice el número.
 *
 * ── Una sola política de reintentos ───────────────────────────────────
 *
 * El corte vive en UN solo lugar: el barrido de `meta_reclamar_lote`
 * (`intentos >= 5` → `fallido`). Acá no se decide nada de eso: el status vuelve
 * siempre a `pendiente`. Dos políticas escritas en dos idiomas se desincronizan
 * sin que nadie se entere —el TS decía 6, el SQL 5— y entonces ninguna de las
 * dos es LA política.
 */
async function devolverALaCola(
  supabase: SupabaseClient,
  fila: FilaCola,
  fallo: string | null,
  anotarError: (donde: string, detalle: string) => void,
): Promise<void> {
  const { error } = await supabase
    .from('meta_ingest_queue')
    .update({
      status: 'pendiente',
      intentos: fallo === null ? Math.max(0, fila.intentos - 1) : fila.intentos,
      claimed_at: null,
      last_error: fallo === null ? fila.last_error : fallo.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('melee_tournament_id', fila.melee_tournament_id)
  if (error) anotarError(`devolver ${fila.melee_tournament_id}`, error.message)
}

/**
 * Galaxia — capa de datos de la escena 3D.
 *
 * Devuelve un planeta por jugador con lo mínimo que la escena necesita para
 * colocarlo (órbita), dibujarlo (nivel, xp, victorias) y hacerle un emergente
 * (último movimiento).
 *
 * NO reemplaza a `galaxyService.ts` — lo usa. `getGalaxyPlayers()` ya resuelve
 * el join `profiles` + `player_stats` con el gotcha de `single<T>` (los joins
 * 1:N de Supabase vuelven ARRAY) y ya sanea los nombres. Acá solo se le suma
 * el "último movimiento", que es lo que ese servicio no trae.
 *
 * ── Qué hay DE VERDAD detrás del emergente (medido 2026-08-07, 19 cuentas) ──
 *
 *   community_posts   65 filas /  7 jugadores  · tipos: trade 41, achievement 18, level_up 6
 *   decks             24 filas / 11 jugadores  · 22 son públicos → 10 jugadores visibles con RLS
 *   achievement_dates 18 de 19 jugadores       · viene GRATIS, ya está en player_stats
 *
 * Con esas tres fuentes, 18 de los 19 planetas tienen movimiento real y 1
 * (Allister, nivel 1, sin mazo ni logro ni post) se queda en `null`. Ese null
 * es honesto: NO se rellena con «se unió a la comunidad» aunque
 * `profiles.created_at` exista, porque unirse no es un movimiento.
 *
 * ── Fuentes que se DESCARTARON y por qué ──
 *
 *   collection.for_sale (37 filas, 1 jugador) — redundante: cada publicación
 *     dispara un `community_posts` type='trade', y son del mismo jugador
 *     (Nelson: 37 cartas en venta ↔ 41 posts trade). Consultarla no agrega un
 *     solo planeta.
 *   meta_standings (3.565 filas) cruzado con `profiles.melee_username` — solo
 *     2 de 19 perfiles tienen melee enlazado, y para los DOS el mazo más
 *     reciente (2026-08-07) le gana por fecha al torneo (2026-07-25): hoy no
 *     se vería en ningún planeta. Además, cruzarlo bien exige la ronda final
 *     (`meta_tournaments.final_round_id`) y la normalización de nombres que ya
 *     viven en `metaNacionalService.ts`; la única puerta exportada de ahí es
 *     `getMetaNacional()`, que carga las 9.057 cartas de Dexie para parsear
 *     arquetipos. Eso no entra en una pantalla 3D de teléfono.
 *   blog_posts (5 filas, 1 autor) y tournament_results (1 fila) — muy poco
 *     para pagar una consulta.
 *
 * ── Campos MUERTOS que la escena no debe usar ──
 *
 *   `victorias` y `derrotas` son 0 en los 19 jugadores (la tabla `matches`
 *   tiene 0 filas). Se exponen igual porque son parte del contrato, pero
 *   **el tamaño y el color del planeta tienen que salir de `nivel`/`xp`**, que
 *   sí están vivos (niveles 1–8, xp 0–3.180). Si se dimensiona por victorias,
 *   los 19 planetas salen del mismo tamaño.
 */

import { supabase, isSupabaseReady } from './supabase'
import { getCountryByCode } from '../data/regions'
import { getGalaxyPlayersOFalla } from './galaxyService'
import { RANKS, ACHIEVEMENTS } from './gamification'

// ─── Contrato ────────────────────────────────────────────

export interface PlanetaJugador {
  id: string
  nombre: string
  /**
   * El nombre que el dueño le puso a su mundo. Cadena vacía = sin bautizar,
   * y quien lo pinte decide el genérico (no se inventa acá: la escena y el
   * emergente lo muestran distinto).
   */
  nombrePlaneta: string
  /** Lo que su dueño eligió para el mundo. Se lo pasa tal cual a `rasgosDe`. */
  ajustesPlaneta: {
    familia: string | null
    mares: number | null
    crateres: number | null
    /* Anillos, lunas y terraformación viajan con el resto. Faltaban, y el
       efecto era que el mundo que alguien arma en /terraformar se veía
       terraformado SOLO ahí: en la Galaxia y en su perfil salía pelado. */
    anillos: number | null
    lunas: number | null
    ciudades: number
    nubes: number
    auroras: number
    acento: string | null
  }
  avatar: string
  nivel: number
  xp: number
  rango: string
  /**
   * CAMPO MUERTO: 0 en las 19 cuentas (la tabla `matches` está vacía). Viaja
   * porque es parte del contrato, pero **el tamaño y el color del planeta NO
   * pueden salir de acá** — ver la cabecera del archivo. Con victorias, los 19
   * planetas salen del mismo tamaño. La escena usa `nivel`, que es lo correcto.
   */
  victorias: number
  /** Campo muerto, igual que `victorias`. */
  derrotas: number
  /** El último movimiento REAL, o null si no hay ninguno. */
  ultimoMovimiento: { texto: string; cuando: string; tipo: string } | null
  /** Para el orden orbital: estable entre cargas. */
  orbita: number
  esYo: boolean
  /**
   * Las magnitudes con VARIANZA real en la base (contado el 2026-08-08 sobre
   * las 20 cuentas): cartas 7 valores distintos, mazos 5, logros 1-9 en todas,
   * reputación 5. Torneos, racha y duelos están en CERO para todo el mundo y
   * por eso NO viajan: una lente sobre un campo muerto son 20 planetas
   * idénticos — mentira con forma de vista.
   */
  cartas: number
  mazos: number
  logros: number
  reputacion: number
  /** Título activo elegido por el jugador, o cadena vacía. */
  titulo: string
  /**
   * Tamaño del planeta en la vista ACTUAL, 0..1. Lo calcula la pantalla según
   * la lente elegida; el servicio lo inicializa con el nivel (la vista por
   * defecto). La escena dibuja `0.42 + 0.52·magnitud` y no sabe de lentes.
   */
  magnitud: number
}

/**
 * Un sistema solar: un pais con su sol y sus planetas.
 *
 * El `orbita` de sus planetas es el puesto DENTRO de este sistema, no global.
 * Eso no es un detalle: hoy los 28 perfiles caian en un solo sol y el anillo
 * mas externo era k=5; partido por pais, El Salvador baja a k=4 y sus planetas
 * CRECEN un 15% (medido: 10,2 -> 11,8 px de diametro a 375 px). Repartir la
 * galaxia no encoge a los salvadorenos, los agranda.
 */
export interface SistemaSolar {
  /** Codigo ISO, o `null` para quien no eligio pais. */
  pais: string | null
  /** Como se llama en pantalla: «El Salvador», «Mexico», «Sin registrar». */
  nombre: string
  bandera: string
  planetas: PlanetaJugador[]
}

export interface Galaxia {
  /** El sistema de quien mira, o el mas poblado. Es donde arranca la camara. */
  sistema: string
  /** Todos los sistemas, el mas poblado primero. */
  sistemas: SistemaSolar[]
  /** Todos los planetas de todos los sistemas. Se conserva para quien solo
   *  necesita buscar una persona sin importarle donde vive (PlanetaPage). */
  planetas: PlanetaJugador[]
  totalJugadores: number
}

/**
 * Vocabulario cerrado de `ultimoMovimiento.tipo`. La escena puede mapear cada
 * uno a un color de emergente sin adivinar.
 */
export type TipoMovimiento = 'venta' | 'logro' | 'nivel' | 'mazo' | 'mensaje'

// ─── Constantes ──────────────────────────────────────────

/**
 * El nombre del sistema es una ETIQUETA, no un filtro. `profiles.settings.country`
 * está vacío en 14 de 19 cuentas (4 'SV', 1 'ES'), así que filtrar por país
 * dejaría fuera a 3 de cada 4 jugadores. La comunidad entera es un sistema.
 */
const SISTEMA = 'El Salvador'

/** Clave del sistema de quien no eligio pais. No es un codigo ISO a proposito. */
const SIN_PAIS = '·'

/**
 * Tope de filas por fuente de movimiento. Se piden ordenadas por fecha
 * descendente y después se agrupa por jugador quedándose con la primera.
 * Con 19 cuentas (65 posts, 24 mazos) sobra de largo. Si la comunidad crece,
 * un jugador cuyo único movimiento quedó más atrás que la fila 300 pierde ESA
 * fuente, pero conserva las otras dos (los logros vienen completos siempre,
 * son una fila por jugador).
 */
const TOPE_MOVIMIENTOS = 300

/**
 * Tope de jugadores, compartido por la lista de planetas y por la consulta de
 * logros. Las dos tienen que pedir lo MISMO: si una trae 200 y la otra 1.000
 * (el corte silencioso de PostgREST), el emergente y el planeta dejan de
 * hablar de la misma gente.
 */
const TOPE_JUGADORES = 200

/**
 * El texto del emergente flota sobre el planeta: si un post manual trae 500
 * caracteres, tapa media escena. Se corta acá y no en la vista porque el corte
 * es una decisión de datos (qué cabe en una etiqueta), no de estilo.
 */
const LARGO_TEXTO = 120

// ─── Helpers ─────────────────────────────────────────────

function rangoDeNivel(nivel: number): string {
  const r = RANKS.find(x => nivel >= x.minLevel && nivel <= x.maxLevel) ?? RANKS[0]
  return r.name
}

function recortar(texto: string): string {
  const limpio = texto.trim().replace(/\s+/g, ' ')
  if (limpio.length <= LARGO_TEXTO) return limpio
  return `${limpio.slice(0, LARGO_TEXTO - 1)}…`
}

interface Movimiento {
  texto: string
  cuando: string
  tipo: TipoMovimiento
  /** Milisegundos epoch. Solo para comparar; no sale en el contrato. */
  ms: number
  /**
   * Desempate cuando dos fuentes traen el MISMO instante. Pasa de verdad: un
   * logro escribe `achievement_dates` y dispara un `community_posts` en el
   * mismo tick. Gana el número más bajo = el texto más rico.
   */
  prioridad: number
}

/** Gana el más reciente; a igual instante, la fuente de menor prioridad. */
function masReciente(a: Movimiento | null, b: Movimiento | null): Movimiento | null {
  if (!a) return b
  if (!b) return a
  if (b.ms > a.ms) return b
  if (b.ms === a.ms && b.prioridad < a.prioridad) return b
  return a
}

function anotar(mapa: Map<string, Movimiento>, userId: string, mov: Movimiento | null): void {
  if (!mov || !Number.isFinite(mov.ms) || mov.ms <= 0) return
  const mejor = masReciente(mapa.get(userId) ?? null, mov)
  if (mejor) mapa.set(userId, mejor)
}

/** `community_posts.type` → nuestro vocabulario. */
function tipoDePost(tipo: string | null): TipoMovimiento {
  switch (tipo) {
    case 'trade': return 'venta'
    case 'achievement': return 'logro'
    case 'level_up': return 'nivel'
    default: return 'mensaje'
  }
}

// ─── Fuentes de movimiento ───────────────────────────────

/**
 * Posts de la comunidad. Son la mejor fuente: el texto ya viene redactado
 * («puso Grogu en venta por $1.00», «alcanzó el rango Estratega de Escuadrón»)
 * porque los produce `communityService` al pasar cada cosa.
 */
async function movimientosDePosts(mapa: Map<string, Movimiento>): Promise<void> {
  const { data, error } = await supabase
    .from('community_posts')
    .select('user_id, type, content, created_at')
    .order('created_at', { ascending: false })
    .limit(TOPE_MOVIMIENTOS)

  if (error || !data) {
    console.warn('[Galaxia] posts:', error)
    return
  }

  for (const fila of data) {
    const r = fila as Record<string, unknown>
    const userId = r.user_id as string | null
    const contenido = (r.content as string | null) ?? ''
    const creado = r.created_at as string | null
    if (!userId || !contenido || !creado) continue

    anotar(mapa, userId, {
      texto: recortar(contenido),
      cuando: creado,
      tipo: tipoDePost(r.type as string | null),
      ms: Date.parse(creado),
      prioridad: 1,
    })
  }
}

/**
 * Mazos creados.
 *
 * OJO con RLS: la política de `decks` es `auth.uid() = user_id OR
 * data->>'isPublic' = true`. Desde el cliente NO se ven los mazos privados de
 * los demás. Medido: 22 de 24 mazos son públicos → 10 de los 11 jugadores con
 * mazo siguen apareciendo. No se intenta esquivar la política: un mazo privado
 * es privado también en la galaxia.
 */
async function movimientosDeMazos(mapa: Map<string, Movimiento>): Promise<void> {
  const { data, error } = await supabase
    .from('decks')
    .select('user_id, name, created_at')
    .order('created_at', { ascending: false })
    .limit(TOPE_MOVIMIENTOS)

  if (error || !data) {
    console.warn('[Galaxia] mazos:', error)
    return
  }

  for (const fila of data) {
    const r = fila as Record<string, unknown>
    const userId = r.user_id as string | null
    const nombre = (r.name as string | null) ?? ''
    const creado = r.created_at as string | null
    if (!userId || !nombre || !creado) continue

    anotar(mapa, userId, {
      texto: recortar(`armó el mazo «${nombre}»`),
      cuando: creado,
      tipo: 'mazo',
      ms: Date.parse(creado),
      prioridad: 2,
    })
  }
}

/**
 * Logros, desde `player_stats.achievement_dates` (jsonb `{ id: epoch_ms }`).
 *
 * Es la fuente de mayor cobertura (18 de 19) y la más barata: la fila ya
 * existe por jugador, no hay join ni orden. De paso esta misma consulta trae
 * el conteo exacto para `totalJugadores`.
 *
 * Un id que no esté en el catálogo `ACHIEVEMENTS` se ignora en vez de mostrar
 * el id crudo: si el catálogo cambió, es preferible caer al logro anterior
 * que poner «desbloqueó her_9» en pantalla. Hoy no descarta nada: los 10 ids
 * distintos que hay en la base (cun_1/2, her_1..5, trn_1, vil_1/2) resuelven
 * contra las 70 entradas del catálogo.
 */
async function movimientosDeLogros(mapa: Map<string, Movimiento>): Promise<number | null> {
  const { data, error, count } = await supabase
    .from('player_stats')
    .select('user_id, achievement_dates', { count: 'exact' })
    // Sin tope explícito, PostgREST corta `data` en su max-rows (1.000 por
    // defecto) mientras `count` sigue siendo exacto: pasadas las 1.000 cuentas
    // los logros de las demás desaparecían del emergente sin que se notara,
    // porque el total seguía diciendo la verdad. Ahora el tope es nuestro y
    // está escrito, como en las otras dos fuentes.
    .limit(TOPE_JUGADORES)

  if (error || !data) {
    console.warn('[Galaxia] logros:', error)
    // `null`, no `0`: un fallo no es «no hay nadie». Ver `getGalaxia`.
    return null
  }

  for (const fila of data) {
    const r = fila as Record<string, unknown>
    const userId = r.user_id as string | null
    const fechas = r.achievement_dates as Record<string, unknown> | null
    if (!userId || !fechas) continue

    let mejor: Movimiento | null = null
    for (const [id, valor] of Object.entries(fechas)) {
      const ms = typeof valor === 'number' ? valor : Number(valor)
      if (!Number.isFinite(ms) || ms <= 0) continue
      const logro = ACHIEVEMENTS.find(a => a.id === id)
      if (!logro) continue

      mejor = masReciente(mejor, {
        texto: recortar(`desbloqueó «${logro.name}»`),
        cuando: new Date(ms).toISOString(),
        tipo: 'logro',
        ms,
        prioridad: 3,
      })
    }

    anotar(mapa, userId, mejor)
  }

  return count ?? data.length
}

// ─── Consulta principal ──────────────────────────────────

/**
 * Arma la galaxia completa.
 *
 * Un solo viaje de red: las cuatro consultas salen en paralelo porque ninguna
 * depende de otra. Con 19 cuentas el payload total son ~19 filas de perfil,
 * ~19 de logros, 65 posts y 24 mazos.
 *
 * ── Regla de la órbita ──
 * Se ordena por **nivel descendente** (más nivel = más cerca del sol) y se
 * desempata por **id ascendente**. `orbita` es el índice 0-based en ese orden,
 * y `planetas` viene ordenado igual, así que `planetas[i].orbita === i`.
 *
 * El desempate por id es lo que la hace estable: los 12 jugadores de nivel 1
 * caen todos en el mismo grupo y sin él el orden lo decidiría el capricho de
 * PostgREST, con planetas saltando de anillo entre recargas. Con id, un
 * jugador solo cambia de órbita cuando sube de nivel (o cuando alguien lo
 * sobrepasa), nunca por refrescar.
 *
 * Se usa el nivel GUARDADO en `player_stats.level`, no el derivado del xp, para
 * que el planeta y la tarjeta de perfil digan el mismo número. Medido: 18 de 19
 * coinciden; ElDaigo tiene level=1 con 537 xp (le tocarían 3). Es una fila
 * desactualizada en la base, no algo que la galaxia deba maquillar.
 */
export async function getGalaxia(miId?: string): Promise<Galaxia> {
  if (!isSupabaseReady()) {
    return { sistema: SISTEMA, sistemas: [], planetas: [], totalJugadores: 0 }
  }

  const movimientos = new Map<string, Movimiento>()

  // `getGalaxyPlayersOFalla` LANZA si su consulta falla, y ese rechazo sube
  // hasta el `.catch` de la pantalla. Las tres fuentes de movimiento sí pueden
  // fallar en silencio —un planeta sin emergente sigue siendo un planeta—;
  // la lista de jugadores no: si esa se cae, la galaxia entera mentiría.
  const [jugadores, , , total] = await Promise.all([
    getGalaxyPlayersOFalla(TOPE_JUGADORES),
    movimientosDePosts(movimientos),
    movimientosDeMazos(movimientos),
    movimientosDeLogros(movimientos),
  ])

  // Se agrupa por PAIS antes de numerar: la orbita es el puesto dentro del
  // sistema, no en toda la galaxia. Quien no eligio pais va a un sistema
  // aparte —«Sin registrar»— y NO se le inventa uno: meterlo en El Salvador
  // seria afirmar de donde es alguien que no lo dijo.
  const porPais = new Map<string, typeof jugadores>()
  for (const j of jugadores) {
    const clave = (j.country || '').trim().toUpperCase() || SIN_PAIS
    const l = porPais.get(clave)
    if (l) l.push(j)
    else porPais.set(clave, [j])
  }

  const planetas: PlanetaJugador[] = jugadores
    .slice()
    .sort((a, b) => (b.level - a.level) || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0))
    .map((j, i) => {
      const mov = movimientos.get(j.userId) ?? null
      return {
        id: j.userId,
        nombre: j.name,
        nombrePlaneta: (j.planetName ?? '').trim(),
        ajustesPlaneta: {
          familia: j.planetFamily, mares: j.planetSeas,
          crateres: j.planetCraters,
          anillos: j.planetRings, lunas: j.planetMoons,
          ciudades: j.planetCities, nubes: j.planetClouds, auroras: j.planetAuroras,
          acento: j.accent,
        },
        avatar: j.avatar,
        nivel: j.level,
        xp: j.xp,
        rango: rangoDeNivel(j.level),
        victorias: j.wins,
        derrotas: j.losses,
        ultimoMovimiento: mov
          ? { texto: mov.texto, cuando: mov.cuando, tipo: mov.tipo }
          : null,
        orbita: i,
        esYo: !!miId && j.userId === miId,
        cartas: j.cardsCollected,
        mazos: j.decksCreated,
        logros: j.unlockedAchievements.length,
        reputacion: j.socialReputation,
        titulo: j.activeTitle,
        // La misma compresión log que usaba la escena: nivel 1-26 → 0..1 sin
        // que un nivel 40 futuro se coma la pantalla.
        magnitud: Math.min(1, Math.log2(1 + Math.max(1, j.level)) / Math.log2(27)),
      }
    })

  // Los sistemas, el mas poblado primero. Se re-numera la orbita DENTRO de
  // cada uno con el mismo criterio de siempre: nivel DESC y desempate por id
  // ascendente, que es lo que hace que un planeta solo cambie de anillo al
  // subir de nivel y nunca por refrescar.
  const porId = new Map(planetas.map(p => [p.id, p]))
  const sistemas: SistemaSolar[] = [...porPais.entries()]
    .map(([clave, gente]) => {
      const pais = clave === SIN_PAIS ? null : clave
      const c = pais ? getCountryByCode(pais) : undefined
      return {
        pais,
        nombre: c?.name ?? (pais ?? 'Sin registrar'),
        bandera: c?.flag ?? '🛰',
        planetas: gente
          .slice()
          .sort((a, b) => (b.level - a.level) || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0))
          .map((j, i) => {
            const base = porId.get(j.userId)!
            // La orbita se re-escribe: la global ya no significa nada.
            return { ...base, orbita: i }
          }),
      }
    })
    // Mas poblado primero; desempate por codigo para que el orden no dependa
    // del capricho del Map. El «sin registrar» SIEMPRE al final: no compite
    // con un pais.
    .sort((a, b) =>
      (b.planetas.length - a.planetas.length) ||
      (a.pais === null ? 1 : b.pais === null ? -1 : a.pais.localeCompare(b.pais)))

  // El sistema de quien mira, o el mas poblado. Es donde arranca la camara.
  const mio = miId ? sistemas.find(s => s.planetas.some(p => p.id === miId)) : undefined

  return {
    sistema: mio?.nombre ?? sistemas[0]?.nombre ?? SISTEMA,
    sistemas,
    planetas,
    // El conteo sale de `player_stats`, no de `planetas.length`: si algún día
    // la comunidad pasa el tope de `getGalaxyPlayers`, el número tiene que
    // seguir diciendo la verdad aunque la escena dibuje menos planetas.
    //
    // Era `total || planetas.length`, y con `total` en 0 por un fallo eso daba
    // `0 || 0` = **0**: la cabecera decía «0 planetas» sobre una consulta que
    // ni siquiera se pudo hacer. Ahora el fallo llega como `null` y el conteo
    // cae a lo que SÍ se pudo leer, que son los planetas que se van a dibujar.
    totalJugadores: total ?? planetas.length,
  }
}

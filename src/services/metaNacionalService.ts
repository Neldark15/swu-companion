/**
 * metaNacionalService — el meta de ACÁ, armado con los standings de melee.
 *
 * Lo que `metaStatsService` trae es el meta del MUNDO. Esto es otra cosa: qué
 * se juega y qué gana en El Salvador. Las dos fuentes conviven y no se mezclan.
 *
 * ── Dos ámbitos, los dos honestos ─────────────────────────────────────
 *
 * 1. **«Acá»** (`aca`) — solo torneos con `is_local = true`, o sea los que
 *    organiza alguien de la lista curada `meta_sv_organizers`. De esos cuenta
 *    la sala ENTERA, porque ese torneo *es* el meta local.
 * 2. **«Los nuestros»** (`nuestros`) — las filas cuyo `player_name` coincide
 *    con un `profiles.melee_username` enlazado, en CUALQUIER torneo del mundo.
 *    **Solo esas filas**, nunca el torneo completo.
 *
 * La tentación de juntarlos es exactamente el error a evitar: dos salvadoreños
 * metidos en un Galactic Open de 1022 personas no convierten a esos 1022 en el
 * meta nacional. Serían 1020 mazos de gente que no juega acá contados como si
 * lo hicieran.
 *
 * ── El arquetipo se resuelve ACÁ, en el cliente ────────────────────────
 *
 * El servidor guarda el `DecklistName` **crudo** en `meta_standings.decklist_name`,
 * tal cual lo mandó melee, y nada más. El nombre se traduce a cartas con
 * `meleeArchetype.ts` contra la base de cartas de Dexie. Dos razones:
 * - La base de cartas ya está en el dispositivo; no hay que duplicarla en
 *   Postgres ni mantener dos copias que se desincronicen.
 * - Cuando el parser mejora, TODO el histórico se reinterpreta solo, sin
 *   re-ingestar un byte de melee.
 *
 * Por eso `meta_standings` **no tiene** columnas de líder/base/confianza: se
 * escribían siempre en null y nadie las leía nunca. Un esquema con columnas que
 * mienten es peor que uno más chico.
 *
 * ── Lo que no se pudo parsear SE MUESTRA, y separado ──────────────────
 *
 * Muchísimas filas vienen sin mazo publicado (medido: en un torneo local de 8,
 * los 8). Otras traen la lista renombrada a mano. **No son el mismo hecho** y
 * por eso van en dos contadores:
 * - `sinLista` — no hay `decklist_name`. No dice nada del parser.
 * - `noParseado` — hay nombre y el parser no lo resolvió. ESTE es el que
 *   delata un parser roto, y por eso se mira solo.
 *
 * Y antes de creerle a cualquiera de los dos hay que mirar `baseIncompleta`:
 * sin la base de cartas entera el parser no resuelve NADA y el módulo diría
 * «nadie publica mazo» cuando el problema es local (gotcha 2c).
 *
 * ── Un agregado a medias se declara a medias ──────────────────────────
 *
 * supabase-js no lanza ante un error de PostgREST (gotcha 2f). Devolver lo que
 * se alcanzó a leer como si fuera todo convierte un 404 de permisos en «todavía
 * no hay torneos». Acá: si falla la PRIMERA consulta se **lanza** (`ErrorMeta`)
 * para que la vista muestre su estado de error; si falla a mitad, se devuelve
 * lo que hay con `parcial: true` y sin quórum —o sea, sin porcentajes—.
 */

import { supabase, isSupabaseReady } from './supabase'
import { db } from './db'
import { ensureCards, isDatabaseComplete, loadFullDatabase } from './swuApi'
import {
  construirIndiceArquetipos,
  parseDecklistName,
  type IndiceArquetipos,
} from './meleeArchetype'
import type { Card } from '../types'

// ─── Lo que expone ────────────────────────────────────────────────────

export type AmbitoMeta = 'aca' | 'nuestros'

/**
 * Falla de lectura contra Supabase que deja la pantalla SIN nada que mostrar.
 *
 * Se lanza a propósito: la vista tiene un estado de error y era inalcanzable
 * mientras el servicio se tragaba todo y devolvía el objeto vacío.
 */
export class ErrorMeta extends Error {
  readonly codigo: string | null
  readonly donde: string
  constructor(donde: string, codigo: string | null | undefined, detalle: string) {
    super(
      `Falló la lectura de ${donde} del meta nacional${codigo ? ` (${codigo})` : ''}: ` +
        detalle.slice(0, 200),
    )
    this.name = 'ErrorMeta'
    this.donde = donde
    this.codigo = codigo ?? null
  }
}

export interface ArquetipoNacional {
  liderId: string
  baseId: string
  liderNombre: string
  baseNombre: string
  vecesJugado: number
  mejorPuesto: number | null
  /**
   * Cuántos jugaron el torneo donde consiguió `mejorPuesto`. `null` si esa
   * fuente no dijo cuántos eran.
   *
   * Viaja pegado al puesto porque **el puesto solo miente** (gotcha 2n): un 3.º
   * puede ser 3 de 4. La UI muestra «3.º de 128» o no muestra el puesto.
   */
  participantes: number | null
  /** Promedio de percentiles. `null` si NINGÚN torneo dijo cuántos jugaron. */
  percentilMedio: number | null
  victorias: number
  derrotas: number
  empates: number
}

export interface TorneoNacional {
  id: string
  nombre: string
  organizador: string | null
  fecha: string | null
  jugadores: number | null
  esLocal: boolean
  /**
   * Las filas que entraron POR ESTE ÁMBITO, de mejor a peor puesto.
   *
   * En «acá» es el top real de la sala. En «los nuestros» es dónde quedaron
   * los nuestros — que puede ser el puesto 340 — y no el podio del torneo.
   * Llamarlo «top» a secas mentiría en ese segundo caso, así que la UI tiene
   * que rotularlo según el ámbito.
   */
  top: {
    puesto: number
    jugador: string
    mazo: string | null
    liderId: string | null
    baseId: string | null
    /**
     * `true` un perfil enlazado Y verificado por un admin, `false` enlazado sin
     * verificar, `null` alguien que no está en la comunidad (pasa todo el
     * tiempo en «acá»: la sala entera cuenta, esté enlazada o no).
     *
     * Nadie puede probar que una cuenta de melee es suya (gotcha 2n), así que
     * el dato se **muestra**, no se exige: pedir `melee_verified` para contar
     * dejaría el módulo vacío (hoy hay 0 verificados).
     */
    verificado: boolean | null
  }[]
}

export interface MetaNacional {
  ambito: AmbitoMeta
  arquetipos: ArquetipoNacional[]
  torneos: TorneoNacional[]
  /** Cuántas filas de standing entraron al conteo. */
  totalFilas: number
  /** De esas, cuántas dieron un arquetipo con confianza `exacta`. */
  conArquetipo: number
  /** `sinLista + noParseado`. Lo que NO entró a los arquetipos. */
  sinArquetipo: number
  /** Filas sin `decklist_name`: esa persona no publicó su mazo. */
  sinLista: number
  /** Filas CON nombre de mazo que el parser no resolvió. El síntoma a vigilar. */
  noParseado: number
  /**
   * Cuánta gente de la comunidad tiene su melee enlazado. **En total**, aunque
   * no aparezca en ninguna fila de este ámbito: si no, un torneo local lleno de
   * gente de fuera hacía decir «nadie tiene melee enlazado» con 10 enlazados.
   */
  jugadoresEnlazados: number
  /** De esos, cuántos aparecen en las filas de ESTE ámbito. */
  jugadoresConFilas: number
  /**
   * Hay muestra suficiente para dibujar porcentajes.
   *
   * Exige `conArquetipo >= QUORUM` **y** que el agregado no esté a medias
   * (`parcial`) ni apoyado en una base de cartas incompleta: un porcentaje
   * sacado de datos truncados es tan falso como uno sacado de 3 filas.
   */
  hayQuorum: boolean
  /**
   * Alguna consulta falló DESPUÉS de que ya hubiera datos: lo que se devuelve
   * es un pedazo, no el total. La vista lo tiene que decir.
   */
  parcial: boolean
  /**
   * La base de cartas local no está completa (gotcha 2c), así que el parser de
   * arquetipos no es de fiar: todo caería en `noParseado`. Es un estado
   * propio, no un cero.
   */
  baseIncompleta: boolean
}

/**
 * Mínimo de mazos identificados para que la tabla signifique algo.
 *
 * Por debajo de 20 el «arquetipo más jugado» puede ser un mazo que apareció
 * dos veces contra otro que apareció una. Eso no es un meta, es una anécdota,
 * y la UI tiene que decirlo en vez de dibujar un ranking.
 */
export const QUORUM = 20

/** Cuántas filas se guardan por torneo para la vista de detalle. */
const TOP_POR_TORNEO = 8

// ─── Filas crudas ─────────────────────────────────────────────────────

interface FilaTorneo {
  melee_tournament_id: string
  name: string
  organizer: string | null
  date: string | null
  player_count: number | null
  is_local: boolean
  final_round_id: string | null
}

interface FilaStanding {
  melee_tournament_id: string
  round_id: string
  rank: number
  player_name: string
  record: string | null
  wins: number | null
  losses: number | null
  draws: number | null
  decklist_name: string | null
  decklist_id: string | null
}

const COLS_TORNEO =
  'melee_tournament_id, name, organizer, date, player_count, is_local, final_round_id'

const COLS_STANDING =
  'melee_tournament_id, round_id, rank, player_name, record, wins, losses, draws, decklist_name, decklist_id'

/** PostgREST corta cualquier SELECT en 1000 filas. Sin paginar se pierde el resto. */
const PAGINA = 1000

/** Ids por consulta: un `in` con cientos de valores arma un URL que el proxy rechaza. */
const TANDA = 50

function enTandas<T>(xs: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n))
  return out
}

/** Lo que devuelve un lector paginado: las filas y si se quedó a medias. */
interface Lectura<T> {
  filas: T[]
  parcial: boolean
}

// ─── Lectura de Supabase ──────────────────────────────────────────────

/**
 * Torneos: o todos los locales, o los de una lista de ids.
 *
 * Se pagina igual que los standings aunque hoy sean pocos: el día que sean
 * 1001 el corte silencioso de PostgREST se vería como «faltan torneos» y nadie
 * lo relacionaría con esto.
 */
async function traerTorneos(
  filtro: { soloLocales: true } | { ids: string[] },
): Promise<Lectura<FilaTorneo>> {
  const out: FilaTorneo[] = []
  let parcial = false

  const tandas = 'ids' in filtro ? enTandas(filtro.ids, TANDA) : [null]
  for (const tanda of tandas) {
    for (let desde = 0; ; desde += PAGINA) {
      let q = supabase.from('meta_tournaments').select(COLS_TORNEO)
      q = tanda ? q.in('melee_tournament_id', tanda) : q.eq('is_local', true)

      const { data, error } = await q
        .order('melee_tournament_id')
        .range(desde, desde + PAGINA - 1)

      // supabase-js NO lanza ante un error de PostgREST (gotcha 2f): sin mirar
      // `error` esto devolvería «no hay torneos» ante un fallo de permisos.
      if (error) {
        // Sin una sola fila acumulada no hay «agregado parcial» que enseñar:
        // esto es un fallo, y se lanza para que la vista lo diga.
        if (out.length === 0) throw new ErrorMeta('los torneos', error.code, error.message)
        console.warn('[MetaNacional] torneos:', error.code, error.message)
        parcial = true
        break
      }
      if (!data || data.length === 0) break
      out.push(...(data as unknown as FilaTorneo[]))
      if (data.length < PAGINA) break
    }
  }
  return { filas: out, parcial }
}

/** Todos los standings de una lista de torneos. Es el ámbito «acá». */
async function traerStandingsDeTorneos(ids: string[]): Promise<Lectura<FilaStanding>> {
  const out: FilaStanding[] = []
  let parcial = false

  for (const tanda of enTandas(ids, TANDA)) {
    for (let desde = 0; ; desde += PAGINA) {
      const { data, error } = await supabase
        .from('meta_standings')
        .select(COLS_STANDING)
        .in('melee_tournament_id', tanda)
        // El orden tiene que ser TOTAL o la paginación repite y se salta filas.
        // (torneo, ronda, puesto) es justo la clave primaria.
        .order('melee_tournament_id')
        .order('round_id')
        .order('rank')
        .range(desde, desde + PAGINA - 1)

      if (error) {
        if (out.length === 0) throw new ErrorMeta('las clasificaciones', error.code, error.message)
        console.warn('[MetaNacional] standings:', error.code, error.message)
        parcial = true
        break
      }
      if (!data || data.length === 0) break
      out.push(...(data as unknown as FilaStanding[]))
      if (data.length < PAGINA) break
    }
  }
  return { filas: out, parcial }
}

/**
 * Misma gramática que valida el proxy y la restricción `profiles_melee_username_valido`.
 * Un nombre que no la cumpla no debería existir en la base; si aparece, no se
 * mete en la consulta. De paso garantiza que el nombre no trae comillas ni
 * comas, que son lo que rompería la sintaxis del `or=(...)` de PostgREST.
 */
const USUARIO_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$/

/**
 * Standings de los jugadores enlazados, en cualquier torneo. Ámbito «nuestros».
 *
 * El `ilike` del servidor es solo un PRE-filtro para no bajarse la tabla
 * entera; la igualdad de verdad la decide el llamador contra el conjunto de
 * nombres normalizados. La regla es que el pre-filtro tiene que ser un
 * **superconjunto** de lo que acepta el cliente: ensanchar de más es
 * inofensivo, dejar fuera una fila que sí era es un dato perdido en silencio.
 *
 * Por eso va con `%` a los dos lados. `ilike."nel15"` exige el valor EXACTO, y
 * el cliente compara con `normNombre`, que recorta espacios y colapsa los de
 * sobra: un `player_name` guardado como `" nel15"` lo aceptaría el cliente y el
 * pre-filtro lo tiraba antes — al revés de lo que prometía este comentario.
 * (Que el `%` dentro de un valor entrecomillado de `or=(…)` sea comodín y no un
 * literal está **medido** contra este PostgREST: `ilike."%DAR%"` devuelve
 * `neldark`.)
 * (Los `_` del nombre también son comodín de `ilike`; eso ya ensanchaba, que es
 * el lado seguro. Un usuario de 1-2 letras ensancha mucho: se lo comen el
 * filtro del cliente y la paginación, pero por eso el pre-filtro no es la
 * defensa, solo un ahorro.)
 */
async function traerStandingsDeNuestros(nombres: string[]): Promise<Lectura<FilaStanding>> {
  const seguros = nombres.filter(n => USUARIO_RE.test(n))
  if (seguros.length === 0) return { filas: [], parcial: false }

  const out: FilaStanding[] = []
  let parcial = false

  // Tandas chicas: cada nombre es una condición y el `or` viaja en el URL.
  for (const tanda of enTandas(seguros, 25)) {
    const patron = tanda.map(n => `player_name.ilike."%${n}%"`).join(',')
    for (let desde = 0; ; desde += PAGINA) {
      const { data, error } = await supabase
        .from('meta_standings')
        .select(COLS_STANDING)
        .or(patron)
        .order('melee_tournament_id')
        .order('round_id')
        .order('rank')
        .range(desde, desde + PAGINA - 1)

      if (error) {
        if (out.length === 0) throw new ErrorMeta('las clasificaciones', error.code, error.message)
        console.warn('[MetaNacional] standings nuestros:', error.code, error.message)
        parcial = true
        break
      }
      if (!data || data.length === 0) break
      out.push(...(data as unknown as FilaStanding[]))
      if (data.length < PAGINA) break
    }
  }
  return { filas: out, parcial }
}

/** Nombre comparable: solo se ignoran mayúsculas y espacios de sobra. */
function normNombre(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

interface Enlazados {
  /** Los usuarios tal cual están escritos, para armar la consulta. */
  lista: string[]
  /** Los mismos, normalizados, para decidir si una fila es de los nuestros. */
  set: Set<string>
  /** De esos, los que un admin confirmó. */
  verificados: Set<string>
}

/**
 * Los `melee_username` enlazados en perfiles.
 *
 * No se deduplica por perfil: dos perfiles con el mismo usuario de melee son un
 * solo jugador en melee, y así se cuenta. Se pagina por lo mismo que los
 * torneos: el corte de PostgREST en 1000 se vería como «esa gente no tiene
 * melee enlazado».
 */
async function traerEnlazados(): Promise<Enlazados> {
  const set = new Set<string>()
  const verificados = new Set<string>()
  const lista: string[] = []

  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, melee_username, melee_verified')
      .not('melee_username', 'is', null)
      .order('id')
      .range(desde, desde + PAGINA - 1)

    if (error) throw new ErrorMeta('los perfiles enlazados', error.code, error.message)
    if (!data || data.length === 0) break

    for (const row of data as { melee_username: string | null; melee_verified: boolean | null }[]) {
      const u = row.melee_username?.trim()
      if (!u) continue
      const k = normNombre(u)
      if (!set.has(k)) {
        set.add(k)
        lista.push(u)
      }
      // Con dos perfiles sobre el mismo usuario basta que UNO esté verificado:
      // es la misma cuenta de melee y un admin ya la confirmó.
      if (row.melee_verified) verificados.add(k)
    }

    if (data.length < PAGINA) break
  }

  return { lista, set, verificados }
}

// ─── Base de cartas ───────────────────────────────────────────────────

interface BaseCartas {
  idx: IndiceArquetipos
  porCarta: Map<string, Card>
  /** La base local no está completa: el parser no es de fiar (gotcha 2c). */
  incompleta: boolean
}

/**
 * Índice de arquetipos cacheado.
 *
 * Construirlo son 9.057 cartas leídas de Dexie y dos mapas; hacerlo en CADA
 * cambio de ámbito era medio segundo de nada. La clave es el total de cartas:
 * si la base creció (llegó un set nuevo, terminó una descarga a medias) el
 * índice se rehace.
 */
let cacheBase: (BaseCartas & { total: number }) | null = null
/** Que la reparación de la base se pida una vez, no en cada carga. */
let reparacionPedida = false

async function baseDeCartas(): Promise<BaseCartas> {
  // `/meta` se puede abrir directo sin pasar por el buscador, así que la base
  // puede no estar. Esto la trae si falta.
  await ensureCards()

  // Pero «hay cartas» no es «están todas»: con la base a medias el parser no
  // resuelve nada y el módulo diría que nadie publica mazo. Se comprueba el
  // centinela de completitud, no el `count > 0`.
  const completa = await isDatabaseComplete()
  const total = await db.cards.count()

  if (!completa && !reparacionPedida) {
    reparacionPedida = true
    // Sin `await`: son ~10 MB y la vista no se queda esperándolos. Esta carga
    // se declara `baseIncompleta`; la siguiente ya encuentra la base entera.
    loadFullDatabase({ force: true }).catch(() => {
      reparacionPedida = false
    })
  }

  if (!cacheBase || cacheBase.total !== total) {
    const cartas = await db.cards.toArray()
    cacheBase = {
      total,
      idx: construirIndiceArquetipos(cartas),
      porCarta: new Map(cartas.map(c => [c.id, c])),
      incompleta: !completa,
    }
  }
  cacheBase.incompleta = !completa
  return cacheBase
}

// ─── Ronda final ──────────────────────────────────────────────────────

/**
 * Se queda solo con la clasificación FINAL de cada torneo.
 *
 * `rank` es único **por ronda**, no por torneo: si en la tabla conviven la
 * ronda 5 y la final, el campeón aparece dos veces y su arquetipo se cuenta
 * doble. `meta_tournaments.final_round_id` dice cuál es la buena.
 *
 * **Si el torneo la declara, se usa ESA y punto**, aunque en las filas que
 * tenemos a mano no aparezca. El fallback de «si hay una sola ronda, es esa»
 * solo vale cuando el torneo NO declara nada: en «los nuestros» las filas ya
 * vienen filtradas por jugador, así que un salvadoreño eliminado en la ronda 3
 * tiene UNA sola ronda guardada —la 3— y el fallback la habría tomado por final
 * teniendo el dato correcto a la vista.
 *
 * Cuando no hay declaración y hay varias rondas el torneo se descarta entero:
 * elegir «la de id más alto» sería inventar, porque los `roundId` de melee **no
 * son monotónicos** (medido: Round 11 = 1420227 pesa más que Finals = 1419188).
 */
function soloRondaFinal(filas: FilaStanding[], torneos: Map<string, FilaTorneo>): FilaStanding[] {
  const rondas = new Map<string, Set<string>>()
  for (const f of filas) {
    let s = rondas.get(f.melee_tournament_id)
    if (!s) rondas.set(f.melee_tournament_id, (s = new Set()))
    s.add(f.round_id)
  }

  const elegida = new Map<string, string>()
  /**
   * Torneos cuya ronda final declarada no aparece en las filas del ámbito.
   * En «los nuestros» es lo NORMAL —quien no llegó a la final no tiene fila
   * ahí— así que se cuenta y se dice una vez, no una por torneo.
   */
  let sinFilaEnLaFinal = 0

  for (const [tid, s] of rondas) {
    const declarada = torneos.get(tid)?.final_round_id ?? null
    if (declarada) {
      elegida.set(tid, declarada)
      // Ninguna fila del ámbito llegó a la final. Eso es un dato, no un
      // problema a arreglar bajando a una ronda intermedia teniendo el dato
      // correcto a la vista.
      if (!s.has(declarada)) sinFilaEnLaFinal++
    } else if (s.size === 1) {
      elegida.set(tid, [...s][0])
    } else {
      console.warn(
        `[MetaNacional] torneo ${tid} tiene ${s.size} rondas y no declara final_round_id: se omite`,
      )
    }
  }

  if (sinFilaEnLaFinal > 0) {
    console.info(
      `[MetaNacional] ${sinFilaEnLaFinal} torneo(s): nadie del ámbito aparece en la ronda final declarada`,
    )
  }

  return filas.filter(f => elegida.get(f.melee_tournament_id) === f.round_id)
}

// ─── Percentil y marca ────────────────────────────────────────────────

/**
 * Percentil dentro del torneo: 100 = campeón, 0 = último.
 *
 * Sin `player_count` **no se calcula y no se inventa**. Un puesto 399 puede ser
 * excelente (de 1022) o un desastre (de 400); rellenar con un valor por defecto
 * fabrica justo el número que después alguien cita como si fuera real.
 */
function percentilFila(rank: number, jugadores: number | null): number | null {
  if (jugadores == null || jugadores < 2 || rank < 1) return null
  const p = ((jugadores - rank) / (jugadores - 1)) * 100
  return Math.max(0, Math.min(100, p))
}

const RECORD_RE = /^(\d+)\s*-\s*(\d+)(?:\s*-\s*(\d+))?$/

/**
 * Victorias/derrotas/empates de una fila.
 *
 * Las columnas numéricas mandan. Si las tres vienen en null se intenta el
 * `MatchRecord` crudo («3-1-0»), que es de donde salieron: mejor leerlo que
 * anotar un 0-0-0 que se sumaría como si esa persona no hubiera jugado.
 */
function marca(f: FilaStanding): { v: number; d: number; e: number } {
  if (f.wins != null || f.losses != null || f.draws != null) {
    return { v: f.wins ?? 0, d: f.losses ?? 0, e: f.draws ?? 0 }
  }
  const m = f.record ? RECORD_RE.exec(f.record.trim()) : null
  if (!m) return { v: 0, d: 0, e: 0 }
  return { v: Number(m[1]), d: Number(m[2]), e: m[3] ? Number(m[3]) : 0 }
}

/** Nombre de líder para mostrar: «Nombre, Subtítulo», que es lo que lo identifica. */
function nombreLider(c: Card | undefined, id: string): string {
  if (!c) return id
  return c.subtitle ? `${c.name}, ${c.subtitle}` : c.name
}

// ─── Consulta principal ───────────────────────────────────────────────

function vacio(ambito: AmbitoMeta, extra?: Partial<MetaNacional>): MetaNacional {
  return {
    ambito,
    arquetipos: [],
    torneos: [],
    totalFilas: 0,
    conArquetipo: 0,
    sinArquetipo: 0,
    sinLista: 0,
    noParseado: 0,
    jugadoresEnlazados: 0,
    jugadoresConFilas: 0,
    hayQuorum: false,
    parcial: false,
    baseIncompleta: false,
    ...extra,
  }
}

interface Acumulado {
  liderId: string
  baseId: string
  vecesJugado: number
  mejorPuesto: number | null
  participantes: number | null
  sumaPercentil: number
  conPercentil: number
  victorias: number
  derrotas: number
  empates: number
}

/**
 * Arma el meta de un ámbito.
 *
 * **Lanza `ErrorMeta`** cuando la primera consulta falla, o sea cuando no hay
 * absolutamente nada que mostrar: ese caso tiene que verse como un error y no
 * como «todavía no hay torneos». Un fallo posterior no lanza, marca `parcial`.
 */
export async function getMetaNacional(ambito: AmbitoMeta): Promise<MetaNacional> {
  if (!isSupabaseReady()) return vacio(ambito)

  const { idx, porCarta, incompleta } = await baseDeCartas()

  let parcial = false

  // Los enlazados son el ámbito ENTERO en «nuestros» —sin ellos no hay qué
  // consultar—, pero en «acá» solo sirven para contar cuántos de los nuestros
  // aparecen en la sala. Por eso el mismo fallo es fatal en un caso y parcial
  // en el otro.
  let enlazados: Enlazados
  try {
    enlazados = await traerEnlazados()
  } catch (e) {
    if (ambito === 'nuestros') throw e
    console.warn('[MetaNacional] enlazados:', (e as Error).message)
    enlazados = { lista: [], set: new Set(), verificados: new Set() }
    parcial = true
  }

  let listaTorneos: FilaTorneo[]
  let filas: FilaStanding[]

  if (ambito === 'aca') {
    // La sala entera de los torneos locales.
    const t = await traerTorneos({ soloLocales: true })
    listaTorneos = t.filas
    parcial = parcial || t.parcial

    if (listaTorneos.length === 0) {
      filas = []
    } else {
      // Si los standings fallan enteros todavía quedan los torneos, que son
      // datos de verdad: se enseñan con el cartel de parcial en vez de tirar la
      // pantalla. El estado de error es para cuando NO hay nada.
      try {
        const s = await traerStandingsDeTorneos(listaTorneos.map(x => x.melee_tournament_id))
        filas = s.filas
        parcial = parcial || s.parcial
      } catch (e) {
        if (!(e instanceof ErrorMeta)) throw e
        console.warn('[MetaNacional]', e.message)
        filas = []
        parcial = true
      }
    }
  } else {
    if (enlazados.lista.length === 0) return vacio(ambito, { baseIncompleta: incompleta })
    // Solo las filas de los nuestros, en el torneo que sea. El `ilike` del
    // servidor ensancha; acá se decide de verdad.
    const s = await traerStandingsDeNuestros(enlazados.lista)
    parcial = parcial || s.parcial
    filas = s.filas.filter(f => enlazados.set.has(normNombre(f.player_name)))

    const ids = [...new Set(filas.map(f => f.melee_tournament_id))]
    if (ids.length === 0) {
      listaTorneos = []
    } else {
      // Ídem: las filas ya están en la mano. Sin los torneos se pierden la
      // ronda final declarada y el «de N», así que el resultado es peor —y por
      // eso se marca parcial—, pero no es una pantalla vacía.
      try {
        const t = await traerTorneos({ ids })
        listaTorneos = t.filas
        parcial = parcial || t.parcial
      } catch (e) {
        if (!(e instanceof ErrorMeta)) throw e
        console.warn('[MetaNacional]', e.message)
        listaTorneos = []
        parcial = true
      }
    }
  }

  const porTorneo = new Map(listaTorneos.map(t => [t.melee_tournament_id, t]))
  const finales = soloRondaFinal(filas, porTorneo)

  // ── Agregado por arquetipo ──
  const acc = new Map<string, Acumulado>()
  const conFilas = new Set<string>()
  // TODAS las filas de cada torneo. Recortar acá al vuelo guardaba las 8
  // PRIMERAS que llegaban, no las 8 mejores: se ordena y se corta al final.
  const filasPorTorneo = new Map<string, TorneoNacional['top']>()
  let conArquetipo = 0
  let sinLista = 0
  let noParseado = 0

  for (const f of finales) {
    const t = porTorneo.get(f.melee_tournament_id)

    const nk = normNombre(f.player_name)
    const esNuestro = enlazados.set.has(nk)
    if (esNuestro) conFilas.add(nk)

    // El arquetipo se parsea acá y solo se cuenta si es EXACTO. `permitirTruncado`
    // queda apagado a propósito: estos nombres vienen del API de melee, que no
    // los corta, así que un «truncado» sería un nombre raro, no una carta.
    const nombreMazo = f.decklist_name?.trim() || null
    const arq = nombreMazo ? parseDecklistName(nombreMazo, idx) : null
    const exacto = arq && arq.confianza === 'exacta' ? arq : null

    const fila = filasPorTorneo.get(f.melee_tournament_id) ?? []
    fila.push({
      puesto: f.rank,
      jugador: f.player_name,
      mazo: nombreMazo,
      liderId: exacto?.liderId ?? null,
      baseId: exacto?.baseId ?? null,
      verificado: esNuestro ? enlazados.verificados.has(nk) : null,
    })
    filasPorTorneo.set(f.melee_tournament_id, fila)

    if (!exacto) {
      // Dos hechos distintos: no publicó mazo / publicó y no se entendió. El
      // segundo es el que delata un parser roto, así que no se mezclan.
      if (nombreMazo) noParseado++
      else sinLista++
      continue
    }
    conArquetipo++

    const clave = `${exacto.liderId}|${exacto.baseId}`
    let a = acc.get(clave)
    if (!a) {
      a = {
        liderId: exacto.liderId,
        baseId: exacto.baseId,
        vecesJugado: 0,
        mejorPuesto: null,
        participantes: null,
        sumaPercentil: 0,
        conPercentil: 0,
        victorias: 0,
        derrotas: 0,
        empates: 0,
      }
      acc.set(clave, a)
    }

    a.vecesJugado++
    if (a.mejorPuesto === null || f.rank < a.mejorPuesto) {
      a.mejorPuesto = f.rank
      // El «de N» del torneo donde consiguió ESE puesto, no de otro.
      a.participantes = t?.player_count ?? null
    }

    const p = percentilFila(f.rank, t?.player_count ?? null)
    if (p !== null) {
      a.sumaPercentil += p
      a.conPercentil++
    }

    const m = marca(f)
    a.victorias += m.v
    a.derrotas += m.d
    a.empates += m.e
  }

  const arquetipos: ArquetipoNacional[] = [...acc.values()]
    .map(a => ({
      liderId: a.liderId,
      baseId: a.baseId,
      liderNombre: nombreLider(porCarta.get(a.liderId), a.liderId),
      baseNombre: porCarta.get(a.baseId)?.name ?? a.baseId,
      vecesJugado: a.vecesJugado,
      mejorPuesto: a.mejorPuesto,
      participantes: a.participantes,
      percentilMedio:
        a.conPercentil > 0 ? Math.round(a.sumaPercentil / a.conPercentil) : null,
      victorias: a.victorias,
      derrotas: a.derrotas,
      empates: a.empates,
    }))
    // Más jugado primero; a igualdad, el que llegó más arriba. El nombre
    // desempata para que dos cargas seguidas den el MISMO orden.
    .sort(
      (x, y) =>
        y.vecesJugado - x.vecesJugado ||
        (x.mejorPuesto ?? Infinity) - (y.mejorPuesto ?? Infinity) ||
        x.liderNombre.localeCompare(y.liderNombre) ||
        x.baseNombre.localeCompare(y.baseNombre),
    )

  const torneos: TorneoNacional[] = listaTorneos
    .map(t => ({
      id: t.melee_tournament_id,
      nombre: t.name,
      organizador: t.organizer,
      fecha: t.date,
      jugadores: t.player_count,
      esLocal: t.is_local,
      // Primero el orden REAL, después el corte. Al revés se mostraban las
      // primeras filas que llegaron y se llamaban «top».
      top: (filasPorTorneo.get(t.melee_tournament_id) ?? [])
        .slice()
        .sort((a, b) => a.puesto - b.puesto || a.jugador.localeCompare(b.jugador))
        .slice(0, TOP_POR_TORNEO),
    }))
    // Un torneo del que no se guardó ni un puesto NO se lista.
    //
    // Existe de verdad: melee reconoce eventos con jugadores declarados y
    // rondas cerradas cuya clasificación nunca publica. Medido en producción
    // con el Last Chance Qualifier 2026 — 1.486 jugadores, 8 rondas, y
    // `recordsTotal: 0`. Mostrarlo con un top vacío diría «nadie jugó», que es
    // falso; lo cierto es que no sabemos quién ganó, y de eso no hay nada útil
    // que enseñar en una tabla del meta.
    .filter(t => t.top.length > 0)
    // Lo más reciente arriba. Un torneo sin fecha va al final: no se le inventa
    // una para poder ordenarlo.
    .sort((a, b) => {
      if (!a.fecha && !b.fecha) return a.nombre.localeCompare(b.nombre)
      if (!a.fecha) return 1
      if (!b.fecha) return -1
      return b.fecha.localeCompare(a.fecha)
    })

  const totalFilas = finales.length
  return {
    ambito,
    arquetipos,
    torneos,
    totalFilas,
    conArquetipo,
    sinArquetipo: sinLista + noParseado,
    sinLista,
    noParseado,
    jugadoresEnlazados: enlazados.set.size,
    jugadoresConFilas: conFilas.size,
    hayQuorum: conArquetipo >= QUORUM && !parcial && !incompleta,
    parcial,
    baseIncompleta: incompleta,
  }
}

// ─── Disparar la ingesta ──────────────────────────────────────────────

/**
 * Cuerpo que devuelve `api/meta-ingesta` con 200. Todo opcional a propósito:
 * lo que llega por la red no se da por cierto ni por completo.
 */
interface CuerpoIngesta {
  /** Torneos de SWU vistos en los perfiles de esta corrida (nuevos o no). */
  descubiertos?: unknown
  /** De esos, los que entraron a la cola por primera vez. */
  encolados?: unknown
  perfilesLeidos?: unknown
  procesados?: unknown
  /** Filas de standing escritas. */
  filas?: unknown
  cortadoPorTiempo?: unknown
  pendientesDelLote?: unknown
  erroresTotales?: unknown
  /** Solo en las respuestas de error (4xx/5xx). */
  error?: unknown
}

function num(x: unknown): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`
}

/**
 * Traduce el resumen del servidor a una frase.
 *
 * Se arma con los campos que la función manda DE VERDAD (`descubiertos`,
 * `encolados`, `procesados`, `filas`…). Antes se leía un `mensaje` que esa
 * respuesta nunca tuvo, así que el botón siempre decía lo mismo pasara lo que
 * pasara.
 */
function resumirIngesta(c: CuerpoIngesta): string {
  const perfiles = num(c.perfilesLeidos)
  const encolados = num(c.encolados)
  const descubiertos = num(c.descubiertos)
  const procesados = num(c.procesados)
  const filas = num(c.filas)
  const pendientes = num(c.pendientesDelLote)
  const errores = num(c.erroresTotales)

  const partes: string[] = []

  if (perfiles > 0) partes.push(plural(perfiles, 'perfil revisado', 'perfiles revisados'))

  if (encolados > 0) {
    partes.push(`${plural(encolados, 'torneo nuevo', 'torneos nuevos')} en cola`)
  } else if (descubiertos > 0) {
    partes.push(`sin torneos nuevos (${plural(descubiertos, 'ya conocido', 'ya conocidos')})`)
  } else {
    partes.push('no se encontraron torneos de SWU')
  }

  if (procesados > 0) {
    partes.push(
      `${plural(procesados, 'torneo procesado', 'torneos procesados')} (${plural(filas, 'fila', 'filas')})`,
    )
  }
  if (pendientes > 0) {
    partes.push(`${plural(pendientes, 'torneo queda', 'torneos quedan')} en la cola`)
  }
  if (c.cortadoPorTiempo === true) partes.push('se acabó el tiempo: sigue en la próxima corrida')
  if (errores > 0) partes.push(plural(errores, 'error', 'errores'))

  const frase = partes.join('; ')
  return `${frase.charAt(0).toUpperCase()}${frase.slice(1)}.`
}

/**
 * Le pide al servidor que descubra torneos nuevos y baje sus standings.
 *
 * **Va por GET.** No porque sea un GET de libro —escribe en la base— sino
 * porque el cron de Vercel solo sabe hacer GET y la alternativa era mantener
 * dos caminos y duplicar la puerta de entrada. `api/meta-ingesta` responde 405
 * a cualquier otro verbo, así que mandar POST desde acá dejaba toda la ingesta
 * manual muerta: el botón no disparaba nada y decía que sí.
 *
 * Va con el JWT de la sesión (mismo patrón que `/api/notify-listing`): quien no
 * tiene sesión no dispara descargas contra melee desde nuestro dominio. El
 * trabajo real —el turno global de `meta_fetch_lease`, el `Crawl-Delay: 5` y la
 * cola— vive del lado del servidor; acá solo se toca el timbre.
 *
 * Nunca lanza: esto se llama desde un botón y un fallo de red no puede tumbar
 * la pantalla del meta, que ya está mostrando datos.
 */
export async function dispararIngesta(): Promise<{ ok: boolean; mensaje: string }> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión al servidor' }

  try {
    // `error` desestructurado también acá: un token vencido que no se pudo
    // refrescar deja `session` en null y sin mirarlo se vería igual que «nunca
    // inició sesión» (gotcha 2f).
    const { data, error } = await supabase.auth.getSession()
    if (error) console.warn('[MetaNacional] sesión:', error.message)
    const token = data.session?.access_token
    if (!token) return { ok: false, mensaje: 'Iniciá sesión para actualizar el meta.' }

    const res = await fetch('/api/meta-ingesta', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      // Escribe en la base: que no lo sirva ninguna caché.
      cache: 'no-store',
    })

    let cuerpo: CuerpoIngesta = {}
    try {
      cuerpo = (await res.json()) as CuerpoIngesta
    } catch {
      // Un 502 de Vercel llega en HTML: que no se caiga acá.
    }

    if (!res.ok) {
      const detalle = typeof cuerpo.error === 'string' ? cuerpo.error : null
      return { ok: false, mensaje: detalle ?? `No se pudo actualizar (error ${res.status})` }
    }
    return { ok: true, mensaje: resumirIngesta(cuerpo) }
  } catch {
    return { ok: false, mensaje: 'No se pudo contactar al servidor.' }
  }
}

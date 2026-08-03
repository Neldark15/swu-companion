/**
 * metaStatsService — el meta competitivo, con datos vivos.
 *
 * Viene de swumetastats.com por `/api/swu-stats`. Sustituye en números al
 * snapshot de un torneo de abril que la app traía empaquetado: ese describe un
 * pool de cartas que el juego CERRÓ el 16 de julio, y 53 de los 177 arquetipos
 * actuales tienen líderes que entonces no existían.
 *
 * ── Lo que estos datos NO aguantan ────────────────────────────────────
 *
 * Medido, no supuesto:
 *
 * - **El nombre de la base es basura.** En llamadas idénticas la fuente
 *   reasigna qué carta concreta representa a un grupo. Lo estable es
 *   líder + GRUPO de base («Vigilance 30 HP»). Nunca se afirma «juega la base
 *   X»: `baseName` es una etiqueta de grupo, no una carta.
 * - **`conversion` no es «% que llega a top 8».** Para el mismo arquetipo da
 *   0.07203 mientras top8/total da 0.07563. Se muestran los conteos crudos.
 * - **`sampleConfidence` no es confianza estadística**, es un multiplicador
 *   escalonado por cantidad de mazos. No se usa como si midiera certeza.
 * - **El tier no ordena «mejor mazo».** Mezcla win rate, cuota y conversión;
 *   hay tier 3 con 1 mazo y 11 partidas al 81%. Se muestra como etiqueta de
 *   la fuente, nunca como veredicto.
 * - **Un par ausente en los matchups es «sin dato», no 0%.**
 */

const BASE = '/api/swu-stats'

export const SOURCE = { name: 'SWU Meta Stats', url: 'https://swumetastats.com' }

/**
 * Mínimos para mostrar un win rate sin advertencia.
 *
 * Con `games ≥ 100 && deckCount ≥ 20` quedan ~20 arquetipos y el error del
 * porcentaje baja de ±10 puntos. Por debajo el número existe pero se marca:
 * un 81% de 11 partidas no es información, es ruido con formato de dato.
 */
export const MIN_GAMES = 100
export const MIN_DECKS = 20

// ─── Caché ────────────────────────────────────────────────────────────

const CACHE_VERSION = 1
const TTL = 6 * 60 * 60 * 1000

function leerCache<T>(key: string): { data: T; at: number; fresco: boolean } | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { v, at, data } = JSON.parse(raw) as { v: number; at: number; data: T }
    if (v !== CACHE_VERSION) return null
    return { data, at, fresco: Date.now() - at <= TTL }
  } catch { return null }
}

function guardarCache(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify({ v: CACHE_VERSION, at: Date.now(), data }))
  } catch { /* cuota llena o modo privado: la caché es un lujo */ }
}

async function pedir<T>(url: string, key: string, force = false): Promise<T> {
  const hit = leerCache<T>(key)
  if (!force && hit?.fresco) return hit.data
  try {
    const res = await fetch(url)
    if (!res.ok) {
      let msg = `error ${res.status}`
      try {
        const b = (await res.json()) as { error?: string }
        if (b?.error) msg = b.error
      } catch { /* puede no ser JSON */ }
      throw new Error(msg)
    }
    const body = (await res.json()) as { data: T }
    guardarCache(key, body.data)
    return body.data
  } catch (e) {
    // Un dato de ayer sirve para preparar un torneo; un error, no.
    if (hit) return hit.data
    throw e
  }
}

// ─── Tipos de la fuente ───────────────────────────────────────────────

export interface Arquetipo {
  leaderName: string
  /** Etiqueta del GRUPO de base («Vigilance 30 HP»), no una carta concreta. */
  baseName: string
  baseCardName?: string
  leaderAspect: string | null
  baseAspect: string | null
  leaderSet: string | null
  baseSet: string | null
  baseGroup: string | null
  /** Vienen como string: la fuente serializa BigInt. */
  total: string
  top8: string
  tournamentWins: string
  wins: number
  losses: number
  draws: number
  games: number
  winRate: number
  metaShare: number
}

export interface EntradaTier {
  archetypeId: string
  tier: string
  score: number
  recentWinRate: number | null
  trend: string | null
  conversion: number
  deckCount: number
}

export interface StatsLider {
  wins: number; losses: number; draws: number; games: number
  winRate: number; metaShare: number; deckCount: number
}

export interface VentanaMeta {
  start: string
  end: string | null
  setId: string
  label: string
}

/** Un arquetipo con lo que aporta el tierlist ya pegado. */
export interface FilaMeta extends Arquetipo {
  id: string
  mazos: number
  top8n: number
  titulos: number
  tier: string | null
  tendencia: string | null
  wrReciente: number | null
  /** ¿Tiene muestra suficiente para leer su win rate sin asterisco? */
  fiable: boolean
}

// ─── Clave canónica ───────────────────────────────────────────────────

/**
 * Identidad de arquetipo, con el formato exacto del tierlist de la fuente.
 *
 * Son DOS formatos y hay que respetarlos para que las dos tablas se puedan
 * cruzar (verificado: empalma 177/177):
 * - base genérica → `Líder::Aspecto::Grupo`
 * - base con nombre propio → `Líder__Base`
 */
const GENERICAS = new Set(['Generic30HP', 'Force28HP', 'Splash27HP'])

export function archetypeId(a: Arquetipo): string {
  return a.baseGroup && GENERICAS.has(a.baseGroup)
    ? `${a.leaderName}::${a.baseAspect ?? ''}::${a.baseGroup}`
    : `${a.leaderName}__${a.baseName}`
}

// ─── Consultas ────────────────────────────────────────────────────────

export async function getVentanas(force = false): Promise<VentanaMeta[]> {
  const d = await pedir<VentanaMeta[] | { boundaries?: VentanaMeta[] }>(
    `${BASE}?mode=ventanas`, 'swu_stats_ventanas', force,
  )
  return Array.isArray(d) ? d : (d.boundaries ?? [])
}

/** La ventana vigente es la única sin fecha de cierre. */
export const ventanaActual = (v: VentanaMeta[]) => v.find(x => x.end === null) ?? null

export interface MetaCompleto {
  filas: FilaMeta[]
  lideres: Record<string, StatsLider>
  totalMazos: number
}

/**
 * Tabla del meta: arquetipos + tierlist cruzados por `archetypeId`.
 *
 * Se piden los dos en paralelo. Si el tierlist falla, la tabla igual sirve —
 * pierde tier y tendencia, que son adorno frente a los conteos.
 */
export async function getMeta(force = false): Promise<MetaCompleto> {
  const [arq, tier] = await Promise.all([
    pedir<{ archetypes?: Arquetipo[]; leaderStats?: Record<string, StatsLider> }>(
      `${BASE}?mode=arquetipos`, 'swu_stats_arquetipos', force,
    ),
    pedir<{ tierlist?: EntradaTier[] }>(`${BASE}?mode=tierlist`, 'swu_stats_tierlist', force)
      .catch(() => ({ tierlist: [] as EntradaTier[] })),
  ])

  const porId = new Map((tier.tierlist ?? []).map(t => [t.archetypeId, t]))
  const lista = arq.archetypes ?? []

  const filas: FilaMeta[] = lista.map(a => {
    const id = archetypeId(a)
    const t = porId.get(id)
    const mazos = Number(a.total) || 0
    return {
      ...a,
      id,
      mazos,
      top8n: Number(a.top8) || 0,
      titulos: Number(a.tournamentWins) || 0,
      tier: t?.tier ?? null,
      tendencia: t?.trend ?? null,
      wrReciente: t?.recentWinRate ?? null,
      fiable: a.games >= MIN_GAMES && mazos >= MIN_DECKS,
    }
  })

  return {
    filas,
    lideres: arq.leaderStats ?? {},
    totalMazos: filas.reduce((s, f) => s + f.mazos, 0),
  }
}

// ─── Receta de un arquetipo ───────────────────────────────────────────

export interface CartaReceta {
  cardName: string
  raw3: number; pct3: number
  raw2: number; pct2: number
  raw1: number; pct1: number
}

export interface Grupos {
  Core: CartaReceta[]
  Popular: CartaReceta[]
  Flex: CartaReceta[]
}

export interface MazoDeCombo {
  guid: string
  standing: number | null
  tournament?: { name?: string } | null
}

export interface Receta {
  leaderName: string
  baseName: string
  baseGroupLabel: string | null
  totalDecks: number
  deckCounts: { all: number; top8: number; winners: number }
  mainboardGroups: Grupos
  sideboardGroups: Grupos
  mainboardGroupsTop8: Grupos
  mainboardGroupsWinners: Grupos
  imageUrlMap: Record<string, string>
  costMap: Record<string, number | null>
  typeMap: Record<string, string>
  aspectMap: Record<string, string>
  setMap: Record<string, string>
  leaderImageUrl: string | null
  baseImageUrl: string | null
  decklistsForCombo: MazoDeCombo[]
  notFound?: boolean
}

/**
 * La receta del arquetipo: qué juega la gente que lo juega.
 *
 * Es MEJOR que listar mazos sueltos porque es el consenso —«el 84% juega 3
 * copias de X»— y además viene partido en Core / Popular / Flex, que es lo que
 * de verdad se quiere saber para armarlo.
 */
export async function getReceta(leader: string, base: string, force = false): Promise<Receta> {
  const url = `${BASE}?mode=detalle&leader=${encodeURIComponent(leader)}&base=${encodeURIComponent(base)}`
  return pedir<Receta>(url, `swu_stats_receta_${leader}__${base}`, force)
}

/** Enlace al mazo en melee.gg, que es donde vive la lista completa. */
export const urlMelee = (guid: string) => `https://melee.gg/Decklist/View/${guid}`

// ─── Presentación ─────────────────────────────────────────────────────

export const pct = (v: number | null | undefined, dec = 1) =>
  v == null ? '—' : `${(v * 100).toFixed(dec)}%`

/**
 * Color del win rate, con banda muerta.
 *
 * Entre 47% y 53% no se pinta: la diferencia no se distingue del ruido y
 * teñirla de verde o rojo inventa una señal que el dato no tiene.
 */
export function tonoWR(v: number | null | undefined, fiable = true): 'green' | 'red' | 'neutral' {
  if (v == null || !fiable) return 'neutral'
  if (v > 0.53) return 'green'
  if (v < 0.47) return 'red'
  return 'neutral'
}

/** Aviso de muestra chica, o null si la muestra alcanza. */
export function avisoMuestra(f: FilaMeta): string | null {
  if (f.fiable) return null
  if (f.games < MIN_GAMES && f.mazos < MIN_DECKS) {
    return `Muestra chica: ${f.mazos} mazos y ${f.games} partidas`
  }
  if (f.games < MIN_GAMES) return `Solo ${f.games} partidas`
  return `Solo ${f.mazos} mazos`
}

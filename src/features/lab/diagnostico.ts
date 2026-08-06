/**
 * Diagnóstico del laboratorio — de 22 números sueltos a algo que se pueda hacer.
 *
 * Esta capa es PURA: no toca la red, ni Dexie, ni React. Recibe lo que ya midió
 * el simulador y devuelve lecturas. Se puede probar sin levantar nada.
 *
 * ── Lo que este archivo NO puede decir, y por qué ─────────────────────
 *
 * El motor (swusim.py) agrega por PARTIDA: ganador, rondas, vida final de cada
 * base, ronda de despliegue del líder y ventaja de iniciar. **No rastrea cartas
 * individuales.** No existe el dato «esta carta se quedó en la mano», «esta
 * nunca se jugó», «esta ganó la partida». Por eso acá no hay —ni puede haber—
 * una función que diga «tu Carta X está fallando»: sería inventarlo.
 *
 * Lo único que se afirma de una carta es lo que mide `/probar`: «cambiar X por
 * Y midió N puntos contra tal rival». Todo lo que sale de `candidatos()` es una
 * HIPÓTESIS para meter en el probador, no un hallazgo. De ahí `AVISO_HIPOTESIS`.
 *
 * ── El ruido no es un detalle, es la mitad del diseño ─────────────────
 *
 * Los dos umbrales de este archivo (`EMPATE_TECNICO` y `DELTA_MINIMO`) salen de
 * medir el propio simulador, no de elegir un número redondo. Están arriba de
 * todo, con su medición al lado, porque son la columna vertebral de que esta
 * pantalla no mienta.
 */

import type { Card, Deck, DeckCard } from '../../types'
import type { ResultadoRival } from './simApi'

// ─── Los umbrales de honestidad ──────────────────────────────────────────

/**
 * Partidas por medición. Están acá, y no en la UI, porque **los umbrales se
 * derivan de ellas**: subir las partidas sin recalibrar la franja de empate
 * dejaría la pantalla mintiendo en silencio, y era exactamente el riesgo de
 * tener el número en un lado y el umbral en el otro unidos por un comentario.
 *
 * Los tres topes los impone el proxy (`api/sim.ts`): `probar` corre DOS
 * simulaciones y las funciones de Vercel cortan a los ~10 s.
 */
export const PARTIDAS_GAUNTLET = 400
export const PARTIDAS_PROBAR = 1000
export const PARTIDAS_SIMULAR = 1500

/**
 * Margen de error al 95 % de una proporción cercana al 50 %, en puntos
 * porcentuales: 1,96 · √(0,25/n) · 100.
 *
 * No es una estimación de sobremesa: contrastado contra el propio simulador,
 * `/simular` con 1500 partidas devuelve `margen95: 2.5` y esta función da 2,5.
 * Todo lo que sigue sale de acá, así que cambiar un tamaño de muestra
 * recalibra la pantalla entera sola.
 */
export function margen95(partidas: number): number {
  return Math.round(196 * Math.sqrt(0.25 / partidas) * 10) / 10
}

/** Margen de UNA fila del guantelete (400 partidas): ±4,9 puntos. */
export const MARGEN_GAUNTLET = margen95(PARTIDAS_GAUNTLET)

/**
 * Margen de la DIFERENCIA entre dos filas del guantelete: ±6,9 puntos.
 *
 * Esta constante existe porque faltaba, y su ausencia sostenía una mentira.
 * Estar fuera de la franja de empate significa distinguible **del 50 %**, no
 * distinguible **entre sí**: dos rivales medidos por separado tienen cada uno
 * su error, y el de la resta crece √2 veces. Un 44,2 y un 40,1 no están
 * ordenados por nada — su diferencia es 4,1 y hace falta 6,9 para afirmarla.
 *
 * Por eso `pierde` y `gana` también salen alfabéticos, y por eso el
 * superlativo «donde más claramente perdés» solo se escribe cuando el segundo
 * está a más de este margen.
 */
export const MARGEN_DIFERENCIA = Math.round(MARGEN_GAUNTLET * Math.SQRT2 * 10) / 10

/** Margen de CADA extremo de `/probar` (1000 partidas): ±3,1 puntos. */
export const MARGEN_PROBAR = margen95(PARTIDAS_PROBAR)

/**
 * La franja donde un emparejamiento es EMPATE TÉCNICO.
 *
 * El guantelete corre 400 partidas por rival, o sea ±4,9 puntos: un rival que
 * marca 52 % podría estar realmente en 47,1 %, y uno que marca 48 % podría
 * estar en 52,9 %.
 *
 * Consecuencia práctica: **dentro de esta franja no se puede ordenar
 * «mejor/peor»**. Ordenarla por win rate es dibujar un ranking del ruido. Por
 * eso `diagnosticar()` devuelve los tres cajones ordenados alfabéticamente —
 * un orden que nadie va a confundir con una clasificación.
 */
export const EMPATE_TECNICO = {
  min: 50 - MARGEN_GAUNTLET,
  max: 50 + MARGEN_GAUNTLET,
} as const

/**
 * El delta mínimo de `/probar` que se puede reportar como mejora.
 *
 * `/probar` corre base y variante con la MISMA semilla (muestreo pareado), lo
 * que ya reduce mucho la varianza. Aun así, EL MISMO cambio medido a distintos
 * tamaños de muestra dio:
 *
 *     n=100  → +3,0      n=800  → −2,5      n=3000 → −4,9
 *     n=200  → +3,0      n=1600 → −3,2      n=6000 → −4,4
 *     n=400  →  0,0
 *
 * **El signo se da vuelta entre 400 y 800** y recién converge cerca de −4,5 a
 * las 3.000 partidas. El proxy (`api/sim.ts`) topa `probar` en **1000**, así
 * que a ese tamaño un delta de +3 es indistinguible de un −4,5 real.
 *
 * Regla: por debajo de 5 puntos se dice «dentro del margen de error». Nunca se
 * pinta como mejora. Ver `esReportable()`.
 */
export const DELTA_MINIMO = 5

/**
 * Los dos números de esa tabla que se le enseñan a la gente.
 *
 * Estaban escritos a mano en dos sitios de la UI, sueltos de `DELTA_MINIMO`:
 * volver a medir el ruido obligaba a tocar tres lugares y nada garantizaba que
 * coincidieran. Son la evidencia del umbral, así que viven con él.
 */
export const EVIDENCIA_DELTA = { alto: 3.0, bajo: -4.5 } as const

/**
 * Cuántas rondas de diferencia hacen falta para afirmar un patrón.
 *
 * Menos de una ronda entera de diferencia entre las derrotas y las victorias es
 * el mismo pecado que el delta de 2 puntos: una historia contada sobre ruido.
 * Sin señal, `patron` es `null` y se dice que no hay patrón.
 */
const DIFERENCIA_MINIMA_RONDAS = 1

/**
 * Emparejamientos mínimos de cada lado para promediar rondas.
 *
 * Con un solo emparejamiento ganado, «la ronda media de las victorias» es un
 * número suelto con su propio error encima. Dos es poco, pero ya es un promedio.
 */
const MIN_EMPAREJAMIENTOS_PATRON = 2

/**
 * Tope de candidatos.
 *
 * Cada uno se termina midiendo con un `probar` de 1000 partidas, que en el VPS
 * (2 núcleos COMPARTIDOS con ~20 contenedores: HERMES, NOVIX, Genesis) tarda
 * 3-6 s. Seis candidatos secuenciales son ~30 s de CPU que le sacamos al resto.
 * No es dinero, pero es de alguien más.
 */
const MAX_CANDIDATOS = 6

/** Aspecto que no se pudo resolver. Se agrupa aparte en vez de repartirlo. */
const FAMILIA_DESCONOCIDA = 'Sin aspecto'

/**
 * La frase que tiene que acompañar a cualquier lista de candidatos.
 *
 * El motor no mide cartas (ver cabecera). Un candidato es una hipótesis que
 * todavía no midió nadie; presentarla como mejora sería exactamente lo que este
 * archivo existe para evitar.
 */
export const AVISO_HIPOTESIS =
  'Estas son hipótesis para medir, no mejoras medidas: el simulador no rastrea ' +
  'cartas sueltas. Pasá cada cambio por el probador antes de creerle.'

// ─── Tipos ───────────────────────────────────────────────────────────────

/**
 * Un rival con su aspecto ya resuelto.
 *
 * El aspecto sale de la base de cartas local (Dexie), pero esta función es
 * pura: quien la llame se encarga de traerlo. Acá solo se agrupa.
 */
export interface RivalEnriquecido {
  slug: string
  lider: string
  base: string | null
  /** Aspecto dominante del líder rival (Vigilance, Aggression, Cunning…). */
  familia: string
  /**
   * El color de la base, que cambia la lectura del emparejamiento: una base
   * de color regala un aspecto (más consistencia de plan) y una sin color lo
   * cambia por vida extra — Data Vault son 33 PV, no 30. `null` = sin color,
   * que ES información, no ausencia de dato.
   */
  baseAspecto: string | null
  /** La vida de la base. `null` solo si la carta no resolvió en la base local. */
  baseVida: number | null
}

export interface RivalDiag {
  slug: string
  lider: string
  base: string | null
  win: number
  rondas: number
  /** El aspecto dominante del rival. */
  familia: string
  baseAspecto: string | null
  baseVida: number | null
}

export type Patron = 'te-atropellan' | 'sin-gasolina' | 'mixto' | null

/**
 * Contra quién se miden los cambios, y cuánto se puede AFIRMAR de esa elección.
 *
 * `claro` = está fuera de la franja de empate, o sea distinguible del 50 %.
 * `destacado` = además el segundo peor está a más de `MARGEN_DIFERENCIA`, que
 * es lo ÚNICO que autoriza a llamarlo «donde más claramente perdés». Sin esa
 * separación se elige igual (hay que medir contra alguien) pero no se rotula
 * como máximo: a ±6,9 puntos de resolución, el segundo podría ser el peor.
 */
export interface EleccionRival {
  fila: RivalDiag
  claro: boolean
  destacado: boolean
}

export interface FamiliaDiag {
  familia: string
  media: number
  n: number
  /** Margen 95 % de esa media: `n` rivales × 400 partidas cada uno. */
  margen: number
}

export interface Diagnostico {
  /**
   * Derrotas claras (por debajo de la franja de empate), **alfabéticas**.
   *
   * No van de peor a menos mala: la diferencia entre dos filas necesita 6,9
   * puntos para ser afirmable (ver `MARGEN_DIFERENCIA`) y casi nunca los tiene.
   * Lo que sí se afirma es la pertenencia al cajón, no el puesto dentro.
   */
  pierde: RivalDiag[]
  /** EMPATE TÉCNICO. Alfabético, por la misma razón. */
  parejo: RivalDiag[]
  /** Victorias claras (por encima de la franja). Alfabético, misma razón. */
  gana: RivalDiag[]
  /** Cómo perdés, leído de las rondas. `null` cuando no hay señal. */
  patron: Patron
  /** La frase que justifica el patrón CON los números que lo sostienen. */
  patronPorque: string
  /** Media de win por aspecto rival, con su margen. **Alfabético, no por media.** */
  porFamilia: FamiliaDiag[]
  /** El emparejamiento contra el que medir cambios, con lo que se puede decir de él. */
  pruebaContra: EleccionRival | null
}

export type MotivoCandidato = 'defensa-temprana' | 'valor'

export interface Candidato {
  /** La carta que ENTRA, tal como la nombra el simulador. */
  entra: { id: string; nombre: string; coste: number | null }
  /** La carta del mazo que sale para hacerle sitio. */
  sale: { cardId: string; nombre: string; coste: number | null }
  /**
   * ¿La persona YA la tiene?
   *
   * Es lo único que HOLOCRON sabe y el simulador no, y es lo que separa una
   * sugerencia útil de una lista de compras: un cambio que puede armar hoy.
   */
  enColeccion: boolean
  /** Por qué este cambio, en una frase, con el número que lo motiva. */
  porque: string
  /** Motivo estructural, para que la UI agrupe sin parsear la frase. */
  motivo: MotivoCandidato
}

// ─── Utilidades ──────────────────────────────────────────────────────────

/** Un decimal con coma, como se escribe en español. */
function n1(v: number): string {
  return v.toFixed(1).replace('.', ',')
}

function media(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function nombreCompleto(c: { name: string; subtitle: string | null }): string {
  return c.subtitle ? `${c.name} | ${c.subtitle}` : c.name
}

function clave(s: string): string {
  return s.trim().toLowerCase()
}

// ─── 1 · Diagnóstico ─────────────────────────────────────────────────────

/**
 * Reparte los 22 resultados en tres cajones y lee cómo perdés.
 *
 * `resultados` es lo que devuelve el guantelete; `rivales` son los 22 con su
 * aspecto ya resuelto. Un resultado sin rival conocido no se descarta: se
 * muestra igual con lo que trae, porque perder contra algo que no supimos
 * etiquetar sigue siendo perder.
 */
export function diagnosticar(
  resultados: readonly ResultadoRival[],
  rivales: readonly RivalEnriquecido[],
): Diagnostico {
  const porSlug = new Map(rivales.map((r) => [r.slug, r]))

  const filas: RivalDiag[] = resultados.map((r) => {
    const info = porSlug.get(r.rival)
    return {
      slug: r.rival,
      lider: info?.lider || r.lider || r.rival,
      base: info?.base ?? null,
      win: r.win,
      rondas: r.rondas,
      familia: info?.familia || FAMILIA_DESCONOCIDA,
      baseAspecto: info?.baseAspecto ?? null,
      baseVida: info?.baseVida ?? null,
    }
  })

  // Alfabético en los TRES cajones, no por win. Ver `MARGEN_DIFERENCIA`: el
  // cajón sí se puede afirmar (cada fila está o no fuera de la franja del
  // 50 %), pero el puesto DENTRO del cajón necesita 6,9 puntos de separación
  // que casi nunca hay. Ordenar por win ahí dibujaba una clasificación del
  // ruido con la misma cara que la de `parejo`, que ya se había desactivado.
  const alfabetico = (a: RivalDiag, b: RivalDiag) => a.lider.localeCompare(b.lider, 'es')

  const pierde = filas.filter((f) => f.win < EMPATE_TECNICO.min).sort(alfabetico)
  const gana = filas.filter((f) => f.win > EMPATE_TECNICO.max).sort(alfabetico)
  const parejo = filas
    .filter((f) => f.win >= EMPATE_TECNICO.min && f.win <= EMPATE_TECNICO.max)
    .sort(alfabetico)

  const { patron, patronPorque } = leerPatron(pierde, gana)

  return {
    pierde, parejo, gana, patron, patronPorque,
    porFamilia: agruparFamilias(filas),
    pruebaContra: elegirRival(filas),
  }
}

/**
 * Contra quién medir los cambios, y cuánto se puede decir de esa elección.
 *
 * Se toma el de menor win rate porque hay que medir contra alguien y ese es el
 * mejor candidato disponible. Lo que NO se hace es llamarlo «el peor» por el
 * solo hecho de haber salido primero de un `sort`: eso solo se afirma cuando el
 * segundo está a más de `MARGEN_DIFERENCIA`, que es la resolución real que
 * tiene el guantelete para comparar dos filas entre sí.
 */
function elegirRival(filas: readonly RivalDiag[]): EleccionRival | null {
  const orden = [...filas].sort((a, b) => a.win - b.win || a.lider.localeCompare(b.lider, 'es'))
  const peor = orden[0]
  if (!peor) return null
  const segundo = orden[1]
  return {
    fila: peor,
    claro: peor.win < EMPATE_TECNICO.min,
    destacado: !segundo || segundo.win - peor.win >= MARGEN_DIFERENCIA,
  }
}

/**
 * Cómo perdés, leído de las rondas.
 *
 * Aviso honesto sobre el dato: `rondas` es la duración media de TODAS las
 * partidas de ese emparejamiento, no solo de las que perdiste — el motor no
 * separa una cosa de la otra. Comparar la media de los emparejamientos que
 * perdés contra la de los que ganás sigue siendo direccional (un rival que te
 * gana rápido baja su media), pero no es «la ronda media de tus derrotas».
 * Por eso el umbral es de una ronda entera y no de dos décimas.
 */
function leerPatron(
  pierde: readonly RivalDiag[],
  gana: readonly RivalDiag[],
): { patron: Patron; patronPorque: string } {
  if (pierde.length < MIN_EMPAREJAMIENTOS_PATRON || gana.length < MIN_EMPAREJAMIENTOS_PATRON) {
    return {
      patron: null,
      patronPorque:
        `Hacen falta al menos ${MIN_EMPAREJAMIENTOS_PATRON} emparejamientos ganados y ` +
        `${MIN_EMPAREJAMIENTOS_PATRON} perdidos para promediar rondas; hay ${gana.length} ` +
        `y ${pierde.length}.`,
    }
  }

  const rp = media(pierde.map((f) => f.rondas))
  const rg = media(gana.map((f) => f.rondas))
  const dif = rp - rg

  if (dif <= -DIFERENCIA_MINIMA_RONDAS) {
    return {
      patron: 'te-atropellan',
      patronPorque:
        `Perdés en ${n1(rp)} rondas y ganás en ${n1(rg)}: las derrotas se terminan ` +
        `${n1(-dif)} rondas antes, o sea que te ganan mientras el mazo todavía arranca.`,
    }
  }

  if (dif >= DIFERENCIA_MINIMA_RONDAS) {
    return {
      patron: 'sin-gasolina',
      patronPorque:
        `Perdés en ${n1(rp)} rondas y ganás en ${n1(rg)}: las derrotas duran ` +
        `${n1(dif)} rondas MÁS, o sea que llegás al final y ahí se te acaba.`,
    }
  }

  // El promedio empatado puede esconder dos derrotas distintas apiladas: unas
  // cortas y otras largas que se cancelan. Eso no es «sin señal», es señal en
  // dos direcciones — y solo se afirma con al menos dos emparejamientos de cada
  // clase, para que un caso suelto no invente la historia.
  const cortas = pierde.filter((f) => f.rondas <= rg - DIFERENCIA_MINIMA_RONDAS)
  const largas = pierde.filter((f) => f.rondas >= rg + DIFERENCIA_MINIMA_RONDAS)
  if (cortas.length >= 2 && largas.length >= 2) {
    return {
      patron: 'mixto',
      patronPorque:
        `Ganás en ${n1(rg)} rondas, pero perdés de dos maneras: ${cortas.length} ` +
        `emparejamientos en ${n1(media(cortas.map((f) => f.rondas)))} rondas y ` +
        `${largas.length} en ${n1(media(largas.map((f) => f.rondas)))}. El promedio ` +
        `los cancela; son dos problemas, no uno.`,
    }
  }

  return {
    patron: null,
    patronPorque:
      `Perdés en ${n1(rp)} rondas y ganás en ${n1(rg)}: menos de una ronda de ` +
      `diferencia, así que no hay patrón que afirmar.`,
  }
}

/**
 * Media de win por aspecto rival, **alfabética**, con el margen de cada media.
 *
 * Antes salía de peor a mejor media, que es el mismo ranking del ruido de
 * siempre con otro disfraz: una familia de un solo rival es una fila suelta con
 * ±4,9 encima, y dos familias en 48,5 y 51,5 quedaban ordenadas como si eso
 * significara algo. El margen viaja en la estructura para que la UI no pueda
 * pintar la media sin él.
 */
function agruparFamilias(filas: readonly RivalDiag[]): FamiliaDiag[] {
  const acc = new Map<string, { suma: number; n: number }>()
  for (const f of filas) {
    const a = acc.get(f.familia) ?? { suma: 0, n: 0 }
    a.suma += f.win
    a.n += 1
    acc.set(f.familia, a)
  }
  return [...acc.entries()]
    .map(([familia, a]) => ({
      familia,
      media: a.suma / a.n,
      n: a.n,
      // n rivales × 400 partidas cada uno: el margen de la media baja con √n.
      margen: margen95(PARTIDAS_GAUNTLET * a.n),
    }))
    .sort((x, y) => x.familia.localeCompare(y.familia, 'es'))
}

// ─── 2 · Candidatos ──────────────────────────────────────────────────────

/**
 * Roba o busca cartas.
 *
 * El texto de la base local viene en inglés. El patrón exige el objeto («draw
 * a card», «draw 2 cards») a propósito: un `/draw/` pelado también engancha
 * «your opponent draws a card», que es lo contrario de generar valor.
 */
const RE_ROBA = /\bdraws?\s+(?:a|an|another|\d+|x)\s+cards?\b|\bsearch\s+your\s+deck\b/i

/** Nombre del jugador que roba, para no contar el robo del rival como valor. */
const RE_ROBA_RIVAL = /\bopponent(?:'s)?\s+draws?\b|\bopponent\s+may\s+draw\b/i

/**
 * ¿La carta TIENE Sentinel? Solo por palabra clave.
 *
 * Antes valía cualquier `/\bsentinel\b/` en el texto, y eso mete cartas que
 * apenas lo MENCIONAN («…defeat a Sentinel unit», «each of your units gains
 * Sentinel») como si el cuerpo propuesto lo tuviera. Es la misma clase de
 * afirmación inventada que este archivo existe para evitar, y el error caía
 * del lado peligroso: se le proponía a la gente «un cuerpo con Sentinel» que
 * no lo era. La palabra clave es un hecho de la carta; el texto es prosa.
 */
function tieneSentinel(c: Card): boolean {
  return c.keywords.some((k) => clave(k) === 'sentinel')
}

function generaValor(c: Card): boolean {
  return RE_ROBA.test(c.text) && !RE_ROBA_RIVAL.test(c.text)
}

function jugable(c: Card): boolean {
  return c.type !== 'Leader' && c.type !== 'Base'
}

/** Índices del pool para resolver una línea de mazo a una carta real. */
interface IndicePool {
  porId: Map<string, Card>
  porLegacy: Map<string, Card>
  porNombre: Map<string, Card>
  /** Una fila por carta: sin esto, las 9.057 impresiones inundan la lista. */
  unicas: Card[]
}

function indexar(pool: readonly Card[]): IndicePool {
  const porId = new Map<string, Card>()
  const porLegacy = new Map<string, Card>()
  const porNombre = new Map<string, Card>()
  const unicas: Card[] = []

  const mejor = (previa: Card | undefined, nueva: Card) =>
    !previa || (nueva.isCanonical === true && previa.isCanonical !== true)

  for (const c of pool) {
    porId.set(c.id, c)
    if (c.legacyId && mejor(porLegacy.get(c.legacyId), c)) porLegacy.set(c.legacyId, c)
    const k = clave(nombreCompleto(c))
    const previa = porNombre.get(k)
    if (mejor(previa, c)) porNombre.set(k, c)
  }
  for (const c of porNombre.values()) unicas.push(c)

  return { porId, porLegacy, porNombre, unicas }
}

function resolver(dc: DeckCard, idx: IndicePool): Card | undefined {
  return idx.porId.get(dc.cardId)
    ?? idx.porLegacy.get(dc.cardId)
    ?? idx.porNombre.get(clave(nombreCompleto(dc)))
}

/** Cuántas veces está disponible cada aspecto: líder(es) + base. */
function aspectosDisponibles(mazo: Deck, idx: IndicePool): Map<string, number> | null {
  const cabeza: Card[] = []
  for (const l of mazo.leaders) {
    const c = resolver(l, idx)
    if (c) cabeza.push(c)
  }
  const b = mazo.base ? resolver(mazo.base, idx) : undefined
  if (b) cabeza.push(b)

  // Sin líder NI base resueltos no se sabe qué aspectos tiene el mazo sin
  // penalización, y sugerir a ciegas mete cartas que pagan +2 de coste. Eso es
  // peor que no sugerir nada, así que no se sugiere nada.
  if (cabeza.length === 0) return null

  const disp = new Map<string, number>()
  for (const c of cabeza) {
    for (const a of c.aspects) disp.set(a, (disp.get(a) ?? 0) + 1)
  }
  return disp
}

/**
 * ¿Entra sin pagar penalización?
 *
 * La comparación es de MULTICONJUNTO, no de conjunto: una carta que pide dos
 * Aggression contra un mazo con una sola sigue pagando el sobrecoste.
 */
function sinPenalizacion(c: Card, disponibles: Map<string, number>): boolean {
  const pide = new Map<string, number>()
  for (const a of c.aspects) pide.set(a, (pide.get(a) ?? 0) + 1)
  for (const [a, n] of pide) {
    if ((disponibles.get(a) ?? 0) < n) return false
  }
  return true
}

const COSTE_DEFENSA_TEMPRANA = 3

/**
 * Qué probar para arreglar lo que el diagnóstico encontró.
 *
 * `pool` son las cartas de la base local, `coleccion` los ids que la persona
 * tiene (`collectionService` → `CollectionItem.cardId`, que es `Card.id`).
 *
 * Ninguno de estos candidatos está medido. Ver `AVISO_HIPOTESIS`.
 */
export function candidatos(
  mazo: Deck,
  diagnostico: Diagnostico,
  pool: readonly Card[],
  coleccion: ReadonlySet<string>,
): Candidato[] {
  const idx = indexar(pool)
  const disponibles = aspectosDisponibles(mazo, idx)
  if (!disponibles) return []

  /**
   * Copias que ya hay en el mazo, indexadas por NOMBRE, no por `id`.
   *
   * El 74 % de las 9.057 filas son impresiones alternativas de la misma carta.
   * Con el índice por `id`, un mazo que guardó el uuid de una impresión no
   * canónica contaba sus copias bajo ESE uuid, mientras `idx.unicas` trae la
   * canónica con otro — y `admisible()` veía 0 copias. Resultado: se podía
   * proponer una cuarta copia de una carta que ya estaba tres veces. Un
   * candidato ilegal por construcción. La identidad de una carta es su nombre.
   */
  const copias = new Map<string, number>()
  const enMazo: { dc: DeckCard; card: Card }[] = []
  for (const dc of mazo.mainDeck) {
    const card = resolver(dc, idx)
    if (!card) continue
    const k = clave(nombreCompleto(card))
    copias.set(k, (copias.get(k) ?? 0) + dc.quantity)
    enMazo.push({ dc, card })
  }
  if (enMazo.length === 0) return []

  const admisible = (c: Card) =>
    jugable(c) && sinPenalizacion(c, disponibles)
    && (copias.get(clave(nombreCompleto(c))) ?? 0) < 3

  /**
   * Qué cartas tiene la persona, también por nombre.
   *
   * Mismo problema de impresión, dirección opuesta: quien tenga la Hyperspace
   * de una carta guarda otro `id` que el canónico, así que el cruce por `id`
   * decía «no la tenés» de algo que sí tiene. Falso negativo, sí, pero falso.
   */
  const enColeccionPorNombre = new Set<string>()
  for (const id of coleccion) {
    const c = idx.porId.get(id) ?? idx.porLegacy.get(id)
    if (c) enColeccionPorNombre.add(clave(nombreCompleto(c)))
  }
  const tiene = (c: Card) => enColeccionPorNombre.has(clave(nombreCompleto(c)))

  // Prioriza lo que la persona YA TIENE: un cambio que puede armar hoy vale
  // más que uno perfecto que tendría que comprar. A igualdad, lo más barato.
  const ordenar = (a: Card, b: Card) =>
    Number(tiene(b)) - Number(tiene(a))
    || (a.cost ?? 99) - (b.cost ?? 99)
    || (b.hp ?? 0) - (a.hp ?? 0)
    || a.name.localeCompare(b.name, 'es')

  const defensa = idx.unicas
    .filter((c) => admisible(c) && c.type === 'Unit'
      && (c.cost ?? 99) <= COSTE_DEFENSA_TEMPRANA && tieneSentinel(c))
    .sort(ordenar)

  const valor = idx.unicas
    .filter((c) => admisible(c) && generaValor(c))
    .sort(ordenar)

  // Qué sale. Para el candidato de defensa temprana, lo más caro; para el de
  // valor, lo más barato que no roba ni busca. Son criterios de SELECCIÓN, no
  // afirmaciones sobre esas cartas: el motor no rastrea cartas y la frase que
  // acompaña al cambio no dice qué hicieron en partida (ver `frase()`).
  const salidasCaras = [...enMazo]
    .sort((a, b) => (b.card.cost ?? 0) - (a.card.cost ?? 0)
      || b.dc.quantity - a.dc.quantity
      || a.card.name.localeCompare(b.card.name, 'es'))

  const salidasFlojas = enMazo
    .filter(({ card }) => !generaValor(card))
    .sort((a, b) => (a.card.cost ?? 99) - (b.card.cost ?? 99)
      || b.dc.quantity - a.dc.quantity
      || a.card.name.localeCompare(b.card.name, 'es'))

  // Costes reales, sin los nulos. Un coste `null` (líderes, bases, alguna ficha)
  // metido como 0 hundía `costeMin` y desactivaba el superlativo por accidente:
  // salía bien por casualidad, no por diseño. Si no hay ni un coste numérico,
  // `describirSalida` se calla en vez de comparar contra un cero inventado.
  const costes = enMazo.map((e) => e.card.cost).filter((c): c is number => c !== null)
  const totalCopias = enMazo.reduce((s, e) => s + e.dc.quantity, 0)
  const costeMedio = totalCopias === 0 ? 0
    : enMazo.reduce((s, e) => s + (e.card.cost ?? 0) * e.dc.quantity, 0) / totalCopias
  const costeMax = costes.length > 0 ? Math.max(...costes) : null
  const costeMin = costes.length > 0 ? Math.min(...costes) : null

  const elegidos: { card: Card; motivo: MotivoCandidato }[] = []
  if (diagnostico.patron === 'te-atropellan') {
    elegidos.push(...defensa.slice(0, MAX_CANDIDATOS).map((c) => ({ card: c, motivo: 'defensa-temprana' as const })))
  } else if (diagnostico.patron === 'sin-gasolina') {
    elegidos.push(...valor.slice(0, MAX_CANDIDATOS).map((c) => ({ card: c, motivo: 'valor' as const })))
  } else {
    // Sin patrón (o con los dos a la vez) no hay motivo para apostar a una sola
    // cosa: mitad y mitad, intercaladas para que la lista no arranque sesgada.
    const mitad = MAX_CANDIDATOS / 2
    const a = defensa.slice(0, mitad)
    const b = valor.slice(0, mitad)
    for (let i = 0; i < mitad; i++) {
      if (a[i]) elegidos.push({ card: a[i], motivo: 'defensa-temprana' })
      if (b[i]) elegidos.push({ card: b[i], motivo: 'valor' })
    }
  }

  const salida: Candidato[] = []
  const usadas = new Set<string>()

  for (const { card, motivo } of elegidos.slice(0, MAX_CANDIDATOS)) {
    const lista = motivo === 'defensa-temprana' ? salidasCaras : salidasFlojas
    // Cada candidato propone un cambio DISTINTO mientras haya cartas: seis
    // filas quitando la misma serían seis maneras de decir lo mismo. Si la
    // lista se agota se repite, que es honesto —son dos recambios alternativos
    // para el mismo hueco— y mejor que perder la sugerencia.
    //
    // La comparación es por NOMBRE, no por `id`: con dos impresiones de la
    // misma carta los uuid no coinciden y el cambio propuesto era «sacá X para
    // meter X», que el simulador mide como cero y la gente lee como una burla.
    const entraK = clave(nombreCompleto(card))
    const k = (s: { card: Card }) => clave(nombreCompleto(s.card))
    const elegida = lista.find((s) => !usadas.has(k(s)) && k(s) !== entraK)
      ?? lista.find((s) => k(s) !== entraK)
    if (!elegida) continue
    usadas.add(clave(nombreCompleto(elegida.card)))

    salida.push({
      entra: { id: card.id, nombre: nombreCompleto(card), coste: card.cost },
      sale: {
        cardId: elegida.dc.cardId,
        nombre: nombreCompleto(elegida.card),
        coste: elegida.card.cost,
      },
      enColeccion: tiene(card),
      porque: frase(
        motivo, card, elegida.card, diagnostico.patron,
        describirSalida(motivo, elegida.card, costeMax, costeMin, costeMedio),
      ),
      motivo,
    })
  }

  return salida
}

/**
 * Cómo describir la carta que sale SIN mentir.
 *
 * Dos reglas, y las dos costaron un hallazgo:
 *
 *  1. **El superlativo solo si es el extremo real.** El primer candidato saca
 *     de verdad la más cara del mazo; el tercero puede estar sacando una de
 *     coste 3. «De lo más caro» cuando está del lado correcto de la media, y
 *     nada cuando no.
 *  2. **«Sin efecto» era falso por construcción.** El filtro que arma esta
 *     lista es `!generaValor`, que es un regex de robo y búsqueda. Una carta
 *     con remove, daño, buff o recursión no roba y caía en «sin efecto» / «no
 *     repone nada». Se dice lo que el filtro comprueba de verdad: *sin robo ni
 *     búsqueda*. Y el sustantivo sale del `type` real, porque la lista tampoco
 *     filtra por tipo y un Evento salía descrito como «cuerpo».
 */
function describirSalida(
  motivo: MotivoCandidato,
  sale: Card,
  costeMax: number | null,
  costeMin: number | null,
  costeMedio: number,
): string {
  const c = sale.cost
  if (c === null) return ''

  if (motivo === 'defensa-temprana') {
    if (costeMax !== null && c >= costeMax) return 'lo más caro del mazo'
    if (c > costeMedio) return 'de lo más caro del mazo'
    return ''
  }

  const cosa = sale.type === 'Unit' ? 'la unidad' : 'la carta'
  if (costeMin !== null && c <= costeMin) return `${cosa} más barata sin robo ni búsqueda`
  if (c < costeMedio) return `de lo más barato sin robo ni búsqueda`
  return ''
}

/**
 * Por qué este cambio — SIN afirmar nada de lo que hizo una carta en partida.
 *
 * Esta función es donde se colaban tres mentiras a la vez, y las tres decían
 * cosas que el motor no puede saber:
 *
 *  · «que casi nunca se llega a jugar» y «que no repone nada» son afirmaciones
 *    sobre el comportamiento de UNA carta. El motor agrega por partida
 *    (ganador, rondas, vida de las bases) y no rastrea cartas — ver la cabecera
 *    de este archivo. No hay dato detrás de esas frases.
 *  · «en derrotas de 6,2 rondas» negaba el aviso que este mismo archivo escribe
 *    en `leerPatron`: `rondas` es la media de TODAS las partidas de ese
 *    emparejamiento, no de las que perdiste. El motor no separa una de otra.
 *  · Y las escribía IGUAL cuando `patron` era `null`, o sea contando seis veces
 *    en letra pequeña el diagnóstico que `leerPatron` acababa de negarse a
 *    afirmar.
 *
 * Lo que queda es lo comprobable: qué entra, con qué palabra clave, qué sale,
 * a qué coste — y de qué lectura del diagnóstico sale la idea, citando el
 * patrón cuando existe y admitiendo que se prueba a ciegas cuando no.
 */
function frase(
  motivo: MotivoCandidato,
  entra: Card,
  sale: Card,
  patron: Patron,
  descriptor: string,
): string {
  const entraPrecio = entra.cost === null ? '' : ` de coste ${entra.cost}`
  const salePrecio = sale.cost === null ? '' : ` (coste ${sale.cost})`
  const desc = descriptor ? `, ${descriptor}` : ''

  if (motivo === 'defensa-temprana') {
    const razon = patron === 'te-atropellan'
      ? 'El diagnóstico leyó «te atropellan», así que la hipótesis es tapar el suelo temprano.'
      : 'El diagnóstico no afirmó ese patrón: esta se prueba a ciegas.'
    return `Entra una unidad${entraPrecio} con Sentinel y sale ${nombreCompleto(sale)}${salePrecio}${desc}. ${razon}`
  }

  const razon = patron === 'sin-gasolina'
    ? 'El diagnóstico leyó «te quedás sin gasolina», así que la hipótesis es reponer más.'
    : 'El diagnóstico no afirmó ese patrón: esta se prueba a ciegas.'
  return `Entra una carta${entraPrecio} que roba o busca y sale ${nombreCompleto(sale)}${salePrecio}${desc}. ${razon}`
}

// ─── 3 · Lo que se puede reportar ────────────────────────────────────────

/**
 * ¿Este delta de `/probar` se puede mostrar como cambio, o es ruido?
 *
 * Ver `DELTA_MINIMO`: a 1000 partidas (el tope del proxy) el mismo cambio midió
 * +3,0 y −4,5 según la muestra. Todo lo que no llegue a 5 puntos se rotula
 * «dentro del margen de error» y NUNCA se pinta como mejora.
 */
export function esReportable(delta: number): boolean {
  return Math.abs(delta) >= DELTA_MINIMO
}

/**
 * ¿El cambio deja un mazo que se pueda seguir jugando?
 *
 * ── Lo que decía antes, y por qué era falso ───────────────────────────
 *
 * Esta función afirmaba que «`probar` rechaza todo mazo que no sume exactamente
 * 50 cartas» y bloqueaba el botón para cualquier mazo con base Data Vault.
 * Medido contra el servicio vivo, no es cierto: el tope de 50 vive en el
 * subcomando de LÍNEA DE COMANDOS de `swusim.py`, que el servidor HTTP nunca
 * llama. `POST /probar` con el mazo Luke/Data Vault de 66 cartas responde 200 y
 * devuelve su delta, igual que con uno de 49. O sea que la pantalla apagaba una
 * función que sí funciona y lo justificaba con un límite del motor que el motor
 * no tiene — mentira en la dirección contraria, pero mentira.
 *
 * Y el número tampoco era el del motor: `/validar` devuelve `minimo: 60` para
 * Data Vault. El 66 era el total de ese mazo concreto, no el mínimo de la base.
 * Por eso acá ya no hay ninguna constante inventada: el mínimo entra como
 * argumento y sale de `/validar`, que es quien lo sabe.
 *
 * ── Lo que comprueba ahora ────────────────────────────────────────────
 *
 * Lo único que sigue siendo cierto y le importa a quien juega: un cambio que
 * quita más de lo que mete puede dejar el mazo por debajo de su mínimo legal.
 * El simulador lo mide igual — y ese número sería el de un mazo que no se puede
 * llevar a un torneo. Vale para las dos rutas, la de mazo guardado y la de
 * lista pegada, porque las dos tienen informe.
 */
export function cambioViable(
  informe: { total: number; minimo: number },
  quita: number,
  mete: number,
): { viable: boolean; total: number; motivo: string | null } {
  const total = informe.total - quita + mete
  if (total >= informe.minimo) return { viable: true, total, motivo: null }
  return {
    viable: false,
    total,
    motivo:
      `Con ese cambio el mazo baja a ${total} cartas y el mínimo con esta base es ` +
      `${informe.minimo}. El simulador lo mediría igual, pero sería el número de un ` +
      `mazo que no se puede jugar.`,
  }
}

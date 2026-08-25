/**
 * LOS ASPECTOS — maestría de trivia, y lo único que se sube SABIENDO.
 *
 * ── Qué eran, y por qué no funcionaban ────────────────────────────────
 *
 * Eran ocho contadores renombrados: Vigilancia = partidas jugadas, Heroísmo =
 * cartas coleccionadas, Villanía = logros. Los mismos números que ya están en
 * otro lado, con nombre de aspecto encima. Y apuntados a cosas que en esta
 * comunidad casi no pasan.
 *
 * Medido el 2026-08-24 sobre las 39 cuentas, en el PRIMER escalón de cada uno:
 *
 *     Vigilancia   100 partidas → 0 personas   (el máximo real es 3)
 *     Comando      25 torneos   → 0            (el máximo real es 1)
 *     Agresión     50 victorias → 0            (el máximo real es 9)
 *     Astucia      25 mazos     → 0            (el máximo real es 10)
 *     Heroísmo     250 cartas   → 5
 *     Progreso     nivel 10     → 1
 *
 * Seis de ocho sin una sola persona, y no por poco: Vigilancia pedía 100
 * partidas cuando el que más jugó lleva 3. Una escalera cuyo primer escalón
 * está 33 veces más arriba de donde llega la gente no es difícil, es decorativa
 * — el mismo patrón que ya mató al motor de lealtad.
 *
 * ── Qué son ahora ─────────────────────────────────────────────────────
 *
 * Los SEIS aspectos de Star Wars: Unlimited (los de verdad, los que trae el
 * juego) y una sola forma de subirlos: acertar preguntas de trivia de ese
 * aspecto. Nada de partidas ni de cartas.
 *
 * Eso los vuelve la única progresión de la app que NO se compra ni se acumula
 * por estar: los créditos se ganan abriendo sobres, el nivel sube solo, las
 * piezas se pagan. Un aspecto alto dice que sabés de Star Wars, y esa es
 * exactamente la clase de cosa que vale la pena tener en un perfil.
 *
 * Progreso y Transmisiones se van: no son aspectos del juego, eran inventos
 * para llenar ocho casillas (nivel y regalos recibidos). Seis es lo que hay.
 */

/** Los seis aspectos de Star Wars: Unlimited. */
export const ASPECTOS = [
  'Heroism', 'Villainy', 'Aggression', 'Cunning', 'Vigilance', 'Command',
] as const

export type Aspecto = typeof ASPECTOS[number]

export interface FichaAspecto {
  nombre: string
  /** Una línea que dice qué preguntas lo suben. */
  detalle: string
  color: string
  borde: string
  texto: string
}

export const FICHA: Record<Aspecto, FichaAspecto> = {
  Heroism:    { nombre: 'Heroísmo',  detalle: 'Jedi, la Rebelión, el sacrificio.', color: '#facc15', borde: 'border-yellow-400/50', texto: 'text-yellow-300' },
  Villainy:   { nombre: 'Villanía',  detalle: 'Sith, el Imperio, el lado oscuro.', color: '#a855f7', borde: 'border-purple-400/50', texto: 'text-purple-300' },
  Aggression: { nombre: 'Agresión',  detalle: 'Batallas, criaturas, armas.',       color: '#ef4444', borde: 'border-red-400/50',    texto: 'text-red-300' },
  Cunning:    { nombre: 'Astucia',   detalle: 'Engaños, contrabando, reglas.',     color: '#eab308', borde: 'border-amber-400/50',  texto: 'text-amber-300' },
  Vigilance:  { nombre: 'Vigilancia',detalle: 'Mundos, historia, la Fuerza.',      color: '#3b82f6', borde: 'border-blue-400/50',   texto: 'text-blue-300' },
  Command:    { nombre: 'Comando',   detalle: 'Flotas, naves, quien manda.',       color: '#22c55e', borde: 'border-green-400/50',  texto: 'text-green-300' },
}

/**
 * Los escalones, en ACIERTOS de ese aspecto.
 *
 * Calibrados contra lo que la gente de verdad hace, no contra un número
 * redondo: se juegan 10 preguntas por día y una tanda reparte ~2 de cada
 * aspecto, así que el primer escalón cae en menos de una semana de jugar y el
 * último pide constancia real. Un escalón inalcanzable no es una meta.
 */
export const ESCALONES = [10, 30, 75, 150] as const

export const NOMBRE_ESCALON = ['Iniciado', 'Adepto', 'Maestro', 'Kyber'] as const

export interface NivelAspecto {
  aspecto: Aspecto
  aciertos: number
  /** −1 = todavía no llegó al primero. 0..3 = escalón alcanzado. */
  escalon: number
  /** Cómo se llama el escalón alcanzado, o `null`. */
  titulo: string | null
  /** Cuántos aciertos pide el siguiente, o `null` si ya está al tope. */
  siguiente: number | null
  /** 0..1 dentro del escalón actual. Para la barra. */
  avance: number
}

export function nivelDe(aspecto: Aspecto, aciertos: number): NivelAspecto {
  let escalon = -1
  for (let i = 0; i < ESCALONES.length; i++) {
    if (aciertos >= ESCALONES[i]) escalon = i
  }
  const siguiente = escalon + 1 < ESCALONES.length ? ESCALONES[escalon + 1] : null
  const desde = escalon >= 0 ? ESCALONES[escalon] : 0
  const avance = siguiente === null
    ? 1
    : Math.min(1, Math.max(0, (aciertos - desde) / (siguiente - desde)))
  return {
    aspecto,
    aciertos,
    escalon,
    titulo: escalon >= 0 ? NOMBRE_ESCALON[escalon] : null,
    siguiente,
    avance,
  }
}

/**
 * Lo que paga cada escalón, en créditos.
 *
 * Se cobra UNA vez por escalón y por aspecto. Es la parte que impide que esto
 * vuelva a ser una barra bonita que no hace nada — que fue exactamente el
 * problema de los aspectos viejos.
 */
export const PREMIO_ESCALON = [100, 250, 600, 1500] as const

/**
 * El aspecto de una pregunta que no lo trae escrito.
 *
 * Las 180 del banco viejo no tienen `aspecto`, y retaguetearlas a mano sería
 * un día de trabajo con más riesgo de error que de acierto. El tema ya las
 * agrupa por contenido, así que se deriva de ahí — y las preguntas nuevas sí
 * lo traen explícito, que es donde la precisión rinde.
 */
export const ASPECTO_POR_TEMA: Record<string, Aspecto> = {
  jedi: 'Heroism',
  sith: 'Villainy',
  criaturas: 'Aggression',
  planetas: 'Vigilance',
  naves: 'Command',
  juego: 'Cunning',
}

export function aspectoDe(p: { aspecto?: string; tema: string }): Aspecto {
  if (p.aspecto && (ASPECTOS as readonly string[]).includes(p.aspecto)) {
    return p.aspecto as Aspecto
  }
  return ASPECTO_POR_TEMA[p.tema] ?? 'Vigilance'
}

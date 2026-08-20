/**
 * Tipos del marcador de transmisión.
 *
 * El alcance es DELIBERADAMENTE corto: solo entra lo que el operador puede
 * verificar de un vistazo mientras narra. Quedan fuera recursos listos/exhaustos,
 * escudos, experiencia, épica usada, cartas en mano y cartas en mazo — cambian
 * varias veces por turno, el operador queda atrás y el marcador miente.
 * Un marcador equivocado al aire es peor que no tener marcador.
 */

export type Escena = 'pronto' | 'juego' | 'descanso' | 'fin'

/** Un lado de la mesa. */
export interface LadoOverlay {
  nombre: string
  liderNombre: string
  liderImg: string
  /** Vigilance | Command | Aggression | Cunning | Heroism | Villainy */
  liderAspectos: string[]
  liderDesplegado: boolean
  baseNombre: string
  baseImg: string
  baseAspectos: string[]
  /** HP impreso de la base. Va de 24 a 35 según la carta — NUNCA 30 fijo. */
  hpMax: number
  /** Se cuenta DAÑO, igual que el dial físico sobre la mesa. */
  dano: number
  /** Total de recursos. No se separa listo/exhausto a propósito. */
  recursos: number
  juegosGanados: number
  /**
   * Última carta jugada, mostrada EN GRANDE en el panel lateral.
   *
   * Es la única forma real de que el espectador lea una carta: en la mesa una
   * carta mide 96×134 px y su texto 2,3 px — ocho veces por debajo del umbral
   * de lectura. Acá se muestra el arte a tamaño legible.
   */
  jugadaNombre: string
  jugadaImg: string
  jugadaSub: string
}

export interface RelojOverlay {
  duracionMs: number
  /** Epoch ms del arranque. `null` = detenido. */
  iniciadoEn: number | null
  /** Lo que quedaba cuando se pausó. `null` = nunca se pausó. */
  restanteAlPausar: number | null
}

export interface CartaDestacada {
  nombre: string
  subtitulo: string
  texto: string
  img: string
  /** Epoch ms hasta el que se muestra. Se auto-oculta sola. */
  hasta: number
}

/**
 * La identidad visual de la cabina.
 *
 * Existe para que la herramienta NO sea «el overlay de El Salvador»: cada
 * creador sube su logo y elige sus colores. Los valores por defecto son
 * neutros a propósito — quien no configure nada obtiene algo sobrio, no la
 * marca de otra comunidad.
 */
export interface MarcaOverlay {
  /** Rótulo de las pantallas de espera. Ej: «CHAVO RUCOS». */
  nombre: string
  /** Línea chica bajo el nombre. Ej: «MÉXICO» o el nombre del torneo. */
  lema: string
  logoUrl: string
  fondoUrl: string
  /** Color de los paneles. */
  primario: string
  /** Color de los filos, rótulos e INICIATIVA. */
  acento: string
  /** El filo tricolor y el volcán: propios de El Salvador, apagables. */
  motivoLocal: boolean
  /** Editable: cada comunidad tiene su propia fórmula. */
  avisoLegal: string
}

export const MARCA_POR_DEFECTO: MarcaOverlay = {
  nombre: '',
  lema: '',
  logoUrl: '',
  fondoUrl: '',
  primario: '#0A2E6E',
  acento: '#E8B849',
  motivoLocal: false,
  avisoLegal:
    'COBERTURA COMUNITARIA · HECHA POR FANS · NO OFICIAL · NO AFILIADA A FANTASY FLIGHT GAMES, ASMODEE NI LUCASFILM',
}

export interface EstadoOverlay {
  v: 1
  marca: MarcaOverlay
  escena: Escena
  /** "RONDA 3" · "TOP 4" · "FINAL" */
  etiquetaRonda: string
  juego: number
  /** Índice del lado con la iniciativa. `null` = todavía no se sabe. */
  iniciativa: 0 | 1 | null
  /** Fase de acción adicional: banner rojo + resalta HP restante e iniciativa. */
  tiempoExtra: boolean
  /** Congela el marcador cuando llaman al juez o se rehace una partida. */
  enRevision: boolean
  reloj: RelojOverlay
  /** Texto libre de las escenas opacas. */
  mensaje: string
  patrocinio: string
  /**
   * Barra de noticias que corre abajo: mensajes de la comunidad, saludos,
   * avisos del torneo. Un mensaje por línea; el overlay los une con un
   * separador y los hace rotar en bucle.
   */
  ticker: string
  tickerVisible: boolean
  /**
   * Enlace de YouTube del directo, para que la pantalla pública de la app
   * (`/envivo`) lo incruste. Admite el enlace completo, el id del video o el
   * id del canal — se normaliza al construir la URL de incrustación.
   */
  youtube: string
  /** El operador anuncia que hay transmisión: la app la muestra a todos. */
  envivo: boolean
  lados: [LadoOverlay, LadoOverlay]
  carta: CartaDestacada | null
}

const LADO_VACIO: LadoOverlay = {
  nombre: '',
  liderNombre: '',
  liderImg: '',
  liderAspectos: [],
  liderDesplegado: false,
  baseNombre: '',
  baseImg: '',
  baseAspectos: [],
  hpMax: 30,
  dano: 0,
  recursos: 0,
  juegosGanados: 0,
  jugadaNombre: '',
  jugadaImg: '',
  jugadaSub: '',
}

export const ESTADO_INICIAL: EstadoOverlay = {
  v: 1,
  marca: { ...MARCA_POR_DEFECTO },
  escena: 'pronto',
  etiquetaRonda: 'RONDA 1',
  juego: 1,
  iniciativa: null,
  tiempoExtra: false,
  enRevision: false,
  reloj: { duracionMs: 55 * 60 * 1000, iniciadoEn: null, restanteAlPausar: null },
  mensaje: '',
  patrocinio: '',
  ticker: '',
  tickerVisible: false,
  youtube: '',
  envivo: false,
  lados: [{ ...LADO_VACIO }, { ...LADO_VACIO }],
  carta: null,
}

const ESCENAS: Escena[] = ['pronto', 'juego', 'descanso', 'fin']

function texto(x: unknown, porDefecto = ''): string {
  return typeof x === 'string' ? x : porDefecto
}

function entero(x: unknown, porDefecto: number, min: number, max: number): number {
  const n = typeof x === 'number' && Number.isFinite(x) ? Math.round(x) : porDefecto
  return Math.min(max, Math.max(min, n))
}

function booleano(x: unknown, porDefecto = false): boolean {
  return typeof x === 'boolean' ? x : porDefecto
}

function normalizarLado(x: unknown): LadoOverlay {
  const o = (x ?? {}) as Record<string, unknown>
  const hpMax = entero(o.hpMax, 30, 1, 99)
  return {
    nombre: texto(o.nombre),
    liderNombre: texto(o.liderNombre),
    liderImg: texto(o.liderImg),
    liderAspectos: Array.isArray(o.liderAspectos)
      ? o.liderAspectos.filter((a): a is string => typeof a === 'string').slice(0, 4)
      : [],
    liderDesplegado: booleano(o.liderDesplegado),
    baseNombre: texto(o.baseNombre),
    baseImg: texto(o.baseImg),
    baseAspectos: Array.isArray(o.baseAspectos)
      ? o.baseAspectos.filter((a): a is string => typeof a === 'string').slice(0, 2)
      : [],
    hpMax,
    // El daño se acota al HP máximo: no se puede pintar un imposible aunque
    // la fila venga de una versión vieja con otra base.
    dano: entero(o.dano, 0, 0, hpMax),
    recursos: entero(o.recursos, 0, 0, 30),
    juegosGanados: entero(o.juegosGanados, 0, 0, 3),
    jugadaNombre: texto(o.jugadaNombre),
    jugadaImg: texto(o.jugadaImg),
    jugadaSub: texto(o.jugadaSub),
  }
}

function normalizarReloj(x: unknown): RelojOverlay {
  const o = (x ?? {}) as Record<string, unknown>
  return {
    duracionMs: entero(o.duracionMs, ESTADO_INICIAL.reloj.duracionMs, 0, 6 * 60 * 60 * 1000),
    iniciadoEn: typeof o.iniciadoEn === 'number' && Number.isFinite(o.iniciadoEn) ? o.iniciadoEn : null,
    restanteAlPausar:
      typeof o.restanteAlPausar === 'number' && Number.isFinite(o.restanteAlPausar)
        ? o.restanteAlPausar
        : null,
  }
}

function normalizarCarta(x: unknown): CartaDestacada | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const nombre = texto(o.nombre)
  if (!nombre) return null
  return {
    nombre,
    subtitulo: texto(o.subtitulo),
    texto: texto(o.texto),
    img: texto(o.img),
    hasta: typeof o.hasta === 'number' && Number.isFinite(o.hasta) ? o.hasta : 0,
  }
}

function normalizarMarca(x: unknown): MarcaOverlay {
  const o = (x ?? {}) as Record<string, unknown>
  // Un color inválido rompería el render entero; se acota a #rgb/#rrggbb.
  const color = (v: unknown, porDefecto: string) =>
    typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v.trim()) ? v.trim() : porDefecto
  return {
    nombre: texto(o.nombre),
    lema: texto(o.lema),
    logoUrl: texto(o.logoUrl),
    fondoUrl: texto(o.fondoUrl),
    primario: color(o.primario, MARCA_POR_DEFECTO.primario),
    acento: color(o.acento, MARCA_POR_DEFECTO.acento),
    motivoLocal: booleano(o.motivoLocal),
    avisoLegal: texto(o.avisoLegal, MARCA_POR_DEFECTO.avisoLegal),
  }
}

/**
 * Convierte cualquier cosa que venga de la base en un estado pintable.
 *
 * No es opcional ni defensivo por gusto: es el seguro de que una fila vieja,
 * a medio escribir o de otra versión NUNCA deje el overlay en blanco al aire.
 * Cada campo tiene su valor por defecto; nada puede llegar `undefined` al render.
 */
export function normalizarEstado(x: unknown): EstadoOverlay {
  const o = (x ?? {}) as Record<string, unknown>
  const lados = Array.isArray(o.lados) ? o.lados : []
  const iniciativa = o.iniciativa === 0 || o.iniciativa === 1 ? o.iniciativa : null

  return {
    v: 1,
    marca: normalizarMarca(o.marca),
    escena: ESCENAS.includes(o.escena as Escena) ? (o.escena as Escena) : 'pronto',
    etiquetaRonda: texto(o.etiquetaRonda, ESTADO_INICIAL.etiquetaRonda),
    juego: entero(o.juego, 1, 1, 5),
    iniciativa,
    tiempoExtra: booleano(o.tiempoExtra),
    enRevision: booleano(o.enRevision),
    reloj: normalizarReloj(o.reloj),
    mensaje: texto(o.mensaje),
    patrocinio: texto(o.patrocinio),
    ticker: texto(o.ticker),
    tickerVisible: booleano(o.tickerVisible),
    youtube: texto(o.youtube),
    envivo: booleano(o.envivo),
    lados: [normalizarLado(lados[0]), normalizarLado(lados[1])],
    carta: normalizarCarta(o.carta),
  }
}

/**
 * Convierte lo que pegue el operador en una URL de incrustación de YouTube.
 *
 * Acepta las formas que YouTube reparte en la práctica: el enlace de ver, el
 * corto de youtu.be, el nuevo /live/, el id pelado y el id de canal. Con el
 * canal se usa `live_stream`, que sirve SIEMPRE lo que esté en directo — así
 * el enlace no hay que cambiarlo entre transmisión y transmisión.
 *
 * Devuelve `null` si no reconoce nada: la pantalla pública prefiere decir
 * «no hay transmisión» antes que incrustar un iframe roto.
 */
export function urlIncrustarYoutube(entrada: string, origen?: string): string | null {
  const v = entrada.trim()
  if (!v) return null

  const params = origen ? `?rel=0&modestbranding=1&playsinline=1&origin=${encodeURIComponent(origen)}` : '?rel=0&modestbranding=1&playsinline=1'

  // Id de canal (UC...) suelto o dentro de una URL → el directo del canal.
  const canal = v.match(/(?:channel\/)?(UC[\w-]{20,})/)
  if (canal) return `https://www.youtube.com/embed/live_stream${params}&channel=${canal[1]}`

  // Id de video en cualquiera de sus URLs.
  const video =
    v.match(/(?:youtu\.be\/|watch\?v=|\/live\/|\/embed\/|\/shorts\/)([\w-]{11})/) ??
    v.match(/^([\w-]{11})$/)
  if (video) return `https://www.youtube.com/embed/${video[1]}${params}`

  return null
}

/** Los mensajes del ticker, ya limpios y sin líneas vacías. */
export function mensajesTicker(ticker: string): string[] {
  return ticker
    .split('\n')
    .map(m => m.trim())
    .filter(Boolean)
}

/** Milisegundos restantes del reloj, o `null` si nunca se arrancó. */
export function restanteReloj(r: RelojOverlay, ahora: number): number | null {
  if (r.iniciadoEn !== null) return Math.max(0, r.iniciadoEn + r.duracionMs - ahora)
  if (r.restanteAlPausar !== null) return Math.max(0, r.restanteAlPausar)
  return r.duracionMs
}

/** `55:00` — siempre mm:ss, sin horas: ninguna ronda pasa de 99 minutos. */
export function formatearReloj(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const min = Math.floor(total / 60)
  const seg = total % 60
  return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`
}

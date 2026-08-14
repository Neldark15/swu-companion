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
  /** HP impreso de la base. Va de 24 a 35 según la carta — NUNCA 30 fijo. */
  hpMax: number
  /** Se cuenta DAÑO, igual que el dial físico sobre la mesa. */
  dano: number
  /** Total de recursos. No se separa listo/exhausto a propósito. */
  recursos: number
  juegosGanados: number
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

export interface EstadoOverlay {
  v: 1
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
  hpMax: 30,
  dano: 0,
  recursos: 0,
  juegosGanados: 0,
}

export const ESTADO_INICIAL: EstadoOverlay = {
  v: 1,
  escena: 'pronto',
  etiquetaRonda: 'RONDA 1',
  juego: 1,
  iniciativa: null,
  tiempoExtra: false,
  enRevision: false,
  reloj: { duracionMs: 55 * 60 * 1000, iniciadoEn: null, restanteAlPausar: null },
  mensaje: '',
  patrocinio: '',
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
    hpMax,
    // El daño se acota al HP máximo: no se puede pintar un imposible aunque
    // la fila venga de una versión vieja con otra base.
    dano: entero(o.dano, 0, 0, hpMax),
    recursos: entero(o.recursos, 0, 0, 30),
    juegosGanados: entero(o.juegosGanados, 0, 0, 3),
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
    escena: ESCENAS.includes(o.escena as Escena) ? (o.escena as Escena) : 'pronto',
    etiquetaRonda: texto(o.etiquetaRonda, ESTADO_INICIAL.etiquetaRonda),
    juego: entero(o.juego, 1, 1, 5),
    iniciativa,
    tiempoExtra: booleano(o.tiempoExtra),
    enRevision: booleano(o.enRevision),
    reloj: normalizarReloj(o.reloj),
    mensaje: texto(o.mensaje),
    patrocinio: texto(o.patrocinio),
    lados: [normalizarLado(lados[0]), normalizarLado(lados[1])],
    carta: normalizarCarta(o.carta),
  }
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

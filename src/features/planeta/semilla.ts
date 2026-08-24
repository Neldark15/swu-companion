/**
 * De un id de usuario a un mundo. Sin tocar la base.
 *
 * ── Por qué derivada y no guardada ───────────────────────────────────
 *
 * El planeta de cada quien tiene que ser DISTINTO y ESTABLE: el mismo mundo hoy,
 * mañana, desde el teléfono y desde la compu, y el mismo que ven los demás
 * cuando lo visitan. Una semilla derivada del `user.id` da las tres cosas
 * gratis: cero columnas, cero migración, cero backfill, y sirve igual para el
 * planeta de otro sin pedirle nada al servidor.
 *
 * Guardarla sería peor: una columna más que mantener para reproducir un número
 * que ya está determinado por una llave primaria que nunca cambia.
 *
 * ── Por qué FNV-1a y no un hash cualquiera ───────────────────────────
 *
 * Los ids son UUID v4: 36 caracteres que comparten formato y difieren en pocos
 * bits. Un hash malo (sumar códigos, por ejemplo) los agruparía y varios
 * jugadores tendrían mundos casi iguales — que es justo lo que se quiere evitar.
 * FNV-1a mezcla byte a byte con multiplicación, así que un bit de diferencia en
 * la entrada cambia la salida entera.
 */

/** Hash FNV-1a de 32 bits. Determinista y sin dependencias. */
export function hashCadena(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    // El `>>> 0` de cada paso mantiene el número en 32 bits sin signo: sin él,
    // JavaScript pasa a coma flotante y el hash pierde los bits altos.
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * Generador reproducible (mulberry32). Devuelve una función que da 0..1.
 *
 * Se usa para las decisiones de UNA sola vez —paleta, inclinación, giro del
 * campo de cráteres—, no para el relieve: ese necesita ser consultable por
 * posición, y para eso está el ruido con desplazamiento de dominio.
 */
export function generador(semilla: number): () => number {
  let a = semilla >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Lo que el dueño eligió A MANO. Todo opcional: `null` = usá el que corresponda. */
export interface AjustesPlaneta {
  /**
   * Familia elegida. `null` = se hereda del acento del perfil.
   *
   * Se tipa como `string` y no como `FamiliaPlaneta` a propósito: este valor
   * viene de la BASE, y aunque hay un CHECK del lado del servidor, el cliente
   * no debe CREERLE al dato — se valida acá abajo contra `FAMILIAS`. Tiparlo
   * estrecho sería fingir una garantía que el borde de la red no da.
   */
  familia?: string | null
  /** 0-100. `null` = el que decidió la semilla. */
  mares?: number | null
  /** 0-100. `null` = la que decidió la semilla. */
  crateres?: number | null
  /** El acento del perfil, de donde sale la familia por defecto. */
  acento?: string | null
  /**
   * Anillos: 0 = ninguno, 1..3 = los tres estilos. `null` = lo decide la semilla.
   *
   * Con `null` la mayoría de los mundos NO lleva anillos, y eso es a propósito:
   * si los tuviera casi todo el mundo dejarían de significar algo. Se los pone
   * quien quiere que su planeta se distinga de lejos.
   */
  anillos?: number | null
  /** Lunas: 0..3. `null` = lo decide la semilla. */
  lunas?: number | null
}

/** Los rasgos de un mundo: todo lo que lo hace distinto de los demás. */
export interface RasgosMundo {
  /** 0..1, la semilla normalizada. Alimenta el desplazamiento de dominio del ruido. */
  s01: number
  /** Giro del campo de cráteres, en radianes. Sin esto todos los mundos los tienen en el mismo sitio. */
  giro: number
  /** 0,7..1,3 — cuántos cráteres, respecto de la densidad base. */
  densidadCrateres: number
  /** Color de las tierras altas. */
  altiplano: string
  /** Color de los mares. */
  mares: string
  /** Tinte de la atmósfera y del resplandor del borde. */
  atmosfera: string
  /** Inclinación del eje, en radianes. Cambia por dónde pega el sol. */
  inclinacion: number
  /** Cuánto mar tiene: corre el umbral del ruido. Mundos claros y mundos oscuros. */
  nivelMares: number
  /** Cuál quedó, después de resolver ajuste → acento → semilla. Para la UI. */
  familia: FamiliaPlaneta
  /** 0 = sin anillos; 1..3 = estilo. */
  anillos: number
  /** Cuántas lunas, 0..3. */
  lunas: number
}

/**
 * Ocho familias de color.
 *
 * No es una paleta al azar por canal: con RGB libre salen mundos marrón barro y
 * verde flúor, y la galaxia pierde el aire de Star Wars. Familias elegidas a
 * mano y repartidas por la semilla dan variedad SIN salirse del tono. Cada una
 * lleva su propio color de atmósfera, que es lo que más se nota de lejos.
 */
export type FamiliaPlaneta =
  | 'lunar' | 'desierto' | 'jungla' | 'helado'
  | 'volcanico' | 'yermo' | 'oceanico' | 'cristal'

export const FAMILIAS: Record<FamiliaPlaneta, {
  etiqueta: string; altiplano: string; mares: string; atmosfera: string
}> = {
  lunar:     { etiqueta: 'Lunar',     altiplano: '#c8ccd8', mares: '#565c6e', atmosfera: '#7fb2ff' },
  desierto:  { etiqueta: 'Desierto',  altiplano: '#d9c3a5', mares: '#7a5c3e', atmosfera: '#ffb066' },
  jungla:    { etiqueta: 'Jungla',    altiplano: '#b8d6c4', mares: '#3d6b58', atmosfera: '#66ffc2' },
  helado:    { etiqueta: 'Helado',    altiplano: '#cfd2e6', mares: '#4a4f7a', atmosfera: '#9d8cff' },
  volcanico: { etiqueta: 'Volcánico', altiplano: '#e0b9b0', mares: '#8a4438', atmosfera: '#ff7a6b' },
  yermo:     { etiqueta: 'Yermo',     altiplano: '#c6c2a8', mares: '#5f6340', atmosfera: '#d6ff7a' },
  oceanico:  { etiqueta: 'Oceánico',  altiplano: '#aebfd6', mares: '#2f4c6b', atmosfera: '#57c9ff' },
  cristal:   { etiqueta: 'Cristal',   altiplano: '#d8c7dd', mares: '#5b3f6b', atmosfera: '#e08cff' },
}

export const ORDEN_FAMILIAS: FamiliaPlaneta[] =
  ['lunar', 'desierto', 'jungla', 'helado', 'volcanico', 'yermo', 'oceanico', 'cristal']

/**
 * El acento del perfil decide el mundo, mientras nadie elija otra cosa.
 *
 * Es lo que pidió Nel: que el color que uno elige en el perfil se herede. Cada
 * acento apunta a la familia que MÁS SE LE PARECE, así que tu mundo sale del
 * color que ya elegiste y no hay que configurar nada para que se sienta tuyo.
 *
 * Las tres familias que no aparecen acá —lunar, helado, yermo— solo se
 * consiguen eligiéndolas a mano. Que existan opciones que el acento no da es a
 * propósito: premia entrar al panel.
 */
const FAMILIA_DE_ACENTO: Record<string, FamiliaPlaneta> = {
  cyan: 'oceanico',
  amber: 'desierto',
  green: 'jungla',
  red: 'volcanico',
  purple: 'cristal',
}

/**
 * Los rasgos del mundo de un usuario.
 *
 * Tres capas, en este orden: lo que el dueño eligió a mano gana sobre el acento
 * de su perfil, y el acento gana sobre la semilla del id. Todo lo que no se
 * eligió sigue saliendo del id, así que dos cuentas con el MISMO acento y sin
 * tocar nada igual tienen mundos distintos — cambia la paleta, no el relieve.
 */
export function rasgosDe(userId: string, ajustes?: AjustesPlaneta): RasgosMundo {
  const h = hashCadena(userId || 'sin-id')
  const rnd = generador(h)

  const elegida = ajustes?.familia
  const familia: FamiliaPlaneta =
    (elegida && elegida in FAMILIAS ? (elegida as FamiliaPlaneta) : null)
    ?? FAMILIA_DE_ACENTO[ajustes?.acento ?? '']
    ?? ORDEN_FAMILIAS[h % ORDEN_FAMILIAS.length]
  const fam = FAMILIAS[familia]

  // Se consumen SIEMPRE, en el mismo orden, elija el dueño o no: si se saltaran
  // cuando hay ajuste manual, cambiar la familia también movería la inclinación
  // y el relieve, y el mundo dejaría de ser el mismo.
  const giro = rnd() * Math.PI * 2
  const cratSemilla = 0.7 + rnd() * 0.6
  const inclinacion = (rnd() - 0.5) * 0.8
  const maresSemilla = 0.44 + rnd() * 0.18
  /* Los rasgos NUEVOS se sacan AL FINAL de la secuencia, nunca en el medio.
     Meter una tirada antes correría todas las de abajo y le cambiaría la forma
     al mundo de las 19 personas que ya tienen el suyo — un planeta que se
     reescribe solo el día que agregamos anillos. */
  const anillosSemilla = rnd()
  const anillosEstilo = 1 + Math.floor(rnd() * 3)
  const lunasSemilla = rnd()
  const lunasCuantas = 1 + Math.floor(rnd() * 3)

  /* 0-100 del panel a los rangos que la geometría entiende.
   *
   * OJO CON EL SIGNO: `nivelMares` es el UMBRAL del ruido para que un punto
   * cuente como mar, así que más alto significa MENOS mar. El deslizador dice
   * «Mares», y subirlo tiene que dar más mar — así que la conversión va
   * INVERTIDA. Probado a ojo: con el mapeo directo, subir «Mares» al máximo
   * dejaba el mundo entero del color del altiplano, sin una sola mancha. */
  const nivelMares = ajustes?.mares == null
    ? maresSemilla
    : 0.70 - (Math.min(100, Math.max(0, ajustes.mares)) / 100) * 0.36
  /* Anillos y lunas: el ajuste manda; si no hay, decide la semilla. Los cortes
     (0.82 y 0.55) están puestos para que sean MINORÍA — un cielo donde todos
     tienen anillos es un cielo sin anillos. */
  const anillos = ajustes?.anillos == null
    ? (anillosSemilla > 0.82 ? anillosEstilo : 0)
    : Math.min(3, Math.max(0, Math.round(ajustes.anillos)))
  const lunas = ajustes?.lunas == null
    ? (lunasSemilla > 0.55 ? lunasCuantas : 0)
    : Math.min(3, Math.max(0, Math.round(ajustes.lunas)))
  const densidadCrateres = ajustes?.crateres == null
    ? cratSemilla
    : 0.35 + (Math.min(100, Math.max(0, ajustes.crateres)) / 100) * 1.15

  return {
    s01: (h >>> 8) / 16777216,
    giro,
    densidadCrateres,
    altiplano: fam.altiplano,
    mares: fam.mares,
    atmosfera: fam.atmosfera,
    // ±23°, como la Tierra. Más que eso y el sol pega raro.
    inclinacion,
    nivelMares,
    familia,
    anillos,
    lunas,
  }
}

/** Nombre por defecto cuando el dueño todavía no bautizó su mundo. */
export function nombrePorDefecto(userId: string): string {
  const h = hashCadena(userId || 'sin-id')
  // Designación con forma de catálogo estelar en vez de «Sin nombre»: se lee
  // como un mundo que existe y todavía nadie reclamó.
  const letra = String.fromCharCode(65 + (h % 26))
  return `${letra}-${(h % 9000) + 1000}`
}

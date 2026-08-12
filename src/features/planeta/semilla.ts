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
}

/**
 * Ocho familias de color.
 *
 * No es una paleta al azar por canal: con RGB libre salen mundos marrón barro y
 * verde flúor, y la galaxia pierde el aire de Star Wars. Familias elegidas a
 * mano y repartidas por la semilla dan variedad SIN salirse del tono. Cada una
 * lleva su propio color de atmósfera, que es lo que más se nota de lejos.
 */
const FAMILIAS: { altiplano: string; mares: string; atmosfera: string }[] = [
  { altiplano: '#c8ccd8', mares: '#565c6e', atmosfera: '#7fb2ff' }, // lunar, el original
  { altiplano: '#d9c3a5', mares: '#7a5c3e', atmosfera: '#ffb066' }, // desierto
  { altiplano: '#b8d6c4', mares: '#3d6b58', atmosfera: '#66ffc2' }, // jungla
  { altiplano: '#cfd2e6', mares: '#4a4f7a', atmosfera: '#9d8cff' }, // helado
  { altiplano: '#e0b9b0', mares: '#8a4438', atmosfera: '#ff7a6b' }, // volcánico
  { altiplano: '#c6c2a8', mares: '#5f6340', atmosfera: '#d6ff7a' }, // yermo
  { altiplano: '#aebfd6', mares: '#2f4c6b', atmosfera: '#57c9ff' }, // oceánico
  { altiplano: '#d8c7dd', mares: '#5b3f6b', atmosfera: '#e08cff' }, // cristal
]

/** Los rasgos del mundo de un usuario. Mismo id, mismo mundo, siempre. */
export function rasgosDe(userId: string): RasgosMundo {
  const h = hashCadena(userId || 'sin-id')
  const rnd = generador(h)
  const fam = FAMILIAS[h % FAMILIAS.length]
  return {
    s01: (h >>> 8) / 16777216,
    giro: rnd() * Math.PI * 2,
    densidadCrateres: 0.7 + rnd() * 0.6,
    altiplano: fam.altiplano,
    mares: fam.mares,
    atmosfera: fam.atmosfera,
    // ±23°, como la Tierra. Más que eso y el sol pega raro.
    inclinacion: (rnd() - 0.5) * 0.8,
    // El umbral del fbm para que algo sea «mar». Bajo = mundo oscuro y
    // manchado; alto = mundo claro y liso.
    nivelMares: 0.44 + rnd() * 0.18,
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

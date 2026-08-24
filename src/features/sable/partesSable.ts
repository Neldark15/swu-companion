/**
 * La FORMA de cada pieza del sable. Puro, sin three y sin red.
 *
 * ── Por qué la geometría vive acá y no en Postgres ────────────────────
 *
 * La base guarda id, tipo, nombre y precio; el perfil de torneado vive en este
 * archivo. Es la misma línea del §2y: Postgres no guarda datos de presentación
 * que no puede usar ni validar. Agregar una pieza pide un deploy, y eso es una
 * ventaja — la geometría se revisa MIRÁNDOLA, no confiando en un jsonb.
 *
 * ── Un sable es una pieza torneada ────────────────────────────────────
 *
 * Todo el mango es UNA sola `LatheGeometry`: un perfil de puntos (radio, alto)
 * girado 360°. Eso importa por rendimiento, no por elegancia — el §2s manda
 * compartir geometría y material, y así el mango entero es **una geometría y
 * una llamada de dibujo** en vez de tres mallas apiladas con sus costuras.
 *
 * El perfil se arma de abajo hacia arriba: pomo → cuerpo → emisor. Cada pieza
 * declara su alto y devuelve sus puntos con el 0 en SU base; `perfilDeSable`
 * los desplaza y los pega.
 *
 * ── Dos reglas que `LatheGeometry` no perdona ─────────────────────────
 *
 * 1. **El alto tiene que ir siempre hacia arriba.** Un punto con `y` menor que
 *    el anterior gira la normal al revés y ese anillo sale negro. Para un
 *    escalón recto se repite el mismo `y` con otro radio, nunca se baja.
 * 2. **El radio nunca es 0 en el medio.** Solo puede cerrar en los extremos; un
 *    0 intermedio pincha la malla y deja ver el interior.
 *
 * `perfilValido()` comprueba las dos, y hay una prueba que la corre sobre TODAS
 * las combinaciones posibles: 4 emisores × 4 cuerpos × 4 pomos = 64.
 */

/** Un punto del perfil: `[radio, alto]`. */
export type Punto = readonly [number, number]

export type TipoPieza = 'emisor' | 'cuerpo' | 'pomo' | 'color'

interface Pieza {
  /** Cuánto mide de alto, en las mismas unidades del perfil. */
  alto: number
  /** Los puntos, con el 0 en la base de ESTA pieza, de abajo hacia arriba. */
  puntos: (alto: number) => Punto[]
}

/** El radio «de agarre». Todo lo demás se mide contra esto. */
const R = 1.05

/* ── Pomos (abajo) ─────────────────────────────────────────────────── */

const POMOS: Record<string, Pieza> = {
  pom_plano: {
    alto: 3,
    puntos: h => [[0, 0], [R * 0.95, 0], [R * 1.06, h * 0.2], [R, h]],
  },
  pom_conico: {
    alto: 3.4,
    // Se cierra en punta hacia abajo, como el de Dooku.
    puntos: h => [[0, 0], [R * 0.45, h * 0.1], [R * 0.8, h * 0.4], [R * 1.06, h * 0.75], [R, h]],
  },
  pom_bulbo: {
    alto: 3.6,
    puntos: h => [
      [0, 0], [R * 0.6, 0], [R * 1.3, h * 0.28], [R * 1.32, h * 0.55],
      [R * 1.0, h * 0.8], [R, h],
    ],
  },
  pom_anillo: {
    alto: 4,
    // El aro del pomo: dos escalones marcados. Con `y` repetido para que el
    // canto sea recto sin retroceder nunca (regla 1).
    puntos: h => [
      [0, 0], [R * 0.9, 0], [R * 0.9, h * 0.15],
      [R * 1.45, h * 0.15], [R * 1.45, h * 0.4], [R * 0.92, h * 0.4],
      [R * 0.92, h * 0.7], [R, h * 0.75], [R, h],
    ],
  },
}

/* ── Cuerpos (el medio, lo que se agarra) ──────────────────────────── */

/**
 * n bultos iguales repartidos a lo largo del cuerpo. Para forros y costillas.
 *
 * EL BORDE DE CADA BULTO SE CALCULA CON LA MISMA EXPRESIÓN QUE EL PRINCIPIO DEL
 * SIGUIENTE, y no es un detalle de estilo. La primera versión cerraba con
 * `y + paso` y abría con `(i+1) * paso`: matemáticamente lo mismo, en coma
 * flotante no. Salía un alto que BAJABA 1×10⁻¹⁵ —11.147272727272728 seguido de
 * 11.147272727272727— y eso invierte la normal de ese anillo: un aro NEGRO en el
 * mango, en una sola de las 64 combinaciones, sin un error en consola.
 *
 * Lo cazó `scripts/sable-perfiles.test.mts` la primera vez que corrió.
 */
function repetir(h: number, n: number, rBajo: number, rAlto: number): Punto[] {
  const p: Punto[] = []
  const paso = h / n
  for (let i = 0; i < n; i++) {
    const y0 = i * paso
    const y1 = (i + 1) * paso
    const d = y1 - y0
    p.push([rBajo, y0], [rAlto, y0 + d * 0.3], [rAlto, y0 + d * 0.7], [rBajo, y1])
  }
  return p
}

const CUERPOS: Record<string, Pieza> = {
  cue_liso: {
    alto: 14,
    puntos: h => [[R, 0], [R, h]],
  },
  cue_anillado: {
    alto: 14,
    // Los tres anillos de control, estilo Obi-Wan.
    puntos: h => [
      [R, 0], [R, h * 0.18],
      [R * 1.22, h * 0.18], [R * 1.22, h * 0.26], [R, h * 0.26],
      [R, h * 0.44],
      [R * 1.22, h * 0.44], [R * 1.22, h * 0.52], [R, h * 0.52],
      [R, h * 0.70],
      [R * 1.22, h * 0.70], [R * 1.22, h * 0.78], [R, h * 0.78],
      [R, h],
    ],
  },
  cue_forrado: {
    alto: 14,
    // El forro de cuero: muchos bultos chicos y suaves.
    puntos: h => [[R, 0], ...repetir(h * 0.86, 11, R, R * 1.1).map(
      ([r, y]) => [r, y + h * 0.07] as Punto), [R, h]],
  },
  cue_costillas: {
    alto: 14,
    // Costillas: menos, más profundas y de canto vivo.
    puntos: h => [[R, 0], ...repetir(h * 0.8, 6, R * 0.94, R * 1.26).map(
      ([r, y]) => [r, y + h * 0.1] as Punto), [R, h]],
  },
}

/* ── Emisores (arriba, de donde sale la hoja) ──────────────────────── */

const EMISORES: Record<string, Pieza> = {
  emi_estandar: {
    alto: 5,
    puntos: h => [
      [R, 0], [R * 1.18, h * 0.1], [R * 1.18, h * 0.55],
      [R * 0.92, h * 0.68], [R * 0.92, h], [R * 0.6, h],
    ],
  },
  emi_ranurado: {
    alto: 5.4,
    puntos: h => [
      [R, 0], [R * 1.2, h * 0.08],
      [R * 1.2, h * 0.22], [R * 0.98, h * 0.22], [R * 0.98, h * 0.34], [R * 1.2, h * 0.34],
      [R * 1.2, h * 0.48], [R * 0.98, h * 0.48], [R * 0.98, h * 0.6], [R * 1.2, h * 0.6],
      [R * 1.2, h * 0.72], [R * 0.88, h * 0.82], [R * 0.88, h], [R * 0.58, h],
    ],
  },
  emi_conico: {
    alto: 5.6,
    // Se abre como una campana, estilo Vader.
    puntos: h => [
      [R, 0], [R * 1.1, h * 0.15], [R * 1.42, h * 0.62], [R * 1.42, h * 0.74],
      [R * 1.0, h * 0.84], [R * 1.0, h], [R * 0.62, h],
    ],
  },
  emi_dentado: {
    alto: 5.2,
    // Los «dientes» del cerco. Al ser una pieza torneada son escalones, no
    // dientes de verdad: en un mango de 26 unidades a 22 px de alto en el
    // teléfono, un diente real no se distinguiría del escalón y costaría una
    // geometría aparte.
    puntos: h => [
      [R, 0], [R * 1.16, h * 0.1], [R * 1.16, h * 0.42],
      [R * 1.34, h * 0.42], [R * 1.34, h * 0.52], [R * 1.02, h * 0.58],
      [R * 1.02, h * 0.72], [R * 1.3, h * 0.72], [R * 1.3, h * 0.82],
      [R * 0.9, h * 0.88], [R * 0.9, h], [R * 0.6, h],
    ],
  },
}

/* ── Colores de hoja ───────────────────────────────────────────────── */

export interface ColorHoja {
  /** El núcleo, casi blanco: una hoja es luz, no pintura. */
  nucleo: string
  /** El halo, que es lo que le da el color. */
  halo: string
}

export const COLORES: Record<string, ColorHoja> = {
  col_azul:     { nucleo: '#eaf6ff', halo: '#2b8cff' },
  col_verde:    { nucleo: '#eaffee', halo: '#2ee06a' },
  col_rojo:     { nucleo: '#fff0ee', halo: '#ff2d2d' },
  col_purpura:  { nucleo: '#f7eaff', halo: '#a855f7' },
  col_amarillo: { nucleo: '#fffbea', halo: '#ffd21e' },
  col_blanco:   { nucleo: '#ffffff', halo: '#cfe6ff' },
}

/* ── Armar el perfil completo ──────────────────────────────────────── */

export interface Diseno {
  emisor: string
  cuerpo: string
  pomo: string
  color: string
}

export const POR_DEFECTO: Diseno = {
  emisor: 'emi_estandar', cuerpo: 'cue_liso', pomo: 'pom_plano', color: 'col_azul',
}

/** Los ids que este archivo sabe dibujar, por tipo. Para cotejar con la base. */
export const IDS_CONOCIDOS: Record<Exclude<TipoPieza, 'color'>, string[]> & { color: string[] } = {
  emisor: Object.keys(EMISORES),
  cuerpo: Object.keys(CUERPOS),
  pomo: Object.keys(POMOS),
  color: Object.keys(COLORES),
}

/**
 * El perfil del mango entero, de abajo hacia arriba.
 *
 * Ante un id desconocido cae al de fábrica en vez de reventar: los ids vienen
 * de la base y un deploy viejo puede no conocer una pieza nueva (§2g — la PWA
 * instalada tarda en actualizar). Un sable de fábrica se ve raro; una pantalla
 * en blanco parece que la app se rompió.
 */
export function perfilDeSable(d: Diseno): { puntos: Punto[]; alto: number } {
  const pomo = POMOS[d.pomo] ?? POMOS[POR_DEFECTO.pomo]
  const cuerpo = CUERPOS[d.cuerpo] ?? CUERPOS[POR_DEFECTO.cuerpo]
  const emisor = EMISORES[d.emisor] ?? EMISORES[POR_DEFECTO.emisor]

  const puntos: Punto[] = []
  let y = 0
  let techo = -Infinity
  for (const pieza of [pomo, cuerpo, emisor]) {
    for (const [r, py] of pieza.puntos(pieza.alto)) {
      /* Red de seguridad SOLO contra la deriva de coma flotante: sujeta el alto
         para que nunca retroceda. Un retroceso de 1×10⁻¹⁵ al pegar dos piezas
         invierte la normal y deja un anillo NEGRO, y eso no se ve revisando el
         código — pasó de verdad al empalmar `cue_forrado` con `pom_bulbo`.
         NO es un sustituto de la prueba: si una pieza retrocede de verdad, el
         guion sigue plantándose y hay que arreglar el catálogo, no taparlo acá. */
      const alt = Math.max(py + y, techo)
      techo = alt
      puntos.push([r, alt])
    }
    y += pieza.alto
  }
  return { puntos, alto: y }
}

/** El color de la hoja, con caída al azul de fábrica. */
export function colorDeHoja(id: string): ColorHoja {
  return COLORES[id] ?? COLORES[POR_DEFECTO.color]
}

/** Una pieza suelta, para la vista explotada. */
export interface PiezaSuelta {
  clave: 'pomo' | 'cuerpo' | 'emisor'
  /** Puntos con el 0 en la BASE de la pieza, no del mango. */
  puntos: Punto[]
  alto: number
  /** A qué altura del mango armado empieza. */
  base: number
}

/**
 * Las tres piezas por separado.
 *
 * El mango armado es UNA sola `LatheGeometry` (ver `perfilDeSable`) porque así
 * no hay costura entre pomo, cuerpo y emisor. Pero la vista EXPLOTADA necesita
 * separarlas, y para eso hacen falta tres geometrías — no hay forma de abrir una
 * pieza torneada única.
 *
 * La escena usa SIEMPRE estas tres y las junta con separación 0 cuando el sable
 * está armado: un solo camino de código en vez de dos. Cuesta dos llamadas de
 * dibujo más, que sobre una escena de tres mallas y dos cápsulas no se nota — y
 * es mucho más barato que mantener dos formas de construir el mismo mango, que
 * es como se separan las cosas en este repo (§2y).
 *
 * Los perfiles NO se cierran en el eje al separarse: una pieza torneada abierta
 * deja ver el hueco por dentro, y eso es lo correcto — es lo que se ve al
 * desarmar un sable de verdad. Cerrarlas las volvería bolitas macizas.
 */
export function piezasDeSable(d: Diseno): PiezaSuelta[] {
  const pomo = POMOS[d.pomo] ?? POMOS[POR_DEFECTO.pomo]
  const cuerpo = CUERPOS[d.cuerpo] ?? CUERPOS[POR_DEFECTO.cuerpo]
  const emisor = EMISORES[d.emisor] ?? EMISORES[POR_DEFECTO.emisor]

  const claves = ['pomo', 'cuerpo', 'emisor'] as const
  const piezas = [pomo, cuerpo, emisor]
  const salida: PiezaSuelta[] = []
  let base = 0
  for (let i = 0; i < piezas.length; i++) {
    const p = piezas[i]
    // Misma red de seguridad que en `perfilDeSable`: la deriva de coma flotante
    // dentro de una pieza también invierte una normal y deja un aro negro.
    let techo = -Infinity
    const puntos: Punto[] = p.puntos(p.alto).map(([r, y]) => {
      const alt = Math.max(y, techo); techo = alt
      return [r, alt] as Punto
    })
    salida.push({ clave: claves[i], puntos, alto: p.alto, base })
    base += p.alto
  }
  return salida
}

/**
 * ¿Este perfil es dibujable? Las dos reglas que `LatheGeometry` no perdona.
 *
 * Devuelve la lista de problemas, vacía si está bien. Se usa en la prueba
 * (`scripts/sable-perfiles.test.mts`) sobre las 64 combinaciones, no en
 * caliente: si una combinación es inválida, el bug es del catálogo y hay que
 * arreglarlo antes de desplegar, no taparlo en el navegador.
 */
export function perfilValido(puntos: Punto[]): string[] {
  const malos: string[] = []
  if (puntos.length < 3) malos.push('menos de 3 puntos')
  for (let i = 0; i < puntos.length; i++) {
    const [r, y] = puntos[i]
    if (!Number.isFinite(r) || !Number.isFinite(y)) { malos.push(`punto ${i} no es finito`); continue }
    if (r < 0) malos.push(`punto ${i}: radio negativo (${r})`)
    const interior = i > 0 && i < puntos.length - 1
    if (interior && r === 0) malos.push(`punto ${i}: radio 0 en el medio — pincha la malla`)
    if (i > 0 && y < puntos[i - 1][1]) {
      malos.push(`punto ${i}: el alto BAJA (${puntos[i - 1][1]} → ${y}) — ese anillo sale negro`)
    }
  }
  return malos
}

/**
 * mesas — la aritmética de un torneo de MESAS (Twin Suns).
 *
 * Módulo puro, sin dependencias, hermano de `swiss.ts` y `elimination.ts`:
 * se puede probar sin base y sin navegador.
 *
 * ── Por qué «mesas» y no «twin_suns» ──────────────────────────────────
 *
 * `twin_suns` YA existe en el repo como **formato de mazo**
 * (`types/index.ts`, `deckValidator.ts`). Si el tipo de torneo se llamara
 * igual, la misma fila de `official_events` tendría `format='twin_suns'` y
 * `tournament_type='twin_suns'` significando cosas distintas. Son dos ejes:
 * el formato dice con qué mazo se juega, el tipo dice cómo se estructura el
 * torneo. Un torneo de mesas podría usarse para otro formato multijugador
 * mañana.
 *
 * ── La regla, entera ──────────────────────────────────────────────────
 *
 * Twin Suns se juega en mesas de **3 o 4**. Con M mesas caben de 3M a 4M
 * personas, así que M sirve si y solo si `3M ≤ N ≤ 4M`. De ahí sale todo:
 *
 *   · mesas de 4 = N − 3M      · mesas de 3 = 4M − N
 *   · M válidos para N: de ceil(N/4) a floor(N/3)
 *
 * **El único número entre 3 y 32 que no cierra es el 5** (verificado). Con 5
 * no hay combinación de treses y cuatros: hay que conseguir un sexto o dejar
 * a alguien en descanso.
 *
 * Y elegir mesas no es decorativo: con **12** jugadores se puede jugar 3
 * mesas de 4 o 4 mesas de 3, y son torneos distintos —una mesa de 4 dura más
 * y reparte 3/2/1/0 en vez de 3/2/1—. Por eso lo elige el organizador y no
 * una fórmula.
 */

/** Puntos por puesto en la mesa. El índice es el puesto − 1. */
export const PUNTOS_MESA = [3, 2, 1, 0] as const

/** Tamaños de mesa que el formato admite. */
export const MIN_MESA = 3
export const MAX_MESA = 4

export interface Composicion {
  /** Cuántas mesas en total. */
  mesas: number
  /** Cuántas de esas mesas llevan 4 jugadores. */
  de4: number
  /** Cuántas llevan 3. */
  de3: number
}

/**
 * Los números de mesas válidos para `n` jugadores, de menos a más mesas.
 * Vacío = con esa cantidad no se puede armar (n < 3, o n = 5).
 */
export function mesasPosibles(n: number): Composicion[] {
  const out: Composicion[] = []
  if (!Number.isInteger(n) || n < MIN_MESA) return out
  for (let m = Math.ceil(n / MAX_MESA); m <= Math.floor(n / MIN_MESA); m++) {
    const de4 = n - MIN_MESA * m
    out.push({ mesas: m, de4, de3: m - de4 })
  }
  return out
}

/** La composición para un número de mesas concreto, o `null` si no cierra. */
export function composicion(n: number, mesas: number): Composicion | null {
  if (!Number.isInteger(n) || !Number.isInteger(mesas) || mesas < 1) return null
  if (n < MIN_MESA * mesas || n > MAX_MESA * mesas) return null
  const de4 = n - MIN_MESA * mesas
  return { mesas, de4, de3: mesas - de4 }
}

/** «4 + 3 + 3», para enseñar el reparto antes de armarlo. */
export function dibujarComposicion(c: Composicion): string {
  return [...Array(c.de4).fill(4), ...Array(c.de3).fill(3)].join(' + ')
}

/**
 * Por qué NO se puede armar, en palabras que sirvan en la mesa.
 * Devuelve `null` cuando sí se puede.
 */
export function porQueNo(n: number, mesas: number): string | null {
  if (!Number.isInteger(n) || n < MIN_MESA) {
    return `Hacen falta al menos ${MIN_MESA} jugadores para armar una mesa.`
  }
  const posibles = mesasPosibles(n)
  if (posibles.length === 0) {
    // Hoy esto solo pasa con 5.
    return `Con ${n} jugadores no se pueden armar mesas de 3 o 4: ${n} no es suma de treses y cuatros. ` +
      `Conseguí un jugador más, o dejá a uno en descanso.`
  }
  if (composicion(n, mesas)) return null

  const min = posibles[0].mesas
  const max = posibles[posibles.length - 1].mesas
  const rango = min === max ? `tiene que ser ${min}` : `tiene que estar entre ${min} y ${max}`
  const faltan = MIN_MESA * mesas - n
  const sobran = n - MAX_MESA * mesas
  const detalle = faltan > 0
    ? `Con ${mesas} mesas faltarían ${faltan} jugador${faltan === 1 ? '' : 'es'} para llenarlas.`
    : `Con ${mesas} mesas sobrarían ${sobran} jugador${sobran === 1 ? '' : 'es'} sin asiento.`
  return `Con ${n} jugadores el número de mesas ${rango}. ${detalle}`
}

export interface AsientoJugador {
  /** `null` para quien juega sin cuenta. Es un tercio de la sala real. */
  userId: string | null
  nombre: string
  /** Con qué se ordena antes de repartir: puntos acumulados, o la semilla. */
  orden: number
}

export interface Asiento extends AsientoJugador {
  /** Número de mesa, empezando en 1. */
  mesa: number
}

/**
 * Reparte a la gente en mesas, en SERPENTINA sobre el orden recibido.
 *
 * Serpentina —1,2,3,3,2,1,1,2,3…— y no bloques seguidos: repartir en bloques
 * mete a los cuatro punteros en la misma mesa y a los cuatro últimos en otra,
 * así que la ronda 1 ya decide medio torneo. Con serpentina cada mesa recibe
 * un poco de cada tramo de la tabla.
 *
 * **Límite conocido de v1:** no garantiza que dos personas no repitan mesa
 * entre rondas. Con 3 mesas y 3 rondas el cruce es inevitable de todos modos;
 * evitarlo de verdad pide un emparejador con historial, que no está.
 */
export function repartir(jugadores: AsientoJugador[], comp: Composicion): Asiento[] {
  const orden = [...jugadores].sort((a, b) => b.orden - a.orden)

  // Los tamaños, mesas de 4 primero: así la gente de arriba de la tabla cae en
  // las mesas más grandes, que es donde hay más puntos en juego (3/2/1/0).
  const tam = [...Array(comp.de4).fill(MAX_MESA), ...Array(comp.de3).fill(MIN_MESA)]
  const libres = tam.map((t, i) => ({ mesa: i + 1, quedan: t }))

  const out: Asiento[] = []
  let i = 0
  let vuelta = 0
  while (i < orden.length) {
    // Cada vuelta recorre las mesas en un sentido y la siguiente al revés.
    const seq = vuelta % 2 === 0 ? libres : [...libres].reverse()
    let colocado = false
    for (const m of seq) {
      if (m.quedan === 0) continue
      if (i >= orden.length) break
      out.push({ ...orden[i], mesa: m.mesa })
      m.quedan--
      i++
      colocado = true
    }
    vuelta++
    // Sin esto, una composición mal calculada colgaría el bucle para siempre.
    if (!colocado) break
  }
  return out
}

/**
 * Cuántas rondas de mesas tiene una fecha.
 *
 * La especificación de la temporada define los puntos de mesa pero **nunca
 * dice cuántas veces se rearman las mesas**, y con UNA sola ronda la fecha no
 * puede coronar a nadie: con dos mesas de 4, los dos ganadores empatan en 3
 * puntos y no hay desempate que los separe.
 *
 * Tres rondas es lo que cabe en el mismo reloj que una fecha suiza normal
 * (3 × 55 + 2 × 5 = 175 min) y lo que hace que los puntos acumulados separen.
 */
export function rondasMesas(n: number): number {
  if (n <= 4) return 1   // una sola mesa: se juega y ya está
  if (n <= 12) return 3
  return 4
}

/** Los puntos que da un puesto de mesa. Fuera de 1-4 no da nada. */
export function puntosDePuesto(puesto: number | null | undefined): number {
  if (!puesto || puesto < 1 || puesto > PUNTOS_MESA.length) return 0
  return PUNTOS_MESA[puesto - 1]
}

/**
 * La ronda siguiente, armada con los PUESTOS de la anterior.
 *
 * ── El formato que pidió Nel ─────────────────────────────────────────
 *
 * «El ganador de cada mesa pasa a la final. Las mesas que quedan, el ganador
 * de cada una recibe un sobre.»
 *
 * O sea: los primeros de cada mesa se juntan en la MESA 1 —la final— y el
 * resto se reparte en las mesas siguientes. Con 9 en 3 mesas de 3 da una
 * final de 3 y dos mesas de 3 abajo, que es exactamente lo que él describió.
 *
 * ── Por qué el resto NO se reparte en serpentina ─────────────────────
 *
 * Los que no clasifican se agrupan POR PUESTO: todos los segundos juntos,
 * todos los terceros juntos. Mezclarlos daría mesas donde un segundo juega
 * contra un tercero por el mismo premio, y eso no es una consolación: es
 * castigar al que quedó más cerca.
 */
export interface AsientoConPuesto extends AsientoJugador {
  /** Mesa de la ronda anterior. */
  mesaAnterior: number
  /** Puesto DENTRO de esa mesa: 1 es el ganador. */
  puesto: number
  /** Vida que le quedó. `null` = no se anotó en esa mesa. */
  vida?: number | null
}

export type RondaSiguiente =
  | { ok: true; asientos: Asiento[]; repescado: string | null }
  | { ok: false; motivo: string }

/**
 * Quién es «el mejor segundo».
 *
 * Nel: «la mesa final tiene que ser de 4; la cuarta persona saldrá del mejor
 * segundo de entre las 3 mesas».
 *
 * Todos los segundos sacaron los mismos puntos en su mesa, así que hace falta
 * un desempate y NO puede ser el azar: esa silla vale un premio. El orden es:
 *
 *  1. **El que quedó con más VIDA.** Es el criterio de verdad: sale de la
 *     partida, no de una regla de escritorio. Solo cuenta si la mesa la
 *     anotó — quien no tiene vida anotada no gana por defecto ni pierde por
 *     defecto, va después de los que sí.
 *  2. **El de la mesa más grande.** Quedar segundo entre cuatro es haberle
 *     ganado a más gente que quedar segundo entre tres.
 *  3. **Más puntos acumulados** en el torneo.
 *  4. **Mejor siembra**, que es lo único que queda y es estable — sortearlo
 *     haría que la misma ronda diera finalistas distintos al recalcularse.
 */
function mejorSegundo(
  segundos: AsientoConPuesto[],
  tamañoDeMesa: Map<number, number>,
): AsientoConPuesto[] {
  // `null` va al fondo y no al frente: sin vida anotada no se puede afirmar
  // que quedó mejor que nadie.
  const vidaDe = (p: AsientoConPuesto) => (typeof p.vida === 'number' ? p.vida : -1)
  return [...segundos].sort((a, b) =>
    vidaDe(b) - vidaDe(a)
    || (tamañoDeMesa.get(b.mesaAnterior) ?? 0) - (tamañoDeMesa.get(a.mesaAnterior) ?? 0)
    || b.orden - a.orden
    || a.mesaAnterior - b.mesaAnterior)
}

export function armarRondaSiguiente(previos: AsientoConPuesto[]): RondaSiguiente {
  // Sin puestos anotados no se puede: adivinar quién ganó sería inventar el
  // resultado de una partida que se jugó.
  if (previos.some(p => !p.puesto || p.puesto < 1)) {
    return { ok: false, motivo: 'Faltan puestos por anotar en la ronda anterior.' }
  }

  const tamañoDeMesa = new Map<number, number>()
  for (const p of previos) {
    tamañoDeMesa.set(p.mesaAnterior, (tamañoDeMesa.get(p.mesaAnterior) ?? 0) + 1)
  }

  const ganadores = previos
    .filter(p => p.puesto === 1)
    .sort((a, b) => a.mesaAnterior - b.mesaAnterior)

  if (ganadores.length < 2) {
    return { ok: false, motivo: 'Hace falta más de una mesa para armar una final.' }
  }

  /* La final es de CUATRO. Con tres mesas hay tres ganadores, así que la
     cuarta silla la ocupa el mejor segundo. Con cuatro mesas ya está llena y
     no se repesca a nadie. */
  const segundos = mejorSegundo(previos.filter(p => p.puesto === 2), tamañoDeMesa)
  const faltan = Math.max(0, MAX_MESA - ganadores.length)
  const repescados = segundos.slice(0, faltan)
  const finalistas = [...ganadores, ...repescados]

  if (finalistas.length < MIN_MESA) {
    return {
      ok: false,
      motivo: `Solo se juntan ${finalistas.length} para la final y una mesa necesita al menos ${MIN_MESA}.`,
    }
  }

  const enFinal = new Set(finalistas)
  /* El resto, por puesto y después por mesa: los segundos que no repescaron
     quedan juntos, y los terceros juntos. Mezclarlos daría mesas donde un
     segundo juega contra un tercero por el mismo premio. */
  const resto = previos
    .filter(p => !enFinal.has(p))
    .sort((a, b) => a.puesto - b.puesto || a.mesaAnterior - b.mesaAnterior)

  /* Las mesas de abajo se arman con la MISMA regla que las de arriba: de 3 o
     de 4, nunca de 1 ni de 5. Una versión anterior cortaba de a tamaño fijo y
     con 10 jugadores dejaba una MESA DE UNO. */
  const comp = mesasPosibles(resto.length)[0]
  if (resto.length > 0 && !comp) {
    return {
      ok: false,
      motivo: `Quedan ${resto.length} para las mesas de abajo y con ese número no se pueden armar mesas de ${MIN_MESA} o ${MAX_MESA}.`,
    }
  }

  const asientos: Asiento[] = finalistas.map(p => ({ ...p, mesa: 1 }))
  if (comp) {
    const tamaños = [...Array(comp.de4).fill(MAX_MESA), ...Array(comp.de3).fill(MIN_MESA)]
    let i = 0
    tamaños.forEach((t, k) => {
      for (const p of resto.slice(i, i + t)) asientos.push({ ...p, mesa: k + 2 })
      i += t
    })
  }

  return {
    ok: true,
    asientos,
    // Se DICE a quién se repescó: entra a jugar por el premio grande sin
    // haber ganado su mesa, y eso tiene que poder explicarse en voz alta.
    repescado: repescados[0]?.nombre ?? null,
  }
}

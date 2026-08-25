/**
 * EL SORTEO DE LA TRIVIA — puro, sin Supabase.
 *
 * Vive aparte de `trivia.ts` para que se pueda PROBAR: aquel importa el cliente
 * de Supabase, que necesita `import.meta.env` y revienta fuera del navegador.
 * Un guion de prueba no debería tener que levantar medio entorno para contar
 * en qué posición cae la respuesta correcta.
 *
 * Es el mismo criterio que `partesSable.ts`: lo que se puede comprobar con
 * números vive donde los números se puedan correr.
 */

import { BANCO_TRIVIA, type PreguntaTrivia, type TemaTrivia } from './triviaBanco'
import { diaCalendarioSV } from './horaSV'

/** El día de hoy en El Salvador. Todo el sorteo se ancla acá. */
function hoySV(): string {
  return diaCalendarioSV(new Date())
}

/** La semilla del día por cuenta: mismo día y misma cuenta, mismas preguntas. */
export function getDailySeed(userId: string, dateStr: string): number {
  let hash = 0
  const str = `${userId}-${dateStr}`
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr]
  let s = seed
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
    const j = Math.abs(s) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Baraja las OPCIONES de una pregunta y recoloca cuál es la correcta.
 *
 * ── Por qué hace falta ────────────────────────────────────────────────
 *
 * `seededShuffle` barajaba las PREGUNTAS, nunca las opciones, y las opciones
 * quedaban en el orden en que se escribieron. Medido sobre las 180 del banco,
 * la respuesta correcta caía así:
 *
 *     1ª opción · 95    2ª · 66    3ª · 18    4ª · 1
 *
 * O sea que **contestar siempre la primera acertaba el 53 %** y las dos
 * primeras cubrían el 89 %. La trivia se podía ganar sin saber nada — y desde
 * que paga créditos, eso es una fuga de la economía, no solo un juego flojo.
 *
 * No se arregla reescribiendo 180 líneas a mano: eso deja el mismo sesgo
 * esperando en la pregunta 181. Se baraja acá, y de paso queda arreglado para
 * todo lo que se agregue después.
 *
 * ── La semilla incluye el id de la pregunta ───────────────────────────
 *
 * Si todas las preguntas del día compartieran semilla, todas moverían sus
 * opciones con la MISMA permutación y el sesgo volvería, apenas corrido de
 * lugar. Con el id adentro, cada una se mezcla distinto.
 *
 * Y es DETERMINISTA a propósito: el mismo día, la misma cuenta y la misma
 * pregunta dan siempre el mismo orden. Con azar de verdad, un repintado
 * movería las opciones bajo el dedo de quien está por tocar una.
 */
function barajarOpciones(q: PreguntaTrivia, semillaDia: number): PreguntaTrivia {
  /* MEZCLA CON AVALANCHA, y no `s * 31 + char`.
     El primer intento usaba esa mezcla clásica y el reparto quedó en
     34/17/26/23 % en vez de 25 cada uno: los ids se parecen muchísimo entre sí
     (`u02`, `u03`, `n110`, `n111`), así que semillas casi iguales producían
     permutaciones casi iguales y el sesgo del banco se colaba igual, apenas
     disimulado.

     FNV-1a con `Math.imul` para el hash y xorshift32 para el sorteo: cambiar un
     solo carácter del id cambia la mitad de los bits. Todo con `>>> 0` para
     trabajar sin signo — `& 0xFFFFFFFF` devuelve un entero CON signo y
     `Math.abs` sobre él vuelve a sesgar el módulo. */
  let s = (semillaDia ^ 0x811c9dc5) >>> 0
  for (let i = 0; i < q.id.length; i++) {
    s = Math.imul(s ^ q.id.charCodeAt(i), 0x01000193) >>> 0
  }
  const siguiente = (): number => {
    s ^= s << 13; s >>>= 0
    s ^= s >>> 17
    s ^= s << 5; s >>>= 0
    return s
  }

  const pares = q.options.map((texto, i) => ({ texto, correcta: i === q.correctIndex }))
  for (let i = pares.length - 1; i > 0; i--) {
    const j = siguiente() % (i + 1);
    [pares[i], pares[j]] = [pares[j], pares[i]]
  }
  const correcta = pares.findIndex(p => p.correcta)
  return {
    ...q,
    options: pares.map(p => p.texto),
    // Red de seguridad: si algo saliera mal, se deja la pregunta como estaba
    // en vez de marcar como correcta una respuesta que no lo es.
    correctIndex: correcta >= 0 ? correcta : q.correctIndex,
  }
}

/** Las diez preguntas del día para una cuenta, ya barajadas. */
export function getDailyQuestions(userId: string): PreguntaTrivia[] {
  const today = hoySV()
  const seed = getDailySeed(userId, today)
  const shuffled = seededShuffle(BANCO_TRIVIA, seed)
  return shuffled.slice(0, 10).map(q => barajarOpciones(q, seed))
}

/**
 * Las 10 preguntas de UN TEMA para hoy. Mismo barajado de opciones que la
 * diaria: el sesgo de posición estaba en el banco, así que afectaba por igual
 * a las dos formas de jugar y las dos tenían que arreglarse.
 */
export function getTemaQuestions(userId: string, tema: TemaTrivia): PreguntaTrivia[] {
  const delTema = BANCO_TRIVIA.filter(q => q.tema === tema)
  const seed = getDailySeed(userId, `${hoySV()}-${tema}`)
  return seededShuffle(delTema, seed).slice(0, 10).map(q => barajarOpciones(q, seed))
}

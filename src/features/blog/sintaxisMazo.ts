/**
 * sintaxisMazo — el parseo del bloque de mazo del blog.
 *
 * Va separado de BloqueMazo.tsx por el mismo motivo que sintaxisEstadistica.ts
 * va separado de BloquesEstadisticos.tsx: un archivo que exporta componentes Y
 * funciones rompe el Fast Refresh de Vite
 * (`react-refresh/only-export-components`).
 *
 * ── Por qué existe ────────────────────────────────────────────────────
 *
 * Un análisis de mazo terminaba en un callejón: la lista estaba a la vista,
 * pero para probarla había que transcribirla a mano en Mis Decks. Este bloque
 * cierra el circuito —leer, copiar, probar en el laboratorio— sin salir del
 * artículo. Para eso el mazo tiene que ser DATOS, no una captura de pantalla
 * ni un párrafo con nombres sueltos.
 *
 * ── La sintaxis, completa ─────────────────────────────────────────────
 *
 * Se escribe A MANO en el textarea del editor, igual que los bloques de
 * datos, y con la misma familia de marcadores:
 *
 *     [[mazo: The Armorer — 2.º en el PQ de Cambridgeshire]]
 *     formato: premier
 *     lider: The Armorer|ASH-1
 *     base: Freetown|ASH-26
 *     3x Han Solo|LAW-37
 *     2x Devaronian Doorbuster|LAW-70
 *     banquillo
 *     2x B-Wing Rearguard|ASH-78
 *     1x The Eye of Aldhani|SEC-73
 *     fuente: melee.gg — Rollplay's Ashes of the Empire PQ
 *
 * - El título tras el `:` del marcador es el NOMBRE con el que se copia el
 *   mazo a Mis Decks. Sin título se arma uno con el líder y la base.
 * - `formato:` es opcional (por defecto `premier`); vale premier, twin_suns,
 *   trilogy, sealed, draft y limited.
 * - `lider:` (también `líder:` o `leader:`) y `base:` son OBLIGATORIOS: un
 *   bloque sin líder no es un mazo que se pueda copiar a ningún lado.
 * - Una línea suelta `banquillo` (o `sideboard`, o `reserva`) manda las
 *   líneas siguientes al sideboard.
 * - `fuente:` la consume el propio artículo, igual que en los otros bloques.
 *
 * ── El `|SET-NUM` no es un adorno ─────────────────────────────────────
 *
 * **El nombre no identifica una carta.** Medido sobre el export: «Han Solo»
 * son 40 filas y «Maul» 22. Sin fijar la impresión, el bloque dibuja la carta
 * equivocada y el mazo copiado lleva otra cosa. Es el mismo motivo por el que
 * `[[carta:…|ASH-11]]` acepta un set, y el formato es idéntico a propósito:
 * quien escribe el artículo aprende una sola convención.
 *
 * Y por eso se RECHAZA el nombre con subtítulo: `Maul | Master of the Shadow
 * Collective|LAW-54` no parsea. El resolvedor casa por `name` pelado, así que
 * esa línea resolvería a un Maul cualquiera —o a ninguno— en silencio. Mejor
 * que el bloque entero caiga a texto plano y se vea el error en la vista
 * previa.
 *
 * ── Por qué el parseo es todo-o-nada ──────────────────────────────────
 *
 * Igual que los bloques de datos: si UNA línea no cumple, se devuelve null y
 * el artículo muestra el texto crudo. Un mazo al que le falta una línea en
 * silencio es peor que no tener bloque — se copiaría a Mis Decks incompleto y
 * nadie se enteraría. Jamás se lanza.
 */

import type { TournamentFormat } from '../../types'

/** Una carta pedida por el artículo, todavía sin resolver contra la base. */
export interface RefCarta {
  /** Nombre PELADO, sin subtítulo. Así casa el resolvedor. */
  nombre: string
  /** `ASH-1` fija set y número; `ASH` solo el set; null deja elegir. */
  set: string | null
  cantidad: number
}

export interface MazoDelArticulo {
  formato: TournamentFormat | 'limited'
  lider: RefCarta
  base: RefCarta
  main: RefCarta[]
  sideboard: RefCarta[]
}

/**
 * Topes de cordura. Por encima de esto ya no es un mazo sino otra cosa pegada
 * por error: se cae al texto crudo, no se recorta (recortar sería mostrar un
 * mazo distinto al que el artículo dice).
 */
const MAX_LINEAS = 90
const MAX_COPIAS = 30

const FORMATOS: readonly (TournamentFormat | 'limited')[] = [
  'premier', 'twin_suns', 'trilogy', 'sealed', 'draft', 'limited',
]

/** Mismo formato de código de impresión que `[[carta:Nombre|ASH-11]]`. */
const CODIGO_SET = /^[A-Za-z0-9]{2,5}(?:-\d+)?$/

/**
 * `Nombre` o `Nombre|SET-NUM`.
 *
 * Se corta por el ÚLTIMO `|` y se EXIGE que lo de la derecha sea un código de
 * set: si alguien escribe el subtítulo (`Maul | Master of…|LAW-54`) el nombre
 * queda con un `|` adentro y esto devuelve null en vez de resolver a la carta
 * equivocada.
 */
function refCarta(texto: string, cantidad: number): RefCarta | null {
  const s = texto.trim()
  if (!s) return null
  const corte = s.lastIndexOf('|')
  if (corte < 0) {
    return s.includes('|') ? null : { nombre: s, set: null, cantidad }
  }
  const nombre = s.slice(0, corte).trim()
  const set = s.slice(corte + 1).trim()
  if (!nombre || nombre.includes('|')) return null
  if (!CODIGO_SET.test(set)) return null
  return { nombre, set: set.toUpperCase(), cantidad }
}

/** Parsea las líneas de un bloque de mazo, o null si no cumplen. Nunca lanza. */
export function parsearMazo(lineas: string[]): MazoDelArticulo | null {
  if (lineas.length === 0 || lineas.length > MAX_LINEAS) return null

  let formato: TournamentFormat | 'limited' = 'premier'
  let lider: RefCarta | null = null
  let base: RefCarta | null = null
  const main: RefCarta[] = []
  const sideboard: RefCarta[] = []
  let destino = main

  for (const linea of lineas) {
    const l = linea.trim()
    if (!l) continue

    // Cambio de sección: una palabra sola, con `:` opcional.
    if (/^(banquillo|sideboard|reserva)\s*:?$/i.test(l)) {
      destino = sideboard
      continue
    }

    const etiqueta = /^(formato|l[ií]der|leader|base)\s*:\s*(.+)$/i.exec(l)
    if (etiqueta) {
      const clave = etiqueta[1].toLowerCase()
      const valor = etiqueta[2].trim()

      if (clave === 'formato') {
        const f = valor.toLowerCase().replace(/[\s-]+/g, '_')
        const encontrado = FORMATOS.find(x => x === f)
        if (!encontrado) return null
        formato = encontrado
        continue
      }

      const ref = refCarta(valor, 1)
      if (!ref) return null
      // Repetir la etiqueta sería ambiguo: ¿cuál de los dos líderes vale?
      if (clave === 'base') {
        if (base) return null
        base = ref
      } else {
        if (lider) return null
        lider = ref
      }
      continue
    }

    // `3x Nombre|SET-NUM`. El espacio tras la `x` es opcional y `3 x` vale.
    const fila = /^(\d{1,2})\s*x\s+(.+)$/i.exec(l)
    if (!fila) return null
    const cantidad = Number(fila[1])
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_COPIAS) return null
    const ref = refCarta(fila[2], cantidad)
    if (!ref) return null
    destino.push(ref)
  }

  // Sin líder o sin base no hay mazo que copiar: la mitad del bloque es
  // justamente el botón «Copiar a Mis Decks», y copiar eso daría un mazo roto.
  if (!lider || !base || main.length === 0) return null

  return { formato, lider, base, main, sideboard }
}

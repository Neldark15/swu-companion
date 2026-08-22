/**
 * borradorArticulo — convierte un torneo cerrado en el borrador de un artículo.
 *
 * Función PURA: recibe el torneo y devuelve texto. No toca la base, no pide
 * nada, no depende del reloj. Así se puede ver la previa antes de guardar y
 * probar el resultado sin montar media app.
 *
 * ── Escribe en el dialecto del blog, no en HTML ───────────────────────
 *
 * `Articulo.tsx` parsea a mano una sintaxis propia y construye elementos
 * React (nunca `dangerouslySetInnerHTML`). Los bloques que se usan acá:
 *
 *     [[ficha: Título]]   rejilla de etiqueta:valor
 *     [[barras: Título]]  barras horizontales con porcentaje
 *
 * Dos reglas del parser que hay que respetar o el bloque se cae a texto
 * plano **sin un solo error visible**:
 *   1. cada bloque termina en la PRIMERA línea en blanco, así que va con
 *      línea en blanco antes y después — dos bloques pegados se destruyen;
 *   2. el parseo es todo-o-nada: una sola línea mal formada anula el bloque
 *      entero.
 *
 * ── Por qué NO se emite `[[carta:Nombre]]` ────────────────────────────
 *
 * El líder de una clasificación es texto libre («Cad Bane — Ruthless
 * Mercenary»), y el bloque de carta necesita `|SET-NUM` para saber CUÁL
 * impresión es: «Cad Bane» son 5 cartas distintas y «Han Solo» 40 filas.
 * Sin el código, el bloque elegiría una al azar y el artículo mostraría la
 * carta equivocada con toda confianza. Los líderes van como texto.
 *
 * ── Y por qué a veces hay porcentajes y a veces no ────────────────────
 *
 * La regla del meta de la app fija el quórum en **20 listas** y prohíbe
 * mostrar porcentajes por debajo. Un torneo de 8 con «25 % Cad Bane» son
 * dos personas: el porcentaje suena a tendencia y es una anécdota. Bajo
 * quórum se publican CONTEOS.
 */

import type { TorneoCompleto, ClasificadoTorneo } from '../../services/torneosHistoricos'

/** Debajo de esto no se publican porcentajes, solo conteos. */
export const QUORUM = 20

export interface Borrador {
  title: string
  excerpt: string
  content: string
  tags: string[]
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** `2026-08-15` → `15 de agosto de 2026`. Se parte a mano: `new Date('…')` de una fecha suelta la interpreta en UTC y puede correrla un día. */
function enLetras(iso: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return ''
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}`
}

/** El nombre del líder sin el subtítulo: «Cad Bane — Ruthless Mercenary» → «Cad Bane». */
function soloLider(leader: string): string {
  return leader.split('—')[0].trim() || leader.trim()
}

function record(c: ClasificadoTorneo): string {
  const e = c.empates > 0 ? `-${c.empates}` : ''
  return `${c.victorias}-${c.derrotas}${e}`
}

/**
 * Un valor de bloque no puede llevar `:` sin cuidado —el parser parte por el
 * ÚLTIMO— ni saltos de línea. Se limpia antes de escribirlo.
 */
function limpio(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Cuenta líderes, de más a menos. */
function porLider(cl: ClasificadoTorneo[]): { nombre: string; n: number }[] {
  const m = new Map<string, number>()
  for (const c of cl) {
    const l = soloLider(c.leader)
    if (!l) continue
    m.set(l, (m.get(l) ?? 0) + 1)
  }
  return [...m.entries()]
    .map(([nombre, n]) => ({ nombre, n }))
    .sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre))
}

export function componerBorrador(t: TorneoCompleto): Borrador {
  const { torneo, clasificacion } = t
  const jugadores = clasificacion.length
  const campeon = clasificacion.find(c => c.puesto === 1) ?? clasificacion[0]
  const fecha = enLetras(torneo.fecha)
  const invitados = clasificacion.filter(c => !c.perfilId).length
  const lideres = porLider(clasificacion)
  const conLider = clasificacion.filter(c => soloLider(c.leader)).length

  const p: string[] = []

  // ── Entrada ──
  p.push(
    campeon
      ? `**${campeon.nombre}** ganó ${torneo.nombre}${fecha ? ` el ${fecha}` : ''} ` +
        `con un récord de ${record(campeon)}${
          soloLider(campeon.leader) ? `, jugando ${soloLider(campeon.leader)}` : ''
        }.`
      : `Así quedó ${torneo.nombre}${fecha ? ` el ${fecha}` : ''}.`,
  )

  // ── Ficha ──
  const ficha: string[] = ['[[ficha: El torneo]]']
  if (fecha) ficha.push(`Fecha: ${fecha}`)
  ficha.push(`Jugadores: ${jugadores}`)
  if (torneo.formato) ficha.push(`Formato: ${limpio(torneo.formato)}`)
  if (torneo.lugar) ficha.push(`Sede: ${limpio(torneo.lugar)}`)
  if (campeon) ficha.push(`Campeón: ${limpio(campeon.nombre)}`)
  p.push(ficha.join('\n'))

  // ── La tabla ──
  p.push('## Cómo quedó la tabla')

  const podio = clasificacion.slice(0, Math.min(8, clasificacion.length))
  p.push(
    podio
      .map(c => {
        const l = soloLider(c.leader)
        return `**${c.puesto}. ${c.nombre}** — ${record(c)}${l ? ` · ${l}` : ''}`
      })
      .join('\n'),
  )

  if (clasificacion.length > 8) {
    p.push(`Y ${clasificacion.length - 8} jugadores más completaron el torneo.`)
  }

  // ── Los líderes ──
  //
  // Con muestra chica se publican CONTEOS: un porcentaje sobre 8 listas
  // suena a tendencia del meta y es una anécdota de dos personas.
  if (lideres.length > 0) {
    p.push('## Con qué se jugó')
    if (conLider >= QUORUM) {
      p.push(
        [
          '[[barras: Líderes por representación]]',
          ...lideres.map(l => `${limpio(l.nombre)}: ${((l.n / conLider) * 100).toFixed(1)}`),
          `fuente: ${conLider} listas de ${torneo.nombre}`,
        ].join('\n'),
      )
    } else {
      p.push(
        [
          '[[ficha: Líderes, por cuántos lo jugaron]]',
          ...lideres.map(l => `${limpio(l.nombre)}: ${l.n}`),
          `fuente: ${conLider} de ${jugadores} listas · muestra chica, se cuentan sin porcentajes`,
        ].join('\n'),
      )
      p.push(
        `*Son ${conLider} listas. Por debajo de ${QUORUM} no se publican porcentajes: ` +
          `sobre esta muestra, un punto porcentual es media persona.*`,
      )
    }
  }

  if (invitados > 0) {
    p.push(
      `## Nota\n\n${invitados} de los ${jugadores} jugaron sin cuenta en la app. ` +
        `Sus resultados quedan a su nombre y se unen solos a su historial el día que se registren.`,
    )
  }

  p.push('## Qué nos llevamos')
  p.push('_Escribí acá la lectura del torneo: qué mazo sorprendió, qué partida decidió el día, qué esperar de la próxima fecha._')

  return {
    title: `${torneo.nombre} — resultados`,
    excerpt: campeon
      ? `${campeon.nombre} se llevó ${torneo.nombre} con ${record(campeon)} entre ${jugadores} jugadores.`
      : `Resultados de ${torneo.nombre}.`,
    // La línea en blanco entre bloques es OBLIGATORIA: sin ella el parser
    // no cierra el bloque anterior y los dos se caen a texto plano.
    content: p.join('\n\n'),
    tags: ['torneo', 'resultados'],
  }
}

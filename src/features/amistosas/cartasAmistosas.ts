/**
 * De un nombre guardado a la carta real — y al revés.
 *
 * La tabla guarda TEXTO, no ids: `base_creador` viene guardando `Card.name`
 * desde que existe el Contador, y los líderes nuevos siguen la misma
 * convención. Eso es una decisión con la que hay que vivir, no un error a
 * corregir a medias: si los líderes se guardaran por uuid y las bases por
 * nombre, cada lectura tendría que resolver dos caminos distintos.
 *
 * El precio del texto es la ambigüedad, y es real:
 *
 *  · Hay CUATRO líderes llamados «Ahsoka Tano» y dos «Cad Bane». Por eso el
 *    líder se guarda como «Nombre — Subtítulo»: el subtítulo es justo lo que
 *    los distingue, y es lo que la gente dice en la mesa.
 *  · Hay DOS bases Standard llamadas «Chopper Base» (SOR_030 y JTL_029) con el
 *    mismo nombre y sin subtítulo. Esas NO se pueden desambiguar por texto. Se
 *    resuelve la primera y se sigue: es un empate entre dos cartas de arte
 *    distinto, no un dato inventado. Si algún día importa, hay que migrar la
 *    columna a uuid — no parchear acá.
 *
 * Cuando el texto no resuelve a ninguna carta NO se inventa nada: se muestra
 * el texto pelado. Un duelo de hace un año con una carta que ya no existe se
 * tiene que poder seguir leyendo.
 */

import { db } from '../../services/db'
import type { Card } from '../../types'

/** El separador del formato «Nombre — Subtítulo». Es una raya, no un guion. */
export const SEPARADOR = ' — '

/** La clave con la que se guarda un líder. Las bases van por nombre pelado. */
export function claveDeCarta(c: Card): string {
  return c.subtitle ? `${c.name}${SEPARADOR}${c.subtitle}` : c.name
}

export interface IndiceCartas {
  lideres: Card[]
  bases: Card[]
  /** Clave → carta. Lleva la clave completa Y el nombre pelado, para duelos viejos. */
  porClave: Map<string, Card>
}

/**
 * Carga líderes y bases canónicos desde Dexie.
 *
 * `isCanonical` y no `isCollectible`: acá se quiere UNA fila por carta para
 * elegirla y pintarla, no saber si cuenta para completar un set (gotcha 2d).
 * Sin este filtro, el buscador mostraría la misma Ahsoka ocho veces —una por
 * impresión— y el índice de resolución quedaría lleno de duplicados que solo
 * se diferencian en el arte.
 *
 * Quien llama tiene que haber corrido `ensureCards()` antes: si la base local
 * está vacía esto devuelve listas vacías SIN error, y el buscador se vería
 * roto sin decir por qué.
 */
export async function cargarIndice(): Promise<IndiceCartas> {
  const [lideresCrudos, basesCrudas] = await Promise.all([
    db.cards.where('type').equals('Leader').toArray(),
    db.cards.where('type').equals('Base').toArray(),
  ])

  const canonicas = (xs: Card[]) => xs.filter(c => c.isCanonical !== false)

  const lideres = canonicas(lideresCrudos)
    .sort((a, b) => a.name.localeCompare(b.name) || (a.subtitle ?? '').localeCompare(b.subtitle ?? ''))
  const bases = canonicas(basesCrudas)
    .sort((a, b) => a.name.localeCompare(b.name))

  const porClave = new Map<string, Card>()
  for (const c of [...lideres, ...bases]) {
    const clave = claveDeCarta(c)
    if (!porClave.has(clave)) porClave.set(clave, c)
    // El nombre pelado también, para los duelos guardados antes de que el
    // líder llevara subtítulo. `Ahsoka Tano` a secas resolverá a UNA de las
    // cuatro — la primera alfabéticamente — y eso es lo mejor que se puede
    // hacer con el dato que hay. No es adivinar el mazo: es pintar un arte.
    if (!porClave.has(c.name)) porClave.set(c.name, c)
  }

  return { lideres, bases, porClave }
}

/** La carta detrás de un texto guardado, o `null` si no resuelve. */
export function resolver(indice: IndiceCartas | null, texto: string): Card | null {
  if (!indice || !texto) return null
  return indice.porClave.get(texto) ?? indice.porClave.get(texto.split(SEPARADOR)[0]) ?? null
}

/** Lo que se muestra cuando hay que leer el texto: sin la raya, que estorba. */
export function nombreCorto(texto: string): string {
  return texto.split(SEPARADOR)[0] || texto
}

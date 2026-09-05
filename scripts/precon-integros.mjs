#!/usr/bin/env node
/**
 * ¿Los mazos preconstruidos siguen enteros?
 *
 *   npm run precon
 *
 * Las listas se resolvieron carta por carta contra el catalogo ANTES de
 * escribir el archivo, y lo guardado son IDs. Esta guarda fija la forma, que
 * es lo que se puede romper editando a mano:
 *
 *  · Un precon de Twin Suns tiene DOS lideres. Con uno, el validador marcaria
 *    el mazo invalido apenas se abre y la persona creeria que el precon esta
 *    mal armado.
 *  · Son SINGLETON: una copia de cada carta. Un id repetido significa que
 *    alguien pego una linea dos veces.
 *  · Un id vacio no falla al agregar: el mazo se guarda con un hueco y la
 *    persona cree que tiene el precon completo.
 */
import { readFileSync } from 'node:fs'

const mazos = JSON.parse(
  readFileSync(new URL('../src/data/preconTwinSuns.json', import.meta.url), 'utf8'))

let fallos = 0
const ok = (t, c, extra = '') => {
  if (!c) { fallos++; console.log(`  FALLO  ${t} ${extra}`) } else console.log(`  ok     ${t}`)
}

ok('hay 4 mazos', mazos.length === 4, `hay ${mazos.length}`)

const slugs = new Set()
for (const m of mazos) {
  ok(`${m.nombre}: slug unico`, !slugs.has(m.slug)); slugs.add(m.slug)
  ok(`${m.nombre}: dos lideres`, m.lideres?.length === 2, `tiene ${m.lideres?.length}`)
  ok(`${m.nombre}: tiene base`, !!m.base?.cardId)
  ok(`${m.nombre}: 80 cartas`, m.cartas?.length === 80, `tiene ${m.cartas?.length}`)

  const todas = [...m.lideres, m.base, ...m.cartas]
  ok(`${m.nombre}: ningun id vacio`, todas.every(c => typeof c.cardId === 'string' && c.cardId.length > 3))
  ok(`${m.nombre}: ningun nombre vacio`, todas.every(c => (c.name || '').trim().length > 0))

  // Singleton: una copia de cada carta, incluidos lideres y base.
  const ids = todas.map(c => c.cardId)
  const repes = ids.filter((x, i) => ids.indexOf(x) !== i)
  ok(`${m.nombre}: sin repetidas`, repes.length === 0, repes.join(', '))
}

console.log(fallos ? `\n${fallos} fallo(s)` : '\nlos precon estan enteros')
process.exit(fallos ? 1 : 0)

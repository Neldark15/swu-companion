#!/usr/bin/env tsx
/**
 * La agrupación por coste, fijada.
 *
 *   npm run agrupar-coste
 *
 * Se protege lo que se puede equivocar EN SILENCIO: que una carta sin coste
 * conocido caiga en el grupo del 0 —afirmando algo falso sobre la curva del
 * mazo— y que las copias se cuenten como entradas, que da una curva a escala
 * equivocada.
 *
 * Se importa el módulo de verdad con `tsx`. Un intento anterior recortaba los
 * tipos con expresiones regulares para poder correrlo con node pelado: eso
 * prueba una copia deformada del código, no el código.
 */
import { agruparPorCoste } from '../src/services/cardSort'

let fallos = 0
const ok = (t: string, c: boolean, extra = '') => {
  if (!c) { fallos++; console.log(`  FALLO  ${t} ${extra}`) } else console.log(`  ok     ${t}`)
}

interface Fila { n: string; coste: number | null; q: number }
const cartas: Fila[] = [
  { n: 'c', coste: 2, q: 3 },
  { n: 'a', coste: 0, q: 1 },
  { n: 'z', coste: null, q: 2 },
  { n: 'b', coste: 2, q: 1 },
  { n: 'd', coste: 7, q: 1 },
]

const g = agruparPorCoste<Fila>(cartas, x => x.coste, x => x.q, (a, b) => a.n.localeCompare(b.n))
const de = (c: number) => g.find(x => x.coste === c)!

ok('los costes salen de menor a mayor', g.map(x => x.coste).join(',') === '0,2,7,')
ok('el coste desconocido va al final y APARTE', g[g.length - 1].coste === null)
ok('el desconocido NO cae en el grupo del 0', de(0).cartas.length === 1)
ok('cuenta COPIAS, no entradas', de(2).copias === 4, `dio ${de(2).copias}`)
ok('ordena dentro de cada grupo', de(2).cartas.map(c => c.n).join('') === 'bc')
ok('no pierde ni duplica cartas',
   g.reduce((n, x) => n + x.cartas.length, 0) === cartas.length)

// Un mazo entero de coste desconocido no puede inventar un grupo de 0.
const soloNulos = agruparPorCoste<Fila>([{ n: 'x', coste: null, q: 1 }], x => x.coste, x => x.q)
ok('sin costes conocidos, un solo grupo y es el nulo',
   soloNulos.length === 1 && soloNulos[0].coste === null)

console.log(fallos ? `\n${fallos} fallo(s)` : '\nla agrupación por coste se sostiene')
process.exit(fallos ? 1 : 0)

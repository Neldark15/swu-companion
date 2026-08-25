/**
 * ¿Está sesgada la posición de la respuesta correcta en la trivia?
 *
 *   npx tsx scripts/trivia-barajado.test.mts
 *
 * El banco se escribió a mano y quedó torcido sin que nadie lo notara: de las
 * 180 preguntas, 95 tenían la correcta en la PRIMERA opción y una sola en la
 * cuarta. Contestar siempre la primera acertaba el 53 %, y las dos primeras
 * cubrían el 89 %. Como la trivia paga créditos, eso no es un juego flojo: es
 * una fuga de la economía.
 *
 * Esta prueba mide el reparto REAL —el que ve la gente, después de barajar— y
 * se planta si alguna posición se sale de lo razonable. Es la clase de fallo
 * que no da error, no rompe nada y solo se ve contando.
 */

// Se importa del módulo PURO, no de `trivia.ts`: aquel arrastra el cliente de
// Supabase, que necesita `import.meta.env` y no existe fuera del navegador.
import { getDailyQuestions } from '../src/services/triviaSorteo.ts'
import { BANCO_TRIVIA } from '../src/services/triviaBanco.ts'

let fallos = 0

console.log('\n── El banco, tal como está escrito ──')
const crudo = [0, 0, 0, 0]
for (const q of BANCO_TRIVIA) crudo[q.correctIndex]++
console.log(`  posiciones 1ª/2ª/3ª/4ª: ${crudo.join(' / ')}  (de ${BANCO_TRIVIA.length})`)
console.log('  ↑ este sesgo es el que hay que TAPAR barajando, no el que se mide abajo')

/* Se simulan muchas cuentas: cada una recibe sus diez preguntas del día ya
   barajadas. Es exactamente lo que devuelve la app, no una aproximación. */
console.log('\n── Lo que de verdad ve la gente ──')
const visto = [0, 0, 0, 0]
const CUENTAS = 400
for (let i = 0; i < CUENTAS; i++) {
  for (const q of getDailyQuestions(`cuenta-de-prueba-${i}`)) visto[q.correctIndex]++
}
const total = visto.reduce((a, b) => a + b, 0)
const pct = visto.map(v => (v / total) * 100)
console.log(`  posiciones 1ª/2ª/3ª/4ª: ${visto.join(' / ')}  (${pct.map(p => p.toFixed(1) + '%').join(' · ')})`)

// Con 4 opciones, lo justo es 25 % cada una. Se deja margen porque la muestra
// es finita, pero nada puede acercarse al 53 % que había.
for (let i = 0; i < 4; i++) {
  if (pct[i] < 18 || pct[i] > 32) {
    fallos++
    console.log(`  ✗ la posición ${i + 1} sale el ${pct[i].toFixed(1)}% — debería rondar el 25%`)
  }
}
if (!fallos) console.log('  ✓ ninguna posición se despega: adivinar ya no paga')

/* Que baraje no sirve de nada si mueve la respuesta correcta. Se comprueba que
   el TEXTO correcto siga siendo el mismo después de barajar. */
console.log('\n── La respuesta correcta sigue siendo la correcta ──')
let malas = 0
for (let i = 0; i < 80; i++) {
  for (const q of getDailyQuestions(`cuenta-de-prueba-${i}`)) {
    const original = BANCO_TRIVIA.find(o => o.id === q.id)
    if (!original) { malas++; continue }
    if (q.options[q.correctIndex] !== original.options[original.correctIndex]) malas++
    // Y ninguna opción se perdió ni se duplicó por el camino.
    if ([...q.options].sort().join('|') !== [...original.options].sort().join('|')) malas++
  }
}
if (malas) { fallos += malas; console.log(`  ✗ ${malas} preguntas quedaron con la respuesta cambiada`) }
else console.log('  ✓ el texto correcto se mantiene, y no se pierde ni se repite ninguna opción')

/* DETERMINISTA: dos llamadas seguidas tienen que dar el MISMO orden, o las
   opciones se moverían bajo el dedo de quien está por tocar una. */
console.log('\n── Estable entre repintados ──')
const a = getDailyQuestions('cuenta-estable')
const b = getDailyQuestions('cuenta-estable')
const iguales = a.every((q, i) => q.id === b[i].id && q.options.join('|') === b[i].options.join('|'))
if (!iguales) { fallos++; console.log('  ✗ dos llamadas dieron órdenes distintos') }
else console.log('  ✓ el mismo día y la misma cuenta dan siempre el mismo orden')

console.log(fallos === 0 ? '\n✅ TODO PASA\n' : `\n❌ ${fallos} fallo(s)\n`)
process.exit(fallos === 0 ? 0 : 1)

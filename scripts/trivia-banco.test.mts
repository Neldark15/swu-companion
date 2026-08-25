/**
 * ¿Está sano el banco de trivia?
 *
 *   npx tsx scripts/trivia-banco.test.mts
 *
 * Comprueba lo que solo se ve contando: ids únicos, cuatro opciones sin
 * repetir, `correctIndex` en rango, aspectos válidos — y sobre todo las dos
 * cosas que ya se colaron de verdad en este banco:
 *
 *  · REPETIDAS. En la primera ampliación entraron Dooku y el Halcón por
 *    duplicado, con otro id, y salieron como preguntas «nuevas».
 *  · FILTRACIONES. El `funFact` de una pregunta que regala la respuesta de
 *    otra. Los revisores encontraron diez de estas en la tanda de 111, y es
 *    un fallo que nadie ve leyendo: hay que cruzar todas contra todas.
 */

import { BANCO_TRIVIA } from '../src/services/triviaBanco.ts'
import { ASPECTOS, ASPECTO_POR_TEMA } from '../src/services/aspectos.ts'

let fallos = 0
const decir = (ok: boolean, bien: string, mal: string) => {
  if (ok) console.log(`  ✓ ${bien}`)
  else { fallos++; console.log(`  ✗ ${mal}`) }
}

console.log(`\n── El banco: ${BANCO_TRIVIA.length} preguntas ──`)

// ── Forma ──
const ids = new Set<string>()
let repes = 0, malForma = 0, opcionesRepetidas = 0
for (const q of BANCO_TRIVIA) {
  if (ids.has(q.id)) { repes++; console.log(`    id repetido: ${q.id}`) }
  ids.add(q.id)
  if (q.options.length !== 4) { malForma++; console.log(`    ${q.id}: ${q.options.length} opciones`) }
  if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
    malForma++; console.log(`    ${q.id}: correctIndex fuera de rango`)
  }
  if (new Set(q.options.map(o => o.trim().toLowerCase())).size !== q.options.length) {
    opcionesRepetidas++; console.log(`    ${q.id}: dos opciones iguales`)
  }
}
decir(repes === 0, 'ids únicos', `${repes} ids repetidos`)
decir(malForma === 0, 'cuatro opciones y correctIndex en rango', `${malForma} preguntas mal formadas`)
decir(opcionesRepetidas === 0, 'ninguna pregunta repite una opción', `${opcionesRepetidas} con opciones duplicadas`)

// ── Aspectos ──
let aspMal = 0
for (const q of BANCO_TRIVIA) {
  const a = (q as { aspecto?: string }).aspecto
  if (a && !(ASPECTOS as readonly string[]).includes(a)) {
    aspMal++; console.log(`    ${q.id}: aspecto desconocido «${a}»`)
  }
  if (!ASPECTO_POR_TEMA[q.tema]) {
    aspMal++; console.log(`    ${q.id}: el tema «${q.tema}» no mapea a ningún aspecto`)
  }
}
decir(aspMal === 0, 'todo aspecto y todo tema son conocidos', `${aspMal} problemas de aspecto`)

/* ── REPETIDAS ──
   Se comparan por el conjunto de palabras significativas del enunciado: dos
   preguntas que comparten casi todas son la misma con otras palabras, que es
   exactamente cómo se colaron las repetidas anteriores. */
const VACIAS = new Set(['que','cual','quien','como','donde','cuando','cuantos','cuantas','de','del','la','el','los','las','un','una','en','se','y','o','a','al','es','son','por','para','con','su','sus','lo','le','mas','the'])
const normal = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !VACIAS.has(w))

console.log('\n── Preguntas repetidas ──')
const palabras = BANCO_TRIVIA.map(q => ({ id: q.id, w: new Set(normal(q.question)) }))
let parecidas = 0
for (let i = 0; i < palabras.length; i++) {
  for (let j = i + 1; j < palabras.length; j++) {
    const a = palabras[i].w, b = palabras[j].w
    if (a.size < 3 || b.size < 3) continue
    let comunes = 0
    for (const w of a) if (b.has(w)) comunes++
    const jaccard = comunes / (a.size + b.size - comunes)
    if (jaccard >= 0.75) {
      parecidas++
      if (parecidas <= 40) console.log(`    ${palabras[i].id} ≈ ${palabras[j].id} (${(jaccard * 100).toFixed(0)}% en común)`)
    }
  }
}
decir(parecidas === 0, 'ninguna pregunta repite a otra', `${parecidas} pares casi idénticos`)

/* ── FILTRACIONES ──
   Un `funFact` que contiene la respuesta correcta de OTRA pregunta.
   Es el fallo que más veces se coló acá: los revisores encontraron diez en la
   tanda de 111, y no se ve leyendo una pregunta por vez.

   PERO NO TODA COINCIDENCIA ES UNA FILTRACIÓN. «Anakin Skywalker» es la
   respuesta de cinco preguntas distintas y aparece en veinte funFact: saber
   que ese nombre existe no te ayuda a contestar ninguna en particular. La
   filtración duele cuando las dos preguntas hablan de LO MISMO — ahí sí, leer
   una te regala la otra.

   Por eso se exige las dos cosas: que el dato contenga la respuesta Y que los
   dos enunciados compartan tema. Es el mismo criterio que se aplicó a mano al
   revisar la tanda nueva. */
console.log('\n── funFacts que regalan otra respuesta ──')
let filtra = 0
for (const q of BANCO_TRIVIA) {
  const dato = q.funFact.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const suyas = new Set(normal(q.question))
  for (const otra of BANCO_TRIVIA) {
    if (otra.id === q.id) continue
    const resp = otra.options[otra.correctIndex].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    // Solo respuestas con sustancia: «Azul» aparecería en medio mundo.
    if (resp.length < 9) continue
    if (!dato.includes(resp)) continue
    // ¿Hablan de lo mismo? Sin esto, un nombre repetido dispara falsos avisos.
    const otrasP = new Set(normal(otra.question))
    let comunes = 0
    for (const w of suyas) if (otrasP.has(w)) comunes++
    const cerca = comunes / Math.min(suyas.size, otrasP.size)
    if (cerca < 0.5) continue
    filtra++
    if (filtra <= 40) console.log(`    el funFact de ${q.id} regala la respuesta de ${otra.id}: «${otra.options[otra.correctIndex]}»`)
  }
}
decir(filtra === 0, 'ningún funFact regala la respuesta de una pregunta hermana', `${filtra} filtraciones`)

console.log(fallos === 0 ? '\n✅ TODO PASA\n' : `\n❌ ${fallos} fallo(s)\n`)
process.exit(fallos === 0 ? 0 : 1)

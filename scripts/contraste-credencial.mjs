#!/usr/bin/env node
/**
 * Comprueba el contraste de los temas de la credencial.
 *
 * El archivo afirma que «el `texto` sobre `panel` pasa el contraste AA en las
 * catorce». Esto lo VERIFICA en vez de creerlo — y verifica también los que se
 * agreguen después, que es cuando la afirmación se rompe.
 *
 * Se miden tres pares, y cada uno es un texto que existe de verdad en la placa:
 *   texto  sobre panel  — los datos (nombre, rango, ubicación)
 *   acento sobre panel  — el sub-nombre y los rótulos de acento
 *   grabado sobre panel — los rótulos chicos grabados
 *
 * Umbrales WCAG: 4,5 para texto normal, 3,0 para texto grande (18,66 px en
 * negrita o 24 px). Los rótulos de la placa son chicos, así que el listón real
 * es 4,5; el grabado es decorativo y se le pide 3,0.
 */
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../src/features/credencial/credencialTemas.ts', import.meta.url), 'utf8')
const bloque = src.match(/export const TEMAS_CREDENCIAL[\s\S]*?\n\]/)[0]

const temas = [...bloque.matchAll(
  /id: '([^']+)',\s*etiqueta: '([^']+)',\s*base: '(#[0-9A-Fa-f]{6})',\s*panel: '(#[0-9A-Fa-f]{6})',\s*texto: '(#[0-9A-Fa-f]{6})',\s*acento: '(#[0-9A-Fa-f]{6})',\s*acentoTexto: '(#[0-9A-Fa-f]{6})',\s*grabado: '(#[0-9A-Fa-f]{6})'/g,
)].map(m => ({
  id: m[1], etiqueta: m[2], base: m[3], panel: m[4],
  texto: m[5], acento: m[6], acentoTexto: m[7], grabado: m[8],
}))

/* Un cero acá NO es un aprobado.
 *
 * Al agregar `acentoTexto` el patrón dejó de casar y el guion dijo «0 temas ·
 * TODOS PASAN» — verde sobre nada medido, que es el peor resultado posible
 * porque parece el mejor. Es el mismo fallo que ya tuvo el DetectorChoques de
 * la credencial (§2z). */
if (temas.length === 0) {
  console.error('No se pudo leer ningún tema: el patrón dejó de casar con el archivo.')
  process.exit(1)
}

const canal = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const luz = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255)
}
const contraste = (a, b) => {
  const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const MIN_TEXTO = 4.5
const MIN_GRABADO = 3.0

let fallos = 0
console.log(`${temas.length} temas\n`)
console.log('tema                 texto  acentoTx grabado')
for (const t of temas) {
  const ct = contraste(t.texto, t.panel)
  // Se mide `acentoTexto`, que es el que lleva texto chico. El `acento` crudo
  // solo pinta formas y el número grande de nivel (texto grande, umbral 3,0).
  const ca = contraste(t.acentoTexto, t.panel)
  const cg = contraste(t.grabado, t.panel)
  const malo = ct < MIN_TEXTO || ca < MIN_TEXTO || cg < MIN_GRABADO
  if (malo) fallos++
  const m = (v, min) => `${v.toFixed(2)}${v < min ? '✗' : ' '}`
  console.log(
    `${t.etiqueta.padEnd(20)} ${m(ct, MIN_TEXTO)} ${m(ca, MIN_TEXTO)}  ${m(cg, MIN_GRABADO)}` +
    (malo ? '   ← NO PASA' : ''),
  )
}

// Dos temas con el mismo acento no suman una opción, suman una duda.
const porAcento = new Map()
for (const t of temas) {
  const k = t.acento.toLowerCase()
  porAcento.set(k, [...(porAcento.get(k) ?? []), t.etiqueta])
}
const repes = [...porAcento.entries()].filter(([, v]) => v.length > 1)
if (repes.length) {
  console.log('\nACENTOS REPETIDOS:')
  for (const [c, v] of repes) console.log(`  ${c}: ${v.join(', ')}`)
}

console.log(fallos === 0 && repes.length === 0
  ? `\n${'='.repeat(44)}\nTODOS PASAN`
  : `\n${fallos} temas por debajo del umbral`)
process.exit(fallos ? 1 : 0)

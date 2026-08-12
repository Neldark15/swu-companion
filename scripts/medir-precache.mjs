#!/usr/bin/env node
/**
 * Cuánto se baja de verdad quien instala la PWA.
 *
 * ── Por qué existe ───────────────────────────────────────────────────
 *
 * Es fácil creer que una ruta perezosa no le cuesta nada a quien nunca entra.
 * Con `injectManifest` eso es FALSO: `precacheAndRoute(self.__WB_MANIFEST)`
 * (src/sw.ts) se baja TODOS los chunks del build en la instalación, perezosos
 * incluidos. Medido el 2026-08-12 sobre `dist/sw.js`: 174 entradas, 5.044.812 B,
 * y adentro estaban `three-*.js` (521 KB), `GalaxiaPage`, `GalaxiaEscena`,
 * `MesaEscena` y `LabPage` — todas pantallas que la mayoría no abre nunca.
 *
 * La pereza del router aplaza la EJECUCIÓN, no la DESCARGA.
 *
 * Sin este script, meter una pantalla pesada engorda la instalación de los 20
 * usuarios y nadie se entera hasta que alguien se queja de que la app tarda en
 * instalar con datos móviles. Con él, el número es un criterio duro que se
 * mira en cada cambio.
 *
 * ── Uso ──────────────────────────────────────────────────────────────
 *
 *   npm run build && node scripts/medir-precache.mjs
 *   node scripts/medir-precache.mjs --max-kb 5100    (falla si se pasa)
 */

import { readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist'
const SW = join(DIST, 'sw.js')

/** Chunks que interesa vigilar de cerca: los que NO debería bajarse todo el mundo. */
const VIGILADOS = ['three-', 'GalaxiaPage', 'GalaxiaEscena', 'MesaEscena', 'LabPage', 'exploracion/']

function arg(nombre) {
  const i = process.argv.indexOf(nombre)
  return i >= 0 ? process.argv[i + 1] : null
}

if (!existsSync(SW)) {
  console.error(`No existe ${SW}. Corré primero: npm run build`)
  process.exit(1)
}

const sw = readFileSync(SW, 'utf8')

/**
 * El manifiesto va inyectado como un array de `{revision, url}`. El minificador
 * decide si las claves llevan comillas, así que se prueban las dos formas y se
 * usa la que encuentre más — comparar por cantidad evita quedarse con un
 * puñado de falsos positivos de alguna otra parte del archivo.
 */
const conComillas = [...sw.matchAll(/"url"\s*:\s*"([^"]+)"/g)].map(m => m[1])
const sinComillas = [...sw.matchAll(/\burl\s*:\s*"([^"]+)"/g)].map(m => m[1])
const urls = conComillas.length >= sinComillas.length ? conComillas : sinComillas

if (urls.length === 0) {
  console.error('No se encontró el manifiesto dentro de sw.js. ¿Cambió el formato de workbox?')
  process.exit(1)
}

let total = 0
let faltantes = 0
const pesos = []

for (const u of urls) {
  const p = join(DIST, u.replace(/^\//, ''))
  if (existsSync(p)) {
    const s = statSync(p).size
    total += s
    pesos.push({ url: u, bytes: s })
  } else {
    // Una entrada sin archivo no es cosmética: el `install` del service worker
    // es ATÓMICO. Si una sola falla, no se activa la versión nueva y el usuario
    // se queda con la vieja sin ningún aviso.
    faltantes++
    console.warn(`  ⚠ entrada sin archivo: ${u}`)
  }
}

const kb = total / 1024
console.log('')
console.log(`  entradas   ${urls.length}`)
console.log(`  bytes      ${total.toLocaleString('es-SV')}`)
console.log(`  KB         ${kb.toFixed(0)}`)
console.log(`  faltantes  ${faltantes}`)
console.log('')

console.log('  los 10 más pesados:')
for (const { url, bytes } of pesos.sort((a, b) => b.bytes - a.bytes).slice(0, 10)) {
  console.log(`    ${(bytes / 1024).toFixed(0).padStart(6)} KB  ${url}`)
}
console.log('')

console.log('  vigilados (¿se los baja quien nunca abre esa pantalla?):')
for (const v of VIGILADOS) {
  const hits = pesos.filter(p => p.url.includes(v))
  if (hits.length === 0) {
    console.log(`    fuera  ${v}`)
  } else {
    const suma = hits.reduce((a, b) => a + b.bytes, 0)
    console.log(`    SÍ     ${v.padEnd(16)} ${hits.length} archivo(s), ${(suma / 1024).toFixed(0)} KB`)
  }
}
console.log('')

const maxKb = Number(arg('--max-kb'))
if (Number.isFinite(maxKb) && maxKb > 0 && kb > maxKb) {
  console.error(`  ✗ El precache pesa ${kb.toFixed(0)} KB y el tope es ${maxKb} KB.`)
  process.exit(1)
}
if (faltantes > 0) {
  console.error(`  ✗ Hay ${faltantes} entradas sin archivo: el install del service worker va a fallar entero.`)
  process.exit(1)
}

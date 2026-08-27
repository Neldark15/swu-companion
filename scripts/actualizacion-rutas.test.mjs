#!/usr/bin/env node
/**
 * Qué rutas se actualizan solas y cuáles preguntan.
 *
 * La app pasó de preguntar SIEMPRE a aplicarse sola donde no hay nada que
 * interrumpir. Eso es exactamente donde un error se paga caro: recargar encima
 * de alguien que está llevando la vida de una partida le borra el marcador.
 *
 * La lista es BLANCA a propósito — lo que no está declarado pregunta, que es
 * el fallo barato. Esta prueba existe para que agregar una ruta nueva a la
 * lista sea una decisión y no un descuido, y para fijar el caso que más cuesta
 * ver leyendo: `/liga/:code` es segura y `/liga/:code/panel` NO, aunque una
 * sea prefijo de la otra.
 *
 * Si tocás `SEGURAS` o `esSegura` en src/components/UpdatePrompt.tsx, copiá el
 * cambio acá y corré esto.
 */
import { readFileSync } from 'node:fs'

const fuente = readFileSync(new URL('../src/components/UpdatePrompt.tsx', import.meta.url), 'utf8')

// La lista se lee DEL COMPONENTE, no se copia: dos listas se separan.
const bloque = fuente.match(/const SEGURAS = \[([\s\S]*?)\]/)
if (!bloque) {
  console.error('✗ no se encontró SEGURAS en UpdatePrompt.tsx. Cambió el formato y esto no mide nada.')
  process.exit(1)
}
const SEGURAS = [...bloque[1].matchAll(/'([^']+)'/g)].map(m => m[1])
if (SEGURAS.length < 10) {
  console.error(`✗ solo se leyeron ${SEGURAS.length} rutas seguras. Algo se rompió.`)
  process.exit(1)
}
const NO_SEGURAS = ['/liga/', '/panel']

function esSegura(ruta) {
  const l = ruta.split('?')[0]
  if (l.startsWith(NO_SEGURAS[0]) && l.endsWith(NO_SEGURAS[1])) return false
  if (l === '/') return true
  return SEGURAS.some(r => r !== '/' && (l === r || l.startsWith(r.endsWith('/') ? r : r + '/')))
}

const CASOS = [
  // Lectura o estado ya guardado: recargar no cuesta nada.
  ['/', true], ['/explore', true], ['/cards/abc', true], ['/liga/puente3', true],
  ['/u/123', true], ['/profile', true], ['/sobres', true], ['/blog/algo', true],
  ['/rulings', true], ['/misiones', true], ['/sable', true],
  // Algo a medio hacer que solo vive en la pantalla.
  ['/play', false], ['/contador', false], ['/contador/mesa', false],
  ['/decks', false], ['/decks/abc', false], ['/events/dashboard/X', false],
  // El que cuesta ver leyendo: prefijo compartido, respuesta opuesta.
  ['/liga/puente3/panel', false],
]

let mal = 0
for (const [ruta, esperado] of CASOS) {
  const dio = esSegura(ruta)
  if (dio !== esperado) {
    mal++
    console.error(`  ✗ ${ruta}: dio ${dio ? 'se actualiza sola' : 'pregunta'}, se esperaba lo contrario`)
  }
}

console.log(`${SEGURAS.length} rutas en la lista blanca · ${CASOS.length} casos`)
if (mal) { console.error(`\n✗ ${mal} fallos`); process.exit(1) }
console.log('✓ cada ruta decide lo que debe')

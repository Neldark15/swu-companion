#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Ejecuta la política real, sin copiar listas ni reimplementar el predicado.
const fuente = readFileSync(new URL('../src/services/politicaActualizacion.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(fuente, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
const { esSeguraParaActualizar, omitirRegistroPwa, posponerAvisoActualizacion } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const casos = [
  ['/', true], ['/explore', true], ['/cards/abc', true], ['/liga/puente3', true],
  ['/u/123', true], ['/profile', true], ['/sobres', true], ['/blog/algo', true],
  ['/rulings?regla=7.4.2', true], ['/misiones', true], ['/sable', true],
  ['/play', false], ['/contador', false], ['/contador/mesa', false],
  ['/contador/registrado', false], ['/calculadora', false], ['/jugar', false],
  ['/decks', false], ['/decks/abc', false], ['/events/dashboard/X', false],
  ['/liga/puente3/panel', false], ['/liga/puente3/panel/', false],
  ['/ruta-nueva', false], ['/cards-falso', false], ['/overlay/abc', false],
]
for (const [ruta, esperado] of casos) assert.equal(esSeguraParaActualizar(ruta), esperado, ruta)
for (const ruta of ['/contador', '/contador/mesa', '/play', '/jugar', '/events/live/x', '/overlay/x', '/estudio/x', '/liga/puente3/panel']) {
  assert.equal(posponerAvisoActualizacion(ruta), true, `No interrumpir ${ruta}`)
}
assert.equal(omitirRegistroPwa('/contador'), false, 'El contador directo debe instalar la PWA')
for (const ruta of ['/overlay/x', '/estudio', '/estudio/x', '/events/live/x']) assert.equal(omitirRegistroPwa(ruta), true, ruta)
console.log(`✓ ${casos.length} rutas + pantallas protegidas y registro directo del contador`)

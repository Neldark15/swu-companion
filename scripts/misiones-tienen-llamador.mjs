#!/usr/bin/env node
/**
 * Comprueba la regla del §3h-ter: «una misión sin llamador es una tarea
 * imposible en pantalla».
 *
 * Cruza tres listas que tienen que coincidir:
 *   1. los `objectiveType` declarados en el tipo,
 *   2. los que usa alguna plantilla del catálogo,
 *   3. los que alguien dispara de verdad con `updateMissionProgress`.
 *
 * Existe porque la regla ya se rompió dos veces —tres misiones colgaban de
 * `arenaMatchesLogged`, que nadie incrementaba, y cuatro tipos quedaron
 * declarados sin plantilla ni llamador—. Acordarse no alcanzó; esto sí se
 * puede correr.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = new URL('..', import.meta.url).pathname
const SRC = join(RAIZ, 'src')
/* El catálogo vive en `misionesCatalogo.ts` (puro) y los llamadores en las
   pantallas. Este script ya se rompió una vez cuando el catálogo se mudó, y
   eso está bien: prefiere fallar a mirar un archivo que ya no manda. */
const MS = readFileSync(join(SRC, 'services/misionesCatalogo.ts'), 'utf8')

const declarados = new Set(
  (MS.match(/export type ObjectiveType =[\s\S]*?\n\n/)?.[0] ?? '')
    .match(/'([a-z_]+)'/g)?.map(s => s.slice(1, -1)) ?? [],
)
const usadosPorPlantillas = new Set(
  [...MS.matchAll(/objectiveType:\s*'([a-z_]+)'/g)].map(m => m[1]),
)

const archivos = []
;(function recorrer(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) recorrer(p)
    else if (/\.tsx?$/.test(e)) archivos.push(p)
  }
})(SRC)

const conLlamador = new Set()
for (const f of archivos) {
  if (f.endsWith('services/missionService.ts') || f.endsWith('services/misionesCatalogo.ts')) continue
  for (const m of readFileSync(f, 'utf8').matchAll(/updateMissionProgress\(\s*[^,]+,\s*'([a-z_]+)'/g)) {
    conLlamador.add(m[1])
  }
}

const problemas = []
for (const t of usadosPorPlantillas) {
  if (!conLlamador.has(t)) problemas.push(`MISIÓN IMPOSIBLE: alguna plantilla pide '${t}' y NADIE lo dispara`)
}
for (const t of declarados) {
  if (!usadosPorPlantillas.has(t)) problemas.push(`TIPO MUERTO: '${t}' está declarado y ninguna plantilla lo usa`)
}
for (const t of conLlamador) {
  if (!declarados.has(t)) problemas.push(`TIPO FANTASMA: alguien dispara '${t}' y no está en ObjectiveType`)
}

console.log(`objectiveType declarados     ${declarados.size}`)
console.log(`usados por alguna plantilla  ${usadosPorPlantillas.size}`)
console.log(`con llamador real            ${conLlamador.size}`)
console.log(`  ${[...conLlamador].sort().join(', ')}`)
if (problemas.length) {
  console.log('\n' + problemas.map(p => '  ✗ ' + p).join('\n'))
  process.exit(1)
}
console.log('\nTodas las misiones del catálogo se pueden cumplir.')

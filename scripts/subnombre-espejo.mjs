#!/usr/bin/env node
/**
 * La lista compartida de casos del sub-nombre.
 *
 * La regla existe DOS veces —en `services/subnombre.ts` para responder al
 * instante y en Postgres para que mande de verdad— y dos copias de una regla
 * se separan (§3c). Este archivo es la única lista de casos: el lado TS la
 * corre acá, y el SQL la corre contra la base con el mismo arreglo.
 *
 *   node scripts/subnombre-espejo.mjs            → prueba el lado TS
 *   node scripts/subnombre-espejo.mjs --sql      → escupe el SQL para la base
 */

export const CASOS = [
  // Reservados para el creador
  ['The Creator', true], ['Creator', true], ['creador', true], ['El Creador', true],
  ['CREADOR', true], ['Créator', true], ['Cre4dor', true], ['cr3ator', true],
  ['C R E A T O R', true], ['the-creator', true], ['xXcreatorXx', true],
  ['Kreador', true], ['creador de la plataforma', true], ['CrEaToR', true],
  ['Th3 Cr34t0r', true], ['c.r.e.a.d.o.r', true], ['Criador', true],
  ['creatore', true], ['THE  CREATOR', true], ['_creator_', true],
  // Legítimos: no se puede prohibir un verbo común
  ['Creativo', false], ['Creado en SV', false], ['Crear mazos', false],
  ['Jedi de Sonsonate', false], ['El Contrabandista', false], ['Cazarrecompensas', false],
  ['Maestro del Sable', false], ['Piloto Rebelde', false], ['', false],
  ['Señor de los Sith', false], ['Mandaloriano', false], ['Nº1 del ranking', false],
]

if (process.argv.includes('--sql')) {
  const filas = CASOS.map(([t, esp]) => `  (${JSON.stringify(t).replace(/"/g, "'")}, ${esp})`).join(',\n')
  console.log(`select c.t as caso,
       c.esp as esperado,
       public.subnombre_reservado(c.t) as dio
from (values\n${filas}\n) c(t, esp)
where public.subnombre_reservado(c.t) <> c.esp;`)
  process.exit(0)
}

const { subnombreReservado } = await import('../src/services/subnombreRegla.ts')

let fallos = 0
for (const [texto, esperado] of CASOS) {
  const dio = subnombreReservado(texto)
  if (dio !== esperado) {
    fallos++
    console.log(`  ✗ "${texto}" → ${dio ? 'BLOQUEA' : 'permite'}, se esperaba ${esperado ? 'BLOQUEA' : 'permite'}`)
  }
}
console.log(fallos === 0
  ? `TS: ${CASOS.length}/${CASOS.length} casos bien.`
  : `TS: ${fallos} FALLOS de ${CASOS.length}.`)
process.exit(fallos ? 1 : 0)

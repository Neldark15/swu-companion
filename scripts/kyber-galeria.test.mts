// Ejecutar con npx tsx scripts/kyber-galeria.test.mts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MODELOS_GALERIA, disenoParaEquipar } from '../src/features/sable/modelosGaleria.ts'
import { IDS_CONOCIDOS, POR_DEFECTO } from '../src/features/sable/partesSable.ts'
import { longitudesDeHoja } from '../src/features/sable/hojasModelo.ts'
import type { ParteTaller } from '../src/services/sableService.ts'

const catalogo = readFileSync(new URL('../supabase/migrations/sable-modelos-galeria.sql', import.meta.url), 'utf8')
const gratis = new Set([POR_DEFECTO.emisor, POR_DEFECTO.cuerpo, POR_DEFECTO.pomo, POR_DEFECTO.color])
for (const fila of catalogo.matchAll(/\('([a-z_]+)', '(?:emisor|cuerpo|pomo)', '[^']+', 0,/g)) gratis.add(fila[1])
const partes = (Object.entries(IDS_CONOCIDOS) as [ParteTaller['tipo'], string[]][]).flatMap(([tipo, ids]) =>
  ids.map(id => ({ id, tipo, nombre: id, precio: gratis.has(id) ? 0 : 1, orden: 1, tengo: gratis.has(id),
    rareza: 'comun', potencia: 0, control: 0, energia: 0 })))
const siluetas = new Set<string>()
for (const modelo of MODELOS_GALERIA) {
  const d = modelo.diseno
  assert.ok(!siluetas.has([d.emisor, d.cuerpo, d.pomo].join('/')), modelo.nombre)
  siluetas.add([d.emisor, d.cuerpo, d.pomo].join('/'))
  const foto = readFileSync(new URL(`../public/kyber/modelos/${modelo.id}.webp`, import.meta.url))
  assert.equal(foto.subarray(8, 12).toString(), 'WEBP', modelo.nombre)
  for (const tipo of ['emisor', 'cuerpo', 'pomo', 'color'] as const) assert.ok(IDS_CONOCIDOS[tipo].includes(d[tipo]), d[tipo])
  assert.deepEqual(disenoParaEquipar(modelo, POR_DEFECTO, partes), { ...d, color: POR_DEFECTO.color })
  assert.deepEqual(disenoParaEquipar(modelo, POR_DEFECTO, partes.map(p => ({ ...p, tengo: true }))), d)
  assert.equal(disenoParaEquipar(modelo, POR_DEFECTO, partes.filter(p => p.id !== d.emisor)), null)
}
const shoto = longitudesDeHoja({ cuerpo: 'cue_shoto', pomo: 'pom_plano' })
const doble = longitudesDeHoja({ cuerpo: 'cue_pica', pomo: 'pom_gemelo' })
const clasico = longitudesDeHoja(POR_DEFECTO)
assert.ok(shoto.principal < clasico.principal)
assert.equal(shoto.secundaria, 0)
assert.equal(clasico.secundaria, 0)
assert.equal(doble.secundaria, doble.principal)
console.log(`${siluetas.size} modelos distintos, miniaturas, piezas incluidas y cristales comprobados.`)

import assert from 'node:assert/strict'
import type { Card } from '../src/types/index.ts'
import { catalogoBasesCalculadora, filtrarBasesCalculadora } from '../src/features/calculadora/basesCalculadora.ts'
import { crearMesa, leerMesa } from '../src/features/calculadora/estadoCalculadora.ts'

function carta(cambios: Partial<Card> = {}): Card {
  return {
    id: 'SOR_029', name: 'Capital City', subtitle: null, type: 'Base', rarity: 'Common',
    cost: null, power: null, hp: 30, aspects: ['Command'], traits: [], keywords: [], arena: null,
    text: '', deployBox: null, epicAction: null, setCode: 'SOR', setNumber: 29, artist: '',
    imageUrl: 'https://cdn.starwarsunlimited.com/base.png', backImageUrl: null,
    isUnique: false, isLeader: false, isBase: true, isCanonical: true, ...cambios,
  }
}

const capital = carta()
const variantes = catalogoBasesCalculadora([
  carta({ id: 'unit', type: 'Unit', isBase: false }),
  carta({ id: 'foil', isCanonical: false }),
  carta({ id: 'unknown-hp', hp: null }),
  ...[0, -1, 30.5, 1000, NaN, Infinity].map((hp, i) => carta({ id: `invalid-${i}`, hp })),
  capital, capital,
  carta({ id: 'SHD_021', name: 'Remote Village', hp: 25, setCode: 'SHD', setNumber: 21, isCanonical: undefined }),
])
assert.equal(variantes.length, 2, 'Solo bases canónicas jugables, sin repetir UUID; acepta caché anterior sin isCanonical')
assert.deepEqual(variantes.map(base => base.vidaImpresa), [30, 25])
assert.equal(variantes[0].imagen, capital.imageUrl)

assert.equal(catalogoBasesCalculadora([carta({ id: 'invalid id' }), carta({ name: 'x'.repeat(161) })]).length, 0,
  'No se puede elegir una identidad que el guardado de partidas rechazaría')
assert.equal(catalogoBasesCalculadora([carta({ imageUrl: 'javascript:alert(1)' })])[0].imagen, null,
  'Arte inválido cae al placeholder; la base puede seguir usándose')

const acentos = catalogoBasesCalculadora([
  carta({ id: 'acento', name: 'Île de Padmé', subtitle: 'The Emperor’s Outpost', setCode: 'TS26', setNumber: 4 }),
  carta({ id: 'otra', name: 'Echo Base', subtitle: null, setCode: 'SOR' }),
])
for (const texto of ['padme', 'PADMÉ', 'ile ts26', 'emperors', 'outpost 4']) {
  assert.deepEqual(filtrarBasesCalculadora(acentos, texto).map(base => base.id), ['acento'], `Busca ${texto}`)
}
assert.equal(filtrarBasesCalculadora(acentos, 'SOR padme').length, 0)
assert.equal(filtrarBasesCalculadora(acentos, '   ').length, 2)

const muchas = catalogoBasesCalculadora(Array.from({ length: 73 }, (_, i) => carta({ id: `base-${i}`, name: `Base ${i}` })))
assert.equal(filtrarBasesCalculadora(muchas, '').length, 73, 'El catálogo no esconde bases posteriores a una página visual')
assert.deepEqual(filtrarBasesCalculadora(muchas, 'Base 72').map(base => base.id), ['base-72'])

const base = variantes[1]
const mesa = crearMesa('premier', [{ nombre: 'Leia', maxVida: 30, base }, { nombre: 'Han', maxVida: 30 }])
assert.equal(mesa.jugadores[0].maxVida, 25, 'La selección lleva la vida impresa real al contador')
assert.deepEqual(leerMesa(JSON.stringify(mesa))?.jugadores[0].base, {
  id: base.id, nombre: base.nombre, imagen: base.imagen, vidaImpresa: base.vidaImpresa,
}, 'La metadata del catálogo se puede guardar y recuperar sin campos de búsqueda')

console.log('Calculadora: catálogo de bases, filtros y selección persistente correctos.')

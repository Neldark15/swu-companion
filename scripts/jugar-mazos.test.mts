import assert from 'node:assert/strict'
import { convertirMazo, importarMazoOnline, leerMazoGuardado } from '../src/features/jugar/mazos.ts'
import type { Card, Deck, DeckCard } from '../src/types/index.ts'

function carta(id: string, name: string, type: Card['type'], setNumber: number, cambios: Partial<Card> = {}): Card {
  return { id, name, type, setNumber, subtitle: null, rarity: 'Common', cost: 1, power: 1, hp: 1,
    aspects: [], traits: [], keywords: [], arena: 'Ground', text: '', deployBox: null, epicAction: null,
    setCode: 'JTL', artist: '', imageUrl: '', backImageUrl: null, isUnique: false,
    isLeader: type === 'Leader', isBase: type === 'Base', variantType: 'Standard', isCanonical: true, ...cambios }
}
function entrada(c: Card, quantity = 1): DeckCard {
  return { cardId: c.id, name: c.name, subtitle: c.subtitle, quantity, setCode: c.setCode }
}
const lider = carta('lider', 'Líder de prueba', 'Leader', 1)
const base = carta('base', 'Base de prueba', 'Base', 20)
const unidad = carta('unidad', 'Unidad de prueba', 'Unit', 80, { legacyId: 'JTL_080' })
const foil = carta('foil', unidad.name, 'Unit', 380, { variantType: 'Hyperspace Foil', isCanonical: false })
const otra = carta('otra', 'Otra unidad', 'Unit', 81, { legacyId: 'JTL_080' })
const catalogo = [lider, base, unidad, foil, otra]
const mazo: Pick<Deck, 'leaders' | 'base' | 'mainDeck' | 'sideboard' | 'format'> = {
  format: 'premier', leaders: [entrada(lider)], base: entrada(base),
  mainDeck: [entrada(unidad, 2), entrada(foil)], sideboard: [entrada(otra)],
}
assert.deepEqual(convertirMazo(mazo, catalogo), {
  leader: { id: 'JTL_001', count: 1 }, base: { id: 'JTL_020', count: 1 },
  deck: [{ id: 'JTL_080', count: 3 }], sideboard: [{ id: 'JTL_081', count: 1 }],
})
const heredado = { ...mazo, mainDeck: [{ ...entrada(unidad), cardId: 'JTL_080' }] }
assert.equal(convertirMazo(heredado, catalogo).deck[0].id, 'JTL_080')
assert.throws(() => convertirMazo({ ...mazo, mainDeck: [{ ...entrada(unidad), cardId: 'perdido' }] }, catalogo), /identificar/)
assert.throws(() => convertirMazo({ ...mazo, mainDeck: [entrada(lider)] }, catalogo), /zona/)
assert.throws(() => convertirMazo({ ...mazo, format: 'twin_suns' }, catalogo), /Premier/)
assert.throws(() => convertirMazo({ ...mazo, leaders: [entrada(lider), entrada(lider)] }, catalogo), /líder/)
assert.throws(() => convertirMazo({ ...mazo, mainDeck: [entrada(unidad, 1.5)] }, catalogo), /cantidad/)
assert.throws(() => convertirMazo({ ...mazo, mainDeck: [entrada(foil)] }, [lider, base, foil]), /impresión/)
const json = JSON.stringify({ ...convertirMazo(mazo, catalogo), metadata: { name: 'Mi mazo' } })
assert.equal(importarMazoOnline(json).nombre, 'Mi mazo')
assert.equal(importarMazoOnline(json).mazo.deck[0].count, 3)
assert.throws(() => importarMazoOnline('{ roto'), /JSON válido/)
assert.throws(() => importarMazoOnline(JSON.stringify({ leader: { id: 'uuid', count: 1 } })), /edición/)
assert.throws(() => leerMazoGuardado({ ...mazo, mainDeck: null }), /incompleto/)
assert.throws(() => leerMazoGuardado({ ...mazo, mainDeck: [{ cardId: 'x', name: 'X', quantity: -1 }] }), /incompleta/)
console.log('Mazos online: variantes, ambigüedad, zonas e importación verificados.')

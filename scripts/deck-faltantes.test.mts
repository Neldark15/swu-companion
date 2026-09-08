import assert from 'node:assert/strict'
import { calcularFaltantesMazo, identidadCartaJugable } from '../src/features/decks/faltantesMazo'
import type { Card, Deck, DeckCard } from '../src/types'

function carta(id: string, cambios: Partial<Card> = {}): Card {
  return {
    id, name: 'Piloto', subtitle: 'Veterano', type: 'Unit', rarity: 'Common',
    cost: 2, power: 2, hp: 3, aspects: ['Command'], traits: [], keywords: [],
    arena: 'Ground', text: '', deployBox: null, epicAction: null,
    setCode: 'SOR', setNumber: 1, artist: '', imageUrl: '', backImageUrl: null,
    isUnique: false, isLeader: false, isBase: false, variantType: 'Standard',
    ...cambios,
  }
}
const normal = carta('uuid-normal', { legacyId: 'SOR_001' })
const foil = carta('uuid-foil', { variantType: 'Standard Foil' })
const promo = carta('uuid-promo', { variantType: 'Weekly Play', setCode: 'TS26' })
const otraVersion = carta('uuid-otro', { subtitle: 'Aprendiz' })
const lider = carta('uuid-lider', { type: 'Leader', isLeader: true })
const segundoLider = carta('uuid-lider-2', { type: 'Leader', isLeader: true, subtitle: 'Aprendiz' })
const base = carta('uuid-base', { name: 'Base', subtitle: null, type: 'Base', isBase: true })
const catalogo = [normal, foil, promo, otraVersion, lider, segundoLider, base]
const vacio: Pick<Deck, 'leaders' | 'base' | 'mainDeck' | 'sideboard'> = { leaders: [], base: null, mainDeck: [], sideboard: [] }
const dc = (c: Card, quantity: number, cardId = c.id): DeckCard => ({
  cardId, quantity, name: c.name, subtitle: c.subtitle, setCode: c.setCode,
})
const propia = (cardId: string, quantity: number, profileId = 'local') => ({ cardId, quantity, profileId })

// Una copia física no cubre simultáneamente el principal y el sideboard,
// aunque el mazo los refiera con distintos ids o líneas duplicadas.
const demanda = { ...vacio, mainDeck: [dc(normal, 2), dc(normal, 1, 'SOR_001')], sideboard: [dc(foil, 1)] }
let r = calcularFaltantesMazo(demanda, catalogo, [propia(normal.id, 1), propia(promo.id, 2)], 'local', true)
assert.equal(r.estado, 'listo')
if (r.estado !== 'listo') throw new Error('Resultado esperado listo')
assert.equal(r.totalNecesarias, 4)
assert.equal(r.totalDisponibles, 3)
assert.equal(r.totalFaltantes, 1)
assert.equal(r.cartas.length, 1)
assert.deepEqual([r.cartas[0].necesarias, r.cartas[0].disponibles, r.cartas[0].faltantes], [4, 3, 1])

// El id antiguo de la colección se resuelve igual que el del mazo. Las
// preferencias normal/foil por copia no cambian la disponibilidad jugable.
r = calcularFaltantesMazo({ ...vacio, mainDeck: [{ ...dc(foil, 3), variantes: ['foil', 'foil', 'foil'] }] },
  catalogo, [propia('SOR_001', 3)], 'local', true)
assert.equal(r.estado === 'listo' && r.totalFaltantes, 0)

// Mismo nombre no es suficiente: no cubrir con otro subtítulo ni con un
// líder del mismo personaje. Null y subtítulo vacío sí son equivalentes.
r = calcularFaltantesMazo({ ...vacio, mainDeck: [dc(normal, 2)] },
  catalogo, [propia(otraVersion.id, 3), propia(lider.id, 1)], 'local', true)
assert.equal(r.estado === 'listo' && r.totalFaltantes, 2)
assert.notEqual(identidadCartaJugable(normal), identidadCartaJugable(lider))
assert.equal(identidadCartaJugable(base), identidadCartaJugable({ ...base, subtitle: '' }))
assert.equal(identidadCartaJugable(normal), identidadCartaJugable(promo))

// Twin Suns tiene dos líderes reales, más base; no se impone el número de
// líderes del formato Premier ni se inventa uno que todavía no se eligió.
r = calcularFaltantesMazo({ ...vacio, leaders: [dc(lider, 1), dc(segundoLider, 1)], base: dc(base, 1) },
  catalogo, [propia(lider.id, 1), propia(base.id, 1)], 'local', true)
assert.equal(r.estado === 'listo' && r.totalNecesarias, 3)
assert.equal(r.estado === 'listo' && r.totalFaltantes, 1)
assert.equal(r.estado === 'listo' && r.cartas[0].carta.id, segundoLider.id)

// Un perfil LOCAL funciona sin usuario de nube. Las cartas ajenas o sin
// dueño no cuentan ni provocan errores por ids que no pertenecen al perfil.
r = calcularFaltantesMazo({ ...vacio, mainDeck: [dc(normal, 3)] }, catalogo,
  [propia(normal.id, 1), propia(foil.id, 5, 'otro'), { cardId: promo.id, quantity: 5 }, propia('desconocida', 1, 'otro')], 'local', true)
assert.equal(r.estado === 'listo' && r.totalDisponibles, 1)
assert.equal(r.estado === 'listo' && r.totalFaltantes, 2)
assert.equal(calcularFaltantesMazo(demanda, catalogo, [propia(normal.id, 100)], null, true).estado, 'sin-perfil')

// Datos incompletos/ilegibles jamás se convierten en un cero convincente.
assert.equal(calcularFaltantesMazo(demanda, catalogo, [], 'local', false).estado, 'catalogo-incompleto')
r = calcularFaltantesMazo({ ...vacio, mainDeck: [dc(normal, 1, 'no-existe')] }, catalogo, [], 'local', true)
assert.deepEqual(r, { estado: 'sin-resolver', cartasMazo: ['no-existe'], cartasColeccion: [] })
r = calcularFaltantesMazo(demanda, catalogo, [propia('no-existe', 1)], 'local', true)
assert.deepEqual(r, { estado: 'sin-resolver', cartasMazo: [], cartasColeccion: ['no-existe'] })
assert.equal(calcularFaltantesMazo(demanda, catalogo, [propia(normal.id, Number.NaN)], 'local', true).estado, 'cantidades-invalidas')
assert.equal(calcularFaltantesMazo({ ...vacio, mainDeck: [dc(normal, -1)] }, catalogo, [], 'local', true).estado, 'cantidades-invalidas')
assert.equal(calcularFaltantesMazo({ ...vacio, mainDeck: [dc(normal, 1.5)] }, catalogo, [], 'local', true).estado, 'cantidades-invalidas')

// Una colección vacía válida sí significa faltantes. Una lista vacía no
// recibe copias fantasma. Los sobrantes nunca vuelven negativo el total.
r = calcularFaltantesMazo(demanda, catalogo, [], 'local', true)
assert.equal(r.estado === 'listo' && r.totalFaltantes, 4)
r = calcularFaltantesMazo(vacio, catalogo, [propia(normal.id, 20)], 'local', true)
assert.deepEqual(r, { estado: 'listo', cartas: [], totalNecesarias: 0, totalDisponibles: 0, totalFaltantes: 0 })
r = calcularFaltantesMazo(demanda, catalogo, [propia(normal.id, 20)], 'local', true)
assert.equal(r.estado === 'listo' && r.totalFaltantes, 0)
assert.equal(r.estado === 'listo' && r.totalDisponibles, 4)

// Recalcular con una edición del mazo o una nueva lectura de colección usa
// los nuevos valores; el helper no mantiene una caché de cantidades.
const mazoEditado = { ...demanda, sideboard: [dc(foil, 3)] }
assert.equal(calcularFaltantesMazo(mazoEditado, catalogo, [propia(normal.id, 4)], 'local', true).estado, 'listo')
const editado = calcularFaltantesMazo(mazoEditado, catalogo, [propia(normal.id, 4)], 'local', true)
assert.equal(editado.estado === 'listo' && editado.totalFaltantes, 2)
const coleccionEditada = calcularFaltantesMazo(mazoEditado, catalogo, [propia(normal.id, 6)], 'local', true)
assert.equal(coleccionEditada.estado === 'listo' && coleccionEditada.totalFaltantes, 0)

console.log('Faltantes del mazo: impresiones, referencias antiguas, sideboard, líderes/base, perfil local y estados incompletos correctos.')

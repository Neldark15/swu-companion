import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { comandoBoton, comandoCarta, comandoDistribucion, normalizarCarta, normalizarPrompt, normalizarVista, todasLasCartas, validarDistribucion } from '../src/features/jugar/vistaJuego.ts'

const estados: { momento: string; usuarioId: string; estado: unknown }[] = JSON.parse(readFileSync(new URL('./fixtures/jugar/estados-privados.json', import.meta.url), 'utf8'))
const prompts: { nombre: string; prompt: unknown }[] = JSON.parse(readFileSync(new URL('./fixtures/jugar/prompts-upstream.json', import.meta.url), 'utf8'))
const ejemplo = (nombre: string) => {
  const encontrado = prompts.find(p => p.nombre === nombre)
  assert.ok(encontrado, `Falta fixture ${nombre}`)
  return normalizarPrompt(encontrado.prompt)
}
for (const e of estados) {
  const vista = normalizarVista(e.estado, e.usuarioId)
  assert.ok(vista.jugador, `No se leyó la vista propia: ${e.momento} / ${e.usuarioId}`)
  assert.ok(vista.rival)
  assert.equal(vista.jugador.id, e.usuarioId)
  assert.equal(normalizarVista(e.estado, vista.rival.id).jugador, null, 'Una vista de A nunca debe presentarse como mano de B')
  assert.equal(normalizarVista(e.estado, 'intruso').jugador, null)
  assert.ok(vista.rival.zonas.hand.every(c => c.oculta && c.uuid === null && c.nombre === 'Carta oculta'))
  assert.ok(vista.rival.zonas.resources.every(c => c.oculta && c.uuid === null))
  assert.equal(vista.rival.prompt.botones.length, 0)
  assert.ok(vista.jugador.base?.salud !== null)
  if (e.momento === 'recursos') {
    assert.equal(vista.jugador.zonas.hand.length, 6)
    assert.equal(vista.jugador.prompt.tipo, 'resource')
    const elegible = vista.jugador.zonas.hand.find(c => c.seleccionable)
    assert.ok(elegible)
    assert.deepEqual(comandoCarta(elegible), { nombre: 'cardClicked', args: [elegible.uuid] })
  }
  if (e.momento === 'accion') {
    assert.equal(vista.jugador.zonas.hand.length, 4)
    assert.equal(vista.jugador.zonas.resources.length, 2)
    assert.equal(vista.jugador.recursosDisponibles, 2)
  }
  if (e.momento === 'habilidad-revelar' && vista.jugador.prompt.tipo === 'displayCards') {
    assert.ok(vista.jugador.prompt.cartas.length > 0)
    assert.ok(vista.jugador.prompt.cartas.every(c => !c.oculta && c.uuid))
    for (const c of vista.jugador.prompt.cartas) {
      if (vista.jugador.prompt.botonesCarta.length) assert.ok(comandoBoton(vista.jugador.prompt.botonesCarta[0], vista.jugador.prompt, c))
      else if (c.seleccionable || c.seleccionada) assert.ok(comandoCarta(c, vista.jugador.prompt))
    }
  }
  for (const b of vista.jugador.prompt.botones) {
    if (!b.desactivado) assert.deepEqual(comandoBoton(b, vista.jugador.prompt)?.args.slice(0, 2), [b.argumento, vista.jugador.prompt.uuid])
  }
  assert.equal(new Set(todasLasCartas(vista).map(c => c.clave)).size, todasLasCartas(vista).length)
}

for (const entrada of [null, [], 'inválido', 3, { players: null }, { players: { a: { promptState: {} } } }]) assert.equal(normalizarVista(entrada, 'a').jugador, null)
const oculta = normalizarCarta({ controllerId: 'b', zone: 'hand', power: undefined })
assert.equal(oculta.oculta, true)
assert.equal(oculta.salud, null)
assert.equal(oculta.dano, null)
assert.equal(oculta.agotada, null)
assert.equal(comandoCarta(oculta), null)
const unidad = normalizarCarta({ uuid: 'objetivo-a', name: 'Unidad', type: 'basicUnit', hp: 5, damage: 2, power: 3, exhausted: true, selectable: true })
const base = normalizarCarta({ uuid: 'objetivo-b', name: 'Base', type: 'base', hp: 30, damage: 0, selectable: true })
assert.deepEqual([unidad.poder, unidad.salud, unidad.dano, unidad.agotada], [3, 5, 2, true])

const numerico = ejemplo('numero')
assert.deepEqual(numerico.numero, { min: -2, max: 5 })
assert.deepEqual(ejemplo('lista').opciones, ['Ambush', 'Sentinel'])
const menuMultiple = ejemplo('menu-multiple-elegido')
assert.equal(menuMultiple.botones[1].argumento, 1)
assert.equal(menuMultiple.botones[1].seleccionado, true)
assert.deepEqual(comandoBoton(menuMultiple.botones[1], menuMultiple), { nombre: 'menuButton', args: [1, menuMultiple.uuid] })
assert.equal(comandoBoton({ ...menuMultiple.botones[0], desactivado: true }, menuMultiple), null)

const orden = ejemplo('orden-uno')
assert.equal(orden.multiple, true)
assert.equal(orden.cartas[1].orden, 1)
assert.equal(orden.cartas[1].seleccionada, true)
assert.equal(orden.botones[0].desactivado, true)
assert.deepEqual(comandoCarta(orden.cartas[1], orden), { nombre: 'menuButton', args: ['objetivo-b', orden.uuid] })
assert.equal(comandoCarta(ejemplo('solo-ver').cartas[0], ejemplo('solo-ver')), null)
const porCarta = ejemplo('por-carta')
assert.equal(comandoCarta(porCarta.cartas[0], porCarta), null)
assert.deepEqual(comandoBoton(porCarta.botonesCarta[1], porCarta, porCarta.cartas[0]), { nombre: 'perCardMenuButton', args: ['bottom', 'objetivo-a', porCarta.uuid] })
assert.equal(comandoBoton(porCarta.botonesCarta[0], porCarta), null)

for (const tipo of ['distributeDamage', 'distributeIndirectDamage', 'distributeHealing', 'distributeTokenUpgrade']) {
  const p = ejemplo(tipo)
  assert.equal(p.distribucion?.tipo, tipo)
  const reparto = [{ uuid: unidad.uuid!, amount: 2 }, { uuid: base.uuid!, amount: 1 }]
  assert.equal(validarDistribucion(p, reparto, [unidad, base]), null)
  assert.deepEqual(comandoDistribucion(p, reparto, [unidad, base]), { nombre: 'statefulPromptResults', args: [{ type: tipo, valueDistribution: reparto }, p.uuid] })
  for (const invalido of [[], [{ uuid: 'intruso', amount: 3 }], [{ uuid: unidad.uuid!, amount: 1.5 }], [{ uuid: unidad.uuid!, amount: -1 }], [{ uuid: unidad.uuid!, amount: 0 }], [{ uuid: unidad.uuid!, amount: 1 }, { uuid: unidad.uuid!, amount: 2 }]]) {
    assert.notEqual(validarDistribucion(p, invalido, [unidad, base]), null)
    assert.equal(comandoDistribucion(p, invalido, [unidad, base]), null)
  }
}
const indirecto = ejemplo('distributeIndirectDamage')
const herida = { ...unidad, dano: 4 }
assert.notEqual(validarDistribucion(indirecto, [{ uuid: unidad.uuid!, amount: 3 }], [herida]), null)
assert.equal(validarDistribucion(indirecto, [{ uuid: base.uuid!, amount: 3 }], [base]), null)
const flexible = { ...indirecto, distribucion: { ...indirecto.distribucion!, menos: true, ninguno: true, maxObjetivos: 1 } }
assert.equal(validarDistribucion(flexible, [], [unidad, base]), null)
assert.equal(validarDistribucion(flexible, [{ uuid: unidad.uuid!, amount: 1 }], [unidad, base]), null)
assert.notEqual(validarDistribucion(flexible, [{ uuid: unidad.uuid!, amount: 1 }, { uuid: base.uuid!, amount: 1 }], [unidad, base]), null)

for (const nombre of ['opcional', 'pausa', 'grupo', 'orden-habilidades']) {
  const p = ejemplo(nombre)
  assert.ok(p.botones.length > 0)
  for (const b of p.botones) assert.ok(comandoBoton(b, p), `Prompt sin respuesta: ${nombre}`)
}
assert.equal(ejemplo('grupo').restantes, 3)
assert.equal(ejemplo('opcional').botones[0].texto, 'Draw a card')
assert.equal(ejemplo('opcional').botones[0].argumento, 'trigger')

/* Captura serializadores upstream reales con dependencias mínimas, sin arrancar una sala.
 * Requiere npm --prefix services/juego run preparar-motor. */
const { createRequire } = require('node:module')
const { resolve } = require('node:path')
const { writeFileSync } = require('node:fs')
const cargar = createRequire(resolve(__dirname, '../../../services/juego/.motor/fuente/package.json'))
const clase = nombre => {
  const modulo = cargar(`./build/server/game/core/gameSteps/prompts/${nombre}.js`)
  return modulo[nombre] ?? modulo
}
const juego = { getPlayers: () => [] }
const jugador = { name: 'Piloto de prueba' }
const fuente = { name: 'Fuente de prueba', title: 'Fuente de prueba', type: '' }
const cartas = [
  { uuid: 'objetivo-a', setId: { set: 'JTL', number: 132 }, internalName: 'b1-security-team', name: 'B1 Security Team' },
  { uuid: 'objetivo-b', setId: { set: 'JTL', number: 133 }, internalName: 'on-the-doorstep', name: 'On the Doorstep' },
]
const capturas = []
function capturar(nombre, instancia) {
  const prompt = instancia.activePromptInternal(jugador)
  // El mismo default de UiPrompt.addDefaultsToButtons antes de PlayerPromptState.getState.
  for (const boton of [...(prompt.buttons ?? []), ...(prompt.perCardButtons ?? [])]) {
    boton.command ??= 'menuButton'; boton.uuid = prompt.promptUuid
  }
  capturas.push({ nombre, prompt: JSON.parse(JSON.stringify(prompt)) })
}
capturar('numero', new (clase('NumberPrompt'))(juego, jugador, { min: -2, max: 5, source: fuente, choiceHandler() {} }))
capturar('lista', new (clase('DropdownListPrompt'))(juego, jugador, { options: ['Ambush', 'Sentinel'], source: fuente, choiceHandler() {} }))
for (const tipo of ['distributeDamage', 'distributeIndirectDamage', 'distributeHealing', 'distributeTokenUpgrade']) {
  capturar(tipo, new (clase('DistributeAmongTargetsPrompt'))(juego, jugador, {
    type: tipo, amount: 3, source: fuente, canChooseNoTargets: false, canDistributeLess: false,
    maxTargets: 2, tokenType: tipo === 'distributeTokenUpgrade' ? 'shield' : undefined, legalTargets: cartas, resultsHandler() {},
  }))
}
const seleccion = new (clase('DisplayCardsForSelectionPrompt'))(juego, jugador, { source: fuente, displayCards: cartas, maxCards: 2, showSelectionOrder: true, selectedCardsHandler() {} })
capturar('orden-vacio', seleccion)
seleccion.menuCommand(jugador, cartas[1].uuid, seleccion.uuid)
capturar('orden-uno', seleccion)
capturar('por-carta', new (clase('DisplayCardsWithButtonsPrompt'))(juego, jugador, {
  source: fuente, displayCards: cartas, perCardButtons: [{ text: 'Top', arg: 'top' }, { text: 'Bottom', arg: 'bottom' }], onCardButton() {},
}))
capturar('solo-ver', new (clase('DisplayCardsBasicPrompt'))(juego, jugador, { source: fuente, displayCards: cartas }))
capturar('opcional', new (clase('OptionalTriggerPrompt'))(juego, jugador, { sourceCard: cartas[0], abilityText: 'Draw a card', onTrigger() {}, onPass() {} }))
capturar('pausa', new (clase('PassDelayPrompt'))(juego, jugador, { source: fuente }))
const multiple = new (clase('HandlerMenuMultipleSelectionPrompt'))(juego, jugador, {
  source: fuente, context: { source: fuente }, choices: ['Yourself', 'Opponent'], maxSelected: 2, handler() {},
})
capturar('menu-multiple', multiple)
multiple.menuCommand(jugador, 1)
capturar('menu-multiple-elegido', multiple)
// Estas clases crean fuentes GameObject al construirse. Se ejecuta su serializador
// original sobre un contexto mínimo; no se presenta esto como una partida jugada.
for (const [nombre, nombreClase, contexto] of [
  ['grupo', 'BatchTriggerResolutionPrompt', { properties: { title: 'Advantage', remainingCount: 3, sourceCard: cartas[0] } }],
  ['orden-habilidades', 'TriggeredAbilityResolutionPrompt', { choices: [{ getTitle: () => 'Draw a card', getSourceCard: () => cartas[0], hasLegalEffects: () => true, count: 2 }] }],
]) {
  const prototipo = clase(nombreClase).prototype
  const instancia = Object.assign(Object.create(prototipo), { source: fuente, uuid: `prueba-${nombre}`, ...contexto })
  capturar(nombre, instancia)
}
writeFileSync(resolve(__dirname, 'prompts-upstream.json'), JSON.stringify(capturas, null, 2) + '\n')

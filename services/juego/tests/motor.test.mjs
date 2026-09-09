import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { crearProveedorMotor } from '../motor.mjs';
import { mazosEjemplo } from '../fixtures/mazos.mjs';

const proveedor = await crearProveedorMotor();
const jugadores = mazosEjemplo.map((ejemplo, indice) => ({ id: ['dev-alpha', 'dev-beta'][indice], nombre: ['Piloto Alfa', 'Piloto Beta'][indice], mazo: ejemplo.mazo }));
function cartas(estado) {
  return Object.values(estado.players).flatMap((jugador) => [...Object.values(jugador.cardPiles).flat(), jugador.base, jugador.leader].filter(Boolean));
}
function pulsar(motor, id, boton) {
  const prompt = motor.vista(id).players[id].promptState;
  motor.ejecutar(id, { nombre: 'menuButton', args: [boton.arg, prompt.promptUuid, boton.method ?? 'menuButton'] });
}
function elegir(motor, id, uuid) { motor.ejecutar(id, { nombre: 'cardClicked', args: [uuid] }); }
function boton(motor, id, texto) { return motor.vista(id).players[id].promptState.buttons.find((boton) => boton.text === texto || (texto === 'Done' && boton.arg === 'done'));  }
function iniciar(motor, capturas = []) {
  for (const { id } of jugadores) {
    const vista = motor.vista(id); const prompt = vista.players[id].promptState;
    capturas.push({ momento: 'iniciativa', usuarioId: id, estado: vista });
    if (prompt.promptType === 'initiative') pulsar(motor, id, prompt.buttons[0]);
  }
  for (const { id } of jugadores) {
    capturas.push({ momento: 'mulligan', usuarioId: id, estado: motor.vista(id) });
    pulsar(motor, id, boton(motor, id, 'Keep'));
  }
  for (const { id } of jugadores) {
    const vista = motor.vista(id); capturas.push({ momento: 'recursos', usuarioId: id, estado: vista });
    for (const carta of vista.players[id].cardPiles.hand.slice(-2)) elegir(motor, id, carta.uuid);
    pulsar(motor, id, boton(motor, id, 'Done'));
  }
  assert.equal(motor.vista(jugadores[0].id).phase, 'action');
}

test('Premier real: mazos válidos, formato, copias combinadas, suspensión y no implementadas', async () => {
  for (const { mazo } of mazosEjemplo) assert.deepEqual(await proveedor.validarMazo(mazo), []);
  for (const mazo of [null, {}, { ...jugadores[0].mazo, leader: { ...jugadores[0].mazo.leader, count: 2 } }, { ...jugadores[0].mazo, deck: [{ id: 'JTL_100', count: 1.5 }] }]) assert.ok((await proveedor.validarMazo(mazo)).length);
  const conCopias = structuredClone(jugadores[0].mazo);
  conCopias.sideboard = [{ ...conCopias.deck[0], count: 1 }];
  assert.ok((await proveedor.validarMazo(conCopias)).some((error) => error.codigo === 'copias_excedidas'));
  const duplicado = structuredClone(jugadores[0].mazo); duplicado.deck.push({ ...duplicado.deck[0] });
  assert.ok((await proveedor.validarMazo(duplicado)).some((error) => error.codigo === 'invalidDeckData'));
  const suspendido = { ...jugadores[0].mazo, leader: { id: 'ASH_011', count: 1 } };
  assert.ok((await proveedor.validarMazo(suspendido)).some((error) => error.codigo === 'illegalInFormat'));
  const ajeno = structuredClone(jugadores[0].mazo); ajeno.deck[0].id = 'ZZZ_999';
  assert.ok((await proveedor.validarMazo(ajeno)).some((error) => error.codigo === 'unknownCardId'));
  const sinImplementar = structuredClone(jugadores[0].mazo); sinImplementar.deck[0].id = 'HMW_158';
  assert.ok((await proveedor.validarMazo(sinImplementar)).some((error) => error.codigo === 'cartas_no_implementadas'));
  const reimpresiones = structuredClone(jugadores[0].mazo);
  reimpresiones.deck[0] = { id: 'SOR_113', count: 3 }; reimpresiones.sideboard = [{ id: 'JTL_113', count: 1 }];
  assert.ok((await proveedor.validarMazo(reimpresiones)).some((error) => error.codigo === 'copias_excedidas'));
  const excepcion = structuredClone(jugadores[0].mazo); excepcion.deck.find((carta) => carta.id === 'JTL_256').count = 15;
  assert.deepEqual(await proveedor.validarMazo(excepcion), []);
});

test('Setup y privacidad reales; rechaza actores, cartas ocultas y botones ajenos sin interrumpir', async () => {
  const capturas = []; const fallos = []; let cambios = 0;
  const motor = await proveedor.crearPartida({ id: 'prueba-privacidad', jugadores, alCambiar: () => cambios++, alFallar: (error) => fallos.push(error) });
  try {
    assert.equal(motor.resultado(), null);
    assert.throws(() => motor.vista('intruso'), /pertenecés/);
    assert.throws(() => motor.ejecutar(jugadores[0].id, { nombre: 'selectDeck', args: [] }), /no permitido/);
    iniciar(motor, capturas);
    const a = motor.vista(jugadores[0].id), b = motor.vista(jugadores[1].id);
    assert.notDeepEqual(a, b);
    for (const [propio, rival] of [[jugadores[0], jugadores[1]], [jugadores[1], jugadores[0]]]) {
      const visible = motor.vista(propio.id), otra = motor.vista(rival.id);
      assert.equal(visible.players[propio.id].cardPiles.hand.length, 4);
      assert.ok(visible.players[propio.id].cardPiles.hand.every((carta) => carta.id && carta.uuid));
      assert.ok(visible.players[rival.id].cardPiles.hand.every((carta) => !carta.id && !carta.name && !carta.uuid));
      assert.deepEqual(visible.players[rival.id].promptState, {});
      assert.throws(() => elegir(motor, propio.id, otra.players[rival.id].cardPiles.hand[0].uuid), /no es seleccionable/);
    }
    const id = jugadores.find((jugador) => motor.vista(jugador.id).players[jugador.id].isActionPhaseActivePlayer).id;
    const prompt = motor.vista(id).players[id].promptState;
    assert.throws(() => motor.ejecutar(id, { nombre: 'menuButton', args: ['pass', 'caducado'] }), /no está activa/);
    assert.throws(() => motor.ejecutar(id, { nombre: 'menuButton', args: ['inventado', prompt.promptUuid] }), /no pertenece/);
    assert.equal(fallos.length, 0);
    assert.ok(cambios > 0);
    capturas.push(...jugadores.map(({ id }) => ({ momento: 'accion', usuarioId: id, estado: motor.vista(id) })));
    if (process.env.ACTUALIZAR_FIXTURES_MOTOR === '1') await writeFile(new URL('../fixtures/estados-privados.json', import.meta.url), JSON.stringify(capturas, null, 2) + '\n');
    motor.ejecutar(jugadores[0].id, { nombre: 'concede', args: [] });
    assert.equal(motor.resultado().ganadorId, jugadores[1].id);
    assert.throws(() => motor.ejecutar(jugadores[1].id, { nombre: 'concede', args: [] }), /ya terminó/);
  } finally { motor.cerrar(); }
  assert.throws(() => motor.vista(jugadores[0].id), /cerrada/);
});

// Prueba de integración mediante elecciones públicas: no inyecta cartas ni cambia fases/daño internamente.
// Los dos participantes de prueba juegan unidades y atacan bases hasta que las reglas determinan ganador.
test('Partida completa con recursos, unidad, ataque, elección de habilidad y victoria por reglas', async () => {
  const motor = await proveedor.crearPartida({ id: 'prueba-completa', jugadores, alFallar: (error) => { throw error; } });
  const evidencia = { unidad: false, ataque: false, habilidad: false, reagrupar: false, botonNumerico: false };
  try {
    iniciar(motor);
    for (let paso = 0; paso < 1600 && !motor.resultado(); paso++) {
      let respondio = false;
      for (const { id } of jugadores) {
        if (motor.resultado()) break;
        const vista = motor.vista(id), propio = vista.players[id], prompt = propio.promptState;
        const disponibles = cartas(vista).filter((carta) => carta.selectable);
        const botones = (prompt.buttons ?? []).filter((boton) => !boton.disabled);
        if (botones.some((boton) => typeof boton.arg === 'number')) evidencia.botonNumerico = true;
        if (vista.phase === 'regroup') evidencia.reagrupar = true;
        if (prompt.promptType === 'actionWindow') {
          // Las unidades en la mano y las unidades preparadas avanzan la partida sin resolver acciones ajenas.
          const unidadMano = propio.cardPiles.hand.find((carta) => carta.selectable && /unit/i.test(carta.type));
          const atacante = [...propio.cardPiles.groundArena, ...propio.cardPiles.spaceArena].find((carta) => carta.selectable);
          if (unidadMano) { elegir(motor, id, unidadMano.uuid); evidencia.unidad = true; }
          else if (atacante) { elegir(motor, id, atacante.uuid); evidencia.ataque = true; }
          else if (!evidencia.habilidad && propio.leader.selectable) { elegir(motor, id, propio.leader.uuid); evidencia.habilidad = true; }
          else { const pasar = botones.find((boton) => boton.text === 'Pass'); if (!pasar) continue; pulsar(motor, id, pasar); }
        } else if (prompt.distributeAmongTargets) {
          const reglas = prompt.distributeAmongTargets;
          const objetivo = disponibles.find((carta) => carta.type === 'base') ?? disponibles[0];
          motor.ejecutar(id, { nombre: 'statefulPromptResults', args: [{ type: reglas.type, valueDistribution: objetivo ? [{ uuid: objetivo.uuid, amount: reglas.amount }] : [] }, prompt.promptUuid] });
        } else if (prompt.perCardButtons?.length && prompt.displayCards?.length) {
          motor.ejecutar(id, { nombre: 'perCardMenuButton', args: [prompt.perCardButtons[0].arg, prompt.displayCards[0].cardUuid, prompt.promptUuid] });
        } else if (prompt.selectNumber) {
          motor.ejecutar(id, { nombre: 'menuButton', args: [String(prompt.selectNumber.min), prompt.promptUuid] });
        } else if (prompt.dropdownListOptions?.length) {
          motor.ejecutar(id, { nombre: 'menuButton', args: [prompt.dropdownListOptions[0], prompt.promptUuid] });
        } else if (prompt.promptType === 'resource') {
          if (!botones.length) continue;
          const recurso = propio.cardPiles.hand.find((carta) => carta.selectable);
          if (recurso) elegir(motor, id, recurso.uuid);
          pulsar(motor, id, boton(motor, id, 'Done'));
        } else if (disponibles.length) {
          const objetivo = disponibles.find((carta) => carta.type === 'base' && carta.controller !== id) ?? disponibles[0];
          elegir(motor, id, objetivo.uuid);
          const actual = motor.vista(id).players[id].promptState;
          const terminar = actual.buttons?.find((boton) => boton.arg === 'done' && !boton.disabled);
          if (terminar && actual.promptUuid === prompt.promptUuid) pulsar(motor, id, terminar);
        } else if (botones.length) {
          pulsar(motor, id, botones.find((boton) => !['cancel', 'pass'].includes(boton.arg)) ?? botones[0]);
        } else if (prompt.displayCards?.some((carta) => carta.selectionState === 'selectable')) {
          motor.ejecutar(id, { nombre: 'menuButton', args: [prompt.displayCards.find((carta) => carta.selectionState === 'selectable').cardUuid, prompt.promptUuid] });
        } else continue;
        respondio = true;
        break;
      }
      assert.ok(respondio, 'El motor dejó una elección sin respuesta compatible.');
    }
    assert.ok(motor.resultado(), 'Debe alcanzar una victoria por reglas.');
    assert.notEqual(motor.resultado().motivo, 'concede');
    assert.deepEqual(evidencia, { unidad: true, ataque: true, habilidad: true, reagrupar: true, botonNumerico: true });
  } finally { motor.cerrar(); }
});


test('Habilidad real de Han: revela carta privada y resuelve displayCards', async () => {
  const motor = await proveedor.crearPartida({ id: 'prueba-habilidad', jugadores, alFallar: (error) => { throw error; } });
  const id = jugadores[0].id;
  try {
    iniciar(motor);
    const otro = jugadores[1].id;
    if (motor.vista(otro).players[otro].isActionPhaseActivePlayer) pulsar(motor, otro, boton(motor, otro, 'Pass'));
    elegir(motor, id, motor.vista(id).players[id].leader.uuid);
    let prompt = motor.vista(id).players[id].promptState;
    if (!prompt.displayCards?.length) {
      const opcion = prompt.buttons.find((boton) => /Reveal/.test(boton.text));
      assert.ok(opcion, JSON.stringify(prompt));
      pulsar(motor, id, opcion);
      prompt = motor.vista(id).players[id].promptState;
    }
    assert.ok(prompt.displayCards?.length, JSON.stringify(prompt));
    assert.ok(prompt.displayCards[0].internalName);
    if (process.env.ACTUALIZAR_FIXTURES_MOTOR === '1') {
      const ruta = new URL('../fixtures/estados-privados.json', import.meta.url);
      const capturas = JSON.parse(await readFile(ruta, 'utf8'));
      capturas.push(...jugadores.map(({ id }) => ({ momento: 'habilidad-revelar', usuarioId: id, estado: motor.vista(id) })));
      await writeFile(ruta, JSON.stringify(capturas, null, 2) + '\n');
    }
    for (let paso = 0; paso < 6; paso++) {
      const botones = motor.vista(id).players[id].promptState.buttons.filter((boton) => !boton.disabled);
      if (!botones.length || motor.vista(id).players[id].promptState.promptType === 'actionWindow') break;
      pulsar(motor, id, botones[0]);
    }
    assert.equal(motor.resultado(), null);
  } finally { motor.cerrar(); }
});


test('El resultado usa IDs aun si los perfiles comparten nombre', async () => {
  const motor = await proveedor.crearPartida({ id: 'prueba-nombres-iguales', jugadores: jugadores.map((jugador) => ({ ...jugador, nombre: 'Piloto' })) });
  try {
    motor.ejecutar(jugadores[0].id, { nombre: 'concede', args: [] });
    assert.equal(motor.resultado().ganadorId, jugadores[1].id);
  } finally { motor.cerrar(); }
});

test('Improvise: rechaza menuButton en prompt por carta sin interrumpir y permite la respuesta ofrecida', async () => {
  const jugadoresImprovise = structuredClone(jugadores);
  jugadoresImprovise[0].mazo.deck[0] = { id: 'LAW_242', count: 3 };
  assert.deepEqual(await proveedor.validarMazo(jugadoresImprovise[0].mazo), []);
  const fallos = []; let cambios = 0;
  const motor = await proveedor.crearPartida({ id: 'prueba-improvise', jugadores: jugadoresImprovise,
    alFallar: (error) => fallos.push(error), alCambiar: () => cambios++ });
  const id = jugadoresImprovise[0].id, rival = jugadoresImprovise[1].id;
  const idImprovise = '1925903426';
  const propio = (usuarioId) => motor.vista(usuarioId).players[usuarioId];
  try {
    for (const { id } of jugadoresImprovise) {
      const prompt = propio(id).promptState;
      if (prompt.promptType === 'initiative') pulsar(motor, id, prompt.buttons[0]);
    }
    for (const { id } of jugadoresImprovise) pulsar(motor, id, boton(motor, id, 'Keep'));
    for (const { id } of jugadoresImprovise) {
      for (const carta of propio(id).cardPiles.hand.filter((carta) => carta.id !== idImprovise).slice(-2)) elegir(motor, id, carta.uuid);
      pulsar(motor, id, boton(motor, id, 'Done'));
    }
    // Robar mediante fases reales hasta encontrar una de las tres copias, conservándola en mano.
    // No depende de la aleatoriedad de la mano inicial ni altera el orden del mazo.
    let jugado = false;
    for (let paso = 0; paso < 200 && !jugado; paso++) {
      for (const jugador of jugadoresImprovise) {
        const estado = propio(jugador.id), prompt = estado.promptState;
        if (prompt.promptType === 'actionWindow') {
          const improvise = jugador.id === id && estado.cardPiles.hand.find((carta) => carta.id === idImprovise && carta.selectable);
          if (improvise) { elegir(motor, id, improvise.uuid); jugado = true; break; }
          const pasar = prompt.buttons.find((boton) => boton.text === 'Pass' && !boton.disabled);
          if (pasar) pulsar(motor, jugador.id, pasar);
        } else if (prompt.promptType === 'resource') {
          const omitir = prompt.buttons.find((boton) => boton.arg === 'done' && !boton.disabled);
          if (omitir) pulsar(motor, jugador.id, omitir);
        }
      }
    }
    assert.ok(jugado, 'Las fases reales deben permitir robar y jugar Improvise.');
    const prompt = propio(id).promptState;
    assert.ok(prompt.perCardButtons.length > 0);
    assert.equal(prompt.displayCards.length, 1);
    const antes = motor.vista(id), antesRival = motor.vista(rival), cambiosAntes = cambios;
    assert.throws(() => motor.ejecutar(id, { nombre: 'menuButton', args: [prompt.displayCards[0].cardUuid, prompt.promptUuid] }),
      (error) => error.codigo === 'accion_invalida' && /no pertenece/.test(error.message));
    assert.deepEqual(fallos, [], 'Una solicitud inválida no debe notificar fallo interno.');
    assert.equal(cambios, cambiosAntes, 'El rechazo no emite cambios de partida.');
    assert.deepEqual(motor.vista(id), antes);
    assert.deepEqual(motor.vista(rival), antesRival, 'El rival conserva conexión y estado.');
    assert.equal(motor.resultado(), null);
    const descartar = prompt.perCardButtons.find((boton) => boton.arg === 'discard');
    assert.ok(descartar);
    motor.ejecutar(id, { nombre: 'perCardMenuButton', args: [descartar.arg, prompt.displayCards[0].cardUuid, prompt.promptUuid] });
    assert.ok(cambios > cambiosAntes);
    assert.notEqual(propio(id).promptState.promptUuid, prompt.promptUuid);
    assert.equal(propio(id).numCardsInDeck, antes.players[id].numCardsInDeck - 1);
    assert.deepEqual(fallos, []);
    motor.ejecutar(id, { nombre: 'concede', args: [] });
    assert.equal(motor.resultado().ganadorId, rival);
  } finally { motor.cerrar(); }
});

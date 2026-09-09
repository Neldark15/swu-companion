import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const raiz = new URL('./.motor/fuente/', import.meta.url);
const cargar = createRequire(new URL('package.json', raiz));
const bloqueo = JSON.parse(await readFile(new URL('./motor-lock.json', import.meta.url), 'utf8'));
const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const clonar = (valor) => JSON.parse(JSON.stringify(valor));
function exigir(condicion, mensaje, codigo = 'accion_invalida') {
  if (!condicion) throw Object.assign(new Error(mensaje), { codigo });
}
const mensajes = {
  illegalInFormat: 'Hay cartas fuera del Premier vigente o suspendidas.',
  invalidDeckData: 'El mazo tiene un formato inválido.',
  invalidCardLocation: 'Hay cartas en una zona incorrecta del mazo.',
  maxSideboardSizeExceeded: 'El sideboard supera el máximo de diez cartas.',
  minDecklistSizeNotMet: 'El mazo no alcanza el mínimo de cartas para su base.',
  minMainboardSizeNotMet: 'El principal no alcanza el mínimo de cartas para su base.',
  tooManyCopiesOfCard: 'Hay demasiadas copias de una carta.',
  tooManyLeaders: 'Premier requiere exactamente un líder.',
  unknownCardId: 'Hay identificadores de cartas desconocidos.',
};

/** Carga exclusivamente el motor local preparado; nunca inicia servidores upstream. */
export async function crearProveedorMotor() {
  const preparado = JSON.parse(await readFile(new URL('./.motor/preparado.json', import.meta.url), 'utf8').catch(() => {
    throw new Error('Prepará el motor con npm --prefix services/juego run preparar-motor.');
  }));
  exigir(preparado.revision === bloqueo.revision && preparado.catalogoSha256 === bloqueo.catalogo.sha256,
    'La caché del motor no coincide con motor-lock.json. Volvé a prepararla.', 'motor_no_preparado');
  const { Game } = cargar('./build/server/game/core/Game.js');
  const { Deck } = cargar('./build/server/utils/deck/Deck.js');
  const { DeckValidator } = cargar('./build/server/utils/deck/DeckValidator.js');
  const { LocalFolderCardDataGetter } = cargar('./build/server/utils/cardData/LocalFolderCardDataGetter.js');
  const { getUserWithDefaultsSet } = cargar('./build/server/Settings.js');
  const { SwuGameFormat, CardPool } = cargar('./build/server/game/core/Constants.js');
  const datos = await LocalFolderCardDataGetter.createAsync(fileURLToPath(new URL('test/json/', raiz)));
  const validador = await DeckValidator.createAsync(datos);

  async function validarMazo(mazo) {
    const entrada = (carta) => esObjeto(carta) && typeof carta.id === 'string' && /^[A-Z0-9]{3,4}_\d{3}$/.test(carta.id)
      && Number.isInteger(carta.count) && carta.count > 0 && carta.count <= 1000;
    if (!esObjeto(mazo) || !entrada(mazo.leader) || mazo.leader.count !== 1 || !entrada(mazo.base) || mazo.base.count !== 1
      || !Array.isArray(mazo.deck) || mazo.deck.length > 1000 || !mazo.deck.every(entrada)
      || (mazo.sideboard !== undefined && (!Array.isArray(mazo.sideboard) || mazo.sideboard.length > 10 || !mazo.sideboard.every(entrada)))) {
      return [{ codigo: 'formato_invalido', mensaje: 'Usá un líder, una base y listas de cartas con ID SET_001 y cantidades enteras positivas.' }];
    }
    const copia = clonar(mazo);
    const fallos = validador.validateSwuDbDeck(copia, { format: SwuGameFormat.Premier, cardPool: CardPool.Current });
    const errores = Object.entries(fallos).map(([codigo, detalle]) => ({ codigo, mensaje: mensajes[codigo] ?? 'El mazo no es válido.',
      ...(Array.isArray(detalle) ? { cartas: detalle.map((item) => item.id ?? item.card?.id).filter(Boolean) } : {}) }));
    const noImplementadas = validador.getUnimplementedCardsInDeck(copia);
    if (noImplementadas.length) errores.push({ codigo: 'cartas_no_implementadas', mensaje: 'El motor todavía no implementa estas cartas.', cartas: noImplementadas.map((carta) => carta.id) });
    // Upstream verifica cantidades por fila. Aquí se suman principal, sideboard y reimpresiones del mismo ID interno.
    const cantidades = new Map();
    for (const carta of [...copia.deck, ...(copia.sideboard ?? [])]) {
      const id = datos.setCodeMap.get(carta.id);
      if (!id) continue;
      const total = cantidades.get(id) ?? { cantidad: 0, cartas: [] };
      total.cantidad += carta.count;
      total.cartas.push(carta.id);
      cantidades.set(id, total);
    }
    for (const [id, total] of cantidades) {
      if (total.cantidad > (bloqueo.limitesCopias[id] ?? 3)) errores.push({ codigo: 'copias_excedidas', mensaje: 'El total de copias entre principal, sideboard y reimpresiones supera el límite.', cartas: total.cartas });
    }
    return errores;
  }

  async function crearPartida({ id, jugadores, alCambiar = () => {}, alFallar = () => {} }) {
    exigir(typeof id === 'string' && id.length > 0 && id.length <= 128, 'Identificador de partida inválido.');
    exigir(Array.isArray(jugadores) && jugadores.length === 2 && new Set(jugadores.map((j) => j.id)).size === 2,
      'La partida necesita dos jugadores distintos.');
    for (const jugador of jugadores) {
      exigir(typeof jugador.id === 'string' && jugador.id.length > 0 && !['__proto__', 'prototype', 'constructor'].includes(jugador.id)
        && typeof jugador.nombre === 'string' && jugador.nombre.trim().length > 0, 'Jugador inválido.');
      const errores = await validarMazo(jugador.mazo);
      exigir(errores.length === 0, errores.map((error) => error.mensaje).join(' '), 'mazo_invalido');
    }
    let cerrado = false;
    let fallo = null;
    let terminado = null;
    let listo = false;
    const temporizadores = new Set();
    const ids = new Set(jugadores.map((jugador) => jugador.id));
    // Los nombres internos únicos evitan la ambigüedad de winnerNames upstream si ambos perfiles se llaman igual.
    const usuarios = jugadores.map((jugador) => getUserWithDefaultsSet({ id: jugador.id, username: jugador.id,
      settings: { optionSettings: { autoSingleTarget: false } } }));
    const avisar = () => { if (listo && !cerrado) alCambiar(); };
    const fallar = (error) => {
      if (fallo || cerrado) return;
      fallo = error instanceof Error ? error : new Error('El motor interrumpió la partida.');
      alFallar(fallo);
    };
    const juego = new Game({ id, owner: usuarios[0].id, players: usuarios, allowSpectators: false, gameMode: 'premier',
      cardDataGetter: datos, undoMode: 'disabled', useActionTimer: false, pushUpdate: avisar,
      userTimeoutDisconnect: () => {},
      buildSafeTimeout(callback, demora) {
        const temporizador = setTimeout(() => { temporizadores.delete(temporizador); if (!cerrado) { try { callback(); avisar(); } catch (error) { fallar(error); } } }, demora);
        temporizador.unref(); temporizadores.add(temporizador); return temporizador;
      },
    }, { router: { id, handleError: (_juego, error) => fallar(error), handleSerializationFailure: (_juego, error) => fallar(error),
      handleGameEnd() {
        terminado = { ganadorId: juego.winnerNames.length === 1 ? juego.winnerNames[0] : null, motivo: juego.gameEndReason };
      }, sendGameState: avisar } });
    for (const jugador of jugadores) juego.selectDeck(jugador.id, new Deck(clonar(jugador.mazo), datos));
    await juego.initialiseAsync();
    if (fallo) throw fallo;
    listo = true;

    function comprobarUsuario(usuarioId) {
      exigir(ids.has(usuarioId), 'No pertenecés a esta partida.', 'jugador_ajeno');
      exigir(!cerrado && !fallo, 'La partida está cerrada o interrumpida.', 'partida_cerrada');
    }
    function vista(usuarioId) {
      comprobarUsuario(usuarioId);
      // getState lleva cursor de chat por receptor. Se entrega historial completo para reconectar sin depender del socket anterior.
      juego.chatMessageOffsets.set(usuarioId, 0);
      const estado = clonar(juego.getState(usuarioId));
      if (fallo) throw fallo;
      for (const jugador of jugadores) {
        estado.players[jugador.id].name = jugador.nombre;
        estado.players[jugador.id].user = { id: jugador.id, username: jugador.nombre };
      }
      return estado;
    }
    function ejecutar(usuarioId, comando) {
      comprobarUsuario(usuarioId);
      exigir(!terminado, 'La partida ya terminó.', 'partida_terminada');
      exigir(esObjeto(comando) && Array.isArray(comando.args), 'Comando inválido.');
      const { nombre, args } = comando;
      exigir(['cardClicked', 'menuButton', 'perCardMenuButton', 'statefulPromptResults', 'concede'].includes(nombre), 'Comando no permitido.');
      const jugador = juego.getPlayerById(usuarioId);
      const prompt = jugador.currentPrompt();
      const texto = (valor) => typeof valor === 'string' && valor.length <= 1000;
      const argumento = (valor) => texto(valor) || Number.isSafeInteger(valor);
      const uuidActual = (uuid) => exigir(texto(uuid) && uuid === prompt.promptUuid && jugador.activeForPreviousPrompt, 'Esta elección ya no está activa.');
      const botonValido = (boton, arg, metodo) => !boton.disabled && boton.arg === arg && (boton.method ?? 'menuButton') === (metodo ?? 'menuButton');
      if (nombre === 'concede') exigir(args.length === 0, 'Conceder no acepta argumentos.');
      if (nombre === 'cardClicked') {
        exigir(args.length === 1 && texto(args[0]), 'Elegí una carta válida.');
        const carta = juego.findAnyCardInAnyList(args[0]);
        exigir(carta && jugador.getCardSelectionState(carta).selectable, 'Esta carta no es seleccionable en tu elección actual.');
      }
      if (nombre === 'menuButton') {
        exigir(args.length >= 2 && args.length <= 3 && argumento(args[0]) && (args[2] == null || texto(args[2])), 'Botón inválido.');
        uuidActual(args[1]);
        const [arg, , metodo] = args;
        const boton = prompt.buttons?.some((boton) => botonValido(boton, arg, metodo) && (!boton.command || boton.command === 'menuButton'));
        // DisplayCardsWithButtons también marca cartas selectable, pero solo admite perCardMenuButton.
        const carta = !prompt.perCardButtons?.length && prompt.displayCards?.some((carta) => carta.cardUuid === arg && ['selectable', 'selected'].includes(carta.selectionState));
        const numero = prompt.selectNumber && /^-?\d+$/.test(String(arg)) && Number(arg) >= prompt.selectNumber.min && Number(arg) <= prompt.selectNumber.max;
        const lista = prompt.dropdownListOptions?.includes(arg);
        exigir(boton || ((carta || numero || lista) && (metodo == null || metodo === 'menuButton')), 'El botón no pertenece a tu elección actual.');
      }
      if (nombre === 'perCardMenuButton') {
        exigir(args.length >= 3 && args.length <= 4 && argumento(args[0]) && args.slice(1, 3).every(texto), 'Elección por carta inválida.');
        uuidActual(args[2]);
        exigir(args[3] == null || args[3] === 'menuButton' || args[3] === 'perCardMenuButton', 'Método inválido.');
        exigir(prompt.perCardButtons?.some((boton) => !boton.disabled && boton.arg === args[0])
          && prompt.displayCards?.some((carta) => carta.cardUuid === args[1] && carta.selectionState === 'selectable'), 'Carta o botón ajeno a la elección actual.');
      }
      if (nombre === 'statefulPromptResults') {
        exigir(args.length === 2 && esObjeto(args[0]), 'Distribución inválida.'); uuidActual(args[1]);
        const distribucion = args[0]; const reglas = prompt.distributeAmongTargets;
        exigir(reglas && distribucion.type === reglas.type && Array.isArray(distribucion.valueDistribution) && distribucion.valueDistribution.length <= 200, 'Distribución incompatible.');
        const vistos = new Set(); let suma = 0;
        for (const valor of distribucion.valueDistribution) {
          exigir(esObjeto(valor) && texto(valor.uuid) && Number.isInteger(valor.amount) && valor.amount > 0 && !vistos.has(valor.uuid), 'Distribución inválida o repetida.');
          const carta = juego.findAnyCardInAnyList(valor.uuid);
          exigir(carta && jugador.getCardSelectionState(carta).selectable, 'Objetivo no permitido.');
          if (reglas.isIndirectDamage && carta.isUnit()) exigir(valor.amount <= carta.remainingHp, 'El daño indirecto supera la vida restante.');
          vistos.add(valor.uuid); suma += valor.amount;
        }
        exigir((suma === 0 && reglas.canChooseNoTargets) || (suma > 0 && (reglas.canDistributeLess ? suma <= reglas.amount : suma === reglas.amount)), 'La suma distribuida no es válida.');
        exigir(!reglas.maxTargets || vistos.size <= reglas.maxTargets, 'Demasiados objetivos.');
      }
      try { juego[nombre](usuarioId, ...clonar(args)); juego.continue(); if (fallo) throw fallo; } catch (error) { fallar(error); throw error; }
      avisar();
    }
    return { vista, ejecutar, resultado: () => terminado ? { ...terminado } : null, cerrar() {
      if (cerrado) return; cerrado = true;
      for (const temporizador of temporizadores) clearTimeout(temporizador);
      temporizadores.clear();
      for (const jugador of juego.getPlayers()) jugador.actionTimer.stop();
      juego.removeAllListeners();
    } };
  }
  return { version: bloqueo.revision, validarMazo, crearPartida };
}

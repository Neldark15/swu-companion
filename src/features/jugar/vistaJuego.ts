/** Adaptador de getState de Forceteki. El motor conserva reglas y privacidad. */
export interface ComandoTablero { nombre: string; args: unknown[] }
export interface CartaJuego {
  clave: string; uuid: string | null; nombre: string; oculta: boolean
  edicion: string | null; numero: number | null; zona: string; tipo: string
  poder: number | null; salud: number | null; dano: number | null
  agotada: boolean | null; seleccionable: boolean; seleccionada: boolean; orden: number | null
  atacante: boolean; defensora: boolean; centinela: boolean; anulada: boolean
  accionEpicaGastada: boolean; padre: string | null; mejoras: CartaJuego[]
  texto: string | null; estadoSeleccion: string | null; ladoInicial: boolean | null
}
export interface BotonJuego {
  texto: string; argumento: string | number; comando: string; desactivado: boolean; seleccionado: boolean | null; metodo: string | null
  origen: CartaJuego | null; cantidad: number | null
}
export interface DistribucionJuego {
  tipo: string; cantidad: number; menos: boolean; ninguno: boolean; maxObjetivos: number | null
  indirecto: boolean; ficha: string | null
}
export interface PromptJuego {
  uuid: string; tipo: string; titulo: string; descripcion: string
  botones: BotonJuego[]; botonesCarta: BotonJuego[]; cartas: CartaJuego[]
  multiple: boolean; ordenar: boolean; numero: { min: number; max: number } | null
  opciones: string[]; distribucion: DistribucionJuego | null; restantes: number | null
}
export const ZONAS_JUEGO = ['hand', 'resources', 'groundArena', 'spaceArena', 'discard', 'capturedZone', 'outsideTheGame', 'credits'] as const
export type ZonaJuego = typeof ZONAS_JUEGO[number]
export interface JugadorJuego {
  id: string; nombre: string; iniciativa: boolean; activo: boolean; desconectado: boolean
  recursosDisponibles: number | null; mazo: number | null; base: CartaJuego | null; lider: CartaJuego | null
  zonas: Record<ZonaJuego, CartaJuego[]>; fuerza: CartaJuego | null; prompt: PromptJuego
}
export interface VistaJuego {
  id: string; fase: string; jugador: JugadorJuego | null; rival: JugadorJuego | null; ganadores: string[]
}

function registro(valor: unknown): Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor) ? valor as Record<string, unknown> : {}
}
function cadena(valor: unknown): string { return typeof valor === 'string' ? valor : '' }
function numero(valor: unknown): number | null { return typeof valor === 'number' && Number.isFinite(valor) ? valor : null }
function booleano(valor: unknown): boolean | null { return typeof valor === 'boolean' ? valor : null }
function lista(valor: unknown): unknown[] { return Array.isArray(valor) ? valor : [] }
function textos(valor: unknown): string[] { return lista(valor).filter((v): v is string => typeof v === 'string') }

export function normalizarCarta(valor: unknown, clave = 'carta', profundidad = 0): CartaJuego {
  const c = registro(valor)
  const edicion = registro(c.setId)
  const seleccion = registro(c.selectionState)
  const estadoSeleccion = cadena(c.selectionState) || null
  const uuid = cadena(c.uuid) || cadena(c.cardUuid) || null
  const nombre = cadena(c.name) || cadena(c.internalName).replace(/--/g, ' · ').replace(/-/g, ' ')
  return {
    clave: uuid ?? clave, uuid, nombre: nombre || 'Carta oculta', oculta: !nombre && !cadena(edicion.set),
    edicion: cadena(edicion.set).toUpperCase() || null, numero: numero(edicion.number), zona: cadena(c.zone), tipo: cadena(c.type),
    poder: numero(c.power), salud: numero(c.hp), dano: numero(c.damage), agotada: booleano(c.exhausted),
    seleccionable: c.selectable === true || seleccion.selectable === true || estadoSeleccion === 'selectable',
    seleccionada: c.selected === true || seleccion.selected === true || estadoSeleccion === 'selected',
    orden: numero(c.order) ?? numero(c.selectionOrder) ?? numero(seleccion.order),
    atacante: c.isAttacker === true, defensora: c.isDefender === true, centinela: c.sentinel === true, anulada: c.isBlanked === true,
    accionEpicaGastada: c.epicActionSpent === true || c.epicDeployActionSpent === true, padre: cadena(c.parentCardId) || null,
    mejoras: profundidad < 3 ? lista(c.upgrades).map((m, i) => normalizarCarta(m, `${clave}-mejora-${i}`, profundidad + 1)) : [],
    texto: cadena(c.displayText) || cadena(c.blockedFromPlayReason) || null, estadoSeleccion, ladoInicial: booleano(c.onStartingSide),
  }
}
function botones(valor: unknown): BotonJuego[] {
  return lista(valor).flatMap((entrada) => {
    const b = registro(entrada)
    if ((typeof b.arg !== 'string' && !(typeof b.arg === 'number' && Number.isInteger(b.arg))) || typeof b.text !== 'string') return []
    return [{ texto: cadena(b.label) || b.text, argumento: b.arg, comando: cadena(b.command) || 'menuButton', desactivado: b.disabled === true,
      seleccionado: booleano(b.selected), metodo: cadena(b.method) || null,
      origen: b.sourceCard || b.card ? normalizarCarta(b.sourceCard ?? b.card) : null, cantidad: numero(b.count) }]
  })
}
export function normalizarPrompt(valor: unknown): PromptJuego {
  const p = registro(valor)
  const n = registro(p.selectNumber)
  const d = registro(p.distributeAmongTargets)
  const min = numero(n.min), max = numero(n.max), cantidad = numero(d.amount)
  return {
    uuid: cadena(p.promptUuid), tipo: cadena(p.promptType), titulo: cadena(p.promptTitle), descripcion: cadena(p.menuTitle),
    botones: botones(p.buttons), botonesCarta: botones(p.perCardButtons), cartas: lista(p.displayCards).map((c, i) => normalizarCarta(c, `prompt-${i}`)),
    multiple: p.selectCardMode === 'multiple', ordenar: p.selectOrder === true,
    numero: min !== null && max !== null && Number.isInteger(min) && Number.isInteger(max) && min <= max ? { min, max } : null,
    opciones: textos(p.dropdownListOptions), restantes: numero(registro(p.batchTriggerResolution).remainingCount),
    distribucion: cantidad !== null && cantidad >= 0 && cadena(d.type) ? {
      tipo: cadena(d.type), cantidad, menos: d.canDistributeLess === true, ninguno: d.canChooseNoTargets === true,
      maxObjetivos: numero(d.maxTargets), indirecto: d.isIndirectDamage === true || d.type === 'distributeIndirectDamage', ficha: cadena(d.tokenType) || null,
    } : null,
  }
}
function jugador(valor: unknown, id: string): JugadorJuego {
  const p = registro(valor), pilas = registro(p.cardPiles), fuerza = registro(p.forceToken)
  const zonas = Object.fromEntries(ZONAS_JUEGO.map(zona => [zona, lista(pilas[zona]).map((c, i) => normalizarCarta(c, `${id}-${zona}-${i}`))])) as Record<ZonaJuego, CartaJuego[]>
  return {
    id, nombre: cadena(p.name) || 'Jugador', iniciativa: p.hasInitiative === true, activo: p.isActionPhaseActivePlayer === true,
    desconectado: p.disconnected === true, recursosDisponibles: numero(p.availableResources), mazo: numero(p.numCardsInDeck),
    base: p.base ? normalizarCarta(p.base, `${id}-base`) : null, lider: p.leader ? normalizarCarta(p.leader, `${id}-lider`) : null,
    zonas, fuerza: fuerza.active === true ? normalizarCarta({ ...fuerza, name: 'La Fuerza', type: 'force', zone: 'base' }, `${id}-fuerza`) : null,
    prompt: normalizarPrompt(p.promptState),
  }
}
export function normalizarVista(valor: unknown, usuarioId: string): VistaJuego {
  const e = registro(valor), jugadores = registro(e.players), propio = registro(jugadores[usuarioId])
  // El resumen ajeno siempre tiene promptState vacío. Nunca reinterpretar como propia una vista privada de otra cuenta.
  const esVistaPropia = usuarioId !== '' && Object.keys(registro(propio.promptState)).length > 0 &&
    (!cadena(e.playerUpdate) || e.playerUpdate === usuarioId || e.playerUpdate === propio.name)
  const rival = Object.keys(jugadores).find(id => id !== usuarioId)
  return { id: cadena(e.id), fase: cadena(e.phase), jugador: esVistaPropia ? jugador(propio, usuarioId) : null,
    rival: esVistaPropia && rival ? jugador(jugadores[rival], rival) : null, ganadores: textos(e.winners) }
}
export function todasLasCartas(vista: VistaJuego): CartaJuego[] {
  const cartas = [vista.jugador, vista.rival].flatMap(j => j ? [j.base, j.lider, j.fuerza, ...Object.values(j.zonas).flat()].filter((c): c is CartaJuego => c !== null) : [])
  const visitar = (c: CartaJuego): CartaJuego[] => [c, ...c.mejoras.flatMap(visitar)]
  return Array.from(new Map(cartas.flatMap(visitar).map(c => [c.clave, c])).values())
}
export function comandoCarta(carta: CartaJuego, prompt?: PromptJuego): ComandoTablero | null {
  if (!carta.uuid || (!carta.seleccionable && !carta.seleccionada)) return null
  if (prompt) return prompt.uuid && prompt.botonesCarta.length === 0 ? { nombre: 'menuButton', args: [carta.uuid, prompt.uuid] } : null
  return { nombre: 'cardClicked', args: [carta.uuid] }
}
export function comandoBoton(boton: BotonJuego, prompt: PromptJuego, carta?: CartaJuego): ComandoTablero | null {
  if (boton.desactivado || !prompt.uuid) return null
  const metodo = boton.metodo ? [boton.metodo] : []
  if (boton.comando === 'perCardMenuButton') return carta?.uuid ? { nombre: 'perCardMenuButton', args: [boton.argumento, carta.uuid, prompt.uuid, ...metodo] } : null
  if (boton.comando === 'menuButton') return { nombre: 'menuButton', args: [boton.argumento, prompt.uuid, ...metodo] }
  return null
}
export interface RepartoJuego { uuid: string; amount: number }
export function validarDistribucion(prompt: PromptJuego, reparto: RepartoJuego[], cartas: CartaJuego[]): string | null {
  const d = prompt.distribucion
  if (!d || !prompt.uuid) return 'Esta elección ya no está disponible.'
  const vistos = new Set<string>()
  for (const entrada of reparto) {
    const carta = cartas.find(c => c.uuid === entrada.uuid && c.seleccionable)
    if (!carta || vistos.has(entrada.uuid) || !Number.isInteger(entrada.amount) || entrada.amount <= 0) return 'Elegí objetivos válidos y cantidades enteras positivas.'
    vistos.add(entrada.uuid)
    if (d.indirecto && carta.tipo.toLowerCase().includes('unit') && carta.salud !== null && carta.dano !== null && entrada.amount > carta.salud - carta.dano) return 'El daño indirecto no puede superar la salud restante de una unidad.'
  }
  const total = reparto.reduce((s, r) => s + r.amount, 0)
  if (total === 0) return d.ninguno ? null : 'Distribuí al menos un punto.'
  if (d.maxObjetivos !== null && reparto.length > d.maxObjetivos) return `Elegí hasta ${d.maxObjetivos} objetivos.`
  if (total > d.cantidad || (!d.menos && total !== d.cantidad)) return `Distribuí ${d.menos ? 'hasta' : 'exactamente'} ${d.cantidad}.`
  return null
}
export function comandoDistribucion(prompt: PromptJuego, reparto: RepartoJuego[], cartas: CartaJuego[]): ComandoTablero | null {
  return validarDistribucion(prompt, reparto, cartas) || !prompt.distribucion ? null : {
    nombre: 'statefulPromptResults', args: [{ type: prompt.distribucion.tipo, valueDistribution: reparto }, prompt.uuid],
  }
}
const TRADUCCIONES: Record<string, string> = {
  Done: 'Listo', Cancel: 'Cancelar', Yes: 'Sí', No: 'No', Pass: 'Pasar', Skip: 'Continuar', Trigger: 'Activar',
  Yourself: 'Vos', Opponent: 'Rival', Keep: 'Conservar mano', 'Keep Hand': 'Conservar mano', Mulligan: 'Cambiar mano',
  'Claim Initiative': 'Tomar iniciativa', 'choose initiative player': 'Iniciativa inicial',
  'You won the flip. Choose the player to start with initiative:': 'Ganaste el sorteo. Elegí quién empieza con la iniciativa:',
  'Mulligan Step': 'Mano inicial', 'Choose whether to mulligan or keep your hand': 'Elegí si conservás tu mano inicial o la cambiás.',
  'Resource Step': 'Elegir recursos', 'Confirm Resources': 'Confirmar recursos', 'Skip Resourcing': 'No añadir recurso',
  'Waiting for opponent to choose cards to resource': 'Esperando que el rival elija sus recursos',
  'Waiting for opponent': 'Esperando al rival', 'Waiting for opponent to take an action or pass': 'Esperando que el rival actúe o pase',
  'Choose a number': 'Elegí un número', 'Choose an option from the list': 'Elegí una opción',
  'Action Phase': 'Fase de acción', 'Action Window': 'Fase de acción', 'Choose an action': 'Elegí una acción',
  'Select one': 'Elegí una opción', 'Regroup Phase': 'Reagrupamiento', 'Resolve all': 'Resolver todas',
  'Resolve next': 'Resolver la siguiente', 'Take nothing': 'No tomar ninguna',
  'You may trigger this ability': 'Podés activar esta habilidad',
  'You have multiple triggers to resolve. Choose which to resolve first:': 'Tenés varias habilidades pendientes. Elegí cuál resolver primero:',
  'Choose Triggered Ability Resolution Order': 'Orden de habilidades', 'Resolve Grouped Triggers': 'Resolver habilidades agrupadas',
}
export function textoJuego(texto: string): string {
  if (TRADUCCIONES[texto]) return TRADUCCIONES[texto]
  const recursos = /^Select (\d+) cards? to resource$/.exec(texto)
  if (recursos) return `Elegí ${recursos[1]} ${recursos[1] === '1' ? 'carta como recurso' : 'cartas como recursos'}`
  const rango = /^Select between (\d+) and (\d+) cards to resource$/.exec(texto)
  if (rango) return `Elegí entre ${rango[1]} y ${rango[2]} cartas como recursos`
  const grupo = /^Resolve all \((\d+)\)$/.exec(texto)
  if (grupo) return `Resolver todas (${grupo[1]})`
  return texto
}

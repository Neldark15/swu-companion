export type ModoCalculadora = 'premier' | 'twin-suns'
export type FichaCalculadora = 'iniciativa' | 'blast' | 'plan'

export interface BaseCalculadora {
  id: string
  nombre: string
  imagen: string | null
  vidaImpresa: number
  usaFuerza: boolean
}

export interface JugadorCalculadora {
  id: string
  nombre: string
  vida: number
  maxVida: number
  base: BaseCalculadora | null
  fuerza: boolean
}

export interface InstantaneaCalculadora {
  modo: ModoCalculadora
  jugadores: JugadorCalculadora[]
  ronda: number
  fichas: Record<FichaCalculadora, string | null>
  /** La iniciativa puede conservar dueño sin estar reclamada en esta ronda. */
  reclamadas: FichaCalculadora[]
}

export interface MovimientoCalculadora {
  descripcion: string
  anterior: InstantaneaCalculadora
}

export interface MesaCalculadora extends InstantaneaCalculadora {
  historial: MovimientoCalculadora[]
}

export const CLAVE_CALCULADORA = 'holocron-calculadora-casual-v1'
const MAX_HISTORIAL = 100
const MAX_RONDA = 9999
const FICHAS: readonly FichaCalculadora[] = ['iniciativa', 'blast', 'plan']
const NOMBRES_FICHA: Record<FichaCalculadora, string> = {
  iniciativa: 'Iniciativa', blast: 'Explosión', plan: 'Plan',
}

// Solo migración de partidas antiguas sin usaFuerza: UUID canónicos LOF 19–30
// verificados por su texto "The Force is with you" en el catálogo local del
// 2026-09-12. Las nuevas selecciones detectan la habilidad en basesCalculadora.
// No se infiere por el nombre ni por los PG (cuatro de estas bases tienen 25).
const BASES_FUERZA_ANTIGUAS = new Set([
  '019d317a-e2e2-79f9-b1c1-ec20814337c3',
  '019d317a-e319-745f-acde-755b3f2f30d3',
  '019d317a-e355-7fb6-88d3-faf0eade764c',
  '019d317a-e391-7ddc-b4e5-8b9dcc0b69cf',
  '019d317a-e3cd-7c4a-8215-1848b83619cc',
  '019d317a-e406-74a5-bd3f-25547ad14c72',
  '019d317a-e441-71ca-9ddb-ca0c8b501305',
  '019d317a-e47b-7d8b-99b9-c888c656ce39',
  '019d317a-e4be-7def-87c2-95215a4cfd1c',
  '019d317a-e4fc-7980-b1e9-3d0350da451d',
  '019d317a-e535-72b6-a528-435116468a6c',
  '019d317a-e569-7aa7-8767-f6956115cdd8',
])

function enteroEntre(valor: unknown, minimo: number, maximo: number): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= minimo && valor <= maximo
}

function cantidadValida(modo: ModoCalculadora, cantidad: number): boolean {
  return modo === 'premier' ? cantidad === 2 : modo === 'twin-suns' && (cantidad === 3 || cantidad === 4)
}

function clonarJugador(jugador: JugadorCalculadora): JugadorCalculadora {
  return { ...jugador, base: jugador.base ? { ...jugador.base } : null }
}

function instantanea(mesa: InstantaneaCalculadora): InstantaneaCalculadora {
  return {
    modo: mesa.modo,
    jugadores: mesa.jugadores.map(clonarJugador),
    ronda: mesa.ronda,
    fichas: { ...mesa.fichas },
    reclamadas: [...mesa.reclamadas],
  }
}

function registrar(mesa: MesaCalculadora, siguiente: InstantaneaCalculadora, descripcion: string): MesaCalculadora {
  return {
    ...siguiente,
    historial: [...mesa.historial.slice(-(MAX_HISTORIAL - 1)), { descripcion, anterior: instantanea(mesa) }],
  }
}

export function crearMesa(modo: ModoCalculadora, jugadores: Array<{ nombre: string; maxVida: number; base?: BaseCalculadora | null }>): MesaCalculadora {
  if (!cantidadValida(modo, jugadores.length)) throw new RangeError('Premier necesita 2 jugadores; Twin Suns, 3 o 4.')
  const preparados = jugadores.map((j, indice) => {
    const base = j.base == null ? null : leerBaseCalculadora(j.base)
    if (j.base != null && !base) throw new RangeError('La carta de base seleccionada tiene datos inválidos.')
    const maxVida = base ? base.vidaImpresa : j.maxVida
    if (!enteroEntre(maxVida, 1, 999)) throw new RangeError('La salud de cada base debe ser un entero entre 1 y 999.')
    return {
      id: `jugador-${indice + 1}`,
      nombre: j.nombre.replace(/\s+/g, ' ').trim().slice(0, 32) || `Jugador ${indice + 1}`,
      vida: maxVida,
      maxVida,
      base,
      fuerza: false,
    }
  })
  return {
    modo,
    jugadores: preparados,
    ronda: 1,
    fichas: { iniciativa: null, blast: null, plan: null },
    reclamadas: [],
    historial: [],
  }
}

export function cambiarVida(mesa: MesaCalculadora, id: string, delta: number): MesaCalculadora {
  if (!Number.isSafeInteger(delta) || delta === 0) return mesa
  const jugador = mesa.jugadores.find(j => j.id === id)
  if (!jugador || jugador.vida === 0) return mesa
  const vida = Math.max(0, Math.min(jugador.maxVida, jugador.vida + delta))
  const cambio = vida - jugador.vida
  if (cambio === 0) return mesa
  const descripcion = cambio < 0
    ? `${jugador.nombre}: ${-cambio} de daño (${vida}/${jugador.maxVida}).`
    : `${jugador.nombre}: recupera ${cambio} (${vida}/${jugador.maxVida}).`
  const siguiente: InstantaneaCalculadora = {
    ...instantanea(mesa),
    jugadores: mesa.jugadores.map(j => j.id === id ? { ...clonarJugador(j), vida, fuerza: vida === 0 ? false : j.fuerza } : clonarJugador(j)),
  }
  // CR 11.3.4: solo la iniciativa vuelve disponible al eliminar a su dueño.
  // Explosión y Plan siguen reclamadas hasta el reagrupamiento (CR 12.5.5).
  if (mesa.modo === 'twin-suns' && vida === 0 && mesa.fichas.iniciativa === id) {
    siguiente.fichas.iniciativa = null
    siguiente.reclamadas = siguiente.reclamadas.filter(ficha => ficha !== 'iniciativa')
  }
  return registrar(mesa, siguiente, descripcion)
}

/** CR 8.37: como máximo una ficha; se crea/gasta al resolver su habilidad. */
export function cambiarFuerza(mesa: MesaCalculadora, id: string, tieneFuerza: boolean): MesaCalculadora {
  if (mesa.modo !== 'premier' || typeof tieneFuerza !== 'boolean') return mesa
  const jugador = mesa.jugadores.find(j => j.id === id)
  if (!jugador || jugador.vida === 0 || !jugador.base?.usaFuerza || jugador.fuerza === tieneFuerza) return mesa
  const siguiente = instantanea(mesa)
  siguiente.jugadores = siguiente.jugadores.map(j => j.id === id ? { ...j, fuerza: tieneFuerza } : j)
  return registrar(mesa, siguiente, tieneFuerza
    ? `${jugador.nombre} crea su ficha de Fuerza.`
    : `${jugador.nombre} usa la Fuerza.`)
}

export function puedeTomarFicha(mesa: MesaCalculadora, id: string, ficha: FichaCalculadora): boolean {
  if (!FICHAS.includes(ficha) || (mesa.modo === 'premier' && ficha !== 'iniciativa')) return false
  const jugador = mesa.jugadores.find(j => j.id === id)
  return Boolean(jugador && jugador.vida > 0
    && !mesa.reclamadas.includes(ficha)
    && !mesa.reclamadas.some(reclamada => mesa.fichas[reclamada] === id))
}

/** Marcadores manuales: reclamar una ficha nunca aplica daño ni roba cartas. */
export function tomarFicha(mesa: MesaCalculadora, id: string, ficha: FichaCalculadora): MesaCalculadora {
  if (!puedeTomarFicha(mesa, id, ficha)) return mesa
  const jugador = mesa.jugadores.find(j => j.id === id)!
  return registrar(mesa, {
    ...instantanea(mesa),
    fichas: { ...mesa.fichas, [ficha]: id },
    reclamadas: [...mesa.reclamadas, ficha],
  }, `${jugador.nombre} toma ${NOMBRES_FICHA[ficha]}.`)
}

export function siguienteRonda(mesa: MesaCalculadora): MesaCalculadora {
  if (mesa.ronda >= MAX_RONDA) return mesa
  return registrar(mesa, {
    ...instantanea(mesa),
    ronda: mesa.ronda + 1,
    fichas: { iniciativa: mesa.fichas.iniciativa, blast: null, plan: null },
    reclamadas: [],
  }, `Comienza la ronda ${mesa.ronda + 1}.`)
}

export function deshacer(mesa: MesaCalculadora): MesaCalculadora {
  const ultimo = mesa.historial.at(-1)
  if (!ultimo) return mesa
  return { ...instantanea(ultimo.anterior), historial: mesa.historial.slice(0, -1) }
}

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function imagenValida(valor: unknown): valor is string | null {
  if (valor === null) return true
  if (typeof valor !== 'string' || !valor || valor.length > 2048
    || [...valor].some(caracter => caracter.charCodeAt(0) <= 32 || caracter.charCodeAt(0) === 127)
    || valor.includes('\\') || valor.startsWith('//')) return false
  const absoluta = /^https:\/\//i.test(valor)
  if (!absoluta && (/^[a-z][a-z0-9+.-]*:/i.test(valor) || /^[?#]/.test(valor))) return false
  try {
    const url = new URL(valor, 'https://calculadora.local/')
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

export function leerBaseCalculadora(valor: unknown): BaseCalculadora | null {
  if (!objeto(valor) || typeof valor.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(valor.id)
    || typeof valor.nombre !== 'string' || !valor.nombre.trim() || valor.nombre.length > 160
    || [...valor.nombre].some(caracter => caracter.charCodeAt(0) < 32 || caracter.charCodeAt(0) === 127)
    || !imagenValida(valor.imagen) || !enteroEntre(valor.vidaImpresa, 1, 999)
    || (valor.usaFuerza !== undefined && typeof valor.usaFuerza !== 'boolean')) return null
  return {
    id: valor.id, nombre: valor.nombre, imagen: valor.imagen, vidaImpresa: valor.vidaImpresa,
    usaFuerza: valor.usaFuerza ?? BASES_FUERZA_ANTIGUAS.has(valor.id),
  }
}

function mismaBase(a: BaseCalculadora | null, b: BaseCalculadora | null): boolean {
  return a === null || b === null ? a === b
    : a.id === b.id && a.nombre === b.nombre && a.imagen === b.imagen && a.vidaImpresa === b.vidaImpresa && a.usaFuerza === b.usaFuerza
}

function leerInstantanea(valor: unknown): InstantaneaCalculadora | null {
  if (!objeto(valor) || (valor.modo !== 'premier' && valor.modo !== 'twin-suns')) return null
  if (!Array.isArray(valor.jugadores) || !cantidadValida(valor.modo, valor.jugadores.length)) return null
  if (!enteroEntre(valor.ronda, 1, MAX_RONDA) || !objeto(valor.fichas) || !Array.isArray(valor.reclamadas)) return null
  const jugadores: JugadorCalculadora[] = []
  for (const jugador of valor.jugadores) {
    if (!objeto(jugador) || typeof jugador.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(jugador.id)
      || typeof jugador.nombre !== 'string' || !jugador.nombre.trim() || jugador.nombre.length > 32
      || !enteroEntre(jugador.maxVida, 1, 999) || !enteroEntre(jugador.vida, 0, jugador.maxVida)) return null
    // Los guardados anteriores a la selección de cartas no tenían este campo.
    const base = jugador.base == null ? null : leerBaseCalculadora(jugador.base)
    if ((jugador.base != null && !base) || (base !== null && base.vidaImpresa !== jugador.maxVida)) return null
    if (jugador.fuerza !== undefined && typeof jugador.fuerza !== 'boolean') return null
    const fuerza = jugador.fuerza ?? false
    if (fuerza && (valor.modo !== 'premier' || !base?.usaFuerza || jugador.vida === 0)) return null
    jugadores.push({ id: jugador.id, nombre: jugador.nombre, vida: jugador.vida, maxVida: jugador.maxVida, base, fuerza })
  }
  const ids = new Set(jugadores.map(j => j.id))
  if (ids.size !== jugadores.length) return null
  const fichas: Record<FichaCalculadora, string | null> = { iniciativa: null, blast: null, plan: null }
  for (const ficha of FICHAS) {
    const dueno = valor.fichas[ficha]
    if (dueno !== null && (typeof dueno !== 'string' || !ids.has(dueno))) return null
    fichas[ficha] = dueno
  }
  const reclamadas: FichaCalculadora[] = []
  const reclamantes = new Set<string>()
  for (const ficha of valor.reclamadas) {
    if (typeof ficha !== 'string' || !FICHAS.includes(ficha as FichaCalculadora)) return null
    const clave = ficha as FichaCalculadora
    const dueno = fichas[clave]
    if (!dueno || reclamadas.includes(clave) || reclamantes.has(dueno)) return null
    reclamantes.add(dueno)
    reclamadas.push(clave)
  }
  if (valor.modo === 'premier' && (fichas.blast !== null || fichas.plan !== null)) return null
  if (valor.modo === 'twin-suns' && jugadores.some(j => j.vida === 0 && j.id === fichas.iniciativa)) return null
  if ((fichas.blast !== null && !reclamadas.includes('blast')) || (fichas.plan !== null && !reclamadas.includes('plan'))) return null
  return { modo: valor.modo, jugadores, ronda: valor.ronda, fichas, reclamadas }
}

/** Lee datos locales ajenos a los tipos de TS. Nunca restaura un snapshot sin validarlo. */
export function leerMesa(crudo: string | null): MesaCalculadora | null {
  if (typeof crudo !== 'string' || crudo.length > 2_000_000) return null
  try {
    const valor: unknown = JSON.parse(crudo)
    if (!objeto(valor) || !Array.isArray(valor.historial) || valor.historial.length > MAX_HISTORIAL) return null
    const mesa = leerInstantanea(valor)
    if (!mesa) return null
    const historial: MovimientoCalculadora[] = []
    for (const movimiento of valor.historial) {
      if (!objeto(movimiento) || typeof movimiento.descripcion !== 'string'
        || !movimiento.descripcion.trim() || movimiento.descripcion.length > 160) return null
      const anterior = leerInstantanea(movimiento.anterior)
      if (!anterior || anterior.modo !== mesa.modo || anterior.ronda > mesa.ronda
        || anterior.jugadores.length !== mesa.jugadores.length
        || anterior.jugadores.some((j, indice) => {
          const actual = mesa.jugadores[indice]
          return j.id !== actual.id || j.nombre !== actual.nombre || j.maxVida !== actual.maxVida || !mismaBase(j.base, actual.base)
        })) return null
      historial.push({ descripcion: movimiento.descripcion, anterior })
    }
    return { ...mesa, historial }
  } catch {
    return null
  }
}

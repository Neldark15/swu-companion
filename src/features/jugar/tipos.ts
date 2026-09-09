export interface CartaMazoMotor { id: string; count: number }
export interface MazoMotor {
  leader: CartaMazoMotor
  base: CartaMazoMotor
  deck: CartaMazoMotor[]
  sideboard: CartaMazoMotor[]
}
export interface MazoOnline { id: string; nombre: string; mazo: MazoMotor }
export interface ComandoJuego { nombre: string; args: unknown[] }
export interface JugadorSala {
  id: string
  nombre: string
  preparado: boolean
  conectado: boolean
  mazoNombre: string
}
export interface ResultadoJuego { ganadorId: string | null; motivo: string }
export interface SalaJuego {
  codigo: string
  estado: 'espera' | 'jugando' | 'finalizada' | 'interrumpida'
  revision: number
  jugadores: JugadorSala[]
  resultado: ResultadoJuego | null
  juego?: unknown
}
export interface ConfiguracionJuego {
  disponible: boolean
  versionMotor: string
  formato: 'premier'
  modo: 'bo1'
  desarrollo: boolean
}

export function objeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? valor as Record<string, unknown> : null
}

export function leerSala(valor: unknown, usuarioId: string): SalaJuego {
  const respuesta = objeto(valor)
  const sala = objeto(respuesta?.sala)
  if (!sala || typeof sala.codigo !== 'string' || !/^[A-Z0-9]{6,16}$/.test(sala.codigo)
    || !Number.isSafeInteger(sala.revision) || Number(sala.revision) < 0
    || !['espera', 'jugando', 'finalizada', 'interrumpida'].includes(String(sala.estado))
    || !Array.isArray(sala.jugadores) || sala.jugadores.length > 2) {
    throw new Error('El servicio devolvió una sala que no podemos interpretar. Actualizá la conexión.')
  }
  const jugadores: JugadorSala[] = sala.jugadores.map((valor: unknown) => {
    const jugador = objeto(valor)
    if (!jugador || typeof jugador.id !== 'string' || typeof jugador.nombre !== 'string'
      || typeof jugador.preparado !== 'boolean' || typeof jugador.conectado !== 'boolean'
      || typeof jugador.mazoNombre !== 'string') throw new Error('No se pudo interpretar a los jugadores de la sala.')
    return { id: jugador.id, nombre: jugador.nombre, preparado: jugador.preparado,
      conectado: jugador.conectado, mazoNombre: jugador.mazoNombre }
  })
  if (!jugadores.some(jugador => jugador.id === usuarioId)) throw new Error('Esta sala no pertenece a tu sesión.')
  const resultado = objeto(sala.resultado)
  if (sala.resultado != null && (!resultado || typeof resultado.motivo !== 'string'
    || !(resultado.ganadorId === null || jugadores.some(jugador => jugador.id === resultado.ganadorId)))) {
    throw new Error('El resultado de la partida no es válido.')
  }
  return {
    codigo: sala.codigo, estado: sala.estado as SalaJuego['estado'], revision: Number(sala.revision), jugadores,
    resultado: resultado ? { ganadorId: resultado.ganadorId as string | null, motivo: String(resultado.motivo) } : null,
    juego: sala.juego,
  }
}

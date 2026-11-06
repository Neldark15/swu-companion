import type { MatchState } from '../types'

/** Ordena las escrituras: una respuesta lenta nunca restaura una jugada vieja. */
export function crearGuardadorPartidas(escribir: (partida: MatchState) => Promise<unknown>, ahora = Date.now) {
  let pendiente: Promise<unknown> = Promise.resolve()
  return (partida: MatchState): Promise<MatchState> => {
    const copia = structuredClone({ ...partida, updatedAt: ahora() })
    const guardado = pendiente.then(async () => {
      await escribir(copia)
      return copia
    })
    // Un fallo se informa al llamador, pero no bloquea el próximo reintento.
    pendiente = guardado.catch(() => {})
    return guardado
  }
}

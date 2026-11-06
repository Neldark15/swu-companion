import assert from 'node:assert/strict'
import { cambiarFuerza, cambiarVida, crearMesa, crearRevancha, leerMesa, siguienteRonda, tomarFicha } from '../src/features/calculadora/estadoCalculadora.ts'

for (const modo of ['premier', 'twin-suns'] as const) {
  const jugadores = Array.from({ length: modo === 'premier' ? 2 : 4 }, (_, i) => ({
    nombre: `Persona ${i + 1}`, maxVida: 30,
    base: i === 0 ? { id: 'base-fuerza', nombre: 'Base con Fuerza', imagen: null, vidaImpresa: 25, usaFuerza: true } : null,
  }))
  let mesa = crearMesa(modo, jugadores)
  mesa = cambiarFuerza(mesa, 'jugador-1', true)
  mesa = tomarFicha(mesa, 'jugador-1', 'iniciativa')
  if (modo === 'twin-suns') mesa = tomarFicha(mesa, 'jugador-2', 'blast')
  mesa = siguienteRonda(mesa)
  mesa = cambiarVida(mesa, 'jugador-2', -30)
  const anterior = JSON.stringify(mesa)
  const revancha = crearRevancha(mesa)
  assert.equal(JSON.stringify(mesa), anterior, 'Preparar revancha no modifica el resultado anterior')
  assert.equal(revancha.modo, modo)
  assert.equal(revancha.ronda, 1)
  assert.deepEqual(revancha.fichas, { iniciativa: null, blast: null, plan: null })
  assert.deepEqual(revancha.reclamadas, [])
  assert.deepEqual(revancha.historial, [])
  assert.deepEqual(revancha.jugadores.map(j => j.nombre), jugadores.map(j => j.nombre))
  assert.deepEqual(revancha.jugadores.map(j => j.base), mesa.jugadores.map(j => j.base))
  assert(revancha.jugadores.every(j => j.vida === j.maxVida && !j.fuerza))
  assert.deepEqual(leerMesa(JSON.stringify(revancha)), revancha, 'La revancha puede recuperarse tras recargar')
}
console.log('Revancha: Premier y Twin Suns conservan preparación y reinician la partida correctamente.')

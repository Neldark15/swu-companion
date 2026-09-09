import assert from 'node:assert/strict'
import { ClienteJuego, ErrorJuego, normalizarUrlJuego } from '../src/features/jugar/cliente.ts'
import { leerSala } from '../src/features/jugar/tipos.ts'

assert.equal(normalizarUrlJuego('https://partidas.example.test/'), 'https://partidas.example.test')
assert.equal(normalizarUrlJuego('http://127.0.0.1:3001'), 'http://127.0.0.1:3001')
for (const url of ['http://remoto.test', 'https://usuario:clave@remoto.test', 'https://remoto.test/api', 'https://remoto.test?token=x']) {
  assert.throws(() => normalizarUrlJuego(url))
}
const sala = {
  codigo: 'ABCDEF1234', estado: 'jugando', revision: 4,
  jugadores: [
    { id: 'alfa', nombre: 'Alfa', preparado: true, conectado: true, mazoNombre: 'Mazo A' },
    { id: 'beta', nombre: 'Beta', preparado: true, conectado: true, mazoNombre: 'Mazo B' },
  ], resultado: null, juego: { players: { alfa: { hand: [] }, beta: { hand: [{ facedown: true }] } } },
}
assert.equal(leerSala({ sala }, 'alfa').revision, 4)
assert.throws(() => leerSala({ sala }, 'tercero'), /sesión/)
assert.throws(() => leerSala({ sala: { ...sala, revision: -1 } }, 'alfa'), /interpretar/)
assert.throws(() => leerSala({ sala: { ...sala, resultado: { ganadorId: 'tercero', motivo: 'inventado' } } }, 'alfa'), /resultado/)

const anterior = globalThis.fetch
const peticiones: unknown[] = []
let perder = true
let rechazar = false
globalThis.fetch = async (_input, opciones) => {
  if (typeof opciones?.body === 'string') peticiones.push(JSON.parse(opciones.body) as unknown)
  assert.equal(new Headers(opciones?.headers).get('Authorization'), 'Bearer token-local')
  assert.equal(opciones?.credentials, 'omit')
  if (perder) { perder = false; throw new TypeError('Red cortada después del envío') }
  if (rechazar) return Response.json({ error: { codigo: 'revision', mensaje: 'La sala cambió' } }, { status: 409 })
  return Response.json({ sala })
}
try {
  const cliente = new ClienteJuego('https://partidas.example.test', 'alfa', async () => 'token-local')
  const comando = { nombre: 'menuButton', args: [0, 'prompt-1'] }
  await assert.rejects(cliente.enviar(sala.codigo, 3, comando), (error: unknown) => error instanceof ErrorJuego && error.codigo === 'conexion')
  assert.equal(cliente.hayJugadaPendiente, true)
  await assert.rejects(cliente.enviar(sala.codigo, 3, { nombre: 'concede', args: [] }), /anterior/)
  comando.args[0] = 99
  assert.equal((await cliente.reintentar()).revision, 4)
  assert.deepEqual(peticiones[0], peticiones[1], 'Reintenta UUID y payload originales pese mutación externa')
  assert.equal(cliente.hayJugadaPendiente, false)
  rechazar = true
  await assert.rejects(cliente.enviar(sala.codigo, 0, { nombre: 'cardClicked', args: ['carta'] }), /cambió/)
  assert.equal(cliente.hayJugadaPendiente, false, 'Un rechazo definitivo permite una nueva elección')
  cliente.cerrar()
  await assert.rejects(cliente.leer(sala.codigo), /sesión/)
} finally { globalThis.fetch = anterior }
console.log('Cliente online: sesión, respuestas y reintento sin duplicación verificados.')

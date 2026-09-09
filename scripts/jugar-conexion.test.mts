import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { setTimeout as esperar } from 'node:timers/promises'
import { Server } from '../services/juego/node_modules/socket.io/dist/index.js'
import { ClienteJuego, type ConexionJuego } from '../src/features/jugar/cliente.ts'

// Exclusivamente este programa unitario: no controla ni simula el navegador del usuario.
class DocumentoPrueba extends EventTarget { hidden = false }
async function hasta(condicion: () => boolean, mensaje: string) {
  const limite = Date.now() + 4000
  while (!condicion()) {
    assert.ok(Date.now() < limite, mensaje)
    await esperar(10)
  }
}
const sala = {
  codigo: 'ABCDEF1234', estado: 'jugando', revision: 4,
  jugadores: [
    { id: 'alfa', nombre: 'Alfa', preparado: true, conectado: true, mazoNombre: 'Mazo Alfa' },
    { id: 'beta', nombre: 'Beta', preparado: true, conectado: true, mazoNombre: 'Mazo Beta' },
  ], resultado: null,
}
async function banco(t: TestContext, obtenerToken: () => Promise<string>) {
  const documentos = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const ventanas = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const documento = new DocumentoPrueba()
  const ventana = new EventTarget()
  Object.defineProperty(globalThis, 'document', { configurable: true, value: documento })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: ventana })
  let consultas = 0
  let falloGet = false
  let bloquearGet: Promise<void> | null = null
  const tokensGet: (string | undefined)[] = []
  const http = createServer(async (req, res) => {
    if (req.url !== `/api/salas/${sala.codigo}`) { res.writeHead(404).end(); return }
    consultas += 1
    tokensGet.push(req.headers.authorization)
    if (bloquearGet) await bloquearGet
    if (res.destroyed) return
    res.setHeader('Content-Type', 'application/json')
    if (falloGet) { res.writeHead(503).end(JSON.stringify({ error: { codigo: 'snapshot_no_disponible', mensaje: 'Estado no disponible.' } })); return }
    res.end(JSON.stringify({ sala }))
  })
  const io = new Server(http, { path: '/ws' })
  const tokensSocket: unknown[] = []
  io.on('connection', socket => {
    tokensSocket.push(socket.handshake.auth.token)
    socket.emit('sala', { sala })
  })
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve))
  const direccion = http.address()
  assert.ok(direccion && typeof direccion !== 'string')
  const cliente = new ClienteJuego(`http://127.0.0.1:${direccion.port}`, 'alfa', obtenerToken)
  const estados: ConexionJuego[] = []
  const errores: Error[] = []
  let recibidas = 0
  const suscribir = () => cliente.suscribir(sala.codigo, () => { recibidas += 1 }, estado => estados.push(estado), error => errores.push(error))
  t.after(async () => {
    cliente.cerrar()
    await new Promise<void>(resolve => io.close(() => resolve()))
    if (documentos) Object.defineProperty(globalThis, 'document', documentos)
    else Reflect.deleteProperty(globalThis, 'document')
    if (ventanas) Object.defineProperty(globalThis, 'window', ventanas)
    else Reflect.deleteProperty(globalThis, 'window')
  })
  return { cliente, io, documento, ventana, estados, errores, tokensGet, tokensSocket, suscribir,
    get consultas() { return consultas }, get recibidas() { return recibidas },
    set falloGet(valor: boolean) { falloGet = valor },
    set bloquearGet(valor: Promise<void> | null) { bloquearGet = valor },
  }
}

test('cierre del servidor reconecta con token fresco y espera GET antes de habilitar acciones', async t => {
  let token = 'token-1'
  const b = await banco(t, async () => token)
  b.suscribir()
  await hasta(() => b.estados.at(-1) === 'conectado', 'La primera conexión debe reconciliar')
  token = 'token-2'
  const bloqueo = Promise.withResolvers<void>()
  b.bloquearGet = bloqueo.promise
  for (const socket of b.io.sockets.sockets.values()) socket.disconnect(true)
  await hasta(() => b.consultas === 2, 'El cierre explícito debe reintentar y pedir un nuevo snapshot')
  assert.equal(b.estados.at(-1), 'reconectando')
  assert.equal(b.estados.filter(estado => estado === 'conectado').length, 1)
  assert.deepEqual(b.tokensSocket, ['token-1', 'token-2'])
  assert.deepEqual(b.tokensGet, ['Bearer token-1', 'Bearer token-2'])
  bloqueo.resolve()
  await hasta(() => b.estados.filter(estado => estado === 'conectado').length === 2, 'El GET reconciliado debe habilitar acciones')
  assert.equal(b.io.sockets.sockets.size, 1)
})

test('GET fallido mantiene reconectando y cierra el transporte hasta una lectura válida', async t => {
  const b = await banco(t, async () => 'token')
  b.falloGet = true
  b.suscribir()
  await hasta(() => b.errores.length === 1, 'Debe mostrar el fallo del snapshot')
  assert.equal(b.estados.includes('conectado'), false)
  await hasta(() => b.io.engine.clientsCount === 0, 'El intento fallido debe cerrar el transporte')
  b.falloGet = false
  await hasta(() => b.estados.at(-1) === 'conectado', 'Debe reconciliar al recuperar el servicio')
  assert.equal(b.consultas, 2)
  assert.equal(b.io.sockets.sockets.size, 1)
})

test('rechazo de obtenerToken no abre transporte y el siguiente intento renueva autenticación', async t => {
  let consultasToken = 0
  const b = await banco(t, async () => {
    consultasToken += 1
    if (consultasToken === 1) throw new Error('Auth temporalmente no disponible')
    return 'token-renovado'
  })
  b.suscribir()
  await hasta(() => b.errores.length === 1, 'Debe terminar el intento con error de Auth')
  assert.equal(b.io.engine.clientsCount, 0)
  assert.equal(b.consultas, 0)
  await hasta(() => b.estados.at(-1) === 'conectado', 'Debe recuperar el token en un nuevo intento')
  assert.deepEqual(b.tokensSocket, ['token-renovado'])
  assert.equal(b.io.engine.clientsCount, 1)
})

test('cancelar suscripción elimina el reintento y los listeners de reconexión', async t => {
  let consultasToken = 0
  const b = await banco(t, async () => { consultasToken += 1; throw new Error('Token vencido') })
  const cancelar = b.suscribir()
  await hasta(() => b.errores.length === 1, 'Debe programar el reintento')
  cancelar()
  b.documento.dispatchEvent(new Event('visibilitychange'))
  b.ventana.dispatchEvent(new Event('online'))
  b.cliente.renovarConexion()
  await esperar(850)
  assert.equal(consultasToken, 1)
  assert.equal(b.io.engine.clientsCount, 0)
})

test('logout cancela autenticación pendiente y no revive transportes al activarse otra sesión', async t => {
  const tokenPendiente = Promise.withResolvers<string>()
  const b = await banco(t, () => tokenPendiente.promise)
  b.suscribir()
  b.cliente.cerrar()
  b.cliente.activar()
  tokenPendiente.resolve('token-de-sesion-anterior')
  b.ventana.dispatchEvent(new Event('online'))
  await esperar(100)
  assert.equal(b.io.engine.clientsCount, 0)
  assert.equal(b.tokensSocket.length, 0)
  assert.equal(b.estados.includes('conectado'), false)
})

test('reemplazar suscripción cancela intentos viejos y cierre cliente no reconecta', async t => {
  const pendiente = Promise.withResolvers<string>()
  let consultasToken = 0
  const b = await banco(t, async () => {
    consultasToken += 1
    return consultasToken === 1 ? pendiente.promise : 'token-actual'
  })
  const cancelarVieja = b.suscribir()
  b.suscribir()
  pendiente.resolve('token-viejo')
  await hasta(() => b.estados.at(-1) === 'conectado', 'La suscripción nueva debe conectar')
  cancelarVieja()
  assert.deepEqual(b.tokensSocket, ['token-actual'])
  b.cliente.cerrar()
  const consultasAlCerrar = consultasToken
  b.ventana.dispatchEvent(new Event('online'))
  await esperar(850)
  assert.equal(consultasToken, consultasAlCerrar)
  assert.equal(b.io.engine.clientsCount, 0)
})

test('renovar conexión cancela GET viejo y solo el intento vigente puede anunciar conectado', async t => {
  const b = await banco(t, async () => 'token')
  const bloqueo = Promise.withResolvers<void>()
  b.bloquearGet = bloqueo.promise
  b.suscribir()
  await hasta(() => b.consultas === 1, 'La lectura inicial debe estar pendiente')
  b.cliente.renovarConexion()
  await hasta(() => b.consultas === 2, 'La renovación debe reemplazar el intento y pedir snapshot')
  assert.equal(b.estados.includes('conectado'), false)
  bloqueo.resolve()
  await hasta(() => b.estados.at(-1) === 'conectado', 'Solo la lectura vigente debe habilitar acciones')
  assert.equal(b.estados.filter(estado => estado === 'conectado').length, 1)
  assert.equal(b.io.sockets.sockets.size, 1)
})

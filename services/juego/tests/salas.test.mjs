import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { io } from 'socket.io-client';
import { crearServidor } from '../servidor.mjs';
import { crearAutenticador } from '../auth.mjs';
import { crearPersistencia } from '../persistencia.mjs';
import { crearSalas } from '../salas.mjs';

const datosMazo = { mazoNombre: 'Mazo privado', mazo: { secreto: 'no-publicar' } };
function proveedorPrueba() {
  let ejecuciones = 0;
  return { version: 'motor-prueba', get ejecuciones() { return ejecuciones; },
    async validarMazo(mazo) { return mazo?.secreto ? [] : [{ codigo: 'MAZO_INVALIDO', mensaje: 'Mazo inválido.' }]; },
    async crearPartida({ jugadores, alCambiar }) {
      let resultado = null;
      return {
        vista(id) { return { jugador: id, mano: [`carta-privada-${id}`], rival: { cantidadMano: 1 }, ejecuciones }; },
        async ejecutar(id, comando) {
          if (!['concede', 'pasar'].includes(comando.nombre)) { const error = new Error('Inválido'); error.codigo = 'COMANDO_NO_PERMITIDO'; throw error; }
          ejecuciones += 1;
          if (comando.nombre === 'concede') resultado = { ganadorId: jugadores.find((j) => j.id !== id).id, motivo: 'concesion' };
          alCambiar();
        },
        resultado() { return resultado; }, cerrar() {},
      };
    },
  };
}
async function banco(t, opciones = {}) {
  const directorio = await mkdtemp(join(tmpdir(), 'holocron-salas-'));
  const proveedor = proveedorPrueba();
  const entorno = { NODE_ENV: 'test', JUEGO_DEV_AUTH: '1' };
  const rutaDatos = join(directorio, 'salas.sqlite');
  const servicio = await crearServidor({ entorno, puerto: 0, proveedor, rutaDatos, ...opciones });
  t.after(async () => { await servicio.cerrar(); await rm(directorio, { recursive: true, force: true }); });
  async function pedir(ruta, usuario = 'alpha', body, metodo) {
    const respuesta = await fetch(`${servicio.url}${ruta}`, { method: metodo ?? (body === undefined ? 'GET' : 'POST'), headers: { Authorization: `Bearer dev:${usuario}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: respuesta.status, ...await respuesta.json() };
  }
  async function iniciar() {
    const creada = await pedir('/api/salas', 'alpha', datosMazo);
    const ruta = `/api/salas/${creada.sala.codigo}`;
    assert.equal((await pedir(`${ruta}/unirse`, 'beta', datosMazo)).status, 200);
    await pedir(`${ruta}/preparado`, 'alpha', { preparado: true });
    const jugando = await pedir(`${ruta}/preparado`, 'beta', { preparado: true });
    return { ruta, sala: jugando.sala };
  }
  return { ...servicio, pedir, iniciar, proveedor, rutaDatos, entorno };
}
async function conectar(url, codigo, usuario) {
  const socket = io(url, { path: '/ws', transports: ['websocket'], auth: { token: `dev:${usuario}`, codigo }, forceNew: true, reconnection: false });
  await new Promise((resolve, reject) => { socket.once('sala', resolve); socket.once('connect_error', reject); });
  return socket;
}

test('autenticación local se prohíbe en producción y fuera de loopback', () => {
  assert.throws(() => crearAutenticador({ entorno: { NODE_ENV: 'production', JUEGO_DEV_AUTH: '1' } }), /producción/);
  assert.throws(() => crearAutenticador({ entorno: { JUEGO_DEV_AUTH: '1' }, host: '0.0.0.0' }), /loopback/);
});
test('Supabase valida token contra Auth y obtiene nombre del perfil servidor', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const rutas = [];
  const autenticar = crearAutenticador({ entorno: { SUPABASE_URL: 'https://supabase.invalid', SUPABASE_ANON_KEY: 'clave-publica-prueba' }, solicitar: async (url, opciones) => {
    rutas.push(url); assert.equal(opciones.headers.Authorization, 'Bearer token-prueba');
    return new Response(JSON.stringify(url.endsWith('/user') ? { id, user_metadata: { name: 'NO USAR' } } : [{ id, name: 'Perfil verificado' }]), { status: 200 });
  } });
  assert.deepEqual(await autenticar('token-prueba'), { id, nombre: 'Perfil verificado' });
  assert.equal(rutas.length, 2);
  const invalido = crearAutenticador({ entorno: { SUPABASE_URL: 'https://supabase.invalid', SUPABASE_ANON_KEY: 'prueba' }, solicitar: async () => new Response('{}', { status: 401 }) });
  await assert.rejects(invalido('token-falso'), { codigo: 'SESION_INVALIDA' });
});
test('token inválido, identidad inyectada y mazo inválido son rechazados', async (t) => {
  const b = await banco(t);
  assert.equal((await b.pedir('/api/salas', 'invalido', datosMazo)).status, 401);
  assert.equal((await b.pedir('/api/salas', 'alpha', { ...datosMazo, id: 'dev-beta' })).status, 400);
  assert.equal((await b.pedir('/api/salas', 'alpha', { mazoNombre: 'Inválido', mazo: {} })).status, 422);
  assert.equal((await b.pedir('/api/usuario')).usuario.id, 'dev-alpha');
});
test('sin motor no admite una sala ficticia', async (t) => {
  const b = await banco(t, { proveedor: undefined });
  assert.equal((await b.pedir('/api/configuracion')).disponible, false);
  assert.equal((await b.pedir('/api/salas', 'alpha', datosMazo)).status, 503);
});
test('unión simultánea admite exactamente dos asientos y tercero no puede leer', async (t) => {
  const b = await banco(t);
  const creada = await b.pedir('/api/salas', 'alpha', datosMazo);
  const ruta = `/api/salas/${creada.sala.codigo}`;
  const respuestas = await Promise.all(['beta', 'gamma'].map((id) => b.pedir(`${ruta}/unirse`, id, datosMazo)));
  assert.deepEqual(respuestas.map((r) => r.status).sort(), [200, 409]);
  const tercero = respuestas[0].status === 409 ? 'beta' : 'gamma';
  assert.equal((await b.pedir(ruta, tercero)).status, 403);
  await assert.rejects(conectar(b.url, creada.sala.codigo, tercero), /privada/);
  assert.equal(JSON.stringify(respuestas).includes('no-publicar'), false);
});
test('cuenta única entre salas y recuperación de creación con respuesta perdida', async (t) => {
  const b = await banco(t);
  const creadas = await Promise.all([b.pedir('/api/salas', 'alpha', datosMazo), b.pedir('/api/salas', 'alpha', datosMazo)]);
  assert.deepEqual(creadas.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await b.pedir('/api/salas/mia')).sala.codigo, creadas.find((r) => r.status === 201).sala.codigo);
});
test('comandos serializados, deduplicación, payload inmutable y revisión obsoleta', async (t) => {
  const b = await banco(t); const { ruta, sala } = await b.iniciar();
  const accion = { id: randomUUID(), revision: sala.revision, comando: { nombre: 'pasar', args: [] } };
  const respuestas = await Promise.all([b.pedir(`${ruta}/acciones`, 'alpha', accion), b.pedir(`${ruta}/acciones`, 'alpha', accion)]);
  assert.equal(respuestas[0].status, 200);
  assert.deepEqual(respuestas[0], respuestas[1]);
  assert.equal(b.proveedor.ejecuciones, 1);
  assert.equal((await b.pedir(ruta)).sala.revision, respuestas[0].sala.revision);
  assert.equal((await b.pedir(`${ruta}/acciones`, 'alpha', { ...accion, comando: { nombre: 'concede', args: [] } })).error.codigo, 'ID_REUTILIZADO');
  const vieja = await b.pedir(`${ruta}/acciones`, 'alpha', { ...accion, id: randomUUID() });
  assert.equal(vieja.error.codigo, 'REVISION_OBSOLETA');
  assert.equal(vieja.error.detalles.sala.juego.jugador, 'dev-alpha');
  assert.equal((await b.pedir(`${ruta}/mazo`, 'alpha', datosMazo)).status, 409);
  assert.equal((await b.pedir(`${ruta}/salir`, 'alpha', {})).status, 409);
  assert.equal((await b.pedir(`${ruta}/acciones`, 'gamma', accion)).status, 403);
});
test('mano privada y reconexión conservan asiento sin adjudicar derrota', async (t) => {
  const b = await banco(t); const { ruta, sala } = await b.iniciar();
  const a = await conectar(b.url, sala.codigo, 'alpha');
  const otro = await conectar(b.url, sala.codigo, 'alpha');
  t.after(() => { a.close(); otro.close(); });
  assert.equal((await b.pedir(ruta, 'alpha')).sala.juego.mano[0], 'carta-privada-dev-alpha');
  assert.equal(JSON.stringify((await b.pedir(ruta, 'beta')).sala).includes('carta-privada-dev-alpha'), false);
  a.close();
  const leida = await b.pedir(ruta);
  assert.equal(leida.sala.estado, 'jugando'); assert.equal(leida.sala.resultado, null);
  const reconexion = await b.pedir(`${ruta}/unirse`, 'alpha', datosMazo);
  assert.equal(reconexion.sala.jugadores.length, 2);
  assert.equal(reconexion.sala.jugadores[0].conectado, true);
});
test('resultado idempotente y reinicio preservan ganador sin persistir manos/mazos', async (t) => {
  const b = await banco(t); const { ruta, sala } = await b.iniciar();
  const accion = { id: randomUUID(), revision: sala.revision, comando: { nombre: 'concede', args: [] } };
  const fin = await b.pedir(`${ruta}/acciones`, 'alpha', accion);
  assert.equal(fin.sala.estado, 'finalizada'); assert.equal(fin.sala.resultado.ganadorId, 'dev-beta');
  assert.deepEqual(await b.pedir(`${ruta}/acciones`, 'alpha', accion), fin);
  await b.cerrar();
  const siguiente = await crearServidor({ entorno: b.entorno, puerto: 0, proveedor: b.proveedor, rutaDatos: b.rutaDatos });
  t.after(() => siguiente.cerrar());
  const recargada = await siguiente.salas.leer(sala.codigo, 'dev-alpha');
  assert.deepEqual(recargada.sala.resultado, fin.sala.resultado);
  const bytes = await readFile(b.rutaDatos);
  assert.equal(bytes.includes(Buffer.from('no-publicar')), false);
  assert.equal(bytes.includes(Buffer.from('carta-privada-')), false);
});
test('reinicio interrumpe partidas activas sin ganador y libera cuenta', async (t) => {
  const b = await banco(t); const { sala } = await b.iniciar();
  await b.cerrar();
  const siguiente = await crearServidor({ entorno: b.entorno, puerto: 0, proveedor: b.proveedor, rutaDatos: b.rutaDatos });
  t.after(() => siguiente.cerrar());
  const recuperada = await siguiente.salas.leer(sala.codigo, 'dev-alpha');
  assert.equal(recuperada.sala.estado, 'interrumpida'); assert.equal(recuperada.sala.resultado, null);
  assert.equal((await siguiente.salas.mia('dev-alpha')).sala, null);
});
test('recuperación tras caída abrupta marca metadatos activos interrumpidos', async () => {
  const persistencia = crearPersistencia(':memory:');
  persistencia.guardar({ codigo: 'ABCD234567', estado: 'jugando', revision: 8, jugadores: [{ id: 'dev-alpha', nombre: 'Alfa' }], resultado: null, actualizado: Date.now() });
  const salas = crearSalas({ persistencia, proveedor: proveedorPrueba() });
  assert.equal((await salas.leer('ABCD234567', 'dev-alpha')).sala.estado, 'interrumpida');
  await salas.cerrar();
});
test('salas vacías/inactivas expiran y liberan cuentas', async () => {
  let ahora = 100;
  const salas = crearSalas({ persistencia: crearPersistencia(':memory:'), proveedor: proveedorPrueba(), ahora: () => ahora, expiracionMs: 1000 });
  const creada = await salas.crear({ id: 'dev-alpha', nombre: 'Alfa' }, datosMazo);
  ahora += 1001; await salas.depurar();
  await assert.rejects(salas.leer(creada.sala.codigo, 'dev-alpha'), { codigo: 'SALA_NO_EXISTE' });
  await salas.cerrar();
});
test('límite de solicitudes y origen no autorizado', async (t) => {
  const b = await banco(t, { limiteSolicitudes: 2 });
  await b.pedir('/api/usuario'); await b.pedir('/api/usuario');
  assert.equal((await b.pedir('/api/usuario')).status, 429);
  const respuesta = await fetch(`${b.url}/health`, { headers: { Origin: 'https://ajeno.invalid' } });
  assert.equal(respuesta.status, 403);
});
test('comandos malformados y rechazados no ejecutan', async (t) => {
  const b = await banco(t); const { ruta, sala } = await b.iniciar();
  assert.equal((await b.pedir(`${ruta}/acciones`, 'alpha', { id: 'no-uuid', revision: sala.revision, comando: { nombre: 'concede', args: [] } })).status, 400);
  const accion = { id: randomUUID(), revision: sala.revision, comando: { nombre: 'identidadForjada', args: [] } };
  const fallo = await b.pedir(`${ruta}/acciones`, 'alpha', accion);
  assert.equal(fallo.error.codigo, 'COMANDO_NO_PERMITIDO');
  assert.deepEqual(await b.pedir(`${ruta}/acciones`, 'alpha', accion), fallo);
  assert.equal(b.proveedor.ejecuciones, 0);
});

test('fallo del motor interrumpe y jamás produce un ganador', async (t) => {
  const proveedor = proveedorPrueba();
  proveedor.crearPartida = async ({ alFallar }) => ({ vista() { return {}; }, resultado() { return null; }, cerrar() {}, ejecutar() { alFallar(new Error('Fallo deliberado')); throw new Error('Fallo deliberado'); } });
  const b = await banco(t, { proveedor }); const { ruta, sala } = await b.iniciar();
  await b.pedir(`${ruta}/acciones`, 'alpha', { id: randomUUID(), revision: sala.revision, comando: { nombre: 'pasar', args: [] } });
  const estado = (await b.pedir(ruta)).sala;
  assert.equal(estado.estado, 'interrumpida'); assert.equal(estado.resultado, null);
});
test('Socket.IO entrega exclusivamente la vista de la identidad autenticada', async (t) => {
  const b = await banco(t); const { sala } = await b.iniciar();
  const socket = io(b.url, { path: '/ws', transports: ['websocket'], auth: { token: 'dev:beta', codigo: sala.codigo }, reconnection: false });
  t.after(() => socket.close());
  const respuesta = await new Promise((resolve, reject) => { socket.once('sala', resolve); socket.once('connect_error', reject); });
  assert.equal(respuesta.sala.juego.jugador, 'dev-beta');
  assert.equal(JSON.stringify(respuesta).includes('carta-privada-dev-alpha'), false);
  assert.equal(JSON.stringify(respuesta).includes('no-publicar'), false);
});
test('dos comandos distintos con la misma revisión ejecutan solo uno', async (t) => {
  const b = await banco(t); const { ruta, sala } = await b.iniciar();
  const respuestas = await Promise.all(['alpha', 'beta'].map((id) => b.pedir(`${ruta}/acciones`, id, { id: randomUUID(), revision: sala.revision, comando: { nombre: 'pasar', args: [] } })));
  assert.deepEqual(respuestas.map((r) => r.status).sort(), [200, 409]);
  assert.equal(b.proveedor.ejecuciones, 1);
});


test('integración HTTP y Socket.IO con Forceteki real preparado', { skip: !existsSync(new URL('../.motor/preparado.json', import.meta.url)) && 'Ejecutá npm run preparar-motor para habilitar integración real.' }, async (t) => {
  const { crearProveedorMotor } = await import('../motor.mjs');
  const { mazosEjemplo } = await import('../fixtures/mazos.mjs');
  const proveedor = await crearProveedorMotor();
  const b = await banco(t, { proveedor, mazosEjemplo });
  const ejemplos = await b.pedir('/api/mazos-ejemplo');
  assert.ok(ejemplos.mazos.length >= 2);
  const creada = await b.pedir('/api/salas', 'alpha', { mazoNombre: mazosEjemplo[0].nombre, mazo: mazosEjemplo[0].mazo });
  assert.equal(creada.status, 201, JSON.stringify(creada));
  const ruta = `/api/salas/${creada.sala.codigo}`;
  assert.equal((await b.pedir(`${ruta}/unirse`, 'beta', { mazoNombre: mazosEjemplo[1].nombre, mazo: mazosEjemplo[1].mazo })).status, 200);
  await b.pedir(`${ruta}/preparado`, 'alpha', { preparado: true });
  const inicio = await b.pedir(`${ruta}/preparado`, 'beta', { preparado: true });
  assert.equal(inicio.sala.estado, 'jugando', JSON.stringify(inicio));
  const a = await b.pedir(ruta, 'alpha');
  const beta = await b.pedir(ruta, 'beta');
  assert.notDeepEqual(a.sala.juego, beta.sala.juego);
  const socket = await conectar(b.url, creada.sala.codigo, 'alpha');
  t.after(() => socket.close());
  const accion = { id: randomUUID(), revision: a.sala.revision, comando: { nombre: 'concede', args: [] } };
  const fin = await b.pedir(`${ruta}/acciones`, 'alpha', accion);
  assert.equal(fin.sala.estado, 'finalizada', JSON.stringify(fin));
  assert.equal(fin.sala.resultado.ganadorId, 'dev-beta');
  assert.deepEqual(await b.pedir(`${ruta}/acciones`, 'alpha', accion), fin);
});

test('UUID de revisión obsoleta tampoco permite sustituir el payload', async (t) => {
  const b = await banco(t); const { ruta, sala } = await b.iniciar();
  const accion = { id: randomUUID(), revision: sala.revision - 1, comando: { nombre: 'pasar', args: [] } };
  assert.equal((await b.pedir(`${ruta}/acciones`, 'alpha', accion)).error.codigo, 'REVISION_OBSOLETA');
  assert.equal((await b.pedir(`${ruta}/acciones`, 'alpha', { ...accion, revision: sala.revision })).error.codigo, 'ID_REUTILIZADO');
});
test('JSON excesivo devuelve un error estructurado', async (t) => {
  const b = await banco(t);
  assert.equal((await b.pedir('/api/salas', 'alpha', { ...datosMazo, mazoNombre: 'x'.repeat(70_000) })).status, 413);
});

test('doce handshakes durante inicio real de Forceteki admiten máximo cinco', { skip: !existsSync(new URL('../.motor/preparado.json', import.meta.url)) && 'Requiere motor preparado.' }, async (t) => {
  const { crearProveedorMotor } = await import('../motor.mjs');
  const { mazosEjemplo } = await import('../fixtures/mazos.mjs');
  const b = await banco(t, { proveedor: await crearProveedorMotor() });
  const datos = (i) => ({ mazoNombre: mazosEjemplo[i].nombre, mazo: mazosEjemplo[i].mazo });
  const codigo = (await b.salas.crear({ id: 'dev-alpha', nombre: 'Alfa' }, datos(0))).sala.codigo;
  await b.salas.unirse(codigo, { id: 'dev-beta', nombre: 'Beta' }, datos(1));
  await b.salas.preparar(codigo, 'dev-alpha', { preparado: true });
  const inicio = b.salas.preparar(codigo, 'dev-beta', { preparado: true });
  const sockets = Array.from({ length: 12 }, () => io(b.url, { path: '/ws', transports: ['websocket'], auth: { token: 'dev:alpha', codigo }, forceNew: true, reconnection: false }));
  t.after(() => sockets.forEach((socket) => socket.close()));
  const resultados = await Promise.all(sockets.map((socket) => new Promise((resolve) => {
    socket.once('connect', () => resolve('aceptado'));
    socket.once('connect_error', (error) => resolve(error.data.error.codigo));
  })));
  await inicio;
  assert.equal(resultados.filter((resultado) => resultado === 'aceptado').length, 5);
  assert.equal(resultados.filter((resultado) => resultado === 'CONEXIONES_EXCESIVAS').length, 7);
  assert.equal(b.io.sockets.sockets.size, 5);
  // Desconectar libera el cupo inmediatamente; la otra identidad tiene cupos independientes.
  const admitido = [...b.io.sockets.sockets.values()][0];
  admitido.disconnect(true);
  const reemplazo = await conectar(b.url, codigo, 'alpha');
  const beta = await conectar(b.url, codigo, 'beta');
  t.after(() => { reemplazo.close(); beta.close(); });
  assert.equal(b.io.sockets.sockets.size, 6);
});

test('rechazo de sala privada libera la reserva para próximos handshakes', async (t) => {
  const b = await banco(t);
  const codigo = (await b.pedir('/api/salas', 'alpha', datosMazo)).sala.codigo;
  for (let intento = 0; intento < 7; intento += 1) await assert.rejects(conectar(b.url, codigo, 'beta'), /privada/);
  await b.pedir(`/api/salas/${codigo}/unirse`, 'beta', datosMazo);
  const socket = await conectar(b.url, codigo, 'beta');
  t.after(() => socket.close());
  assert.equal(socket.connected, true);
});

test('abortar transporte con admisión pendiente libera el cupo antes de resolver la cola', async (t) => {
  const b = await banco(t);
  const codigo = (await b.pedir('/api/salas', 'alpha', datosMazo)).sala.codigo;
  const leerOriginal = b.salas.leer;
  const entraron = Promise.withResolvers();
  const desbloquear = Promise.withResolvers();
  let pendientes = 0;
  b.salas.leer = async (...args) => {
    pendientes += 1;
    if (pendientes === 5) entraron.resolve();
    await desbloquear.promise;
    return leerOriginal(...args);
  };
  const sockets = Array.from({ length: 5 }, () => io(b.url, { path: '/ws', transports: ['websocket'], auth: { token: 'dev:alpha', codigo }, forceNew: true, reconnection: false }));
  t.after(() => { desbloquear.resolve(); sockets.forEach((socket) => socket.close()); });
  await entraron.promise;
  // Los cinco siguen en middleware y aún no figuran como sockets admitidos.
  assert.equal(b.io.sockets.sockets.size, 0);
  await assert.rejects(conectar(b.url, codigo, 'alpha'), /otra pestaña/);
  const transportes = Object.values(b.io.engine.clients);
  const cerrados = transportes.map((transporte) => new Promise((resolve) => transporte.once('close', resolve)));
  for (const socket of sockets) socket.close();
  await Promise.all(cerrados);
  b.salas.leer = leerOriginal;
  const reemplazo = await conectar(b.url, codigo, 'alpha');
  t.after(() => reemplazo.close());
  assert.equal(reemplazo.connected, true);
  desbloquear.resolve();
});

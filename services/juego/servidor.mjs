import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Server } from 'socket.io';
import { crearAutenticador, extraerToken } from './auth.mjs';
import { crearPersistencia } from './persistencia.mjs';
import { crearSalas } from './salas.mjs';
import { ErrorJuego, exigir } from './errores.mjs';

function crearLimitador(maximo, ventana = 60_000) {
  const contadores = new Map();
  return (clave) => {
    const ahora = Date.now();
    if (contadores.size > 10_000) for (const [id, contador] of contadores) if (ahora > contador.hasta) contadores.delete(id);
    let contador = contadores.get(clave);
    if (!contador || ahora > contador.hasta) { contador = { total: 0, hasta: ahora + ventana }; contadores.set(clave, contador); }
    exigir(++contador.total <= maximo && contadores.size <= 20_000, 429, 'DEMASIADAS_SOLICITUDES', 'Esperá un momento antes de volver a intentar.');
  };
}
async function leerCuerpo(req) {
  exigir(req.headers['content-type']?.split(';')[0] === 'application/json', 415, 'JSON_REQUERIDO', 'Enviá application/json.');
  const contenido = await new Promise((aceptar, rechazar) => {
    let tamano = 0;
    const partes = [];
    req.on('data', (parte) => {
      tamano += parte.length;
      if (tamano > 64 * 1024) { rechazar(new ErrorJuego(413, 'CUERPO_GRANDE', 'La solicitud es demasiado grande.')); return; }
      partes.push(parte);
    });
    req.on('end', () => aceptar(Buffer.concat(partes).toString('utf8')));
    req.on('error', rechazar);
    req.on('aborted', () => rechazar(new ErrorJuego(400, 'PETICION_ABORTADA', 'La solicitud fue cancelada.')));
  });
  try { return JSON.parse(contenido); }
  catch { throw new ErrorJuego(400, 'JSON_INVALIDO', 'La solicitud no es JSON válido.'); }
}
function errorPublico(error) {
  if (!(error instanceof ErrorJuego)) return { error: { codigo: 'ERROR_INTERNO', mensaje: 'No se pudo completar la solicitud.' } };
  return { error: { codigo: error.codigo, mensaje: error.message, ...(error.detalles ? { detalles: error.detalles } : {}) } };
}
export async function crearServidor({ entorno = process.env, host = entorno.JUEGO_HOST ?? '127.0.0.1', puerto = Number(entorno.JUEGO_PORT ?? 3001), proveedor, autenticar, rutaDatos = entorno.JUEGO_DATOS ?? resolve(import.meta.dirname, '.datos/salas.sqlite'), mazosEjemplo, limiteSolicitudes = 240, expiracionMs } = {}) {
  const desarrollo = entorno.JUEGO_DEV_AUTH === '1';
  const auth = autenticar ?? crearAutenticador({ entorno, host });
  // También verificar bind si se inyecta autenticación en pruebas.
  exigir(!desarrollo || (entorno.NODE_ENV !== 'production' && ['127.0.0.1', '::1'].includes(host)), 500, 'DEV_INSEGURO', 'El modo local exige loopback y no puede usarse en producción.');
  const origenes = (entorno.JUEGO_ORIGENES ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((o) => o.trim()).filter(Boolean);
  const limitarIP = crearLimitador(limiteSolicitudes * 2);
  const limitarUsuario = crearLimitador(limiteSolicitudes);
  const persistencia = crearPersistencia(rutaDatos);
  let apagando = false;
  let io;
  const reservasConexiones = new Map();
  const salas = crearSalas({ proveedor, persistencia, expiracionMs, alCambiar(codigo) {
    if (!io) return;
    for (const socket of io.sockets.sockets.values()) if (socket.data.codigo === codigo) {
      void salas.leer(codigo, socket.data.usuario.id).then((respuesta) => { if (socket.connected) socket.emit('sala', respuesta); }).catch(() => socket.disconnect(true));
    }
  } });
  function enviar(res, status, cuerpo) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(cuerpo));
  }
  const http = createServer(async (req, res) => {
    try {
      const origen = req.headers.origin;
      exigir(!origen || origenes.includes(origen), 403, 'ORIGEN_NO_PERMITIDO', 'Origen no permitido.');
      if (origen) { res.setHeader('Access-Control-Allow-Origin', origen); res.setHeader('Vary', 'Origin'); }
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      limitarIP(req.socket.remoteAddress ?? 'sin-ip');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
      const ruta = new URL(req.url, 'http://servicio.local').pathname;
      if (req.method === 'GET' && ruta === '/health') return enviar(res, apagando ? 503 : 200, { estado: apagando ? 'apagando' : 'ok', motorDisponible: Boolean(proveedor) });
      exigir(!apagando, 503, 'SERVICIO_CERRANDO', 'El servicio se está apagando.');
      if (req.method === 'GET' && ruta === '/api/configuracion') return enviar(res, 200, { disponible: Boolean(proveedor), versionMotor: proveedor?.version ?? null, formato: 'premier', modo: 'bo1', desarrollo });
      if (ruta === '/api/mazos-ejemplo' && !desarrollo) throw new ErrorJuego(404, 'RUTA_NO_EXISTE', 'La ruta no existe.');
      const usuario = await auth(extraerToken(req.headers.authorization));
      limitarUsuario(usuario.id);
      if (req.method === 'GET' && ruta === '/api/usuario') return enviar(res, 200, { usuario, salaActiva: (await salas.mia(usuario.id)).sala });
      if (req.method === 'GET' && ruta === '/api/mazos-ejemplo') return enviar(res, 200, { mazos: mazosEjemplo ?? [] });
      if (req.method === 'GET' && ruta === '/api/salas/mia') return enviar(res, 200, await salas.mia(usuario.id));
      if (req.method === 'POST' && ruta === '/api/salas') return enviar(res, 201, await salas.crear(usuario, await leerCuerpo(req)));
      const coincidencia = /^\/api\/salas\/([A-Z2-9]{10})(?:\/(unirse|mazo|preparado|salir|acciones))?$/.exec(ruta);
      exigir(coincidencia, 404, 'RUTA_NO_EXISTE', 'La ruta no existe.');
      const [, codigo, operacion] = coincidencia;
      if (req.method === 'GET' && !operacion) return enviar(res, 200, await salas.leer(codigo, usuario.id));
      exigir(req.method === 'POST' && operacion, 405, 'METODO_NO_PERMITIDO', 'Método no permitido.');
      const datos = await leerCuerpo(req);
      let respuesta;
      if (operacion === 'unirse') respuesta = await salas.unirse(codigo, usuario, datos);
      if (operacion === 'mazo') respuesta = await salas.cambiarMazo(codigo, usuario.id, datos);
      if (operacion === 'preparado') respuesta = await salas.preparar(codigo, usuario.id, datos);
      if (operacion === 'salir') respuesta = await salas.salir(codigo, usuario.id);
      if (operacion === 'acciones') respuesta = await salas.accion(codigo, usuario.id, datos);
      enviar(res, 200, respuesta);
    } catch (error) { if (!res.headersSent && !res.destroyed) enviar(res, error instanceof ErrorJuego ? error.status : 500, errorPublico(error)); }
  });
  http.requestTimeout = 15_000;
  http.headersTimeout = 10_000;
  io = new Server(http, { path: '/ws', maxHttpBufferSize: 64 * 1024, cors: { origin: origenes }, allowRequest(req, aceptar) {
    try { exigir(!apagando && (!req.headers.origin || origenes.includes(req.headers.origin)), 403, 'ORIGEN_NO_PERMITIDO', 'Origen no permitido.'); limitarIP(req.socket.remoteAddress ?? 'sin-ip'); aceptar(null, true); }
    catch { aceptar('Acceso rechazado', false); }
  } });
  io.use(async (socket, siguiente) => {
    let liberarReserva = () => {};
    try {
      exigir(!apagando, 503, 'SERVICIO_CERRANDO', 'El servicio se está apagando.');
      const { token, codigo } = socket.handshake.auth;
      const usuario = await auth(token); limitarUsuario(usuario.id);
      exigir(socket.conn.readyState === 'open', 400, 'CONEXION_CERRADA', 'La conexión fue cerrada.');
      const reservas = reservasConexiones.get(usuario.id) ?? new Set();
      exigir(reservas.size < 5, 429, 'CONEXIONES_EXCESIVAS', 'Cerrá otra pestaña de juego.');
      // Comprobar y reservar sin await: incluye handshakes detenidos en la cola de salas.
      reservas.add(socket.id); reservasConexiones.set(usuario.id, reservas);
      liberarReserva = () => {
        reservas.delete(socket.id);
        if (reservas.size === 0 && reservasConexiones.get(usuario.id) === reservas) reservasConexiones.delete(usuario.id);
        socket.conn.off('close', liberarReserva);
        socket.off('disconnect', liberarReserva);
      };
      // Antes de admitir el namespace solo se emite close en el transporte.
      socket.conn.once('close', liberarReserva);
      socket.once('disconnect', liberarReserva);
      await salas.leer(codigo, usuario.id);
      exigir(!apagando && socket.conn.readyState === 'open', 400, 'CONEXION_CERRADA', 'La conexión fue cerrada.');
      socket.data = { usuario, codigo, token }; siguiente();
    } catch (error) { liberarReserva(); const rechazo = new Error(errorPublico(error).error.mensaje); rechazo.data = errorPublico(error); siguiente(rechazo); }
  });
  io.on('connection', (socket) => {
    const { usuario, codigo } = socket.data;
    // Renovar/revalidar sesión exige reconnect con token actual; no mantener JWT vencidos indefinidamente.
    const revalidar = setInterval(() => { void auth(socket.data.token).then((actual) => { if (actual.id !== usuario.id) socket.disconnect(true); }).catch(() => socket.disconnect(true)); }, 60_000);
    revalidar.unref();
    socket.on('disconnect', () => { clearInterval(revalidar); void salas.desconectar(codigo, usuario.id, socket.id); });
    void salas.conectar(codigo, usuario.id, socket.id).then((respuesta) => { if (socket.connected) socket.emit('sala', respuesta); else void salas.desconectar(codigo, usuario.id, socket.id); }).catch(() => socket.disconnect(true));
  });
  const limpieza = setInterval(() => { void salas.depurar(); }, 60_000); limpieza.unref();
  await new Promise((aceptar, rechazar) => { http.once('error', rechazar); http.listen(puerto, host, () => { http.off('error', rechazar); aceptar(); }); });
  const direccion = http.address();
  return { http, io, salas, url: `http://${host === '::1' ? '[::1]' : host}:${direccion.port}`,
    async cerrar() {
      if (apagando) return;
      apagando = true; clearInterval(limpieza);
      await new Promise((aceptar) => io.close(aceptar));
      await salas.cerrar();
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let proveedor;
  let mazosEjemplo;
  try { const { crearProveedorMotor } = await import('./motor.mjs'); proveedor = await crearProveedorMotor(); }
  catch (error) { console.error('Motor no disponible. Ejecutá npm run preparar-motor.', error instanceof Error ? error.message : 'Error de preparación'); }
  if (process.env.JUEGO_DEV_AUTH === '1' && proveedor) {
    try { const fixtures = await import('./fixtures/mazos.mjs'); mazosEjemplo = fixtures.mazosEjemplo; }
    catch { console.warn('No se cargaron mazos de ejemplo.'); }
  }
  const servicio = await crearServidor({ proveedor, mazosEjemplo });
  console.info(`Servicio de juego escuchando en ${servicio.url}`);
  for (const senal of ['SIGINT', 'SIGTERM']) process.once(senal, () => { void servicio.cerrar().then(() => { process.exitCode = 0; }).catch(() => { process.exitCode = 1; }); });
}

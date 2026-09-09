import { randomBytes, randomUUID } from 'node:crypto';
import { ErrorJuego, exigir, clavesExactas } from './errores.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clonar = (valor) => structuredClone(valor);
function congelar(valor) {
  if (valor && typeof valor === 'object') { Object.freeze(valor); for (const hijo of Object.values(valor)) congelar(hijo); }
  return valor;
}
function canonico(valor) {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`;
  if (valor && typeof valor === 'object') return `{${Object.keys(valor).sort().map((clave) => `${JSON.stringify(clave)}:${canonico(valor[clave])}`).join(',')}}`;
  return JSON.stringify(valor);
}

export function crearSalas({ proveedor, persistencia, alCambiar = () => {}, ahora = Date.now, expiracionMs = 30 * 60_000 }) {
  const salas = new Map();
  // Un único proceso: esta cola también protege el índice de cuentas entre salas.
  let cola = Promise.resolve();
  let cerrando = false;
  function serial(tarea) {
    const siguiente = cola.then(tarea);
    cola = siguiente.catch(() => {});
    return siguiente;
  }
  for (const registro of persistencia.cargar()) {
    if (registro.estado === 'jugando' || registro.estado === 'espera') {
      registro.estado = 'interrumpida'; registro.resultado = null; registro.revision += 1;
      persistencia.guardar(registro);
    }
    salas.set(registro.codigo, { ...registro, motor: null, recibos: new Map(), conexiones: new Map() });
  }
  function obtener(codigo) {
    exigir(typeof codigo === 'string' && /^[A-Z2-9]{10}$/.test(codigo), 404, 'SALA_NO_EXISTE', 'La sala no existe.');
    const sala = salas.get(codigo);
    exigir(sala, 404, 'SALA_NO_EXISTE', 'La sala no existe.');
    return sala;
  }
  function asiento(sala, usuarioId) {
    const jugador = sala.jugadores.find((j) => j.id === usuarioId);
    exigir(jugador, 403, 'SALA_PRIVADA', 'Esta sala es privada.');
    return jugador;
  }
  function vista(sala, usuarioId) {
    asiento(sala, usuarioId);
    const estado = { codigo: sala.codigo, estado: sala.estado, revision: sala.revision,
      jugadores: sala.jugadores.map(({ id, nombre, preparado, mazoNombre }) => ({ id, nombre, preparado, mazoNombre, conectado: (sala.conexiones.get(id)?.size ?? 0) > 0 })),
      resultado: sala.resultado };
    if (sala.motor) estado.juego = sala.motor.vista(usuarioId);
    else if (sala.vistasFinales?.has(usuarioId)) estado.juego = sala.vistasFinales.get(usuarioId);
    return clonar({ sala: estado });
  }
  function publicar(sala, incrementar = true) {
    if (incrementar) sala.revision += 1;
    sala.actualizado = ahora();
    persistencia.guardar(sala);
    alCambiar(sala.codigo);
  }
  function interrumpir(sala) {
    if (sala.estado === 'jugando') {
      sala.estado = 'interrumpida'; sala.resultado = null;
      sala.motor?.cerrar(); sala.motor = null;
      publicar(sala);
    }
  }
  function finalizar(sala) {
    const resultado = sala.motor?.resultado();
    if (!resultado || sala.estado !== 'jugando') return;
    exigir(resultado.ganadorId === null || sala.jugadores.some((j) => j.id === resultado.ganadorId), 500, 'RESULTADO_INVALIDO', 'El motor devolvió un resultado inválido.');
    sala.resultado = clonar(resultado); sala.estado = 'finalizada';
    sala.vistasFinales = new Map();
    for (const jugador of sala.jugadores) {
      try { sala.vistasFinales.set(jugador.id, clonar(sala.motor.vista(jugador.id))); } catch { /* El resultado confirmado no depende de una última vista. */ }
    }
    sala.motor.cerrar(); sala.motor = null;
  }
  function libre(usuarioId, excepto) {
    exigir(![...salas.values()].some((s) => s.codigo !== excepto && ['espera', 'jugando'].includes(s.estado) && s.jugadores.some((j) => j.id === usuarioId)), 409, 'CUENTA_OCUPADA', 'Ya tenés una sala activa.');
  }
  async function mazoValidado(datos) {
    exigir(proveedor, 503, 'MOTOR_NO_DISPONIBLE', 'El motor de juego todavía no está preparado.');
    exigir(clavesExactas(datos, ['mazo', 'mazoNombre']) && typeof datos.mazoNombre === 'string' && datos.mazoNombre.trim().length > 0 && datos.mazoNombre.length <= 100, 400, 'MAZO_INVALIDO', 'Ingresá un mazo y un nombre de hasta 100 caracteres.');
    const mazo = clonar(datos.mazo);
    const errores = await proveedor.validarMazo(mazo);
    if (errores.length) throw new ErrorJuego(422, 'MAZO_INVALIDO', errores.map((e) => e.mensaje).join(' '), errores);
    return { mazo: congelar(mazo), mazoNombre: datos.mazoNombre.trim() };
  }
  function disponible() { exigir(!cerrando, 503, 'SERVICIO_CERRANDO', 'El servicio se está apagando.'); }
  return {
    leer(codigo, usuarioId) { return serial(() => vista(obtener(codigo), usuarioId)); },
    mia(usuarioId) { return serial(() => { const sala = [...salas.values()].find((s) => ['espera', 'jugando'].includes(s.estado) && s.jugadores.some((j) => j.id === usuarioId)); return sala ? vista(sala, usuarioId) : { sala: null }; }); },
    crear(usuario, datos) { return serial(async () => {
      disponible(); libre(usuario.id);
      const mazo = await mazoValidado(datos);
      let codigo;
      const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      do { codigo = [...randomBytes(10)].map((n) => alfabeto[n % 32]).join(''); } while (salas.has(codigo));
      const sala = { codigo, estado: 'espera', revision: 0, jugadores: [{ id: usuario.id, nombre: usuario.nombre, preparado: false, ...mazo }], resultado: null, motor: null, recibos: new Map(), conexiones: new Map(), actualizado: ahora() };
      salas.set(codigo, sala); publicar(sala);
      return vista(sala, usuario.id);
    }); },
    unirse(codigo, usuario, datos) { return serial(async () => {
      disponible(); const sala = obtener(codigo);
      if (sala.jugadores.some((j) => j.id === usuario.id)) return vista(sala, usuario.id);
      exigir(sala.estado === 'espera' && sala.jugadores.length < 2, 409, 'SALA_LLENA', 'La sala ya no admite jugadores.');
      libre(usuario.id, codigo); const mazo = await mazoValidado(datos);
      sala.jugadores.push({ id: usuario.id, nombre: usuario.nombre, preparado: false, ...mazo });
      publicar(sala); return vista(sala, usuario.id);
    }); },
    cambiarMazo(codigo, usuarioId, datos) { return serial(async () => {
      disponible(); const sala = obtener(codigo); const jugador = asiento(sala, usuarioId);
      exigir(sala.estado === 'espera', 409, 'MAZO_CONGELADO', 'Los mazos están congelados desde el inicio.');
      Object.assign(jugador, await mazoValidado(datos));
      for (const participante of sala.jugadores) participante.preparado = false;
      publicar(sala); return vista(sala, usuarioId);
    }); },
    preparar(codigo, usuarioId, datos) { return serial(async () => {
      disponible(); const sala = obtener(codigo); const jugador = asiento(sala, usuarioId);
      exigir(clavesExactas(datos, ['preparado']) && typeof datos.preparado === 'boolean', 400, 'PETICION_INVALIDA', 'Indicá si estás preparado.');
      exigir(sala.estado === 'espera', 409, 'SALA_INICIADA', 'La sala ya no está en espera.');
      jugador.preparado = datos.preparado;
      if (sala.jugadores.length === 2 && sala.jugadores.every((j) => j.preparado)) {
        let iniciando = true;
        let falloInicio = false;
        try {
          sala.motor = await proveedor.crearPartida({ id: randomUUID(), jugadores: sala.jugadores.map(({ id, nombre, mazo }) => ({ id, nombre, mazo: clonar(mazo) })),
            alCambiar() { if (!iniciando && !sala.enComando) void serial(() => { if (sala.estado === 'jugando') { try { finalizar(sala); publicar(sala); } catch { interrumpir(sala); } } }).catch(() => {}); },
            alFallar() { falloInicio = true; sala.falloMotor = true; if (!iniciando) void serial(() => interrumpir(sala)).catch(() => {}); },
          });
          sala.estado = 'jugando'; iniciando = false;
          if (falloInicio) { interrumpir(sala); throw new ErrorJuego(503, 'MOTOR_FALLO', 'El motor no pudo iniciar la partida.'); }
        } catch (error) {
          if (sala.estado !== 'interrumpida') { sala.motor?.cerrar(); sala.motor = null; for (const j of sala.jugadores) j.preparado = false; publicar(sala); }
          throw error instanceof ErrorJuego ? error : new ErrorJuego(503, 'MOTOR_FALLO', 'El motor no pudo iniciar la partida.');
        }
      }
      publicar(sala); return vista(sala, usuarioId);
    }); },
    salir(codigo, usuarioId) { return serial(() => {
      disponible(); const sala = obtener(codigo); asiento(sala, usuarioId);
      exigir(sala.estado !== 'jugando', 409, 'PARTIDA_ACTIVA', 'Para abandonar una partida en curso usá Conceder.');
      const respuesta = vista(sala, usuarioId);
      if (sala.estado === 'espera') { sala.jugadores = sala.jugadores.filter((j) => j.id !== usuarioId); sala.conexiones.delete(usuarioId); for (const j of sala.jugadores) j.preparado = false; publicar(sala); respuesta.sala.jugadores = respuesta.sala.jugadores.filter((j) => j.id !== usuarioId); respuesta.sala.revision = sala.revision; }
      return respuesta;
    }); },
    accion(codigo, usuarioId, datos) { return serial(async () => {
      disponible(); const sala = obtener(codigo); asiento(sala, usuarioId);
      exigir(clavesExactas(datos, ['id', 'revision', 'comando']) && typeof datos.id === 'string' && UUID.test(datos.id) && Number.isSafeInteger(datos.revision) && datos.revision >= 0 && clavesExactas(datos.comando, ['nombre', 'args']) && typeof datos.comando.nombre === 'string' && datos.comando.nombre.length <= 64 && Array.isArray(datos.comando.args) && datos.comando.args.length <= 16, 400, 'ACCION_INVALIDA', 'El comando no es válido.');
      const clave = `${usuarioId}:${datos.id}`; const huella = canonico(datos);
      const recibo = sala.recibos.get(clave);
      if (recibo) {
        exigir(recibo.huella === huella, 409, 'ID_REUTILIZADO', 'No reutilices un identificador de acción con otro contenido.');
        if (recibo.error) throw recibo.error;
        return clonar(recibo.respuesta);
      }
      exigir(sala.recibos.size < 10_000, 409, 'LIMITE_ACCIONES', 'Esta partida alcanzó el límite de acciones.');
      try {
        exigir(sala.estado === 'jugando', 409, 'PARTIDA_NO_ACTIVA', 'La partida no está activa.');
        if (datos.revision !== sala.revision) throw new ErrorJuego(409, 'REVISION_OBSOLETA', 'La partida cambió; revisá el estado antes de elegir otra acción.', vista(sala, usuarioId));
        sala.enComando = true;
        await sala.motor.ejecutar(usuarioId, clonar(datos.comando));
        sala.enComando = false;
        if (sala.falloMotor) { interrumpir(sala); throw new ErrorJuego(503, 'MOTOR_FALLO', 'La partida fue interrumpida por un error del motor.'); }
        finalizar(sala); publicar(sala);
        const respuesta = vista(sala, usuarioId);
        sala.recibos.set(clave, { huella, respuesta });
        return respuesta;
      } catch (error) {
        sala.enComando = false;
        if (sala.falloMotor) interrumpir(sala);
        const fallo = error instanceof ErrorJuego ? error : new ErrorJuego(400, typeof error?.codigo === 'string' ? error.codigo : 'ACCION_RECHAZADA', 'El motor rechazó esta acción.');
        sala.recibos.set(clave, { huella, error: fallo });
        throw fallo;
      }
    }); },
    conectar(codigo, usuarioId, conexionId) { return serial(() => {
      disponible(); const sala = obtener(codigo); asiento(sala, usuarioId);
      const conexiones = sala.conexiones.get(usuarioId) ?? new Set();
      conexiones.add(conexionId); sala.conexiones.set(usuarioId, conexiones);
      publicar(sala, false); return vista(sala, usuarioId);
    }); },
    desconectar(codigo, usuarioId, conexionId) { return serial(() => {
      const sala = salas.get(codigo); if (!sala) return;
      sala.conexiones.get(usuarioId)?.delete(conexionId); if (!cerrando) publicar(sala, false);
    }); },
    depurar() { return serial(() => {
      for (const [codigo, sala] of salas) if (sala.estado === 'espera' && ![...sala.conexiones.values()].some((c) => c.size > 0) && ahora() - sala.actualizado > expiracionMs) {
        salas.delete(codigo); persistencia.eliminar(codigo);
      }
    }); },
    async cerrar() {
      cerrando = true;
      await serial(() => { for (const sala of salas.values()) { interrumpir(sala); sala.motor?.cerrar(); } });
      persistencia.cerrar();
    },
  };
}

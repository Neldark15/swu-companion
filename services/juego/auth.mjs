import { ErrorJuego, exigir } from './errores.mjs';

export const USUARIOS_DESARROLLO = Object.freeze({
  'dev:alpha': Object.freeze({ id: 'dev-alpha', nombre: 'Piloto Alfa' }),
  'dev:beta': Object.freeze({ id: 'dev-beta', nombre: 'Piloto Beta' }),
  'dev:gamma': Object.freeze({ id: 'dev-gamma', nombre: 'Piloto Gamma' }),
});
export function crearAutenticador({ entorno = process.env, host = '127.0.0.1', solicitar = fetch } = {}) {
  const desarrollo = entorno.JUEGO_DEV_AUTH === '1';
  exigir(!desarrollo || (entorno.NODE_ENV !== 'production' && ['127.0.0.1', '::1'].includes(host)),
    500, 'DEV_INSEGURO', 'La autenticación de desarrollo exige loopback y está prohibida en producción.');
  const url = entorno.SUPABASE_URL?.replace(/\/$/, '');
  const clave = entorno.SUPABASE_ANON_KEY;
  return async function autenticar(token) {
    exigir(typeof token === 'string' && token.length > 0 && token.length <= 8192, 401, 'SESION_INVALIDA', 'Iniciá sesión para jugar.');
    if (desarrollo) {
      exigir(Object.hasOwn(USUARIOS_DESARROLLO, token), 401, 'SESION_INVALIDA', 'Cuenta de desarrollo inválida.');
      return { ...USUARIOS_DESARROLLO[token] };
    }
    exigir(url && clave, 503, 'AUTH_NO_CONFIGURADO', 'La autenticación del servicio todavía no está configurada.');
    const headers = { apikey: clave, Authorization: `Bearer ${token}` };
    try {
      // Consultar Auth verifica firma, caducidad e identidad; nunca confiar en un JWT decodificado.
      const sesion = await solicitar(`${url}/auth/v1/user`, { headers, signal: AbortSignal.timeout(8000) });
      exigir(sesion.ok, 401, 'SESION_INVALIDA', 'La sesión venció o no es válida.');
      const usuario = await sesion.json();
      exigir(typeof usuario.id === 'string' && /^[0-9a-f-]{36}$/i.test(usuario.id), 401, 'SESION_INVALIDA', 'Identidad inválida.');
      const perfil = await solicitar(`${url}/rest/v1/profiles?select=id,name&id=eq.${encodeURIComponent(usuario.id)}&limit=1`, { headers, signal: AbortSignal.timeout(8000) });
      exigir(perfil.ok, 503, 'PERFIL_NO_DISPONIBLE', 'No se pudo verificar tu perfil.');
      const filas = await perfil.json();
      exigir(Array.isArray(filas) && filas.length === 1 && filas[0].id === usuario.id && typeof filas[0].name === 'string', 403, 'PERFIL_REQUERIDO', 'Necesitás un perfil de HOLOCRON.');
      return { id: usuario.id, nombre: filas[0].name.slice(0, 80) };
    } catch (error) {
      if (error instanceof ErrorJuego) throw error;
      throw new ErrorJuego(503, 'AUTH_NO_DISPONIBLE', 'No se pudo verificar la sesión.');
    }
  };
}
export function extraerToken(cabecera) {
  return typeof cabecera === 'string' && cabecera.startsWith('Bearer ') ? cabecera.slice(7) : '';
}

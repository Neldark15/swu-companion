/** Fronteras de confianza de la autoridad. Sin perfiles, roles ni tokens persistidos aquí. */
export const DESTINO_MEMENTO = 'https://mementohobby.com/cuenta/conectar'
export const RECUPERACION_MEMENTO = 'https://swusv.com/cuenta/recuperar'
const CLAVE_RETORNO = 'memento-autorizacion-pendiente-v1'
export const VIDA_RETORNO_MS = 10 * 60 * 1000

export function invalidaRecuperacion(evento: string, anterior: string | null | undefined, siguiente: string | null): boolean {
  return evento === 'SIGNED_OUT' || (evento === 'SIGNED_IN' && anterior !== undefined && anterior !== siguiente)
}

export function esRutaCuenta(pathname: string): boolean {
  try {
    const path = decodeURIComponent(pathname).replace(/\/+$/, '').toLowerCase()
    return path === '/cuenta/autorizar' || path === '/cuenta/recuperar'
  } catch { return false }
}

export function idAutorizacionValido(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export function leerAutorizacion(search: string): string | null {
  const params = new URLSearchParams(search)
  const id = params.get('authorization_id')
  return params.getAll('authorization_id').length === 1 && idAutorizacionValido(id) ? id : null
}

export interface DetallesAutorizacion {
  authorization_id: string
  redirect_uri: string
  client: { id: string }
  user: { id: string }
  scope: string
}

/** Las dos peticiones usan la identidad que la persona vio al pulsar Continuar. */
export async function consultarOAuthFijado(
  fetcher: typeof fetch,
  configuracion: { url: string; clavePublica: string },
  solicitud: { id: string; token: string; aprobar: boolean },
  signal: AbortSignal,
): Promise<DetallesAutorizacion | { redirect_url: string }> {
  if (!idAutorizacionValido(solicitud.id)) throw new Error('solicitud_no_permitida')
  const response = await fetcher(`${configuracion.url.replace(/\/$/, '')}/auth/v1/oauth/authorizations/${solicitud.id}${solicitud.aprobar ? '/consent' : ''}`, {
    method: solicitud.aprobar ? 'POST' : 'GET', signal, cache: 'no-store', credentials: 'omit',
    headers: { 'Content-Type': 'application/json', apikey: configuracion.clavePublica, Authorization: `Bearer ${solicitud.token}` },
    ...(solicitud.aprobar ? { body: JSON.stringify({ action: 'approve' }) } : {}),
  })
  if (!response.ok) throw new Error('solicitud_no_disponible')
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object') throw new Error('solicitud_no_permitida')
  if ('redirect_url' in data && typeof data.redirect_url === 'string') return { redirect_url: data.redirect_url }
  if (!solicitud.aprobar && 'authorization_id' in data && typeof data.authorization_id === 'string' &&
    'redirect_uri' in data && typeof data.redirect_uri === 'string' && 'scope' in data && typeof data.scope === 'string' &&
    'client' in data && data.client && typeof data.client === 'object' && 'id' in data.client && typeof data.client.id === 'string' &&
    'user' in data && data.user && typeof data.user === 'object' && 'id' in data.user && typeof data.user.id === 'string') {
    return { authorization_id: data.authorization_id, redirect_uri: data.redirect_uri, scope: data.scope, client: { id: data.client.id }, user: { id: data.user.id } }
  }
  throw new Error('solicitud_no_permitida')
}

export function verificarSolicitud(data: DetallesAutorizacion, id: string, cliente: string, usuario: string): boolean {
  const scopes = data.scope.split(/\s+/).filter(Boolean)
  return idAutorizacionValido(cliente) && data.authorization_id === id && data.client.id === cliente &&
    data.redirect_uri === DESTINO_MEMENTO && data.user.id === usuario &&
    scopes.length === 2 && new Set(scopes).size === 2 && scopes.includes('email') && scopes.includes('profile')
}

/** El SDK recibe skipBrowserRedirect:true; nunca navegar antes de esta validación. */
export function destinoAutorizacionSeguro(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.origin + url.pathname !== DESTINO_MEMENTO || url.username || url.password || url.hash) return null
    const keys = [...url.searchParams.keys()]
    if (new Set(keys).size !== keys.length || keys.some(k => !['code', 'state', 'error', 'error_description'].includes(k))) return null
    const state = url.searchParams.get('state')
    const code = url.searchParams.get('code')
    const error = url.searchParams.get('error')
    if (!state || state.length > 1024 || !/^[a-zA-Z0-9._~-]+$/.test(state)) return null
    if (code && !url.searchParams.has('error') && keys.length === 2 && code.length <= 4096 && !/\s/.test(code)) return url.href
    if (!url.searchParams.has('code') && error === 'access_denied') return url.href
    return null
  } catch { return null }
}

export function guardarRetorno(storage: Storage, id: string, ahora = Date.now()): void {
  if (!idAutorizacionValido(id)) return
  try { storage.setItem(CLAVE_RETORNO, JSON.stringify({ id, vence: ahora + VIDA_RETORNO_MS })) } catch { /* Navegación privada: volver desde MEMENTO. */ }
}

export function leerRetorno(storage: Storage, ahora = Date.now()): string | null {
  try {
    const raw: unknown = JSON.parse(storage.getItem(CLAVE_RETORNO) || 'null')
    if (typeof raw !== 'object' || raw === null || !('id' in raw) || !('vence' in raw) ||
      !idAutorizacionValido(raw.id) || typeof raw.vence !== 'number' || raw.vence <= ahora || raw.vence > ahora + VIDA_RETORNO_MS) {
      storage.removeItem(CLAVE_RETORNO)
      return null
    }
    return raw.id
  } catch { return null }
}

export function borrarRetorno(storage: Storage): void {
  try { storage.removeItem(CLAVE_RETORNO) } catch { /* Sin almacenamiento disponible. */ }
}

export type EnlaceCorreo = { tokenHash: string; tipo: 'recovery' | 'signup' }
export function leerEnlaceCorreo(hash: string): EnlaceCorreo | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const tokenHash = params.get('token_hash')
  const tipo = params.get('type')
  if ([...params.keys()].length !== 2 || params.getAll('token_hash').length !== 1 || params.getAll('type').length !== 1) return null
  if (!tokenHash || !/^[a-zA-Z0-9_-]{32,512}$/.test(tokenHash) || (tipo !== 'recovery' && tipo !== 'signup')) return null
  return { tokenHash, tipo }
}

/** Cancela la espera del componente, no promete cancelar una operación ya aceptada por Auth. */
export function esperarLectura<T>(promise: PromiseLike<T>, signal: AbortSignal, ms = 12000): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancelar = () => { limpiar(); reject(new Error('lectura_cancelada')) }
    const timer = setTimeout(() => { limpiar(); reject(new Error('lectura_vencida')) }, ms)
    const limpiar = () => { clearTimeout(timer); signal.removeEventListener('abort', cancelar) }
    if (signal.aborted) { cancelar(); return }
    signal.addEventListener('abort', cancelar, { once: true })
    Promise.resolve(promise).then(value => { limpiar(); resolve(value) }, error => { limpiar(); reject(error) })
  })
}

/** Fija la identidad al enlace verificado, aunque otra pestaña cambie la sesión
 * entre getUser y el PUT. El SDK updateUser tomaría la sesión global más reciente. */
export async function actualizarClaveVerificada(
  fetcher: typeof fetch,
  configuracion: { url: string; clavePublica: string },
  cuenta: { token: string; usuario: string; clave: string },
  signal: AbortSignal,
): Promise<void> {
  const response = await fetcher(`${configuracion.url.replace(/\/$/, '')}/auth/v1/user`, {
    method: 'PUT', signal, cache: 'no-store', credentials: 'omit',
    headers: { 'Content-Type': 'application/json', apikey: configuracion.clavePublica, Authorization: `Bearer ${cuenta.token}` },
    body: JSON.stringify({ password: cuenta.clave }),
  })
  if (!response.ok) throw new Error('cambio_no_confirmado')
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || !('id' in data) || data.id !== cuenta.usuario) throw new Error('identidad_no_confirmada')
}

/** /verify usa el mismo Auth que SWU, pero no instala una sesión en el SDK.
 * Un correo abierto tarde nunca sustituye a la cuenta activa del navegador. */
export async function verificarCorreoExplicito(
  fetcher: typeof fetch,
  configuracion: { url: string; clavePublica: string },
  enlace: EnlaceCorreo,
  signal: AbortSignal,
): Promise<{ token: string; usuario: string; correo: string }> {
  const response = await fetcher(`${configuracion.url.replace(/\/$/, '')}/auth/v1/verify`, {
    method: 'POST', signal, cache: 'no-store', credentials: 'omit',
    headers: { 'Content-Type': 'application/json', apikey: configuracion.clavePublica },
    body: JSON.stringify({ token_hash: enlace.tokenHash, type: enlace.tipo }),
  })
  if (!response.ok) throw new Error('correo_no_verificado')
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || !('access_token' in data) || typeof data.access_token !== 'string' ||
    !data.access_token || !('user' in data) || !data.user || typeof data.user !== 'object' ||
    !('id' in data.user) || typeof data.user.id !== 'string' || !data.user.id ||
    !('email' in data.user) || typeof data.user.email !== 'string') throw new Error('correo_no_verificado')
  return { token: data.access_token, usuario: data.user.id, correo: data.user.email }
}

import assert from 'node:assert/strict'
import {
  actualizarClaveVerificada, consultarOAuthFijado, DESTINO_MEMENTO, destinoAutorizacionSeguro, esRutaCuenta,
  esperarLectura, guardarRetorno, invalidaRecuperacion, leerAutorizacion, leerEnlaceCorreo, leerRetorno,
  verificarCorreoExplicito, verificarSolicitud, VIDA_RETORNO_MS,
} from '../src/features/cuenta/autoridadMemento.ts'

const id = '11111111-1111-4111-8111-111111111111'
const cliente = '22222222-2222-4222-8222-222222222222'
const solicitud = { authorization_id: id, redirect_uri: DESTINO_MEMENTO, client: { id: cliente }, user: { id: 'cuenta-a' }, scope: 'email profile' }
assert.ok(verificarSolicitud(solicitud, id, cliente, 'cuenta-a'))
assert.ok(!verificarSolicitud(solicitud, id, '', 'cuenta-a'))
assert.ok(!verificarSolicitud(solicitud, id, id, 'cuenta-a'))
assert.ok(!verificarSolicitud(solicitud, id, cliente, 'cuenta-b'))
for (const scope of ['email', 'email profile openid', 'email profile profile', 'phone profile']) {
  assert.ok(!verificarSolicitud({ ...solicitud, scope }, id, cliente, 'cuenta-a'))
}
assert.equal(leerAutorizacion(`?authorization_id=${id}`), id)
assert.equal(leerAutorizacion(`?authorization_id=${id}&authorization_id=${cliente}`), null)
assert.equal(leerAutorizacion('?authorization_id=../../users'), null)
assert.equal(esRutaCuenta('/profile'), false, 'recuperación histórica conserva implicit')
assert.equal(esRutaCuenta('/cuenta/recuperar'), true)
assert.equal(esRutaCuenta('/cuenta/autorizar'), true)
assert.equal(esRutaCuenta('/CUENTA/RECUPERAR/'), true)
assert.equal(esRutaCuenta('/%63uenta/recuperar'), true)
assert.equal(invalidaRecuperacion('INITIAL_SESSION', undefined, 'cuenta-a'), false)
assert.equal(invalidaRecuperacion('SIGNED_IN', 'cuenta-a', 'cuenta-a'), false, 'refocus conserva formulario')
assert.equal(invalidaRecuperacion('TOKEN_REFRESHED', 'cuenta-a', 'cuenta-a'), false)
assert.equal(invalidaRecuperacion('SIGNED_IN', 'cuenta-a', 'cuenta-b'), true)
assert.equal(invalidaRecuperacion('SIGNED_IN', null, 'cuenta-b'), true)
assert.equal(invalidaRecuperacion('SIGNED_OUT', 'cuenta-a', null), true)

assert.equal(destinoAutorizacionSeguro(`${DESTINO_MEMENTO}?code=codigo-de-prueba&state=estado-aleatorio`), `${DESTINO_MEMENTO}?code=codigo-de-prueba&state=estado-aleatorio`)
assert.ok(destinoAutorizacionSeguro(`${DESTINO_MEMENTO}?error=access_denied&state=estado-aleatorio`))
for (const url of [
  'https://evil.example/cuenta/conectar?code=x&state=y',
  'https://mementohobby.com.evil.example/cuenta/conectar?code=x&state=y',
  'https://www.mementohobby.com/cuenta/conectar?code=x&state=y',
  'https://mementohobby.com/cuenta/conectar/extra?code=x&state=y',
  'https://user@mementohobby.com/cuenta/conectar?code=x&state=y',
  `${DESTINO_MEMENTO}?code=x`, `${DESTINO_MEMENTO}?code=x&state=y#access_token=token`,
  `${DESTINO_MEMENTO}?code=x&state=y&access_token=token`,
  `${DESTINO_MEMENTO}?code=x&code=z&state=y`, `${DESTINO_MEMENTO}?code=x&error=access_denied&state=y`,
  `javascript:alert(1)`,
]) assert.equal(destinoAutorizacionSeguro(url), null, url)

const memoria = new Map<string, string>()
const storage: Storage = { length: 0, clear: () => memoria.clear(), key: () => null, getItem: k => memoria.get(k) ?? null, setItem: (k, v) => { memoria.set(k, v) }, removeItem: k => { memoria.delete(k) } }
guardarRetorno(storage, id, 1000)
assert.equal(leerRetorno(storage, 1001), id)
assert.equal(leerRetorno(storage, 1000 + VIDA_RETORNO_MS), null)
guardarRetorno(storage, id, 1000)
assert.equal(leerRetorno(storage, -VIDA_RETORNO_MS), null, 'rechaza expiración futura manipulada')
const token = 'a'.repeat(64)
assert.deepEqual(leerEnlaceCorreo(`#token_hash=${token}&type=recovery`), { tokenHash: token, tipo: 'recovery' })
assert.equal(leerEnlaceCorreo(`#access_token=${token}&type=recovery`), null)
assert.equal(leerEnlaceCorreo(`#token_hash=${token}&type=invite`), null)
assert.equal(leerEnlaceCorreo(`#token_hash=${token}&type=recovery&type=signup`), null)

const cancelacion = new AbortController()
const lectura = esperarLectura(new Promise(() => {}), cancelacion.signal)
cancelacion.abort()
await assert.rejects(lectura, /lectura_cancelada/)
await assert.rejects(esperarLectura(new Promise(() => {}), new AbortController().signal, 1), /lectura_vencida/)

// La contraseña usa el token de A aunque la sesión de otra pestaña ya sea B.
let enviada = false
await actualizarClaveVerificada(async (url, init) => {
  enviada = true
  assert.equal(url, 'https://auth.example.test/auth/v1/user')
  assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer token-verificado-a')
  assert.deepEqual(JSON.parse(init?.body as string), { password: 'clave-de-prueba' })
  assert.equal(init?.cache, 'no-store')
  return new Response(JSON.stringify({ id: 'cuenta-a' }), { status: 200 })
}, { url: 'https://auth.example.test/', clavePublica: 'anon-test' }, { token: 'token-verificado-a', usuario: 'cuenta-a', clave: 'clave-de-prueba' }, new AbortController().signal)
assert.ok(enviada)
await assert.rejects(actualizarClaveVerificada(async () => new Response(JSON.stringify({ id: 'cuenta-b' })), { url: 'https://auth.example.test', clavePublica: 'anon-test' }, { token: 'token-a', usuario: 'cuenta-a', clave: 'no-real' }, new AbortController().signal), /identidad_no_confirmada/)
await assert.rejects(actualizarClaveVerificada(async () => new Response('{}', { status: 422 }), { url: 'https://auth.example.test', clavePublica: 'anon-test' }, { token: 'token-a', usuario: 'cuenta-a', clave: 'no-real' }, new AbortController().signal), /cambio_no_confirmado/)

const verificada = await verificarCorreoExplicito(async (url, init) => {
  assert.equal(url, 'https://auth.example.test/auth/v1/verify')
  assert.equal(init?.method, 'POST')
  assert.deepEqual(JSON.parse(init?.body as string), { token_hash: token, type: 'recovery' })
  return new Response(JSON.stringify({ access_token: 'token-a', refresh_token: 'no-se-conserva', user: { id: 'cuenta-a', email: 'a@example.test' } }))
}, { url: 'https://auth.example.test', clavePublica: 'anon-test' }, { tokenHash: token, tipo: 'recovery' }, new AbortController().signal)
assert.deepEqual(verificada, { token: 'token-a', usuario: 'cuenta-a', correo: 'a@example.test' }, 'no devuelve ni almacena refresh token')
for (const aprobar of [false, true]) {
  const resultado = await consultarOAuthFijado(async (url, init) => {
    assert.equal(url, `https://auth.example.test/auth/v1/oauth/authorizations/${id}${aprobar ? '/consent' : ''}`)
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer token-a')
    assert.equal(init?.method, aprobar ? 'POST' : 'GET')
    if (aprobar) assert.deepEqual(JSON.parse(init?.body as string), { action: 'approve' })
    return new Response(JSON.stringify(aprobar ? { redirect_url: `${DESTINO_MEMENTO}?code=code-test&state=state-test` } : solicitud))
  }, { url: 'https://auth.example.test', clavePublica: 'anon-test' }, { id, token: 'token-a', aprobar }, new AbortController().signal)
  assert.ok(aprobar ? 'redirect_url' in resultado : 'authorization_id' in resultado)
}
console.log('Autoridad MEMENTO: fronteras OAuth, correo explícito, cancelación e identidad fija pasan.')

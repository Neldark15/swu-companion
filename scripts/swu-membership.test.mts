import assert from 'node:assert/strict'
import { createEnsureSwuMembership, ERROR_MEMBRESIA_SWU, type MembershipParams } from '../src/services/swuMembership.ts'

const usuario = { id: 'cuenta-a', user_metadata: { origin_app: 'memento', name: '  Nelson  ', avatar: 'darth-vader', role: 'admin' } }
const llamadas: MembershipParams[] = []
let terminar!: (result: { error: null }) => void
const ensure = createEnsureSwuMembership(params => {
  llamadas.push(params)
  return new Promise(resolve => { terminar = resolve })
})
const primera = ensure(usuario)
const simultanea = ensure(usuario)
assert.equal(primera, simultanea, 'dos entradas de Auth deben compartir la RPC en vuelo')
assert.deepEqual(llamadas, [{ display_name: 'Nelson', profile_avatar: 'darth-vader' }], 'no se envían IDs, roles ni otros metadata')
terminar({ error: null })
assert.deepEqual(await primera, { ok: true })
assert.deepEqual(await simultanea, { ok: true })
assert.deepEqual(await ensure(usuario), { ok: true })
assert.equal(llamadas.length, 1, 'renovar sesión no repite una membresía ya preparada')

const otra = ensure({ id: 'cuenta-b', user_metadata: { origin_app: 'memento', name: 123, avatar: {} } })
assert.equal(llamadas.length, 2, 'cada cuenta requiere su propia comprobación')
assert.deepEqual(llamadas[1], { display_name: 'Jugador', profile_avatar: '🎯' })
terminar({ error: null })
await otra

let intentos = 0
const reintentable = createEnsureSwuMembership(async () => ({
  error: ++intentos === 1 ? { message: 'detalle privado del servidor' } : null,
}))
assert.deepEqual(await reintentable(usuario), { ok: false, error: ERROR_MEMBRESIA_SWU })
assert.deepEqual(await reintentable(usuario), { ok: true })
assert.equal(intentos, 2, 'un error de PostgREST no queda cacheado ni bloquea el reintento')

let lanzamientos = 0
const red = createEnsureSwuMembership(async () => {
  if (++lanzamientos === 1) throw new Error('falló la red')
  return { error: null }
})
assert.deepEqual(await red(usuario), { ok: false, error: ERROR_MEMBRESIA_SWU })
assert.deepEqual(await red(usuario), { ok: true })

let signal: AbortSignal | undefined
let respuestaTardia!: (result: { error: null }) => void
let peticiones = 0
const lenta = createEnsureSwuMembership((_, actual) => {
  signal = actual
  if (++peticiones > 1) return Promise.resolve({ error: null })
  return new Promise(resolve => { respuestaTardia = resolve })
}, 5)
assert.deepEqual(await lenta(usuario), { ok: false, error: ERROR_MEMBRESIA_SWU })
assert.equal(signal?.aborted, true, 'el límite cancela la petición cuando el transporte lo permite')
respuestaTardia({ error: null })
await Promise.resolve()
assert.deepEqual(await lenta(usuario), { ok: true })
assert.equal(peticiones, 2, 'una respuesta tardía no convierte el intento vencido en éxito cacheado')

const cantidad = llamadas.length
assert.deepEqual(await ensure({ id: '' }), { ok: false, error: ERROR_MEMBRESIA_SWU })
assert.equal(llamadas.length, cantidad, 'no hay RPC sin identidad de sesión')
for (const origin_app of [undefined, 'swu', 'otra-app']) {
  assert.deepEqual(await ensure({ id: 'historica', user_metadata: { origin_app } }), { ok: true })
}
assert.equal(llamadas.length, cantidad, 'los usuarios SWU históricos no dependen de la nueva RPC')
console.log('Membresía SWU: deduplicación, identidad, errores, reintento y vencimiento verificados.')

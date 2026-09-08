import assert from 'node:assert/strict'
import { destinoTrasAcceso, leerModoAcceso, rutaAccesoPerfil } from '../src/features/profile/accesoPerfil.ts'

for (const modo of ['register', 'login', 'forgot-password'] as const) {
  const destino = '/liga/puente?temporada=3&mesa=2'
  const ruta = rutaAccesoPerfil(modo, `?next=${encodeURIComponent(destino)}`)
  const url = new URL(ruta, 'https://swusv.com')
  assert.equal(url.pathname, '/profile')
  assert.equal(leerModoAcceso(url.search), modo)
  assert.equal(destinoTrasAcceso(url.search), destino)
  // Cambiar el formulario mantiene el retorno de AuthGate.
  assert.equal(destinoTrasAcceso(new URL(rutaAccesoPerfil('login', url.search), url).search), destino)
}

for (const modo of ['', 'reset-password', 'profile', 'customize', 'otro']) {
  assert.equal(leerModoAcceso(`?modo=${modo}`), 'select')
}
assert.equal(destinoTrasAcceso('?modo=register'), null)
for (const destino of ['https://otro.test', '//otro.test', '/\\otro.test', '\\otro.test', '/\n/otro.test']) {
  const search = `?next=${encodeURIComponent(destino)}`
  assert.equal(destinoTrasAcceso(search), '/profile')
  assert.equal(new URL(rutaAccesoPerfil('register', search), 'https://swusv.com').searchParams.has('next'), false)
}
assert.equal(destinoTrasAcceso('?next=%2Fexplore%3Ftab%3Dmarket%26carta%3Dabc'), '/explore?tab=market&carta=abc')
console.log('Acceso: modos públicos, retorno de AuthGate y destinos externos verificados.')

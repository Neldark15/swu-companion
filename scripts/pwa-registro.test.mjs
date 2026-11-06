import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const compilar = texto => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(texto, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString('base64')}`
const politica = compilar(readFileSync(new URL('../src/services/politicaActualizacion.ts', import.meta.url), 'utf8'))
const turno = () => new Promise(resolve => setImmediate(resolve))
let registros = 0, aplicaciones = 0, comprobaciones = 0, recargas = 0, rechazarRegistro
const intervalos = new Set()
const ventana = Object.assign(new EventTarget(), {
  location: { pathname: '/', href: 'https://prueba.local/', origin: 'https://prueba.local', reload() { recargas++ } },
  setInterval(fn) { intervalos.add(fn); return fn },
  clearInterval(fn) { intervalos.delete(fn) },
})
const documento = Object.assign(new EventTarget(), { hidden: false })
const anterior = new EventTarget()
const nuevo = Object.assign(new EventTarget(), { state: 'installed', postMessage(mensaje) { assert.deepEqual(mensaje, { type: 'SKIP_WAITING' }); aplicaciones++ } })
const registro = Object.assign(new EventTarget(), { waiting: null, installing: null, update: async () => { comprobaciones++ } })
const sw = Object.assign(new EventTarget(), {
  controller: anterior,
  register() {
    registros++
    return registros === 1 ? new Promise((_, reject) => { rechazarRegistro = reject }) : Promise.resolve(registro)
  },
})
Object.assign(globalThis, { window: ventana, document: documento })
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true, serviceWorker: sw }, configurable: true })
const estado = {
  hayVersionNueva: false,
  _setVersionNueva(value) { this.hayVersionNueva = value },
  _setFunciones(funciones) { Object.assign(this, funciones) },
}
globalThis.__pwaPrueba = { useActualizacion: { getState: () => estado } }
const fuente = readFileSync(new URL('../src/services/registroPwa.ts', import.meta.url), 'utf8')
  .replace("import { useActualizacion } from './actualizacion'", 'const { useActualizacion } = globalThis.__pwaPrueba')
  .replace("'./politicaActualizacion'", JSON.stringify(politica))
  .replace('import.meta.env.PROD', 'true')
const { iniciarRegistroPwa, aplicarActualizacionSegura } = await import(compilar(fuente))
const cerrarPrimero = iniciarRegistroPwa()
cerrarPrimero()
assert.equal(intervalos.size, 0)
const cerrar = iniciarRegistroPwa()
assert.equal(registros, 1, 'StrictMode comparte el registro en curso')
assert.equal(intervalos.size, 1)
rechazarRegistro(new Error('Sin red al registrar'))
await turno()
ventana.dispatchEvent(new Event('online'))
await turno()
assert.equal(registros, 2, 'Recupera registro fallido al volver la conexión')
const antes = comprobaciones
ventana.dispatchEvent(new Event('focus'))
await turno()
assert.equal(comprobaciones, antes + 1)
// Se detecta una versión mientras el contador está oculto.
ventana.location.pathname = '/contador'
documento.hidden = true
registro.waiting = nuevo
registro.installing = nuevo
registro.dispatchEvent(new Event('updatefound'))
assert.equal(estado.hayVersionNueva, true)
assert.equal(aplicaciones, 0)
assert.equal(recargas, 0)
// Otra pestaña activa esa versión. Este contador NO puede recargarse.
registro.waiting = null
sw.controller = nuevo
sw.dispatchEvent(new Event('controllerchange'))
await turno()
assert.equal(recargas, 0, 'Actualización de otra pestaña no recarga la partida')
ventana.location.pathname = '/jugar'
await aplicarActualizacionSegura()
assert.equal(recargas, 0)
cerrar()
cerrar()
assert.equal(intervalos.size, 0)
const sinEscuchas = comprobaciones
ventana.dispatchEvent(new Event('focus'))
ventana.dispatchEvent(new Event('online'))
documento.hidden = false
documento.dispatchEvent(new Event('visibilitychange'))
await turno()
assert.equal(comprobaciones, sinEscuchas, 'Limpia todas las escuchas')
ventana.location.pathname = '/'
await aplicarActualizacionSegura()
assert.equal(recargas, 1, 'Al salir se aplica la versión que quedó pendiente')
console.log('✓ Registro único, reintento, limpieza, ruta actual, partida oculta y actualización desde otra pestaña')
// Una autorización explícita de ESTA pestaña sí permite recargar un editor.
const manual = await import(`${compilar(fuente)}#manual`)
ventana.location.pathname = '/decks/123'
const cerrarManual = manual.iniciarRegistroPwa()
await turno()
const tercero = Object.assign(new EventTarget(), { state: 'installed', postMessage() { aplicaciones++ } })
registro.waiting = tercero
registro.installing = tercero
registro.dispatchEvent(new Event('updatefound'))
const antesManual = recargas
await estado.aplicar()
sw.controller = tercero
sw.dispatchEvent(new Event('controllerchange'))
await turno()
assert.equal(recargas, antesManual + 1, 'Actualizar ahora autoriza la recarga de esta pestaña')
cerrarManual()
console.log('✓ Actualización manual explícita en editor')

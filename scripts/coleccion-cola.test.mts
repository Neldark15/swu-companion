import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import Dexie from 'dexie'
import { db, type CambioColeccion } from '../src/services/db/index.ts'
import {
  guardarCantidadColeccion, vaciarColeccionLocal, fotoCambiosColeccion,
  aplicarColeccionRemota, crearVaciadorColeccion, VACIAR_COLECCION,
} from '../src/services/collectionQueue.ts'

const nube = new Map<string, number>()
const envios: CambioColeccion[][] = []
let cuenta = 'A'
let conectado = false
let interceptar: ((cambios: CambioColeccion[]) => Promise<void>) | undefined
const enviar = crearVaciadorColeccion({
  vigente: profileId => profileId === cuenta,
  enviar: async cambios => {
    envios.push(cambios)
    if (!conectado) throw new Error('Sin conexión')
    await interceptar?.(cambios)
    for (const cambio of cambios) {
      if (cambio.cardId === VACIAR_COLECCION) {
        for (const key of nube.keys()) if (key.startsWith(`${cambio.profileId}:`)) nube.delete(key)
      } else if (cambio.quantity === 0) nube.delete(`${cambio.profileId}:${cambio.cardId}`)
      else nube.set(`${cambio.profileId}:${cambio.cardId}`, cambio.quantity)
    }
  },
})
const pendiente = (profileId: string, cardId: string) => db.collectionChanges.get([profileId, cardId])
const cantidad = async (cardId: string) => (await db.collection.get(cardId))?.quantity
async function reset() {
  await db.collection.clear()
  await db.collectionChanges.clear()
  nube.clear(); envios.length = 0; interceptar = undefined; cuenta = 'A'; conectado = true
}
function cerrojo() {
  let liberar!: () => void
  let entrar!: () => void
  const entrada = new Promise<void>(resolve => { entrar = resolve })
  const espera = new Promise<void>(resolve => { liberar = resolve })
  return { entrada, liberar, interceptar: async () => { entrar(); await espera } }
}

try {
  await db.delete()
  const antigua = new Dexie(db.name)
  antigua.version(10).stores(Object.fromEntries(db.tables.filter(tabla => tabla.name !== 'collectionChanges')
    .map(tabla => [tabla.name, [tabla.schema.primKey.src, ...tabla.schema.indexes.map(indice => indice.src)].join(', ')])))
  await antigua.open()
  await antigua.table('collection').put({ cardId: 'existente', quantity: 5, profileId: 'A' })
  await antigua.table('cards').put({ id: 'catalogo', name: 'Carta conservada' })
  antigua.close()
  await db.open()
  assert.equal(await cantidad('existente'), 5, 'migrar v10→v11 conserva la colección existente')
  assert.equal((await db.cards.get('catalogo'))?.name, 'Carta conservada', 'migrar no vacía el catálogo')
  assert.equal(await db.collectionChanges.count(), 0)
  await reset()
  await guardarCantidadColeccion('invitado', 2)
  assert.equal(await cantidad('invitado'), 2, 'primera carta del invitado no tiene fila previa')
  assert.equal(await db.collectionChanges.count(), 0, 'el invitado no genera envíos para otra cuenta')
  await reset()
  // Error original: local acepta, red falla y descarga antigua pisa el dato.
  conectado = false
  await guardarCantidadColeccion('carta', 3, 'A')
  await assert.rejects(enviar('A'), /Sin conexión/)
  assert.equal((await pendiente('A', 'carta'))?.pendiente, 1)
  await aplicarColeccionRemota('A', [{ card_id: 'carta', quantity: 1 }], await fotoCambiosColeccion('A'), () => true)
  assert.equal(await cantidad('carta'), 3)
  db.close(); await db.open()
  assert.equal((await pendiente('A', 'carta'))?.quantity, 3, 'la cola sobrevive a cerrar y reabrir IndexedDB')
  conectado = true
  await enviar('A')
  assert.equal(nube.get('A:carta'), 3)
  assert.equal((await pendiente('A', 'carta'))?.pendiente, 0)

  // Una descarga completa propaga borrados conocidos; nunca borra pendientes
  // ni datos antiguos cuyo estado remoto todavía no conocemos.
  await db.collection.put({ cardId: 'legado', quantity: 8, profileId: 'A' })
  await aplicarColeccionRemota('A', [{ card_id: 'remota', quantity: 2 }, { card_id: 'carta', quantity: 3 }], await fotoCambiosColeccion('A'), () => true)
  assert.equal(await cantidad('remota'), 2)
  await aplicarColeccionRemota('A', [{ card_id: 'carta', quantity: 3 }], await fotoCambiosColeccion('A'), () => true)
  assert.equal(await cantidad('remota'), undefined)
  assert.equal(await cantidad('legado'), 8)

  // Un borrado offline deja una lápida y no reaparece en una descarga antigua.
  await guardarCantidadColeccion('carta', 0, 'A')
  const fotoBorrado = await fotoCambiosColeccion('A')
  await enviar('A')
  await aplicarColeccionRemota('A', [{ card_id: 'carta', quantity: 3 }], fotoBorrado, () => true)
  assert.equal(await cantidad('carta'), undefined)
  assert.equal(nube.has('A:carta'), false)

  // Una edición nueva mientras el envío viejo está en vuelo no pierde su acuse.
  await reset()
  await guardarCantidadColeccion('carta', 1, 'A')
  const bloqueo = cerrojo()
  interceptar = bloqueo.interceptar
  const vuelo = enviar('A')
  await bloqueo.entrada
  await guardarCantidadColeccion('carta', 4, 'A')
  interceptar = undefined
  bloqueo.liberar()
  await vuelo
  assert.equal(nube.get('A:carta'), 4)
  assert.equal((await pendiente('A', 'carta'))?.pendiente, 0)

  // Descarga iniciada ANTES de una edición ya confirmada remotamente.
  const fotoVieja = await fotoCambiosColeccion('A')
  await guardarCantidadColeccion('carta', 7, 'A')
  await enviar('A')
  await aplicarColeccionRemota('A', [{ card_id: 'carta', quantity: 4 }], fotoVieja, () => true)
  assert.equal(await cantidad('carta'), 7)

  // Cambio de cuenta: solo se envían operaciones del dueño, no se aplica pull tardío.
  await reset()
  await guardarCantidadColeccion('igual', 2, 'A')
  await guardarCantidadColeccion('igual', 9, 'B')
  cuenta = 'B'
  await enviar('A')
  assert.equal(envios.length, 0)
  await enviar('B')
  assert.equal(nube.get('B:igual'), 9)
  assert.equal(nube.has('A:igual'), false)
  await aplicarColeccionRemota('A', [{ card_id: 'igual', quantity: 1 }], await fotoCambiosColeccion('A'), () => cuenta === 'A')
  assert.equal(await cantidad('igual'), 9)
  cuenta = 'A'
  await aplicarColeccionRemota('A', [{ card_id: 'igual', quantity: 1 }], await fotoCambiosColeccion('A'), () => cuenta === 'A')
  assert.equal(await cantidad('igual'), 2, 'se recupera la copia pendiente del dueño al volver')
  await enviar('A')
  assert.equal(nube.get('A:igual'), 2)

  // Vaciar/reemplazar durante un envío: el vaciado va después de ese envío y
  // antes de los valores nuevos, también elimina filas desconocidas localmente.
  await reset()
  nube.set('A:no-descargada', 50)
  nube.set('B:ajena', 6)
  await guardarCantidadColeccion('vieja', 1, 'A')
  const vaciando = cerrojo()
  interceptar = vaciando.interceptar
  const envioAnterior = enviar('A')
  await vaciando.entrada
  const antesDeVaciar = await fotoCambiosColeccion('A')
  await vaciarColeccionLocal('A')
  await guardarCantidadColeccion('nueva', 3, 'A')
  interceptar = undefined; vaciando.liberar()
  await envioAnterior
  await aplicarColeccionRemota('A', [{ card_id: 'vieja', quantity: 1 }], antesDeVaciar, () => true)
  assert.deepEqual([...nube.entries()].sort(), [['A:nueva', 3], ['B:ajena', 6]])
  assert.equal(await cantidad('vieja'), undefined)
  assert.equal(await cantidad('nueva'), 3)

  // El invitado no borra la colección de un perfil guardado en este equipo.
  await vaciarColeccionLocal()
  assert.equal(await cantidad('nueva'), 3)

  // La operación y la cantidad son atómicas si falla la escritura de la cola.
  const fallar = () => { throw new Error('Disco lleno') }
  db.collectionChanges.hook('creating', fallar)
  await assert.rejects(guardarCantidadColeccion('sin-espacio', 2, 'A'), /Disco lleno/)
  db.collectionChanges.hook('creating').unsubscribe(fallar)
  assert.equal(await cantidad('sin-espacio'), undefined)

  // Una importación se envía por lotes, y cambiar cuenta frena el siguiente.
  await reset()
  for (let i = 0; i < 205; i++) await guardarCantidadColeccion(`c${i}`, 1, 'A')
  interceptar = async () => { cuenta = 'B' }
  await enviar('A')
  assert.equal(envios.length, 1)
  assert.equal(envios[0].length, 100)
  assert.equal(await db.collectionChanges.where('[profileId+pendiente]').equals(['A', 1]).count(), 105)
  cuenta = 'A'; interceptar = undefined
  await enviar('A')
  assert.equal(nube.size, 205)
  assert.equal(envios.length, 3)
  console.log('Colección: cola durable, reintento, borrados, revisiones, cuentas, reemplazo, atomicidad y lotes verificados.')
} finally {
  await db.delete()
}

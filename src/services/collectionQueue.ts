import { db, type CambioColeccion } from './db'

/** El marcador permite vaciar/reemplazar también filas aún no descargadas. */
export const VACIAR_COLECCION = '*'

export async function guardarCantidadColeccion(cardId: string, quantity: number, profileId?: string): Promise<number> {
  if (!cardId || cardId === VACIAR_COLECCION || !Number.isSafeInteger(quantity) || quantity < 0) {
    throw new Error('Cantidad de cartas inválida')
  }
  return db.transaction('rw', db.collection, db.collectionChanges, async () => {
    const previa = await db.collection.get(cardId)
    const antes = previa && previa.profileId === profileId ? previa.quantity : 0
    if (quantity > 0) await db.collection.put({ cardId, quantity, ...(profileId ? { profileId } : {}) })
    else if (previa?.profileId === profileId) await db.collection.delete(cardId)
    if (profileId) {
      await db.collectionChanges.put({ profileId, cardId, quantity, revision: crypto.randomUUID(), pendiente: 1 })
    }
    return antes
  })
}

export async function vaciarColeccionLocal(profileId?: string): Promise<void> {
  await db.transaction('rw', db.collection, db.collectionChanges, async () => {
    // Nunca borrar filas de otra cuenta ni atribuirlas al invitado.
    const filas = await db.collection.filter(fila => fila.profileId === profileId).primaryKeys()
    await db.collection.bulkDelete(filas)
    if (profileId) {
      await db.collectionChanges.where('profileId').equals(profileId).delete()
      await db.collectionChanges.put({ profileId, cardId: VACIAR_COLECCION, quantity: 0,
        revision: crypto.randomUUID(), pendiente: 1 })
    }
  })
}

export async function fotoCambiosColeccion(profileId: string): Promise<Map<string, CambioColeccion>> {
  const cambios = await db.collectionChanges.where('profileId').equals(profileId).toArray()
  return new Map(cambios.map(cambio => [cambio.cardId, cambio]))
}

/** La foto se toma ANTES de pedir la nube. Se protege incluso un cambio que
 * terminó de enviarse durante esa petición (ya no aparece como pendiente). */
export async function aplicarColeccionRemota(
  profileId: string,
  filas: Array<{ card_id: string; quantity: number }>,
  foto: Map<string, CambioColeccion>,
  vigente: () => boolean,
): Promise<void> {
  await db.transaction('rw', db.collection, db.collectionChanges, async () => {
    if (!vigente()) return
    const actuales = await fotoCambiosColeccion(profileId)
    if (!vigente()) return
    const vaciado = actuales.get(VACIAR_COLECCION)
    const vaciadoAntes = foto.get(VACIAR_COLECCION)
    const descartarDescarga = vaciado?.pendiente === 1 || vaciadoAntes?.pendiente === 1 ||
      vaciado?.revision !== vaciadoAntes?.revision
    const protegidos = new Set([...actuales.values()].filter(cambio =>
      cambio.pendiente === 1 || foto.get(cambio.cardId)?.pendiente === 1 ||
      foto.get(cambio.cardId)?.revision !== cambio.revision,
    ).map(cambio => cambio.cardId))
    if (descartarDescarga) {
      const locales = await db.collection.where('profileId').equals(profileId).primaryKeys()
      await db.collection.bulkDelete(locales)
    } else {
      const seguros = filas.filter(fila => !protegidos.has(fila.card_id))
      await db.collection.bulkPut(seguros.map(fila => ({ cardId: fila.card_id, quantity: fila.quantity, profileId })))
      const recibidos = new Set(filas.map(fila => fila.card_id))
      const versiones: CambioColeccion[] = []
      for (const fila of seguros) {
        const previa = actuales.get(fila.card_id)
        if (!previa || previa.quantity !== fila.quantity) versiones.push({ profileId, cardId: fila.card_id,
          quantity: fila.quantity, revision: crypto.randomUUID(), pendiente: 0 })
      }
      // Propagar borrados de otro dispositivo solo de filas cuya relación con
      // la nube ya conocemos. No destruir datos locales históricos sin diario.
      for (const cambio of actuales.values()) {
        if (cambio.cardId === VACIAR_COLECCION || protegidos.has(cambio.cardId) || recibidos.has(cambio.cardId) || cambio.quantity === 0) continue
        const local = await db.collection.get(cambio.cardId)
        if (local?.profileId === profileId) await db.collection.delete(cambio.cardId)
        versiones.push({ ...cambio, quantity: 0, revision: crypto.randomUUID(), pendiente: 0 })
      }
      await db.collectionChanges.bulkPut(versiones)
    }
    // La caché histórica comparte cardId entre perfiles. Reconstruir los
    // cambios propios evita perderlos después de usar otra cuenta aquí.
    for (const cambio of actuales.values()) {
      if (cambio.cardId === VACIAR_COLECCION || (!descartarDescarga && !protegidos.has(cambio.cardId))) continue
      if (cambio.quantity > 0) await db.collection.put({ cardId: cambio.cardId, quantity: cambio.quantity, profileId })
      else {
        const local = await db.collection.get(cambio.cardId)
        if (local?.profileId === profileId) await db.collection.delete(cambio.cardId)
      }
    }
  })
}

export interface TransporteColeccion {
  vigente: (profileId: string) => boolean | Promise<boolean>
  enviar: (cambios: CambioColeccion[]) => Promise<void>
}

/** Serializado por cuenta. El acuse de una versión nunca borra otra posterior. */
export function crearVaciadorColeccion(transporte: TransporteColeccion) {
  const enCurso = new Map<string, Promise<void>>()
  return function enviarPendientes(profileId: string): Promise<void> {
    const existente = enCurso.get(profileId)
    if (existente) return existente
    const ejecutar = async () => {
      while (await transporte.vigente(profileId)) {
        const pendientes = await db.collectionChanges.where('[profileId+pendiente]').equals([profileId, 1]).toArray()
        if (!pendientes.length) return
        // Vaciar siempre antes de los nuevos valores de una importación.
        pendientes.sort((a, b) => Number(b.cardId === VACIAR_COLECCION) - Number(a.cardId === VACIAR_COLECCION))
        const lote = pendientes[0].cardId === VACIAR_COLECCION ? [pendientes[0]] : pendientes.slice(0, 100)
        const actuales = await db.collectionChanges.bulkGet(lote.map(cambio => [profileId, cambio.cardId]))
        const vigentes = lote.filter((cambio, i) => actuales[i]?.revision === cambio.revision)
        if (!vigentes.length) continue
        // Un vaciado nuevo invalida cualquier lote anterior; reiniciar.
        const vaciar = await db.collectionChanges.get([profileId, VACIAR_COLECCION])
        if (lote[0].cardId !== VACIAR_COLECCION && vaciar?.pendiente === 1) continue
        if (!(await transporte.vigente(profileId))) return
        await transporte.enviar(vigentes)
        await db.transaction('rw', db.collectionChanges, async () => {
          for (const cambio of vigentes) {
            const reciente = await db.collectionChanges.get([profileId, cambio.cardId])
            if (reciente?.revision === cambio.revision) await db.collectionChanges.update([profileId, cambio.cardId], { pendiente: 0 })
          }
        })
      }
    }
    const promesa = (async () => {
      // Web Locks serializa también otras pestañas de esta instalación.
      if (typeof navigator !== 'undefined' && navigator.locks) {
        await navigator.locks.request(`holocron-coleccion-${profileId}`, ejecutar)
      } else await ejecutar()
    })().finally(() => { enCurso.delete(profileId) })
    enCurso.set(profileId, promesa)
    return promesa
  }
}

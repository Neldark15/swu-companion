import { create } from 'zustand'
import { db } from './db'
import { supabase, isSupabaseReady } from './supabase'
import { crearVaciadorColeccion, VACIAR_COLECCION } from './collectionQueue'

type IdentidadColeccion = { currentProfileId: string | null; supabaseUser: { id: string } | null }
let leerIdentidad: () => IdentidadColeccion = () => ({ currentProfileId: null, supabaseUser: null })

export function configurarIdentidadColeccion(lector: () => IdentidadColeccion) { leerIdentidad = lector }
export function perfilColeccionVigente(profileId: string): boolean {
  const identidad = leerIdentidad()
  return identidad.currentProfileId === profileId && identidad.supabaseUser?.id === profileId
}

export const useEstadoSyncColeccion = create<{ enviando: string | null; errorPerfil: string | null }>(() => ({ enviando: null, errorPerfil: null }))

const vaciar = crearVaciadorColeccion({
  vigente: async profileId => {
    if (!isSupabaseReady() || !perfilColeccionVigente(profileId) || (typeof navigator !== 'undefined' && !navigator.onLine)) return false
    const { data: { session } } = await supabase.auth.getSession()
    return session?.user.id === profileId && perfilColeccionVigente(profileId)
  },
  enviar: async cambios => {
    const profileId = cambios[0].profileId
    if (cambios[0].cardId === VACIAR_COLECCION) {
      const { error } = await supabase.from('collection').delete().eq('user_id', profileId)
      if (error) throw error
      return
    }
    const borrados = cambios.filter(cambio => cambio.quantity === 0).map(cambio => cambio.cardId)
    const cantidades = cambios.filter(cambio => cambio.quantity > 0)
    if (borrados.length) {
      const { error } = await supabase.from('collection').delete().eq('user_id', profileId).in('card_id', borrados)
      if (error) throw error
    }
    if (cantidades.length) {
      // Comprobar de nuevo entre peticiones: la sesión pudo cambiar.
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user.id !== profileId || !perfilColeccionVigente(profileId)) throw new Error('Sesión cambiada')
      const { error } = await supabase.from('collection').upsert(cantidades.map(cambio => ({
        user_id: profileId, card_id: cambio.cardId, quantity: cambio.quantity,
      })))
      if (error) throw error
    }
  },
})

/** El fallo de red deja la cola intacta; nunca se presenta como fallo local. */
export async function sincronizarColeccionPendiente(profileId: string): Promise<void> {
  if (!perfilColeccionVigente(profileId)) return
  const pendientes = await db.collectionChanges.where('[profileId+pendiente]').equals([profileId, 1]).count()
  if (!pendientes) return
  useEstadoSyncColeccion.setState({ enviando: profileId, errorPerfil: null })
  try {
    await vaciar(profileId)
  } catch {
    useEstadoSyncColeccion.setState({ errorPerfil: profileId })
  } finally {
    if (useEstadoSyncColeccion.getState().enviando === profileId) useEstadoSyncColeccion.setState({ enviando: null })
  }
}

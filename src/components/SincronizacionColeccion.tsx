import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CloudUpload, RefreshCw } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { db } from '../services/db'
import { configurarIdentidadColeccion, sincronizarColeccionPendiente, useEstadoSyncColeccion } from '../services/collectionSync'

configurarIdentidadColeccion(() => useAuth.getState())

/** Vive en la raíz: salir de Colección no cancela sus cambios pendientes. */
export function SincronizacionColeccion() {
  const profileId = useAuth(estado => estado.currentProfileId)
  const userId = useAuth(estado => estado.supabaseUser?.id)
  useEffect(() => {
    if (!profileId || userId !== profileId) return
    const reintentar = () => { void sincronizarColeccionPendiente(profileId).catch(() => {}) }
    const visible = () => { if (!document.hidden) reintentar() }
    reintentar()
    window.addEventListener('online', reintentar)
    window.addEventListener('focus', reintentar)
    document.addEventListener('visibilitychange', visible)
    const intervalo = window.setInterval(visible, 30_000)
    return () => {
      window.clearInterval(intervalo)
      window.removeEventListener('online', reintentar)
      window.removeEventListener('focus', reintentar)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [profileId, userId])
  return null
}

export function AvisoSyncColeccion() {
  const profileId = useAuth(estado => estado.currentProfileId)
  const userId = useAuth(estado => estado.supabaseUser?.id)
  const pendientes = useLiveQuery(() => profileId
    ? db.collectionChanges.where('[profileId+pendiente]').equals([profileId, 1]).count()
    : Promise.resolve(0), [profileId], 0)
  const enviando = useEstadoSyncColeccion(estado => estado.enviando === profileId && profileId !== null)
  if (!profileId || !pendientes) return null
  return (
    <div className="flex items-center gap-3 rounded-xl border border-swu-amber/30 bg-swu-amber/10 px-3 py-2 text-sm" role="status">
      <CloudUpload size={20} className="shrink-0 text-swu-amber" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-swu-text">{enviando ? 'Sincronizando colección…' : 'Cambios pendientes de sincronizar'}</p>
        <p className="text-xs text-swu-muted">Guardados en este dispositivo. {userId === profileId ? 'Se enviarán al recuperar la conexión.' : 'Iniciá sesión en esta cuenta para enviarlos.'}</p>
      </div>
      {userId === profileId && <button type="button" disabled={enviando} onClick={() => { void sincronizarColeccionPendiente(profileId).catch(() => {}) }}
        className="min-h-11 min-w-11 flex items-center justify-center rounded-lg px-2 text-swu-amber disabled:opacity-50" aria-label="Reintentar sincronización de colección">
        <RefreshCw size={18} className={enviando ? 'animate-spin motion-reduce:animate-none' : ''} />
      </button>}
    </div>
  )
}

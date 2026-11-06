import { useActualizacion } from './actualizacion'
import { esSeguraParaActualizar } from './politicaActualizacion'

let consumidores = 0
let registro: ServiceWorkerRegistration | null = null
let registrando: Promise<void> | null = null
let controlador: ServiceWorker | null = null
let recargaPendiente = false
let activando = false
let recargaAutorizada = false
let detenerEscuchas: (() => void) | null = null
let detenerRegistro: (() => void) | null = null

/** Captura también los recursos de la primera visita que llegaron antes de
 * tomar control. Solo lecturas públicas; no descarga pantallas sin visitar. */
function guardarRecursosVisitados(): void {
  if (!navigator.serviceWorker.controller) return
  const urls = new Set(performance.getEntriesByType('resource').map(entrada => entrada.name))
  for (const recurso of urls) {
    const url = new URL(recurso, window.location.href)
    if (url.origin !== window.location.origin) continue
    if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/datos-cr/')
      || url.pathname === '/card-hashes.bin' || url.pathname === '/api/img') {
      void fetch(url.href).catch(() => {})
    }
  }
}

async function aplicarVersion(manual = false): Promise<void> {
  if (recargaPendiente) {
    window.location.reload()
    return
  }
  if (registro?.waiting && !activando) {
    recargaAutorizada = manual
    activando = true
    registro.waiting.postMessage({ type: 'SKIP_WAITING' })
  }
}

export async function aplicarActualizacionSegura(): Promise<void> {
  if (useActualizacion.getState().hayVersionNueva && esSeguraParaActualizar(window.location.pathname)) {
    await aplicarVersion()
  }
}

function versionDisponible(): void {
  if (!registro?.waiting) return
  useActualizacion.getState()._setVersionNueva(true)
  void aplicarActualizacionSegura()
}

function observarRegistro(): void {
  if (!registro || detenerRegistro || consumidores === 0) return
  const actual = registro
  let instalando: ServiceWorker | null = null
  const cambioEstado = () => {
    if (instalando?.state === 'installed') versionDisponible()
  }
  const encontrada = () => {
    instalando?.removeEventListener('statechange', cambioEstado)
    instalando = actual.installing
    instalando?.addEventListener('statechange', cambioEstado)
    cambioEstado()
  }
  actual.addEventListener('updatefound', encontrada)
  encontrada()
  versionDisponible()
  detenerRegistro = () => {
    actual.removeEventListener('updatefound', encontrada)
    instalando?.removeEventListener('statechange', cambioEstado)
    detenerRegistro = null
  }
}

async function registrar(): Promise<void> {
  if (registro) { observarRegistro(); return }
  if (registrando) return registrando
  registrando = navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .then(nuevo => {
      registro = nuevo
      observarRegistro()
      guardarRecursosVisitados()
    })
    .finally(() => { registrando = null })
  return registrando
}

async function comprobar(): Promise<void> {
  if (!navigator.onLine) return
  await registrar()
  await registro?.update()
}

/** Registro único con reintento tras fallos de red y limpieza real de escuchas.
 * No usamos el listener `controlling` de virtual:pwa-register: recarga TODAS
 * las pestañas cuando otra activa un SW, incluso las que tienen una partida. */
export function iniciarRegistroPwa(): () => void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return () => {}
  consumidores++
  if (!detenerEscuchas) {
    controlador = navigator.serviceWorker.controller
    const buscar = () => { void comprobar().catch(() => {}) }
    const alVolver = () => { if (!document.hidden) buscar() }
    const cambioControlador = () => {
      const nuevo = navigator.serviceWorker.controller
      const reemplazo = controlador !== null && controlador !== nuevo
      controlador = nuevo
      guardarRecursosVisitados()
      if (reemplazo || activando) {
        activando = false
        recargaPendiente = true
        useActualizacion.getState()._setVersionNueva(true)
        // Cada pestaña decide por su ruta ACTUAL. Ocultarse no da permiso.
        if (recargaAutorizada) window.location.reload()
        else void aplicarActualizacionSegura()
      }
    }
    const intervalo = window.setInterval(buscar, 15 * 60 * 1000)
    window.addEventListener('focus', buscar)
    window.addEventListener('online', buscar)
    document.addEventListener('visibilitychange', alVolver)
    navigator.serviceWorker.addEventListener('controllerchange', cambioControlador)
    detenerEscuchas = () => {
      window.clearInterval(intervalo)
      window.removeEventListener('focus', buscar)
      window.removeEventListener('online', buscar)
      document.removeEventListener('visibilitychange', alVolver)
      navigator.serviceWorker.removeEventListener('controllerchange', cambioControlador)
      detenerRegistro?.()
      detenerEscuchas = null
    }
    useActualizacion.getState()._setFunciones({ aplicar: () => aplicarVersion(true), comprobar })
    buscar()
  }
  observarRegistro()
  let cerrado = false
  return () => {
    if (cerrado) return
    cerrado = true
    consumidores--
    if (consumidores === 0) detenerEscuchas?.()
  }
}

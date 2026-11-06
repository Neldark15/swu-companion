import { useEffect } from 'react'

/** Adelanta solo herramientas frecuentes. Los módulos opcionales se cargan
 * al usarlos; respetar ahorro de datos y conexiones especialmente lentas. */
export function usePrefetchRoutes() {
  useEffect(() => {
    const conexion = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
    if (conexion?.saveData || /(^|-)2g$/.test(conexion?.effectiveType ?? '')) return
    let cancelado = false
    let idle: number | undefined
    const cargar = () => {
      if (cancelado) return
      void import('../features/home/HomePage').catch(() => {})
      void import('../features/cards/CardsPage').catch(() => {})
      void import('../features/collection/CollectionPage').catch(() => {})
    }
    const timer = window.setTimeout(() => {
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(cargar)
      else cargar()
    }, 1500)
    return () => {
      cancelado = true
      window.clearTimeout(timer)
      if (idle !== undefined) window.cancelIdleCallback(idle)
    }
  }, [])
}

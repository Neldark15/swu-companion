/**
 * El estado de «hay versión nueva», en UN solo sitio.
 *
 * Vivía dentro de `UpdatePrompt`, así que Ajustes no tenía forma de saberlo ni
 * de disparar una actualización: la única puerta era el aviso emergente, y si
 * lo cerrabas con «Después» te quedabas sin ninguna hasta que volviera a
 * aparecer.
 *
 * `registerSW` se llama UNA SOLA VEZ, desde `UpdatePrompt`, que está montado
 * siempre en el caparazón de la app. Ajustes solo LEE de acá y usa las
 * funciones que el registro dejó guardadas. Si Ajustes registrara su propio
 * service worker habría dos registros compitiendo, y el que aplicara la
 * actualización no sería necesariamente el que la detectó.
 */

import { create } from 'zustand'

interface EstadoActualizacion {
  /** El service worker ya bajó una versión nueva y está esperando. */
  hayVersionNueva: boolean
  /** Aplica la actualización y recarga. `null` hasta que el registro termine. */
  aplicar: (() => Promise<void>) | null
  /** Fuerza una comprobación contra el servidor. */
  comprobar: (() => Promise<void>) | null
  /** Una comprobación manual en curso, para que el botón lo diga. */
  comprobando: boolean
  /** Cuándo se comprobó por última vez (ms). `null` = nunca en esta sesión. */
  ultimaComprobacion: number | null

  _setVersionNueva: (v: boolean) => void
  _setFunciones: (f: { aplicar: () => Promise<void>; comprobar: () => Promise<void> }) => void
  comprobarAhora: () => Promise<void>
}

export const useActualizacion = create<EstadoActualizacion>()((set, get) => ({
  hayVersionNueva: false,
  aplicar: null,
  comprobar: null,
  comprobando: false,
  ultimaComprobacion: null,

  _setVersionNueva: (v) => set({ hayVersionNueva: v }),
  _setFunciones: ({ aplicar, comprobar }) => set({ aplicar, comprobar }),

  /**
   * Comprobación manual.
   *
   * Marca `ultimaComprobacion` SIEMPRE, aunque no haya nada nuevo: sin eso, el
   * botón de Ajustes no tendría cómo decir «ya miré y estás al día», y quien lo
   * toca se queda sin saber si pasó algo. Un botón que no acusa recibo se toca
   * cinco veces.
   */
  comprobarAhora: async () => {
    const { comprobar, comprobando } = get()
    if (!comprobar || comprobando) return
    set({ comprobando: true })
    try {
      await comprobar()
    } catch {
      // Sin conexión no se puede comprobar; el estado sigue diciendo la verdad
      // de lo último que se supo.
    } finally {
      set({ comprobando: false, ultimaComprobacion: Date.now() })
    }
  },
}))

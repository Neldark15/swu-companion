/**
 * EFECTOS — la receta de cuánto ruido hace cada carta al salir.
 *
 * Abrir un sobre son 5 cartas. Si las 5 salieran igual, la quinta no
 * emocionaría; si las 5 salieran con fuegos artificiales, tampoco. Lo que
 * hace que abrir un sobre se sienta bien es la ESCALA: cuatro cartas
 * tranquilas y luego una que rompe la pantalla. Este archivo es esa escala, en
 * un solo sitio, para que la apertura y el binder no se contradigan.
 *
 * ── Menos movimiento ─────────────────────────────────────────────────
 *
 * Con `prefers-reduced-motion` no se apaga el módulo: se apagan las
 * animaciones y quedan los colores y el orden de revelado. Quien pidió menos
 * movimiento igual quiere saber que le salió una serializada.
 */

import { useEffect, useState } from 'react'
import type { Rareza } from '../../services/sobres'

/** Todo lo que cambia según la rareza, junto. */
export interface Receta {
  /** El color del aura, del texto y de las partículas. */
  color: string
  /** Cuántos rayos de luz salen por detrás. 0 = ninguno. */
  rayos: number
  /** Cuántas partículas revientan al girar la carta. */
  chispas: number
  /** Cuánto dura el suspenso ANTES de girarla, en ms. */
  suspenso: number
  /** ¿La pantalla entera destella? Solo para lo que de verdad lo merece. */
  fogonazo: boolean
  /** ¿La carta queda vibrando después de salir? */
  latido: boolean
  /** La palabra que se canta al salir. */
  grito: string
  /** Nota del acorde que suena, en Hz. */
  nota: number
}

export const RECETA: Record<Rareza, Receta> = {
  // La base del sobre YA es foil: brilla, pero sin fanfarria. Si las cuatro
  // primeras hicieran ruido, la quinta no significaria nada.
  hiper: {
    color: '#4fc3f7',
    rayos: 5,
    chispas: 8,
    suspenso: 100,
    fogonazo: false,
    latido: false,
    grito: 'FOIL',
    nota: 523.25, // do
  },
  prestigio: {
    color: '#cbd5e1',
    rayos: 12,
    chispas: 20,
    suspenso: 520,
    fogonazo: false,
    latido: true,
    grito: 'PRESTIGE',
    nota: 659.25, // mi
  },
  prestigioFoil: {
    color: '#fbbf24',
    rayos: 17,
    chispas: 30,
    suspenso: 900,
    fogonazo: true,
    latido: true,
    grito: 'PRESTIGE FOIL',
    nota: 783.99, // sol alto
  },
  showcase: {
    color: '#a78bfa',
    rayos: 20,
    chispas: 38,
    suspenso: 1200,
    fogonazo: true,
    latido: true,
    grito: 'SHOWCASE',
    nota: 880.0, // la alto
  },
  serializada: {
    color: '#ff4d6d',
    rayos: 24,
    chispas: 48,
    suspenso: 1600,
    fogonazo: true,
    latido: true,
    grito: 'SERIALIZADA',
    nota: 1046.5, // do alto
  },
}

/**
 * ¿Pidió menos movimiento?
 *
 * Se escucha el cambio en vivo y no solo al montar: el ajuste del sistema se
 * puede tocar con la app abierta, y una animación que sigue corriendo después
 * de apagarla es exactamente lo que la preferencia intenta evitar.
 */
export function useMenosMovimiento(): boolean {
  const [reducido, setReducido] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  )
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const cambio = (e: MediaQueryListEvent) => setReducido(e.matches)
    mq.addEventListener('change', cambio)
    return () => mq.removeEventListener('change', cambio)
  }, [])
  return reducido
}

/**
 * Las chispas de una explosión, calculadas UNA vez.
 *
 * Sale un ángulo y una distancia por chispa; el CSS las anima con
 * `transform`. Se calcula fuera del render (con `useMemo` en quien llama)
 * porque `Math.random()` dentro del JSX vuelve a tirar los dados en cada
 * repintado y las partículas saltan de sitio.
 */
export function chispas(cuantas: number, semilla: number): { x: number; y: number; d: number }[] {
  const out: { x: number; y: number; d: number }[] = []
  // Generador propio: las mismas chispas para la misma carta mientras esté en
  // pantalla, en vez de un patrón nuevo por fotograma.
  let s = semilla * 9301 + 49297
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  for (let i = 0; i < cuantas; i++) {
    // Se reparten por el círculo con un empujón al azar, para que no queden
    // en abanico perfecto (que se lee como un ventilador, no como una explosión).
    const ang = (i / cuantas) * Math.PI * 2 + rnd() * 0.6
    const dist = 60 + rnd() * 120
    out.push({
      x: Math.cos(ang) * dist,
      y: Math.sin(ang) * dist,
      d: rnd() * 220,
    })
  }
  return out
}

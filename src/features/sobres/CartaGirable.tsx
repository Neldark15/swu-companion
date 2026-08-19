/**
 * CartaGirable — la carta en la mano: se gira con el dedo, sigue girando al
 * soltar y se ve por los dos lados.
 *
 * ── En qué se diferencia de `Carta3D` ────────────────────────────────
 *
 * `Carta3D` INCLINA: la carta vuelve sola al centro cuando soltás, porque está
 * apoyada en una rejilla y tiene que quedar donde estaba. Esta GIRA: no hay
 * centro al que volver, el ángulo se acumula sin tope y pasando de 90° se ve
 * el dorso. Son dos gestos distintos y mezclarlos daba una carta que ni se
 * dejaba girar ni se quedaba quieta.
 *
 * ── Los tres detalles de los que depende que se sienta fluida ────────
 *
 * 1. **El ángulo NO es estado de React.** Se guarda en una `ref` y se escribe
 *    con `style.transform`. Un `setState` por movimiento del dedo son 60
 *    renders por segundo del árbol entero: es exactamente el retraso que se
 *    siente como «pegajoso».
 *
 * 2. **Inercia al soltar.** Sin ella la carta se congela en seco en cuanto se
 *    levanta el dedo, que es lo que delata que es una interfaz y no un objeto.
 *    La velocidad se guarda del último movimiento y decae al 94% por
 *    fotograma; por debajo de 0,02°/f se para el bucle para no dejar un
 *    `requestAnimationFrame` corriendo eternamente.
 *
 * 3. **El eje X va con tope y el Y no.** Girar de canto (Y) es infinito, como
 *    en la mano. Volcarla hacia adelante y atrás (X) se limita a ±55°: más
 *    allá la carta se ve de canto y no se entiende qué se está mirando.
 */

import { useRef, useEffect, useCallback, type ReactNode } from 'react'

interface Props {
  /** La cara. */
  frente: ReactNode
  /** El dorso, que aparece solo al pasar de los 90°. */
  dorso: ReactNode
  /** Proporción de la caja, para que no salte al cargar el arte. */
  ratio?: number
  className?: string
}

/** Cuánto decae la velocidad por fotograma al soltar. */
const ROCE = 0.94
/** Por debajo de esto se considera quieta y se corta el bucle. */
const QUIETA = 0.02

export function CartaGirable({ frente, dorso, ratio = 286 / 400, className = '' }: Props) {
  const caja = useRef<HTMLDivElement>(null)
  const giro = useRef({ x: -6, y: 0 })
  const vel = useRef({ x: 0, y: 0 })
  const arrastrando = useRef(false)
  const ultimo = useRef({ x: 0, y: 0, t: 0 })
  const bucle = useRef(0)

  const pintar = useCallback(() => {
    const el = caja.current
    if (!el) return
    const { x, y } = giro.current
    el.style.transform = `rotateX(${x.toFixed(2)}deg) rotateY(${y.toFixed(2)}deg)`
  }, [])

  /** El bucle de inercia. Solo corre mientras de verdad se mueve. */
  const rodar = useCallback(() => {
    bucle.current = 0
    if (arrastrando.current) return
    const v = vel.current
    if (Math.abs(v.x) < QUIETA && Math.abs(v.y) < QUIETA) return

    giro.current.y += v.y
    giro.current.x = Math.max(-55, Math.min(55, giro.current.x + v.x))
    v.x *= ROCE
    v.y *= ROCE
    pintar()
    bucle.current = requestAnimationFrame(rodar)
  }, [pintar])

  const empezar = useCallback((e: React.PointerEvent) => {
    arrastrando.current = true
    vel.current = { x: 0, y: 0 }
    ultimo.current = { x: e.clientX, y: e.clientY, t: performance.now() }
    // Captura del puntero: si el dedo se sale de la carta a mitad del giro, los
    // eventos siguen llegando acá. Sin esto, girarla rápido la soltaba a medias.
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }, [])

  const mover = useCallback(
    (e: React.PointerEvent) => {
      if (!arrastrando.current) return
      const dx = e.clientX - ultimo.current.x
      const dy = e.clientY - ultimo.current.y
      const dt = Math.max(1, performance.now() - ultimo.current.t)
      ultimo.current = { x: e.clientX, y: e.clientY, t: performance.now() }

      giro.current.y += dx * 0.55
      giro.current.x = Math.max(-55, Math.min(55, giro.current.x - dy * 0.4))
      // La velocidad se normaliza a ~16 ms para que la inercia no dependa de
      // cada cuánto llegan los eventos del puntero, que varía por aparato.
      vel.current = { x: (-dy * 0.4 * 16) / dt, y: (dx * 0.55 * 16) / dt }
      pintar()
    },
    [pintar],
  )

  const soltar = useCallback(() => {
    if (!arrastrando.current) return
    arrastrando.current = false
    // Un empujón muy chico no es inercia, es ruido del dedo al levantarse.
    if (Math.abs(vel.current.x) > QUIETA || Math.abs(vel.current.y) > QUIETA) {
      bucle.current = requestAnimationFrame(rodar)
    }
  }, [rodar])

  /** Voltearla de un toque, para quien no quiera arrastrar. */
  const voltear = useCallback(() => {
    vel.current = { x: 0, y: 0 }
    // Se suma media vuelta al ángulo ACTUAL en vez de fijar 0 o 180: así gira
    // desde donde está y siempre por el camino corto.
    giro.current.y += 180
    const el = caja.current
    if (!el) return
    el.style.transition = 'transform 520ms cubic-bezier(0.22,1,0.36,1)'
    pintar()
    window.setTimeout(() => {
      if (el) el.style.transition = ''
    }, 540)
  }, [pintar])

  useEffect(() => {
    pintar()
    return () => {
      if (bucle.current) cancelAnimationFrame(bucle.current)
    }
  }, [pintar])

  return (
    <div className={`select-none ${className}`}>
      <div
        className="relative mx-auto w-full"
        style={{ perspective: 1100, aspectRatio: String(ratio), touchAction: 'none' }}
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onDoubleClick={voltear}
      >
        <div
          ref={caja}
          className="absolute inset-0"
          style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backfaceVisibility: 'hidden' }}
          >
            {frente}
          </div>
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            {dorso}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={voltear}
        className="mx-auto mt-3 block text-xs text-swu-muted underline underline-offset-4"
      >
        Darle la vuelta
      </button>
    </div>
  )
}

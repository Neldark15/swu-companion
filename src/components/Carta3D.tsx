/**
 * Carta3D — inclinar la carta y verle el brillo, como cuando la girás en la mano.
 *
 * ── Cómo se hace que corra en un teléfono de gama baja ────────────────
 *
 * Todo el efecto se apoya en cuatro decisiones, y ninguna es opcional:
 *
 * 1. **React NO se entera del movimiento.** Los ángulos se escriben como
 *    variables CSS directamente sobre el nodo con una `ref`. Un `setState` por
 *    fotograma serían 60 renders por segundo del árbol de arriba, que es
 *    exactamente lo que hace que estos efectos se sientan pegajosos.
 *
 * 2. **Solo `transform` y `opacity`.** Son las dos propiedades que el
 *    navegador puede animar en el compositor sin volver a calcular ni a
 *    pintar la página. Nada de `filter: blur`, `backdrop-filter` ni sombras
 *    animadas: eso es lo que funde a un teléfono barato.
 *
 * 3. **Un solo `requestAnimationFrame` en vuelo.** Los eventos de puntero
 *    llegan más rápido que los fotogramas; sin la compuerta se calcularían
 *    posiciones que nadie llega a ver.
 *
 * 4. **`will-change` solo mientras se toca.** Dejarlo puesto reserva una capa
 *    de memoria por carta; con una rejilla de cartas eso solo hace falta en la
 *    que se está tocando.
 *
 * Y si la persona pidió menos movimiento, no hay inclinación ni brillo: la
 * carta se queda quieta. El efecto es adorno, no información.
 */

import { useRef, useCallback, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Cuánto se inclina, en grados. Más de ~14 se siente a caricatura. */
  intensidad?: number
  /**
   * Brillo especular que recorre la carta siguiendo al dedo.
   * Para las Showcase y las foil, que es donde de verdad existe.
   */
  brillo?: boolean
  /** Halo irisado del borde, para las impresiones especiales. */
  iridiscente?: boolean
  /**
   * Se mueve sola, sin que nadie la toque.
   *
   * Para la vitrina: estas impresiones existen porque cambian con el ángulo,
   * y quietas no muestran nada. El número desfasa el vaivén de cada una para
   * que no se muevan todas a la vez, que se ve mecánico.
   */
  sola?: number | false
  className?: string
}

export function Carta3D({
  children,
  intensidad = 10,
  brillo = false,
  iridiscente = false,
  sola = false,
  className = '',
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const frame = useRef(0)
  const pendiente = useRef<{ x: number; y: number } | null>(null)

  const pintar = useCallback(() => {
    frame.current = 0
    const el = ref.current
    const p = pendiente.current
    if (!el || !p) return
    // `--px`/`--py` van de -1 a 1 con el centro en 0.
    el.style.setProperty('--px', p.x.toFixed(3))
    el.style.setProperty('--py', p.y.toFixed(3))
  }, [])

  const mover = useCallback((clientX: number, clientY: number) => {
    const el = ref.current
    if (!el) return
    // Solo se calcula si de verdad está activo: con el dedo llegan eventos de
    // movimiento durante el scroll, y responder a ellos hacía que las cartas
    // se inclinaran solas al desplazar la lista.
    if (el.style.getPropertyValue('--activo') !== '1') return
    const r = el.getBoundingClientRect()
    if (r.width === 0) return
    pendiente.current = {
      x: ((clientX - r.left) / r.width) * 2 - 1,
      y: ((clientY - r.top) / r.height) * 2 - 1,
    }
    // Compuerta: un solo fotograma en vuelo por más eventos que lleguen.
    if (!frame.current) frame.current = requestAnimationFrame(pintar)
  }, [pintar])

  const activar = useCallback((on: boolean) => {
    const el = ref.current
    if (!el) return
    // Se reserva la capa solo mientras dura el gesto.
    el.style.willChange = on ? 'transform' : 'auto'
    if (on) {
      el.style.setProperty('--activo', '1')
      return
    }
    // Al soltar se BORRAN las variables en vez de ponerlas en 0: así la carta
    // que se mueve sola vuelve a su animación, en lugar de quedarse clavada.
    el.style.removeProperty('--activo')
    el.style.removeProperty('--px')
    el.style.removeProperty('--py')
    pendiente.current = null
  }, [])

  return (
    <div
      className={`carta3d-escena ${className}`}
      // Con ratón basta entrar y salir. Con el dedo hace falta más:
      // `pointerenter` llega junto con el toque, y `pointercancel` llega
      // cuando el navegador decide que el gesto era un scroll — sin
      // atenderlo, la carta se quedaba inclinada y torcida al soltar.
      onPointerEnter={e => { if (e.pointerType === 'mouse') activar(true) }}
      onPointerLeave={e => { if (e.pointerType === 'mouse') activar(false) }}
      onPointerDown={e => { activar(true); mover(e.clientX, e.clientY) }}
      onPointerUp={() => activar(false)}
      onPointerCancel={() => activar(false)}
      onLostPointerCapture={() => activar(false)}
      onPointerMove={e => mover(e.clientX, e.clientY)}
    >
      <div
        ref={ref}
        className={`carta3d ${
          sola === false ? '' : `carta3d-sola ${['', 'carta3d-sola-b', 'carta3d-sola-c', 'carta3d-sola-d'][sola % 4]}`
        }`}
        style={{ '--intensidad': `${intensidad}deg` } as React.CSSProperties}
      >
        {children}
        {brillo && <span aria-hidden className="carta3d-brillo" />}
        {iridiscente && <span aria-hidden className="carta3d-iris" />}
      </div>
    </div>
  )
}

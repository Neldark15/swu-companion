import { useCallback, useEffect, useLayoutEffect, useRef, type ButtonHTMLAttributes, type PointerEvent as EventoPuntero } from 'react'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick' | 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'
  | 'onPointerLeave' | 'onLostPointerCapture' | 'onBlur' | 'onContextMenu' | 'onKeyDown'
  | 'onDragStart' | 'type' | 'draggable'> & { alAjustar: () => void }

interface Pulsacion {
  id: number
  boton: HTMLButtonElement
  temporizador: number | null
  repitio: boolean
  zona: Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom'>
}

function zonaPulsacion(boton: HTMLButtonElement): Pulsacion['zona'] {
  const caja = boton.getBoundingClientRect()
  // :active encoge visualmente el botón; su área táctil mantiene el tamaño
  // lógico para que un dedo cerca del borde no cancele su propia pulsación.
  const ancho = Math.max(caja.width, boton.offsetWidth)
  const alto = Math.max(caja.height, boton.offsetHeight)
  const centroX = caja.left + caja.width / 2
  const centroY = caja.top + caja.height / 2
  return { left: centroX - ancho / 2, right: centroX + ancho / 2, top: centroY - alto / 2, bottom: centroY + alto / 2 }
}

function dentro(caja: Pulsacion['zona'], x: number, y: number): boolean {
  return x >= caja.left && x <= caja.right && y >= caja.top && y <= caja.bottom
}

/** Un toque cuenta al soltar; mantener comienza a los 350 ms y avanza sin acelerar. */
export function BotonVidaCalculadora({ alAjustar, disabled = false, style, ...props }: Props) {
  const ajustar = useRef(alAjustar)
  const bloqueado = useRef(disabled)
  const montado = useRef(false)
  const pulsacion = useRef<Pulsacion | null>(null)

  const cancelar = useCallback(() => {
    const activa = pulsacion.current
    pulsacion.current = null
    if (!activa) return
    if (activa.temporizador !== null) window.clearTimeout(activa.temporizador)
    try {
      if (activa.boton.hasPointerCapture(activa.id)) activa.boton.releasePointerCapture(activa.id)
    } catch { /* La captura puede haber desaparecido al cancelar el puntero. */ }
  }, [])

  useLayoutEffect(() => {
    ajustar.current = alAjustar
    bloqueado.current = disabled
    if (disabled) cancelar()
  }, [alAjustar, disabled, cancelar])

  useLayoutEffect(() => {
    montado.current = true
    return () => { montado.current = false; cancelar() }
  }, [cancelar])

  const soltar = useCallback((evento: Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>) => {
    const activa = pulsacion.current
    if (!activa || activa.id !== evento.pointerId) return
    const esToque = !activa.repitio && dentro(activa.zona, evento.clientX, evento.clientY)
      && !activa.boton.disabled && !bloqueado.current && montado.current && !document.hidden
    cancelar()
    if (esToque) ajustar.current()
  }, [cancelar])

  useEffect(() => {
    const visibilidad = () => { if (document.hidden) cancelar() }
    const cancelarPuntero = (evento: PointerEvent) => {
      if (pulsacion.current?.id === evento.pointerId) cancelar()
    }
    // También cubre navegadores donde capturar un puntero no llegó a funcionar.
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', cancelarPuntero)
    window.addEventListener('blur', cancelar)
    window.addEventListener('resize', cancelar)
    document.addEventListener('visibilitychange', visibilidad)
    return () => {
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', cancelarPuntero)
      window.removeEventListener('blur', cancelar)
      window.removeEventListener('resize', cancelar)
      document.removeEventListener('visibilitychange', visibilidad)
      cancelar()
    }
  }, [cancelar, soltar])

  function comenzar(evento: EventoPuntero<HTMLButtonElement>) {
    if (disabled || bloqueado.current || !montado.current || document.hidden
      || evento.button !== 0 || !evento.isPrimary || pulsacion.current) return
    evento.preventDefault()
    const boton = evento.currentTarget
    boton.focus({ preventScroll: true })
    const activa: Pulsacion = { id: evento.pointerId, boton, temporizador: null, repitio: false, zona: zonaPulsacion(boton) }
    pulsacion.current = activa
    try { boton.setPointerCapture(activa.id) } catch { /* Sigue disponible la limpieza global. */ }
    const repetir = () => {
      if (pulsacion.current !== activa) return
      if (!montado.current || bloqueado.current || boton.disabled || document.hidden) { cancelar(); return }
      activa.repitio = true
      ajustar.current()
      // El ajuste puede deshabilitar o desmontar el botón antes de programar otro.
      if (pulsacion.current === activa && montado.current && !bloqueado.current && !boton.disabled) {
        activa.temporizador = window.setTimeout(repetir, 140)
      }
    }
    activa.temporizador = window.setTimeout(repetir, 350)
  }

  return <button {...props} type="button" disabled={disabled} draggable={false} data-repetir-vida="true"
    style={{ ...style, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
    onPointerDown={comenzar}
    onPointerMove={evento => {
      const activa = pulsacion.current
      if (activa?.id === evento.pointerId && !dentro(activa.zona, evento.clientX, evento.clientY)) cancelar()
    }}
    onPointerUp={soltar}
    onPointerCancel={evento => { if (pulsacion.current?.id === evento.pointerId) cancelar() }}
    onPointerLeave={evento => {
      const activa = pulsacion.current
      if (activa?.id === evento.pointerId && !dentro(activa.zona, evento.clientX, evento.clientY)) cancelar()
    }}
    onLostPointerCapture={evento => { if (pulsacion.current?.id === evento.pointerId) cancelar() }}
    onBlur={cancelar}
    onContextMenu={evento => evento.preventDefault()}
    onDragStart={evento => evento.preventDefault()}
    onKeyDown={evento => {
      if ((evento.key === 'Enter' || evento.key === ' ') && (evento.repeat || pulsacion.current)) evento.preventDefault()
    }}
    onClick={evento => {
      evento.preventDefault()
      // Los clics físicos ya se contaron al soltar o por el temporizador.
      // detail=0 conserva activación nativa por teclado/tecnología de asistencia.
      if (evento.detail === 0 && !pulsacion.current && !bloqueado.current && montado.current && !document.hidden) ajustar.current()
    }} />
}

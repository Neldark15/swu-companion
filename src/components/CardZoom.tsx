/**
 * CardZoom — visor de carta a pantalla completa.
 *
 * En un juego de cartas, poder AMPLIAR la carta para leer su texto impreso es
 * la función principal de un visor; hasta ahora la app no la tenía en ninguna
 * pantalla.
 *
 * Dos decisiones que importan:
 *
 * 1. Las caras apaisadas (frente de líder, bases) se muestran ROTADAS 90°.
 *    Sin eso, en un teléfono vertical una imagen de 400x287 apenas gana ~130px
 *    de alto — justo donde está el texto. Rotada aprovecha el alto completo.
 *
 * 2. El zoom se activa TOCANDO la carta, no con un gesto oculto de pellizco.
 *    Un gesto que no se ve no se descubre (mismo destino que el botón de venta
 *    de 28px). Además hay un botón visible con el estado actual.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, ZoomIn, ZoomOut } from 'lucide-react'

interface CardZoomProps {
  src: string
  alt: string
  /** Cara apaisada (líder de frente o base) → se rota 90°. */
  landscape: boolean
  onClose: () => void
}

export function CardZoom({ src, alt, landscape, onClose }: CardZoomProps) {
  const [zoomed, setZoomed] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  // La rotación solo ayuda en pantalla VERTICAL. En una pantalla apaisada
  // (escritorio, o el teléfono de costado) rotar una carta apaisada la hace
  // más CHICA, que es exactamente lo contrario de lo que se pidió.
  const [portraitScreen, setPortraitScreen] = useState(
    () => typeof window === 'undefined' || window.innerHeight >= window.innerWidth,
  )
  useEffect(() => {
    const onResize = () => setPortraitScreen(window.innerHeight >= window.innerWidth)
    onResize()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  const rotate = landscape && portraitScreen

  // Escape cierra; el fondo no debe scrollear mientras el visor está abierto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const toggleZoom = useCallback(() => {
    setZoomed(z => {
      if (z) setOffset({ x: 0, y: 0 }) // al desampliar, vuelve al centro
      return !z
    })
  }, [])

  // Arrastre con un dedo — solo tiene sentido cuando está ampliada.
  //
  // `movedRef` distingue arrastrar de tocar: sin él, TODO arrastre terminaba
  // también en `click`, que apagaba el zoom y recentraba la carta. O sea que
  // era imposible pasear por la carta ampliada — se cerraba sola apenas
  // levantabas el dedo.
  const movedRef = useRef(false)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!zoomed) return
    movedRef.current = false
    setDragging(true)
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLImageElement>) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!movedRef.current && Math.hypot(dx, dy) > 6) movedRef.current = true
    setOffset({ x: d.ox + dx, y: d.oy + dy })
  }
  const endDrag = () => { dragRef.current = null; setDragging(false) }

  const onImageClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (movedRef.current) { movedRef.current = false; return } // fue arrastre
    toggleZoom()
  }

  // A pantalla completa de verdad. Con un margen del 94% la carta ampliada
  // salía MÁS CHICA que la del detalle (que ya usa casi todo el ancho), así
  // que "Ampliar" no ampliaba nada.
  // Rotada 90°, el ancho de la imagen ocupa el ALTO de la pantalla: los
  // límites se cruzan a propósito.
  const maxW = rotate ? '100vh' : '100vw'
  const maxH = rotate ? '100vw' : '100vh'

  // El orden importa: escrito de izquierda a derecha, `translate` se aplica en
  // coordenadas de pantalla, así que arrastrar hacia la derecha mueve la carta
  // hacia la derecha aunque esté rotada.
  const transform = [
    `translate(${offset.x}px, ${offset.y}px)`,
    `scale(${zoomed ? 2 : 1})`,
    rotate ? 'rotate(90deg)' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center overscroll-contain"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Vista ampliada de ${alt}`}
    >
      {/* Cerrar */}
      <button
        onClick={onClose}
        aria-label="Cerrar vista ampliada"
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 backdrop-blur
                   text-white flex items-center justify-center active:scale-90 transition-transform"
      >
        <X size={20} />
      </button>

      {/* Ampliar / desampliar — visible, no un gesto escondido */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleZoom() }}
        aria-label={zoomed ? 'Reducir' : 'Ampliar'}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full
                   bg-white/10 backdrop-blur text-white text-xs font-semibold
                   flex items-center gap-2 active:scale-95 transition-transform"
      >
        {zoomed ? <ZoomOut size={14} /> : <ZoomIn size={14} />}
        {zoomed ? 'Reducir' : 'Ampliar'}
      </button>

      {zoomed && (
        <p className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 text-[10px] text-white/50">
          Arrastrá para moverte por la carta
        </p>
      )}

      <img
        src={src}
        alt={alt}
        draggable={false}
        onClick={onImageClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          maxWidth: maxW,
          maxHeight: maxH,
          transform,
          // Sin esto el navegador se queda el gesto para hacer scroll/pinch
          // y el arrastre nunca llega al componente.
          touchAction: 'none',
          // La transición se apaga MIENTRAS se arrastra: si no, cada
          // movimiento reinicia una animación de 200ms y la carta va
          // visiblemente atrasada respecto del dedo.
          transition: dragging ? 'none' : 'transform 200ms',
        }}
        className={`select-none rounded-xl shadow-2xl ${
          zoomed ? 'cursor-grab' : 'cursor-zoom-in'
        }`}
      />
    </div>
  )
}

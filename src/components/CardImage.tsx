/**
 * CardImage — Optimized card image component.
 *
 * Features:
 * - IntersectionObserver: only loads when near viewport (200px margin)
 * - Skeleton placeholder while loading
 * - Fade-in transition on load
 * - Error fallback with card icon
 * - Supports custom sizes via className
 */

import { useState, useRef, useEffect, memo } from 'react'
import { Package } from 'lucide-react'

interface CardImageProps {
  src: string | undefined | null
  alt?: string
  className?: string
  /** Preload margin in px (default 300) */
  rootMargin?: number
  /**
   * Cómo encaja la imagen en la caja.
   * - 'cover' (default): recorta para llenar. Correcto para cartas verticales.
   * - 'contain': entra completa con bandas. Necesario para líderes y bases,
   *   que son apaisadas (400x287) y con 'cover' salen como un fragmento
   *   irreconocible dentro de una caja vertical.
   */
  fit?: 'cover' | 'contain'
}

export const CardImage = memo(function CardImage({
  src,
  alt = '',
  className = 'w-12 h-16',
  rootMargin = 300,
  fit = 'cover',
}: CardImageProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [isVisible, setIsVisible] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // IntersectionObserver — only trigger image load when near viewport
  useEffect(() => {
    const el = containerRef.current
    if (!el || !src) return

    // If IntersectionObserver not available, load immediately
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: `${rootMargin}px` },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [src, rootMargin])

  // Load image when visible
  useEffect(() => {
    if (!isVisible || !src) return

    let cancelled = false
    const img = new Image()
    // Los manejadores van ANTES de asignar `src`. Al revés, una imagen que ya
    // está en caché podía terminar de cargar antes de que existiera el
    // manejador: `load` no volvía a dispararse, el estado quedaba en 'loading'
    // y la carta se veía como un rectángulo vacío para siempre.
    img.onload = () => { if (!cancelled) setState('loaded') }
    img.onerror = () => { if (!cancelled) setState('error') }
    img.src = src

    // Red de seguridad para el mismo caso: si ya está resuelta, no hay ningún
    // evento que esperar.
    if (img.complete && img.naturalWidth > 0) setState('loaded')
    else setState('loading')

    return () => { cancelled = true }
  }, [isVisible, src])

  // No src at all
  if (!src) {
    return (
      <div
        className={`${className} rounded-lg bg-swu-bg flex items-center justify-center flex-shrink-0`}
      >
        <Package size={16} className="text-swu-muted/40" />
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`${className} rounded-lg bg-swu-bg overflow-hidden flex-shrink-0 relative`}>
      {/* Skeleton pulse */}
      {state !== 'loaded' && state !== 'error' && (
        <div className="absolute inset-0 bg-swu-border/20 animate-pulse rounded-lg" />
      )}

      {/* Actual image */}
      {isVisible && state !== 'error' && (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full ${fit === 'contain' ? 'object-contain' : 'object-cover'} rounded-lg transition-opacity duration-300 ${
            state === 'loaded' ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* Error fallback */}
      {state === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Package size={16} className="text-swu-muted/40" />
        </div>
      )}
    </div>
  )
})

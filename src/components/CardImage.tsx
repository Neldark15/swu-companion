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
}

export const CardImage = memo(function CardImage({
  src,
  alt = '',
  className = 'w-12 h-16',
  rootMargin = 300,
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
    if (!isVisible || !src || state === 'loaded') return

    setState('loading')

    const img = new Image()
    img.src = src

    img.onload = () => setState('loaded')
    img.onerror = () => setState('error')

    return () => {
      img.onload = null
      img.onerror = null
    }
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
          className={`w-full h-full object-cover rounded-lg transition-opacity duration-300 ${
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

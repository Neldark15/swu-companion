import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * PageTransition — wraps page content with a smooth fade+slide animation
 * on every route change. Uses CSS transitions (no framer-motion dependency).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [displayedChildren, setDisplayedChildren] = useState(children)
  const [phase, setPhase] = useState<'visible' | 'exit' | 'enter'>('visible')
  const prevPathRef = useRef(location.pathname)

  useEffect(() => {
    // Same path (hash change or search param) — no transition
    if (location.pathname === prevPathRef.current) {
      setDisplayedChildren(children)
      return
    }

    prevPathRef.current = location.pathname

    // Start exit animation
    setPhase('exit')

    const exitTimer = setTimeout(() => {
      // Swap content while hidden
      setDisplayedChildren(children)
      setPhase('enter')
      // Scroll to top on page change
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })

      const enterTimer = setTimeout(() => {
        setPhase('visible')
      }, 30) // Small delay to trigger CSS transition

      return () => clearTimeout(enterTimer)
    }, 150) // Exit duration

    return () => clearTimeout(exitTimer)
  }, [location.pathname, children])

  const style: React.CSSProperties = {
    transition: phase === 'visible' ? 'opacity 200ms ease-out, transform 200ms ease-out' : 'opacity 120ms ease-in',
    opacity: phase === 'exit' ? 0 : phase === 'enter' ? 0 : 1,
    transform: phase === 'enter' ? 'translateY(8px)' : 'translateY(0)',
  }

  return (
    <div style={style}>
      {displayedChildren}
    </div>
  )
}

/**
 * HolocronLoader — Star Wars themed loading spinner for Suspense fallback.
 * Shows a glowing holocron animation.
 */
export function HolocronLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      {/* Holocron glow */}
      <div className="relative">
        {/* Outer glow ring */}
        <div className="absolute -inset-3 rounded-full bg-swu-accent/20 animate-ping" style={{ animationDuration: '1.5s' }} />
        {/* Inner holocron shape */}
        <div className="relative w-12 h-12 flex items-center justify-center">
          <svg viewBox="0 0 48 48" className="w-12 h-12 animate-spin" style={{ animationDuration: '3s' }}>
            {/* Diamond/holocron shape */}
            <path
              d="M24 4 L44 24 L24 44 L4 24 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-swu-accent"
              opacity={0.6}
            />
            <path
              d="M24 10 L38 24 L24 38 L10 24 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-swu-accent"
              opacity={0.3}
            />
            {/* Center dot */}
            <circle cx="24" cy="24" r="3" className="fill-swu-accent" opacity={0.8} />
          </svg>
        </div>
      </div>
      {/* Loading text */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-swu-muted font-mono tracking-widest uppercase">Cargando</span>
        <span className="flex gap-0.5">
          <span className="w-1 h-1 rounded-full bg-swu-accent animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1 h-1 rounded-full bg-swu-accent animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1 h-1 rounded-full bg-swu-accent animate-bounce" style={{ animationDelay: '300ms' }} />
        </span>
      </div>
    </div>
  )
}

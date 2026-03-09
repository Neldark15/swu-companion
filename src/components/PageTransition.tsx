import { Suspense, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * PageTransition — lightweight wrapper that:
 *  1. Scrolls to top on route changes
 *  2. Wraps children in a Suspense with an inline loader so lazy chunks
 *     always show feedback while loading (not a blank screen)
 *
 * We intentionally removed the fade/slide animation because the 150ms exit
 * delay was stacking on top of chunk load time, making navigation feel sluggish.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const prevPath = useRef(pathname)

  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }
  }, [pathname])

  return (
    <Suspense fallback={<InlineLoader />}>
      {children}
    </Suspense>
  )
}

/** Compact inline loader shown while a lazy page chunk is downloading */
function InlineLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-2 border-swu-accent/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-swu-accent animate-spin" />
      </div>
      <span className="text-[10px] text-swu-muted font-mono tracking-widest uppercase">Cargando</span>
    </div>
  )
}

/**
 * HolocronLoader — Star Wars themed loading spinner for initial app Suspense.
 */
export function HolocronLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="relative">
        <div className="absolute -inset-3 rounded-full bg-swu-accent/20 animate-ping" style={{ animationDuration: '1.5s' }} />
        <div className="relative w-12 h-12 flex items-center justify-center">
          <svg viewBox="0 0 48 48" className="w-12 h-12 animate-spin" style={{ animationDuration: '3s' }}>
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
            <circle cx="24" cy="24" r="3" className="fill-swu-accent" opacity={0.8} />
          </svg>
        </div>
      </div>
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

/**
 * usePrefetchRoutes — preloads critical page chunks after initial render
 * so subsequent navigation is instant (no lazy loading delay).
 */
export function usePrefetchRoutes() {
  const done = useRef(false)

  const prefetch = useCallback(() => {
    if (done.current) return
    done.current = true

    // Prefetch the most-visited pages after a short idle delay
    const pages = [
      () => import('../features/home/HomePage'),
      () => import('../features/cards/CardsPage'),
      () => import('../features/decks/DeckListPage'),
      () => import('../features/profile/ProfilePage'),
      () => import('../features/play/PlayPage'),
      () => import('../features/collection/CollectionPage'),
      () => import('../features/espionaje/EspionajePage'),
      () => import('../features/rank/RankingPage'),
      () => import('../features/arena/ArenaPage'),
      () => import('../features/events/EventsPage'),
    ]

    // Use requestIdleCallback or setTimeout fallback
    const schedule = typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 200)

    // Stagger prefetches to not block the main thread
    pages.forEach((load) => {
      schedule(() => { load().catch(() => {}) })
    })
  }, [])

  useEffect(() => {
    // Wait for initial render to settle, then start prefetching
    const timer = setTimeout(prefetch, 1500)
    return () => clearTimeout(timer)
  }, [prefetch])
}

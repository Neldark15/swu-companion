/**
 * usePrefetchRoutes — precarga los trozos de las pantallas críticas.
 *
 * Vive en su propio archivo y no junto a PageTransition porque un módulo que
 * exporta un componente Y otra cosa rompe el refresco en caliente: al editarlo
 * durante el desarrollo, React no puede conservar el estado y recarga la
 * página entera.
 */

import { useCallback, useEffect, useRef } from 'react'

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

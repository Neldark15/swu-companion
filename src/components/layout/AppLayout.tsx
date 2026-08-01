import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { SideNav } from './SideNav'
import { TabBar } from './TabBar'
import { useAuth } from '../../hooks/useAuth'
import { NotificationToast } from '../ui/NotificationToast'
import { PageTransition, usePrefetchRoutes } from '../PageTransition'
import { TournamentBroadcastListener } from '../../features/events/TournamentBroadcastListener'
import { GiftListener } from '../../features/espionaje/GiftListener'

export function AppLayout() {
  const initAuth = useAuth(s => s.initAuth)

  // Initialize auth on app mount — restores Supabase session + role
  useEffect(() => {
    initAuth()
  }, [initAuth])

  // Prefetch critical route chunks after initial render
  usePrefetchRoutes()

  return (
    <div className="min-h-screen bg-swu-bg">
      {/* Global notification toast */}
      <NotificationToast />

      {/* Global tournament broadcasts → toasts for non-participants */}
      <TournamentBroadcastListener />

      {/* Live gift notifications for the signed-in recipient */}
      <GiftListener />

      {/* Desktop sidebar — hidden on mobile */}
      <SideNav />

      {/* Main content area */}
      <div className="lg:ml-64 xl:ml-72">
        {/* Mobile: constrained width. Desktop: full width with max */}
        <div className="max-w-lg lg:max-w-full mx-auto min-h-screen relative">
          <Header />
          {/* `pb-24` deja libre el alto de la barra inferior para que el último
              elemento de cada pantalla no quede tapado en móvil. */}
          <main className="pb-24 lg:pb-6 overflow-y-auto">
            <PageTransition>
              <Outlet />
            </PageTransition>
          </main>
        </div>
      </div>

      {/* Navegación principal en móvil — el sidebar la cubre en escritorio */}
      <TabBar />
    </div>
  )
}

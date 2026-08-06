import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { SideNav } from './SideNav'
import { TabBar } from './TabBar'
import { ID_SCROLL } from '../../services/scrollApp'
import { UpdatePrompt } from '../UpdatePrompt'
import { useAuth } from '../../hooks/useAuth'
import { NotificationToast } from '../ui/NotificationToast'
import { PageTransition } from '../PageTransition'
import { usePrefetchRoutes } from '../usePrefetchRoutes'
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
    /* Caparazón de alto fijo que NO se desplaza.
     *
     * Antes el documento entero scrolleaba, y en el teléfono eso hace que la
     * barra del navegador aparezca y desaparezca al desplazar: todo lo anclado
     * abajo se movía con ella. Ahora el que scrollea es el `<main>` de adentro,
     * la altura de la ventana nunca cambia, y la barra de navegación deja de
     * ser `fixed` —es el último hijo del caparazón— así que no puede moverse.
     *
     * `dvh` y no `vh`: en móvil `100vh` mide la ventana SIN la barra del
     * navegador, así que dejaba el último tramo fuera de la pantalla. */
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-swu-bg">
      {/* Global notification toast */}
      <NotificationToast />

      {/* Global tournament broadcasts → toasts for non-participants */}
      <TournamentBroadcastListener />

      {/* Live gift notifications for the signed-in recipient */}
      <GiftListener />

      {/* Desktop sidebar — hidden on mobile */}
      <SideNav />

      {/* Main content area */}
      {/* `min-h-0` es imprescindible: sin él, un hijo flexible no se deja
          encoger por debajo de su contenido y el `overflow-y-auto` de dentro
          nunca llega a scrollear. */}
      <div className="flex-1 min-h-0 lg:ml-64 xl:ml-72">
        <div className="max-w-lg lg:max-w-full mx-auto h-full flex flex-col relative">
          <Header />
          <main id={ID_SCROLL} className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-6">
            <PageTransition>
              <Outlet />
            </PageTransition>
          </main>
        </div>
      </div>

      {/* Navegación principal en móvil — el sidebar la cubre en escritorio */}
      <TabBar />

      {/* Aviso de versión nueva. Va por encima de la TabBar (z-70 vs z-50). */}
      <UpdatePrompt />
    </div>
  )
}

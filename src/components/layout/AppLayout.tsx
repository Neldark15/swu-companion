import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { SideNav } from './SideNav'
import { useAuth } from '../../hooks/useAuth'
import { NotificationToast } from '../ui/NotificationToast'
import { loadFullDatabase } from '../../services/swuApi'

export function AppLayout() {
  const initAuth = useAuth(s => s.initAuth)

  // Initialize auth on app mount — restores Supabase session + role
  useEffect(() => {
    initAuth()
  }, [initAuth])

  // Pre-load card database in background on app start
  useEffect(() => {
    loadFullDatabase().catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-swu-bg">
      {/* Global notification toast */}
      <NotificationToast />

      {/* Desktop sidebar — hidden on mobile */}
      <SideNav />

      {/* Main content area */}
      <div className="lg:ml-64 xl:ml-72">
        {/* Mobile: constrained width. Desktop: full width with max */}
        <div className="max-w-lg lg:max-w-full mx-auto min-h-screen relative">
          <Header />
          <main className="pb-6 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { TabBar } from './TabBar'
import { useAuth } from '../../hooks/useAuth'

export function AppLayout() {
  const initAuth = useAuth(s => s.initAuth)

  // Initialize auth on app mount — restores Supabase session + role
  useEffect(() => {
    initAuth()
  }, [initAuth])

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-swu-bg relative">
      <Header />
      <main className="pb-20 overflow-y-auto">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}

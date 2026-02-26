import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { TabBar } from './TabBar'

export function AppLayout() {
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

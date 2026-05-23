import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Newspaper,
  Trophy,
  Library,
  Bell,
  ScrollText,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useEffect } from 'react'

interface NavItemDef {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
}

const NAV_ITEMS: NavItemDef[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Usuarios', icon: Users },
  { to: '/admin/news', label: 'Noticias', icon: Newspaper },
  { to: '/admin/events', label: 'Eventos', icon: Trophy },
  { to: '/admin/cards', label: 'Cartas DB', icon: Library },
  { to: '/admin/push', label: 'Notificaciones', icon: Bell },
  { to: '/admin/audit', label: 'Auditoría', icon: ScrollText },
]

export function AdminLayout() {
  const navigate = useNavigate()
  const { isAdmin, currentProfile, initAuth } = useAuth()

  useEffect(() => {
    initAuth()
  }, [])

  // Bounce non-admins back to home
  useEffect(() => {
    if (currentProfile && !isAdmin) {
      navigate('/', { replace: true })
    }
  }, [currentProfile, isAdmin, navigate])

  if (!currentProfile) {
    return (
      <div className="min-h-screen bg-swu-bg flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <ShieldCheck size={32} className="mx-auto text-swu-muted" />
          <p className="text-swu-text font-semibold">Inicie sesión para acceder al panel admin</p>
          <button
            onClick={() => navigate('/profile')}
            className="px-4 py-2 rounded-lg bg-swu-accent text-white text-sm font-semibold"
          >
            Iniciar sesión
          </button>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    // Will redirect via effect; this is a brief flicker fallback
    return null
  }

  return (
    <div className="min-h-screen bg-swu-bg text-swu-text flex">
      {/* ── Minimalist sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 bg-black/30 border-r border-swu-border/40 min-h-screen">
        {/* Header */}
        <div className="px-4 py-5 border-b border-swu-border/40">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-swu-accent" />
            <span className="text-[10px] tracking-[0.3em] uppercase text-swu-muted font-mono">
              Cuartel General
            </span>
          </div>
          <h1 className="mt-1 text-base font-bold text-swu-text">Admin</h1>
        </div>

        {/* Back to app */}
        <button
          onClick={() => navigate('/')}
          className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-swu-muted hover:text-swu-text hover:bg-swu-surface/40 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Volver a la app</span>
        </button>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-swu-accent/15 text-swu-accent'
                    : 'text-swu-muted hover:text-swu-text hover:bg-swu-surface/40'
                }`
              }
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-swu-border/40">
          <p className="text-[10px] text-swu-muted truncate">
            {currentProfile.name}
          </p>
          <p className="text-[9px] text-swu-muted/60 font-mono mt-0.5">ADMIN</p>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-black/40 backdrop-blur border-b border-swu-border/40">
        <div className="px-3 py-2.5 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs text-swu-muted"
          >
            <ArrowLeft size={14} />
            <span>App</span>
          </button>
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-swu-accent" />
            <span className="text-xs font-bold text-swu-text">Admin</span>
          </div>
          <div className="w-12" />
        </div>
        {/* Mobile nav (horizontal scroll) */}
        <nav className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-none">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-swu-accent/15 text-swu-accent'
                    : 'text-swu-muted hover:text-swu-text'
                }`
              }
            >
              <item.icon size={12} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 pt-24 md:pt-0 px-4 md:px-6 py-6 max-w-6xl">
        <Outlet />
      </main>
    </div>
  )
}

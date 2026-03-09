import { useState, useRef, useEffect } from 'react'
import { Settings, X, Hexagon, ChevronLeft } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { NotificationBell } from '../ui/NotificationBell'

const menuItems = [
  { label: 'Configuración', path: '/settings' },
  { label: 'Exportar / Importar', path: '/settings/export' },
  { label: 'Feedback', path: '/settings/feedback' },
  { label: 'Legal / Privacidad', path: '/settings/legal' },
]

/* Maps route to a page title for desktop breadcrumb */
function getPageTitle(pathname: string): string {
  if (pathname === '/') return 'Base'
  if (pathname.startsWith('/play')) return 'Duelo'
  if (pathname.startsWith('/events')) return 'Torneos'
  if (pathname.startsWith('/rank')) return 'Consejo Jedi'
  if (pathname.startsWith('/arena')) return 'Holocrón'
  if (pathname.startsWith('/melee')) return 'Circuito Melee'
  if (pathname.startsWith('/profile')) return 'Mi Perfil'
  if (pathname.startsWith('/cards')) return 'Buscar Cartas'
  if (pathname.startsWith('/decks')) return 'Mis Decks'
  if (pathname.startsWith('/collection')) return 'Mi Botín'
  if (pathname.startsWith('/explore')) return 'Contrabando'
  if (pathname.startsWith('/utilities')) return 'Utilidades'
  if (pathname.startsWith('/misiones')) return 'Misiones'
  if (pathname.startsWith('/espionaje')) return 'Espionaje'
  if (pathname.startsWith('/settings')) return 'Configuración'
  return 'HOLOCRON SWU'
}

export function Header() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const isHome = location.pathname === '/'
  const pageTitle = getPageTitle(location.pathname)

  return (
    <header className="sticky top-0 z-50 bg-swu-surface shadow-[0_4px_10px_#111118] px-4 lg:px-6 py-3 flex items-center justify-between">
      {/* Left side: Base button (on inner pages) or logo (on home) */}
      <div className="flex items-center gap-2">
        {isHome ? (
          <>
            {/* Mobile: logo */}
            <div className="lg:hidden flex items-center gap-2">
              <span className="text-lg font-extrabold text-swu-amber tracking-tight">HOLOCRON</span>
              <span className="text-base font-semibold text-swu-text">SWU</span>
            </div>
            {/* Desktop: page title */}
            <div className="hidden lg:flex items-center gap-3">
              <h1 className="text-lg font-bold text-swu-text">{pageTitle}</h1>
            </div>
          </>
        ) : (
          <>
            {/* Mobile: Back to Base button */}
            <button
              onClick={() => navigate('/')}
              className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-swu-bg neu-inset text-swu-muted hover:text-swu-accent active:scale-95 transition-all"
            >
              <Hexagon size={16} className="text-swu-accent" />
              <span className="text-xs font-bold tracking-wide">Base</span>
            </button>
            {/* Mobile: page title next to base button */}
            <span className="lg:hidden text-sm font-semibold text-swu-text ml-1">{pageTitle}</span>
            {/* Desktop: breadcrumb style */}
            <div className="hidden lg:flex items-center gap-2">
              <button
                onClick={() => navigate('/')}
                className="text-sm text-swu-muted hover:text-swu-accent transition-colors font-medium"
              >
                Base
              </button>
              <ChevronLeft size={14} className="text-swu-muted rotate-180" />
              <h1 className="text-lg font-bold text-swu-text">{pageTitle}</h1>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen(!open)}
          className="p-1.5 rounded-lg text-swu-muted hover:text-swu-text hover:bg-swu-surface-hover transition-colors"
          aria-label="Settings"
        >
          {open ? <X size={22} /> : <Settings size={22} />}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-52 bg-swu-surface rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setOpen(false) }}
                className="w-full text-left px-4 py-3 text-sm font-medium text-swu-text hover:bg-swu-surface-hover transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
      </div>
    </header>
  )
}

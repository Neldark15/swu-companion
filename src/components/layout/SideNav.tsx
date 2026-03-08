import { useLocation, useNavigate } from 'react-router-dom'
import { Hexagon, Layers, BookOpen, Dice6, Package, Skull, type LucideIcon } from 'lucide-react'

type NavItem =
  | { id: string; label: string; sub: string; icon: LucideIcon; img?: undefined }
  | { id: string; label: string; sub: string; img: string; icon?: undefined }

const mainNav: NavItem[] = [
  { id: '/', label: 'Base', sub: 'Centro de mando', icon: Hexagon },
  { id: '/arena', label: 'Holocrón', sub: 'Registro de duelos', img: '/jugar-icon.png' },
  { id: '/events', label: 'Eventos', sub: 'Torneos', img: '/eventos-icon.png' },
  { id: '/rank', label: 'Consejo', sub: 'Leaderboard', img: '/consejo-icon.png' },
  { id: '/profile', label: 'Holocrón', sub: 'Mi perfil', img: '/holocron-icon.png' },
]

const secondaryNav: NavItem[] = [
  { id: '/cards', label: 'Buscar Cartas', sub: 'Base de datos', icon: Layers },
  { id: '/decks', label: 'Mis Decks', sub: 'Constructor', icon: BookOpen },
  { id: '/collection', label: 'Mi Botín', sub: 'Colección', icon: Package },
  { id: '/explore', label: 'Contrabando', sub: 'Explorar', icon: Skull },
  { id: '/utilities', label: 'Utilidades', sub: 'Herramientas', icon: Dice6 },
]

export function SideNav() {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const renderItem = (item: NavItem) => {
    const active = isActive(item.id)
    return (
      <button
        key={item.id}
        onClick={() => navigate(item.id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group ${
          active
            ? 'bg-swu-accent/15 text-swu-accent border border-swu-accent/30'
            : 'text-swu-muted hover:bg-swu-surface-hover hover:text-swu-text border border-transparent'
        }`}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          active ? 'bg-swu-accent/20' : 'bg-swu-surface group-hover:bg-swu-surface-hover'
        }`}>
          {item.img ? (
            <img
              src={item.img}
              alt={item.label}
              className={`w-5 h-5 object-contain transition-opacity ${active ? 'opacity-100 brightness-125' : 'opacity-60 group-hover:opacity-80'}`}
            />
          ) : item.icon ? (
            <item.icon size={18} strokeWidth={active ? 2.5 : 2} />
          ) : null}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold truncate ${active ? 'text-swu-accent' : ''}`}>{item.label}</div>
          <div className="text-[10px] text-swu-muted font-mono tracking-wider truncate">{item.sub}</div>
        </div>
        {active && <div className="w-1 h-6 rounded-full bg-swu-accent flex-shrink-0" />}
      </button>
    )
  }

  return (
    <aside className="hidden lg:flex flex-col w-64 xl:w-72 bg-swu-surface border-r border-swu-border min-h-screen fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3 border-b border-swu-border">
        <img src="/swu-logo-title.png" alt="SWU" className="w-10 h-12 object-contain" />
        <div>
          <h1 className="text-base font-extrabold text-swu-amber tracking-tight leading-tight">
            SWU Companion
          </h1>
          <p className="text-[9px] tracking-[0.2em] uppercase text-swu-muted font-mono">
            Centro de Mando
          </p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2">
          <span className="text-[9px] text-swu-muted/60 font-mono tracking-[0.25em] uppercase">Principal</span>
        </div>
        {mainNav.map(renderItem)}

        <div className="px-3 mt-5 mb-2">
          <span className="text-[9px] text-swu-muted/60 font-mono tracking-[0.25em] uppercase">Sistemas</span>
        </div>
        {secondaryNav.map(renderItem)}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-swu-border">
        <p className="text-[9px] text-swu-muted/40 font-mono tracking-widest text-center">
          SWU COMPANION v1.0
        </p>
      </div>
    </aside>
  )
}

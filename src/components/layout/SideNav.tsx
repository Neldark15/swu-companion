import { useLocation, useNavigate } from 'react-router-dom'
import { Hexagon, Swords, ShieldCheck, Megaphone } from 'lucide-react'
import {
  DatapadIcon, MedalIcon, MandoTrophyIcon, CargoIcon, BountyIcon,
  DeckCardsIcon, SpyIcon, DeathStarIcon, BeskarIcon, HolonetIcon,
  ChanceCubeIcon, RebelIcon, StarfighterIcon,
} from '../SWIcons'
import { NotificationBell } from '../ui/NotificationBell'
import { useAuth } from '../../hooks/useAuth'
import type { ComponentType } from 'react'

type IconComp = ComponentType<{ size?: number; className?: string; strokeWidth?: number }>

type NavItem =
  | { id: string; label: string; sub: string; icon: IconComp; img?: undefined }
  | { id: string; label: string; sub: string; img: string; icon?: undefined }

const mainNav: NavItem[] = [
  { id: '/', label: 'Base', sub: 'Centro de mando', icon: Hexagon },
  { id: '/play', label: 'Duelo', sub: 'Tracker en vivo', icon: Swords },
  { id: '/arena', label: 'Holocrón', sub: 'Registro de duelos', icon: DatapadIcon },
  { id: '/melee', label: 'Circuito', sub: 'Melee.gg', icon: MedalIcon },
  { id: '/events', label: 'Torneo', sub: 'Eventos organizados', icon: MandoTrophyIcon },
  { id: '/profile', label: 'Mi Perfil', sub: 'Holocrón', img: '/holocron-icon.png' },
]

const secondaryNav: NavItem[] = [
  { id: '/collection', label: 'Mi Botín', sub: 'Colección', icon: CargoIcon },
  { id: '/explore', label: 'Contrabando', sub: 'Explorar', icon: BountyIcon },
  { id: '/espionaje', label: 'Espionaje', sub: 'Transmisiones', icon: SpyIcon },
  { id: '/misiones', label: 'Misiones', sub: 'Órdenes del Día', icon: DeathStarIcon },
  { id: '/decks', label: 'Mis Decks', sub: 'Constructor', icon: DeckCardsIcon },
  { id: '/galaxy', label: 'La Galaxia', sub: 'Explorador Global', icon: StarfighterIcon },
  { id: '/community', label: 'Comunidades', sub: 'Galaxia', icon: RebelIcon },
  { id: '/rank', label: 'Consejo Jedi', sub: 'Leaderboard', icon: BeskarIcon },
  { id: '/cards', label: 'Buscar Cartas', sub: 'Base de datos', icon: HolonetIcon },
  { id: '/utilities', label: 'Utilidades', sub: 'Herramientas', icon: ChanceCubeIcon },
]

export function SideNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

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
            <item.icon size={18} />
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
    <aside className="hidden lg:flex flex-col w-64 xl:w-72 bg-swu-surface shadow-[4px_0_10px_#111118] min-h-screen fixed left-0 top-0 z-40">
      {/* Logo + Notification Bell */}
      <div className="px-5 py-5 flex items-center gap-3 border-b border-swu-border">
        <img src="/swu-logo-title.png" alt="SWU" className="w-10 h-12 object-contain" />
        <div className="flex-1">
          <h1 className="text-base font-extrabold text-swu-amber tracking-tight leading-tight">
            HOLOCRON SWU
          </h1>
          <p className="text-[9px] tracking-[0.2em] uppercase text-swu-muted font-mono">
            Centro de Mando
          </p>
        </div>
        <NotificationBell />
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

        {/* Admin-only quick utility (lives in Sistemas section but only visible to admins) */}
        {isAdmin && (
          <button
            onClick={() => navigate('/admin/announcements')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group ${
              location.pathname === '/admin/announcements'
                ? 'bg-swu-accent/15 text-swu-accent border border-swu-accent/30'
                : 'text-swu-muted hover:bg-swu-surface-hover hover:text-swu-text border border-transparent'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              location.pathname === '/admin/announcements' ? 'bg-swu-accent/20' : 'bg-swu-surface group-hover:bg-swu-surface-hover'
            }`}>
              <Megaphone size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold truncate ${location.pathname === '/admin/announcements' ? 'text-swu-accent' : ''}`}>Anuncios</div>
              <div className="text-[10px] text-swu-muted font-mono tracking-wider truncate">Centro de comunicaciones</div>
            </div>
          </button>
        )}

        {isAdmin && (
          <>
            <div className="px-3 mt-5 mb-2">
              <span className="text-[9px] text-swu-amber/70 font-mono tracking-[0.25em] uppercase">Cuartel General</span>
            </div>
            <button
              onClick={() => navigate('/admin')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group ${
                location.pathname.startsWith('/admin') && location.pathname !== '/admin/announcements'
                  ? 'bg-swu-amber/15 text-swu-amber border border-swu-amber/30'
                  : 'text-swu-muted hover:bg-swu-surface-hover hover:text-swu-text border border-transparent'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                location.pathname.startsWith('/admin') && location.pathname !== '/admin/announcements' ? 'bg-swu-amber/20' : 'bg-swu-surface group-hover:bg-swu-surface-hover'
              }`}>
                <ShieldCheck size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold truncate ${location.pathname.startsWith('/admin') && location.pathname !== '/admin/announcements' ? 'text-swu-amber' : ''}`}>Admin</div>
                <div className="text-[10px] text-swu-muted font-mono tracking-wider truncate">Panel de control</div>
              </div>
            </button>
          </>
        )}
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

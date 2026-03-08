import { useLocation, useNavigate } from 'react-router-dom'
import { Hexagon, type LucideIcon } from 'lucide-react'
import { useUIStore } from '../../hooks/useUIStore'

type TabDef =
  | { id: string; label: string; icon: LucideIcon; img?: undefined }
  | { id: string; label: string; img: string; icon?: undefined }

const tabs: TabDef[] = [
  { id: '/', label: 'Base', icon: Hexagon },
  { id: '/play', label: 'Duelo', img: '/jugar-icon.png' },
  { id: '/events', label: 'Eventos', img: '/eventos-icon.png' },
  { id: '/rank', label: 'Consejo', img: '/consejo-icon.png' },
  { id: '/profile', label: 'Holocrón', img: '/holocron-icon.png' },
]

export function TabBar() {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const hideTabBar = useUIStore((s) => s.hideTabBar)

  // Hide tab bar on tracker page or when game is fullscreen
  if (location.pathname.includes('/play/tracker/')) return null
  if (hideTabBar) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-swu-surface border-t border-swu-border pb-safe lg:hidden">
      <div className="max-w-lg mx-auto flex justify-around items-center py-1.5">
        {tabs.map((tab) => {
          const active = isActive(tab.id)
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${
                active ? 'text-swu-accent' : 'text-swu-muted'
              }`}
            >
              {tab.img ? (
                <img
                  src={tab.img}
                  alt={tab.label}
                  className={`w-[22px] h-[22px] object-contain transition-opacity ${
                    active ? 'opacity-100 brightness-125' : 'opacity-50'
                  }`}
                />
              ) : tab.icon ? (
                <tab.icon size={22} strokeWidth={active ? 2.5 : 2} />
              ) : null}
              <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
              {active && <div className="w-5 h-0.5 bg-swu-accent rounded-full mt-0.5" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

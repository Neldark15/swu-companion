import { useLocation, useNavigate } from 'react-router-dom'
import { Hexagon, Swords, Calendar, BookOpen, Shield } from 'lucide-react'

const tabs = [
  { id: '/', label: 'Base', icon: Hexagon },
  { id: '/play', label: 'Jugar', icon: Swords },
  { id: '/events', label: 'Eventos', icon: Calendar },
  { id: '/decks', label: 'Decks', icon: BookOpen },
  { id: '/profile', label: 'Holored', icon: Shield },
]

export function TabBar() {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  // Hide tab bar on tracker page (face-to-face play)
  if (location.pathname.includes('/play/tracker/')) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-swu-surface border-t border-swu-border pb-safe">
      <div className="max-w-lg mx-auto flex justify-around items-center py-1.5">
        {tabs.map((tab) => {
          const active = isActive(tab.id)
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${
                active ? 'text-swu-accent' : 'text-swu-muted'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
              {active && <div className="w-5 h-0.5 bg-swu-accent rounded-full mt-0.5" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

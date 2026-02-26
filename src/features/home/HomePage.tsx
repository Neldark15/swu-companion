import { useNavigate } from 'react-router-dom'
import { Swords, Trophy, Layers, Dice6 } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'

const quickActions = [
  { icon: Swords, label: 'Nueva Partida', color: 'text-swu-green', bg: 'bg-swu-green/10', to: '/play' },
  { icon: Trophy, label: 'Torneo Casero', color: 'text-swu-amber', bg: 'bg-swu-amber/10', to: '/events/tournament' },
  { icon: Layers, label: 'Buscar Cartas', color: 'text-swu-accent', bg: 'bg-swu-accent/10', to: '/cards' },
  { icon: Dice6, label: 'Utilidades', color: 'text-purple-400', bg: 'bg-purple-500/10', to: '/utilities' },
]

const news = [
  { title: 'Nuevo set "Twilight of the Republic" anunciado', date: '25 Feb 2026', tag: 'Noticias' },
  { title: 'Cambios en reglas de torneo para Premier', date: '22 Feb 2026', tag: 'Reglas' },
  { title: 'Store Championship: temporada Q1 abierta', date: '18 Feb 2026', tag: 'Eventos' },
]

export function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="p-4 space-y-5">
      {/* Set Banner */}
      <div className="bg-gradient-to-br from-swu-accent/20 to-swu-amber/10 rounded-2xl p-6 border border-swu-border">
        <p className="text-[11px] text-swu-amber font-bold tracking-widest uppercase">Set Actual</p>
        <h2 className="text-2xl font-extrabold text-swu-text mt-1">Twilight of the Republic</h2>
        <p className="text-sm text-swu-muted mt-1">252 cartas · Lanzamiento: Mar 2026</p>
        <button
          onClick={() => navigate('/cards')}
          className="mt-3 bg-swu-accent text-white text-sm font-semibold px-5 py-2 rounded-lg active:scale-95 transition-transform"
        >
          Ver Cartas del Set
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        {quickActions.map((a) => {
          const Icon = a.icon
          return (
            <button
              key={a.label}
              onClick={() => navigate(a.to)}
              className={`${a.bg} border border-swu-border rounded-xl p-4 flex items-center gap-3 active:scale-[0.97] transition-transform`}
            >
              <Icon size={22} className={a.color} />
              <span className={`font-semibold text-sm ${a.color}`}>{a.label}</span>
            </button>
          )
        })}
      </div>

      {/* News Feed */}
      <div>
        <h3 className="text-sm font-bold text-swu-text mb-3">Noticias</h3>
        <div className="space-y-2">
          {news.map((n) => (
            <div key={n.title} className="bg-swu-surface rounded-xl p-3 border border-swu-border">
              <div className="flex items-center justify-between mb-1">
                <Badge>{n.tag}</Badge>
                <span className="text-[11px] text-swu-muted">{n.date}</span>
              </div>
              <p className="text-sm font-medium text-swu-text">{n.title}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

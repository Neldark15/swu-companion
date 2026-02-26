import { useNavigate } from 'react-router-dom'
import { Swords, Trophy, Layers, Dice6, ExternalLink } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'

const quickActions = [
  { icon: Swords, label: 'Nueva Partida', color: 'text-swu-green', bg: 'bg-swu-green/10', to: '/play' },
  { icon: Trophy, label: 'Torneo Casero', color: 'text-swu-amber', bg: 'bg-swu-amber/10', to: '/events/tournament' },
  { icon: Layers, label: 'Buscar Cartas', color: 'text-swu-accent', bg: 'bg-swu-accent/10', to: '/cards' },
  { icon: Dice6, label: 'Utilidades', color: 'text-purple-400', bg: 'bg-purple-500/10', to: '/utilities' },
]

const news = [
  {
    title: 'A Lawless Time — Nuevo set en Marzo 2026',
    date: '26 Feb 2026',
    tag: 'Set Nuevo',
    tagColor: 'amber' as const,
    summary: 'Set 7 con 260+ cartas, tokens de Crédito y cartas multi-aspecto. Pre-release: 6 Mar.',
    url: 'https://starwarsunlimited.com/articles/a-lawless-time',
  },
  {
    title: 'Galactics 2026 — Boletos disponibles',
    date: '17 Feb 2026',
    tag: 'Eventos',
    tagColor: 'green' as const,
    summary: 'Boletos para el Galactic Championship a la venta. Promos exclusivas para compradores early bird.',
    url: 'https://starwarsunlimited.com/articles/tickets-to-galactics',
  },
  {
    title: 'Roadmap 2026: 3 sets + 4 mazos Twin Suns',
    date: '10 Feb 2026',
    tag: 'Roadmap',
    tagColor: 'accent' as const,
    summary: 'A Lawless Time (Mar), Ashes of the Empire (Jul), Homeworlds (Nov) + mazos precons Twin Suns.',
    url: 'https://icv2.com/articles/news/view/61111/fantasy-flight-reveals-2026-star-wars-unlimited-releases',
  },
  {
    title: 'Secrets of Power — Metagame update',
    date: '2 Feb 2026',
    tag: 'Meta',
    tagColor: 'purple' as const,
    summary: 'Análisis del meta actual con SEC. Los líderes más jugados y decks tier 1.',
  },
  {
    title: 'Store Championship Q1 — Temporada abierta',
    date: '20 Ene 2026',
    tag: 'OP',
    tagColor: 'default' as const,
    summary: 'Temporada de Store Championships Q1 2026 en curso. Consulta tu tienda local.',
  },
]

const tagVariant: Record<string, 'amber' | 'green' | 'accent' | 'purple' | 'default'> = {
  amber: 'amber',
  green: 'green',
  accent: 'accent',
  purple: 'purple',
  default: 'default',
}

export function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="p-4 space-y-5">
      {/* Set Banner */}
      <div className="bg-gradient-to-br from-swu-amber/20 to-swu-red/10 rounded-2xl p-6 border border-swu-amber/30">
        <p className="text-[11px] text-swu-amber font-bold tracking-widest uppercase">Próximo Set</p>
        <h2 className="text-2xl font-extrabold text-swu-text mt-1">A Lawless Time</h2>
        <p className="text-sm text-swu-muted mt-1">260+ cartas · Lanzamiento: 13 Mar 2026</p>
        <div className="flex gap-2 mt-1.5">
          <span className="text-[10px] bg-swu-amber/20 text-swu-amber px-2 py-0.5 rounded-full font-bold">Tokens de Crédito</span>
          <span className="text-[10px] bg-swu-accent/20 text-swu-accent px-2 py-0.5 rounded-full font-bold">Multi-Aspecto</span>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => navigate('/cards')}
            className="bg-swu-accent text-white text-sm font-semibold px-5 py-2 rounded-lg active:scale-95 transition-transform"
          >
            Ver Cartas
          </button>
          <a
            href="https://starwarsunlimited.com/articles/a-lawless-time"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-swu-surface text-swu-muted text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 active:scale-95 transition-transform border border-swu-border"
          >
            Info <ExternalLink size={12} />
          </a>
        </div>
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
        <h3 className="text-sm font-bold text-swu-text mb-3">Noticias y Actualizaciones</h3>
        <div className="space-y-2">
          {news.map((n) => (
            <div
              key={n.title}
              className="bg-swu-surface rounded-xl p-3 border border-swu-border"
              onClick={() => n.url && window.open(n.url, '_blank')}
              role={n.url ? 'button' : undefined}
              style={n.url ? { cursor: 'pointer' } : undefined}
            >
              <div className="flex items-center justify-between mb-1">
                <Badge variant={tagVariant[n.tagColor]}>{n.tag}</Badge>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-swu-muted">{n.date}</span>
                  {n.url && <ExternalLink size={10} className="text-swu-muted" />}
                </div>
              </div>
              <p className="text-sm font-medium text-swu-text">{n.title}</p>
              <p className="text-xs text-swu-muted mt-1">{n.summary}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

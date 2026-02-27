import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Swords, Trophy, Layers, Dice6, ExternalLink, User, LogIn, Newspaper, Settings2, Loader2, RefreshCw } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { useAuth } from '../../hooks/useAuth'
import { getNews, type NewsItem } from '../../services/news'

const quickActions = [
  { icon: Swords, label: 'Nueva Partida', color: 'text-swu-green', bg: 'bg-swu-green/10', to: '/play' },
  { icon: Trophy, label: 'Torneo', color: 'text-swu-amber', bg: 'bg-swu-amber/10', to: '/events/tournament' },
  { icon: Layers, label: 'Buscar Cartas', color: 'text-swu-accent', bg: 'bg-swu-accent/10', to: '/cards' },
  { icon: Dice6, label: 'Utilidades', color: 'text-purple-400', bg: 'bg-purple-500/10', to: '/utilities' },
]

const tagVariant: Record<string, 'amber' | 'green' | 'accent' | 'purple' | 'default'> = {
  amber: 'amber', green: 'green', accent: 'accent', purple: 'purple', default: 'default',
}

// Auto-refresh interval: 2 minutes
const REFRESH_INTERVAL = 2 * 60 * 1000

export function HomePage() {
  const navigate = useNavigate()
  const { currentProfile, isAdmin } = useAuth()
  const [news, setNews] = useState<NewsItem[]>([])
  const [loadingNews, setLoadingNews] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadNews = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoadingNews(true)

    const items = await getNews(15)
    setNews(items)

    setLoadingNews(false)
    setRefreshing(false)
  }

  // Initial load + auto-refresh
  useEffect(() => {
    loadNews()
    const interval = setInterval(() => loadNews(), REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="p-4 space-y-5">
      {/* Profile / Login Button */}
      {currentProfile ? (
        <button
          onClick={() => navigate('/profile')}
          className="w-full bg-swu-surface border border-swu-border rounded-xl p-3 flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="w-10 h-10 rounded-full bg-swu-accent/20 flex items-center justify-center text-xl">
            {currentProfile.avatar || '🎮'}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-swu-text">{currentProfile.name}</p>
            <p className="text-[11px] text-swu-muted">Ver mi perfil</p>
          </div>
          <User size={18} className="text-swu-muted" />
        </button>
      ) : (
        <button
          onClick={() => navigate('/profile')}
          className="w-full bg-gradient-to-r from-swu-accent/20 to-swu-amber/20 border border-swu-accent/40 rounded-xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="w-10 h-10 rounded-full bg-swu-accent/30 flex items-center justify-center">
            <LogIn size={20} className="text-swu-accent" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-swu-accent">Iniciar Sesión</p>
            <p className="text-[11px] text-swu-muted">Ingrese o cree su cuenta para guardar progreso</p>
          </div>
        </button>
      )}

      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden border border-swu-amber/30">
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/20 z-10" />
        <img
          src="https://images.unsplash.com/photo-1608889175157-718b6205a50a?w=800&h=400&fit=crop"
          alt="SWU"
          className="w-full h-48 object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <div className="absolute bottom-0 left-0 right-0 p-5 z-20">
          <p className="text-[11px] text-swu-amber font-bold tracking-widest uppercase">Próximo Set</p>
          <h2 className="text-2xl font-extrabold text-white mt-1">A Lawless Time</h2>
          <p className="text-sm text-gray-300 mt-1">260+ cartas · Lanzamiento: 13 Mar 2026</p>
          <div className="flex gap-2 mt-1.5">
            <span className="text-[10px] bg-swu-amber/30 text-swu-amber px-2 py-0.5 rounded-full font-bold">Crédito</span>
            <span className="text-[10px] bg-swu-accent/30 text-swu-accent px-2 py-0.5 rounded-full font-bold">Multi-Aspecto</span>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => navigate('/cards')} className="bg-swu-accent text-white text-sm font-semibold px-5 py-2 rounded-lg active:scale-95 transition-transform">Ver Cartas</button>
            <a href="https://starwarsunlimited.com/articles/a-lawless-time" target="_blank" rel="noopener noreferrer"
              className="bg-white/10 backdrop-blur text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 active:scale-95 transition-transform border border-white/20">
              Info <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        {quickActions.map((a) => {
          const Icon = a.icon
          return (
            <button key={a.label} onClick={() => navigate(a.to)}
              className={`${a.bg} border border-swu-border rounded-xl p-4 flex items-center gap-3 active:scale-[0.97] transition-transform`}>
              <Icon size={22} className={a.color} />
              <span className={`font-semibold text-sm ${a.color}`}>{a.label}</span>
            </button>
          )
        })}
      </div>

      {/* News Feed */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-swu-text">Noticias y Actualizaciones</h3>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => navigate('/news/manage')}
                className="p-1.5 rounded-lg bg-swu-accent/10 text-swu-accent active:scale-95 transition-transform"
                title="Gestionar noticias"
              >
                <Settings2 size={14} />
              </button>
            )}
            <button
              onClick={() => loadNews(true)}
              disabled={refreshing}
              className="p-1.5 rounded-lg bg-swu-surface text-swu-muted active:scale-95 transition-transform"
              title="Actualizar"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {loadingNews ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="text-swu-accent animate-spin" />
          </div>
        ) : news.length === 0 ? (
          <div className="bg-swu-surface rounded-xl border border-swu-border p-6 text-center">
            <Newspaper size={32} className="mx-auto text-swu-muted mb-2" />
            <p className="text-sm text-swu-muted">No hay noticias por el momento.</p>
            <p className="text-xs text-swu-muted mt-1">Las noticias se actualizan automáticamente.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {news.map((n) => (
              <div key={n.id} className="bg-swu-surface rounded-xl border border-swu-border overflow-hidden"
                onClick={() => n.url && window.open(n.url, '_blank')} role={n.url ? 'button' : undefined}
                style={n.url ? { cursor: 'pointer' } : undefined}>
                {n.image_url && (
                  <img src={n.image_url} alt="" className="w-full h-28 object-cover" loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                )}
                <div className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant={tagVariant[n.tag_color] || 'default'}>{n.tag}</Badge>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-swu-muted">{formatDate(n.created_at)}</span>
                      {n.url && <ExternalLink size={10} className="text-swu-muted" />}
                    </div>
                  </div>
                  <p className="text-sm font-medium text-swu-text">{n.title}</p>
                  <p className="text-xs text-swu-muted mt-1">{n.summary}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

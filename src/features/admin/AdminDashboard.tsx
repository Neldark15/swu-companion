import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, Newspaper, Trophy, Library, Bell, ScrollText,
  Activity, Globe, Award, Loader2, TrendingUp,
} from 'lucide-react'
import { getSystemStats, type SystemStats } from '../../services/adminService'

export function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSystemStats().then(s => {
      setStats(s)
      setLoading(false)
    })
  }, [])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-swu-text">Dashboard</h1>
        <p className="text-sm text-swu-muted mt-1">Resumen del sistema en producción</p>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-swu-muted text-sm">
          <Loader2 size={16} className="animate-spin" /> Cargando stats…
        </div>
      ) : stats ? (
        <>
          {/* KPI grid */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiTile icon={Users} label="Usuarios" value={stats.totalUsers} accent />
            <KpiTile icon={Award} label="Admins" value={stats.adminCount} />
            <KpiTile icon={Globe} label="Con país" value={stats.usersWithCountry} sub={`${stats.totalUsers ? Math.round(stats.usersWithCountry/stats.totalUsers*100) : 0}%`} />
            <KpiTile icon={TrendingUp} label="Player stats" value={stats.totalPlayerStats} />

            <KpiTile icon={Activity} label="Eventos activos" value={stats.activeEvents} />
            <KpiTile icon={Trophy} label="Eventos abiertos" value={stats.openEvents} />
            <KpiTile icon={Trophy} label="Eventos terminados" value={stats.finishedEvents} muted />
            <KpiTile icon={Newspaper} label="Noticias" value={stats.totalNewsPosts} />

            <KpiTile icon={Globe} label="Posts comunidad" value={stats.totalCommunityPosts} />
            <KpiTile icon={Award} label="Logros desbloqueados" value={stats.totalAchievementsUnlocked} />
          </section>

          {/* Quick links */}
          <section>
            <h2 className="text-sm font-semibold text-swu-text mb-3">Acciones rápidas</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <QuickLink to="/admin/users" icon={Users} title="Gestionar usuarios" desc={`${stats.totalUsers} registrados`} />
              <QuickLink to="/admin/news" icon={Newspaper} title="Publicar noticia" desc="News management" />
              <QuickLink to="/admin/events" icon={Trophy} title="Administrar eventos" desc={`${stats.activeEvents + stats.openEvents} en curso`} />
              <QuickLink to="/admin/cards" icon={Library} title="Base de cartas" desc="Refresh / cache" />
              <QuickLink to="/admin/push" icon={Bell} title="Enviar notificación" desc="Próximamente (Fase C)" />
              <QuickLink to="/admin/audit" icon={ScrollText} title="Auditoría" desc="Log de acciones admin" />
            </div>
          </section>
        </>
      ) : (
        <p className="text-sm text-swu-red">No se pudieron cargar las stats.</p>
      )}
    </div>
  )
}

function KpiTile({
  icon: Icon, label, value, sub, accent, muted,
}: {
  icon: typeof Users
  label: string
  value: number
  sub?: string
  accent?: boolean
  muted?: boolean
}) {
  return (
    <div className={`rounded-xl p-3 border ${
      accent
        ? 'bg-swu-accent/10 border-swu-accent/30'
        : muted
        ? 'bg-swu-surface/40 border-swu-border/40'
        : 'bg-swu-surface border-swu-border'
    }`}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-swu-muted">
        <Icon size={12} />
        <span>{label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={`text-2xl font-extrabold font-mono ${accent ? 'text-swu-accent' : 'text-swu-text'}`}>
          {value.toLocaleString()}
        </span>
        {sub && <span className="text-[10px] text-swu-muted">{sub}</span>}
      </div>
    </div>
  )
}

function QuickLink({
  to, icon: Icon, title, desc,
}: {
  to: string
  icon: typeof Users
  title: string
  desc: string
}) {
  return (
    <Link
      to={to}
      className="bg-swu-surface rounded-xl p-4 border border-swu-border hover:border-swu-accent/40 transition-colors group"
    >
      <Icon size={20} className="text-swu-accent mb-2" />
      <p className="text-sm font-semibold text-swu-text group-hover:text-swu-accent transition-colors">{title}</p>
      <p className="text-[11px] text-swu-muted mt-0.5">{desc}</p>
    </Link>
  )
}

import { useNavigate } from 'react-router-dom'
import { Swords, Trophy, Layers, Dice6, User, LogIn, BookOpen, BarChart3, ExternalLink } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

/*  ────────────────────────────────────────────
 *  BASE — Main cockpit / galactic command panel
 *  Star Wars ship console aesthetic:
 *    – angular borders, scan-line overlays
 *    – amber/cyan accent lighting on dark panels
 *    – technical font treatments
 *  ──────────────────────────────────────────── */

const mainSystems = [
  {
    icon: Swords,
    label: 'Nueva Partida',
    sub: 'Iniciar combate',
    color: 'swu-green',
    glow: 'shadow-[0_0_18px_rgba(74,222,128,0.15)]',
    to: '/play',
  },
  {
    icon: Trophy,
    label: 'Torneo',
    sub: 'Eventos organizados',
    color: 'swu-amber',
    glow: 'shadow-[0_0_18px_rgba(251,191,36,0.15)]',
    to: '/events/tournament',
  },
  {
    icon: Layers,
    label: 'Buscar Cartas',
    sub: 'Base de datos',
    color: 'swu-accent',
    glow: 'shadow-[0_0_18px_rgba(56,189,248,0.15)]',
    to: '/cards',
  },
  {
    icon: BookOpen,
    label: 'Mis Decks',
    sub: 'Constructor',
    color: 'swu-accent',
    glow: 'shadow-[0_0_18px_rgba(56,189,248,0.15)]',
    to: '/decks',
  },
  {
    icon: Dice6,
    label: 'Utilidades',
    sub: 'Herramientas',
    color: 'purple-400',
    glow: 'shadow-[0_0_18px_rgba(192,132,252,0.15)]',
    to: '/utilities',
  },
  {
    icon: BarChart3,
    label: 'Ranking',
    sub: 'Leaderboard mensual',
    color: 'swu-amber',
    glow: 'shadow-[0_0_18px_rgba(251,191,36,0.15)]',
    to: '/rank',
  },
]

export function HomePage() {
  const navigate = useNavigate()
  const { currentProfile } = useAuth()

  return (
    <div className="min-h-screen bg-swu-bg pb-28">
      {/* ── Cockpit Header ── */}
      <div className="relative overflow-hidden">
        {/* Scan-line overlay */}
        <div
          className="absolute inset-0 z-10 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.08) 2px, rgba(255,255,255,0.08) 4px)',
          }}
        />

        {/* Gradient backdrop */}
        <div className="relative z-0 bg-gradient-to-b from-swu-accent/10 via-swu-bg to-swu-bg px-5 pt-8 pb-4">
          {/* Top status bar */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] tracking-[0.35em] uppercase text-swu-amber font-bold">
                Sistema Operativo
              </p>
              <h1 className="text-2xl font-extrabold text-swu-text tracking-tight">
                B A S E
              </h1>
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-swu-green animate-pulse" />
              <span className="text-[10px] text-swu-green font-mono font-bold tracking-wider uppercase">
                Online
              </span>
            </div>
          </div>

          {/* Profile / Login Button */}
          {currentProfile ? (
            <button
              onClick={() => navigate('/profile')}
              className="w-full rounded-xl p-3 flex items-center gap-3 active:scale-[0.98] transition-transform
                         bg-swu-surface/60 backdrop-blur border border-swu-border/60"
            >
              <div className="w-11 h-11 rounded-lg bg-swu-accent/15 border border-swu-accent/30 flex items-center justify-center text-xl">
                {currentProfile.avatar || '🎮'}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-swu-text">{currentProfile.name}</p>
                <p className="text-[10px] text-swu-muted font-mono tracking-wider">PILOTO ACTIVO</p>
              </div>
              <User size={16} className="text-swu-muted" />
            </button>
          ) : (
            <button
              onClick={() => navigate('/profile')}
              className="w-full rounded-xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform
                         bg-gradient-to-r from-swu-accent/15 to-swu-amber/15 border border-swu-accent/30"
            >
              <div className="w-11 h-11 rounded-lg bg-swu-accent/20 border border-swu-accent/40 flex items-center justify-center">
                <LogIn size={20} className="text-swu-accent" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-swu-accent">Iniciar Sesión</p>
                <p className="text-[10px] text-swu-muted">Ingrese para sincronizar datos</p>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* ── Decorative separator ── */}
      <div className="px-5 py-1">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-gradient-to-r from-swu-amber/40 to-transparent" />
          <span className="text-[9px] text-swu-amber/60 font-mono tracking-[0.3em]">SISTEMAS</span>
          <div className="h-px flex-1 bg-gradient-to-l from-swu-amber/40 to-transparent" />
        </div>
      </div>

      {/* ── Main Systems Grid (ship console buttons) ── */}
      <div className="px-5 pt-2 grid grid-cols-2 gap-3">
        {mainSystems.map((sys) => {
          const Icon = sys.icon
          return (
            <button
              key={sys.label}
              onClick={() => navigate(sys.to)}
              className={`relative overflow-hidden rounded-xl border border-swu-border bg-swu-surface
                          p-4 flex flex-col gap-2.5 text-left
                          active:scale-[0.96] transition-all duration-150
                          ${sys.glow}`}
            >
              {/* Corner accent */}
              <div
                className={`absolute top-0 right-0 w-12 h-12 opacity-[0.07]`}
                style={{
                  background: `radial-gradient(circle at top right, currentColor 0%, transparent 70%)`,
                }}
              />
              {/* Corner notch decoration (ship panel style) */}
              <div className={`absolute top-0 left-0 w-5 h-0.5 bg-${sys.color}/40 rounded-br`} />
              <div className={`absolute top-0 left-0 w-0.5 h-5 bg-${sys.color}/40 rounded-br`} />

              <div className={`w-10 h-10 rounded-lg bg-${sys.color}/10 border border-${sys.color}/20 flex items-center justify-center`}>
                <Icon size={20} className={`text-${sys.color}`} />
              </div>
              <div>
                <p className={`text-sm font-bold text-${sys.color}`}>{sys.label}</p>
                <p className="text-[10px] text-swu-muted font-mono tracking-wider uppercase">{sys.sub}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Next Set Banner (compact ship-terminal style) ── */}
      <div className="px-5 pt-5">
        <div className="relative rounded-xl overflow-hidden border border-swu-amber/20 bg-swu-surface">
          {/* Scan line overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03] z-10"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.06) 2px, rgba(255,255,255,0.06) 4px)',
            }}
          />

          <div className="relative z-0 p-4">
            {/* Terminal header */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-swu-amber animate-pulse" />
              <span className="text-[9px] text-swu-amber font-mono tracking-[0.3em] uppercase font-bold">
                Transmisión entrante
              </span>
            </div>

            <h3 className="text-lg font-extrabold text-swu-text">A Lawless Time</h3>
            <p className="text-xs text-swu-muted mt-0.5 font-mono">260+ cartas · 13 MAR 2026</p>

            <div className="flex gap-1.5 mt-2">
              <span className="text-[9px] bg-swu-amber/15 text-swu-amber px-2 py-0.5 rounded font-bold border border-swu-amber/20">
                Crédito
              </span>
              <span className="text-[9px] bg-swu-accent/15 text-swu-accent px-2 py-0.5 rounded font-bold border border-swu-accent/20">
                Multi-Aspecto
              </span>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => navigate('/cards')}
                className="bg-swu-accent/15 text-swu-accent text-xs font-bold px-4 py-2 rounded-lg
                           border border-swu-accent/30 active:scale-95 transition-transform"
              >
                Ver Cartas
              </button>
              <a
                href="https://starwarsunlimited.com/articles/a-lawless-time"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-swu-surface text-swu-muted text-xs font-bold px-4 py-2 rounded-lg
                           border border-swu-border flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                Info <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer version indicator ── */}
      <div className="px-5 pt-5 pb-2 text-center">
        <p className="text-[9px] text-swu-muted/40 font-mono tracking-widest">
          SWU COMPANION v1.0 — EL SALVADOR
        </p>
      </div>
    </div>
  )
}

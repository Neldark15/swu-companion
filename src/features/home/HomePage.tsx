import { useNavigate } from 'react-router-dom'
import { User, LogIn, ExternalLink } from 'lucide-react'
import {
  DatapadIcon, MedalIcon, MandoTrophyIcon, CargoIcon, BountyIcon,
  DeckCardsIcon, SpyIcon, DeathStarIcon, BeskarIcon, HolonetIcon,
  ChanceCubeIcon,
} from '../../components/SWIcons'
import { useAuth } from '../../hooks/useAuth'

/* Avatar helper: detect image-based avatar vs emoji */
const swAvatarIds = ['chewbacca','r2d2','c3po','bb8','pilot','boba-fett','stormtrooper','darth-vader','phasma','kylo-ren','jedi-order','phoenix','rebel-alliance','galactic-empire','first-order','first-order-2','starfighter','sith-empire','rebel-alliance-2','jedi-order-2','new-republic','empire-gear','separatist','galactic-republic']

/*  ────────────────────────────────────────────
 *  BASE — Main cockpit / galactic command panel
 *  Star Wars ship console aesthetic
 *  ──────────────────────────────────────────── */

const mainSystems = [
  {
    icon: DatapadIcon,
    label: 'Holocrón de Duelos',
    sub: 'Registro de combate',
    textClass: 'text-swu-green',
    iconBg: 'bg-swu-green/10 border-swu-green/20',
    notchBg: 'bg-swu-green/40',
    glow: 'shadow-[0_0_18px_rgba(74,222,128,0.15)]',
    to: '/arena',
    auth: true,
  },
  {
    icon: MedalIcon,
    label: 'Circuito Melee',
    sub: 'Historial competitivo',
    textClass: 'text-swu-amber',
    iconBg: 'bg-swu-amber/10 border-swu-amber/20',
    notchBg: 'bg-swu-amber/40',
    glow: 'shadow-[0_0_18px_rgba(251,191,36,0.15)]',
    to: '/melee',
    auth: true,
  },
  {
    icon: MandoTrophyIcon,
    label: 'Eventos',
    sub: 'Torneos y más',
    textClass: 'text-swu-amber',
    iconBg: 'bg-swu-amber/10 border-swu-amber/20',
    notchBg: 'bg-swu-amber/40',
    glow: 'shadow-[0_0_18px_rgba(251,191,36,0.15)]',
    to: '/events',
    auth: true,
  },
  {
    icon: CargoIcon,
    label: 'Mi Botín',
    sub: 'Colección de cartas',
    textClass: 'text-swu-green',
    iconBg: 'bg-swu-green/10 border-swu-green/20',
    notchBg: 'bg-swu-green/40',
    glow: 'shadow-[0_0_18px_rgba(74,222,128,0.15)]',
    to: '/collection',
    auth: true,
  },
  {
    icon: BountyIcon,
    label: 'Contrabando',
    sub: 'Explorar colecciones',
    textClass: 'text-red-400',
    iconBg: 'bg-red-500/10 border-red-400/20',
    notchBg: 'bg-red-400/40',
    glow: 'shadow-[0_0_18px_rgba(248,113,113,0.15)]',
    to: '/explore',
    auth: true,
  },
  {
    icon: DeckCardsIcon,
    label: 'Mis Decks',
    sub: 'Constructor',
    textClass: 'text-swu-accent',
    iconBg: 'bg-swu-accent/10 border-swu-accent/20',
    notchBg: 'bg-swu-accent/40',
    glow: 'shadow-[0_0_18px_rgba(56,189,248,0.15)]',
    to: '/decks',
    auth: true,
  },
  {
    icon: SpyIcon,
    label: 'Espionaje',
    sub: 'Transmisiones sociales',
    textClass: 'text-indigo-400',
    iconBg: 'bg-indigo-500/10 border-indigo-400/20',
    notchBg: 'bg-indigo-400/40',
    glow: 'shadow-[0_0_18px_rgba(129,140,248,0.15)]',
    to: '/espionaje',
    auth: true,
  },
  {
    icon: DeathStarIcon,
    label: 'Misiones',
    sub: 'Órdenes del día',
    textClass: 'text-orange-400',
    iconBg: 'bg-orange-500/10 border-orange-400/20',
    notchBg: 'bg-orange-400/40',
    glow: 'shadow-[0_0_18px_rgba(251,146,60,0.15)]',
    to: '/misiones',
    auth: true,
  },
  {
    icon: BeskarIcon,
    label: 'Consejo Jedi',
    sub: 'Leaderboard mensual',
    textClass: 'text-swu-amber',
    iconBg: 'bg-swu-amber/10 border-swu-amber/20',
    notchBg: 'bg-swu-amber/40',
    glow: 'shadow-[0_0_18px_rgba(251,191,36,0.15)]',
    to: '/rank',
    auth: true,
  },
  {
    icon: HolonetIcon,
    label: 'Buscar Cartas',
    sub: 'Base de datos',
    textClass: 'text-swu-accent',
    iconBg: 'bg-swu-accent/10 border-swu-accent/20',
    notchBg: 'bg-swu-accent/40',
    glow: 'shadow-[0_0_18px_rgba(56,189,248,0.15)]',
    to: '/cards',
  },
  {
    icon: ChanceCubeIcon,
    label: 'Utilidades',
    sub: 'Herramientas',
    textClass: 'text-purple-400',
    iconBg: 'bg-purple-500/10 border-purple-400/20',
    notchBg: 'bg-purple-400/40',
    glow: 'shadow-[0_0_18px_rgba(192,132,252,0.15)]',
    to: '/utilities',
  },
]

export function HomePage() {
  const navigate = useNavigate()
  const { currentProfile } = useAuth()

  return (
    <div className="min-h-screen bg-swu-bg pb-8">
      {/* ── Cockpit Header with Banner ── */}
      <div className="relative overflow-hidden">
        {/* Banner background image */}
        <div className="absolute inset-0 z-0">
          <img
            src="/banner-base.png"
            alt=""
            className="w-full h-full object-cover object-center"
          />
          {/* Gradient fade over banner */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-swu-bg" />
        </div>

        {/* Scan-line overlay */}
        <div
          className="absolute inset-0 z-10 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.08) 2px, rgba(255,255,255,0.08) 4px)',
          }}
        />

        {/* Content over banner */}
        <div className="relative z-20 px-5 pt-8 pb-4">
          {/* Top status bar with logo */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <img src="/swu-logo-title.png" alt="SWU" className="w-16 h-20 object-contain drop-shadow-lg" />
              <div>
                <h1 className="text-lg font-extrabold text-white tracking-tight leading-tight drop-shadow-md">
                  HOLOCRON SWU
                </h1>
                <p className="text-[9px] tracking-[0.3em] uppercase text-swu-amber font-bold drop-shadow-sm">
                  Centro de Mando
                </p>
              </div>
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-2 bg-black/30 rounded-full px-2.5 py-1 backdrop-blur-sm">
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
              className="w-full rounded-xl p-3 flex items-center gap-3 active:scale-[0.98] transition-transform bg-swu-surface/60 backdrop-blur border border-swu-border/60"
            >
              <div className="w-11 h-11 rounded-lg bg-swu-accent/15 border border-swu-accent/30 flex items-center justify-center overflow-hidden">
                {swAvatarIds.includes(currentProfile.avatar)
                  ? <img src={`/avatars/${currentProfile.avatar}.png`} alt="" className="w-9 h-9 object-contain" />
                  : <span className="text-xl">{currentProfile.avatar || '🎮'}</span>
                }
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
              className="w-full rounded-xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform bg-gradient-to-r from-swu-accent/15 to-swu-amber/15 border border-swu-accent/30"
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
      <div className="px-5 pt-2 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
        {mainSystems.filter(s => !s.auth || currentProfile).map((sys) => {
          const Icon = sys.icon
          return (
            <button
              key={sys.label}
              onClick={() => navigate(sys.to)}
              className={`relative overflow-hidden rounded-xl border border-swu-border bg-swu-surface p-4 flex flex-col gap-2.5 text-left active:scale-[0.96] transition-all duration-150 ${sys.glow}`}
            >
              {/* Corner notch decoration (ship panel style) */}
              <div className={`absolute top-0 left-0 w-5 h-0.5 ${sys.notchBg} rounded-br`} />
              <div className={`absolute top-0 left-0 w-0.5 h-5 ${sys.notchBg} rounded-br`} />

              <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${sys.iconBg}`}>
                <Icon size={20} className={sys.textClass} />
              </div>
              <div>
                <p className={`text-sm font-bold ${sys.textClass}`}>{sys.label}</p>
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
                className="bg-swu-accent/15 text-swu-accent text-xs font-bold px-4 py-2 rounded-lg border border-swu-accent/30 active:scale-95 transition-transform"
              >
                Ver Cartas
              </button>
              <a
                href="https://starwarsunlimited.com/articles/a-lawless-time"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-swu-surface text-swu-muted text-xs font-bold px-4 py-2 rounded-lg border border-swu-border flex items-center gap-1.5 active:scale-95 transition-transform"
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

/**
 * BASE — el Centro de Mando.
 *
 * Consola de nave: paneles de esquinas cortadas, íconos en octágono y el
 * acento cian del HUD. Las formas viven en components/Hud.tsx y las utilidades
 * de recorte en index.css.
 *
 * ── Dos reglas que esta pantalla no rompe ─────────────────────────────
 *
 * 1. Ningún botón decorativo. Cada acción va a una ruta que existe.
 * 2. Ningún número inventado. Victorias, derrotas y racha salen de
 *    `playerStats` (gamification.ts). Si todavía no hay partidas registradas,
 *    la tira no se dibuja en vez de mostrar tres ceros.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ScanLine, Swords } from 'lucide-react'
import {
  DatapadIcon, MandoTrophyIcon, CargoIcon, BountyIcon,
  DeckCardsIcon, SpyIcon, DeathStarIcon, BeskarIcon, HolonetIcon,
  ChanceCubeIcon, KyberIcon,
} from '../../components/SWIcons'
import { HudPanel, HudCorners, HexIcon } from '../../components/Hud'
import { HUD_TEXTO, type HudTone } from '../../components/hudTones'
import { useAuth } from '../../hooks/useAuth'
import { calculateLevel } from '../../services/gamification'
import { db } from '../../services/db'
import { WelcomeHome } from './components/WelcomeHome'

/* Avatar helper: detect image-based avatar vs emoji */
const swAvatarIds = ['chewbacca','r2d2','c3po','bb8','pilot','boba-fett','stormtrooper','darth-vader','phasma','kylo-ren','jedi-order','phoenix','rebel-alliance','galactic-empire','first-order','first-order-2','starfighter','sith-empire','rebel-alliance-2','jedi-order-2','new-republic','empire-gear','separatist','galactic-republic']

interface Sistema {
  icon: typeof DatapadIcon
  label: string
  tone: HudTone
  to: string
  auth?: boolean
}

const mainSystems: Sistema[] = [
  { icon: DatapadIcon,     label: 'Holocrón',    tone: 'green',  to: '/arena',      auth: true },
  { icon: MandoTrophyIcon, label: 'Eventos',   tone: 'amber',  to: '/events',     auth: true },
  { icon: KyberIcon,       label: 'Meta',      tone: 'cyan',   to: '/meta' },
  { icon: CargoIcon,       label: 'Mi Botín',   tone: 'green',  to: '/collection', auth: true },
  { icon: DeckCardsIcon,   label: 'Mis Decks',           tone: 'green',  to: '/decks',      auth: true },
  { icon: BountyIcon,      label: 'Contrabando',  tone: 'red',    to: '/explore',    auth: true },
  { icon: SpyIcon,         label: 'Espionaje',         tone: 'purple', to: '/espionaje',  auth: true },
  { icon: DeathStarIcon,   label: 'Misiones',       tone: 'amber',  to: '/misiones',   auth: true },
  { icon: BeskarIcon,      label: 'Consejo Jedi',   tone: 'amber',  to: '/rank',       auth: true },
  { icon: HolonetIcon,     label: 'Buscar Cartas',         tone: 'cyan',   to: '/cards',      auth: true },
  { icon: ChanceCubeIcon,  label: 'Utilidades',          tone: 'purple', to: '/utilities' },
]

interface Marcador {
  label: string
  value: number | string
  tone: HudTone
  icon: typeof DatapadIcon
}

export function HomePage() {
  const navigate = useNavigate()
  const { currentProfile } = useAuth()

  /** Rango y marcador viajan juntos: salen de la misma fila y se pintan a la
   *  vez, así que un solo estado evita un render intermedio a medio llenar. */
  const [panel, setPanel] = useState<{
    rank: { name: string; color: string } | null
    marcadores: Marcador[] | null
  }>({ rank: null, marcadores: null })

  useEffect(() => {
    if (!currentProfile) return
    let vivo = true
    db.playerStats.get(currentProfile.id).then(stats => {
      if (!vivo || !stats) return
      const lvl = calculateLevel(stats.xp)
      const r = stats.currentStreak
      setPanel({
        rank: { name: lvl.rank.name, color: lvl.rank.color },
        // Sin partidas no hay marcador: tres ceros dicen «perdiste todo»
        // cuando en realidad todavía no jugaste nada.
        marcadores: stats.matchesPlayed > 0 ? [
          { label: 'Victorias', value: stats.wins,   tone: 'green', icon: BeskarIcon },
          { label: 'Derrotas',  value: stats.losses, tone: 'red',   icon: BountyIcon },
          // La racha viene con signo: positiva son victorias seguidas y
          // negativa derrotas seguidas. Mostrarla pelada diría «racha -4».
          {
            label: r < 0 ? 'Racha mala' : 'Racha',
            value: Math.abs(r),
            tone: r < 0 ? 'red' : 'amber',
            icon: MandoTrophyIcon,
          },
        ] : null,
      })
    }).catch(() => {})
    return () => { vivo = false }
  }, [currentProfile])

  const { rank: rankInfo, marcadores } = panel

  if (!currentProfile) return <WelcomeHome />

  const avatar = currentProfile.avatar

  return (
    <div className="min-h-screen bg-swu-bg pb-8">
      {/* ── Panel del comandante ── */}
      <div className="px-4 pt-4">
        <HudPanel tone="cyan" glow className="relative">
          <div className="relative overflow-hidden">
            {/* Arte de fondo, ya existente en la app. Se desvanece hacia la
                izquierda para que el texto siempre tenga contraste. */}
            <div className="absolute inset-0" aria-hidden>
              <img src="/banner-base.png" alt="" className="w-full h-full object-cover object-right" />
              <div className="absolute inset-0 bg-gradient-to-r from-swu-bg via-swu-bg/85 to-swu-bg/20" />
              <div
                className="absolute inset-0 opacity-[0.05]"
                style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.10) 2px, rgba(255,255,255,0.10) 4px)' }}
              />
            </div>
            <HudCorners tone="cyan" />

            <div className="relative p-4">
              <div className="flex items-start gap-3">
                <div className="clip-hud-sm bg-swu-cyan/40 p-px flex-shrink-0">
                  <div className="clip-hud-sm bg-black/60 p-1.5">
                    <img src="/swu-logo-title.png" alt="Star Wars: Unlimited" className="w-9 h-11 object-contain" />
                  </div>
                </div>
                <div className="min-w-0 pt-0.5">
                  <h1 className="text-xl font-extrabold text-white tracking-tight leading-none">
                    CENTRO DE MANDO
                  </h1>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-swu-green animate-pulse" aria-hidden />
                    <span className="text-[10px] text-swu-green font-mono font-bold tracking-[0.25em] uppercase">
                      Online
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate('/profile')}
                className="mt-4 flex items-center gap-3 text-left w-full active:scale-[0.99] transition-transform rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-cyan"
              >
                <div className="w-14 h-14 rounded-full p-px bg-gradient-to-br from-swu-green to-swu-cyan flex-shrink-0">
                  <div className="w-full h-full rounded-full bg-swu-bg overflow-hidden flex items-center justify-center">
                    {avatar?.startsWith('data:image/')
                      ? <img src={avatar} alt="" className="w-full h-full object-cover" />
                      : swAvatarIds.includes(avatar)
                        ? <img src={`/avatars/${avatar}.png`} alt="" className="w-10 h-10 object-contain" />
                        : <span className="text-2xl">{avatar || '🎮'}</span>}
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-extrabold text-white leading-tight truncate">{currentProfile.name}</p>
                  <p className={`text-[10px] font-mono tracking-[0.2em] uppercase ${rankInfo?.color || 'text-swu-muted'}`}>
                    {rankInfo?.name || 'Piloto activo'}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </HudPanel>
      </div>

      {/* ── Acción principal ── */}
      <div className="px-4 pt-3 flex gap-3">
        <button onClick={() => navigate('/arena/log')} className="flex-1 min-w-0 active:scale-[0.98] transition-transform">
          <HudPanel tone="cyan" glow fill="bg-swu-cyan/[0.08]">
            <div className="relative flex items-center gap-3 px-3 py-3.5">
              <HudCorners tone="cyan" />
              <HexIcon tone="cyan" size={38}><Swords size={17} aria-hidden /></HexIcon>
              <span className="flex-1 text-left text-[13px] font-extrabold text-white tracking-wide whitespace-nowrap">
                REGISTRAR DUELO
              </span>
              <ChevronRight size={16} className="text-swu-cyan flex-shrink-0" aria-hidden />
            </div>
          </HudPanel>
        </button>

        <button onClick={() => navigate('/scan')} className="w-[30%] flex-shrink-0 active:scale-[0.98] transition-transform">
          <HudPanel tone="neutral">
            <div className="relative flex flex-col items-center justify-center gap-1.5 px-2 py-3.5 h-full">
              <HudCorners tone="neutral" />
              <ScanLine size={20} className="text-swu-muted" aria-hidden />
              <span className="text-[9px] font-mono font-bold tracking-[0.15em] uppercase text-swu-muted text-center leading-tight">
                Escanear<br />carta
              </span>
            </div>
          </HudPanel>
        </button>
      </div>

      {/* ── Marcador ── */}
      {marcadores && (
        <div className="px-4 pt-3">
          <HudPanel tone="neutral">
            <div className="flex items-stretch">
              {marcadores.map((m, i) => {
                const Icon = m.icon
                return (
                  <div
                    key={m.label}
                    className={`flex-1 flex items-center gap-2.5 px-3 py-3 ${i > 0 ? 'border-l border-swu-border' : ''}`}
                  >
                    <HexIcon tone={m.tone} size={34}><Icon size={15} /></HexIcon>
                    <div className="min-w-0">
                      <p className="text-[9px] font-mono tracking-wider uppercase text-swu-muted truncate">
                        {m.label}
                      </p>
                      <p className={`text-xl font-extrabold font-mono leading-none ${HUD_TEXTO[m.tone]}`}>
                        {m.value}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </HudPanel>
        </div>
      )}

      {/* ── Separador ── */}
      <div className="px-4 pt-5 pb-1">
        <div className="flex items-center gap-2.5">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-swu-cyan/40" />
          <span className="text-[9px] text-swu-cyan/70 font-mono tracking-[0.35em]">SISTEMAS</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-swu-cyan/40" />
        </div>
      </div>

      {/* ── Módulos ── */}
      <div className="px-4 pt-2 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {mainSystems.filter(s => !s.auth || currentProfile).map(sys => {
          const Icon = sys.icon
          return (
            <button
              key={sys.label}
              onClick={() => navigate(sys.to)}
              className="active:scale-[0.97] transition-transform text-left"
            >
              <HudPanel tone={sys.tone} glow className="h-full">
                <div className="relative h-full flex items-center gap-2 p-2.5">
                  <HudCorners tone={sys.tone} />
                  <HexIcon tone={sys.tone} size={38}><Icon size={18} /></HexIcon>
                  {/* Solo el rótulo, en blanco: el color lo lleva el ícono. Con
                      subtítulo debajo, nombres como «Circuito Melee» no entran
                      en media pantalla de 375 px y se cortaban con puntos. */}
                  <span className="min-w-0 flex-1 text-[13px] font-bold text-white leading-tight">
                    {sys.label}
                  </span>
                  <ChevronRight size={14} className="text-swu-muted flex-shrink-0" aria-hidden />
                </div>
              </HudPanel>
            </button>
          )
        })}
      </div>
    </div>
  )
}

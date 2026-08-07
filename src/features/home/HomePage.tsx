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
import { ChevronRight, ScanLine, Swords} from 'lucide-react'
import {
  DatapadIcon, MandoTrophyIcon, CargoIcon, BountyIcon,
  DeckCardsIcon, SpyIcon, DeathStarIcon, BeskarIcon, HolonetIcon,
  ChanceCubeIcon, KyberIcon, LabIcon, HolocronIcon, StarfighterIcon, SaberIcon,
} from '../../components/SWIcons'
import { HudPanel, HudCorners, HexIcon } from '../../components/Hud'
import { NoticiasSection } from './NoticiasSection'
import { TiendaOficial } from './TiendaOficial'
import { ProximosEventos } from './ProximosEventos'
import { TarjetaJugador } from '../profile/TarjetaJugador'
import { Carta3D } from '../../components/Carta3D'
import { HUD_TEXTO, type HudTone } from '../../components/hudTones'
import { useAuth } from '../../hooks/useAuth'
import { type PlayerStats, calculateLevel } from '../../services/gamification'
import { db } from '../../services/db'
import { WelcomeHome } from './components/WelcomeHome'

/* Avatar helper: detect image-based avatar vs emoji */

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
  // PÚBLICO a propósito (sin auth): un juez en torneo consulta una regla
  // sin loguearse. Va arriba, cerca de Meta: los dos son consulta de mesa.
  { icon: HolocronIcon,    label: 'Rulings',   tone: 'cyan',   to: '/rulings' },
  { icon: HolonetIcon,     label: 'Blog',      tone: 'amber',  to: '/blog' },
  { icon: CargoIcon,       label: 'Mi Botín',   tone: 'green',  to: '/collection', auth: true },
  { icon: DeckCardsIcon,   label: 'Mis Decks',           tone: 'green',  to: '/decks',      auth: true },
  // Va PEGADO a Mis Decks porque es el paso siguiente del mismo trabajo:
  // se arma un mazo y se prueba. Estaba solo en el SideNav —que es
  // `hidden lg:flex`, o sea invisible en el teléfono— y en MoreNav, a dos
  // toques dentro de Perfil. Un módulo al que no se llega desde el Inicio,
  // en la práctica, no existe.
  { icon: LabIcon,         label: 'Laboratorio',  tone: 'cyan',   to: '/laboratorio', auth: true },
  // Y pegada al Laboratorio, por lo mismo: allí sale un porcentaje y aquí se
  // ve UNA partida de esa misma medición, carta por carta, sobre una mesa.
  { icon: SaberIcon,       label: 'Mesa',         tone: 'purple', to: '/mesa',       auth: true },
  { icon: BountyIcon,      label: 'Contrabando',  tone: 'red',    to: '/explore',    auth: true },
  // Acceso directo al mercado: llegar a comprar/vender exigía entrar a
  // Contrabando y después cambiar de pestaña.
  { icon: CargoIcon,       label: 'Mercancía',  tone: 'amber',  to: '/explore?tab=market', auth: true },
  { icon: SpyIcon,         label: 'Espionaje',         tone: 'purple', to: '/espionaje',  auth: true },
  // Pegada a Espionaje: las dos son mirar a la comunidad. Espionaje va a una
  // persona que ya se conoce; la Galaxia muestra a todas de un vistazo.
  { icon: StarfighterIcon, label: 'La Galaxia',   tone: 'cyan',   to: '/galaxia',    auth: true },
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
  const { currentProfile, supabaseUser } = useAuth()

  /** Rango y marcador viajan juntos: salen de la misma fila y se pintan a la
   *  vez, así que un solo estado evita un render intermedio a medio llenar. */
  const [panel, setPanel] = useState<{
    rank: { name: string; color: string } | null
    marcadores: Marcador[] | null
    /** Las estadísticas completas: la tarjeta de jugador necesita el XP. */
    stats: PlayerStats | null
  }>({ rank: null, marcadores: null, stats: null })

  useEffect(() => {
    if (!currentProfile) return
    let vivo = true
    db.playerStats.get(currentProfile.id).then(stats => {
      if (!vivo || !stats) return
      const lvl = calculateLevel(stats.xp)
      const r = stats.currentStreak
      setPanel({
        rank: { name: lvl.rank.name, color: lvl.rank.color },
        stats,
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

  const { marcadores, stats: playerStats } = panel

  if (!currentProfile) return <WelcomeHome />

  return (
    <div className="min-h-screen bg-swu-bg pb-8">
      {/* ── Quién sos ──
          Antes acá iba un panel que decía «CENTRO DE MANDO» y el nombre de la
          app: información que ya tenés, porque la abriste vos. Ahora va la
          misma tarjeta del perfil —nivel, rango, país y barra de XP—, que sí
          dice algo nuevo cada vez que entrás. Es el MISMO componente que usa
          Mi Perfil, para que las dos pantallas no se contradigan. */}
      <div className="px-4 pt-4">
        <TarjetaJugador
          perfil={currentProfile}
          stats={playerStats}
          enLinea={!!supabaseUser}
          alTocar="perfil"
        />
      </div>

      {/* ── Acción principal ── */}
      <div className="px-4 pt-3 flex gap-3">
        <button onClick={() => navigate('/arena/log')} className="flex-1 min-w-0 active:scale-[0.98] transition-transform">
          <HudPanel tone="cyan" glow fill="bg-swu-cyan/[0.08]">
            <div className="relative flex items-center gap-3 px-3 py-3.5">
              <HudCorners tone="cyan" />
              <HexIcon tone="cyan" size={38}><Swords size={17} aria-hidden /></HexIcon>
              {/* `min-w-0` y sin `nowrap`: era esto lo que empujaba la fila.
                  Un ítem flex arranca en `min-width: auto`, o sea que no se
                  deja encoger por debajo de su contenido; con el texto sin
                  poder cortarse, «REGISTRAR DUELO» imponía su ancho intrínseco
                  y la fila entera se pasaba del teléfono. Medido: a 320 px se
                  salía 38 px y a 360 px, 10 px. Ahora parte en dos líneas en
                  las pantallas angostas, que es preferible a recortar la
                  acción principal de la pantalla de inicio. */}
              <span className="flex-1 min-w-0 text-left text-[13px] font-extrabold text-white tracking-wide leading-tight">
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
              className="text-left"
            >
              {/* El mismo 3D de las cartas, con menos ángulo: un panel de
                  interfaz que se inclina como una carta se siente a juguete.
                  Seis grados alcanzan para que responda al dedo. */}
              <Carta3D brillo intensidad={6} className="h-full">
              <HudPanel tone={sys.tone} glow className="h-full">
                <div className="relative h-full flex items-center gap-2 p-2.5">
                  <HudCorners tone={sys.tone} />
                  <HexIcon tone={sys.tone} size={38}><Icon size={18} /></HexIcon>
                  {/* Solo el rótulo, en blanco: el color lo lleva el ícono. Con
                      subtítulo debajo, nombres como «Circuito Melee» no entran
                      en media pantalla de 375 px y se cortaban con puntos.

                      A 320 px la caja se queda en 46 px y una palabra sola
                      —«Contrabando» mide 83— no tiene dónde partirse: se salía
                      y la recortaba el clip-path del octágono contra el
                      chevron. Medido en las 9 tarjetas (83/73/67/64/62/58/58/
                      52/51 px de contenido en 46 de caja). `break-words` la
                      parte y `text-[11px]` a 320 px le devuelve el aire; a
                      partir de 360 vuelve a 13. */}
                  <span className="min-w-0 flex-1 break-words text-[11px] font-bold text-white
                                   leading-tight min-[360px]:text-[13px]">
                    {sys.label}
                  </span>
                  <ChevronRight size={14} className="text-swu-muted flex-shrink-0" aria-hidden />
                </div>
              </HudPanel>
              </Carta3D>
            </button>
          )
        })}
      </div>

      {/* ── Próximos eventos ──
          Van PRIMERO de las tres secciones de abajo porque son lo único que
          CADUCA: una noticia sirve igual mañana, un torneo del sábado no. Si
          no hay ninguno, el componente no dibuja nada y esta franja no existe. */}
      <ProximosEventos />

      {/* ── Noticias ──
          Va DEBAJO de los módulos a propósito: quien abre la app viene a hacer
          algo —registrar un duelo, buscar una carta—, no a leer. Las noticias
          se encuentran al bajar, que es cuando uno tiene tiempo. */}
      {/* La tienda oficial va ARRIBA de las noticias: para quien recién
          llega, «dónde consigo las cartas acá» pesa más que cualquier
          novedad del juego. */}
      <div className="px-4 pt-6">
        <TiendaOficial />
      </div>

      <div className="px-4 pt-6">
        <NoticiasSection />
      </div>
    </div>
  )
}

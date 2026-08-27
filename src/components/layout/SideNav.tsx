import { useLocation, useNavigate } from 'react-router-dom'
import { InsigniaSobres } from '../ui/InsigniaSobres'
import {
  EmpireIcon,
  HelmetIcon,
  AnuncioIcon,
  AgendaIcon,
  ArticuloIcon,
  BaseIcon,
  BeskarIcon,
  BinderIcon,
  BlasterIcon,
  CargoIcon,
  ChanceCubeIcon,
  DatapadIcon,
  DeathStarIcon,
  DeckCardsIcon,
  EmisionIcon,
  HolocronIcon,
  HolonetIcon,
  LabIcon,
  MandoTrophyIcon,
  MedalIcon,
  MetaHoloIcon,
  RebelIcon,
  AurebeshIcon, SaberIcon,
  SalasIcon,
  SobreIcon,
  SpyIcon,
  StarfighterIcon,
  KyberIcon,
} from '../SWIcons'
// El planeta anillado ya existe: se dibujó para el tema «Planetas» de la
// Trivia. El ícono de una cosa es el de esa cosa.
import { PlanetaAnilladoIcon } from '../../features/trivia/iconosTrivia'
import { NotificationBell } from '../ui/NotificationBell'
import { useAuth } from '../../hooks/useAuth'
import type { ComponentType, ReactNode } from 'react'

type IconComp = ComponentType<{ size?: number; className?: string; strokeWidth?: number }>

/**
 * El rótulo de una familia del menú, PEGADO ARRIBA mientras se recorre.
 *
 * Con 31 entradas en una sola columna, la pregunta que se hace cualquiera a
 * mitad del scroll es «¿de qué grupo es esto?». El rótulo pegajoso la responde
 * sin ocupar sitio. Lleva su propio fondo porque si no, las entradas se leen a
 * través de él al pasar por debajo.
 */
function Rotulo({ children, tono = 'muted' }: { children: ReactNode; tono?: 'muted' | 'amber' }) {
  return (
    <div className="sticky top-0 z-10 -mx-3 mt-5 mb-2 bg-swu-surface px-6 pt-2 pb-1.5 first:mt-0">
      <span
        className={`font-mono text-[9px] uppercase tracking-[0.25em] ${
          tono === 'amber' ? 'text-swu-amber/70' : 'text-swu-muted/60'
        }`}
      >
        {children}
      </span>
    </div>
  )
}

type NavItem =
  | { id: string; label: string; sub: string; icon: IconComp; img?: undefined }
  | { id: string; label: string; sub: string; img: string; icon?: undefined }

const mainNav: NavItem[] = [
  { id: '/', label: 'Base', sub: 'Centro de mando', icon: BaseIcon },
  { id: '/play', label: 'Duelo', sub: 'Tracker en vivo', icon: SaberIcon },
  { id: '/galaxia', label: 'La Galaxia', sub: 'Universo 3D', icon: StarfighterIcon },
  { id: '/blog', label: 'Blog', sub: 'Análisis y artículos', icon: ArticuloIcon },
  { id: '/events', label: 'Próximos Eventos', sub: 'Los que vienen', icon: MedalIcon },
  { id: '/profile', label: 'Mi Perfil', sub: 'Holocrón', img: '/holocron-icon.png' },
]

const secondaryNav: NavItem[] = [
  { id: '/collection', label: 'Mi Botín', sub: 'Colección', icon: CargoIcon },
  /* Sobredosis NO va acá: vive en Mini Juegos, más abajo. Estaba en las dos
     listas y salía dos veces en la misma barra — un menú que repite una entrada
     te hace dudar de si son la misma pantalla. El Binder sí se queda, porque es
     dónde MIRÁS lo que abriste, que es otro trabajo. */
  { id: '/binder-digital', label: 'Binder digital', sub: 'Lo que abriste', icon: BinderIcon },
  /* Una sola entrada de mercado, igual que en Inicio y en el menú móvil.
     Antes esta barra tenía «Contrabando» y el menú móvil tenía «Pedidos»: dos
     mapas distintos del mismo módulo, y ninguno de los dos completo. Pedidos
     vive ahora en la cabecera del mercado, con el número de lo que espera un
     acto tuyo — que es más de lo que una fila de menú puede decir. */
  { id: '/explore?tab=market', label: 'Mercado', sub: 'Comprar, vender y pedidos', icon: KyberIcon },
  { id: '/prestamos', label: 'Préstamos', sub: 'Quién tiene tus cartas', icon: CargoIcon },
  { id: '/espionaje', label: 'Espionaje', sub: 'Transmisiones', icon: SpyIcon },
  { id: '/misiones', label: 'Misiones', sub: 'Órdenes del Día', icon: DeathStarIcon },
  { id: '/decks', label: 'Mis Decks', sub: 'Constructor', icon: DeckCardsIcon },
  { id: '/laboratorio', label: 'Laboratorio', sub: 'Simulador de mazos', icon: LabIcon },
  { id: '/galaxy', label: 'Salas', sub: 'Chat y comandantes', icon: SalasIcon },
  { id: '/news', label: 'Noticias', sub: 'Agenda de torneos', icon: DatapadIcon },
  { id: '/meta', label: 'Meta', sub: 'Torneos y matchups', icon: MetaHoloIcon },
  { id: '/community', label: 'Comunidades', sub: 'Galaxia', icon: RebelIcon },
  { id: '/rank', label: 'Ranking', sub: 'Quién gana partidas', icon: BeskarIcon },
  { id: '/cards', label: 'Buscar Cartas', sub: 'Base de datos', icon: HolonetIcon },
  { id: '/envivo', label: 'En Vivo', sub: 'Transmisión de torneos', icon: EmisionIcon },
  { id: '/rulings', label: 'Rulings', sub: 'Reglamento del juego', icon: HolocronIcon },
  { id: '/contador', label: 'Contador de daños', sub: 'Duelo en mesa real', icon: ChanceCubeIcon },
  { id: '/amistosas', label: 'Amistosas', sub: 'Historial cara a cara', icon: BlasterIcon },
  { id: '/torneos', label: 'Torneos', sub: 'Archivo y organizar', icon: MandoTrophyIcon },
  { id: '/calendario', label: 'Calendario', sub: 'Los torneos del mes', icon: AgendaIcon },
]

/* Lo que se juega DENTRO de la app. El orden cuenta la economía: primero lo
   que DA créditos (Sobredosis paga 50 por sobre, la Trivia 2 por acierto),
   después lo que los GASTA —el Taller y Terraformar comparten la misma bolsa—
   y al final Aurebesh, que ni da ni gasta. */
const MINI_JUEGOS = [
  { id: '/sobres', label: 'Sobredosis', sub: 'Abrir sobres', icon: SobreIcon },
  { id: '/trivia', label: 'Trivia', sub: 'Preguntas del canon', icon: HolocronIcon },
  { id: '/sable', label: 'Taller Kyber', sub: 'Armá tu sable', icon: SaberIcon },
  { id: '/terraformar', label: 'Terraformar', sub: 'Ponéle vida a tu mundo', icon: PlanetaAnilladoIcon },
  { id: '/aurebesh', label: 'Aurebesh', sub: 'Traductor galáctico', icon: AurebeshIcon },
]

export function SideNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    /* El id puede traer query («/explore?tab=market»): se compara solo la RUTA.
       `pathname` nunca incluye el query, así que sin este corte la entrada del
       Mercado jamás se marcaría activa — y una barra que no marca dónde estás
       es una barra que miente por omisión. */
    return location.pathname.startsWith(path.split('?')[0])
  }

  const renderItem = (item: NavItem) => {
    const active = isActive(item.id)
    return (
      <button
        key={item.id}
        onClick={() => navigate(item.id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group ${
          active
            ? 'bg-swu-accent/15 text-swu-accent-texto border border-swu-accent/30'
            : 'text-swu-muted hover:bg-swu-surface-hover hover:text-swu-text border border-transparent'
        }`}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          active ? 'bg-swu-accent/20' : 'bg-swu-surface group-hover:bg-swu-surface-hover'
        }`}>
          {item.img ? (
            <img
              src={item.img}
              alt={item.label}
              className={`w-5 h-5 object-contain transition-opacity ${active ? 'opacity-100 brightness-125' : 'opacity-60 group-hover:opacity-80'}`}
            />
          ) : item.icon ? (
            <item.icon size={18} />
          ) : null}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold truncate ${active ? 'text-swu-accent-texto' : ''}`}>{item.label}</div>
          <div className="text-[10px] text-swu-muted font-mono tracking-wider truncate">{item.sub}</div>
        </div>
        {/* La insignia solo en Sobredosis: es el único módulo que acumula algo
            que se pierde de vista. Ponerla en más sitios la volvería decoración. */}
        {item.id === '/sobres' && <InsigniaSobres className="flex-shrink-0" />}
        {active && <div className="w-1 h-6 rounded-full bg-swu-accent flex-shrink-0" />}
      </button>
    )
  }

  return (
    /* ALTO DEFINIDO, no `min-h-screen`.
     *
     * Estuvo en `fixed top-0` + `min-h-screen`, o sea SIN alto: la barra crecía
     * con su contenido, y por eso el `flex-1 overflow-y-auto` del `<nav>` nunca
     * se veía obligado a encoger y no llegaba a scrollear jamás. Medido en una
     * ventana de 820 px: el aside medía 2.175 y `nav.scrollHeight === clientHeight`.
     * Como es `fixed`, esos 1.355 px que colgaban por debajo no se podían
     * alcanzar de ninguna forma —el documento no scrollea— así que de 31
     * entradas se llegaba a once. Un admin, que tiene tres más, perdía el panel.
     *
     * Es el MISMO gotcha que el `min-h-0` de AppLayout, con otra cara: allá
     * faltaba dejar encoger, acá falta decir hasta dónde. */
    <aside className="hidden lg:flex flex-col w-64 xl:w-72 bg-swu-surface shadow-[4px_0_10px_#111118] h-[100dvh] fixed left-0 top-0 z-40">
      {/* Logo + Notification Bell */}
      <div className="px-5 py-5 flex items-center gap-3 border-b border-swu-border">
        <img src="/swu-logo-title.png" alt="SWU" className="w-10 h-12 object-contain" />
        <div className="flex-1">
          <h1 className="text-base font-extrabold text-swu-amber tracking-tight leading-tight">
            HOLOCRON SWU
          </h1>
          <p className="text-[9px] tracking-[0.2em] uppercase text-swu-muted font-mono">
            Centro de Mando
          </p>
        </div>
        <NotificationBell />
      </div>

      {/* Main Navigation.
          `min-h-0` es lo que deja que este hijo se encoja por debajo de su
          contenido; sin él, `overflow-y-auto` es decorativo. */}
      <nav className="flex-1 min-h-0 px-3 py-4 space-y-1 overflow-y-auto barra-fina">
        <Rotulo>Principal</Rotulo>
        {mainNav.map(renderItem)}

        <Rotulo>Sistemas</Rotulo>
        {secondaryNav.map(renderItem)}

        {/* ── Mini Juegos ──
            Antes el Taller colgaba suelto al final de «Sistemas» y Sobredosis
            y Aurebesh vivían en otras familias. La sección existe en Inicio y
            en el menú móvil: faltaba acá, y tres mapas distintos de la misma
            app es cómo alguien deja de encontrar las cosas.

            MISMO ORDEN QUE EN LOS OTROS DOS: lo que da créditos, lo que los
            gasta, y lo que no hace ninguna de las dos. */}
        <Rotulo>Mini Juegos</Rotulo>
        {MINI_JUEGOS.map(renderItem)}

        {/* Admin-only quick utility (lives in Sistemas section but only visible to admins) */}
        {isAdmin && (
          <button
            onClick={() => navigate('/admin/announcements')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group ${
              location.pathname === '/admin/announcements'
                ? 'bg-swu-accent/15 text-swu-accent-texto border border-swu-accent/30'
                : 'text-swu-muted hover:bg-swu-surface-hover hover:text-swu-text border border-transparent'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              location.pathname === '/admin/announcements' ? 'bg-swu-accent/20' : 'bg-swu-surface group-hover:bg-swu-surface-hover'
            }`}>
              <AnuncioIcon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold truncate ${location.pathname === '/admin/announcements' ? 'text-swu-accent-texto' : ''}`}>Anuncios</div>
              <div className="text-[10px] text-swu-muted font-mono tracking-wider truncate">Centro de comunicaciones</div>
            </div>
          </button>
        )}

        {isAdmin && (
          <>
            <Rotulo tono="amber">Cuartel General</Rotulo>
            <button
              onClick={() => navigate('/estudio')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group mb-1 ${
                location.pathname.startsWith('/estudio')
                  ? 'bg-swu-accent/15 text-swu-accent-texto border border-swu-accent/30'
                  : 'text-swu-muted hover:bg-swu-surface-hover hover:text-swu-text border border-transparent'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                location.pathname.startsWith('/estudio') ? 'bg-swu-accent/20' : 'bg-swu-surface group-hover:bg-swu-surface-hover'
              }`}>
                <HelmetIcon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold truncate ${location.pathname.startsWith('/estudio') ? 'text-swu-accent-texto' : ''}`}>Transmisión</div>
                <div className="text-[10px] text-swu-muted font-mono tracking-wider truncate">Centro de mando en vivo</div>
              </div>
            </button>
            <button
              onClick={() => navigate('/admin')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group ${
                location.pathname.startsWith('/admin') && location.pathname !== '/admin/announcements'
                  ? 'bg-swu-amber/15 text-swu-amber border border-swu-amber/30'
                  : 'text-swu-muted hover:bg-swu-surface-hover hover:text-swu-text border border-transparent'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                location.pathname.startsWith('/admin') && location.pathname !== '/admin/announcements' ? 'bg-swu-amber/20' : 'bg-swu-surface group-hover:bg-swu-surface-hover'
              }`}>
                <EmpireIcon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold truncate ${location.pathname.startsWith('/admin') && location.pathname !== '/admin/announcements' ? 'text-swu-amber' : ''}`}>Admin</div>
                <div className="text-[10px] text-swu-muted font-mono tracking-wider truncate">Panel de control</div>
              </div>
            </button>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-swu-border">
        <p className="text-[9px] text-swu-muted/40 font-mono tracking-widest text-center">
          SWU COMPANION v1.0
        </p>
      </div>
    </aside>
  )
}

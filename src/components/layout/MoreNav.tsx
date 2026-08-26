import { useNavigate } from 'react-router-dom'
import { InsigniaSobres } from '../ui/InsigniaSobres'
import {
  AgendaIcon,
  AnuncioIcon,
  ArticuloIcon,
  AurebeshIcon,
  BeskarIcon,
  BinderIcon,
  BlasterIcon,
  ChanceCubeIcon,
  CredencialIcon,
  DatapadIcon,
  DeathStarIcon,
  DeckCardsIcon,
  EmisionIcon,
  EmpireIcon,
  HelmetIcon,
  HolocronIcon,
  LabIcon,
  MandoTrophyIcon,
  MedalIcon,
  MetaHoloIcon,
  PedidoIcon,
  RebelIcon,
  SaberIcon,
  SalasIcon,
  SobreIcon,
  SpyIcon,
  StarfighterIcon,
  TransmisionIcon,
  KyberIcon,
} from '../SWIcons'
// El planeta anillado ya existe: se dibujó para el tema «Planetas» de la
// Trivia. El ícono de una cosa es el de esa cosa.
import { PlanetaAnilladoIcon } from '../../features/trivia/iconosTrivia'
import { useAuth } from '../../hooks/useAuth'
import type { ComponentType } from 'react'

/**
 * MoreNav — todo lo que no entra en las cinco pestañas de móvil.
 *
 * La barra inferior lleva los cinco destinos de colección (Inicio, Explorar,
 * Binder, Mercado, Perfil). Las otras once rutas viven acá, agrupadas por lo
 * que uno viene a hacer, y no perdidas en una lista de once.
 *
 * En escritorio esto no aparece: el sidebar sigue mostrando las dieciséis.
 */

type IconComp = ComponentType<{ size?: number; className?: string; strokeWidth?: number }>

interface MoreItem { to: string; label: string; sub: string; icon: IconComp }
interface MoreGroup { title: string; items: MoreItem[] }

const GROUPS: MoreGroup[] = [
  {
    title: 'Jugar',
    items: [
      { to: '/play', label: 'Duelo', sub: 'Tracker en vivo', icon: SaberIcon },
      { to: '/events', label: 'Próximos Eventos', sub: 'Los que vienen', icon: MedalIcon },
      // Vive en «Jugar»: se consulta EN la mesa, en medio de una partida.
      { to: '/envivo', label: 'En Vivo', sub: 'Transmisión de torneos', icon: EmisionIcon },
      { to: '/rulings', label: 'Rulings', sub: 'Reglamento del juego', icon: HolocronIcon },
    ],
  },
  {
    title: 'Construir',
    items: [
      { to: '/decks', label: 'Mis Decks', sub: 'Constructor', icon: DeckCardsIcon },
      { to: '/laboratorio', label: 'Laboratorio', sub: 'Simulador de mazos', icon: LabIcon },
      { to: '/misiones', label: 'Misiones', sub: 'Órdenes del día', icon: DeathStarIcon },
      { to: '/contador', label: 'Contador de daños', sub: 'Duelo en mesa real', icon: ChanceCubeIcon },
      { to: '/amistosas', label: 'Amistosas', sub: 'Historial cara a cara', icon: BlasterIcon },
      { to: '/torneos', label: 'Torneos', sub: 'Archivo y organizar', icon: MandoTrophyIcon },
      { to: '/calendario', label: 'Calendario', sub: 'Los torneos del mes', icon: AgendaIcon },
      /* Una sola entrada de mercado, igual que en Inicio y en la barra de
         escritorio. Pedidos vive en la cabecera del mercado, con el número de
         lo que espera un acto tuyo. */
      { to: '/explore?tab=market', label: 'Mercado', sub: 'Comprar, vender y pedidos', icon: KyberIcon },
      { to: '/prestamos', label: 'Préstamos', sub: 'Quién tiene tus cartas', icon: PedidoIcon },
      { to: '/mensajes', label: 'Mensajes', sub: 'Conversaciones privadas', icon: TransmisionIcon },
    ],
  },
  {
    title: 'Comunidad',
    items: [
      { to: '/news', label: 'Noticias', sub: 'Agenda de torneos', icon: DatapadIcon },
      { to: '/meta', label: 'Meta', sub: 'Torneos y matchups', icon: MetaHoloIcon },
      { to: '/community', label: 'Comunidades', sub: 'El Salvador', icon: RebelIcon },
      { to: '/rank', label: 'Ranking', sub: 'Quién gana partidas', icon: BeskarIcon },
      // Dos entradas porque son dos trabajos: la Galaxia es MIRAR a la
      // comunidad (quién es quién, qué hizo de último) y el Explorador es
      // BUSCAR dentro de ella (nombre, país, rankings).
      { to: '/galaxia', label: 'La Galaxia', sub: 'Universo 3D', icon: StarfighterIcon },
      { to: '/galaxy', label: 'Salas', sub: 'Chat y comandantes', icon: SalasIcon },
      { to: '/binder-digital', label: 'Binder digital', sub: 'Lo que abriste', icon: BinderIcon },
      { to: '/credencial', label: 'Mi Credencial', sub: 'Placa imprimible', icon: CredencialIcon },
      { to: '/blog', label: 'Blog', sub: 'Análisis y artículos', icon: ArticuloIcon },
      { to: '/espionaje', label: 'Espionaje', sub: 'Transmisiones', icon: SpyIcon },
    ],
  },
  {
    /* ── Mini Juegos ──
       Existe en Inicio desde que Nel juntó lo que se juega DENTRO de la app, y
       faltaba acá: el menú seguía repartiendo Sobredosis y Aurebesh en
       Comunidad y colgando el Taller al final, suelto. Dos mapas distintos de
       la misma app es cómo alguien deja de encontrar las cosas.

       MISMO ORDEN QUE EN INICIO, y no es capricho: primero lo que DA créditos,
       después lo que los GASTA, al final lo que no hace ninguna de las dos. */
    title: 'Mini Juegos',
    items: [
      { to: '/sobres', label: 'Sobredosis', sub: 'Abrir sobres', icon: SobreIcon },
      { to: '/trivia', label: 'Trivia', sub: 'Preguntas del canon', icon: HolocronIcon },
      { to: '/sable', label: 'Taller Kyber', sub: 'Armá tu sable', icon: SaberIcon },
      { to: '/terraformar', label: 'Terraformar', sub: 'Ponéle vida a tu mundo', icon: PlanetaAnilladoIcon },
      { to: '/aurebesh', label: 'Aurebesh', sub: 'Traductor galáctico', icon: AurebeshIcon },
    ],
  },
]

export function MoreNav() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const tile = (item: MoreItem) => (
    <button
      key={item.to}
      onClick={() => navigate(item.to)}
      className="relative flex flex-col items-start gap-1.5 p-3 rounded-xl bg-swu-bg border border-swu-border
                 text-left min-h-20 active:scale-[0.98] transition-transform
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
    >
      {item.to === '/sobres' && (
        <InsigniaSobres className="absolute right-2 top-2" />
      )}
      <item.icon size={20} className="text-swu-muted" />
      <span className="text-xs font-semibold text-swu-text leading-tight">{item.label}</span>
      <span className="text-[10px] text-swu-muted leading-tight">{item.sub}</span>
    </button>
  )

  return (
    <div className="lg:hidden space-y-4">
      {GROUPS.map(group => (
        <section key={group.title}>
          <h3 className="text-[10px] font-mono tracking-[0.2em] uppercase text-swu-muted/60 mb-2 px-1">
            {group.title}
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {group.items.map(tile)}
          </div>
        </section>
      ))}

      {isAdmin && (
        <section>
          <h3 className="text-[10px] font-mono tracking-[0.2em] uppercase text-swu-amber/70 mb-2 px-1">
            Cuartel General
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {tile({ to: '/estudio', label: 'Transmisión', sub: 'Centro de mando', icon: HelmetIcon })}
            {tile({ to: '/admin', label: 'Admin', sub: 'Panel de control', icon: EmpireIcon })}
            {tile({ to: '/admin/announcements', label: 'Anuncios', sub: 'Comunicaciones', icon: AnuncioIcon })}
          </div>
        </section>
      )}
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import { Swords, ShieldCheck, Megaphone, Newspaper, BarChart3, BookOpen, FlaskConical, Scale, Radar, RadioTower, Fingerprint, Languages, PackageOpen, Library , ShoppingCart, CalendarDays, MessageCircle} from 'lucide-react'
import {
  MandoTrophyIcon, DeckCardsIcon, SpyIcon,
  DeathStarIcon, BeskarIcon, ChanceCubeIcon, RebelIcon, StarfighterIcon,
} from '../SWIcons'
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
      { to: '/play', label: 'Duelo', sub: 'Tracker en vivo', icon: Swords },
      { to: '/events', label: 'Torneo', sub: 'Eventos organizados', icon: MandoTrophyIcon },
      // Vive en «Jugar»: se consulta EN la mesa, en medio de una partida.
      { to: '/envivo', label: 'En Vivo', sub: 'Transmisión de torneos', icon: RadioTower },
      { to: '/rulings', label: 'Rulings', sub: 'Reglamento del juego', icon: Scale },
    ],
  },
  {
    title: 'Construir',
    items: [
      { to: '/decks', label: 'Mis Decks', sub: 'Constructor', icon: DeckCardsIcon },
      { to: '/laboratorio', label: 'Laboratorio', sub: 'Simulador de mazos', icon: FlaskConical },
      { to: '/misiones', label: 'Misiones', sub: 'Órdenes del día', icon: DeathStarIcon },
      { to: '/contador', label: 'Contador', sub: 'Duelo en mesa real', icon: ChanceCubeIcon },
      { to: '/amistosas', label: 'Amistosas', sub: 'Historial cara a cara', icon: Swords },
      { to: '/torneos', label: 'Torneos', sub: 'Archivo de la comunidad', icon: MandoTrophyIcon },
      { to: '/calendario', label: 'Calendario', sub: 'Los torneos del mes', icon: CalendarDays },
      { to: '/pedidos', label: 'Pedidos', sub: 'Carrito y ventas', icon: ShoppingCart },
      { to: '/mensajes', label: 'Mensajes', sub: 'Conversaciones privadas', icon: MessageCircle },
    ],
  },
  {
    title: 'Comunidad',
    items: [
      { to: '/news', label: 'Noticias', sub: 'Agenda de torneos', icon: Newspaper },
      { to: '/meta', label: 'Meta', sub: 'Torneos y matchups', icon: BarChart3 },
      { to: '/community', label: 'Comunidades', sub: 'El Salvador', icon: RebelIcon },
      { to: '/rank', label: 'Ranking', sub: 'Quién gana partidas', icon: BeskarIcon },
      // Dos entradas porque son dos trabajos: la Galaxia es MIRAR a la
      // comunidad (quién es quién, qué hizo de último) y el Explorador es
      // BUSCAR dentro de ella (nombre, país, rankings).
      { to: '/galaxia', label: 'La Galaxia', sub: 'Universo 3D', icon: StarfighterIcon },
      { to: '/galaxy', label: 'Salas', sub: 'Chat y comandantes', icon: Radar },
      { to: '/sobres', label: 'Sobredosis', sub: 'Abrir sobres', icon: PackageOpen },
      { to: '/binder-digital', label: 'Binder digital', sub: 'Lo que abriste', icon: Library },
      { to: '/credencial', label: 'Mi Credencial', sub: 'Placa imprimible', icon: Fingerprint },
      { to: '/aurebesh', label: 'Aurebesh', sub: 'Traductor galáctico', icon: Languages },
            { to: '/blog', label: 'Blog', sub: 'Análisis y artículos', icon: BookOpen },
{ to: '/espionaje', label: 'Espionaje', sub: 'Transmisiones', icon: SpyIcon },
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
      className="flex flex-col items-start gap-1.5 p-3 rounded-xl bg-swu-bg border border-swu-border
                 text-left min-h-20 active:scale-[0.98] transition-transform
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
    >
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
            {tile({ to: '/estudio', label: 'Transmisión', sub: 'Centro de mando', icon: RadioTower })}
            {tile({ to: '/admin', label: 'Admin', sub: 'Panel de control', icon: ShieldCheck })}
            {tile({ to: '/admin/announcements', label: 'Anuncios', sub: 'Comunicaciones', icon: Megaphone })}
          </div>
        </section>
      )}
    </div>
  )
}

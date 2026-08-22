/**
 * BancoIconos — los íconos propios, al lado del genérico que reemplazan.
 * **Solo desarrollo.**
 *
 * Un ícono no se juzga leyendo su SVG. Se juzga a 14 px —que es el tamaño al
 * que los pinta el menú de móvil— y contra el que estaba antes: cambiar un
 * matraz de lucide por un dibujo propio solo vale la pena si el propio se
 * distingue IGUAL de rápido. Los que se empasten a 14 hay que volver a
 * dibujarlos con menos trazos, no defenderlos.
 *
 * Por eso cada fila enseña los cuatro tamaños reales de la app (14 en MoreNav,
 * 15 en la cabecera de bahía, 18 en el sidebar, 38 dentro del octógono de
 * Inicio) y, al lado, el genérico que venía ocupando ese sitio.
 */

import {
  Hexagon, Swords, BookOpen, FlaskConical, Radar, CalendarDays, Scale,
  RadioTower, PackageOpen, Library, Languages, Fingerprint, ShoppingCart,
  MessageCircle, Newspaper, BarChart3, Megaphone,
} from 'lucide-react'
import type { ComponentType } from 'react'
import {
  SobreIcon, BinderIcon, CredencialIcon, AurebeshIcon, AgendaIcon,
  TransmisionIcon, PedidoIcon, EmisionIcon, SalasIcon, ArticuloIcon,
  MetaHoloIcon, BaseIcon, AnuncioIcon, LabIcon, HolocronIcon, HolonetIcon,
  SaberIcon, DeckCardsIcon, CargoIcon, DeathStarIcon, SpyIcon, BeskarIcon,
  MandoTrophyIcon, DatapadIcon, MedalIcon, ChanceCubeIcon, BountyIcon,
  StarfighterIcon, KyberIcon, RebelIcon, EmpireIcon, BlasterIcon, HelmetIcon,
} from './SWIcons'

type Icono = ComponentType<{ size?: number; className?: string }>

/** Los que reemplazan a un genérico: se enseñan enfrentados. */
const CAMBIOS: { modulo: string; nuevo: Icono; viejo: Icono; nota?: string }[] = [
  { modulo: 'Base',            nuevo: BaseIcon,        viejo: Hexagon },
  { modulo: 'Sobredosis',      nuevo: SobreIcon,       viejo: PackageOpen },
  { modulo: 'Binder digital',  nuevo: BinderIcon,      viejo: Library },
  { modulo: 'Mi Credencial',   nuevo: CredencialIcon,  viejo: Fingerprint },
  { modulo: 'Aurebesh',        nuevo: AurebeshIcon,    viejo: Languages },
  { modulo: 'Calendario',      nuevo: AgendaIcon,      viejo: CalendarDays },
  { modulo: 'Mensajes',        nuevo: TransmisionIcon, viejo: MessageCircle },
  { modulo: 'Pedidos',         nuevo: PedidoIcon,      viejo: ShoppingCart },
  { modulo: 'En Vivo',         nuevo: EmisionIcon,     viejo: RadioTower },
  { modulo: 'Salas',           nuevo: SalasIcon,       viejo: Radar },
  { modulo: 'Blog',            nuevo: ArticuloIcon,    viejo: BookOpen },
  { modulo: 'Meta',            nuevo: MetaHoloIcon,    viejo: BarChart3, nota: 'lucide con alias: BarChart3 as MetaIcon' },
  { modulo: 'Noticias',        nuevo: HolonetIcon,     viejo: Newspaper, nota: 'lucide con alias: Newspaper as NewspaperIcon' },
  { modulo: 'Anuncios',        nuevo: AnuncioIcon,     viejo: Megaphone },
  { modulo: 'Laboratorio',     nuevo: LabIcon,         viejo: FlaskConical, nota: 'ya existía y el sidebar no lo usaba' },
  { modulo: 'Rulings',         nuevo: HolocronIcon,    viejo: Scale,        nota: 'ya existía y el sidebar no lo usaba' },
  { modulo: 'Duelo',           nuevo: SaberIcon,       viejo: Swords,       nota: 'ya existía y NADIE lo usaba' },
]

/** Los que ya eran propios. Van para comprobar que la tanda nueva es hermana. */
const YA_PROPIOS: { nombre: string; icono: Icono }[] = [
  { nombre: 'DeckCards', icono: DeckCardsIcon }, { nombre: 'Cargo', icono: CargoIcon },
  { nombre: 'DeathStar', icono: DeathStarIcon }, { nombre: 'Spy', icono: SpyIcon },
  { nombre: 'Beskar', icono: BeskarIcon }, { nombre: 'MandoTrophy', icono: MandoTrophyIcon },
  { nombre: 'Datapad', icono: DatapadIcon }, { nombre: 'Medal', icono: MedalIcon },
  { nombre: 'ChanceCube', icono: ChanceCubeIcon }, { nombre: 'Bounty', icono: BountyIcon },
  { nombre: 'Starfighter', icono: StarfighterIcon }, { nombre: 'Kyber', icono: KyberIcon },
  { nombre: 'Rebel', icono: RebelIcon }, { nombre: 'Empire', icono: EmpireIcon },
  { nombre: 'Blaster', icono: BlasterIcon }, { nombre: 'Helmet', icono: HelmetIcon },
]

const TAMANOS = [14, 15, 18, 38]

export function BancoIconos() {
  return (
    <div className="min-h-screen bg-swu-bg px-4 py-4 pb-20">
      <p className="font-mono text-[11px] text-swu-muted" data-banco-iconos="1">
        Banco de íconos · {CAMBIOS.length} reemplazos · {YA_PROPIOS.length} que ya eran propios ·
        tamaños {TAMANOS.join(' / ')} px
      </p>
      <p className="mt-1 font-mono text-[10px] leading-relaxed text-swu-muted">
        La columna de la izquierda es el nuevo; la gris de la derecha, el genérico
        que reemplaza. Lo que importa es la de 14: si a ese tamaño no se
        distinguen, el cambio empeora la navegación.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[22rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-swu-border">
              <th className="py-2 font-mono text-[10px] uppercase tracking-widest text-swu-muted">Módulo</th>
              {TAMANOS.map(t => (
                <th key={t} className="py-2 text-center font-mono text-[10px] text-swu-muted">{t}</th>
              ))}
              <th className="py-2 text-center font-mono text-[10px] uppercase tracking-widest text-swu-muted">Antes</th>
            </tr>
          </thead>
          <tbody>
            {CAMBIOS.map(({ modulo, nuevo: Nuevo, viejo: Viejo, nota }) => (
              <tr key={modulo} className="border-b border-swu-border/40">
                <td className="py-2.5 pr-2">
                  <span className="block text-[12px] font-bold text-swu-text">{modulo}</span>
                  {nota && <span className="block text-[10px] text-swu-amber">{nota}</span>}
                </td>
                {TAMANOS.map(t => (
                  <td key={t} className="px-1 py-2.5 text-center">
                    <span className="inline-flex items-center justify-center text-swu-cyan">
                      <Nuevo size={t} />
                    </span>
                  </td>
                ))}
                <td className="px-1 py-2.5 text-center">
                  <span className="inline-flex items-center justify-center text-swu-muted/60">
                    <Viejo size={18} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-swu-muted">
        Los que ya eran propios
      </p>
      <div className="mt-2 grid grid-cols-4 gap-3 sm:grid-cols-6">
        {YA_PROPIOS.map(({ nombre, icono: Ico }) => (
          <div key={nombre} className="flex flex-col items-center gap-1 rounded-lg bg-swu-surface py-2.5">
            <span className="text-swu-cyan"><Ico size={22} /></span>
            <span className="text-[9px] text-swu-muted">{nombre}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

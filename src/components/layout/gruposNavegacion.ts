import type { ComponentType } from 'react'
import {
  AgendaIcon, ArticuloIcon, AurebeshIcon, BeskarIcon, BinderIcon, BlasterIcon,
  CargoIcon, ChanceCubeIcon, CredencialIcon, DatapadIcon, DeathStarIcon,
  DeckCardsIcon, EmisionIcon, HolocronIcon, HolonetIcon, KyberIcon, LabIcon,
  MandoTrophyIcon, MetaHoloIcon, RebelIcon, SaberIcon, SalasIcon, SobreIcon,
  SpyIcon, StarfighterIcon, TransmisionIcon,
} from '../SWIcons'
import { PlanetaAnilladoIcon } from '../../features/trivia/iconosTrivia'

export type CategoriaNavegacion = 'jugar' | 'competir' | 'construir' | 'coleccion' | 'minijuegos' | 'comunidad'
export interface ModuloNavegacion {
  to: string
  label: string
  sub: string
  icon: ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
}

/** Un mapa para Inicio y los dos menús: cambiar de pantalla no cambia de categoría. */
export const GRUPOS_NAVEGACION: { id: CategoriaNavegacion; title: string; items: ModuloNavegacion[] }[] = [
  { id: 'jugar', title: 'Jugar', items: [
    { to: '/contador', label: 'Contador de daños', sub: 'Premier y Twin Suns', icon: ChanceCubeIcon },
    { to: '/amistosas', label: 'Amistosas', sub: 'Historial cara a cara', icon: BlasterIcon },
    { to: '/play', label: 'Duelo', sub: 'Partidas registradas', icon: SaberIcon },
    { to: '/misiones', label: 'Misiones', sub: 'Órdenes del día', icon: DeathStarIcon },
  ] },
  { id: 'competir', title: 'Competir', items: [
    { to: '/torneos', label: 'Torneos', sub: 'Lo que viene y el archivo', icon: MandoTrophyIcon },
    { to: '/calendario', label: 'Calendario', sub: 'Los torneos del mes', icon: AgendaIcon },
    { to: '/meta', label: 'Meta', sub: 'Torneos y matchups', icon: MetaHoloIcon },
    { to: '/rank', label: 'Ranking', sub: 'Quién gana partidas', icon: BeskarIcon },
    { to: '/envivo', label: 'En Vivo', sub: 'Transmisión de torneos', icon: EmisionIcon },
  ] },
  { id: 'construir', title: 'Construir', items: [
    { to: '/decks', label: 'Mis Decks', sub: 'Constructor', icon: DeckCardsIcon },
    { to: '/laboratorio', label: 'Laboratorio', sub: 'Simulador de mazos', icon: LabIcon },
    { to: '/cards', label: 'Cartas', sub: 'Buscar en el catálogo', icon: HolonetIcon },
    { to: '/rulings', label: 'Reglas', sub: 'Reglamento y aclaraciones', icon: HolocronIcon },
  ] },
  { id: 'coleccion', title: 'Colección', items: [
    { to: '/collection', label: 'Mi Botín', sub: 'Tus cartas físicas', icon: CargoIcon },
    { to: '/binder-digital', label: 'Binder digital', sub: 'Lo que abriste', icon: BinderIcon },
    { to: '/explore?tab=market', label: 'Mercado', sub: 'Comprar, vender y pedidos', icon: KyberIcon },
    { to: '/prestamos', label: 'Préstamos', sub: 'Quién tiene tus cartas', icon: CargoIcon },
  ] },
  { id: 'minijuegos', title: 'Mini Juegos', items: [
    { to: '/sobres', label: 'Sobredosis', sub: 'Abrir sobres', icon: SobreIcon },
    { to: '/trivia', label: 'Trivia', sub: 'Preguntas del canon', icon: HolocronIcon },
    { to: '/jugar', label: 'Jugar online', sub: 'Partida virtual privada', icon: DatapadIcon },
    { to: '/sable', label: 'Taller Kyber', sub: 'Armá tu sable', icon: SaberIcon },
    { to: '/terraformar', label: 'Terraformar', sub: 'Ponéle vida a tu mundo', icon: PlanetaAnilladoIcon },
    { to: '/aurebesh', label: 'Aurebesh', sub: 'Traductor galáctico', icon: AurebeshIcon },
  ] },
  { id: 'comunidad', title: 'Comunidad', items: [
    { to: '/galaxia', label: 'La Galaxia', sub: 'Universo 3D', icon: StarfighterIcon },
    { to: '/credencial', label: 'Mi Credencial', sub: 'Placa imprimible', icon: CredencialIcon },
    { to: '/mensajes', label: 'Mensajes', sub: 'Conversaciones privadas', icon: TransmisionIcon },
    { to: '/espionaje', label: 'Espionaje', sub: 'Transmisiones', icon: SpyIcon },
    { to: '/blog', label: 'Blog', sub: 'Análisis y artículos', icon: ArticuloIcon },
    { to: '/news', label: 'Noticias', sub: 'Agenda de torneos', icon: DatapadIcon },
    { to: '/community', label: 'Comunidades', sub: 'Encontrá tu comunidad', icon: RebelIcon },
    { to: '/galaxy', label: 'Salas', sub: 'Chat y comandantes', icon: SalasIcon },
  ] },
]

export function moduloDeRuta(ruta: string) {
  for (const grupo of GRUPOS_NAVEGACION) {
    const modulo = grupo.items.find(item => item.to.split('?')[0] === ruta.split('?')[0])
    if (modulo) return { ...modulo, categoria: grupo.id }
  }
  return undefined
}

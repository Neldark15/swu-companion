/**
 * Emblemas de la credencial — el mapa id → ícono.
 *
 * Se REUSAN los íconos SVG del repo (SWIcons): la credencial no inventa
 * iconografía nueva, graba la que la app ya habla. El catálogo de IDS vive
 * en credencialTemas.ts (sin React) porque useSettings lo necesita para
 * validar; acá solo se le pone dibujo y etiqueta a cada id.
 *
 * El Record está tipado contra EmblemaCredencialId: si algún día se agrega
 * un id al catálogo y se olvida el dibujo (o al revés), el build no pasa.
 */

import type { ComponentType } from 'react'
import type { EmblemaCredencialId } from './credencialTemas'
import {
  SaberIcon, HolocronIcon, RebelIcon, EmpireIcon, StarfighterIcon,
  KyberIcon, BlasterIcon, HelmetIcon, DeckCardsIcon, CargoIcon,
  DeathStarIcon, SpyIcon, BeskarIcon, MandoTrophyIcon, DatapadIcon,
  MedalIcon, ChanceCubeIcon, HolonetIcon, BountyIcon, LabIcon,
} from '../../components/SWIcons'

interface EmblemaCredencial {
  etiqueta: string
  Icono: ComponentType<{ size?: number; className?: string }>
}

export const EMBLEMAS_CREDENCIAL: Record<EmblemaCredencialId, EmblemaCredencial> = {
  rebelde:      { etiqueta: 'Alianza',       Icono: RebelIcon },
  imperio:      { etiqueta: 'Imperio',       Icono: EmpireIcon },
  mandaloriano: { etiqueta: 'Casco',         Icono: HelmetIcon },
  sable:        { etiqueta: 'Sable',         Icono: SaberIcon },
  holocron:     { etiqueta: 'Holocrón',      Icono: HolocronIcon },
  caza:         { etiqueta: 'Caza estelar',  Icono: StarfighterIcon },
  kyber:        { etiqueta: 'Kyber',         Icono: KyberIcon },
  blaster:      { etiqueta: 'Bláster',       Icono: BlasterIcon },
  mazo:         { etiqueta: 'Cartas',        Icono: DeckCardsIcon },
  carga:        { etiqueta: 'Carga',         Icono: CargoIcon },
  estrella:     { etiqueta: 'Estrella',      Icono: DeathStarIcon },
  espia:        { etiqueta: 'Espía',         Icono: SpyIcon },
  beskar:       { etiqueta: 'Beskar',        Icono: BeskarIcon },
  trofeo:       { etiqueta: 'Trofeo',        Icono: MandoTrophyIcon },
  datapad:      { etiqueta: 'Datapad',       Icono: DatapadIcon },
  medalla:      { etiqueta: 'Medalla',       Icono: MedalIcon },
  dado:         { etiqueta: 'Dado',          Icono: ChanceCubeIcon },
  holored:      { etiqueta: 'HoloRed',       Icono: HolonetIcon },
  calavera:     { etiqueta: 'Recompensa',    Icono: BountyIcon },
  matraz:       { etiqueta: 'Laboratorio',   Icono: LabIcon },
}

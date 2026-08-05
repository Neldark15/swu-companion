/**
 * Mapa de clave -> ícono, para resolverlos por nombre.
 *
 *     const Icon = SWU_ICON_MAP['vigilance']
 *
 * Vive en su propio archivo y no junto a los íconos porque un módulo que
 * exporta componentes Y un objeto rompe el refresco en caliente: al editarlo
 * durante el desarrollo, React recarga la página entera en vez de conservar
 * el estado.
 */

import type { IconProps } from './SWUIcons'
import {
  IconAggression,
  IconArchive,
  IconBlade,
  IconBlueprint,
  IconBooks,
  IconCalendar,
  IconChest,
  IconCommand,
  IconCouncil,
  IconCrown,
  IconCunning,
  IconDarkLord,
  IconDraft,
  IconDualBlades,
  IconFortress,
  IconGlowingStar,
  IconGrandMaster,
  IconHeart,
  IconHeroism,
  IconHolocron,
  IconInfinity,
  IconJediOrder,
  IconLightbulb,
  IconLightsaber,
  IconLocked,
  IconMasks,
  IconMedal,
  IconNewMoon,
  IconPasskey,
  IconSentinel,
  IconSkull,
  IconStar,
  IconStrategy,
  IconTrophy,
  IconValid,
  IconVigilance,
  IconVillainy,
  IconWrench,
  IconXp,
  IconYoungling,
} from './SWUIcons'

export const SWU_ICON_MAP: Record<string, React.ComponentType<IconProps>> = {
  // Aspects
  vigilance: IconVigilance,
  command: IconCommand,
  aggression: IconAggression,
  cunning: IconCunning,
  heroism: IconHeroism,
  villainy: IconVillainy,

  // Achievement icons
  sentinel: IconSentinel,
  fortress: IconFortress,
  calendar: IconCalendar,
  strategy: IconStrategy,
  medal: IconMedal,
  star: IconStar,
  crown: IconCrown,
  blade: IconBlade,
  dual_blades: IconDualBlades,
  skull: IconSkull,
  trophy: IconTrophy,
  draft: IconDraft,
  wrench: IconWrench,
  blueprint: IconBlueprint,
  valid: IconValid,
  lightbulb: IconLightbulb,
  chest: IconChest,
  books: IconBooks,
  archive: IconArchive,
  glowing_star: IconGlowingStar,
  heart: IconHeart,
  new_moon: IconNewMoon,
  passkey: IconPasskey,
  masks: IconMasks,
  infinity: IconInfinity,
  dark_lord: IconDarkLord,

  // Ranks
  youngling: IconYoungling,
  lightsaber: IconLightsaber,
  jedi_order: IconJediOrder,
  council: IconCouncil,
  grand_master: IconGrandMaster,

  // UI
  xp: IconXp,
  locked: IconLocked,
  holocron: IconHolocron,
}

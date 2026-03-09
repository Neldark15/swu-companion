/**
 * Cosmetics Service — Títulos desbloqueables
 * Players earn titles based on achievements, stats, and milestones.
 * Active title is displayed in public profiles and rankings.
 */

import type { PlayerStats } from './gamification'

// ─── TYPES ──────────────────────────────────────────────────────────

export type TitleRarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface Title {
  id: string
  name: string
  description: string
  condition: string          // human-readable unlock condition
  rarity: TitleRarity
  check: (stats: PlayerStats) => boolean
}

export const RARITY_CONFIG: Record<TitleRarity, { label: string; color: string; bgColor: string; borderColor: string }> = {
  common:    { label: 'Común',      color: 'text-gray-300',   bgColor: 'bg-gray-500/15',   borderColor: 'border-gray-500/30' },
  rare:      { label: 'Raro',       color: 'text-blue-400',   bgColor: 'bg-blue-500/15',   borderColor: 'border-blue-500/30' },
  epic:      { label: 'Épico',      color: 'text-purple-400', bgColor: 'bg-purple-500/15', borderColor: 'border-purple-500/30' },
  legendary: { label: 'Legendario', color: 'text-yellow-400', bgColor: 'bg-yellow-500/15', borderColor: 'border-yellow-500/30' },
}

// ─── TITLE CATALOG ──────────────────────────────────────────────────

export const TITLES: Title[] = [
  // Common
  {
    id: 'title_novato',
    name: 'Novato',
    description: 'Primer paso en la galaxia',
    condition: 'Crear perfil (nivel 1+)',
    rarity: 'common',
    check: (s) => s.level >= 1,
  },
  {
    id: 'title_duelista',
    name: 'Duelista',
    description: 'Curtido en batalla',
    condition: '50 partidas jugadas',
    rarity: 'common',
    check: (s) => s.matchesPlayed >= 50,
  },
  {
    id: 'title_arquitecto',
    name: 'Arquitecto',
    description: 'Constructor de estrategias',
    condition: '20 decks creados',
    rarity: 'common',
    check: (s) => s.decksCreated >= 20,
  },
  {
    id: 'title_explorador',
    name: 'Explorador',
    description: 'Conocedor de la galaxia',
    condition: '7 días de login',
    rarity: 'common',
    check: (s) => s.loginDays >= 7,
  },
  {
    id: 'title_generoso',
    name: 'Generoso',
    description: 'Comparte con los aliados',
    condition: '10 regalos enviados',
    rarity: 'common',
    check: (s) => s.giftsSent >= 10,
  },

  // Rare
  {
    id: 'title_invicto',
    name: 'Invicto',
    description: 'Racha imparable',
    condition: 'Racha de 10 victorias',
    rarity: 'rare',
    check: (s) => s.bestStreak >= 10,
  },
  {
    id: 'title_coleccionista',
    name: 'Coleccionista Galáctico',
    description: 'Acumulador de tesoros',
    condition: '500 cartas en colección',
    rarity: 'rare',
    check: (s) => s.cardsCollected >= 500,
  },
  {
    id: 'title_emisario',
    name: 'Emisario',
    description: 'Mensajero entre mundos',
    condition: '50 regalos enviados',
    rarity: 'rare',
    check: (s) => s.giftsSent >= 50,
  },
  {
    id: 'title_veterano',
    name: 'Veterano',
    description: 'Sobreviviente de mil batallas',
    condition: '200 partidas jugadas',
    rarity: 'rare',
    check: (s) => s.matchesPlayed >= 200,
  },
  {
    id: 'title_cronista',
    name: 'Cronista del Holocrón',
    description: 'Registrador de duelos',
    condition: '50 duelos en Holocrón',
    rarity: 'rare',
    check: (s) => s.arenaMatchesLogged >= 50,
  },

  // Epic
  {
    id: 'title_maestro_torneos',
    name: 'Maestro de Torneos',
    description: 'Dominador de la arena competitiva',
    condition: 'Ganar 5 torneos',
    rarity: 'epic',
    check: (s) => s.tournamentWins >= 5,
  },
  {
    id: 'title_leyenda_compartida',
    name: 'Leyenda Compartida',
    description: 'Vínculo forjado en la Fuerza',
    condition: 'Vínculo nivel 4 con alguien',
    rarity: 'epic',
    check: (s) => s.relationshipCount >= 1,
  },
  {
    id: 'title_vigilante_supremo',
    name: 'Vigilante Supremo',
    description: 'Constancia inquebrantable',
    condition: '100 días de login',
    rarity: 'epic',
    check: (s) => s.loginDays >= 100,
  },

  // Legendary
  {
    id: 'title_gran_maestro',
    name: 'Gran Maestro Galáctico',
    description: 'El pináculo del poder',
    condition: 'Alcanzar nivel 26+',
    rarity: 'legendary',
    check: (s) => s.level >= 26,
  },
  {
    id: 'title_todo_kyber',
    name: 'Imbuido en Kyber',
    description: 'Dominio absoluto de todos los aspectos',
    condition: 'Desbloquear 50+ logros',
    rarity: 'legendary',
    check: (s) => s.unlockedAchievements.length >= 50,
  },
]

// ─── FUNCTIONS ──────────────────────────────────────────────────────

/** Check which titles a player has earned */
export function getUnlockedTitles(stats: PlayerStats): string[] {
  return TITLES
    .filter(t => t.check(stats))
    .map(t => t.id)
}

/** Get title info by ID */
export function getTitleById(titleId: string): Title | undefined {
  return TITLES.find(t => t.id === titleId)
}

/** Get rarity config for a title */
export function getTitleRarity(titleId: string): typeof RARITY_CONFIG[TitleRarity] {
  const title = getTitleById(titleId)
  return title ? RARITY_CONFIG[title.rarity] : RARITY_CONFIG.common
}

/** Check for newly unlocked titles and return them */
export function checkNewTitles(stats: PlayerStats): Title[] {
  const currentlyUnlocked = stats.unlockedTitles || []
  const nowEarned = getUnlockedTitles(stats)
  return nowEarned
    .filter(id => !currentlyUnlocked.includes(id))
    .map(id => TITLES.find(t => t.id === id)!)
    .filter(Boolean)
}

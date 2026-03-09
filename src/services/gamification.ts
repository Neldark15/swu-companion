/**
 * Gamification Engine — Star Wars Unlimited Companion
 * XP, Levels, Ranks, Achievements, Aspect Stats
 *
 * 7 Categories (6 original + Progress):
 *   Vigilancia  – Constancia (login, partidas)
 *   Comando     – Torneos (crear, finalizar, top, ganar)
 *   Agresión    – Victorias & rachas
 *   Astucia     – Deckbuilding
 *   Heroísmo    – Colección (total, raras, especiales, favoritas)
 *   Villanía    – Especiales (perfil, passkey, modos, nivel)
 *   Progreso    – Meta-logros (registro Holocrón, completar categorías)
 */

// ─── TYPES ──────────────────────────────────────────────────────────

export type Aspect = 'Vigilance' | 'Command' | 'Aggression' | 'Cunning' | 'Heroism' | 'Villainy' | 'Progress'
export type XpAction = 'match_played' | 'match_won' | 'tournament_created' | 'tournament_finished' |
  'deck_created' | 'deck_valid' | 'card_favorited' | 'card_collected' | 'daily_login' |
  'tournament_won' | 'arena_match_logged'

export interface Achievement {
  id: string
  name: string
  description: string
  aspect: Aspect
  icon: string        // Emoji fallback
  svgIcon: string     // Key for SWU_ICON_MAP
  threshold: number   // Value needed to unlock
  statKey: string     // Which stat to check
}

export interface Rank {
  name: string
  minLevel: number
  maxLevel: number
  color: string       // Tailwind text color
  bgColor: string     // Tailwind bg color
  borderColor: string // Tailwind border color
}

export interface PlayerStats {
  profileId: string
  xp: number
  level: number
  wins: number
  losses: number
  matchesPlayed: number
  tournamentsCreated: number
  tournamentsFinished: number
  tournamentWins: number           // standing === 1
  tournamentTopPlacements: number  // standing <= 4
  decksCreated: number
  decksValid: number
  cardsCollected: number
  cardsFavorited: number
  legendaryCards: number           // Legendary + Special rarity cards
  rareCards: number                // Rare+ cards in collection
  currentStreak: number
  bestStreak: number
  loginDays: number
  lastLoginDate: string        // YYYY-MM-DD
  modesPlayed: string[]        // ['premier', 'twin_suns']
  arenaMatchesLogged: number   // matches logged in Holocrón
  unlockedAchievements: string[]
  achievementDates: Record<string, number> // achievementId → timestamp
}

export interface LevelInfo {
  level: number
  rank: Rank
  xpCurrent: number    // XP within current level
  xpNeeded: number     // XP needed for this level
  xpTotal: number      // Total XP
  progress: number     // 0-1
}

export type AspectTier = 'copper' | 'silver' | 'gold' | 'kyber'

export const TIER_ORDER: AspectTier[] = ['copper', 'silver', 'gold', 'kyber']

export const TIER_CONFIG: Record<AspectTier, { label: string; borderColor: string; glowColor: string }> = {
  copper: { label: 'Cobre', borderColor: '#B87333', glowColor: 'rgba(184,115,51,0.4)' },
  silver: { label: 'Plata', borderColor: '#C0C0C0', glowColor: 'rgba(192,192,192,0.4)' },
  gold:   { label: 'Oro',   borderColor: '#FFD700', glowColor: 'rgba(255,215,0,0.4)' },
  kyber:  { label: 'Kyber', borderColor: '#00BFFF', glowColor: 'rgba(0,191,255,0.6)' },
}

export interface AspectBar {
  aspect: Aspect
  label: string
  icon: string
  svgIcon: string
  value: number          // raw stat value
  maxValue: number       // max for current tier threshold
  progress: number       // 0-1 within current tier
  color: string          // Tailwind gradient from color
  bgColor: string
  textColor: string
  borderColor: string
  displayValue: string   // "45/100"
  tier: AspectTier       // current tier
  tierIndex: number      // 0-3
  tierProgress: number   // 0-100 display value within tier
}

// ─── RANKS ──────────────────────────────────────────────────────────

export const RANKS: Rank[] = [
  { name: 'Youngling', minLevel: 1, maxLevel: 5, color: 'text-gray-400', bgColor: 'bg-gray-500/20', borderColor: 'border-gray-500/30' },
  { name: 'Padawan', minLevel: 6, maxLevel: 10, color: 'text-blue-400', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500/30' },
  { name: 'Caballero Jedi', minLevel: 11, maxLevel: 15, color: 'text-green-400', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/30' },
  { name: 'Maestro Jedi', minLevel: 16, maxLevel: 20, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-500/30' },
  { name: 'Miembro del Consejo', minLevel: 21, maxLevel: 25, color: 'text-amber-400', bgColor: 'bg-amber-500/20', borderColor: 'border-amber-500/30' },
  { name: 'Gran Maestro', minLevel: 26, maxLevel: 999, color: 'text-amber-300', bgColor: 'bg-amber-400/20', borderColor: 'border-amber-400/40' },
]

// ─── XP CONFIG ──────────────────────────────────────────────────────

export const XP_VALUES: Record<XpAction, number> = {
  match_played: 10,
  match_won: 25,
  tournament_created: 20,
  tournament_finished: 50,
  tournament_won: 100,
  deck_created: 15,
  deck_valid: 30,
  card_favorited: 2,
  card_collected: 1,
  daily_login: 5,
  arena_match_logged: 15,
}

// ─── ACHIEVEMENTS ───────────────────────────────────────────────────
// Original 30 achievements preserved + new ones added per user specs

export const ACHIEVEMENTS: Achievement[] = [
  // ═══════════════════════════════════════════════════════════════════
  // VIGILANCIA (Azul) — Consistencia: login acumulado + partidas
  // ═══════════════════════════════════════════════════════════════════
  { id: 'vig_1', name: 'Centinela', description: '10 partidas jugadas', aspect: 'Vigilance', icon: '🛡️', svgIcon: 'sentinel', threshold: 10, statKey: 'matchesPlayed' },
  { id: 'vig_2', name: 'Guardián', description: '50 partidas jugadas', aspect: 'Vigilance', icon: '🏰', svgIcon: 'fortress', threshold: 50, statKey: 'matchesPlayed' },
  { id: 'vig_3', name: 'Protector', description: '100 partidas jugadas', aspect: 'Vigilance', icon: '⚜️', svgIcon: 'vigilance', threshold: 100, statKey: 'matchesPlayed' },
  { id: 'vig_4', name: 'Fortaleza', description: '7 días de login acumulados', aspect: 'Vigilance', icon: '🗓️', svgIcon: 'calendar', threshold: 7, statKey: 'loginDays' },
  { id: 'vig_5', name: 'Incansable', description: '30 días de login acumulados', aspect: 'Vigilance', icon: '📅', svgIcon: 'calendar', threshold: 30, statKey: 'loginDays' },
  // NEW: 100 login days tier
  { id: 'vig_6', name: 'Eterno', description: '100 días de login acumulados', aspect: 'Vigilance', icon: '🏛️', svgIcon: 'fortress', threshold: 100, statKey: 'loginDays' },

  // ═══════════════════════════════════════════════════════════════════
  // COMANDO (Verde) — Torneos: crear, finalizar, top placements, ganar
  // ═══════════════════════════════════════════════════════════════════
  { id: 'cmd_1', name: 'Estratega', description: 'Crear 1 torneo', aspect: 'Command', icon: '📋', svgIcon: 'strategy', threshold: 1, statKey: 'tournamentsCreated' },
  { id: 'cmd_2', name: 'Comandante', description: 'Finalizar 5 torneos', aspect: 'Command', icon: '🎖️', svgIcon: 'medal', threshold: 5, statKey: 'tournamentsFinished' },
  { id: 'cmd_3', name: 'General', description: 'Finalizar 10 torneos', aspect: 'Command', icon: '⭐', svgIcon: 'star', threshold: 10, statKey: 'tournamentsFinished' },
  { id: 'cmd_4', name: 'Táctico', description: 'Finalizar 15 torneos', aspect: 'Command', icon: '🎯', svgIcon: 'cunning', threshold: 15, statKey: 'tournamentsFinished' },
  { id: 'cmd_5', name: 'Mariscal', description: 'Finalizar 25 torneos', aspect: 'Command', icon: '👑', svgIcon: 'crown', threshold: 25, statKey: 'tournamentsFinished' },
  // NEW: Top placements (standing <= 4)
  { id: 'cmd_6', name: 'Top Contendiente', description: 'Top 4 en 1 torneo', aspect: 'Command', icon: '🏅', svgIcon: 'medal', threshold: 1, statKey: 'tournamentTopPlacements' },
  { id: 'cmd_7', name: 'Élite', description: 'Top 4 en 5 torneos', aspect: 'Command', icon: '🏅', svgIcon: 'medal', threshold: 5, statKey: 'tournamentTopPlacements' },
  { id: 'cmd_8', name: 'Leyenda Competitiva', description: 'Top 4 en 15 torneos', aspect: 'Command', icon: '⭐', svgIcon: 'star', threshold: 15, statKey: 'tournamentTopPlacements' },
  { id: 'cmd_9', name: 'Gran Almirante', description: 'Top 4 en 50 torneos', aspect: 'Command', icon: '👑', svgIcon: 'crown', threshold: 50, statKey: 'tournamentTopPlacements' },
  // NEW: Tournament wins (standing === 1)
  { id: 'cmd_10', name: 'Primer Triunfo', description: 'Ganar 1 torneo', aspect: 'Command', icon: '🏆', svgIcon: 'trophy', threshold: 1, statKey: 'tournamentWins' },
  { id: 'cmd_11', name: 'Campeón Estelar', description: 'Ganar 3 torneos', aspect: 'Command', icon: '🏆', svgIcon: 'trophy', threshold: 3, statKey: 'tournamentWins' },
  { id: 'cmd_12', name: 'Invicto', description: 'Ganar 10 torneos', aspect: 'Command', icon: '👑', svgIcon: 'crown', threshold: 10, statKey: 'tournamentWins' },

  // ═══════════════════════════════════════════════════════════════════
  // AGRESIÓN (Rojo) — Victorias acumuladas + rachas de combate
  // ═══════════════════════════════════════════════════════════════════
  { id: 'agg_1', name: 'Primera Sangre', description: '1 victoria', aspect: 'Aggression', icon: '⚔️', svgIcon: 'blade', threshold: 1, statKey: 'wins' },
  { id: 'agg_2', name: 'Gladiador', description: '10 victorias', aspect: 'Aggression', icon: '🗡️', svgIcon: 'dual_blades', threshold: 10, statKey: 'wins' },
  { id: 'agg_3', name: 'Conquistador', description: '50 victorias', aspect: 'Aggression', icon: '🔥', svgIcon: 'aggression', threshold: 50, statKey: 'wins' },
  { id: 'agg_4', name: 'Imparable', description: '100 victorias', aspect: 'Aggression', icon: '💀', svgIcon: 'skull', threshold: 100, statKey: 'wins' },
  { id: 'agg_5', name: 'Leyenda', description: 'Racha de 3 victorias', aspect: 'Aggression', icon: '🏆', svgIcon: 'trophy', threshold: 3, statKey: 'bestStreak' },
  // NEW: Higher streak tiers
  { id: 'agg_6', name: 'Dominación', description: 'Racha de 5 victorias', aspect: 'Aggression', icon: '🔥', svgIcon: 'aggression', threshold: 5, statKey: 'bestStreak' },
  { id: 'agg_7', name: 'Leyenda Sith', description: 'Racha de 10 victorias', aspect: 'Aggression', icon: '👿', svgIcon: 'dark_lord', threshold: 10, statKey: 'bestStreak' },
  // NEW: Tournament victories (25/50)
  { id: 'agg_8', name: 'Devastador', description: '25 victorias', aspect: 'Aggression', icon: '🗡️', svgIcon: 'dual_blades', threshold: 25, statKey: 'wins' },

  // ═══════════════════════════════════════════════════════════════════
  // ASTUCIA (Amarillo) — Deckbuilding (conservados)
  // ═══════════════════════════════════════════════════════════════════
  { id: 'cun_1', name: 'Aprendiz', description: '1 deck creado', aspect: 'Cunning', icon: '📝', svgIcon: 'draft', threshold: 1, statKey: 'decksCreated' },
  { id: 'cun_2', name: 'Ingeniero', description: '5 decks creados', aspect: 'Cunning', icon: '🔧', svgIcon: 'wrench', threshold: 5, statKey: 'decksCreated' },
  { id: 'cun_3', name: 'Arquitecto', description: '10 decks creados', aspect: 'Cunning', icon: '🏗️', svgIcon: 'blueprint', threshold: 10, statKey: 'decksCreated' },
  { id: 'cun_4', name: 'Maestro Constructor', description: '5 decks válidos', aspect: 'Cunning', icon: '✅', svgIcon: 'valid', threshold: 5, statKey: 'decksValid' },
  { id: 'cun_5', name: 'Innovador', description: '20 decks creados', aspect: 'Cunning', icon: '💡', svgIcon: 'lightbulb', threshold: 20, statKey: 'decksCreated' },

  // ═══════════════════════════════════════════════════════════════════
  // HEROÍSMO (Cian) — Colección: total, rarezas especiales, favoritas
  // ═══════════════════════════════════════════════════════════════════
  { id: 'her_1', name: 'Coleccionista', description: '50 cartas en colección', aspect: 'Heroism', icon: '📦', svgIcon: 'chest', threshold: 50, statKey: 'cardsCollected' },
  { id: 'her_2', name: 'Archivista', description: '200 cartas en colección', aspect: 'Heroism', icon: '📚', svgIcon: 'books', threshold: 200, statKey: 'cardsCollected' },
  { id: 'her_3', name: 'Curador', description: '500 cartas en colección', aspect: 'Heroism', icon: '🗃️', svgIcon: 'archive', threshold: 500, statKey: 'cardsCollected' },
  { id: 'her_4', name: 'Enciclopedista', description: '1000 cartas', aspect: 'Heroism', icon: '🌟', svgIcon: 'glowing_star', threshold: 1000, statKey: 'cardsCollected' },
  { id: 'her_5', name: 'Bibliófilo', description: '50 cartas favoritas', aspect: 'Heroism', icon: '❤️', svgIcon: 'heart', threshold: 50, statKey: 'cardsFavorited' },
  // NEW: Legendary/Special cards (proxy Hyperspace)
  { id: 'her_6', name: 'Rastreador de Reliquias', description: '25 cartas especiales', aspect: 'Heroism', icon: '💎', svgIcon: 'heroism', threshold: 25, statKey: 'legendaryCards' },
  { id: 'her_7', name: 'Cazador de Tesoros', description: '50 cartas especiales', aspect: 'Heroism', icon: '💎', svgIcon: 'heroism', threshold: 50, statKey: 'legendaryCards' },
  { id: 'her_8', name: 'Guardián del Archivo', description: '100 cartas especiales', aspect: 'Heroism', icon: '💎', svgIcon: 'heroism', threshold: 100, statKey: 'legendaryCards' },
  // NEW: Rare+ cards (proxy Foil)
  { id: 'her_9', name: 'Acumulador', description: '50 cartas raras+', aspect: 'Heroism', icon: '📦', svgIcon: 'chest', threshold: 50, statKey: 'rareCards' },
  { id: 'her_10', name: 'Bóveda Estelar', description: '100 cartas raras+', aspect: 'Heroism', icon: '📚', svgIcon: 'books', threshold: 100, statKey: 'rareCards' },
  { id: 'her_11', name: 'Curador Galáctico', description: '200 cartas raras+', aspect: 'Heroism', icon: '🗃️', svgIcon: 'archive', threshold: 200, statKey: 'rareCards' },

  // ═══════════════════════════════════════════════════════════════════
  // VILLANÍA (Púrpura) — Especiales (conservados)
  // ═══════════════════════════════════════════════════════════════════
  { id: 'vil_1', name: 'Iniciado', description: 'Crear perfil', aspect: 'Villainy', icon: '🌑', svgIcon: 'new_moon', threshold: 1, statKey: '_profileCreated' },
  { id: 'vil_2', name: 'Blindado', description: 'Registrar Passkey', aspect: 'Villainy', icon: '🔐', svgIcon: 'passkey', threshold: 1, statKey: '_hasPasskey' },
  { id: 'vil_3', name: 'Diversificado', description: 'Jugar 2+ modos', aspect: 'Villainy', icon: '🎭', svgIcon: 'masks', threshold: 2, statKey: '_modesPlayed' },
  { id: 'vil_4', name: 'Completo', description: 'Logro de cada aspecto', aspect: 'Villainy', icon: '♾️', svgIcon: 'infinity', threshold: 7, statKey: '_aspectsCovered' },
  { id: 'vil_5', name: 'Maestro Oscuro', description: 'Alcanzar nivel 20', aspect: 'Villainy', icon: '👿', svgIcon: 'dark_lord', threshold: 20, statKey: 'level' },

  // ═══════════════════════════════════════════════════════════════════
  // PROGRESO (Ámbar/Dorado) — Registro de duelos + meta-logros
  // ═══════════════════════════════════════════════════════════════════
  { id: 'pro_1', name: 'Primer Registro', description: 'Registrar 1 duelo en Holocrón', aspect: 'Progress', icon: '📝', svgIcon: 'draft', threshold: 1, statKey: 'arenaMatchesLogged' },
  { id: 'pro_2', name: 'Cronista', description: 'Registrar 10 duelos', aspect: 'Progress', icon: '📜', svgIcon: 'blueprint', threshold: 10, statKey: 'arenaMatchesLogged' },
  { id: 'pro_3', name: 'Historiador', description: 'Registrar 50 duelos', aspect: 'Progress', icon: '📖', svgIcon: 'books', threshold: 50, statKey: 'arenaMatchesLogged' },
  // Meta: complete each category
  { id: 'pro_4', name: 'Héroe Completo', description: 'Completar Heroísmo 100%', aspect: 'Progress', icon: '💎', svgIcon: 'heroism', threshold: 1, statKey: '_heroismComplete' },
  { id: 'pro_5', name: 'Comandante Supremo', description: 'Completar Comando 100%', aspect: 'Progress', icon: '⚔️', svgIcon: 'command', threshold: 1, statKey: '_commandComplete' },
  { id: 'pro_6', name: 'Vigilante Eterno', description: 'Completar Vigilancia 100%', aspect: 'Progress', icon: '🛡️', svgIcon: 'vigilance', threshold: 1, statKey: '_vigilanceComplete' },
  { id: 'pro_7', name: 'Destructor Total', description: 'Completar Agresión 100%', aspect: 'Progress', icon: '🔥', svgIcon: 'aggression', threshold: 1, statKey: '_aggressionComplete' },
  // Meta: complete ALL
  { id: 'pro_8', name: 'Leyenda Suprema', description: 'Completar TODOS los logros', aspect: 'Progress', icon: '👑', svgIcon: 'crown', threshold: 1, statKey: '_allComplete' },
]

// ─── ASPECT CONFIG ──────────────────────────────────────────────────

export const ASPECT_CONFIG: Record<Aspect, {
  label: string; icon: string; svgIcon: string; color: string; bgColor: string;
  textColor: string; borderColor: string; tierThresholds: number[]; statKey: string;
}> = {
  Vigilance:  { label: 'Vigilancia',  icon: '🛡️', svgIcon: 'vigilance',  color: 'from-blue-500 to-blue-700',    bgColor: 'bg-blue-500/20',    textColor: 'text-blue-400',    borderColor: 'border-blue-500/30',    tierThresholds: [100, 200, 300, 400],  statKey: 'matchesPlayed' },
  Command:    { label: 'Comando',     icon: '⚔️', svgIcon: 'command',    color: 'from-green-500 to-green-700',   bgColor: 'bg-green-500/20',   textColor: 'text-green-400',   borderColor: 'border-green-500/30',   tierThresholds: [25, 50, 75, 100],    statKey: 'tournamentsFinished' },
  Aggression: { label: 'Agresión',    icon: '🔥', svgIcon: 'aggression', color: 'from-red-500 to-red-700',      bgColor: 'bg-red-500/20',     textColor: 'text-red-400',     borderColor: 'border-red-500/30',     tierThresholds: [25, 50, 100, 200],   statKey: 'wins' },
  Cunning:    { label: 'Astucia',     icon: '🎯', svgIcon: 'cunning',    color: 'from-yellow-500 to-yellow-700', bgColor: 'bg-yellow-500/20',  textColor: 'text-yellow-400',  borderColor: 'border-yellow-500/30',  tierThresholds: [10, 25, 50, 100],    statKey: 'decksCreated' },
  Heroism:    { label: 'Heroísmo',    icon: '💎', svgIcon: 'heroism',    color: 'from-cyan-400 to-cyan-600',    bgColor: 'bg-cyan-500/20',    textColor: 'text-cyan-300',    borderColor: 'border-cyan-500/30',    tierThresholds: [100, 300, 600, 1000], statKey: 'cardsCollected' },
  Villainy:   { label: 'Villanía',    icon: '🌙', svgIcon: 'villainy',   color: 'from-purple-500 to-purple-700', bgColor: 'bg-purple-500/20',  textColor: 'text-purple-400',  borderColor: 'border-purple-500/30',  tierThresholds: [8, 15, 22, 30],      statKey: 'unlockedCount' },
  Progress:   { label: 'Progreso',    icon: '🌟', svgIcon: 'glowing_star', color: 'from-amber-400 to-amber-600', bgColor: 'bg-amber-500/20',   textColor: 'text-amber-400',   borderColor: 'border-amber-500/30',   tierThresholds: [10, 25, 50, 100],    statKey: 'arenaMatchesLogged' },
}

// ─── FUNCTIONS ──────────────────────────────────────────────────────

export function calculateLevel(xp: number): LevelInfo {
  let level = 1
  let xpRemaining = xp

  while (xpRemaining >= level * 100) {
    xpRemaining -= level * 100
    level++
  }

  const xpNeeded = level * 100
  const rank = RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || RANKS[0]

  return {
    level,
    rank,
    xpCurrent: xpRemaining,
    xpNeeded,
    xpTotal: xp,
    progress: xpRemaining / xpNeeded,
  }
}

export function getXpForAction(action: XpAction): number {
  return XP_VALUES[action] || 0
}

/** Helper: count how many achievements of a given aspect are unlocked */
function countAspectUnlocks(aspect: Aspect, unlocked: string[]): number {
  return ACHIEVEMENTS.filter(a => a.aspect === aspect && unlocked.includes(a.id)).length
}

/** Helper: total achievements for an aspect (excluding meta-achievements) */
function totalAspectAchievements(aspect: Aspect): number {
  return ACHIEVEMENTS.filter(a => a.aspect === aspect).length
}

export function checkAchievements(stats: PlayerStats): string[] {
  const newUnlocks: string[] = []

  // Calculate total non-Progress achievements (for _allComplete)
  const nonProgressAchievements = ACHIEVEMENTS.filter(a => a.aspect !== 'Progress')

  for (const ach of ACHIEVEMENTS) {
    if (stats.unlockedAchievements.includes(ach.id)) continue

    let value = 0
    const allUnlocked = [...stats.unlockedAchievements, ...newUnlocks]

    // Special stat keys
    if (ach.statKey === '_profileCreated') {
      value = 1 // Always true if we have stats
    } else if (ach.statKey === '_hasPasskey') {
      // Checked externally — skip here
      continue
    } else if (ach.statKey === '_modesPlayed') {
      value = stats.modesPlayed.length
    } else if (ach.statKey === '_aspectsCovered') {
      // Count unique aspects that have at least 1 unlocked achievement
      const aspectsWithUnlock = new Set<string>()
      for (const uid of allUnlocked) {
        const a = ACHIEVEMENTS.find(x => x.id === uid)
        if (a) aspectsWithUnlock.add(a.aspect)
      }
      value = aspectsWithUnlock.size
    } else if (ach.statKey === '_heroismComplete') {
      const total = totalAspectAchievements('Heroism')
      const unlocked = countAspectUnlocks('Heroism', allUnlocked)
      value = unlocked >= total ? 1 : 0
    } else if (ach.statKey === '_commandComplete') {
      const total = totalAspectAchievements('Command')
      const unlocked = countAspectUnlocks('Command', allUnlocked)
      value = unlocked >= total ? 1 : 0
    } else if (ach.statKey === '_vigilanceComplete') {
      const total = totalAspectAchievements('Vigilance')
      const unlocked = countAspectUnlocks('Vigilance', allUnlocked)
      value = unlocked >= total ? 1 : 0
    } else if (ach.statKey === '_aggressionComplete') {
      const total = totalAspectAchievements('Aggression')
      const unlocked = countAspectUnlocks('Aggression', allUnlocked)
      value = unlocked >= total ? 1 : 0
    } else if (ach.statKey === '_allComplete') {
      // All non-Progress achievements unlocked?
      const totalNonProg = nonProgressAchievements.length
      const unlockedNonProg = nonProgressAchievements.filter(a => allUnlocked.includes(a.id)).length
      value = unlockedNonProg >= totalNonProg ? 1 : 0
    } else if (ach.statKey === 'level') {
      value = calculateLevel(stats.xp).level
    } else {
      value = (stats as unknown as Record<string, number>)[ach.statKey] || 0
    }

    if (value >= ach.threshold) {
      newUnlocks.push(ach.id)
    }
  }

  return newUnlocks
}

/** Calculate tier info for a given raw value and tier thresholds */
function calculateTier(rawValue: number, thresholds: number[]): { tier: AspectTier; tierIndex: number; progress: number; tierProgress: number; displayMax: number } {
  for (let i = 0; i < thresholds.length; i++) {
    const prevThreshold = i === 0 ? 0 : thresholds[i - 1]
    const currentThreshold = thresholds[i]
    const range = currentThreshold - prevThreshold

    if (rawValue < currentThreshold) {
      const withinTier = rawValue - prevThreshold
      const progress = withinTier / range
      const tierProgress = Math.round(progress * 100)
      return {
        tier: TIER_ORDER[i],
        tierIndex: i,
        progress,
        tierProgress,
        displayMax: 100,
      }
    }
  }
  // Maxed out — kyber tier, full bar
  return { tier: 'kyber', tierIndex: 3, progress: 1, tierProgress: 100, displayMax: 100 }
}

export function getAspectBars(stats: PlayerStats): AspectBar[] {
  const unlockedCount = stats.unlockedAchievements.length
  const aspects: Aspect[] = ['Vigilance', 'Command', 'Aggression', 'Cunning', 'Heroism', 'Villainy', 'Progress']

  return aspects.map((aspect) => {
    const config = ASPECT_CONFIG[aspect]
    // Get raw stat value
    let rawValue: number
    switch (config.statKey) {
      case 'matchesPlayed': rawValue = stats.matchesPlayed; break
      case 'tournamentsFinished': rawValue = stats.tournamentsFinished; break
      case 'tournamentTopPlacements': rawValue = stats.tournamentTopPlacements; break
      case 'wins': rawValue = stats.wins; break
      case 'decksCreated': rawValue = stats.decksCreated; break
      case 'cardsCollected': rawValue = stats.cardsCollected; break
      case 'loginDays': rawValue = stats.loginDays; break
      case 'arenaMatchesLogged': rawValue = stats.arenaMatchesLogged; break
      case 'unlockedCount': rawValue = unlockedCount; break
      default: rawValue = 0
    }

    const tierInfo = calculateTier(rawValue, config.tierThresholds)

    return {
      aspect,
      label: config.label,
      icon: config.icon,
      svgIcon: config.svgIcon,
      value: rawValue,
      maxValue: tierInfo.displayMax,
      progress: tierInfo.progress,
      color: config.color,
      bgColor: config.bgColor,
      textColor: config.textColor,
      borderColor: config.borderColor,
      displayValue: `${tierInfo.tierProgress}/100`,
      tier: tierInfo.tier,
      tierIndex: tierInfo.tierIndex,
      tierProgress: tierInfo.tierProgress,
    }
  })
}

export function createDefaultStats(profileId: string): PlayerStats {
  const today = new Date().toISOString().split('T')[0]
  return {
    profileId,
    xp: 0,
    level: 1,
    wins: 0,
    losses: 0,
    matchesPlayed: 0,
    tournamentsCreated: 0,
    tournamentsFinished: 0,
    tournamentWins: 0,
    tournamentTopPlacements: 0,
    decksCreated: 0,
    decksValid: 0,
    cardsCollected: 0,
    cardsFavorited: 0,
    legendaryCards: 0,
    rareCards: 0,
    currentStreak: 0,
    bestStreak: 0,
    loginDays: 1,
    lastLoginDate: today,
    modesPlayed: [],
    arenaMatchesLogged: 0,
    unlockedAchievements: ['vil_1'], // "Iniciado" unlocked on profile creation
    achievementDates: { vil_1: Date.now() },
  }
}

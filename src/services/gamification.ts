/**
 * Gamification Engine — Star Wars Unlimited Companion
 * XP, Levels, Ranks, Achievements, Aspect Stats
 */

// ─── TYPES ──────────────────────────────────────────────────────────

export type Aspect = 'Vigilance' | 'Command' | 'Aggression' | 'Cunning' | 'Heroism' | 'Villainy'
export type XpAction = 'match_played' | 'match_won' | 'tournament_created' | 'tournament_finished' |
  'deck_created' | 'deck_valid' | 'card_favorited' | 'card_collected' | 'daily_login'

export interface Achievement {
  id: string
  name: string
  description: string
  aspect: Aspect
  icon: string        // Emoji icon
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
  decksCreated: number
  decksValid: number
  cardsCollected: number
  cardsFavorited: number
  currentStreak: number
  bestStreak: number
  loginDays: number
  lastLoginDate: string        // YYYY-MM-DD
  modesPlayed: string[]        // ['premier', 'twin_suns']
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

export interface AspectBar {
  aspect: Aspect
  label: string
  icon: string
  value: number
  maxValue: number
  progress: number     // 0-1
  color: string        // Tailwind gradient from color
  bgColor: string
  textColor: string
  displayValue: string
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
  deck_created: 15,
  deck_valid: 30,
  card_favorited: 2,
  card_collected: 1,
  daily_login: 5,
}

// ─── ACHIEVEMENTS ───────────────────────────────────────────────────

export const ACHIEVEMENTS: Achievement[] = [
  // Vigilance (Azul) — Consistencia
  { id: 'vig_1', name: 'Centinela', description: '10 partidas jugadas', aspect: 'Vigilance', icon: '🛡️', threshold: 10, statKey: 'matchesPlayed' },
  { id: 'vig_2', name: 'Guardián', description: '50 partidas jugadas', aspect: 'Vigilance', icon: '🏰', threshold: 50, statKey: 'matchesPlayed' },
  { id: 'vig_3', name: 'Protector', description: '100 partidas jugadas', aspect: 'Vigilance', icon: '⚜️', threshold: 100, statKey: 'matchesPlayed' },
  { id: 'vig_4', name: 'Fortaleza', description: 'Login 7 días seguidos', aspect: 'Vigilance', icon: '🗓️', threshold: 7, statKey: 'loginDays' },
  { id: 'vig_5', name: 'Incansable', description: 'Login 30 días seguidos', aspect: 'Vigilance', icon: '📅', threshold: 30, statKey: 'loginDays' },

  // Command (Verde) — Torneos
  { id: 'cmd_1', name: 'Estratega', description: 'Crear 1 torneo', aspect: 'Command', icon: '📋', threshold: 1, statKey: 'tournamentsCreated' },
  { id: 'cmd_2', name: 'Comandante', description: 'Finalizar 5 torneos', aspect: 'Command', icon: '🎖️', threshold: 5, statKey: 'tournamentsFinished' },
  { id: 'cmd_3', name: 'General', description: 'Finalizar 10 torneos', aspect: 'Command', icon: '⭐', threshold: 10, statKey: 'tournamentsFinished' },
  { id: 'cmd_4', name: 'Táctico', description: 'Finalizar 15 torneos', aspect: 'Command', icon: '🎯', threshold: 15, statKey: 'tournamentsFinished' },
  { id: 'cmd_5', name: 'Mariscal', description: 'Finalizar 25 torneos', aspect: 'Command', icon: '👑', threshold: 25, statKey: 'tournamentsFinished' },

  // Aggression (Rojo) — Victorias
  { id: 'agg_1', name: 'Primera Sangre', description: '1 victoria', aspect: 'Aggression', icon: '⚔️', threshold: 1, statKey: 'wins' },
  { id: 'agg_2', name: 'Gladiador', description: '10 victorias', aspect: 'Aggression', icon: '🗡️', threshold: 10, statKey: 'wins' },
  { id: 'agg_3', name: 'Conquistador', description: '50 victorias', aspect: 'Aggression', icon: '🔥', threshold: 50, statKey: 'wins' },
  { id: 'agg_4', name: 'Imparable', description: '100 victorias', aspect: 'Aggression', icon: '💀', threshold: 100, statKey: 'wins' },
  { id: 'agg_5', name: 'Leyenda', description: 'Racha de 3 victorias', aspect: 'Aggression', icon: '🏆', threshold: 3, statKey: 'bestStreak' },

  // Cunning (Amarillo) — Deckbuilding
  { id: 'cun_1', name: 'Aprendiz', description: '1 deck creado', aspect: 'Cunning', icon: '📝', threshold: 1, statKey: 'decksCreated' },
  { id: 'cun_2', name: 'Ingeniero', description: '5 decks creados', aspect: 'Cunning', icon: '🔧', threshold: 5, statKey: 'decksCreated' },
  { id: 'cun_3', name: 'Arquitecto', description: '10 decks creados', aspect: 'Cunning', icon: '🏗️', threshold: 10, statKey: 'decksCreated' },
  { id: 'cun_4', name: 'Maestro Constructor', description: '5 decks válidos', aspect: 'Cunning', icon: '✅', threshold: 5, statKey: 'decksValid' },
  { id: 'cun_5', name: 'Innovador', description: '20 decks creados', aspect: 'Cunning', icon: '💡', threshold: 20, statKey: 'decksCreated' },

  // Heroism (Cian) — Colección
  { id: 'her_1', name: 'Coleccionista', description: '50 cartas en colección', aspect: 'Heroism', icon: '📦', threshold: 50, statKey: 'cardsCollected' },
  { id: 'her_2', name: 'Archivista', description: '200 cartas en colección', aspect: 'Heroism', icon: '📚', threshold: 200, statKey: 'cardsCollected' },
  { id: 'her_3', name: 'Curador', description: '500 cartas en colección', aspect: 'Heroism', icon: '🗃️', threshold: 500, statKey: 'cardsCollected' },
  { id: 'her_4', name: 'Enciclopedista', description: '1000 cartas', aspect: 'Heroism', icon: '🌟', threshold: 1000, statKey: 'cardsCollected' },
  { id: 'her_5', name: 'Bibliófilo', description: '50 cartas favoritas', aspect: 'Heroism', icon: '❤️', threshold: 50, statKey: 'cardsFavorited' },

  // Villainy (Púrpura) — Especiales
  { id: 'vil_1', name: 'Iniciado', description: 'Crear perfil', aspect: 'Villainy', icon: '🌑', threshold: 1, statKey: '_profileCreated' },
  { id: 'vil_2', name: 'Blindado', description: 'Registrar Passkey', aspect: 'Villainy', icon: '🔐', threshold: 1, statKey: '_hasPasskey' },
  { id: 'vil_3', name: 'Diversificado', description: 'Jugar 2+ modos', aspect: 'Villainy', icon: '🎭', threshold: 2, statKey: '_modesPlayed' },
  { id: 'vil_4', name: 'Completo', description: 'Logro de cada aspecto', aspect: 'Villainy', icon: '♾️', threshold: 6, statKey: '_aspectsCovered' },
  { id: 'vil_5', name: 'Maestro Oscuro', description: 'Alcanzar nivel 20', aspect: 'Villainy', icon: '👿', threshold: 20, statKey: 'level' },
]

// ─── ASPECT CONFIG ──────────────────────────────────────────────────

export const ASPECT_CONFIG: Record<Aspect, { label: string; icon: string; color: string; bgColor: string; textColor: string; borderColor: string }> = {
  Vigilance: { label: 'Vigilancia', icon: '🛡️', color: 'from-blue-500 to-blue-700', bgColor: 'bg-blue-500/20', textColor: 'text-blue-400', borderColor: 'border-blue-500/30' },
  Command: { label: 'Comando', icon: '⚔️', color: 'from-green-500 to-green-700', bgColor: 'bg-green-500/20', textColor: 'text-green-400', borderColor: 'border-green-500/30' },
  Aggression: { label: 'Agresión', icon: '🔥', color: 'from-red-500 to-red-700', bgColor: 'bg-red-500/20', textColor: 'text-red-400', borderColor: 'border-red-500/30' },
  Cunning: { label: 'Astucia', icon: '🎯', color: 'from-yellow-500 to-yellow-700', bgColor: 'bg-yellow-500/20', textColor: 'text-yellow-400', borderColor: 'border-yellow-500/30' },
  Heroism: { label: 'Heroísmo', icon: '💎', color: 'from-cyan-400 to-cyan-600', bgColor: 'bg-cyan-500/20', textColor: 'text-cyan-300', borderColor: 'border-cyan-500/30' },
  Villainy: { label: 'Villanía', icon: '🌙', color: 'from-purple-500 to-purple-700', bgColor: 'bg-purple-500/20', textColor: 'text-purple-400', borderColor: 'border-purple-500/30' },
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

export function checkAchievements(stats: PlayerStats): string[] {
  const newUnlocks: string[] = []

  for (const ach of ACHIEVEMENTS) {
    if (stats.unlockedAchievements.includes(ach.id)) continue

    let value = 0

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
      for (const uid of [...stats.unlockedAchievements, ...newUnlocks]) {
        const a = ACHIEVEMENTS.find(x => x.id === uid)
        if (a) aspectsWithUnlock.add(a.aspect)
      }
      value = aspectsWithUnlock.size
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

export function getAspectBars(stats: PlayerStats): AspectBar[] {
  const totalAchievements = ACHIEVEMENTS.length
  const unlockedCount = stats.unlockedAchievements.length

  const bars: AspectBar[] = [
    {
      ...ASPECT_CONFIG.Vigilance,
      aspect: 'Vigilance',
      label: ASPECT_CONFIG.Vigilance.label,
      icon: ASPECT_CONFIG.Vigilance.icon,
      value: stats.matchesPlayed,
      maxValue: 100,
      progress: Math.min(stats.matchesPlayed / 100, 1),
      displayValue: `${stats.matchesPlayed}/100`,
    },
    {
      ...ASPECT_CONFIG.Command,
      aspect: 'Command',
      label: ASPECT_CONFIG.Command.label,
      icon: ASPECT_CONFIG.Command.icon,
      value: stats.tournamentsFinished,
      maxValue: 10,
      progress: Math.min(stats.tournamentsFinished / 10, 1),
      displayValue: `${stats.tournamentsFinished}/10`,
    },
    {
      ...ASPECT_CONFIG.Aggression,
      aspect: 'Aggression',
      label: ASPECT_CONFIG.Aggression.label,
      icon: ASPECT_CONFIG.Aggression.icon,
      value: stats.matchesPlayed > 0 ? Math.round((stats.wins / stats.matchesPlayed) * 100) : 0,
      maxValue: 100,
      progress: stats.matchesPlayed > 0 ? stats.wins / stats.matchesPlayed : 0,
      displayValue: stats.matchesPlayed > 0 ? `${Math.round((stats.wins / stats.matchesPlayed) * 100)}%` : '0%',
    },
    {
      ...ASPECT_CONFIG.Cunning,
      aspect: 'Cunning',
      label: ASPECT_CONFIG.Cunning.label,
      icon: ASPECT_CONFIG.Cunning.icon,
      value: stats.decksCreated,
      maxValue: 10,
      progress: Math.min(stats.decksCreated / 10, 1),
      displayValue: `${stats.decksCreated}/10`,
    },
    {
      ...ASPECT_CONFIG.Heroism,
      aspect: 'Heroism',
      label: ASPECT_CONFIG.Heroism.label,
      icon: ASPECT_CONFIG.Heroism.icon,
      value: stats.cardsCollected,
      maxValue: 1000,
      progress: Math.min(stats.cardsCollected / 1000, 1),
      displayValue: `${stats.cardsCollected}/1000`,
    },
    {
      ...ASPECT_CONFIG.Villainy,
      aspect: 'Villainy',
      label: ASPECT_CONFIG.Villainy.label,
      icon: ASPECT_CONFIG.Villainy.icon,
      value: unlockedCount,
      maxValue: totalAchievements,
      progress: totalAchievements > 0 ? unlockedCount / totalAchievements : 0,
      displayValue: `${unlockedCount}/${totalAchievements}`,
    },
  ]

  return bars
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
    decksCreated: 0,
    decksValid: 0,
    cardsCollected: 0,
    cardsFavorited: 0,
    currentStreak: 0,
    bestStreak: 0,
    loginDays: 1,
    lastLoginDate: today,
    modesPlayed: [],
    unlockedAchievements: ['vil_1'], // "Iniciado" unlocked on profile creation
    achievementDates: { vil_1: Date.now() },
  }
}

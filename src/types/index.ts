// ─── Match Tracker Types ───
export type GameMode = 'premier' | 'twin_suns' | 'custom'
export type MatchType = 'bo1' | 'bo3'
export type TournamentFormat = 'premier' | 'sealed' | 'draft' | 'twin_suns' | 'trilogy'

export interface PlayerState {
  name: string
  baseHp: number
  leaderDeployed: boolean
  leaderDamage: number
  resources: number
  shieldTokens: number
  experienceTokens: number
}

export interface GameResult {
  winner: number | null
  initiativePlayer: number
}

export interface GameScore {
  games: GameResult[]
  finalScore: [number, number]
}

export interface MatchState {
  id: string
  mode: GameMode
  players: PlayerState[]
  gameScore: GameScore
  currentGame: number
  initiativeHolder: number
  createdAt: number
  updatedAt: number
  isActive: boolean
}

// ─── Tournament Types ───
export interface TournamentPlayer {
  id: string
  name: string
  points: number
  matchWins: number
  matchLosses: number
  matchDraws: number
  gameWins: number
  gameLosses: number
  byes: number
  opponentIds: string[]
  supabaseUserId?: string // linked cloud account (null = guest)
}

export interface TournamentPairing {
  player1Id: string
  player2Id: string | null
  result: {
    winnerId: string | null
    score: [number, number]
  } | null
}

export interface TournamentRound {
  number: number
  pairings: TournamentPairing[]
  completed: boolean
}

export interface Tournament {
  id: string
  name: string
  format: TournamentFormat
  matchType: MatchType
  tournamentType?: 'swiss' | 'elimination'
  maxRounds: number
  avoidRematches: boolean
  players: TournamentPlayer[]
  rounds: TournamentRound[]
  status: 'setup' | 'active' | 'finished'
  eventCode: string
  createdAt: number
  updatedAt: number
  profileId?: string
}

// ─── Card Types ───
export type CardType = 'Leader' | 'Base' | 'Unit' | 'Event' | 'Upgrade'
export type CardRarity = 'Common' | 'Uncommon' | 'Rare' | 'Legendary' | 'Special'

export interface Card {
  /** UUID del API — único y estable. Clave primaria en Dexie. */
  id: string
  /**
   * Id heredado con formato `SET_NNN` (ej. `SOR_001`). NO es único: el API
   * lo reutiliza entre variantes e incluso entre cartas distintas. Solo lo
   * lleva la impresión canónica de cada grupo, para poder resolver
   * referencias viejas (colecciones y mazos guardados antes del cambio a
   * uuid). Las demás variantes lo dejan vacío.
   */
  legacyId?: string
  name: string
  subtitle: string | null
  type: CardType
  rarity: CardRarity
  cost: number | null
  power: number | null
  hp: number | null
  aspects: string[]
  traits: string[]
  keywords: string[]
  arena: 'Ground' | 'Space' | null
  text: string
  deployBox: string | null
  epicAction: string | null
  setCode: string
  setNumber: number
  artist: string
  imageUrl: string
  backImageUrl: string | null
  isUnique: boolean
  isLeader: boolean
  isBase: boolean
  /**
   * Impresión de la carta: 'Standard', 'Hyperspace', 'Standard Foil',
   * 'Weekly Play', promos de torneo, etc. Importa para ordenar: cada serie
   * de variantes tiene su PROPIA numeración, así que varias cartas distintas
   * comparten número dentro de un mismo set. La Standard va primero.
   */
  variantType?: string
  /**
   * ¿Es LA impresión que representa a esta carta?
   *
   * El 74% de las 9,057 filas del API son impresiones alternativas de la misma
   * carta (Hyperspace, Foil, Showcase, promos de torneo), así que buscar
   * "vader" devolvía 57 filas para 12 cartas reales — y muchas de esas
   * impresiones traen el texto de reglas recortado.
   *
   * Regla: la impresión 'Standard' es la canónica. Las cartas que no tienen
   * NINGUNA impresión Standard en todo el juego (exactamente 2: Zam Wesell
   * "Not What She Seems" y R2-D2 "Full Of Solutions") rescatan su mejor
   * impresión, para que ninguna carta desaparezca del buscador.
   */
  isCanonical?: boolean
  /** Texto normalizado (minúsculas, sin acentos) para buscar sin recalcular. */
  searchBlob?: string
}

export interface SetInfo {
  code: string
  name: string
  cardCount: number
  releaseDate: string
}

// ─── Deck Types ───
export interface DeckCard {
  cardId: string
  name: string
  subtitle: string | null
  quantity: number
  setCode: string
  /**
   * La impresión de CADA COPIA. Una entrada por copia, en el mismo orden en
   * que se ven en la hoja.
   *
   * Es un arreglo y no un valor suelto porque nadie tiene sus tres copias
   * iguales: lo normal es tener una foil y dos normales. Un solo valor obligaba
   * a mentir en dos de las tres.
   *
   * Opcional a propósito, y por partida doble:
   *   · los mazos guardados antes de que esto existiera no lo llevan
   *   · los guardados con la versión anterior llevan `variante`, el valor único
   * Los dos casos se resuelven al leer con `impresionesDe()`, que nunca
   * devuelve menos entradas que copias hay.
   *
   * NO afecta a la validación ni a la exportación: para el juego, una foil y
   * una normal son la misma carta.
   */
  variantes?: ('normal' | 'foil' | 'hyperspace' | 'alterna')[]
  /** @deprecated El valor único de antes. Lo lee `impresionesDe()` y ya no se escribe. */
  variante?: 'normal' | 'foil' | 'hyperspace'
}

export interface Deck {
  id: string
  name: string
  format: TournamentFormat | 'limited'
  leaders: DeckCard[]
  base: DeckCard | null
  mainDeck: DeckCard[]
  sideboard: DeckCard[]
  isValid: boolean
  validationErrors: string[]
  isPublic: boolean
  createdAt: number
  updatedAt: number
}

// ─── Event Types ───
export interface EventAnnouncement {
  id: string
  message: string
  timestamp: string
  priority: 'info' | 'warning' | 'urgent'
}

// ─── Feed Types ───
export interface FeedItem {
  id: string
  title: string
  summary: string
  imageUrl?: string
  url: string
  date: string
  tag: string
}

// ─── Arena / Holocrón de Duelos Types ───
export interface MatchLog {
  id: string
  userId?: string
  player1Name: string
  player2Name: string
  player1ProfileId?: string
  player2ProfileId?: string
  player1DeckName?: string
  player2DeckName?: string
  gameMode: GameMode
  winnerPlayer: 1 | 2
  gameResults?: { winner: number }[]
  finalScore: [number, number]
  notes?: string
  recordedAt: number
  createdAt: number
}

// ─── Melee Tournament Tracker Types ───
export interface MeleeTournament {
  id: string
  userId?: string
  name: string
  meleeUrl?: string          // e.g. https://melee.gg/Tournament/View/353255
  meleeId?: string           // extracted tournament ID from URL
  date: string               // YYYY-MM-DD
  location?: string
  organizer?: string
  format: TournamentFormat
  playerCount?: number
  standing?: number          // final standing (1st, 2nd, etc.)
  wins: number
  losses: number
  draws: number
  deckName?: string          // deck used
  deckLeader?: string        // leader card name
  deckBase?: string          // base card name
  notes?: string
  tags?: string[]            // e.g. ['Planetary Qualifier', 'Store Showdown']
  recordedAt: number
  createdAt: number
}

export interface MeleeTournamentStats {
  totalEvents: number
  totalWins: number
  totalLosses: number
  totalDraws: number
  avgStanding: number | null
  bestStanding: number | null
  topDecks: { name: string; count: number; avgStanding: number | null }[]
  byFormat: Record<string, { events: number; wins: number; losses: number }>
  eventsByMonth: { month: string; count: number }[]
}

export interface ArenaStats {
  matchesPlayed: number
  wins: number
  losses: number
  winrate: number
  currentStreak: number
  bestStreak: number
  byMode: Record<string, { wins: number; losses: number }>
  topDecks: { name: string; wins: number; losses: number }[]
  recentOpponents: { name: string; profileId?: string; count: number }[]
}

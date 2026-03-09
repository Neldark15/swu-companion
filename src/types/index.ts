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
  id: string
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

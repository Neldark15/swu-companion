// ─── Match Tracker Types ───
export type GameMode = 'premier' | 'twin_suns' | 'custom'
export type MatchType = 'bo1' | 'bo3'
export type TournamentFormat = 'premier' | 'sealed' | 'draft' | 'twin_suns'

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
  maxRounds: number
  avoidRematches: boolean
  players: TournamentPlayer[]
  rounds: TournamentRound[]
  status: 'setup' | 'active' | 'finished'
  createdAt: number
  updatedAt: number
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

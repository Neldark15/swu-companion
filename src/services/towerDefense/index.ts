// ═══════════════════════════════════════════════════
// Tower Defense: Defensa de la Base Estelar
// Types, interfaces & configuration
// ═══════════════════════════════════════════════════

export type TowerType = 'turbolaser' | 'ion_cannon' | 'tractor_beam' | 'superlaser'
export type EnemyType = 'x_wing' | 'y_wing' | 'a_wing' | 'corvette'
export type GamePhase = 'prep' | 'wave' | 'between' | 'gameover' | 'victory'

// ── Path ──
export interface PathPoint {
  x: number
  y: number
}

// ── Base ──
export interface Base {
  x: number
  y: number
  hp: number
  maxHp: number
}

// ── Tower ──
export interface Tower {
  id: string
  type: TowerType
  x: number
  y: number
  level: number
  range: number
  fireRate: number
  damage: number
  areaRadius: number
  slowFactor: number
  lastFired: number
  targetId: string | null
  angle: number
}

// ── Enemy ──
export interface Enemy {
  id: string
  type: EnemyType
  pathProgress: number
  hp: number
  maxHp: number
  speed: number
  baseSpeed: number
  bounty: number
  slow: number
  slowTimer: number
  x: number
  y: number
  alive: boolean
}

// ── Projectile ──
export interface Projectile {
  id: string
  fromTowerId: string
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  areaRadius: number
  slowFactor: number
  color: string
  speed: number
  targetId: string
}

// ── Particle ──
export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
}

// ── Score Popup ──
export interface ScorePopup {
  x: number
  y: number
  text: string
  color: string
  life: number
}

// ── Game State ──
export interface GameState {
  phase: GamePhase
  wave: number
  maxWaves: number
  base: Base
  towers: Tower[]
  enemies: Enemy[]
  projectiles: Projectile[]
  particles: Particle[]
  scorePopups: ScorePopup[]
  credits: number
  score: number
  path: PathPoint[]
  spawnTimer: number
  spawnIndex: number
  waveEnemies: EnemyType[]
  selectedTowerType: TowerType | null
  selectedTowerId: string | null
  frame: number
  isPaused: boolean
  speedMultiplier: number
  totalKills: number
  startTime: number
}

// ── Tower Config ──
export interface TowerConfig {
  type: TowerType
  name: string
  cost: number
  upgradeCost: number
  range: number
  fireRate: number
  damage: number
  areaRadius: number
  slowFactor: number
  color: string
  glowColor: string
  description: string
}

export const TOWER_CONFIGS: Record<TowerType, TowerConfig> = {
  turbolaser: {
    type: 'turbolaser',
    name: 'Turboláser',
    cost: 25,
    upgradeCost: 15,
    range: 80,
    fireRate: 20,
    damage: 8,
    areaRadius: 0,
    slowFactor: 0,
    color: '#3B82F6',
    glowColor: 'rgba(59,130,246,0.6)',
    description: 'Rápido, daño directo',
  },
  ion_cannon: {
    type: 'ion_cannon',
    name: 'Cañón Iones',
    cost: 40,
    upgradeCost: 25,
    range: 70,
    fireRate: 45,
    damage: 15,
    areaRadius: 30,
    slowFactor: 0,
    color: '#F59E0B',
    glowColor: 'rgba(245,158,11,0.6)',
    description: 'Lento, daño de área',
  },
  tractor_beam: {
    type: 'tractor_beam',
    name: 'Rayo Tractor',
    cost: 35,
    upgradeCost: 20,
    range: 90,
    fireRate: 30,
    damage: 3,
    areaRadius: 0,
    slowFactor: 0.5,
    color: '#10B981',
    glowColor: 'rgba(16,185,129,0.6)',
    description: 'Ralentiza enemigos',
  },
  superlaser: {
    type: 'superlaser',
    name: 'Superláser',
    cost: 80,
    upgradeCost: 50,
    range: 100,
    fireRate: 80,
    damage: 40,
    areaRadius: 40,
    slowFactor: 0,
    color: '#EF4444',
    glowColor: 'rgba(239,68,68,0.6)',
    description: 'Devastador, área masiva',
  },
}

// ── Enemy Config ──
export interface EnemyConfig {
  type: EnemyType
  name: string
  hp: number
  speed: number
  bounty: number
  color: string
  size: number
}

export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  x_wing: {
    type: 'x_wing',
    name: 'X-Wing',
    hp: 20,
    speed: 0.008,
    bounty: 5,
    color: '#E0E7FF',
    size: 6,
  },
  y_wing: {
    type: 'y_wing',
    name: 'Y-Wing',
    hp: 50,
    speed: 0.004,
    bounty: 12,
    color: '#FEF08A',
    size: 8,
  },
  a_wing: {
    type: 'a_wing',
    name: 'A-Wing',
    hp: 15,
    speed: 0.012,
    bounty: 8,
    color: '#A78BFA',
    size: 5,
  },
  corvette: {
    type: 'corvette',
    name: 'Corvette',
    hp: 120,
    speed: 0.003,
    bounty: 50,
    color: '#EC4899',
    size: 12,
  },
}

// ── Game Config ──
export const GAME_CONFIG = {
  initialCredits: 80,
  initialHP: 30,
  maxWaves: 15,
  towerPlacementRadius: 12,
  minDistanceBetweenTowers: 28,
  minDistanceFromPath: 15,
  maxTowers: 15,
  spawnInterval: 35,
  betweenWaveFrames: 120,
  canvasRatio: 1.5, // height/width
} as const

// ── Helper to generate path for a given canvas size ──
export function generatePath(w: number, h: number): PathPoint[] {
  return [
    { x: w * 0.5,  y: 0 },
    { x: w * 0.5,  y: h * 0.12 },
    { x: w * 0.15, y: h * 0.12 },
    { x: w * 0.15, y: h * 0.32 },
    { x: w * 0.85, y: h * 0.32 },
    { x: w * 0.85, y: h * 0.52 },
    { x: w * 0.3,  y: h * 0.52 },
    { x: w * 0.3,  y: h * 0.72 },
    { x: w * 0.7,  y: h * 0.72 },
    { x: w * 0.7,  y: h * 0.88 },
    { x: w * 0.5,  y: h * 0.88 },
    { x: w * 0.5,  y: h },
  ]
}

// ── Helper to get position along path ──
export function getPositionOnPath(path: PathPoint[], progress: number): { x: number; y: number } {
  if (progress <= 0) return { x: path[0].x, y: path[0].y }
  if (progress >= 1) return { x: path[path.length - 1].x, y: path[path.length - 1].y }

  // Calculate total path length
  let totalLength = 0
  const segLengths: number[] = []
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x
    const dy = path[i].y - path[i - 1].y
    const len = Math.sqrt(dx * dx + dy * dy)
    segLengths.push(len)
    totalLength += len
  }

  const targetDist = progress * totalLength
  let accum = 0
  for (let i = 0; i < segLengths.length; i++) {
    if (accum + segLengths[i] >= targetDist) {
      const t = (targetDist - accum) / segLengths[i]
      return {
        x: path[i].x + (path[i + 1].x - path[i].x) * t,
        y: path[i].y + (path[i + 1].y - path[i].y) * t,
      }
    }
    accum += segLengths[i]
  }

  return { x: path[path.length - 1].x, y: path[path.length - 1].y }
}

// ── Distance helper ──
export function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

// ── ID generator ──
let _idCounter = 0
export function genId(): string {
  return `e${++_idCounter}_${Date.now().toString(36)}`
}
export function resetIdCounter(): void {
  _idCounter = 0
}

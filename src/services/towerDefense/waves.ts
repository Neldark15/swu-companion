// ═══════════════════════════════════════════════════
// Wave definitions for Tower Defense
// ═══════════════════════════════════════════════════

import type { EnemyType } from './index'

export interface WaveDefinition {
  enemies: Array<{ type: EnemyType; count: number }>
  spawnInterval: number // frames between spawns
  reward: number // bonus credits after clearing wave
}

// 15 waves of increasing difficulty
export const WAVES: WaveDefinition[] = [
  // Wave 1-3: X-Wings only (tutorial)
  {
    enemies: [{ type: 'x_wing', count: 6 }],
    spawnInterval: 40,
    reward: 15,
  },
  {
    enemies: [{ type: 'x_wing', count: 10 }],
    spawnInterval: 35,
    reward: 20,
  },
  {
    enemies: [
      { type: 'x_wing', count: 8 },
      { type: 'y_wing', count: 2 },
    ],
    spawnInterval: 35,
    reward: 25,
  },
  // Wave 4-6: Introducing Y-Wings
  {
    enemies: [
      { type: 'x_wing', count: 6 },
      { type: 'y_wing', count: 4 },
    ],
    spawnInterval: 30,
    reward: 30,
  },
  {
    enemies: [
      { type: 'x_wing', count: 8 },
      { type: 'y_wing', count: 4 },
      { type: 'a_wing', count: 2 },
    ],
    spawnInterval: 28,
    reward: 35,
  },
  {
    enemies: [
      { type: 'y_wing', count: 6 },
      { type: 'a_wing', count: 4 },
    ],
    spawnInterval: 28,
    reward: 40,
  },
  // Wave 7-9: A-Wings + first Corvette
  {
    enemies: [
      { type: 'x_wing', count: 6 },
      { type: 'a_wing', count: 6 },
      { type: 'corvette', count: 1 },
    ],
    spawnInterval: 25,
    reward: 50,
  },
  {
    enemies: [
      { type: 'y_wing', count: 5 },
      { type: 'a_wing', count: 8 },
    ],
    spawnInterval: 22,
    reward: 45,
  },
  {
    enemies: [
      { type: 'x_wing', count: 10 },
      { type: 'y_wing', count: 5 },
      { type: 'a_wing', count: 3 },
      { type: 'corvette', count: 1 },
    ],
    spawnInterval: 22,
    reward: 55,
  },
  // Wave 10-12: Getting hard
  {
    enemies: [
      { type: 'a_wing', count: 12 },
      { type: 'corvette', count: 2 },
    ],
    spawnInterval: 20,
    reward: 60,
  },
  {
    enemies: [
      { type: 'x_wing', count: 8 },
      { type: 'y_wing', count: 8 },
      { type: 'a_wing', count: 6 },
      { type: 'corvette', count: 1 },
    ],
    spawnInterval: 18,
    reward: 65,
  },
  {
    enemies: [
      { type: 'y_wing', count: 10 },
      { type: 'corvette', count: 3 },
    ],
    spawnInterval: 18,
    reward: 70,
  },
  // Wave 13-15: Final waves
  {
    enemies: [
      { type: 'a_wing', count: 15 },
      { type: 'corvette', count: 2 },
    ],
    spawnInterval: 15,
    reward: 80,
  },
  {
    enemies: [
      { type: 'x_wing', count: 10 },
      { type: 'y_wing', count: 8 },
      { type: 'a_wing', count: 8 },
      { type: 'corvette', count: 3 },
    ],
    spawnInterval: 14,
    reward: 90,
  },
  // Wave 15: BOSS WAVE
  {
    enemies: [
      { type: 'a_wing', count: 10 },
      { type: 'corvette', count: 5 },
    ],
    spawnInterval: 12,
    reward: 100,
  },
]

// Flatten wave enemies into spawn order (shuffled mix)
export function getWaveSpawnOrder(waveIndex: number): EnemyType[] {
  const wave = WAVES[Math.min(waveIndex, WAVES.length - 1)]
  const result: EnemyType[] = []
  for (const group of wave.enemies) {
    for (let i = 0; i < group.count; i++) {
      result.push(group.type)
    }
  }
  // Shuffle to mix types
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function getWaveReward(waveIndex: number): number {
  return WAVES[Math.min(waveIndex, WAVES.length - 1)].reward
}

export function getWaveSpawnInterval(waveIndex: number): number {
  return WAVES[Math.min(waveIndex, WAVES.length - 1)].spawnInterval
}

// ═══════════════════════════════════════════════════
// Tower Defense Engine — Game Logic
// ═══════════════════════════════════════════════════

import {
  type GameState, type Tower, type Enemy, type Projectile,
  type TowerType, type PathPoint,
  TOWER_CONFIGS, ENEMY_CONFIGS, GAME_CONFIG,
  generatePath, getPositionOnPath, dist, genId, resetIdCounter,
} from './index'
import { getWaveSpawnOrder, getWaveSpawnInterval, getWaveReward } from './waves'

export type GameCallback = (state: GameState) => void

export class TowerDefenseEngine {
  state: GameState
  private canvasW: number
  private canvasH: number
  private onUpdate: GameCallback | null = null
  private onGameEnd: ((wave: number, score: number, duration: number) => void) | null = null
  private animId: number | null = null
  private lastTime = 0
  private accumulator = 0
  private readonly TICK_MS = 1000 / 60

  constructor(canvasW: number, canvasH: number) {
    this.canvasW = canvasW
    this.canvasH = canvasH
    resetIdCounter()
    this.state = this.createInitialState()
  }

  private createInitialState(): GameState {
    const path = generatePath(this.canvasW, this.canvasH)
    return {
      phase: 'prep',
      wave: 0,
      maxWaves: GAME_CONFIG.maxWaves,
      base: {
        x: path[path.length - 1].x,
        y: path[path.length - 1].y,
        hp: GAME_CONFIG.initialHP,
        maxHp: GAME_CONFIG.initialHP,
      },
      towers: [],
      enemies: [],
      projectiles: [],
      particles: [],
      scorePopups: [],
      credits: GAME_CONFIG.initialCredits,
      score: 0,
      path,
      spawnTimer: 0,
      spawnIndex: 0,
      waveEnemies: [],
      selectedTowerType: null,
      selectedTowerId: null,
      frame: 0,
      isPaused: false,
      speedMultiplier: 1,
      totalKills: 0,
      startTime: Date.now(),
    }
  }

  setCallbacks(
    onUpdate: GameCallback,
    onGameEnd: (wave: number, score: number, duration: number) => void
  ) {
    this.onUpdate = onUpdate
    this.onGameEnd = onGameEnd
  }

  // ── Start / Stop ──
  start() {
    this.lastTime = performance.now()
    this.accumulator = 0
    this.loop(this.lastTime)
  }

  stop() {
    if (this.animId) cancelAnimationFrame(this.animId)
    this.animId = null
  }

  destroy() {
    this.stop()
    this.onUpdate = null
    this.onGameEnd = null
  }

  private loop = (now: number) => {
    this.animId = requestAnimationFrame(this.loop)
    if (this.state.isPaused) {
      this.lastTime = now
      return
    }

    const dt = Math.min(now - this.lastTime, 100) // cap at 100ms
    this.lastTime = now
    this.accumulator += dt * this.state.speedMultiplier

    while (this.accumulator >= this.TICK_MS) {
      this.tick()
      this.accumulator -= this.TICK_MS
    }

    this.onUpdate?.(this.state)
  }

  // ── Game Tick (fixed 60fps) ──
  private tick() {
    const s = this.state
    s.frame++

    if (s.phase === 'wave') {
      this.spawnEnemies()
      this.updateEnemies()
      this.updateTowers()
      this.updateProjectiles()
      this.updateParticles()
      this.updatePopups()
      this.checkWaveComplete()
    } else if (s.phase === 'between') {
      this.updateParticles()
      this.updatePopups()
      s.spawnTimer++
      if (s.spawnTimer >= GAME_CONFIG.betweenWaveFrames) {
        this.startNextWave()
      }
    } else if (s.phase === 'prep') {
      // Wait for user to start
      this.updateParticles()
    }
  }

  // ── Wave Management ──
  startFirstWave() {
    this.startNextWave()
  }

  private startNextWave() {
    const s = this.state
    if (s.wave >= s.maxWaves) {
      s.phase = 'victory'
      this.endGame()
      return
    }
    s.wave++
    s.phase = 'wave'
    s.spawnTimer = 0
    s.spawnIndex = 0
    s.waveEnemies = getWaveSpawnOrder(s.wave - 1)
  }

  private checkWaveComplete() {
    const s = this.state
    if (s.spawnIndex >= s.waveEnemies.length && s.enemies.length === 0) {
      // Wave cleared
      const reward = getWaveReward(s.wave - 1)
      s.credits += reward
      s.score += reward

      this.addPopup(this.canvasW / 2, this.canvasH / 2, `Onda ${s.wave} completada! +${reward}`, '#F59E0B')

      if (s.wave >= s.maxWaves) {
        s.phase = 'victory'
        this.endGame()
      } else {
        s.phase = 'between'
        s.spawnTimer = 0
      }
    }
  }

  // ── Spawning ──
  private spawnEnemies() {
    const s = this.state
    if (s.spawnIndex >= s.waveEnemies.length) return

    s.spawnTimer++
    const interval = getWaveSpawnInterval(s.wave - 1)
    if (s.spawnTimer >= interval) {
      s.spawnTimer = 0
      const eType = s.waveEnemies[s.spawnIndex]
      const config = ENEMY_CONFIGS[eType]
      // Scale HP by wave number
      const hpScale = 1 + (s.wave - 1) * 0.08
      const hp = Math.round(config.hp * hpScale)
      const enemy: Enemy = {
        id: genId(),
        type: eType,
        pathProgress: 0,
        hp,
        maxHp: hp,
        speed: config.speed,
        baseSpeed: config.speed,
        bounty: config.bounty,
        slow: 0,
        slowTimer: 0,
        x: s.path[0].x,
        y: s.path[0].y,
        alive: true,
      }
      s.enemies.push(enemy)
      s.spawnIndex++
    }
  }

  // ── Enemy Update ──
  private updateEnemies() {
    const s = this.state
    for (let i = s.enemies.length - 1; i >= 0; i--) {
      const e = s.enemies[i]
      if (!e.alive) {
        s.enemies.splice(i, 1)
        continue
      }

      // Apply slow decay
      if (e.slow > 0) {
        e.slowTimer--
        if (e.slowTimer <= 0) e.slow = 0
        e.speed = e.baseSpeed * (1 - e.slow)
      } else {
        e.speed = e.baseSpeed
      }

      e.pathProgress += e.speed
      const pos = getPositionOnPath(s.path, e.pathProgress)
      e.x = pos.x
      e.y = pos.y

      // Reached base
      if (e.pathProgress >= 1) {
        s.base.hp -= 1
        e.alive = false
        s.enemies.splice(i, 1)
        this.createExplosion(s.base.x, s.base.y, '#EF4444', 5)

        if (s.base.hp <= 0) {
          s.phase = 'gameover'
          this.endGame()
          return
        }
      }
    }
  }

  // ── Tower Update ──
  private updateTowers() {
    const s = this.state
    for (const tower of s.towers) {
      tower.lastFired++

      // Find target
      const target = this.findTarget(tower)
      if (!target) {
        tower.targetId = null
        continue
      }
      tower.targetId = target.id

      // Rotate towards target
      tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x)

      // Fire
      const scaledFireRate = Math.max(5, tower.fireRate)
      if (tower.lastFired >= scaledFireRate) {
        tower.lastFired = 0
        this.fireProjectile(tower, target)
      }
    }
  }

  private findTarget(tower: Tower): Enemy | null {
    const s = this.state
    let closest: Enemy | null = null
    let closestDist = Infinity

    for (const e of s.enemies) {
      if (!e.alive) continue
      const d = dist(tower.x, tower.y, e.x, e.y)
      if (d <= tower.range && d < closestDist) {
        closest = e
        closestDist = d
      }
    }
    return closest
  }

  private fireProjectile(tower: Tower, target: Enemy) {
    const config = TOWER_CONFIGS[tower.type]
    const dx = target.x - tower.x
    const dy = target.y - tower.y
    const d = Math.sqrt(dx * dx + dy * dy) || 1
    const speed = 4

    const proj: Projectile = {
      id: genId(),
      fromTowerId: tower.id,
      x: tower.x,
      y: tower.y,
      vx: (dx / d) * speed,
      vy: (dy / d) * speed,
      damage: tower.damage,
      areaRadius: tower.areaRadius,
      slowFactor: tower.slowFactor,
      color: config.color,
      speed,
      targetId: target.id,
    }
    this.state.projectiles.push(proj)
  }

  // ── Projectile Update ──
  private updateProjectiles() {
    const s = this.state
    for (let i = s.projectiles.length - 1; i >= 0; i--) {
      const p = s.projectiles[i]

      // Home towards target if still alive
      const target = s.enemies.find(e => e.id === p.targetId && e.alive)
      if (target) {
        const dx = target.x - p.x
        const dy = target.y - p.y
        const d = Math.sqrt(dx * dx + dy * dy) || 1
        p.vx = (dx / d) * p.speed
        p.vy = (dy / d) * p.speed
      }

      p.x += p.vx
      p.y += p.vy

      // Off screen
      if (p.x < -20 || p.x > this.canvasW + 20 || p.y < -20 || p.y > this.canvasH + 20) {
        s.projectiles.splice(i, 1)
        continue
      }

      // Check hit
      let hit = false
      for (const e of s.enemies) {
        if (!e.alive) continue
        const d = dist(p.x, p.y, e.x, e.y)
        const hitRadius = ENEMY_CONFIGS[e.type].size + 3
        if (d < hitRadius) {
          hit = true
          this.damageEnemy(e, p.damage, p.slowFactor)

          // Area damage
          if (p.areaRadius > 0) {
            for (const e2 of s.enemies) {
              if (!e2.alive || e2.id === e.id) continue
              if (dist(p.x, p.y, e2.x, e2.y) < p.areaRadius) {
                this.damageEnemy(e2, Math.round(p.damage * 0.5), p.slowFactor)
              }
            }
            this.createExplosion(p.x, p.y, p.color, 10)
          } else {
            this.createExplosion(p.x, p.y, p.color, 4)
          }
          break
        }
      }

      if (hit) {
        s.projectiles.splice(i, 1)
      }
    }
  }

  private damageEnemy(enemy: Enemy, damage: number, slowFactor: number) {
    enemy.hp -= damage
    if (slowFactor > 0 && slowFactor > enemy.slow) {
      enemy.slow = slowFactor
      enemy.slowTimer = 90 // 1.5 seconds
    }

    if (enemy.hp <= 0) {
      enemy.alive = false
      const s = this.state
      s.credits += enemy.bounty
      s.score += enemy.bounty * 2
      s.totalKills++
      this.createExplosion(enemy.x, enemy.y, ENEMY_CONFIGS[enemy.type].color, 8)
      this.addPopup(enemy.x, enemy.y - 10, `+${enemy.bounty}`, '#F59E0B')
    }
  }

  // ── Particles ──
  private updateParticles() {
    const s = this.state
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i]
      p.x += p.vx
      p.y += p.vy
      p.vx *= 0.96
      p.vy *= 0.96
      p.life -= 1 / p.maxLife
      if (p.life <= 0) {
        s.particles.splice(i, 1)
      }
    }
    // Limit particles
    if (s.particles.length > 300) {
      s.particles.splice(0, s.particles.length - 300)
    }
  }

  private createExplosion(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5
      const speed = 1 + Math.random() * 2.5
      this.state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 25 + Math.random() * 15,
        size: 2 + Math.random() * 3,
        color,
      })
    }
  }

  // ── Score Popups ──
  private updatePopups() {
    const s = this.state
    for (let i = s.scorePopups.length - 1; i >= 0; i--) {
      const p = s.scorePopups[i]
      p.y -= 0.5
      p.life -= 0.02
      if (p.life <= 0) {
        s.scorePopups.splice(i, 1)
      }
    }
  }

  private addPopup(x: number, y: number, text: string, color: string) {
    this.state.scorePopups.push({ x, y, text, color, life: 1 })
  }

  // ── End Game ──
  private endGame() {
    const duration = Math.floor((Date.now() - this.state.startTime) / 1000)
    this.onGameEnd?.(this.state.wave, this.state.score, duration)
  }

  // ── Player Actions ──
  placeTower(x: number, y: number, type: TowerType): boolean {
    const s = this.state
    const config = TOWER_CONFIGS[type]

    if (s.credits < config.cost) return false
    if (s.towers.length >= GAME_CONFIG.maxTowers) return false

    // Check distance from other towers
    for (const t of s.towers) {
      if (dist(x, y, t.x, t.y) < GAME_CONFIG.minDistanceBetweenTowers) return false
    }

    // Check not too close to path
    for (let i = 0; i < s.path.length - 1; i++) {
      const nearest = this.pointToSegmentDist(x, y, s.path[i], s.path[i + 1])
      if (nearest < GAME_CONFIG.minDistanceFromPath) return false
    }

    const tower: Tower = {
      id: genId(),
      type,
      x,
      y,
      level: 1,
      range: config.range,
      fireRate: config.fireRate,
      damage: config.damage,
      areaRadius: config.areaRadius,
      slowFactor: config.slowFactor,
      lastFired: config.fireRate,
      targetId: null,
      angle: 0,
    }

    s.towers.push(tower)
    s.credits -= config.cost
    s.selectedTowerType = null
    return true
  }

  upgradeTower(towerId: string): boolean {
    const s = this.state
    const tower = s.towers.find(t => t.id === towerId)
    if (!tower || tower.level >= 3) return false

    const config = TOWER_CONFIGS[tower.type]
    const cost = config.upgradeCost * tower.level
    if (s.credits < cost) return false

    s.credits -= cost
    tower.level++
    tower.damage = Math.round(config.damage * (1 + (tower.level - 1) * 0.5))
    tower.range = config.range + (tower.level - 1) * 10
    tower.fireRate = Math.max(5, config.fireRate - (tower.level - 1) * 5)
    return true
  }

  sellTower(towerId: string): boolean {
    const s = this.state
    const idx = s.towers.findIndex(t => t.id === towerId)
    if (idx === -1) return false

    const tower = s.towers[idx]
    const config = TOWER_CONFIGS[tower.type]
    const refund = Math.floor(config.cost * 0.6)
    s.credits += refund
    s.towers.splice(idx, 1)
    s.selectedTowerId = null
    this.addPopup(tower.x, tower.y, `+${refund}`, '#10B981')
    return true
  }

  selectTowerType(type: TowerType | null) {
    this.state.selectedTowerType = type
    this.state.selectedTowerId = null
  }

  selectTower(towerId: string | null) {
    this.state.selectedTowerId = towerId
    this.state.selectedTowerType = null
  }

  togglePause() {
    this.state.isPaused = !this.state.isPaused
  }

  toggleSpeed() {
    this.state.speedMultiplier = this.state.speedMultiplier === 1 ? 2 : 1
  }

  // ── Helpers ──
  private pointToSegmentDist(px: number, py: number, a: PathPoint, b: PathPoint): number {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) return dist(px, py, a.x, a.y)

    let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq
    t = Math.max(0, Math.min(1, t))
    return dist(px, py, a.x + t * dx, a.y + t * dy)
  }

  getCanvasSize() {
    return { w: this.canvasW, h: this.canvasH }
  }

  resize(w: number, h: number) {
    this.canvasW = w
    this.canvasH = h
    this.state.path = generatePath(w, h)
  }
}

// ═══════════════════════════════════════════════════
// Tower Defense Renderer — Canvas Drawing
// Neon Star Wars aesthetic
// ═══════════════════════════════════════════════════

import {
  type GameState, type Tower, type Enemy, type Projectile, type Particle, type PathPoint,
  type ScorePopup,
  TOWER_CONFIGS, ENEMY_CONFIGS,
} from './index'

// ── Star cache ──
let starCache: Array<{ x: number; y: number; size: number; alpha: number }> | null = null

function generateStars(w: number, h: number) {
  starCache = []
  for (let i = 0; i < 80; i++) {
    starCache.push({
      x: Math.random() * w,
      y: Math.random() * h,
      size: 0.5 + Math.random() * 1.5,
      alpha: 0.3 + Math.random() * 0.7,
    })
  }
}

export function render(canvas: HTMLCanvasElement, state: GameState) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height

  if (!starCache) generateStars(w, h)

  // ── Background ──
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#060B18')
  grad.addColorStop(0.5, '#0A1128')
  grad.addColorStop(1, '#0F172A')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // ── Stars ──
  if (starCache) {
    for (const star of starCache) {
      const twinkle = 0.7 + Math.sin(state.frame * 0.03 + star.x) * 0.3
      ctx.globalAlpha = star.alpha * twinkle
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // ── Path ──
  drawPath(ctx, state.path, state.frame)

  // ── Tower ranges (if selecting) ──
  if (state.selectedTowerId) {
    const tower = state.towers.find(t => t.id === state.selectedTowerId)
    if (tower) {
      ctx.beginPath()
      ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(59,130,246,0.3)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = 'rgba(59,130,246,0.05)'
      ctx.fill()
    }
  }

  // ── Towers ──
  for (const tower of state.towers) {
    drawTower(ctx, tower, state.frame)
  }

  // ── Enemies ──
  for (const enemy of state.enemies) {
    if (enemy.alive) drawEnemy(ctx, enemy, state.frame)
  }

  // ── Projectiles ──
  for (const proj of state.projectiles) {
    drawProjectile(ctx, proj)
  }

  // ── Base ──
  drawBase(ctx, state, w, h)

  // ── Particles ──
  for (const p of state.particles) {
    drawParticle(ctx, p)
  }

  // ── Score Popups ──
  for (const popup of state.scorePopups) {
    drawPopup(ctx, popup)
  }

  // ── Placement ghost ──
  if (state.selectedTowerType) {
    drawPlacementInfo(ctx, state, w, h)
  }
}

// ═══ Drawing Functions ═══

function drawPath(ctx: CanvasRenderingContext2D, path: PathPoint[], frame: number) {
  if (path.length < 2) return

  // Glow path
  ctx.save()
  ctx.strokeStyle = 'rgba(59,130,246,0.12)'
  ctx.lineWidth = 20
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(path[0].x, path[0].y)
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y)
  }
  ctx.stroke()

  // Dashed center line
  ctx.setLineDash([6, 8])
  ctx.lineDashOffset = -(frame * 0.3)
  ctx.strokeStyle = 'rgba(59,130,246,0.25)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(path[0].x, path[0].y)
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y)
  }
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

function drawTower(ctx: CanvasRenderingContext2D, tower: Tower, frame: number) {
  const config = TOWER_CONFIGS[tower.type]
  const radius = 10 + tower.level * 2

  ctx.save()
  ctx.translate(tower.x, tower.y)

  // Glow ring
  const glowSize = radius + 4 + Math.sin(frame * 0.05) * 2
  ctx.beginPath()
  ctx.arc(0, 0, glowSize, 0, Math.PI * 2)
  ctx.fillStyle = config.glowColor.replace('0.6', '0.15')
  ctx.fill()

  // Level rings
  for (let l = 0; l < tower.level; l++) {
    const r = radius - l * 3
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.strokeStyle = config.color
    ctx.lineWidth = l === 0 ? 2 : 1
    ctx.globalAlpha = 1 - l * 0.2
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // Inner fill
  ctx.beginPath()
  ctx.arc(0, 0, 5, 0, Math.PI * 2)
  ctx.fillStyle = config.color
  ctx.fill()

  // Turret barrel (points toward angle)
  ctx.rotate(tower.angle)
  ctx.fillStyle = config.color
  ctx.fillRect(0, -1.5, radius, 3)

  // Fire flash
  if (tower.lastFired < 3) {
    ctx.beginPath()
    ctx.arc(radius, 0, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#FFFFFF'
    ctx.globalAlpha = 1 - tower.lastFired / 3
    ctx.fill()
    ctx.globalAlpha = 1
  }

  ctx.restore()

  // Level indicator dots
  for (let l = 0; l < tower.level; l++) {
    ctx.beginPath()
    ctx.arc(tower.x - 4 + l * 4, tower.y + radius + 5, 1.5, 0, Math.PI * 2)
    ctx.fillStyle = config.color
    ctx.fill()
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, frame: number) {
  const config = ENEMY_CONFIGS[enemy.type]
  const size = config.size

  ctx.save()
  ctx.translate(enemy.x, enemy.y)

  // Glow
  ctx.shadowColor = config.color
  ctx.shadowBlur = 8

  // Different shapes per type
  ctx.fillStyle = config.color

  switch (enemy.type) {
    case 'x_wing': {
      // X shape
      ctx.beginPath()
      ctx.moveTo(0, -size)
      ctx.lineTo(size * 0.5, size * 0.5)
      ctx.lineTo(0, size * 0.3)
      ctx.lineTo(-size * 0.5, size * 0.5)
      ctx.closePath()
      ctx.fill()
      // Wings
      ctx.fillRect(-size, -size * 0.3, size * 0.5, 2)
      ctx.fillRect(size * 0.5, -size * 0.3, size * 0.5, 2)
      break
    }
    case 'y_wing': {
      // Wider, heavier shape
      ctx.beginPath()
      ctx.moveTo(0, -size)
      ctx.lineTo(size * 0.8, size * 0.3)
      ctx.lineTo(size * 0.3, size)
      ctx.lineTo(-size * 0.3, size)
      ctx.lineTo(-size * 0.8, size * 0.3)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'a_wing': {
      // Slim triangle
      ctx.beginPath()
      ctx.moveTo(0, -size)
      ctx.lineTo(size * 0.4, size)
      ctx.lineTo(-size * 0.4, size)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'corvette': {
      // Large diamond + glow pulse
      const pulse = 1 + Math.sin(frame * 0.1) * 0.1
      ctx.scale(pulse, pulse)
      ctx.beginPath()
      ctx.moveTo(0, -size)
      ctx.lineTo(size * 0.6, 0)
      ctx.lineTo(0, size)
      ctx.lineTo(-size * 0.6, 0)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.5
      ctx.stroke()
      ctx.globalAlpha = 1
      break
    }
  }

  ctx.shadowBlur = 0
  ctx.restore()

  // Health bar
  if (enemy.hp < enemy.maxHp) {
    const barW = size * 2.5
    const barH = 2
    const barX = enemy.x - barW / 2
    const barY = enemy.y - size - 6

    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2)

    const pct = enemy.hp / enemy.maxHp
    const barColor = pct > 0.5 ? '#10B981' : pct > 0.25 ? '#F59E0B' : '#EF4444'
    ctx.fillStyle = barColor
    ctx.fillRect(barX, barY, barW * pct, barH)
  }

  // Slow indicator
  if (enemy.slow > 0) {
    ctx.beginPath()
    ctx.arc(enemy.x, enemy.y + size + 4, 2, 0, Math.PI * 2)
    ctx.fillStyle = '#10B981'
    ctx.globalAlpha = 0.7
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

function drawProjectile(ctx: CanvasRenderingContext2D, proj: Projectile) {
  ctx.save()
  ctx.shadowColor = proj.color
  ctx.shadowBlur = 6

  // Trail
  ctx.strokeStyle = proj.color
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(proj.x, proj.y)
  ctx.lineTo(proj.x - proj.vx * 3, proj.y - proj.vy * 3)
  ctx.stroke()

  // Head
  ctx.globalAlpha = 1
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.arc(proj.x, proj.y, 2, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = proj.color
  ctx.beginPath()
  ctx.arc(proj.x, proj.y, 1.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.shadowBlur = 0
  ctx.restore()
}

function drawBase(ctx: CanvasRenderingContext2D, state: GameState, _w: number, _h: number) {
  const base = state.base
  const hpPct = base.hp / base.maxHp

  // Shield glow
  const shieldColor = hpPct > 0.5 ? 'rgba(59,130,246,' : hpPct > 0.25 ? 'rgba(245,158,11,' : 'rgba(239,68,68,'
  const pulseAlpha = 0.1 + Math.sin(state.frame * 0.04) * 0.05

  ctx.save()
  ctx.beginPath()
  ctx.arc(base.x, base.y, 25, 0, Math.PI * 2)
  ctx.fillStyle = shieldColor + (pulseAlpha + 0.1) + ')'
  ctx.fill()
  ctx.strokeStyle = shieldColor + '0.5)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Inner base
  ctx.beginPath()
  ctx.arc(base.x, base.y, 12, 0, Math.PI * 2)
  ctx.fillStyle = '#1E293B'
  ctx.fill()
  ctx.strokeStyle = shieldColor + '0.8)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Imperial symbol (simple)
  ctx.fillStyle = '#F1F5F9'
  ctx.font = 'bold 10px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('B', base.x, base.y)

  ctx.restore()

  // HP bar below base
  const barW = 50
  const barH = 4
  const barX = base.x - barW / 2
  const barY = base.y + 30

  ctx.fillStyle = 'rgba(0,0,0,0.7)'
  ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2)

  const barColor = hpPct > 0.5 ? '#3B82F6' : hpPct > 0.25 ? '#F59E0B' : '#EF4444'
  ctx.fillStyle = barColor
  ctx.fillRect(barX, barY, barW * hpPct, barH)

  ctx.fillStyle = '#F1F5F9'
  ctx.font = '8px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(`${base.hp}/${base.maxHp}`, base.x, barY + barH + 8)
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.globalAlpha = p.life
  ctx.fillStyle = p.color
  ctx.beginPath()
  ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawPopup(ctx: CanvasRenderingContext2D, popup: ScorePopup) {
  ctx.globalAlpha = popup.life
  ctx.fillStyle = popup.color
  ctx.font = 'bold 10px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(popup.text, popup.x, popup.y)
  ctx.globalAlpha = 1
}

function drawPlacementInfo(ctx: CanvasRenderingContext2D, _state: GameState, w: number, h: number) {
  // Dim hint text
  ctx.fillStyle = 'rgba(59,130,246,0.5)'
  ctx.font = '10px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('Toque para colocar torre', w / 2, h - 10)
}

// ── Reset stars on resize ──
export function resetStarCache() {
  starCache = null
}

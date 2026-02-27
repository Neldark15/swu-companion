import { useState, useEffect, useRef, useCallback } from 'react'
import { Shield, Zap, Trophy, Play, Pause, FastForward, RotateCcw, X, ChevronUp, Coins } from 'lucide-react'
import { TowerDefenseEngine } from '../../../services/towerDefense/engine'
import { render, resetStarCache } from '../../../services/towerDefense/renderer'
import { type GameState, type TowerType, TOWER_CONFIGS, GAME_CONFIG } from '../../../services/towerDefense/index'
import { calculateGameXP, explainXP } from '../../../services/towerDefense/xpSystem'
import { saveGameScore, getTodayGameCount, getTowerDefenseStats, type TowerDefenseStats } from '../../../services/gameProgress'
import { useUIStore } from '../../../hooks/useUIStore'

interface TowerDefenseGameProps {
  userId: string
  onXpGained?: (xp: number) => void
}

type Screen = 'menu' | 'playing' | 'result'

const TOWER_ORDER: TowerType[] = ['turbolaser', 'ion_cannon', 'tractor_beam', 'superlaser']

export function TowerDefenseGame({ userId, onXpGained }: TowerDefenseGameProps) {
  const [screen, setScreen] = useState<Screen>('menu')
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [stats, setStats] = useState<TowerDefenseStats | null>(null)
  const [todayCount, setTodayCount] = useState(0)
  const [resultData, setResultData] = useState<{ wave: number; score: number; xp: number; duration: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const setHideTabBar = useUIStore((s) => s.setHideTabBar)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<TowerDefenseEngine | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Hide TabBar while playing, restore on unmount
  useEffect(() => {
    setHideTabBar(screen === 'playing')
    return () => setHideTabBar(false)
  }, [screen, setHideTabBar])

  // Load stats
  useEffect(() => {
    async function load() {
      const [s, count] = await Promise.all([
        getTowerDefenseStats(userId),
        getTodayGameCount(userId),
      ])
      setStats(s)
      setTodayCount(count)
    }
    load()
  }, [userId])

  // Canvas sizing
  const getCanvasSize = useCallback(() => {
    const container = containerRef.current
    if (!container) return { w: 320, h: 480 }
    const w = Math.min(container.clientWidth, 400)
    const h = Math.round(w * GAME_CONFIG.canvasRatio)
    return { w, h }
  }, [])

  // Start game
  const startGame = useCallback(() => {
    const { w, h } = getCanvasSize()
    resetStarCache()

    const engine = new TowerDefenseEngine(w, h)
    engineRef.current = engine

    engine.setCallbacks(
      (state) => {
        setGameState({ ...state })
        if (canvasRef.current) {
          render(canvasRef.current, state)
        }
      },
      async (wave, score, duration) => {
        // Game ended
        const count = await getTodayGameCount(userId)
        const xp = calculateGameXP(wave, count + 1)

        setResultData({ wave, score, xp, duration })
        setScreen('result')

        // Save to Supabase
        setSaving(true)
        await saveGameScore(userId, wave, score, xp, duration)
        setSaving(false)

        // Update parent XP
        onXpGained?.(xp)

        // Refresh stats
        const [newStats, newCount] = await Promise.all([
          getTowerDefenseStats(userId),
          getTodayGameCount(userId),
        ])
        setStats(newStats)
        setTodayCount(newCount)
      }
    )

    engine.start()
    setScreen('playing')

    // Auto-start first wave after a brief prep
    setTimeout(() => {
      engine.startFirstWave()
    }, 500)
  }, [userId, onXpGained, getCanvasSize])

  // Cleanup
  useEffect(() => {
    return () => {
      engineRef.current?.destroy()
    }
  }, [])

  // Canvas tap handler
  const handleCanvasTap = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current
    if (!engine) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number

    if ('touches' in e) {
      if (e.touches.length === 0) return
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (clientX - rect.left) * scaleX
    const y = (clientY - rect.top) * scaleY

    const state = engine.state

    // If selecting tower type for placement
    if (state.selectedTowerType) {
      const placed = engine.placeTower(x, y, state.selectedTowerType)
      if (!placed) {
        // Maybe tapped on existing tower
        const tapped = state.towers.find(t => Math.sqrt((t.x - x) ** 2 + (t.y - y) ** 2) < 15)
        if (tapped) {
          engine.selectTower(tapped.id)
        }
      }
      return
    }

    // Check if tapped on existing tower
    const tappedTower = state.towers.find(t => Math.sqrt((t.x - x) ** 2 + (t.y - y) ** 2) < 15)
    if (tappedTower) {
      engine.selectTower(state.selectedTowerId === tappedTower.id ? null : tappedTower.id)
      return
    }

    // Deselect
    engine.selectTower(null)
    engine.selectTowerType(null)
  }, [])

  // ══════════════════════════════════════════
  // MENU SCREEN
  // ══════════════════════════════════════════
  if (screen === 'menu') {
    const multiplier = Math.round(Math.pow(0.7, todayCount) * 100)

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-swu-accent uppercase tracking-widest flex items-center gap-1.5">
            <Shield size={14} /> Defensa Estelar
          </p>
          {stats && stats.totalGames > 0 && (
            <span className="text-[10px] text-swu-muted font-mono">{todayCount} hoy</span>
          )}
        </div>

        <div className="bg-swu-surface rounded-xl border border-swu-border p-4 space-y-3">
          {/* Stats */}
          {stats && stats.totalGames > 0 ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-extrabold text-swu-accent">{stats.bestWave}</p>
                <p className="text-[9px] text-swu-muted uppercase">Mejor Onda</p>
              </div>
              <div>
                <p className="text-lg font-extrabold text-swu-amber">{stats.totalXpEarned}</p>
                <p className="text-[9px] text-swu-muted uppercase">XP Total</p>
              </div>
              <div>
                <p className="text-lg font-extrabold text-green-400">{stats.totalGames}</p>
                <p className="text-[9px] text-swu-muted uppercase">Partidas</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-2">
              <p className="text-sm text-swu-muted">Defiende tu Base Estelar contra oleadas de naves rebeldes</p>
              <p className="text-xs text-swu-muted mt-1">Coloca torretas, destruye enemigos, gana XP</p>
            </div>
          )}

          {/* XP multiplier info */}
          <div className="flex items-center justify-between text-[10px] text-swu-muted pt-1 border-t border-swu-border/50">
            <span className="flex items-center gap-1">
              <Zap size={10} className="text-swu-amber" />
              Bonificador XP: {multiplier}%
            </span>
            <span>{todayCount === 0 ? 'Primer juego = XP máximo' : `${todayCount} jugados hoy`}</span>
          </div>

          {/* Play button */}
          <button
            onClick={startGame}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-swu-accent to-blue-600 text-white text-sm font-extrabold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
          >
            <Play size={16} fill="currentColor" />
            {stats && stats.totalGames > 0 ? 'Jugar de Nuevo' : 'Iniciar Defensa'}
          </button>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════
  // RESULT SCREEN
  // ══════════════════════════════════════════
  if (screen === 'result' && resultData) {
    const isVictory = resultData.wave >= GAME_CONFIG.maxWaves
    const breakdown = explainXP(resultData.wave, todayCount)
    const minutes = Math.floor(resultData.duration / 60)
    const seconds = resultData.duration % 60

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-swu-accent uppercase tracking-widest flex items-center gap-1.5">
            <Shield size={14} /> Defensa Estelar
          </p>
        </div>

        <div className={`bg-swu-surface rounded-xl border p-4 space-y-3 ${isVictory ? 'border-swu-amber' : 'border-swu-red/50'}`}>
          <div className="text-center">
            <p className={`text-lg font-extrabold ${isVictory ? 'text-swu-amber' : 'text-swu-red'}`}>
              {isVictory ? 'VICTORIA IMPERIAL' : 'BASE DESTRUIDA'}
            </p>
            {isVictory && <Trophy size={24} className="mx-auto mt-1 text-swu-amber" />}
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-swu-bg rounded-lg p-2">
              <p className="text-xl font-extrabold text-swu-text">{resultData.wave}/{GAME_CONFIG.maxWaves}</p>
              <p className="text-[9px] text-swu-muted uppercase">Ondas</p>
            </div>
            <div className="bg-swu-bg rounded-lg p-2">
              <p className="text-xl font-extrabold text-swu-amber">{resultData.score}</p>
              <p className="text-[9px] text-swu-muted uppercase">Puntos</p>
            </div>
          </div>

          <div className="bg-swu-bg rounded-lg p-3 text-center">
            <p className="text-2xl font-extrabold text-green-400">+{resultData.xp} XP</p>
            <p className="text-[9px] text-swu-muted">
              Base: {breakdown.baseXP} XP x {Math.round(breakdown.multiplier * 100)}% = {resultData.xp} XP
            </p>
            {saving && <p className="text-[9px] text-swu-muted animate-pulse mt-1">Guardando...</p>}
          </div>

          <p className="text-[10px] text-swu-muted text-center">
            Duración: {minutes}:{seconds.toString().padStart(2, '0')}
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => setScreen('menu')}
              className="flex-1 py-2.5 rounded-lg bg-swu-bg border border-swu-border text-swu-text text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
            >
              <X size={14} /> Volver
            </button>
            <button
              onClick={startGame}
              className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-swu-accent to-blue-600 text-white text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
            >
              <RotateCcw size={14} /> Reintentar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════
  // PLAYING SCREEN
  // ══════════════════════════════════════════
  const gs = gameState || engineRef.current?.state

  return (
    <div className="space-y-2" ref={containerRef}>
      {/* Header HUD */}
      <div className="flex items-center justify-between text-[10px]">
        <p className="font-bold text-swu-accent uppercase tracking-widest flex items-center gap-1">
          <Shield size={12} /> Defensa Estelar
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => engineRef.current?.toggleSpeed()}
            className="p-1 rounded bg-swu-bg border border-swu-border active:scale-95"
            title="Velocidad"
          >
            <FastForward size={12} className={gs?.speedMultiplier === 2 ? 'text-swu-amber' : 'text-swu-muted'} />
          </button>
          <button
            onClick={() => engineRef.current?.togglePause()}
            className="p-1 rounded bg-swu-bg border border-swu-border active:scale-95"
          >
            {gs?.isPaused ? <Play size={12} className="text-green-400" /> : <Pause size={12} className="text-swu-muted" />}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {gs && (
        <div className="flex items-center justify-between text-[10px] bg-swu-bg rounded-lg px-2 py-1 border border-swu-border/50">
          <span className="text-swu-accent font-bold">Onda {gs.wave}/{gs.maxWaves}</span>
          <span className="text-swu-amber flex items-center gap-0.5">
            <Coins size={10} /> {gs.credits}
          </span>
          <span className={`font-bold ${gs.base.hp > 10 ? 'text-swu-accent' : gs.base.hp > 5 ? 'text-swu-amber' : 'text-swu-red'}`}>
            HP {gs.base.hp}/{gs.base.maxHp}
          </span>
          <span className="text-swu-muted">{gs.score} pts</span>
        </div>
      )}

      {/* Canvas */}
      <div className="relative rounded-lg overflow-hidden border border-swu-border/50">
        <canvas
          ref={canvasRef}
          width={getCanvasSize().w}
          height={getCanvasSize().h}
          onClick={handleCanvasTap}
          onTouchStart={(e) => { e.preventDefault(); handleCanvasTap(e) }}
          className="w-full touch-none select-none"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Pause overlay */}
        {gs?.isPaused && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-extrabold text-swu-text">PAUSADO</p>
              <button
                onClick={() => engineRef.current?.togglePause()}
                className="mt-2 px-4 py-1.5 rounded-lg bg-swu-accent text-white text-sm font-bold"
              >
                Continuar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tower selection bar */}
      {gs && (
        <div className="flex gap-1.5">
          {TOWER_ORDER.map(type => {
            const config = TOWER_CONFIGS[type]
            const isSelected = gs.selectedTowerType === type
            const canAfford = gs.credits >= config.cost

            return (
              <button
                key={type}
                onClick={() => {
                  if (isSelected) {
                    engineRef.current?.selectTowerType(null)
                  } else if (canAfford) {
                    engineRef.current?.selectTowerType(type)
                  }
                }}
                disabled={!canAfford && !isSelected}
                className={`flex-1 py-1.5 px-1 rounded-lg border text-center transition-all active:scale-95 ${
                  isSelected
                    ? 'border-2 bg-swu-bg'
                    : canAfford
                      ? 'border-swu-border bg-swu-bg'
                      : 'border-swu-border/30 bg-swu-bg/50 opacity-40'
                }`}
                style={isSelected ? { borderColor: config.color } : undefined}
              >
                <div
                  className="w-3 h-3 rounded-full mx-auto mb-0.5"
                  style={{ backgroundColor: config.color, boxShadow: `0 0 6px ${config.glowColor}` }}
                />
                <p className="text-[8px] font-bold text-swu-text leading-tight truncate">{config.name}</p>
                <p className="text-[8px] text-swu-muted">${config.cost}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Selected tower actions */}
      {gs?.selectedTowerId && (() => {
        const tower = gs.towers.find(t => t.id === gs.selectedTowerId)
        if (!tower) return null
        const config = TOWER_CONFIGS[tower.type]
        const upgradeCost = config.upgradeCost * tower.level
        const canUpgrade = tower.level < 3 && gs.credits >= upgradeCost
        const sellValue = Math.floor(config.cost * 0.6)

        return (
          <div className="flex gap-2 items-center bg-swu-bg rounded-lg p-2 border border-swu-border/50">
            <div className="flex-1 text-[9px]">
              <p className="font-bold text-swu-text">{config.name} Nv.{tower.level}</p>
              <p className="text-swu-muted">Daño: {tower.damage} | Rango: {tower.range}</p>
            </div>
            {tower.level < 3 && (
              <button
                onClick={() => engineRef.current?.upgradeTower(tower.id)}
                disabled={!canUpgrade}
                className={`px-2 py-1 rounded text-[9px] font-bold flex items-center gap-1 ${
                  canUpgrade ? 'bg-swu-accent text-white' : 'bg-swu-border text-swu-muted'
                }`}
              >
                <ChevronUp size={10} /> ${upgradeCost}
              </button>
            )}
            <button
              onClick={() => engineRef.current?.sellTower(tower.id)}
              className="px-2 py-1 rounded bg-swu-red/20 text-swu-red text-[9px] font-bold"
            >
              Vender ${sellValue}
            </button>
          </div>
        )
      })()}
    </div>
  )
}

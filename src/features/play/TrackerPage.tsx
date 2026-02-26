import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Save, RotateCcw, Shield, Sparkles, Zap } from 'lucide-react'
import { Counter } from '../../components/ui/Counter'
import { Badge } from '../../components/ui/Badge'
import type { GameMode } from '../../types'

interface PlayerData {
  name: string
  baseHp: number
  resources: number
  shields: number
  experience: number
  leaderDeployed: boolean
}

const defaultHp: Record<string, number> = { premier: 30, twin_suns: 30, custom: 30 }

export function TrackerPage() {
  const { mode = 'premier' } = useParams<{ mode: GameMode }>()
  const navigate = useNavigate()
  const startHp = defaultHp[mode] ?? 30

  const [players, setPlayers] = useState<PlayerData[]>([
    { name: 'Jugador 1', baseHp: startHp, resources: 0, shields: 0, experience: 0, leaderDeployed: false },
    { name: 'Jugador 2', baseHp: startHp, resources: 0, shields: 0, experience: 0, leaderDeployed: false },
  ])
  const [initiative, setInitiative] = useState(0)
  const [gameScore, setGameScore] = useState<[number, number]>([0, 0])
  const [currentGame, setCurrentGame] = useState(1)

  const updatePlayer = useCallback((idx: number, field: keyof PlayerData, value: number | boolean) => {
    setPlayers(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }, [])

  const resetGame = () => {
    if (confirm('¿Iniciar nuevo game? Los contadores se resetearán.')) {
      setPlayers(prev => prev.map(p => ({ ...p, baseHp: startHp, resources: 0, shields: 0, experience: 0, leaderDeployed: false })))
    }
  }

  const recordWin = (playerIdx: number) => {
    const newScore: [number, number] = [...gameScore]
    newScore[playerIdx]++
    setGameScore(newScore)
    if (newScore[playerIdx] < 2) {
      setCurrentGame(prev => prev + 1)
      // Loser gets initiative choice
      setInitiative(playerIdx === 0 ? 1 : 0)
      setPlayers(prev => prev.map(p => ({ ...p, baseHp: startHp, resources: 0, shields: 0, experience: 0, leaderDeployed: false })))
    }
  }

  const PlayerPanel = ({ idx, flipped }: { idx: number; flipped: boolean }) => {
    const p = players[idx]
    const isInit = initiative === idx
    const accent = idx === 0 ? 'swu-accent' : 'swu-red'

    return (
      <div className={`flex-1 bg-swu-surface rounded-2xl p-3 border-2 border-${accent}/30 ${flipped ? 'rotate-180' : ''}`}>
        {/* Name + initiative */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-sm text-swu-text">{p.name}</span>
          {isInit && <Badge variant="amber">INICIATIVA</Badge>}
        </div>

        {/* Main HP Counter */}
        <div className="flex items-center justify-center mb-3">
          <Counter
            value={p.baseHp}
            onChange={(v) => updatePlayer(idx, 'baseHp', v)}
            min={0}
            max={99}
            label="BASE HP"
            size="lg"
            color={p.baseHp <= 5 ? '#EF4444' : undefined}
          />
        </div>

        {/* Sub counters */}
        <div className="grid grid-cols-4 gap-1.5">
          {/* Resources */}
          <div className="bg-swu-bg rounded-lg p-2 text-center">
            <Zap size={14} className="mx-auto text-swu-amber mb-0.5" />
            <p className="text-[9px] text-swu-muted">Recursos</p>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <button onClick={() => updatePlayer(idx, 'resources', Math.max(0, p.resources - 1))} className="text-swu-red text-base font-bold leading-none">-</button>
              <span className="text-lg font-bold text-swu-amber font-mono">{p.resources}</span>
              <button onClick={() => updatePlayer(idx, 'resources', p.resources + 1)} className="text-swu-green text-base font-bold leading-none">+</button>
            </div>
          </div>

          {/* Shields */}
          <div className="bg-swu-bg rounded-lg p-2 text-center">
            <Shield size={14} className="mx-auto text-swu-accent mb-0.5" />
            <p className="text-[9px] text-swu-muted">Shields</p>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <button onClick={() => updatePlayer(idx, 'shields', Math.max(0, p.shields - 1))} className="text-swu-red text-base font-bold leading-none">-</button>
              <span className="text-lg font-bold text-swu-accent font-mono">{p.shields}</span>
              <button onClick={() => updatePlayer(idx, 'shields', p.shields + 1)} className="text-swu-green text-base font-bold leading-none">+</button>
            </div>
          </div>

          {/* Experience */}
          <div className="bg-swu-bg rounded-lg p-2 text-center">
            <Sparkles size={14} className="mx-auto text-purple-400 mb-0.5" />
            <p className="text-[9px] text-swu-muted">XP</p>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <button onClick={() => updatePlayer(idx, 'experience', Math.max(0, p.experience - 1))} className="text-swu-red text-base font-bold leading-none">-</button>
              <span className="text-lg font-bold text-purple-400 font-mono">{p.experience}</span>
              <button onClick={() => updatePlayer(idx, 'experience', p.experience + 1)} className="text-swu-green text-base font-bold leading-none">+</button>
            </div>
          </div>

          {/* Leader */}
          <button
            onClick={() => updatePlayer(idx, 'leaderDeployed', !p.leaderDeployed)}
            className={`bg-swu-bg rounded-lg p-2 text-center border ${p.leaderDeployed ? `border-${accent}` : 'border-transparent'}`}
          >
            <span className="text-[9px] text-swu-muted block">Leader</span>
            <span className={`text-xs font-bold block mt-1 ${p.leaderDeployed ? `text-${accent}` : 'text-swu-muted'}`}>
              {p.leaderDeployed ? 'DEPLOY' : 'Ready'}
            </span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 flex flex-col gap-2" style={{ height: 'calc(100vh - 52px - 64px)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/play')} className="flex items-center gap-1 text-sm text-swu-muted">
          <ChevronLeft size={18} /> Modos
        </button>

        <div className="flex items-center gap-1">
          <Badge variant="accent">G{gameScore[0]}</Badge>
          <span className="text-swu-muted text-xs">—</span>
          <Badge variant="red">G{gameScore[1]}</Badge>
          <span className="text-swu-muted text-xs ml-1">Game {currentGame}</span>
        </div>

        <div className="flex gap-2">
          <button onClick={resetGame} className="p-2 rounded-lg bg-swu-surface border border-swu-border text-swu-muted">
            <RotateCcw size={16} />
          </button>
          <button className="p-2 rounded-lg bg-swu-surface border border-swu-border text-swu-muted">
            <Save size={16} />
          </button>
        </div>
      </div>

      {/* Player 1 (flipped) */}
      <PlayerPanel idx={0} flipped={true} />

      {/* Initiative + Win buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => recordWin(0)}
          className="flex-1 py-2 rounded-lg bg-swu-accent/20 border border-swu-accent/40 text-swu-accent font-bold text-xs active:scale-95 transition-transform"
        >
          P1 Gana
        </button>
        <button
          onClick={() => setInitiative(initiative === 0 ? 1 : 0)}
          className="flex-[2] py-2 rounded-xl bg-gradient-to-r from-swu-amber/20 to-swu-amber/10 border-2 border-swu-amber/40 text-swu-amber font-bold text-sm tracking-wide active:scale-95 transition-transform"
        >
          TAKE INITIATIVE
        </button>
        <button
          onClick={() => recordWin(1)}
          className="flex-1 py-2 rounded-lg bg-swu-red/20 border border-swu-red/40 text-swu-red font-bold text-xs active:scale-95 transition-transform"
        >
          P2 Gana
        </button>
      </div>

      {/* Player 2 */}
      <PlayerPanel idx={1} flipped={false} />
    </div>
  )
}

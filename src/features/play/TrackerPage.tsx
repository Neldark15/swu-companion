import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Save, RotateCcw, Shield, Sparkles, Zap, Check, Pencil, Trophy } from 'lucide-react'
import { Counter } from '../../components/ui/Counter'
import { Badge } from '../../components/ui/Badge'
import { useMatchPersistence } from '../../hooks/useMatchPersistence'
import type { GameMode, MatchState, GameResult } from '../../types'

interface PlayerData {
  name: string
  baseHp: number
  resources: number
  shields: number
  experience: number
  leaderDeployed: boolean
}

const defaultHp: Record<string, number> = { premier: 30, twin_suns: 30, custom: 30 }
const modeLabels: Record<string, string> = { premier: 'Premier', twin_suns: 'Twin Suns', custom: 'Custom' }

function generateId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function buildMatchState(
  id: string,
  mode: string,
  players: PlayerData[],
  gameScore: [number, number],
  currentGame: number,
  initiative: number,
  games: GameResult[],
  isActive: boolean,
): MatchState {
  return {
    id,
    mode: mode as GameMode,
    players: players.map((p) => ({
      name: p.name,
      baseHp: p.baseHp,
      leaderDeployed: p.leaderDeployed,
      leaderDamage: 0,
      resources: p.resources,
      shieldTokens: p.shields,
      experienceTokens: p.experience,
    })),
    gameScore: {
      games,
      finalScore: gameScore,
    },
    currentGame,
    initiativeHolder: initiative,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isActive,
  }
}

export function TrackerPage() {
  const { mode = 'premier' } = useParams<{ mode: string }>()
  const [searchParams] = useSearchParams()
  const resumeId = searchParams.get('resume')
  const navigate = useNavigate()
  const startHp = defaultHp[mode] ?? 30

  const [matchId, setMatchId] = useState(() => resumeId || generateId())
  const [players, setPlayers] = useState<PlayerData[]>([
    { name: 'Jugador 1', baseHp: startHp, resources: 0, shields: 0, experience: 0, leaderDeployed: false },
    { name: 'Jugador 2', baseHp: startHp, resources: 0, shields: 0, experience: 0, leaderDeployed: false },
  ])
  const [initiative, setInitiative] = useState(0)
  const [gameScore, setGameScore] = useState<[number, number]>([0, 0])
  const [currentGame, setCurrentGame] = useState(1)
  const [games, setGames] = useState<GameResult[]>([])
  const [matchOver, setMatchOver] = useState(false)
  const [saveFlash, setSaveFlash] = useState(false)
  const [editingName, setEditingName] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  const matchState = buildMatchState(matchId, mode, players, gameScore, currentGame, initiative, games, !matchOver)
  const { save, loadMatch, finishMatch } = useMatchPersistence(matchOver ? null : matchState)

  // Load resumed match
  useEffect(() => {
    if (resumeId && !loaded) {
      loadMatch(resumeId).then((m) => {
        if (m) {
          setMatchId(m.id)
          setPlayers(
            m.players.map((p) => ({
              name: p.name,
              baseHp: p.baseHp,
              resources: p.resources,
              shields: p.shieldTokens,
              experience: p.experienceTokens,
              leaderDeployed: p.leaderDeployed,
            })),
          )
          setInitiative(m.initiativeHolder)
          setGameScore(m.gameScore.finalScore)
          setCurrentGame(m.currentGame)
          setGames(m.gameScore.games)
          setMatchOver(!m.isActive)
        }
        setLoaded(true)
      })
    } else {
      setLoaded(true)
    }
  }, [resumeId, loadMatch, loaded])

  // Auto-save every 30s
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (matchOver) return
    autoSaveRef.current = setInterval(() => {
      const ms = buildMatchState(matchId, mode, players, gameScore, currentGame, initiative, games, true)
      save(ms)
    }, 30_000)
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current)
    }
  }, [matchId, mode, players, gameScore, currentGame, initiative, games, matchOver, save])

  // Save on unmount
  useEffect(() => {
    return () => {
      if (!matchOver) {
        const ms = buildMatchState(matchId, mode, players, gameScore, currentGame, initiative, games, true)
        save(ms)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updatePlayer = useCallback((idx: number, field: keyof PlayerData, value: number | boolean) => {
    setPlayers((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)))
  }, [])

  const resetGame = () => {
    if (confirm('¿Iniciar nuevo game? Los contadores se resetearán.')) {
      setPlayers((prev) => prev.map((p) => ({ ...p, baseHp: startHp, resources: 0, shields: 0, experience: 0, leaderDeployed: false })))
    }
  }

  const recordWin = (playerIdx: number) => {
    const newScore: [number, number] = [...gameScore]
    newScore[playerIdx]++
    const newGame: GameResult = { winner: playerIdx, initiativePlayer: initiative }
    const newGames = [...games, newGame]

    setGameScore(newScore)
    setGames(newGames)

    if (newScore[playerIdx] >= 2) {
      // Match over (Bo3)
      setMatchOver(true)
      const ms = buildMatchState(matchId, mode, players, newScore, currentGame, initiative, newGames, false)
      finishMatch(ms)
    } else {
      setCurrentGame((prev) => prev + 1)
      setInitiative(playerIdx === 0 ? 1 : 0) // Loser gets initiative
      setPlayers((prev) =>
        prev.map((p) => ({ ...p, baseHp: startHp, resources: 0, shields: 0, experience: 0, leaderDeployed: false })),
      )
    }
  }

  const handleManualSave = async () => {
    const ms = buildMatchState(matchId, mode, players, gameScore, currentGame, initiative, games, !matchOver)
    await save(ms)
    setSaveFlash(true)
    setTimeout(() => setSaveFlash(false), 1200)
  }

  const updateName = (idx: number, name: string) => {
    setPlayers((prev) => prev.map((p, i) => (i === idx ? { ...p, name: name || `Jugador ${i + 1}` } : p)))
    setEditingName(null)
  }

  const PlayerPanel = ({ idx, flipped }: { idx: number; flipped: boolean }) => {
    const p = players[idx]
    const isInit = initiative === idx
    const accent = idx === 0 ? 'text-swu-accent' : 'text-swu-red'
    const borderAccent = idx === 0 ? 'border-swu-accent/30' : 'border-swu-red/30'

    return (
      <div className={`flex-1 bg-swu-surface rounded-2xl p-3 border-2 ${borderAccent} ${flipped ? 'rotate-180' : ''}`}>
        {/* Name + initiative */}
        <div className="flex items-center justify-between mb-2">
          {editingName === idx ? (
            <input
              autoFocus
              className="bg-swu-bg border border-swu-border rounded-lg px-2 py-1 text-sm text-swu-text font-bold w-32"
              defaultValue={p.name}
              onBlur={(e) => updateName(idx, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') updateName(idx, (e.target as HTMLInputElement).value)
              }}
            />
          ) : (
            <button onClick={() => setEditingName(idx)} className="flex items-center gap-1.5 group">
              <span className="font-bold text-sm text-swu-text">{p.name}</span>
              <Pencil size={12} className="text-swu-muted opacity-0 group-active:opacity-100" />
            </button>
          )}
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
          <div className="bg-swu-bg rounded-lg p-2 text-center">
            <Zap size={14} className="mx-auto text-swu-amber mb-0.5" />
            <p className="text-[9px] text-swu-muted">Recursos</p>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <button onClick={() => updatePlayer(idx, 'resources', Math.max(0, p.resources - 1))} className="text-swu-red text-base font-bold leading-none">−</button>
              <span className="text-lg font-bold text-swu-amber font-mono">{p.resources}</span>
              <button onClick={() => updatePlayer(idx, 'resources', p.resources + 1)} className="text-swu-green text-base font-bold leading-none">+</button>
            </div>
          </div>

          <div className="bg-swu-bg rounded-lg p-2 text-center">
            <Shield size={14} className="mx-auto text-swu-accent mb-0.5" />
            <p className="text-[9px] text-swu-muted">Shields</p>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <button onClick={() => updatePlayer(idx, 'shields', Math.max(0, p.shields - 1))} className="text-swu-red text-base font-bold leading-none">−</button>
              <span className="text-lg font-bold text-swu-accent font-mono">{p.shields}</span>
              <button onClick={() => updatePlayer(idx, 'shields', p.shields + 1)} className="text-swu-green text-base font-bold leading-none">+</button>
            </div>
          </div>

          <div className="bg-swu-bg rounded-lg p-2 text-center">
            <Sparkles size={14} className="mx-auto text-purple-400 mb-0.5" />
            <p className="text-[9px] text-swu-muted">XP</p>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <button onClick={() => updatePlayer(idx, 'experience', Math.max(0, p.experience - 1))} className="text-swu-red text-base font-bold leading-none">−</button>
              <span className="text-lg font-bold text-purple-400 font-mono">{p.experience}</span>
              <button onClick={() => updatePlayer(idx, 'experience', p.experience + 1)} className="text-swu-green text-base font-bold leading-none">+</button>
            </div>
          </div>

          <button
            onClick={() => updatePlayer(idx, 'leaderDeployed', !p.leaderDeployed)}
            className={`bg-swu-bg rounded-lg p-2 text-center border ${p.leaderDeployed ? borderAccent : 'border-transparent'}`}
          >
            <span className="text-[9px] text-swu-muted block">Leader</span>
            <span className={`text-xs font-bold block mt-1 ${p.leaderDeployed ? accent : 'text-swu-muted'}`}>
              {p.leaderDeployed ? 'DEPLOY' : 'Ready'}
            </span>
          </button>
        </div>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-swu-muted">Cargando partida...</div>
      </div>
    )
  }

  // Match finished screen
  if (matchOver) {
    const winnerIdx = gameScore[0] >= 2 ? 0 : 1
    const winner = players[winnerIdx]
    return (
      <div className="p-4 flex flex-col items-center justify-center gap-6" style={{ minHeight: 'calc(100vh - 52px - 64px)' }}>
        <Trophy size={64} className="text-swu-amber" />
        <h2 className="text-2xl font-extrabold text-swu-text text-center">
          ¡{winner.name} gana!
        </h2>
        <div className="flex items-center gap-3">
          <Badge variant="accent">P1: {gameScore[0]}</Badge>
          <span className="text-swu-muted text-lg">—</span>
          <Badge variant="red">P2: {gameScore[1]}</Badge>
        </div>

        {/* Game-by-game */}
        <div className="w-full max-w-xs space-y-2">
          {games.map((g, i) => (
            <div key={i} className="bg-swu-surface rounded-lg p-3 flex items-center justify-between border border-swu-border">
              <span className="text-xs text-swu-muted">Game {i + 1}</span>
              <span className="text-sm font-bold text-swu-text">
                {g.winner !== null ? players[g.winner].name : 'Empate'}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-3 w-full max-w-xs">
          <button
            onClick={() => navigate('/play')}
            className="flex-1 py-3 rounded-xl bg-swu-surface border border-swu-border text-swu-text font-bold text-sm"
          >
            Volver
          </button>
          <button
            onClick={() => {
              setMatchId(generateId())
              setPlayers((prev) => prev.map((p) => ({ ...p, baseHp: startHp, resources: 0, shields: 0, experience: 0, leaderDeployed: false })))
              setGameScore([0, 0])
              setCurrentGame(1)
              setGames([])
              setMatchOver(false)
            }}
            className="flex-1 py-3 rounded-xl bg-swu-accent text-white font-bold text-sm"
          >
            Revancha
          </button>
        </div>

        <p className="text-[10px] text-swu-muted">
          {modeLabels[mode]} · {new Date().toLocaleDateString()}
        </p>
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
          <button
            onClick={handleManualSave}
            className={`p-2 rounded-lg border transition-colors ${saveFlash ? 'bg-swu-green/20 border-swu-green/40 text-swu-green' : 'bg-swu-surface border-swu-border text-swu-muted'}`}
          >
            {saveFlash ? <Check size={16} /> : <Save size={16} />}
          </button>
        </div>
      </div>

      {/* Player 1 (flipped for face-to-face) */}
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

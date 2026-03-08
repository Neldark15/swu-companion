import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Save, RotateCcw, Shield, Sparkles, Zap, Check, Pencil, Trophy, Search, X, Users, Layers } from 'lucide-react'
import { Counter } from '../../components/ui/Counter'
import { Badge } from '../../components/ui/Badge'
import { useMatchPersistence } from '../../hooks/useMatchPersistence'
import { searchCards } from '../../services/swuApi'
import { db } from '../../services/db'
import { CardImage } from '../../components/CardImage'
import type { GameMode, MatchState, GameResult, Card, Deck } from '../../types'

interface PlayerData {
  name: string
  baseHp: number
  resources: number
  shields: number
  experience: number
  leaderDeployed: boolean
  baseName: string
  baseImageUrl: string
}

const defaultHp: Record<string, number> = { premier: 30, twin_suns: 30 }
const modeLabels: Record<string, string> = { premier: 'Premier', twin_suns: 'Twin Suns' }

function generateId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function createPlayer(idx: number, hp: number): PlayerData {
  return { name: `Jugador ${idx + 1}`, baseHp: hp, resources: 0, shields: 0, experience: 0, leaderDeployed: false, baseName: '', baseImageUrl: '' }
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
    players: players.slice(0, 2).map((p) => ({
      name: p.name,
      baseHp: p.baseHp,
      leaderDeployed: p.leaderDeployed,
      leaderDamage: 0,
      resources: p.resources,
      shieldTokens: p.shields,
      experienceTokens: p.experience,
    })),
    gameScore: { games, finalScore: gameScore },
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

  // Deck selector state
  const [showDeckPicker, setShowDeckPicker] = useState(false)
  const [deckPickerFor, setDeckPickerFor] = useState<number>(0)
  const [availableDecks, setAvailableDecks] = useState<Deck[]>([])

  // Player count for Twin Suns
  const [, setPlayerCount] = useState(2)
  const [showPlayerCountPicker, setShowPlayerCountPicker] = useState(mode === 'twin_suns' && !resumeId)

  const [matchId, setMatchId] = useState(() => resumeId || generateId())
  const [players, setPlayers] = useState<PlayerData[]>([
    createPlayer(0, startHp),
    createPlayer(1, startHp),
  ])
  const [basePickerFor, setBasePickerFor] = useState<number | null>(null)
  const [baseSearchQuery, setBaseSearchQuery] = useState('')
  const [baseResults, setBaseResults] = useState<Card[]>([])
  const [baseSearching, setBaseSearching] = useState(false)
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

  // Load decks for deck picker
  useEffect(() => {
    db.decks.toArray().then(setAvailableDecks)
  }, [])

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
              baseName: '',
              baseImageUrl: '',
            })),
          )
          setInitiative(m.initiativeHolder)
          setGameScore(m.gameScore.finalScore)
          setCurrentGame(m.currentGame)
          setGames(m.gameScore.games)
          setMatchOver(!m.isActive)
          setShowPlayerCountPicker(false)
        }
        setLoaded(true)
      })
    } else if (!showPlayerCountPicker) {
      setLoaded(true)
    }
  }, [resumeId, loadMatch, loaded, showPlayerCountPicker])

  // Apply player count for Twin Suns
  const confirmPlayerCount = (count: number) => {
    setPlayerCount(count)
    const newPlayers: PlayerData[] = []
    for (let i = 0; i < count; i++) {
      newPlayers.push(createPlayer(i, startHp))
    }
    setPlayers(newPlayers)
    setShowPlayerCountPicker(false)
    setLoaded(true)
  }

  // Select deck for a player → auto-set base
  const selectDeckForPlayer = async (deck: Deck, playerIdx: number) => {
    if (deck.base) {
      const baseCard = await db.cards.get(deck.base.cardId)
      if (baseCard) {
        setPlayers(prev => prev.map((p, i) => i === playerIdx ? {
          ...p,
          baseName: baseCard.name,
          baseImageUrl: baseCard.imageUrl,
          baseHp: baseCard.hp || startHp,
        } : p))
      }
    }
    setShowDeckPicker(false)
  }

  // Auto-save every 30s
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (matchOver) return
    autoSaveRef.current = setInterval(() => {
      const ms = buildMatchState(matchId, mode, players, gameScore, currentGame, initiative, games, true)
      save(ms)
    }, 30_000)
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current) }
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

  // Base picker search
  useEffect(() => {
    if (basePickerFor === null) return
    if (!baseSearchQuery.trim()) { setBaseResults([]); return }
    setBaseSearching(true)
    const timer = setTimeout(async () => {
      const { cards } = await searchCards({ query: baseSearchQuery, type: 'Base', limit: 20 })
      setBaseResults(cards)
      setBaseSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [baseSearchQuery, basePickerFor])

  const selectBase = (card: Card, playerIdx: number) => {
    setPlayers(prev => prev.map((p, i) => i === playerIdx ? { ...p, baseName: card.name, baseImageUrl: card.imageUrl, baseHp: card.hp || p.baseHp } : p))
    setBasePickerFor(null)
    setBaseSearchQuery('')
    setBaseResults([])
  }

  const updatePlayer = useCallback((idx: number, field: keyof PlayerData, value: number | boolean) => {
    setPlayers((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)))
  }, [])

  const resetGame = () => {
    if (confirm('¿Iniciar nuevo game? Los contadores se resetearán.')) {
      setPlayers((prev) => prev.map((p) => ({ ...p, baseHp: p.baseImageUrl ? p.baseHp : startHp, resources: 0, shields: 0, experience: 0, leaderDeployed: false })))
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
      setMatchOver(true)
      const ms = buildMatchState(matchId, mode, players, newScore, currentGame, initiative, newGames, false)
      finishMatch(ms)
    } else {
      setCurrentGame((prev) => prev + 1)
      setInitiative(playerIdx === 0 ? 1 : 0)
      setPlayers((prev) => prev.map((p) => ({ ...p, baseHp: startHp, resources: 0, shields: 0, experience: 0, leaderDeployed: false })))
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
    const colors = ['text-swu-accent', 'text-swu-red', 'text-swu-green', 'text-purple-400']
    const borders = ['border-swu-accent/30', 'border-swu-red/30', 'border-swu-green/30', 'border-purple-400/30']
    const accent = colors[idx % colors.length]
    const borderAccent = borders[idx % borders.length]

    return (
      <div className={`flex-1 bg-swu-surface rounded-2xl p-3 border-2 ${borderAccent} ${flipped ? 'rotate-180' : ''}`}>
        {/* Name + initiative + deck selector */}
        <div className="flex items-center justify-between mb-2">
          {editingName === idx ? (
            <input
              autoFocus
              className="bg-swu-bg border border-swu-border rounded-lg px-2 py-1 text-sm text-swu-text font-bold w-28"
              defaultValue={p.name}
              onBlur={(e) => updateName(idx, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') updateName(idx, (e.target as HTMLInputElement).value) }}
            />
          ) : (
            <button onClick={() => setEditingName(idx)} className="flex items-center gap-1 group">
              <span className="font-bold text-sm text-swu-text truncate max-w-[100px]">{p.name}</span>
              <Pencil size={10} className="text-swu-muted opacity-0 group-active:opacity-100" />
            </button>
          )}
          <div className="flex items-center gap-1">
            {isInit && <Badge variant="amber">INI</Badge>}
            <button
              onClick={() => { setDeckPickerFor(idx); setShowDeckPicker(true) }}
              className="px-2 py-0.5 rounded-md bg-swu-bg border border-swu-border text-[9px] text-swu-muted font-bold"
            >
              <Layers size={10} className="inline mr-0.5" />Deck
            </button>
          </div>
        </div>

        {/* Base + HP Counter */}
        <div className="flex items-center justify-center gap-2 mb-2">
          {p.baseImageUrl ? (
            <button onClick={() => setBasePickerFor(idx)} className="w-11 h-15 rounded-lg overflow-hidden border border-swu-border flex-shrink-0 active:scale-95 transition-transform">
              <img src={p.baseImageUrl} alt={p.baseName} className="w-full h-full object-cover" />
            </button>
          ) : (
            <button
              onClick={() => setBasePickerFor(idx)}
              className="w-11 h-15 rounded-lg border-2 border-dashed border-swu-border flex items-center justify-center text-swu-muted active:bg-swu-surface transition-colors flex-shrink-0"
            >
              <Search size={12} />
            </button>
          )}
          <div className="flex-1">
            {p.baseName && <p className="text-[8px] text-swu-muted text-center truncate mb-0.5">{p.baseName}</p>}
            <Counter
              value={p.baseHp}
              onChange={(v) => updatePlayer(idx, 'baseHp', v)}
              min={0}
              max={99}
              label="HP"
              size="lg"
              color={p.baseHp <= 5 ? '#EF4444' : undefined}
            />
          </div>
        </div>

        {/* Sub counters */}
        <div className="grid grid-cols-4 gap-1">
          <div className="bg-swu-bg rounded-lg p-1.5 text-center">
            <Zap size={12} className="mx-auto text-swu-amber mb-0.5" />
            <p className="text-[8px] text-swu-muted">Rec.</p>
            <div className="flex items-center justify-center gap-0.5 mt-0.5">
              <button onClick={() => updatePlayer(idx, 'resources', Math.max(0, p.resources - 1))} className="text-swu-red text-sm font-bold leading-none">−</button>
              <span className="text-base font-bold text-swu-amber font-mono">{p.resources}</span>
              <button onClick={() => updatePlayer(idx, 'resources', p.resources + 1)} className="text-swu-green text-sm font-bold leading-none">+</button>
            </div>
          </div>

          <div className="bg-swu-bg rounded-lg p-1.5 text-center">
            <Shield size={12} className="mx-auto text-swu-accent mb-0.5" />
            <p className="text-[8px] text-swu-muted">Esc.</p>
            <div className="flex items-center justify-center gap-0.5 mt-0.5">
              <button onClick={() => updatePlayer(idx, 'shields', Math.max(0, p.shields - 1))} className="text-swu-red text-sm font-bold leading-none">−</button>
              <span className="text-base font-bold text-swu-accent font-mono">{p.shields}</span>
              <button onClick={() => updatePlayer(idx, 'shields', p.shields + 1)} className="text-swu-green text-sm font-bold leading-none">+</button>
            </div>
          </div>

          <div className="bg-swu-bg rounded-lg p-1.5 text-center">
            <Sparkles size={12} className="mx-auto text-purple-400 mb-0.5" />
            <p className="text-[8px] text-swu-muted">XP</p>
            <div className="flex items-center justify-center gap-0.5 mt-0.5">
              <button onClick={() => updatePlayer(idx, 'experience', Math.max(0, p.experience - 1))} className="text-swu-red text-sm font-bold leading-none">−</button>
              <span className="text-base font-bold text-purple-400 font-mono">{p.experience}</span>
              <button onClick={() => updatePlayer(idx, 'experience', p.experience + 1)} className="text-swu-green text-sm font-bold leading-none">+</button>
            </div>
          </div>

          <button
            onClick={() => updatePlayer(idx, 'leaderDeployed', !p.leaderDeployed)}
            className={`bg-swu-bg rounded-lg p-1.5 text-center border ${p.leaderDeployed ? borderAccent : 'border-transparent'}`}
          >
            <span className="text-[8px] text-swu-muted block">Líder</span>
            <span className={`text-[10px] font-bold block mt-1 ${p.leaderDeployed ? accent : 'text-swu-muted'}`}>
              {p.leaderDeployed ? 'DESP' : 'Listo'}
            </span>
          </button>
        </div>
      </div>
    )
  }

  // Player count picker for Twin Suns
  if (showPlayerCountPicker) {
    return (
      <div className="p-4 flex flex-col items-center justify-center gap-6" style={{ minHeight: 'calc(100vh - 52px - 64px)' }}>
        <Users size={48} className="text-swu-amber" />
        <h2 className="text-xl font-extrabold text-swu-text">Twin Suns</h2>
        <p className="text-sm text-swu-muted text-center">¿Cuántos jugadores participarán?</p>
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          {[2, 3, 4].map(n => (
            <button
              key={n}
              onClick={() => confirmPlayerCount(n)}
              className="py-6 rounded-2xl bg-swu-surface border-2 border-swu-amber/40 text-swu-amber font-extrabold text-2xl active:scale-95 transition-transform"
            >
              {n}
            </button>
          ))}
        </div>
        <button onClick={() => navigate('/play')} className="text-sm text-swu-muted">← Volver</button>
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
        <h2 className="text-2xl font-extrabold text-swu-text text-center">¡{winner.name} gana!</h2>
        <div className="flex items-center gap-3">
          <Badge variant="accent">J1: {gameScore[0]}</Badge>
          <span className="text-swu-muted text-lg">—</span>
          <Badge variant="red">J2: {gameScore[1]}</Badge>
        </div>
        <div className="w-full max-w-xs space-y-2">
          {games.map((g, i) => (
            <div key={i} className="bg-swu-surface rounded-lg p-3 flex items-center justify-between border border-swu-border">
              <span className="text-xs text-swu-muted">Game {i + 1}</span>
              <span className="text-sm font-bold text-swu-text">{g.winner !== null ? players[g.winner]?.name || `J${g.winner + 1}` : 'Empate'}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3 w-full max-w-xs">
          <button onClick={() => navigate('/play')} className="flex-1 py-3 rounded-xl bg-swu-surface border border-swu-border text-swu-text font-bold text-sm">Volver</button>
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
          >Revancha</button>
        </div>
        <p className="text-[10px] text-swu-muted">{modeLabels[mode]} · {new Date().toLocaleDateString()}</p>
      </div>
    )
  }

  const is2Player = players.length <= 2

  return (
    <div className="p-2 flex flex-col gap-1.5" style={{ height: 'calc(100vh - 52px - 64px)' }}>
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
        <div className="flex gap-1.5">
          <button onClick={resetGame} className="p-1.5 rounded-lg bg-swu-surface border border-swu-border text-swu-muted"><RotateCcw size={14} /></button>
          <button
            onClick={handleManualSave}
            className={`p-1.5 rounded-lg border transition-colors ${saveFlash ? 'bg-swu-green/20 border-swu-green/40 text-swu-green' : 'bg-swu-surface border-swu-border text-swu-muted'}`}
          >
            {saveFlash ? <Check size={14} /> : <Save size={14} />}
          </button>
        </div>
      </div>

      {is2Player ? (
        <>
          <PlayerPanel idx={0} flipped={true} />
          <div className="flex gap-2">
            <button onClick={() => recordWin(0)} className="flex-1 py-1.5 rounded-lg bg-swu-accent/20 border border-swu-accent/40 text-swu-accent font-bold text-xs active:scale-95 transition-transform">J1 Gana</button>
            <button onClick={() => setInitiative(initiative === 0 ? 1 : 0)} className="flex-[2] py-1.5 rounded-xl bg-gradient-to-r from-swu-amber/20 to-swu-amber/10 border-2 border-swu-amber/40 text-swu-amber font-bold text-xs tracking-wide active:scale-95 transition-transform">INICIATIVA</button>
            <button onClick={() => recordWin(1)} className="flex-1 py-1.5 rounded-lg bg-swu-red/20 border border-swu-red/40 text-swu-red font-bold text-xs active:scale-95 transition-transform">J2 Gana</button>
          </div>
          <PlayerPanel idx={1} flipped={false} />
        </>
      ) : (
        /* 3-4 players: grid layout */
        <>
          <div className="grid grid-cols-2 gap-1.5 flex-1">
            {players.map((_, idx) => (
              <PlayerPanel key={idx} idx={idx} flipped={false} />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setInitiative((initiative + 1) % players.length)} className="flex-1 py-2 rounded-xl bg-gradient-to-r from-swu-amber/20 to-swu-amber/10 border-2 border-swu-amber/40 text-swu-amber font-bold text-xs active:scale-95 transition-transform">
              PASAR INICIATIVA → J{((initiative + 1) % players.length) + 1}
            </button>
          </div>
        </>
      )}

      {/* Base Picker Modal */}
      {basePickerFor !== null && (
        <div className="fixed inset-0 z-50 bg-black/70 flex flex-col">
          <div className="bg-swu-bg p-4 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-swu-text">Seleccionar Base — {players[basePickerFor].name}</h3>
              <button onClick={() => { setBasePickerFor(null); setBaseSearchQuery(''); setBaseResults([]) }} className="p-2 text-swu-muted"><X size={20} /></button>
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
              <input
                autoFocus
                value={baseSearchQuery}
                onChange={(e) => setBaseSearchQuery(e.target.value)}
                placeholder="Buscar base por nombre..."
                className="w-full bg-swu-surface border border-swu-border rounded-xl py-3 pl-10 pr-3 text-sm text-swu-text outline-none focus:border-swu-accent"
              />
            </div>
            {baseSearching && <div className="text-center py-4"><div className="animate-pulse text-sm text-swu-muted">Buscando...</div></div>}
            <div className="space-y-1">
              {baseResults.map((card) => (
                <button key={card.id} onClick={() => selectBase(card, basePickerFor)} className="w-full bg-swu-surface rounded-xl p-3 border border-swu-border flex items-center gap-3 text-left active:scale-[0.98] transition-transform">
                  <CardImage src={card.imageUrl} alt={card.name} className="w-12 h-16" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-swu-text truncate">{card.name}</p>
                    {card.subtitle && <p className="text-xs text-swu-muted truncate">{card.subtitle}</p>}
                    <p className="text-xs text-swu-muted mt-0.5">{card.setCode} · HP: <span className="font-bold text-swu-accent">{card.hp}</span></p>
                  </div>
                </button>
              ))}
            </div>
            {!baseSearching && baseSearchQuery && baseResults.length === 0 && <p className="text-xs text-swu-muted text-center py-4">No se encontraron bases</p>}
            {!baseSearchQuery && <p className="text-xs text-swu-muted text-center py-4">Escriba el nombre de la base para buscar</p>}
          </div>
        </div>
      )}

      {/* Deck Picker Modal */}
      {showDeckPicker && (
        <div className="fixed inset-0 z-50 bg-black/70 flex flex-col">
          <div className="bg-swu-bg p-4 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-swu-text">Seleccionar Deck — {players[deckPickerFor]?.name}</h3>
              <button onClick={() => setShowDeckPicker(false)} className="p-2 text-swu-muted"><X size={20} /></button>
            </div>
            {availableDecks.length === 0 ? (
              <div className="text-center py-8">
                <Layers size={32} className="mx-auto text-swu-muted/40 mb-2" />
                <p className="text-sm text-swu-muted">No tiene decks creados</p>
                <button onClick={() => navigate('/decks/new')} className="mt-3 px-4 py-2 rounded-lg bg-swu-accent text-white text-sm font-bold">Crear Deck</button>
              </div>
            ) : (
              <div className="space-y-2">
                {availableDecks.map(d => (
                  <button
                    key={d.id}
                    onClick={() => selectDeckForPlayer(d, deckPickerFor)}
                    className="w-full bg-swu-surface rounded-xl p-3 border border-swu-border text-left active:scale-[0.98] transition-transform"
                  >
                    <p className="text-sm font-bold text-swu-text">{d.name}</p>
                    <p className="text-[10px] text-swu-muted mt-0.5">
                      {d.leaders[0]?.name || 'Sin líder'} · {d.base?.name || 'Sin base'} · {d.mainDeck.reduce((s, c) => s + c.quantity, 0)} cartas
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

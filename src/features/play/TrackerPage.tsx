import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Save, RotateCcw, Shield, Sparkles, Zap, Check, Pencil, Trophy, Search, X, Users, Layers } from 'lucide-react'
import { Counter } from '../../components/ui/Counter'
import { Badge } from '../../components/ui/Badge'
import { useMatchPersistence } from '../../hooks/useMatchPersistence'
import { searchCards } from '../../services/swuApi'
import { db } from '../../services/db'
import { fechaCorta } from '../../services/horaSV'
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
  /** Última consulta cuyos resultados ya llegaron. De acá sale `baseSearching`. */
  const [ultimaBusqueda, setUltimaBusqueda] = useState('')
  const [initiative, setInitiative] = useState(0)
  const [gameScore, setGameScore] = useState<[number, number]>([0, 0])
  const [currentGame, setCurrentGame] = useState(1)
  const [games, setGames] = useState<GameResult[]>([])
  const [matchOver, setMatchOver] = useState(false)
  const [saveFlash, setSaveFlash] = useState(false)
  const [editingName, setEditingName] = useState<number | null>(null)
  const [resumenCargado, setResumenCargado] = useState(false)

  const matchState = buildMatchState(matchId, mode, players, gameScore, currentGame, initiative, games, !matchOver)
  const { save, loadMatch, finishMatch } = useMatchPersistence(matchOver ? null : matchState)

  // Load decks for deck picker
  useEffect(() => {
    db.decks.toArray().then(setAvailableDecks)
  }, [])

  // Load resumed match
  useEffect(() => {
    if (resumeId && !resumenCargado) {
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
        setResumenCargado(true)
      })
    }
  }, [resumeId, loadMatch, resumenCargado])

  /* `loaded` pasó a ser DERIVADO en vez de estado.
   *
   * La rama sin `resumeId` hacía `setLoaded(true)` dentro del cuerpo del
   * efecto, o sea un render en cascada solo para pasar de «cargando» a
   * «listo» en un caso que se sabe de antemano. Sin partida que reanudar no
   * hay nada que cargar: basta con que el selector de jugadores ya no esté.
   * El estado queda solo para el camino asíncrono, que es el único que de
   * verdad espera algo. */
  const loaded = resumeId ? resumenCargado : !showPlayerCountPicker

  // Apply player count for Twin Suns
  const confirmPlayerCount = (count: number) => {
    setPlayerCount(count)
    const newPlayers: PlayerData[] = []
    for (let i = 0; i < count; i++) {
      newPlayers.push(createPlayer(i, startHp))
    }
    setPlayers(newPlayers)
    // Con `loaded` derivado, cerrar el selector YA lo pone en verdadero.
    setShowPlayerCountPicker(false)
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

  /* El guardado al desmontar se borró: `useMatchPersistence` ya lo hace, y bien.
   *
   * El efecto que estaba acá tenía `deps: []`, así que su función de limpieza
   * se quedaba con el `matchOver`, el `matchId` y los `players` del PRIMER
   * render. Consecuencia: una partida que cerrabas con el botón de finalizar
   * se volvía a guardar al salir con `matchOver` capturado en `false` —o sea,
   * como ACTIVA y en blanco— y reaparecía en «guardadas». También machacaba la
   * partida anterior con el id viejo después de darle a «nueva partida».
   *
   * `useMatchPersistence` lee de un ref que sí está fresco. */

  /* Buscador de bases.
   *
   * Vaciar los resultados con la caja vacía era un `setState` en el cuerpo del
   * efecto. No hace falta guardarlo: con la caja vacía no hay nada que mostrar,
   * y eso se decide al pintar (ver `resultadosVisibles`). El efecto queda solo
   * para lo que sí es un efecto — pedirle cartas a la base de datos. */
  useEffect(() => {
    if (basePickerFor === null) return
    if (!baseSearchQuery.trim()) return
    const timer = setTimeout(async () => {
      const { cards } = await searchCards({ query: baseSearchQuery, type: 'Base', limit: 20 })
      setBaseResults(cards)
      setUltimaBusqueda(baseSearchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [baseSearchQuery, basePickerFor])

  /** Con la caja vacía no se muestra nada, aunque queden resultados viejos guardados. */
  const resultadosVisibles = baseSearchQuery.trim() ? baseResults : []

  /* «Buscando» también es derivado: hay algo escrito y todavía no llegaron los
   * resultados DE ESO. Antes era un estado que se prendía dentro del efecto. */
  const baseSearching = !!baseSearchQuery.trim() && baseSearchQuery !== ultimaBusqueda

  const selectBase = (card: Card, playerIdx: number) => {
    setPlayers(prev => prev.map((p, i) => i === playerIdx ? { ...p, baseName: card.name, baseImageUrl: card.imageUrl, baseHp: card.hp || p.baseHp } : p))
    setBasePickerFor(null)
    setBaseSearchQuery('')
    setBaseResults([])
    // `ultimaBusqueda` va junto con los resultados o quedan descoordinados:
    // volver a escribir el MISMO texto para el otro jugador daría «ya llegó»
    // con la lista vacía, y la pantalla afirmaría «No se encontraron bases»
    // sobre una carta que sí existe.
    setUltimaBusqueda('')
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

  /* PENDIENTE: `PlayerPanel` se define DENTRO del componente, así que React lo
   * ve como un tipo distinto en cada render y desmonta/remonta todo el panel.
   * Sacarlo afuera son ~110 líneas y media docena de props (players, initiative,
   * los manejadores), o sea un refactor de verdad sobre la pantalla que se usa
   * en torneo — no algo para colar en un arreglo de sesión.
   *
   * Esto NO es deuda nueva: estaba desde antes, oculto porque el efecto muerto
   * que había más arriba hacía que el compilador de React abandonara el
   * análisis de este archivo y se tragara los diagnósticos. Al borrarlo salió. */
  const PlayerPanel = ({ idx, flipped }: { idx: number; flipped: boolean }) => {
    const p = players[idx]
    const isInit = initiative === idx
    const colors = ['text-swu-accent-texto', 'text-swu-red-texto', 'text-swu-green', 'text-purple-400']
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
              <button onClick={() => updatePlayer(idx, 'resources', Math.max(0, p.resources - 1))} className="text-swu-red-texto text-sm font-bold leading-none">−</button>
              <span className="text-base font-bold text-swu-amber font-mono">{p.resources}</span>
              <button onClick={() => updatePlayer(idx, 'resources', p.resources + 1)} className="text-swu-green text-sm font-bold leading-none">+</button>
            </div>
          </div>

          <div className="bg-swu-bg rounded-lg p-1.5 text-center">
            <Shield size={12} className="mx-auto text-swu-accent-texto mb-0.5" />
            <p className="text-[8px] text-swu-muted">Esc.</p>
            <div className="flex items-center justify-center gap-0.5 mt-0.5">
              <button onClick={() => updatePlayer(idx, 'shields', Math.max(0, p.shields - 1))} className="text-swu-red-texto text-sm font-bold leading-none">−</button>
              <span className="text-base font-bold text-swu-accent-texto font-mono">{p.shields}</span>
              <button onClick={() => updatePlayer(idx, 'shields', p.shields + 1)} className="text-swu-green text-sm font-bold leading-none">+</button>
            </div>
          </div>

          <div className="bg-swu-bg rounded-lg p-1.5 text-center">
            <Sparkles size={12} className="mx-auto text-purple-400 mb-0.5" />
            <p className="text-[8px] text-swu-muted">XP</p>
            <div className="flex items-center justify-center gap-0.5 mt-0.5">
              <button onClick={() => updatePlayer(idx, 'experience', Math.max(0, p.experience - 1))} className="text-swu-red-texto text-sm font-bold leading-none">−</button>
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
      <div className="p-4 flex flex-col items-center justify-center gap-6" style={{ minHeight: 'calc(var(--app-vh, 100vh) - 52px - 64px)' }}>
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
      <div className="p-4 flex flex-col items-center justify-center gap-6" style={{ minHeight: 'calc(var(--app-vh, 100vh) - 52px - 64px)' }}>
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
        <button
          onClick={() => {
            const params = new URLSearchParams({
              p1: players[0]?.name || '',
              p2: players[1]?.name || '',
              mode,
              score: `${gameScore[0]}-${gameScore[1]}`,
              winner: String(gameScore[0] >= 2 ? 1 : 2),
            })
            navigate(`/arena/log?${params.toString()}`)
          }}
          className="w-full max-w-xs py-3 rounded-xl bg-swu-green/15 border border-swu-green/40 text-swu-green font-bold text-sm active:scale-95 transition-transform"
        >
          Registrar en Holocrón
        </button>
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
        <p className="text-[10px] text-swu-muted">{modeLabels[mode]} · {fechaCorta(new Date())}</p>
      </div>
    )
  }

  const is2Player = players.length <= 2

  return (
    <div className="p-2 flex flex-col gap-1.5" style={{ height: 'calc(var(--app-vh, 100vh) - 52px - 64px)' }}>
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
          <button onClick={resetGame} aria-label="Reiniciar el game" className="p-1.5 rounded-lg bg-swu-surface border border-swu-border text-swu-muted"><RotateCcw size={14} /></button>
          <button
            onClick={handleManualSave}
            aria-label={saveFlash ? 'Partida guardada' : 'Guardar partida'}
            className={`p-1.5 rounded-lg border transition-colors ${saveFlash ? 'bg-swu-green/20 border-swu-green/40 text-swu-green' : 'bg-swu-surface border-swu-border text-swu-muted'}`}
          >
            {saveFlash ? <Check size={14} /> : <Save size={14} />}
          </button>
        </div>
      </div>

      {is2Player ? (
        <>
          {/* eslint-disable-next-line react-hooks/static-components -- ver la nota en la definición de PlayerPanel */}
          <PlayerPanel idx={0} flipped={true} />
          <div className="flex gap-2">
            <button onClick={() => recordWin(0)} className="flex-1 py-1.5 rounded-lg bg-swu-accent/20 border border-swu-accent/40 text-swu-accent-texto font-bold text-xs active:scale-95 transition-transform">J1 Gana</button>
            <button onClick={() => setInitiative(initiative === 0 ? 1 : 0)} className="flex-[2] py-1.5 rounded-xl bg-gradient-to-r from-swu-amber/20 to-swu-amber/10 border-2 border-swu-amber/40 text-swu-amber font-bold text-xs tracking-wide active:scale-95 transition-transform">INICIATIVA</button>
            <button onClick={() => recordWin(1)} className="flex-1 py-1.5 rounded-lg bg-swu-red/20 border border-swu-red/40 text-swu-red-texto font-bold text-xs active:scale-95 transition-transform">J2 Gana</button>
          </div>
          {/* eslint-disable-next-line react-hooks/static-components -- ver la nota en la definición de PlayerPanel */}
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
              <button onClick={() => { setBasePickerFor(null); setBaseSearchQuery(''); setBaseResults([]); setUltimaBusqueda('') }} className="p-2 text-swu-muted"><X size={20} /></button>
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
              {resultadosVisibles.map((card) => (
                <button key={card.id} onClick={() => selectBase(card, basePickerFor)} className="w-full bg-swu-surface rounded-xl p-3 border border-swu-border flex items-center gap-3 text-left active:scale-[0.98] transition-transform">
                  {/* Las bases son SIEMPRE apaisadas (400x286): en una caja
                      vertical de 48x64 se recortaban al centro y quedaba un
                      fragmento irreconocible, justo en la pantalla donde hay
                      que elegir una. */}
                  <CardImage
                    src={card.imageUrl}
                    orientacion="apaisada"
                    fit="cover"
                    alt={card.name}
                    className="w-20 aspect-[400/286] flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-swu-text truncate">{card.name}</p>
                    {card.subtitle && <p className="text-xs text-swu-muted truncate">{card.subtitle}</p>}
                    <p className="text-xs text-swu-muted mt-0.5">{card.setCode} · HP: <span className="font-bold text-swu-accent-texto">{card.hp}</span></p>
                  </div>
                </button>
              ))}
            </div>
            {!baseSearching && baseSearchQuery && resultadosVisibles.length === 0 && <p className="text-xs text-swu-muted text-center py-4">No se encontraron bases</p>}
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

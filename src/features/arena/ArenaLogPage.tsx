import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Check, BookOpen } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { logMatch } from '../../services/arenaService'
import { db } from '../../services/db'
import type { GameMode, Deck } from '../../types'

const gameModes: { id: GameMode; label: string }[] = [
  { id: 'premier', label: 'Premier' },
  { id: 'twin_suns', label: 'Twin Suns' },
]

const quickScores: [number, number][] = [
  [2, 0],
  [2, 1],
  [0, 2],
  [1, 2],
]

export function ArenaLogPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { currentProfile } = useAuth()

  const [player1Name, setPlayer1Name] = useState(currentProfile?.name || 'Jugador 1')
  const [player2Name, setPlayer2Name] = useState('')
  const [mode, setMode] = useState<GameMode>('premier')
  const [winner, setWinner] = useState<1 | 2>(1)
  const [score, setScore] = useState<[number, number]>([2, 0])
  const [player1Deck, setPlayer1Deck] = useState('')
  const [player2Deck, setPlayer2Deck] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [decks, setDecks] = useState<Deck[]>([])

  // Load decks
  useEffect(() => {
    db.decks.toArray().then(setDecks)
  }, [])

  // Prefill from tracker
  useEffect(() => {
    const p1 = searchParams.get('p1')
    const p2 = searchParams.get('p2')
    const m = searchParams.get('mode')
    const s = searchParams.get('score')
    const w = searchParams.get('winner')
    if (p1) setPlayer1Name(p1)
    if (p2) setPlayer2Name(p2)
    if (m === 'premier' || m === 'twin_suns') setMode(m)
    if (s) {
      const parts = s.split('-').map(Number)
      if (parts.length === 2) setScore(parts as [number, number])
    }
    if (w === '1' || w === '2') setWinner(Number(w) as 1 | 2)
  }, [searchParams])

  // Auto-set winner from score
  useEffect(() => {
    if (score[0] > score[1]) setWinner(1)
    else if (score[1] > score[0]) setWinner(2)
  }, [score])

  const handleSave = async () => {
    if (!player2Name.trim()) return
    setSaving(true)
    try {
      await logMatch(
        {
          player1Name: player1Name.trim(),
          player2Name: player2Name.trim(),
          player1ProfileId: currentProfile?.id,
          player1DeckName: player1Deck || undefined,
          player2DeckName: player2Deck || undefined,
          gameMode: mode,
          winnerPlayer: winner,
          finalScore: score,
          notes: notes.trim() || undefined,
          recordedAt: Date.now(),
        },
        currentProfile?.id,
      )
      navigate('/arena', { replace: true })
    } catch (err) {
      console.error('Error saving match log:', err)
      setSaving(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 pb-8 lg:pb-8 max-w-xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/arena')} className="text-swu-muted">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h2 className="text-lg font-extrabold text-swu-text">Registrar Combate</h2>
          <p className="text-[10px] text-swu-muted font-mono tracking-wider">HOLOCRÓN DE DUELOS</p>
        </div>
      </div>

      {/* Player 1 */}
      <div className="bg-swu-surface rounded-xl p-4 border border-swu-accent/30 space-y-3">
        <p className="text-[10px] text-swu-accent font-mono font-bold tracking-widest">JUGADOR 1 (YO)</p>
        <input
          value={player1Name}
          onChange={(e) => setPlayer1Name(e.target.value)}
          className="w-full bg-swu-bg border border-swu-border rounded-lg px-3 py-2.5 text-sm text-swu-text outline-none focus:border-swu-accent"
          placeholder="Mi nombre"
        />
        <div>
          <p className="text-[10px] text-swu-muted mb-1.5">Deck (opcional)</p>
          {decks.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {decks.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setPlayer1Deck(player1Deck === d.name ? '' : d.name)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                    player1Deck === d.name
                      ? 'bg-swu-accent/20 border-swu-accent text-swu-accent'
                      : 'bg-swu-bg border-swu-border text-swu-muted'
                  }`}
                >
                  <BookOpen size={10} className="inline mr-1" />
                  {d.name}
                </button>
              ))}
              <input
                value={decks.some((d) => d.name === player1Deck) ? '' : player1Deck}
                onChange={(e) => setPlayer1Deck(e.target.value)}
                placeholder="O escribir nombre..."
                className="bg-swu-bg border border-swu-border rounded-lg px-3 py-1.5 text-xs text-swu-text outline-none focus:border-swu-accent w-40"
              />
            </div>
          ) : (
            <input
              value={player1Deck}
              onChange={(e) => setPlayer1Deck(e.target.value)}
              placeholder="Nombre del deck..."
              className="w-full bg-swu-bg border border-swu-border rounded-lg px-3 py-2.5 text-sm text-swu-text outline-none focus:border-swu-accent"
            />
          )}
        </div>
      </div>

      {/* Player 2 */}
      <div className="bg-swu-surface rounded-xl p-4 border border-swu-red/30 space-y-3">
        <p className="text-[10px] text-swu-red font-mono font-bold tracking-widest">JUGADOR 2 (OPONENTE)</p>
        <input
          value={player2Name}
          onChange={(e) => setPlayer2Name(e.target.value)}
          className="w-full bg-swu-bg border border-swu-border rounded-lg px-3 py-2.5 text-sm text-swu-text outline-none focus:border-swu-accent"
          placeholder="Nombre del oponente"
        />
        <div>
          <p className="text-[10px] text-swu-muted mb-1.5">Deck (opcional)</p>
          <input
            value={player2Deck}
            onChange={(e) => setPlayer2Deck(e.target.value)}
            placeholder="Deck del oponente..."
            className="w-full bg-swu-bg border border-swu-border rounded-lg px-3 py-2.5 text-sm text-swu-text outline-none focus:border-swu-accent"
          />
        </div>
      </div>

      {/* Game Mode */}
      <div>
        <p className="text-[10px] text-swu-muted font-mono font-bold tracking-widest mb-2">MODO DE JUEGO</p>
        <div className="flex gap-2">
          {gameModes.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition-colors ${
                mode === m.id
                  ? 'bg-swu-amber/15 border-swu-amber text-swu-amber'
                  : 'bg-swu-surface border-swu-border text-swu-muted'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Score */}
      <div>
        <p className="text-[10px] text-swu-muted font-mono font-bold tracking-widest mb-2">RESULTADO</p>
        <div className="grid grid-cols-4 gap-2">
          {quickScores.map(([s1, s2]) => {
            const isSelected = score[0] === s1 && score[1] === s2
            const isWin = s1 > s2
            return (
              <button
                key={`${s1}-${s2}`}
                onClick={() => setScore([s1, s2])}
                className={`py-3 rounded-xl border text-center font-extrabold text-lg transition-colors ${
                  isSelected
                    ? isWin
                      ? 'bg-swu-green/15 border-swu-green text-swu-green'
                      : 'bg-swu-red/15 border-swu-red text-swu-red'
                    : 'bg-swu-surface border-swu-border text-swu-muted'
                }`}
              >
                {s1}-{s2}
              </button>
            )
          })}
        </div>
      </div>

      {/* Winner override */}
      <div>
        <p className="text-[10px] text-swu-muted font-mono font-bold tracking-widest mb-2">GANADOR</p>
        <div className="flex gap-2">
          <button
            onClick={() => setWinner(1)}
            className={`flex-1 py-3 rounded-xl border font-bold text-sm transition-colors ${
              winner === 1
                ? 'bg-swu-green/15 border-swu-green text-swu-green'
                : 'bg-swu-surface border-swu-border text-swu-muted'
            }`}
          >
            {player1Name || 'J1'} Gana
          </button>
          <button
            onClick={() => setWinner(2)}
            className={`flex-1 py-3 rounded-xl border font-bold text-sm transition-colors ${
              winner === 2
                ? 'bg-swu-red/15 border-swu-red text-swu-red'
                : 'bg-swu-surface border-swu-border text-swu-muted'
            }`}
          >
            {player2Name || 'J2'} Gana
          </button>
        </div>
      </div>

      {/* Notes */}
      <div>
        <p className="text-[10px] text-swu-muted font-mono font-bold tracking-widest mb-2">NOTAS (OPCIONAL)</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Notas sobre la partida..."
          className="w-full bg-swu-surface border border-swu-border rounded-xl px-3 py-2.5 text-sm text-swu-text outline-none focus:border-swu-accent resize-none"
        />
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving || !player2Name.trim()}
        className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
          player2Name.trim()
            ? 'bg-swu-accent text-white active:scale-[0.98]'
            : 'bg-swu-surface border border-swu-border text-swu-muted cursor-not-allowed'
        }`}
      >
        {saving ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Check size={18} />
            Registrar en Holocrón
          </>
        )}
      </button>
    </div>
  )
}

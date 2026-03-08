import { useState } from 'react'
import { ChevronLeft, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, RotateCcw, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const diceIcons = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6]

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function UtilitiesPage() {
  const navigate = useNavigate()

  // Dice roller
  const [diceCount, setDiceCount] = useState(1)
  const [diceResults, setDiceResults] = useState<number[]>([])
  const [diceRolling, setDiceRolling] = useState(false)
  const diceTotal = diceResults.reduce((a, b) => a + b, 0)

  // Coin flip
  const [coinResult, setCoinResult] = useState<'heads' | 'tails' | null>(null)
  const [coinFlipping, setCoinFlipping] = useState(false)

  // Initiative
  const [initPlayers, setInitPlayers] = useState(['Jugador 1', 'Jugador 2'])
  const [initWinner, setInitWinner] = useState<string | null>(null)
  const [initRolling, setInitRolling] = useState(false)

  // Aspect penalty calculator
  const [penaltyAspects, setPenaltyAspects] = useState(0)

  const rollDice = () => {
    setDiceRolling(true)
    // Animate
    let count = 0
    const interval = setInterval(() => {
      setDiceResults(Array.from({ length: diceCount }, () => randomInt(1, 6)))
      count++
      if (count >= 8) {
        clearInterval(interval)
        setDiceRolling(false)
      }
    }, 80)
  }

  const flipCoin = () => {
    setCoinFlipping(true)
    let count = 0
    const interval = setInterval(() => {
      setCoinResult(Math.random() > 0.5 ? 'heads' : 'tails')
      count++
      if (count >= 10) {
        clearInterval(interval)
        setCoinFlipping(false)
      }
    }, 80)
  }

  const rollInitiative = () => {
    if (initPlayers.filter((p) => p.trim()).length < 2) return
    setInitRolling(true)
    const valid = initPlayers.filter((p) => p.trim())
    let count = 0
    const interval = setInterval(() => {
      setInitWinner(valid[randomInt(0, valid.length - 1)])
      count++
      if (count >= 12) {
        clearInterval(interval)
        setInitRolling(false)
      }
    }, 80)
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 pb-24 lg:pb-8 max-w-5xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-swu-muted">
        <ChevronLeft size={18} /> Volver
      </button>

      <h2 className="text-lg font-bold text-swu-text">Utilidades</h2>

      {/* DICE ROLLER */}
      <div className="bg-swu-surface rounded-2xl border border-swu-border p-4 space-y-3">
        <h3 className="text-sm font-bold text-swu-text flex items-center gap-2">
          <Dice6 size={18} className="text-swu-accent" /> Dados
        </h3>

        <div className="flex items-center gap-3">
          <span className="text-xs text-swu-muted">Cantidad:</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => { setDiceCount(n); setDiceResults([]) }}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                  diceCount === n ? 'bg-swu-accent text-white' : 'bg-swu-bg text-swu-muted border border-swu-border'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {diceResults.length > 0 && (
          <div className="flex items-center justify-center gap-3 py-3">
            {diceResults.map((r, i) => {
              const DIcon = diceIcons[r - 1]
              return (
                <div key={i} className={`transition-transform ${diceRolling ? 'animate-bounce' : ''}`}>
                  <DIcon size={48} className="text-swu-accent" />
                </div>
              )
            })}
          </div>
        )}

        {diceResults.length > 1 && !diceRolling && (
          <p className="text-center text-sm text-swu-muted">
            Total: <span className="font-extrabold text-swu-accent text-lg">{diceTotal}</span>
          </p>
        )}

        <button
          onClick={rollDice}
          disabled={diceRolling}
          className="w-full py-3 rounded-xl bg-swu-accent text-white font-bold text-sm active:scale-[0.97] transition-transform disabled:opacity-50"
        >
          {diceRolling ? 'Tirando...' : `Tirar ${diceCount > 1 ? `${diceCount} dados` : 'dado'}`}
        </button>
      </div>

      {/* COIN FLIP */}
      <div className="bg-swu-surface rounded-2xl border border-swu-border p-4 space-y-3">
        <h3 className="text-sm font-bold text-swu-text flex items-center gap-2">
          <RotateCcw size={18} className="text-swu-amber" /> Moneda
        </h3>

        {coinResult && (
          <div className="flex justify-center py-4">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center text-2xl font-extrabold border-4 transition-transform ${
              coinFlipping ? 'animate-spin' : ''
            } ${
              coinResult === 'heads'
                ? 'bg-swu-amber/20 border-swu-amber text-swu-amber'
                : 'bg-swu-accent/20 border-swu-accent text-swu-accent'
            }`}>
              {coinResult === 'heads' ? 'CARA' : 'CRUZ'}
            </div>
          </div>
        )}

        <button
          onClick={flipCoin}
          disabled={coinFlipping}
          className="w-full py-3 rounded-xl bg-swu-amber text-black font-bold text-sm active:scale-[0.97] transition-transform disabled:opacity-50"
        >
          {coinFlipping ? 'Volteando...' : 'Lanzar Moneda'}
        </button>
      </div>

      {/* INITIATIVE RANDOMIZER */}
      <div className="bg-swu-surface rounded-2xl border border-swu-border p-4 space-y-3">
        <h3 className="text-sm font-bold text-swu-text flex items-center gap-2">
          <Zap size={18} className="text-swu-green" /> Iniciativa Aleatoria
        </h3>

        <div className="space-y-2">
          {initPlayers.map((p, i) => (
            <input
              key={i}
              value={p}
              onChange={(e) => setInitPlayers((prev) => prev.map((pp, ii) => (ii === i ? e.target.value : pp)))}
              placeholder={`Jugador ${i + 1}`}
              className="w-full bg-swu-bg border border-swu-border rounded-lg px-3 py-2 text-sm text-swu-text placeholder:text-swu-muted/50"
            />
          ))}
        </div>

        {initWinner && (
          <div className={`text-center py-3 rounded-xl ${initRolling ? 'animate-pulse' : ''} bg-swu-green/10 border border-swu-green/30`}>
            <p className="text-xs text-swu-muted">Iniciativa para:</p>
            <p className="text-xl font-extrabold text-swu-green">{initWinner}</p>
          </div>
        )}

        <button
          onClick={rollInitiative}
          disabled={initRolling}
          className="w-full py-3 rounded-xl bg-swu-green text-white font-bold text-sm active:scale-[0.97] transition-transform disabled:opacity-50"
        >
          {initRolling ? 'Eligiendo...' : 'Sortear Iniciativa'}
        </button>
      </div>

      {/* ASPECT PENALTY CALCULATOR */}
      <div className="bg-swu-surface rounded-2xl border border-swu-border p-4 space-y-3">
        <h3 className="text-sm font-bold text-swu-text flex items-center gap-2">
          <span className="text-swu-red text-lg">⚠</span> Penalidad por Aspectos
        </h3>
        <p className="text-xs text-swu-muted">
          Cada aspecto faltante en tu Leader/Base agrega +2 al costo de la carta.
        </p>

        <div className="flex items-center gap-3">
          <span className="text-xs text-swu-muted">Aspectos faltantes:</span>
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => setPenaltyAspects(n)}
                className={`w-10 h-10 rounded-lg text-sm font-bold transition-colors ${
                  penaltyAspects === n ? 'bg-swu-red text-white' : 'bg-swu-bg text-swu-muted border border-swu-border'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-swu-bg rounded-xl p-4 text-center">
          <p className="text-xs text-swu-muted">Penalidad al costo</p>
          <p className="text-4xl font-extrabold font-mono text-swu-red">
            +{penaltyAspects * 2}
          </p>
          {penaltyAspects > 0 && (
            <p className="text-[10px] text-swu-muted mt-1">
              Una carta de costo 3 costaría <span className="text-swu-text font-bold">{3 + penaltyAspects * 2}</span> recursos
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

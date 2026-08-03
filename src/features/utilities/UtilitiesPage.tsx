/**
 * Utilidades — lo que hace falta en la mesa.
 *
 * Dados en 3D, moneda e iniciativa, con la estética de consola del Centro de
 * Mando (los paneles y octágonos viven en components/Hud.tsx).
 *
 * ── El azar y la animación son cosas separadas ────────────────────────
 *
 * El resultado se sortea con `Math.random()` y recién después se anima. Al
 * revés —dejar que lo decida la simulación— la tirada dependería del motor 3D,
 * y un móvil lento o un fotograma perdido cambiarían el número. Acá el 3D es
 * cómo se muestra, no de dónde sale.
 */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Dice6, Coins, Zap, RotateCcw, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { HudPanel, HudCorners, HexIcon } from '../../components/Hud'
import { Dice3D } from './Dice3D'
import { Coin3D, type Lado } from './Coin3D'

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function Seccion({
  titulo, icono, tono, children,
}: {
  titulo: string
  icono: React.ReactNode
  tono: 'cyan' | 'amber' | 'green'
  children: React.ReactNode
}) {
  return (
    <HudPanel tone={tono} glow>
      <div className="relative p-3.5 space-y-3">
        <HudCorners tone={tono} />
        <div className="flex items-center gap-2.5">
          <HexIcon tone={tono} size={36}>{icono}</HexIcon>
          <h2 className="text-sm font-bold text-white tracking-wide">{titulo}</h2>
        </div>
        {children}
      </div>
    </HudPanel>
  )
}

export function UtilitiesPage() {
  const navigate = useNavigate()

  // ── Dados ──
  const [cantidad, setCantidad] = useState(1)
  const [resultados, setResultados] = useState<number[]>([])
  /** Cambia en cada tirada: sin esto, sacar dos veces lo mismo no se animaba. */
  const [tirada, setTirada] = useState(0)
  const total = resultados.reduce((a, b) => a + b, 0)

  const tirar = useCallback(() => {
    setResultados(Array.from({ length: cantidad }, () => randomInt(1, 6)))
    setTirada(t => t + 1)
    navigator.vibrate?.(40)
  }, [cantidad])

  // ── Moneda ──
  const [moneda, setMoneda] = useState<Lado | null>(null)
  const [lanzamiento, setLanzamiento] = useState(0)
  const [girando, setGirando] = useState(false)

  const lanzar = () => {
    // El lado se decide ACÁ y la animación lo muestra: el 3D no elige nada.
    setMoneda(Math.random() < 0.5 ? 'cara' : 'cruz')
    setLanzamiento(n => n + 1)
    setGirando(true)
    navigator.vibrate?.(40)
    // El rótulo se revela recién al aterrizar; verlo antes arruina el lanzamiento.
    window.setTimeout(() => setGirando(false), 1400)
  }

  // ── Iniciativa ──
  const [jugadores, setJugadores] = useState(['', ''])
  const [ganador, setGanador] = useState<string | null>(null)
  const [sorteando, setSorteando] = useState(false)

  const validos = jugadores.map(p => p.trim()).filter(Boolean)

  const sortear = () => {
    if (validos.length < 2) return
    setSorteando(true)
    const elegido = validos[randomInt(0, validos.length - 1)]
    let i = 0
    const id = window.setInterval(() => {
      setGanador(validos[i % validos.length])
      i++
      if (i >= 14) {
        window.clearInterval(id)
        setGanador(elegido)
        setSorteando(false)
        navigator.vibrate?.(60)
      }
    }, 90)
  }

  return (
    <div className="min-h-screen bg-swu-bg pb-8">
      <div className="sticky top-0 z-40 bg-swu-bg/95 backdrop-blur border-b border-swu-border">
        <div className="max-w-lg lg:max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-swu-muted" aria-label="Atrás">
            <ArrowLeft size={20} aria-hidden />
          </button>
          <h1 className="text-lg font-bold text-swu-text flex-1">Utilidades</h1>
        </div>
      </div>

      <div className="max-w-lg lg:max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* ── Dados ── */}
        <Seccion titulo="DADOS" icono={<Dice6 size={17} />} tono="cyan">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono uppercase tracking-wider text-swu-muted">Cuántos</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  onClick={() => { setCantidad(n); setResultados([]) }}
                  aria-pressed={cantidad === n}
                  className={`w-8 h-8 rounded-lg text-xs font-mono font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-cyan ${
                    cantidad === n
                      ? 'bg-swu-cyan/20 text-swu-cyan border border-swu-cyan'
                      : 'bg-swu-bg text-swu-muted border border-swu-border'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-swu-bg border border-swu-border overflow-hidden">
            <Dice3D valores={resultados} tirada={tirada} className="h-40" />
            {resultados.length === 0 && (
              <p className="text-center text-[11px] text-swu-muted pb-3 -mt-3">
                Tocá «Tirar» para lanzar {cantidad === 1 ? 'el dado' : `los ${cantidad} dados`}
              </p>
            )}
          </div>

          {resultados.length > 0 && (
            <div className="flex items-center justify-center gap-3 flex-wrap" aria-live="polite">
              <div className="flex gap-1.5">
                {resultados.map((r, i) => (
                  <span
                    key={i}
                    className="w-8 h-8 rounded-lg border border-swu-cyan/40 bg-swu-cyan/10 flex items-center justify-center font-mono font-bold text-swu-cyan"
                  >
                    {r}
                  </span>
                ))}
              </div>
              {resultados.length > 1 && (
                <span className="text-sm font-mono text-swu-muted">
                  Total <span className="text-lg font-extrabold text-swu-cyan">{total}</span>
                </span>
              )}
            </div>
          )}

          <Button block onClick={tirar}>
            <RotateCcw size={15} aria-hidden /> Tirar
          </Button>
        </Seccion>

        {/* ── Moneda ── */}
        <Seccion titulo="MONEDA" icono={<Coins size={17} />} tono="amber">
          <div className="rounded-xl bg-swu-bg border border-swu-border overflow-hidden">
            <Coin3D lado={moneda} lanzamiento={lanzamiento} className="h-36" />
          </div>
          <p className="text-center text-sm font-extrabold tracking-wide text-swu-amber h-5" aria-live="polite">
            {girando ? '' : moneda ? (moneda === 'cara' ? 'CARA' : 'CRUZ') : ''}
          </p>
          <Button block variant="secondary" onClick={lanzar} loading={girando}>
            Lanzar
          </Button>
        </Seccion>

        {/* ── Iniciativa ── */}
        <Seccion titulo="INICIATIVA" icono={<Zap size={17} />} tono="green">
          <div className="space-y-1.5">
            {jugadores.map((p, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={p}
                  onChange={e => setJugadores(l => l.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={`Jugador ${i + 1}`}
                  aria-label={`Nombre del jugador ${i + 1}`}
                  className="flex-1 min-w-0 bg-swu-bg border border-swu-border rounded-lg px-3 py-2 text-sm text-swu-text outline-none focus:border-swu-green"
                />
                {jugadores.length > 2 && (
                  <button
                    onClick={() => setJugadores(l => l.filter((_, j) => j !== i))}
                    aria-label={`Quitar jugador ${i + 1}`}
                    className="w-9 rounded-lg border border-swu-border text-swu-muted flex items-center justify-center"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                )}
              </div>
            ))}
          </div>

          {jugadores.length < 8 && (
            <Button size="sm" variant="ghost" onClick={() => setJugadores(l => [...l, ''])}>
              <Plus size={13} aria-hidden /> Agregar jugador
            </Button>
          )}

          {ganador && (
            <div
              className={`text-center py-2 rounded-lg border ${
                sorteando
                  ? 'border-swu-border text-swu-muted'
                  : 'border-swu-green/40 bg-swu-green/10 text-swu-green'
              }`}
              aria-live="polite"
            >
              <p className="text-[10px] font-mono uppercase tracking-wider opacity-70">
                {sorteando ? 'Sorteando' : 'Empieza'}
              </p>
              <p className="text-base font-extrabold">{ganador}</p>
            </div>
          )}

          <Button block variant="secondary" onClick={sortear} disabled={validos.length < 2} loading={sorteando}>
            Sortear iniciativa
          </Button>
          {validos.length < 2 && (
            <p className="text-[11px] text-swu-muted text-center">
              Escribí al menos dos nombres.
            </p>
          )}
        </Seccion>
      </div>
    </div>
  )
}

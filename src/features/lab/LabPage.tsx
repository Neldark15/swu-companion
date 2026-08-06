/**
 * Laboratorio de mazos — la mesa de pruebas contra el meta real.
 *
 * Manda un mazo al simulador del VPS (swusim: las 1 324 cartas del Premier
 * modeladas, reglamento oficial implementado) y lo enfrenta a los 22 mazos
 * reales del Galactic Championship 2026. Tres herramientas: el informe de
 * legalidad y sinergias, el guantelete contra todo el campo, y el probador
 * de cambios («quita esto, mete aquello, ¿gano o pierdo puntos?»).
 *
 * ── El encuadre no es decorativo ──────────────────────────────────────
 *
 * Contrastado contra los resultados reales del Galactic, el simulador se
 * desvía en promedio ±11 puntos. Un 65 % aquí NO significa ganar 6,5 de cada
 * 10 en una sala. Significa que ese mazo mide por encima de otro bajo las
 * mismas reglas y el mismo rival. Por eso cada número de esta pantalla se
 * presenta como COMPARACIÓN (contra el campeón, contra tu versión anterior)
 * y el aviso vive en el encabezado, no escondido en una nota al pie.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, FlaskConical, ShieldCheck, Swords, Scale,
  AlertTriangle, CheckCircle2, Loader2, ClipboardPaste, BookOpen,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { HudPanel, HudCorners, HexIcon } from '../../components/Hud'
import { db } from '../../services/db'
import type { Deck } from '../../types'
import {
  simApi, deckAMazo, ErrorSim,
  type MazoEnvio, type InformeValidar, type EstadoTrabajo,
} from './simApi'

/**
 * Referencias medidas en el MISMO motor (gauntlet completo): el campeón y el
 * subcampeón del Galactic. Son la vara de comparación honesta: si tu mazo
 * marca 60 y el campeón marca 49, eso es señal; el número absoluto no lo es.
 */
const REFERENCIAS = [
  { nombre: 'Cad Bane — campeón Galactic', media: 49.0 },
  { nombre: 'Boba Fett — subcampeón', media: 48.9 },
]

type Fuente = 'guardado' | 'pegado'

function Seccion({ titulo, icono, tono, children }: {
  titulo: string
  icono: React.ReactNode
  tono: 'cyan' | 'amber' | 'green' | 'purple'
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

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-start text-[11px] leading-relaxed text-swu-muted bg-swu-surface rounded-lg p-2.5 border border-swu-border">
      <AlertTriangle size={14} className="text-swu-amber flex-shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  )
}

/** Barra horizontal 0–100 con la línea del 50 % como referencia. */
function BarraWin({ etiqueta, valor, destacada }: { etiqueta: string; valor: number; destacada?: boolean }) {
  const color = destacada ? 'bg-swu-amber' : valor >= 55 ? 'bg-swu-green' : valor >= 45 ? 'bg-swu-cyan' : 'bg-swu-red'
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2 items-center text-xs">
      <div>
        <div className={`truncate ${destacada ? 'text-swu-amber font-semibold' : 'text-swu-text'}`}>{etiqueta}</div>
        <div className="relative h-2 mt-1 rounded bg-swu-surface overflow-hidden">
          <div className={`absolute inset-y-0 left-0 rounded ${color}`} style={{ width: `${Math.min(valor, 100)}%` }} />
          <div className="absolute inset-y-0 left-1/2 w-px bg-swu-muted/50" title="50 %" />
        </div>
      </div>
      <span className="font-mono tabular-nums text-right text-swu-text">{valor.toFixed(1)}</span>
    </div>
  )
}

export function LabPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  // ── fuente del mazo ──
  const [fuente, setFuente] = useState<Fuente>('guardado')
  const [mazos, setMazos] = useState<Deck[]>([])
  const [mazoId, setMazoId] = useState<string>('')
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)

  // ── resultados ──
  const [informe, setInforme] = useState<InformeValidar | null>(null)
  const [validando, setValidando] = useState(false)
  const [trabajo, setTrabajo] = useState<EstadoTrabajo | null>(null)
  const [corriendo, setCorriendo] = useState(false)
  const idTrabajo = useRef<string | null>(null)

  // ── probador de cambios ──
  const [quitaCarta, setQuitaCarta] = useState('')
  const [quitaN, setQuitaN] = useState(1)
  const [meteCarta, setMeteCarta] = useState('')
  const [meteN, setMeteN] = useState(1)
  const [prueba, setPrueba] = useState<{ antes: number; despues: number; delta: number } | null>(null)
  const [probando, setProbando] = useState(false)

  useEffect(() => {
    db.decks.toArray().then((todos) => {
      const orden = todos.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      setMazos(orden)
      const pedido = params.get('deck')
      if (pedido && orden.some((d) => d.id === pedido)) setMazoId(pedido)
      else if (orden.length > 0) setMazoId(orden[0].id)
      else setFuente('pegado')
    }).catch(() => setFuente('pegado'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** El mazo elegido, en el formato que viaja al simulador. */
  const armarMazo = useCallback((): MazoEnvio => {
    if (fuente === 'pegado') {
      if (!texto.trim()) throw new ErrorSim('Pega una lista primero.')
      return { texto }
    }
    const deck = mazos.find((d) => d.id === mazoId)
    if (!deck) throw new ErrorSim('Elige un mazo guardado.')
    return deckAMazo(deck)
  }, [fuente, texto, mazos, mazoId])

  const validar = useCallback(async () => {
    setError(null); setInforme(null); setValidando(true)
    try {
      setInforme(await simApi.validar(armarMazo()))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fallo inesperado.')
    } finally {
      setValidando(false)
    }
  }, [armarMazo])

  // ── guantelete con sondeo ──
  const lanzarGauntlet = useCallback(async () => {
    setError(null); setTrabajo(null); setCorriendo(true)
    try {
      const { trabajo: id } = await simApi.gauntlet(armarMazo(), 400)
      idTrabajo.current = id
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fallo inesperado.')
      setCorriendo(false)
    }
  }, [armarMazo])

  useEffect(() => {
    if (!corriendo || !idTrabajo.current) return
    const timer = setInterval(async () => {
      try {
        const estado = await simApi.trabajo(idTrabajo.current as string)
        setTrabajo(estado)
        if (estado.estado === 'listo' || estado.estado === 'error') {
          setCorriendo(false)
          if (estado.estado === 'error') setError(estado.error || 'El guantelete falló.')
        }
      } catch {
        // un fallo de red en un sondeo no cancela el trabajo: se reintenta solo
      }
    }, 2500)
    return () => clearInterval(timer)
  }, [corriendo])

  const probar = useCallback(async () => {
    setError(null); setPrueba(null); setProbando(true)
    try {
      const quita = quitaCarta ? [`${quitaN}x ${quitaCarta}`] : []
      const mete = meteCarta.trim() ? [`${meteN}x ${meteCarta.trim()}`] : []
      if (quita.length === 0 && mete.length === 0) {
        throw new ErrorSim('Indica al menos un cambio: qué quitar o qué meter.')
      }
      setPrueba(await simApi.probar(armarMazo(), quita, mete, 800))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fallo inesperado.')
    } finally {
      setProbando(false)
    }
  }, [armarMazo, quitaCarta, quitaN, meteCarta, meteN])

  const deckActual = fuente === 'guardado' ? mazos.find((d) => d.id === mazoId) : undefined
  const curvaMax = informe ? Math.max(1, ...Object.values(informe.curva)) : 1
  const listo = trabajo?.estado === 'listo'

  return (
    <div className="max-w-2xl mx-auto px-3 pb-24 pt-4 space-y-4">
      {/* ── encabezado ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Volver"
          className="p-2 rounded-lg bg-swu-surface hover:bg-swu-surface-hover text-swu-muted">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <FlaskConical size={18} className="text-swu-cyan" /> Laboratorio de mazos
          </h1>
          <p className="text-[11px] text-swu-muted leading-snug">
            Simulación contra los 22 mazos reales del Galactic 2026
          </p>
        </div>
      </div>

      <Aviso>
        Los números de esta pantalla sirven para <b className="text-swu-text">comparar mazos entre
        sí</b> bajo las mismas reglas — no predicen tu win rate en torneo. Contrastado con los
        resultados reales del Galactic, el simulador se desvía en promedio ±11 puntos.
      </Aviso>

      {/* ── 1 · el mazo ── */}
      <Seccion titulo="El mazo" icono={<BookOpen size={16} />} tono="cyan">
        <div className="flex gap-2">
          <Button size="xs" variant={fuente === 'guardado' ? 'primary' : 'secondary'}
            onClick={() => setFuente('guardado')} disabled={mazos.length === 0}>
            <BookOpen size={13} /> Guardados
          </Button>
          <Button size="xs" variant={fuente === 'pegado' ? 'primary' : 'secondary'}
            onClick={() => setFuente('pegado')}>
            <ClipboardPaste size={13} /> Pegar lista
          </Button>
        </div>

        {fuente === 'guardado' ? (
          <select value={mazoId} onChange={(e) => { setMazoId(e.target.value); setInforme(null); setTrabajo(null); setPrueba(null) }}
            className="w-full bg-swu-surface border border-swu-border rounded-lg px-3 py-2 text-sm text-swu-text">
            {mazos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} — {d.leaders[0]?.name ?? 'sin líder'}
              </option>
            ))}
          </select>
        ) : (
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6}
            placeholder={'Leader: Luke Skywalker | I Can Save Him\nBase: Data Vault\n3x Red Squadron X-Wing\n…'}
            className="w-full bg-swu-surface border border-swu-border rounded-lg px-3 py-2 text-xs font-mono text-swu-text placeholder:text-swu-muted/60" />
        )}

        <Button variant="primary" size="sm" block onClick={validar} loading={validando}>
          <ShieldCheck size={14} /> Analizar el mazo
        </Button>
      </Seccion>

      {error && (
        <div className="flex gap-2 items-start text-xs text-swu-red bg-swu-red/10 border border-swu-red/30 rounded-lg p-3">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* ── 2 · informe ── */}
      {informe && (
        <Seccion titulo="Informe" icono={informe.legal ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          tono={informe.legal ? 'green' : 'amber'}>
          <div className="flex items-center gap-2 text-sm">
            {informe.legal
              ? <span className="text-swu-green font-semibold">Legal en Premier</span>
              : <span className="text-swu-amber font-semibold">Con problemas</span>}
            <span className="text-swu-muted text-xs">
              · {informe.total}/{informe.minimo} cartas · {informe.aspectos_disponibles.join(' + ')}
            </span>
          </div>

          {informe.problemas.map((p) => (
            <div key={p} className="text-xs text-swu-amber">• {p}</div>
          ))}
          {informe.penalizaciones.map((p) => (
            <div key={p.carta} className="text-xs text-swu-amber">
              • {p.carta}: fuera de aspecto ({p.aspectos.join(', ')}) → paga +{p.sobrecoste}
            </div>
          ))}

          {/* curva */}
          <div className="flex items-end gap-1.5 h-20 pt-1" aria-label="Curva de coste">
            {Object.entries(informe.curva).map(([coste, n]) => (
              <div key={coste} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                <span className="text-[10px] font-mono text-swu-text">{n}</span>
                <div className="w-full rounded-t bg-swu-cyan/70" style={{ height: `${(n / curvaMax) * 100}%`, minHeight: 2 }} />
                <span className="text-[10px] font-mono text-swu-muted">{coste}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            {[
              ['Unidades', informe.unidades], ['Eventos', informe.eventos], ['Mejoras', informe.mejoras],
              ['Sentinel', informe.sentinel], ['Únicas 4+', informe.unicas_coste4], ['Mínimo', informe.minimo],
            ].map(([k, v]) => (
              <div key={k as string} className="bg-swu-surface rounded-lg py-1.5">
                <div className="text-swu-muted">{k}</div>
                <div className="font-mono font-bold text-swu-text">{v}</div>
              </div>
            ))}
          </div>

          {informe.sinergias && informe.sinergias.huerfanas.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-swu-text">Sinergias sin apoyo</div>
              {informe.sinergias.huerfanas.map((h) => (
                <div key={`${h.carta}-${h.pide}`} className="text-[11px] text-swu-muted">
                  • {h.copias}x <span className="text-swu-text">{h.carta}</span> pide{' '}
                  <span className="font-mono">{h.pide}</span> (hay {h.hay}, suele bastar con ~{h.umbral})
                </div>
              ))}
              <Aviso>{informe.sinergias.aviso}</Aviso>
            </div>
          )}
        </Seccion>
      )}

      {/* ── 3 · guantelete ── */}
      {informe && (
        <Seccion titulo="Guantelete contra el meta" icono={<Swords size={16} />} tono="amber">
          {!trabajo && !corriendo && (
            <p className="text-xs text-swu-muted leading-relaxed">
              22 emparejamientos × 400 partidas cada uno. Tarda alrededor de medio minuto.
            </p>
          )}
          <Button variant="primary" size="sm" block onClick={lanzarGauntlet} loading={corriendo && !trabajo}>
            <Swords size={14} /> {listo ? 'Volver a correr' : 'Correr el guantelete'}
          </Button>

          {corriendo && trabajo && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-swu-muted">
                <Loader2 size={13} className="animate-spin text-swu-amber" />
                {trabajo.hechos} de {trabajo.total} emparejamientos
              </div>
              <div className="h-2 rounded bg-swu-surface overflow-hidden">
                <div className="h-full bg-swu-amber rounded transition-all"
                  style={{ width: `${(trabajo.hechos / Math.max(trabajo.total, 1)) * 100}%` }} />
              </div>
            </div>
          )}

          {listo && trabajo && (
            <div className="space-y-3">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-black text-swu-amber font-mono tabular-nums">
                  {trabajo.media?.toFixed(1)}<span className="text-lg">%</span>
                </span>
                <span className="text-[11px] text-swu-muted leading-tight">
                  promedio simulado<br />contra el campo
                </span>
              </div>

              {/* la vara de comparar: el podio real medido en el mismo motor */}
              <div className="space-y-1.5 border-b border-swu-border pb-2.5">
                {REFERENCIAS.map((r) => <BarraWin key={r.nombre} etiqueta={r.nombre} valor={r.media} destacada />)}
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {trabajo.resultados.map((r) => (
                  <BarraWin key={r.rival} etiqueta={r.lider ? r.lider.split(' | ')[0] : r.rival} valor={r.win} />
                ))}
              </div>
            </div>
          )}
        </Seccion>
      )}

      {/* ── 4 · probador de cambios ── */}
      {informe && (
        <Seccion titulo="Probar un cambio" icono={<Scale size={16} />} tono="purple">
          <p className="text-xs text-swu-muted leading-relaxed">
            Mide el mazo con y sin el cambio contra el campeón del Galactic (800 partidas por lado)
            y te dice cuántos puntos gana o pierde. Esta es la comparación más fiable del laboratorio:
            mismo rival, mismas reglas, misma semilla.
          </p>

          <div className="space-y-2">
            <div className="flex gap-2">
              <select value={quitaN} onChange={(e) => setQuitaN(Number(e.target.value))}
                className="w-14 bg-swu-surface border border-swu-border rounded-lg px-1 py-2 text-xs text-swu-text">
                {[1, 2, 3].map((n) => <option key={n} value={n}>−{n}</option>)}
              </select>
              <select value={quitaCarta} onChange={(e) => setQuitaCarta(e.target.value)}
                className="flex-1 min-w-0 bg-swu-surface border border-swu-border rounded-lg px-2 py-2 text-xs text-swu-text">
                <option value="">(no quitar nada)</option>
                {(deckActual?.mainDeck ?? []).map((c) => {
                  const n = c.subtitle ? `${c.name} | ${c.subtitle}` : c.name
                  return <option key={n} value={n}>{n}</option>
                })}
              </select>
            </div>
            <div className="flex gap-2">
              <select value={meteN} onChange={(e) => setMeteN(Number(e.target.value))}
                className="w-14 bg-swu-surface border border-swu-border rounded-lg px-1 py-2 text-xs text-swu-text">
                {[1, 2, 3].map((n) => <option key={n} value={n}>+{n}</option>)}
              </select>
              <input value={meteCarta} onChange={(e) => setMeteCarta(e.target.value)}
                placeholder="Carta a meter (nombre o id SWUDB)"
                className="flex-1 min-w-0 bg-swu-surface border border-swu-border rounded-lg px-2 py-2 text-xs text-swu-text placeholder:text-swu-muted/60" />
            </div>
          </div>

          <Button variant="primary" size="sm" block onClick={probar} loading={probando}>
            <Scale size={14} /> Medir el cambio
          </Button>

          {prueba && (
            <div className="flex items-center justify-center gap-4 py-1">
              <div className="text-center">
                <div className="text-[10px] text-swu-muted uppercase tracking-wider">antes</div>
                <div className="font-mono text-lg text-swu-text tabular-nums">{prueba.antes.toFixed(1)}%</div>
              </div>
              <div className={`text-2xl font-black font-mono tabular-nums ${
                prueba.delta > 0.5 ? 'text-swu-green' : prueba.delta < -0.5 ? 'text-swu-red' : 'text-swu-muted'}`}>
                {prueba.delta > 0 ? '+' : ''}{prueba.delta.toFixed(1)}
              </div>
              <div className="text-center">
                <div className="text-[10px] text-swu-muted uppercase tracking-wider">después</div>
                <div className="font-mono text-lg text-swu-text tabular-nums">{prueba.despues.toFixed(1)}%</div>
              </div>
            </div>
          )}
          {prueba && Math.abs(prueba.delta) <= 1.5 && (
            <p className="text-[11px] text-swu-muted text-center">
              Un delta de ±1,5 o menos entra en el margen de ruido de 800 partidas.
            </p>
          )}
        </Seccion>
      )}
    </div>
  )
}

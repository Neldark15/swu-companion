/**
 * MetaLiveView — qué se juega y qué funciona, con datos vivos.
 *
 * Reemplaza en números a la tabla del snapshot de abril: aquel torneo describe
 * un pool de cartas que el juego cerró el 16 de julio. Acá van los arquetipos
 * de la ventana meta vigente, y al tocar uno se abre su RECETA: qué cartas son
 * núcleo, cuáles flexibles y en qué proporción las juega la gente.
 *
 * ── Cómo se leen estos números ────────────────────────────────────────
 *
 * - **Mazos y cuota son censos**, no estimaciones: cuadran entre endpoints.
 * - **El win rate lleva reja de muestra.** Por debajo de 100 partidas o 20
 *   mazos se marca en ámbar: un 81% de 11 partidas no es información.
 * - **El tier es la etiqueta de la fuente, no un veredicto nuestro.** Mezcla
 *   win rate, cuota y conversión, y hay tier 3 con un solo mazo.
 * - **La base es un GRUPO** («Vigilance 30 HP»), no una carta: la fuente
 *   reasigna qué carta concreta lo representa entre llamadas idénticas.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  BarChart3, RefreshCw, AlertTriangle, ExternalLink, Info, ChevronRight,
  TrendingUp, TrendingDown, Minus, WifiOff,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Chip } from '../../components/ui/Chip'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Sheet } from '../../components/ui/Sheet'
import { EmptyState } from '../../components/ui/EmptyState'
import { CardImage } from '../../components/CardImage'
import {
  getMeta, getVentanas, getReceta, ventanaActual, pct, tonoWR, avisoMuestra,
  urlMelee, SOURCE, MIN_GAMES, MIN_DECKS,
  type FilaMeta, type Receta, type VentanaMeta, type CartaReceta, type Grupos,
} from '../../services/metaStatsService'

type Orden = 'mazos' | 'cuota' | 'wr' | 'top8' | 'titulos'

const ORDEN_LABEL: Record<Orden, string> = {
  mazos: 'Mazos', cuota: 'Cuota', wr: 'Win rate', top8: 'Top 8', titulos: 'Títulos',
}

const TONO_CLASE = { green: 'text-swu-green', red: 'text-swu-red', neutral: 'text-swu-muted' } as const

function WR({ v, fiable }: { v: number | null | undefined; fiable: boolean }) {
  return (
    <span className={`font-mono font-bold ${TONO_CLASE[tonoWR(v, fiable)]}`}>
      {pct(v)}
    </span>
  )
}

function Tendencia({ t }: { t: string | null }) {
  if (t === 'rising' || t === 'up') return <TrendingUp size={11} className="text-swu-green" aria-label="subiendo" />
  if (t === 'falling' || t === 'down') return <TrendingDown size={11} className="text-swu-red" aria-label="bajando" />
  return <Minus size={11} className="text-swu-muted/50" aria-label="estable" />
}

/** «Cad Bane | Still Faster Than You» → «Cad Bane». */
const soloNombre = (s: string) => s.split('|')[0].trim()

function GrupoCartas({
  titulo, cartas, receta, nota,
}: { titulo: string; cartas: CartaReceta[]; receta: Receta; nota?: string }) {
  if (cartas.length === 0) return null
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-1.5">
        <h3 className="text-[10px] font-mono tracking-wider uppercase text-swu-muted/60">
          {titulo} · {cartas.length}
        </h3>
        {nota && <span className="text-[10px] text-swu-muted/50">{nota}</span>}
      </div>
      <div className="space-y-1">
        {cartas.map(c => {
          // Se muestra la cantidad MÁS jugada y con qué frecuencia. Decir «3
          // copias» a secas escondería que el 40% juega 2.
          const opciones = [
            { n: 3, raw: c.raw3, p: c.pct3 },
            { n: 2, raw: c.raw2, p: c.pct2 },
            { n: 1, raw: c.raw1, p: c.pct1 },
          ].filter(o => o.raw > 0).sort((a, b) => b.raw - a.raw)
          const top = opciones[0]
          return (
            <div key={c.cardName} className="flex items-center gap-2 bg-swu-bg rounded-lg border border-swu-border px-2 py-1.5">
              <div className="w-9 h-12 flex-shrink-0 rounded overflow-hidden bg-swu-surface">
                <CardImage src={receta.imageUrlMap[c.cardName]} alt={c.cardName} className="w-full h-full" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-swu-text leading-tight truncate">
                  {soloNombre(c.cardName)}
                </p>
                <p className="text-[10px] text-swu-muted truncate">
                  {receta.typeMap[c.cardName] ?? ''}
                  {receta.costMap[c.cardName] != null && ` · coste ${receta.costMap[c.cardName]}`}
                </p>
              </div>
              {top && (
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-mono font-bold text-swu-amber leading-none">×{top.n}</p>
                  <p className="text-[9px] text-swu-muted font-mono">{top.p.toFixed(0)}%</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function MetaLiveView() {
  const [filas, setFilas] = useState<FilaMeta[]>([])
  const [ventana, setVentana] = useState<VentanaMeta | null>(null)
  const [totalMazos, setTotalMazos] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [orden, setOrden] = useState<Orden>('mazos')
  const [soloFiables, setSoloFiables] = useState(false)
  const [busca, setBusca] = useState('')

  const [abierto, setAbierto] = useState<FilaMeta | null>(null)
  const [receta, setReceta] = useState<Receta | null>(null)
  const [recetaError, setRecetaError] = useState<string | null>(null)
  const [fuente, setFuente] = useState<'todos' | 'top8' | 'winners'>('todos')
  const [info, setInfo] = useState(false)

  const cargar = useCallback(async (force = false) => {
    setCargando(true)
    setError(null)
    try {
      const [meta, ventanas] = await Promise.all([
        getMeta(force),
        getVentanas(force).catch(() => [] as VentanaMeta[]),
      ])
      setFilas(meta.filas)
      setTotalMazos(meta.totalMazos)
      setVentana(ventanaActual(ventanas))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'no se pudo consultar')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  // La receta se pide solo al abrir un arquetipo: una consulta por consulta.
  useEffect(() => {
    if (!abierto) return
    let vivo = true
    setReceta(null)
    setRecetaError(null)
    setFuente('todos')
    void getReceta(abierto.leaderName, abierto.baseName)
      .then(r => { if (vivo) setReceta(r) })
      .catch(e => { if (vivo) setRecetaError(e instanceof Error ? e.message : 'no se pudo cargar la receta') })
    return () => { vivo = false }
  }, [abierto])

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase()
    let l = filas.filter(f => {
      if (soloFiables && !f.fiable) return false
      if (q && !`${f.leaderName} ${f.baseName}`.toLowerCase().includes(q)) return false
      return true
    })
    l = [...l].sort((a, b) => {
      switch (orden) {
        case 'cuota': return b.metaShare - a.metaShare
        case 'wr': return b.winRate - a.winRate
        case 'top8': return b.top8n - a.top8n
        case 'titulos': return b.titulos - a.titulos
        default: return b.mazos - a.mazos
      }
    })
    return l
  }, [filas, orden, soloFiables, busca])

  const grupos: { k: keyof Pick<Receta, 'mainboardGroups' | 'mainboardGroupsTop8' | 'mainboardGroupsWinners'>; nota: string } =
    fuente === 'winners'
      ? { k: 'mainboardGroupsWinners', nota: 'solo campeones' }
      : fuente === 'top8'
        ? { k: 'mainboardGroupsTop8', nota: 'solo top 8' }
        : { k: 'mainboardGroups', nota: 'todos los mazos' }

  const g: Grupos | null = receta ? receta[grupos.k] : null

  return (
    <>
      {/* Atribución + ventana meta vigente */}
      <div className="flex items-center gap-2 text-[11px] text-swu-muted bg-swu-surface border border-swu-border rounded-xl px-3 py-2">
        <BarChart3 size={13} className="text-swu-cyan flex-shrink-0" aria-hidden />
        <span className="flex-1 leading-snug min-w-0">
          {ventana ? <><span className="text-swu-text font-semibold">{ventana.label}</span> · </> : null}
          {totalMazos > 0 && `${totalMazos.toLocaleString('es-SV')} mazos · `}
          <a href={SOURCE.url} target="_blank" rel="noopener noreferrer" className="text-swu-cyan underline underline-offset-2">
            {SOURCE.name}
          </a>
        </span>
        <button onClick={() => setInfo(true)} aria-label="Cómo leer estos datos"
          className="text-swu-muted hover:text-swu-text rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent">
          <Info size={13} aria-hidden />
        </button>
        <button onClick={() => void cargar(true)} disabled={cargando} aria-label="Actualizar"
          className="text-swu-muted hover:text-swu-text rounded p-1 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent">
          <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} aria-hidden />
        </button>
      </div>

      <input
        value={busca}
        onChange={e => setBusca(e.target.value)}
        placeholder="Buscar líder o base…"
        aria-label="Buscar arquetipo"
        className="w-full bg-swu-surface border border-swu-border rounded-xl px-3 py-2.5 text-sm text-swu-text outline-none focus:border-swu-accent"
      />

      <div className="flex items-center gap-1.5 flex-wrap">
        {(Object.keys(ORDEN_LABEL) as Orden[]).map(k => (
          <Chip key={k} tone="neutral" active={orden === k} onClick={() => setOrden(k)}>
            {ORDEN_LABEL[k]}
          </Chip>
        ))}
        <Chip tone="green" active={soloFiables} onClick={() => setSoloFiables(v => !v)}>
          Muestra sólida
        </Chip>
      </div>

      <div aria-live="polite" className="space-y-3">
        {cargando && filas.length === 0 && (
          <p className="text-center text-xs text-swu-muted py-8">Consultando el meta…</p>
        )}

        {!cargando && error && filas.length === 0 && (
          <EmptyState
            icon={<WifiOff size={28} aria-hidden />}
            title="No se pudo traer el meta"
            hint={`${error}. Esta sección necesita internet la primera vez.`}
            action={<Button size="sm" variant="secondary" onClick={() => void cargar(true)}>Reintentar</Button>}
          />
        )}

        {error && filas.length > 0 && (
          <div className="flex items-start gap-2 text-[11px] text-swu-red bg-swu-red/10 border border-swu-red/30 rounded-lg px-3 py-2">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" aria-hidden />
            <span>No se pudo actualizar: {error}</span>
          </div>
        )}

        {!cargando && !error && visibles.length === 0 && filas.length > 0 && (
          <EmptyState
            icon={<BarChart3 size={28} aria-hidden />}
            title="Ningún arquetipo con esos filtros"
            action={
              <Button size="sm" variant="secondary" onClick={() => { setBusca(''); setSoloFiables(false) }}>
                Quitar filtros
              </Button>
            }
          />
        )}

        {visibles.length > 0 && (
          <>
            <p className="text-xs text-swu-muted">
              {visibles.length} de {filas.length} arquetipos
            </p>

            <div className="space-y-1">
              {visibles.map(f => {
                const aviso = avisoMuestra(f)
                return (
                  <button
                    key={f.id}
                    onClick={() => setAbierto(f)}
                    className="w-full flex items-center gap-2.5 bg-swu-surface rounded-lg border border-swu-border px-2.5 py-2 text-left active:scale-[0.99] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-swu-text truncate leading-tight">
                          {soloNombre(f.leaderName)}
                        </p>
                        {f.tier && (
                          <span className="text-[9px] font-mono text-swu-muted border border-swu-border rounded px-1 flex-shrink-0">
                            T{f.tier}
                          </span>
                        )}
                        <Tendencia t={f.tendencia} />
                      </div>
                      <p className="text-[10px] text-swu-muted truncate">{f.baseName}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-swu-muted">
                        <span>{f.mazos} mazos</span>
                        <span>{pct(f.metaShare)}</span>
                        {f.top8n > 0 && <span className="text-swu-cyan">T8 {f.top8n}</span>}
                        {f.titulos > 0 && <span className="text-swu-amber">🏆 {f.titulos}</span>}
                      </div>
                      {aviso && (
                        <p className="text-[9px] text-swu-amber flex items-center gap-1 mt-0.5">
                          <AlertTriangle size={9} aria-hidden /> {aviso}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <WR v={f.winRate} fiable={f.fiable} />
                      <p className="text-[9px] text-swu-muted font-mono">{f.games} part.</p>
                    </div>
                    <ChevronRight size={14} className="text-swu-muted flex-shrink-0" aria-hidden />
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Receta del arquetipo ── */}
      <Sheet
        open={!!abierto}
        onClose={() => setAbierto(null)}
        title={abierto ? soloNombre(abierto.leaderName) : ''}
      >
        {abierto && (
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              {/* La columna se dibuja SIEMPRE, no solo cuando llegó la receta.
                  Como `receta` arranca en null en cada apertura, antes el
                  nombre y los chips se pintaban a todo el ancho y saltaban 92px
                  a la derecha cuando cargaba la imagen —el 100% de las veces,
                  en la interacción principal de la vista—. CardImage ya dibuja
                  su propio esqueleto mientras tanto. */}
              <div className="w-20 flex-shrink-0">
                <CardImage
                  src={receta?.leaderImageUrl}
                  alt={abierto.leaderName}
                  orientacion="apaisada"
                  fit="cover"
                  className="w-full aspect-[400/286]"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-swu-text leading-tight">{abierto.leaderName}</p>
                <p className="text-[11px] text-swu-muted">
                  {abierto.baseName}
                  {/* La base es un grupo, no una carta: se dice. */}
                  <span className="text-swu-muted/60"> · grupo de bases</span>
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <Chip tone="neutral">{abierto.mazos} mazos</Chip>
                  <Chip tone="cyan">{pct(abierto.metaShare)} del meta</Chip>
                  {abierto.top8n > 0 && <Chip tone="amber">Top 8: {abierto.top8n}</Chip>}
                  {abierto.titulos > 0 && <Chip tone="green">{abierto.titulos} títulos</Chip>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-swu-bg rounded-lg border border-swu-border px-3 py-2">
              <div className="flex-1">
                <p className="text-[10px] font-mono uppercase tracking-wider text-swu-muted/60">Win rate</p>
                <WR v={abierto.winRate} fiable={abierto.fiable} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-mono uppercase tracking-wider text-swu-muted/60">Partidas</p>
                <p className="font-mono text-sm text-swu-text">{abierto.games}</p>
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-mono uppercase tracking-wider text-swu-muted/60">W-L-D</p>
                <p className="font-mono text-xs text-swu-text">{abierto.wins}-{abierto.losses}-{abierto.draws}</p>
              </div>
            </div>

            {avisoMuestra(abierto) && (
              <p className="text-[11px] text-swu-amber flex items-start gap-1.5">
                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" aria-hidden />
                {avisoMuestra(abierto)} — por debajo de {MIN_GAMES} partidas o {MIN_DECKS} mazos el
                porcentaje se mueve demasiado como para compararlo.
              </p>
            )}

            {/* ── La receta ── */}
            <div className="pt-1">
              <SegmentedControl
                label="Qué mazos contar"
                value={fuente}
                onChange={setFuente}
                options={[
                  { value: 'todos', label: 'Todos', count: receta?.deckCounts?.all },
                  { value: 'top8', label: 'Top 8', count: receta?.deckCounts?.top8 },
                  { value: 'winners', label: 'Campeones', count: receta?.deckCounts?.winners },
                ]}
              />
            </div>

            {recetaError && (
              <p className="text-[11px] text-swu-red flex items-start gap-1.5">
                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" aria-hidden /> {recetaError}
              </p>
            )}
            {!receta && !recetaError && (
              <p className="text-center text-xs text-swu-muted py-6">Cargando la receta…</p>
            )}

            {receta && g && (
              <div className="space-y-3">
                <GrupoCartas titulo="Núcleo" cartas={g.Core} receta={receta} nota="casi todos las llevan" />
                <GrupoCartas titulo="Habituales" cartas={g.Popular} receta={receta} />
                <GrupoCartas titulo="Flexibles" cartas={g.Flex} receta={receta} nota="acá está el gusto de cada uno" />
                {receta[fuente === 'todos' ? 'sideboardGroups' : 'sideboardGroups'].Popular.length > 0 && (
                  <GrupoCartas
                    titulo="Sideboard"
                    cartas={receta.sideboardGroups.Popular}
                    receta={receta}
                  />
                )}
                <p className="text-[10px] text-swu-muted leading-relaxed">
                  El número es la cantidad de copias más jugada y el porcentaje, cuánta
                  gente la lleva así. Sale de {receta.deckCounts?.[fuente === 'todos' ? 'all' : fuente] ?? 0} mazos.
                </p>
              </div>
            )}

            {receta && receta.decklistsForCombo?.length > 0 && (
              <div>
                <p className="text-[10px] font-mono tracking-wider uppercase text-swu-muted/60 mb-1.5">
                  Listas completas en melee.gg
                </p>
                <div className="flex flex-wrap gap-1">
                  {[...receta.decklistsForCombo]
                    .sort((a, b) => (a.standing ?? 999) - (b.standing ?? 999))
                    .slice(0, 12)
                    .map(d => (
                      <a
                        key={d.guid}
                        href={urlMelee(d.guid)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono text-swu-cyan border border-swu-border rounded px-2 py-1 flex items-center gap-1"
                      >
                        {d.standing === 1 ? '🏆' : `#${d.standing ?? '?'}`}
                        <ExternalLink size={9} aria-hidden />
                      </a>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Sheet>

      {/* ── Cómo leer esto ── */}
      <Sheet open={info} onClose={() => setInfo(false)} title="Cómo leer estos números">
        <div className="p-4 space-y-3 text-xs text-swu-text leading-relaxed">
          <p>
            Los datos los recopila{' '}
            <a href={SOURCE.url} target="_blank" rel="noopener noreferrer" className="text-swu-cyan underline underline-offset-2">
              {SOURCE.name}
            </a>{' '}
            sobre la ventana meta vigente, o sea el set legal de ahora. Se guardan unas
            horas para no consultar en cada visita.
          </p>
          <ul className="space-y-1.5 text-[11px] text-swu-muted">
            <li>
              <span className="text-swu-text font-semibold">Mazos y cuota</span> · son censos,
              no estimaciones: se cuentan todos los mazos registrados.
            </li>
            <li>
              <span className="text-swu-text font-semibold">Win rate</span> · se atenúa y se
              marca cuando hay menos de {MIN_GAMES} partidas o {MIN_DECKS} mazos. Un 81% de 11
              partidas no es información. Entre 47% y 53% no se pinta de color: esa diferencia
              no se distingue del ruido.
            </li>
            <li>
              <span className="text-swu-text font-semibold">Tier</span> · es la etiqueta de la
              fuente, no un veredicto. Mezcla win rate, cuota y conversión, y hay tier 3 con un
              solo mazo.
            </li>
            <li>
              <span className="text-swu-text font-semibold">La base</span> · es un GRUPO
              («Vigilance 30 HP»), no una carta. La fuente reasigna cuál la representa entre
              consultas, así que decir «juega tal base» sería inventar.
            </li>
            <li>
              <span className="text-swu-text font-semibold">La receta</span> · muestra la
              cantidad de copias más jugada y qué porcentaje la lleva así, partida en núcleo,
              habituales y flexibles. Podés ver la de todos, la de los que llegaron a top 8, o
              solo la de los campeones.
            </li>
          </ul>
        </div>
      </Sheet>
    </>
  )
}

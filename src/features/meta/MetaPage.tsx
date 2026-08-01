/**
 * MetaPage — el meta del torneo, con tabla interactiva.
 *
 * Dos vistas, porque son dos preguntas distintas:
 *
 * - **Meta**: "¿qué se jugó y qué funcionó?" Tabla ordenable por cualquier
 *   columna, con filtros por estrategia, set y tier.
 * - **Matchups**: "¿cómo le va a MI deck contra el resto?" Se elige un
 *   arquetipo y se ven sus enfrentamientos, del mejor al peor.
 *
 * ── Lo que esta pantalla NO hace, a propósito ─────────────────────────
 *
 * No rellena huecos. La matriz cubre el 73% de los pares y solo las rondas
 * Premier; un par sin dato se muestra como "sin dato", nunca como 0%.
 * Tampoco corona al mejor deck por win rate pelado: el mejor número del
 * snapshot (73.4%) sale de 3 decks y 8 observaciones, así que las muestras
 * chicas van marcadas.
 */

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowUpDown, Swords, BarChart3, Info,
  ExternalLink, AlertTriangle, ChevronRight,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Chip } from '../../components/ui/Chip'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Sheet } from '../../components/ui/Sheet'
import {
  tournament, archetypes, findings, notes, sources,
  strategies, sets, tiers,
  getArchetype, getMatchupsOf, formatPct, winRateTone, sampleWarning,
  type MetaArchetype,
} from '../../services/metaService'

type SortKey = 'rank' | 'decks' | 'metaShare' | 'top8' | 'wrVsTop10' | 'kyberWR'

const SORT_LABELS: Record<SortKey, string> = {
  rank: 'Ranking',
  decks: 'Decks',
  metaShare: 'Meta',
  top8: 'Top 8',
  wrVsTop10: 'WR vs Top 10',
  kyberWR: 'WR Kyber',
}

const TONE_CLASS = {
  green: 'text-swu-green',
  red: 'text-swu-red',
  neutral: 'text-swu-muted',
} as const

function WinRate({ value }: { value: number | null | undefined }) {
  return (
    <span className={`font-mono font-bold ${TONE_CLASS[winRateTone(value)]}`}>
      {formatPct(value)}
    </span>
  )
}

export function MetaPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<'meta' | 'matchups'>('meta')
  const [sortBy, setSortBy] = useState<SortKey>('rank')
  const [desc, setDesc] = useState(false)
  const [fStrategy, setFStrategy] = useState<string | null>(null)
  const [fSet, setFSet] = useState<string | null>(null)
  const [fTier, setFTier] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(archetypes[0]?.id ?? null)
  const [detail, setDetail] = useState<MetaArchetype | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  const rows = useMemo(() => {
    let list = archetypes.filter(a => {
      if (fStrategy && a.strategy !== fStrategy) return false
      if (fSet && a.set !== fSet) return false
      if (fTier && a.kyberTier !== fTier) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!(a.name ?? a.id).toLowerCase().includes(q) && !a.id.toLowerCase().includes(q)) return false
      }
      return true
    })
    list = [...list].sort((a, b) => {
      const av = a[sortBy] ?? -Infinity
      const bv = b[sortBy] ?? -Infinity
      // El ranking es "mejor = más chico"; el resto, "mejor = más grande".
      const cmp = sortBy === 'rank' ? (av as number) - (bv as number) : (bv as number) - (av as number)
      return desc ? -cmp : cmp
    })
    return list
  }, [sortBy, desc, fStrategy, fSet, fTier, search])

  const activeFilters = [fStrategy, fSet, fTier].filter(Boolean).length + (search.trim() ? 1 : 0)
  const clearFilters = () => { setFStrategy(null); setFSet(null); setFTier(null); setSearch('') }

  const selectedArch = selected ? getArchetype(selected) : undefined
  const selectedMatchups = selected ? getMatchupsOf(selected) : []

  return (
    <div className="min-h-screen bg-swu-bg">
      <div className="sticky top-0 z-40 bg-swu-bg/95 backdrop-blur border-b border-swu-border">
        <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-swu-muted" aria-label="Atrás">
            <ArrowLeft size={20} aria-hidden />
          </button>
          <h1 className="text-lg font-bold text-swu-text flex-1">Meta</h1>
          <Button size="xs" variant="ghost" onClick={() => setShowInfo(true)}>
            <Info size={13} aria-hidden /> Fuentes
          </Button>
        </div>
      </div>

      <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 py-4 space-y-4">
        {/* Cabecera del torneo */}
        <div className="bg-swu-surface rounded-xl border border-swu-border p-3 space-y-2">
          <p className="text-sm font-bold text-swu-text leading-tight">{tournament.name}</p>
          <div className="flex flex-wrap gap-3 text-[11px] text-swu-muted font-mono">
            <span>{tournament.players} jugadores</span>
            <span>{tournament.archetypeCount} arquetipos</span>
            <span>{tournament.dates}</span>
          </div>
          {/* La cobertura va arriba, no en una nota al pie: cambia cómo hay
              que leer TODA la matriz. */}
          {tournament.coverage !== null && tournament.coverage < 1 && (
            <div className="flex items-start gap-1.5 text-[11px] text-swu-amber bg-swu-amber/10 border border-swu-amber/30 rounded-lg px-2 py-1.5">
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" aria-hidden />
              <span>
                Cobertura {formatPct(tournament.coverage, 0)} · {tournament.pairsWithData} pares
                con dato. La matriz solo cubre las rondas Premier; los pares sin
                dato aparecen como «sin dato», no como 0%.
              </span>
            </div>
          )}
        </div>

        <SegmentedControl
          label="Qué mirar"
          value={view}
          onChange={setView}
          options={[
            { value: 'meta', label: 'Meta', icon: <BarChart3 size={13} aria-hidden /> },
            { value: 'matchups', label: 'Matchups', icon: <Swords size={13} aria-hidden /> },
          ]}
        />

        {view === 'meta' && (
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar arquetipo o líder…"
              aria-label="Buscar arquetipo"
              className="w-full bg-swu-surface border border-swu-border rounded-xl px-3 py-2.5 text-sm text-swu-text outline-none focus:border-swu-accent"
            />

            {/* Filtros */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1">
                {strategies.map(s => (
                  <Chip key={s} tone="cyan" active={fStrategy === s}
                    onClick={() => setFStrategy(fStrategy === s ? null : s)}>{s}</Chip>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {sets.map(s => (
                  <Chip key={s} tone="amber" active={fSet === s}
                    onClick={() => setFSet(fSet === s ? null : s)}>{s}</Chip>
                ))}
                {tiers.map(t => (
                  <Chip key={t} tone="green" active={fTier === t}
                    onClick={() => setFTier(fTier === t ? null : t)}>{t}</Chip>
                ))}
                {activeFilters > 0 && (
                  <Button size="xs" variant="ghost" onClick={clearFilters} className="text-swu-red">
                    Limpiar
                  </Button>
                )}
              </div>
            </div>

            {/* Ordenar */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <ArrowUpDown size={12} className="text-swu-muted" aria-hidden />
              {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                <Chip
                  key={k}
                  tone="neutral"
                  active={sortBy === k}
                  onClick={() => { if (sortBy === k) setDesc(d => !d); else { setSortBy(k); setDesc(false) } }}
                >
                  {SORT_LABELS[k]}{sortBy === k ? (desc ? ' ↓' : ' ↑') : ''}
                </Chip>
              ))}
            </div>

            <p className="text-xs text-swu-muted">
              {rows.length} de {archetypes.length} arquetipos
            </p>

            {/* Tabla. Scroll horizontal PROPIO: el cuerpo de la página nunca
                debe scrollear de lado en móvil. */}
            <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
              <table className="w-full min-w-[640px] text-left border-collapse">
                <thead>
                  <tr className="text-[10px] font-mono tracking-wider uppercase text-swu-muted/60">
                    <th className="py-2 pr-2 font-medium">#</th>
                    <th className="py-2 pr-2 font-medium">Arquetipo</th>
                    <th className="py-2 px-2 font-medium text-right">Decks</th>
                    <th className="py-2 px-2 font-medium text-right">Meta</th>
                    <th className="py-2 px-2 font-medium text-right">Top 8</th>
                    <th className="py-2 px-2 font-medium text-right">vs Top 10</th>
                    <th className="py-2 pl-2 font-medium text-right">Kyber</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(a => {
                    const warn = sampleWarning(a)
                    return (
                      <tr
                        key={a.id}
                        onClick={() => setDetail(a)}
                        className="border-t border-swu-border/50 cursor-pointer hover:bg-swu-surface/60 transition-colors"
                      >
                        <td className="py-2 pr-2 text-[11px] font-mono text-swu-muted">{a.rank ?? '—'}</td>
                        <td className="py-2 pr-2">
                          <div className="text-xs font-semibold text-swu-text leading-tight">
                            {a.leader ?? a.id}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] text-swu-muted">{a.strategy}</span>
                            {a.set && <span className="text-[10px] text-swu-amber font-mono">{a.set}</span>}
                            {warn && (
                              <span className="text-[9px] text-swu-amber" title={warn}>
                                <AlertTriangle size={9} aria-hidden />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right text-xs font-mono text-swu-text">{a.decks}</td>
                        <td className="py-2 px-2 text-right text-xs font-mono text-swu-muted">{formatPct(a.metaShare, 1)}</td>
                        <td className="py-2 px-2 text-right text-xs font-mono text-swu-text">
                          {a.top8 > 0 ? a.top8 : '—'}
                        </td>
                        <td className="py-2 px-2 text-right text-xs"><WinRate value={a.wrVsTop10} /></td>
                        <td className="py-2 pl-2 text-right text-xs">
                          <span className="font-mono text-swu-muted">{a.kyberTier ?? '—'}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {rows.length === 0 && (
              <p className="text-center text-xs text-swu-muted py-6">
                Ningún arquetipo con esos filtros
              </p>
            )}
          </>
        )}

        {view === 'matchups' && (
          <>
            <div>
              <label className="text-xs text-swu-muted mb-1.5 block">Tu arquetipo</label>
              <select
                value={selected ?? ''}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full bg-swu-surface border border-swu-border rounded-xl px-3 py-2.5 text-sm text-swu-text"
              >
                {archetypes.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.rank ? `${a.rank}. ` : ''}{a.leader ?? a.id}
                  </option>
                ))}
              </select>
            </div>

            {selectedArch && (
              <div className="bg-swu-surface rounded-xl border border-swu-border p-3 space-y-1">
                <p className="text-sm font-bold text-swu-text">{selectedArch.leader ?? selectedArch.id}</p>
                <p className="text-[11px] text-swu-muted">
                  {selectedArch.strategy}
                  {selectedArch.substrategy ? ` · ${selectedArch.substrategy}` : ''}
                </p>
                <div className="flex gap-3 text-[11px] font-mono text-swu-muted pt-1">
                  <span>{selectedMatchups.length} matchups</span>
                  <span className="text-swu-green">{selectedArch.favorable ?? 0} favorables</span>
                  <span className="text-swu-red">{selectedArch.unfavorable ?? 0} malos</span>
                </div>
                {sampleWarning(selectedArch) && (
                  <p className="text-[11px] text-swu-amber flex items-center gap-1 pt-0.5">
                    <AlertTriangle size={11} aria-hidden /> {sampleWarning(selectedArch)}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1">
              {selectedMatchups.map(m => {
                const rival = getArchetype(m.target)
                return (
                  <button
                    key={m.target}
                    onClick={() => rival && setDetail(rival)}
                    className="w-full flex items-center gap-2 bg-swu-surface rounded-lg border border-swu-border px-3 py-2 text-left active:scale-[0.99] transition-transform"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-swu-text truncate">
                        {rival?.leader ?? m.target}
                      </p>
                      <p className="text-[10px] text-swu-muted">{rival?.strategy}</p>
                    </div>
                    {/* Barra centrada en 50%: se ve de un vistazo si estás
                        arriba o abajo, sin leer el número. */}
                    <div className="w-16 h-1.5 rounded-full bg-swu-bg relative overflow-hidden flex-shrink-0" aria-hidden>
                      <div className="absolute inset-y-0 left-1/2 w-px bg-swu-border" />
                      <div
                        className={`absolute inset-y-0 rounded-full ${
                          m.winRate >= 0.5 ? 'bg-swu-green/70 left-1/2' : 'bg-swu-red/70 right-1/2'
                        }`}
                        style={{ width: `${Math.min(50, Math.abs(m.winRate - 0.5) * 100)}%` }}
                      />
                    </div>
                    <span className="w-12 text-right"><WinRate value={m.winRate} /></span>
                  </button>
                )
              })}
              {selectedMatchups.length === 0 && (
                <p className="text-center text-xs text-swu-muted py-6">
                  Este arquetipo no tiene matchups en la matriz.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Detalle del arquetipo */}
      <Sheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.leader ?? detail?.id ?? ''}
      >
        {detail && (
          <div className="p-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-swu-text">{detail.leader ?? detail.id}</p>
              {detail.base && <p className="text-[11px] text-swu-muted">Base: {detail.base}</p>}
            </div>

            <div className="flex flex-wrap gap-1">
              {detail.strategy && <Chip tone="cyan" active>{detail.strategy}</Chip>}
              {detail.set && <Chip tone="amber" active>{detail.set}</Chip>}
              {detail.kyberTier && <Chip tone="green" active>Kyber {detail.kyberTier}</Chip>}
            </div>

            {detail.gameplan && (
              <div>
                <p className="text-[10px] font-mono tracking-wider uppercase text-swu-muted/60 mb-1">
                  Plan de juego
                </p>
                <p className="text-xs text-swu-text leading-relaxed">{detail.gameplan}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ['Decks', String(detail.decks)],
                ['Meta share', formatPct(detail.metaShare)],
                ['Top 8', String(detail.top8)],
                ['Conversión', formatPct(detail.top8Conversion)],
                ['WR vs Top 10', formatPct(detail.wrVsTop10)],
                ['WR general', formatPct(detail.wrGeneral)],
                ['WR Kyber', formatPct(detail.kyberWR)],
                ['Velocidad', detail.speed ? `${detail.speed}/5` : '—'],
              ].map(([k, v]) => (
                <div key={k} className="bg-swu-bg rounded-lg px-2.5 py-1.5 border border-swu-border">
                  <p className="text-[10px] text-swu-muted">{k}</p>
                  <p className="font-mono font-bold text-swu-text">{v}</p>
                </div>
              ))}
            </div>

            {detail.confidence && (
              <p className="text-[11px] text-swu-muted">
                Confianza de la clasificación: <b className="text-swu-text">{detail.confidence}</b>
                {detail.communityTag ? ` · Comunidad: ${detail.communityTag}` : ''}
              </p>
            )}

            {sampleWarning(detail) && (
              <p className="text-[11px] text-swu-amber flex items-start gap-1.5 bg-swu-amber/10 border border-swu-amber/30 rounded-lg px-2 py-1.5">
                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" aria-hidden />
                {sampleWarning(detail)} — leé este número con cuidado.
              </p>
            )}

            <Button
              size="sm"
              variant="secondary"
              block
              onClick={() => { setSelected(detail.id); setView('matchups'); setDetail(null) }}
            >
              Ver sus matchups <ChevronRight size={13} aria-hidden />
            </Button>
          </div>
        )}
      </Sheet>

      {/* Fuentes y método */}
      <Sheet open={showInfo} onClose={() => setShowInfo(false)} title="Fuentes y método">
        <div className="p-4 space-y-4">
          <div className="space-y-1 text-[11px] text-swu-muted">
            <p><b className="text-swu-text">Torneo:</b> {tournament.name}</p>
            {tournament.venue && <p><b className="text-swu-text">Sede:</b> {tournament.venue}</p>}
            {tournament.format && <p><b className="text-swu-text">Formato:</b> {tournament.format}</p>}
            {tournament.champion && <p><b className="text-swu-text">Campeón:</b> {tournament.champion}</p>}
            <p><b className="text-swu-text">Verificado:</b> {tournament.verifiedAt}</p>
          </div>

          {findings.length > 0 && (
            <section>
              <p className="text-[10px] font-mono tracking-wider uppercase text-swu-muted/60 mb-1.5">
                Conclusiones
              </p>
              <ul className="space-y-1">
                {findings.map((f, i) => (
                  <li key={i} className="text-[11px] text-swu-text leading-relaxed">{f}</li>
                ))}
              </ul>
            </section>
          )}

          {notes.length > 0 && (
            <section>
              <p className="text-[10px] font-mono tracking-wider uppercase text-swu-muted/60 mb-1.5">
                Notas metodológicas
              </p>
              <ul className="space-y-1">
                {notes.map((n, i) => (
                  <li key={i} className="text-[11px] text-swu-muted leading-relaxed">· {n}</li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <p className="text-[10px] font-mono tracking-wider uppercase text-swu-muted/60 mb-1.5">
              Fuentes
            </p>
            <div className="space-y-1">
              {sources.map(s => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[11px] text-swu-cyan hover:underline"
                >
                  <ExternalLink size={11} aria-hidden /> {s.name}
                </a>
              ))}
            </div>
          </section>
        </div>
      </Sheet>
    </div>
  )
}

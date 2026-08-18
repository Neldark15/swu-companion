/**
 * MetaPage — el meta competitivo, con tabla interactiva.
 *
 * Tres vistas, porque son tres preguntas distintas:
 *
 * - **Torneos**: "¿qué está ganando ahora?" Últimos torneos oficiales del
 *   mundo con su top y el enlace a cada lista. Dato VIVO, de
 *   swu-competitivehub.com vía `/api/swu-events`.
 * - **Meta**: "¿qué se jugó y qué funcionó?" Tabla ordenable por cualquier
 *   columna, con filtros por estrategia, set y tier.
 * - **Matchups**: "¿cómo le va a MI deck contra el resto?" Se elige un
 *   arquetipo y se ven sus enfrentamientos, del mejor al peor.
 *
 * Las dos últimas salen de un snapshot empaquetado de UN torneo (Galactic,
 * 543 jugadores). Por eso "Torneos" abre primero: es lo que está pasando hoy,
 * mientras que la matriz es una foto de abril que envejece sola.
 *
 * ── Lo que esta pantalla NO hace, a propósito ─────────────────────────
 *
 * No rellena huecos. La matriz cubre el 73% de los pares y solo las rondas
 * Premier; un par sin dato se muestra como "sin dato", nunca como 0%.
 * Tampoco corona al mejor deck por win rate pelado: el mejor número del
 * snapshot (73.4%) sale de 3 decks y 8 observaciones, así que las muestras
 * chicas van marcadas.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Swords, BarChart3, Info,
  ExternalLink, AlertTriangle, ChevronRight, Trophy, Flag, Handshake,
} from 'lucide-react'
import { TournamentsView } from './TournamentsView'
import { MetaLiveView } from './MetaLiveView'
import { MetaNacionalView } from './MetaNacionalView'
import { Button } from '../../components/ui/Button'
import { Chip } from '../../components/ui/Chip'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { MetaAmistosoView } from './MetaAmistosoView'
import { Sheet } from '../../components/ui/Sheet'
import {
  tournament, archetypes, findings, notes, sources,
  getArchetype, getMatchupsOf, formatPct, winRateTone, sampleWarning,
  type MetaArchetype,
} from '../../services/metaService'

const TONE_CLASS = {
  green: 'text-swu-green',
  red: 'text-swu-red-texto',
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
  const [view, setView] = useState<'torneos' | 'meta' | 'matchups' | 'nacional' | 'amistosas'>('torneos')
  const [selected, setSelected] = useState<string | null>(archetypes[0]?.id ?? null)
  const [detail, setDetail] = useState<MetaArchetype | null>(null)
  const [showInfo, setShowInfo] = useState(false)

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
          {/* «Fuentes» describe el snapshot del torneo único. En «Torneos» los
              datos son otros y tienen su propio botón de contexto, así que acá
              solo confundiría. */}
          {view === 'matchups' && (
            <Button size="xs" variant="ghost" onClick={() => setShowInfo(true)}>
              <Info size={13} aria-hidden /> Fuentes
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 py-4 space-y-4">
        {/* Cabecera del snapshot. Solo en «Matchups», que es lo único que
            sigue saliendo de ese torneo: sobre los datos vivos del Meta,
            afirmar «543 jugadores» contradiría lo de abajo. */}
        {view === 'matchups' && (
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
        )}

        <SegmentedControl
          label="Qué mirar"
          value={view}
          onChange={setView}
          options={[
            { value: 'torneos', label: 'Torneos', icon: <Trophy size={13} aria-hidden /> },
            { value: 'meta', label: 'Meta', icon: <BarChart3 size={13} aria-hidden /> },
            { value: 'matchups', label: 'Matchups', icon: <Swords size={13} aria-hidden /> },
            // «SV» y no «Nacional»: con cuatro pestañas, a 360px de ancho la
            // etiqueta larga rompía la fila. La bandera lleva el resto.
            // El control ya no desborda —recorta— pero «Nacio…» no dice más que
            // «SV», así que la etiqueta corta se queda por legible, no por miedo.
            { value: 'nacional', label: 'SV', icon: <Flag size={13} aria-hidden /> },
            // Lo que se juega FUERA de torneo. Es la única pestaña alimentada
            // por la propia comunidad en vez de por una ingesta externa.
            { value: 'amistosas', label: 'Mesa', icon: <Handshake size={13} aria-hidden /> },
          ]}
        />

        {/* Datos VIVOS. Reemplaza en números a la tabla del snapshot: aquel
            torneo describe un pool de cartas que el juego cerró el 16 de
            julio, y 53 de los 177 arquetipos de hoy tienen líderes que
            entonces no existían. La prosa curada sigue en «Matchups». */}
        {view === 'meta' && <MetaLiveView />}
        {/* El meta de acá. Es la única de las cuatro que habla de nosotros: las
            otras tres describen el mundo. */}
        {view === 'nacional' && <MetaNacionalView />}
        {view === 'amistosas' && <MetaAmistosoView />}
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
                {/* `flex-wrap`: son tres cifras de ancho variable en una fila
                    que no se puede encoger, y a 320px se salían de la tarjeta. */}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-mono text-swu-muted pt-1">
                  <span>{selectedMatchups.length} matchups</span>
                  <span className="text-swu-green">{selectedArch.favorable ?? 0} favorables</span>
                  <span className="text-swu-red-texto">{selectedArch.unfavorable ?? 0} malos</span>
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

        {/* Se OCULTA en vez de desmontarse: con `{view === 'torneos' && …}`,
            pasar a Matchups y volver borraba el formato, el rango y el nivel
            que la persona acababa de elegir, y repetía la consulta. */}
        {/* `space-y-4` propio y no `contents`: con display:contents el div no
            genera caja, así que el espaciado del contenedor padre no llegaría
            a las secciones de adentro y quedarían todas pegadas. */}
        <div className={view === 'torneos' ? 'space-y-4' : 'hidden'}>
          <TournamentsView />
        </div>
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

/**
 * TournamentsView — qué se ganó últimamente, y con qué.
 *
 * Es la capa VIVA del meta. La matriz de matchups que vive al lado es una foto
 * de un torneo concreto; esto son los últimos torneos oficiales del mundo, con
 * su top y el enlace a cada lista.
 *
 * ── Cómo leer los números ─────────────────────────────────────────────
 *
 * La columna es TÍTULOS: torneos ganados. No es cuota de meta — la fuente no
 * publica cuánta gente jugó cada mazo, así que no se estima. Un mazo con 2
 * títulos en 2 torneos chicos no es mejor que uno con 2 en dos Galactic; por
 * eso al lado va la suma de jugadores de esos torneos.
 *
 * ── Por qué el nombre se pinta antes que la carta ─────────────────────
 *
 * El mazo se dibuja con lo que dice la FUENTE (texto), y la carta nuestra solo
 * lo enriquece cuando el índice de Dexie está listo. Al revés —esperar a la
 * carta— la pantalla decía «Mazo no publicado» de los 165 torneos durante la
 * carga, que es una afirmación falsa sobre datos que sí existen.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Trophy, ExternalLink, RefreshCw, AlertTriangle, Users, ChevronRight, Info, WifiOff,
  CalendarDays,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Chip } from '../../components/ui/Chip'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Sheet } from '../../components/ui/Sheet'
import { EmptyState } from '../../components/ui/EmptyState'
import { CardImage } from '../../components/CardImage'
import {
  getTournaments, getStandings, getUpcoming, resolveDecks, countTitles, countUnpublished,
  archetypeKey, ensureCards, SOURCE,
  type HubTournament, type HubStanding, type HubRange, type HubCategory,
  type HubUpcoming, type ResolvedDeck,
} from '../../services/tournamentsService'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** `2026-08-02` → `2 ago`. Se parte el string a mano: `new Date('2026-08-02')`
 *  se interpreta en UTC y en El Salvador (UTC-6) mostraría el día anterior. */
function fecha(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${MESES[m - 1]}${new Date().getFullYear() === y ? '' : ` ${String(y).slice(2)}`}`
}

/** «Boba Fett (JTL)» → «Boba Fett». El set ya se ve en la carta. */
const sinSet = (s: string) => s.replace(/\s*\([A-Za-z0-9]{2,6}\)\s*$/, '').trim()

/** Los niveles grandes se destacan: no es lo mismo ganar un Galactic que un local. */
const esGrande = (nivel: string) => /galactic|regional|sector/i.test(nivel)

function Identidad({
  leader, base, deck, size = 'sm',
}: {
  leader: string | null
  base: string | null
  deck?: ResolvedDeck
  size?: 'sm' | 'md'
}) {
  if (!leader) {
    return <span className="text-[11px] text-swu-muted italic">Mazo no publicado</span>
  }
  const box = size === 'md' ? 'w-14 h-10' : 'w-11 h-8'
  const card = deck?.leaderCard
  const rotulo = deck?.base?.label ?? base
  const esClase = deck?.base?.isClass ?? false

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className={`${box} flex-shrink-0 rounded overflow-hidden bg-swu-bg border border-swu-border`}>
        <CardImage src={card?.imageUrl} alt={leader} fit="contain" className="w-full h-full" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-swu-text truncate leading-tight">
          {card?.name ?? sinSet(leader)}
        </p>
        {rotulo && (
          <p className="text-[10px] text-swu-muted truncate">
            {rotulo}
            {/* Cuando la fuente da una clase y no una carta, se dice. Poner el
                nombre de una base concreta sería inventar cuál se jugó. */}
            {esClase && <span className="text-swu-muted/60"> · clase</span>}
          </p>
        )}
      </div>
    </div>
  )
}

const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** `2026-08-08` → `agosto 2026`, para agrupar la agenda. */
function mesDe(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return y && m ? `${MESES_LARGO[m - 1]} ${y}` : iso
}

/** Días que faltan. Se calcula sobre fechas sueltas, sin husos horarios. */
function faltan(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const hoy = new Date()
  const a = Date.UTC(y, m - 1, d)
  const b = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return Math.round((a - b) / 86_400_000)
}

function cuenta(dias: number): string {
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'mañana'
  if (dias < 7) return `en ${dias} días`
  if (dias < 30) return `en ${Math.round(dias / 7)} sem`
  return `en ${Math.round(dias / 30)} meses`
}

/** Los formatos que publica la agenda, con el tono que ya usa la app. */
const TONO_FORMATO: Record<string, 'cyan' | 'amber' | 'green'> = {
  Premier: 'cyan', Limited: 'amber', Eternal: 'green',
}

export function TournamentsView() {
  const [vista, setVista] = useState<'resultados' | 'agenda'>('resultados')
  const [range, setRange] = useState<HubRange>('3')
  const [category, setCategory] = useState<HubCategory>('todas')
  const [nivel, setNivel] = useState<string>('')

  const [tournaments, setTournaments] = useState<HubTournament[]>([])
  const [decks, setDecks] = useState<Map<string, ResolvedDeck>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Fecha del dato cuando se está sirviendo lo guardado por falta de red. */
  const [viejo, setViejo] = useState<number | null>(null)

  const [abierto, setAbierto] = useState<HubTournament | null>(null)
  const [top, setTop] = useState<HubStanding[] | null>(null)
  const [topDecks, setTopDecks] = useState<ResolvedDeck[]>([])
  const [topError, setTopError] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  const [agenda, setAgenda] = useState<HubUpcoming[]>([])
  const [agendaCargando, setAgendaCargando] = useState(false)
  const [agendaError, setAgendaError] = useState<string | null>(null)
  const [agendaVieja, setAgendaVieja] = useState<number | null>(null)
  const [pais, setPais] = useState<string>('')

  /** Descarta respuestas de un filtro ya abandonado. Sin esto, una respuesta
   *  lenta del filtro viejo pisaba la lista del nuevo y la pantalla quedaba
   *  rotulada con un formato que no era el de sus datos. */
  const peticion = useRef(0)

  /** Mapa arquetipo → carta. Se separa del fetch porque un fallo de IndexedDB
   *  no es culpa de la fuente y no debe reportarse como tal. */
  const enriquecer = useCallback(async (list: HubTournament[], id: number) => {
    try {
      const resolved = await resolveDecks(list.map(t => ({ leader: t.leader, base: t.base })))
      if (id !== peticion.current) return
      const map = new Map<string, ResolvedDeck>()
      list.forEach((t, i) => {
        const k = archetypeKey(t.leader, t.base)
        if (k && !map.has(k)) map.set(k, resolved[i])
      })
      setDecks(map)
    } catch {
      // Sin imágenes se sigue viendo todo: nombres, títulos y tops.
    }
  }, [])

  const cargar = useCallback(async (force = false) => {
    const id = ++peticion.current
    setLoading(true)
    setError(null)
    try {
      const { tournaments: list, cachedAt } = await getTournaments(range, category, force)
      if (id !== peticion.current) return
      setTournaments(list)
      setViejo(cachedAt)
      void enriquecer(list, id)
    } catch (e) {
      if (id !== peticion.current) return
      // Se limpia todo: dejar los torneos del filtro anterior bajo el rótulo
      // del nuevo es peor que no mostrar nada.
      setTournaments([])
      setDecks(new Map())
      setViejo(null)
      setError(e instanceof Error ? e.message : 'no se pudo consultar')
    } finally {
      if (id === peticion.current) setLoading(false)
    }
  }, [range, category, enriquecer])

  useEffect(() => { void cargar() }, [cargar])

  // La base de cartas se baja sola si falta: /meta es pública y ninguna otra
  // pantalla de esta ruta la carga, así que sin esto un visitante nuevo no
  // vería ni una imagen. Va en segundo plano — la pantalla ya es útil sin ella.
  useEffect(() => {
    if (tournaments.length === 0) return
    let vivo = true
    void ensureCards().then(cargadas => {
      if (vivo && cargadas) void enriquecer(tournaments, peticion.current)
    })
    return () => { vivo = false }
  }, [tournaments, enriquecer])

  const niveles = useMemo(
    () => [...new Set(tournaments.map(t => t.level))].sort(),
    [tournaments],
  )

  const visibles = useMemo(
    () => (nivel ? tournaments.filter(t => t.level === nivel) : tournaments),
    [tournaments, nivel],
  )

  const titulos = useMemo(() => countTitles(visibles), [visibles])
  const sinPublicar = useMemo(() => countUnpublished(visibles), [visibles])
  const maxTitulos = titulos[0]?.titles ?? 1

  // El top se pide solo al abrir un torneo: una petición por consulta, no 165.
  useEffect(() => {
    if (!abierto) return
    let vivo = true
    setTop(null)
    setTopDecks([])
    setTopError(null)
    void (async () => {
      try {
        const s = await getStandings(abierto.slug)
        if (!vivo) return
        setTop(s)
        const r = await resolveDecks(s.map(x => ({ leader: x.leader, base: x.base })))
        if (vivo) setTopDecks(r)
      } catch (e) {
        if (vivo) setTopError(e instanceof Error ? e.message : 'no se pudo cargar el top')
      }
    })()
    return () => { vivo = false }
  }, [abierto])

  // La agenda se pide solo cuando alguien la mira, y una sola vez.
  const cargarAgenda = useCallback(async (force = false) => {
    setAgendaCargando(true)
    setAgendaError(null)
    try {
      const { events, cachedAt } = await getUpcoming(force)
      setAgenda(events)
      setAgendaVieja(cachedAt)
    } catch (e) {
      setAgenda([])
      setAgendaError(e instanceof Error ? e.message : 'no se pudo consultar')
    } finally {
      setAgendaCargando(false)
    }
  }, [])

  useEffect(() => {
    if (vista === 'agenda' && agenda.length === 0 && !agendaError) void cargarAgenda()
  }, [vista, agenda.length, agendaError, cargarAgenda])

  const paises = useMemo(
    () => [...new Set(agenda.map(e => e.country).filter(Boolean))].sort(),
    [agenda],
  )

  /** Agrupada por mes: una lista plana de 218 fechas no se lee. */
  const agendaPorMes = useMemo(() => {
    const lista = pais ? agenda.filter(e => e.country === pais) : agenda
    const grupos = new Map<string, HubUpcoming[]>()
    for (const e of lista) {
      const k = mesDe(e.date)
      const g = grupos.get(k)
      if (g) g.push(e)
      else grupos.set(k, [e])
    }
    return [...grupos.entries()]
  }, [agenda, pais])

  const limpiarFiltros = () => { setNivel(''); setCategory('todas') }

  return (
    <>
      {/* Atribución. Los datos son de otra gente y se dice arriba, no al pie. */}
      <div className="flex items-center gap-2 text-[11px] text-swu-muted bg-swu-surface border border-swu-border rounded-xl px-3 py-2">
        <Trophy size={13} className="text-swu-amber flex-shrink-0" aria-hidden />
        <span className="flex-1 leading-snug">
          Resultados de{' '}
          <a
            href={SOURCE.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-swu-cyan underline underline-offset-2"
          >
            {SOURCE.name}
          </a>
        </span>
        <button
          onClick={() => setShowInfo(true)}
          aria-label="Cómo leer estos datos"
          className="text-swu-muted hover:text-swu-text rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
        >
          <Info size={13} aria-hidden />
        </button>
        <button
          onClick={() => void cargar(true)}
          disabled={loading}
          aria-label="Actualizar"
          className="text-swu-muted hover:text-swu-text rounded p-1 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} aria-hidden />
        </button>
      </div>

      <SegmentedControl
        label="Qué torneos"
        value={vista}
        onChange={setVista}
        options={[
          { value: 'resultados', label: 'Resultados', icon: <Trophy size={13} aria-hidden /> },
          { value: 'agenda', label: 'Próximos', icon: <CalendarDays size={13} aria-hidden /> },
        ]}
      />

      {vista === 'agenda' && (
        <div aria-live="polite" aria-busy={agendaCargando} className="space-y-3">
          {paises.length > 1 && (
            <select
              value={pais}
              onChange={e => setPais(e.target.value)}
              aria-label="Filtrar la agenda por país"
              className="w-full bg-swu-surface border border-swu-border rounded-lg px-2 py-2 text-xs text-swu-text"
            >
              <option value="">Todos los países ({agenda.length})</option>
              {paises.map(p => (
                <option key={p} value={p}>{p} ({agenda.filter(e => e.country === p).length})</option>
              ))}
            </select>
          )}

          {agendaVieja !== null && (
            <div className="flex items-start gap-2 text-[11px] text-swu-amber bg-swu-amber/10 border border-swu-amber/30 rounded-lg px-3 py-2">
              <WifiOff size={13} className="flex-shrink-0 mt-0.5" aria-hidden />
              <span>
                Sin conexión con la fuente. Agenda guardada del{' '}
                {new Date(agendaVieja).toLocaleDateString('es-SV', { day: 'numeric', month: 'short' })}.
              </span>
            </div>
          )}

          {agendaCargando && agenda.length === 0 && (
            <p className="text-center text-xs text-swu-muted py-8">Consultando la agenda…</p>
          )}

          {!agendaCargando && agendaError && agenda.length === 0 && (
            <EmptyState
              icon={<WifiOff size={28} aria-hidden />}
              title="No se pudo traer la agenda"
              hint={`${agendaError}. Necesita internet la primera vez.`}
              action={
                <Button size="sm" variant="secondary" onClick={() => void cargarAgenda(true)}>
                  Reintentar
                </Button>
              }
            />
          )}

          {agendaPorMes.map(([mes, eventos]) => (
            <section key={mes}>
              <h2 className="text-[10px] font-mono tracking-wider uppercase text-swu-muted/60 mb-2">
                {mes} · {eventos.length}
              </h2>
              <div className="space-y-1">
                {eventos.map(e => {
                  const dias = faltan(e.date)
                  return (
                    <div
                      key={`${e.date}-${e.name}-${e.city}`}
                      className="flex items-center gap-2.5 bg-swu-surface rounded-lg border border-swu-border px-2.5 py-2"
                    >
                      <div className="w-11 flex-shrink-0 text-center">
                        <p className="text-sm font-mono font-bold text-swu-text leading-none">
                          {Number(e.date.slice(8, 10))}
                        </p>
                        <p className="text-[9px] text-swu-muted font-mono uppercase mt-0.5">
                          {MESES[Number(e.date.slice(5, 7)) - 1]}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-swu-text truncate leading-tight">{e.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-swu-muted font-mono">
                          <span className="truncate">{[e.city, e.country].filter(Boolean).join(' · ')}</span>
                          {/* Solo si la fuente lo publica: un 0 no significa
                              «nadie inscrito», significa «no lo dicen». */}
                          {e.players > 0 && (
                            <span className="flex items-center gap-0.5 flex-shrink-0">
                              <Users size={9} aria-hidden />{e.players}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <Chip tone={TONO_FORMATO[e.format] ?? 'neutral'}>{e.format}</Chip>
                        <span className={`text-[9px] font-mono ${dias <= 7 ? 'text-swu-amber' : 'text-swu-muted'}`}>
                          {cuenta(dias)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}

          {!agendaCargando && !agendaError && agendaPorMes.length === 0 && (
            <EmptyState
              icon={<CalendarDays size={28} aria-hidden />}
              title={pais ? `Sin torneos anunciados en ${pais}` : 'Sin torneos anunciados'}
              hint="La agenda la publica la fuente; cuando anuncien nuevos aparecen acá."
              action={pais ? (
                <Button size="sm" variant="secondary" onClick={() => setPais('')}>
                  Ver todos los países
                </Button>
              ) : undefined}
            />
          )}
        </div>
      )}

      {vista === 'resultados' && (<>
      <SegmentedControl
        label="Formato"
        value={category}
        onChange={setCategory}
        options={[
          { value: 'todas', label: 'Todos' },
          { value: 'premier', label: 'Premier' },
          { value: 'limited', label: 'Limitado' },
          { value: 'eternal', label: 'Eternal' },
        ]}
      />

      <div className="flex flex-wrap items-center gap-1">
        <Chip tone="amber" active={range === '3'} onClick={() => setRange('3')}>3 meses</Chip>
        <Chip tone="amber" active={range === '6'} onClick={() => setRange('6')}>6 meses</Chip>
        {niveles.length > 1 && (
          <select
            value={nivel}
            onChange={e => setNivel(e.target.value)}
            aria-label="Filtrar por nivel de evento"
            className="ml-auto bg-swu-surface border border-swu-border rounded-lg px-2 py-1.5 text-[11px] text-swu-text max-w-[55%]"
          >
            <option value="">Todos los niveles</option>
            {niveles.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
      </div>

      {/* Toda esta región cambia sola tras una consulta; sin `aria-live` un
          lector de pantalla no anuncia ni la carga ni el resultado. */}
      <div aria-live="polite" aria-busy={loading} className="space-y-4">
        {viejo !== null && (
          <div className="flex items-start gap-2 text-[11px] text-swu-amber bg-swu-amber/10 border border-swu-amber/30 rounded-lg px-3 py-2">
            <WifiOff size={13} className="flex-shrink-0 mt-0.5" aria-hidden />
            <span>
              Sin conexión con la fuente. Estás viendo lo guardado del{' '}
              {new Date(viejo).toLocaleDateString('es-SV', { day: 'numeric', month: 'short' })}.
            </span>
          </div>
        )}

        {loading && tournaments.length === 0 && (
          <p className="text-center text-xs text-swu-muted py-8">Consultando torneos…</p>
        )}

        {/* Sin datos y con error: se ofrece reintentar, que es lo único que
            puede destrabar. Un mensaje de red suelto dejaba encerrado. */}
        {!loading && error && tournaments.length === 0 && (
          <EmptyState
            icon={<WifiOff size={28} aria-hidden />}
            title="No se pudieron traer los torneos"
            hint={`${error}. Revisá tu conexión: esta sección necesita internet la primera vez.`}
            action={
              <Button size="sm" variant="secondary" onClick={() => void cargar(true)}>
                Reintentar
              </Button>
            }
          />
        )}

        {/* Con datos viejos en pantalla el error va como aviso, no como vacío. */}
        {error && tournaments.length > 0 && (
          <div className="flex items-start gap-2 text-[11px] text-swu-red bg-swu-red/10 border border-swu-red/30 rounded-lg px-3 py-2">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" aria-hidden />
            <span>No se pudo actualizar: {error}</span>
          </div>
        )}

        {!loading && !error && visibles.length === 0 && (
          <EmptyState
            icon={<Trophy size={28} aria-hidden />}
            title="Sin torneos en este filtro"
            hint="Probá con otro formato, otro nivel o un rango más amplio."
            action={
              <Button size="sm" variant="secondary" onClick={limpiarFiltros}>
                Quitar filtros
              </Button>
            }
          />
        )}

        {visibles.length > 0 && (
          <>
            {/* ── Qué está ganando ── */}
            <section>
              <h2 className="text-[10px] font-mono tracking-wider uppercase text-swu-muted/60 mb-2">
                Qué está ganando · {visibles.length} torneos
              </h2>
              <div className="space-y-1">
                {titulos.slice(0, 8).map(t => (
                  <div
                    key={t.key}
                    className="flex items-center gap-2 bg-swu-surface rounded-lg border border-swu-border px-2.5 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <Identidad leader={t.leader} base={t.base} deck={decks.get(t.key)} size="md" />
                    </div>
                    <div className="w-16 h-1.5 rounded-full bg-swu-bg overflow-hidden flex-shrink-0" aria-hidden>
                      <div
                        className="h-full rounded-full bg-swu-amber/70"
                        style={{ width: `${(t.titles / maxTitulos) * 100}%` }}
                      />
                    </div>
                    <div className="text-right w-14 flex-shrink-0">
                      <p className="text-xs font-mono font-bold text-swu-text">{t.titles}</p>
                      <p className="text-[9px] text-swu-muted font-mono">{t.players} jug.</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-swu-muted mt-1.5 leading-relaxed">
                Títulos = torneos ganados. No es cuota de meta: la fuente no publica
                cuánta gente jugó cada mazo.
                {sinPublicar > 0 && ` ${sinPublicar} de ${visibles.length} no publicaron el mazo ganador.`}
              </p>
            </section>

            {/* ── Últimos torneos ── */}
            <section>
              <h2 className="text-[10px] font-mono tracking-wider uppercase text-swu-muted/60 mb-2">
                Últimos torneos
              </h2>
              <div className="space-y-1">
                {visibles.map(t => (
                  <button
                    key={t.slug}
                    onClick={() => setAbierto(t)}
                    className="w-full flex items-center gap-2.5 bg-swu-surface rounded-lg border border-swu-border px-2.5 py-2 text-left active:scale-[0.99] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-swu-text truncate leading-tight">{t.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-swu-muted font-mono">
                        <span>{fecha(t.date)}</span>
                        <span className="truncate">{t.country}</span>
                        <span className="flex items-center gap-0.5">
                          <Users size={9} aria-hidden />{t.players}
                        </span>
                        {esGrande(t.level) && <span className="text-swu-amber truncate">{t.level}</span>}
                      </div>
                      <div className="mt-1">
                        <Identidad
                          leader={t.leader}
                          base={t.base}
                          deck={decks.get(archetypeKey(t.leader, t.base) ?? '')}
                        />
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-swu-muted flex-shrink-0" aria-hidden />
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
      </>)}

      {/* ── Top de un torneo ── */}
      <Sheet open={!!abierto} onClose={() => setAbierto(null)} title={abierto?.name ?? ''}>
        {abierto && (
          <div className="p-4 space-y-3">
            <div className="flex flex-wrap gap-1">
              <Chip tone="neutral">{fecha(abierto.date)}</Chip>
              <Chip tone="cyan">{abierto.country}</Chip>
              <Chip tone="amber">{abierto.level}</Chip>
              <Chip tone="neutral">{abierto.players} jugadores</Chip>
            </div>

            <div aria-live="polite">
              {topError && (
                <p className="text-[11px] text-swu-red flex items-start gap-1.5">
                  <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" aria-hidden />
                  {topError}
                </p>
              )}

              {!top && !topError && (
                <p className="text-center text-xs text-swu-muted py-6">Cargando el top…</p>
              )}

              {top && top.length === 0 && (
                <p className="text-center text-xs text-swu-muted py-6">
                  Este torneo todavía no publicó su top.
                </p>
              )}

              {top && top.length > 0 && (
                <div className="space-y-1">
                  {top.map((s, i) => (
                    <div
                      key={`${s.place}-${s.player}`}
                      className="flex items-center gap-2 bg-swu-bg rounded-lg border border-swu-border px-2.5 py-2"
                    >
                      <span
                        className={`w-6 text-center text-xs font-mono font-bold flex-shrink-0 ${
                          s.place === 1 ? 'text-swu-amber' : 'text-swu-muted'
                        }`}
                      >
                        {s.place}
                      </span>
                      <div className="flex-1 min-w-0">
                        <Identidad leader={s.leader} base={s.base} deck={topDecks[i]} />
                        <p className="text-[10px] text-swu-muted truncate mt-0.5">{s.player}</p>
                      </div>
                      {s.decklistUrl && (
                        <a
                          href={s.decklistUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Ver la lista de ${s.player} en melee.gg`}
                          className="text-swu-cyan p-1.5 flex-shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
                        >
                          <ExternalLink size={14} aria-hidden />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <a
              href={`${SOURCE.url}/event/${abierto.slug}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-[11px] text-swu-cyan py-2"
            >
              Ver en {SOURCE.name} <ExternalLink size={11} aria-hidden />
            </a>
          </div>
        )}
      </Sheet>

      {/* ── Cómo leer esto ── */}
      <Sheet open={showInfo} onClose={() => setShowInfo(false)} title="De dónde salen estos datos">
        <div className="p-4 space-y-3 text-xs text-swu-text leading-relaxed">
          <p>
            Los resultados los recopila{' '}
            <a href={SOURCE.url} target="_blank" rel="noopener noreferrer" className="text-swu-cyan underline underline-offset-2">
              {SOURCE.name}
            </a>
            , un proyecto comunitario. HOLOCRON los consulta y los guarda unas horas
            para no molestar al sitio en cada visita.
          </p>
          <div>
            <p className="text-[10px] font-mono tracking-wider uppercase text-swu-muted/60 mb-1">
              Qué significa cada cosa
            </p>
            <ul className="space-y-1.5 text-[11px] text-swu-muted">
              <li>
                <span className="text-swu-text font-semibold">Títulos</span> · torneos
                ganados con ese líder y esa base. No es cuota de meta.
              </li>
              <li>
                <span className="text-swu-text font-semibold">Jug.</span> · jugadores
                sumados de esos torneos, para pesar cuánto valen los títulos.
              </li>
              <li>
                <span className="text-swu-text font-semibold">clase</span> · la fuente a
                veces publica un grupo de bases equivalentes («azul 30 PV») en vez de la
                carta exacta. Se muestra el grupo, no una carta, porque no se sabe cuál
                de ellas se jugó.
              </li>
              <li>
                <span className="text-swu-text font-semibold">Mazo no publicado</span> ·
                el torneo no informó con qué se ganó. No se rellena.
              </li>
            </ul>
          </div>
          <p className="text-[11px] text-swu-muted">
            Las listas completas abren en melee.gg, que es donde viven.
          </p>
        </div>
      </Sheet>
    </>
  )
}

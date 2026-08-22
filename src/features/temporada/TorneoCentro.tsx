/**
 * TorneoCentro — operar UNA fecha: inscritos, llaves y publicación.
 *
 * ── Lo que esta pantalla NO hace ──────────────────────────────────────
 *
 * No reporta resultados ronda por ronda: eso ya lo hace
 * `/events/dashboard/:code`, que además tiene tiempo real y temporizador.
 * Reconstruirlo acá sería el tercer tablero de torneo de la app. Esta
 * pantalla hace lo que faltaba —sembrar con semillas de verdad, armar la
 * llave, exportar la tabla, redactar el artículo— y para lo demás enlaza.
 *
 * ── Las semillas importan ─────────────────────────────────────────────
 *
 * `initializeTournament()` siembra con el ORDEN DE INSCRIPCIÓN
 * (`seed: idx + 1`). Para un suizo da igual, pero para una llave es la
 * diferencia entre «1.º contra el último» y «el que se inscribió primero
 * contra el que se inscribió segundo». Por eso acá se puede reordenar antes
 * de generar el cuadro.
 *
 * ── Cerrar va por UN solo camino ──────────────────────────────────────
 *
 * `finishTournament()` → RPC `cerrar_torneo`, que es el único sitio que
 * reparte resultados, XP y sobres, y es idempotente. Las funciones de
 * avance del motor también saben poner `status='finished'`, pero lo hacen
 * con un update de cliente y **no reparten nada**: usar esas dejaría el
 * torneo cerrado y a todos sin premio.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertCircle, ArrowLeft, Check, Copy, Download, ExternalLink,
  Image as ImageIcon, ArrowDown, ArrowUp, Newspaper, Play, Trophy,
} from 'lucide-react'
import { HudPanel } from '../../components/Hud'
import { Avatar } from '../../components/ui/Avatar'
import { getEventByCode, getEventRegistrations, type OfficialEvent, type EventRegistration } from '../../services/events'
import {
  initializeTournament, generateSwissPairings, generateEliminationBracket,
  getStandings, getAllRounds, getRoundPairings, finishTournament,
  type CloudStanding, type CloudRound, type CloudPairing,
} from '../../services/tournamentCloud'
import { verTorneo, type TorneoCompleto } from '../../services/torneosHistoricos'
import { guardar as guardarArticulo } from '../../services/blogService'
import { useAuth } from '../../hooks/useAuth'
import { fijarSemillas } from '../../services/centroTemporada'
import { StandingsTable } from '../events/components/StandingsTable'
import { BracketView } from '../events/components/BracketView'
import { componerBorrador, type Borrador } from './borradorArticulo'
import {
  aTexto, copiarTexto, descargarCSV, compartirImagen, type TablaPublicable,
} from './exportarTabla'

type Pestana = 'inscritos' | 'llaves' | 'publicar'

export function TorneoCentro() {
  const { code = '' } = useParams()
  const { currentProfile } = useAuth()
  const [evento, setEvento] = useState<OfficialEvent | null>(null)
  const [inscritos, setInscritos] = useState<EventRegistration[]>([])
  const [standings, setStandings] = useState<CloudStanding[]>([])
  const [rondas, setRondas] = useState<CloudRound[]>([])
  const [pareos, setPareos] = useState<Map<number, CloudPairing[]>>(new Map())
  const [cerrado, setCerrado] = useState<TorneoCompleto | null>(null)
  const [pestana, setPestana] = useState<Pestana>('inscritos')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [recarga, setRecarga] = useState(0)

  /* La carga vive DENTRO del efecto, con bandera de vida (renders en cascada
   * + escritura sobre componente desmontado). `recarga` la vuelve a disparar
   * desde los manejadores. */
  useEffect(() => {
    let vivo = true
    void (async () => {
      const ev = await getEventByCode(code)
      if (!vivo) return
      setEvento(ev)
      if (!ev) { setCargando(false); return }

      const [regs, st, rd] = await Promise.all([
        getEventRegistrations(ev.id), getStandings(ev.id), getAllRounds(ev.id),
      ])
      if (!vivo) return
      setInscritos(regs)
      setStandings(st)
      setRondas(rd)

      // Los pareos de todas las rondas, en paralelo: el cuadro los necesita
      // todos para dibujarse.
      const mapa = new Map<number, CloudPairing[]>()
      await Promise.all(
        rd.map(async r => { mapa.set(r.round_number, await getRoundPairings(ev.id, r.round_number)) }),
      )
      if (!vivo) return
      setPareos(mapa)

      // Un torneo cerrado se lee por el camino histórico: es el ÚNICO que
      // respeta la columna `puesto`. El orden calculado de `getStandings`
      // puede diferir del podio que la gente vio en la mesa.
      if (ev.status === 'finished') {
        const r = await verTorneo(code)
        if (!vivo) return
        setCerrado(r.ok ? r.datos : null)
      } else {
        setCerrado(null)
      }
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [code, recarga])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 2600)
    return () => clearTimeout(t)
  }, [aviso])

  const nombres = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of standings) m.set(s.user_id, s.player_name)
    return m
  }, [standings])

  async function accion(fn: () => Promise<{ ok: boolean; error?: string }>, exito: string) {
    setOcupado(true)
    const r = await fn()
    setOcupado(false)
    if (r.ok) { setAviso(exito); setRecarga(n => n + 1) } else { setError(r.error ?? 'Falló') }
  }

  if (cargando) return <p className="text-sm text-swu-muted animate-pulse">Cargando torneo…</p>
  if (!evento) return <p className="text-sm text-swu-muted">No se encontró el torneo {code}.</p>

  return (
    <div className="space-y-5">
      <Link to="/temporada" className="inline-flex items-center gap-1.5 text-xs text-swu-muted min-h-[44px]">
        <ArrowLeft size={14} /> Centro
      </Link>

      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-swu-amber">
          {evento.code} · {evento.status}
        </p>
        <h1 className="text-2xl font-black text-swu-text">{evento.name}</h1>
        <p className="font-mono text-[11px] text-swu-muted">
          {evento.format} · {inscritos.length} inscritos · {standings.length} en clasificación ·{' '}
          {rondas.length} ronda{rondas.length === 1 ? '' : 's'}
        </p>
        <a
          href={`/events/dashboard/${evento.code}`}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-swu-cyan"
        >
          <ExternalLink size={13} /> Abrir el tablero en vivo (reportar resultados)
        </a>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-swu-red/40 bg-swu-red/10 p-3">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-swu-red-texto" />
          <p className="text-sm text-swu-red-texto">{error}</p>
        </div>
      )}
      {aviso && (
        <div className="flex items-center gap-2 rounded-lg border border-swu-green/40 bg-swu-green/10 p-3">
          <Check size={16} className="text-swu-green" />
          <p className="text-sm text-swu-green">{aviso}</p>
        </div>
      )}

      <div className="flex gap-1 border-b border-swu-border overflow-x-auto">
        {([['inscritos', 'Inscritos'], ['llaves', 'Llaves'], ['publicar', 'Publicar']] as const).map(
          ([k, label]) => (
            <button
              key={k}
              onClick={() => setPestana(k)}
              className={`min-h-[44px] whitespace-nowrap px-4 text-sm font-semibold border-b-2 -mb-px ${
                pestana === k
                  ? 'border-swu-amber text-swu-amber'
                  : 'border-transparent text-swu-muted hover:text-swu-text'
              }`}
            >
              {label}
            </button>
          ),
        )}
      </div>

      {pestana === 'inscritos' && (
        <Inscritos
          evento={evento}
          inscritos={inscritos}
          standings={standings}
          ocupado={ocupado}
          onSembrar={() => accion(() => initializeTournament(evento.id), 'Clasificación sembrada')}
          onSemillas={async orden => {
            setOcupado(true)
            const r = await fijarSemillas(evento.id, orden)
            setOcupado(false)
            if (r.ok) { setAviso(`${r.datos} semillas fijadas`); setRecarga(n => n + 1) } else { setError(r.mensaje) }
          }}
        />
      )}

      {pestana === 'llaves' && (
        <Llaves
          evento={evento}
          standings={standings}
          rondas={rondas}
          pareos={pareos}
          nombres={nombres}
          ocupado={ocupado}
          onSuizo={() =>
            accion(() => generateSwissPairings(evento.id, (evento.status === 'open' ? 0 : rondas.length) + 1),
                   'Pareos generados')}
          onCuadro={() => accion(() => generateEliminationBracket(evento.id), 'Cuadro generado')}
          onCerrar={() => accion(() => finishTournament(evento.id), 'Torneo cerrado y premios repartidos')}
        />
      )}

      {pestana === 'publicar' && (
        <Publicar
          evento={evento}
          cerrado={cerrado}
          standings={standings}
          autorId={currentProfile?.id ?? null}
          onAviso={setAviso}
          onError={setError}
        />
      )}
    </div>
  )
}

// ── Inscritos ────────────────────────────────────────────────────────

function Inscritos({
  evento, inscritos, standings, ocupado, onSembrar, onSemillas,
}: {
  evento: OfficialEvent
  inscritos: EventRegistration[]
  standings: CloudStanding[]
  ocupado: boolean
  onSembrar: () => Promise<void>
  onSemillas: (orden: string[]) => Promise<void>
}) {
  /* El orden de siembra que se está editando.
   *
   * Se DERIVA de `standings` con useMemo en vez de copiarse a estado con un
   * efecto: copiar en un efecto escribe estado en sincrónico —renders en
   * cascada— y además deja dos fuentes del mismo orden que se separan en
   * cuanto llega una recarga. El estado guarda solo los movimientos que hizo
   * la persona, y se vacía cuando cambian los standings de abajo. */
  const sembradoOriginal = useMemo(
    () => [...standings].sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99)),
    [standings],
  )

  /* Lo movido se guarda JUNTO A LA FOTO de los standings sobre la que se
   * movió. Así el reseteo no necesita ningún efecto: cuando llega una
   * recarga con semillas nuevas la clave deja de coincidir y lo movido
   * simplemente deja de aplicar. Derivar es más barato y más seguro que
   * sincronizar dos estados. */
  const clave = standings.map(s => `${s.id}:${s.seed}`).join('|')
  const [movidos, setMovidos] = useState<{ clave: string; orden: CloudStanding[] } | null>(null)
  const orden = movidos?.clave === clave ? movidos.orden : sembradoOriginal

  const mover = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= orden.length) return
    const n = [...orden]
    ;[n[i], n[j]] = [n[j], n[i]]
    setMovidos({ clave, orden: n })
  }

  const sembrado = standings.length > 0

  return (
    <div className="space-y-4">
      <HudPanel compact tone={sembrado ? 'green' : 'amber'}>
        <div className="space-y-2 p-3.5">
          <p className="text-sm font-bold text-swu-text">
            {sembrado
              ? `Clasificación sembrada con ${standings.length} jugadores`
              : `${inscritos.length} inscritos, sin sembrar`}
          </p>
          <p className="text-xs text-swu-muted">
            {sembrado
              ? 'Ya se puede armar la llave. Volver a sembrar no funciona: la clasificación ya existe.'
              : 'Sembrar crea la clasificación desde los inscritos y pone el torneo en curso. Hacen falta al menos 2.'}
          </p>
          {!sembrado && (
            <button
              onClick={() => void onSembrar()}
              disabled={ocupado || inscritos.length < 2}
              className="flex min-h-[44px] items-center gap-2 rounded-lg bg-swu-accent px-4 text-sm
                         font-semibold text-white disabled:opacity-50"
            >
              <Play size={15} /> Sembrar clasificación
            </button>
          )}
        </div>
      </HudPanel>

      {!sembrado && (
        <div className="space-y-1.5">
          {inscritos.map(r => (
            <div key={r.id} className="flex items-center gap-2.5 rounded-lg bg-swu-surface p-2.5">
              <Avatar avatar={r.player_avatar} size={26} anillo={r.user_id} />
              <span className="min-w-0 flex-1 truncate text-sm text-swu-text">
                {r.player_name ?? 'Sin nombre'}
              </span>
              <span className="font-mono text-[10px] uppercase text-swu-muted">{r.status}</span>
            </div>
          ))}
          {inscritos.length === 0 && (
            <p className="text-sm text-swu-muted">Nadie se ha inscrito todavía.</p>
          )}
        </div>
      )}

      {sembrado && (
        <div className="space-y-2">
          <div>
            <p className="text-sm font-bold text-swu-text">Orden de siembra</p>
            <p className="text-xs text-swu-muted">
              Solo importa para la llave de eliminación: decide quién cruza con quién.
              El 1.º de acá enfrenta al último. Por defecto es el orden de inscripción,
              que para un cuadro no significa nada.
            </p>
          </div>

          {orden.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 rounded-lg bg-swu-surface p-2">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded
                               bg-swu-bg font-mono text-xs font-bold text-swu-amber">
                {i + 1}
              </span>
              <Avatar avatar={null} size={24} anillo={s.user_id} />
              <span className="min-w-0 flex-1 truncate text-sm text-swu-text">{s.player_name}</span>
              <span className="font-mono text-[10px] text-swu-muted">{s.points} pts</span>
              <button onClick={() => mover(i, -1)} disabled={i === 0}
                      aria-label={`Subir a ${s.player_name}`}
                      className="flex h-11 w-9 items-center justify-center text-swu-muted disabled:opacity-25">
                <ArrowUp size={14} />
              </button>
              <button onClick={() => mover(i, 1)} disabled={i === orden.length - 1}
                      aria-label={`Bajar a ${s.player_name}`}
                      className="flex h-11 w-9 items-center justify-center text-swu-muted disabled:opacity-25">
                <ArrowDown size={14} />
              </button>
            </div>
          ))}

          <button
            onClick={() => void onSemillas(orden.map(o => o.user_id))}
            disabled={ocupado || evento.status === 'finished'}
            className="flex min-h-[44px] items-center gap-2 rounded-lg border border-swu-border px-4
                       text-sm font-semibold text-swu-text disabled:opacity-50"
          >
            <Check size={15} /> Guardar este orden
          </button>
        </div>
      )}
    </div>
  )
}

// ── Llaves ───────────────────────────────────────────────────────────

function Llaves({
  evento, standings, rondas, pareos, nombres, ocupado, onSuizo, onCuadro, onCerrar,
}: {
  evento: OfficialEvent
  standings: CloudStanding[]
  rondas: CloudRound[]
  pareos: Map<number, CloudPairing[]>
  nombres: Map<string, string>
  ocupado: boolean
  onSuizo: () => Promise<void>
  onCuadro: () => Promise<void>
  onCerrar: () => Promise<void>
}) {
  const [confirmarCierre, setConfirmarCierre] = useState(false)

  if (standings.length === 0) {
    return (
      <p className="text-sm text-swu-muted">
        Primero hay que sembrar la clasificación, en la pestaña de Inscritos.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => void onSuizo()}
          disabled={ocupado || evento.status === 'finished'}
          className="flex min-h-[44px] items-center gap-2 rounded-lg border border-swu-border px-3
                     text-xs font-semibold text-swu-text disabled:opacity-50"
        >
          <Play size={14} /> Generar ronda suiza {rondas.length + 1}
        </button>
        <button
          onClick={() => void onCuadro()}
          disabled={ocupado || evento.status === 'finished'}
          className="flex min-h-[44px] items-center gap-2 rounded-lg border border-swu-border px-3
                     text-xs font-semibold text-swu-text disabled:opacity-50"
        >
          <Trophy size={14} /> Generar cuadro de eliminación
        </button>
      </div>

      {rondas.length > 0 && (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-swu-muted">
            {rondas.length} ronda{rondas.length === 1 ? '' : 's'}
          </p>
          <BracketView rounds={rondas} pairingsByRound={pareos} playerNames={nombres} />
        </div>
      )}

      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-swu-muted">Clasificación</p>
        <StandingsTable standings={standings} />
      </div>

      {evento.status !== 'finished' && (
        <HudPanel compact tone="red">
          <div className="space-y-2 p-3.5">
            <p className="text-sm font-bold text-swu-text">Cerrar el torneo</p>
            <p className="text-xs text-swu-muted">
              Reparte resultados, XP y sobres, y congela la clasificación. Es el
              único camino que premia — las funciones de avance también cierran,
              pero no reparten nada. Se puede llamar dos veces sin premiar dos veces.
            </p>
            {confirmarCierre ? (
              <div className="flex gap-2">
                <button
                  onClick={() => void onCerrar()}
                  disabled={ocupado}
                  className="min-h-[44px] rounded-lg bg-swu-red px-4 text-sm font-semibold text-white
                             disabled:opacity-50"
                >
                  Sí, cerrar y repartir
                </button>
                <button
                  onClick={() => setConfirmarCierre(false)}
                  className="min-h-[44px] rounded-lg border border-swu-border px-4 text-sm text-swu-muted"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmarCierre(true)}
                className="min-h-[44px] rounded-lg border border-swu-red/50 px-4 text-sm
                           font-semibold text-swu-red-texto"
              >
                Cerrar torneo…
              </button>
            )}
          </div>
        </HudPanel>
      )}
    </div>
  )
}

// ── Publicar ─────────────────────────────────────────────────────────

function Publicar({
  evento, cerrado, standings, autorId, onAviso, onError,
}: {
  evento: OfficialEvent
  cerrado: TorneoCompleto | null
  standings: CloudStanding[]
  autorId: string | null
  onAviso: (m: string) => void
  onError: (m: string) => void
}) {
  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [generando, setGenerando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const publicable = useMemo<TablaPublicable | null>(() => {
    if (cerrado) {
      return {
        titulo: cerrado.torneo.nombre,
        subtitulo: 'Resultados',
        columnas: ['Récord', 'Puntos'],
        filas: cerrado.clasificacion.map(c => ({
          puesto: c.puesto,
          nombre: c.nombre,
          invitado: !c.perfilId,
          valores: [`${c.victorias}-${c.derrotas}`, c.puntos],
        })),
        nota: `${cerrado.clasificacion.length} jugadores · ${cerrado.torneo.formato}`,
      }
    }
    if (standings.length === 0) return null
    return {
      titulo: evento.name,
      subtitulo: 'Clasificación en curso',
      columnas: ['Récord', 'Puntos'],
      filas: standings.map((s, i) => ({
        puesto: i + 1,
        nombre: s.player_name,
        invitado: false,
        valores: [`${s.match_wins}-${s.match_losses}`, s.points],
      })),
      nota: `${standings.length} jugadores · provisional, el torneo no ha cerrado`,
    }
  }, [cerrado, standings, evento.name])

  async function guardarBorrador() {
    if (!borrador || !autorId) return
    setGuardando(true)
    const r = await guardarArticulo({
      title: borrador.title,
      excerpt: borrador.excerpt,
      content: borrador.content,
      tags: borrador.tags,
      kind: 'articulo',
      // Siempre borrador. Publicar lo decide una persona después de leerlo.
      published: false,
      author_id: autorId,
    })
    setGuardando(false)
    if (r.ok) onAviso('Borrador guardado en el blog, sin publicar')
    else onError(r.error)
  }

  return (
    <div className="space-y-5">
      {/* Exportar la tabla */}
      <div className="space-y-2">
        <p className="text-sm font-bold text-swu-text">Exportar la tabla</p>
        {!publicable ? (
          <p className="text-xs text-swu-muted">Todavía no hay clasificación que exportar.</p>
        ) : (
          <>
            {!cerrado && (
              <p className="text-xs text-swu-amber">
                El torneo no ha cerrado: estos puestos son provisionales y pueden cambiar.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => descargarCSV(publicable)}
                className="flex min-h-[44px] items-center gap-2 rounded-lg border border-swu-border px-3
                           text-xs font-semibold text-swu-text"
              >
                <Download size={14} /> CSV
              </button>
              <button
                onClick={async () => {
                  const ok = await copiarTexto(aTexto(publicable))
                  if (ok) onAviso('Tabla copiada')
                  else onError('No se pudo copiar')
                }}
                className="flex min-h-[44px] items-center gap-2 rounded-lg border border-swu-border px-3
                           text-xs font-semibold text-swu-text"
              >
                <Copy size={14} /> Copiar texto
              </button>
              <button
                onClick={async () => {
                  setGenerando(true)
                  try {
                    const r = await compartirImagen(publicable)
                    onAviso(r === 'compartida' ? 'Imagen compartida' : 'Imagen descargada')
                  } catch (e) {
                    onError(e instanceof Error ? e.message : 'No se pudo generar la imagen')
                  } finally { setGenerando(false) }
                }}
                disabled={generando}
                className="flex min-h-[44px] items-center gap-2 rounded-lg bg-swu-accent px-3 text-xs
                           font-semibold text-white disabled:opacity-50"
              >
                <ImageIcon size={14} /> {generando ? 'Generando…' : 'Imagen'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Artículo */}
      <div className="space-y-2">
        <p className="text-sm font-bold text-swu-text">Artículo de resultados</p>
        {!cerrado ? (
          <p className="text-xs text-swu-muted">
            El artículo se redacta cuando el torneo cierra: antes, el campeón todavía
            puede cambiar.
          </p>
        ) : (
          <>
            <p className="text-xs text-swu-muted">
              Se arma con la clasificación y los líderes, en la sintaxis de bloques del
              blog. Queda como <strong>borrador</strong> — publicarlo lo decidís vos
              después de leerlo y agregarle la lectura del torneo.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setBorrador(componerBorrador(cerrado))}
                className="flex min-h-[44px] items-center gap-2 rounded-lg border border-swu-border px-3
                           text-xs font-semibold text-swu-text"
              >
                <Newspaper size={14} /> Redactar borrador
              </button>
              {borrador && (
                <button
                  onClick={() => void guardarBorrador()}
                  disabled={guardando || !autorId}
                  className="flex min-h-[44px] items-center gap-2 rounded-lg bg-swu-accent px-3 text-xs
                             font-semibold text-white disabled:opacity-50"
                >
                  <Check size={14} /> {guardando ? 'Guardando…' : 'Guardar como borrador'}
                </button>
              )}
            </div>

            {borrador && (
              <HudPanel compact>
                <div className="space-y-2 p-3.5">
                  <p className="text-sm font-bold text-swu-text">{borrador.title}</p>
                  <p className="text-xs text-swu-muted">{borrador.excerpt}</p>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-swu-bg p-3
                                  font-mono text-[11px] leading-relaxed text-swu-muted">
                    {borrador.content}
                  </pre>
                </div>
              </HudPanel>
            )}
          </>
        )}
      </div>
    </div>
  )
}

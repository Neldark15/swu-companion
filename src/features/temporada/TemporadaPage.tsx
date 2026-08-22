/**
 * TemporadaPage — operar UNA temporada: sus fechas y su tabla de puntos.
 *
 * ── La tabla no se calcula acá ────────────────────────────────────────
 *
 * Sale de `temporada_tabla()` en Postgres. Recalcularla en el cliente daría
 * otros números que los de la base y tendríamos dos respuestas a la misma
 * pregunta (§3c). Acá solo se pinta y se exporta.
 *
 * ── Solo cuenta lo cerrado ────────────────────────────────────────────
 *
 * La función filtra por `status = 'finished'`. Un torneo a medias tiene
 * puestos provisionales, y publicar una temporada con un resultado que
 * todavía puede cambiar es peor que no publicarla.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertCircle, ArrowLeft, Check, Download, Copy, Image as ImageIcon,
  Link2, Plus, Trash2, ChevronRight,
} from 'lucide-react'
import { HudPanel } from '../../components/Hud'
import { Avatar } from '../../components/ui/Avatar'
import {
  listarTemporadas, leerFechas, guardarFecha, borrarFecha, tablaTemporada,
  torneosLibres, actualizarTemporada,
  type TemporadaCompetitiva, type FechaTemporada, type FilaTemporada, type EventoDeFecha,
} from '../../services/centroTemporada'
import {
  aTexto, copiarTexto, descargarCSV, compartirImagen, type TablaPublicable,
} from './exportarTabla'

type Pestana = 'fechas' | 'puntos'

const ESTADO_EVENTO: Record<string, { texto: string; clase: string }> = {
  open: { texto: 'inscripción abierta', clase: 'text-swu-cyan' },
  active: { texto: 'en curso', clase: 'text-swu-green' },
  finished: { texto: 'cerrado', clase: 'text-swu-amber' },
  cancelled: { texto: 'cancelado', clase: 'text-swu-red-texto' },
}

export function TemporadaPage() {
  const { id = '' } = useParams()
  const [temporada, setTemporada] = useState<TemporadaCompetitiva | null>(null)
  const [fechas, setFechas] = useState<FechaTemporada[]>([])
  const [tabla, setTabla] = useState<FilaTemporada[]>([])
  const [libres, setLibres] = useState<EventoDeFecha[]>([])
  const [pestana, setPestana] = useState<Pestana>('fechas')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [recarga, setRecarga] = useState(0)

  /* La carga vive DENTRO del efecto, con bandera de vida: llamar desde el
   * cuerpo a algo que escribe estado dispara renders en cascada, y la bandera
   * evita escribir sobre un componente ya desmontado. `recarga` es el
   * disparador que usan los manejadores, así hay un solo camino de carga. */
  useEffect(() => {
    let vivo = true
    void (async () => {
      const [ts, fs, tb, lb] = await Promise.all([
        listarTemporadas(), leerFechas(id), tablaTemporada(id), torneosLibres(),
      ])
      if (!vivo) return
      if (ts.ok) setTemporada(ts.datos.find(t => t.id === id) ?? null)
      if (fs.ok) setFechas(fs.datos); else setError(fs.mensaje)
      if (tb.ok) setTabla(tb.datos)
      if (lb.ok) setLibres(lb.datos)
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [id, recarga])

  const recargar = useCallback(async () => { setRecarga(n => n + 1) }, [])

  // El aviso se borra solo; si no, queda un «Copiado» pegado para siempre.
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 2600)
    return () => clearTimeout(t)
  }, [aviso])

  const publicable = useMemo<TablaPublicable | null>(() => {
    if (!temporada || tabla.length === 0) return null
    return {
      titulo: temporada.nombre,
      subtitulo: 'Tabla de la temporada',
      columnas: ['Fechas', 'Puntos'],
      filas: tabla.map((f, i) => ({
        puesto: i + 1,
        nombre: f.nombre,
        invitado: !f.user_id,
        valores: [f.fechas_jugadas, f.sp_total],
      })),
      nota:
        `15 al 1.º · 12 al 2.º · 10 al 3.º-4.º · 6 u 8 según la sala` +
        (temporada.cuentan ? ` · cuentan las ${temporada.cuentan} mejores` : ' · cuentan todas'),
    }
  }, [temporada, tabla])

  const cerradas = fechas.filter(f => f.evento?.status === 'finished').length

  if (cargando) return <p className="text-sm text-swu-muted animate-pulse">Cargando…</p>
  if (!temporada) return <p className="text-sm text-swu-muted">No se encontró esa temporada.</p>

  return (
    <div className="space-y-5">
      <Link to="/temporada" className="inline-flex items-center gap-1.5 text-xs text-swu-muted min-h-[44px]">
        <ArrowLeft size={14} /> Temporadas
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-black text-swu-text">{temporada.nombre}</h1>
        <p className="font-mono text-[11px] text-swu-muted">
          {temporada.empieza} → {temporada.termina} · top {temporada.corte_final} a la final ·{' '}
          {cerradas} de {fechas.length} fecha{fechas.length === 1 ? '' : 's'} cerrada{cerradas === 1 ? '' : 's'}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {(['borrador', 'activa', 'cerrada'] as const).map(e => (
            <button
              key={e}
              onClick={async () => {
                const r = await actualizarTemporada(id, { estado: e })
                if (r.ok) { setTemporada({ ...temporada, estado: e }) } else { setError(r.mensaje) }
              }}
              className={`min-h-[36px] rounded-lg px-3 font-mono text-[10px] uppercase tracking-widest ${
                temporada.estado === e
                  ? 'bg-swu-amber/20 text-swu-amber'
                  : 'border border-swu-border text-swu-muted'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
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

      <div className="flex gap-1 border-b border-swu-border">
        {(['fechas', 'puntos'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPestana(p)}
            className={`min-h-[44px] px-4 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              pestana === p
                ? 'border-swu-amber text-swu-amber'
                : 'border-transparent text-swu-muted hover:text-swu-text'
            }`}
          >
            {p === 'fechas' ? 'Fechas' : 'Tabla de puntos'}
          </button>
        ))}
      </div>

      {pestana === 'fechas' ? (
        <Fechas
          temporadaId={id}
          fechas={fechas}
          libres={libres}
          onCambio={recargar}
          onError={setError}
        />
      ) : (
        <Puntos
          tabla={tabla}
          publicable={publicable}
          cerradas={cerradas}
          onAviso={setAviso}
          onError={setError}
        />
      )}
    </div>
  )
}

// ── Fechas ───────────────────────────────────────────────────────────

function Fechas({
  temporadaId, fechas, libres, onCambio, onError,
}: {
  temporadaId: string
  fechas: FechaTemporada[]
  libres: EventoDeFecha[]
  onCambio: () => Promise<void>
  onError: (m: string) => void
}) {
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevoFormato, setNuevoFormato] = useState('Premier')
  const [esFinal, setEsFinal] = useState(false)
  const [guardando, setGuardando] = useState(false)

  async function agregar() {
    if (!nuevaFecha) return
    setGuardando(true)
    const r = await guardarFecha({
      temporada_id: temporadaId,
      numero: (fechas.at(-1)?.numero ?? 0) + 1,
      fecha: nuevaFecha,
      formato: nuevoFormato.trim() || 'Premier',
      es_final: esFinal,
    })
    setGuardando(false)
    if (!r.ok) { onError(r.mensaje); return }
    setNuevaFecha(''); setEsFinal(false)
    await onCambio()
  }

  async function enlazar(fecha: FechaTemporada, eventId: string) {
    const r = await guardarFecha({
      id: fecha.id,
      temporada_id: temporadaId,
      numero: fecha.numero,
      fecha: fecha.fecha,
      formato: fecha.formato,
      es_final: fecha.es_final,
      event_id: eventId || null,
    })
    if (!r.ok) { onError(r.mensaje); return }
    await onCambio()
  }

  return (
    <div className="space-y-4">
      {fechas.length === 0 && (
        <p className="text-sm text-swu-muted">
          Todavía no hay fechas. Agregá la primera abajo y después enlazala con su torneo.
        </p>
      )}

      <div className="space-y-2">
        {fechas.map(f => {
          const est = f.evento ? ESTADO_EVENTO[f.evento.status] : null
          return (
            <HudPanel key={f.id} compact tone={f.es_final ? 'amber' : 'neutral'}>
              <div className="space-y-3 p-3.5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg
                                   bg-swu-bg font-mono text-sm font-bold text-swu-amber">
                    {f.numero}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-swu-text">
                      {f.formato}
                      {f.es_final && <span className="ml-2 text-[10px] uppercase text-swu-amber">final</span>}
                    </p>
                    <p className="font-mono text-[11px] text-swu-muted">{f.fecha}</p>
                  </div>
                  <button
                    onClick={async () => {
                      const r = await borrarFecha(f.id)
                      if (r.ok) await onCambio(); else onError(r.mensaje)
                    }}
                    aria-label={`Borrar fecha ${f.numero}`}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-swu-muted
                               hover:text-swu-red-texto"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {f.evento ? (
                  <Link
                    to={`/temporada/torneo/${f.evento.code}`}
                    className="flex items-center gap-2 rounded-lg bg-swu-bg/60 p-2.5
                               transition-colors hover:bg-swu-surface-hover"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-swu-text">{f.evento.name}</p>
                      <p className="font-mono text-[10px] text-swu-muted">
                        <span className={est?.clase}>{est?.texto}</span>
                        {' · '}
                        {f.inscritos === null ? '— inscritos' : `${f.inscritos} inscritos`}
                      </p>
                    </div>
                    <ChevronRight size={15} className="text-swu-muted" />
                  </Link>
                ) : (
                  <label className="flex items-center gap-2">
                    <Link2 size={14} className="flex-shrink-0 text-swu-muted" />
                    <select
                      defaultValue=""
                      onChange={e => e.target.value && void enlazar(f, e.target.value)}
                      className="min-h-[44px] w-full rounded-lg border border-swu-border bg-swu-bg px-2
                                 text-xs text-swu-text"
                    >
                      <option value="">Enlazar con un torneo…</option>
                      {libres.map(e => (
                        <option key={e.id} value={e.id}>
                          {e.name} · {e.code}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </HudPanel>
          )
        })}
      </div>

      <HudPanel compact>
        <div className="space-y-3 p-3.5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-swu-muted">Agregar fecha</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="date" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)}
              className="min-h-[44px] rounded-lg border border-swu-border bg-swu-bg px-3 text-sm text-swu-text"
            />
            <input
              value={nuevoFormato} onChange={e => setNuevoFormato(e.target.value)}
              placeholder="Formato"
              className="min-h-[44px] rounded-lg border border-swu-border bg-swu-bg px-3 text-sm text-swu-text"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={esFinal} onChange={e => setEsFinal(e.target.checked)}
                   className="h-4 w-4 accent-swu-amber" />
            <span className="text-xs text-swu-muted">Es la Gran Final</span>
          </label>
          <button
            onClick={() => void agregar()}
            disabled={guardando || !nuevaFecha}
            className="flex min-h-[44px] items-center gap-2 rounded-lg bg-swu-accent px-4 text-sm
                       font-semibold text-white disabled:opacity-50"
          >
            <Plus size={15} /> Agregar
          </button>
        </div>
      </HudPanel>
    </div>
  )
}

// ── Puntos ───────────────────────────────────────────────────────────

function Puntos({
  tabla, publicable, cerradas, onAviso, onError,
}: {
  tabla: FilaTemporada[]
  publicable: TablaPublicable | null
  cerradas: number
  onAviso: (m: string) => void
  onError: (m: string) => void
}) {
  const [generando, setGenerando] = useState(false)

  if (cerradas === 0) {
    return (
      <p className="text-sm text-swu-muted">
        Todavía no hay ningún torneo cerrado enlazado. La tabla se llena sola en
        cuanto se cierre el primero — solo cuentan los torneos cerrados, porque
        antes de cerrar los puestos todavía pueden cambiar.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => publicable && descargarCSV(publicable)}
          disabled={!publicable}
          className="flex min-h-[44px] items-center gap-2 rounded-lg border border-swu-border px-3
                     text-xs font-semibold text-swu-text disabled:opacity-50"
        >
          <Download size={14} /> CSV
        </button>
        <button
          onClick={async () => {
            if (!publicable) return
            const ok = await copiarTexto(aTexto(publicable))
            if (ok) onAviso('Tabla copiada')
            else onError('No se pudo copiar')
          }}
          disabled={!publicable}
          className="flex min-h-[44px] items-center gap-2 rounded-lg border border-swu-border px-3
                     text-xs font-semibold text-swu-text disabled:opacity-50"
        >
          <Copy size={14} /> Copiar texto
        </button>
        <button
          onClick={async () => {
            if (!publicable) return
            setGenerando(true)
            try {
              const r = await compartirImagen(publicable)
              onAviso(r === 'compartida' ? 'Imagen compartida' : 'Imagen descargada')
            } catch (e) {
              onError(e instanceof Error ? e.message : 'No se pudo generar la imagen')
            } finally {
              setGenerando(false)
            }
          }}
          disabled={!publicable || generando}
          className="flex min-h-[44px] items-center gap-2 rounded-lg bg-swu-accent px-3 text-xs
                     font-semibold text-white disabled:opacity-50"
        >
          <ImageIcon size={14} /> {generando ? 'Generando…' : 'Imagen'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[26rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-swu-border">
              {['#', 'Jugador', 'Fechas', 'Puntos'].map((h, i) => (
                <th key={h}
                    className={`py-2 font-mono text-[10px] uppercase tracking-widest text-swu-muted ${
                      i >= 2 ? 'text-right' : ''
                    }`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabla.map((f, i) => (
              <tr key={f.clave} className="border-b border-swu-border/40">
                <td className="py-2.5 pr-2 font-mono text-sm font-bold text-swu-amber tabular-nums">
                  {i + 1}
                </td>
                <td className="py-2.5 pr-2">
                  <div className="flex items-center gap-2">
                    <Avatar avatar={f.avatar} size={26} anillo={f.clave} />
                    <div className="min-w-0">
                      <span className="block truncate text-sm text-swu-text">{f.nombre}</span>
                      {!f.user_id && (
                        <span className="font-mono text-[9px] uppercase text-swu-muted">sin cuenta</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-2.5 text-right font-mono text-sm text-swu-muted tabular-nums">
                  {f.fechas_jugadas}
                </td>
                <td className="py-2.5 text-right font-mono text-sm font-bold text-swu-text tabular-nums">
                  {f.sp_total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] leading-relaxed text-swu-muted">
        Los puntos salen del puesto de cada torneo cerrado. Quien jugó sin cuenta
        entra igual, agrupado por su nombre — el día que se registre, su historial
        se une solo.
      </p>
    </div>
  )
}

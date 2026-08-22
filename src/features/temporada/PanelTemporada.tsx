/**
 * PanelTemporada — la portada del Centro: las temporadas y su estado.
 *
 * Una temporada es «varias fechas que se suman a una tabla». Acá se crean,
 * se ven de un vistazo y se entra a operarlas.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ChevronRight, AlertCircle } from 'lucide-react'
import { HudPanel } from '../../components/Hud'
import { BeskarIcon } from '../../components/SWIcons'
import {
  listarTemporadas, crearTemporada, type TemporadaCompetitiva,
} from '../../services/centroTemporada'

const ESTADO_TONO: Record<string, string> = {
  borrador: 'text-swu-muted bg-swu-surface',
  activa: 'text-swu-green bg-swu-green/10',
  cerrada: 'text-swu-amber bg-swu-amber/10',
}

/** Los sábados desde una fecha, para no escribirlos a mano al crear. */
function sabados(desde: string, cuantos: number): string[] {
  const out: string[] = []
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(desde)
  if (!m) return out
  // UTC a propósito: sumar días sobre una fecha local cruza el cambio de hora.
  const base = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  for (let i = 0; i < cuantos; i++) {
    const d = new Date(base + i * 7 * 86400000)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export function PanelTemporada() {
  const [temporadas, setTemporadas] = useState<TemporadaCompetitiva[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [recarga, setRecarga] = useState(0)

  const [nombre, setNombre] = useState('Holocron Season I')
  const [empieza, setEmpieza] = useState('2026-08-29')
  const [fechas, setFechas] = useState(4)
  const [corte, setCorte] = useState(4)
  const [conDescarte, setConDescarte] = useState(false)

  /* La carga vive DENTRO del efecto, con bandera de vida.
   *
   * Llamar a un `useCallback` que escribe estado desde el cuerpo del efecto
   * dispara renders en cascada (y el lint lo rechaza). Con la bandera además
   * se arregla un fallo real: si alguien sale de la pantalla mientras la
   * consulta viaja, la respuesta ya no escribe sobre un componente muerto.
   *
   * `recarga` es el disparador: los manejadores lo suben y el efecto vuelve
   * a correr. Así hay UN solo camino de carga, no dos que se separen. */
  useEffect(() => {
    let vivo = true
    void (async () => {
      const r = await listarTemporadas()
      if (!vivo) return
      if (r.ok) { setTemporadas(r.datos); setError(null) } else { setError(r.mensaje) }
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [recarga])

  const dias = sabados(empieza, fechas)
  const termina = dias[dias.length - 1] ?? empieza
  // Las clasificatorias son todas menos la final.
  const clasificatorias = Math.max(1, fechas - 1)

  async function crear() {
    setCreando(true)
    const r = await crearTemporada({
      nombre: nombre.trim(),
      empieza,
      termina,
      corte_final: corte,
      cuentan: conDescarte ? Math.max(1, clasificatorias - 1) : null,
      ajuste_sala_chica: true,
    })
    setCreando(false)
    if (!r.ok) { setError(r.mensaje); return }
    setError(null)
    setRecarga(n => n + 1)
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-swu-amber">
          Centro de temporada
        </p>
        <h1 className="text-2xl font-black text-swu-text">Temporadas</h1>
        <p className="text-sm text-swu-muted max-w-prose">
          Varias fechas que se suman a una sola tabla, más una final. Los puntos
          salen del puesto de cada torneo cerrado — no hay nada que cargar a mano.
        </p>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-swu-red/40 bg-swu-red/10 p-3">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-swu-red-texto" />
          <p className="text-sm text-swu-red-texto">{error}</p>
        </div>
      )}

      {/* ── Crear ── */}
      <HudPanel tone="amber">
        <div className="p-4 space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-swu-text">
            <Plus size={15} className="text-swu-amber" /> Nueva temporada
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-swu-muted">Nombre</span>
              <input
                value={nombre} onChange={e => setNombre(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-swu-border bg-swu-bg px-3
                           text-sm text-swu-text focus-visible:outline-none focus-visible:ring-2
                           focus-visible:ring-swu-accent"
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-swu-muted">Primer sábado</span>
              <input
                type="date" value={empieza} onChange={e => setEmpieza(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-swu-border bg-swu-bg px-3
                           text-sm text-swu-text focus-visible:outline-none focus-visible:ring-2
                           focus-visible:ring-swu-accent"
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-swu-muted">
                Fechas en total (con la final)
              </span>
              <input
                type="number" min={2} max={16} value={fechas}
                onChange={e => setFechas(Math.max(2, Math.min(16, Number(e.target.value) || 2)))}
                className="w-full min-h-[44px] rounded-lg border border-swu-border bg-swu-bg px-3
                           text-sm text-swu-text focus-visible:outline-none focus-visible:ring-2
                           focus-visible:ring-swu-accent"
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-swu-muted">
                Clasifican a la final
              </span>
              <input
                type="number" min={2} max={32} value={corte}
                onChange={e => setCorte(Math.max(2, Math.min(32, Number(e.target.value) || 2)))}
                className="w-full min-h-[44px] rounded-lg border border-swu-border bg-swu-bg px-3
                           text-sm text-swu-text focus-visible:outline-none focus-visible:ring-2
                           focus-visible:ring-swu-accent"
              />
            </label>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox" checked={conDescarte}
              onChange={e => setConDescarte(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-swu-amber"
            />
            <span className="text-xs text-swu-muted">
              Descartar la peor fecha
              {clasificatorias <= 3 && (
                <span className="block text-swu-amber">
                  Con {clasificatorias} clasificatorias, descartar deja solo{' '}
                  {Math.max(1, clasificatorias - 1)} contando: faltar deja de costar.
                </span>
              )}
            </span>
          </label>

          <div className="rounded-lg bg-swu-bg/60 p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-swu-muted">Quedaría</p>
            <p className="mt-1 text-xs text-swu-text">
              {clasificatorias} clasificatoria{clasificatorias === 1 ? '' : 's'} + final ·{' '}
              {dias[0]} → {termina} · top {corte} a la final
            </p>
          </div>

          <button
            onClick={() => void crear()}
            disabled={creando || !nombre.trim()}
            className="flex min-h-[44px] items-center gap-2 rounded-lg bg-swu-accent px-4 text-sm
                       font-semibold text-white disabled:opacity-50"
          >
            <Plus size={15} /> {creando ? 'Creando…' : 'Crear temporada'}
          </button>
        </div>
      </HudPanel>

      {/* ── Lista ── */}
      {cargando ? (
        <p className="text-sm text-swu-muted animate-pulse">Cargando temporadas…</p>
      ) : temporadas.length === 0 ? (
        <p className="text-sm text-swu-muted">Todavía no hay ninguna temporada.</p>
      ) : (
        <div className="space-y-2">
          {temporadas.map(t => (
            <Link key={t.id} to={`/temporada/${t.id}`} className="block">
              <HudPanel compact className="transition-colors hover:bg-swu-surface-hover">
                <div className="flex items-center gap-3 p-3.5">
                  <BeskarIcon size={20} className="flex-shrink-0 text-swu-amber" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-swu-text">{t.nombre}</p>
                    <p className="font-mono text-[11px] text-swu-muted">
                      {t.empieza} → {t.termina} · top {t.corte_final}
                      {t.cuentan ? ` · cuentan ${t.cuentan}` : ' · cuentan todas'}
                    </p>
                  </div>
                  <span className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase ${ESTADO_TONO[t.estado]}`}>
                    {t.estado}
                  </span>
                  <ChevronRight size={16} className="flex-shrink-0 text-swu-muted" />
                </div>
              </HudPanel>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

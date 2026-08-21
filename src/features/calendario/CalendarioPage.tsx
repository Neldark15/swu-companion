/**
 * CALENDARIO — el mes de un vistazo, y el día que tocás abajo con su afiche.
 *
 * ── Por qué rejilla Y lista, y no una sola de las dos ────────────────
 *
 * A 375 px las siete columnas dejan ~48 px por casilla: ahí no cabe el nombre
 * de un torneo, solo un punto. Una rejilla sola no dice NADA de lo que pasa el
 * sábado; una agenda sola, con ~2 eventos por semana, es una lista con mucho
 * aire y sin la forma del mes.
 *
 * Juntas cada una hace lo suyo: la rejilla es para VER EL RITMO —todos los
 * sábados encendidos, dos puntos cuando juegan las dos sedes— y la lista de
 * abajo es donde de verdad se lee el evento, con su foto, su hora y su sede.
 *
 * ── El color es la SEDE, no el estado ────────────────────────────────
 *
 * Sale de `venues.accent`, el mismo tono con el que la sede se pinta en toda la
 * app. Así el punto ámbar de la rejilla y la ficha ámbar de Sonsonate son
 * reconociblemente lo mismo sin leer una palabra. El estado (terminado,
 * cancelado) se dice con TEXTO, no con color: si el color hiciera las dos
 * cosas, un torneo cancelado en Sonsonate y uno abierto en San Salvador serían
 * indistinguibles.
 *
 * ── Y la rejilla es de seis semanas SIEMPRE ──────────────────────────
 *
 * Aunque el mes entre en cinco. Si el alto cambiara al pasar de mes, la lista
 * de abajo daría un brinco a mitad del gesto — es la misma lección de las hojas
 * del álbum, que encogían 321 px al pasar a la última (§3i).
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, MapPin, Clock, Users } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { MandoTrophyIcon } from '../../components/SWIcons'
import {
  eventosDelMes, porDia, casillasDelMes, type EventoCalendario,
} from '../../services/calendario'
import { diaCalendarioSV, hora } from '../../services/horaSV'

const DIAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/** Los tonos de sede, en el vocabulario del HUD. */
const TONO: Record<string, { punto: string; texto: string; borde: string; fondo: string }> = {
  cyan:   { punto: 'bg-swu-cyan',   texto: 'text-swu-cyan',       borde: 'border-swu-cyan/40',   fondo: 'bg-swu-cyan/10' },
  amber:  { punto: 'bg-swu-amber',  texto: 'text-swu-amber',      borde: 'border-swu-amber/40',  fondo: 'bg-swu-amber/10' },
  green:  { punto: 'bg-swu-green',  texto: 'text-swu-green',      borde: 'border-swu-green/40',  fondo: 'bg-swu-green/10' },
  red:    { punto: 'bg-swu-red',    texto: 'text-swu-red-texto',  borde: 'border-swu-red/40',    fondo: 'bg-swu-red/10' },
  purple: { punto: 'bg-purple-400', texto: 'text-purple-300',     borde: 'border-purple-400/40', fondo: 'bg-purple-400/10' },
}
const tono = (a?: string) => TONO[a ?? 'cyan'] ?? TONO.cyan

const ESTADO: Record<EventoCalendario['status'], string | null> = {
  open: null,               // lo normal: no se rotula
  active: 'En curso',
  finished: 'Terminado',
  cancelled: 'Cancelado',
}

export function CalendarioPage() {
  const hoy = diaCalendarioSV(new Date())
  const [ancla, setAncla] = useState(() => new Date())
  /**
   * Los eventos guardados JUNTO al mes de quién son.
   *
   * No se hace `setEventos(null)` al principio del efecto: eso encadena un
   * render antes de que React pinte, y el lint del repo lo marca. Guardando la
   * clave del mes al lado, los datos del mes anterior dejan de valer solos en
   * cuanto cambia el ancla — sin un `setState` de más y sin un fotograma
   * mostrando agosto con el encabezado de septiembre.
   */
  const [cargado, setCargado] = useState<{ mes: string; datos: EventoCalendario[] } | null>(null)
  const [elegido, setElegido] = useState<string>(hoy)
  /** Filtro por sede. `null` = todas. */
  const [sedeFiltro, setSedeFiltro] = useState<string | null>(null)

  const mesActual = diaCalendarioSV(ancla).slice(0, 7)
  const eventos = cargado && cargado.mes === mesActual ? cargado.datos : null

  useEffect(() => {
    let vivo = true
    void eventosDelMes(ancla).then(e => {
      if (vivo) setCargado({ mes: diaCalendarioSV(ancla).slice(0, 7), datos: e })
    })
    return () => { vivo = false }
  }, [ancla])

  const visibles = useMemo(
    () => (eventos ?? []).filter(e => !sedeFiltro || e.sede?.id === sedeFiltro),
    [eventos, sedeFiltro],
  )
  const mapa = useMemo(() => porDia(visibles), [visibles])
  const casillas = useMemo(() => casillasDelMes(ancla), [ancla])

  // Las sedes que aparecen ESTE mes, para los chips. No se listan todas las de
  // la base: un chip que siempre da cero resultados es un botón que miente.
  const sedes = useMemo(() => {
    const m = new Map<string, { id: string; name: string; city: string | null; accent: string }>()
    for (const e of eventos ?? []) if (e.sede) m.set(e.sede.id, e.sede)
    return [...m.values()]
  }, [eventos])

  const delDia = mapa.get(elegido) ?? []
  const [a, m] = diaCalendarioSV(ancla).split('-').map(Number)

  const correrMes = (d: number) => {
    setAncla(prev => {
      const [pa, pm] = diaCalendarioSV(prev).split('-').map(Number)
      return new Date(Date.UTC(pa, pm - 1 + d, 15))
    })
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-3 pb-24">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-black tracking-tight text-swu-text">Calendario</h1>
        <div className="flex items-center gap-1">
          {/* 44×44 de área táctil, no el tamaño del ícono. */}
          <button
            onClick={() => correrMes(-1)}
            aria-label="Mes anterior"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-swu-muted hover:text-swu-text"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="min-w-[8.5rem] text-center text-sm font-bold text-swu-text tabular-nums">
            {MESES[m - 1]} {a}
          </span>
          <button
            onClick={() => correrMes(1)}
            aria-label="Mes siguiente"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-swu-muted hover:text-swu-text"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {/* Los chips de sede. Con una sola sede en el mes no se dibujan: elegir
          entre una opción no es elegir. */}
      {sedes.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => setSedeFiltro(null)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${
              sedeFiltro === null ? 'bg-swu-surface-hover text-swu-text' : 'bg-swu-surface text-swu-muted'
            }`}
          >
            Todas
          </button>
          {sedes.map(s => {
            const t = tono(s.accent)
            const activo = sedeFiltro === s.id
            return (
              <button
                key={s.id}
                onClick={() => setSedeFiltro(activo ? null : s.id)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                  activo ? `${t.fondo} ${t.texto}` : 'bg-swu-surface text-swu-muted'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${t.punto}`} />
                {s.city ?? s.name}
              </button>
            )
          })}
        </div>
      )}

      {/* ── La rejilla ── */}
      <div className="clip-hud bg-swu-surface p-2.5">
        <div className="mb-1 grid grid-cols-7">
          {DIAS.map((d, i) => (
            <span key={i} className="text-center text-[10px] font-black tracking-wider text-swu-muted">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {casillas.map(c => {
            const delDiaC = mapa.get(c.dia) ?? []
            const esHoy = c.dia === hoy
            const esElegido = c.dia === elegido
            const numero = Number(c.dia.slice(-2))
            return (
              <button
                key={c.dia}
                onClick={() => setElegido(c.dia)}
                aria-label={`${numero}, ${delDiaC.length} ${delDiaC.length === 1 ? 'evento' : 'eventos'}`}
                aria-current={esElegido ? 'date' : undefined}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-lg transition-colors ${
                  esElegido ? 'bg-swu-accent/25' : delDiaC.length > 0 ? 'bg-swu-surface-hover' : ''
                }`}
              >
                <span className={`text-xs tabular-nums ${
                  !c.delMes ? 'text-swu-muted/35'
                  : esHoy ? 'font-black text-swu-accent-texto'
                  : 'text-swu-text'
                }`}>
                  {numero}
                </span>
                {/* Un punto por SEDE, no por evento: dos torneos de la misma
                    sede el mismo día son un punto, no dos iguales pegados. */}
                {delDiaC.length > 0 && (
                  <span className="absolute bottom-1 flex gap-0.5">
                    {[...new Set(delDiaC.map(e => e.sede?.accent ?? 'cyan'))].map(ac => (
                      <span key={ac} className={`h-1.5 w-1.5 rounded-full ${tono(ac).punto}`} />
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── El día elegido ── */}
      <section className="mt-4">
        <h2 className="mb-1.5 px-1 text-[10px] font-black tracking-[0.22em] text-swu-muted uppercase">
          {elegido === hoy ? 'Hoy' : elegido.split('-').reverse().join('/')}
        </h2>

        {eventos === null && <div className="h-24 animate-pulse rounded-xl bg-swu-surface" />}

        {eventos !== null && delDia.length === 0 && (
          <EmptyState
            icon={<MandoTrophyIcon size={26} />}
            title="Nada este día"
            hint="Tocá otro día en la rejilla. Los sábados hay torneo en las dos sedes."
          />
        )}

        <ul className="space-y-2">
          {delDia.map(e => {
            const t = tono(e.sede?.accent)
            const rotulo = ESTADO[e.status]
            // Si el evento no trae afiche propio, cae al banner de la sede: es
            // mejor la foto del local que un rectángulo gris.
            const foto = e.imageUrl ?? e.sede?.bannerUrl ?? null
            return (
              <li key={e.id}>
                <Link
                  to={`/torneos/${e.code}`}
                  className={`clip-hud block overflow-hidden border ${t.borde} bg-swu-surface`}
                >
                  {foto && (
                    <img
                      src={foto}
                      alt=""
                      loading="lazy"
                      className="h-28 w-full object-cover"
                    />
                  )}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black text-swu-text">{e.name}</span>
                        <span className={`mt-0.5 flex items-center gap-1 text-[11px] ${t.texto}`}>
                          <MapPin size={11} className="shrink-0" />
                          <span className="truncate">{e.sede?.name ?? e.location ?? 'Sin sede'}</span>
                        </span>
                      </span>
                      {/* El estado va en TEXTO. El color ya lo ocupa la sede. */}
                      {rotulo && (
                        <span className="shrink-0 rounded bg-swu-surface-hover px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-swu-muted uppercase">
                          {rotulo}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-swu-muted tabular-nums">
                      <span className="flex items-center gap-1"><Clock size={11} />{hora(e.date)}</span>
                      {e.maxPlayers && (
                        <span className="flex items-center gap-1"><Users size={11} />{e.maxPlayers} cupos</span>
                      )}
                      {e.format && <span className="uppercase">{e.format}</span>}
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

/**
 * MesasPanel — armar y anotar un torneo de MESAS (Twin Suns).
 *
 * Vive en `features/events/` y no en `features/temporada/`: llevar un torneo
 * de mesas es una función de TORNEOS. Estuvo un rato dentro del Centro de
 * Temporada y estaba mal — el Centro lo ve una sola persona, así que ningún
 * otro organizador podía operar un Twin Suns.
 *
 * ── Elegir cuántas mesas no es un capricho ────────────────────────────
 *
 * Con 12 jugadores se puede jugar **3 mesas de 4** o **4 mesas de 3**, y
 * son torneos distintos: una mesa de 4 dura más y reparte 3/2/1/0, una de 3
 * reparte 3/2/1. Por eso lo elige el organizador y no una fórmula.
 *
 * El selector ofrece SOLO los números que cierran —`3M ≤ N ≤ 4M`— y enseña
 * el reparto literal («4 + 3 + 3») antes de armar. El servidor revalida:
 * el cliente no valida nada de verdad.
 *
 * ── Se puede rehacer, hasta que se juegue ─────────────────────────────
 *
 * `armar_mesas` reemplaza la ronda si todavía NADIE tiene puesto anotado.
 * Así el organizador puede volver a repartir si alguien llegó tarde, sin
 * inventar un botón de «borrar ronda» que en el momento equivocado
 * destruiría resultados.
 */

import { useMemo, useState } from 'react'
import { AlertCircle, Check, Play, Shuffle, Trophy } from 'lucide-react'
import { HudPanel } from '../../components/Hud'
import {
  mesasPosibles, composicion, dibujarComposicion, porQueNo, repartir, armarRondaSiguiente,
  PUNTOS_MESA, type Composicion,
} from '../../services/mesas'
import {
  armarMesas, guardarPuestosMesa, fijarPuestosFinales,
  type MesaArmada, type AsientoPropuesto,
} from '../../services/mesasService'
import type { CloudStanding } from '../../services/tournamentCloud'

interface Props {
  eventId: string
  cerrado: boolean
  standings: CloudStanding[]
  ronda: { id: string; numero: number } | null
  mesas: MesaArmada[]
  ocupado: boolean
  onCambio: () => void
  onAviso: (m: string) => void
  onError: (m: string) => void
  /** Sembrar la clasificación con los inscritos. Ver el bucle de abajo. */
  onSembrar: () => void
}

export function MesasPanel({
  eventId, cerrado, standings, ronda, mesas, ocupado, onCambio, onAviso, onError, onSembrar,
}: Props) {
  const activos = useMemo(() => standings.filter(s => !s.dropped), [standings])
  const n = activos.length
  const opciones = useMemo(() => mesasPosibles(n), [n])
  const [elegida, setElegida] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Por defecto, la primera opción válida — casi siempre la de mesas de 4.
  const sel: Composicion | null =
    (elegida !== null ? composicion(n, elegida) : null) ?? opciones[0] ?? null

  const yaArmada = mesas.length > 0
  const hayPuntos = activos.some(s => s.points > 0)
  const todasAnotadas = yaArmada && mesas.every(m => m.anotada)

  async function armar() {
    /* Con la ronda YA anotada, la siguiente no se reparte de nuevo: se arma
       con los PUESTOS de la anterior. Los ganadores de cada mesa van a la
       final y el resto se agrupa por puesto — que es el formato que se juega
       acá y lo que hace que «ganar tu mesa» signifique algo. */
    if (todasAnotadas) {
      const previos = mesas.flatMap(m => m.jugadores.map(j => ({
        userId: j.user_id ?? null,
        nombre: j.player_name,
        orden: 0,
        mesaAnterior: m.mesa,
        puesto: j.puesto ?? 0,
      })))
      const siguientes = armarRondaSiguiente(previos)
      if (siguientes.length === 0) {
        onError('Faltan puestos por anotar en la ronda anterior.')
        return
      }
      setGuardando(true)
      const r = await armarMesas(eventId, siguientes.map(a => ({
        user_id: a.userId, player_name: a.nombre, mesa: a.mesa,
      })))
      setGuardando(false)
      if (r.ok) {
        onAviso(`Ronda ${r.datos.ronda} · la mesa 1 es la final`)
        onCambio()
      } else onError(r.mensaje)
      return
    }

    if (!sel) return
    const problema = porQueNo(n, sel.mesas)
    if (problema) { onError(problema); return }

    const asientos: AsientoPropuesto[] = repartir(
      activos.map(s => ({
        userId: s.user_id ?? null,
        nombre: s.player_name,
        /* Por puntos si ya hay puntos; si no, por semilla.
         *
         * Antes la condición era «¿ya existe una ronda?», y eso fallaba justo
         * en el caso que el botón «Volver a repartir» existe para cubrir: la
         * ronda 1 ya existe pero nadie tiene puntos todavía, así que ordenaba
         * por 0 para todos y la serpentina repartía por orden alfabético. */
        orden: hayPuntos ? s.points : -(s.seed ?? 999),
      })),
      sel,
    ).map(a => ({ user_id: a.userId, player_name: a.nombre, mesa: a.mesa }))

    setGuardando(true)
    const r = await armarMesas(eventId, asientos)
    setGuardando(false)
    if (r.ok) { onAviso(`Ronda ${r.datos.ronda} · ${r.datos.mesas} mesas`); onCambio() }
    else onError(r.mensaje)
  }

  if (n === 0) {
    /* El botón de sembrar vive ACÁ, no en otra pestaña.
     *
     * Era un bucle cerrado: este panel mandaba a la pestaña Rondas, y Rondas
     * —al ser un torneo de mesas— solo mostraba un cartel que mandaba de
     * vuelta acá. El único botón que podía arrancar el torneo no se dibujaba
     * en ninguna de las dos, así que un Twin Suns no se podía empezar de
     * ninguna forma. Es la tercera vez que aparece esta forma: una capacidad
     * que existe entera y no tiene puerta desde ningún lado. */
    return (
      <div className="space-y-3">
        <p className="text-sm text-swu-muted">
          Todavía no hay clasificación. Sembrala con los inscritos y ya podés
          armar las mesas.
        </p>
        {!cerrado && (
          <button
            onClick={onSembrar}
            disabled={ocupado}
            className="min-h-[48px] w-full rounded-xl bg-swu-accent text-sm font-bold text-white disabled:opacity-50"
          >
            {ocupado ? 'Sembrando…' : '🚀 Iniciar torneo y sembrar'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Elegir cuántas mesas ── */}
      {!cerrado && (
        <HudPanel compact tone={opciones.length === 0 ? 'red' : 'amber'}>
          <div className="space-y-3 p-3.5">
            <div>
              {/* Tres estados, no dos: sin mesas se ARMA la primera; con
                  mesas a medio anotar se REARMA la misma; con todo anotado el
                  botón crea la SIGUIENTE. Decía «Rearmar la ronda 1» justo
                  cuando iba a crear la 2. */}
              <p className="text-sm font-bold text-swu-text">
                {!yaArmada
                  ? `Armar la ronda ${(ronda?.numero ?? 0) + 1}`
                  : todasAnotadas
                    ? `Armar la ronda ${(ronda?.numero ?? 1) + 1}`
                    : `Rearmar la ronda ${ronda?.numero ?? 1}`}
              </p>
              <p className="text-xs text-swu-muted">
                {n} jugador{n === 1 ? '' : 'es'} activo{n === 1 ? '' : 's'}
                {todasAnotadas && ' · esta ronda ya está anotada. La siguiente se arma con los ganadores: la mesa 1 será la final'}
              </p>
            </div>

            {opciones.length === 0 ? (
              <p className="text-sm text-swu-red-texto">{porQueNo(n, 1)}</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {opciones.map(o => {
                    const activa = sel?.mesas === o.mesas
                    return (
                      <button
                        key={o.mesas}
                        onClick={() => setElegida(o.mesas)}
                        className={`min-h-[44px] rounded-lg px-3 text-left transition-colors ${
                          activa
                            ? 'bg-swu-amber/20 text-swu-amber ring-1 ring-swu-amber/50'
                            : 'border border-swu-border text-swu-muted hover:text-swu-text'
                        }`}
                      >
                        <span className="block text-sm font-bold">
                          {o.mesas} mesa{o.mesas === 1 ? '' : 's'}
                        </span>
                        <span className="block font-mono text-[10px]">{dibujarComposicion(o)}</span>
                      </button>
                    )
                  })}
                </div>

                {opciones.length === 1 && (
                  <p className="text-[11px] text-swu-muted">
                    Con {n} jugadores solo cierra de una forma. Elegir importa desde 12
                    (3 mesas de 4, o 4 de 3).
                  </p>
                )}

                <button
                  onClick={() => void armar()}
                  disabled={ocupado || guardando || !sel}
                  className="flex min-h-[44px] items-center gap-2 rounded-lg bg-swu-accent px-4
                             text-sm font-semibold text-white disabled:opacity-50"
                >
                  {yaArmada && !todasAnotadas ? <Shuffle size={15} /> : <Play size={15} />}
                  {guardando
                    ? 'Armando…'
                    : yaArmada && !todasAnotadas
                      ? 'Volver a repartir'
                      : yaArmada
                        ? `Armar la ronda ${(ronda?.numero ?? 1) + 1}`
                        : 'Armar mesas'}
                </button>
              </>
            )}
          </div>
        </HudPanel>
      )}

      {/* ── Las mesas ── */}
      {yaArmada && (
        <div className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-swu-muted">
            Ronda {ronda?.numero} · {mesas.length} mesa{mesas.length === 1 ? '' : 's'}
          </p>
          {mesas.map(m => (
            <Mesa
              /* La clave lleva la RONDA, no solo el número de mesa.
               *
               * `armar_mesas` numera las mesas desde 1 en cada ronda, así que
               * con `key={m.mesa}` React reutilizaba la MISMA instancia entre
               * rondas — y el estado de puestos, que se inicializa una sola vez,
               * llegaba a la ronda 2 con lo anotado en la 1. Guardar ahí habría
               * escrito los puestos de la ronda anterior como si fueran nuevos. */
              key={`${ronda?.id ?? 'r'}-${m.mesa}`}
              mesa={m}
              rondaId={ronda?.id ?? ''}
              bloqueada={cerrado}
              onGuardado={onCambio}
              onAviso={onAviso}
              onError={onError}
            />
          ))}
        </div>
      )}

      {/* ── Clasificación final ── */}
      {yaArmada && !cerrado && (
        <HudPanel compact tone={todasAnotadas ? 'amber' : 'neutral'}>
          <div className="space-y-2 p-3.5">
            <p className="text-sm font-bold text-swu-text">Fijar la clasificación final</p>
            <p className="text-xs leading-relaxed text-swu-muted">
              Escribe el puesto de cada jugador según los puntos de mesa acumulados.
              Hay que hacerlo <strong>antes</strong> de cerrar: si el puesto queda vacío,
              el torneo desaparece de la tabla de la temporada sin dar ningún error.
            </p>
            <button
              onClick={async () => {
                setGuardando(true)
                const r = await fijarPuestosFinales(eventId)
                setGuardando(false)
                if (r.ok) { onAviso(`Clasificación fijada para ${r.datos} jugadores`); onCambio() }
                else onError(r.mensaje)
              }}
              disabled={ocupado || guardando || !todasAnotadas}
              className="flex min-h-[44px] items-center gap-2 rounded-lg border border-swu-border
                         px-4 text-sm font-semibold text-swu-text disabled:opacity-40"
            >
              <Trophy size={15} />
              {todasAnotadas ? 'Fijar clasificación' : 'Faltan puestos por anotar'}
            </button>
          </div>
        </HudPanel>
      )}
    </div>
  )
}

/* ── Una mesa ──────────────────────────────────────────────────────── */

function Mesa({
  mesa, rondaId, bloqueada, onGuardado, onAviso, onError,
}: {
  mesa: MesaArmada
  rondaId: string
  bloqueada: boolean
  onGuardado: () => void
  onAviso: (m: string) => void
  onError: (m: string) => void
}) {
  const k = mesa.jugadores.length

  /* Lo que se está editando, DERIVADO de lo guardado.
   *
   * El inicializador perezoso corre una sola vez, así que si llegan datos
   * nuevos sin que el componente se desmonte (una recarga tras guardar, o el
   * refresco de otro admin) seguía mostrando lo viejo. Se guarda junto a la
   * foto sobre la que se editó: cuando esa foto cambia, lo editado deja de
   * aplicar solo. */
  const foto = mesa.jugadores.map(j => `${j.id}:${j.puesto}`).join('|')
  const [editado, setEditado] = useState<{ foto: string; v: Record<string, number | null> } | null>(null)
  const guardadoActual = Object.fromEntries(mesa.jugadores.map(j => [j.player_name, j.puesto]))
  const puestos = editado?.foto === foto ? editado.v : guardadoActual
  const setPuestos = (f: (p: Record<string, number | null>) => Record<string, number | null>) =>
    setEditado({ foto, v: f(puestos) })
  const [guardando, setGuardando] = useState(false)

  const asignados = Object.values(puestos).filter(p => p !== null) as number[]
  const completa = asignados.length === k && new Set(asignados).size === k

  function poner(nombre: string, puesto: number) {
    setPuestos(prev => {
      const n = { ...prev }
      // Un puesto solo puede ser de uno: si ya lo tenía otro, se lo quita.
      for (const [k2, v] of Object.entries(n)) if (v === puesto && k2 !== nombre) n[k2] = null
      n[nombre] = n[nombre] === puesto ? null : puesto
      return n
    })
  }

  async function guardar() {
    if (!completa) return
    setGuardando(true)
    const r = await guardarPuestosMesa(
      rondaId,
      mesa.mesa,
      mesa.jugadores.map(j => ({ player_name: j.player_name, puesto: puestos[j.player_name] as number })),
    )
    setGuardando(false)
    if (r.ok) { onAviso(`Mesa ${mesa.mesa} anotada`); onGuardado() }
    else onError(r.mensaje)
  }

  return (
    <HudPanel compact tone={mesa.anotada ? 'green' : 'neutral'}>
      <div className="space-y-2.5 p-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg
                           bg-swu-bg font-mono text-sm font-bold text-swu-amber">
            {mesa.mesa}
          </span>
          <p className="flex-1 text-sm font-bold text-swu-text">
            Mesa {mesa.mesa} · {k} jugadores
          </p>
          {mesa.anotada && <Check size={16} className="text-swu-green" />}
        </div>

        <div className="space-y-1.5">
          {mesa.jugadores.map(j => (
            <div key={j.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm text-swu-text">
                {j.player_name}
                {!j.user_id && (
                  <span className="ml-1.5 font-mono text-[9px] uppercase text-swu-muted">sin cuenta</span>
                )}
              </span>
              <div className="flex flex-shrink-0 gap-1">
                {Array.from({ length: k }, (_, i) => i + 1).map(p => {
                  const activo = puestos[j.player_name] === p
                  return (
                    <button
                      key={p}
                      onClick={() => poner(j.player_name, p)}
                      disabled={bloqueada}
                      aria-label={`${j.player_name}, puesto ${p}`}
                      className={`flex h-11 w-9 items-center justify-center rounded font-mono text-sm
                                  font-bold transition-colors disabled:opacity-40 ${
                        activo
                          ? 'bg-swu-amber/25 text-swu-amber ring-1 ring-swu-amber/50'
                          : 'bg-swu-bg text-swu-muted'
                      }`}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <p className="font-mono text-[10px] text-swu-muted">
          {mesa.jugadores.map((_, i) => `${i + 1}.º = ${PUNTOS_MESA[i]}`).slice(0, k).join(' · ')} puntos
        </p>

        {!bloqueada && (
          <button
            onClick={() => void guardar()}
            disabled={!completa || guardando}
            className="flex min-h-[44px] items-center gap-2 rounded-lg border border-swu-border px-3
                       text-xs font-semibold text-swu-text disabled:opacity-40"
          >
            {completa ? <Check size={14} /> : <AlertCircle size={14} />}
            {guardando ? 'Guardando…' : completa ? 'Guardar puestos' : `Faltan puestos (${asignados.length}/${k})`}
          </button>
        )}
      </div>
    </HudPanel>
  )
}

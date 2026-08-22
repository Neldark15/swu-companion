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
  mesasPosibles, composicion, dibujarComposicion, porQueNo, repartir,
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
}

export function MesasPanel({
  eventId, cerrado, standings, ronda, mesas, ocupado, onCambio, onAviso, onError,
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
  const todasAnotadas = yaArmada && mesas.every(m => m.anotada)

  async function armar() {
    if (!sel) return
    const problema = porQueNo(n, sel.mesas)
    if (problema) { onError(problema); return }

    const asientos: AsientoPropuesto[] = repartir(
      activos.map(s => ({
        userId: s.user_id ?? null,
        nombre: s.player_name,
        // Ronda 1: por semilla. Después: por puntos, para que la serpentina
        // reparta según la tabla y no según quién se inscribió antes.
        orden: (ronda?.numero ?? 0) === 0 ? -(s.seed ?? 999) : s.points,
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
    return (
      <p className="text-sm text-swu-muted">
        Primero hay que sembrar la clasificación, en la pestaña de Inscritos.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Elegir cuántas mesas ── */}
      {!cerrado && (
        <HudPanel compact tone={opciones.length === 0 ? 'red' : 'amber'}>
          <div className="space-y-3 p-3.5">
            <div>
              <p className="text-sm font-bold text-swu-text">
                {yaArmada ? `Rearmar la ronda ${ronda?.numero ?? 1}` : `Armar la ronda ${(ronda?.numero ?? 0) + 1}`}
              </p>
              <p className="text-xs text-swu-muted">
                {n} jugador{n === 1 ? '' : 'es'} activo{n === 1 ? '' : 's'}
                {todasAnotadas && ' · esta ronda ya está anotada, armar creará la siguiente'}
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
                  {guardando ? 'Armando…' : yaArmada && !todasAnotadas ? 'Volver a repartir' : 'Armar mesas'}
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
              key={m.mesa}
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
        <HudPanel compact>
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
              disabled={ocupado || guardando}
              className="flex min-h-[44px] items-center gap-2 rounded-lg border border-swu-border
                         px-4 text-sm font-semibold text-swu-text disabled:opacity-50"
            >
              <Trophy size={15} /> Fijar clasificación
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
  // Lo que se está editando. Arranca de lo guardado.
  const [puestos, setPuestos] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(mesa.jugadores.map(j => [j.player_name, j.puesto])),
  )
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

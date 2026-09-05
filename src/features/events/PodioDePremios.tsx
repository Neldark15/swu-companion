/**
 * El podio de premios: lo que se lleva cada puesto.
 *
 * ── Por qué es público y el formulario no ────────────────────────────
 *
 * Anunciar los premios es como se llena un torneo: quien duda si va, lo que
 * mira es esto. Por eso el podio lo ve cualquiera —hasta sin cuenta—, y lo
 * único reservado es la FORMA DE AGREGARLOS.
 *
 * ── Los dos tipos, separados a propósito ─────────────────────────────
 *
 * Los sobres y la XP los da el sistema y se acreditan solos al cerrar; los
 * físicos los pone la tienda y se entregan en la mano. Mezclarlos en una sola
 * línea haría que alguien esperara que su playmat le apareciera en la app.
 *
 * La escala de sobres se PREGUNTA al servidor, no se escribe acá: es la misma
 * función con la que se reparte al cerrar. Copiarla sería anunciar una cosa y
 * repartir otra el día que cambie.
 */

import { useCallback, useEffect, useState } from 'react'
import { Trophy, Gift, Package, Plus, Trash2, Loader2 } from 'lucide-react'
import {
  getPremiosFisicos, getEscalaVirtual, agregarPremio, borrarPremio, escucharPremios,
  type PremioFisico, type EscalonVirtual,
} from '../../services/premiosTorneo'

const MEDALLA: Record<number, string> = { 1: 'text-swu-amber', 2: 'text-slate-300', 3: 'text-orange-400' }

export function PodioDePremios({ eventId, puedoEditar }: {
  eventId: string
  /** Solo quien lleva el torneo ve el formulario. El podio lo ve todo el mundo. */
  puedoEditar: boolean
}) {
  const [fisicos, setFisicos] = useState<PremioFisico[] | null>(null)
  const [escala, setEscala] = useState<EscalonVirtual[]>([])
  const [abriendo, setAbriendo] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    /* Hasta 9 y no 4: con una escala propia los puestos premiados pueden
       pasar del podio —acá el 4º y el 5º ganan su mesa— y cortando en 4 se
       dejaría de anunciar un premio que sí existe. Los puestos con 0 sobres
       no se pintan. */
    const [f, e] = await Promise.all([getPremiosFisicos(eventId), getEscalaVirtual(eventId, 9)])
    setFisicos(f)
    setEscala(e)
  }, [eventId])

  useEffect(() => { void (async () => { await cargar() })() }, [cargar])
  useEffect(() => escucharPremios(eventId, () => { void cargar() }), [eventId, cargar])

  // Los puestos que hay que pintar: los de la escala virtual más cualquier
  // puesto que solo tenga premio físico.
  const puestos = [...new Set([
    // Un puesto sin sobres NO se anuncia como premio: decir «0 sobres» es
    // peor que no decir nada.
    ...escala.filter(e => e.sobres > 0).map(e => e.puesto),
    ...(fisicos ?? []).filter(p => p.puesto !== null).map(p => p.puesto as number),
  ])].sort((a, b) => a - b)

  const sueltos = (fisicos ?? []).filter(p => p.puesto === null)

  return (
    <section className="space-y-2.5">
      <header className="flex items-center gap-2">
        <Trophy size={16} className="text-swu-amber" />
        <h3 className="text-sm font-black tracking-tight text-swu-text">Premios</h3>
        {puedoEditar && (
          <button
            onClick={() => setAbriendo(v => !v)}
            className="ml-auto flex items-center gap-1 rounded-lg border border-swu-border px-2 py-1 text-[11px] font-bold text-swu-text"
          >
            <Plus size={12} /> {abriendo ? 'Cerrar' : 'Agregar premio'}
          </button>
        )}
      </header>

      {puedoEditar && abriendo && (
        <FormularioPremio eventId={eventId} onListo={() => { setAbriendo(false); void cargar() }} />
      )}

      {fisicos === null ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
          No se pudieron leer los premios. No es que no haya: es que no se pudo consultar.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {puestos.map(n => {
            const v = escala.find(e => e.puesto === n)
            const f = (fisicos ?? []).filter(p => p.puesto === n)
            return (
              <li key={n} className="rounded-2xl border border-swu-border bg-swu-surface p-3">
                <div className="flex items-center gap-2">
                  <Trophy size={14} className={MEDALLA[n] ?? 'text-swu-muted'} />
                  <span className="text-[12px] font-black text-swu-text">{n}º lugar</span>
                </div>

                {/* Lo que da el sistema, con su etiqueta: se acredita solo. */}
                {v && (
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-swu-accent-texto">
                    <Gift size={12} />
                    {v.sobres} {v.sobres === 1 ? 'sobre' : 'sobres'} · {v.xp} XP
                    <span className="text-swu-muted">— se acreditan solos al cerrar</span>
                  </p>
                )}

                {/* Lo que entrega la tienda, en la mano. */}
                {f.map(p => (
                  <p key={p.id} className="mt-1 flex items-center gap-1.5 text-[11px] text-swu-text">
                    <Package size={12} className="text-swu-green" />
                    {p.descripcion}
                    {p.valor !== null && (
                      <span className="font-mono text-swu-muted">${Number(p.valor).toFixed(2)}</span>
                    )}
                    {puedoEditar && <BotonBorrar id={p.id} onListo={cargar} onFallo={setFallo} />}
                  </p>
                ))}
              </li>
            )
          })}

          {sueltos.length > 0 && (
            <li className="rounded-2xl border border-swu-border bg-swu-surface p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-swu-muted">
                Además, para todos
              </p>
              {sueltos.map(p => (
                <p key={p.id} className="mt-1 flex items-center gap-1.5 text-[11px] text-swu-text">
                  <Package size={12} className="text-swu-green" />
                  {p.descripcion}
                  {p.valor !== null && (
                    <span className="font-mono text-swu-muted">${Number(p.valor).toFixed(2)}</span>
                  )}
                  {puedoEditar && <BotonBorrar id={p.id} onListo={cargar} onFallo={setFallo} />}
                </p>
              ))}
            </li>
          )}
        </ul>
      )}

      {fallo && <p className="text-[11px] text-red-400">{fallo}</p>}
    </section>
  )
}

function BotonBorrar({ id, onListo, onFallo }: {
  id: string; onListo: () => void | Promise<void>; onFallo: (m: string) => void
}) {
  const [borrando, setBorrando] = useState(false)
  return (
    <button
      onClick={async () => {
        setBorrando(true)
        const r = await borrarPremio(id)
        setBorrando(false)
        if (!r.ok) { onFallo(r.error ?? 'No se pudo borrar.'); return }
        await onListo()
      }}
      disabled={borrando}
      aria-label="Quitar este premio"
      className="ml-auto shrink-0 rounded p-1 text-swu-muted hover:text-red-400"
    >
      {borrando ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
    </button>
  )
}

function FormularioPremio({ eventId, onListo }: { eventId: string; onListo: () => void }) {
  const [puesto, setPuesto] = useState<string>('1')
  const [desc, setDesc] = useState('')
  const [valor, setValor] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const guardar = async () => {
    if (!desc.trim()) { setFallo('Escribí qué es el premio.'); return }
    setGuardando(true); setFallo(null)
    const r = await agregarPremio(eventId, {
      // «todos» = un premio que no es de un puesto: rifa, mejor mazo,
      // participación. Va como `null`, no como puesto 0.
      puesto: puesto === 'todos' ? null : Number(puesto),
      descripcion: desc,
      // Vacío es «no se dice el valor», que no es lo mismo que valer cero.
      valor: valor.trim() === '' ? null : Number(valor),
    })
    setGuardando(false)
    if (!r.ok) { setFallo(r.error ?? 'No se pudo guardar.'); return }
    setDesc(''); setValor('')
    onListo()
  }

  return (
    <div className="space-y-2 rounded-2xl border border-swu-accent/30 bg-swu-bg p-3">
      <div className="flex gap-2">
        <select
          value={puesto}
          onChange={e => setPuesto(e.target.value)}
          className="rounded-lg border border-swu-border bg-swu-surface px-2 py-2 text-[12px] text-swu-text"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}º lugar</option>)}
          <option value="todos">Para todos</option>
        </select>
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Caja de sobres, playmat, efectivo…"
          className="min-w-0 flex-1 rounded-lg border border-swu-border bg-swu-surface px-2 py-2 text-[12px] text-swu-text placeholder:text-swu-muted"
        />
      </div>
      <div className="flex gap-2">
        <input
          value={valor}
          onChange={e => setValor(e.target.value)}
          inputMode="decimal"
          placeholder="Valor en $ (opcional)"
          className="min-w-0 flex-1 rounded-lg border border-swu-border bg-swu-surface px-2 py-2 text-[12px] text-swu-text placeholder:text-swu-muted"
        />
        <button
          onClick={() => void guardar()}
          disabled={guardando}
          className="shrink-0 rounded-lg bg-swu-accent px-4 py-2 text-[12px] font-bold text-white disabled:opacity-60"
        >
          {guardando ? 'Guardando…' : 'Agregar'}
        </button>
      </div>
      {fallo && <p className="text-[11px] text-red-400">{fallo}</p>}
    </div>
  )
}

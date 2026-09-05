/**
 * Agregar un mazo preconstruido de los que se venden.
 *
 * Quien compra un precon y quiere tenerlo en la app hoy mete 80 cartas a mano,
 * una por una. Nadie lo hace: el mazo se queda en la caja y la app sin saber
 * qué juega esa persona — y de ahí sale que la mitad de las inscripciones a un
 * torneo no traigan mazo declarado.
 *
 * Las listas están verificadas carta por carta contra el catálogo y guardadas
 * por id, no por nombre. Ver `services/preconstruidos.ts`: hay cuatro «Ahsoka
 * Tano», siete «Obi-Wan Kenobi», y una carta que el catálogo escribe con un
 * CERO en el nombre.
 */

import { useState } from 'react'
import { X, Package, Check, Loader2 } from 'lucide-react'
import { db } from '../../services/db'
import { syncDeckToCloud } from '../../services/sync'
import { useAuth } from '../../hooks/useAuth'
import { PRECON_TWIN_SUNS, construirPrecon, type MazoPrecon } from '../../services/preconstruidos'

export function PreconModal({ open, onClose, onListo }: {
  open: boolean; onClose: () => void; onListo: () => void
}) {
  const { supabaseUser } = useAuth()
  const [guardando, setGuardando] = useState<string | null>(null)
  const [hechos, setHechos] = useState<string[]>([])
  const [fallo, setFallo] = useState<string | null>(null)

  if (!open) return null

  const agregar = async (m: MazoPrecon) => {
    setGuardando(m.slug); setFallo(null)
    try {
      const mazo = construirPrecon(m)
      await db.decks.put(mazo)
      // A la nube va aparte y sin bloquear: el mazo ya está guardado en el
      // aparato y perderlo por un problema de red sería peor que no subirlo.
      if (supabaseUser) syncDeckToCloud(supabaseUser.id, mazo).catch(() => {})
      setHechos(h => [...h, m.slug])
      onListo()
    } catch (e) {
      setFallo(e instanceof Error ? e.message : 'No se pudo guardar el mazo.')
    } finally {
      setGuardando(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-swu-border bg-swu-surface p-4 sm:rounded-2xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-swu-text">Mazos preconstruidos</h3>
            <p className="mt-0.5 text-[11px] text-swu-muted">
              Twin Suns (TS26). Si tenés la caja, agregalo con un toque.
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1 text-swu-muted">
            <X size={18} />
          </button>
        </div>

        <ul className="space-y-2">
          {PRECON_TWIN_SUNS.map(m => {
            const ya = hechos.includes(m.slug)
            return (
              <li key={m.slug} className="rounded-2xl border border-swu-border bg-swu-bg p-3">
                <p className="text-[13px] font-black text-swu-text">{m.nombre}</p>
                <p className="mt-0.5 text-[11px] text-swu-accent-texto">
                  {m.lideres.map(l => l.name).join(' + ')}
                  <span className="text-swu-muted"> · {m.base.name}</span>
                </p>
                <p className="mt-0.5 text-[10px] text-swu-muted">
                  {m.cartas.length} cartas · una copia de cada una
                </p>
                <button
                  onClick={() => void agregar(m)}
                  disabled={guardando !== null || ya}
                  className={`mt-2 flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl text-xs font-bold disabled:opacity-60 ${
                    ya ? 'border border-swu-green/40 bg-swu-green/10 text-swu-green' : 'bg-swu-accent text-white'
                  }`}
                >
                  {guardando === m.slug ? <Loader2 size={14} className="animate-spin" />
                    : ya ? <Check size={14} /> : <Package size={14} />}
                  {guardando === m.slug ? 'Agregando…' : ya ? 'Agregado a tus mazos' : 'Agregar a mis mazos'}
                </button>
              </li>
            )
          })}
        </ul>

        {fallo && (
          <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
            {fallo}
          </p>
        )}
      </div>
    </div>
  )
}

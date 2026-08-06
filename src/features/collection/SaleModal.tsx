/**
 * SaleModal — poner una carta en venta, o corregir la publicación.
 *
 * Vive en su propio archivo porque lo usan DOS pantallas: Mi Botín, donde uno
 * publica lo que tiene, y Contrabando, donde uno se encuentra su propia
 * publicación y quiere corregirle el precio sin salir de ahí. Mandarlo a
 * buscar la carta a otra pantalla era pedirle que hiciera el trabajo dos veces.
 */

import { useState, useEffect } from 'react'
import { Tag, DollarSign, Loader2, Minus, Plus, Users } from 'lucide-react'
import { getPricesForCards } from '../../services/pricing'
import type { MyListingSummary } from '../../services/collectionService'

export function SaleModal({
  cardId, cardName, owned, current, submitting, onCancel, onSave, onUnlist,
}: {
  cardId: string
  cardName: string
  /** Cuántas copias tiene: es el tope de lo que puede ofrecer. */
  owned: number
  current: MyListingSummary | null
  submitting: boolean
  onCancel: () => void
  onSave: (price: number | null, notes: string, cantidad: number) => void
  /** Solo se pasa cuando la carta YA está publicada (modo edición). */
  onUnlist?: () => void
}) {
  const editing = !!current
  const [priceStr, setPriceStr] = useState(current?.price != null ? String(current.price) : '')
  const [notes, setNotes] = useState(current?.notes ?? '')
  const [cantidad, setCantidad] = useState(
    Math.min(current?.quantity ?? owned, Math.max(1, owned)),
  )
  /** Precio de mercado de TCGplayer, para no tener que ir a buscarlo. */
  const [sugerido, setSugerido] = useState<number | null | 'buscando'>('buscando')

  useEffect(() => {
    let vivo = true
    void getPricesForCards([cardId]).then(m => {
      if (!vivo) return
      const p = m.get(cardId)
      // `market` es el precio al que se está vendiendo de verdad; `mid` es el
      // punto medio de las ofertas. Se prefiere el primero y se cae al
      // segundo, que es lo que hace la propia TCGplayer.
      const ref = p?.market ?? p?.mid ?? null
      setSugerido(ref)
      // El relleno va acá dentro y no en otro efecto: encadenar efectos por
      // estado provoca renders en cascada. Y solo si no había precio puesto —
      // editando una publicación, pisarle el precio que la persona eligió
      // sería una sorpresa desagradable.
      if (ref !== null && !editing) {
        setPriceStr(actual => (actual.trim() ? actual : ref.toFixed(2)))
      }
    }).catch(() => { if (vivo) setSugerido(null) })
    return () => { vivo = false }
    // `editing` sale de `current`, que no cambia mientras el modal está abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId])

  const submit = () => {
    const p = priceStr.trim() ? Number(priceStr) : null
    if (p !== null && (Number.isNaN(p) || p < 0)) {
      alert('Precio inválido')
      return
    }
    if (cantidad < 1 || cantidad > owned) {
      alert(`Solo tenés ${owned} ${owned === 1 ? 'copia' : 'copias'}.`)
      return
    }
    onSave(p, notes, cantidad)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-swu-surface rounded-2xl border border-swu-amber/40 p-5 max-w-sm w-full space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-swu-amber/15 flex items-center justify-center flex-shrink-0">
            <Tag size={20} className="text-swu-amber" />
          </div>
          <div>
            <div className="text-sm font-bold text-swu-text">
              {editing ? 'Editar publicación' : 'Poner en venta'}
            </div>
            <div className="text-xs text-swu-muted mt-0.5 truncate">{cardName}</div>
          </div>
        </div>

        <div className="space-y-3">
          {/* Cuántas se ofrecen. Antes se publicaba la carta y el mercado
              mostraba cuántas TENÍAS: quien tenía 3 y vendía 1 aparecía
              ofreciendo las tres, y el comprador llegaba esperando tres. */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-swu-muted font-medium block mb-1">
              Cuántas vendés
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCantidad(c => Math.max(1, c - 1))}
                disabled={cantidad <= 1}
                aria-label="Una menos"
                className="w-9 h-9 rounded-lg bg-swu-bg border border-swu-border text-swu-text
                           flex items-center justify-center disabled:opacity-30"
              >
                <Minus size={14} aria-hidden />
              </button>
              <div className="flex-1 text-center">
                <span className="text-xl font-extrabold font-mono text-swu-text">{cantidad}</span>
                <span className="text-[11px] text-swu-muted"> de {owned}</span>
              </div>
              <button
                onClick={() => setCantidad(c => Math.min(owned, c + 1))}
                disabled={cantidad >= owned}
                aria-label="Una más"
                className="w-9 h-9 rounded-lg bg-swu-bg border border-swu-border text-swu-text
                           flex items-center justify-center disabled:opacity-30"
              >
                <Plus size={14} aria-hidden />
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-swu-muted font-medium flex items-center gap-1 mb-1">
              <DollarSign size={10} /> Precio en USD (opcional)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              placeholder="dejar vacío si es a convenir"
              className="w-full px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text font-mono"
            />
            {/* El sugerido es una referencia, no una imposición: se muestra
                siempre y se aplica con un toque. El precio de una carta acá no
                es el de TCGplayer, pero saber ese número ayuda a poner uno. */}
            <div className="mt-1.5 min-h-[18px]">
              {sugerido === 'buscando' ? (
                <p className="text-[10px] text-swu-muted/60">buscando precio de referencia…</p>
              ) : sugerido === null ? (
                <p className="text-[10px] text-swu-muted/60">Sin precio de referencia para esta carta.</p>
              ) : (
                <button
                  onClick={() => setPriceStr(sugerido.toFixed(2))}
                  className="text-[10px] text-swu-cyan hover:underline"
                >
                  TCGplayer: ${sugerido.toFixed(2)} — usar este precio
                </button>
              )}
            </div>
            {cantidad > 1 && priceStr.trim() && Number(priceStr) > 0 && (
              <p className="text-[10px] text-swu-muted mt-1">
                Es el precio por carta. Las {cantidad} juntas:{' '}
                <span className="font-mono text-swu-amber">
                  ${(Number(priceStr) * cantidad).toFixed(2)}
                </span>
              </p>
            )}
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-swu-muted font-medium block mb-1">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="Condición, idioma, foiled, contacto..."
              className="w-full px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text resize-none"
            />
            <p className="text-[10px] text-swu-muted/60 mt-0.5">{notes.length}/200</p>
          </div>

          {/* Decirlo antes, no después. Publicar acá es un acto público: la
              carta y el nombre quedan a la vista de toda la comunidad, y el
              botón de escribirle al vendedor lleva su WhatsApp. Eso pasa
              aunque el perfil esté en privado —vender y mostrar la colección
              son dos permisos distintos—, así que si no se dice, alguien
              podría publicar creyendo que su ajuste de privacidad lo cubre. */}
          <p className="flex items-start gap-1.5 text-[10px] text-swu-muted leading-snug">
            <Users size={11} className="text-swu-amber flex-shrink-0 mt-px" aria-hidden />
            <span>
              Lo que publiques lo ve <strong className="text-swu-text">toda la comunidad</strong> en
              Contrabando, con tu nombre y tu WhatsApp para que te escriban. Podés quitarlo
              cuando querás.
            </span>
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-swu-bg border border-swu-border text-swu-muted text-sm font-medium active:scale-[0.98]"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-swu-amber text-black text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Tag size={14} />}
            {submitting ? 'Guardando...' : editing ? 'Guardar cambios' : 'Publicar venta'}
          </button>
        </div>

        {/* Quitar del mercado vive acá dentro: en la fila ocupaba el mismo
            botón que publicar, así que no se podía editar sin despublicar. */}
        {onUnlist && (
          <button
            onClick={onUnlist}
            disabled={submitting}
            className="w-full py-2 rounded-xl border border-swu-red/30 text-swu-red text-xs font-semibold
                       active:scale-[0.98] disabled:opacity-50"
          >
            Quitar del mercado
          </button>
        )}
      </div>
    </div>
  )
}


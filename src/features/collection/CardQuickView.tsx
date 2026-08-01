/**
 * CardQuickView — la carta sin salir del binder.
 *
 * Tocar una casilla abre esto encima de la cuadrícula en vez de navegar al
 * detalle. Al navegar se pierde el lugar en el binder, que es justo lo que uno
 * está recorriendo; acá se ajusta la cantidad, se mira el arte y se cierra.
 *
 * El botón "Ver ficha completa" sigue existiendo para lo que sí necesita la
 * pantalla entera (texto de reglas, precios por impresión, zoom).
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Minus, Plus, ExternalLink, Tag } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Chip } from '../../components/ui/Chip'
import { CardImage } from '../../components/CardImage'
import { listFaceUrl, listFaceFit } from '../../services/cardArt'
import { PLAYSET_SIZE } from '../../services/swuApi'
import { formatPrice } from '../../services/pricing'
import { translateType, translateRarity, translateArena } from '../../services/translations'
import type { BinderSlot } from '../../services/collectionProgress'

interface CardQuickViewProps {
  slot: BinderSlot
  /** Precio de mercado, si se conoce. */
  price?: number | null
  /** Está publicada en el mercado. */
  listed?: boolean
  onChangeQty: (newQty: number) => void | Promise<void>
  onSell?: () => void
}

export function CardQuickView({ slot, price, listed, onChangeQty, onSell }: CardQuickViewProps) {
  const navigate = useNavigate()
  const { card } = slot
  // Optimista: la cantidad responde al toque sin esperar al servidor.
  const [qty, setQty] = useState(slot.qty)

  const change = (next: number) => {
    const n = Math.max(0, next)
    setQty(n)
    void onChangeQty(n)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-3">
        <CardImage
          src={listFaceUrl(card)}
          fit={listFaceFit(card)}
          alt={card.name}
          className="w-24 h-32 flex-shrink-0"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div>
            <p className="text-base font-bold text-swu-text leading-tight">{card.name}</p>
            {card.subtitle && <p className="text-xs text-swu-muted leading-tight">{card.subtitle}</p>}
          </div>
          <div className="flex flex-wrap gap-1">
            <Chip tone="neutral" active>{translateType(card.type)}</Chip>
            <Chip tone="neutral" active>{translateRarity(card.rarity)}</Chip>
            {card.arena && <Chip tone="neutral" active>{translateArena(card.arena)}</Chip>}
          </div>
          <p className="text-[11px] font-mono text-swu-muted">
            {card.setCode} #{card.setNumber}
            {price != null && price > 0 && (
              <span className="text-swu-green ml-2">{formatPrice(price)}</span>
            )}
          </p>
        </div>
      </div>

      {/* Cantidad — el gesto principal de esta vista */}
      <div className="flex items-center justify-between rounded-xl bg-swu-bg border border-swu-border p-3">
        <div>
          <p className="text-xs font-semibold text-swu-text">
            {qty === 0 ? 'No la tenés' : `${qty} ${qty === 1 ? 'copia' : 'copias'}`}
          </p>
          {qty > 0 && qty < PLAYSET_SIZE && (
            <p className="text-[10px] text-swu-muted">
              Te faltan {PLAYSET_SIZE - qty} para el playset
            </p>
          )}
          {qty >= PLAYSET_SIZE && (
            <p className="text-[10px] text-swu-green">Playset completo</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => change(qty - 1)}
            disabled={qty === 0}
            aria-label="Quitar una copia"
            className="w-11 px-0"
          >
            <Minus size={14} aria-hidden />
          </Button>
          <span className="w-8 text-center text-lg font-bold font-mono text-swu-text">{qty}</span>
          <Button
            size="sm"
            variant="primary"
            onClick={() => change(qty + 1)}
            aria-label="Agregar una copia"
            className="w-11 px-0"
          >
            <Plus size={14} aria-hidden />
          </Button>
          {qty === 0 && (
            <Button size="sm" variant="secondary" onClick={() => change(PLAYSET_SIZE)}>
              ×{PLAYSET_SIZE}
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          block
          onClick={() => navigate(`/cards/${card.id}`)}
        >
          <ExternalLink size={13} aria-hidden /> Ver ficha completa
        </Button>
        {onSell && qty > 0 && (
          <Button size="sm" variant={listed ? 'primary' : 'secondary'} block onClick={onSell}>
            <Tag size={13} aria-hidden /> {listed ? 'Editar venta' : 'Vender'}
          </Button>
        )}
      </div>
    </div>
  )
}

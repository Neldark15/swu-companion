/**
 * BinderGrid — la colección como un binder, no como una lista.
 *
 * Dos cosas que una lista no puede hacer:
 *
 * 1. **Los huecos son la información.** Mi Botín solo mostraba lo que ya
 *    tenías, así que un set al que le faltan 80 cartas se veía igual de
 *    "lleno" que uno completo. Acá, al filtrar por expansión, se dibujan las
 *    264 casillas del set y las que faltan quedan vacías, con su número.
 *
 * 2. **El arte manda.** Es un juego de cartas: se reconoce el dibujo antes
 *    que el nombre.
 *
 * Reusa CardImage (con la cara correcta por tipo de carta) y el orden
 * canónico, así que la cuadrícula se recorre igual que el set impreso.
 */

import { CardImage } from '../../components/CardImage'
import { listFaceUrl, listFaceFit } from '../../services/cardArt'
import type { BinderSlot } from '../../services/collectionProgress'
import { PLAYSET_SIZE } from '../../services/swuApi'

interface BinderGridProps {
  slots: BinderSlot[]
  onSelect: (slot: BinderSlot) => void
  /** Oculta las casillas vacías (modo "solo lo que tengo"). */
  hideMissing?: boolean
}

export function BinderGrid({ slots, onSelect, hideMissing = false }: BinderGridProps) {
  const visible = hideMissing ? slots.filter(s => s.qty > 0) : slots

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
      {visible.map(slot => {
        const { card, qty } = slot
        const owned = qty > 0
        const complete = qty >= PLAYSET_SIZE

        return (
          <button
            key={card.id}
            onClick={() => onSelect(slot)}
            aria-label={
              owned
                ? `${card.name}, ${qty} ${qty === 1 ? 'copia' : 'copias'}`
                : `${card.name}, no la tenés`
            }
            className={`
              relative aspect-[5/7] rounded-lg overflow-hidden border transition-all
              active:scale-[0.97]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent
              ${owned
                ? 'border-swu-border'
                : 'border-dashed border-swu-border/60 bg-swu-bg'}
            `}
          >
            {owned ? (
              <>
                <CardImage
                  src={listFaceUrl(card)}
                  fit={listFaceFit(card)}
                  alt=""
                  className="w-full h-full"
                  rootMargin={400}
                />
                {/* Cuántas copias. El playset completo se marca en verde, y
                    además lleva el número: el color no es el único aviso. */}
                <span
                  className={`absolute bottom-1 right-1 min-w-5 h-5 px-1 rounded
                              text-[10px] font-bold font-mono
                              flex items-center justify-center
                              ${complete
                                ? 'bg-swu-green text-black'
                                : 'bg-black/75 text-white'}`}
                >
                  {qty}
                </span>
              </>
            ) : (
              // Hueco: se ve el número de carta para saber QUÉ falta.
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-swu-muted/40">
                <span className="text-[10px] font-mono">#{card.setNumber}</span>
                <span className="text-[9px] px-1 text-center leading-tight line-clamp-2">
                  {card.name}
                </span>
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

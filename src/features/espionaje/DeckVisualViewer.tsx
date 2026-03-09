import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronUp, Swords, Shield, Layers } from 'lucide-react'
import { getCardById } from '../../services/swuApi'
import type { PublicDeck, PublicDeckCard } from '../../services/sync'

/* ─── Card image with quantity badge ──────────────────────────── */
function DeckCardTile({ card, imageUrl }: { card: PublicDeckCard; imageUrl?: string }) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="relative group">
      {/* Card image */}
      <div className="aspect-[5/7] rounded-lg overflow-hidden bg-swu-bg border border-swu-border/50 shadow-md">
        {imageUrl && !imgError ? (
          <img
            src={imageUrl}
            alt={card.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center">
            <Layers size={16} className="text-swu-muted/30 mb-1" />
            <span className="text-[7px] text-swu-muted leading-tight">{card.name}</span>
          </div>
        )}
      </div>

      {/* Quantity badge */}
      {card.quantity > 1 && (
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-swu-bg
                        flex items-center justify-center shadow-lg z-10">
          <span className="text-[9px] font-black text-white">{card.quantity}</span>
        </div>
      )}

      {/* Hover tooltip */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/80 rounded-b-lg px-1 py-0.5
                      opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <p className="text-[7px] text-white text-center truncate leading-tight">{card.name}</p>
        {card.subtitle && (
          <p className="text-[6px] text-swu-muted text-center truncate leading-tight">{card.subtitle}</p>
        )}
      </div>
    </div>
  )
}

/* ─── Section header inside viewer ────────────────────────────── */
function SectionLabel({ icon: Icon, label, count, color }: {
  icon: React.ElementType; label: string; count: number; color: string
}) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon size={12} className={color} />
      <span className={`text-[10px] font-bold uppercase tracking-widest ${color}`}>{label}</span>
      <span className="text-[10px] text-swu-muted font-mono ml-auto">{count}</span>
    </div>
  )
}

/* ─── Main DeckVisualViewer Component ─────────────────────────── */
export function DeckVisualViewer({ deck }: { deck: PublicDeck }) {
  const [expanded, setExpanded] = useState(false)
  const [cardImages, setCardImages] = useState<Map<string, string>>(new Map())
  const [loadingImages, setLoadingImages] = useState(false)

  // Collect all unique card IDs from this deck
  const allCardIds = useMemo(() => {
    const ids = new Set<string>()
    deck.leaders.forEach(c => ids.add(c.cardId))
    if (deck.base) ids.add(deck.base.cardId)
    deck.mainDeck.forEach(c => ids.add(c.cardId))
    deck.sideboard.forEach(c => ids.add(c.cardId))
    return [...ids]
  }, [deck])

  // Load card images when expanded
  useEffect(() => {
    if (!expanded || allCardIds.length === 0) return
    // Skip if already loaded
    if (cardImages.size >= allCardIds.length) return

    let cancelled = false
    async function loadImages() {
      setLoadingImages(true)
      const imgs = new Map<string, string>()

      // Load in batches of 8 for performance
      const batchSize = 8
      for (let i = 0; i < allCardIds.length; i += batchSize) {
        if (cancelled) break
        const batch = allCardIds.slice(i, i + batchSize)
        await Promise.all(batch.map(async (cardId) => {
          try {
            const card = await getCardById(cardId)
            if (card?.imageUrl) imgs.set(cardId, card.imageUrl)
          } catch { /* skip */ }
        }))
      }

      if (!cancelled) {
        setCardImages(imgs)
        setLoadingImages(false)
      }
    }
    loadImages()
    return () => { cancelled = true }
  }, [expanded, allCardIds, cardImages.size])

  // Total card count
  const totalCards = deck.mainDeck.reduce((s, c) => s + c.quantity, 0)
  const sideboardCount = deck.sideboard.reduce((s, c) => s + c.quantity, 0)

  return (
    <div className="bg-swu-surface rounded-xl border border-swu-border overflow-hidden">
      {/* Deck header — always visible, click to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left active:bg-swu-bg/50 transition-colors"
      >
        {/* Leader mini thumbnail */}
        <div className="w-10 h-14 rounded-md overflow-hidden bg-swu-bg border border-swu-border/50 flex-shrink-0">
          {cardImages.get(deck.leaderCardId) ? (
            <img src={cardImages.get(deck.leaderCardId)} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Swords size={14} className="text-swu-muted/30" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-swu-text truncate">{deck.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-swu-muted">{deck.leaderName || 'Sin líder'}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 font-bold">
              {deck.format === 'twin_suns' ? 'Twin Suns' : deck.format.charAt(0).toUpperCase() + deck.format.slice(1)}
            </span>
          </div>
          <p className="text-[10px] text-swu-muted mt-0.5 font-mono">{totalCards} cartas{sideboardCount > 0 ? ` · ${sideboardCount} sideboard` : ''}</p>
        </div>

        <div className="flex-shrink-0 text-swu-muted">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Expanded visual grid */}
      {expanded && (
        <div className="border-t border-swu-border px-3 py-3 space-y-4">
          {/* Loading indicator */}
          {loadingImages && (
            <div className="flex items-center justify-center gap-2 py-2">
              <div className="animate-spin w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full" />
              <span className="text-[10px] text-swu-muted">Cargando imágenes...</span>
            </div>
          )}

          {/* Leader + Base row */}
          <div>
            <SectionLabel icon={Swords} label="Líder & Base" count={deck.leaders.length + (deck.base ? 1 : 0)} color="text-swu-amber" />
            <div className="flex gap-2">
              {deck.leaders.map((c, i) => (
                <div key={`leader-${i}`} className="w-20">
                  <DeckCardTile card={c} imageUrl={cardImages.get(c.cardId)} />
                  <p className="text-[7px] text-swu-amber text-center mt-0.5 font-bold">LÍDER</p>
                </div>
              ))}
              {deck.base && (
                <div className="w-20">
                  <DeckCardTile card={deck.base} imageUrl={cardImages.get(deck.base.cardId)} />
                  <p className="text-[7px] text-swu-green text-center mt-0.5 font-bold">BASE</p>
                </div>
              )}
            </div>
          </div>

          {/* Main Deck grid */}
          {deck.mainDeck.length > 0 && (
            <div>
              <SectionLabel icon={Layers} label="Deck Principal" count={totalCards} color="text-indigo-400" />
              <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-8 gap-1.5">
                {deck.mainDeck.map((c, i) => (
                  <DeckCardTile key={`main-${i}`} card={c} imageUrl={cardImages.get(c.cardId)} />
                ))}
              </div>
            </div>
          )}

          {/* Sideboard */}
          {deck.sideboard.length > 0 && (
            <div>
              <SectionLabel icon={Shield} label="Sideboard" count={sideboardCount} color="text-purple-400" />
              <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-8 gap-1.5">
                {deck.sideboard.map((c, i) => (
                  <DeckCardTile key={`side-${i}`} card={c} imageUrl={cardImages.get(c.cardId)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

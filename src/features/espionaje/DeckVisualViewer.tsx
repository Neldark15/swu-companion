import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronUp, Swords, Shield, Layers } from 'lucide-react'
import { getCardsByIds } from '../../services/swuApi'
import { AspectIcon } from '../../components/icons/AspectIcon'
import type { Aspect } from '../../services/gamification'
import type { PublicDeck, PublicDeckCard } from '../../services/sync'
import type { Card } from '../../types'

/* ─── Card image with quantity badge (vertical, for main deck) ── */
function DeckCardTile({ card, imageUrl }: { card: PublicDeckCard; imageUrl?: string }) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="relative group">
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

      {card.quantity > 1 && (
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-swu-bg
                        flex items-center justify-center shadow-lg z-10">
          <span className="text-[9px] font-black text-white">{card.quantity}</span>
        </div>
      )}

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

/* ─── Horizontal card (for leader/base) ───────────────────────── */
function HorizontalCard({ card, cardData, label, labelColor, size = 'normal' }: {
  card: PublicDeckCard
  cardData?: Card
  label: string
  labelColor: string
  size?: 'mini' | 'normal'
}) {
  const [imgError, setImgError] = useState(false)
  const imageUrl = cardData?.imageUrl
  const aspects = cardData?.aspects || []

  const isMini = size === 'mini'

  return (
    <div className={isMini ? 'flex-1 min-w-0' : 'flex-1'}>
      {/* Horizontal card image */}
      <div className={`relative rounded-lg overflow-hidden bg-swu-bg border border-swu-border/50 shadow-md
                       ${isMini ? 'aspect-[7/5]' : 'aspect-[7/5]'}`}>
        {imageUrl && !imgError ? (
          <img
            src={imageUrl}
            alt={card.name}
            className="w-full h-full object-cover"
            style={{ transform: 'rotate(0deg)' }}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <Swords size={isMini ? 12 : 20} className="text-swu-muted/30" />
            {!isMini && (
              <span className="text-[8px] text-swu-muted mt-1">{card.name}</span>
            )}
          </div>
        )}

        {/* Label badge */}
        <div className={`absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm`}>
          <span className={`font-black uppercase ${isMini ? 'text-[6px]' : 'text-[8px]'} ${labelColor}`}>{label}</span>
        </div>

        {/* Aspect icons */}
        {aspects.length > 0 && (
          <div className={`absolute ${isMini ? 'bottom-0.5 right-0.5' : 'bottom-1 right-1'} flex gap-0.5`}>
            {aspects.map((a, i) => (
              <div key={i} className={`${isMini ? 'w-4 h-4' : 'w-5 h-5'} rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center`}>
                <AspectIcon aspect={a as Aspect} size={isMini ? 12 : 16} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Name below card */}
      {!isMini && (
        <div className="mt-1 text-center">
          <p className="text-[9px] font-bold text-swu-text truncate">{card.name}</p>
          {card.subtitle && (
            <p className="text-[7px] text-swu-muted truncate">{card.subtitle}</p>
          )}
        </div>
      )}
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
  const [cardDataMap, setCardDataMap] = useState<Map<string, Card>>(new Map())
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

  // Leader + base card IDs (load immediately for header thumbnails)
  const headerCardIds = useMemo(() => {
    const ids: string[] = []
    deck.leaders.forEach(c => ids.push(c.cardId))
    if (deck.base) ids.push(deck.base.cardId)
    return ids
  }, [deck])

  // Load leader/base card data immediately (for header)
  useEffect(() => {
    if (headerCardIds.length === 0) return
    // Skip if already loaded
    if (headerCardIds.every(id => cardDataMap.has(id))) return

    let cancelled = false
    async function loadHeader() {
      const result = await getCardsByIds(headerCardIds)
      if (!cancelled) {
        setCardDataMap(prev => {
          const next = new Map(prev)
          result.forEach((card, id) => next.set(id, card))
          return next
        })
      }
    }
    loadHeader()
    return () => { cancelled = true }
  }, [headerCardIds]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load all card data when expanded
  useEffect(() => {
    if (!expanded || allCardIds.length === 0) return
    // Skip if already loaded
    if (allCardIds.every(id => cardDataMap.has(id))) return

    let cancelled = false
    async function loadAll() {
      setLoadingImages(true)
      const result = await getCardsByIds(allCardIds)
      if (!cancelled) {
        setCardDataMap(prev => {
          const next = new Map(prev)
          result.forEach((card, id) => next.set(id, card))
          return next
        })
        setLoadingImages(false)
      }
    }
    loadAll()
    return () => { cancelled = true }
  }, [expanded, allCardIds]) // eslint-disable-line react-hooks/exhaustive-deps

  // Total card count
  const totalCards = deck.mainDeck.reduce((s, c) => s + c.quantity, 0)
  const sideboardCount = deck.sideboard.reduce((s, c) => s + c.quantity, 0)

  const leaderCard = deck.leaders[0]
  const leaderData = leaderCard ? cardDataMap.get(leaderCard.cardId) : undefined
  const baseData = deck.base ? cardDataMap.get(deck.base.cardId) : undefined

  return (
    <div className="bg-swu-surface rounded-xl border border-swu-border overflow-hidden">
      {/* Deck header — always visible, click to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 text-left active:bg-swu-bg/50 transition-colors"
      >
        {/* Deck name + info row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-swu-text truncate">{deck.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-mono text-swu-accent font-bold">{totalCards} cartas</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 font-bold">
                {deck.format === 'twin_suns' ? 'Twin Suns' : deck.format.charAt(0).toUpperCase() + deck.format.slice(1)}
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 text-swu-muted ml-2">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {/* Leader + Base horizontal thumbnails side by side */}
        <div className="flex gap-2">
          {leaderCard && (
            <HorizontalCard
              card={leaderCard}
              cardData={leaderData}
              label="Líder"
              labelColor="text-swu-amber"
              size="mini"
            />
          )}
          {deck.base && (
            <HorizontalCard
              card={deck.base}
              cardData={baseData}
              label="Base"
              labelColor="text-swu-green"
              size="mini"
            />
          )}
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

          {/* Main Deck grid */}
          {deck.mainDeck.length > 0 && (
            <div>
              <SectionLabel icon={Layers} label="Deck Principal" count={totalCards} color="text-indigo-400" />
              <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-8 gap-1.5">
                {deck.mainDeck.map((c, i) => (
                  <DeckCardTile key={`main-${i}`} card={c} imageUrl={cardDataMap.get(c.cardId)?.imageUrl} />
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
                  <DeckCardTile key={`side-${i}`} card={c} imageUrl={cardDataMap.get(c.cardId)?.imageUrl} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

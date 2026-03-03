import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, BookOpen, AlertTriangle, CheckCircle2, Swords } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { db } from '../../services/db'
import { getCardById } from '../../services/swuApi'
import { deleteDeckFromCloud, pullDecksFromCloud } from '../../services/sync'
import { getEffectiveMinDeckSize } from '../../services/deckValidator'
import { useAuth } from '../../hooks/useAuth'
import type { Deck } from '../../types'

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `Hace ${days}d`
}

function countCards(cards: { quantity: number }[]): number {
  return cards.reduce((s, c) => s + c.quantity, 0)
}

const formatLabels: Record<string, string> = {
  premier: 'Premier',
  twin_suns: 'Twin Suns',
  trilogy: 'Trilogy',
  sealed: 'Sealed',
  draft: 'Draft',
  limited: 'Limited',
}

// Cache for card images to avoid repeated lookups
const imageCache = new Map<string, string>()

export function DeckListPage() {
  const navigate = useNavigate()
  const { supabaseUser } = useAuth()
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [cardImages, setCardImages] = useState<Map<string, string>>(new Map())
  const [baseTexts, setBaseTexts] = useState<Map<string, string>>(new Map())

  const loadDecks = useCallback(async () => {
    setLoading(true)

    // If user is logged in, pull latest decks from cloud first
    if (supabaseUser) {
      await pullDecksFromCloud(supabaseUser.id).catch(() => {})
    }

    const all = await db.decks.toArray()
    const d = all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    setDecks(d)
    setLoading(false)

    // Load card images for leaders and bases
    const cardIds = new Set<string>()
    d.forEach(deck => {
      deck.leaders.forEach(l => cardIds.add(l.cardId))
      if (deck.base) cardIds.add(deck.base.cardId)
    })

    const newImages = new Map<string, string>(imageCache)
    const newBaseTexts = new Map<string, string>()
    const toFetch = [...cardIds].filter(id => !imageCache.has(id))

    // Collect base card IDs for text lookup
    const baseCardIds = new Set<string>()
    d.forEach(deck => { if (deck.base) baseCardIds.add(deck.base.cardId) })

    if (toFetch.length > 0) {
      const results = await Promise.all(
        toFetch.map(async (id) => {
          const card = await getCardById(id)
          return { id, imageUrl: card?.imageUrl || '', text: card?.text || '' }
        })
      )
      results.forEach(({ id, imageUrl, text }) => {
        if (imageUrl) {
          newImages.set(id, imageUrl)
          imageCache.set(id, imageUrl)
        }
        if (baseCardIds.has(id) && text) {
          newBaseTexts.set(id, text)
        }
      })
    }

    // Also fetch base texts for cards already cached (images loaded but text not)
    for (const baseId of baseCardIds) {
      if (!newBaseTexts.has(baseId)) {
        const card = await getCardById(baseId)
        if (card?.text) newBaseTexts.set(baseId, card.text)
      }
    }

    setCardImages(newImages)
    setBaseTexts(newBaseTexts)
  }, [supabaseUser])

  // Load on mount and when navigating back
  useEffect(() => {
    loadDecks()
  }, [loadDecks])

  // Also reload when page becomes visible (e.g. navigating back)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadDecks()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [loadDecks])

  // Re-load when this component mounts (handles back navigation from deck builder)
  useEffect(() => {
    const handleFocus = () => loadDecks()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [loadDecks])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await db.decks.delete(id)
    if (supabaseUser) deleteDeckFromCloud(id).catch(() => {})
    setDecks((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-swu-text">Mis Decks</h2>
        <button
          onClick={() => navigate('/decks/new')}
          className="px-4 py-2 rounded-xl bg-swu-accent text-white font-bold text-sm flex items-center gap-1.5 active:scale-95 transition-transform"
        >
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-pulse text-swu-muted">Cargando...</div>
        </div>
      ) : decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-swu-muted gap-3">
          <BookOpen size={40} className="opacity-40" />
          <p className="text-sm">No tiene decks aún</p>
          <button
            onClick={() => navigate('/decks/new')}
            className="px-5 py-2.5 rounded-xl bg-swu-accent text-white font-bold text-sm"
          >
            Crear Primer Deck
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {decks.map((deck) => {
            const mainCount = countCards(deck.mainDeck)
            const sideCount = countCards(deck.sideboard)
            const leader = deck.leaders[0]
            const base = deck.base
            const leaderImg = leader ? cardImages.get(leader.cardId) : undefined
            const baseImg = base ? cardImages.get(base.cardId) : undefined
            const bText = deck.base ? baseTexts.get(deck.base.cardId) || '' : ''
            const targetSize = getEffectiveMinDeckSize(deck.format, bText)

            return (
              <div
                key={deck.id}
                onClick={() => navigate(`/decks/${deck.id}`)}
                className="bg-swu-surface rounded-2xl border border-swu-border overflow-hidden active:scale-[0.99] transition-transform cursor-pointer"
              >
                {/* Card thumbnails header */}
                <div className="flex h-24 bg-swu-bg relative">
                  {/* Leader image */}
                  <div className="flex-1 relative overflow-hidden">
                    {leaderImg ? (
                      <img
                        src={leaderImg}
                        alt={leader?.name || ''}
                        className="w-full h-full object-cover object-top"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Swords size={24} className="text-swu-muted/20" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
                      <p className="text-[9px] text-swu-amber font-bold">LÍDER</p>
                      <p className="text-[10px] text-white font-medium truncate">{leader?.name || 'Sin líder'}</p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="w-px bg-swu-border" />

                  {/* Base image */}
                  <div className="flex-1 relative overflow-hidden">
                    {baseImg ? (
                      <img
                        src={baseImg}
                        alt={base?.name || ''}
                        className="w-full h-full object-cover object-top"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen size={24} className="text-swu-muted/20" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
                      <p className="text-[9px] text-swu-green font-bold">BASE</p>
                      <p className="text-[10px] text-white font-medium truncate">{base?.name || 'Sin base'}</p>
                    </div>
                  </div>

                  {/* Validity badge */}
                  <div className="absolute top-2 right-2">
                    {deck.isValid ? (
                      <div className="bg-swu-green/90 rounded-full p-1">
                        <CheckCircle2 size={12} className="text-white" />
                      </div>
                    ) : (
                      <div className="bg-swu-amber/90 rounded-full p-1">
                        <AlertTriangle size={12} className="text-white" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-swu-text">{deck.name}</span>
                    <Badge variant="accent">{formatLabels[deck.format] || deck.format}</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[11px] text-swu-muted">
                      <span className="font-mono font-bold text-swu-accent">{mainCount}/{targetSize}</span>
                      {sideCount > 0 && <span>Side: {sideCount}</span>}
                      <span>{timeAgo(deck.updatedAt)}</span>
                    </div>
                    <button
                      onClick={(e) => handleDelete(deck.id, e)}
                      className="p-1.5 rounded-lg bg-swu-red/10 text-swu-red active:scale-95 transition-transform"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {!deck.isValid && deck.validationErrors.length > 0 && (
                    <p className="text-[10px] text-swu-amber">{deck.validationErrors[0]}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

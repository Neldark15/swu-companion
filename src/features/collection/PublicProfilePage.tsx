import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Package, DollarSign, Layers, Lock, Search } from 'lucide-react'
import {
  getPublicProfile,
  getPublicCollection,
  type PublicProfile,
} from '../../services/collectionService'
import { getPricesForCards, formatPrice, type PriceInfo } from '../../services/pricing'
import { getCardsByIds } from '../../services/swuApi'
import type { Card } from '../../types'

interface CollectionDisplayItem {
  cardId: string
  quantity: number
  card: Card | null
  price: PriceInfo | null
}

export function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [items, setItems] = useState<CollectionDisplayItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const prof = await getPublicProfile(userId!)
        if (cancelled) return

        if (!prof) {
          setNotFound(true)
          setLoading(false)
          return
        }

        if (!prof.isPublic) {
          setProfile(prof)
          setIsPrivate(true)
          setLoading(false)
          return
        }

        setProfile(prof)

        // Load collection
        const collItems = await getPublicCollection(userId!)
        if (cancelled) return

        // Load card details + prices in parallel batch queries
        const cardIds = collItems.map(i => i.cardId)
        const [cardMap, prices] = await Promise.all([
          getCardsByIds(cardIds),
          getPricesForCards(cardIds),
        ])

        const displayItems: CollectionDisplayItem[] = collItems.map(item => ({
          cardId: item.cardId,
          quantity: item.quantity,
          card: cardMap.get(item.cardId) ?? null,
          price: prices.get(item.cardId) ?? null,
        }))

        if (!cancelled) {
          displayItems.sort((a, b) =>
            (a.card?.name ?? '').localeCompare(b.card?.name ?? ''),
          )
          setItems(displayItems)
        }
      } catch (e) {
        console.warn('[PublicProfile] Failed to load:', e)
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [userId])

  // Stats
  const stats = useMemo(() => {
    let total = 0
    let value = 0
    for (const item of items) {
      total += item.quantity
      if (item.price?.market) value += item.price.market * item.quantity
    }
    return { unique: items.length, total, value }
  }, [items])

  // Filtered
  const displayed = useMemo(() => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter(i =>
      i.card?.name.toLowerCase().includes(q) ||
      i.card?.subtitle?.toLowerCase().includes(q) ||
      i.cardId.toLowerCase().includes(q),
    )
  }, [items, search])

  const rarityColor = (r?: string) => {
    switch (r) {
      case 'Legendary': return 'text-swu-amber'
      case 'Rare': return 'text-swu-accent'
      case 'Uncommon': return 'text-swu-green'
      case 'Special': return 'text-purple-400'
      default: return 'text-swu-muted'
    }
  }

  return (
    <div className="min-h-screen bg-swu-bg pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-swu-bg/95 backdrop-blur border-b border-swu-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-swu-muted">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold text-swu-text flex-1">
            {profile?.name ?? 'Perfil'}
          </h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Loading */}
        {loading && (
          <div className="text-center py-16 text-swu-muted">
            <div className="animate-spin w-8 h-8 border-2 border-swu-accent border-t-transparent rounded-full mx-auto mb-3" />
            Cargando perfil...
          </div>
        )}

        {/* Not found */}
        {!loading && notFound && (
          <div className="text-center py-16">
            <Package size={48} className="mx-auto text-swu-muted/30 mb-4" />
            <p className="text-swu-muted">Perfil no encontrado</p>
          </div>
        )}

        {/* Private */}
        {!loading && isPrivate && profile && (
          <div className="text-center py-16">
            <Lock size={48} className="mx-auto text-swu-muted/30 mb-4" />
            <p className="text-swu-text font-medium mb-2">{profile.name}</p>
            <p className="text-swu-muted text-sm">Esta colección es privada</p>
          </div>
        )}

        {/* Profile loaded */}
        {!loading && profile && !isPrivate && (
          <>
            {/* Profile header */}
            <div className="bg-swu-surface rounded-xl p-4 border border-swu-border text-center">
              <div className="text-4xl mb-2">{profile.avatar}</div>
              <div className="text-lg font-bold text-swu-text">{profile.name}</div>
              {profile.bio && (
                <div className="text-sm text-swu-muted mt-1">{profile.bio}</div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-swu-surface rounded-xl p-3 text-center border border-swu-border">
                <Package size={16} className="mx-auto text-swu-accent mb-1" />
                <div className="text-lg font-bold text-swu-text">{stats.unique}</div>
                <div className="text-[10px] text-swu-muted">Únicas</div>
              </div>
              <div className="bg-swu-surface rounded-xl p-3 text-center border border-swu-border">
                <Layers size={16} className="mx-auto text-swu-amber mb-1" />
                <div className="text-lg font-bold text-swu-text">{stats.total}</div>
                <div className="text-[10px] text-swu-muted">Copias</div>
              </div>
              <div className="bg-swu-surface rounded-xl p-3 text-center border border-swu-border">
                <DollarSign size={16} className="mx-auto text-swu-green mb-1" />
                <div className="text-lg font-bold text-swu-text">{formatPrice(stats.value)}</div>
                <div className="text-[10px] text-swu-muted">Valor</div>
              </div>
            </div>

            {/* Search */}
            {items.length > 5 && (
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
                <input
                  type="text"
                  placeholder="Buscar en colección..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-swu-surface border border-swu-border rounded-xl pl-9 pr-3 py-2.5
                             text-sm text-swu-text placeholder:text-swu-muted focus:border-swu-accent outline-none"
                />
              </div>
            )}

            {/* Collection list */}
            {items.length === 0 ? (
              <div className="text-center py-8 text-swu-muted text-sm">
                Este usuario no tiene cartas en su colección
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-xs text-swu-muted px-1">
                  {displayed.length} carta{displayed.length !== 1 ? 's' : ''}
                </div>
                {displayed.map(item => (
                  <button
                    key={item.cardId}
                    onClick={() => navigate(`/cards/${item.cardId}`)}
                    className="w-full bg-swu-surface rounded-xl p-3 border border-swu-border
                               flex items-center gap-3 text-left active:scale-[0.99]"
                  >
                    {item.card?.imageUrl ? (
                      <img
                        src={item.card.imageUrl}
                        alt={item.card.name}
                        className="w-12 h-16 rounded-lg object-cover bg-swu-bg flex-shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-12 h-16 rounded-lg bg-swu-bg flex items-center justify-center flex-shrink-0">
                        <Package size={16} className="text-swu-muted" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-swu-text truncate">
                        {item.card?.name ?? item.cardId}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.card?.rarity && (
                          <span className={`text-[10px] font-medium ${rarityColor(item.card.rarity)}`}>
                            {item.card.rarity}
                          </span>
                        )}
                        {item.card?.setCode && (
                          <span className="text-[10px] text-swu-muted">{item.card.setCode}</span>
                        )}
                      </div>
                      {item.price?.market != null && item.price.market > 0 && (
                        <div className="text-xs text-swu-green mt-0.5">
                          {formatPrice(item.price.market)}
                        </div>
                      )}
                    </div>

                    <div className="text-sm font-bold text-swu-accent flex-shrink-0">
                      ×{item.quantity}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

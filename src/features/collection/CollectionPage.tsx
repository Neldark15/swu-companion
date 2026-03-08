import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Search, SlidersHorizontal, Eye, EyeOff,
  Package, DollarSign, Layers, TrendingUp, RefreshCw,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { getCardsByIds } from '../../services/swuApi'
import {
  getMyCollectionWithPrices,
  updateCollectionQuantity,
  calculateCollectionStats,
  toggleProfilePublic,
  getMyPublicStatus,
  type CollectionCardWithPrice,
} from '../../services/collectionService'
import { formatPrice, fetchTCGPrices } from '../../services/pricing'
import type { Card } from '../../types'

type SortKey = 'name' | 'price' | 'quantity' | 'rarity'
type FilterType = '' | 'Unit' | 'Event' | 'Upgrade' | 'Leader' | 'Base'

const RARITY_ORDER: Record<string, number> = {
  Legendary: 0, Special: 1, Rare: 2, Uncommon: 3, Common: 4,
}

export function CollectionPage() {
  const navigate = useNavigate()
  const { currentProfileId, supabaseUser } = useAuth()

  const [items, setItems] = useState<CollectionCardWithPrice[]>([])
  const [cards, setCards] = useState<Map<string, Card>>(new Map())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('name')
  const [filterType, setFilterType] = useState<FilterType>('')
  const [showFilters, setShowFilters] = useState(false)
  const [isPublic, setIsPublic] = useState(true)
  const [fetchingPrices, setFetchingPrices] = useState(false)
  const [priceStatus, setPriceStatus] = useState('')

  // Load collection
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const collItems = await getMyCollectionWithPrices(currentProfileId ?? undefined)
        if (cancelled) return
        setItems(collItems)

        // Load card details in a single batch query
        const cardIds = collItems.map(i => i.cardId)
        const cardMap = await getCardsByIds(cardIds)
        if (!cancelled) setCards(cardMap)
      } catch (e) {
        console.warn('[Collection] Failed to load:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [currentProfileId])

  // Load public status
  useEffect(() => {
    if (!supabaseUser) return
    getMyPublicStatus(supabaseUser.id).then(s => setIsPublic(s.isPublic))
  }, [supabaseUser])

  // Stats
  const stats = useMemo(() => calculateCollectionStats(items), [items])

  // Filtered + sorted items
  const displayed = useMemo(() => {
    let list = [...items]

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(item => {
        const card = cards.get(item.cardId)
        if (!card) return item.cardId.toLowerCase().includes(q)
        return card.name.toLowerCase().includes(q) ||
          (card.subtitle?.toLowerCase().includes(q))
      })
    }

    // Filter by type
    if (filterType) {
      list = list.filter(item => {
        const card = cards.get(item.cardId)
        return card?.type === filterType
      })
    }

    // Sort
    list.sort((a, b) => {
      const ca = cards.get(a.cardId)
      const cb = cards.get(b.cardId)
      switch (sortBy) {
        case 'name':
          return (ca?.name ?? '').localeCompare(cb?.name ?? '')
        case 'price': {
          const pa = a.price?.market ?? 0
          const pb = b.price?.market ?? 0
          return pb - pa
        }
        case 'quantity':
          return b.quantity - a.quantity
        case 'rarity': {
          const ra = RARITY_ORDER[ca?.rarity ?? 'Common'] ?? 5
          const rb = RARITY_ORDER[cb?.rarity ?? 'Common'] ?? 5
          return ra - rb
        }
        default:
          return 0
      }
    })

    return list
  }, [items, cards, search, filterType, sortBy])

  // Handlers
  const handleTogglePublic = useCallback(async () => {
    if (!supabaseUser) return
    const newVal = !isPublic
    setIsPublic(newVal)
    await toggleProfilePublic(supabaseUser.id, newVal)
  }, [supabaseUser, isPublic])

  const handleQuantityChange = useCallback(async (cardId: string, delta: number) => {
    const item = items.find(i => i.cardId === cardId)
    const current = item?.quantity ?? 0
    const newQty = Math.max(0, current + delta)

    setItems(prev => {
      if (newQty <= 0) return prev.filter(i => i.cardId !== cardId)
      return prev.map(i =>
        i.cardId === cardId ? { ...i, quantity: newQty } : i,
      )
    })

    await updateCollectionQuantity(
      cardId,
      newQty,
      currentProfileId ?? undefined,
      supabaseUser?.id,
    )
  }, [items, currentProfileId, supabaseUser])

  const handleFetchPrices = useCallback(async () => {
    if (fetchingPrices || items.length === 0) return
    setFetchingPrices(true)
    setPriceStatus('Conectando con TCGPlayer...')

    try {
      // Build card info for pricing
      const cardInfos = items
        .map(item => {
          const card = cards.get(item.cardId)
          if (!card) return null
          return { id: card.id, name: card.name, subtitle: card.subtitle, setCode: card.setCode }
        })
        .filter(Boolean) as { id: string; name: string; subtitle: string | null; setCode: string }[]

      const count = await fetchTCGPrices(cardInfos, (setCode, fetched) => {
        setPriceStatus(`${setCode}... ${fetched} precios`)
      })

      setPriceStatus(`✓ ${count} precios actualizados`)

      // Reload collection with new prices
      const collItems = await getMyCollectionWithPrices(currentProfileId ?? undefined)
      setItems(collItems)
    } catch (e) {
      console.warn('[Collection] Price fetch failed:', e)
      setPriceStatus('Error al obtener precios')
    } finally {
      setFetchingPrices(false)
      setTimeout(() => setPriceStatus(''), 4000)
    }
  }, [fetchingPrices, items, cards, currentProfileId])

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
          <h1 className="text-lg font-bold text-swu-text flex-1">Mi Botín de Cartas</h1>
          {supabaseUser && (
            <button
              onClick={handleTogglePublic}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                isPublic
                  ? 'bg-swu-green/15 text-swu-green'
                  : 'bg-swu-surface text-swu-muted'
              }`}
            >
              {isPublic ? <Eye size={14} /> : <EyeOff size={14} />}
              {isPublic ? 'Público' : 'Privado'}
            </button>
          )}
          <button
            onClick={() => navigate('/cards')}
            className="bg-swu-accent/15 text-swu-accent p-2 rounded-lg"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-swu-surface rounded-xl p-3 text-center border border-swu-border">
            <Package size={16} className="mx-auto text-swu-accent mb-1" />
            <div className="text-lg font-bold text-swu-text">{stats.uniqueCards}</div>
            <div className="text-[10px] text-swu-muted">Únicas</div>
          </div>
          <div className="bg-swu-surface rounded-xl p-3 text-center border border-swu-border">
            <Layers size={16} className="mx-auto text-swu-amber mb-1" />
            <div className="text-lg font-bold text-swu-text">{stats.totalCopies}</div>
            <div className="text-[10px] text-swu-muted">Copias</div>
          </div>
          <div className="bg-swu-surface rounded-xl p-3 text-center border border-swu-border">
            <DollarSign size={16} className="mx-auto text-swu-green mb-1" />
            <div className="text-lg font-bold text-swu-text">{stats.formattedValue}</div>
            <div className="text-[10px] text-swu-muted">Valor</div>
          </div>
          <div className="bg-swu-surface rounded-xl p-3 text-center border border-swu-border">
            <TrendingUp size={16} className="mx-auto text-purple-400 mb-1" />
            <div className="text-lg font-bold text-swu-text">
              {items.filter(i => i.price?.market).length}
            </div>
            <div className="text-[10px] text-swu-muted">Con precio</div>
          </div>
        </div>

        {/* Fetch Prices button */}
        <button
          onClick={handleFetchPrices}
          disabled={fetchingPrices || items.length === 0}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium
                     border transition-colors ${
                       fetchingPrices
                         ? 'bg-swu-green/10 border-swu-green/30 text-swu-green'
                         : 'bg-swu-surface border-swu-border text-swu-muted hover:text-swu-green hover:border-swu-green/30'
                     }`}
        >
          <RefreshCw size={14} className={fetchingPrices ? 'animate-spin' : ''} />
          {fetchingPrices ? priceStatus : 'Actualizar Precios (TCGPlayer)'}
        </button>
        {priceStatus && !fetchingPrices && (
          <div className="text-center text-[10px] text-swu-green font-mono">{priceStatus}</div>
        )}

        {/* Search + Filters */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
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
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-xl border transition-colors ${
              showFilters || filterType
                ? 'bg-swu-accent/15 border-swu-accent text-swu-accent'
                : 'bg-swu-surface border-swu-border text-swu-muted'
            }`}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

        {/* Filter options */}
        {showFilters && (
          <div className="bg-swu-surface rounded-xl p-3 border border-swu-border space-y-3">
            <div>
              <div className="text-xs text-swu-muted mb-2">Tipo</div>
              <div className="flex flex-wrap gap-1.5">
                {(['', 'Unit', 'Event', 'Upgrade', 'Leader', 'Base'] as FilterType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      filterType === t
                        ? 'bg-swu-accent text-white'
                        : 'bg-swu-bg text-swu-muted'
                    }`}
                  >
                    {t || 'Todos'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-swu-muted mb-2">Ordenar por</div>
              <div className="flex flex-wrap gap-1.5">
                {([
                  ['name', 'Nombre'],
                  ['price', 'Precio'],
                  ['quantity', 'Cantidad'],
                  ['rarity', 'Rareza'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSortBy(key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      sortBy === key
                        ? 'bg-swu-accent text-white'
                        : 'bg-swu-bg text-swu-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12 text-swu-muted">
            <div className="animate-spin w-8 h-8 border-2 border-swu-accent border-t-transparent rounded-full mx-auto mb-3" />
            Cargando colección...
          </div>
        )}

        {/* Empty state */}
        {!loading && items.length === 0 && (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-swu-muted/30 mb-4" />
            <p className="text-swu-muted mb-4">Tu colección está vacía</p>
            <button
              onClick={() => navigate('/cards')}
              className="bg-swu-accent text-white px-4 py-2 rounded-xl text-sm font-medium"
            >
              Explorar cartas
            </button>
          </div>
        )}

        {/* Card list */}
        {!loading && displayed.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs text-swu-muted px-1">
              {displayed.length} carta{displayed.length !== 1 ? 's' : ''}
            </div>
            {displayed.map(item => {
              const card = cards.get(item.cardId)
              return (
                <div
                  key={item.cardId}
                  className="bg-swu-surface rounded-xl p-3 border border-swu-border flex items-center gap-3"
                >
                  {/* Card image */}
                  <button
                    onClick={() => navigate(`/cards/${item.cardId}`)}
                    className="flex-shrink-0"
                  >
                    {card?.imageUrl ? (
                      <img
                        src={card.imageUrl}
                        alt={card.name}
                        className="w-12 h-16 rounded-lg object-cover bg-swu-bg"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-12 h-16 rounded-lg bg-swu-bg flex items-center justify-center">
                        <Package size={16} className="text-swu-muted" />
                      </div>
                    )}
                  </button>

                  {/* Card info */}
                  <button
                    onClick={() => navigate(`/cards/${item.cardId}`)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="text-sm font-medium text-swu-text truncate">
                      {card?.name ?? item.cardId}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {card?.rarity && (
                        <span className={`text-[10px] font-medium ${rarityColor(card.rarity)}`}>
                          {card.rarity}
                        </span>
                      )}
                      {card?.setCode && (
                        <span className="text-[10px] text-swu-muted">{card.setCode}</span>
                      )}
                    </div>
                    <div className={`text-xs mt-0.5 ${item.price?.market ? 'text-swu-green' : 'text-swu-muted/50'}`}>
                      {formatPrice(item.price?.market)}
                      {item.price?.market && item.quantity > 1 && (
                        <span className="text-swu-muted ml-1">
                          (×{item.quantity} = {formatPrice(item.price.market * item.quantity)})
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleQuantityChange(item.cardId, -1)}
                      className="w-7 h-7 rounded-lg bg-swu-bg text-swu-muted flex items-center justify-center
                                 text-sm font-bold active:scale-95"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-swu-text">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleQuantityChange(item.cardId, 1)}
                      className="w-7 h-7 rounded-lg bg-swu-accent/15 text-swu-accent flex items-center justify-center
                                 text-sm font-bold active:scale-95"
                    >
                      +
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* No results */}
        {!loading && items.length > 0 && displayed.length === 0 && (
          <div className="text-center py-8 text-swu-muted text-sm">
            No se encontraron cartas con esos filtros
          </div>
        )}
      </div>
    </div>
  )
}

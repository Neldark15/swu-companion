import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Package, DollarSign, Layers, Lock, Search, RefreshCw, Loader2, SlidersHorizontal } from 'lucide-react'
import {
  getPublicProfile,
  getPublicCollection,
  type PublicProfile,
} from '../../services/collectionService'
import { getPricesForCards, fetchTCGPrices, formatPrice, type PriceInfo } from '../../services/pricing'
import { getCardsByIds } from '../../services/swuApi'
import type { Card } from '../../types'

const swAvatarIds = ['chewbacca','r2d2','c3po','bb8','pilot','boba-fett','stormtrooper','darth-vader','phasma','kylo-ren','jedi-order','phoenix','rebel-alliance','galactic-empire','first-order','first-order-2','starfighter','sith-empire','rebel-alliance-2','jedi-order-2','new-republic','empire-gear','separatist','galactic-republic']

type SortKey = 'name' | 'price' | 'quantity' | 'rarity' | 'set'
type FilterType = '' | 'Unit' | 'Event' | 'Upgrade' | 'Leader' | 'Base'

const SET_LABELS: Record<string, string> = {
  SOR: 'Spark of Rebellion',
  SHD: 'Shadows of the Galaxy',
  TWI: 'Twilight of the Republic',
  JTL: 'Jump to Lightspeed',
  ALT: 'A Lawless Time',
}

const RARITY_ORDER: Record<string, number> = {
  Legendary: 0, Special: 1, Rare: 2, Uncommon: 3, Common: 4,
}

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
  const [sortBy, setSortBy] = useState<SortKey>('name')
  const [filterType, setFilterType] = useState<FilterType>('')
  const [filterSet, setFilterSet] = useState('')
  const [filterRarity, setFilterRarity] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState('')

  const handleRefreshPrices = async () => {
    if (refreshing || items.length === 0) return
    setRefreshing(true)
    setRefreshMsg('Obteniendo precios de TCGPlayer...')

    try {
      const cardsToPrice = items
        .filter(i => i.card)
        .map(i => ({
          id: i.cardId,
          name: i.card!.name,
          subtitle: i.card!.subtitle || null,
          setCode: i.card!.setCode || '',
        }))

      const count = await fetchTCGPrices(cardsToPrice, (setCode, fetched) => {
        setRefreshMsg(`${setCode}: ${fetched} precios obtenidos...`)
      })

      // Reload prices
      const cardIds = items.map(i => i.cardId)
      const newPrices = await getPricesForCards(cardIds)
      setItems(prev =>
        prev.map(item => ({
          ...item,
          price: newPrices.get(item.cardId) ?? item.price,
        })),
      )

      setRefreshMsg(`${count} precios actualizados`)
      setTimeout(() => setRefreshMsg(''), 3000)
    } catch {
      setRefreshMsg('Error al obtener precios')
      setTimeout(() => setRefreshMsg(''), 3000)
    } finally {
      setRefreshing(false)
    }
  }

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

  // Available sets in collection
  const availableSets = useMemo(() => {
    const sets = new Set<string>()
    for (const item of items) {
      if (item.card?.setCode) sets.add(item.card.setCode)
    }
    return Array.from(sets).sort()
  }, [items])

  // Available rarities in collection
  const availableRarities = useMemo(() => {
    const rarities = new Set<string>()
    for (const item of items) {
      if (item.card?.rarity) rarities.add(item.card.rarity)
    }
    return ['Legendary', 'Special', 'Rare', 'Uncommon', 'Common'].filter(r => rarities.has(r))
  }, [items])

  // Filtered + sorted
  const displayed = useMemo(() => {
    let list = [...items]

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(i =>
        i.card?.name.toLowerCase().includes(q) ||
        i.card?.subtitle?.toLowerCase().includes(q) ||
        i.cardId.toLowerCase().includes(q),
      )
    }

    // Type filter
    if (filterType) {
      list = list.filter(i => i.card?.type === filterType)
    }

    // Set filter
    if (filterSet) {
      list = list.filter(i => i.card?.setCode === filterSet)
    }

    // Rarity filter
    if (filterRarity) {
      list = list.filter(i => i.card?.rarity === filterRarity)
    }

    // Sort
    list.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.card?.name ?? '').localeCompare(b.card?.name ?? '')
        case 'price': {
          const pa = a.price?.market ?? 0
          const pb = b.price?.market ?? 0
          return pb - pa
        }
        case 'quantity':
          return b.quantity - a.quantity
        case 'rarity': {
          const ra = RARITY_ORDER[a.card?.rarity ?? 'Common'] ?? 5
          const rb = RARITY_ORDER[b.card?.rarity ?? 'Common'] ?? 5
          return ra - rb
        }
        case 'set':
          return (a.card?.setCode ?? '').localeCompare(b.card?.setCode ?? '')
        default:
          return 0
      }
    })

    return list
  }, [items, search, filterType, filterSet, filterRarity, sortBy])

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
    <div className="min-h-screen bg-swu-bg pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-swu-bg/95 backdrop-blur border-b border-swu-border">
        <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-swu-muted">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold text-swu-text flex-1">
            {profile?.name ?? 'Perfil'}
          </h1>
        </div>
      </div>

      <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 py-4 space-y-4">
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
              <div className="w-16 h-16 rounded-full bg-swu-bg mx-auto mb-2 flex items-center justify-center overflow-hidden">
                {swAvatarIds.includes(profile.avatar)
                  ? <img src={`/avatars/${profile.avatar}.png`} alt="" className="w-12 h-12 object-contain" />
                  : <span className="text-4xl">{profile.avatar}</span>
                }
              </div>
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

            {/* Refresh Prices Button */}
            {items.length > 0 && (
              <button
                onClick={handleRefreshPrices}
                disabled={refreshing}
                className="w-full py-2.5 rounded-xl bg-swu-green/10 border border-swu-green/30 text-swu-green
                           font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all
                           disabled:opacity-50"
              >
                {refreshing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                {refreshMsg || 'Actualizar Precios'}
              </button>
            )}

            {/* Search + Filters */}
            {items.length > 0 && (
              <>
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
                      showFilters || filterType || filterSet || filterRarity
                        ? 'bg-swu-accent/15 border-swu-accent text-swu-accent'
                        : 'bg-swu-surface border-swu-border text-swu-muted'
                    }`}
                  >
                    <SlidersHorizontal size={18} />
                  </button>
                </div>

                {/* Filter panel */}
                {showFilters && (
                  <div className="bg-swu-surface rounded-xl p-3 border border-swu-border space-y-3">
                    {/* Type filter */}
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

                    {/* Set filter */}
                    {availableSets.length > 0 && (
                      <div>
                        <div className="text-xs text-swu-muted mb-2">Set</div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => setFilterSet('')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                              filterSet === '' ? 'bg-swu-amber text-white' : 'bg-swu-bg text-swu-muted'
                            }`}
                          >
                            Todos
                          </button>
                          {availableSets.map(s => (
                            <button
                              key={s}
                              onClick={() => setFilterSet(filterSet === s ? '' : s)}
                              title={SET_LABELS[s] || s}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                filterSet === s ? 'bg-swu-amber text-white' : 'bg-swu-bg text-swu-muted'
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rarity filter */}
                    {availableRarities.length > 0 && (
                      <div>
                        <div className="text-xs text-swu-muted mb-2">Rareza</div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => setFilterRarity('')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                              filterRarity === '' ? 'bg-purple-500 text-white' : 'bg-swu-bg text-swu-muted'
                            }`}
                          >
                            Todas
                          </button>
                          {availableRarities.map(r => (
                            <button
                              key={r}
                              onClick={() => setFilterRarity(filterRarity === r ? '' : r)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                filterRarity === r
                                  ? r === 'Legendary' ? 'bg-swu-amber text-white'
                                    : r === 'Rare' ? 'bg-swu-accent text-white'
                                    : r === 'Special' ? 'bg-purple-500 text-white'
                                    : r === 'Uncommon' ? 'bg-swu-green text-white'
                                    : 'bg-swu-muted text-white'
                                  : 'bg-swu-bg text-swu-muted'
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sort */}
                    <div>
                      <div className="text-xs text-swu-muted mb-2">Ordenar por</div>
                      <div className="flex flex-wrap gap-1.5">
                        {([
                          ['name', 'Nombre'],
                          ['price', 'Precio'],
                          ['quantity', 'Cantidad'],
                          ['rarity', 'Rareza'],
                          ['set', 'Set'],
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

                    {/* Active filters indicator + clear */}
                    {(filterType || filterSet || filterRarity) && (
                      <div className="flex items-center justify-between pt-1 border-t border-swu-border/50">
                        <div className="flex flex-wrap gap-1">
                          {filterType && (
                            <span className="px-2 py-0.5 rounded-full bg-swu-accent/15 text-swu-accent text-[10px] font-medium">
                              {filterType}
                            </span>
                          )}
                          {filterSet && (
                            <span className="px-2 py-0.5 rounded-full bg-swu-amber/15 text-swu-amber text-[10px] font-medium">
                              {filterSet}
                            </span>
                          )}
                          {filterRarity && (
                            <span className="px-2 py-0.5 rounded-full bg-purple-400/15 text-purple-400 text-[10px] font-medium">
                              {filterRarity}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => { setFilterType(''); setFilterSet(''); setFilterRarity('') }}
                          className="text-[10px] text-red-400 font-medium"
                        >
                          Limpiar filtros
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
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

            {/* No results with filters */}
            {items.length > 0 && displayed.length === 0 && (
              <div className="text-center py-8 text-swu-muted text-sm">
                No se encontraron cartas con esos filtros
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

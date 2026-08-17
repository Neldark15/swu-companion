import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Package, DollarSign, Layers, Lock, Search, RefreshCw, Loader2, SlidersHorizontal } from 'lucide-react'
import {
  getPublicProfile,
  getPublicCollection,
  type PublicProfile,
} from '../../services/collectionService'
import { getPricesForCards, fetchTCGPrices, formatPrice, precioPromedio, type PriceInfo } from '../../services/pricing'
import { getPersonalizacion, VACIA, type Personalizacion } from '../../services/profileCustomService'
import { PerfilPersonalizado } from '../profile/PerfilVitrina'
import { BannerPortada } from '../profile/BannerPortada'
import { MeleeRecordDeUsuario } from '../profile/MeleeRecord'
import { CardImage } from '../../components/CardImage'
import { listFaceUrl, listFaceIsLandscape } from '../../services/cardArt'
import { getCardsByIds, MAIN_SET_LABELS } from '../../services/swuApi'
import { byCanonicalCard, compareCardsBySetNumber } from '../../services/cardSort'
import type { Card } from '../../types'
import { Avatar } from '../../components/ui/Avatar'
import { getUserListings, type MarketplaceListing } from '../../services/collectionService'


type SortKey = 'canonical' | 'name' | 'price' | 'quantity' | 'rarity' | 'set'
type FilterType = '' | 'Unit' | 'Event' | 'Upgrade' | 'Leader' | 'Base'

// Centralized in swuApi — all 8 main expansions (incl. LOF, SEC, LAW, ASH)
const SET_LABELS = MAIN_SET_LABELS

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
  const [custom, setCustom] = useState<Personalizacion>(VACIA)
  const [items, setItems] = useState<CollectionDisplayItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('canonical')
  const [filterType, setFilterType] = useState<FilterType>('')
  const [filterSet, setFilterSet] = useState('')
  const [filterRarity, setFilterRarity] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState('')
  /**
   * Lo que esta persona tiene en venta.
   *
   * `getUserListings` existía desde que se hizo el mercado y NO la llamaba
   * nadie: el mercado te deja tocar el nombre del vendedor, te trae acá, y acá
   * no se veía ni una de sus publicaciones. Era el final del camino más obvio
   * de la pantalla, y estaba roto por omisión.
   */
  const [enVenta, setEnVenta] = useState<MarketplaceListing[]>([])
  const [cartasVenta, setCartasVenta] = useState<Map<string, Card>>(new Map())

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

  // Stage 1: profile + collection IDs — fast, blocks initial render
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function loadShell() {
      setLoading(true)
      try {
        const prof = await getPublicProfile(userId!)
        // La personalización es opcional: si falla, el perfil se ve igual.
        void getPersonalizacion(userId!).then(setCustom).catch(() => {})
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

        // Just the IDs — fast Supabase query
        const collItems = await getPublicCollection(userId!)
        if (cancelled) return

        // Render IMMEDIATELY with skeleton cards (null card). Hydration runs
        // in a separate effect below so the user sees the list right away
        // instead of waiting for all card details to come back.
        const skeleton: CollectionDisplayItem[] = collItems.map(item => ({
          cardId: item.cardId,
          quantity: item.quantity,
          card: null,
          price: null,
        }))
        setItems(skeleton)
      } catch (e) {
        console.warn('[PublicProfile] Failed to load shell:', e)
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadShell()
    return () => { cancelled = true }
  }, [userId])

  // Lo que vende, aparte del resto: es una consulta chica y no debe retrasar
  // el perfil. Si falla, la sección simplemente no aparece.
  useEffect(() => {
    if (!userId) return
    let vivo = true
    ;(async () => {
      try {
        const list = await getUserListings(userId)
        if (!vivo) return
        setEnVenta(list)
        if (list.length > 0) {
          const mapa = await getCardsByIds([...new Set(list.map(l => l.cardId))])
          if (vivo) setCartasVenta(mapa)
        }
      } catch (e) {
        console.warn('[PublicProfile] no se pudo leer lo que vende:', e)
      }
    })()
    return () => { vivo = false }
  }, [userId])

  // Stage 2: hydrate card details in background once we have IDs
  useEffect(() => {
    if (items.length === 0) return
    // Skip if all already hydrated (re-renders shouldn't trigger another fetch)
    const needsCards = items.some(i => !i.card)
    if (!needsCards) return

    let cancelled = false
    const cardIds = items.map(i => i.cardId)

    getCardsByIds(cardIds).then(cardMap => {
      if (cancelled) return
      setItems(prev => {
        const hydrated = prev.map(item => ({
          ...item,
          card: item.card ?? cardMap.get(item.cardId) ?? null,
        }))
        // Orden del juego ahora que tenemos los detalles
        hydrated.sort(byCanonicalCard(i => i.card))
        return hydrated
      })
    }).catch(e => console.warn('[PublicProfile] Card hydration failed:', e))

    return () => { cancelled = true }
  // We only want to hydrate ONCE per items-set change (not on every prop tweak).
  // Using items.length as a coarse dependency for that.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])

  // Stage 3: deferred prices — non-blocking, runs after cards are showing
  useEffect(() => {
    if (items.length === 0) return
    const needsPrices = items.some(i => !i.price)
    if (!needsPrices) return

    let cancelled = false
    const cardIds = items.map(i => i.cardId)

    getPricesForCards(cardIds).then(prices => {
      if (cancelled) return
      setItems(prev => prev.map(item => ({
        ...item,
        price: item.price ?? prices.get(item.cardId) ?? null,
      })))
    }).catch(() => { /* prices are optional */ })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])

  // Stats
  const stats = useMemo(() => {
    let total = 0
    let value = 0
    for (const item of items) {
      total += item.quantity
      // Valor con el promedio (bajo–alto), igual que en Mi Botín.
      const prom = precioPromedio(item.price)
      if (prom) value += prom * item.quantity
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
    const canonical = byCanonicalCard<typeof list[number]>(i => i.card)
    list.sort((a, b) => {
      switch (sortBy) {
        case 'canonical':
          return canonical(a, b)
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
        case 'set': {
          if (!a.card || !b.card) return a.card ? -1 : b.card ? 1 : 0
          return compareCardsBySetNumber(a.card, b.card)
        }
        default:
          return canonical(a, b)
      }
    })

    return list
  }, [items, search, filterType, filterSet, filterRarity, sortBy])

  const rarityColor = (r?: string) => {
    switch (r) {
      case 'Legendary': return 'text-swu-amber'
      case 'Rare': return 'text-swu-accent-texto'
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
            {/* Profile header — con la portada elegida de fondo, si la hay */}
            <div className="relative overflow-hidden bg-swu-surface rounded-xl p-4 border border-swu-border text-center">
              <BannerPortada cardId={custom.banner_card_id} className="absolute inset-0 h-full w-full opacity-50" />
              {/* emoji de 36px (text-4xl) en una caja de 64 */}
              <Avatar avatar={profile.avatar} size={64} escalaEmoji={36 / 64} className="relative mx-auto mb-2" />
              <div className="relative text-lg font-bold text-swu-text">{profile.name}</div>
              {profile.bio && (
                <div className="relative text-sm text-swu-muted mt-1">{profile.bio}</div>
              )}
              <div className="relative mt-2 flex justify-center">
                <PerfilPersonalizado p={{ ...custom, showcase_cards: [] }} />
              </div>
            </div>

            {/* Las cartas van fuera del bloque centrado: necesitan el ancho
                completo para su scroll horizontal propio. */}
            <PerfilPersonalizado p={{ ...custom, favorite_aspects: [] }} />

            {/* Sus torneos de melee, si enlazó cuenta. Si no, no se dibuja. */}
            {userId && (
              <div className="mt-3">
                <MeleeRecordDeUsuario userId={userId} />
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-swu-surface rounded-xl p-3 text-center border border-swu-border">
                <Package size={16} className="mx-auto text-swu-accent-texto mb-1" />
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

            {/* Lo que vende — antes del binder completo, porque es lo
                accionable: de acá salís a escribirle. */}
            {enVenta.length > 0 && (
              <section className="rounded-xl border border-swu-amber/25 bg-swu-amber/5 p-3">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-bold text-swu-amber">
                    En venta · {enVenta.length}
                  </h3>
                  <button
                    onClick={() => navigate('/explore')}
                    className="text-[11px] text-swu-muted underline underline-offset-2"
                  >
                    Ver el mercado
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {enVenta.slice(0, 8).map(l => {
                    const c = cartasVenta.get(l.cardId)
                    return (
                      <button
                        key={l.cardId}
                        onClick={() => navigate(`/cards/${l.cardId}`)}
                        className="text-left"
                        title={c?.name ?? 'Carta'}
                      >
                        <CardImage
                          src={listFaceUrl(c)}
                          orientacion={listFaceIsLandscape(c) ? 'apaisada' : 'vertical'}
                          alt={c?.name ?? ''}
                          className="w-full"
                        />
                        <p className="mt-1 truncate text-[10px] font-semibold text-swu-text">
                          {c?.name ?? '…'}
                        </p>
                        {/* Sin precio NO se inventa uno: se dice que se acuerda. */}
                        <p className="font-mono text-[10px] text-swu-green">
                          {l.price !== null ? formatPrice(l.price) : 'a convenir'}
                        </p>
                      </button>
                    )
                  })}
                </div>
                {enVenta.length > 8 && (
                  <p className="mt-2 text-[11px] text-swu-muted">
                    y {enVenta.length - 8} más en el mercado
                  </p>
                )}
              </section>
            )}

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
                        ? 'bg-swu-accent/15 border-swu-accent text-swu-accent-texto'
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
                          ['canonical', 'Orden del juego'],
                          ['set', 'Por expansión'],
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

                    {/* Active filters indicator + clear */}
                    {(filterType || filterSet || filterRarity) && (
                      <div className="flex items-center justify-between pt-1 border-t border-swu-border/50">
                        <div className="flex flex-wrap gap-1">
                          {filterType && (
                            <span className="px-2 py-0.5 rounded-full bg-swu-accent/15 text-swu-accent-texto text-[10px] font-medium">
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
                      /* Iba con un <img> crudo y la cara FRONTAL: un líder o
                         una base —apaisados— se recortaban dentro de una caja
                         vertical. Va por CardImage, que usa la cara correcta
                         para una lista y respeta el radio real de la carta. */
                      <CardImage
                        src={listFaceUrl(item.card)}
                        orientacion={listFaceIsLandscape(item.card) ? 'apaisada' : 'vertical'}
                        fit="cover"
                        alt={item.card.name}
                        className={`flex-shrink-0 ${
                          listFaceIsLandscape(item.card)
                            ? 'w-20 aspect-[400/286]'
                            : 'w-12 aspect-[286/400]'
                        }`}
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
                      {(() => {
                        const prom = precioPromedio(item.price)
                        return prom != null && prom > 0 ? (
                          <div className="text-xs text-swu-green mt-0.5">{formatPrice(prom)}</div>
                        ) : null
                      })()}
                    </div>

                    <div className="text-sm font-bold text-swu-accent-texto flex-shrink-0">
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

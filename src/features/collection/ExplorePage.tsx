/**
 * Contrabando — explorar colecciones + mercancía (cartas en venta) de otros jugadores.
 *
 * 2 tabs:
 *  - Colecciones: lista de jugadores con sus colecciones públicas (flujo anterior)
 *  - Mercancía: feed global de cartas marcadas en venta (con vendedor + precio + notas)
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Search, Users, Skull, Package, Eye, EyeOff, Tag,
  ShoppingBag, Loader2, ExternalLink, RefreshCw,
} from 'lucide-react'
import {
  searchPublicProfiles,
  getExploreProfiles,
  getMarketplaceListings,
  type PublicProfile,
  type MarketplaceListing,
} from '../../services/collectionService'
import { getCardsByIds } from '../../services/swuApi'
import { CardImage } from '../../components/CardImage'
import type { Card } from '../../types'

/* Avatar helper */
const swAvatarIds = ['chewbacca','r2d2','c3po','bb8','pilot','boba-fett','stormtrooper','darth-vader','phasma','kylo-ren','jedi-order','phoenix','rebel-alliance','galactic-empire','first-order','first-order-2','starfighter','sith-empire','rebel-alliance-2','jedi-order-2','new-republic','empire-gear','separatist','galactic-republic']

type Tab = 'collections' | 'market'

export function ExplorePage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('collections')

  return (
    <div className="min-h-screen bg-swu-bg pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-swu-bg/95 backdrop-blur border-b border-swu-border">
        <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-swu-muted">
            <ArrowLeft size={20} />
          </button>
          <Skull size={20} className="text-red-400" />
          <h1 className="text-lg font-bold text-swu-text flex-1">Contrabando</h1>
        </div>
      </div>

      <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 py-4 space-y-4">
        {/* Tabs */}
        <div className="flex bg-swu-surface rounded-lg p-0.5 border border-swu-border">
          <TabBtn
            active={tab === 'collections'}
            onClick={() => setTab('collections')}
            icon={Users}
            label="Colecciones"
          />
          <TabBtn
            active={tab === 'market'}
            onClick={() => setTab('market')}
            icon={ShoppingBag}
            label="Mercancía"
          />
        </div>

        {tab === 'collections' ? <CollectionsTab /> : <MarketTab />}
      </div>
    </div>
  )
}

// ─── Collections tab (browse user profiles) ───────────────

function CollectionsTab() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [profiles, setProfiles] = useState<PublicProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getExploreProfiles(50)
      .then(data => { if (!cancelled) setProfiles(data) })
      .catch(e => console.warn('[Contrabando] Failed to load profiles:', e))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q)
    setSearching(true)
    try {
      const data = q.trim() ? await searchPublicProfiles(q) : await getExploreProfiles(50)
      setProfiles(data)
    } catch { /* ignore */ }
    finally { setSearching(false) }
  }, [])

  return (
    <div className="space-y-3">
      <p className="text-xs text-red-300/70 font-mono text-center bg-red-500/5 rounded-lg border border-red-500/15 p-2">
        Todos los contrabandistas de la galaxia y su botín de cartas
      </p>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
        <input
          type="text"
          placeholder="Buscar contrabandista..."
          value={query}
          onChange={e => handleSearch(e.target.value)}
          className="w-full bg-swu-surface border border-swu-border rounded-xl pl-9 pr-3 py-2.5
                     text-sm text-swu-text placeholder:text-swu-muted focus:border-red-400 outline-none"
        />
      </div>

      <div className="flex items-center gap-2 text-swu-muted">
        <Users size={14} />
        <span className="text-xs font-medium">
          {query.trim() ? `Resultados para "${query}"` : `${profiles.length} contrabandistas`}
        </span>
      </div>

      {(loading || searching) && (
        <div className="text-center py-12 text-swu-muted">
          <Loader2 size={28} className="text-red-400 animate-spin mx-auto mb-3" />
          Rastreando contrabandistas...
        </div>
      )}

      {!loading && !searching && profiles.length === 0 && (
        <div className="text-center py-12">
          <Users size={48} className="mx-auto text-swu-muted/30 mb-4" />
          <p className="text-swu-muted text-sm">
            {query.trim()
              ? 'No se encontró ningún contrabandista con ese nombre'
              : 'No hay contrabandistas con colecciones públicas todavía'}
          </p>
        </div>
      )}

      {!loading && !searching && profiles.length > 0 && (
        <div className="space-y-1.5">
          {profiles.map(p => (
            <button
              key={p.id}
              onClick={() => navigate(`/u/${p.id}`)}
              className="w-full bg-swu-surface rounded-xl p-3 border border-swu-border
                         flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
            >
              <div className="w-10 h-10 rounded-full bg-swu-bg flex items-center justify-center
                              text-lg flex-shrink-0 overflow-hidden">
                {p.avatar?.startsWith('data:image/')
                  ? <img src={p.avatar} alt="" className="w-10 h-10 object-cover rounded-full" />
                  : swAvatarIds.includes(p.avatar)
                    ? <img src={`/avatars/${p.avatar}.png`} alt="" className="w-8 h-8 object-contain" />
                    : <span>{p.avatar}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-swu-text truncate">{p.name}</span>
                  {p.isPublic
                    ? <Eye size={10} className="text-swu-green flex-shrink-0" />
                    : <EyeOff size={10} className="text-swu-muted flex-shrink-0" />}
                </div>
                {p.bio && <div className="text-xs text-swu-muted truncate mt-0.5">{p.bio}</div>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Package size={12} className={p.cardCount > 0 ? 'text-red-400' : 'text-swu-muted/40'} />
                <span className={`text-xs font-medium ${p.cardCount > 0 ? 'text-red-400' : 'text-swu-muted/40'}`}>
                  {p.cardCount}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Marketplace tab (cards for sale across users) ───────

function MarketTab() {
  const navigate = useNavigate()
  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [cards, setCards] = useState<Map<string, Card>>(new Map())
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getMarketplaceListings({ limit: 200 })
      setListings(list)
      // Hydrate card details
      const cardIds = Array.from(new Set(list.map(l => l.cardId)))
      if (cardIds.length > 0) {
        const cardMap = await getCardsByIds(cardIds)
        setCards(cardMap)
      }
    } catch (e) {
      console.warn('[Contrabando] Failed to load market:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!filter.trim()) return listings
    const q = filter.toLowerCase()
    return listings.filter(l => {
      const card = cards.get(l.cardId)
      if (!card) return l.cardId.toLowerCase().includes(q)
      return card.name.toLowerCase().includes(q)
          || (card.subtitle?.toLowerCase().includes(q))
          || l.sellerName.toLowerCase().includes(q)
          || (l.notes?.toLowerCase().includes(q) ?? false)
    })
  }, [listings, cards, filter])

  return (
    <div className="space-y-3">
      <p className="text-xs text-swu-amber/80 font-mono text-center bg-swu-amber/5 rounded-lg border border-swu-amber/20 p-2">
        Cartas marcadas en venta por los jugadores · {listings.length} listings
      </p>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
          <input
            type="text"
            placeholder="Buscar carta o vendedor..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full bg-swu-surface border border-swu-border rounded-xl pl-9 pr-3 py-2.5
                       text-sm text-swu-text placeholder:text-swu-muted focus:border-swu-amber outline-none"
          />
        </div>
        <button
          onClick={load}
          className="px-3 rounded-xl border border-swu-border bg-swu-surface text-swu-muted hover:text-swu-text"
          title="Refrescar"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && (
        <div className="text-center py-12 text-swu-muted">
          <Loader2 size={28} className="text-swu-amber animate-spin mx-auto mb-3" />
          Cargando mercado...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12">
          <ShoppingBag size={48} className="mx-auto text-swu-muted/30 mb-4" />
          <p className="text-swu-muted text-sm">
            {filter.trim()
              ? 'No se encontraron cartas con esa búsqueda'
              : 'Todavía no hay nadie vendiendo cartas'}
          </p>
          {!filter.trim() && (
            <button
              onClick={() => navigate('/collection')}
              className="mt-3 text-xs text-swu-amber underline"
            >
              ¿Vender tus propias cartas? Andá a Mi Botín
            </button>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-1.5 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
          {filtered.map(l => {
            const card = cards.get(l.cardId)
            return (
              <div
                key={`${l.userId}-${l.cardId}`}
                className="bg-swu-surface rounded-xl p-3 border border-swu-amber/30 flex items-center gap-3"
              >
                <button onClick={() => navigate(`/cards/${l.cardId}`)} className="flex-shrink-0">
                  <CardImage src={card?.imageUrl} alt={card?.name} className="w-12 h-16" />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-swu-text truncate">
                    {card?.name ?? l.cardId}
                  </div>
                  {card?.subtitle && (
                    <div className="text-[10px] text-swu-muted truncate">{card.subtitle}</div>
                  )}

                  {/* Seller chip */}
                  <button
                    onClick={() => navigate(`/u/${l.userId}`)}
                    className="text-[10px] text-swu-muted hover:text-swu-text inline-flex items-center gap-1 mt-1"
                  >
                    <Tag size={9} className="text-swu-amber" />
                    Vende: <span className="font-medium">{l.sellerName}</span>
                    <ExternalLink size={9} />
                  </button>

                  {l.notes && (
                    <p className="text-[10px] text-swu-muted/80 italic mt-0.5 line-clamp-2">"{l.notes}"</p>
                  )}
                </div>

                <div className="text-right flex-shrink-0">
                  {l.price != null ? (
                    <p className="text-base font-extrabold text-swu-amber font-mono">${l.price.toFixed(2)}</p>
                  ) : (
                    <p className="text-[10px] text-swu-muted font-mono">a convenir</p>
                  )}
                  <p className="text-[9px] text-swu-muted/60">qty {l.quantity}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────

function TabBtn({
  active, onClick, icon: Icon, label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Users
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
        active ? 'bg-red-500/15 text-red-400' : 'text-swu-muted hover:text-swu-text'
      }`}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}

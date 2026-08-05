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
  ShoppingBag, Loader2, RefreshCw, Sparkles, MessageCircle, Pencil} from 'lucide-react'
import {
  searchPublicProfiles,
  getExploreProfiles,
  getMarketplaceListings,
  type PublicProfile,
  type MarketplaceListing,
} from '../../services/collectionService'
import { getCardsByIds } from '../../services/swuApi'
import { getTradeMatches, type TradeMatch } from '../../services/tradeService'
import { CardImage } from '../../components/CardImage'
import { Carta3D } from '../../components/Carta3D'
import { VitrinaShowcase } from './VitrinaShowcase'
import { listFaceUrl, listFaceIsLandscape } from '../../services/cardArt'
import { TradeMatches } from './TradeMatches'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../services/db'
import type { Card } from '../../types'

/**
 * Sección de coincidencias de intercambio, arriba del catálogo.
 *
 * Solo aparece con sesión iniciada: sin usuario no hay wishlist ni colección
 * propia contra la que cruzar.
 */
function MatchesSection() {
  const { supabaseUser } = useAuth()
  const [matches, setMatches] = useState<TradeMatch[]>([])
  const [cards, setCards] = useState<Map<string, Card>>(new Map())
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [myName, setMyName] = useState('un jugador')

  useEffect(() => {
    let cancelled = false
    if (!supabaseUser) { setLoading(false); return }

    setFailed(false)
    getTradeMatches(supabaseUser.id)
      .then(async (ms) => {
        if (cancelled) return
        setMatches(ms)
        // Un solo lote para todas las cartas de todas las coincidencias.
        const ids = Array.from(new Set(
          ms.flatMap(m => [...m.theyOffer, ...m.iOffer].map(x => x.cardId)),
        ))
        if (ids.length > 0) {
          // Si esto falla, el mensaje de WhatsApp saldría con "Carta" en vez
          // de nombres — y ese mensaje ya se fue. Mejor marcarlo como fallo.
          try {
            const map = await getCardsByIds(ids)
            if (!cancelled) setCards(map)
          } catch {
            if (!cancelled) setFailed(true)
          }
        }
      })
      // Un fallo de red no puede verse igual que "no hay cruces".
      .catch(() => { if (!cancelled) setFailed(true) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [supabaseUser])

  useEffect(() => {
    if (!supabaseUser) return
    db.profiles.get(supabaseUser.id)
      .then(p => { if (p?.name) setMyName(p.name) })
      .catch(() => {})
  }, [supabaseUser])

  if (!supabaseUser) return null

  return (
    <section>
      <h2 className="text-[10px] font-mono tracking-[0.2em] uppercase text-swu-muted/60 mb-2 px-1">
        Para vos
      </h2>
      {failed ? (
        <div className="bg-swu-amber/10 border border-swu-amber/30 rounded-xl p-3">
          <p className="text-xs text-swu-amber font-semibold">
            No se pudo consultar el cruce
          </p>
          <p className="text-[11px] text-swu-muted mt-0.5">
            Puede que no haya conexión. No es que no tengas coincidencias.
          </p>
        </div>
      ) : (
        <TradeMatches matches={matches} cards={cards} myName={myName} loading={loading} />
      )}
    </section>
  )
}

/* Avatar helper */
const swAvatarIds = ['chewbacca','r2d2','c3po','bb8','pilot','boba-fett','stormtrooper','darth-vader','phasma','kylo-ren','jedi-order','phoenix','rebel-alliance','galactic-empire','first-order','first-order-2','starfighter','sith-empire','rebel-alliance-2','jedi-order-2','new-republic','empire-gear','separatist','galactic-republic']

type Tab = 'collections' | 'market' | 'vitrina'

/**
 * El mensaje que se le manda al vendedor.
 *
 * Antes decía solo el nombre de la carta, y eso no alcanza: **el nombre no
 * identifica una impresión**. Hay cinco cartas llamadas «Cad Bane» y cuatro
 * «Pre Vizsla», con precios muy distintos. Si el vendedor tiene varias, no
 * sabe cuál le están pidiendo y hay que preguntar de nuevo.
 *
 * Así que va todo lo que hace falta para que el trato se cierre en un solo
 * mensaje: qué carta exactamente, de qué set, cuántas, a qué precio publicado
 * y el enlace para verla.
 */
function mensajeVendedor(l: MarketplaceListing, card: Card | undefined): string {
  const nombre = card?.name ?? 'una carta'
  const sub = card?.subtitle ? ` (${card.subtitle})` : ''
  const impresion = card ? ` · ${card.setCode} ${card.setNumber}` : ''
  const precio = l.price != null ? ` · $${l.price.toFixed(2)} c/u` : ' · precio a convenir'
  const cuantas = l.quantity > 1 ? `\nTenés ${l.quantity} publicadas.` : ''
  const enlace = card ? `\n${window.location.origin}/cards/${card.id}` : ''
  return (
    `Hola ${l.sellerName}, te escribo por HOLOCRÓN SWU.\n\n`
    + `Me interesa: ${nombre}${sub}${impresion}${precio}${cuantas}${enlace}`
  )
}

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
        {/* Las coincidencias van ANTES del catálogo: un listado de todo lo
            publicado es un catálogo; esto es una lista de tratos posibles. */}
        <MatchesSection />

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
          <TabBtn
            active={tab === 'vitrina'}
            onClick={() => setTab('vitrina')}
            icon={Sparkles}
            label="Vitrina"
          />
        </div>

        {tab === 'collections' ? <CollectionsTab />
          : tab === 'market' ? <MarketTab />
          : <VitrinaShowcase />}
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
  // Para distinguir lo propio de lo ajeno: sobre lo propio se edita, no se
  // escribe uno mismo por WhatsApp.
  const { supabaseUser } = useAuth()
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
        /* Vitrina de tienda: la carta grande y el precio encima, como en el
           mostrador. Antes era una fila de lista con una miniatura de 56px,
           donde lo que se veía era el texto y no la mercancía. */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {filtered.map(l => {
            const card = cards.get(l.cardId)
            const apaisada = listFaceIsLandscape(card)
            const esMia = !!supabaseUser && l.userId === supabaseUser.id
            return (
              <div
                key={`${l.userId}-${l.cardId}`}
                className="bg-swu-surface rounded-xl border border-swu-amber/25 overflow-hidden flex flex-col"
              >
                <button
                  onClick={() => navigate(`/cards/${l.cardId}`)}
                  aria-label={`Ver ${card?.name ?? 'la carta'}`}
                  className="relative p-2"
                >
                  <Carta3D brillo intensidad={10}>
                    <CardImage
                      src={listFaceUrl(card)}
                      orientacion={apaisada ? 'apaisada' : 'vertical'}
                      fit="cover"
                      elevacion="realce"
                      alt={card?.name}
                      className={`w-full ${apaisada ? 'aspect-[400/286]' : 'aspect-[286/400]'}`}
                    />
                  </Carta3D>

                  {/* El precio va encima de la carta, como la etiqueta en la
                      funda. Es lo primero que se mira en una tienda. */}
                  <span className="absolute top-3 right-3 z-10 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-[2px]">
                    {l.price != null ? (
                      <span className="text-[11px] font-extrabold text-swu-amber font-mono">
                        ${l.price.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-[9px] text-swu-muted font-mono">a convenir</span>
                    )}
                  </span>

                  {l.quantity > 1 && (
                    <span className="absolute bottom-3 right-3 z-10 text-[9px] font-mono font-bold text-white bg-black/75 rounded px-1">
                      x{l.quantity}
                    </span>
                  )}
                </button>

                <div className="px-2.5 pb-2.5 flex-1 flex flex-col">
                  <p className="text-[12px] font-semibold text-swu-text leading-tight line-clamp-2">
                    {card?.name ?? l.cardId}
                  </p>
                  {card?.subtitle && (
                    <p className="text-[9px] text-swu-muted truncate">{card.subtitle}</p>
                  )}

                  {l.notes && (
                    <p className="text-[10px] text-swu-muted/80 italic mt-1 line-clamp-2">«{l.notes}»</p>
                  )}

                  <button
                    onClick={() => navigate(`/u/${l.userId}`)}
                    className="text-[10px] text-swu-muted hover:text-swu-text inline-flex items-center gap-1 mt-1.5 self-start"
                  >
                    <Tag size={9} className="text-swu-amber flex-shrink-0" aria-hidden />
                    <span className="truncate max-w-[110px]">
                      {esMia ? 'Tu publicación' : l.sellerName}
                    </span>
                  </button>

                  {/* Sobre lo propio no se escribe: se edita. Antes había que
                      salir a Mi Botín, encontrar la carta y abrir su venta
                      desde ahí para corregir un precio. */}
                  {esMia ? (
                    <button
                      onClick={() => navigate('/collection?venta=1')}
                      className="mt-2 flex items-center justify-center gap-1.5 bg-swu-amber/15 border border-swu-amber/40
                                 text-swu-amber text-[11px] font-semibold rounded-lg py-1.5 active:scale-[0.98] transition-transform"
                    >
                      <Pencil size={12} aria-hidden /> Editar publicación
                    </button>
                  ) : l.sellerWhatsapp ? (
                    <a
                      href={`https://wa.me/${l.sellerWhatsapp}?text=${encodeURIComponent(
                        mensajeVendedor(l, card),
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="mt-2 flex items-center justify-center gap-1.5 bg-swu-green/15 border border-swu-green/40
                                 text-swu-green text-[11px] font-semibold rounded-lg py-1.5 active:scale-[0.98] transition-transform"
                    >
                      <MessageCircle size={12} aria-hidden /> Escribirle
                    </a>
                  ) : (
                    <p className="mt-2 text-[9px] text-swu-muted/60 text-center leading-tight">
                      Sin WhatsApp — tocá su nombre para ver el perfil
                    </p>
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

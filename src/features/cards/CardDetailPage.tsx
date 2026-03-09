import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Heart, Loader2, AlertCircle, BookOpen, Star, Package, Plus, Minus } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { getCardById } from '../../services/swuApi'
import { db } from '../../services/db'
import { syncFavoriteToCloud } from '../../services/sync'
import { useAuth } from '../../hooks/useAuth'
import { getCardQuantity, updateCollectionQuantity } from '../../services/collectionService'
import { formatPrice, getLocalPrice, type PriceInfo } from '../../services/pricing'
import { getPricesForCards, fetchTCGPrices } from '../../services/pricing'
import type { Card } from '../../types'

const typeVariant: Record<string, 'amber' | 'accent' | 'green' | 'purple' | 'default'> = {
  Leader: 'amber',
  Unit: 'accent',
  Event: 'green',
  Upgrade: 'purple',
  Base: 'default',
}
const rarityVariant: Record<string, 'default' | 'green' | 'accent' | 'amber' | 'purple'> = {
  Common: 'default',
  Uncommon: 'green',
  Rare: 'accent',
  Legendary: 'amber',
  Special: 'purple',
}

const aspectColors: Record<string, string> = {
  Vigilance: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Command: 'bg-green-500/20 text-green-400 border-green-500/30',
  Aggression: 'bg-red-500/20 text-red-400 border-red-500/30',
  Cunning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Heroism: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  Villainy: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

export function CardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { supabaseUser } = useAuth()
  const { currentProfileId } = useAuth()
  const [card, setCard] = useState<Card | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFavorite, setIsFavorite] = useState(false)
  const [showBack, setShowBack] = useState(false)
  const [collectionQty, setCollectionQty] = useState(0)
  const [priceInfo, setPriceInfo] = useState<PriceInfo | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      getCardById(id),
      db.favoriteCards.get(id),
      getCardQuantity(id),
      getLocalPrice(id),
    ]).then(([c, fav, qty, price]) => {
      setCard(c)
      setIsFavorite(!!fav)
      setCollectionQty(qty)
      setPriceInfo(price)
      setLoading(false)

      // If no cached price, fetch from TCGPlayer
      if (!price && c) {
        setPriceLoading(true)
        fetchTCGPrices([{ id: c.id, name: c.name, subtitle: c.subtitle || null, setCode: c.setCode, setNumber: c.setNumber }])
          .then(() => getPricesForCards([c.id]))
          .then(map => {
            const fetched = map.get(c.id)
            if (fetched) setPriceInfo(fetched)
          })
          .catch(() => {})
          .finally(() => setPriceLoading(false))
      }
    })
  }, [id])

  const handleCollectionChange = async (delta: number) => {
    if (!id) return
    const newQty = Math.max(0, collectionQty + delta)
    setCollectionQty(newQty)
    await updateCollectionQuantity(id, newQty, currentProfileId ?? undefined, supabaseUser?.id)
  }

  const toggleFavorite = async () => {
    if (!id) return
    const newFav = !isFavorite
    if (isFavorite) {
      await db.favoriteCards.delete(id)
    } else {
      await db.favoriteCards.put({ cardId: id })
    }
    setIsFavorite(newFav)

    // Sync to cloud
    if (supabaseUser) {
      syncFavoriteToCloud(supabaseUser.id, id, newFav).catch(() => {})
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="text-swu-accent animate-spin" />
      </div>
    )
  }

  if (!card) {
    return (
      <div className="p-4 text-center">
        <AlertCircle size={32} className="mx-auto text-swu-red mb-2" />
        <p className="text-swu-text font-bold">Carta no encontrada</p>
        <button onClick={() => navigate('/cards')} className="mt-3 text-sm text-swu-accent">
          Volver a búsqueda
        </button>
      </div>
    )
  }

  const imageUrl = showBack && card.backImageUrl ? card.backImageUrl : card.imageUrl

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-8 lg:pb-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-swu-muted">
          <ChevronLeft size={18} /> Atrás
        </button>
        <button
          onClick={toggleFavorite}
          className={`p-2 rounded-lg border transition-colors ${
            isFavorite ? 'bg-swu-red/20 border-swu-red/40 text-swu-red' : 'bg-swu-surface border-swu-border text-swu-muted'
          }`}
        >
          <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Card Image */}
      {imageUrl && (
        <div className="flex justify-center">
          <img
            src={imageUrl}
            alt={card.name}
            className="w-64 rounded-2xl shadow-xl shadow-black/30 border-2 border-swu-border"
          />
        </div>
      )}

      {/* Flip button (if double-sided) */}
      {card.backImageUrl && (
        <button
          onClick={() => setShowBack(!showBack)}
          className="w-full py-2 rounded-lg bg-swu-surface border border-swu-border text-swu-accent text-xs font-bold"
        >
          {showBack ? 'Ver Frente' : 'Ver Reverso'}
        </button>
      )}

      {/* Name & subtitle */}
      <div className="text-center">
        <h2 className="text-xl font-extrabold text-swu-text">{card.name}</h2>
        {card.subtitle && <p className="text-sm text-swu-muted">{card.subtitle}</p>}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 justify-center">
        <Badge variant={typeVariant[card.type] || 'default'}>{card.type}</Badge>
        <Badge variant={rarityVariant[card.rarity] || 'default'}>{card.rarity}</Badge>
        {card.arena && <Badge>{card.arena}</Badge>}
        {card.isUnique && <Badge variant="purple">Única</Badge>}
      </div>

      {/* Stats */}
      {(card.cost !== null || card.power !== null || card.hp !== null) && (
        <div className="flex justify-center gap-6">
          {card.cost !== null && (
            <div className="text-center">
              <p className="text-[10px] text-swu-muted">Costo</p>
              <p className="text-2xl font-extrabold text-swu-amber font-mono">{card.cost}</p>
            </div>
          )}
          {card.power !== null && (
            <div className="text-center">
              <p className="text-[10px] text-swu-muted">Poder</p>
              <p className="text-2xl font-extrabold text-swu-red font-mono">{card.power}</p>
            </div>
          )}
          {card.hp !== null && (
            <div className="text-center">
              <p className="text-[10px] text-swu-muted">HP</p>
              <p className="text-2xl font-extrabold text-swu-green font-mono">{card.hp}</p>
            </div>
          )}
        </div>
      )}

      {/* Aspects */}
      {card.aspects.length > 0 && (
        <div>
          <p className="text-xs text-swu-muted mb-1.5">Aspectos</p>
          <div className="flex flex-wrap gap-1.5">
            {card.aspects.map((a) => (
              <span
                key={a}
                className={`px-3 py-1 rounded-lg text-xs font-bold border ${aspectColors[a] || 'bg-swu-surface text-swu-text border-swu-border'}`}
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Traits */}
      {card.traits.length > 0 && (
        <div>
          <p className="text-xs text-swu-muted mb-1.5">Rasgos</p>
          <p className="text-sm text-swu-text">{card.traits.join(' · ')}</p>
        </div>
      )}

      {/* Keywords */}
      {card.keywords.length > 0 && (
        <div>
          <p className="text-xs text-swu-muted mb-1.5">Palabras Clave</p>
          <div className="flex flex-wrap gap-1.5">
            {card.keywords.map((k) => (
              <Badge key={k} variant="accent">{k}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Card Text */}
      {card.text && (
        <div className="bg-swu-surface rounded-xl p-4 border border-swu-border">
          <div className="flex items-center gap-1.5 mb-2">
            <BookOpen size={14} className="text-swu-accent" />
            <p className="text-xs font-bold text-swu-muted">Texto de Carta</p>
          </div>
          <p className="text-sm text-swu-text leading-relaxed whitespace-pre-wrap">{card.text}</p>
        </div>
      )}

      {/* Deploy Box */}
      {card.deployBox && (
        <div className="bg-swu-amber/10 rounded-xl p-4 border border-swu-amber/30">
          <p className="text-xs font-bold text-swu-amber mb-1">Despliegue</p>
          <p className="text-sm text-swu-text">{card.deployBox}</p>
        </div>
      )}

      {/* Epic Action */}
      {card.epicAction && (
        <div className="bg-purple-400/10 rounded-xl p-4 border border-purple-400/30">
          <div className="flex items-center gap-1.5 mb-1">
            <Star size={14} className="text-purple-400" />
            <p className="text-xs font-bold text-purple-400">Acción Épica</p>
          </div>
          <p className="text-sm text-swu-text">{card.epicAction}</p>
        </div>
      )}

      {/* Prices by Variant */}
      {(priceInfo || priceLoading) && (
        <div className="bg-swu-green/10 rounded-xl p-4 border border-swu-green/30">
          <div className="flex items-center gap-2 mb-3">
            <Package size={16} className="text-swu-green" />
            <span className="text-sm font-bold text-swu-green">Precios TCGPlayer</span>
            {priceLoading && <Loader2 size={12} className="text-swu-green animate-spin" />}
          </div>

          {priceInfo && priceInfo.variants && Object.keys(priceInfo.variants).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(priceInfo.variants).map(([subtype, v]) => (
                <div key={subtype} className="flex items-center justify-between py-1.5 border-b border-swu-border/30 last:border-0">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                    subtype === 'Normal' ? 'bg-swu-surface text-swu-text' :
                    subtype === 'Foil' ? 'bg-swu-amber/20 text-swu-amber' :
                    subtype.includes('Hyperspace') ? 'bg-purple-400/20 text-purple-400' :
                    subtype.includes('Showcase') ? 'bg-cyan-400/20 text-cyan-300' :
                    'bg-swu-surface text-swu-muted'
                  }`}>{subtype}</span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-swu-muted">Low <span className="text-swu-text font-bold">{formatPrice(v.low)}</span></span>
                    <span className="text-swu-green font-extrabold text-sm">{formatPrice(v.market)}</span>
                    <span className="text-swu-muted">High <span className="text-swu-text font-bold">{formatPrice(v.high)}</span></span>
                  </div>
                </div>
              ))}
            </div>
          ) : priceInfo ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-swu-muted">Market Price</span>
              <span className="text-sm font-extrabold text-swu-green">{formatPrice(priceInfo.market)}</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Collection */}
      <div className="bg-swu-accent/10 rounded-xl p-4 border border-swu-accent/30">
        <div className="flex items-center gap-2 mb-3">
          <Package size={16} className="text-swu-accent" />
          <span className="text-sm font-bold text-swu-accent">Colección</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-swu-muted">
            {collectionQty > 0
              ? `Tienes ${collectionQty} copia${collectionQty > 1 ? 's' : ''}`
              : 'No está en tu colección'}
          </span>
          <div className="flex items-center gap-2">
            {collectionQty > 0 && (
              <button
                onClick={() => handleCollectionChange(-1)}
                className="w-8 h-8 rounded-lg bg-swu-surface border border-swu-border text-swu-muted
                           flex items-center justify-center active:scale-95"
              >
                <Minus size={14} />
              </button>
            )}
            <span className="w-8 text-center text-sm font-bold text-swu-text">{collectionQty}</span>
            <button
              onClick={() => handleCollectionChange(1)}
              className="w-8 h-8 rounded-lg bg-swu-accent/20 border border-swu-accent/40 text-swu-accent
                         flex items-center justify-center active:scale-95"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="bg-swu-surface rounded-xl p-3 border border-swu-border">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-swu-muted">Set:</span>{' '}
            <span className="text-swu-text font-bold">{card.setCode} #{card.setNumber}</span>
          </div>
          <div>
            <span className="text-swu-muted">Artista:</span>{' '}
            <span className="text-swu-text">{card.artist}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

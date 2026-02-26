import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, SlidersHorizontal, X, Loader2, WifiOff } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { searchCards, getSets, type SearchParams } from '../../services/swuApi'
import type { Card, SetInfo } from '../../types'

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

const filterTypes = ['Leader', 'Base', 'Unit', 'Event', 'Upgrade']
const filterAspects = ['Vigilance', 'Command', 'Aggression', 'Cunning', 'Heroism', 'Villainy']
const filterArenas = ['Ground', 'Space']
const filterRarities = ['Common', 'Uncommon', 'Rare', 'Legendary', 'Special']

const PAGE_SIZE = 30

export function CardsPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [selectedAspect, setSelectedAspect] = useState<string | null>(null)
  const [selectedSet, setSelectedSet] = useState<string | null>(null)
  const [selectedArena, setSelectedArena] = useState<string | null>(null)
  const [selectedRarity, setSelectedRarity] = useState<string | null>(null)

  const [cards, setCards] = useState<Card[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offline, setOffline] = useState(false)
  const [sets, setSets] = useState<SetInfo[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load sets on mount
  useEffect(() => {
    getSets().then(setSets)
  }, [])

  const doSearch = useCallback(
    async (reset = true) => {
      const params: SearchParams = {
        query: query || undefined,
        type: selectedType || undefined,
        aspect: selectedAspect || undefined,
        set: selectedSet || undefined,
        arena: selectedArena || undefined,
        rarity: selectedRarity || undefined,
        offset: reset ? 0 : cards.length,
        limit: PAGE_SIZE,
      }

      if (reset) {
        setLoading(true)
        setOffline(false)
      } else {
        setLoadingMore(true)
      }

      try {
        const result = await searchCards(params)
        if (reset) {
          setCards(result.cards)
        } else {
          setCards((prev) => [...prev, ...result.cards])
        }
        setTotal(result.total)
        setHasSearched(true)
      } catch {
        setOffline(true)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [query, selectedType, selectedAspect, selectedSet, selectedArena, selectedRarity, cards.length],
  )

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      doSearch(true)
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectedType, selectedAspect, selectedSet, selectedArena, selectedRarity])

  const toggleFilter = (current: string | null, value: string, setter: (v: string | null) => void) => {
    setter(current === value ? null : value)
  }

  const activeFilterCount = [selectedType, selectedAspect, selectedSet, selectedArena, selectedRarity].filter(Boolean).length

  const clearFilters = () => {
    setSelectedType(null)
    setSelectedAspect(null)
    setSelectedSet(null)
    setSelectedArena(null)
    setSelectedRarity(null)
  }

  // Main sets only (exclude promo/convention)
  const mainSets = sets.filter((s) => !['C24', 'C25', 'P25', 'P26', 'GG', 'J24', 'J25', 'G25', 'TS26', 'IBH'].includes(s.code))

  return (
    <div className="p-4 space-y-3 pb-24">
      {/* Search */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cartas..."
            className="w-full bg-swu-surface border border-swu-border rounded-xl py-3 pl-10 pr-3 text-sm text-swu-text outline-none focus:border-swu-accent transition-colors"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 rounded-xl border text-sm font-semibold transition-colors relative ${
            showFilters ? 'bg-swu-accent/15 border-swu-accent text-swu-accent' : 'bg-swu-surface border-swu-border text-swu-muted'
          }`}
        >
          <SlidersHorizontal size={18} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-swu-accent text-white text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-swu-surface rounded-xl p-3 border border-swu-border space-y-3">
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-[10px] text-swu-red flex items-center gap-1">
              <X size={12} /> Limpiar filtros
            </button>
          )}

          {/* Type */}
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Tipo</p>
            <div className="flex flex-wrap gap-1.5">
              {filterTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleFilter(selectedType, t, setSelectedType)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold border transition-colors ${
                    selectedType === t
                      ? 'bg-swu-accent/20 border-swu-accent text-swu-accent'
                      : 'bg-swu-bg border-swu-border text-swu-muted'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Aspect */}
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Aspecto</p>
            <div className="flex flex-wrap gap-1.5">
              {filterAspects.map((a) => (
                <button
                  key={a}
                  onClick={() => toggleFilter(selectedAspect, a, setSelectedAspect)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold border transition-colors ${
                    selectedAspect === a
                      ? 'bg-swu-accent/20 border-swu-accent text-swu-accent'
                      : 'bg-swu-bg border-swu-border text-swu-muted'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Set */}
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Set</p>
            <div className="flex flex-wrap gap-1.5">
              {mainSets.map((s) => (
                <button
                  key={s.code}
                  onClick={() => toggleFilter(selectedSet, s.code, setSelectedSet)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold border transition-colors ${
                    selectedSet === s.code
                      ? 'bg-swu-amber/20 border-swu-amber text-swu-amber'
                      : 'bg-swu-bg border-swu-border text-swu-muted'
                  }`}
                >
                  {s.code}
                </button>
              ))}
            </div>
          </div>

          {/* Arena */}
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Arena</p>
            <div className="flex flex-wrap gap-1.5">
              {filterArenas.map((a) => (
                <button
                  key={a}
                  onClick={() => toggleFilter(selectedArena, a, setSelectedArena)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold border transition-colors ${
                    selectedArena === a
                      ? 'bg-swu-green/20 border-swu-green text-swu-green'
                      : 'bg-swu-bg border-swu-border text-swu-muted'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Rarity */}
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Rareza</p>
            <div className="flex flex-wrap gap-1.5">
              {filterRarities.map((r) => (
                <button
                  key={r}
                  onClick={() => toggleFilter(selectedRarity, r, setSelectedRarity)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold border transition-colors ${
                    selectedRarity === r
                      ? 'bg-purple-400/20 border-purple-400 text-purple-400'
                      : 'bg-swu-bg border-swu-border text-swu-muted'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Status */}
      {offline && (
        <div className="flex items-center gap-2 bg-swu-amber/10 border border-swu-amber/30 rounded-lg px-3 py-2">
          <WifiOff size={14} className="text-swu-amber" />
          <span className="text-xs text-swu-amber">Modo offline — mostrando cartas en caché</span>
        </div>
      )}

      {hasSearched && !loading && (
        <p className="text-xs text-swu-muted">{total} cartas encontradas</p>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={28} className="text-swu-accent animate-spin" />
        </div>
      )}

      {/* Results */}
      {!loading && (
        <div className="space-y-1.5">
          {cards.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/cards/${c.id}`)}
              className="w-full bg-swu-surface rounded-xl p-3 border border-swu-border flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
            >
              {/* Thumbnail */}
              {c.imageUrl && (
                <img
                  src={c.imageUrl}
                  alt={c.name}
                  className="w-12 h-16 rounded-lg object-cover bg-swu-bg flex-shrink-0"
                  loading="lazy"
                />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-swu-text truncate">{c.name}</span>
                  {c.subtitle && <span className="text-xs text-swu-muted truncate">{c.subtitle}</span>}
                </div>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  <Badge variant={typeVariant[c.type] || 'default'}>{c.type}</Badge>
                  <Badge variant={rarityVariant[c.rarity] || 'default'}>{c.rarity}</Badge>
                  {c.arena && <Badge>{c.arena}</Badge>}
                  <span className="text-[9px] text-swu-muted">{c.setCode} #{c.setNumber}</span>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                {c.cost !== null && <p className="text-xl font-extrabold text-swu-amber font-mono">{c.cost}</p>}
                {c.power !== null && c.hp !== null && (
                  <p className="text-xs text-swu-muted">{c.power}/{c.hp}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Load more */}
      {!loading && cards.length < total && (
        <button
          onClick={() => doSearch(false)}
          disabled={loadingMore}
          className="w-full py-3 rounded-xl bg-swu-surface border border-swu-border text-swu-accent font-bold text-sm flex items-center justify-center gap-2"
        >
          {loadingMore ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            `Cargar más (${cards.length}/${total})`
          )}
        </button>
      )}

      {/* Empty state */}
      {!loading && hasSearched && cards.length === 0 && (
        <div className="text-center py-12">
          <Search size={36} className="mx-auto text-swu-muted/40 mb-3" />
          <p className="text-sm text-swu-muted">No se encontraron cartas</p>
          <p className="text-xs text-swu-muted mt-1">Intente con otra búsqueda o filtro</p>
        </div>
      )}
    </div>
  )
}

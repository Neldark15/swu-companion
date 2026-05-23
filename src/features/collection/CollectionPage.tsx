import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Search, SlidersHorizontal, Eye, EyeOff,
  Package, DollarSign, Layers, TrendingUp, RefreshCw, Upload, Download, X, FileUp, Trash2, AlertTriangle,
  Tag, ShoppingBag, Loader2,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { getCardsByIds, loadFullDatabase, getLocalCardCount } from '../../services/swuApi'
import {
  getMyCollectionWithPrices,
  updateCollectionQuantity,
  calculateCollectionStats,
  toggleProfilePublic,
  getMyPublicStatus,
  getMyListings,
  markCardForSale,
  unmarkCardForSale,
  type CollectionCardWithPrice,
  type MyListingSummary,
} from '../../services/collectionService'
import { formatPrice, fetchTCGPrices } from '../../services/pricing'
import { importCollectionFromFile, type ImportResult } from '../../services/collectionImport'
import { exportCollection, downloadFile, EXPORT_FORMATS, type ExportFormat } from '../../services/collectionExport'
import { db } from '../../services/db'
import { supabase, isSupabaseReady } from '../../services/supabase'
import { CardImage } from '../../components/CardImage'
import type { Card } from '../../types'

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
  const [filterSet, setFilterSet] = useState('')
  const [filterRarity, setFilterRarity] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [fetchingPrices, setFetchingPrices] = useState(false)
  const [priceStatus, setPriceStatus] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importProgress, setImportProgress] = useState('')
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState('')

  // Marketplace state — which of my cards are listed for sale
  const [listings, setListings] = useState<Map<string, MyListingSummary>>(new Map())
  const [saleFilter, setSaleFilter] = useState<'all' | 'for_sale' | 'not_for_sale'>('all')
  const [saleModal, setSaleModal] = useState<{ cardId: string; current: MyListingSummary | null } | null>(null)
  const [saleSubmitting, setSaleSubmitting] = useState(false)

  // Load collection
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const collItems = await getMyCollectionWithPrices(currentProfileId ?? undefined)
        if (cancelled) return
        setItems(collItems)

        // If local card DB is sparse, trigger background refresh (catches promo sets, new sets)
        const localCount = await getLocalCardCount()
        if (localCount < 2000) {
          loadFullDatabase().catch(() => {})
        }

        // Load card details in a single batch query (with network fallback for missing)
        const cardIds = collItems.map(i => i.cardId)
        const cardMap = await getCardsByIds(cardIds)
        if (!cancelled) setCards(cardMap)

        // Second pass: if any cards still missing after initial load and DB was sparse, retry
        if (localCount < 2000 && cardMap.size < cardIds.length) {
          const missingIds = cardIds.filter(id => !cardMap.has(id))
          if (missingIds.length > 0) {
            const extra = await getCardsByIds(missingIds)
            if (!cancelled) {
              setCards(prev => {
                const merged = new Map(prev)
                extra.forEach((v, k) => merged.set(k, v))
                return merged
              })
            }
          }
        }
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

  // Load my marketplace listings
  const refreshListings = useCallback(async () => {
    if (!supabaseUser) { setListings(new Map()); return }
    const list = await getMyListings(supabaseUser.id)
    setListings(new Map(list.map(l => [l.cardId, l])))
  }, [supabaseUser])

  useEffect(() => { refreshListings() }, [refreshListings])

  const handleSaveSale = async (cardId: string, price: number | null, notes: string) => {
    if (!supabaseUser) return
    setSaleSubmitting(true)
    const r = await markCardForSale(cardId, supabaseUser.id, { price, notes })
    setSaleSubmitting(false)
    if (!r.ok) { alert(`Error: ${r.error}`); return }
    setSaleModal(null)
    await refreshListings()
  }

  const handleUnlist = async (cardId: string) => {
    if (!supabaseUser) return
    if (!confirm('¿Quitar esta carta del mercado?')) return
    await unmarkCardForSale(cardId, supabaseUser.id)
    await refreshListings()
  }

  // Stats
  const stats = useMemo(() => calculateCollectionStats(items), [items])

  // Available sets in collection
  const availableSets = useMemo(() => {
    const sets = new Set<string>()
    for (const item of items) {
      const card = cards.get(item.cardId)
      if (card?.setCode) sets.add(card.setCode)
    }
    return Array.from(sets).sort()
  }, [items, cards])

  // Available rarities in collection
  const availableRarities = useMemo(() => {
    const rarities = new Set<string>()
    for (const item of items) {
      const card = cards.get(item.cardId)
      if (card?.rarity) rarities.add(card.rarity)
    }
    return ['Legendary', 'Special', 'Rare', 'Uncommon', 'Common'].filter(r => rarities.has(r))
  }, [items, cards])

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

    // Filter by set
    if (filterSet) {
      list = list.filter(item => {
        const card = cards.get(item.cardId)
        return card?.setCode === filterSet
      })
    }

    // Filter by rarity
    if (filterRarity) {
      list = list.filter(item => {
        const card = cards.get(item.cardId)
        return card?.rarity === filterRarity
      })
    }

    // Filter by sale status
    if (saleFilter === 'for_sale') {
      list = list.filter(item => listings.has(item.cardId))
    } else if (saleFilter === 'not_for_sale') {
      list = list.filter(item => !listings.has(item.cardId))
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
        case 'set':
          return (ca?.setCode ?? '').localeCompare(cb?.setCode ?? '')
        default:
          return 0
      }
    })

    return list
  }, [items, cards, search, filterType, filterSet, filterRarity, sortBy])

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

  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || importing) return

    setImporting(true)
    setImportResult(null)
    setImportProgress('Leyendo archivo...')

    try {
      const result = await importCollectionFromFile(
        file,
        supabaseUser?.id,
        importMode,
        (processed, total) => {
          setImportProgress(`Procesando... ${processed}/${total} cartas`)
        },
        currentProfileId ?? undefined,
      )

      setImportResult(result)
      setImportProgress('')

      // Reload collection
      const collItems = await getMyCollectionWithPrices(currentProfileId ?? undefined)
      setItems(collItems)
      const cardIds = collItems.map(i => i.cardId)
      const cardMap = await getCardsByIds(cardIds)
      setCards(cardMap)
    } catch (err) {
      setImportResult({
        total: 0, matched: 0, added: 0, updated: 0,
        notFound: [],
        errors: [`Error: ${err}`],
      })
      setImportProgress('')
    } finally {
      setImporting(false)
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [importing, supabaseUser, importMode, currentProfileId])

  const handleDeleteCollection = useCallback(async () => {
    setDeleting(true)
    try {
      // Clear local Dexie collection for this profile
      if (currentProfileId) {
        const toDelete = await db.collection.where('profileId').equals(currentProfileId).primaryKeys()
        await db.collection.bulkDelete(toDelete)
      } else {
        await db.collection.clear()
      }
      // Clear cloud collection
      if (supabaseUser?.id && isSupabaseReady()) {
        await supabase.from('collection').delete().eq('user_id', supabaseUser.id)
      }
      setItems([])
      setCards(new Map())
      setShowDeleteConfirm(false)
    } catch (e) {
      console.warn('[Collection] Failed to delete:', e)
    } finally {
      setDeleting(false)
    }
  }, [currentProfileId, supabaseUser])

  const handleExport = useCallback(async (format: ExportFormat) => {
    if (exporting || items.length === 0) return
    setExporting(true)
    setExportStatus('Preparando exportación...')

    try {
      const { content, filename, mimeType } = await exportCollection(format, currentProfileId ?? undefined)
      downloadFile(content, filename, mimeType)
      setExportStatus(`✓ ${filename} descargado`)
      setTimeout(() => {
        setExportStatus('')
        setShowExport(false)
      }, 2500)
    } catch (e) {
      console.warn('[Collection] Export failed:', e)
      setExportStatus(`Error: ${e instanceof Error ? e.message : 'Error al exportar'}`)
      setTimeout(() => setExportStatus(''), 4000)
    } finally {
      setExporting(false)
    }
  }, [exporting, items, currentProfileId])

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

      <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 py-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 lg:grid-cols-4 gap-2 lg:gap-3">
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

        {/* Import from SWUDB */}
        <button
          onClick={() => { setShowImport(!showImport); setImportResult(null) }}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium
                     border transition-colors bg-swu-surface border-swu-border text-swu-muted
                     hover:text-swu-amber hover:border-swu-amber/30"
        >
          <Upload size={14} />
          Importar Colección (swudb.com)
        </button>

        {showImport && (
          <div className="bg-swu-surface rounded-xl border border-swu-amber/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-swu-amber flex items-center gap-2">
                <FileUp size={16} /> Importar desde swudb.com
              </h3>
              <button onClick={() => setShowImport(false)} className="text-swu-muted">
                <X size={16} />
              </button>
            </div>

            <p className="text-[11px] text-swu-muted leading-relaxed">
              Exporte su colección desde swudb.com en formato <b className="text-swu-text">CSV</b> o{' '}
              <b className="text-swu-text">JSON</b> y súbala aquí. El formato esperado es:{' '}
              <code className="text-swu-amber text-[10px]">Set,CardNumber,Count,IsFoil</code>
            </p>

            {/* Mode selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setImportMode('merge')}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  importMode === 'merge'
                    ? 'bg-swu-amber/15 border-swu-amber/40 text-swu-amber'
                    : 'bg-swu-bg border-swu-border text-swu-muted'
                }`}
              >
                Combinar (sumar)
              </button>
              <button
                onClick={() => setImportMode('replace')}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  importMode === 'replace'
                    ? 'bg-red-500/15 border-red-500/40 text-red-400'
                    : 'bg-swu-bg border-swu-border text-swu-muted'
                }`}
              >
                Reemplazar todo
              </button>
            </div>
            {importMode === 'replace' && (
              <p className="text-[10px] text-red-400 text-center">
                ⚠ Esto borrará su colección actual y la reemplazará con el archivo
              </p>
            )}

            {/* File input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,.txt"
              onChange={handleImportFile}
              disabled={importing}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className={`w-full py-3 rounded-xl text-sm font-medium border-2 border-dashed transition-colors ${
                importing
                  ? 'border-swu-amber/30 text-swu-amber bg-swu-amber/5'
                  : 'border-swu-border text-swu-muted hover:border-swu-amber/40 hover:text-swu-amber'
              }`}
            >
              {importing ? importProgress || 'Importando...' : '📁 Seleccionar archivo CSV / JSON'}
            </button>

            {/* Import result */}
            {importResult && (
              <div className={`rounded-xl p-3 text-xs space-y-1 border ${
                importResult.errors.length > 0
                  ? 'bg-red-500/5 border-red-500/20'
                  : 'bg-swu-green/5 border-swu-green/20'
              }`}>
                <div className="font-bold text-swu-text">
                  {importResult.errors.length > 0 && importResult.matched === 0
                    ? '❌ Error en la importación'
                    : '✅ Importación completada'}
                </div>
                {importResult.matched > 0 && (
                  <>
                    <div className="text-swu-green">
                      {importResult.added} cartas nuevas, {importResult.updated} actualizadas
                    </div>
                    <div className="text-swu-muted">
                      {importResult.matched} de {importResult.total} reconocidas
                    </div>
                  </>
                )}
                {importResult.notFound.length > 0 && (
                  <details className="text-swu-muted">
                    <summary className="cursor-pointer text-swu-amber">
                      {importResult.notFound.length} no encontradas
                    </summary>
                    <div className="mt-1 text-[10px] max-h-20 overflow-y-auto font-mono">
                      {importResult.notFound.slice(0, 20).join(', ')}
                      {importResult.notFound.length > 20 && ` ...y ${importResult.notFound.length - 20} más`}
                    </div>
                  </details>
                )}
                {importResult.errors.map((err, i) => (
                  <div key={i} className="text-red-400">{err}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Export collection */}
        <button
          onClick={() => { setShowExport(!showExport); setExportStatus('') }}
          disabled={items.length === 0}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium
                     border transition-colors bg-swu-surface border-swu-border text-swu-muted
                     hover:text-swu-green hover:border-swu-green/30 disabled:opacity-40 disabled:hover:text-swu-muted disabled:hover:border-swu-border"
        >
          <Download size={14} />
          Exportar Colección
        </button>

        {showExport && (
          <div className="bg-swu-surface rounded-xl border border-swu-green/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-swu-green flex items-center gap-2">
                <Download size={16} /> Exportar colección
              </h3>
              <button onClick={() => setShowExport(false)} className="text-swu-muted">
                <X size={16} />
              </button>
            </div>

            <p className="text-[11px] text-swu-muted leading-relaxed">
              Descargue su colección en el formato que prefiera.
              El formato <b className="text-swu-text">CSV</b> es compatible con swudb.com.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {EXPORT_FORMATS.map(fmt => (
                <button
                  key={fmt.id}
                  onClick={() => handleExport(fmt.id)}
                  disabled={exporting}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-swu-border
                             bg-swu-bg hover:border-swu-green/40 hover:bg-swu-green/5
                             transition-colors active:scale-[0.97] disabled:opacity-50"
                >
                  <span className="text-xl">{fmt.icon}</span>
                  <span className="text-xs font-bold text-swu-text">{fmt.label}</span>
                  <span className="text-[10px] text-swu-muted leading-tight text-center">{fmt.description}</span>
                </button>
              ))}
            </div>

            {exportStatus && (
              <div className={`text-center text-xs font-medium py-2 rounded-lg ${
                exportStatus.startsWith('✓')
                  ? 'text-swu-green bg-swu-green/5'
                  : exportStatus.startsWith('Error')
                    ? 'text-red-400 bg-red-500/5'
                    : 'text-swu-amber bg-swu-amber/5'
              }`}>
                {exporting && (
                  <span className="inline-block w-3 h-3 border-2 border-swu-amber/30 border-t-swu-amber rounded-full animate-spin mr-2 align-middle" />
                )}
                {exportStatus}
              </div>
            )}
          </div>
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
              showFilters || filterType || filterSet || filterRarity
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
                      filterSet === ''
                        ? 'bg-swu-amber text-white'
                        : 'bg-swu-bg text-swu-muted'
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
                        filterSet === s
                          ? 'bg-swu-amber text-white'
                          : 'bg-swu-bg text-swu-muted'
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
                      filterRarity === ''
                        ? 'bg-purple-500 text-white'
                        : 'bg-swu-bg text-swu-muted'
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
                  className="text-[10px] text-swu-red font-medium"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
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

        {/* Sale filter chips */}
        {!loading && items.length > 0 && (
          <div className="flex gap-1.5 items-center px-1">
            <ShoppingBag size={12} className="text-swu-muted" />
            {(['all', 'for_sale', 'not_for_sale'] as const).map(f => (
              <button
                key={f}
                onClick={() => setSaleFilter(f)}
                className={`text-[11px] px-2.5 py-1 rounded-md transition-colors ${
                  saleFilter === f
                    ? 'bg-swu-amber/15 text-swu-amber border border-swu-amber/30'
                    : 'text-swu-muted hover:text-swu-text'
                }`}
              >
                {f === 'all' ? 'Todas' : f === 'for_sale' ? `En venta (${listings.size})` : 'No en venta'}
              </button>
            ))}
          </div>
        )}

        {/* Card list */}
        {!loading && displayed.length > 0 && (
          <div>
            <div className="text-xs text-swu-muted px-1 mb-1.5">
              {displayed.length} carta{displayed.length !== 1 ? 's' : ''}
            </div>
            <div className="space-y-1.5 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
            {displayed.map(item => {
              const card = cards.get(item.cardId)
              const listing = listings.get(item.cardId)
              const isListed = !!listing
              return (
                <div
                  key={item.cardId}
                  className={`bg-swu-surface rounded-xl p-3 border flex items-center gap-3 ${
                    isListed ? 'border-swu-amber/50' : 'border-swu-border'
                  }`}
                >
                  {/* Card image */}
                  <button
                    onClick={() => navigate(`/cards/${item.cardId}`)}
                    className="flex-shrink-0"
                  >
                    <CardImage src={card?.imageUrl} alt={card?.name} className="w-12 h-16" />
                  </button>

                  {/* Card info */}
                  <button
                    onClick={() => navigate(`/cards/${item.cardId}`)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="text-sm font-medium text-swu-text truncate">
                      {card?.name ?? item.cardId}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {card?.rarity && (
                        <span className={`text-[10px] font-medium ${rarityColor(card.rarity)}`}>
                          {card.rarity}
                        </span>
                      )}
                      {card?.setCode && (
                        <span className="text-[10px] text-swu-muted">{card.setCode}</span>
                      )}
                      {isListed && (
                        <span className="text-[9px] font-bold bg-swu-amber/15 text-swu-amber px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                          <Tag size={8} /> EN VENTA{listing?.price != null && ` · $${listing.price.toFixed(2)}`}
                        </span>
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
                    {isListed && listing?.notes && (
                      <p className="text-[10px] text-swu-muted/80 italic mt-0.5 truncate">"{listing.notes}"</p>
                    )}
                  </button>

                  {/* Right side: sale button + qty controls */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    {/* Sale toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isListed) handleUnlist(item.cardId)
                        else setSaleModal({ cardId: item.cardId, current: null })
                      }}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                        isListed
                          ? 'bg-swu-amber/20 text-swu-amber'
                          : 'bg-swu-bg text-swu-muted hover:text-swu-amber'
                      }`}
                      title={isListed ? 'Quitar del mercado' : 'Vender esta carta'}
                    >
                      <Tag size={12} />
                    </button>
                    {/* Quantity controls */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleQuantityChange(item.cardId, -1)}
                        className="w-6 h-6 rounded bg-swu-bg text-swu-muted flex items-center justify-center
                                   text-xs font-bold active:scale-95"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-swu-text">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleQuantityChange(item.cardId, 1)}
                        className="w-6 h-6 rounded bg-swu-accent/15 text-swu-accent flex items-center justify-center
                                   text-xs font-bold active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            </div>
          </div>
        )}

        {/* Sale modal */}
        {saleModal && (
          <SaleModal
            cardName={cards.get(saleModal.cardId)?.name ?? saleModal.cardId}
            current={saleModal.current}
            submitting={saleSubmitting}
            onCancel={() => setSaleModal(null)}
            onSave={(price, notes) => handleSaveSale(saleModal.cardId, price, notes)}
          />
        )}

        {/* No results */}
        {!loading && items.length > 0 && displayed.length === 0 && (
          <div className="text-center py-8 text-swu-muted text-sm">
            No se encontraron cartas con esos filtros
          </div>
        )}

        {/* Delete collection button */}
        {!loading && items.length > 0 && (
          <div className="pt-6 border-t border-swu-border/30">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400
                         font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              <Trash2 size={16} />
              Borrar colección completa
            </button>
          </div>
        )}

        {/* Delete confirmation modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="bg-swu-surface rounded-2xl border border-red-500/30 p-5 max-w-sm w-full space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={20} className="text-red-400" />
                </div>
                <div>
                  <div className="text-sm font-bold text-swu-text">¿Borrar toda la colección?</div>
                  <div className="text-xs text-swu-muted mt-0.5">
                    Se eliminarán las {items.length} cartas ({items.reduce((s, i) => s + i.quantity, 0)} copias).
                    Esta acción no se puede deshacer.
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl bg-swu-bg border border-swu-border text-swu-muted
                             text-sm font-medium active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteCollection}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold
                             flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                >
                  {deleting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  {deleting ? 'Borrando...' : 'Sí, borrar todo'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sale Modal ───────────────────────────────────────────

function SaleModal({
  cardName, current, submitting, onCancel, onSave,
}: {
  cardName: string
  current: MyListingSummary | null
  submitting: boolean
  onCancel: () => void
  onSave: (price: number | null, notes: string) => void
}) {
  const [priceStr, setPriceStr] = useState(current?.price != null ? String(current.price) : '')
  const [notes, setNotes] = useState(current?.notes ?? '')

  const submit = () => {
    const p = priceStr.trim() ? Number(priceStr) : null
    if (p !== null && (Number.isNaN(p) || p < 0)) {
      alert('Precio inválido')
      return
    }
    onSave(p, notes)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-swu-surface rounded-2xl border border-swu-amber/40 p-5 max-w-sm w-full space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-swu-amber/15 flex items-center justify-center flex-shrink-0">
            <Tag size={20} className="text-swu-amber" />
          </div>
          <div>
            <div className="text-sm font-bold text-swu-text">Poner en venta</div>
            <div className="text-xs text-swu-muted mt-0.5 truncate">{cardName}</div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-swu-muted font-medium flex items-center gap-1 mb-1">
              <DollarSign size={10} /> Precio en USD (opcional)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              placeholder="ej. 12.50 — dejar vacío si es a convenir"
              className="w-full px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text font-mono"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-swu-muted font-medium block mb-1">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="Condición, idioma, foiled, contacto..."
              className="w-full px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text resize-none"
            />
            <p className="text-[10px] text-swu-muted/60 mt-0.5">{notes.length}/200</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-swu-bg border border-swu-border text-swu-muted text-sm font-medium active:scale-[0.98]"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-swu-amber text-black text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Tag size={14} />}
            {submitting ? 'Guardando...' : 'Publicar venta'}
          </button>
        </div>
      </div>
    </div>
  )
}

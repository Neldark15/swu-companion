import { Fragment, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, BookOpen, AlertTriangle, CheckCircle2, Swords, Eye, EyeOff, Upload, Share2, FlaskConical } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { db } from '../../services/db'
import { getCardById } from '../../services/swuApi'
import { deleteDeckFromCloud, pullDecksFromCloud, syncDeckToCloud } from '../../services/sync'
import { validateDeck, getEffectiveMinDeckSize } from '../../services/deckValidator'
import { getPricesForCards, fetchTCGPrices, formatPrice, precioVariante, type PriceInfo } from '../../services/pricing'
import { useAuth } from '../../hooks/useAuth'
import { updateMissionProgress } from '../../services/missionService'
import { ImportDeckModal } from './ImportDeckModal'
import { ExportDeckModal } from './ExportDeckModal'
import type { Deck, DeckCard } from '../../types'
import type { DeckImportResult } from '../../services/deckImportExport'

type Variante = 'normal' | 'foil' | 'hyperspace'

/** Todas las cartas que cuestan de un mazo: líderes + base + mazo principal.
 *  El sideboard queda fuera: es opcional y no es «el mazo que jugás». */
function cartasDeMazo(deck: Deck): DeckCard[] {
  const cs = [...deck.leaders, ...deck.mainDeck]
  if (deck.base) cs.push(deck.base)
  return cs
}

/** Precio aproximado del mazo para una impresión, y cuántas cartas no tienen
 *  precio (para poder avisarlo en vez de mentir con un total bajo). */
function precioDeMazo(deck: Deck, precios: Map<string, PriceInfo>, variante: Variante): { total: number; faltan: number } {
  let total = 0
  let faltan = 0
  for (const c of cartasDeMazo(deck)) {
    const v = precioVariante(precios.get(c.cardId), variante)
    if (v != null && v > 0) total += v * c.quantity
    else faltan += c.quantity
  }
  return { total, faltan }
}

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
  const [deckToDelete, setDeckToDelete] = useState<Deck | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cardImages, setCardImages] = useState<Map<string, string>>(new Map())
  const [baseTexts, setBaseTexts] = useState<Map<string, string>>(new Map())
  const [showImport, setShowImport] = useState(false)
  const [exportDeck, setExportDeck] = useState<Deck | null>(null)
  const [precios, setPrecios] = useState<Map<string, PriceInfo>>(new Map())
  const [variante, setVariante] = useState<Variante>('normal')
  const [trayendoPrecios, setTrayendoPrecios] = useState(false)

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

    // Precios de TODAS las cartas de TODOS los mazos, desde la caché (local +
    // nube). No dispara descargas: si una carta no tiene precio guardado, su
    // mazo mostrará «faltan N precios» y el botón «Traer precios» los baja.
    const idsPrecio = new Set<string>()
    d.forEach(deck => cartasDeMazo(deck).forEach(c => idsPrecio.add(c.cardId)))
    if (idsPrecio.size > 0) {
      const p = await getPricesForCards([...idsPrecio])
      setPrecios(p)
    }
  }, [supabaseUser])

  /** Baja de TCGplayer los precios que falten, para todos los mazos. */
  const traerPrecios = useCallback(async () => {
    setTrayendoPrecios(true)
    try {
      const necesarias = new Map<string, DeckCard>()
      decks.forEach(deck => cartasDeMazo(deck).forEach(c => {
        if (!precios.has(c.cardId)) necesarias.set(c.cardId, c)
      }))
      if (necesarias.size > 0) {
        await fetchTCGPrices([...necesarias.values()].map(c => ({
          id: c.cardId, name: c.name, subtitle: c.subtitle, setCode: c.setCode,
        })))
      }
      const idsPrecio = new Set<string>()
      decks.forEach(deck => cartasDeMazo(deck).forEach(c => idsPrecio.add(c.cardId)))
      setPrecios(await getPricesForCards([...idsPrecio]))
    } finally {
      setTrayendoPrecios(false)
    }
  }, [decks, precios])

  // Load on mount and when navigating back
  useEffect(() => {
    void (async () => { await loadDecks() })()
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

  const confirmDelete = async () => {
    const deck = deckToDelete
    if (!deck) return
    setDeleting(true)
    await db.decks.delete(deck.id)
    if (supabaseUser) deleteDeckFromCloud(deck.id).catch(() => {})
    setDecks((prev) => prev.filter((d) => d.id !== deck.id))
    setDeleting(false)
    setDeckToDelete(null)
  }

  const handleTogglePublic = async (deckId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const target = decks.find(d => d.id === deckId)
    if (!target) return
    const updated = { ...target, isPublic: !(target.isPublic ?? true), updatedAt: Date.now() }
    await db.decks.put(updated)
    if (supabaseUser) syncDeckToCloud(supabaseUser.id, updated).catch(() => {})
    setDecks(prev => prev.map(d => d.id === deckId ? updated : d))
  }

  const handleImportResult = async (result: DeckImportResult) => {
    if (!result.success || !result.deck) return
    const now = Date.now()
    const newDeck: Deck = {
      id: `d_${now}_${Math.random().toString(36).slice(2, 6)}`,
      name: result.deck.name || 'Deck Importado',
      format: 'premier',
      leaders: result.deck.leaders || [],
      base: result.deck.base || null,
      mainDeck: result.deck.mainDeck || [],
      sideboard: result.deck.sideboard || [],
      isValid: false,
      validationErrors: [],
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    }
    // Validate
    const baseCard = newDeck.base ? await getCardById(newDeck.base.cardId) : null
    const validation = validateDeck(newDeck, baseCard?.text)
    newDeck.isValid = validation.isValid
    newDeck.validationErrors = validation.errors

    await db.decks.put(newDeck)
    if (supabaseUser) {
      syncDeckToCloud(supabaseUser.id, newDeck).catch(() => {})
      // La misión de «crear mazo» se cuenta acá, que es donde nace uno. Se traga
      // el fallo a propósito: una misión no puede impedir que se guarde el mazo.
      void updateMissionProgress(supabaseUser.id, 'deck_created').catch(() => {})
    }
    loadDecks()
  }

  const handleExport = (deck: Deck, e: React.MouseEvent) => {
    e.stopPropagation()
    setExportDeck(deck)
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-8 lg:pb-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-swu-text">Mis Decks</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-2 rounded-xl border border-swu-accent/30 bg-swu-accent/10 text-swu-accent-texto font-bold text-sm flex items-center gap-1.5 active:scale-95 transition-transform"
            title="Importar deck desde SWUDB o texto"
          >
            <Upload size={14} /> Importar
          </button>
          <button
            onClick={() => navigate('/decks/new')}
            className="px-4 py-2 rounded-xl bg-swu-accent text-white font-bold text-sm flex items-center gap-1.5 active:scale-95 transition-transform"
          >
            <Plus size={16} /> Nuevo
          </button>
        </div>
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
          {/* Precio aproximado + modificador de impresión. El precio de un mazo
              cambia MUCHO según si las cartas son normales, foil o hyperspace;
              el modificador acerca el aproximado al costo real. */}
          <div className="rounded-2xl border border-swu-border bg-swu-surface p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-swu-muted">Precio aproximado</span>
              <button
                onClick={() => void traerPrecios()}
                disabled={trayendoPrecios}
                className="text-[11px] font-bold text-swu-accent-texto disabled:opacity-50"
              >
                {trayendoPrecios ? 'Trayendo…' : 'Traer precios'}
              </button>
            </div>
            <SegmentedControl<Variante>
              label="Impresión de las cartas"
              value={variante}
              onChange={setVariante}
              options={[
                { value: 'normal', label: 'Normal' },
                { value: 'foil', label: 'Foil' },
                { value: 'hyperspace', label: 'Hyperspace' },
              ]}
            />
            <p className="text-[10px] text-swu-muted">
              El aproximado supone que TODO el mazo es de esa impresión. Si una carta no
              tiene ese precio, se usa el normal.
            </p>
          </div>

          {decks.map((deck) => {
            const mainCount = countCards(deck.mainDeck)
            const sideCount = countCards(deck.sideboard)
            const { total: precioTotal, faltan: precioFaltan } = precioDeMazo(deck, precios, variante)
            /* TODOS los líderes, no solo el primero.
               Un Twin Suns se juega con DOS, y la miniatura mostraba uno: dos
               mazos distintos que compartieran el primer líder se veían
               idénticos en la lista, que es justo donde uno los distingue de
               un vistazo. */
            const lideres = deck.leaders.length > 0 ? deck.leaders : [null]
            const base = deck.base
            const baseImg = base ? cardImages.get(base.cardId) : undefined
            const bText = deck.base ? baseTexts.get(deck.base.cardId) || '' : ''
            const targetSize = getEffectiveMinDeckSize(deck.format, bText)

            return (
              <div
                key={deck.id}
                onClick={() => navigate(`/decks/${deck.id}`)}
                className="bg-swu-surface rounded-2xl border border-swu-border overflow-hidden active:scale-[0.99] transition-transform cursor-pointer"
              >
                {/* Cabecera con líder y base.
                    `object-top` mostraba justo la franja MENOS útil: la barra
                    del título impreso. Y con `h-24` fijo y mitades de ancho
                    libre, en escritorio cada mitad medía ~487px y el arte se
                    renderizaba a 349px de alto dentro de 96: se veía el 27% de
                    arriba y nada del dibujo. Ahora se recorta por el CENTRO,
                    que es donde está la ilustración, y la altura crece con la
                    pantalla en vez de quedarse clavada. */}
                <div className="flex h-36 sm:h-44 lg:h-52 bg-swu-bg relative">
                  {lideres.map((l, i) => {
                    const img = l ? cardImages.get(l.cardId) : undefined
                    return (
                      <Fragment key={l?.cardId ?? `sin-lider-${i}`}>
                        <div className="flex-1 relative overflow-hidden">
                          {img ? (
                            <img
                              src={img}
                              alt={l?.name || ''}
                              className="w-full h-full object-cover object-center"
                              loading="lazy"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Swords size={24} className="text-swu-muted/20" />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
                            {/* Se numeran solo si hay más de uno: «LÍDER 1» con
                                un solo líder es ruido. */}
                            <p className="text-[9px] text-swu-amber font-bold">
                              {lideres.length > 1 ? `LÍDER ${i + 1}` : 'LÍDER'}
                            </p>
                            <p className="text-[10px] text-white font-medium truncate">{l?.name || 'Sin líder'}</p>
                          </div>
                        </div>
                        <div className="w-px bg-swu-border" />
                      </Fragment>
                    )
                  })}

                  {/* Base image */}
                  <div className="flex-1 relative overflow-hidden">
                    {baseImg ? (
                      <img
                        src={baseImg}
                        alt={base?.name || ''}
                        className="w-full h-full object-cover object-center"
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
                      <span className="font-mono font-bold text-swu-accent-texto">{mainCount}/{targetSize}</span>
                      {sideCount > 0 && <span>Side: {sideCount}</span>}
                      {precioTotal > 0 && (
                        <span
                          className="font-mono font-bold text-swu-green"
                          title={precioFaltan > 0 ? `Faltan ${precioFaltan} cartas sin precio` : undefined}
                        >
                          ~{formatPrice(precioTotal)}{precioFaltan > 0 && <span className="text-swu-amber">*</span>}
                        </span>
                      )}
                      <span>{timeAgo(deck.updatedAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/laboratorio?deck=${deck.id}`) }}
                        className="p-1.5 rounded-lg bg-swu-cyan/10 text-swu-cyan active:scale-95 transition-transform"
                        title="Probar en el laboratorio (simulador)"
                      >
                        <FlaskConical size={13} />
                      </button>
                      <button
                        onClick={(e) => handleExport(deck, e)}
                        className="p-1.5 rounded-lg bg-swu-accent/10 text-swu-accent-texto active:scale-95 transition-transform"
                        title="Exportar deck"
                      >
                        <Share2 size={13} />
                      </button>
                      <button
                        onClick={(e) => handleTogglePublic(deck.id, e)}
                        className={`p-1.5 rounded-lg active:scale-95 transition-all ${
                          (deck.isPublic ?? true)
                            ? 'bg-indigo-500/15 text-indigo-400'
                            : 'bg-swu-bg text-swu-muted/50'
                        }`}
                        title={(deck.isPublic ?? true) ? 'Público — visible en espionaje' : 'Privado — oculto en espionaje'}
                      >
                        {(deck.isPublic ?? true) ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeckToDelete(deck) }}
                        className="p-1.5 rounded-lg bg-swu-red/10 text-swu-red-texto active:scale-95 transition-transform"
                        title="Borrar deck"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
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

      {/* Import/Export Modals */}
      <ImportDeckModal open={showImport} onClose={() => setShowImport(false)} onImport={handleImportResult} />
      <ExportDeckModal open={!!exportDeck} deck={exportDeck} onClose={() => setExportDeck(null)} />

      {/* Confirmación de borrado — un deck puede ser horas de trabajo */}
      {deckToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-swu-surface rounded-2xl border border-swu-red/30 p-5 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-swu-red/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-swu-red-texto" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-swu-text">¿Borrar este deck?</div>
                <div className="text-xs text-swu-muted mt-0.5 truncate">{deckToDelete.name}</div>
              </div>
            </div>

            <p className="text-[11px] text-swu-muted leading-relaxed">
              Se elimina de este dispositivo y de la nube. Esta acción no se puede deshacer.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setDeckToDelete(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-swu-bg border border-swu-border text-swu-muted text-sm font-medium active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-swu-red text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
              >
                {deleting
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Trash2 size={14} />}
                {deleting ? 'Borrando…' : 'Sí, borrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

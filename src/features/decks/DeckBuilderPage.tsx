import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Plus, Minus, Search, X, Save, Check,
  AlertTriangle, CheckCircle2, Loader2, BookOpen, Layers
} from 'lucide-react'
import { db } from '../../services/db'
import { searchCards, loadFullDatabase, isDatabaseReady } from '../../services/swuApi'
import { validateDeck, canAddCard } from '../../services/deckValidator'
import type { Deck, DeckCard, Card, TournamentFormat } from '../../types'

function generateId() {
  return `d_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function countCards(cards: DeckCard[]): number {
  return cards.reduce((s, c) => s + c.quantity, 0)
}

const formatLabels: Record<string, string> = {
  premier: 'Premier',
  twin_suns: 'Twin Suns',
  sealed: 'Sealed',
  draft: 'Draft',
  limited: 'Limited',
}

type Tab = 'deck' | 'search'

export function DeckBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const [deck, setDeck] = useState<Deck>({
    id: generateId(),
    name: 'Nuevo Deck',
    format: 'premier',
    leaders: [],
    base: null,
    mainDeck: [],
    sideboard: [],
    isValid: false,
    validationErrors: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  const [loading, setLoading] = useState(!isNew)
  const [dbLoading, setDbLoading] = useState(!isDatabaseReady())
  const [tab, setTab] = useState<Tab>('deck')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Card[]>([])
  const [searching, setSearching] = useState(false)
  const [searchTotal, setSearchTotal] = useState(0)
  const [saveFlash, setSaveFlash] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [addTarget, setAddTarget] = useState<'mainDeck' | 'sideboard'>('mainDeck')

  // Ensure DB is loaded for search
  useEffect(() => {
    if (!isDatabaseReady()) {
      setDbLoading(true)
      loadFullDatabase().then(() => setDbLoading(false))
    }
  }, [])

  // Auto-save new deck immediately so it exists in DB
  useEffect(() => {
    if (isNew) {
      db.decks.put({ ...deck, updatedAt: Date.now() }).catch(() => {})
    }
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load existing deck
  useEffect(() => {
    if (!isNew && id) {
      db.decks.get(id).then((d) => {
        if (d) setDeck(d)
        setLoading(false)
      })
    }
  }, [id, isNew])

  // Validate on changes
  useEffect(() => {
    const result = validateDeck(deck)
    setDeck((prev) => ({ ...prev, isValid: result.isValid, validationErrors: result.errors }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.leaders, deck.base, deck.mainDeck, deck.sideboard, deck.format])

  const saveDeck = useCallback(async () => {
    const toSave = { ...deck, updatedAt: Date.now() }
    await db.decks.put(toSave)
    setSaveFlash(true)
    setTimeout(() => setSaveFlash(false), 1200)
  }, [deck])

  const autoSave = useCallback(async (d: Deck) => {
    await db.decks.put({ ...d, updatedAt: Date.now() }).catch(() => {})
  }, [])

  const doSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setSearchResults([]); setSearchTotal(0); return }
    if (dbLoading) return
    setSearching(true)
    try {
      const { cards, total } = await searchCards({ query, limit: 30 })
      setSearchResults(cards)
      setSearchTotal(total)
    } catch { setSearchResults([]) }
    setSearching(false)
  }, [dbLoading])

  useEffect(() => {
    if (dbLoading) return
    const timer = setTimeout(() => doSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery, doSearch, dbLoading])

  const addCardToDeck = (card: Card) => {
    if (card.type === 'Leader' || card.isLeader) {
      const existing = deck.leaders.find((c) => c.cardId === card.id)
      if (existing) return
      const rules = deck.format === 'twin_suns' ? 2 : 1
      if (deck.leaders.length >= rules) return
      const nd = { ...deck, leaders: [...deck.leaders, { cardId: card.id, name: card.name, subtitle: card.subtitle, quantity: 1, setCode: card.setCode }] }
      setDeck(nd); autoSave(nd)
      return
    }
    if (card.type === 'Base' || card.isBase) {
      const nd = { ...deck, base: { cardId: card.id, name: card.name, subtitle: card.subtitle, quantity: 1, setCode: card.setCode } }
      setDeck(nd); autoSave(nd)
      return
    }
    const target = addTarget
    const check = canAddCard(deck, card.id, card.name, card.isUnique, target)
    if (!check.allowed) return
    setDeck((prev) => {
      const list = [...prev[target]]
      const idx = list.findIndex((c) => c.cardId === card.id)
      if (idx >= 0) { list[idx] = { ...list[idx], quantity: list[idx].quantity + 1 } }
      else { list.push({ cardId: card.id, name: card.name, subtitle: card.subtitle, quantity: 1, setCode: card.setCode }) }
      const nd = { ...prev, [target]: list }
      autoSave(nd)
      return nd
    })
  }

  const removeCard = (target: 'leaders' | 'mainDeck' | 'sideboard' | 'base', cardId: string) => {
    if (target === 'base') { setDeck((p) => { const nd = { ...p, base: null }; autoSave(nd); return nd }); return }
    if (target === 'leaders') { setDeck((p) => { const nd = { ...p, leaders: p.leaders.filter((c) => c.cardId !== cardId) }; autoSave(nd); return nd }); return }
    setDeck((prev) => {
      const list = prev[target].map((c) => c.cardId === cardId ? { ...c, quantity: c.quantity - 1 } : c).filter((c) => c.quantity > 0)
      const nd = { ...prev, [target]: list }; autoSave(nd); return nd
    })
  }

  const incrementCard = (target: 'mainDeck' | 'sideboard', cardId: string) => {
    setDeck((prev) => {
      const list = prev[target].map((c) => {
        if (c.cardId !== cardId) return c
        const maxCopies = deck.format === 'twin_suns' ? 1 : 3
        if (c.quantity >= maxCopies) return c
        return { ...c, quantity: c.quantity + 1 }
      })
      const nd = { ...prev, [target]: list }; autoSave(nd); return nd
    })
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={28} className="text-swu-accent animate-spin" /></div>
  }

  const mainCount = countCards(deck.mainDeck)
  const sideCount = countCards(deck.sideboard)
  const targetSize = deck.format === 'sealed' || deck.format === 'draft' || deck.format === 'limited' ? 30 : 50

  return (
    <div className="p-3 space-y-3 pb-24">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/decks')} className="flex items-center gap-1 text-sm text-swu-muted"><ChevronLeft size={18} /> Decks</button>
        <button onClick={saveDeck} className={`p-2 rounded-lg border transition-colors ${saveFlash ? 'bg-swu-green/20 border-swu-green/40 text-swu-green' : 'bg-swu-surface border-swu-border text-swu-muted'}`}>
          {saveFlash ? <Check size={16} /> : <Save size={16} />}
        </button>
      </div>

      <div className="flex items-center gap-2">
        {editingName ? (
          <input autoFocus className="flex-1 bg-swu-surface border border-swu-border rounded-lg px-3 py-2 text-sm text-swu-text font-bold" defaultValue={deck.name}
            onBlur={(e) => { setDeck((p) => ({ ...p, name: e.target.value || 'Nuevo Deck' })); setEditingName(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { setDeck((p) => ({ ...p, name: (e.target as HTMLInputElement).value || 'Nuevo Deck' })); setEditingName(false) } }} />
        ) : (
          <button onClick={() => setEditingName(true)} className="flex-1 text-left"><h2 className="text-lg font-bold text-swu-text">{deck.name}</h2></button>
        )}
        <select value={deck.format} onChange={(e) => setDeck((p) => ({ ...p, format: e.target.value as TournamentFormat | 'limited' }))}
          className="bg-swu-surface border border-swu-border rounded-lg px-3 py-2 text-xs text-swu-text font-bold">
          {Object.entries(formatLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${deck.isValid ? 'bg-swu-green/10 border-swu-green/30' : 'bg-swu-amber/10 border-swu-amber/30'}`}>
        {deck.isValid ? <CheckCircle2 size={14} className="text-swu-green" /> : <AlertTriangle size={14} className="text-swu-amber" />}
        <span className={`text-xs font-bold ${deck.isValid ? 'text-swu-green' : 'text-swu-amber'}`}>{deck.isValid ? 'Deck válido' : deck.validationErrors[0] || 'Deck incompleto'}</span>
        <span className="text-[10px] text-swu-muted ml-auto">{mainCount}/{targetSize}</span>
      </div>

      {dbLoading && (
        <div className="bg-swu-accent/10 border border-swu-accent/30 rounded-xl p-3 flex items-center gap-2">
          <Loader2 size={16} className="text-swu-accent animate-spin" />
          <p className="text-xs text-swu-accent font-bold">Cargando base de datos...</p>
        </div>
      )}

      <div className="flex bg-swu-surface rounded-xl border border-swu-border overflow-hidden">
        <button onClick={() => setTab('deck')} className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${tab === 'deck' ? 'bg-swu-accent text-white' : 'text-swu-muted'}`}>
          <Layers size={14} /> Deck ({mainCount})
        </button>
        <button onClick={() => setTab('search')} className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${tab === 'search' ? 'bg-swu-accent text-white' : 'text-swu-muted'}`}>
          <Search size={14} /> Buscar
        </button>
      </div>

      {tab === 'deck' && (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold text-swu-amber mb-1.5">Líder ({deck.leaders.length})</p>
            {deck.leaders.length === 0 ? (
              <p className="text-[10px] text-swu-muted bg-swu-surface rounded-lg p-3 border border-swu-border text-center">Busque un Líder para agregarlo</p>
            ) : deck.leaders.map((c) => (
              <div key={c.cardId} className="bg-swu-surface rounded-lg p-2.5 border border-swu-amber/30 flex items-center justify-between">
                <div><span className="text-sm font-bold text-swu-text">{c.name}</span>{c.subtitle && <span className="text-xs text-swu-muted ml-1.5">{c.subtitle}</span>}</div>
                <button onClick={() => removeCard('leaders', c.cardId)} className="text-swu-red p-1"><X size={14} /></button>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-bold text-swu-green mb-1.5">Base ({deck.base ? 1 : 0})</p>
            {!deck.base ? (
              <p className="text-[10px] text-swu-muted bg-swu-surface rounded-lg p-3 border border-swu-border text-center">Busque una Base para agregarla</p>
            ) : (
              <div className="bg-swu-surface rounded-lg p-2.5 border border-swu-green/30 flex items-center justify-between">
                <div><span className="text-sm font-bold text-swu-text">{deck.base.name}</span>{deck.base.subtitle && <span className="text-xs text-swu-muted ml-1.5">{deck.base.subtitle}</span>}</div>
                <button onClick={() => removeCard('base', '')} className="text-swu-red p-1"><X size={14} /></button>
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-swu-accent mb-1.5">Mazo Principal ({mainCount}/{targetSize})</p>
            {deck.mainDeck.length === 0 ? (
              <p className="text-[10px] text-swu-muted bg-swu-surface rounded-lg p-3 border border-swu-border text-center">Vaya a "Buscar" para agregar cartas</p>
            ) : (
              <div className="space-y-1">{deck.mainDeck.map((c) => (
                <div key={c.cardId} className="bg-swu-surface rounded-lg px-2.5 py-2 border border-swu-border flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-swu-accent/20 text-swu-accent text-xs font-bold flex items-center justify-center font-mono">{c.quantity}</span>
                  <div className="flex-1 min-w-0"><span className="text-sm text-swu-text truncate block">{c.name}</span></div>
                  <span className="text-[9px] text-swu-muted">{c.setCode}</span>
                  <div className="flex gap-1">
                    <button onClick={() => removeCard('mainDeck', c.cardId)} className="w-6 h-6 rounded bg-swu-red/10 text-swu-red flex items-center justify-center"><Minus size={12} /></button>
                    <button onClick={() => incrementCard('mainDeck', c.cardId)} className="w-6 h-6 rounded bg-swu-green/10 text-swu-green flex items-center justify-center"><Plus size={12} /></button>
                  </div>
                </div>
              ))}</div>
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-purple-400 mb-1.5">Sideboard ({sideCount}/10)</p>
            {deck.sideboard.length === 0 ? (
              <p className="text-[10px] text-swu-muted bg-swu-surface rounded-lg p-3 border border-swu-border text-center">Opcional</p>
            ) : (
              <div className="space-y-1">{deck.sideboard.map((c) => (
                <div key={c.cardId} className="bg-swu-surface rounded-lg px-2.5 py-2 border border-swu-border flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-purple-400/20 text-purple-400 text-xs font-bold flex items-center justify-center font-mono">{c.quantity}</span>
                  <div className="flex-1 min-w-0"><span className="text-sm text-swu-text truncate block">{c.name}</span></div>
                  <div className="flex gap-1">
                    <button onClick={() => removeCard('sideboard', c.cardId)} className="w-6 h-6 rounded bg-swu-red/10 text-swu-red flex items-center justify-center"><Minus size={12} /></button>
                    <button onClick={() => incrementCard('sideboard', c.cardId)} className="w-6 h-6 rounded bg-swu-green/10 text-swu-green flex items-center justify-center"><Plus size={12} /></button>
                  </div>
                </div>
              ))}</div>
            )}
          </div>
        </div>
      )}

      {tab === 'search' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setAddTarget('mainDeck')} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${addTarget === 'mainDeck' ? 'bg-swu-accent/20 border-swu-accent text-swu-accent' : 'bg-swu-surface border-swu-border text-swu-muted'}`}>Mazo ({mainCount})</button>
            <button onClick={() => setAddTarget('sideboard')} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${addTarget === 'sideboard' ? 'bg-purple-400/20 border-purple-400 text-purple-400' : 'bg-swu-surface border-swu-border text-swu-muted'}`}>Sideboard ({sideCount})</button>
          </div>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por nombre..." disabled={dbLoading}
              className="w-full bg-swu-surface border border-swu-border rounded-xl py-3 pl-10 pr-3 text-sm text-swu-text outline-none focus:border-swu-accent disabled:opacity-50" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-swu-muted"><X size={16} /></button>}
          </div>
          {searching && <div className="flex items-center justify-center py-8"><Loader2 size={24} className="text-swu-accent animate-spin" /></div>}
          {!searching && searchResults.length > 0 && (
            <>
              <p className="text-[10px] text-swu-muted">{searchTotal} resultados</p>
              <div className="space-y-1">{searchResults.map((card) => {
                const inDeck = deck.mainDeck.find((c) => c.cardId === card.id)
                const inSide = deck.sideboard.find((c) => c.cardId === card.id)
                const isLeaderInDeck = deck.leaders.some((c) => c.cardId === card.id)
                const isBaseInDeck = deck.base?.cardId === card.id
                return (
                  <button key={card.id} onClick={() => addCardToDeck(card)} disabled={isLeaderInDeck || isBaseInDeck}
                    className="w-full bg-swu-surface rounded-lg p-2.5 border border-swu-border flex items-center gap-2 text-left active:scale-[0.99] transition-transform disabled:opacity-40">
                    {card.imageUrl && <img src={card.imageUrl} alt="" className="w-10 h-14 rounded object-cover bg-swu-bg flex-shrink-0" loading="lazy" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-swu-text truncate">{card.name}</p>
                      <div className="flex gap-1 mt-0.5">
                        <span className="text-[9px] text-swu-muted">{card.type}</span>
                        {card.cost !== null && <span className="text-[9px] text-swu-amber font-bold">⬡{card.cost}</span>}
                        {card.arena && <span className="text-[9px] text-swu-muted">· {card.arena}</span>}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {(inDeck || inSide) && <span className="text-[10px] text-swu-accent font-bold">×{(inDeck?.quantity || 0) + (inSide?.quantity || 0)}</span>}
                      {isLeaderInDeck && <span className="text-[9px] text-swu-amber">Líder</span>}
                      {isBaseInDeck && <span className="text-[9px] text-swu-green">Base</span>}
                      {!isLeaderInDeck && !isBaseInDeck && <Plus size={16} className="text-swu-accent" />}
                    </div>
                  </button>
                )
              })}</div>
            </>
          )}
          {!searching && searchQuery && searchResults.length === 0 && (
            <div className="text-center py-8"><BookOpen size={28} className="mx-auto text-swu-muted/40 mb-2" /><p className="text-xs text-swu-muted">No se encontraron cartas</p></div>
          )}
          {!searchQuery && (
            <div className="text-center py-8"><Search size={28} className="mx-auto text-swu-muted/40 mb-2" /><p className="text-xs text-swu-muted">Escriba el nombre de una carta</p><p className="text-[10px] text-swu-muted mt-1">Líderes y Bases se asignan automáticamente</p></div>
          )}
        </div>
      )}
    </div>
  )
}

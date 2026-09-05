import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Plus, Minus, Search, X, Save, Check,
  AlertTriangle, CheckCircle2, Loader2, BookOpen, Layers, Package, RotateCw, Share2,
} from 'lucide-react'
import { db } from '../../services/db'
import {
  searchCards, getCardById, getCardsByIds, ensureFreshDatabase,
  subscribeDbLoadProgress, COST_MAX_BUCKET, type DbLoadProgress,
} from '../../services/swuApi'
import { validateDeck, canAddCard, getEffectiveMinDeckSize, getFormatRules } from '../../services/deckValidator'
import { syncDeckToCloud } from '../../services/sync'
import { updateMissionProgress } from '../../services/missionService'
import { useAuth } from '../../hooks/useAuth'
import { CardImage } from '../../components/CardImage'
import { CardPreviewSheet } from '../../components/CardPreviewSheet'
import { ExportDeckModal } from './ExportDeckModal'
import { listFaceUrl, listFaceFit } from '../../services/cardArt'
import { translateType, translateAspect } from '../../services/translations'
import type { Deck, DeckCard, Card, TournamentFormat } from '../../types'
import { ASPECTOS } from '../../services/filtrosCarta'
import { FiltrosBusqueda } from './FiltrosBusqueda'
import { SIN_FILTROS, contarActivos, type FiltrosAvanzados } from './filtrosAvanzados'
import { formatPrice } from '../../services/pricing'
import {
  precioDeCartas, impresionesDe, resumenImpresiones,
  type PrecioMazo, type VarianteMazo,
} from '../../services/precioMazo'
import { CopiasDeCarta } from './CopiasDeCarta'

const BUILDER_COSTS = [0, 1, 2, 3, 4, 5, 6, COST_MAX_BUCKET]

function generateId() {
  return `d_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function countCards(cards: DeckCard[]): number {
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

type Tab = 'deck' | 'search'

// ─── Image cache for card thumbnails ─────────────────────
const imgCache = new Map<string, string>()
const backImgCache = new Map<string, string>()

export function DeckBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { supabaseUser } = useAuth()
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
    isPublic: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  const [loading, setLoading] = useState(!isNew)
  const [tab, setTab] = useState<Tab>('deck')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchAspect, setSearchAspect] = useState<string | null>(null)
  const [searchCost, setSearchCost] = useState<number | null>(null)
  const [filtros, setFiltros] = useState<FiltrosAvanzados>(SIN_FILTROS)
  const [searchResults, setSearchResults] = useState<Card[]>([])
  const [searching, setSearching] = useState(false)
  const [searchTotal, setSearchTotal] = useState(0)
  const [saveFlash, setSaveFlash] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [addTarget, setAddTarget] = useState<'mainDeck' | 'sideboard'>('mainDeck')

  // Base card text for deck-size modifiers (e.g. Data Vault +10)
  const [baseText, setBaseText] = useState('')

  // Card DB download progress (shown while the full card database bootstraps)
  const [dbProgress, setDbProgress] = useState<DbLoadProgress>({ phase: 'idle', message: '' })

  // Bootstrap: make sure the card DB exists and is fresh (auto-downloads
  // new expansions weekly). Without this, search returned empty forever
  // on a cold cache.
  useEffect(() => {
    const unsub = subscribeDbLoadProgress(setDbProgress)
    void ensureFreshDatabase()
    return unsub
  }, [])

  // Card images state
  const [cardImages, setCardImages] = useState<Map<string, string>>(new Map(imgCache))
  /** Carta que se está mirando en grande. Null = cerrado. */
  const [verCarta, setVerCarta] = useState<string | null>(null)
  const [precio, setPrecio] = useState<PrecioMazo | null>(null)
  /**
   * Qué carta tiene abierta la hoja de copias. Se guarda la REFERENCIA
   * (id + lista), no la carta: la carta se deriva del mazo al pintar.
   *
   * Guardar una copia del objeto era tener dos fuentes de verdad para el mismo
   * dato — al cambiar una impresión había que escribir en las dos, y cualquier
   * otro camino que tocara el mazo (los botones + y −, deshacer, el autoguardado
   * volviendo de la nube) dejaba la hoja mostrando lo viejo.
   */
  const [copias, setCopias] = useState<
    { cardId: string; lista: 'leaders' | 'mainDeck' | 'sideboard' | 'base' } | null
  >(null)
  const [backImages, setBackImages] = useState<Map<string, string>>(new Map(backImgCache))
  const loadedRef = useRef(new Set<string>())

  // Leader flip animation: 'front' | 'to-back' | 'back' | 'to-front'
  type FlipPhase = 'front' | 'to-back' | 'back' | 'to-front'
  const [leaderFlip, setLeaderFlip] = useState<Record<string, FlipPhase>>({})
  const flipTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const toggleLeaderFlip = useCallback((cardId: string) => {
    if (flipTimers.current[cardId]) clearTimeout(flipTimers.current[cardId])

    setLeaderFlip(p => {
      const cur = p[cardId] || 'front'
      const next: FlipPhase = (cur === 'front' || cur === 'to-front') ? 'to-back' : 'to-front'
      return { ...p, [cardId]: next }
    })

    // After the card reaches edge (400ms), swap to final state
    flipTimers.current[cardId] = setTimeout(() => {
      setLeaderFlip(p => {
        const cur = p[cardId]
        if (cur === 'to-back') return { ...p, [cardId]: 'back' as FlipPhase }
        if (cur === 'to-front') return { ...p, [cardId]: 'front' as FlipPhase }
        return p
      })
    }, 400)
  }, [])

  // Auto-save new deck immediately so it exists in DB
  useEffect(() => {
    if (isNew) {
      db.decks.put({ ...deck, updatedAt: Date.now() }).catch(() => {})
    }
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

  // Load base card text when base changes (for deck-size modifiers)
  useEffect(() => {
    if (!deck.base) { setBaseText(''); return }
    getCardById(deck.base.cardId).then(card => {
      setBaseText(card?.text || '')
    })
  }, [deck.base?.cardId])

  // Validate on changes
  useEffect(() => {
    const result = validateDeck(deck, baseText)
    setDeck((prev) => ({ ...prev, isValid: result.isValid, validationErrors: result.errors }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.leaders, deck.base, deck.mainDeck, deck.sideboard, deck.format, baseText])

  // ─── Load card images for all cards in deck ────────────
  useEffect(() => {
    const allCardIds = new Set<string>()
    deck.leaders.forEach(c => allCardIds.add(c.cardId))
    if (deck.base) allCardIds.add(deck.base.cardId)
    deck.mainDeck.forEach(c => allCardIds.add(c.cardId))
    deck.sideboard.forEach(c => allCardIds.add(c.cardId))

    const toFetch = [...allCardIds].filter(cid => !loadedRef.current.has(cid) && !imgCache.has(cid))
    if (toFetch.length === 0) return

    toFetch.forEach(cid => loadedRef.current.add(cid))

    // Batch load all card data in a single Dexie query
    getCardsByIds(toFetch).then((cardMap) => {
      const newMap = new Map(imgCache)
      const newBackMap = new Map(backImgCache)
      for (const [cid, card] of cardMap) {
        if (card.imageUrl) { newMap.set(cid, card.imageUrl); imgCache.set(cid, card.imageUrl) }
        if (card.backImageUrl) { newBackMap.set(cid, card.backImageUrl); backImgCache.set(cid, card.backImageUrl) }
      }
      setCardImages(new Map(newMap))
      setBackImages(new Map(newBackMap))
    })
  }, [deck.leaders, deck.base, deck.mainDeck, deck.sideboard])

  /**
   * Crear un mazo NO contaba para las misiones, y esa era la trampa.
   *
   * El único llamador de `deck_created` estaba en el flujo de IMPORTAR
   * (DeckListPage). O sea que la misión «Crear 1 deck» solo se completaba
   * pegando una lista de otro lado: armar uno a mano en esta pantalla —que es
   * lo que la misión pide con todas las letras— no contaba nada.
   *
   * Cuenta cuando el mazo deja de estar vacío: con líder Y base ya es un mazo,
   * antes es una pantalla en blanco. Y una sola vez, porque esto vive dentro
   * del autoguardado y ese corre en cada carta que se toca.
   */
  const yaConto = useRef(false)
  const contarSiNace = useCallback((d: Deck) => {
    if (!isNew || yaConto.current || !supabaseUser) return
    if (!d.leaders?.length || !d.base) return
    yaConto.current = true
    void updateMissionProgress(supabaseUser.id, 'deck_created').catch(() => {})
  }, [isNew, supabaseUser])

  const saveDeck = useCallback(async () => {
    const toSave = { ...deck, updatedAt: Date.now() }
    await db.decks.put(toSave)
    if (supabaseUser) syncDeckToCloud(supabaseUser.id, toSave).catch(() => {})
    contarSiNace(toSave)
    setSaveFlash(true)
    setTimeout(() => setSaveFlash(false), 1200)
  }, [deck, supabaseUser, contarSiNace])

  const autoSave = useCallback(async (d: Deck) => {
    const toSave = { ...d, updatedAt: Date.now() }
    await db.decks.put(toSave).catch(() => {})
    if (supabaseUser) syncDeckToCloud(supabaseUser.id, toSave).catch(() => {})
    contarSiNace(toSave)
  }, [supabaseUser, contarSiNace])

  const doSearch = useCallback(async (
    query: string, aspect: string | null, cost: number | null,
    f: FiltrosAvanzados, aspectosMazo: string[],
  ) => {
    // Antes solo se buscaba con texto escrito. Acá es justamente donde uno
    // piensa "necesito una unidad Vigilance de coste 3", así que con CUALQUIER
    // filtro puesto ya alcanza para buscar — si no, elegir «Evento» y no ver
    // nada se lee como que el filtro no funciona.
    if (!query.trim() && !aspect && cost === null && contarActivos(f) === 0) {
      setSearchResults([]); setSearchTotal(0); return
    }
    setSearching(true)
    try {
      const { cards, total } = await searchCards({
        query: query.trim() || undefined,
        aspect: aspect || undefined,
        cost,
        type: f.tipo || undefined,
        arena: f.arena || undefined,
        keyword: f.palabraClave || undefined,
        trait: f.rasgo || undefined,
        limit: 30,
      })

      /* «De mis aspectos» se aplica ACÁ y no en `searchCards`: el motor filtra
       * por UN aspecto, y esto pregunta otra cosa —que TODOS los de la carta
       * estén entre los del mazo—. Meterlo al servicio obligaría a que
       * conociera el mazo, que no es asunto suyo.
       *
       * Ojo con el total: se recorta la página, así que el número que se
       * enseña deja de ser el del servicio. Se recalcula abajo. */
      const filtradas = f.soloMisAspectos && aspectosMazo.length > 0
        ? cards.filter(c => (c.aspects ?? []).every(a => aspectosMazo.includes(a)))
        : cards

      setSearchResults(filtradas)
      setSearchTotal(filtradas.length === cards.length ? total : filtradas.length)
    } catch { setSearchResults([]) }
    setSearching(false)
  }, [])

  /* Los aspectos que da el mazo: líder + base. Es lo que decide si una carta
     entra sin pagar de más (CR 8.1.1). */
  const [aspectosDelMazo, setAspectosDelMazo] = useState<string[]>([])
  useEffect(() => {
    let vivo = true
    void (async () => {
      const ids = [...deck.leaders.map(l => l.cardId), ...(deck.base ? [deck.base.cardId] : [])]
      if (ids.length === 0) { if (vivo) setAspectosDelMazo([]); return }
      const mapa = await getCardsByIds(ids)
      if (!vivo) return
      const set = new Set<string>()
      for (const c of mapa.values()) for (const a of c.aspects ?? []) set.add(a)
      setAspectosDelMazo([...set])
    })()
    return () => { vivo = false }
  }, [deck.leaders, deck.base])

  useEffect(() => {
    const timer = setTimeout(
      () => doSearch(searchQuery, searchAspect, searchCost, filtros, aspectosDelMazo), 300)
    return () => clearTimeout(timer)
  }, [searchQuery, searchAspect, searchCost, filtros, aspectosDelMazo, doSearch])

  const addCardToDeck = (card: Card) => {
    // Cache image immediately
    if (card.imageUrl && !imgCache.has(card.id)) {
      imgCache.set(card.id, card.imageUrl)
      setCardImages(new Map(imgCache))
    }
    if (card.backImageUrl && !backImgCache.has(card.id)) {
      backImgCache.set(card.id, card.backImageUrl)
      setBackImages(new Map(backImgCache))
    }

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
      else { list.push({ cardId: card.id, name: card.name, subtitle: card.subtitle, quantity: 1, setCode: card.setCode, variantes: ['normal'] }) }
      const nd = { ...prev, [target]: list }
      autoSave(nd)
      return nd
    })
  }

  const removeCard = (target: 'leaders' | 'mainDeck' | 'sideboard' | 'base', cardId: string) => {
    if (target === 'base') { setDeck((p) => { const nd = { ...p, base: null }; autoSave(nd); return nd }); return }
    if (target === 'leaders') { setDeck((p) => { const nd = { ...p, leaders: p.leaders.filter((c) => c.cardId !== cardId) }; autoSave(nd); return nd }); return }
    setDeck((prev) => {
      // Se recorta también el arreglo de impresiones. Sin esto, bajar de 3 a 1
      // dejaba guardada la impresión de la copia 3, y volver a subir a 3 la
      // resucitaba: una foil que la persona ya había quitado reaparecía sola.
      const list = prev[target]
        .map((c) => {
          if (c.cardId !== cardId) return c
          const n = c.quantity - 1
          return { ...c, quantity: n, variantes: impresionesDe(c).slice(0, Math.max(0, n)) }
        })
        .filter((c) => c.quantity > 0)
      const nd = { ...prev, [target]: list }; autoSave(nd); return nd
    })
  }

  /**
   * Cambia la impresión de UNA copia, o de todas.
   *
   * `impresionesDe` normaliza antes de escribir: la fila guardada puede venir
   * sin nada, con el valor único de la versión anterior, o con un arreglo
   * desfasado de la cantidad (los botones + y − la mueven). Escribir sobre lo
   * crudo dejaría huecos justo en la copia que se está tocando.
   *
   * Solo cambia el precio, nunca las reglas: para el juego una foil y una
   * normal son la misma carta, así que ni la validación ni la exportación la
   * miran.
   */
  const cambiarImpresion = (
    target: 'leaders' | 'mainDeck' | 'sideboard' | 'base',
    cardId: string,
    copia: number | 'todas',
    v: VarianteMazo,
  ) => {
    const nuevas = (c: DeckCard) => {
      const actuales = impresionesDe(c)
      return copia === 'todas'
        ? actuales.map(() => v)
        : actuales.map((x, i) => (i === copia ? v : x))
    }
    setDeck((prev) => {
      if (target === 'base') {
        if (!prev.base) return prev
        const nd = { ...prev, base: { ...prev.base, variantes: nuevas(prev.base) } }
        autoSave(nd)
        return nd
      }
      const list = prev[target].map(c =>
        c.cardId === cardId ? { ...c, variantes: nuevas(c) } : c,
      )
      const nd = { ...prev, [target]: list }
      autoSave(nd)
      return nd
    })
  }

  const incrementCard = (target: 'mainDeck' | 'sideboard', cardId: string) => {
    setDeck((prev) => {
      const list = prev[target].map((c) => {
        if (c.cardId !== cardId) return c
        const maxCopies = deck.format === 'twin_suns' ? 1 : 3
        if (c.quantity >= maxCopies) return c
        // La copia nueva entra como normal: es lo que se acaba de conseguir, y
        // heredar la impresión de la anterior afirmaría algo que nadie dijo.
        return { ...c, quantity: c.quantity + 1, variantes: [...impresionesDe(c), 'normal' as VarianteMazo] }
      })
      const nd = { ...prev, [target]: list }; autoSave(nd); return nd
    })
  }

  /* ── El precio aproximado del mazo ────────────────────────────────
   *
   * La clave incluye la IMPRESIÓN de cada carta, no solo el id y la cantidad:
   * si no, marcar una carta como foil no recalcularía nada y el total se
   * quedaría mostrando el precio de la versión normal.
   *
   * El efecto va acá, ANTES del retorno por `loading`: un hook después de un
   * return condicional se llamaría un número distinto de veces según el
   * estado, que es exactamente lo que React prohíbe. */
  const todasLasCartas = [
    ...deck.leaders, ...(deck.base ? [deck.base] : []), ...deck.mainDeck, ...deck.sideboard,
  ]
  const clavePrecio = todasLasCartas
    .map(c => `${c.cardId}:${c.quantity}:${impresionesDe(c).join(',')}`)
    .join('|')

  // La lista se memoriza contra la CLAVE, no contra el mazo: así el efecto solo
  // vuelve a correr cuando cambia algo que de verdad mueve el precio, y no con
  // cada tecla del nombre del mazo.
  const cartasParaPrecio = useMemo(
    () => todasLasCartas,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clavePrecio],
  )

  useEffect(() => {
    let vivo = true
    void (async () => {
      const p = await precioDeCartas(cartasParaPrecio)
      if (vivo) setPrecio(p)
    })()
    return () => { vivo = false }
  }, [cartasParaPrecio])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={28} className="text-swu-accent-texto animate-spin" /></div>
  }

  /* La carta de la hoja, SIEMPRE leída del mazo: si se cierra la sesión de esa
   * carta (se quitó la última copia) la hoja se va sola en vez de quedarse
   * enseñando algo que ya no está. */
  const cartaEnCopias: DeckCard | null = !copias
    ? null
    : copias.lista === 'base'
      ? deck.base
      : (deck[copias.lista].find(c => c.cardId === copias.cardId) ?? null)

  const mainCount = countCards(deck.mainDeck)
  const sideCount = countCards(deck.sideboard)
  const targetSize = getEffectiveMinDeckSize(deck.format, baseText)
  const fmtRules = getFormatRules(deck.format)

  // ─── Expansion breakdown ─────────────────────────────
  const setBreakdown = new Map<string, number>()
  deck.mainDeck.forEach(c => setBreakdown.set(c.setCode, (setBreakdown.get(c.setCode) || 0) + c.quantity))
  deck.sideboard.forEach(c => setBreakdown.set(c.setCode, (setBreakdown.get(c.setCode) || 0) + c.quantity))

  return (
    <div className="p-3 lg:p-6 space-y-3 pb-8 lg:pb-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/decks')} className="flex items-center gap-1 text-sm text-swu-muted"><ChevronLeft size={18} /> Decks</button>
        <div className="flex items-center gap-2">
          {/* Exportar VIVÍA SOLO EN LA LISTA, detrás de un ícono de 13 px sin
              rótulo. O sea que para copiar el mazo que tenías abierto había
              que salir de él, encontrar su fila y adivinar cuál de los cuatro
              iconitos era. Acá va con la palabra escrita: el que quiere copiar
              su lista está mirando la lista, no el índice. */}
          <button
            onClick={() => setExportando(true)}
            className="flex items-center gap-1.5 rounded-lg border border-swu-border bg-swu-surface
                       px-2.5 py-2 text-xs font-bold text-swu-muted transition-colors active:scale-95"
            title="Exportar o copiar este mazo"
          >
            <Share2 size={14} /> Exportar
          </button>
          <button onClick={saveDeck} className={`p-2 rounded-lg border transition-colors ${saveFlash ? 'bg-swu-green/20 border-swu-green/40 text-swu-green' : 'bg-swu-surface border-swu-border text-swu-muted'}`}>
            {saveFlash ? <Check size={16} /> : <Save size={16} />}
          </button>
        </div>
      </div>

      {/* Se exporta lo que está EN PANTALLA, no lo último guardado: el mazo se
          guarda solo en cada cambio, y esperar a un guardado explícito para
          poder copiar sería pedir un paso que la pantalla ya no pide. */}
      <ExportDeckModal open={exportando} deck={deck} onClose={() => setExportando(false)} />

      {/* El nombre y el formato eran los DOS únicos campos que cambiaban con
          `setDeck` sin llamar a `autoSave`: las cartas se guardaban solas (ocho
          sitios lo llaman) pero renombrar el mazo y salir perdía el nombre.
          Ahora van por el mismo camino que el resto. */}
      <div className="flex items-center gap-2">
        {editingName ? (
          <input autoFocus className="flex-1 bg-swu-surface border border-swu-border rounded-lg px-3 py-2 text-sm text-swu-text font-bold" defaultValue={deck.name}
            onBlur={(e) => { setDeck((p) => { const nd = { ...p, name: e.target.value || 'Nuevo Deck' }; autoSave(nd); return nd }); setEditingName(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { setDeck((p) => { const nd = { ...p, name: (e.target as HTMLInputElement).value || 'Nuevo Deck' }; autoSave(nd); return nd }); setEditingName(false) } }} />
        ) : (
          <button onClick={() => setEditingName(true)} className="flex-1 text-left"><h2 className="text-lg font-bold text-swu-text">{deck.name}</h2></button>
        )}
        <select value={deck.format} onChange={(e) => setDeck((p) => { const nd = { ...p, format: e.target.value as TournamentFormat | 'limited' }; autoSave(nd); return nd })}
          className="bg-swu-surface border border-swu-border rounded-lg px-3 py-2 text-xs text-swu-text font-bold">
          {Object.entries(formatLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${deck.isValid ? 'bg-swu-green/10 border-swu-green/30' : 'bg-swu-amber/10 border-swu-amber/30'}`}>
        {deck.isValid ? <CheckCircle2 size={14} className="text-swu-green" /> : <AlertTriangle size={14} className="text-swu-amber" />}
        <span className={`text-xs font-bold ${deck.isValid ? 'text-swu-green' : 'text-swu-amber'}`}>{deck.isValid ? 'Deck válido' : deck.validationErrors[0] || 'Deck incompleto'}</span>
        <span className="text-[10px] text-swu-muted ml-auto">{mainCount}/{targetSize} mín.</span>
      </div>

      {/* Format info banners */}
      {deck.format === 'twin_suns' && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-2">
          <p className="text-[10px] text-orange-400 font-bold">Twin Suns: 2 Leaders (misma alineación), singleton (1 copia), 80+ cartas</p>
        </div>
      )}
      {deck.format === 'trilogy' && (
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-3 py-2">
          <p className="text-[10px] text-cyan-400 font-bold">Trilogy: Sin sideboard. Máx 3 copias de cada carta entre los 3 decks del grupo.</p>
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
        <div className="space-y-4">

          {/* ═══ LÍDER + BASE — Side by side, landscape, flip with orientation change ═══ */}
          <div className="grid grid-cols-2 gap-3">
            {/* ── Leader card ── */}
            <div>
              <p className="text-[10px] font-bold text-swu-amber mb-1 uppercase tracking-wider">Líder</p>
              {deck.leaders.length === 0 ? (
                <div className="aspect-[7/5] bg-swu-surface rounded-xl border border-dashed border-swu-amber/30 flex flex-col items-center justify-center gap-1">
                  <Search size={16} className="text-swu-amber/30" />
                  <p className="text-[9px] text-swu-muted">Buscar</p>
                </div>
              ) : deck.leaders.map((c) => {
                const img = cardImages.get(c.cardId)
                const backImg = backImages.get(c.cardId)
                const phase = leaderFlip[c.cardId] || 'front'
                const showBack = phase === 'back' || phase === 'to-front'
                const isEdge = phase === 'to-back' || phase === 'to-front'
                const isPortrait = phase === 'back' || phase === 'to-front'

                return (
                  <div key={c.cardId} className="relative group">
                    {/* Outer container — aspect ratio transitions from landscape to portrait */}
                    <div
                      className="rounded-xl border-2 border-swu-amber/40 bg-swu-bg overflow-hidden"
                      style={{
                        aspectRatio: isPortrait ? '5 / 7' : '7 / 5',
                        transition: 'aspect-ratio 0.4s ease-in-out',
                      }}
                    >
                      {/* Inner card — rotates to edge during flip */}
                      <div
                        className="w-full h-full"
                        style={{
                          transform: isEdge
                            ? 'perspective(800px) rotateY(90deg) scale(0.92)'
                            : 'perspective(800px) rotateY(0deg) scale(1)',
                          transition: 'transform 0.4s ease-in-out',
                        }}
                      >
                        {showBack ? (
                          backImg ? (
                            <img src={backImg} alt={`${c.name} reverso`} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-swu-amber/10 to-swu-surface">
                              <p className="text-[9px] text-swu-muted">Sin reverso</p>
                            </div>
                          )
                        ) : (
                          img ? (
                            <img src={img} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Loader2 size={20} className="text-swu-amber/30 animate-spin" />
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    {/* Flip button */}
                    {backImg && (
                      <button
                        onClick={() => toggleLeaderFlip(c.cardId)}
                        className="absolute bottom-8 left-1.5 w-7 h-7 rounded-full bg-black/70 text-swu-amber flex items-center justify-center shadow-lg active:scale-90 transition-transform z-10"
                        title="Voltear carta"
                      >
                        <RotateCw size={12} className={`transition-transform duration-500 ${showBack ? 'rotate-180' : ''}`} />
                      </button>
                    )}

                    {/* Remove button */}
                    <button
                      onClick={() => removeCard('leaders', c.cardId)}
                      aria-label={`Quitar ${c.name}`}
                      title="Quitar este líder"
                      className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full
                                 bg-black/80 text-swu-red-texto shadow-lg transition-transform active:scale-90 z-10"
                    >
                      <X size={12} />
                    </button>

                    <button
                      onClick={() => setVerCarta(c.cardId)}
                      className="w-full mt-1"
                      aria-label={`Ver ${c.name} en grande`}
                    >
                      <p className="text-[10px] font-bold text-swu-text truncate text-center">{c.name}</p>
                      {c.subtitle && <p className="text-[8px] text-swu-muted truncate text-center">{c.subtitle}</p>}
                    </button>
                  </div>
                )
              })}
            </div>

            {/* ── Base card — always landscape ── */}
            <div>
              <p className="text-[10px] font-bold text-swu-green mb-1 uppercase tracking-wider">Base</p>
              {!deck.base ? (
                <div className="aspect-[7/5] bg-swu-surface rounded-xl border border-dashed border-swu-green/30 flex flex-col items-center justify-center gap-1">
                  <Search size={16} className="text-swu-green/30" />
                  <p className="text-[9px] text-swu-muted">Buscar</p>
                </div>
              ) : (() => {
                const img = cardImages.get(deck.base!.cardId)
                return (
                  <div className="relative group">
                    <div className="aspect-[7/5] bg-swu-bg rounded-xl border-2 border-swu-green/40 overflow-hidden">
                      {img ? (
                        <img src={img} alt={deck.base!.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Loader2 size={20} className="text-swu-green/30 animate-spin" />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeCard('base', '')}
                      aria-label="Quitar la base"
                      title="Quitar la base"
                      className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full
                                 bg-black/80 text-swu-red-texto shadow-lg transition-transform active:scale-90 z-10"
                    >
                      <X size={12} />
                    </button>
                    <button
                      onClick={() => setVerCarta(deck.base!.cardId)}
                      className="w-full mt-1"
                      aria-label={`Ver ${deck.base!.name} en grande`}
                    >
                      <p className="text-[10px] font-bold text-swu-text truncate text-center">{deck.base!.name}</p>
                      {deck.base!.subtitle && <p className="text-[8px] text-swu-muted truncate text-center">{deck.base!.subtitle}</p>}
                    </button>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* ═══ Expansion breakdown ═══ */}
          {setBreakdown.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Package size={12} className="text-swu-muted" />
              {[...setBreakdown.entries()].sort((a, b) => b[1] - a[1]).map(([code, qty]) => (
                <span key={code} className="text-[10px] bg-swu-surface border border-swu-border rounded-md px-1.5 py-0.5 text-swu-muted font-mono">
                  <span className="text-swu-accent-texto font-bold">{code}</span> ×{qty}
                </span>
              ))}
            </div>
          )}

          {/* ═══ Precio aproximado ═══
              El total NUNCA va solo. Medido en producción: de 3.630 cartas con
              precio, solo 662 tienen desglose por impresión. Así que si alguien
              marca su mazo como foil, 4 de cada 5 cartas se valoran con el
              precio de la normal — y callarlo convertiría el número en una
              afirmación falsa. */}
          {precio && precio.total !== null && (
            <div className="clip-hud bg-swu-surface px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-swu-muted">
                  Precio aproximado
                </span>
                <span className="text-xl font-black text-swu-green tabular-nums">
                  ≈ {formatPrice(precio.total)}
                </span>
              </div>
              <p className="mt-1 text-[10px] leading-tight text-swu-muted">
                Promedio de TCGplayer en dólares, mercado de EE.&nbsp;UU. Sirve para
                comparar mazos, no para poner precio de venta.
              </p>
              {(precio.copiasSinPrecio > 0 || precio.copiasFoilSinDato > 0 || precio.copiasHyperSiempreSinDato > 0) && (
                <ul className="mt-1.5 space-y-0.5 border-t border-swu-border pt-1.5">
                  {precio.copiasSinPrecio > 0 && (
                    <li className="text-[10px] text-swu-amber">
                      {precio.copiasSinPrecio} {precio.copiasSinPrecio === 1 ? 'copia' : 'copias'} sin
                      precio, fuera del total
                      {precio.sinPrecio.length > 0 && (
                        <span className="text-swu-muted"> · {precio.sinPrecio.slice(0, 3).join(', ')}
                          {precio.sinPrecio.length > 3 ? ` y ${precio.sinPrecio.length - 3} más` : ''}</span>
                      )}
                    </li>
                  )}
                  {precio.copiasFoilSinDato > 0 && (
                    <li className="text-[10px] text-swu-muted">
                      {precio.copiasFoilSinDato} {precio.copiasFoilSinDato === 1 ? 'copia foil' : 'copias foil'} sin
                      precio de foil: van con el de la normal.
                    </li>
                  )}
                  {/* Se dice aparte y con otras palabras porque la causa es
                      otra: medido, NINGUNA de las 662 cartas con desglose trae
                      precio de hyperspace. No es «esta carta no lo tiene». */}
                  {precio.copiasHyperSiempreSinDato > 0 && (
                    <li className="text-[10px] text-swu-muted">
                      {precio.copiasHyperSiempreSinDato} {precio.copiasHyperSiempreSinDato === 1 ? 'copia hyper' : 'copias hyper'}:
                      la fuente no publica precio de hyperspace para ninguna carta, así que van con el de la normal.
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}

          {/* ═══ MAZO PRINCIPAL — with thumbnails ═══ */}
          <div>
            <p className="text-xs font-bold text-swu-accent-texto mb-1.5">Mazo Principal ({mainCount}/{targetSize} mín.)</p>
            {deck.mainDeck.length === 0 ? (
              <p className="text-[10px] text-swu-muted bg-swu-surface rounded-lg p-3 border border-swu-border text-center">Vaya a "Buscar" para agregar cartas</p>
            ) : (
              <div className="space-y-1">{deck.mainDeck.map((c) => {
                const img = cardImages.get(c.cardId)
                return (
                  <div key={c.cardId} className="bg-swu-surface rounded-lg px-2 py-1.5 border border-swu-border flex items-center gap-2">
                    {/* Miniatura: toca para leer la carta. Antes solo había
                        + y −, o sea que se podía cambiar la cantidad pero no
                        revisar el efecto de lo que estabas metiendo. */}
                    <button
                      onClick={() => setVerCarta(c.cardId)}
                      aria-label={`Ver ${c.name} en grande`}
                      className="w-8 h-11 rounded bg-swu-bg flex-shrink-0 overflow-hidden active:scale-95 transition-transform"
                    >
                      {img ? (
                        <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen size={10} className="text-swu-muted/30" />
                        </div>
                      )}
                    </button>
                    {/* Quantity badge */}
                    <span className="w-6 h-6 rounded bg-swu-accent/20 text-swu-accent-texto text-xs font-bold flex items-center justify-center font-mono flex-shrink-0">{c.quantity}</span>
                    {/* Name + set */}
                    <button
                      onClick={() => setVerCarta(c.cardId)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <span className="text-sm text-swu-text truncate block">{c.name}</span>
                    </button>
                    <span className="flex flex-col items-end gap-px flex-shrink-0">
                      <span className="text-[9px] text-swu-muted font-mono">{c.setCode}</span>
                      <button
                        type="button"
                        onClick={() => setCopias({ cardId: c.cardId, lista: 'mainDeck' })}
                        aria-label={`Impresión de las ${c.quantity} copias de ${c.name}: ${resumenImpresiones(impresionesDe(c))}. Tocá para cambiarlas.`}
                        className="rounded px-1 py-px text-[9px] font-bold tracking-wide text-swu-muted uppercase hover:text-swu-text"
                      >
                        {resumenImpresiones(impresionesDe(c))}
                      </button>
                    </span>
                    {/* Controls */}
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => removeCard('mainDeck', c.cardId)} className="w-6 h-6 rounded bg-swu-red/10 text-swu-red-texto flex items-center justify-center"><Minus size={12} /></button>
                      <button onClick={() => incrementCard('mainDeck', c.cardId)} className="w-6 h-6 rounded bg-swu-green/10 text-swu-green flex items-center justify-center"><Plus size={12} /></button>
                    </div>
                  </div>
                )
              })}</div>
            )}
          </div>

          {/* ═══ SIDEBOARD — with thumbnails (hidden for formats without sideboard) ═══ */}
          {fmtRules.hasSideboard && <div>
            <p className="text-xs font-bold text-purple-400 mb-1.5">Sideboard ({sideCount}/{fmtRules.sideboard})</p>
            {deck.sideboard.length === 0 ? (
              <p className="text-[10px] text-swu-muted bg-swu-surface rounded-lg p-3 border border-swu-border text-center">Opcional</p>
            ) : (
              <div className="space-y-1">{deck.sideboard.map((c) => {
                const img = cardImages.get(c.cardId)
                return (
                  <div key={c.cardId} className="bg-swu-surface rounded-lg px-2 py-1.5 border border-swu-border flex items-center gap-2">
                    {/* Miniatura: toca para leer la carta. Antes solo había
                        + y −, o sea que se podía cambiar la cantidad pero no
                        revisar el efecto de lo que estabas metiendo. */}
                    <button
                      onClick={() => setVerCarta(c.cardId)}
                      aria-label={`Ver ${c.name} en grande`}
                      className="w-8 h-11 rounded bg-swu-bg flex-shrink-0 overflow-hidden active:scale-95 transition-transform"
                    >
                      {img ? (
                        <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen size={10} className="text-swu-muted/30" />
                        </div>
                      )}
                    </button>
                    {/* Quantity badge */}
                    <span className="w-6 h-6 rounded bg-purple-400/20 text-purple-400 text-xs font-bold flex items-center justify-center font-mono flex-shrink-0">{c.quantity}</span>
                    {/* Name + set */}
                    <button
                      onClick={() => setVerCarta(c.cardId)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <span className="text-sm text-swu-text truncate block">{c.name}</span>
                    </button>
                    <span className="flex flex-col items-end gap-px flex-shrink-0">
                      <span className="text-[9px] text-swu-muted font-mono">{c.setCode}</span>
                      <button
                        type="button"
                        onClick={() => setCopias({ cardId: c.cardId, lista: 'sideboard' })}
                        aria-label={`Impresión de las ${c.quantity} copias de ${c.name}: ${resumenImpresiones(impresionesDe(c))}. Tocá para cambiarlas.`}
                        className="rounded px-1 py-px text-[9px] font-bold tracking-wide text-swu-muted uppercase hover:text-swu-text"
                      >
                        {resumenImpresiones(impresionesDe(c))}
                      </button>
                    </span>
                    {/* Controls */}
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => removeCard('sideboard', c.cardId)} className="w-6 h-6 rounded bg-swu-red/10 text-swu-red-texto flex items-center justify-center"><Minus size={12} /></button>
                      <button onClick={() => incrementCard('sideboard', c.cardId)} className="w-6 h-6 rounded bg-swu-green/10 text-swu-green flex items-center justify-center"><Plus size={12} /></button>
                    </div>
                  </div>
                )
              })}</div>
            )}
          </div>}
        </div>
      )}

      {tab === 'search' && (
        <div className="space-y-3">
          {fmtRules.hasSideboard ? (
            <div className="flex gap-2">
              <button onClick={() => setAddTarget('mainDeck')} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${addTarget === 'mainDeck' ? 'bg-swu-accent/20 border-swu-accent text-swu-accent-texto' : 'bg-swu-surface border-swu-border text-swu-muted'}`}>Mazo ({mainCount})</button>
              <button onClick={() => setAddTarget('sideboard')} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${addTarget === 'sideboard' ? 'bg-purple-400/20 border-purple-400 text-purple-400' : 'bg-swu-surface border-swu-border text-swu-muted'}`}>Sideboard ({sideCount})</button>
            </div>
          ) : null}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por nombre..."
              className="w-full bg-swu-surface border border-swu-border rounded-xl py-3 pl-10 pr-3 text-sm text-swu-text outline-none focus:border-swu-accent" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-swu-muted"><X size={16} /></button>}
          </div>

          {/* Aspecto y coste: los dos ejes por los que uno busca una carta al
              armar un mazo. Esta pantalla no tenía NINGÚN filtro. */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1">
              {ASPECTOS.map(a => (
                <button
                  key={a}
                  onClick={() => setSearchAspect(searchAspect === a ? null : a)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition-colors ${
                    searchAspect === a
                      ? 'bg-swu-accent/20 border-swu-accent text-swu-accent-texto'
                      : 'bg-swu-surface border-swu-border text-swu-muted'
                  }`}
                >
                  {translateAspect(a)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 items-center">
              <span className="text-[10px] text-swu-muted mr-0.5">Coste</span>
              {BUILDER_COSTS.map(c => (
                <button
                  key={c}
                  onClick={() => setSearchCost(searchCost === c ? null : c)}
                  className={`rounded-lg w-7 py-1 text-[11px] font-semibold border transition-colors ${
                    searchCost === c
                      ? 'bg-swu-green/20 border-swu-green text-swu-green'
                      : 'bg-swu-surface border-swu-border text-swu-muted'
                  }`}
                >
                  {c >= COST_MAX_BUCKET ? `${COST_MAX_BUCKET}+` : c}
                </button>
              ))}
              {(searchAspect || searchCost !== null) && (
                <button
                  onClick={() => { setSearchAspect(null); setSearchCost(null) }}
                  className="text-[10px] text-swu-red-texto font-medium ml-1"
                >
                  Limpiar
                </button>
              )}
            </div>

            <FiltrosBusqueda
              valor={filtros}
              onCambio={setFiltros}
              aspectosDelMazo={aspectosDelMazo}
            />
          </div>

          {/* DB bootstrap progress — visible while the card database downloads */}
          {(dbProgress.phase === 'downloading' || dbProgress.phase === 'parsing' || dbProgress.phase === 'saving') && (
            <div className="bg-swu-accent/5 border border-swu-accent/30 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Loader2 size={13} className="text-swu-accent-texto animate-spin" />
                <p className="text-xs font-semibold text-swu-accent-texto">{dbProgress.message}</p>
              </div>
              {dbProgress.phase === 'saving' && dbProgress.saved && dbProgress.totalToSave && (
                <div className="h-1 bg-swu-bg rounded-full overflow-hidden">
                  <div className="h-full bg-swu-accent transition-all" style={{ width: `${(dbProgress.saved / dbProgress.totalToSave) * 100}%` }} />
                </div>
              )}
              <p className="text-[10px] text-swu-muted">Preparando la base de cartas — la búsqueda se habilita al terminar.</p>
            </div>
          )}
          {dbProgress.phase === 'error' && (
            <div className="bg-swu-red/10 border border-swu-red/30 rounded-lg p-2.5 flex items-center gap-2">
              <AlertTriangle size={13} className="text-swu-red-texto" />
              <p className="text-[11px] text-swu-red-texto">{dbProgress.message}</p>
            </div>
          )}
          {searching && <div className="flex items-center justify-center py-8"><Loader2 size={24} className="text-swu-accent-texto animate-spin" /></div>}
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
                    <CardImage src={listFaceUrl(card)} fit={listFaceFit(card)} alt={card.name} className="w-10 h-14" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-swu-text truncate">{card.name}</p>
                      <div className="flex gap-1 mt-0.5">
                        <span className="text-[9px] text-swu-muted">{translateType(card.type)}</span>
                        {card.cost !== null && <span className="text-[9px] text-swu-amber font-bold">⬡{card.cost}</span>}
                        {card.arena && <span className="text-[9px] text-swu-muted">· {card.arena}</span>}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {(inDeck || inSide) && <span className="text-[10px] text-swu-accent-texto font-bold">×{(inDeck?.quantity || 0) + (inSide?.quantity || 0)}</span>}
                      {isLeaderInDeck && <span className="text-[9px] text-swu-amber">Líder</span>}
                      {isBaseInDeck && <span className="text-[9px] text-swu-green">Base</span>}
                      {!isLeaderInDeck && !isBaseInDeck && <Plus size={16} className="text-swu-accent-texto" />}
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

      {/* Ver la carta en grande sin salir del mazo. */}
      <CardPreviewSheet cardId={verCarta} onClose={() => setVerCarta(null)} />

      {cartaEnCopias && (
        <CopiasDeCarta
          abierto
          alCerrar={() => setCopias(null)}
          nombre={cartaEnCopias.name}
          imagen={cardImages.get(cartaEnCopias.cardId)}
          impresiones={impresionesDe(cartaEnCopias)}
          alCambiar={(i, v) => cambiarImpresion(copias!.lista, cartaEnCopias.cardId, i, v)}
          alCambiarTodas={(v) => cambiarImpresion(copias!.lista, cartaEnCopias.cardId, 'todas', v)}
        />
      )}

    </div>
  )
}

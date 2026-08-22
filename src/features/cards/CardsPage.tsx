import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, SlidersHorizontal, X, Loader2, Plus, Minus,
  Download, RefreshCw, AlertTriangle, Database, Layers, Heart, Sparkles} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Chip, type ChipTone } from '../../components/ui/Chip'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { CardImage } from '../../components/CardImage'
import { irA, posicion } from '../../services/scrollApp'
import { VitrinaShowcase } from '../collection/VitrinaShowcase'
import { listFaceUrl, listFaceIsLandscape } from '../../services/cardArt'
import {
  searchCards, getSets, getLocalCardCount, loadFullDatabase, ensureFreshDatabase, collectionEntry,
  subscribeDbLoadProgress, MAIN_SET_MIN_CARDS, MAIN_SET_LABELS, COST_MAX_BUCKET, PLAYSET_SIZE,
  type SearchParams, type DbLoadProgress, type OwnedFilter,
} from '../../services/swuApi'
import { getPricesForCards, fetchTCGPrices, formatPrice, precioPromedio, type PriceInfo } from '../../services/pricing'
import { getMyCollection, updateCollectionQuantity } from '../../services/collectionService'
import { db } from '../../services/db'
import { useAuth } from '../../hooks/useAuth'
import { translateType, translateRarity, translateArena, translateAspect } from '../../services/translations'
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
const filterCosts = [0, 1, 2, 3, 4, 5, 6, COST_MAX_BUCKET]

const PAGE_SIZE = 30

const OWNED_LABELS: Record<OwnedFilter, string> = {
  all: 'Todas',
  owned: 'Tengo',
  missing: 'Me falta',
  duplicates: 'Repetidas',
}

/**
 * Instantánea del buscador, fuera del componente para que sobreviva a la
 * navegación. Volver del detalle borraba el texto, los filtros y el scroll:
 * revisar 5 cartas seguidas eran 5 búsquedas desde cero.
 */
interface SearchSnapshot {
  query: string
  selectedType: string | null
  selectedAspect: string | null
  selectedSet: string | null
  selectedArena: string | null
  selectedRarity: string | null
  selectedCost: number | null
  owned: OwnedFilter
  favoritesOnly: boolean
  allPrintings: boolean
  cards: Card[]
  total: number
  scrollY: number
  /** Cantidad de cartas en la base al guardar; si cambió, los resultados se descartan. */
  dbCount: number
  /**
   * De quién es esta instantánea. Vive a nivel de módulo, así que sobrevive a
   * un cambio de cuenta: sin este dueño, al entrar otro perfil se le mostraría
   * por un instante el resultado del filtro "Me falta" del perfil anterior.
   */
  profileId: string | null
}
let _snapshot: SearchSnapshot | null = null

/** Se llama antes de leer la instantánea: no es de este perfil, no sirve. */
function snapshotFor(profileId: string | null): SearchSnapshot | null {
  if (_snapshot && _snapshot.profileId !== profileId) _snapshot = null
  return _snapshot
}

/** Dos maneras de mirar la base: buscar algo concreto, o pasear la vitrina. */
function Pestanas(
  { vista, onCambiar }: { vista: 'buscar' | 'vitrina'; onCambiar: (v: 'buscar' | 'vitrina') => void },
) {
  return (
    <div className="flex bg-swu-surface rounded-lg p-0.5 border border-swu-border">
      {([['buscar', 'Buscar', Search], ['vitrina', 'Vitrina', Sparkles]] as const).map(([id, txt, Icon]) => (
        <button
          key={id}
          onClick={() => onCambiar(id)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[12px] font-semibold transition-colors ${
            vista === id ? 'bg-swu-accent/15 text-swu-accent-texto' : 'text-swu-muted'
          }`}
        >
          <Icon size={13} aria-hidden /> {txt}
        </button>
      ))}
    </div>
  )
}

export function CardsPage() {
  const [vista, setVista] = useState<'buscar' | 'vitrina'>('buscar')
  const navigate = useNavigate()
  const { supabaseUser, currentProfileId } = useAuth()

  // Se resuelve UNA vez, antes de sembrar el estado: descarta la instantánea
  // si es de otro perfil.
  const restored = useRef(snapshotFor(currentProfileId ?? null)).current

  const [query, setQuery] = useState(restored?.query ?? '')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedType, setSelectedType] = useState<string | null>(restored?.selectedType ?? null)
  const [selectedAspect, setSelectedAspect] = useState<string | null>(restored?.selectedAspect ?? null)
  const [selectedSet, setSelectedSet] = useState<string | null>(restored?.selectedSet ?? null)
  const [selectedArena, setSelectedArena] = useState<string | null>(restored?.selectedArena ?? null)
  const [selectedRarity, setSelectedRarity] = useState<string | null>(restored?.selectedRarity ?? null)
  const [selectedCost, setSelectedCost] = useState<number | null>(restored?.selectedCost ?? null)
  const [owned, setOwned] = useState<OwnedFilter>(restored?.owned ?? 'all')
  const [favoritesOnly, setFavoritesOnly] = useState(restored?.favoritesOnly ?? false)
  /** Apagado de fábrica: el 74% de las filas son variantes de la misma carta. */
  /**
   * «Todas las impresiones» viene ENCENDIDO por defecto.
   *
   * Apagado, Explorar mostraba solo la impresión canónica de cada carta:
   * 2.316 filas de 9.185. Las Hyperspace, las Showcase y las foil —que es
   * con lo que la gente de verdad abre sobres y arma binder— no aparecían
   * hasta marcar una casilla que estaba dentro del panel de filtros, o sea
   * escondida detrás de un toque que casi nadie daba.
   *
   * Medido: encendido son 9.185 filas, **3,97× más**. Ese es el costo, y
   * está aceptado a propósito. Entran también ~400 promos de torneo (GC Top
   * 64, SQ Prize Wall y demás) que casi nadie tiene; si algún día molestan,
   * lo que hay que filtrar son esas variantes, no volver a esconder las
   * Hyperspace.
   *
   * La instantánea sigue mandando: quien lo apague durante la sesión, lo
   * mantiene apagado mientras navega. Solo cambia con qué arranca.
   */
  const [allPrintings, setAllPrintings] = useState(restored?.allPrintings ?? true)

  const [cards, setCards] = useState<Card[]>(restored?.cards ?? [])
  const [total, setTotal] = useState(restored?.total ?? 0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sets, setSets] = useState<SetInfo[]>([])
  const [hasSearched, setHasSearched] = useState(!!restored)
  const [localCount, setLocalCount] = useState(0)
  const [prices, setPrices] = useState<Map<string, PriceInfo>>(new Map())
  const [pricesLoading, setPricesLoading] = useState(false)
  const priceFetchRef = useRef(0)

  /** Toda la colección en memoria: el cruce "me falta" necesita el set completo. */
  const [collectionQtys, setCollectionQtys] = useState<Map<string, number>>(new Map())
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  /**
   * Pasa a `true` cuando la colección terminó de leerse, y ya no vuelve atrás.
   * Es lo que deja que «Me falta» espere el dato UNA vez sin re-buscar después
   * con cada carta que agregás. Ver `ownedDepKey`.
   */
  const [coleccionLista, setColeccionLista] = useState(false)
  /**
   * La colección tal como estaba cuando se armó la lista que estás viendo.
   * No es estado: cambiarla no debe repintar nada — solo la usa `doSearch`
   * para que la paginación sea coherente consigo misma.
   */
  const criterioColeccionRef = useRef<Map<string, number>>(new Map())

  const [dbProgress, setDbProgress] = useState<DbLoadProgress>({ phase: 'idle', message: '' })

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Solo el texto tecleado espera 300ms; tocar un chip responde al instante. */
  const skipDebounceRef = useRef(false)
  /**
   * Se consume UNA sola vez, dentro del propio efecto de búsqueda. Tenerlo en
   * un ref aparte del scroll es necesario: los efectos corren en orden de
   * declaración, así que si el de scroll lo apagara, el de búsqueda ya lo
   * vería en falso y re-buscaría, tirando abajo lo que acabábamos de restaurar.
   */
  const skipFirstSearchRef = useRef(!!restored)
  const pendingScrollRef = useRef<number | null>(restored?.scrollY ?? null)

  useEffect(() => {
    const unsub = subscribeDbLoadProgress(setDbProgress)
    return () => unsub()
  }, [])

  useEffect(() => {
    getSets().then(setSets).catch(() => {})
    getLocalCardCount().then(setLocalCount).catch(() => {})
    ensureFreshDatabase().then(setLocalCount).catch(() => {})
  }, [])

  useEffect(() => {
    if (dbProgress.phase === 'done' && typeof dbProgress.finalCount === 'number') {
      setLocalCount(dbProgress.finalCount)
    }
  }, [dbProgress])

  // Colección completa + favoritos. Antes se pedía la cantidad carta por carta
  // (30 consultas a Dexie por búsqueda); una sola lectura alcanza.
  const reloadCollection = useCallback(async () => {
    try {
      const items = await getMyCollection(currentProfileId ?? undefined)
      setCollectionQtys(new Map(items.map(i => [i.cardId, i.quantity])))
    } catch { /* colección vacía */ }
    try {
      const favs = await db.favoriteCards.toArray()
      setFavoriteIds(new Set(favs.map(f => f.cardId)))
    } catch { /* sin favoritos */ }
    // Se marca en cualquier caso, incluso si falló: «no tengo nada» también es
    // una respuesta, y dejarlo en false colgaría la primera búsqueda de
    // «Me falta» esperando un dato que no va a llegar.
    setColeccionLista(true)
  }, [currentProfileId])

  useEffect(() => { reloadCollection() }, [reloadCollection])

  // Restaurar el scroll una vez que las filas recuperadas están pintadas.
  useEffect(() => {
    const y = pendingScrollRef.current
    if (y === null) return
    pendingScrollRef.current = null
    requestAnimationFrame(() => irA(y))
  }, [])

  // Si la base de cartas cambió desde que se guardó la instantánea, los
  // resultados guardados ya no son de fiar: se descartan y se busca de nuevo.
  // Los filtros SÍ se conservan — eso es lo que costaba volver a tipear.
  useEffect(() => {
    if (!_snapshot || localCount === 0) return
    if (_snapshot.dbCount !== localCount) {
      _snapshot = null
      skipFirstSearchRef.current = false
      pendingScrollRef.current = null
      doSearch(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localCount])

  const doSearch = useCallback(
    async (reset = true) => {
      // El criterio de pertenencia se CONGELA al empezar una búsqueda y no se
      // vuelve a tocar hasta la siguiente. Dos razones, las dos medidas:
      //
      // 1. Con «Me falta» puesto, agregar una carta cambiaba `collectionQtys`,
      //    eso re-buscaba desde cero y las 120 filas cargadas volvían a 30.
      //    Había que bajar y pulsar «Cargar más» cuatro veces para volver a
      //    donde estabas — por cada carta que agregabas.
      // 2. Y aunque no se reseteara, la paginación quedaría MAL: el servicio
      //    filtra por pertenencia sobre todo el conjunto y recién después
      //    pagina, así que si la colección cambia entre página y página, un
      //    `offset` de 120 apunta a otra fila y se salta o repite cartas.
      //
      // Los resultados son la foto de un instante; tus ediciones se ven en la
      // fila (el contador es estado aparte y sigue vivo) pero no mueven el
      // conjunto bajo el dedo.
      if (reset) criterioColeccionRef.current = collectionQtys

      const params: SearchParams = {
        query: query || undefined,
        type: selectedType || undefined,
        aspect: selectedAspect || undefined,
        set: selectedSet || undefined,
        arena: selectedArena || undefined,
        rarity: selectedRarity || undefined,
        cost: selectedCost,
        canonicalOnly: !allPrintings,
        owned,
        ownedQuantities: criterioColeccionRef.current,
        // Va al servicio, NO se recorta acá: filtrando después de paginar,
        // "Mis favoritas" solo miraba las 30 filas de la primera página.
        favoriteIds: favoritesOnly ? favoriteIds : undefined,
        offset: reset ? 0 : cards.length,
        limit: PAGE_SIZE,
      }

      if (reset) setLoading(true)
      else setLoadingMore(true)

      try {
        const result = await searchCards(params)
        if (reset) setCards(result.cards)
        else setCards(prev => [...prev, ...result.cards])
        setTotal(result.total)
        setHasSearched(true)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    // `collectionQtys` NO va acá: se lee por ref y solo en un reset. Estando en
    // las deps, cada carta agregada recreaba `doSearch` y con él el efecto de
    // búsqueda — que es justo el ciclo que reseteaba la lista.
    [query, selectedType, selectedAspect, selectedSet, selectedArena, selectedRarity,
     selectedCost, allPrintings, owned, favoritesOnly, favoriteIds, cards.length],
  )

  // `refreshDb` tiene que ser estable (lo usan botones que no deben recrearse),
  // pero con deps [] capturaba el `doSearch` del PRIMER render: al reintentar
  // una descarga fallida se re-buscaba con los filtros iniciales en vez de con
  // los que el usuario tiene puestos. El ref siempre apunta al último.
  const doSearchRef = useRef(doSearch)
  useEffect(() => { doSearchRef.current = doSearch })

  const refreshDb = useCallback(async () => {
    const n = await loadFullDatabase({ force: true })
    setLocalCount(n)
    doSearchRef.current(true)
  }, [])

  // Precios de las cartas visibles
  useEffect(() => {
    if (cards.length === 0) return
    const fetchId = ++priceFetchRef.current

    const loadPrices = async () => {
      const cardIds = cards.map(c => c.id)
      const cached = await getPricesForCards(cardIds)
      if (fetchId !== priceFetchRef.current) return
      setPrices(prev => {
        const next = new Map(prev)
        cached.forEach((v, k) => next.set(k, v))
        return next
      })

      const missing = cards.filter(c => !cached.has(c.id))
      if (missing.length > 0) {
        setPricesLoading(true)
        try {
          await fetchTCGPrices(
            missing.map(c => ({ id: c.id, name: c.name, subtitle: c.subtitle || null, setCode: c.setCode, setNumber: c.setNumber }))
          )
          if (fetchId !== priceFetchRef.current) return
          const updated = await getPricesForCards(cardIds)
          if (fetchId !== priceFetchRef.current) return
          setPrices(prev => {
            const next = new Map(prev)
            updated.forEach((v, k) => next.set(k, v))
            return next
          })
        } catch { /* los precios son opcionales */ }
        if (fetchId === priceFetchRef.current) setPricesLoading(false)
      }
    }

    loadPrices()
  }, [cards])

  /**
   * Suma o resta copias. Escribe SOBRE LA CLAVE que ya existe en la colección
   * (uuid o id heredado): usando siempre el uuid, una carta guardada como
   * `SOR_001` terminaba duplicada bajo dos claves distintas.
   */
  const handleCollectionChange = async (card: Card, delta: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const { qty, key } = collectionEntry(card, collectionQtys)
    const newQty = Math.max(0, qty + delta)
    setCollectionQtys(prev => {
      const next = new Map(prev)
      if (newQty > 0) next.set(key, newQty)
      else next.delete(key)
      return next
    })
    await updateCollectionQuantity(key, newQty, currentProfileId ?? undefined, supabaseUser?.id)
  }

  /** Botón ×3: completar el playset de una carta en un solo toque. */
  const handleSetPlayset = async (card: Card, e: React.MouseEvent) => {
    e.stopPropagation()
    const { key } = collectionEntry(card, collectionQtys)
    setCollectionQtys(prev => new Map(prev).set(key, PLAYSET_SIZE))
    await updateCollectionQuantity(key, PLAYSET_SIZE, currentProfileId ?? undefined, supabaseUser?.id)
  }

  /**
   * La colección dispara UNA búsqueda: la del momento en que termina de
   * cargarse. Ni una más.
   *
   * Antes acá iba `collectionQtys.size`, y eso hacía dos cosas a la vez. La
   * buena: con «Me falta» puesto, esperar a que la colección llegue antes de
   * decidir qué falta (sin eso, al montar se listan las 2.316 cartas como si
   * no tuvieras ninguna). La mala: CADA carta que agregabas cambiaba el
   * tamaño y volvía a buscar desde cero.
   *
   * `coleccionLista` separa las dos: es un booleano que pasa de false a true
   * una sola vez, así que la primera búsqueda espera el dato y las ediciones
   * posteriores no mueven nada.
   */
  const ownedDepKey = owned === 'all' ? '' : `${owned}:${coleccionLista}`

  // Búsqueda con retardo SOLO para lo que se teclea.
  useEffect(() => {
    if (skipFirstSearchRef.current) {
      skipFirstSearchRef.current = false
      return // los resultados vienen de la instantánea
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const delay = skipDebounceRef.current ? 0 : 300
    skipDebounceRef.current = false
    debounceRef.current = setTimeout(() => doSearch(true), delay)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectedType, selectedAspect, selectedSet, selectedArena, selectedRarity,
      selectedCost, allPrintings, favoritesOnly, ownedDepKey])

  // Valores vivos para la instantánea. Este efecto corre en cada render pero
  // SOLO escribe un ref — no toca `_snapshot`.
  //
  // Antes el cleanup de un efecto sin array de deps escribía la instantánea
  // en CADA commit, no solo al desmontar. Como el primer commit ocurre antes
  // de que `localCount` se cargue, la instantánea nacía con `dbCount: 0`, el
  // efecto de invalidación la veía distinta del conteo real y la anulaba —
  // así que restaurar al volver no funcionaba nunca.
  const liveRef = useRef<SearchSnapshot | null>(null)
  liveRef.current = {
    query, selectedType, selectedAspect, selectedSet, selectedArena,
    selectedRarity, selectedCost, owned, favoritesOnly, allPrintings,
    cards, total, scrollY: 0, dbCount: localCount,
    profileId: currentProfileId ?? null,
  }

  // Guardar UNA sola vez, al desmontar de verdad.
  useEffect(() => {
    return () => {
      if (liveRef.current) {
        _snapshot = { ...liveRef.current, scrollY: posicion() }
      }
    }
  }, [])

  const setChip = <T,>(setter: (v: T) => void, value: T) => {
    skipDebounceRef.current = true
    setter(value)
  }
  const toggleFilter = (current: string | null, value: string, setter: (v: string | null) => void) => {
    setChip(setter, current === value ? null : value)
  }

  const clearFilters = () => {
    skipDebounceRef.current = true
    setSelectedType(null)
    setSelectedAspect(null)
    setSelectedSet(null)
    setSelectedArena(null)
    setSelectedRarity(null)
    setSelectedCost(null)
    setOwned('all')
    setFavoritesOnly(false)
  }

  /**
   * Chips activos, en español y con X. Antes los filtros vivían escondidos
   * dentro del panel: no se veía qué estaba aplicado sin abrirlo.
   */
  const activeChips = useMemo(() => {
    // El `tone` sigue la semántica del sistema: ámbar = progreso/pertenencia,
    // coral = buscadas, cian = exploración.
    const chips: { key: string; label: string; tone: ChipTone; clear: () => void }[] = []
    if (selectedType) chips.push({ key: 'type', label: translateType(selectedType), tone: 'neutral', clear: () => setChip(setSelectedType, null) })
    if (selectedAspect) chips.push({ key: 'aspect', label: translateAspect(selectedAspect), tone: 'neutral', clear: () => setChip(setSelectedAspect, null) })
    if (selectedCost !== null) chips.push({
      key: 'cost',
      label: selectedCost >= COST_MAX_BUCKET ? `Coste ${COST_MAX_BUCKET}+` : `Coste ${selectedCost}`,
      tone: 'neutral',
      clear: () => setChip(setSelectedCost, null),
    })
    if (selectedSet) chips.push({ key: 'set', label: selectedSet, tone: 'amber', clear: () => setChip(setSelectedSet, null) })
    if (selectedArena) chips.push({ key: 'arena', label: translateArena(selectedArena), tone: 'neutral', clear: () => setChip(setSelectedArena, null) })
    if (selectedRarity) chips.push({ key: 'rarity', label: translateRarity(selectedRarity), tone: 'neutral', clear: () => setChip(setSelectedRarity, null) })
    if (owned !== 'all') chips.push({
      key: 'owned',
      label: OWNED_LABELS[owned],
      tone: owned === 'missing' ? 'coral' : 'amber',
      clear: () => setChip(setOwned, 'all' as OwnedFilter),
    })
    if (favoritesOnly) chips.push({ key: 'fav', label: 'Favoritas', tone: 'coral', clear: () => setChip(setFavoritesOnly, false) })
    if (allPrintings) chips.push({ key: 'printings', label: 'Todas las impresiones', tone: 'cyan', clear: () => setChip(setAllPrintings, false) })
    return chips
  }, [selectedType, selectedAspect, selectedCost, selectedSet, selectedArena,
      selectedRarity, owned, favoritesOnly, allPrintings])

  /**
   * Los chips de set son los COLECCIONABLES, no los grandes.
   *
   * Estaban filtrados por `cardCount >= 500`, y eso dejaba fuera de Explorar
   * al set de Twin Suns: 88 cartas —con 8 líderes y 4 bases propios— que
   * estaban descargadas en la base local y no se podían filtrar por set desde
   * ninguna pantalla. Solo aparecían escribiendo el nombre exacto.
   */
  const setsFiltrables = sets.filter((s) => s.code in MAIN_SET_LABELS)
  /** La expansión más nueva, para las lanzaderas. Acá el tamaño SÍ importa:
   *  un set suplementario de 88 cartas no es «lo último que salió». */
  const mainSets = sets.filter((s) => s.cardCount >= MAIN_SET_MIN_CARDS)
  const newestSet = mainSets.length > 0 ? mainSets[mainSets.length - 1].code : null

  /** Atajos que además ENSEÑAN el sistema de filtros: dejan los chips a la vista. */
  const launchers = useMemo(() => {
    const l: { label: string; run: () => void }[] = []
    if (newestSet) {
      l.push({
        label: `Líderes de ${newestSet}`,
        run: () => { skipDebounceRef.current = true; clearFilters(); setSelectedSet(newestSet); setSelectedType('Leader') },
      })
      l.push({
        label: `${newestSet} completo`,
        run: () => { skipDebounceRef.current = true; clearFilters(); setSelectedSet(newestSet) },
      })
    }
    if (favoriteIds.size > 0) {
      l.push({
        label: `Mis favoritas (${favoriteIds.size})`,
        run: () => { skipDebounceRef.current = true; clearFilters(); setFavoritesOnly(true) },
      })
    }
    if (collectionQtys.size > 0 && newestSet) {
      l.push({
        label: `Me falta de ${newestSet}`,
        run: () => { skipDebounceRef.current = true; clearFilters(); setSelectedSet(newestSet); setOwned('missing') },
      })
    }
    return l
  }, [newestSet, favoriteIds.size, collectionQtys.size])

  const chipClass = (active: boolean, tone: 'accent' | 'amber' | 'green' | 'purple' = 'accent') => {
    const tones = {
      accent: 'bg-swu-accent/20 border-swu-accent text-swu-accent-texto',
      amber: 'bg-swu-amber/20 border-swu-amber text-swu-amber',
      green: 'bg-swu-green/20 border-swu-green text-swu-green',
      purple: 'bg-purple-400/20 border-purple-400 text-purple-400',
    }
    return `rounded-lg px-3 py-1 text-xs font-semibold border transition-colors ${
      active ? tones[tone] : 'bg-swu-bg border-swu-border text-swu-muted'
    }`
  }

  // La vitrina es para MIRAR cartas, no para comerciarlas: vive acá, en el
  // buscador, y no en Contrabando, que es el mercado.
  if (vista === 'vitrina') {
    return (
      <div className="p-4 lg:p-6 space-y-3 pb-8 max-w-5xl mx-auto">
        <Pestanas vista={vista} onCambiar={setVista} />
        <VitrinaShowcase />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-3 pb-8 lg:pb-8 max-w-5xl mx-auto">
      <Pestanas vista={vista} onCambiar={setVista} />

      {/* Search */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={localCount > 0 ? `Buscar en ${localCount.toLocaleString()} cartas...` : 'Descargando cartas...'}
            className="w-full bg-swu-surface border border-swu-border rounded-xl py-3 pl-10 pr-9 text-sm text-swu-text outline-none focus:border-swu-accent transition-colors"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-swu-muted">
              <X size={16} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 rounded-xl border text-sm font-semibold transition-colors relative ${
            showFilters ? 'bg-swu-accent/15 border-swu-accent text-swu-accent-texto' : 'bg-swu-surface border-swu-border text-swu-muted'
          }`}
        >
          <SlidersHorizontal size={18} />
          {activeChips.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-swu-accent text-white text-[10px] font-bold flex items-center justify-center">
              {activeChips.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Chips activos: siempre a la vista, con X, sin abrir el panel ── */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          {activeChips.map(c => (
            <Chip
              key={c.key}
              tone={c.tone}
              active
              onRemove={c.clear}
              removeLabel={`Quitar filtro ${c.label}`}
            >
              {c.label}
            </Chip>
          ))}
          <Button variant="ghost" size="xs" onClick={clearFilters} className="text-swu-red-texto">
            Limpiar
          </Button>
        </div>
      )}

      {/* ── Lanzaderas: solo cuando no hay nada aplicado ── */}
      {activeChips.length === 0 && !query && launchers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {launchers.map(l => (
            <button
              key={l.label}
              onClick={l.run}
              className="px-3 py-1.5 rounded-full bg-swu-surface border border-swu-border text-swu-muted
                         text-[11px] font-semibold active:scale-95 transition-transform hover:text-swu-accent-texto hover:border-swu-accent/40"
            >
              {l.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Cruce con la colección ── */}
      {collectionQtys.size > 0 && (
        <SegmentedControl
          label="Filtrar por lo que tengo"
          value={owned}
          onChange={(v) => setChip(setOwned, v)}
          options={(['all', 'owned', 'missing', 'duplicates'] as OwnedFilter[])
            .map(f => ({ value: f, label: OWNED_LABELS[f] }))}
        />
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-swu-surface rounded-xl p-3 border border-swu-border space-y-3">
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Tipo</p>
            <div className="flex flex-wrap gap-1.5">
              {filterTypes.map((t) => (
                <button key={t} onClick={() => toggleFilter(selectedType, t, setSelectedType)} className={chipClass(selectedType === t)}>
                  {translateType(t)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-swu-muted mb-1.5">Aspecto</p>
            <div className="flex flex-wrap gap-1.5">
              {filterAspects.map((a) => (
                <button key={a} onClick={() => toggleFilter(selectedAspect, a, setSelectedAspect)} className={chipClass(selectedAspect === a)}>
                  {translateAspect(a)}
                </button>
              ))}
            </div>
          </div>

          {/* Coste — el motor local siempre lo resolvió; el API lo ignoraba */}
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Coste</p>
            <div className="flex flex-wrap gap-1.5">
              {filterCosts.map((c) => (
                <button
                  key={c}
                  onClick={() => setChip(setSelectedCost, selectedCost === c ? null : c)}
                  className={chipClass(selectedCost === c, 'green')}
                >
                  {c >= COST_MAX_BUCKET ? `${COST_MAX_BUCKET}+` : c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-swu-muted mb-1.5">Set</p>
            <div className="flex flex-wrap gap-1.5">
              {setsFiltrables.map((s) => (
                <button key={s.code} onClick={() => toggleFilter(selectedSet, s.code, setSelectedSet)} title={s.name} className={chipClass(selectedSet === s.code, 'amber')}>
                  {s.code}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-swu-muted mb-1.5">Arena</p>
            <div className="flex flex-wrap gap-1.5">
              {filterArenas.map((a) => (
                <button key={a} onClick={() => toggleFilter(selectedArena, a, setSelectedArena)} className={chipClass(selectedArena === a, 'green')}>
                  {translateArena(a)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-swu-muted mb-1.5">Rareza</p>
            <div className="flex flex-wrap gap-1.5">
              {filterRarities.map((r) => (
                <button key={r} onClick={() => toggleFilter(selectedRarity, r, setSelectedRarity)} className={chipClass(selectedRarity === r, 'purple')}>
                  {translateRarity(r)}
                </button>
              ))}
            </div>
          </div>

          {/* Impresiones alternativas */}
          <div className="pt-2 border-t border-swu-border/50">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allPrintings}
                onChange={(e) => setChip(setAllPrintings, e.target.checked)}
                className="mt-0.5 accent-swu-accent"
              />
              <span className="flex-1">
                <span className="text-xs text-swu-text font-medium flex items-center gap-1">
                  <Layers size={12} /> Mostrar todas las impresiones
                </span>
                <span className="text-[10px] text-swu-muted block leading-snug">
                  Hyperspace, foils, showcase y promos. Son la misma carta con otro arte
                  y muchas traen el texto de reglas recortado.
                </span>
              </span>
            </label>
          </div>
        </div>
      )}

      {/* ── DB load status banner ── */}
      {(dbProgress.phase === 'downloading' || dbProgress.phase === 'parsing' || dbProgress.phase === 'saving') && (
        <div className="bg-swu-accent/5 border border-swu-accent/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="text-swu-accent-texto animate-spin" />
            <p className="text-xs font-semibold text-swu-accent-texto">{dbProgress.message}</p>
          </div>
          {dbProgress.phase === 'saving' && dbProgress.saved && dbProgress.totalToSave && (
            <div className="h-1 bg-swu-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-swu-accent transition-all"
                style={{ width: `${(dbProgress.saved / dbProgress.totalToSave) * 100}%` }}
              />
            </div>
          )}
          {dbProgress.phase === 'downloading' && (
            <p className="text-[10px] text-swu-muted">
              Esto se hace UNA sola vez · ~5 MB · queda guardado para uso offline.
            </p>
          )}
        </div>
      )}

      {dbProgress.phase === 'error' && (
        <div className="bg-swu-red/10 border border-swu-red/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-swu-red-texto" />
            <p className="text-xs font-semibold text-swu-red-texto">{dbProgress.message}</p>
          </div>
          {dbProgress.error && (
            <p className="text-[10px] text-swu-muted font-mono">{dbProgress.error}</p>
          )}
          <button onClick={refreshDb} className="text-[11px] text-swu-accent-texto font-semibold flex items-center gap-1">
            <RefreshCw size={11} /> Reintentar
          </button>
        </div>
      )}

      {/* ── Cache count + manual refresh ── */}
      <div className="flex items-center justify-between bg-swu-surface/40 rounded-lg px-3 py-1.5 border border-swu-border/40">
        <div className="flex items-center gap-2 text-[11px] text-swu-muted">
          <Database size={11} />
          <span>
            {localCount > 0
              ? <>Caché: <span className="font-mono text-swu-text">{localCount.toLocaleString()}</span> cartas</>
              : <>Sin cartas locales</>}
          </span>
        </div>
        <button
          onClick={refreshDb}
          disabled={dbProgress.phase === 'downloading' || dbProgress.phase === 'saving' || dbProgress.phase === 'parsing'}
          className="text-[11px] text-swu-accent-texto flex items-center gap-1 disabled:opacity-40"
          title="Re-descarga la base completa de cartas"
        >
          <Download size={11} /> Actualizar
        </button>
      </div>

      {hasSearched && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-swu-muted">
            {total.toLocaleString()} carta{total === 1 ? '' : 's'}
            {!allPrintings && total > 0 && <span className="text-swu-muted/60"> · impresión normal</span>}
          </p>
          {pricesLoading && (
            <span className="text-[10px] text-swu-green flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" /> precios...
            </span>
          )}
        </div>
      )}

      {/* La lista NO se desmonta al buscar: se atenúa. Vaciarla hacía saltar
          la pantalla en cada tecla. */}
      <div className={loading ? 'opacity-40 pointer-events-none transition-opacity' : 'transition-opacity'}>
        {loading && cards.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={28} className="text-swu-accent-texto animate-spin" />
          </div>
        )}

        <div className="space-y-1.5 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
          {cards.map((c) => {
            const { qty } = collectionEntry(c, collectionQtys)
            // Con un filtro de pertenencia puesto, la lista ya NO se rehace al
            // editar la colección (perdías las 120 filas y el scroll por cada
            // carta). El precio de esa estabilidad es que la carta que acabás
            // de resolver se queda en su sitio hasta la próxima búsqueda: se
            // atenúa para que se lea de un vistazo, en vez de desaparecer y
            // hacer saltar la lista bajo el dedo.
            const resuelta =
              (owned === 'missing' && qty > 0) ||
              (owned === 'owned' && qty === 0) ||
              (owned === 'duplicates' && qty <= PLAYSET_SIZE)
            return (
              // Contenedor con rol de botón y no un <button>: adentro van los
              // controles +/- y ×3, y un <button> dentro de otro es HTML
              // inválido (la consola lo venía reportando en cada fila).
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/cards/${c.id}`)}
                // Solo cuando la tecla ocurre sobre la fila misma: los +/-/×3
                // anidados son <button> nativos y sus eventos burbujean hasta
                // acá, así que sin esta guarda Enter sobre "+" navegaba al
                // detalle en vez de sumar la carta.
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/cards/${c.id}`)
                  }
                }}
                className={`w-full bg-swu-surface rounded-xl p-3 border border-swu-border flex items-center gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform ${
                  resuelta ? 'opacity-50' : ''
                }`}
              >
                {/* La caja toma la forma de la carta. Con `w-14 h-20` fijo, una base
                    apaisada se dibujaba a 56x40 dentro de 56x80: la mitad de área
                    que la unidad de la fila de al lado, hundida entre dos bandas
                    oscuras. Filtrando por tipo «Base» la lista entera se veía así. */}
                <CardImage
                  src={listFaceUrl(c)}
                  orientacion={listFaceIsLandscape(c) ? 'apaisada' : 'vertical'}
                  fit="cover"
                  alt={c.name}
                  className={listFaceIsLandscape(c) ? 'w-20 aspect-[400/286]' : 'w-14 aspect-[286/400]'}
                />
                <div className="flex-1 min-w-0">
                  {/* Nombre y subtítulo apilados: en una sola línea, con la
                      miniatura más grande, el nombre se cortaba a la mitad
                      ("The Armo…") en cualquier teléfono. */}
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-swu-text truncate leading-tight">{c.name}</div>
                    {c.subtitle && (
                      <div className="text-[11px] text-swu-muted truncate leading-tight">{c.subtitle}</div>
                    )}
                  </div>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
                    <Badge variant={typeVariant[c.type] || 'default'}>{translateType(c.type)}</Badge>
                    <Badge variant={rarityVariant[c.rarity] || 'default'}>{translateRarity(c.rarity)}</Badge>
                    {c.arena && <Badge>{translateArena(c.arena)}</Badge>}
                    <span className="text-[9px] text-swu-muted">{c.setCode} #{c.setNumber}</span>
                    {/* Se dice qué impresión es cuando NO es la normal, para
                        saber qué estás tocando. Antes nunca se dibujaba. */}
                    {c.variantType && c.variantType !== 'Standard' && (
                      <span className="text-[9px] font-bold text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded">
                        {c.variantType}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    {c.cost !== null && <p className="text-xl font-extrabold text-swu-amber font-mono">{c.cost}</p>}
                    {c.power !== null && c.hp !== null && (
                      <p className="text-xs text-swu-muted">{c.power}/{c.hp}</p>
                    )}
                    {(() => {
                      const prom = precioPromedio(prices.get(c.id))
                      return prom != null && prom > 0 ? (
                        <p className="text-[11px] font-bold text-swu-green mt-0.5">{formatPrice(prom)}</p>
                      ) : null
                    })()}
                  </div>
                  {/* Collection +/- */}
                  <div className="flex flex-col items-center gap-0.5" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleCollectionChange(c, 1, e)}
                      className="w-7 h-7 rounded-lg bg-swu-accent/15 border border-swu-accent/30 text-swu-accent-texto flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Plus size={12} />
                    </button>
                    <span className={`text-[10px] font-bold font-mono ${qty > 0 ? 'text-swu-accent-texto' : 'text-swu-muted/40'}`}>
                      {qty}
                    </span>
                    {qty > 0 ? (
                      <button
                        onClick={(e) => handleCollectionChange(c, -1, e)}
                        className="w-7 h-7 rounded-lg bg-swu-red/15 border border-swu-red/30 text-swu-red-texto flex items-center justify-center active:scale-90 transition-transform"
                      >
                        <Minus size={12} />
                      </button>
                    ) : (
                      // Completar el playset en un toque: cargar 3 copias eran
                      // 3 toques y 3 viajes al servidor.
                      <button
                        onClick={(e) => handleSetPlayset(c, e)}
                        title="Agregar 3 copias"
                        className="w-7 h-7 rounded-lg bg-swu-bg border border-swu-border text-swu-muted text-[10px] font-bold flex items-center justify-center active:scale-90 transition-transform"
                      >
                        ×3
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {!loading && cards.length > 0 && cards.length < total && (
        <button
          onClick={() => doSearch(false)}
          disabled={loadingMore}
          className="w-full py-3 rounded-xl bg-swu-surface border border-swu-border text-swu-accent-texto font-bold text-sm flex items-center justify-center gap-2"
        >
          {loadingMore ? <Loader2 size={16} className="animate-spin" /> : `Cargar más (${cards.length}/${total.toLocaleString()})`}
        </button>
      )}

      {!loading && hasSearched && cards.length === 0 && (
        <div className="text-center py-12">
          <Search size={36} className="mx-auto text-swu-muted/40 mb-3" />
          <p className="text-sm text-swu-muted">No se encontraron cartas</p>
          {localCount === 0 ? (
            <>
              <p className="text-xs text-swu-muted mt-1">
                Tu caché local está vacía. Descarga la base de cartas:
              </p>
              <button
                onClick={refreshDb}
                disabled={dbProgress.phase === 'downloading' || dbProgress.phase === 'saving'}
                className="mt-3 px-4 py-2 rounded-lg bg-swu-accent text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Download size={12} /> Descargar base de cartas
              </button>
            </>
          ) : activeChips.length > 0 ? (
            <>
              <p className="text-xs text-swu-muted mt-1">Ningún resultado con estos filtros</p>
              <button onClick={clearFilters} className="mt-3 text-xs text-swu-accent-texto font-semibold">
                Limpiar filtros
              </button>
            </>
          ) : (
            <p className="text-xs text-swu-muted mt-1">Probá con otro nombre</p>
          )}
        </div>
      )}

      {favoritesOnly && favoriteIds.size === 0 && (
        <div className="text-center py-6">
          <Heart size={28} className="mx-auto text-swu-muted/40 mb-2" />
          <p className="text-xs text-swu-muted">
            Todavía no marcaste ninguna favorita. Tocá el corazón en cualquier carta.
          </p>
        </div>
      )}
    </div>
  )
}

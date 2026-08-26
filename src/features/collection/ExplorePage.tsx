/**
 * Contrabando — explorar colecciones + mercancía (cartas en venta) de otros jugadores.
 *
 * 2 tabs:
 *  - Colecciones: lista de jugadores con sus colecciones públicas (flujo anterior)
 *  - Mercancía: feed global de cartas marcadas en venta (con vendedor + precio + notas)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Search, Users, Skull, Package, Eye, EyeOff, Tag,
  ShoppingBag, Loader2, RefreshCw, MessageCircle, Pencil, SlidersHorizontal, ShoppingCart, Heart } from 'lucide-react'
import {
  searchPublicProfiles,
  getExploreProfiles,
  getMarketplaceListings,
  type PublicProfile,
  type MarketplaceListing,
  markCardForSale,
  unmarkCardForSale,
} from '../../services/collectionService'
import { getCardsByIds } from '../../services/swuApi'
import { SaleModal } from './SaleModal'
import {
  getTradeMatches, getMyWishlist, addToWishlist, removeFromWishlist,
  type TradeMatch,
} from '../../services/tradeService'
import { CardImage } from '../../components/CardImage'
import { Carta3D } from '../../components/Carta3D'
import { listFaceUrl, listFaceIsLandscape } from '../../services/cardArt'
import { TradeMatches } from './TradeMatches'
import { useAuth } from '../../hooks/useAuth'
import {
  reservasDelMercado, claveReserva, agregarAlCarrito, misPedidos, pedidosPendientes,
  type Pedido,
} from '../../services/mercadoPedidos'
import { CarritoFlotante } from '../mercado/CarritoFlotante'
import { db } from '../../services/db'
import type { Card } from '../../types'
import { Avatar } from '../../components/ui/Avatar'
import { Chip } from '../../components/ui/Chip'
import {
  TIPOS_CARTA, ASPECTOS, TONO_CHIP_POR_TIPO, pasaFiltros, hayFiltrosPuestos,
} from '../../services/filtrosCarta'
import { translateType, translateAspect } from '../../services/translations'
import { irA, posicion } from '../../services/scrollApp'

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
    // Sin sesión no hay cruces que buscar. El estado de carga se apaga dentro
    // de la función asíncrona y no acá: un `setState` en el cuerpo del efecto
    // encadena un render antes de pintar.
    if (!supabaseUser) {
      void Promise.resolve().then(() => { if (!cancelled) setLoading(false) })
      return () => { cancelled = true }
    }

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

  /**
   * Sin cruces NO se dibuja nada, ni el rótulo ni el estado vacío.
   *
   * El cartel de «todavía no hay cruces» ocupaba cerca de un TERCIO de la
   * primera pantalla del Mercado —rótulo, ícono, tres renglones de explicación
   * y un botón— para no decir nada, y empujaba las 237 publicaciones abajo del
   * pliegue. Un estado vacío se justifica cuando explica algo que la persona
   * puede arreglar AHÍ MISMO; este mandaba a otra pantalla a hacer algo que
   * nadie hizo nunca (`wishlist` está en cero).
   *
   * Cuando alguien marque una carta con el corazón, el bloque aparece solo.
   */
  // También mientras carga: un esqueleto que SIEMPRE termina en nada es un
  // parpadeo en cada visita. Un cruce que aparece un instante tarde no molesta
  // a nadie; el hueco que siempre se resuelve en vacío, sí.
  if (!failed && matches.length === 0) return null

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

type Tab = 'collections' | 'market'

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

/**
 * El acceso a Pedidos, con el número de lo que espera un acto tuyo.
 *
 * El número no es adorno: es lo que distingue «tengo una tienda» de «alguien
 * está esperando que le conteste». Sin él habría que entrar a mirar.
 */
function BotonPedidos() {
  const navigate = useNavigate()
  const { currentProfileId } = useAuth()
  const [pendientes, setPendientes] = useState(0)

  useEffect(() => {
    if (!currentProfileId) return
    let vivo = true
    void pedidosPendientes().then(p => {
      if (vivo) setPendientes(p.porResponder + p.porCerrar)
    })
    return () => { vivo = false }
  }, [currentProfileId])

  if (!currentProfileId) return null

  return (
    <button
      onClick={() => navigate('/pedidos')}
      className="relative flex min-h-[36px] items-center gap-1.5 rounded-lg border
                 border-swu-border px-2.5 text-[12px] font-bold text-swu-text"
    >
      <ShoppingCart size={15} />
      Pedidos
      {pendientes > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center
                         justify-center rounded-full bg-swu-red px-1 text-[10px]
                         font-black text-white">
          {pendientes}
        </span>
      )}
    </button>
  )
}

export function ExplorePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // `?tab=market` abre directo en el mercado. Es el acceso directo de
  // «Mercancía» desde Inicio: sin esto el enlace dejaba a la persona en
  // Colecciones y había que cambiar de pestaña a mano.
  const [tab, setTab] = useState<Tab>(
    () => (params.get('tab') === 'market' ? 'market' : 'collections'),
  )

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
          {/* LA PUERTA A PEDIDOS, SIEMPRE VISIBLE.
              El carrito flotante solo aparece con algo adentro (`unidades === 0
              → null`), así que servía al COMPRADOR y dejaba al VENDEDOR sin
              camino: alguien te pide una carta, tu carrito está vacío, y no hay
              cómo enterarte desde acá. Al unificar el mercado en una sola
              casilla de Inicio, esta pasó a ser la única entrada — y una tienda
              donde no podés ver quién te compró no es una tienda. */}
          <BotonPedidos />
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
  /** Igual que en «Para vos»: un fallo de red no puede verse como un vacío. */
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getExploreProfiles(50)
      .then(data => { if (!cancelled) { setProfiles(data); setFailed(false) } })
      .catch(e => {
        console.warn('[Contrabando] Failed to load profiles:', e)
        if (!cancelled) setFailed(true)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q)
    setSearching(true)
    try {
      const data = q.trim() ? await searchPublicProfiles(q) : await getExploreProfiles(50)
      setProfiles(data)
      setFailed(false)
    } catch { setFailed(true) }
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
        {/* Un «0 contrabandistas» con la consulta caída es un dato inventado:
            mientras no se sepa, no se afirma un total. */}
        <span className="text-xs font-medium">
          {failed
            ? 'Lista no disponible'
            : query.trim() ? `Resultados para "${query}"` : `${profiles.length} contrabandistas`}
        </span>
      </div>

      {(loading || searching) && (
        <div className="text-center py-12 text-swu-muted">
          <Loader2 size={28} className="text-red-400 animate-spin mx-auto mb-3" />
          Rastreando contrabandistas...
        </div>
      )}

      {!loading && !searching && failed && (
        <div className="bg-swu-amber/10 border border-swu-amber/30 rounded-xl p-3">
          <p className="text-xs text-swu-amber font-semibold">No se pudo leer la lista</p>
          <p className="text-[11px] text-swu-muted mt-0.5">
            Puede que no haya conexión. No es que no haya contrabandistas.
          </p>
        </div>
      )}

      {!loading && !searching && !failed && profiles.length === 0 && (
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
              {/* emoji de 18px en una caja de 40: los tamaños que ya tenía la fila */}
              <Avatar avatar={p.avatar} size={44} escalaIcono={0.8} escalaEmoji={18 / 44} anillo={p.id} />
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

/**
 * Instantánea del Mercado, FUERA del componente para que sobreviva a la
 * navegación.
 *
 * Abrir una carta y volver desmonta esta pestaña, y con ella se iba TODO: las
 * publicaciones traídas, los filtros puestos, cuántas se habían desplegado con
 * «Ver más» y dónde estabas mirando. Volvías al principio de una lista de 207 y
 * había que rehacer el camino a mano — el mismo problema que ya tenía el
 * buscador de cartas y que allá se resolvió con esta misma pieza.
 *
 * Vive a nivel de módulo y no en un store: es memoria de una sesión de
 * navegación, no un dato de la app. Se descarta sola al recargar la página.
 */
interface InstantaneaMercado {
  listings: MarketplaceListing[]
  filter: string
  busqueda: string
  vendedorSel: string | null
  tipoSel: string | null
  aspectoSel: string | null
  tope: number
  scrollY: number
  /** De quién es. Con otra cuenta, «lo mío» y los precios cambian de dueño. */
  perfilId: string | null
}
let _instMercado: InstantaneaMercado | null = null

/** Se llama antes de leerla: si no es de este perfil, no sirve. */
function instantaneaDe(perfilId: string | null): InstantaneaMercado | null {
  if (_instMercado && _instMercado.perfilId !== perfilId) _instMercado = null
  return _instMercado
}

function MarketTab() {
  const navigate = useNavigate()
  // Para distinguir lo propio de lo ajeno: sobre lo propio se edita, no se
  // escribe uno mismo por WhatsApp.
  const { supabaseUser } = useAuth()

  // Se resuelve UNA vez, antes de sembrar el estado, y con inicializador
  // perezoso: leerla en cada render devolvería a la instantánea cada vez que
  // tocás un filtro.
  const guardada = useRef(instantaneaDe(supabaseUser?.id ?? null)).current

  /** La publicación propia que se está corrigiendo, si hay alguna. */
  const [editando, setEditando] = useState<MarketplaceListing | null>(null)
  /** Mismo freno que la vitrina: cada carta suma una capa de mezcla, y con
   *  cien a la vez el teléfono se queda sin memoria de GPU. */
  const [tope, setTope] = useState(guardada?.tope ?? 24)
  const [guardando, setGuardando] = useState(false)

  const [listings, setListings] = useState<MarketplaceListing[]>(guardada?.listings ?? [])
  /** Cuántas unidades tiene reservadas cada (vendedor, carta). UNA consulta
   *  para todo el mercado: preguntarlo por fila serían 200 viajes, y §2y
   *  prohíbe topes fijos al leer esta lista. */
  const [reservas, setReservas] = useState<Map<string, number>>(new Map())
  const [alCarrito, setAlCarrito] = useState<string | null>(null)
  const [avisoCarrito, setAvisoCarrito] = useState<string | null>(null)
  /** Los carritos abiertos, uno por vendedor. Alimentan la burbuja flotante. */
  const [carritos, setCarritos] = useState<Pedido[]>([])
  /** Lo que busco, por uuid canónico. Es la pata que le faltaba al cruce: el
   *  único sitio donde se podía marcar era dentro de /cards/:id, a tres toques
   *  de acá, y por eso `wishlist` lleva CERO filas desde siempre. */
  const [deseos, setDeseos] = useState<Set<string>>(new Set())

  /** Relee los carritos y las reservas. Se llama tras cada toque que cambie
   *  alguna de las dos: agregar al carrito cambia el carrito, y mandar un
   *  pedido cambia ADEMAS lo que los demas ven como reservado. */
  const recargarCarritos = useCallback(async () => {
    // Sin sesion la RLS responde «permission denied for table pedidos» y ese
    // texto no le sirve a nadie. El Mercado se puede mirar sin cuenta.
    if (!supabaseUser) { setCarritos([]); return }
    const r = await misPedidos()
    if (r.ok) setCarritos(r.datos.filter(p => p.estado === 'carrito'))
    void reservasDelMercado().then(setReservas)
  }, [supabaseUser])
  const [cards, setCards] = useState<Map<string, Card>>(new Map())
  // Con instantánea NO se arranca cargando: ya hay qué mostrar, y un spinner
  // encima de datos buenos es una pantalla que parpadea sin razón.
  const [loading, setLoading] = useState(!guardada)
  /** Lo que se teclea. Se aplica con retardo — ver `busqueda`. */
  const [filter, setFilter] = useState(guardada?.filter ?? '')
  /** El texto YA estabilizado. Filtrar en cada tecla sobre cientos de
   *  publicaciones hacía trabajo de más en cada pulsación; el buscador de
   *  cartas ya espera 300 ms y el mercado no lo hacía. */
  const [busqueda, setBusqueda] = useState(guardada?.busqueda ?? '')
  /** Filtro por vendedor, por `userId`. Por id y NO por nombre: dos personas
   *  pueden llamarse igual, y el nombre además puede cambiar. */
  const [vendedorSel, setVendedorSel] = useState<string | null>(guardada?.vendedorSel ?? null)
  /** Filtro por tipo de carta ('Leader', 'Unit'…). */
  const [tipoSel, setTipoSel] = useState<string | null>(guardada?.tipoSel ?? null)
  /** Filtro por aspecto. Sale gratis: el objeto Card ya está hidratado. */
  const [aspectoSel, setAspectoSel] = useState<string | null>(guardada?.aspectoSel ?? null)
  const [panelFiltros, setPanelFiltros] = useState(false)
  /** Igual que en «Para vos»: un fallo de red no puede verse como un vacío. */
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // SIN `limit`. El servicio ya pagina y trae todo; dejar el `limit: 200`
      // que había acá era arrastrar el techo viejo del lado del cliente — el
      // mismo que ya se había pasado (207 publicaciones contra un tope de 200).
      const list = await getMarketplaceListings()
      setListings(list)
      void reservasDelMercado().then(setReservas)
      void recargarCarritos()
      if (supabaseUser) {
        void getMyWishlist(supabaseUser.id)
          .then(w => setDeseos(new Set(w.map(x => x.cardId))))
      }
      setFailed(false)
      // Hydrate card details
      const cardIds = Array.from(new Set(list.map(l => l.cardId)))
      if (cardIds.length > 0) {
        const cardMap = await getCardsByIds(cardIds)
        setCards(cardMap)
      }
    } catch (e) {
      console.warn('[Contrabando] Failed to load market:', e)
      setFailed(true)
    } finally {
      setLoading(false)
    }
    // `recargarCarritos` ya depende de `supabaseUser`, así que listar las dos
    // no agrega nada: cuando cambia la sesión cambian las dos a la vez.
  }, [recargarCarritos, supabaseUser])

  // Al montar CON instantánea no se recarga: los datos ya están y una consulta
  // que tarda medio segundo reemplazaría la lista justo cuando estás volviendo
  // a ella, moviéndote lo que mirabas. Se refresca con el botón, o al entrar
  // sin instantánea.
  useEffect(() => {
    if (guardada) return
    void load()
  }, [load, guardada])

  // Devolver el scroll a donde estabas, una sola vez y DESPUÉS de pintar las
  // filas recuperadas — si no, se scrollea sobre una lista que todavía mide
  // cero.
  useEffect(() => {
    const y = guardada?.scrollY
    if (!y) return
    requestAnimationFrame(() => irA(y))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // El retardo es SOLO del texto: tocar un chip tiene que responder al
  // instante, y por eso los chips escriben su propio estado y no pasan por acá.
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(filter), 300)
    return () => clearTimeout(t)
  }, [filter])

  // Al cambiar cualquier filtro se vuelve al tope de render inicial. Sin esto,
  // filtrar con «Ver más» ya pulsado dejaba un tope alto sobre un conjunto
  // chico: la lista se veía completa pero el botón seguía ahí, mintiendo.
  useEffect(() => { setTope(24) }, [busqueda, vendedorSel, tipoSel, aspectoSel])

  /**
   * Los vendedores se DERIVAN de lo publicado, no se consultan aparte.
   *
   * Así la lista contiene exactamente a quien tiene algo en venta —ni un
   * perfil de más— y no cuesta ninguna consulta. Van ordenados por cantidad
   * descendente y con el conteo a la vista: es la señal que hace evidente de
   * un vistazo que la portada puede ser de una sola persona.
   */
  const vendedores = useMemo(() => {
    const m = new Map<string, { id: string; nombre: string; avatar: string; n: number }>()
    for (const l of listings) {
      const e = m.get(l.userId)
      if (e) e.n++
      else m.set(l.userId, { id: l.userId, nombre: l.sellerName, avatar: l.sellerAvatar, n: 1 })
    }
    return [...m.values()].sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre))
  }, [listings])

  /**
   * Los tipos de carta que DE VERDAD hay publicados, con su conteo.
   *
   * Ofrecer los cinco siempre daría botones que llevan a cero resultados. Se
   * respeta el orden canónico del juego (`TIPOS_CARTA`) en vez de ordenar por
   * cantidad: el tipo es una lista fija y que salte de sitio al publicar algo
   * es peor que un botón más abajo.
   */
  const tiposPresentes = useMemo(() => {
    const cuenta = new Map<string, number>()
    for (const l of listings) {
      const t = cards.get(l.cardId)?.type
      if (t) cuenta.set(t, (cuenta.get(t) ?? 0) + 1)
    }
    return TIPOS_CARTA.filter(t => cuenta.has(t)).map(t => ({ tipo: t as string, n: cuenta.get(t)! }))
  }, [listings, cards])

  /** Lo mismo para los aspectos. Una carta puede tener dos, y cuenta en ambos. */
  const aspectosPresentes = useMemo(() => {
    const cuenta = new Map<string, number>()
    for (const l of listings) {
      for (const a of cards.get(l.cardId)?.aspects ?? []) {
        cuenta.set(a, (cuenta.get(a) ?? 0) + 1)
      }
    }
    return ASPECTOS.filter(a => cuenta.has(a)).map(a => ({ aspecto: a as string, n: cuenta.get(a)! }))
  }, [listings, cards])

  /** El estado de los filtros, en la forma que espera `pasaFiltros`. */
  const filtros = useMemo(
    () => ({ texto: busqueda, vendedor: vendedorSel, tipo: tipoSel, aspecto: aspectoSel }),
    [busqueda, vendedorSel, tipoSel, aspectoSel],
  )

  // Valores VIVOS para la instantánea. Este bloque corre en cada pintada pero
  // SOLO escribe un ref — no toca `_instMercado`. Guardar en cada commit es lo
  // que hacía que la instantánea del buscador naciera con datos a medio cargar.
  const vivoRef = useRef<InstantaneaMercado | null>(null)
  vivoRef.current = {
    listings, filter, busqueda, vendedorSel, tipoSel, aspectoSel, tope,
    scrollY: 0,
    perfilId: supabaseUser?.id ?? null,
  }

  // Y se escribe UNA sola vez, al desmontar de verdad — que es exactamente
  // cuando tocás una carta y la app te lleva a su ficha.
  useEffect(() => {
    return () => {
      if (vivoRef.current) _instMercado = { ...vivoRef.current, scrollY: posicion() }
    }
  }, [])

  /** ¿Hay algún filtro puesto? Decide el vacío que se muestra y el botón de limpiar. */
  const hayFiltros = hayFiltrosPuestos(filtros)

  const limpiarFiltros = () => {
    setFilter(''); setBusqueda(''); setVendedorSel(null); setTipoSel(null); setAspectoSel(null)
  }

  // El predicado vive en `filtrosCarta.ts` y no acá: la regla de qué hacer con
  // una carta que todavía no se hidrató dura milisegundos en pantalla, no se
  // puede comprobar mirando, y es justo la que se equivoca sola. Fuera del
  // componente se puede probar.
  const filtered = useMemo(() => {
    if (!hayFiltros) return listings
    return listings.filter(l => pasaFiltros(l, cards.get(l.cardId) ?? null, filtros))
  }, [listings, cards, filtros, hayFiltros])

  return (
    <div className="space-y-3">
      {/* «0 listings» con la consulta caída es un número inventado. Y con
          filtros puestos, el total solo confunde: manda lo que estás viendo. */}
      <p className="text-xs text-swu-amber/80 font-mono text-center bg-swu-amber/5 rounded-lg border border-swu-amber/20 p-2">
        Cartas en venta de la comunidad
        {!failed && (
          hayFiltros
            ? ` · ${filtered.length} de ${listings.length}`
            : ` · ${listings.length} publicacion${listings.length === 1 ? '' : 'es'} de ${vendedores.length} vendedor${vendedores.length === 1 ? '' : 'es'}`
        )}
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
        {/* El contador del botón hace visible que hay filtros aunque el panel
            esté cerrado — si no, se te olvida por qué ves tan poco. */}
        <button
          onClick={() => setPanelFiltros(v => !v)}
          aria-expanded={panelFiltros}
          className={`relative px-3 rounded-xl border transition-colors ${
            hayFiltros
              ? 'border-swu-amber/50 bg-swu-amber/10 text-swu-amber'
              : 'border-swu-border bg-swu-surface text-swu-muted hover:text-swu-text'
          }`}
          title="Filtros"
        >
          <SlidersHorizontal size={14} />
          {hayFiltros && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-swu-amber
                             text-[9px] font-black text-swu-bg grid place-items-center">
              {[vendedorSel, tipoSel, aspectoSel].filter(Boolean).length + (busqueda.trim() ? 1 : 0)}
            </span>
          )}
        </button>
        <button
          onClick={load}
          className="px-3 rounded-xl border border-swu-border bg-swu-surface text-swu-muted hover:text-swu-text"
          title="Refrescar"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Chips de lo que está aplicado, SIEMPRE visibles (no dentro del panel).
          Es lo que evita mirar un mercado casi vacío sin saber por qué. */}
      {hayFiltros && (
        <div className="flex flex-wrap items-center gap-1.5">
          {busqueda.trim() && (
            <Chip tone="cyan" active onRemove={() => { setFilter(''); setBusqueda('') }}>
              «{busqueda.trim()}»
            </Chip>
          )}
          {vendedorSel && (
            <Chip tone="amber" active onRemove={() => setVendedorSel(null)}>
              {vendedores.find(v => v.id === vendedorSel)?.nombre ?? 'Vendedor'}
            </Chip>
          )}
          {tipoSel && (
            <Chip tone={TONO_CHIP_POR_TIPO[tipoSel] ?? 'neutral'} active onRemove={() => setTipoSel(null)}>
              {translateType(tipoSel)}
            </Chip>
          )}
          {aspectoSel && (
            <Chip tone="green" active onRemove={() => setAspectoSel(null)}>
              {translateAspect(aspectoSel)}
            </Chip>
          )}
          <button onClick={limpiarFiltros} className="text-[11px] text-swu-muted underline underline-offset-2 px-1">
            Limpiar
          </button>
        </div>
      )}

      {panelFiltros && (
        <div className="bg-swu-surface rounded-xl border border-swu-border p-3 space-y-3">
          {/* VENDEDOR — el filtro que de verdad hacía falta. Con el orden por
              fecha, quien publica cien cartas seguidas se queda con toda la
              portada y los demás vendedores quedan invisibles. El conteo al
              lado de cada nombre lo hace evidente sin explicarlo. */}
          <div>
            <p className="text-[11px] text-swu-muted mb-1.5">Vendedor</p>
            <div className="flex flex-wrap gap-1.5">
              {vendedores.map(v => (
                <button
                  key={v.id}
                  onClick={() => setVendedorSel(vendedorSel === v.id ? null : v.id)}
                  aria-pressed={vendedorSel === v.id}
                  className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border text-[12px] font-semibold transition-colors ${
                    vendedorSel === v.id
                      ? 'border-swu-amber/50 bg-swu-amber/15 text-swu-amber'
                      : 'border-swu-border bg-swu-bg text-swu-text hover:border-swu-amber/30'
                  }`}
                >
                  {/* Gotcha §2x: el avatar es polimórfico, va por <Avatar>. */}
                  <Avatar avatar={v.avatar} size={22} anillo={v.id} />
                  <span className="truncate max-w-[9rem]">{v.nombre}</span>
                  <span className="font-mono text-[10px] text-swu-muted">{v.n}</span>
                </button>
              ))}
            </div>
          </div>

          {/* TIPO — solo los que existen publicados. Ofrecer los cinco siempre
              daría botones que llevan a cero resultados. */}
          {tiposPresentes.length > 1 && (
            <div>
              <p className="text-[11px] text-swu-muted mb-1.5">Tipo de carta</p>
              <div className="flex flex-wrap gap-1.5">
                {tiposPresentes.map(({ tipo, n }) => (
                  <Chip
                    key={tipo}
                    tone={TONO_CHIP_POR_TIPO[tipo] ?? 'neutral'}
                    active={tipoSel === tipo}
                    onClick={() => setTipoSel(tipoSel === tipo ? null : tipo)}
                  >
                    {translateType(tipo)} <span className="font-mono opacity-60">{n}</span>
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {aspectosPresentes.length > 1 && (
            <div>
              <p className="text-[11px] text-swu-muted mb-1.5">Aspecto</p>
              <div className="flex flex-wrap gap-1.5">
                {aspectosPresentes.map(({ aspecto, n }) => (
                  <Chip
                    key={aspecto}
                    tone="green"
                    active={aspectoSel === aspecto}
                    onClick={() => setAspectoSel(aspectoSel === aspecto ? null : aspecto)}
                  >
                    {translateAspect(aspecto)} <span className="font-mono opacity-60">{n}</span>
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-swu-muted">
          <Loader2 size={28} className="text-swu-amber animate-spin mx-auto mb-3" />
          Cargando mercado...
        </div>
      )}

      {!loading && failed && (
        <div className="bg-swu-amber/10 border border-swu-amber/30 rounded-xl p-3">
          <p className="text-xs text-swu-amber font-semibold">No se pudo leer el mercado</p>
          <p className="text-[11px] text-swu-muted mt-0.5">
            Puede que no haya conexión. No es que nadie esté vendiendo.
          </p>
          <button onClick={load} className="mt-2 text-[11px] text-swu-amber underline">
            Reintentar
          </button>
        </div>
      )}

      {!loading && !failed && filtered.length === 0 && (
        <div className="text-center py-12">
          <ShoppingBag size={48} className="mx-auto text-swu-muted/30 mb-4" />
          {/* Un vacío por filtros NO es un mercado vacío. Antes los dos casos
              decían «todavía no hay nadie vendiendo cartas», que con 179
              publicaciones en la base es sencillamente falso, y encima ofrecía
              ir a vender en vez de la salida útil: soltar el filtro. */}
          <p className="text-swu-muted text-sm">
            {hayFiltros
              ? 'Ninguna publicación coincide con estos filtros'
              : 'Todavía no hay nadie vendiendo cartas'}
          </p>
          {hayFiltros ? (
            <button onClick={limpiarFiltros} className="mt-3 text-xs text-swu-amber underline">
              Quitar los filtros y ver las {listings.length}
            </button>
          ) : (
            <button
              onClick={() => navigate('/collection')}
              className="mt-3 text-xs text-swu-amber underline"
            >
              ¿Vender tus propias cartas? Andá a Mi Botín
            </button>
          )}
        </div>
      )}

      {editando && (
        <SaleModal
          key={editando.cardId}
          cardId={editando.cardId}
          cardName={cards.get(editando.cardId)?.name ?? editando.cardId}
          owned={editando.owned}
          current={{
            cardId: editando.cardId,
            quantity: editando.quantity,
            owned: editando.owned,
            price: editando.price,
            notes: editando.notes,
            listedAt: editando.listedAt,
          }}
          submitting={guardando}
          onCancel={() => setEditando(null)}
          onSave={async (price, notes, cantidad) => {
            if (!supabaseUser) return
            setGuardando(true)
            const r = await markCardForSale(editando.cardId, supabaseUser.id, {
              price, notes, saleQuantity: cantidad,
              cardName: cards.get(editando.cardId)?.name,
            })
            setGuardando(false)
            if (!r.ok) { alert(`Error: ${r.error}`); return }
            setEditando(null)
            await load()
          }}
          onUnlist={async () => {
            if (!supabaseUser) return
            if (!confirm('¿Quitar esta carta del mercado?')) return
            await unmarkCardForSale(editando.cardId, supabaseUser.id)
            setEditando(null)
            await load()
          }}
        />
      )}

      {/* El fallo del carrito va ARRIBA de la vitrina y no dentro de la tarjeta:
          el mensaje del servidor —«no quedan tantas: hay 2 disponibles»— no
          entra en una celda de dos columnas sin partirse. */}
      {avisoCarrito && (
        <div className="mb-2 rounded-lg bg-swu-red/15 px-3 py-2 text-[11px] text-swu-red-texto">
          {avisoCarrito}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        /* Vitrina de tienda: la carta grande y el precio encima, como en el
           mostrador. Antes era una fila de lista con una miniatura de 56px,
           donde lo que se veía era el texto y no la mercancía. */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {filtered.slice(0, tope).map(l => {
            const card = cards.get(l.cardId)
            const apaisada = listFaceIsLandscape(card)
            const esMia = !!supabaseUser && l.userId === supabaseUser.id
            const claveL = claveReserva(l.userId, l.cardId)
            // Lo publicado MENOS lo que ya tiene reservado alguien.
            const quedan = l.quantity - (reservas.get(claveL) ?? 0)
            const deseado = deseos.has(cards.get(l.cardId)?.id ?? l.cardId)
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
                      funda. Es lo primero que se mira en una tienda.
                   *
                   * Sin `backdrop-blur`. Tenía `backdrop-blur-[2px]` DETRÁS de
                   * un negro al 80%: dos píxeles de desenfoque bajo una capa
                   * casi opaca no se ven, y medido costaban **24 capas de
                   * compositor** en esta pantalla —`backdrop-filter` es la
                   * operación más cara que hay en un teléfono, porque obliga a
                   * releer lo ya pintado por debajo—. Se quitó lo invisible y
                   * se quedó lo que hace legible el precio, que es el negro. */}
                  {/* «La busco». Va ACA porque es donde uno mira mercancia: el
                      unico sitio donde se podia marcar era dentro de
                      /cards/:id, a tres toques, y por eso la lista lleva cero
                      filas desde siempre. Sobre lo propio no se dibuja: nadie
                      busca lo que ya vende. */}
                  {!esMia && supabaseUser && (
                    <button
                      aria-label={deseado ? 'Ya la buscás — tocá para quitarla' : 'La busco'}
                      aria-pressed={deseado}
                      onClick={async e => {
                        e.stopPropagation()
                        // La clave es el uuid CANONICO de la carta, no el id de
                        // la fila: a la coleccion se llega con los dos espacios
                        // de ids y con el crudo la misma carta se marca dos
                        // veces y el cruce no casa.
                        const clave = card?.id ?? l.cardId
                        const proximo = new Set(deseos)
                        if (deseado) { proximo.delete(clave); void removeFromWishlist(supabaseUser.id, clave) }
                        else { proximo.add(clave); void addToWishlist(supabaseUser.id, clave) }
                        setDeseos(proximo)
                      }}
                      className="absolute top-1.5 left-1.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/70"
                    >
                      <Heart
                        size={15}
                        className={deseado ? 'fill-swu-red text-swu-red' : 'text-white/60'}
                      />
                    </button>
                  )}

                  <span className="absolute top-3 right-3 z-10 px-1.5 py-0.5 rounded-md bg-black/80">
                    {l.price != null ? (
                      <span className="text-[11px] font-extrabold text-swu-amber font-mono">
                        ${l.price.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-[9px] text-swu-muted font-mono">a convenir</span>
                    )}
                  </span>

                  {/* Lo que QUEDA, no lo publicado. Con 2 de 3 reservadas,
                      decir «x3» es ofrecer algo que no esta disponible. */}
                  {quedan > 1 && (
                    <span className="absolute bottom-3 right-3 z-10 text-[9px] font-mono font-bold text-white bg-black/75 rounded px-1">
                      x{quedan}
                    </span>
                  )}
                  {quedan > 0 && quedan < l.quantity && (
                    <span className="absolute bottom-3 left-3 z-10 rounded bg-black/75 px-1 font-mono text-[9px] font-bold text-swu-amber">
                      {l.quantity - quedan} reservada{l.quantity - quedan > 1 ? 's' : ''}
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
                      onClick={() => setEditando(l)}
                      className="mt-2 flex items-center justify-center gap-1.5 bg-swu-amber/15 border border-swu-amber/40
                                 text-swu-amber text-[11px] font-semibold rounded-lg py-1.5 active:scale-[0.98] transition-transform"
                    >
                      <Pencil size={12} aria-hidden /> Editar publicación
                    </button>
                  ) : quedan <= 0 ? (
                    /* Reservada por otro. Se ATENUA y se rotula, no se
                       esconde: hacer desaparecer la carta haria pensar que el
                       vendedor la retiro, y ademas vuelve en cuanto la reserva
                       venza o se rechace. */
                    <p className="mt-2 rounded-lg bg-swu-surface-hover py-1.5 text-center text-[10px] font-bold text-swu-muted">
                      Ya está reservada
                    </p>
                  ) : (
                    <button
                      disabled={alCarrito === claveL}
                      onClick={async e => {
                        e.stopPropagation()
                        setAlCarrito(claveL)
                        setAvisoCarrito(null)
                        const r = await agregarAlCarrito(l.userId, l.cardId, 1)
                        setAlCarrito(null)
                        // El mensaje del servidor va TAL CUAL: «no quedan
                        // tantas: hay 2 disponibles» dice que hacer.
                        if (!r.ok) setAvisoCarrito(r.mensaje)
                        else void recargarCarritos()
                      }}
                      className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-swu-amber/40 bg-swu-amber/15
                                 py-1.5 text-[11px] font-semibold text-swu-amber transition-transform active:scale-[0.98] disabled:opacity-60"
                    >
                      <ShoppingCart size={12} aria-hidden />
                      {alCarrito === claveL ? 'Agregando…' : 'Al carrito'}
                    </button>
                  )}
                  {/* Escribirle DENTRO de la app, con la carta ya enganchada.
                      Es lo que hace que la conversacion empiece hablando de
                      ESTA publicacion y no de «una carta». La clave que viaja
                      es el uuid CANONICO, igual que en el corazon: el card_id
                      de la fila puede ser del espacio de ids heredado y del
                      otro lado no resolveria. */}
                  {!esMia && supabaseUser && (
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        navigate(`/mensajes?con=${l.userId}&carta=${encodeURIComponent(card?.id ?? l.cardId)}`)
                      }}
                      className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-swu-cyan/40 bg-swu-cyan/15
                                 py-1.5 text-[11px] font-semibold text-swu-cyan transition-transform active:scale-[0.98]"
                    >
                      <MessageCircle size={12} aria-hidden /> Escribirle por esta carta
                    </button>
                  )}

                  {l.sellerWhatsapp && !esMia && quedan > 0 ? (
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
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && filtered.length > tope && (
        <button
          onClick={() => setTope((t: number) => t + 24)}
          className="w-full py-3 rounded-xl bg-swu-surface border border-swu-border
                     text-sm font-semibold text-swu-cyan active:scale-[0.99] transition-transform"
        >
          Ver {Math.min(24, filtered.length - tope)} más
        </button>
      )}

      {/* La burbuja del carrito. Vive DENTRO de la vitrina y no en el layout
          global: solo tiene sentido mientras se mira mercancía. Se calla sola
          cuando el carrito está vacío. */}
      <CarritoFlotante carritos={carritos} cartas={cards} alCambiar={() => { void recargarCarritos() }} />
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

/**
 * BASE — el Centro de Mando.
 *
 * Consola de nave: paneles de esquinas cortadas, íconos en octágono y el
 * acento cian del HUD. Las formas viven en components/Hud.tsx y las utilidades
 * de recorte en index.css.
 *
 * ── Dos reglas que esta pantalla no rompe ─────────────────────────────
 *
 * 1. Ningún botón decorativo. Cada acción va a una ruta que existe.
 * 2. Ningún número inventado. Victorias, derrotas y racha salen de
 *    `playerStats` (gamification.ts). Si todavía no hay partidas registradas,
 *    la tira no se dibuja en vez de mostrar tres ceros.
 */

import type { ComponentType } from 'react'
import { useT } from '../../services/i18n'
import { pendientesDeConfirmar } from '../../services/amistosas'
import { pedidosPendientes } from '../../services/mercadoPedidos'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
// `ChevronRight` y `ScanLine` se quedan: son mecánica de interfaz —«seguir»
// y «escanear»—, no la identidad de un módulo. Un ícono temático ahí no
// ayuda a nadie; un chevrón dibujado como un caza deja de leerse como
// «entrá acá».
import { ChevronRight, ScanLine } from 'lucide-react'
import {
  AgendaIcon, ArticuloIcon, AurebeshIcon, BeskarIcon, BinderIcon,
  BlasterIcon, BountyIcon, CargoIcon, ChanceCubeIcon, CredencialIcon,
  DatapadIcon, DeathStarIcon, DeckCardsIcon, EmisionIcon, EmpireIcon,
  HelmetIcon, HolocronIcon, HolonetIcon, KyberIcon, LabIcon, MandoTrophyIcon,
  MedalIcon, MetaHoloIcon, SaberIcon, SobreIcon, SpyIcon,
  StarfighterIcon, TransmisionIcon,
} from '../../components/SWIcons'
// El planeta anillado ya estaba dibujado para el tema «Planetas» de la Trivia.
// El ícono de una cosa es el de esa cosa: se reusa, no se dibuja otro.
import { PlanetaAnilladoIcon } from '../trivia/iconosTrivia'
import { HudPanel, HudCorners, HexIcon } from '../../components/Hud'
import { NoticiasSection } from './NoticiasSection'
import { CartaDelDia } from './CartaDelDia'
import { DondeJugar } from './DondeJugar'
import { ProximosEventos } from './ProximosEventos'
import { AvisoPerfil } from '../profile/AvisoPerfil'
import { AvisoUbicacion } from '../profile/AvisoUbicacion'
import { AvisoSobreDiario } from '../sobres/AvisoSobreDiario'
import { SobresAcumulados } from '../sobres/SobresAcumulados'
import { AvisoMensajes } from '../mensajes/AvisoMensajes'
import { AvisoEncuesta } from '../encuesta/AvisoEncuesta'
import { MisionesDeHoy } from '../missions/MisionesDeHoy'
import { MosaicoModulo } from './MosaicoModulo'
import { BahiaModulos } from './BahiaModulos'
import { PopupOferta } from '../sobres/OfertaSobresDiarios'
import { TarjetaJugador } from '../profile/TarjetaJugador'
import { AvisoTransmision } from '../stream/AvisoTransmision'
import { HUD_TEXTO, type HudTone } from '../../components/hudTones'
import { soyCurador } from '../../services/centroTemporada'
import { miCasaDeCreador } from '../../services/ligaService'
import { useAuth } from '../../hooks/useAuth'
import { type PlayerStats, calculateLevel } from '../../services/gamification'
import { db } from '../../services/db'
import { WelcomeHome } from './components/WelcomeHome'
import { ChatRegion } from './ChatRegion'

/* Avatar helper: detect image-based avatar vs emoji */

/** Las familias de módulos, en el orden en que se muestran. */
type Categoria = 'jugar' | 'competir' | 'construir' | 'coleccion' | 'minijuegos' | 'comunidad'

const CATEGORIAS: {
  id: Categoria; titulo: string
  /* Tipo ancho a propósito: las categorías mezclan íconos de lucide con los
     propios del juego, y `typeof DatapadIcon` solo abarca los segundos. */
  icono: ComponentType<{ size?: number }>
  tono: HudTone
}[] = [
  { id: 'jugar',     titulo: 'Jugar',     icono: SaberIcon,       tono: 'green' },
  { id: 'competir',  titulo: 'Competir',  icono: MandoTrophyIcon, tono: 'amber' },
  { id: 'construir', titulo: 'Construir', icono: DeckCardsIcon,   tono: 'cyan' },
  { id: 'coleccion', titulo: 'Colección', icono: CargoIcon,       tono: 'purple' },
  // Mini Juegos junta lo que se juega DENTRO de la app. Pedido de Nel: antes
  // estaban regados en tres familias, y Terraformar y Aurebesh todavía andaban
  // sueltos en Comunidad.
  { id: 'minijuegos', titulo: 'Mini Juegos', icono: ChanceCubeIcon, tono: 'purple' },
  { id: 'comunidad', titulo: 'Comunidad', icono: StarfighterIcon, tono: 'red' },
]

/**
 * Qué bahías quedaron abiertas, por aparato.
 *
 * Va en `localStorage` y no en la nube a propósito: es una preferencia de esta
 * pantalla en este teléfono, no un dato de la cuenta. Sincronizarla obligaría a
 * esperar la red para saber cómo dibujar Inicio.
 *
 * La primera vez se abre SOLO «Jugar». Con todo cerrado, quien entra por
 * primera vez no ve un solo módulo y la app parece vacía; con todo abierto
 * volvemos a las trece filas de mosaicos que esto vino a arreglar.
 */
const CLAVE_BAHIAS = 'inicio_bahias'

function bahiasGuardadas(): Set<Categoria> {
  try {
    const crudo = localStorage.getItem(CLAVE_BAHIAS)
    if (crudo === null) return new Set<Categoria>(['jugar'])
    const lista = JSON.parse(crudo) as unknown
    // Se filtra contra las categorías REALES: un valor viejo de una categoría
    // que ya no existe abriría una bahía fantasma.
    if (!Array.isArray(lista)) return new Set<Categoria>(['jugar'])
    return new Set(lista.filter((x): x is Categoria =>
      CATEGORIAS.some(c => c.id === x)))
  } catch {
    // Modo privado de Safari o almacenamiento lleno: no es motivo para no
    // dibujar Inicio.
    return new Set<Categoria>(['jugar'])
  }
}

interface Sistema {
  icon: typeof DatapadIcon
  label: string
  tone: HudTone
  to: string
  /** Categoría del grid principal. Los módulos de admin no la llevan: van en
   *  su propia franja, no en una categoría. */
  cat?: Categoria
  auth?: boolean
  /** Solo para administradores. Los demás ni ven la casilla. */
  admin?: boolean
}

/**
 * Los módulos, agrupados por lo que la persona VIENE A HACER, no por el orden
 * en que se fueron construyendo. Antes era una cuadrícula plana de 19 casillas
 * donde Torneos quedaba lejos de Meta y el Contador lejos de Amistosas; con
 * grupos, cada cosa está donde uno la busca.
 *
 * El orden dentro de cada grupo es por uso esperado, no alfabético: lo que más
 * se toca, primero.
 */
const mainSystems: Sistema[] = [
  // ── Jugar: lo de la mesa, en vivo o para dejar registro ──
  { icon: ChanceCubeIcon,  label: 'Contador de daños', tone: 'purple', to: '/contador', cat: 'jugar' },
  { icon: BlasterIcon, label: 'Amistosas',    tone: 'green',  to: '/amistosas',  cat: 'jugar' },
  // Duelo ocupa el hueco que dejó el Holocrón, y no es un cambio de rótulo:
  // esa casilla era el ÚNICO salto de un toque desde Inicio hacia el tracker
  // en el teléfono (la TabBar no lleva /play y el sidebar es de escritorio).
  // Quitarla sin poner esta habría empeorado el acceso al módulo que la
  // gente sí usa, para arreglar el que nadie usó nunca.
  { icon: SaberIcon,     label: 'Duelo',        tone: 'green',  to: '/play',       cat: 'jugar', auth: true },
  { icon: DeathStarIcon,   label: 'Misiones',     tone: 'amber',  to: '/misiones',   cat: 'jugar', auth: true },

  // ── Competir: torneos, ranking y meta ──
  { icon: MandoTrophyIcon, label: 'Torneos',      tone: 'amber',  to: '/torneos',    cat: 'competir' },
  { icon: AgendaIcon,     label: 'Calendario',   tone: 'cyan',   to: '/calendario', cat: 'competir' },
  { icon: MedalIcon, label: 'Próximos Eventos', tone: 'amber', to: '/events',  cat: 'competir', auth: true },
  { icon: MetaHoloIcon,       label: 'Meta',         tone: 'cyan',   to: '/meta',       cat: 'competir' },
  { icon: BeskarIcon,      label: 'Ranking', tone: 'amber',  to: '/rank',       cat: 'competir', auth: true },
  { icon: EmisionIcon,     label: 'En Vivo',      tone: 'red',    to: '/envivo',     cat: 'competir' },

  // ── Construir: mazos y consulta de cartas y reglas ──
  { icon: DeckCardsIcon,   label: 'Mis Decks',    tone: 'green',  to: '/decks',      cat: 'construir', auth: true },
  // Laboratorio va PEGADO a Mis Decks: es el paso siguiente del mismo trabajo,
  // se arma un mazo y se prueba. (La Mesa 3D no tiene casilla propia a
  // propósito: es el paso final del Laboratorio y se abre desde ahí.)
  { icon: LabIcon,         label: 'Laboratorio',  tone: 'cyan',   to: '/laboratorio', cat: 'construir', auth: true },
  { icon: HolonetIcon,     label: 'Buscar Cartas', tone: 'cyan',  to: '/cards',      cat: 'construir', auth: true },
  // PÚBLICO a propósito (sin auth): un juez en torneo consulta una regla sin
  // loguearse.
  { icon: HolocronIcon,    label: 'Rulings',      tone: 'cyan',   to: '/rulings',    cat: 'construir' },

  // ── Colección: lo que uno tiene y lo que se cambia ──
  { icon: CargoIcon,       label: 'Mi Botín',     tone: 'green',  to: '/collection', cat: 'coleccion', auth: true },

  { icon: BinderIcon,   label: 'Binder digital', tone: 'cyan', to: '/binder-digital', cat: 'coleccion', auth: true },
  /* ── UNA SOLA CASILLA PARA EL MERCADO ──
     Eran TRES y dos de ellas abrían LA MISMA PÁGINA: «Contrabando» iba a
     /explore (pestaña Colecciones) y «Mercancía» a /explore?tab=market. La
     tercera, «Pedidos», era la otra mitad del mismo trabajo — comprar y
     enterarte de que te compraron.

     Tres casillas para un módulo que tocó UNA persona era el mayor derroche de
     la cuadrícula. Ahora es una, y abre donde está lo que se busca: el mercado.
     Las Colecciones quedan a una pestaña de distancia, y Pedidos tiene su
     botón permanente en la cabecera del mercado, con el número de lo que
     espera un acto tuyo.

     Lo que NO se hizo: esconder Pedidos y ya. El carrito flotante que llevaba
     ahí solo aparece con algo adentro, así que un vendedor con un pedido
     entrante se habría quedado sin camino. Unificar casillas sin unificar los
     destinos es esconder una pantalla, no simplificar. */
  { icon: KyberIcon, label: 'Mercado', tone: 'amber', to: '/explore?tab=market', cat: 'coleccion', auth: true },

  /* ── Mini Juegos ──
     EL ORDEN NO ES DECORATIVO: primero lo que DA créditos, después lo que los
     GASTA, y al final lo que no hace ninguna de las dos. Leída de arriba abajo,
     la sección enseña la economía sin una sola línea de texto — que es el
     trabajo que hace un orden bien puesto.

     Sobredosis va primera de las dos que dan porque es la que más paga (50 por
     sobre contra 2 por acierto) y porque es donde está el cuello de botella
     medido: 297 sobres sin abrir repartidos entre 24 personas. Trivia paga
     menos pero se puede jugar sin tener nada.

     Aurebesh cierra: no da ni gasta créditos, se aprende el alfabeto y ya. */

  // Dan créditos
  { icon: SobreIcon,      label: 'Sobredosis',   tone: 'amber',  to: '/sobres',  cat: 'minijuegos', auth: true },
  { icon: HolocronIcon,   label: 'Trivia',       tone: 'cyan',   to: '/trivia',  cat: 'minijuegos', auth: true },

  // Los gastan. Comparten la misma bolsa: `creditos_saldo()` resta de las dos.
  { icon: SaberIcon, label: 'Taller Kyber', tone: 'amber', to: '/sable', cat: 'minijuegos', auth: true },
  { icon: PlanetaAnilladoIcon, label: 'Terraformar', tone: 'green', to: '/terraformar', cat: 'minijuegos', auth: true },

  // Ni da ni gasta: es el único que se puede tocar sin cuenta.
  { icon: AurebeshIcon,   label: 'Aurebesh',     tone: 'cyan',   to: '/aurebesh', cat: 'minijuegos' },

  // ── Comunidad: mirar a los demás ──
  { icon: StarfighterIcon, label: 'La Galaxia',   tone: 'cyan',   to: '/galaxia',    cat: 'comunidad', auth: true },
  // La credencial estaba SOLO dentro de Perfil → Personalizar: en móvil son
  // cuatro toques y nadie la encontraba. Acá se ve al abrir la app.
  { icon: CredencialIcon,       label: 'Mi Credencial', tone: 'amber', to: '/credencial', cat: 'comunidad', auth: true },
  { icon: TransmisionIcon,     label: 'Mensajes',     tone: 'green',  to: '/mensajes',   cat: 'comunidad', auth: true },
  { icon: SpyIcon,         label: 'Espionaje',    tone: 'purple', to: '/espionaje',  cat: 'comunidad', auth: true },
  { icon: ArticuloIcon,     label: 'Blog',         tone: 'amber',  to: '/blog',       cat: 'comunidad' },
]

/**
 * Módulos SOLO de administración, en su propia sección.
 *
 * Antes vivían mezclados en la cuadrícula con un `admin: true` que los ocultaba
 * a los demás — funcionaba, pero para un admin quedaban desperdigados entre los
 * módulos de todos. Juntándolos en una franja aparte se ve de un vistazo qué es
 * herramienta de la comunidad y qué es del cuartel general, y no hay que cazar
 * el botón de Transmisión entre veinte casillas.
 *
 * La sección entera solo se dibuja para admins; no es solo que las casillas se
 * escondan, es que el separador tampoco aparece.
 */
const adminSystems: Sistema[] = [
  { icon: HelmetIcon,     label: 'Transmisión', tone: 'red',    to: '/estudio', admin: true },
  { icon: EmpireIcon, label: 'Panel Admin', tone: 'cyan',   to: '/admin',   admin: true },
]

/**
 * Las herramientas que hasta hoy SOLO se alcanzaban tecleando la URL.
 *
 * El Centro de Temporada y el espacio de creadores se construyeron sin entrada
 * de menú a propósito —los ve una sola persona cada uno— y «a propósito» se
 * convirtió en «no existe»: Nel preguntó dónde estaban sus herramientas y la
 * respuesta era «acordate del URL». Es la misma lección del §3l, donde llevar
 * un torneo ya se podía hacer entero y no había puerta desde ningún lado.
 *
 * CADA UNA LLEVA SU PROPIA LLAVE, y eso no es un detalle: ser admin NO alcanza
 * para ninguna de las dos. El Centro pide estar en `centro_curadores` (una
 * persona, sin escotilla de admin — §3i-bis) y el espacio de creadores pide
 * tener fila en `creadores`. Pintar estas casillas con `isAdmin` le pondría a
 * los otros tres admins dos botones que los echan al tocarlos.
 */
const HERRAMIENTAS_PROPIAS = [
  { icon: MandoTrophyIcon, label: 'Temporada', tone: 'amber' as HudTone, to: '/temporada', llave: 'curador' as const },
  { icon: EmisionIcon,     label: 'Mi espacio', tone: 'cyan' as HudTone, to: '', llave: 'creador' as const },
  /* El plan de la liga es un DOCUMENTO, no una pantalla: vive en
     `public/planes/` y lo sirve Vercel tal cual. Va acá para que Alejo —que
     es creador, no admin— pueda leerlo desde la app sin depender de un enlace
     que solo abre Nel. */
  { icon: ArticuloIcon, label: 'Plan de la liga', tone: 'purple' as HudTone,
    to: '/planes/liga-puente3.html', llave: 'plan' as const, externo: true },
]

interface Marcador {
  label: string
  value: number | string
  tone: HudTone
  icon: typeof DatapadIcon
}

/** Traducción de los rótulos de módulo y categoría al inglés (Fase i18n). */
const CAT_EN: Record<string, string> = {
  'Jugar': 'Play', 'Competir': 'Compete', 'Construir': 'Build', 'Colección': 'Collection', 'Mini Juegos': 'Mini Games', 'Comunidad': 'Community',
  'Solo administradores': 'Administrators only',
  'Mis herramientas': 'My tools',
}

export function HomePage() {
  const navigate = useNavigate()
  const { currentProfile, supabaseUser, isAdmin } = useAuth()

  /* Las llaves de las herramientas propias. `null` = todavía no se preguntó,
     y en ese estado NO se dibuja nada: una casilla que aparece medio segundo
     después, y solo a veces, se lee como un parpadeo. */
  const [curador, setCurador] = useState<boolean | null>(null)
  const [miCreador, setMiCreador] = useState<string | null | false>(null)

  useEffect(() => {
    if (!supabaseUser) return
    let vivo = true
    void soyCurador().then(r => { if (vivo) setCurador(r === true) })
    void miCasaDeCreador().then(code => { if (vivo) setMiCreador(code ?? false) })
    return () => { vivo = false }
  }, [supabaseUser])
  /* El Taller Kyber está en pruebas: su casilla se dibuja SOLO para quien puede
     entrar. La cerradura de verdad sigue estando dentro de cada RPC del taller. */
  const tI = useT()
  const [bahias, setBahias] = useState<Set<Categoria>>(bahiasGuardadas)

  const alternarBahia = (id: Categoria) => {
    setBahias(previo => {
      const siguiente = new Set(previo)
      if (siguiente.has(id)) siguiente.delete(id)
      else siguiente.add(id)
      try { localStorage.setItem(CLAVE_BAHIAS, JSON.stringify([...siguiente])) } catch { /* sin sitio */ }
      return siguiente
    })
  }

  /** Rango y marcador viajan juntos: salen de la misma fila y se pintan a la
   *  vez, así que un solo estado evita un render intermedio a medio llenar. */
  const [panel, setPanel] = useState<{
    rank: { name: string; color: string } | null
    marcadores: Marcador[] | null
    /** Las estadísticas completas: la tarjeta de jugador necesita el XP. */
    stats: PlayerStats | null
  }>({ rank: null, marcadores: null, stats: null })

  useEffect(() => {
    if (!currentProfile) return
    let vivo = true
    db.playerStats.get(currentProfile.id).then(stats => {
      if (!vivo || !stats) return
      const lvl = calculateLevel(stats.xp)
      const r = stats.currentStreak
      setPanel({
        rank: { name: lvl.rank.name, color: lvl.rank.color },
        stats,
        // Sin partidas no hay marcador: tres ceros dicen «perdiste todo»
        // cuando en realidad todavía no jugaste nada.
        marcadores: stats.matchesPlayed > 0 ? [
          { label: 'Victorias', value: stats.wins,   tone: 'green', icon: BeskarIcon },
          { label: 'Derrotas',  value: stats.losses, tone: 'red',   icon: BountyIcon },
          // La racha viene con signo: positiva son victorias seguidas y
          // negativa derrotas seguidas. Mostrarla pelada diría «racha -4».
          {
            label: r < 0 ? 'Racha mala' : 'Racha',
            value: Math.abs(r),
            tone: r < 0 ? 'red' : 'amber',
            icon: MandoTrophyIcon,
          },
        ] : null,
      })
    }).catch(() => {})
    return () => { vivo = false }
  }, [currentProfile])

  const { marcadores, stats: playerStats } = panel

  /* Amistosas esperando MI confirmación.
   *
   * Va en Inicio y no solo en /amistosas porque ahí es donde la gente entra.
   * Medido: de 12 duelos registrados solo UNO está confirmado — y de la
   * confirmación cuelgan el ranking, el meta nacional y los sobres. El aviso
   * existía, pero había que ir a buscarlo a una pantalla a la que nadie iba.
   *
   * Un push no lo arregla: solo 5 de 26 perfiles tienen avisos activos. */
  const [porConfirmar, setPorConfirmar] = useState(0)
  /** Pedidos del Mercado que esperan un acto MÍO. Es el camino que llega a los
   *  20 de 27 que NO tienen push: sin esto, un vendedor sin avisos activados no
   *  se entera nunca de que le compraron. */
  const [pedidos, setPedidos] = useState({ porResponder: 0, porCerrar: 0 })
  const miIdAuth = supabaseUser?.id ?? ''
  useEffect(() => {
    if (!miIdAuth) return
    let vivo = true
    void (async () => {
      const r = await pendientesDeConfirmar(miIdAuth)
      if (vivo && r.ok) setPorConfirmar(r.datos.length)
      const p = await pedidosPendientes()
      if (vivo) setPedidos(p)
    })()
    return () => { vivo = false }
  }, [miIdAuth])

  if (!currentProfile) return <WelcomeHome />

  /** El separador con líneas en degradado y el rótulo al centro, en versalitas.
   *  Una función para que las cinco categorías y la franja de admin salgan
   *  todas iguales; el color distingue el bloque de admin del resto. */
  const renderSeparador = (titulo: string, color: 'cyan' | 'amber') => (
    <div className="px-4 pt-5 pb-1">
      <div className="flex items-center gap-2.5">
        <div className={`h-px flex-1 bg-gradient-to-r from-transparent ${color === 'cyan' ? 'to-swu-cyan/40' : 'to-swu-amber/40'}`} />
        <span className={`text-[9px] font-mono tracking-[0.35em] uppercase ${color === 'cyan' ? 'text-swu-cyan/70' : 'text-swu-amber/80'}`}>
          {tI(titulo, CAT_EN[titulo] ?? titulo)}
        </span>
        <div className={`h-px flex-1 bg-gradient-to-l from-transparent ${color === 'cyan' ? 'to-swu-cyan/40' : 'to-swu-amber/40'}`} />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-swu-bg pb-8">
      {/* ── Quién sos ──
          Antes acá iba un panel que decía «CENTRO DE MANDO» y el nombre de la
          app: información que ya tenés, porque la abriste vos. Ahora va la
          misma tarjeta del perfil —nivel, rango, país y barra de XP—, que sí
          dice algo nuevo cada vez que entrás. Es el MISMO componente que usa
          Mi Perfil, para que las dos pantallas no se contradigan. */}
      {/* La transmisión destacada, arriba del todo cuando hay una cerca. El
          push llega a 13 de 39 cuentas; los otros dos tercios se enteran acá. */}
      <div className="px-4 pt-4">
        <AvisoTransmision />
      </div>

      <div className="px-4 pt-4">
        <TarjetaJugador
          perfil={currentProfile}
          stats={playerStats}
          enLinea={!!supabaseUser}
          alTocar="perfil"
        />
      </div>

      {/* El sobre de las 8 de la mañana. Va primero porque es lo que acaba de
          pasar, y se puede cerrar: el sobre no se gasta al ocultar el aviso. */}
      {/* Primero de todos los avisos: es el único que CADUCA. Un mensaje
          sigue ahí mañana; una encuesta que cerró ya no se puede contestar. */}
      <AvisoEncuesta userId={miIdAuth} />
      <AvisoMensajes userId={miIdAuth} />
      <AvisoSobreDiario userId={miIdAuth} />
      {/* Y DESPUÉS, lo acumulado. Son dos cosas distintas: el de arriba avisa
          que hoy cayó uno —una novedad, que se agota al leerla y por eso se
          calla— y este dice cuántos tenés guardados, que es un estado y no se
          agota. No se puede descartar: se va solo cuando abrís. */}
      <SobresAcumulados />
      {/* Va DESPUÉS del sobre: el sobre es de lo que hay que enterarse,
          las misiones son lo que se puede hacer con eso. Y una de ellas
          es justamente abrirlo. */}
      <MisionesDeHoy userId={miIdAuth} />

      {/* Y para quien está cobrando UNO por no tener los avisos: es el único
          caso sin pantalla propia —entró por la salida de emergencia de la
          puerta, o ya tenía cuenta de antes— y son 20 de los 27 perfiles.
          El propio componente se calla solo si ya está suscrito. */}
      <PopupOferta userId={miIdAuth} alIrAAjustes={() => navigate('/settings')} />

      {/* Los pedidos del Mercado que esperan algo tuyo. Va ARRIBA de las
          amistosas porque acá hay una carta de otra persona BLOQUEADA: mientras
          no respondas, nadie más se la puede llevar y el reloj de 48 h corre. */}
      {(pedidos.porResponder > 0 || pedidos.porCerrar > 0) && (
        <div className="px-4 pt-3">
          <button
            onClick={() => navigate('/pedidos')}
            className="clip-hud flex w-full items-center gap-3 bg-swu-green/15 px-4 py-3 text-left"
          >
            <CargoIcon size={18} className="shrink-0 text-swu-green" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-swu-text">
                {pedidos.porResponder > 0
                  ? pedidos.porResponder === 1
                    ? 'Te llegó un pedido'
                    : `Te llegaron ${pedidos.porResponder} pedidos`
                  : pedidos.porCerrar === 1
                    ? 'Tenés un pedido sin cerrar'
                    : `Tenés ${pedidos.porCerrar} pedidos sin cerrar`}
              </span>
              <span className="block text-[11px] text-swu-muted">
                {pedidos.porResponder > 0
                  ? 'Las cartas quedan apartadas hasta que respondas. Se liberan solas a las 48 horas.'
                  : 'Cuando ya se hayan visto, marcalo para liberar las cartas.'}
              </span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-swu-muted" />
          </button>
        </div>
      )}

      {/* Lo que TE están esperando. Dice el premio porque es cierto y porque es
          lo que hace que valga el toque: confirmar da un sobre a los dos. */}
      {porConfirmar > 0 && (
        <div className="px-4 pt-3">
          <button
            onClick={() => navigate('/amistosas')}
            className="clip-hud flex w-full items-center gap-3 bg-swu-amber/15 px-4 py-3 text-left"
          >
            <BlasterIcon size={18} className="shrink-0 text-swu-amber" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-swu-text">
                {porConfirmar === 1
                  ? 'Tenés una partida por confirmar'
                  : `Tenés ${porConfirmar} partidas por confirmar`}
              </span>
              <span className="block text-[11px] text-swu-muted">
                Al confirmarla cuenta para el ranking y les da un sobre a los dos.
              </span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-swu-muted" />
          </button>
        </div>
      )}

      {/* Terminá tu perfil. Se dibuja solo si de verdad falta algo, y se calla
          solo si la persona lo pide. Va acá arriba —justo bajo la tarjeta que
          muestra el perfil incompleto— y no en /perfil: quien no encuentra la
          personalización tampoco va a entrar a buscarla. */}
      <AvisoPerfil />
      <AvisoUbicacion />

      {/* ── Acción principal ── */}
      <div className="px-4 pt-3 flex gap-3">
        <button onClick={() => navigate('/galaxia')} className="flex-1 min-w-0 active:scale-[0.98] transition-transform">
          <HudPanel tone="cyan" glow fill="bg-swu-cyan/[0.08]">
            <div className="relative flex items-center gap-3 px-3 py-3.5">
              <HudCorners tone="cyan" />
              <HexIcon tone="cyan" size={38}><StarfighterIcon size={17} aria-hidden /></HexIcon>
              {/* `min-w-0` y sin `nowrap`: un ítem flex arranca en
                  `min-width: auto` y no se deja encoger bajo su contenido; sin
                  esto el rótulo impone su ancho intrínseco y la fila se pasa del
                  teléfono (medido con «REGISTRAR DUELO»: +38 px a 320). Se deja
                  igual por si el rótulo crece. */}
              <span className="flex-1 min-w-0 text-left text-[13px] font-extrabold text-white tracking-wide leading-tight">
                LA GALAXIA
              </span>
              <ChevronRight size={16} className="text-swu-cyan flex-shrink-0" aria-hidden />
            </div>
          </HudPanel>
        </button>

        <button onClick={() => navigate('/scan')} className="w-[30%] flex-shrink-0 active:scale-[0.98] transition-transform">
          <HudPanel tone="neutral">
            <div className="relative flex flex-col items-center justify-center gap-1.5 px-2 py-3.5 h-full">
              <HudCorners tone="neutral" />
              <ScanLine size={20} className="text-swu-muted" aria-hidden />
              <span className="text-[9px] font-mono font-bold tracking-[0.15em] uppercase text-swu-muted text-center leading-tight">
                Escanear<br />carta
              </span>
            </div>
          </HudPanel>
        </button>
      </div>

      {/* ── Marcador ── */}
      {marcadores && (
        <div className="px-4 pt-3">
          <HudPanel tone="neutral">
            <div className="flex items-stretch">
              {marcadores.map((m, i) => {
                const Icon = m.icon
                return (
                  <div
                    key={m.label}
                    className={`flex-1 flex items-center gap-2.5 px-3 py-3 ${i > 0 ? 'border-l border-swu-border' : ''}`}
                  >
                    <HexIcon tone={m.tone} size={34}><Icon size={15} /></HexIcon>
                    <div className="min-w-0">
                      <p className="text-[9px] font-mono tracking-wider uppercase text-swu-muted truncate">
                        {m.label}
                      </p>
                      <p className={`text-xl font-extrabold font-mono leading-none ${HUD_TEXTO[m.tone]}`}>
                        {m.value}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </HudPanel>
        </div>
      )}

      {/* ── Módulos, por categoría ──
          Una franja por cada cosa que la persona VIENE A HACER (Jugar,
          Competir, Construir…), en vez de una sola cuadrícula plana. Cada
          categoría se dibuja solo si tiene al menos una casilla visible: sin
          sesión, «Jugar» igual muestra Contador y Amistosas, pero «Colección»
          —toda con auth— no aparece, y su separador tampoco. */}
      {CATEGORIAS.map(({ id, titulo, icono: IconoCat, tono }) => {
        const items = mainSystems.filter(
          s => s.cat === id && (!s.auth || currentProfile)
            && (!s.admin || isAdmin),
        )
        if (items.length === 0) return null
        // El chat de región cuenta como una casilla más: la cifra de la
        // cabecera tiene que decir lo que hay dentro, no lo que hay en el array.
        const conChat = id === 'comunidad' && !!supabaseUser
        return (
          <BahiaModulos
            key={id}
            titulo={tI(titulo, CAT_EN[titulo] ?? titulo)}
            icono={<IconoCat size={15} />}
            tono={tono}
            cantidad={items.length + (conChat ? 1 : 0)}
            abierta={bahias.has(id)}
            onAlternar={() => alternarBahia(id)}
          >
            {/* El chat de tu región va PRIMERO de Comunidad: es lo único de
                esa bahía que cambia solo y que tiene algo que decirte hoy.
                Se dibuja únicamente con sesión — sin cuenta no hay región. */}
            {conChat && <ChatRegion userId={supabaseUser?.id} />}
            {items.map(sys => <MosaicoModulo key={sys.label} sys={sys} />)}
          </BahiaModulos>
        )
      })}

      {/* ── Solo administradores ──
          Franja aparte, y solo para admins: ni el separador aparece para los
          demás. Junta lo del cuartel general (Transmisión, Panel) para no
          tenerlo desperdigado entre los módulos de todos. */}
      {isAdmin && (
        <>
          {renderSeparador('Solo administradores', 'amber')}
          <div className="px-4 pt-2 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {adminSystems.map(sys => <MosaicoModulo key={sys.label} sys={sys} />)}
          </div>
        </>
      )}

      {/* ── Mis herramientas ──
          Las que hasta hoy solo se alcanzaban tecleando el URL. Cada casilla
          sale con SU llave, no con `isAdmin`: el Centro de Temporada lo ve
          quien esté en `centro_curadores` y el espacio de creadores quien
          tenga fila en `creadores` — ser admin no alcanza para ninguna, y
          pintarlas con el rol le pondría a los otros admins dos botones que
          los echan al tocarlos. La franja entera desaparece si no queda
          ninguna: un separador solo es peor que nada. */}
      {(() => {
        const mias = HERRAMIENTAS_PROPIAS
          .filter(h => h.llave === 'curador' ? curador === true
                     : h.llave === 'plan'    ? (curador === true || typeof miCreador === 'string')
                     : typeof miCreador === 'string')
          .map(h => ({
            ...h,
            to: h.llave === 'creador' && typeof miCreador === 'string' ? `/c/${miCreador}` : h.to,
          }))
        if (mias.length === 0) return null
        return (
          <>
            {renderSeparador('Mis herramientas', 'cyan')}
            <div className="px-4 pt-2 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {mias.map(h => (
                <MosaicoModulo
                  key={h.label}
                  sys={{ icon: h.icon, label: h.label, tone: h.tone, to: h.to, externo: h.externo }}
                />
              ))}
            </div>
          </>
        )
      })()}

      {/* ── Próximos eventos ──
          Van PRIMERO de las tres secciones de abajo porque son lo único que
          CADUCA: una noticia sirve igual mañana, un torneo del sábado no. Si
          no hay ninguno, el componente no dibuja nada y esta franja no existe. */}
      <ProximosEventos />

      {/* ── Noticias ──
          Va DEBAJO de los módulos a propósito: quien abre la app viene a hacer
          algo —registrar un duelo, buscar una carta—, no a leer. Las noticias
          se encuentran al bajar, que es cuando uno tiene tiempo. */}
      {/* La tienda va ARRIBA de las noticias: para quien recién
          llega, «dónde consigo las cartas acá» pesa más que cualquier
          novedad del juego. */}
      <div className="px-4 pt-6">
        <DondeJugar />
      </div>

      <div className="px-4 pt-6">
        <NoticiasSection />

      {/* Algo nuevo cada mañana SIN inventar novedad: una carta del catálogo
          ya publicado, elegida por el día. No es un spoiler y no se rotula
          como tal — ver la cabecera del componente. */}
      <CartaDelDia />
      </div>
    </div>
  )
}

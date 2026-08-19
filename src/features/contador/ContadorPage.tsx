/**
 * CONTADOR — el teléfono en el medio de la mesa, como el de la app de FFG.
 *
 * Dos personas con cartas físicas ponen el teléfono entre las dos: la mitad de
 * arriba se dibuja ROTADA 180° para que quien está enfrente la lea derecha.
 * Cada mitad es la base del jugador con su vida en grande y los botones ±.
 *
 * ── Qué reusa (y por qué no inventa nada) ─────────────────────────────
 *
 * - Las BASES salen de la base local de cartas (91 canónicas, con vida e
 *   imagen). Nada de escribir «30» a mano: elegís la carta y la vida inicial
 *   es la impresa — Data Vault arranca en 33 porque la carta dice 33.
 * - Los MAZOS salen de Mis Decks: elegir un mazo trae su base y de paso pone
 *   al líder como avatar del lado.
 * - El 3D es `Carta3D`, el mismo de la vitrina: la base se inclina y brilla.
 * - El dado es `Dice3D` (three.js), heredado de las Utilidades viejas. La
 *   moneda se retiró — decisión de producto, ya no se usa.
 *
 * ── Decisiones de mesa real ───────────────────────────────────────────
 *
 * - **La pantalla no se apaga** mientras el duelo está abierto (Wake Lock, y
 *   si el navegador no lo trae, no pasa nada — se degrada en silencio).
 * - **Recargar no borra la partida**: el estado vive en localStorage y al
 *   volver pregunta si seguís el duelo o empezás otro. En una mesa de torneo,
 *   perder los totales por un toque accidental es perder la partida.
 * - **Deshacer**: cada cambio de vida queda en una pila. El dedo ajeno que
 *   marca −3 de más se corrige con un toque, no discutiendo.
 * - Mantener presionado ± repite: bajar 7 de vida no son 7 toques.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Swords, Dices, Undo2, Settings2, X, Search, Layers, Plus, Minus, RotateCcw,
  Timer, ScrollText, Trophy, History,
} from 'lucide-react'
import { CardImage } from '../../components/CardImage'
import { Carta3D } from '../../components/Carta3D'
import { Avatar } from '../../components/ui/Avatar'
import { Dice3D } from '../utilities/Dice3D'
import { db } from '../../services/db'
import { ensureCards } from '../../services/swuApi'
import { useAuth } from '../../hooks/useAuth'
import { supabase, isSupabaseReady } from '../../services/supabase'
import { searchProfiles, type SearchableProfile } from '../../services/playerSearch'
import { fechaCorta } from '../../services/horaSV'
import type { Card, Deck } from '../../types'

/* ── Estado persistido ───────────────────────────────────── */

interface LadoDuelo {
  /** 'a' es quien sostiene el teléfono; 'b' quien está enfrente. */
  baseNombre: string
  baseImg: string | null
  vidaInicial: number
  vida: number
  /** Partidas ganadas del duelo (mejor de 3). */
  victorias: number
  /** Nombre y arte del líder, si el lado vino de un mazo. */
  liderNombre: string | null
  liderImg: string | null
  /** Desplegado = el líder bajó a la mesa. Es el momento clave de una partida. */
  liderDesplegado: boolean
  /** La FOTO de perfil: la del dueño del teléfono o la del rival elegido. */
  avatar: string | null
  etiqueta: string
}

/**
 * Un movimiento de vida.
 *
 * Lleva `ronda` y `ts` porque cumple DOS funciones: deshacer y ser el registro
 * que se lee («R3: rival −4»). Un array de deltas pelados servía para lo
 * primero y no para lo segundo.
 */
interface Movimiento {
  lado: 'a' | 'b'
  delta: number
  ronda: number
  /** Epoch del ÚLTIMO toque del grupo: con eso se decide si el siguiente suma. */
  ts: number
}

interface Duelo {
  /** Lo genera el cliente para poder upsert el MISMO duelo mientras avanza. */
  id: string
  a: LadoDuelo
  b: LadoDuelo
  /** El contrincante elegido entre los usuarios de la app, si se eligió. */
  rival: { id: string; nombre: string; avatar: string } | null
  ronda: number
  iniciativa: 'a' | 'b' | null
  /** Movimientos de vida: deshacer + registro visible. */
  hist: Movimiento[]
  /** Juegos cerrados del mejor-de-3, en orden. */
  juegos: { ganador: 'a' | 'b' }[]
  /**
   * Reloj de ronda. Se guarda el INSTANTE de fin (epoch), no los segundos que
   * faltan: así recargar el teléfono no regala ni roba tiempo.
   */
  reloj: { finMs: number; minutos: number } | null
}

/** Segundos → «mm:ss», y «0:00» cuando ya se acabó (nunca en negativo). */
function mmss(seg: number): string {
  const s = Math.max(0, seg)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Toques seguidos dentro de esta ventana son UN movimiento. Ver `vida()`. */
const VENTANA_AGRUPADO = 1500

/** Vibración corta al tocar. Silenciosa donde no exista (iOS Safari). */
function vibrar(ms = 12) {
  try { navigator.vibrate?.(ms) } catch { /* sin soporte */ }
}

const CLAVE = 'contador_duelo_v1'

function guardar(d: Duelo) {
  try { localStorage.setItem(CLAVE, JSON.stringify(d)) } catch { /* lleno o bloqueado: se sigue sin persistir */ }
}
function cargar(): Duelo | null {
  try {
    const s = localStorage.getItem(CLAVE)
    if (!s) return null
    const d = JSON.parse(s) as Duelo
    // Lo mínimo para confiar en lo guardado: dos lados con vida numérica.
    if (typeof d?.a?.vida !== 'number' || typeof d?.b?.vida !== 'number') return null
    // Un duelo guardado ANTES de que existieran el id, el rival y los avatares
    // se completa acá: sin esto, reanudarlo intentaba subir a la nube con id
    // undefined y el upsert fallaba en silencio (bueno, en console.warn).
    if (!d.id) d.id = crypto.randomUUID()
    if (d.rival === undefined) d.rival = null
    for (const l of [d.a, d.b]) {
      if (l.avatar === undefined) l.avatar = null
      if (l.liderNombre === undefined) l.liderNombre = null
      if (l.liderDesplegado === undefined) l.liderDesplegado = false
    }
    if (!Array.isArray(d.juegos)) d.juegos = []
    if (d.reloj === undefined) d.reloj = null
    // Los movimientos viejos no traían ronda ni ts: se completan para que el
    // registro no muestre huecos y el agrupado no compare contra `undefined`.
    d.hist = (Array.isArray(d.hist) ? d.hist : []).map(m => ({
      lado: m.lado, delta: m.delta,
      ronda: typeof m.ronda === 'number' ? m.ronda : 1,
      ts: typeof m.ts === 'number' ? m.ts : 0,
    }))
    return d
  } catch { return null }
}
function borrar() {
  try { localStorage.removeItem(CLAVE) } catch { /* nada */ }
}

/* ── La mitad de un jugador ──────────────────────────────── */

function MitadJugador({
  lado, invertida, conIniciativa, onVida, onIniciativa, onVictorias, onDesplegarLider,
}: {
  lado: LadoDuelo
  invertida: boolean
  conIniciativa: boolean
  onVida: (delta: number) => void
  onIniciativa: () => void
  onVictorias: (n: number) => void
  onDesplegarLider: () => void
}) {
  const pct = lado.vidaInicial > 0 ? lado.vida / lado.vidaInicial : 0
  const colorVida = lado.vida === 0 ? 'text-swu-red' : pct <= 0.34 ? 'text-swu-coral' : pct <= 0.67 ? 'text-swu-amber' : 'text-white'

  // Mantener presionado repite. `pointerdown` aplica el primer cambio al
  // instante; si el dedo sigue, a los 450 ms arranca la ráfaga. Todo se corta
  // en up/leave/cancel — sin esto, un dedo que se desliza deja el botón
  // «pegado» restando vida solo.
  const temporizador = useRef<{ espera?: number; rafaga?: number }>({})
  const empezar = useCallback((delta: number) => {
    // Vibra en cada cambio: con el teléfono lejos y reflejos de luz no siempre
    // se ve si el toque entró, y el pulso lo confirma sin mirar.
    vibrar()
    onVida(delta)
    temporizador.current.espera = window.setTimeout(() => {
      temporizador.current.rafaga = window.setInterval(() => { vibrar(8); onVida(delta) }, 140)
    }, 450)
  }, [onVida])
  const parar = useCallback(() => {
    window.clearTimeout(temporizador.current.espera)
    window.clearInterval(temporizador.current.rafaga)
  }, [])
  useEffect(() => parar, [parar])

  return (
    <div className={`relative flex-1 min-h-0 overflow-hidden ${invertida ? 'rotate-180' : ''}`}>
      {/* La base, en 3D y de fondo. `alAbrir` le da el reflejo de presentación
          y el brillo de reposo — es la misma carta física que está en la mesa. */}
      <div className="absolute inset-2 flex items-center justify-center">
        <Carta3D alAbrir brillo className="w-full max-w-md">
          <div className="relative">
            <CardImage
              src={lado.baseImg ?? undefined}
              alt={lado.baseNombre}
              orientacion="apaisada"
              fit="cover"
              className="w-full aspect-[400/286] rounded-2xl opacity-80"
            />
            {/* Velo para que la cifra gane SIEMPRE el contraste sobre el arte.
                El velo plano al 35 % alcanzaba con artes oscuras y no con las
                claras: la vida en ámbar sobre la roca beige de Coaxium Mine
                quedaba casi ilegible. Encima va una cama radial centrada donde
                vive la cifra —oscura en el centro, nula en los bordes—, así el
                número tiene fondo garantizado sea cual sea la base y el arte
                se sigue viendo alrededor. */}
            <div className="absolute inset-0 rounded-2xl bg-black/35" />
            <div className="absolute inset-0 rounded-2xl
                            bg-[radial-gradient(ellipse_42%_52%_at_50%_50%,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.45)_55%,transparent_100%)]" />
          </div>
        </Carta3D>
      </div>

      {/* Nombre de la base + vida inicial, como el rótulo de la carta. */}
      <div className="absolute top-2 inset-x-0 flex items-center justify-center gap-2 pointer-events-none">
        <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-white backdrop-blur">
          {lado.baseNombre}
        </span>
        <span className="rounded-full bg-swu-cyan/25 border border-swu-cyan/50 px-2 py-1 text-[11px] font-mono font-bold text-swu-cyan backdrop-blur">
          {lado.vidaInicial}
        </span>
      </div>

      {/* Victorias del duelo (mejor de 3): dos puntos que se tocan. */}
      <div className="absolute top-2 right-2 flex gap-1.5">
        {[1, 2].map(n => (
          <button
            key={n}
            aria-label={`Marcar ${n} partida${n > 1 ? 's' : ''} ganada${n > 1 ? 's' : ''}`}
            onClick={() => onVictorias(lado.victorias === n ? n - 1 : n)}
            className={`h-4 w-4 rounded-full border transition-colors ${
              lado.victorias >= n ? 'bg-swu-amber border-swu-amber' : 'border-white/40 bg-black/40'
            }`}
          />
        ))}
      </div>

      {/* − VIDA + .
          La zona TOCABLE es el tercio entero de cada lado, no el botón: con el
          teléfono en el medio de la mesa se toca de lejos y en ángulo, y un
          blanco de 80 px se falla. El círculo queda de señal visual (no recibe
          eventos: los toma el tercio que lo contiene). El tercio del medio no
          es tocable a propósito — ahí vive la cifra y un toque suelto no debe
          mover la vida de nadie. */}
      <div className="absolute inset-0 flex">
        <button
          aria-label="Restar vida"
          onPointerDown={() => empezar(-1)}
          onPointerUp={parar} onPointerLeave={parar} onPointerCancel={parar}
          className="flex-1 flex items-center justify-center active:bg-white/5 transition-colors"
        >
          {/* El rojo va en el MENOS. `--color-swu-red` está documentado en
              index.css como «destructivo», y lo destructivo acá es perder vida;
              además es el botón que se toca casi siempre, así que el color
              fuerte tiene que estar donde va el pulgar, no en la corrección. */}
          <span className="pointer-events-none h-20 w-20 rounded-full border-4 border-swu-red/80 bg-black/45 text-swu-red
                           flex items-center justify-center backdrop-blur-sm">
            <Minus size={34} strokeWidth={3} />
          </span>
        </button>
        <div className="flex-1 flex items-center justify-center pointer-events-none">
          <span className={`text-[88px] leading-none font-black tabular-nums drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] ${colorVida}`}>
            {lado.vida}
          </span>
        </div>
        <button
          aria-label="Sumar vida"
          onPointerDown={() => empezar(1)}
          onPointerUp={parar} onPointerLeave={parar} onPointerCancel={parar}
          className="flex-1 flex items-center justify-center active:bg-white/5 transition-colors"
        >
          <span className="pointer-events-none h-20 w-20 rounded-full border-4 border-white/70 bg-black/45 text-white
                           flex items-center justify-center backdrop-blur-sm">
            <Plus size={34} strokeWidth={3} />
          </span>
        </button>
      </div>

      {/* Avatar + ficha de iniciativa, en la esquina que mira al centro.
          El avatar es la FOTO DE PERFIL (la propia o la del rival elegido);
          el arte del líder queda de respaldo si el lado vino de un mazo. */}
      <div className="absolute bottom-2 left-2 flex items-center gap-2">
        <div className="h-11 w-11 rounded-full overflow-hidden border-2 border-swu-cyan/60 bg-swu-bg">
          {lado.avatar
            ? <Avatar avatar={lado.avatar} size={40} caja="redondeada" />
            : lado.liderImg
              ? <img src={lado.liderImg} alt="" className="h-full w-full object-cover object-left" />
              : <Avatar avatar={lado.etiqueta === 'Vos' ? '🧑‍🚀' : '⚔️'} size={40} caja="redondeada" />}
        </div>
        {/* La ficha de iniciativa del juego real: el chip oscuro con el logo.
            Quien la tiene la ve encendida; un toque la toma o la suelta. */}
        <button
          // La ficha y la ronda se tocan SIN mirar —el teléfono está plano en la
          // mesa y vos estás viendo cartas—, así que son las dos que más
          // necesitan el acuse al tacto. Eran justo las dos que no lo tenían.
          onClick={() => { vibrar(); onIniciativa() }}
          aria-label="Tomar la iniciativa"
          className={`relative h-12 w-12 rounded-xl border-2 overflow-hidden
                      transition-[border-color,box-shadow,opacity] duration-150
                      bg-[#0a1020] flex items-center justify-center ${
            conIniciativa
              ? 'border-swu-amber shadow-[0_0_14px_rgba(245,158,11,0.55)] opacity-100'
              : 'border-white/20 opacity-40'
          }`}
        >
          <img src="/swu-logo-title.png" alt="Ficha de iniciativa" className="h-9 w-9 object-contain" />
        </button>
        {/* El líder, si el lado vino de un mazo. Un toque lo despliega: es el
            momento que cambia la partida y el que más se olvida de marcar. */}
        {lado.liderNombre && (
          <button
            onClick={() => { vibrar(); onDesplegarLider() }}
            aria-label={lado.liderDesplegado ? 'Replegar el líder' : 'Desplegar el líder'}
            // `transition-all` animaba trece propiedades —los cuatro radios y
            // los cuatro paddings incluidos— cuando lo único que cambia es
            // color, sombra y opacidad. Se nombran las que cambian.
            className={`flex items-center gap-1.5 rounded-full border pl-1 pr-2 py-1 transition-[color,background-color,border-color,box-shadow,opacity] duration-150 ${
              lado.liderDesplegado
                ? 'border-swu-cyan bg-swu-cyan/20 shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                : 'border-white/20 bg-black/40 opacity-60'
            }`}
          >
            {lado.liderImg
              ? <img src={lado.liderImg} alt="" className="h-6 w-6 rounded-full object-cover object-left" />
              : <span className="h-6 w-6 rounded-full bg-swu-bg" />}
            <span className={`text-[9px] font-bold ${lado.liderDesplegado ? 'text-swu-cyan' : 'text-white/60'}`}>
              {lado.liderDesplegado ? 'EN MESA' : 'LÍDER'}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Elegir base o mazo para un lado ─────────────────────── */

function SelectorLado({
  titulo, bases, decks, elegido, onElegir,
}: {
  titulo: string
  bases: Card[]
  decks: Deck[]
  elegido: { base: Card; lider: Card | null } | null
  onElegir: (base: Card, lider: Card | null) => void
}) {
  const [pestana, setPestana] = useState<'base' | 'mazo'>('base')
  const [filtro, setFiltro] = useState('')

  const filtradas = useMemo(() => {
    const f = filtro.trim().toLowerCase()
    const lista = f ? bases.filter(b => b.name.toLowerCase().includes(f)) : bases
    return lista.slice(0, 24)
  }, [bases, filtro])

  return (
    <div className="rounded-2xl border border-swu-border bg-swu-surface p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-swu-text">{titulo}</p>
        {elegido && (
          <span className="text-[11px] font-mono text-swu-cyan truncate">
            {elegido.base.name} · {elegido.base.hp} de vida
          </span>
        )}
      </div>

      <div className="flex gap-1.5">
        {([['base', 'Buscar base', Search], ['mazo', 'Mis mazos', Layers]] as const).map(([id, rotulo, Icono]) => (
          <button
            key={id}
            onClick={() => setPestana(id)}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              pestana === id ? 'border-swu-cyan/60 bg-swu-cyan/15 text-swu-cyan' : 'border-swu-border text-swu-muted'
            }`}
          >
            <Icono size={11} /> {rotulo}
          </button>
        ))}
      </div>

      {pestana === 'base' && (
        <>
          <input
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            placeholder="Nombre de la base…"
            className="w-full rounded-lg border border-swu-border bg-swu-bg px-3 py-2 text-sm text-swu-text
                       placeholder:text-swu-muted focus:outline-none focus:ring-2 focus:ring-swu-accent"
          />
          <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
            {filtradas.map(b => (
              <button
                key={b.id}
                onClick={() => onElegir(b, null)}
                className={`relative rounded-lg overflow-hidden border-2 text-left ${
                  elegido?.base.id === b.id ? 'border-swu-cyan' : 'border-transparent'
                }`}
              >
                <CardImage src={b.imageUrl} alt={b.name} orientacion="apaisada" fit="cover"
                  className="w-full aspect-[400/286]" />
                <span className="absolute bottom-0 inset-x-0 bg-black/70 px-1 py-0.5 text-[9px] text-white truncate">
                  {b.name} · {b.hp}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {pestana === 'mazo' && (
        decks.length === 0
          ? <p className="text-[12px] text-swu-muted">No hay mazos guardados en este dispositivo.</p>
          : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {decks.map(d => (
                <button
                  key={d.id}
                  onClick={async () => {
                    // El mazo guarda su base como DeckCard; la carta completa
                    // (imagen, vida impresa) sale de la base local.
                    const base = d.base ? await db.cards.get(d.base.cardId) : null
                    const lider = d.leaders?.[0] ? await db.cards.get(d.leaders[0].cardId) : null
                    if (base) onElegir(base, lider ?? null)
                  }}
                  className="w-full rounded-lg border border-swu-border bg-swu-bg px-3 py-2 text-left"
                >
                  <p className="text-[13px] font-semibold text-swu-text truncate">{d.name}</p>
                  <p className="text-[10px] text-swu-muted truncate">
                    {d.leaders?.[0]?.name ?? '—'} · {d.base?.name ?? 'sin base'}
                  </p>
                </button>
              ))}
            </div>
          )
      )}
    </div>
  )
}

/* ── Pantalla ────────────────────────────────────────────── */

export function ContadorPage() {
  const navigate = useNavigate()
  const { currentProfile, supabaseUser } = useAuth()

  const [duelo, setDuelo] = useState<Duelo | null>(null)
  // Inicializador perezoso y no un efecto: leer localStorage es síncrono y
  // hacerlo en el efecto encadenaba un render extra (regla del lint).
  const [reanudable, setReanudable] = useState<Duelo | null>(() => cargar())
  const [bases, setBases] = useState<Card[]>([])
  const [decks, setDecks] = useState<Deck[]>([])
  const [ladoA, setLadoA] = useState<{ base: Card; lider: Card | null } | null>(null)
  const [ladoB, setLadoB] = useState<{ base: Card; lider: Card | null } | null>(null)
  const [dado, setDado] = useState<{ abierto: boolean; valores: number[]; tirada: number }>({ abierto: false, valores: [1], tirada: 0 })
  const [ajustes, setAjustes] = useState(false)
  /** ¿Está preguntando quién ganó antes de cerrar? */
  const [cerrando, setCerrando] = useState(false)
  const [registro, setRegistro] = useState(false)
  const [relojPanel, setReloj] = useState(false)
  /** (3) «Mis duelos»: el historial guardado, que hasta ahora no se veía. */
  const [historial, setHistorial] = useState<{
    id: string; conQuien: string; mias: number; suyas: number; bases: string; cuando: string
  }[] | null>(null)
  const [verHistorial, setVerHistorial] = useState(false)
  /** Lado que ya se ofreció cerrar: no volver a preguntar hasta que reviva. */
  const [cierreOfrecido, setCierreOfrecido] = useState<'a' | 'b' | null>(null)
  /**
   * El «ahora» del reloj, en el ESTADO y no leído en el render.
   *
   * `Date.now()` dentro del render es impuro: el mismo estado daría pantallas
   * distintas y React puede re-renderizar cuando quiera. Acá el tiempo entra
   * por el mismo camino que todo lo demás — un `setState` cada segundo.
   */
  const [ahora, setAhora] = useState(() => Date.now())
  // El contrincante: se busca entre los usuarios de la app. Elegirlo es lo que
  // vuelve el duelo un cara-a-cara con historial; sin elegirlo el duelo se
  // guarda igual, como «Invitado».
  const [rival, setRival] = useState<SearchableProfile | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [candidatos, setCandidatos] = useState<SearchableProfile[]>([])
  // Etiquetado con el id del rival: así cambiar de rival no exige «limpiar» el
  // estado en el efecto (la regla del lint) — el render solo lo usa si coincide.
  const [caraACara, setCaraACara] = useState<{ rivalId: string; duelos: number; ganados: number; perdidos: number } | null>(null)

  // Datos: las 91 bases canónicas y los mazos del dispositivo.
  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        await ensureCards()
        const todas = await db.cards.where('type').equals('Base').toArray()
        const canon = todas
          .filter(b => b.isCanonical !== false && typeof b.hp === 'number')
          .sort((x, y) => x.name.localeCompare(y.name))
        const misDecks = await db.decks.toArray()
        if (!vivo) return
        setBases(canon)
        setDecks(misDecks.sort((x, y) => (y.updatedAt ?? 0) - (x.updatedAt ?? 0)))
      } catch { /* sin base local la búsqueda queda vacía; el error se ve en la lista */ }
    })()
    return () => { vivo = false }
  }, [])

  // La pantalla no se apaga con el duelo abierto. Si el navegador no trae
  // Wake Lock (Firefox viejo), simplemente no pasa — la mesa sigue.
  useEffect(() => {
    if (!duelo) return
    let candado: { release?: () => Promise<void> } | null = null
    const pedir = async () => {
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock
        if (wl) candado = await wl.request('screen')
      } catch { /* denegado o sin soporte */ }
    }
    void pedir()
    // Al volver de un cambio de pestaña el candado se suelta solo: se repide.
    const alVolver = () => { if (document.visibilityState === 'visible') void pedir() }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      void candado?.release?.()
    }
  }, [duelo])

  // Búsqueda de contrincante, con un pequeño respiro para no consultar por tecla.
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (busqueda.trim().length < 2) { setCandidatos([]); return }
      void searchProfiles(busqueda).then(r =>
        setCandidatos(r.filter(p => p.id !== supabaseUser?.id)))
    }, 250)
    return () => window.clearTimeout(id)
  }, [busqueda, supabaseUser?.id])

  // El cara-a-cara contra el rival elegido, EN LAS DOS DIRECCIONES: los duelos
  // que yo guardé contra él y los que él guardó contra mí.
  useEffect(() => {
    if (!rival || !supabaseUser || !isSupabaseReady()) return
    let vivo = true
    void (async () => {
      const { data, error } = await supabase
        .from('duelos_amistosos')
        .select('creador_id, victorias_creador, victorias_rival, terminado')
        .or(`and(creador_id.eq.${supabaseUser.id},rival_id.eq.${rival.id}),and(creador_id.eq.${rival.id},rival_id.eq.${supabaseUser.id})`)
        .eq('terminado', true)
      if (!vivo || error || !data) return
      let g = 0, p = 0
      for (const d of data) {
        const mias = d.creador_id === supabaseUser.id ? d.victorias_creador : d.victorias_rival
        const suyas = d.creador_id === supabaseUser.id ? d.victorias_rival : d.victorias_creador
        if (mias > suyas) g++
        else if (suyas > mias) p++
      }
      setCaraACara({ rivalId: rival.id, duelos: data.length, ganados: g, perdidos: p })
    })()
    return () => { vivo = false }
  }, [rival, supabaseUser])

  /**
   * El duelo sube a la nube con calma (800 ms tras el último cambio) y SOLO
   * campos de resultado. Es fire-and-forget: la mesa no espera a la red. Y es
   * un duelo AMISTOSO por contrato — la tabla no tiene triggers ni toca
   * player_stats: el ranking no se entera (pedido explícito).
   */
  const subidaRef = useRef<number>(0)
  const subir = useCallback((d: Duelo) => {
    if (!supabaseUser || !isSupabaseReady()) return
    window.clearTimeout(subidaRef.current)
    subidaRef.current = window.setTimeout(() => {
      void supabase.from('duelos_amistosos').upsert({
        id: d.id,
        creador_id: supabaseUser.id,
        rival_id: d.rival?.id ?? null,
        rival_nombre: d.rival?.nombre ?? 'Invitado',
        base_creador: d.a.baseNombre,
        base_rival: d.b.baseNombre,
        victorias_creador: d.a.victorias,
        victorias_rival: d.b.victorias,
        rondas: d.ronda,
        updated_at: new Date().toISOString(),
      }).then(({ error }) => {
        // Gotcha 2f: supabase-js no lanza; sin mirar `error` el fallo es invisible.
        if (error) console.warn('[Contador] no se pudo guardar el duelo:', error.message)
      })
    }, 800)
  }, [supabaseUser])

  // El reloj se repinta cada segundo. El estado NO guarda los segundos que
  // faltan (guarda el instante de fin), así que este tic solo fuerza el render.
  useEffect(() => {
    if (!duelo?.reloj) return
    // El primer refresco va DENTRO del intervalo, no en el cuerpo del efecto:
    // un `setState` síncrono ahí encadena un render (regla del lint). El
    // desfase máximo es de un segundo en un reloj de 50 minutos.
    const id = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [duelo?.reloj])

  // (3) El historial completo, de LOS DOS LADOS: los duelos que guardé y
  // aquellos donde yo fui el rival (esos ya se podían leer por RLS y nadie
  // los mostraba). Se carga al abrir el panel, no al entrar a la pantalla.
  useEffect(() => {
    if (!verHistorial || !supabaseUser || !isSupabaseReady()) return
    let vivo = true
    void (async () => {
      const { data, error } = await supabase
        .from('duelos_amistosos')
        .select('id, creador_id, rival_id, rival_nombre, base_creador, base_rival, victorias_creador, victorias_rival, created_at, terminado')
        .or(`creador_id.eq.${supabaseUser.id},rival_id.eq.${supabaseUser.id}`)
        .eq('terminado', true)
        .order('created_at', { ascending: false })
        .limit(30)
      if (!vivo) return
      if (error || !data) { setHistorial([]); return }
      // El nombre de quien creó el duelo no viaja en la fila; cuando yo fui el
      // rival se resuelve contra los perfiles en una sola consulta.
      const ajenos = [...new Set(data.filter(d => d.creador_id !== supabaseUser.id).map(d => d.creador_id))]
      const nombres = new Map<string, string>()
      if (ajenos.length) {
        const { data: perfiles } = await supabase.from('profiles').select('id, name').in('id', ajenos)
        for (const p of perfiles ?? []) nombres.set(p.id, p.name)
      }
      if (!vivo) return
      setHistorial(data.map(d => {
        const yoCree = d.creador_id === supabaseUser.id
        return {
          id: d.id,
          conQuien: yoCree ? (d.rival_nombre || 'Invitado') : (nombres.get(d.creador_id) ?? 'Alguien'),
          mias: yoCree ? d.victorias_creador : d.victorias_rival,
          suyas: yoCree ? d.victorias_rival : d.victorias_creador,
          bases: yoCree ? `${d.base_creador} vs ${d.base_rival}` : `${d.base_rival} vs ${d.base_creador}`,
          cuando: fechaCorta(d.created_at),
        }
      }))
    })()
    return () => { vivo = false }
  }, [verHistorial, supabaseUser])

  const cambiar = useCallback((fn: (d: Duelo) => Duelo) => {
    setDuelo(actual => {
      if (!actual) return actual
      const nuevo = fn(actual)
      guardar(nuevo)
      subir(nuevo)
      return nuevo
    })
  }, [subir])

  /**
   * Cambiar vida, AGRUPANDO los toques seguidos.
   *
   * Antes cada tick era una entrada: mantener presionado y bajar 7 de vida
   * dejaba 7 entradas y deshacer pedía 7 toques. En la mesa el caso real es
   * «me pasé por un gesto», y un gesto tiene que deshacerse de una. Se funde
   * con la última entrada si es el MISMO lado, la MISMA ronda y dentro de
   * `VENTANA_AGRUPADO`; si el grupo vuelve a cero, se descarta entero.
   */
  const vida = useCallback((lado: 'a' | 'b', delta: number) => {
    cambiar(d => {
      const v = Math.max(0, Math.min(99, d[lado].vida + delta))
      const real = v - d[lado].vida
      if (real === 0) return d
      const ahora = Date.now()
      const ultimo = d.hist[d.hist.length - 1]
      const sigue = ultimo && ultimo.lado === lado && ultimo.ronda === d.ronda
        && ahora - ultimo.ts <= VENTANA_AGRUPADO
      let hist: Movimiento[]
      if (sigue) {
        const fundido = { ...ultimo, delta: ultimo.delta + real, ts: ahora }
        hist = fundido.delta === 0 ? d.hist.slice(0, -1) : [...d.hist.slice(0, -1), fundido]
      } else {
        hist = [...d.hist.slice(-49), { lado, delta: real, ronda: d.ronda, ts: ahora }]
      }
      return { ...d, [lado]: { ...d[lado], vida: v }, hist }
    })
  }, [cambiar])

  const deshacer = useCallback(() => {
    cambiar(d => {
      const ultimo = d.hist[d.hist.length - 1]
      if (!ultimo) return d
      return {
        ...d,
        [ultimo.lado]: { ...d[ultimo.lado], vida: Math.max(0, d[ultimo.lado].vida - ultimo.delta) },
        hist: d.hist.slice(0, -1),
      }
    })
  }, [cambiar])

  /**
   * Cierra el juego del mejor-de-3: anota el punto y deja la mesa lista.
   *
   * Antes esto eran tres toques sueltos (marcar el punto, reiniciar vidas,
   * volver la ronda a 1) y era fácil olvidarse del punto — justo el dato que
   * alimenta el cara-a-cara. El reloj NO se reinicia: en torneo la ronda es
   * una sola para los tres juegos.
   */
  const cerrarJuego = useCallback((ganador: 'a' | 'b') => {
    cambiar(d => ({
      ...d,
      [ganador]: { ...d[ganador], victorias: Math.min(2, d[ganador].victorias + 1) },
      a: { ...(ganador === 'a' ? { ...d.a, victorias: Math.min(2, d.a.victorias + 1) } : d.a), vida: d.a.vidaInicial, liderDesplegado: false },
      b: { ...(ganador === 'b' ? { ...d.b, victorias: Math.min(2, d.b.victorias + 1) } : d.b), vida: d.b.vidaInicial, liderDesplegado: false },
      juegos: [...d.juegos, { ganador }],
      ronda: 1,
      iniciativa: null,
      hist: [],
    }))
  }, [cambiar])

  const reloj = useCallback((minutos: number | null) => {
    // `ahora` solo lo refresca el intervalo, y el intervalo solo corre cuando ya
    // hay reloj: al arrancarlo, el primer pintado usaba un `ahora` congelado
    // desde el montaje y mostraba de más (medido: 33:58 al pedir 30 min, cuatro
    // minutos después de abrir el duelo). Se pone en hora en el mismo tic.
    setAhora(Date.now())
    cambiar(d => ({
      ...d,
      reloj: minutos === null ? null : { finMs: Date.now() + minutos * 60_000, minutos },
    }))
  }, [cambiar])

  const empezar = useCallback((a: { base: Card; lider: Card | null }, b: { base: Card; lider: Card | null }) => {
    const lado = (x: { base: Card; lider: Card | null }, etiqueta: string, avatar: string | null): LadoDuelo => ({
      baseNombre: x.base.name,
      baseImg: x.base.imageUrl ?? null,
      vidaInicial: x.base.hp ?? 30,
      vida: x.base.hp ?? 30,
      victorias: 0,
      liderNombre: x.lider?.name ?? null,
      liderImg: x.lider?.imageUrl ?? null,
      liderDesplegado: false,
      avatar,
      etiqueta,
    })
    const d: Duelo = {
      id: crypto.randomUUID(),
      a: lado(a, 'Vos', currentProfile?.avatar ?? null),
      b: lado(b, rival?.name ?? 'Rival', rival?.avatar ?? null),
      rival: rival ? { id: rival.id, nombre: rival.name, avatar: rival.avatar } : null,
      ronda: 1,
      iniciativa: null,
      hist: [],
      juegos: [],
      reloj: null,
    }
    guardar(d)
    subir(d)
    setDuelo(d)
    setReanudable(null)
  }, [currentProfile?.avatar, rival, subir])

  /**
   * Cierra el duelo con un marcador CONCRETO.
   *
   * Antes esto subía lo que hubiera, y lo que hay casi siempre es 0-0: medido
   * en producción, 6 de los 12 duelos están así porque el Contador se usa para
   * llevar la VIDA y nadie marca quién ganó el juego. Y de ahí cuelga todo —el
   * ranking, el meta nacional y los sobres salen de las amistosas confirmadas—,
   * así que ese 0-0 es la fuga de datos más cara de la app.
   */
  const cerrarCon = useCallback((victoriasA: number, victoriasB: number) => {
    if (duelo && supabaseUser && isSupabaseReady()) {
      window.clearTimeout(subidaRef.current)
      void supabase.from('duelos_amistosos').upsert({
        id: duelo.id,
        creador_id: supabaseUser.id,
        rival_id: duelo.rival?.id ?? null,
        rival_nombre: duelo.rival?.nombre ?? 'Invitado',
        base_creador: duelo.a.baseNombre,
        base_rival: duelo.b.baseNombre,
        victorias_creador: victoriasA,
        victorias_rival: victoriasB,
        rondas: duelo.ronda,
        terminado: true,
        updated_at: new Date().toISOString(),
      }).then(({ error }) => {
        if (error) console.warn('[Contador] no se pudo cerrar el duelo:', error.message)
      })
    }
    borrar()
    setDuelo(null)
    setAjustes(false)
    setCerrando(false)
    setLadoA(null); setLadoB(null)
    setRival(null); setBusqueda('')
  }, [duelo, supabaseUser])

  /**
   * El botón de terminar. Si nadie marcó quién ganó, PREGUNTA antes de cerrar.
   *
   * Se pregunta y no se obliga: «no lo anotamos» sigue siendo una respuesta
   * válida, porque forzar una respuesta hace que la gente invente una y un
   * marcador inventado es peor que ninguno. Pero preguntarlo cambia el caso por
   * defecto — antes había que acordarse de marcar ANTES de cerrar, y nadie se
   * acordaba.
   */
  const terminar = useCallback(() => {
    if (duelo && duelo.a.victorias === 0 && duelo.b.victorias === 0) {
      setCerrando(true)
      return
    }
    cerrarCon(duelo?.a.victorias ?? 0, duelo?.b.victorias ?? 0)
  }, [duelo, cerrarCon])

  /* ── El duelo en curso: pantalla completa, por encima de la TabBar ── */
  if (duelo) {
    // Segundos que faltan. Se calcula del instante de fin guardado, así que
    // recargar el teléfono no regala ni roba tiempo.
    const restante = duelo.reloj ? Math.round((duelo.reloj.finMs - ahora) / 1000) : 0
    // ¿Alguien está en 0? Se ofrece cerrar el juego UNA vez por caída.
    const caido: 'a' | 'b' | null = duelo.a.vida === 0 ? 'a' : duelo.b.vida === 0 ? 'b' : null
    const ofrecerCierre = caido !== null && cierreOfrecido !== caido && duelo.juegos.length < 3
    const ganadorDelJuego: 'a' | 'b' | null = caido === 'a' ? 'b' : caido === 'b' ? 'a' : null
    const nombreDe = (l: 'a' | 'b') => (l === 'a' ? 'Vos' : duelo.rival?.nombre ?? 'Rival')
    // «Vos» no concuerda con la tercera persona: «Vos gana el juego» y «la base
    // de Vos» son las dos frases que salían. En voseo el lado propio va en
    // segunda persona y el rival en tercera.
    const fraseGana = (l: 'a' | 'b') =>
      l === 'a' ? 'Ganaste el juego' : `${nombreDe(l)} gana el juego`
    const fraseBase = (l: 'a' | 'b') =>
      l === 'a' ? 'Tu base' : `La base de ${nombreDe(l)}`
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-[#060913]">
        <MitadJugador
          lado={duelo.b} invertida conIniciativa={duelo.iniciativa === 'b'}
          onVida={d => vida('b', d)}
          onIniciativa={() => cambiar(x => ({ ...x, iniciativa: x.iniciativa === 'b' ? null : 'b' }))}
          onVictorias={n => cambiar(x => ({ ...x, b: { ...x.b, victorias: n } }))}
          onDesplegarLider={() => cambiar(x => ({ ...x, b: { ...x.b, liderDesplegado: !x.b.liderDesplegado } }))}
        />

        {/* La barra del medio: las herramientas de la referencia, mejoradas. */}
        <div className="relative z-10 flex items-center justify-center gap-3 border-y border-white/10 bg-black/60 px-3 py-2 backdrop-blur">
          <button
            onClick={() => { vibrar(); cambiar(x => ({ ...x, ronda: x.ronda + 1 })) }}
            className="rounded-full border border-swu-cyan/50 bg-swu-cyan/10 px-3 py-1.5 text-[12px] font-mono font-bold text-swu-cyan"
            aria-label="Siguiente ronda"
          >
            RONDA {duelo.ronda}
          </button>
          <button
            onClick={deshacer}
            disabled={duelo.hist.length === 0}
            aria-label="Deshacer el último cambio de vida"
            className="rounded-full border border-white/20 bg-white/5 p-2 text-white disabled:opacity-30"
          >
            <Undo2 size={16} />
          </button>
          {/* Reloj de ronda: el torneo juega a 50 min y practicar sin reloj es
              practicar otro juego. Se pinta ámbar en los últimos 5 y rojo al
              acabarse; no suena ni bloquea nada — avisa. */}
          <button
            onClick={() => setReloj(true)}
            aria-label="Reloj de ronda"
            className={`rounded-full border px-2.5 py-1.5 text-[12px] font-mono font-bold ${
              !duelo.reloj ? 'border-white/20 bg-white/5 text-white/70'
                : restante <= 0 ? 'border-swu-red bg-swu-red/20 text-swu-red'
                : restante <= 300 ? 'border-swu-amber bg-swu-amber/20 text-swu-amber'
                : 'border-white/20 bg-white/5 text-white'
            }`}
          >
            {duelo.reloj ? mmss(restante) : <Timer size={16} />}
          </button>
          <button
            onClick={() => setRegistro(true)}
            aria-label="Registro de la partida"
            className="rounded-full border border-white/20 bg-white/5 p-2 text-white"
          >
            <ScrollText size={16} />
          </button>
          <button
            onClick={() => setDado(d => ({ ...d, abierto: true }))}
            aria-label="Tirar dados"
            className="rounded-full border border-white/20 bg-white/5 p-2 text-white"
          >
            <Dices size={16} />
          </button>
          <button
            onClick={() => setAjustes(true)}
            aria-label="Ajustes del duelo"
            className="rounded-full border border-white/20 bg-white/5 p-2 text-white"
          >
            <Settings2 size={16} />
          </button>
        </div>

        <MitadJugador
          lado={duelo.a} invertida={false} conIniciativa={duelo.iniciativa === 'a'}
          onVida={d => vida('a', d)}
          onIniciativa={() => cambiar(x => ({ ...x, iniciativa: x.iniciativa === 'a' ? null : 'a' }))}
          onVictorias={n => cambiar(x => ({ ...x, a: { ...x.a, victorias: n } }))}
          onDesplegarLider={() => cambiar(x => ({ ...x, a: { ...x.a, liderDesplegado: !x.a.liderDesplegado } }))}
        />

        {/* (2) Alguien llegó a 0: se ofrece cerrar el juego. Antes la vida
            llegaba a cero, se pintaba roja y no pasaba nada — el punto del
            mejor-de-3 había que acordarse de marcarlo a mano, y ese es
            justamente el dato que alimenta el cara-a-cara. */}
        {ofrecerCierre && ganadorDelJuego && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-6">
            <div className="w-full max-w-sm rounded-2xl border border-swu-amber/50 bg-swu-surface p-4 text-center">
              <Trophy size={26} className="mx-auto mb-2 text-swu-amber" />
              <p className="text-base font-bold text-swu-text">
                {fraseGana(ganadorDelJuego)}
              </p>
              <p className="mt-1 text-[11px] text-swu-muted">
                {fraseBase(caido!)} llegó a 0. Se anota el punto y las vidas vuelven a su valor inicial.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setCierreOfrecido(caido); }}
                  className="rounded-xl border border-swu-border bg-swu-bg py-2.5 text-sm text-swu-muted"
                >
                  Todavía no
                </button>
                <button
                  onClick={() => { vibrar(20); cerrarJuego(ganadorDelJuego); setCierreOfrecido(null) }}
                  className="rounded-xl bg-swu-amber py-2.5 text-sm font-bold text-black"
                >
                  Anotar y seguir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* (4) Reloj de ronda. */}
        {relojPanel && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6"
               onClick={() => setReloj(false)}>
            <div className="w-full max-w-sm rounded-2xl border border-swu-border bg-swu-surface p-4"
                 onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-swu-text">Reloj de ronda</p>
                <button onClick={() => setReloj(false)} aria-label="Cerrar">
                  <X size={16} className="text-swu-muted" />
                </button>
              </div>
              {duelo.reloj && (
                <p className="mb-3 text-center text-4xl font-black tabular-nums text-swu-text">{mmss(restante)}</p>
              )}
              <div className="grid grid-cols-3 gap-2">
                {[50, 40, 30].map(m => (
                  <button key={m}
                    onClick={() => { reloj(m); setReloj(false) }}
                    className="rounded-xl border border-swu-cyan/50 bg-swu-cyan/10 py-2.5 text-sm font-bold text-swu-cyan"
                  >
                    {m} min
                  </button>
                ))}
              </div>
              {duelo.reloj && (
                <button
                  onClick={() => { reloj(null); setReloj(false) }}
                  className="mt-2 w-full rounded-xl border border-swu-border py-2 text-[12px] text-swu-muted"
                >
                  Quitar el reloj
                </button>
              )}
            </div>
          </div>
        )}

        {/* (5) Registro: los mismos movimientos que usa deshacer, leíbles. */}
        {registro && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6"
               onClick={() => setRegistro(false)}>
            <div className="w-full max-w-sm rounded-2xl border border-swu-border bg-swu-surface p-4"
                 onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-swu-text">Registro de la partida</p>
                <button onClick={() => setRegistro(false)} aria-label="Cerrar">
                  <X size={16} className="text-swu-muted" />
                </button>
              </div>
              {duelo.juegos.length > 0 && (
                <p className="mb-2 text-[11px] text-swu-amber">
                  Juegos: {duelo.juegos.map(j => nombreDe(j.ganador)).join(' · ')}
                </p>
              )}
              {duelo.hist.length === 0
                ? <p className="text-[12px] text-swu-muted">Todavía no hay movimientos en este juego.</p>
                : (
                  <ol className="max-h-64 space-y-1 overflow-y-auto pr-1 text-[12px]">
                    {[...duelo.hist].reverse().map((m, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 border-b border-swu-border/50 pb-1">
                        <span className="font-mono text-swu-muted">R{m.ronda}</span>
                        <span className="flex-1 truncate text-swu-text">{nombreDe(m.lado)}</span>
                        <span className={`font-mono font-bold ${m.delta < 0 ? 'text-swu-red' : 'text-swu-green'}`}>
                          {m.delta > 0 ? '+' : ''}{m.delta}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
            </div>
          </div>
        )}

        {/* Dados: el de las Utilidades viejas, en un panel. */}
        {dado.abierto && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6"
               onClick={() => setDado(d => ({ ...d, abierto: false }))}>
            <div className="w-full max-w-sm rounded-2xl border border-swu-border bg-swu-surface p-4"
                 onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-swu-text">Dados</p>
                <button onClick={() => setDado(d => ({ ...d, abierto: false }))} aria-label="Cerrar">
                  <X size={16} className="text-swu-muted" />
                </button>
              </div>
              <Dice3D valores={dado.valores} tirada={dado.tirada} className="h-40" />
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[1, 2].map(n => (
                  <button
                    key={n}
                    onClick={() => setDado(d => ({
                      abierto: true,
                      valores: Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6)),
                      tirada: d.tirada + 1,
                    }))}
                    className="rounded-xl border border-swu-cyan/50 bg-swu-cyan/10 py-2 text-sm font-bold text-swu-cyan"
                  >
                    Tirar {n === 1 ? '1 dado' : '2 dados'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Ajustes: reiniciar vida, terminar. */}
        {/* ── ¿Quién ganó? ──────────────────────────────────────────────
            Sale solo cuando el marcador está en 0-0, que es el 50% de los
            duelos reales. Es LA pregunta de la que cuelga el ranking, el meta y
            los sobres, y hasta ahora nunca se hacía: había que acordarse de
            marcarlo antes de cerrar.

            «No lo anotamos» sigue estando, y arriba de todo no: forzar una
            respuesta hace que la gente invente una, y un marcador inventado es
            peor que ninguno. Lo que cambia es el caso por defecto. */}
        {cerrando && duelo && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-6">
            <div className="w-full max-w-sm space-y-2 rounded-2xl border border-swu-border bg-swu-surface p-4">
              <p className="text-sm font-bold text-swu-text">¿Quién ganó el duelo?</p>
              <p className="mb-1 text-[11px] leading-snug text-swu-muted">
                Con esto la partida cuenta para el ranking y el meta. Si tu rival la
                confirma, les damos un sobre a los dos.
              </p>
              <button
                onClick={() => cerrarCon(1, 0)}
                className="flex w-full items-center gap-2 rounded-xl border border-swu-green/40 bg-swu-green/10 px-3 py-2.5 text-sm font-bold text-swu-green"
              >
                Gané yo
              </button>
              <button
                onClick={() => cerrarCon(0, 1)}
                className="flex w-full items-center gap-2 rounded-xl border border-swu-border bg-swu-bg px-3 py-2.5 text-sm text-swu-text"
              >
                Ganó {duelo.rival?.nombre ?? 'el rival'}
              </button>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setCerrando(false)}
                  className="flex-1 rounded-xl border border-swu-border px-3 py-2 text-xs text-swu-muted"
                >
                  Volver
                </button>
                <button
                  onClick={() => cerrarCon(0, 0)}
                  className="flex-1 rounded-xl border border-swu-border px-3 py-2 text-xs text-swu-muted"
                >
                  No lo anotamos
                </button>
              </div>
            </div>
          </div>
        )}

        {ajustes && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6"
               onClick={() => setAjustes(false)}>
            <div className="w-full max-w-sm rounded-2xl border border-swu-border bg-swu-surface p-4 space-y-2"
                 onClick={e => e.stopPropagation()}>
              <p className="text-sm font-bold text-swu-text mb-1">Ajustes del duelo</p>
              <button
                onClick={() => {
                  cambiar(d => ({
                    ...d,
                    a: { ...d.a, vida: d.a.vidaInicial },
                    b: { ...d.b, vida: d.b.vidaInicial },
                    ronda: 1, iniciativa: null, hist: [],
                  }))
                  setAjustes(false)
                }}
                className="w-full flex items-center gap-2 rounded-xl border border-swu-border bg-swu-bg px-3 py-2.5 text-sm text-swu-text"
              >
                <RotateCcw size={15} className="text-swu-cyan" /> Nueva partida (misma mesa)
              </button>
              <button
                onClick={terminar}
                className="w-full flex items-center gap-2 rounded-xl border border-swu-red/40 bg-swu-red/10 px-3 py-2.5 text-sm text-swu-red"
              >
                <X size={15} /> Terminar el duelo
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ── Preparación ── */
  return (
    <div className="mx-auto max-w-lg px-3 py-4 space-y-3 lg:max-w-3xl">
      <div className="flex items-center gap-2">
        <Swords size={18} className="text-swu-amber" />
        <div>
          <h1 className="text-base font-bold text-swu-text">Contador de mesa</h1>
          <p className="text-[11px] text-swu-muted">
            El teléfono va en el medio: la mitad de arriba se ve derecha desde enfrente.
          </p>
        </div>
      </div>

      {reanudable && (
        <button
          onClick={() => { setDuelo(reanudable); setReanudable(null) }}
          className="w-full rounded-2xl border border-swu-amber/40 bg-swu-amber/10 px-3 py-3 text-left"
        >
          <p className="text-sm font-bold text-swu-amber">Seguir el duelo anterior</p>
          <p className="text-[11px] text-swu-muted">
            {reanudable.a.baseNombre} {reanudable.a.vida} · {reanudable.b.vida} {reanudable.b.baseNombre} — ronda {reanudable.ronda}
          </p>
        </button>
      )}

      {/* El contrincante, buscado entre los usuarios de la app. Elegirlo es lo
          que arma el historial cara-a-cara; sin elegirlo, el duelo se guarda
          igual como «Invitado». Nada de esto toca el ranking: la tabla de
          duelos amistosos no tiene triggers ni escribe player_stats. */}
      <div className="rounded-2xl border border-swu-border bg-swu-surface p-3 space-y-2">
        <p className="text-sm font-bold text-swu-text">Contrincante</p>
        {rival ? (
          <div className="flex items-center gap-2">
            <Avatar avatar={rival.avatar} size={40} caja="redondeada" anillo={rival.id} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-swu-text truncate">{rival.name}</p>
              {caraACara && caraACara.rivalId === rival.id && (
                <p className="text-[10px] text-swu-muted">
                  {caraACara.duelos === 0
                    ? 'Primer duelo guardado entre ustedes.'
                    : `${caraACara.duelos} duelo${caraACara.duelos === 1 ? '' : 's'} · ganaste ${caraACara.ganados} · perdiste ${caraACara.perdidos}`}
                </p>
              )}
            </div>
            <button onClick={() => setRival(null)}
              className="rounded-lg border border-swu-border px-2 py-1 text-[11px] text-swu-muted">
              Quitar
            </button>
          </div>
        ) : (
          <>
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscá por nombre… (opcional: sin rival se guarda como Invitado)"
              className="w-full rounded-lg border border-swu-border bg-swu-bg px-3 py-2 text-sm text-swu-text
                         placeholder:text-swu-muted focus:outline-none focus:ring-2 focus:ring-swu-accent"
            />
            {candidatos.length > 0 && (
              <div className="space-y-1">
                {candidatos.map(c => (
                  <button key={c.id}
                    onClick={() => { setRival(c); setBusqueda(''); setCandidatos([]) }}
                    className="flex w-full items-center gap-2 rounded-lg border border-swu-border bg-swu-bg px-2 py-1.5 text-left">
                    <Avatar avatar={c.avatar} size={32} caja="redondeada" anillo={c.id} />
                    <span className="text-[13px] text-swu-text truncate">{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <SelectorLado titulo={rival ? `Base de ${rival.name}` : 'Jugador de enfrente'} bases={bases} decks={decks}
        elegido={ladoB} onElegir={(base, lider) => setLadoB({ base, lider })} />
      <SelectorLado titulo={`Vos${currentProfile?.name ? ` (${currentProfile.name})` : ''}`}
        bases={bases} decks={decks}
        elegido={ladoA} onElegir={(base, lider) => setLadoA({ base, lider })} />

      <button
        disabled={!ladoA || !ladoB}
        onClick={() => ladoA && ladoB && empezar(ladoA, ladoB)}
        className="w-full rounded-2xl bg-swu-red py-3 text-sm font-bold text-white
                   disabled:opacity-40 active:scale-[0.99] transition-transform"
      >
        Comenzar duelo
      </button>

      {/* (3) «Mis duelos»: hasta ahora el historial se guardaba y el único
          sitio donde se veía era al elegir al MISMO rival otra vez. Acá está
          entero, incluidos los duelos donde el teléfono lo llevó el otro. */}
      <button
        onClick={() => setVerHistorial(v => !v)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-swu-border
                   bg-swu-surface py-2.5 text-[12px] font-semibold text-swu-text"
      >
        <History size={14} className="text-swu-cyan" />
        {verHistorial ? 'Ocultar mis duelos' : 'Mis duelos'}
      </button>

      {verHistorial && (
        <div className="rounded-2xl border border-swu-border bg-swu-surface p-3">
          {!supabaseUser
            ? <p className="text-[12px] text-swu-muted">Iniciá sesión para guardar y ver tus duelos.</p>
            : historial === null
              ? <div className="h-16 animate-pulse rounded-lg bg-swu-bg" />
              : historial.length === 0
                ? <p className="text-[12px] text-swu-muted">
                    Todavía no hay duelos terminados. Un duelo cuenta cuando lo cerrás desde los ajustes.
                  </p>
                : (
                  <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {historial.map(h => (
                      <li key={h.id} className="flex items-center gap-2 rounded-lg border border-swu-border bg-swu-bg px-2.5 py-2">
                        <span className={`font-mono text-sm font-bold ${
                          h.mias > h.suyas ? 'text-swu-green' : h.suyas > h.mias ? 'text-swu-red' : 'text-swu-muted'
                        }`}>
                          {h.mias}–{h.suyas}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-semibold text-swu-text">{h.conQuien}</p>
                          <p className="truncate text-[10px] text-swu-muted">{h.bases}</p>
                        </div>
                        <span className="flex-shrink-0 text-[10px] text-swu-muted">{h.cuando}</span>
                      </li>
                    ))}
                  </ul>
                )}
        </div>
      )}

      <button onClick={() => navigate(-1)} className="w-full py-1 text-[12px] text-swu-muted">
        Volver
      </button>
    </div>
  )
}

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
} from 'lucide-react'
import { CardImage } from '../../components/CardImage'
import { Carta3D } from '../../components/Carta3D'
import { Avatar } from '../../components/ui/Avatar'
import { Dice3D } from '../utilities/Dice3D'
import { db } from '../../services/db'
import { ensureCards } from '../../services/swuApi'
import { useAuth } from '../../hooks/useAuth'
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
  /** Avatar: arte del líder si el lado vino de un mazo; si no, el genérico. */
  liderImg: string | null
  etiqueta: string
}

interface Duelo {
  a: LadoDuelo
  b: LadoDuelo
  ronda: number
  iniciativa: 'a' | 'b' | null
  /** Pila de cambios de vida, para deshacer. */
  hist: { lado: 'a' | 'b'; delta: number }[]
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
    return d
  } catch { return null }
}
function borrar() {
  try { localStorage.removeItem(CLAVE) } catch { /* nada */ }
}

/* ── La mitad de un jugador ──────────────────────────────── */

function MitadJugador({
  lado, invertida, conIniciativa, onVida, onIniciativa, onVictorias,
}: {
  lado: LadoDuelo
  invertida: boolean
  conIniciativa: boolean
  onVida: (delta: number) => void
  onIniciativa: () => void
  onVictorias: (n: number) => void
}) {
  const pct = lado.vidaInicial > 0 ? lado.vida / lado.vidaInicial : 0
  const colorVida = lado.vida === 0 ? 'text-swu-red' : pct <= 0.34 ? 'text-swu-coral' : pct <= 0.67 ? 'text-swu-amber' : 'text-white'

  // Mantener presionado repite. `pointerdown` aplica el primer cambio al
  // instante; si el dedo sigue, a los 450 ms arranca la ráfaga. Todo se corta
  // en up/leave/cancel — sin esto, un dedo que se desliza deja el botón
  // «pegado» restando vida solo.
  const temporizador = useRef<{ espera?: number; rafaga?: number }>({})
  const empezar = useCallback((delta: number) => {
    onVida(delta)
    temporizador.current.espera = window.setTimeout(() => {
      temporizador.current.rafaga = window.setInterval(() => onVida(delta), 140)
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
            {/* Velo para que la cifra gane SIEMPRE el contraste sobre el arte. */}
            <div className="absolute inset-0 rounded-2xl bg-black/35" />
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

      {/* − VIDA + : la fila protagonista, como en la referencia. */}
      <div className="absolute inset-0 flex items-center justify-between px-5">
        <button
          aria-label="Restar vida"
          onPointerDown={() => empezar(-1)}
          onPointerUp={parar} onPointerLeave={parar} onPointerCancel={parar}
          className="h-20 w-20 rounded-full border-4 border-white/70 bg-black/45 text-white
                     flex items-center justify-center active:scale-95 transition-transform backdrop-blur-sm"
        >
          <Minus size={34} strokeWidth={3} />
        </button>
        <span className={`text-[88px] leading-none font-black tabular-nums drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] ${colorVida}`}>
          {lado.vida}
        </span>
        <button
          aria-label="Sumar vida"
          onPointerDown={() => empezar(1)}
          onPointerUp={parar} onPointerLeave={parar} onPointerCancel={parar}
          className="h-20 w-20 rounded-full border-4 border-swu-red/80 bg-black/45 text-swu-red
                     flex items-center justify-center active:scale-95 transition-transform backdrop-blur-sm"
        >
          <Plus size={34} strokeWidth={3} />
        </button>
      </div>

      {/* Avatar + ficha de iniciativa, en la esquina que mira al centro. */}
      <div className="absolute bottom-2 left-2 flex items-center gap-2">
        <div className="h-11 w-11 rounded-full overflow-hidden border-2 border-swu-cyan/60 bg-swu-bg">
          {lado.liderImg
            ? <img src={lado.liderImg} alt="" className="h-full w-full object-cover object-left" />
            : <Avatar avatar={lado.etiqueta === 'Vos' ? '🧑‍🚀' : '⚔️'} size={40} caja="redondeada" />}
        </div>
        <button
          onClick={onIniciativa}
          aria-label="Tomar la iniciativa"
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold border transition-colors ${
            conIniciativa
              ? 'bg-swu-amber text-black border-swu-amber'
              : 'bg-black/40 text-white/60 border-white/25'
          }`}
        >
          INICIATIVA
        </button>
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
  const { currentProfile } = useAuth()

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

  const cambiar = useCallback((fn: (d: Duelo) => Duelo) => {
    setDuelo(actual => {
      if (!actual) return actual
      const nuevo = fn(actual)
      guardar(nuevo)
      return nuevo
    })
  }, [])

  const vida = useCallback((lado: 'a' | 'b', delta: number) => {
    cambiar(d => {
      const v = Math.max(0, Math.min(99, d[lado].vida + delta))
      const real = v - d[lado].vida
      if (real === 0) return d
      return { ...d, [lado]: { ...d[lado], vida: v }, hist: [...d.hist.slice(-49), { lado, delta: real }] }
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

  const empezar = useCallback((a: { base: Card; lider: Card | null }, b: { base: Card; lider: Card | null }) => {
    const lado = (x: { base: Card; lider: Card | null }, etiqueta: string): LadoDuelo => ({
      baseNombre: x.base.name,
      baseImg: x.base.imageUrl ?? null,
      vidaInicial: x.base.hp ?? 30,
      vida: x.base.hp ?? 30,
      victorias: 0,
      liderImg: x.lider?.imageUrl ?? null,
      etiqueta,
    })
    const d: Duelo = { a: lado(a, 'Vos'), b: lado(b, 'Rival'), ronda: 1, iniciativa: null, hist: [] }
    guardar(d)
    setDuelo(d)
    setReanudable(null)
  }, [])

  const terminar = useCallback(() => {
    borrar()
    setDuelo(null)
    setAjustes(false)
    setLadoA(null); setLadoB(null)
  }, [])

  /* ── El duelo en curso: pantalla completa, por encima de la TabBar ── */
  if (duelo) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-[#060913]">
        <MitadJugador
          lado={duelo.b} invertida conIniciativa={duelo.iniciativa === 'b'}
          onVida={d => vida('b', d)}
          onIniciativa={() => cambiar(x => ({ ...x, iniciativa: x.iniciativa === 'b' ? null : 'b' }))}
          onVictorias={n => cambiar(x => ({ ...x, b: { ...x.b, victorias: n } }))}
        />

        {/* La barra del medio: las herramientas de la referencia, mejoradas. */}
        <div className="relative z-10 flex items-center justify-center gap-3 border-y border-white/10 bg-black/60 px-3 py-2 backdrop-blur">
          <button
            onClick={() => cambiar(x => ({ ...x, ronda: x.ronda + 1 }))}
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
        />

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

      <SelectorLado titulo="Jugador de enfrente" bases={bases} decks={decks}
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

      <button onClick={() => navigate(-1)} className="w-full py-1 text-[12px] text-swu-muted">
        Volver
      </button>
    </div>
  )
}

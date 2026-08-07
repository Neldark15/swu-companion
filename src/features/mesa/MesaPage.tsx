/**
 * MesaPage — ver una partida del simulador, jugada a jugada.
 *
 * ── Qué es esto y qué NO es ───────────────────────────────────────────
 *
 * NO es un PvP: no hay dos personas ni hay decisiones que tomar. Es una
 * partida que el motor de `/laboratorio` ya jugó entera con el reglamento
 * implementado, reproducida sobre una mesa. Sirve para lo que pidió existir:
 * **ver** qué le pasa a un mazo contra un rival concreto, en vez de leer un
 * porcentaje y confiar.
 *
 * Y es la MISMA partida que corre dentro de una medición: con la misma
 * `semilla`, `n` selecciona la n-ésima partida de esa tanda. Así «ver» un
 * emparejamiento y «medirlo» hablan del mismo objeto, y pedir otra partida da
 * otra real de la misma medición, no una tirada suelta sin relación.
 *
 * ── El encuadre va arriba, no en una nota al pie ──────────────────────
 *
 * El simulador se desvía ±11 puntos contra los resultados reales del
 * Galactic. Una mesa 3D con arte de verdad se parece mucho a una partida
 * grabada, así que el aviso de que es una SIMULACIÓN tiene que estar donde no
 * se pueda no leer. Es el mismo criterio de `LabPage`.
 *
 * ── El arte sale de la base local ─────────────────────────────────────
 *
 * El simulador manda el id SWUDB de cada carta que salió («ASH_127»), que es
 * justo el `legacyId` de la base de Dexie. Medido sobre 61 partidas y 1 108
 * referencias a carta: **el 100 % resuelve por ese id y todas tienen arte.**
 * Igual hay un plan B por nombre, porque las fichas que se generan en mesa
 * (X-Wing, TIE Fighter, Spy) no siempre son cartas del pool.
 */

import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Play, Pause, SkipBack, SkipForward, RotateCcw, Gauge,
  AlertTriangle, Clapperboard, Shuffle, MonitorOff, Loader2, Swords,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { HudPanel, HudCorners, HexIcon } from '../../components/Hud'
import { CardImage } from '../../components/CardImage'
import { db } from '../../services/db'
import { ensureCards } from '../../services/swuApi'
import {
  simApi, deckAMazo,
  type PartidaNarrada, type RivalInfo, type Lado, type Arena,
} from '../lab/simApi'
import type { Deck, Card } from '../../types'
import {
  estadoEn, totalPasos, avanzar, retroceder, irARonda, rondaEn, rondasDe,
  vidaVisible, enArena, frase,
  type EstadoMesa, type LadoMesa,
} from './reproductor'
// SOLO tipos de MesaEscena. Un `import` de valor —aunque sea una función de
// tres líneas— la mete en ESTE chunk y arrastra `three` con ella: medido, el
// chunk de la pantalla pasaba a importar `three-*.js` de forma ESTÁTICA y el
// `lazy()` de abajo no servía de nada. `import type` se borra al compilar.
import type { ArteCarta } from './MesaEscena'

/**
 * La escena va en su propio chunk.
 *
 * `three` pesa 535 KB (133 gzip) y ya viaja en un chunk compartido, pero el
 * que lo IMPORTA arrastra la descarga. Cargándola aparte, entrar a elegir el
 * mazo no baja el motor 3D: se baja cuando de verdad hay una partida que
 * dibujar. Y sin WebGL no se baja nunca.
 */
const MesaEscena = lazy(() => import('./MesaEscena').then((m) => ({ default: m.MesaEscena })))

/**
 * ¿Hay WebGL en este navegador?
 *
 * Vive aquí y no en `MesaEscena` justo por lo de arriba: es la pregunta que
 * decide si se baja el 3D, así que no puede estar dentro de lo que se baja.
 */
function hayWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

/** Milisegundos por evento a velocidad 1. Medido a ojo: menos se hace ilegible. */
const RITMO = 620
const VELOCIDADES = [0.5, 1, 2, 4]

type Estado = 'eligiendo' | 'cargando' | 'listo' | 'error'

export function MesaPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [mazos, setMazos] = useState<Deck[]>([])
  const [mazoId, setMazoId] = useState('')
  const [rivales, setRivales] = useState<RivalInfo[]>([])
  const [rival, setRival] = useState('')
  const [fase, setFase] = useState<Estado>('eligiendo')
  const [error, setError] = useState<string | null>(null)

  const [partida, setPartida] = useState<PartidaNarrada | null>(null)
  const [arte, setArte] = useState<Map<string, ArteCarta>>(new Map())
  const [indice, setIndice] = useState(0)
  const [jugando, setJugando] = useState(false)
  const [velocidad, setVelocidad] = useState(1)
  /** Sube en cada «otra partida»: selecciona otra de la misma tanda. */
  const [n, setN] = useState(0)

  // WebGL se pregunta UNA vez y no en cada render: crear un canvas de prueba
  // por render es trabajo tonto, y la respuesta no cambia a media sesión.
  const conWebGL = useMemo(() => hayWebGL(), [])

  /* ── Mazos y rivales ── */
  useEffect(() => {
    db.decks.toArray().then((todos) => {
      const orden = todos.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      setMazos(orden)
      const pedido = params.get('deck')
      if (pedido && orden.some((d) => d.id === pedido)) setMazoId(pedido)
      else if (orden.length > 0) setMazoId(orden[0].id)
    }).catch(() => { /* sin mazos guardados: la pantalla lo dice abajo */ })

    simApi.rivales().then((r) => {
      setRivales(r.rivales)
      const pedido = params.get('rival')
      if (pedido && r.rivales.some((x) => x.slug === pedido)) setRival(pedido)
      else if (r.rivales.length > 0) setRival(r.rivales[0].slug)
    }).catch((e) => setError(e instanceof Error ? e.message : 'No se pudo leer la lista de rivales.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Pedir la partida ── */
  const pedir = useCallback(async (cual: number) => {
    const deck = mazos.find((d) => d.id === mazoId)
    if (!deck) { setError('Elige un mazo guardado.'); return }
    if (!rival) { setError('Elige un rival.'); return }
    setFase('cargando'); setError(null); setJugando(false)
    try {
      const p = await simApi.partida(deckAMazo(deck), rival, 31337, cual)
      setPartida(p)
      setIndice(0)
      setArte(await resolverArte(p))
      setFase('listo')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'El laboratorio no respondió.')
      setFase('error')
    }
  }, [mazos, mazoId, rival])

  /* ── El reloj de la reproducción ── */
  const total = partida ? totalPasos(partida) : 0
  const relojRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!jugando || !partida) return
    if (indice >= total) { setJugando(false); return }
    // Las rondas respiran un poco más: son el único punto donde la mesa
    // cambia de capítulo y pasar de largo confunde.
    const ev = partida.eventos[indice]
    const factor = ev?.t === 'ronda' || ev?.t === 'fin' ? 1.8 : 1
    relojRef.current = window.setTimeout(
      () => setIndice((i) => Math.min(i + 1, total)),
      (RITMO / velocidad) * factor,
    )
    return () => window.clearTimeout(relojRef.current)
  }, [jugando, indice, total, velocidad, partida])

  const estado: EstadoMesa | null = useMemo(
    () => (partida ? estadoEn(partida, indice) : null),
    [partida, indice],
  )

  const miNombre = mazos.find((d) => d.id === mazoId)?.name ?? 'Tu mazo'
  const suNombre = rivales.find((r) => r.slug === rival)?.lider.split(' | ')[0] ?? 'Rival'

  /* ── Pantallas ── */

  const cabecera = (
    <div className="flex items-center gap-2.5">
      <button onClick={() => navigate(-1)} aria-label="Volver"
        className="p-2 rounded-lg bg-swu-surface hover:bg-swu-surface-hover text-swu-muted">
        <ArrowLeft size={18} />
      </button>
      <div className="min-w-0">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Clapperboard size={18} className="text-swu-cyan" /> Mesa
        </h1>
        <p className="text-[11px] text-swu-muted leading-snug">
          Ver una partida del simulador, jugada a jugada
        </p>
      </div>
    </div>
  )

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto pb-24">
      {cabecera}

      <div className="flex gap-2 items-start text-[11px] leading-relaxed text-swu-muted bg-swu-surface rounded-lg p-2.5 border border-swu-border">
        <AlertTriangle size={14} className="text-swu-amber flex-shrink-0 mt-0.5" />
        <div>
          Esto es una partida <b className="text-swu-text">simulada por el motor</b>, no una
          partida real ni una mesa contra otra persona. Sirve para ver cómo se comporta el mazo;
          contrastado con el Galactic, el simulador se desvía ±11 puntos.
        </div>
      </div>

      {/* ── Elegir ── */}
      <HudPanel tone="cyan" glow>
        <div className="relative p-3.5 space-y-3">
          <HudCorners tone="cyan" />
          <div className="flex items-center gap-2.5">
            <HexIcon tone="cyan" size={36}><Swords size={16} /></HexIcon>
            <h2 className="text-sm font-bold text-white tracking-wide">El enfrentamiento</h2>
          </div>

          {mazos.length === 0 ? (
            <p className="text-xs text-swu-muted">
              No tienes mazos guardados todavía. Arma uno en <b className="text-swu-text">Mis Decks</b> y
              vuelve.
            </p>
          ) : (
            <>
              <label className="block">
                <span className="text-[11px] text-swu-muted">Tu mazo</span>
                <select value={mazoId} onChange={(e) => setMazoId(e.target.value)}
                  className="w-full mt-1 bg-swu-surface border border-swu-border rounded-lg px-3 py-2 text-sm text-swu-text">
                  {mazos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} — {d.leaders[0]?.name ?? 'sin líder'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] text-swu-muted">Rival</span>
                <select value={rival} onChange={(e) => setRival(e.target.value)}
                  className="w-full mt-1 bg-swu-surface border border-swu-border rounded-lg px-3 py-2 text-sm text-swu-text">
                  {rivales.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.lider.split(' | ')[0]} — {r.jugador || r.slug}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex gap-2">
                <Button variant="primary" size="sm" block loading={fase === 'cargando'}
                  onClick={() => { setN(0); pedir(0) }}>
                  <Play size={14} /> Ver una partida
                </Button>
                {partida && (
                  <Button variant="secondary" size="sm" disabled={fase === 'cargando'}
                    onClick={() => { const s = n + 1; setN(s); pedir(s) }}>
                    <Shuffle size={14} /> Otra
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </HudPanel>

      {error && (
        <div className="flex gap-2 items-start text-xs text-swu-red bg-swu-red/10 border border-swu-red/30 rounded-lg p-3">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {fase === 'cargando' && (
        <div className="flex items-center justify-center gap-2 text-sm text-swu-muted py-10">
          <Loader2 size={16} className="animate-spin" /> Jugando la partida…
        </div>
      )}

      {partida && estado && fase === 'listo' && (
        <>
          {!conWebGL && (
            <div className="flex gap-2 items-start text-[11px] text-swu-muted bg-swu-surface rounded-lg p-2.5 border border-swu-border">
              <MonitorOff size={14} className="text-swu-amber flex-shrink-0 mt-0.5" />
              <div>
                Este navegador no tiene WebGL, así que no se puede dibujar la mesa en 3D. Abajo
                está la misma partida en plano — los datos son exactamente los mismos.
              </div>
            </div>
          )}

          {conWebGL && (
            <div className="rounded-xl overflow-hidden border border-swu-border bg-black relative">
              <Suspense fallback={
                <div className="h-[52vh] min-h-[320px] flex items-center justify-center text-swu-muted text-sm">
                  <Loader2 size={16} className="animate-spin mr-2" /> Montando la mesa…
                </div>
              }>
                <div className="h-[52vh] min-h-[320px]">
                  <MesaEscena estado={estado} arte={arte} duracion={RITMO / velocidad / 1.6} />
                </div>
              </Suspense>
              <p className="absolute bottom-1.5 left-2 text-[10px] text-white/35 pointer-events-none">
                arrastra para girar · pellizca para acercar
              </p>
            </div>
          )}

          <Controles
            partida={partida} indice={indice} total={total} jugando={jugando}
            velocidad={velocidad} estado={estado}
            onIndice={setIndice} onJugando={setJugando} onVelocidad={setVelocidad}
          />

          <Marcador estado={estado} mi={miNombre} suyo={suNombre} />

          {!conWebGL && <MesaPlana estado={estado} arte={arte} mi={miNombre} suyo={suNombre} />}

          <Relato partida={partida} indice={indice} mi={miNombre} suyo={suNombre}
            onIr={(i) => { setJugando(false); setIndice(i) }} />
        </>
      )}
    </div>
  )
}

/* ── El arte ─────────────────────────────────────────────────────────── */

/**
 * `partida.cartas` → arte de cada carta, resuelto contra la base local.
 *
 * Una sola consulta por `legacyId` para todas: 40 `getCardById` sueltos serían
 * 40 viajes a IndexedDB y, para lo que no estuviera, 40 peticiones de red.
 */
async function resolverArte(p: PartidaNarrada): Promise<Map<string, ArteCarta>> {
  const salida = new Map<string, ArteCarta>()
  try {
    await ensureCards()
    const ids = Object.values(p.cartas).map((f) => f.id).filter((x): x is string => !!x)
    const filas = ids.length ? await db.cards.where('legacyId').anyOf(ids).toArray() : []
    const porId = new Map(filas.map((c) => [c.legacyId!, c]))

    // Plan B por nombre para lo que no traiga id (fichas generadas en mesa).
    const huerfanos = Object.entries(p.cartas).filter(([, f]) => !f.id || !porId.has(f.id))
    let porNombre = new Map<string, Card>()
    if (huerfanos.length) {
      const nombres = huerfanos.map(([n]) => n.split(' | ')[0])
      const cands = await db.cards.where('name').anyOf(nombres).toArray()
      porNombre = new Map(cands
        .filter((c) => c.isCanonical !== false)
        .map((c) => [c.subtitle ? `${c.name} | ${c.subtitle}` : c.name, c]))
    }

    for (const [nombre, ficha] of Object.entries(p.cartas)) {
      const c = (ficha.id ? porId.get(ficha.id) : undefined) ?? porNombre.get(nombre)
      if (!c?.imageUrl) continue
      // La orientación la decide el TIPO que declara el simulador, con el de
      // la base local de respaldo. Los líderes y las bases son 400×286: meter
      // uno en un hueco vertical es el bug que ya salió cuatro veces aquí.
      const apaisada = ficha.tipo === 'Leader' || ficha.tipo === 'Base' || c.isLeader || c.isBase
      // El dorso SOLO de los líderes: es su cara de unidad, la que se ve al
      // desplegarse. La base también tiene `backImageUrl` en algunas filas y
      // ahí no significa eso — una base nunca se voltea.
      const esLider = ficha.tipo === 'Leader' || c.isLeader
      salida.set(nombre, {
        url: c.imageUrl,
        apaisada,
        dorso: esLider ? c.backImageUrl ?? null : null,
      })
    }
  } catch {
    // Sin arte la mesa sigue: las cartas salen como rectángulos del color de
    // su bando. Preferible a no enseñar nada.
  }
  return salida
}

/* ── Controles ───────────────────────────────────────────────────────── */

function Controles({
  partida, indice, total, jugando, velocidad, estado, onIndice, onJugando, onVelocidad,
}: {
  partida: PartidaNarrada
  indice: number
  total: number
  jugando: boolean
  velocidad: number
  estado: EstadoMesa
  onIndice: (i: number) => void
  onJugando: (b: boolean) => void
  onVelocidad: (v: number) => void
}) {
  const rondas = useMemo(() => rondasDe(partida), [partida])
  const ronda = rondaEn(partida, indice)

  return (
    <div className="space-y-2.5 bg-swu-surface border border-swu-border rounded-xl p-3">
      {/*
        `flex-wrap` no es decoración. Medido en Chrome a 320 px: el grupo de
        velocidad iba de 202 a 345 y el contenedor se acaba en 300, así que
        `2×` salía cortado por la mitad y `4×` quedaba ENTERO fuera —un control
        imposible de tocar— y encima la página no desborda (scrollWidth 320 =
        clientWidth 320), o sea que no había scroll que lo rescatara. **A 360 px
        pasaba igual**, que es la anchura de medio Android. Con el envoltorio el
        grupo baja a su propia línea, sigue a la derecha por el `ml-auto` y cabe:
        mide 143 px contra los 280 útiles. De 375 px en adelante no envuelve y
        la fila sigue midiendo los mismos 44 px de alto — medido en 320, 360,
        375, 390 y 430.
      */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="xs" variant="secondary" onClick={() => { onJugando(false); onIndice(0) }}
          aria-label="Volver al principio"><RotateCcw size={14} /></Button>
        <Button size="xs" variant="secondary"
          onClick={() => { onJugando(false); onIndice(retroceder(partida, indice)) }}
          aria-label="Un paso atrás"><SkipBack size={14} /></Button>
        <Button size="sm" variant="primary" onClick={() => onJugando(!jugando)}
          aria-label={jugando ? 'Pausar' : 'Reproducir'}>
          {jugando ? <Pause size={15} /> : <Play size={15} />}
        </Button>
        <Button size="xs" variant="secondary"
          onClick={() => { onJugando(false); onIndice(avanzar(partida, indice)) }}
          aria-label="Un paso adelante"><SkipForward size={14} /></Button>

        <div className="ml-auto flex items-center gap-1">
          <Gauge size={13} className="text-swu-muted" aria-hidden />
          {VELOCIDADES.map((v) => (
            <button key={v} onClick={() => onVelocidad(v)}
              className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${
                velocidad === v ? 'bg-swu-cyan/20 text-swu-cyan' : 'text-swu-muted'}`}>
              {v}×
            </button>
          ))}
        </div>
      </div>

      <input
        type="range" min={0} max={total} value={indice}
        onChange={(e) => { onJugando(false); onIndice(Number(e.target.value)) }}
        aria-label="Momento de la partida"
        className="w-full accent-swu-cyan"
      />

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-swu-muted mr-1">
          Ronda {ronda || '—'} · paso {indice}/{total}
        </span>
        {rondas.map((r) => (
          <button key={r} onClick={() => { onJugando(false); onIndice(irARonda(partida, r, indice)) }}
            className={`w-6 h-6 rounded text-[11px] font-mono ${
              r === ronda ? 'bg-swu-cyan/20 text-swu-cyan' : 'bg-swu-bg text-swu-muted'}`}>
            {r}
          </button>
        ))}
      </div>

      {estado.descuadre && (
        <p className="text-[11px] text-swu-red flex items-start gap-1.5">
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
          La vida que va contando esta mesa dejó de cuadrar con la que declara el motor. No te
          fíes del marcador de esta partida.
        </p>
      )}
    </div>
  )
}

/* ── Marcador ────────────────────────────────────────────────────────── */

function Marcador({ estado, mi, suyo }: { estado: EstadoMesa; mi: string; suyo: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-swu-text bg-swu-surface border border-swu-border rounded-lg px-3 py-2 min-h-[2.25rem] flex items-center">
        {frase(estado.ultimo, mi, suyo)}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Vida lado="A" l={estado.a} quien={mi} />
        <Vida lado="B" l={estado.b} quien={suyo} />
      </div>
      {estado.fin && (
        <p className="text-sm font-bold text-center text-swu-amber">
          Gana {estado.fin.ganador === 'A' ? mi : suyo} — {estado.fin.por}
        </p>
      )}
    </div>
  )
}

function Vida({ lado, l, quien }: { lado: Lado; l: LadoMesa; quien: string }) {
  const v = vidaVisible(l)
  const pct = l.vidaInicial > 0 ? (v / l.vidaInicial) * 100 : 0
  const color = lado === 'A' ? 'bg-swu-cyan' : 'bg-swu-red'
  return (
    <div className="bg-swu-surface border border-swu-border rounded-lg p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-swu-muted truncate">{quien}</span>
        <span className="font-mono font-bold text-white">{v}</span>
      </div>
      <div className="h-1.5 bg-swu-bg rounded-full mt-1.5 overflow-hidden">
        <div className={`h-full ${color} transition-[width] duration-300`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-swu-muted mt-1 truncate">{l.base}</p>
    </div>
  )
}

/* ── La mesa en plano, para cuando no hay WebGL ──────────────────────── */

function MesaPlana({ estado, arte, mi, suyo }: {
  estado: EstadoMesa; arte: Map<string, ArteCarta>; mi: string; suyo: string
}) {
  return (
    <div className="space-y-2">
      <FilaPlana l={estado.b} arena="espacio" arte={arte} quien={suyo} />
      <FilaPlana l={estado.b} arena="tierra" arte={arte} quien={suyo} />
      <div className="h-px bg-swu-cyan/25" />
      <FilaPlana l={estado.a} arena="tierra" arte={arte} quien={mi} />
      <FilaPlana l={estado.a} arena="espacio" arte={arte} quien={mi} />
    </div>
  )
}

/**
 * La cara que enseña una carta que está EN LA ARENA.
 *
 * Un líder desplegado se voltea a su cara de unidad, que es el dorso y es
 * vertical. Es la misma regla que aplica la mesa 3D; vive aquí duplicada a
 * propósito, porque importar la función de `MesaEscena` metería `three` en
 * ESTE chunk y mataría el `lazy()`.
 */
function caraEnArena(a: ArteCarta | undefined) {
  if (a?.dorso) return { url: a.dorso, apaisada: false }
  return { url: a?.url, apaisada: a?.apaisada ?? false }
}

function FilaPlana({ l, arena, arte, quien }: {
  l: LadoMesa; arena: Arena; arte: Map<string, ArteCarta>; quien: string
}) {
  const us = enArena(l, arena)
  return (
    <div className="bg-swu-surface border border-swu-border rounded-lg p-2">
      <p className="text-[10px] text-swu-muted uppercase tracking-wide mb-1">
        {quien} · {arena}
      </p>
      {us.length === 0 ? (
        <p className="text-[11px] text-swu-muted/60">vacío</p>
      ) : (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {us.map((u) => {
            const c = caraEnArena(arte.get(u.nombre))
            return (
              <div key={u.uid} className="flex-shrink-0 w-12">
                <CardImage src={c.url} alt={u.nombre} className="w-12 h-16"
                  orientacion={c.apaisada ? 'apaisada' : 'vertical'} />
                <p className="text-[9px] font-mono text-center text-swu-muted mt-0.5">
                  {u.poder}/{u.resto}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── El relato ───────────────────────────────────────────────────────── */

/**
 * La lista de eventos, que también es un índice: se toca una línea y la mesa
 * salta ahí. Sin WebGL esto es lo único que queda, así que no es un adorno.
 */
function Relato({ partida, indice, mi, suyo, onIr }: {
  partida: PartidaNarrada; indice: number; mi: string; suyo: string; onIr: (i: number) => void
}) {
  const cajaRef = useRef<HTMLDivElement>(null)

  // La línea que se está viendo se mantiene a la vista sola.
  useEffect(() => {
    const el = cajaRef.current?.querySelector('[data-actual="1"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [indice])

  return (
    <div ref={cajaRef} className="bg-swu-surface border border-swu-border rounded-xl p-2 max-h-72 overflow-y-auto">
      {partida.eventos.map((ev, i) => {
        const actual = i === indice - 1
        return (
          <button key={i} onClick={() => onIr(i + 1)} data-actual={actual ? '1' : '0'}
            className={`w-full text-left text-[11px] leading-snug px-2 py-1 rounded ${
              actual ? 'bg-swu-cyan/15 text-swu-cyan' : ev.t === 'ronda'
                ? 'text-swu-amber font-semibold mt-1' : 'text-swu-muted'
            }`}>
            {frase(ev, mi, suyo)}
          </button>
        )
      })}
    </div>
  )
}

/**
 * MesaContador — el Contador para una mesa de Twin Suns (3 o 4 jugadores).
 *
 * ── Por qué es otra pantalla y no un parámetro del duelo ──────────────
 *
 * El Contador de dos está construido alrededor de DOS lados enfrentados:
 * el estado es `{ a, b }`, los movimientos llevan `lado: 'a' | 'b'`, el
 * mejor-de-tres cuenta `juegos: { ganador: 'a' | 'b' }`, y el teléfono se
 * dibuja partido en dos con la mitad de arriba rotada 180°. Generalizar eso
 * a N habría tocado el guardado, la subida a la nube de amistosas, las
 * misiones y el historial — todo por una mesa que no juega ninguna de esas
 * cosas.
 *
 * Comparte lo que de verdad importa: `MitadJugador` (el panel con la base en
 * 3D, el mantener-presionado y la vibración) y `SelectorLado` (elegir base o
 * mazo). Si el panel cambia, cambia en los dos modos.
 *
 * ── El teléfono en el centro de una mesa de cuatro ────────────────────
 *
 * Con dos personas alcanza con partir la pantalla y rotar la mitad de
 * arriba. Con cuatro, cada quien mira desde un lado distinto: la rejilla es
 * 2×2 y **los dos paneles de arriba van rotados 180°**, así los de enfrente
 * leen su vida derecha. Con tres, uno arriba rotado y dos abajo.
 *
 * No se rota 90° a los laterales a propósito: un número de vida en vertical
 * no se lee de reojo, que es justo lo que hay que hacer en medio de un
 * turno.
 *
 * ── Sin marcador de partidas ──────────────────────────────────────────
 *
 * Twin Suns se juega a una sola partida por mesa: no hay mejor-de-tres que
 * llevar. Lo que decide la mesa es el ORDEN en que va cayendo cada base, y
 * eso se marca con «eliminado» — que además es lo que hay que anotar después
 * como puesto 1.º a 4.º en el torneo.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, RotateCcw, Skull, Undo2, Users } from 'lucide-react'
import { MitadJugador, SelectorLado } from './piezas'
import { type LadoDuelo, vibrar } from './estado'
import { ensureCards } from '../../services/swuApi'
import { db } from '../../services/db'
import { mazosParaContador, type MazoDeAlguien } from '../../services/amistosas'
import { useAuth } from '../../hooks/useAuth'
import type { Card } from '../../types'

const CLAVE = 'contador_mesa_v1'

interface MovimientoMesa {
  asiento: number
  delta: number
  ts: number
}

interface Mesa {
  id: string
  /** 3 o 4 lados, en el orden en que se sientan. */
  jugadores: LadoDuelo[]
  /** El asiento con la iniciativa, o `null`. */
  iniciativa: number | null
  /** En qué orden fue cayendo cada base: el primero en caer es el último puesto. */
  caidos: number[]
  hist: MovimientoMesa[]
}

function guardar(m: Mesa) {
  try { localStorage.setItem(CLAVE, JSON.stringify(m)) } catch { /* sin sitio */ }
}
function cargar(): Mesa | null {
  try {
    const s = localStorage.getItem(CLAVE)
    if (!s) return null
    const m = JSON.parse(s) as Mesa
    // Lo mínimo para confiar: entre 3 y 4 lados con vida numérica.
    if (!Array.isArray(m?.jugadores) || m.jugadores.length < 3 || m.jugadores.length > 4) return null
    if (m.jugadores.some(j => typeof j?.vida !== 'number')) return null
    if (!Array.isArray(m.caidos)) m.caidos = []
    if (!Array.isArray(m.hist)) m.hist = []
    if (m.iniciativa === undefined) m.iniciativa = null
    return m
  } catch { return null }
}
function borrarGuardado() {
  try { localStorage.removeItem(CLAVE) } catch { /* nada */ }
}

/** Toques seguidos dentro de esta ventana son UN movimiento (igual que el duelo). */
const VENTANA = 1500

export function MesaContador() {
  const navigate = useNavigate()
  const { currentProfile } = useAuth()

  const [mesa, setMesa] = useState<Mesa | null>(null)
  /* Una mesa a medio jugar no se pierde por recargar: en una tienda, perder
   * los totales por un toque accidental es perder la partida.
   *
   * Se lee en el inicializador, no en un efecto: localStorage es
   * síncrono, así que un efecto solo servía para escribir estado dentro de un
   * efecto — renders en cascada por nada. */
  const [restaurable, setRestaurable] = useState<Mesa | null>(() => cargar())
  const [cuantos, setCuantos] = useState<3 | 4>(4)
  const [bases, setBases] = useState<Card[]>([])
  const [decks, setDecks] = useState<MazoDeAlguien[]>([])
  const [elegidos, setElegidos] = useState<Record<number, { base: Card; lider: Card | null }>>({})

  useEffect(() => {
    let vivo = true
    void (async () => {
      await ensureCards().catch(() => {})
      const todas = await db.cards.toArray().catch(() => [] as Card[])
      if (!vivo) return
      // Las bases traen su vida impresa: nadie escribe «30» a mano.
      setBases(todas.filter(c => c.type === 'Base' && c.isCanonical).sort((a, b) => a.name.localeCompare(b.name)))
    })()
    return () => { vivo = false }
  }, [])

  useEffect(() => {
    if (!currentProfile?.id) return
    let vivo = true
    void (async () => {
      const m = await mazosParaContador(currentProfile.id).catch(() => [] as MazoDeAlguien[])
      if (vivo) setDecks(m)
    })()
    return () => { vivo = false }
  }, [currentProfile?.id])

  // La pantalla no se apaga con una mesa abierta.
  useEffect(() => {
    if (!mesa) return
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    void nav.wakeLock?.request('screen').then(l => { lock = l }).catch(() => {})
    return () => { void lock?.release().catch(() => {}) }
  }, [mesa])

  const cambiar = useCallback((f: (m: Mesa) => Mesa) => {
    setMesa(prev => {
      if (!prev) return prev
      const n = f(prev)
      guardar(n)
      return n
    })
  }, [])

  const vida = useCallback((asiento: number, delta: number) => {
    cambiar(m => {
      const j = [...m.jugadores]
      const antes = j[asiento].vida
      // La vida no baja de 0 ni sube por encima de la impresa de la base.
      const nueva = Math.max(0, Math.min(j[asiento].vidaInicial, antes + delta))
      if (nueva === antes) return m
      j[asiento] = { ...j[asiento], vida: nueva }

      // Toques seguidos del mismo asiento se agrupan en UN movimiento, así
      // deshacer no obliga a dar siete toques para desandar siete.
      const ahora = Date.now()
      const ult = m.hist[m.hist.length - 1]
      const hist = ult && ult.asiento === asiento && ahora - ult.ts < VENTANA
        ? [...m.hist.slice(0, -1), { ...ult, delta: ult.delta + (nueva - antes), ts: ahora }]
        : [...m.hist, { asiento, delta: nueva - antes, ts: ahora }]

      return { ...m, jugadores: j, hist }
    })
  }, [cambiar])

  const deshacer = useCallback(() => {
    cambiar(m => {
      const ult = m.hist[m.hist.length - 1]
      if (!ult) return m
      const j = [...m.jugadores]
      j[ult.asiento] = { ...j[ult.asiento], vida: j[ult.asiento].vida - ult.delta }
      vibrar(18)
      return { ...m, jugadores: j, hist: m.hist.slice(0, -1) }
    })
  }, [cambiar])

  function empezar() {
    const jugadores: LadoDuelo[] = Array.from({ length: cuantos }, (_, i) => {
      const e = elegidos[i]
      return {
        baseNombre: e?.base.name ?? 'Base',
        baseImg: e?.base.imageUrl ?? null,
        vidaInicial: e?.base.hp ?? 30,
        vida: e?.base.hp ?? 30,
        victorias: 0,
        liderNombre: e?.lider?.name ?? null,
        liderImg: e?.lider?.imageUrl ?? null,
        liderDesplegado: false,
        avatar: i === 0 ? (currentProfile?.avatar ?? null) : null,
        etiqueta: i === 0 ? (currentProfile?.name ?? 'Vos') : `Asiento ${i + 1}`,
      }
    })
    const m: Mesa = { id: crypto.randomUUID(), jugadores, iniciativa: null, caidos: [], hist: [] }
    guardar(m)
    setMesa(m)
    setRestaurable(null)
  }

  /* ── Mesa en curso ── */
  if (mesa) {
    const n = mesa.jugadores.length
    // Con 4: rejilla 2×2, los de arriba rotados. Con 3: uno arriba rotado y
    // dos abajo — el de arriba es quien está enfrente de quien sostiene.
    const invertido = (i: number) => (n === 4 ? i < 2 : i === 0)

    /* `fixed inset-0 z-[60]` es lo mismo que hace el duelo de dos: en una
     * mesa el teléfono va en el centro, y el Header y la TabBar de la app
     * roban el alto que hace falta para cuatro paneles. */
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-[#060913]">
        <div className={`grid min-h-0 flex-1 gap-px bg-swu-border/40 ${
          n === 4 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-2 grid-rows-2'
        }`}>
          {mesa.jugadores.map((j, i) => (
            <div
              key={i}
              className={`relative flex min-h-0 flex-col bg-swu-bg ${
                n === 3 && i === 0 ? 'col-span-2' : ''
              } ${mesa.caidos.includes(i) ? 'opacity-45' : ''}`}
            >
              <MitadJugador
                lado={j}
                invertida={invertido(i)}
                conIniciativa={mesa.iniciativa === i}
                compacta
                onVida={d => vida(i, d)}
                onIniciativa={() => cambiar(m => ({ ...m, iniciativa: m.iniciativa === i ? null : i }))}
                onVictorias={() => { /* Twin Suns es a una partida: no hay mejor-de-3 */ }}
                onDesplegarLider={() => cambiar(m => {
                  const js = [...m.jugadores]
                  js[i] = { ...js[i], liderDesplegado: !js[i].liderDesplegado }
                  return { ...m, jugadores: js }
                })}
              />
              {/* Marcar quién cayó: el ORDEN es el puesto de la mesa al revés. */}
              <button
                onClick={() => cambiar(m => ({
                  ...m,
                  caidos: m.caidos.includes(i) ? m.caidos.filter(x => x !== i) : [...m.caidos, i],
                }))}
                aria-label={`Marcar que ${j.etiqueta} quedó fuera`}
                className={`absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-lg
                            text-[11px] font-bold ${
                  mesa.caidos.includes(i)
                    ? 'bg-swu-red/25 text-swu-red-texto'
                    : 'bg-black/30 text-white/45'
                } ${invertido(i) ? 'rotate-180' : ''}`}
              >
                {mesa.caidos.includes(i) ? n - mesa.caidos.indexOf(i) + '.º' : <Skull size={14} />}
              </button>
            </div>
          ))}
        </div>

        {/* Barra de control, siempre derecha para quien sostiene el teléfono. */}
        <div className="flex items-center justify-between gap-2 border-t border-swu-border bg-swu-surface px-3 py-2">
          <button
            onClick={deshacer}
            disabled={mesa.hist.length === 0}
            className="flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold
                       text-swu-muted disabled:opacity-30"
          >
            <Undo2 size={15} /> Deshacer
          </button>

          <p className="font-mono text-[10px] uppercase tracking-widest text-swu-muted">
            {mesa.caidos.length > 0
              ? `${mesa.caidos.length} de ${n} fuera`
              : `Mesa de ${n}`}
          </p>

          <button
            onClick={() => {
              if (mesa.caidos.length < n - 1 && !confirm('La mesa no terminó. ¿Cerrarla igual?')) return
              borrarGuardado()
              setMesa(null)
              setElegidos({})
            }}
            className="flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-swu-muted"
          >
            <RotateCcw size={15} /> Terminar
          </button>
        </div>

        {/* El resultado, para pasarlo al torneo. Aparece cuando ya cayeron
            todos menos uno: ese que queda es el 1.º de la mesa. */}
        {mesa.caidos.length >= n - 1 && (
          <div className="border-t border-swu-amber/40 bg-swu-amber/10 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-swu-amber">Puestos de la mesa</p>
            <p className="mt-0.5 text-xs text-swu-text">
              {mesa.jugadores
                .map((j, i) => ({ j, i }))
                .sort((x, y) => {
                  const px = mesa.caidos.indexOf(x.i), py = mesa.caidos.indexOf(y.i)
                  // Quien no cayó va primero; entre los caídos, el último en caer va antes.
                  if (px === -1) return -1
                  if (py === -1) return 1
                  return py - px
                })
                .map((x, k) => `${k + 1}.º ${x.j.etiqueta}`)
                .join(' · ')}
            </p>
          </div>
        )}
      </div>
    )
  }

  /* ── Preparar la mesa ── */
  return (
    <div className="min-h-screen space-y-3 bg-swu-bg px-4 py-4 pb-24">
      <button
        onClick={() => navigate('/contador')}
        className="flex min-h-[44px] items-center gap-1.5 text-xs text-swu-muted"
      >
        <ArrowLeft size={14} /> Contador de dos
      </button>

      <header>
        <h1 className="flex items-center gap-2 text-xl font-black text-swu-text">
          <Users size={20} className="text-swu-amber" /> Mesa de Twin Suns
        </h1>
        <p className="text-xs text-swu-muted">
          El teléfono en el centro. Cada quien ve su vida derecha desde su lado.
        </p>
      </header>

      {restaurable && (
        <div className="rounded-xl border border-swu-amber/40 bg-swu-amber/10 p-3">
          <p className="text-sm font-bold text-swu-text">Hay una mesa a medias</p>
          <p className="text-xs text-swu-muted">
            {restaurable.jugadores.map(j => `${j.etiqueta} ${j.vida}`).join(' · ')}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => { setMesa(restaurable); setRestaurable(null) }}
              className="min-h-[44px] rounded-lg bg-swu-accent px-4 text-sm font-semibold text-white"
            >
              Seguir
            </button>
            <button
              onClick={() => { borrarGuardado(); setRestaurable(null) }}
              className="min-h-[44px] rounded-lg border border-swu-border px-4 text-sm text-swu-muted"
            >
              Empezar otra
            </button>
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-swu-muted">
          Cuántos en la mesa
        </p>
        <div className="flex gap-2">
          {([3, 4] as const).map(c => (
            <button
              key={c}
              onClick={() => setCuantos(c)}
              className={`min-h-[44px] flex-1 rounded-xl text-sm font-bold transition-colors ${
                cuantos === c
                  ? 'bg-swu-amber/20 text-swu-amber ring-1 ring-swu-amber/50'
                  : 'border border-swu-border text-swu-muted'
              }`}
            >
              {c} jugadores
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-swu-muted">
          Twin Suns se juega en mesas de 3 o 4. No hay mesas de 2 ni de 5.
        </p>
      </div>

      {Array.from({ length: cuantos }, (_, i) => (
        <SelectorLado
          key={i}
          titulo={i === 0 ? `Vos${currentProfile?.name ? ` (${currentProfile.name})` : ''}` : `Asiento ${i + 1}`}
          bases={bases}
          decks={i === 0 ? decks : []}
          elegido={elegidos[i] ?? null}
          onElegir={(base, lider) => setElegidos(p => ({ ...p, [i]: { base, lider } }))}
        />
      ))}

      <button
        disabled={Object.keys(elegidos).length < cuantos}
        onClick={empezar}
        className="w-full rounded-2xl bg-swu-red py-3 text-sm font-bold text-white
                   transition-transform active:scale-[0.99] disabled:opacity-40"
      >
        <Plus size={15} className="mr-1 inline" />
        Empezar mesa de {cuantos}
      </button>
    </div>
  )
}

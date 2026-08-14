/**
 * ESTUDIO — el panel que opera el marcador en vivo.
 *
 * Pensado para el pulgar de alguien que además está narrando: botones grandes,
 * lo que más cambia arriba, y una mini-vista de lo que está saliendo al aire.
 *
 * Las tres medidas anti-error, en orden de importancia:
 *  1. La mini-vista. Sin ella el operador escribe a ciegas — y si tecleó mal el
 *     código, se ve en dos segundos porque la vista sale vacía.
 *  2. DESHACER en el daño, que es el control de mayor frecuencia y consecuencia.
 *  3. Valores acotados y estado optimista con aviso de SIN GUARDAR: nada se
 *     pierde en silencio.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  Lock,
  LockOpen,
  RotateCcw,
  Search,
  Undo2,
  X,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  ESTADO_INICIAL,
  formatearReloj,
  restanteReloj,
  type EstadoOverlay,
} from '../../types/stream'
import {
  aplicarAccion,
  leerOverlay,
  reducir,
  suscribirOverlay,
  type Accion,
} from '../../services/streamOverlay'
import {
  buscarCartas,
  cargarCartasStream,
  imgCarta,
  type CartaStream,
} from '../../services/streamCartas'

type Indice = 0 | 1

const RONDAS = ['RONDA 1', 'RONDA 2', 'RONDA 3', 'RONDA 4', 'RONDA 5', 'TOP 8', 'TOP 4', 'FINAL']

export function EstudioPage() {
  const { code = '' } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { isAdmin, currentProfile, initAuth, authListo, rolListo } = useAuth()

  const [estado, setEstado] = useState<EstadoOverlay>(ESTADO_INICIAL)
  const [cargando, setCargando] = useState(true)
  const [sinGuardar, setSinGuardar] = useState(false)
  const [bloqueado, setBloqueado] = useState(false)
  const [ahora, setAhora] = useState(() => Date.now())
  const [ultimoDano, setUltimoDano] = useState<{ lado: Indice; delta: number; hasta: number } | null>(null)

  useEffect(() => {
    initAuth()
  }, [initAuth])

  /* Misma guarda que AdminLayout: solo expulsa cuando YA SE SABE que no es
     admin. Con `currentProfile && !isAdmin` a secas, un admin recién promovido
     —o cualquiera con `isAdmin:false` guardado en localStorage— quedaba fuera
     de su propio panel antes de que la nube respondiera. */
  useEffect(() => {
    if (rolListo && currentProfile && !isAdmin) navigate('/', { replace: true })
  }, [rolListo, currentProfile, isAdmin, navigate])

  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  /* ── Carga inicial + suscripción ──
   * El panel NUNCA escribe al montar: lee primero. Un panel recién abierto no
   * puede pisar el estado con un blanco. */
  const escrituras = useRef(0)

  useEffect(() => {
    if (!code) return
    let vivo = true

    leerOverlay(code)
      .then(r => {
        if (!vivo) return
        setEstado(r.estado)
        setCargando(false)
      })
      .catch(() => {
        if (vivo) setCargando(false)
      })

    const cortar = suscribirOverlay(code, r => {
      // Con una escritura propia en vuelo, el eco de la nube llega con el
      // estado anterior y haría parpadear el contador hacia atrás.
      if (vivo && escrituras.current === 0) setEstado(r.estado)
    })

    return () => {
      vivo = false
      cortar()
    }
  }, [code])

  /* ── Cola de escritura ──
   * Las acciones se serializan: dos toques rápidos en +1 no compiten por la
   * misma versión de la fila. */
  const cola = useRef<Promise<unknown>>(Promise.resolve())

  const aplicar = useCallback(
    (accion: Accion) => {
      if (bloqueado) return

      // Optimista: la UI responde en el acto.
      setEstado(prev => reducir(prev, accion))
      escrituras.current += 1

      cola.current = cola.current
        .then(() => aplicarAccion(code, accion))
        .then(estadoServidor => {
          setSinGuardar(false)
          if (escrituras.current === 1) setEstado(estadoServidor)
        })
        .catch(() => setSinGuardar(true))
        .finally(() => {
          escrituras.current = Math.max(0, escrituras.current - 1)
        })
    },
    [bloqueado, code]
  )

  const cambiarDano = useCallback(
    (lado: Indice, delta: number) => {
      aplicar({ t: 'dano', lado, delta })
      setUltimoDano({ lado, delta, hasta: Date.now() + 5000 })
    },
    [aplicar]
  )

  const restante = useMemo(() => restanteReloj(estado.reloj, ahora), [estado.reloj, ahora])
  const relojCorriendo = estado.reloj.iniciadoEn !== null
  const deshacerVisible = ultimoDano && ultimoDano.hasta > ahora ? ultimoDano : null

  if (!code) return null

  // ── Guardas de sesión (esta ruta NO usa AuthGate; ver App.tsx) ──
  // El orden importa: para un anónimo, authListo pasa a true pero rolListo se
  // queda en false. Por eso se pregunta por la sesión ANTES que por el rol —
  // si no, un visitante sin cuenta giraría en el cargador para siempre.
  if (!authListo) return <Pantalla>Verificando acceso…</Pantalla>

  if (!currentProfile) {
    return (
      <Pantalla>
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-lg font-semibold text-swu-text">Panel de transmisión</p>
          <p className="max-w-xs text-sm text-swu-muted">
            Iniciá sesión con tu cuenta de administrador para operar el marcador.
          </p>
          <button
            onClick={() => navigate('/profile')}
            className="rounded-xl bg-swu-accent px-5 py-3 text-sm font-bold text-white"
          >
            Iniciar sesión
          </button>
        </div>
      </Pantalla>
    )
  }

  // Logueado pero el rol aún no se confirma, o no es admin (el efecto de arriba
  // ya redirige a Inicio): no se pinta el panel en ninguno de los dos casos.
  if (!rolListo) return <Pantalla>Verificando acceso…</Pantalla>
  if (!isAdmin) return <Pantalla>Redirigiendo…</Pantalla>

  if (cargando) return <Pantalla>Cargando marcador…</Pantalla>

  return (
    <div className="min-h-screen bg-swu-bg pb-24 text-swu-text">
      {/* ── Barra fija ── */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-swu-border bg-swu-surface/95 px-4 py-3 backdrop-blur">
        <button
          onClick={() => navigate('/admin')}
          className="rounded-lg p-2 text-swu-muted hover:bg-swu-surface-hover"
          aria-label="Volver"
        >
          <ChevronLeft size={22} />
        </button>

        <div className="flex min-w-0 flex-col">
          <span className="text-xs uppercase tracking-widest text-swu-muted">Estudio</span>
          <span className="truncate font-mono text-lg font-bold">{code}</span>
        </div>

        <span
          className={`ml-auto flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${
            sinGuardar ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${sinGuardar ? 'bg-red-400' : 'bg-emerald-400'}`} />
          {sinGuardar ? 'Sin guardar' : 'Al aire'}
        </span>

        <button
          onClick={() => setBloqueado(b => !b)}
          className={`rounded-lg p-2.5 ${
            bloqueado ? 'bg-amber-500/20 text-amber-400' : 'text-swu-muted hover:bg-swu-surface-hover'
          }`}
          aria-label={bloqueado ? 'Desbloquear controles' : 'Bloquear controles'}
        >
          {bloqueado ? <Lock size={20} /> : <LockOpen size={20} />}
        </button>
      </header>

      <div className="mx-auto flex max-w-2xl flex-col gap-5 p-4">
        {bloqueado && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Controles bloqueados. Tocá el candado para volver a operar.
          </p>
        )}

        <MiniVista code={code} />

        <Escenas escena={estado.escena} onEscena={e => aplicar({ t: 'escena', escena: e })} />

        {/* Daño primero: es lo que más se toca. */}
        <div className="flex flex-col gap-4">
          {([0, 1] as Indice[]).map(i => (
            <TarjetaJugador
              key={i}
              indice={i}
              estado={estado}
              onDano={cambiarDano}
              onAccion={aplicar}
              deshacer={deshacerVisible?.lado === i ? deshacerVisible.delta : null}
              onDeshacer={() => {
                if (!deshacerVisible) return
                aplicar({ t: 'dano', lado: i, delta: -deshacerVisible.delta })
                setUltimoDano(null)
              }}
            />
          ))}
        </div>

        <Bloque titulo="Iniciativa">
          <div className="grid grid-cols-2 gap-2">
            {([0, 1] as Indice[]).map(i => (
              <button
                key={i}
                onClick={() => aplicar({ t: 'iniciativa', lado: estado.iniciativa === i ? null : i })}
                className={`min-h-[64px] rounded-xl border-2 px-4 text-base font-bold transition ${
                  estado.iniciativa === i
                    ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                    : 'border-swu-border bg-swu-surface text-swu-muted'
                }`}
              >
                {estado.lados[i].nombre || `Jugador ${i + 1}`}
              </button>
            ))}
          </div>
        </Bloque>

        <Bloque titulo="Ronda">
          <div className="flex flex-wrap gap-2">
            {RONDAS.map(r => (
              <button
                key={r}
                onClick={() => aplicar({ t: 'ronda', etiqueta: r })}
                className={`rounded-lg border px-3 py-2.5 text-sm font-semibold ${
                  estado.etiquetaRonda === r
                    ? 'border-swu-accent bg-swu-accent/15 text-swu-accent-texto'
                    : 'border-swu-border bg-swu-surface text-swu-muted'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </Bloque>

        <Bloque titulo="Reloj">
          <div className="flex flex-col gap-3">
            <span className="text-center font-mono text-5xl font-black tabular-nums">
              {restante !== null ? formatearReloj(restante) : '--:--'}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() =>
                  aplicar(relojCorriendo ? { t: 'relojPausar', ahora: Date.now() } : { t: 'relojIniciar', ahora: Date.now() })
                }
                className="min-h-[60px] rounded-xl bg-swu-accent/20 text-base font-bold text-swu-accent-texto"
              >
                {relojCorriendo ? 'PAUSA' : 'INICIAR'}
              </button>
              <button
                onClick={() => aplicar({ t: 'relojExtender', minutos: 5, ahora: Date.now() })}
                className="min-h-[60px] rounded-xl border border-swu-border bg-swu-surface text-base font-bold"
              >
                +5 MIN
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[55, 50, 40].map(m => (
                <button
                  key={m}
                  onClick={() => aplicar({ t: 'relojDuracion', minutos: m })}
                  className="min-h-[48px] rounded-lg border border-swu-border bg-swu-surface text-sm font-semibold text-swu-muted"
                >
                  {m} min
                </button>
              ))}
            </div>

            {/* Un solo botón que hace lo correcto de una vez: en eliminación
                gana quien tenga más HP restante, y la iniciativa desempata.
                Esos dos números SON el resultado del partido en ese momento. */}
            <button
              onClick={() => aplicar({ t: 'tiempoExtra', valor: !estado.tiempoExtra })}
              className={`min-h-[64px] rounded-xl border-2 text-base font-black tracking-wider ${
                estado.tiempoExtra
                  ? 'border-red-500 bg-red-500/25 text-red-300'
                  : 'border-swu-border bg-swu-surface text-swu-muted'
              }`}
            >
              {estado.tiempoExtra ? 'QUITAR TIEMPO' : 'TIEMPO'}
            </button>
          </div>
        </Bloque>

        <Bloque titulo="Partida">
          <div className="flex flex-col gap-2">
            <button
              onClick={() => aplicar({ t: 'revision', valor: !estado.enRevision })}
              className={`min-h-[60px] rounded-xl border-2 text-base font-bold ${
                estado.enRevision
                  ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                  : 'border-swu-border bg-swu-surface text-swu-muted'
              }`}
            >
              {estado.enRevision ? 'QUITAR REVISIÓN' : 'PARTIDA EN REVISIÓN'}
            </button>

            <ConConfirmacion
              etiqueta="NUEVO JUEGO"
              pregunta="¿Nuevo juego? Se pone el daño en cero y se conservan líder, base y HP máximo."
              onConfirmar={() => aplicar({ t: 'nuevoJuego' })}
            />

            <button
              onClick={() => aplicar({ t: 'intercambiar' })}
              className="min-h-[56px] rounded-xl border border-swu-border bg-swu-surface text-sm font-semibold text-swu-muted"
            >
              INTERCAMBIAR LADOS
            </button>

            <ConConfirmacion
              etiqueta="REINICIAR MARCADOR"
              pregunta="¿Reiniciar todo? Se conservan solo los nombres de los jugadores."
              peligro
              onConfirmar={() => aplicar({ t: 'reiniciar' })}
            />
          </div>
        </Bloque>

        <Bloque titulo="Texto en pantalla">
          <div className="flex flex-col gap-2">
            <CampoTexto
              etiqueta="Mensaje de las escenas opacas"
              valor={estado.mensaje}
              onGuardar={v => aplicar({ t: 'mensaje', texto: v })}
            />
            <CampoTexto
              etiqueta="Patrocinio / tienda anfitriona"
              valor={estado.patrocinio}
              onGuardar={v => aplicar({ t: 'patrocinio', texto: v })}
            />
          </div>
        </Bloque>

        <div className="rounded-xl border border-swu-border bg-swu-surface p-4 text-sm text-swu-muted">
          <p className="mb-2 font-semibold text-swu-text">En OBS, como Browser Source:</p>
          <code className="block break-all rounded-lg bg-swu-bg px-3 py-2 font-mono text-xs">
            {typeof window !== 'undefined' ? window.location.origin : ''}/overlay/{code}
          </code>
          <p className="mt-2 text-xs">1920 × 1080 · «Apagar fuente cuando no esté visible» y «Refrescar al activar la escena» en OFF.</p>
        </div>
      </div>
    </div>
  )
}

/* ── Mini-vista ─────────────────────────────────────────────────────── */

function MiniVista({ code }: { code: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-swu-border bg-black">
      <div className="flex items-center justify-between border-b border-swu-border bg-swu-surface px-3 py-2">
        <span className="text-xs font-bold uppercase tracking-widest text-swu-muted">Al aire</span>
        <span className="text-[10px] text-swu-muted">lo que ve la gente</span>
      </div>
      {/* 1920×1080 al 25% = 480×270. El iframe se escala; no se re-implementa
          nada, es el MISMO componente del overlay. */}
      <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
        <iframe
          title="Vista del marcador"
          src={`/overlay/${code}?fondo=oscuro`}
          className="absolute left-0 top-0 origin-top-left border-0"
          style={{ width: 1920, height: 1080, transform: 'scale(0.25)' }}
          // Sandbox mínimo: es nuestra propia ruta, pero no necesita
          // formularios, popups ni navegación de nivel superior.
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  )
}

/* ── Escenas ────────────────────────────────────────────────────────── */

const ESCENAS_UI: { id: EstadoOverlay['escena']; texto: string }[] = [
  { id: 'pronto', texto: 'PRONTO' },
  { id: 'juego', texto: 'JUEGO' },
  { id: 'descanso', texto: 'DESCANSO' },
  { id: 'fin', texto: 'FIN' },
]

function Escenas({
  escena,
  onEscena,
}: {
  escena: EstadoOverlay['escena']
  onEscena: (e: EstadoOverlay['escena']) => void
}) {
  return (
    <Bloque titulo="Escena">
      <div className="grid grid-cols-4 gap-2">
        {ESCENAS_UI.map(e => (
          <button
            key={e.id}
            onClick={() => onEscena(e.id)}
            className={`min-h-[64px] rounded-xl border-2 text-sm font-black tracking-wide transition ${
              escena === e.id
                ? 'border-swu-accent bg-swu-accent/20 text-swu-accent-texto'
                : 'border-swu-border bg-swu-surface text-swu-muted'
            }`}
          >
            {e.texto}
          </button>
        ))}
      </div>
    </Bloque>
  )
}

/* ── Tarjeta de jugador ─────────────────────────────────────────────── */

function TarjetaJugador({
  indice,
  estado,
  onDano,
  onAccion,
  deshacer,
  onDeshacer,
}: {
  indice: Indice
  estado: EstadoOverlay
  onDano: (lado: Indice, delta: number) => void
  onAccion: (a: Accion) => void
  deshacer: number | null
  onDeshacer: () => void
}) {
  const lado = estado.lados[indice]
  const restanteHp = Math.max(0, lado.hpMax - lado.dano)

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-swu-border bg-swu-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <CampoTexto
          etiqueta={`Jugador ${indice + 1}`}
          valor={lado.nombre}
          onGuardar={v => onAccion({ t: 'jugador', lado: indice, campos: { nombre: v } })}
          compacto
        />
        <span className="shrink-0 text-right">
          <span className="block font-mono text-3xl font-black tabular-nums">{restanteHp}</span>
          <span className="block text-[11px] text-swu-muted">
            {lado.dano} daño / {lado.hpMax}
          </span>
        </span>
      </div>

      {/* Daño: el control de mayor frecuencia, arriba y grande. */}
      <div className="grid grid-cols-4 gap-2">
        {[-5, -1, 1, 5].map(d => (
          <button
            key={d}
            onClick={() => onDano(indice, d)}
            className={`min-h-[64px] rounded-xl text-xl font-black ${
              d > 0 ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/15 text-emerald-300'
            }`}
          >
            {d > 0 ? `+${d}` : d}
          </button>
        ))}
      </div>

      {deshacer !== null && (
        <button
          onClick={onDeshacer}
          className="flex items-center justify-center gap-2 rounded-lg bg-swu-surface-hover py-2.5 text-sm font-semibold"
        >
          <Undo2 size={16} />
          Deshacer {deshacer > 0 ? `+${deshacer}` : deshacer}
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Contador
          etiqueta="Recursos"
          valor={lado.recursos}
          onDelta={d => onAccion({ t: 'recursos', lado: indice, delta: d })}
        />
        <Contador
          etiqueta="Juegos"
          valor={lado.juegosGanados}
          onDelta={d => onAccion({ t: 'juegos', lado: indice, delta: d })}
        />
      </div>

      <label className="flex items-center justify-between rounded-lg bg-swu-bg px-3 py-3 text-sm font-semibold">
        Líder desplegado
        <input
          type="checkbox"
          checked={lado.liderDesplegado}
          onChange={e =>
            onAccion({ t: 'jugador', lado: indice, campos: { liderDesplegado: e.target.checked } })
          }
          className="h-6 w-6 accent-amber-400"
        />
      </label>

      <BuscadorCarta
        tipo="lider"
        etiqueta="Líder"
        actual={lado.liderNombre}
        onElegir={c =>
          onAccion({
            t: 'jugador',
            lado: indice,
            campos: { liderNombre: c.nombre, liderImg: c.img, liderAspectos: c.aspectos },
          })
        }
      />

      <BuscadorCarta
        tipo="base"
        etiqueta="Base"
        actual={lado.baseNombre}
        onElegir={c =>
          onAccion({
            t: 'jugador',
            lado: indice,
            // El HP máximo sale de la CARTA, no de un 30 por defecto: las bases
            // van de 24 a 35 y ese es exactamente el bug del tracker viejo.
            campos: { baseNombre: c.nombre, baseImg: c.img, hpMax: c.hp ?? 30 },
          })
        }
      />
    </section>
  )
}

function Contador({
  etiqueta,
  valor,
  onDelta,
}: {
  etiqueta: string
  valor: number
  onDelta: (d: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-swu-muted">{etiqueta}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onDelta(-1)}
          className="min-h-[52px] flex-1 rounded-lg bg-swu-bg text-xl font-bold"
        >
          −
        </button>
        <span className="w-10 text-center font-mono text-2xl font-black tabular-nums">{valor}</span>
        <button
          onClick={() => onDelta(1)}
          className="min-h-[52px] flex-1 rounded-lg bg-swu-bg text-xl font-bold"
        >
          +
        </button>
      </div>
    </div>
  )
}

/* ── Buscador de cartas ─────────────────────────────────────────────── */

function BuscadorCarta({
  tipo,
  etiqueta,
  actual,
  onElegir,
}: {
  tipo: 'lider' | 'base'
  etiqueta: string
  actual: string
  onElegir: (c: CartaStream) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [termino, setTermino] = useState('')
  const [cartas, setCartas] = useState<CartaStream[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!abierto) return
    let vivo = true
    cargarCartasStream()
      .then(c => {
        if (vivo) setCartas(tipo === 'lider' ? c.lideres : c.bases)
      })
      .catch(() => {
        if (vivo) setError(true)
      })
    return () => {
      vivo = false
    }
  }, [abierto, tipo])

  const resultados = useMemo(() => buscarCartas(cartas, termino), [cartas, termino])

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center gap-2 rounded-lg border border-swu-border bg-swu-bg px-3 py-3 text-left text-sm"
      >
        <Search size={16} className="shrink-0 text-swu-muted" />
        <span className="min-w-0 flex-1 truncate">
          <span className="text-swu-muted">{etiqueta}: </span>
          {actual || 'sin elegir'}
        </span>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-swu-accent/40 bg-swu-bg p-3">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={termino}
          onChange={e => setTermino(e.target.value)}
          placeholder={`Buscar ${etiqueta.toLowerCase()}…`}
          className="min-w-0 flex-1 rounded-lg bg-swu-surface px-3 py-2.5 text-sm outline-none"
        />
        <button
          onClick={() => setAbierto(false)}
          className="rounded-lg p-2 text-swu-muted"
          aria-label="Cerrar buscador"
        >
          <X size={18} />
        </button>
      </div>

      {error ? (
        <p className="py-2 text-center text-xs text-red-400">
          No se pudo cargar el catálogo. Se puede seguir sin imagen.
        </p>
      ) : (
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {resultados.map(c => (
            <li key={c.id}>
              <button
                onClick={() => {
                  onElegir(c)
                  setAbierto(false)
                  setTermino('')
                }}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-swu-surface-hover"
              >
                {c.img && (
                  <img
                    src={imgCarta(c.img, 128)}
                    alt=""
                    loading="lazy"
                    className="h-11 w-11 shrink-0 rounded object-cover"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{c.nombre}</span>
                  <span className="block truncate text-xs text-swu-muted">
                    {c.subtitulo}
                    {c.hp !== null && ` · ${c.hp} HP`}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {resultados.length === 0 && (
            <li className="py-3 text-center text-xs text-swu-muted">Sin resultados</li>
          )}
        </ul>
      )}
    </div>
  )
}

/* ── Piezas sueltas ─────────────────────────────────────────────────── */

function Pantalla({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-swu-bg px-6 text-swu-muted">
      {children}
    </div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-swu-border bg-swu-surface p-4">
      <h2 className="text-xs font-bold uppercase tracking-widest text-swu-muted">{titulo}</h2>
      {children}
    </section>
  )
}

function CampoTexto({
  etiqueta,
  valor,
  onGuardar,
  compacto,
}: {
  etiqueta: string
  valor: string
  onGuardar: (v: string) => void
  compacto?: boolean
}) {
  /* Input NO controlado, reseteado con `key={valor}`. No se guarda por
     pulsación (eso sube al servidor solo en `onBlur`), así que mientras se
     escribe `valor` no cambia y el campo no se reinicia. Un cambio ajeno que
     llegue por realtime SÍ cambia `valor` → nueva key → el campo toma el valor
     nuevo, que es lo correcto cuando otro operador editó el mismo campo. Sin
     estado ni efecto: nada que pise el texto a media escritura. */
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${compacto ? 'flex-1' : ''}`}>
      <span className="text-[11px] uppercase tracking-wider text-swu-muted">{etiqueta}</span>
      <input
        key={valor}
        defaultValue={valor}
        onBlur={e => {
          if (e.target.value !== valor) onGuardar(e.target.value)
        }}
        className="w-full rounded-lg bg-swu-bg px-3 py-2.5 text-sm outline-none"
      />
    </label>
  )
}

function ConConfirmacion({
  etiqueta,
  pregunta,
  onConfirmar,
  peligro,
}: {
  etiqueta: string
  pregunta: string
  onConfirmar: () => void
  peligro?: boolean
}) {
  const [preguntando, setPreguntando] = useState(false)

  if (!preguntando) {
    return (
      <button
        onClick={() => setPreguntando(true)}
        className={`min-h-[56px] rounded-xl border text-sm font-bold ${
          peligro
            ? 'border-red-500/40 bg-red-500/10 text-red-300'
            : 'border-swu-border bg-swu-surface text-swu-text'
        }`}
      >
        {etiqueta}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
      <p className="text-sm text-amber-200">{pregunta}</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setPreguntando(false)}
          className="min-h-[48px] rounded-lg bg-swu-surface text-sm font-semibold"
        >
          Cancelar
        </button>
        <button
          onClick={() => {
            onConfirmar()
            setPreguntando(false)
          }}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-amber-500 text-sm font-bold text-black"
        >
          <RotateCcw size={16} />
          Confirmar
        </button>
      </div>
    </div>
  )
}

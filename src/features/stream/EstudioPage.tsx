/**
 * ESTUDIO — la consola que opera el marcador en vivo.
 *
 * Pensado para el pulgar de alguien que además está narrando: cada control
 * dice EXACTAMENTE qué hace, y lo que más se toca está más grande.
 *
 * La regla que gobierna el diseño del daño: en SWU el dial físico cuenta DAÑO,
 * pero el espectador lee VIDA RESTANTE. Un botón «+1» a secas es ambiguo —
 * ¿suma vida o suma daño? Por eso los botones van rotulados «MÁS DAÑO» /
 * «MENOS DAÑO», con la vida resultante en vivo debajo del pulgar.
 *
 * Las tres medidas anti-error, en orden de importancia:
 *  1. El monitor de PROGRAMA. Sin él el operador escribe a ciegas — y si tecleó
 *     mal el código, se ve en dos segundos porque el monitor sale vacío.
 *  2. DESHACER en el daño, que es el control de mayor frecuencia y consecuencia.
 *  3. Valores acotados y estado optimista con aviso de SIN GUARDAR: nada se
 *     pierde en silencio.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  Crown,
  Heart,
  Lock,
  LockOpen,
  Radio,
  RotateCcw,
  Search,
  Shield,
  Undo2,
  X,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  ESTADO_INICIAL,
  formatearReloj,
  mensajesTicker,
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

/** Identidad de cada lado, para que el operador no confunda las tarjetas. */
const LADO_UI = [
  { etiqueta: 'JUGADOR 1', barra: 'bg-sky-400', texto: 'text-sky-300', borde: 'border-sky-500/40', suave: 'bg-sky-500/10' },
  { etiqueta: 'JUGADOR 2', barra: 'bg-fuchsia-400', texto: 'text-fuchsia-300', borde: 'border-fuchsia-500/40', suave: 'bg-fuchsia-500/10' },
] as const

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
      setUltimoDano({ lado, delta, hasta: Date.now() + 6000 })
    },
    [aplicar]
  )

  const restante = useMemo(() => restanteReloj(estado.reloj, ahora), [estado.reloj, ahora])
  const cantidadTicker = useMemo(() => mensajesTicker(estado.ticker).length, [estado.ticker])
  const relojCorriendo = estado.reloj.iniciadoEn !== null
  const deshacerVisible = ultimoDano && ultimoDano.hasta > ahora ? ultimoDano : null
  const alAire = estado.escena === 'juego'

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

  if (!rolListo) return <Pantalla>Verificando acceso…</Pantalla>
  if (!isAdmin) return <Pantalla>Redirigiendo…</Pantalla>
  if (cargando) return <Pantalla>Cargando marcador…</Pantalla>

  return (
    <div className="min-h-screen bg-[#0d0f14] pb-16 text-swu-text">
      {/* ══ Barra de estado ══ */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0d0f14]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-3 py-2.5 sm:px-5">
          <button
            onClick={() => navigate('/')}
            className="rounded-lg p-2 text-swu-muted transition hover:bg-white/5 hover:text-swu-text"
            aria-label="Salir del estudio"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex min-w-0 items-baseline gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-swu-muted">Estudio</span>
            <span className="truncate font-mono text-base font-bold tracking-wider">{code}</span>
          </div>

          {/* Tally: rojo solo cuando la escena JUEGO está al aire. */}
          <span
            className={`ml-auto flex items-center gap-2 rounded-md px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] transition ${
              alAire
                ? 'bg-red-600 text-white shadow-[0_0_18px_rgba(220,38,38,.55)]'
                : 'bg-white/5 text-swu-muted'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${alAire ? 'animate-pulse bg-white' : 'bg-swu-muted'}`} />
            {alAire ? 'Al aire' : 'En espera'}
          </span>

          <span
            className={`hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider sm:flex ${
              sinGuardar ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/10 text-emerald-400'
            }`}
            title={sinGuardar ? 'No se pudo guardar el último cambio' : 'Todos los cambios guardados'}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${sinGuardar ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            {sinGuardar ? 'Sin guardar' : 'Sincronizado'}
          </span>

          <button
            onClick={() => setBloqueado(b => !b)}
            className={`rounded-lg p-2.5 transition ${
              bloqueado ? 'bg-amber-500/20 text-amber-300' : 'text-swu-muted hover:bg-white/5'
            }`}
            aria-label={bloqueado ? 'Desbloquear controles' : 'Bloquear controles'}
            title={bloqueado ? 'Desbloquear' : 'Bloquear para guardar el aparato'}
          >
            {bloqueado ? <Lock size={18} /> : <LockOpen size={18} />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5">
        {bloqueado && (
          <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Controles bloqueados. Tocá el candado para volver a operar.
          </p>
        )}

        {/* ══ Fila 1 · Monitor + mezclador de escenas ══
            El monitor se acota a 380 px en portátiles (lg) y crece a 460 solo
            en pantallas grandes: en una MacBook, 520 px se comían la fila. */}
        <div className="mb-3 grid gap-3 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
          <Monitor code={code} alAire={alAire} />

          <Panel titulo="Escena al aire" nota="Lo que ve la gente ahora">
            <Escenas escena={estado.escena} onEscena={e => aplicar({ t: 'escena', escena: e })} />

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <BotonEstado
                activo={estado.tiempoExtra}
                onClick={() => aplicar({ t: 'tiempoExtra', valor: !estado.tiempoExtra })}
                tono="rojo"
                titulo={estado.tiempoExtra ? 'Quitar TIEMPO' : 'TIEMPO'}
                sub="Fase de acción adicional"
              />
              <BotonEstado
                activo={estado.enRevision}
                onClick={() => aplicar({ t: 'revision', valor: !estado.enRevision })}
                tono="ambar"
                titulo={estado.enRevision ? 'Quitar revisión' : 'En revisión'}
                sub="Congela el marcador"
              />
            </div>
          </Panel>
        </div>

        {/* ══ Fila 2 · Los dos jugadores ══ */}
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
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

        {/* ══ Fila 3 · Reloj, ronda, partida, textos ══ */}
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <Panel titulo="Cronómetro" nota="Se ve arriba en pantalla">
            <div className="flex flex-col gap-3">
              <div
                className={`rounded-xl border py-4 text-center ${
                  restante !== null && restante <= 5 * 60 * 1000
                    ? 'border-amber-500/40 bg-amber-500/10'
                    : 'border-white/10 bg-black/30'
                }`}
              >
                <span className="block font-mono text-5xl font-black tabular-nums leading-none">
                  {restante !== null ? formatearReloj(restante) : '--:--'}
                </span>
                <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-swu-muted">
                  {relojCorriendo ? 'Corriendo' : 'Detenido'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    aplicar(relojCorriendo ? { t: 'relojPausar', ahora: Date.now() } : { t: 'relojIniciar', ahora: Date.now() })
                  }
                  className={`min-h-[58px] rounded-xl text-sm font-black uppercase tracking-wider transition ${
                    relojCorriendo
                      ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                  }`}
                >
                  {relojCorriendo ? 'Pausar' : 'Iniciar'}
                </button>
                <button
                  onClick={() => aplicar({ t: 'relojExtender', minutos: 5, ahora: Date.now() })}
                  className="min-h-[58px] rounded-xl border border-white/10 bg-white/5 text-sm font-black uppercase tracking-wider transition hover:bg-white/10"
                >
                  +5 min
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[55, 50, 40].map(m => (
                  <button
                    key={m}
                    onClick={() => aplicar({ t: 'relojDuracion', minutos: m })}
                    className="min-h-[44px] rounded-lg border border-white/10 bg-black/20 text-xs font-bold text-swu-muted transition hover:bg-white/5 hover:text-swu-text"
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </div>
          </Panel>

          <Panel titulo="Ronda e iniciativa">
            <div className="flex flex-col gap-4">
              <div>
                <Rotulo>Ronda</Rotulo>
                <div className="flex flex-wrap gap-1.5">
                  {RONDAS.map(r => (
                    <button
                      key={r}
                      onClick={() => aplicar({ t: 'ronda', etiqueta: r })}
                      className={`rounded-lg border px-2.5 py-2 text-xs font-bold transition ${
                        estado.etiquetaRonda === r
                          ? 'border-swu-accent bg-swu-accent/20 text-white'
                          : 'border-white/10 bg-black/20 text-swu-muted hover:bg-white/5'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Rotulo>¿Quién tiene la iniciativa?</Rotulo>
                <div className="grid grid-cols-2 gap-2">
                  {([0, 1] as Indice[]).map(i => (
                    <button
                      key={i}
                      onClick={() => aplicar({ t: 'iniciativa', lado: estado.iniciativa === i ? null : i })}
                      className={`min-h-[58px] truncate rounded-xl border-2 px-3 text-sm font-bold transition ${
                        estado.iniciativa === i
                          ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                          : 'border-white/10 bg-black/20 text-swu-muted hover:bg-white/5'
                      }`}
                    >
                      {estado.lados[i].nombre || `Jugador ${i + 1}`}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-swu-muted">
                  Tocá de nuevo al que está activo para quitarla.
                </p>
              </div>
            </div>
          </Panel>

          <div className="flex flex-col gap-4">
            <Panel titulo="Partida">
              <div className="flex flex-col gap-2">
                <ConConfirmacion
                  etiqueta="Nuevo juego"
                  pregunta="¿Nuevo juego? El daño vuelve a cero y se conservan líder, base y HP máximo."
                  onConfirmar={() => aplicar({ t: 'nuevoJuego' })}
                />
                <button
                  onClick={() => aplicar({ t: 'intercambiar' })}
                  className="min-h-[52px] rounded-xl border border-white/10 bg-black/20 text-xs font-bold uppercase tracking-wider text-swu-muted transition hover:bg-white/5"
                >
                  Intercambiar lados
                </button>
                <ConConfirmacion
                  etiqueta="Reiniciar marcador"
                  pregunta="¿Reiniciar todo? Se conservan solo los nombres de los jugadores."
                  peligro
                  onConfirmar={() => aplicar({ t: 'reiniciar' })}
                />
              </div>
            </Panel>

            <Panel titulo="Textos en pantalla">
              <div className="flex flex-col gap-3">
                <CampoTexto
                  etiqueta="Mensaje (pantallas de espera)"
                  valor={estado.mensaje}
                  onGuardar={v => aplicar({ t: 'mensaje', texto: v })}
                />
                <CampoTexto
                  etiqueta="Patrocinio / tienda"
                  valor={estado.patrocinio}
                  onGuardar={v => aplicar({ t: 'patrocinio', texto: v })}
                />
              </div>
            </Panel>

            <Panel titulo="Barra de comunidad" nota={`${cantidadTicker} mensaje${cantidadTicker === 1 ? '' : 's'}`}>
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => aplicar({ t: 'tickerVisible', valor: !estado.tickerVisible })}
                  className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 text-xs font-black uppercase tracking-wider transition ${
                    estado.tickerVisible
                      ? 'border-emerald-400 bg-emerald-400/20 text-emerald-200'
                      : 'border-white/10 bg-black/20 text-swu-muted hover:bg-white/5'
                  }`}
                >
                  <Radio size={14} />
                  {estado.tickerVisible ? 'Barra al aire' : 'Barra oculta'}
                </button>

                <CampoLargo
                  etiqueta="Un mensaje por línea"
                  valor={estado.ticker}
                  filas={5}
                  ayuda="Saludos, avisos del torneo, comentarios de la comunidad. Corren en bucle abajo."
                  onGuardar={v => aplicar({ t: 'ticker', texto: v })}
                />
              </div>
            </Panel>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <Rotulo>Fuente para OBS</Rotulo>
              <code className="block break-all rounded-lg bg-black/40 px-3 py-2 font-mono text-[11px] text-swu-muted">
                {typeof window !== 'undefined' ? window.location.origin : ''}/overlay/{code}
              </code>
              <p className="mt-2 text-[11px] leading-relaxed text-swu-muted">
                1920 × 1080 · CSS: <code className="text-[10px]">body {'{'} background: transparent {'}'}</code>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

/* ── Monitor de programa ────────────────────────────────────────────── */

function Monitor({ code, alAire }: { code: string; alAire: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border-2 transition ${
        alAire ? 'border-red-600/70 shadow-[0_0_28px_rgba(220,38,38,.25)]' : 'border-white/10'
      }`}
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-black/40 px-3 py-2">
        <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-swu-muted">
          <span className={`h-2 w-2 rounded-full ${alAire ? 'animate-pulse bg-red-500' : 'bg-swu-muted/50'}`} />
          Programa
        </span>
        <span className="text-[10px] uppercase tracking-wider text-swu-muted">lo que ve la gente</span>
      </div>
      {/* 1920×1080 escalado con `zoom`, que refluye la caja: con `transform`
          había que clavar la escala a mano y en pantallas chicas el iframe se
          salía del marco. Así el monitor se adapta al ancho que le toque. */}
      <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: '16 / 9' }}>
        <iframe
          title="Monitor de programa"
          src={`/overlay/${code}?fondo=oscuro`}
          className="absolute left-0 top-0 h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  )
}

/* ── Mezclador de escenas ───────────────────────────────────────────── */

const ESCENAS_UI: { id: EstadoOverlay['escena']; texto: string; sub: string }[] = [
  { id: 'pronto', texto: 'Pronto', sub: 'Antes de empezar' },
  { id: 'juego', texto: 'Juego', sub: 'Cámara + marcador' },
  { id: 'descanso', texto: 'Descanso', sub: 'Entre rondas' },
  { id: 'fin', texto: 'Fin', sub: 'Cierre' },
]

function Escenas({
  escena,
  onEscena,
}: {
  escena: EstadoOverlay['escena']
  onEscena: (e: EstadoOverlay['escena']) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {ESCENAS_UI.map(e => {
        const activo = escena === e.id
        return (
          <button
            key={e.id}
            onClick={() => onEscena(e.id)}
            className={`flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 transition ${
              activo
                ? 'border-red-500 bg-red-600/25 text-white shadow-[0_0_20px_rgba(220,38,38,.3)]'
                : 'border-white/10 bg-black/25 text-swu-muted hover:border-white/25 hover:bg-white/5'
            }`}
          >
            <span className="text-sm font-black uppercase tracking-wider">{e.texto}</span>
            <span className="text-[10px] leading-tight opacity-70">{e.sub}</span>
          </button>
        )
      })}
    </div>
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
  const ui = LADO_UI[indice]
  const vida = Math.max(0, lado.hpMax - lado.dano)
  const porcentaje = lado.hpMax > 0 ? (vida / lado.hpMax) * 100 : 0
  const critico = porcentaje <= 25
  const derrotado = vida === 0
  const tieneIniciativa = estado.iniciativa === indice

  return (
    <section className={`overflow-hidden rounded-2xl border bg-[#12151c] ${ui.borde}`}>
      {/* Encabezado con color propio del lado */}
      <div className={`flex items-center gap-2 px-4 py-2 ${ui.suave}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${ui.barra}`} />
        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${ui.texto}`}>{ui.etiqueta}</span>
        {tieneIniciativa && (
          <span className="ml-auto rounded bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-black">
            Iniciativa
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3 p-3">
        <CampoTexto
          etiqueta="Nombre del jugador"
          valor={lado.nombre}
          onGuardar={v => onAccion({ t: 'jugador', lado: indice, campos: { nombre: v } })}
        />

        {/* ── Cartas: arriba, porque se configuran al empezar la partida ── */}
        <div className="flex flex-col gap-2">
          <BuscadorCarta
            tipo="lider"
            etiqueta="Líder"
            icono={<Crown size={16} />}
            actual={lado.liderNombre}
            imgActual={lado.liderImg}
            onElegir={c =>
              onAccion({
                t: 'jugador',
                lado: indice,
                campos: { liderNombre: c.nombre, liderImg: c.img, liderAspectos: c.aspectos },
              })
            }
            onQuitar={() =>
              onAccion({
                t: 'jugador',
                lado: indice,
                campos: { liderNombre: '', liderImg: '', liderAspectos: [] },
              })
            }
          />
          <BuscadorCarta
            tipo="base"
            etiqueta="Base"
            icono={<Shield size={16} />}
            actual={lado.baseNombre}
            imgActual={lado.baseImg}
            nota={lado.baseNombre ? `${lado.hpMax} HP` : undefined}
            onElegir={c =>
              onAccion({
                t: 'jugador',
                lado: indice,
                // El HP máximo sale de la CARTA, no de un 30 por defecto: las
                // bases van de 24 a 35 y ese es exactamente el bug del tracker.
                campos: { baseNombre: c.nombre, baseImg: c.img, hpMax: c.hp ?? 30 },
              })
            }
            onQuitar={() =>
              onAccion({ t: 'jugador', lado: indice, campos: { baseNombre: '', baseImg: '' } })
            }
          />
        </div>

        {/* ── Vida: el número que ve el espectador ── */}
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <div className="flex items-end justify-between gap-2">
            <div className="flex items-baseline gap-1.5">
              <Heart size={14} className={critico ? 'text-red-400' : 'text-swu-muted'} />
              <span
                className={`font-mono text-5xl font-black leading-none tabular-nums ${
                  derrotado ? 'text-red-500' : critico ? 'text-amber-300' : 'text-white'
                }`}
              >
                {vida}
              </span>
              <span className="text-xs font-bold text-swu-muted">vida</span>
            </div>
            <span className="pb-1 text-right text-[11px] text-swu-muted">
              <span className="block font-mono text-sm font-bold text-swu-text tabular-nums">
                {lado.dano}
              </span>
              de daño
            </span>
          </div>

          {/* Barra de vida: se lee de un vistazo, sin contar números. */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                derrotado ? 'bg-red-600' : critico ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${porcentaje}%` }}
            />
          </div>

          {/* HP máximo editable: sale solo de la base, pero se puede corregir a
              mano (base rara, erratas, o si no se eligió carta). */}
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/10 pt-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-swu-muted">
              Vida máxima
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  onAccion({ t: 'jugador', lado: indice, campos: { hpMax: Math.max(1, lado.hpMax - 1) } })
                }
                className="h-8 w-8 rounded-md bg-white/5 text-base font-black transition hover:bg-white/10"
                aria-label="Bajar vida máxima"
              >
                −
              </button>
              <span className="w-9 text-center font-mono text-lg font-black tabular-nums">
                {lado.hpMax}
              </span>
              <button
                onClick={() =>
                  onAccion({ t: 'jugador', lado: indice, campos: { hpMax: Math.min(99, lado.hpMax + 1) } })
                }
                className="h-8 w-8 rounded-md bg-white/5 text-base font-black transition hover:bg-white/10"
                aria-label="Subir vida máxima"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* ── Daño: cada botón dice qué hace ── */}
        <div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-1.5">
              <p className="mb-1 text-center text-[9px] font-black uppercase tracking-wider text-emerald-400">
                Quitar daño
              </p>
              <div className="grid grid-cols-2 gap-1">
                {[-5, -1].map(d => (
                  <button
                    key={d}
                    onClick={() => onDano(indice, d)}
                    className="min-h-[50px] rounded-lg bg-emerald-500/20 font-mono text-lg font-black text-emerald-200 transition hover:bg-emerald-500/30 active:scale-95"
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-1.5">
              <p className="mb-1 text-center text-[9px] font-black uppercase tracking-wider text-red-400">
                Más daño
              </p>
              <div className="grid grid-cols-2 gap-1">
                {[1, 5].map(d => (
                  <button
                    key={d}
                    onClick={() => onDano(indice, d)}
                    className="min-h-[50px] rounded-lg bg-red-500/20 font-mono text-lg font-black text-red-200 transition hover:bg-red-500/30 active:scale-95"
                  >
                    +{d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {deshacer !== null && (
            <button
              onClick={onDeshacer}
              className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 py-2 text-[11px] font-bold text-swu-text transition hover:bg-white/10"
            >
              <Undo2 size={13} />
              Deshacer {deshacer > 0 ? `+${deshacer}` : deshacer} de daño
            </button>
          )}
        </div>

        {/* ── Contadores y estado ── */}
        <div className="grid grid-cols-2 gap-2">
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

        <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs font-semibold">
          <span className="flex items-center gap-2">
            <Crown size={13} className="text-swu-muted" />
            Líder desplegado
          </span>
          <input
            type="checkbox"
            checked={lado.liderDesplegado}
            onChange={e =>
              onAccion({ t: 'jugador', lado: indice, campos: { liderDesplegado: e.target.checked } })
            }
            className="h-5 w-5 accent-amber-400"
          />
        </label>
      </div>
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
    <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
      <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-swu-muted">
        {etiqueta}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onDelta(-1)}
          className="min-h-[48px] flex-1 rounded-lg bg-white/5 text-xl font-black transition hover:bg-white/10 active:scale-95"
        >
          −
        </button>
        <span className="w-9 text-center font-mono text-2xl font-black tabular-nums">{valor}</span>
        <button
          onClick={() => onDelta(1)}
          className="min-h-[48px] flex-1 rounded-lg bg-white/5 text-xl font-black transition hover:bg-white/10 active:scale-95"
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
  icono,
  actual,
  imgActual,
  nota,
  onElegir,
  onQuitar,
}: {
  tipo: 'lider' | 'base'
  etiqueta: string
  icono: React.ReactNode
  actual: string
  imgActual?: string
  nota?: string
  onElegir: (c: CartaStream) => void
  onQuitar: () => void
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      {/* Disparador: muestra la miniatura de lo elegido, así el operador
          confirma de un vistazo que puso la carta correcta. */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setAbierto(true)}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-white/10 bg-black/20 px-2.5 py-2.5 text-left text-sm transition hover:border-white/25 hover:bg-white/5"
        >
          {imgActual ? (
            <img
              src={imgCarta(imgActual, 128)}
              alt=""
              className="h-11 w-11 shrink-0 rounded-md object-cover"
            />
          ) : (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-white/5 text-swu-muted">
              {icono}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-swu-muted">
              {etiqueta}
            </span>
            <span className={`block truncate text-sm ${actual ? 'font-semibold' : 'text-swu-muted'}`}>
              {actual || 'Tocá para elegir'}
            </span>
            {nota && <span className="block text-[11px] text-swu-muted">{nota}</span>}
          </span>
          <Search size={16} className="shrink-0 text-swu-muted" />
        </button>

        {actual && (
          <button
            onClick={onQuitar}
            className="shrink-0 rounded-lg p-2.5 text-swu-muted transition hover:bg-white/5 hover:text-red-300"
            aria-label={`Quitar ${etiqueta.toLowerCase()}`}
            title="Quitar"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {abierto && (
        <ModalCartas
          tipo={tipo}
          etiqueta={etiqueta}
          onCerrar={() => setAbierto(false)}
          onElegir={c => {
            onElegir(c)
            setAbierto(false)
          }}
        />
      )}
    </>
  )
}

/**
 * Ventana de selección a pantalla completa.
 *
 * Va FIJA sobre todo (no dentro de la tarjeta): dentro quedaba una lista
 * diminuta imposible de recorrer con el pulgar. Acá la lista tiene toda la
 * altura de la pantalla y las cartas se ven grandes.
 */
function ModalCartas({
  tipo,
  etiqueta,
  onCerrar,
  onElegir,
}: {
  tipo: 'lider' | 'base'
  etiqueta: string
  onCerrar: () => void
  onElegir: (c: CartaStream) => void
}) {
  const [termino, setTermino] = useState('')
  const [cartas, setCartas] = useState<CartaStream[]>([])
  const [error, setError] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    cargarCartasStream()
      .then(c => {
        if (!vivo) return
        setCartas(tipo === 'lider' ? c.lideres : c.bases)
        setCargando(false)
      })
      .catch(() => {
        if (!vivo) return
        setError(true)
        setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [tipo])

  // Escape cierra: es lo que espera cualquiera con teclado.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [onCerrar])

  const resultados = useMemo(() => buscarCartas(cartas, termino, 60), [cartas, termino])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
        {/* Buscador fijo arriba */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-[#12151c] px-3 py-3">
          <Search size={18} className="shrink-0 text-swu-muted" />
          <input
            autoFocus
            value={termino}
            onChange={e => setTermino(e.target.value)}
            placeholder={`Buscar ${etiqueta.toLowerCase()}…`}
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-swu-muted"
          />
          <button
            onClick={onCerrar}
            className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold text-swu-muted transition hover:bg-white/5 hover:text-swu-text"
          >
            Cerrar
          </button>
        </div>

        {/* Lista con toda la altura disponible */}
        <div className="flex-1 overflow-y-auto overscroll-contain bg-[#0d0f14] px-3 py-3">
          {cargando && <p className="py-8 text-center text-sm text-swu-muted">Cargando cartas…</p>}

          {error && (
            <p className="py-8 text-center text-sm text-red-400">
              No se pudo cargar el catálogo de cartas. Podés escribir el nombre a mano en el marcador.
            </p>
          )}

          {!cargando && !error && (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {resultados.map(c => (
                <li key={c.id}>
                  <button
                    onClick={() => onElegir(c)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#12151c] p-2.5 text-left transition hover:border-swu-accent/50 hover:bg-white/5 active:scale-[0.99]"
                  >
                    {c.img ? (
                      <img
                        src={imgCarta(c.img, 128)}
                        alt=""
                        loading="lazy"
                        className="h-16 w-16 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="h-16 w-16 shrink-0 rounded-lg bg-white/5" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{c.nombre}</span>
                      {c.subtitulo && (
                        <span className="block truncate text-xs text-swu-muted">{c.subtitulo}</span>
                      )}
                      {c.hp !== null && (
                        <span className="mt-0.5 inline-block rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                          {c.hp} HP
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
              {resultados.length === 0 && (
                <li className="col-span-full py-8 text-center text-sm text-swu-muted">
                  Sin resultados para «{termino}»
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Piezas sueltas ─────────────────────────────────────────────────── */

function Pantalla({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#0d0f14] px-6 text-swu-muted">{children}</div>
  )
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-swu-muted">{children}</p>
  )
}

function Panel({
  titulo,
  nota,
  children,
}: {
  titulo: string
  nota?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#12151c] p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-swu-muted">{titulo}</h2>
        {nota && <span className="text-[10px] text-swu-muted/70">{nota}</span>}
      </div>
      {children}
    </section>
  )
}

function BotonEstado({
  activo,
  onClick,
  titulo,
  sub,
  tono,
}: {
  activo: boolean
  onClick: () => void
  titulo: string
  sub: string
  tono: 'rojo' | 'ambar'
}) {
  const activos =
    tono === 'rojo'
      ? 'border-red-500 bg-red-600/25 text-red-200'
      : 'border-amber-400 bg-amber-400/20 text-amber-200'

  return (
    <button
      onClick={onClick}
      className={`flex min-h-[62px] flex-col items-center justify-center rounded-xl border-2 px-3 transition ${
        activo ? activos : 'border-white/10 bg-black/25 text-swu-muted hover:bg-white/5'
      }`}
    >
      <span className="text-sm font-black uppercase tracking-wider">{titulo}</span>
      <span className="text-[10px] opacity-70">{sub}</span>
    </button>
  )
}

function CampoTexto({
  etiqueta,
  valor,
  onGuardar,
}: {
  etiqueta: string
  valor: string
  onGuardar: (v: string) => void
}) {
  /* Input NO controlado, reseteado con `key={valor}`. No se guarda por
     pulsación (sube al servidor en `onBlur`), así que mientras se escribe
     `valor` no cambia y el campo no se reinicia. Un cambio ajeno que llegue
     por realtime SÍ cambia `valor` → nueva key → el campo toma el valor nuevo.
     Sin estado ni efecto: nada que pise el texto a media escritura. */
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-swu-muted">{etiqueta}</span>
      <input
        key={valor}
        defaultValue={valor}
        onBlur={e => {
          if (e.target.value !== valor) onGuardar(e.target.value)
        }}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none transition focus:border-swu-accent/50 focus:ring-1 focus:ring-swu-accent/30"
      />
    </label>
  )
}

function CampoLargo({
  etiqueta,
  valor,
  filas = 4,
  ayuda,
  onGuardar,
}: {
  etiqueta: string
  valor: string
  filas?: number
  ayuda?: string
  onGuardar: (v: string) => void
}) {
  /* Mismo patrón que CampoTexto: no controlado con `key`, se guarda al salir
     del campo. Así se pueden escribir varias líneas sin que cada pulsación
     viaje a la nube ni el texto se pise a media escritura. */
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-swu-muted">{etiqueta}</span>
      <textarea
        key={valor}
        defaultValue={valor}
        rows={filas}
        onBlur={e => {
          if (e.target.value !== valor) onGuardar(e.target.value)
        }}
        className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm leading-relaxed outline-none transition focus:border-swu-accent/50 focus:ring-1 focus:ring-swu-accent/30"
      />
      {ayuda && <span className="text-[11px] leading-relaxed text-swu-muted">{ayuda}</span>}
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
        className={`min-h-[52px] rounded-xl border text-xs font-bold uppercase tracking-wider transition ${
          peligro
            ? 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
            : 'border-white/10 bg-black/20 text-swu-text hover:bg-white/5'
        }`}
      >
        {etiqueta}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
      <p className="text-xs leading-relaxed text-amber-200">{pregunta}</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setPreguntando(false)}
          className="min-h-[44px] rounded-lg bg-white/5 text-xs font-bold transition hover:bg-white/10"
        >
          Cancelar
        </button>
        <button
          onClick={() => {
            onConfirmar()
            setPreguntando(false)
          }}
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-amber-500 text-xs font-black text-black transition hover:bg-amber-400"
        >
          <RotateCcw size={14} />
          Confirmar
        </button>
      </div>
    </div>
  )
}

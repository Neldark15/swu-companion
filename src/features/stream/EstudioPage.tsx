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
  Download,
  Heart,
  Lock,
  LockOpen,
  Music,
  Radio,
  RotateCcw,
  Search,
  Image as ImageIcon,
  Shield,
  Sparkles,
  Undo2,
  User as UserIcon,
  X,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  ESTADO_INICIAL,
  formatearReloj,
  mensajesTicker,
  restanteReloj,
  urlIncrustarYoutube,
  type EstadoOverlay,
  type MarcaOverlay,
} from '../../types/stream'
import {
  aplicarAccion,
  leerOverlay,
  reducir,
  suscribirOverlay,
  type Accion,
} from '../../services/streamOverlay'
import { listarSesiones, misSesiones } from '../../services/streamSesiones'
import {
  getInscripciones,
  getLigaDeCreador,
  getPartidas,
  tablaDe,
  type FilaTabla,
  type Liga,
} from '../../services/ligaService'
import { descargarEscenasOBS } from '../../services/obsEscenas'
import { borrarImagenMarca, subirImagenMarca, type TipoMarca } from '../../services/streamMarca'
import {
  buscarCartas,
  cargarCartasStream,
  cargarTodasLasCartas,
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
  /* En mayúsculas desde el borde: el servicio ya normaliza antes de tocar la
     base, pero este `code` también arma la URL que se copia a OBS y el rótulo
     en pantalla. Sin esto, entrar por `/estudio/sv01` funcionaba pero mostraba
     y copiaba un enlace en minúsculas — el mismo sitio con dos caras. */
  const { code: codeCrudo = '' } = useParams<{ code: string }>()
  const code = codeCrudo.trim().toUpperCase()
  const navigate = useNavigate()
  const { currentProfile, supabaseUser, initAuth, authListo } = useAuth()

  /* El acceso ya NO es «ser admin»: es estar asignado a ESTA cabina.
     `null` = todavía preguntando; distinguirlo de `false` evita expulsar a
     alguien en la ventana en que la nube aún no respondió. */
  const [puedeOperar, setPuedeOperar] = useState<boolean | null>(null)
  const [nombreSesion, setNombreSesion] = useState('')

  const [estado, setEstado] = useState<EstadoOverlay>(ESTADO_INICIAL)
  const [cargando, setCargando] = useState(true)
  const [sinGuardar, setSinGuardar] = useState(false)
  const [bloqueado, setBloqueado] = useState(false)
  /* Dos pestañas: CONTROL es lo que se opera en vivo y cabe entero en una
     pantalla 1920×1080 sin desplazarse; AJUSTES es lo que se toca antes del
     torneo (partida, textos, YouTube) y puede scrollear sin molestar. */
  const [pestana, setPestana] = useState<'control' | 'ajustes'>('control')
  const [ahora, setAhora] = useState(() => Date.now())
  const [ultimoDano, setUltimoDano] = useState<{ lado: Indice; delta: number; hasta: number } | null>(null)

  useEffect(() => {
    initAuth()
  }, [initAuth])

  /* ¿Esta persona opera esta cabina? Se pregunta a la nube, que es la misma
     fuente que aplica la RLS: así la pantalla nunca promete lo que la base
     va a rechazar. */
  useEffect(() => {
    if (!currentProfile || !code) return
    let vivo = true

    Promise.all([misSesiones(currentProfile.id), listarSesiones()])
      .then(([propias, todas]) => {
        if (!vivo) return
        setPuedeOperar(propias.includes(code))
        setNombreSesion(todas.find(s => s.code === code)?.nombre ?? '')
      })
      .catch(() => {
        // No se pudo averiguar: NO se expulsa. Se conserva el beneficio de la
        // duda y la RLS sigue siendo la que manda al escribir.
        if (vivo) setPuedeOperar(true)
      })

    return () => {
      vivo = false
    }
  }, [currentProfile, code])

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

  /* ── Atajos de teclado ──
   * Para quien opera desde la Mac: llegar al botón correcto con el ratón en
   * medio de una jugada cuesta más que la propia jugada.
   * Se ignoran mientras se escribe en un campo, o teclear un nombre dispararía
   * media consola. */
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const destino = e.target as HTMLElement | null
      const etiqueta = destino?.tagName
      if (etiqueta === 'INPUT' || etiqueta === 'TEXTAREA' || destino?.isContentEditable) return

      const atajos: Record<string, () => void> = {
        '1': () => aplicar({ t: 'escena', escena: 'pronto' }),
        '2': () => aplicar({ t: 'escena', escena: 'juego' }),
        '3': () => aplicar({ t: 'escena', escena: 'descanso' }),
        '4': () => aplicar({ t: 'escena', escena: 'fin' }),
        q: () => cambiarDano(0, 1),
        a: () => cambiarDano(0, -1),
        p: () => cambiarDano(1, 1),
        l: () => cambiarDano(1, -1),
        ' ': () =>
          aplicar(
            estado.reloj.iniciadoEn !== null
              ? { t: 'relojPausar', ahora: Date.now() }
              : { t: 'relojIniciar', ahora: Date.now() }
          ),
      }

      const accion = atajos[e.key.toLowerCase()]
      if (!accion) return
      e.preventDefault()
      accion()
    }

    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [aplicar, cambiarDano, estado.reloj.iniciadoEn])

  const restante = useMemo(() => restanteReloj(estado.reloj, ahora), [estado.reloj, ahora])
  const cantidadTicker = useMemo(() => mensajesTicker(estado.ticker).length, [estado.ticker])
  const youtubeValido = useMemo(() => urlIncrustarYoutube(estado.youtube) !== null, [estado.youtube])
  const relojCorriendo = estado.reloj.iniciadoEn !== null
  const deshacerVisible = ultimoDano && ultimoDano.hasta > ahora ? ultimoDano : null
  const alAire = estado.escena === 'juego'
  const origen = typeof window !== 'undefined' ? window.location.origin : ''

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
            Iniciá sesión con la cuenta que tiene asignada esta cabina.
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

  if (puedeOperar === null) return <Pantalla>Verificando acceso…</Pantalla>

  if (!puedeOperar) {
    return (
      <Pantalla>
        <div className="flex flex-col items-center gap-4 text-center">
          <Lock size={30} className="text-swu-muted" />
          <p className="text-lg font-semibold text-swu-text">Cabina {code}</p>
          <p className="max-w-xs text-sm text-swu-muted">
            No estás asignado a esta transmisión. Pedile a un administrador que te agregue como
            operador.
          </p>
          <button
            onClick={() => navigate('/estudio')}
            className="rounded-xl bg-swu-accent px-5 py-3 text-sm font-bold text-white"
          >
            Ver mis cabinas
          </button>
        </div>
      </Pantalla>
    )
  }

  if (cargando) return <Pantalla>Cargando marcador…</Pantalla>

  /* `h-[100dvh]` + columna con el scroll ADENTRO, igual que AppLayout.
   *
   * `index.css` le pone `overflow: hidden` a html y body a propósito (para
   * que iOS no rebote), así que el documento NO se desplaza: el que scrollea
   * es el contenedor del caparazón. Esta ruta vive FUERA de AppLayout, así
   * que sin su propio contenedor de scroll todo lo que pase de la altura de
   * la pantalla quedaba cortado y era imposible llegar abajo. */
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#0d0f14] text-swu-text">
      {/* ══ Barra de estado ══ */}
      <header className="shrink-0 border-b border-white/10 bg-[#0d0f14]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1800px] items-center gap-3 px-3 py-2.5 sm:px-5">
          <button
            onClick={() => navigate('/estudio')}
            className="rounded-lg p-2 text-swu-muted transition hover:bg-white/5 hover:text-swu-text"
            aria-label="Volver a las cabinas"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex min-w-0 items-baseline gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-swu-muted">
              {nombreSesion || 'Estudio'}
            </span>
            <span className="truncate font-mono text-base font-bold tracking-wider">{code}</span>
          </div>

          {/* Pestañas */}
          <div className="ml-3 flex rounded-lg border border-white/10 bg-black/30 p-0.5">
            {(
              [
                { id: 'control', texto: 'Control' },
                { id: 'ajustes', texto: 'Ajustes' },
              ] as const
            ).map(t => (
              <button
                key={t.id}
                onClick={() => setPestana(t.id)}
                className={`rounded-md px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider transition ${
                  pestana === t.id ? 'bg-white/10 text-swu-text' : 'text-swu-muted hover:text-swu-text'
                }`}
              >
                {t.texto}
              </button>
            ))}
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

      <main className="mx-auto w-full max-w-[1800px] flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 pb-10 sm:px-4">
        {bloqueado && (
          <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Controles bloqueados. Tocá el candado para volver a operar.
          </p>
        )}

        {pestana === 'control' && (
        <>
        {/* ══ Fila 1 · Monitor · escenas · reloj ══
            El reloj sube acá porque se consulta seguido; así la fila de arriba
            concentra todo lo que el operador mira sin dejar de ver el aire. */}
        <div className="mb-2.5 grid gap-2.5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)_minmax(0,210px)] 2xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)_minmax(0,230px)]">
          <Monitor code={code} alAire={alAire} />

          <Panel titulo="Escena al aire" denso>
            <Escenas escena={estado.escena} onEscena={e => aplicar({ t: 'escena', escena: e })} />

            {/* Estados y quién tiene la iniciativa: todo lo de «qué está
                pasando ahora» vive en el mismo bloque que las escenas. */}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="grid grid-cols-2 gap-1.5">
                <BotonEstado
                  activo={estado.tiempoExtra}
                  onClick={() => aplicar({ t: 'tiempoExtra', valor: !estado.tiempoExtra })}
                  tono="rojo"
                  titulo={estado.tiempoExtra ? 'Quitar tiempo' : 'Tiempo'}
                  sub="Acción adicional"
                />
                <BotonEstado
                  activo={estado.enRevision}
                  onClick={() => aplicar({ t: 'revision', valor: !estado.enRevision })}
                  tono="ambar"
                  titulo={estado.enRevision ? 'Quitar revisión' : 'En revisión'}
                  sub="Congela el marcador"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {([0, 1] as Indice[]).map(i => (
                  <button
                    key={i}
                    onClick={() => aplicar({ t: 'iniciativa', lado: estado.iniciativa === i ? null : i })}
                    className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 truncate rounded-lg border px-2 transition ${
                      estado.iniciativa === i
                        ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                        : 'border-white/10 bg-black/25 text-swu-muted hover:bg-white/5'
                    }`}
                  >
                    <span className="w-full truncate text-[11px] font-black uppercase tracking-wider">
                      {estado.lados[i].nombre || `Jugador ${i + 1}`}
                    </span>
                    <span className="text-[9px] opacity-70">Iniciativa</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Juego de la serie: fijar el número directo. «Nuevo juego» solo
                suma, y un toque de más no se podía corregir en vivo. */}
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-swu-muted">
                Juego
              </span>
              <div className="ml-auto flex items-center gap-1">
                {[1, 2, 3].map(n => (
                  <button
                    key={n}
                    onClick={() => aplicar({ t: 'juego', numero: n })}
                    className={`h-8 w-9 rounded-md text-sm font-black transition ${
                      estado.juego === n
                        ? 'bg-swu-accent/25 text-white'
                        : 'bg-white/5 text-swu-muted hover:bg-white/10'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Ronda: chips, la fila más ancha del bloque. */}
            <div className="mt-2 flex flex-wrap gap-1">
              {RONDAS.map(r => (
                <button
                  key={r}
                  onClick={() => aplicar({ t: 'ronda', etiqueta: r })}
                  className={`rounded-md border px-2 py-1.5 text-[11px] font-bold transition ${
                    estado.etiquetaRonda === r
                      ? 'border-swu-accent bg-swu-accent/20 text-white'
                      : 'border-white/10 bg-black/20 text-swu-muted hover:bg-white/5'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </Panel>

          <Panel titulo="Cronómetro" denso>
            <div className="flex flex-col gap-1.5">
              <div
                className={`rounded-lg border py-2 text-center ${
                  restante !== null && restante <= 5 * 60 * 1000
                    ? 'border-amber-500/40 bg-amber-500/10'
                    : 'border-white/10 bg-black/30'
                }`}
              >
                <span className="block font-mono text-3xl font-black leading-none tabular-nums">
                  {restante !== null ? formatearReloj(restante) : '--:--'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() =>
                    aplicar(relojCorriendo ? { t: 'relojPausar', ahora: Date.now() } : { t: 'relojIniciar', ahora: Date.now() })
                  }
                  className={`min-h-[40px] rounded-lg text-[11px] font-black uppercase tracking-wider transition ${
                    relojCorriendo
                      ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                  }`}
                >
                  {relojCorriendo ? 'Pausar' : 'Iniciar'}
                </button>
                <button
                  onClick={() => aplicar({ t: 'relojExtender', minutos: 5, ahora: Date.now() })}
                  className="min-h-[40px] rounded-lg border border-white/10 bg-white/5 text-[11px] font-black uppercase tracking-wider transition hover:bg-white/10"
                >
                  +5 min
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {[55, 50, 40].map(m => (
                  <button
                    key={m}
                    onClick={() => aplicar({ t: 'relojDuracion', minutos: m })}
                    className="min-h-[32px] rounded-md border border-white/10 bg-black/20 text-[10px] font-bold text-swu-muted transition hover:bg-white/5 hover:text-swu-text"
                  >
                    {m}′
                  </button>
                ))}
              </div>
            </div>
          </Panel>
        </div>

        {/* ══ Fila 2 · Los dos jugadores ══ */}
        <div className="grid gap-2.5 lg:grid-cols-2">
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

        {/* ══ Fila 3 · En vivo: destacar carta, narrador y música ══ */}
        <div className="mt-2.5 grid gap-2.5 lg:grid-cols-3">
          <PanelCartaDestacada carta={estado.carta} ahora={ahora} onAccion={aplicar} />
          <PanelNarrador datos={estado.lowerThird} onAccion={aplicar} />
          <PanelMusica code={code} musica={estado.musica} onAccion={aplicar} />
        </div>

        {/* ══ Fila 4 · Presentar a un jugador de la liga ══ */}
        <div className="mt-2.5">
          <PanelPresentarJugador
            ficha={estado.ficha}
            ahora={ahora}
            userId={supabaseUser?.id ?? null}
            onAccion={aplicar}
          />
        </div>

        </>
        )}

        {/* ══ Ajustes · Puesta en marcha, partida y textos ══ */}
        {pestana === 'ajustes' && (
        <>
        <PuestaEnMarcha
          code={code}
          nombre={nombreSesion || code}
          youtubeOk={youtubeValido}
          alAireApp={estado.envivo}
          tienda={estado.patrocinio}
        />
        <div className="mt-2.5 grid items-start gap-2.5 lg:grid-cols-2">
          <Panel titulo="Partida" denso>
            <div className="flex flex-col gap-1.5">
              <ConConfirmacion
                etiqueta="Nuevo juego"
                pregunta="¿Nuevo juego? El daño vuelve a cero y se conservan líder, base y HP máximo."
                onConfirmar={() => aplicar({ t: 'nuevoJuego' })}
              />
              <button
                onClick={() => aplicar({ t: 'intercambiar' })}
                className="min-h-[40px] rounded-lg border border-white/10 bg-black/20 text-[11px] font-bold uppercase tracking-wider text-swu-muted transition hover:bg-white/5"
              >
                Intercambiar lados
              </button>
              <ConConfirmacion
                etiqueta="Reiniciar marcador"
                pregunta="¿Reiniciar todo? Se conservan solo los nombres de los jugadores."
                peligro
                onConfirmar={() => aplicar({ t: 'reiniciar' })}
              />

              {/* ── Paso 1 · OBS ── */}
              <div className="mt-1 flex flex-col gap-2 rounded-lg border border-white/10 bg-black/20 p-2.5">
                <Rotulo>1 · OBS en la computadora</Rotulo>
                <p className="text-[11px] leading-relaxed text-swu-muted">
                  OBS no se conecta con la app: es un programa aparte. Solo necesita esta URL como
                  <strong className="text-swu-text"> Browser Source</strong>.
                </p>

                <CopiarUrl valor={`${origen}/overlay/${code}`} etiqueta="URL del marcador" />

                <button
                  onClick={() => descargarEscenasOBS(code, nombreSesion || code)}
                  className="flex min-h-[40px] items-center justify-center gap-2 rounded-lg border border-swu-accent/40 bg-swu-accent/10 text-[11px] font-black uppercase tracking-wider text-swu-accent-texto transition hover:bg-swu-accent/20"
                >
                  <Download size={13} />
                  Descargar escenas de OBS
                </button>
                <p className="text-[10px] leading-relaxed text-swu-muted">
                  Trae la URL y la cámara ya encajadas en el marco. En OBS:
                  Colección de escenas → Importar.
                </p>
              </div>

              {/* ── Paso 2 · YouTube ── */}
              <div className="flex flex-col gap-1.5 rounded-lg border border-white/10 bg-black/20 p-2.5">
                <Rotulo>2 · YouTube</Rotulo>
                <p className="text-[11px] leading-relaxed text-swu-muted">
                  La <strong className="text-swu-text">clave de transmisión</strong> se pega en OBS
                  (Ajustes → Emisión), no acá: es un secreto de la cuenta.
                  Acá va solo el enlace para que la comunidad lo vea en la app.
                </p>
                <CampoTexto
                  etiqueta="Enlace del directo o id del canal (UC…)"
                  valor={estado.youtube}
                  onGuardar={v => aplicar({ t: 'youtube', texto: v })}
                />
                <button
                  onClick={() => aplicar({ t: 'envivo', valor: !estado.envivo })}
                  disabled={!youtubeValido && !estado.envivo}
                  className={`flex min-h-[40px] items-center justify-center gap-2 rounded-lg border text-[11px] font-black uppercase tracking-wider transition disabled:opacity-40 ${
                    estado.envivo
                      ? 'border-red-500 bg-red-600/25 text-red-200'
                      : 'border-white/10 bg-black/20 text-swu-muted hover:bg-white/5'
                  }`}
                >
                  <Radio size={13} />
                  {estado.envivo ? 'Anunciado en la app' : 'Anunciar en la app'}
                </button>
                <p className="text-[10px] leading-relaxed text-swu-muted">
                  {estado.youtube && !youtubeValido
                    ? '⚠ No reconozco ese enlace. Pegá el de «Compartir» del directo, o el id del canal (UC…).'
                    : youtubeValido
                      ? '✓ Enlace reconocido. Cada cabina tiene el suyo.'
                      : 'Con el id del canal (UC…) sirve siempre lo que esté al aire y no hay que cambiarlo cada vez.'}
                </p>
              </div>

              {/* ── Paso 3 · verlo ── */}
              <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/20 p-2.5">
                <Rotulo>3 · Dónde se ve</Rotulo>
                <CopiarUrl valor={`${origen}/envivo`} etiqueta="Página pública" />
                <CopiarUrl valor={`${origen}/estudio/${code}`} etiqueta="Este panel" />
              </div>
            </div>
          </Panel>

          <PanelMarca code={code} marca={estado.marca} onAccion={aplicar} />

          <Panel titulo="Textos y barra de comunidad" denso>
            <div className="flex flex-col gap-2">
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

              <button
                onClick={() => aplicar({ t: 'tickerVisible', valor: !estado.tickerVisible })}
                className={`mt-0.5 flex min-h-[40px] items-center justify-center gap-2 rounded-lg border text-[11px] font-black uppercase tracking-wider transition ${
                  estado.tickerVisible
                    ? 'border-emerald-400 bg-emerald-400/20 text-emerald-200'
                    : 'border-white/10 bg-black/20 text-swu-muted hover:bg-white/5'
                }`}
              >
                <Radio size={13} />
                {estado.tickerVisible ? `Barra al aire · ${cantidadTicker}` : 'Barra oculta'}
              </button>

              <CampoLargo
                etiqueta="Comunidad — un mensaje por línea"
                valor={estado.ticker}
                filas={3}
                onGuardar={v => aplicar({ t: 'ticker', texto: v })}
              />
            </div>
          </Panel>
        </div>
        </>
        )}
      </main>
    </div>
  )
}

/* ── En vivo: carta destacada, narrador, música ─────────────────────── */

/** Segundos que la carta destacada se queda en pantalla antes de irse sola. */
const DURACION_CARTA_MS = 14_000

/**
 * La tarjeta grande centrada con el arte y el texto de reglas retipografiado.
 *
 * Es la herramienta de mayor legibilidad que existe en este formato: en la mesa
 * el texto de una carta mide 2,3 px. Se auto-oculta para que nadie la deje
 * puesta encima de la partida.
 */
function PanelCartaDestacada({
  carta,
  ahora,
  onAccion,
}: {
  carta: EstadoOverlay['carta']
  ahora: number
  onAccion: (a: Accion) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const visible = carta !== null && carta.hasta > ahora
  const restante = visible && carta ? Math.ceil((carta.hasta - ahora) / 1000) : 0

  return (
    <Panel titulo="Carta destacada" nota={visible ? `${restante}s al aire` : undefined} denso>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setAbierto(true)}
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-lg border border-swu-accent/40 bg-swu-accent/10 text-xs font-black uppercase tracking-wider text-swu-accent-texto transition hover:bg-swu-accent/20"
        >
          <Sparkles size={14} />
          Destacar una carta
        </button>

        {visible && carta && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2">
            {carta.img && (
              <img src={imgCarta(carta.img, 128)} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
            )}
            <span className="min-w-0 flex-1 truncate text-xs font-bold">{carta.nombre}</span>
            <button
              onClick={() => onAccion({ t: 'carta', carta: null })}
              className="shrink-0 rounded px-2 py-1 text-[10px] font-black uppercase tracking-wider text-swu-muted transition hover:text-red-300"
            >
              Quitar
            </button>
          </div>
        )}

        <p className="text-[10px] leading-relaxed text-swu-muted">
          Sale grande en el centro con el texto de reglas legible y se oculta sola
          a los {DURACION_CARTA_MS / 1000} segundos.
        </p>
      </div>

      {abierto && (
        <ModalCartas
          tipo="jugada"
          etiqueta="carta para destacar"
          onCerrar={() => setAbierto(false)}
          onElegir={c => {
            onAccion({
              t: 'carta',
              carta: {
                nombre: c.nombre,
                subtitulo: c.subtitulo,
                texto: c.texto,
                img: c.img,
                hasta: Date.now() + DURACION_CARTA_MS,
              },
            })
            setAbierto(false)
          }}
        />
      )}
    </Panel>
  )
}

/** Segundos que la ficha de un jugador se queda al aire antes de irse sola. */
const DURACION_FICHA_MS = 18_000

/** Arma la ficha que va al aire. Fuera del componente: usa el reloj. */
function fichaDe(fila: FilaTabla, puesto: number, liga: string): EstadoOverlay['ficha'] {
  return {
    nombre: fila.nombre,
    sub: `${liga.toUpperCase()} · ${puesto}.º`,
    avatar: '',
    datos: [
      { rotulo: 'PUESTO', valor: `${puesto}.º` },
      { rotulo: 'RÉCORD', valor: `${fila.ganadas}-${fila.perdidas}` },
      { rotulo: 'PUNTOS', valor: String(fila.puntos) },
      ...(fila.lider ? [{ rotulo: 'LÍDER', valor: fila.lider }] : []),
    ],
    hasta: Date.now() + DURACION_FICHA_MS,
  }
}

/**
 * Presentar a un jugador de la liga AL AIRE.
 *
 * Es lo que Nel pidió con «que pueda presentar a los jugadores»: antes de una
 * partida, el creador saca la ficha de quien juega —nombre, puesto, récord—
 * y sigue. Se auto-oculta a los {DURACION_FICHA_MS} ms, igual que la carta
 * destacada: una presentación olvidada tapa la mesa.
 *
 * ── Los números NO se teclean ────────────────────────────────────────
 *
 * El puesto y el récord salen de `tablaDe()`, la misma función que pinta la
 * clasificación pública. Un campo de texto libre acá sería una segunda copia
 * de la tabla que se separa a la primera jornada (§3c) — y al aire, delante
 * de la comunidad, con el número equivocado.
 *
 * Si el creador no lleva liga, el panel lo DICE en vez de quedar mudo: un
 * control que no hace nada se lee como que la cabina está rota.
 */
function PanelPresentarJugador({
  ficha,
  ahora,
  userId,
  onAccion,
}: {
  ficha: EstadoOverlay['ficha']
  ahora: number
  userId: string | null
  onAccion: (a: Accion) => void
}) {
  // `undefined` = todavía no se preguntó; `null` = se preguntó y no lleva liga.
  // Con un booleano `cargando` aparte hacían falta dos escrituras de estado
  // para un solo hecho, y sin sesión la primera nunca ocurría: el panel se
  // quedaba diciendo «cargando» para siempre.
  const [liga, setLiga] = useState<Liga | null | undefined>(undefined)
  const [tabla, setTabla] = useState<FilaTabla[]>([])
  const cargando = userId !== null && liga === undefined

  useEffect(() => {
    if (!userId) return
    let vivo = true
    void getLigaDeCreador(userId)
      .then(async l => {
        if (!vivo) return
        setLiga(l)
        if (!l) return
        const [insc, part] = await Promise.all([getInscripciones(l.id), getPartidas(l.id)])
        if (vivo) setTabla(tablaDe(insc, part))
      })
    return () => { vivo = false }
  }, [userId])

  const visible = ficha !== null && ficha.hasta > ahora
  const restante = visible && ficha ? Math.ceil((ficha.hasta - ahora) / 1000) : 0

  return (
    <Panel titulo="Presentar jugador" nota={visible ? `${restante}s al aire` : undefined} denso>
      {visible && ficha && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2">
          <span className="min-w-0 flex-1 truncate text-xs font-bold">{ficha.nombre}</span>
          <button
            onClick={() => onAccion({ t: 'ficha', ficha: null })}
            className="shrink-0 rounded px-2 py-1 text-[10px] font-black uppercase tracking-wider text-swu-muted transition hover:text-red-300"
          >
            Quitar
          </button>
        </div>
      )}

      {cargando ? (
        <p className="py-3 text-center text-xs text-swu-muted">Cargando la liga…</p>
      ) : !liga ? (
        <p className="py-3 text-center text-[11px] leading-relaxed text-swu-muted">
          Esto presenta a los jugadores de tu liga con su puesto y su récord.
          Todavía no llevás ninguna.
        </p>
      ) : tabla.length === 0 ? (
        <p className="py-3 text-center text-[11px] text-swu-muted">
          «{liga.nombre}» no tiene inscritos todavía.
        </p>
      ) : (
        <>
          <div className="flex max-h-44 flex-col gap-1 overflow-y-auto">
            {tabla.map((f, i) => (
              <button
                key={f.inscId}
                onClick={() => onAccion({ t: 'ficha', ficha: fichaDe(f, i + 1, liga.nombre) })}
                className="flex items-center gap-2 rounded-lg border border-swu-border bg-swu-bg px-2.5 py-2 text-left transition hover:border-swu-accent/50"
              >
                <span className="w-6 shrink-0 text-center text-[11px] font-black tabular-nums text-swu-muted">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-bold text-swu-text">{f.nombre}</span>
                <span className="shrink-0 text-[11px] font-bold tabular-nums text-swu-muted">
                  {f.ganadas}-{f.perdidas}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-swu-muted">
            Sale a la izquierda con su puesto y su récord de «{liga.nombre}», y se
            oculta sola a los {DURACION_FICHA_MS / 1000} segundos.
          </p>
        </>
      )}
    </Panel>
  )
}

/** Franja con el nombre de quien narra. */
function PanelNarrador({
  datos,
  onAccion,
}: {
  datos: EstadoOverlay['lowerThird']
  onAccion: (a: Accion) => void
}) {
  return (
    <Panel titulo="Narrador en pantalla" denso>
      <div className="flex flex-col gap-2">
        <CampoTexto
          etiqueta="Nombre"
          valor={datos.texto}
          onGuardar={v => onAccion({ t: 'lowerThird', campos: { texto: v } })}
        />
        <CampoTexto
          etiqueta="Rol o tienda"
          valor={datos.sub}
          onGuardar={v => onAccion({ t: 'lowerThird', campos: { sub: v } })}
        />
        <button
          onClick={() => onAccion({ t: 'lowerThird', campos: { visible: !datos.visible } })}
          disabled={!datos.texto.trim() && !datos.visible}
          className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg border text-[11px] font-black uppercase tracking-wider transition disabled:opacity-40 ${
            datos.visible
              ? 'border-emerald-400 bg-emerald-400/20 text-emerald-200'
              : 'border-white/10 bg-black/20 text-swu-muted hover:bg-white/5'
          }`}
        >
          <UserIcon size={13} />
          {datos.visible ? 'Al aire' : 'Mostrar'}
        </button>
      </div>
    </Panel>
  )
}

/**
 * Música de fondo, controlada desde acá porque el operador está en el celular.
 *
 * El audio sale por el navegador y OBS lo mezcla: hay que marcar «Controlar
 * audio mediante OBS» en la fuente del marcador (el archivo de escenas que
 * genera este panel ya lo trae).
 */
function PanelMusica({
  code,
  musica,
  onAccion,
}: {
  code: string
  musica: EstadoOverlay['musica']
  onAccion: (a: Accion) => void
}) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')

  const subir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendo(true)
    setError('')

    subirImagenMarca(code, 'musica', archivo)
      .then(url => {
        // Se sube PAUSADA: nadie quiere que la música arranque sola al aire.
        onAccion({
          t: 'musica',
          campos: { pista: url, titulo: archivo.name.replace(/\.[^.]+$/, ''), sonando: false },
        })
      })
      .catch(err => setError(err instanceof Error ? err.message : 'No se pudo subir'))
      .finally(() => {
        setSubiendo(false)
        e.target.value = ''
      })
  }

  return (
    <Panel titulo="Música de fondo" nota={musica.sonando ? 'Sonando' : undefined} denso>
      <div className="flex flex-col gap-2">
        {musica.pista ? (
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-2">
            <Music size={14} className="shrink-0 text-swu-muted" />
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">
              {musica.titulo || 'Pista'}
            </span>
          </div>
        ) : (
          <p className="rounded-lg border border-white/10 bg-black/20 p-2 text-[11px] text-swu-muted">
            Sin pista. Subí un MP3 y controlá el volumen desde acá.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onAccion({ t: 'musica', campos: { sonando: !musica.sonando } })}
            disabled={!musica.pista}
            className={`min-h-[44px] rounded-lg border text-[11px] font-black uppercase tracking-wider transition disabled:opacity-40 ${
              musica.sonando
                ? 'border-emerald-400 bg-emerald-400/20 text-emerald-200'
                : 'border-white/10 bg-black/20 text-swu-muted hover:bg-white/5'
            }`}
          >
            {musica.sonando ? 'Pausar' : 'Reproducir'}
          </button>

          <label className="grid min-h-[44px] cursor-pointer place-items-center rounded-lg border border-white/10 bg-black/20 text-[11px] font-black uppercase tracking-wider text-swu-muted transition hover:bg-white/5">
            {subiendo ? 'Subiendo…' : musica.pista ? 'Cambiar' : 'Subir MP3'}
            <input
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/aac"
              onChange={subir}
              disabled={subiendo}
              className="hidden"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-swu-muted">
            Volumen <span className="font-mono">{musica.volumen}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            defaultValue={musica.volumen}
            // Al SOLTAR y no en cada cambio: arrastrar el control dispara
            // decenas de eventos y mandaría una escritura por píxel.
            onMouseUp={e => onAccion({ t: 'musica', campos: { volumen: Number(e.currentTarget.value) } })}
            onTouchEnd={e => onAccion({ t: 'musica', campos: { volumen: Number(e.currentTarget.value) } })}
            className="w-full accent-swu-accent"
          />
        </label>

        {error && <p className="text-[11px] text-red-300">{error}</p>}

        <p className="text-[10px] leading-relaxed text-swu-muted">
          Usá solo música con licencia libre: en YouTube la música con derechos
          genera reclamos sobre el VOD, y eso no se arregla después.
        </p>
      </div>
    </Panel>
  )
}

/* ── Marca de la cabina ─────────────────────────────────────────────── */

/**
 * Identidad visual: logo, colores y textos.
 *
 * Es lo que convierte esto en una herramienta y no en «el overlay de una
 * comunidad»: cada creador sube su logo y elige su color, y el resultado se ve
 * en el monitor al instante porque la marca viaja en el mismo estado en vivo
 * que el marcador.
 */
function PanelMarca({
  code,
  marca,
  onAccion,
}: {
  code: string
  marca: MarcaOverlay
  onAccion: (a: Accion) => void
}) {
  const [subiendo, setSubiendo] = useState<TipoMarca | null>(null)
  const [error, setError] = useState('')

  const subir = (tipo: TipoMarca) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendo(tipo)
    setError('')

    const anterior = tipo === 'logo' ? marca.logoUrl : marca.fondoUrl

    subirImagenMarca(code, tipo, archivo)
      .then(url => {
        onAccion({ t: 'marca', campos: tipo === 'logo' ? { logoUrl: url } : { fondoUrl: url } })
        // La anterior se borra DESPUÉS de guardar la nueva: si se borrara antes
        // y la subida fallara, la cabina quedaría sin imagen.
        if (anterior) void borrarImagenMarca(anterior)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'No se pudo subir'))
      .finally(() => {
        setSubiendo(null)
        e.target.value = ''
      })
  }

  const quitar = (tipo: TipoMarca) => {
    const anterior = tipo === 'logo' ? marca.logoUrl : marca.fondoUrl
    onAccion({ t: 'marca', campos: tipo === 'logo' ? { logoUrl: '' } : { fondoUrl: '' } })
    if (anterior) void borrarImagenMarca(anterior)
  }

  return (
    <Panel titulo="Marca de la cabina" nota="Se ve al instante en el monitor" denso>
      <div className="flex flex-col gap-2.5">
        <CampoTexto
          etiqueta="Nombre (pantallas de espera)"
          valor={marca.nombre}
          onGuardar={v => onAccion({ t: 'marca', campos: { nombre: v } })}
        />
        <CampoTexto
          etiqueta="Lema o región"
          valor={marca.lema}
          onGuardar={v => onAccion({ t: 'marca', campos: { lema: v } })}
        />

        <div className="grid grid-cols-2 gap-2">
          <SubirImagen
            etiqueta="Logo (PNG transparente)"
            url={marca.logoUrl}
            subiendo={subiendo === 'logo'}
            onSubir={subir('logo')}
            onQuitar={() => quitar('logo')}
          />
          <SubirImagen
            etiqueta="Fondo de espera"
            url={marca.fondoUrl}
            subiendo={subiendo === 'fondo'}
            onSubir={subir('fondo')}
            onQuitar={() => quitar('fondo')}
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-300">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <ColorMarca
            etiqueta="Color principal"
            valor={marca.primario}
            onCambiar={v => onAccion({ t: 'marca', campos: { primario: v } })}
          />
          <ColorMarca
            etiqueta="Color de acento"
            valor={marca.acento}
            onCambiar={v => onAccion({ t: 'marca', campos: { acento: v } })}
          />
        </div>

        <button
          onClick={() => onAccion({ t: 'marca', campos: { motivoLocal: !marca.motivoLocal } })}
          className={`flex min-h-[40px] items-center justify-center gap-2 rounded-lg border text-[11px] font-black uppercase tracking-wider transition ${
            marca.motivoLocal
              ? 'border-sky-400 bg-sky-400/20 text-sky-200'
              : 'border-white/10 bg-black/20 text-swu-muted hover:bg-white/5'
          }`}
        >
          {marca.motivoLocal ? 'Motivo El Salvador activo' : 'Motivo El Salvador apagado'}
        </button>
        <p className="text-[10px] leading-relaxed text-swu-muted">
          Enciende el marco de volcanes, el filo tricolor y el emblema. Apagado, la cámara ocupa
          todo el cuadro y manda tu marca.
        </p>

        <CampoLargo
          etiqueta="Aviso legal (franja inferior)"
          valor={marca.avisoLegal}
          filas={2}
          ayuda="Dejalo tal cual si cubrís partidas de un juego con licencia: es lo que deja claro que la cobertura es de fans."
          onGuardar={v => onAccion({ t: 'marca', campos: { avisoLegal: v } })}
        />
      </div>
    </Panel>
  )
}

function SubirImagen({
  etiqueta,
  url,
  subiendo,
  onSubir,
  onQuitar,
}: {
  etiqueta: string
  url: string
  subiendo: boolean
  onSubir: (e: React.ChangeEvent<HTMLInputElement>) => void
  onQuitar: () => void
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-white/10 bg-black/20 p-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-swu-muted">{etiqueta}</span>

      <div className="grid h-16 place-items-center overflow-hidden rounded bg-black/40">
        {url ? (
          <img src={url} alt="" className="max-h-16 max-w-full object-contain" />
        ) : (
          <ImageIcon size={20} className="text-swu-muted" />
        )}
      </div>

      <label className="cursor-pointer rounded bg-white/5 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider transition hover:bg-white/10">
        {subiendo ? 'Subiendo…' : url ? 'Cambiar' : 'Subir'}
        <input
          type="file"
          accept="image/png,image/webp,image/jpeg,image/avif"
          onChange={onSubir}
          disabled={subiendo}
          className="hidden"
        />
      </label>

      {url && (
        <button
          onClick={onQuitar}
          className="rounded py-1 text-[10px] font-bold uppercase tracking-wider text-swu-muted transition hover:text-red-300"
        >
          Quitar
        </button>
      )}
    </div>
  )
}

function ColorMarca({
  etiqueta,
  valor,
  onCambiar,
}: {
  etiqueta: string
  valor: string
  onCambiar: (v: string) => void
}) {
  return (
    <label className="flex flex-col gap-1.5 rounded-lg border border-white/10 bg-black/20 p-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-swu-muted">{etiqueta}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={valor}
          // onBlur y no onChange: el selector dispara en cada movimiento del
          // ratón y mandaría decenas de escrituras a la nube por color elegido.
          onBlur={e => onCambiar(e.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent"
        />
        <span className="font-mono text-[11px] uppercase text-swu-muted">{valor}</span>
      </div>
    </label>
  )
}

/* ── Puesta en marcha ───────────────────────────────────────────────── */

/**
 * La lista de lo que hace falta para salir al aire, con el estado real de lo
 * que la app SÍ puede comprobar.
 *
 * Existe para que una cabina nueva no dependa de que alguien explique los
 * pasos por WhatsApp: se abre esta pestaña y se ve qué falta.
 *
 * Deliberadamente NO guarda la clave de transmisión. El estado del marcador es
 * de lectura pública —OBS lo consume sin sesión— así que una clave ahí la
 * podría leer cualquiera y emitir en el canal ajeno. La clave vive en OBS, en
 * la computadora del operador, que es su sitio.
 */
function PuestaEnMarcha({
  code,
  nombre,
  youtubeOk,
  alAireApp,
  tienda,
}: {
  code: string
  nombre: string
  youtubeOk: boolean
  alAireApp: boolean
  tienda: string
}) {
  const pasos = [
    {
      hecho: null,
      titulo: 'Activar el directo en YouTube',
      detalle:
        'En el canal de esta sede: YouTube Studio → Crear → Transmitir en vivo. La primera vez tarda hasta 24 horas en habilitarse.',
      enlace: 'https://studio.youtube.com/channel/UC/livestreaming',
      enlaceTexto: 'Abrir YouTube Studio',
    },
    {
      hecho: null,
      titulo: 'Pegar la clave de transmisión en OBS',
      detalle:
        'Se copia de YouTube Studio y se pega en OBS → Ajustes → Emisión → Servicio «YouTube - RTMPS». No se guarda acá: es un secreto de la cuenta, y este panel es de lectura pública para que OBS lo consuma.',
    },
    {
      hecho: null,
      titulo: 'Importar las escenas de OBS',
      detalle:
        'Con el botón de abajo se descarga el archivo de ESTA cabina. En OBS: Colección de escenas → Importar. Trae la URL del marcador y la cámara ya encajadas.',
    },
    {
      hecho: youtubeOk,
      titulo: 'Poner el canal de YouTube acá',
      detalle:
        'Para que la comunidad vea el directo dentro de la app. Con el id del canal (UC…) sirve siempre lo que esté al aire.',
    },
    {
      hecho: tienda.trim().length > 0,
      titulo: 'Poner la tienda anfitriona',
      detalle: 'Aparece en la franja de abajo del marcador, junto al aviso legal.',
    },
    {
      hecho: alAireApp,
      titulo: 'Anunciar en la app al salir al aire',
      detalle: 'El último paso del día: enciende la transmisión en la página pública.',
    },
  ]

  const verificables = pasos.filter(p => p.hecho !== null)
  const listos = verificables.filter(p => p.hecho).length

  return (
    <Panel titulo={`Puesta en marcha · ${nombre}`} nota={`${listos}/${verificables.length} verificados`} denso>
      <ol className="flex flex-col gap-1.5">
        {pasos.map((p, i) => (
          <li
            key={i}
            className={`flex gap-2.5 rounded-lg border p-2.5 ${
              p.hecho === true
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : p.hecho === false
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-white/10 bg-black/20'
            }`}
          >
            <span
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black ${
                p.hecho === true
                  ? 'bg-emerald-500 text-black'
                  : p.hecho === false
                    ? 'bg-amber-500 text-black'
                    : 'bg-white/10 text-swu-muted'
              }`}
            >
              {p.hecho === true ? '✓' : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold leading-snug">{p.titulo}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-swu-muted">{p.detalle}</p>
              {p.enlace && (
                <a
                  href={p.enlace}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-[11px] font-bold text-swu-accent-texto underline"
                >
                  {p.enlaceTexto}
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[10px] leading-relaxed text-swu-muted">
        Cabina <span className="font-mono">{code}</span>. Cada sede tiene su propio canal, su propia
        clave y su propio marcador: lo que se configure acá no afecta a las demás.
      </p>
    </Panel>
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
          src={`/overlay/${code}?fondo=oscuro&silencio=1`}
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
            className={`flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-lg border px-1.5 transition ${
              activo
                ? 'border-red-500 bg-red-600/25 text-white shadow-[0_0_16px_rgba(220,38,38,.28)]'
                : 'border-white/10 bg-black/25 text-swu-muted hover:border-white/25 hover:bg-white/5'
            }`}
          >
            <span className="text-xs font-black uppercase tracking-wider">{e.texto}</span>
            <span className="text-[9px] leading-tight opacity-70">{e.sub}</span>
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
                campos: { baseNombre: c.nombre, baseImg: c.img, baseAspectos: c.aspectos, hpMax: c.hp ?? 30 },
              })
            }
            onQuitar={() =>
              onAccion({ t: 'jugador', lado: indice, campos: { baseNombre: '', baseImg: '', baseAspectos: [] } })
            }
          />
        </div>

        {/* ── Vida + daño, en una sola fila: el bloque que más se usa ── */}
        <div className="grid gap-2 sm:grid-cols-[minmax(0,120px)_minmax(0,1fr)]">
          {/* Vida */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-2">
            <div className="flex items-baseline gap-1">
              <Heart size={12} className={critico ? 'text-red-400' : 'text-swu-muted'} />
              <span
                className={`font-mono text-4xl font-black leading-none tabular-nums ${
                  derrotado ? 'text-red-500' : critico ? 'text-amber-300' : 'text-white'
                }`}
              >
                {vida}
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  derrotado ? 'bg-red-600' : critico ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${porcentaje}%` }}
              />
            </div>
            {/* Vida máxima editable: sale de la base, pero se corrige a mano. */}
            <div className="mt-1.5 flex items-center justify-between gap-1 border-t border-white/10 pt-1.5">
              <button
                onClick={() =>
                  onAccion({ t: 'jugador', lado: indice, campos: { hpMax: Math.max(1, lado.hpMax - 1) } })
                }
                className="h-6 w-6 rounded bg-white/5 text-sm font-black transition hover:bg-white/10"
                aria-label="Bajar vida máxima"
              >
                −
              </button>
              <span className="font-mono text-[11px] font-bold tabular-nums text-swu-muted">
                máx {lado.hpMax}
              </span>
              <button
                onClick={() =>
                  onAccion({ t: 'jugador', lado: indice, campos: { hpMax: Math.min(99, lado.hpMax + 1) } })
                }
                className="h-6 w-6 rounded bg-white/5 text-sm font-black transition hover:bg-white/10"
                aria-label="Subir vida máxima"
              >
                +
              </button>
            </div>
          </div>

          {/* Daño: cada botón dice qué hace */}
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-1">
                <p className="mb-0.5 text-center text-[8px] font-black uppercase tracking-wider text-emerald-400">
                  Quitar daño
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {[-5, -1].map(d => (
                    <button
                      key={d}
                      onClick={() => onDano(indice, d)}
                      className="min-h-[44px] rounded-md bg-emerald-500/20 font-mono text-base font-black text-emerald-200 transition hover:bg-emerald-500/30 active:scale-95"
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-red-500/25 bg-red-500/5 p-1">
                <p className="mb-0.5 text-center text-[8px] font-black uppercase tracking-wider text-red-400">
                  Más daño
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {[1, 5].map(d => (
                    <button
                      key={d}
                      onClick={() => onDano(indice, d)}
                      className="min-h-[44px] rounded-md bg-red-500/20 font-mono text-base font-black text-red-200 transition hover:bg-red-500/30 active:scale-95"
                    >
                      +{d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {deshacer !== null ? (
              <button
                onClick={onDeshacer}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-white/15 bg-white/5 py-1.5 text-[10px] font-bold transition hover:bg-white/10"
              >
                <Undo2 size={12} />
                Deshacer {deshacer > 0 ? `+${deshacer}` : deshacer}
              </button>
            ) : (
              <p className="text-center text-[10px] text-swu-muted">{lado.dano} de daño acumulado</p>
            )}
          </div>
        </div>

        {/* ── Última carta jugada: se ve EN GRANDE en el panel lateral ── */}
        <BuscadorCarta
          tipo="jugada"
          etiqueta="Última jugada"
          icono={<Sparkles size={16} />}
          actual={lado.jugadaNombre}
          imgActual={lado.jugadaImg}
          nota={lado.jugadaSub || undefined}
          onElegir={c =>
            onAccion({
              t: 'jugador',
              lado: indice,
              campos: { jugadaNombre: c.nombre, jugadaImg: c.img, jugadaSub: c.subtitulo },
            })
          }
          onQuitar={() =>
            onAccion({
              t: 'jugador',
              lado: indice,
              campos: { jugadaNombre: '', jugadaImg: '', jugadaSub: '' },
            })
          }
        />

        {/* ── Contadores y estado ── */}
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
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
          <button
            onClick={() =>
              onAccion({
                t: 'jugador',
                lado: indice,
                campos: { liderDesplegado: !lado.liderDesplegado },
              })
            }
            className={`flex w-[86px] flex-col items-center justify-center gap-0.5 rounded-lg border px-1 text-[9px] font-bold uppercase leading-tight tracking-wider transition ${
              lado.liderDesplegado
                ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                : 'border-white/10 bg-black/20 text-swu-muted hover:bg-white/5'
            }`}
          >
            <Crown size={14} />
            Desplegado
          </button>
        </div>
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
    <div className="rounded-lg border border-white/10 bg-black/20 p-1.5">
      <p className="mb-1 text-center text-[9px] font-bold uppercase tracking-wider text-swu-muted">
        {etiqueta}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onDelta(-1)}
          className="min-h-[36px] flex-1 rounded-md bg-white/5 text-lg font-black transition hover:bg-white/10 active:scale-95"
        >
          −
        </button>
        <span className="w-7 text-center font-mono text-xl font-black tabular-nums">{valor}</span>
        <button
          onClick={() => onDelta(1)}
          className="min-h-[36px] flex-1 rounded-md bg-white/5 text-lg font-black transition hover:bg-white/10 active:scale-95"
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
  tipo: 'lider' | 'base' | 'jugada'
  etiqueta: string
  icono: React.ReactNode
  actual: string
  imgActual?: string
  nota?: string
  onElegir: (c: CartaStream) => void
  onQuitar: () => void
}) {
  const [abierto, setAbierto] = useState(false)

  /* Las bases son cartas APAISADAS: recortarlas a un cuadrado dejaba una
     franja irreconocible. La miniatura respeta la orientación de cada tipo. */
  const claseMiniatura =
    tipo === 'base' ? 'h-10 w-[68px] shrink-0 rounded-md object-cover' : 'h-11 w-11 shrink-0 rounded-md object-cover'
  const clasePlaceholder =
    tipo === 'base'
      ? 'grid h-10 w-[68px] shrink-0 place-items-center rounded-md bg-white/5 text-swu-muted'
      : 'grid h-11 w-11 shrink-0 place-items-center rounded-md bg-white/5 text-swu-muted'

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
            <img src={imgCarta(imgActual, 224)} alt="" className={claseMiniatura} />
          ) : (
            <span className={clasePlaceholder}>{icono}</span>
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
  tipo: 'lider' | 'base' | 'jugada'
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
    // La carta jugada puede ser CUALQUIERA, así que usa el catálogo completo
    // (2.190 únicas, 313 KB) y no el de líderes y bases.
    const promesa =
      tipo === 'jugada'
        ? cargarTodasLasCartas()
        : cargarCartasStream().then(c => (tipo === 'lider' ? c.lideres : c.bases))

    promesa
      .then(c => {
        if (!vivo) return
        setCartas(c)
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
                        src={imgCarta(c.img, 224)}
                        alt=""
                        loading="lazy"
                        className={
                          tipo === 'base'
                            ? 'h-14 w-[96px] shrink-0 rounded-lg object-cover'
                            : 'h-16 w-16 shrink-0 rounded-lg object-cover'
                        }
                      />
                    ) : (
                      <span
                        className={
                          tipo === 'base'
                            ? 'h-14 w-[96px] shrink-0 rounded-lg bg-white/5'
                            : 'h-16 w-16 shrink-0 rounded-lg bg-white/5'
                        }
                      />
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

/** URL con botón de copiar: en una tienda nadie dicta una URL a mano. */
function CopiarUrl({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false)

  const copiar = () => {
    navigator.clipboard
      .writeText(valor)
      .then(() => {
        setCopiado(true)
        window.setTimeout(() => setCopiado(false), 1800)
      })
      .catch(() => {
        /* Sin permiso de portapapeles el texto sigue a la vista para copiarlo
           a mano; peor sería tragarse el error y no mostrar nada. */
      })
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-swu-muted">{etiqueta}</span>
      <div className="flex items-stretch gap-1.5">
        <code className="min-w-0 flex-1 truncate rounded bg-black/40 px-2 py-2 font-mono text-[10px] text-swu-muted">
          {valor}
        </code>
        <button
          onClick={copiar}
          className={`shrink-0 rounded px-2.5 text-[10px] font-black uppercase tracking-wider transition ${
            copiado ? 'bg-emerald-500/25 text-emerald-300' : 'bg-white/5 text-swu-muted hover:bg-white/10'
          }`}
        >
          {copiado ? '✓' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}

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
  denso,
  children,
}: {
  titulo: string
  nota?: string
  denso?: boolean
  children: React.ReactNode
}) {
  return (
    <section className={`rounded-xl border border-white/10 bg-[#12151c] ${denso ? 'p-2.5' : 'p-4'}`}>
      <div className={`flex items-baseline justify-between gap-2 ${denso ? 'mb-2' : 'mb-3'}`}>
        <h2 className="text-[9px] font-black uppercase tracking-[0.18em] text-swu-muted">{titulo}</h2>
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
      className={`flex min-h-[44px] flex-col items-center justify-center rounded-lg border px-2 transition ${
        activo ? activos : 'border-white/10 bg-black/25 text-swu-muted hover:bg-white/5'
      }`}
    >
      <span className="text-[11px] font-black uppercase tracking-wider">{titulo}</span>
      <span className="text-[9px] opacity-70">{sub}</span>
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

/**
 * ScanPage — apuntar la cámara a una carta y sumarla a la colección.
 *
 * Reconoce la carta por su ILUSTRACIÓN, comparándola contra un índice de
 * hashes que viaja con la app, sin enviar fotogramas al servidor. El
 * código impreso al pie (`ASH·EN 1/264`) queda de respaldo por OCR, para las
 * cartas que comparten arte. El porqué está en services/cardScanner.ts.
 *
 * ── Decisiones de uso ─────────────────────────────────────────────────
 *
 * - **Nada entra solo.** El escáner propone y la persona confirma. Un número
 *   mal leído metería una carta ajena en su colección, y eso es más caro que
 *   un toque de más.
 * - **Siempre hay salida manual.** Con poca luz o funda brillante el OCR
 *   falla; escribir tres dígitos siempre funciona.
 * - **Se escanea en tanda.** Después de agregar vuelve solo a la cámara y va
 *   dejando la lista de lo agregado, que es como se registra un sobre entero.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Camera, CameraOff, Check, Keyboard, Loader2, Plus, Minus, X,
  Zap, ZapOff, ImageUp,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { CardImage } from '../../components/CardImage'
import { listFaceUrl, listFaceIsLandscape } from '../../services/cardArt'
import { EmptyState } from '../../components/ui/EmptyState'
import {
  leerCodigo, leerCodigoDeImagen, buscarPorCodigo, parseCodigo, detenerOCR,
  iniciarOCR, abrirCamara, linterna, reconocerPorArte,
  marcosDeCamara, bandaDelMarco,
  type Coincidencia,
} from '../../services/cardScanner'
import { cargarIndice } from '../../services/cardHash'
import { updateCollectionQuantity, getScanQuantity } from '../../services/collectionService'
import { getMainSets, loadFullDatabase, isDatabaseComplete } from '../../services/swuApi'
import { useAuth } from '../../hooks/useAuth'
import type { Card } from '../../types'
import { CicloEscaner, cambioDeCarta } from './cicloEscaner'

type Estado = 'pidiendo' | 'escaneando' | 'sin-camara' | 'manual'

/** Arte y texto tienen ritmos propios: el worker de texto no frena la cámara. */
const INTERVALO_MS = 300
const MINIMO_ENTRE_OCR_MS = 2500

interface PropsEscaner {
  crearCamara?: typeof abrirCamara
  prepararCatalogo?: () => Promise<void>
  leerCantidad?: typeof getScanQuantity
  guardarCantidad?: typeof updateCollectionQuantity
}

export function ScanPage({
  crearCamara = abrirCamara, prepararCatalogo,
  leerCantidad = getScanQuantity, guardarCantidad = updateCollectionQuantity,
}: PropsEscaner = {}) {
  const navigate = useNavigate()
  const { currentProfile, supabaseUser } = useAuth()

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ciclo] = useState(() => new CicloEscaner())
  const arteEnCurso = useRef(false)
  const textoEnCurso = useRef(false)
  const fotoActiva = useRef(false)
  const presentando = useRef(false)
  const guardandoRef = useRef(false)
  const hallazgoRef = useRef<Coincidencia | null>(null)
  const firmaCanvas = useRef<HTMLCanvasElement | null>(null)
  const ultimoOCR = useRef(-Infinity)

  const [estado, setEstado] = useState<Estado>('pidiendo')
  const [intentoCamara, setIntentoCamara] = useState(0)
  const [intentoLectores, setIntentoLectores] = useState(0)
  const [paginaVisible, setPaginaVisible] = useState(() => !document.hidden)
  const [error, setError] = useState<string | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [leyendoTexto, setLeyendoTexto] = useState(false)
  const [hallazgo, setHallazgo] = useState<Coincidencia | null>(null)
  const [cantidad, setCantidad] = useState(1)
  const [yaTenia, setYaTenia] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [seleccionando, setSeleccionando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)
  const [esperandoRetiro, setEsperandoRetiro] = useState(false)
  const [agregadas, setAgregadas] = useState<{ card: Card; qty: number }[]>([])
  const [ultimoCrudo, setUltimoCrudo] = useState('')
  const [motor, setMotor] = useState<'cargando' | 'listo' | 'error'>('cargando')
  const [indice, setIndice] = useState<'cargando' | 'listo' | 'error'>('cargando')
  const [baseCartas, setBaseCartas] = useState<'cargando' | 'lista' | 'parcial' | 'vacia'>('cargando')
  const [proporcion, setProporcion] = useState(4 / 3)
  const [tieneLinterna, setTieneLinterna] = useState(false)
  const [luz, setLuz] = useState(false)
  const [leyendoFoto, setLeyendoFoto] = useState(false)
  const fotoRef = useRef<HTMLInputElement>(null)
  const [motorError, setMotorError] = useState<string | null>(null)
  const [sets, setSets] = useState<{ code: string; name: string }[]>([])
  const [mSet, setMSet] = useState('')
  const [mNum, setMNum] = useState('')
  const [mError, setMError] = useState<string | null>(null)

  const manual = estado === 'manual'
  const catalogoDisponible = baseCartas === 'lista' || baseCartas === 'parcial'
  const marcos = marcosDeCamara(proporcion, 1)

  useEffect(() => {
    const visibilidad = () => {
      ciclo.invalidar()
      setPaginaVisible(!document.hidden)
    }
    document.addEventListener('visibilitychange', visibilidad)
    return () => {
      document.removeEventListener('visibilitychange', visibilidad)
      ciclo.invalidar()
      void detenerOCR()
    }
  }, [ciclo])

  // Cada apertura posee SU stream y SU cancelación. Una petición antigua que
  // termina después de cambiar de modo se cierra sin tocar la cámara nueva.
  useEffect(() => {
    ciclo.invalidar()
    if (manual || !paginaVisible) return
    let cancelada = false
    let propia: MediaStream | null = null
    const video = videoRef.current
    const dimensiones = () => {
      if (!cancelada && video?.videoWidth && video.videoHeight) setProporcion(video.videoWidth / video.videoHeight)
    }
    const terminada = () => {
      if (cancelada) return
      ciclo.invalidar()
      setError('La cámara se interrumpió. Volvé a abrirla para continuar.')
      setEstado('sin-camara')
    }
    video?.addEventListener('resize', dimensiones)
    void (async () => {
      await Promise.resolve()
      if (cancelada) return
      setEstado('pidiendo'); setError(null); setLuz(false)
      try {
        const camara = await crearCamara()
        propia = camara.stream
        if (cancelada || !video) { propia.getTracks().forEach(t => t.stop()); return }
        streamRef.current = propia
        propia.getVideoTracks().forEach(t => t.addEventListener('ended', terminada))
        video.srcObject = propia
        await video.play()
        if (cancelada) return
        dimensiones()
        setTieneLinterna(camara.tieneLinterna)
        setEstado('escaneando')
      } catch (e) {
        propia?.getTracks().forEach(t => t.stop())
        if (cancelada) return
        setError(e instanceof Error ? e.message : 'No se pudo abrir la cámara.')
        setEstado('sin-camara')
      }
    })()
    return () => {
      cancelada = true
      ciclo.invalidar()
      video?.removeEventListener('resize', dimensiones)
      propia?.getVideoTracks().forEach(t => t.removeEventListener('ended', terminada))
      propia?.getTracks().forEach(t => t.stop())
      if (streamRef.current === propia) streamRef.current = null
      if (video?.srcObject === propia) video.srcObject = null
    }
  }, [manual, paginaVisible, intentoCamara, ciclo, crearCamara])

  useEffect(() => {
    let cancelada = false
    void (async () => {
      await Promise.resolve()
      if (cancelada) return
      setIndice('cargando')
      try {
        const datos = await cargarIndice()
        if (!datos) throw new Error('No se pudo preparar el lector por imagen.')
        if (!cancelada) setIndice('listo')
      } catch {
        if (!cancelada) setIndice('error')
      }
    })()
    return () => { cancelada = true }
  }, [intentoLectores])

  useEffect(() => {
    let cancelada = false
    void (async () => {
      const { db } = await import('../../services/db')
      if (cancelada) return
      setBaseCartas('cargando')
      try {
        // Una tabla con filas no garantiza que la descarga haya terminado.
        if (prepararCatalogo) await prepararCatalogo()
        else if (!await isDatabaseComplete()) await loadFullDatabase()
        const cantidadLocal = await db.cards.count()
        const completa = prepararCatalogo ? cantidadLocal > 0 : await isDatabaseComplete()
        if (!cancelada) setBaseCartas(completa ? 'lista' : cantidadLocal > 0 ? 'parcial' : 'vacia')
      } catch {
        const cantidadLocal = await db.cards.count().catch(() => 0)
        if (!cancelada) setBaseCartas(cantidadLocal > 0 ? 'parcial' : 'vacia')
      }
      const disponibles = await getMainSets().catch(() => [])
      if (!cancelada) {
        setSets(disponibles.map(x => ({ code: x.code, name: x.name })))
        setMSet(prev => prev || disponibles[0]?.code || '')
      }
    })()
    return () => { cancelada = true }
  }, [intentoLectores, prepararCatalogo])

  useEffect(() => {
    if (manual || !paginaVisible) return
    let cancelada = false
    void (async () => {
      await Promise.resolve()
      if (cancelada) return
      setMotor('cargando')
      try {
        await iniciarOCR()
        if (!cancelada) { setMotor('listo'); setMotorError(null) }
      } catch (e) {
        if (!cancelada) {
          setMotor('error')
          setMotorError(e instanceof Error ? e.message : 'No se pudo preparar el lector del código.')
        }
      }
    })()
    return () => { cancelada = true }
  }, [manual, paginaVisible, intentoLectores])

  // Esta miniatura solo detecta un cambio de escena; no se usa para calcular
  // el hash de reconocimiento, cuyo redimensionado debe mantener su paridad.
  const firmaVisual = useCallback((video: HTMLVideoElement): Uint8Array | null => {
    try {
      const canvas = firmaCanvas.current ?? (firmaCanvas.current = document.createElement('canvas'))
      canvas.width = 24; canvas.height = 24
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return null
      ctx.drawImage(video, video.videoWidth * 0.15, video.videoHeight * 0.15,
        video.videoWidth * 0.7, video.videoHeight * 0.7, 0, 0, 24, 24)
      const rgba = ctx.getImageData(0, 0, 24, 24).data
      return Uint8Array.from({ length: 24 * 24 }, (_, i) => Math.round(
        rgba[i * 4] * 0.299 + rgba[i * 4 + 1] * 0.587 + rgba[i * 4 + 2] * 0.114,
      ))
    } catch { return null }
  }, [])

  const presentar = useCallback(async (m: Coincidencia, generacion: number, firma: Uint8Array | null) => {
    if (!ciclo.vigente(generacion) || hallazgoRef.current || presentando.current) return
    presentando.current = true
    ciclo.bloquear(m.card.id, firma)
    const vigente = ciclo.actual()
    try {
      const existentes = await leerCantidad(m.card.id, currentProfile?.id)
      if (!ciclo.vigente(vigente)) return
      setYaTenia(existentes); setCantidad(1); setErrorGuardar(null)
      hallazgoRef.current = m
      setHallazgo(m)
      setEsperandoRetiro(true)
      navigator.vibrate?.(60)
    } catch {
      if (ciclo.vigente(vigente)) setMotorError('No se pudo leer tu colección. Tocá Leer ahora para volver a intentar.')
    } finally { presentando.current = false }
  }, [ciclo, currentProfile?.id, leerCantidad])

  const intentarLeer = useCallback(async (forzado = false) => {
    const video = videoRef.current
    if (!video || arteEnCurso.current || fotoActiva.current || hallazgoRef.current || presentando.current ||
        video.readyState < 2 || video.videoWidth === 0 || video.paused || document.hidden) return
    if (!ciclo.admitirFotograma(video.currentTime, forzado)) return
    const generacion = ciclo.actual()
    const fotograma = video.currentTime
    const firma = firmaVisual(video)
    if (ciclo.observarEscena(firma)) setEsperandoRetiro(false)
    arteEnCurso.current = true
    setLeyendo(true)
    try {
      let porArte = null
      if (indice === 'listo') {
        try { porArte = await reconocerPorArte(video, video.videoWidth, video.videoHeight) }
        catch { if (ciclo.vigente(generacion)) setIndice('error') }
      }
      if (!ciclo.vigente(generacion) || fotoActiva.current) return
      if (ciclo.observar(porArte?.card.id ?? null, 'arte', fotograma, forzado) && porArte) {
        await presentar({ card: porArte.card, alternativas: porArte.gemelas }, generacion, firma)
        return
      }
      // La primera coincidencia por arte espera otro fotograma, sin pagar OCR.
      if (porArte || motor !== 'listo' || textoEnCurso.current ||
          (!forzado && performance.now() - ultimoOCR.current < MINIMO_ENTRE_OCR_MS)) return
      ultimoOCR.current = performance.now()
      // El OCR conserva el fotograma que lo originó, aunque deba esperar a una foto.
      const captura = document.createElement('canvas')
      captura.width = video.videoWidth; captura.height = video.videoHeight
      const contexto = captura.getContext('2d')
      if (!contexto) throw new Error('No se pudo preparar el fotograma. Probá reabrir la cámara.')
      contexto.drawImage(video, 0, 0)
      textoEnCurso.current = true
      setLeyendoTexto(true)
      void ciclo.encolarTexto(generacion, () => leerCodigo(captura, captura.width, captura.height))
        .then(async codigo => {
          if (!codigo || !ciclo.vigente(generacion)) return
          const m = await buscarPorCodigo(codigo)
          if (!ciclo.vigente(generacion)) return
          const actual = videoRef.current
          const firmaActual = actual?.videoWidth ? firmaVisual(actual) : null
          if (!actual || actual.paused || (firma && firmaActual && cambioDeCarta(firma, firmaActual))) {
            ciclo.observar(null, 'texto', fotograma)
            return
          }
          setUltimoCrudo(codigo.crudo)
          if (ciclo.observar(m?.card.id ?? null, 'texto', fotograma, forzado) && m) await presentar(m, generacion, firma)
        })
        .catch(e => {
          if (ciclo.vigente(generacion)) {
            setMotor('error')
            setMotorError(e instanceof Error ? e.message : 'No se pudo leer el código.')
          }
        })
        .finally(() => { textoEnCurso.current = false; setLeyendoTexto(false) })
    } catch (e) {
      if (ciclo.vigente(generacion)) setMotorError(e instanceof Error ? e.message : 'No se pudo leer el fotograma.')
    } finally { arteEnCurso.current = false; setLeyendo(false) }
  }, [ciclo, firmaVisual, indice, motor, presentar])

  useEffect(() => {
    if (estado !== 'escaneando' || hallazgo || leyendoFoto || !catalogoDisponible || !paginaVisible) return
    const video = videoRef.current
    if (!video) return
    let cancelada = false
    let callback = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let ultimo = -Infinity
    const siguiente = (ahora: number) => {
      if (cancelada) return
      if (ahora - ultimo >= INTERVALO_MS) { ultimo = ahora; void intentarLeer() }
      if (typeof video.requestVideoFrameCallback === 'function') callback = video.requestVideoFrameCallback(siguiente)
      else timer = setTimeout(() => siguiente(performance.now()), INTERVALO_MS)
    }
    siguiente(performance.now())
    return () => {
      cancelada = true
      clearTimeout(timer)
      if (callback) video.cancelVideoFrameCallback(callback)
    }
  }, [estado, hallazgo, leyendoFoto, catalogoDisponible, paginaVisible, intentarLeer])

  const cerrarHallazgo = () => {
    if (guardandoRef.current || seleccionando) return
    ciclo.invalidar()
    hallazgoRef.current = null
    setHallazgo(null)
  }

  const confirmar = async (card: Card) => {
    if (guardandoRef.current || seleccionando) return
    guardandoRef.current = true
    setGuardando(true); setErrorGuardar(null)
    const generacion = ciclo.actual()
    const perfilId = currentProfile?.id
    try {
      const existentes = await leerCantidad(card.id, perfilId)
      if (useAuth.getState().currentProfile?.id !== perfilId) throw new Error('La cuenta cambió. Volvé a escanear la carta.')
      const ok = await guardarCantidad(card.id, existentes + cantidad, perfilId,
        supabaseUser?.id === perfilId ? supabaseUser?.id : undefined)
      if (!ok) throw new Error('No se pudo guardar la carta en este dispositivo. Volvé a intentar.')
      if (!ciclo.vigente(generacion)) return
      setAgregadas(prev => [{ card, qty: cantidad }, ...prev].slice(0, 30))
      hallazgoRef.current = null
      setHallazgo(null)
      navigator.vibrate?.(30)
    } catch (e) {
      if (ciclo.vigente(generacion)) setErrorGuardar(e instanceof Error ? e.message : 'No se pudo guardar la carta.')
    } finally { guardandoRef.current = false; setGuardando(false) }
  }

  const leerFoto = async (archivo: File) => {
    if (fotoActiva.current || hallazgoRef.current) return
    fotoActiva.current = true
    const generacion = ciclo.invalidar()
    setLeyendoFoto(true); setMotorError(null)
    try {
      const imagen = await createImageBitmap(archivo).catch(() => null)
      if (imagen) {
        try {
          if (!ciclo.vigente(generacion)) return
          const porArte = await reconocerPorArte(imagen, imagen.width, imagen.height, 'foto').catch(() => null)
          if (!ciclo.vigente(generacion)) return
          if (porArte) {
            await presentar({ card: porArte.card, alternativas: porArte.gemelas }, generacion, null)
            return
          }
        } finally { imagen.close() }
      }
      // El mismo worker atiende foto y vivo en serie; una lectura vieja pierde
      // permiso de publicar, pero termina antes de empezar la nueva.
      const codigo = await ciclo.encolarTexto(generacion, () => leerCodigoDeImagen(archivo))
      if (!codigo || !ciclo.vigente(generacion)) return
      setUltimoCrudo(codigo.crudo)
      const m = await buscarPorCodigo(codigo)
      if (!ciclo.vigente(generacion)) return
      if (m) await presentar(m, generacion, null)
      else setMotorError(codigo.numero != null
        ? `Leí la carta ${codigo.numero}${codigo.setCode ? ' de ' + codigo.setCode : ''} pero no está en la base.`
        : 'No se pudo leer el código de esa foto. Probá más cerca del pie de la carta.')
    } catch (e) {
      if (ciclo.vigente(generacion)) setMotorError(e instanceof Error ? e.message : 'No se pudo leer la foto.')
    } finally { fotoActiva.current = false; setLeyendoFoto(false) }
  }

  const buscarManual = async () => {
    setMError(null)
    const n = parseInt(mNum, 10)
    if (!Number.isFinite(n) || n <= 0) { setMError('Escribí el número de la carta.'); return }
    const generacion = ciclo.actual()
    try {
      const m = await buscarPorCodigo(parseCodigo(`${mSet}·EN ${n}/999`))
      if (!ciclo.vigente(generacion)) return
      if (!m) { setMError(`No hay carta ${n} en ${mSet}.`); return }
      await presentar(m, generacion, null)
    } catch { setMError('No se pudo consultar la base de cartas. Volvé a intentar.') }
  }

  const elegirAlternativa = async (card: Card) => {
    if (guardandoRef.current || seleccionando || !hallazgo) return
    setSeleccionando(true)
    const generacion = ciclo.actual()
    try {
      const existentes = await leerCantidad(card.id, currentProfile?.id)
      if (!ciclo.vigente(generacion)) return
      const otras = [hallazgo.card, ...hallazgo.alternativas].filter(c => c.id !== card.id)
      const siguiente = { card, alternativas: otras }
      setYaTenia(existentes)
      hallazgoRef.current = siguiente
      setHallazgo(siguiente)
    } catch { setErrorGuardar('No se pudo leer la cantidad de esa impresión.') }
    finally { setSeleccionando(false) }
  }

  return (
    <div className="min-h-screen bg-swu-bg">
      <div className="sticky top-0 z-40 bg-swu-bg/95 backdrop-blur border-b border-swu-border">
        <div className="max-w-lg lg:max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-swu-muted" aria-label="Atrás">
            <ArrowLeft size={20} aria-hidden />
          </button>
          <h1 className="text-lg font-bold text-swu-text flex-1">Escanear carta</h1>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => { ciclo.invalidar(); setEstado(e => (e === 'manual' ? 'pidiendo' : 'manual')) }}
            disabled={guardando || leyendoFoto}
          >
            {estado === 'manual'
              ? <><Camera size={13} aria-hidden /> Cámara</>
              : <><Keyboard size={13} aria-hidden /> A mano</>}
          </Button>
        </div>
      </div>

      <div className="max-w-lg lg:max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* ── Visor ── */}
        {estado !== 'manual' && (
          <div
            className="relative rounded-xl overflow-hidden bg-black border border-swu-border w-full"
            style={{ aspectRatio: String(proporcion) }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              onLoadedMetadata={e => {
                const v = e.currentTarget
                if (v.videoWidth && v.videoHeight) setProporcion(v.videoWidth / v.videoHeight)
              }}
              className="w-full h-full object-contain"
              aria-label="Vista de la cámara"
            />

            {/* Guía: la franja del código va abajo, que es donde se lee. */}
            {/* Los marcos se dibujan con las MISMAS constantes que recorta el
                reconocedor. Se muestran los dos porque las unidades son
                verticales y los líderes y bases apaisados, y el escáner prueba
                ambas orientaciones en cada intento. */}
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              {marcos.map((mk, i) => (
                <div
                  key={i}
                  className={`absolute rounded-lg border-2 ${i === 0 ? 'border-swu-cyan' : 'border-swu-cyan/45 border-dashed'}`}
                  style={{
                    left: `${mk.x * 100}%`, top: `${mk.y * 100}%`,
                    width: `${mk.w * 100}%`, height: `${mk.h * 100}%`,
                  }}
                />
              ))}
              {/* La banda del código sigue marcada, tenue: es el respaldo
                  cuando dos cartas comparten ilustración. */}
              {marcos.map((marco, i) => {
                const banda = bandaDelMarco(marco)
                return <div key={`banda-${i}`} className="absolute border border-swu-amber/30 rounded"
                  style={{ left: `${banda.x * 100}%`, top: `${banda.y * 100}%`, width: `${banda.w * 100}%`, height: `${banda.h * 100}%` }} />
              })}
            </div>

            {/* Estado siempre visible: sin esto, «el motor no cargó» y «la
                carta no engancha» se veían exactamente igual.

                El orden importa. Antes el estado del OCR iba ARRIBA, así que
                mientras bajaba —varios MB— se leía «Preparando lector…» y si
                fallaba salía un error rojo, cuando en realidad el escaneo por
                arte ya estaba andando y reconociendo cartas. Ahora el OCR es
                una nota al pie: es el respaldo, no el escáner. */}
            <div className="absolute inset-x-0 bottom-0 p-2 flex flex-col items-center gap-0.5 bg-gradient-to-t from-black/85 to-transparent">
              <div className="flex items-center justify-center gap-2">
                {baseCartas === 'cargando' ? (
                  <><Loader2 size={13} className="animate-spin text-swu-amber" aria-hidden />
                    <span className="text-[11px] text-swu-amber font-mono">Descargando la base de cartas…</span></>
                ) : baseCartas === 'vacia' ? (
                  <span className="text-[11px] text-swu-red-texto font-mono text-center px-2">
                    No se pudo descargar la base de cartas. Sin ella no hay con qué comparar.
                  </span>
                ) : esperandoRetiro ? (
                  <span className="text-[11px] text-white/85 font-mono text-center px-2">Retirá la carta o colocá la siguiente. Para repetirla, tocá Leer ahora.</span>
                ) : leyendo ? (
                  <><Loader2 size={13} className="animate-spin text-swu-cyan" aria-hidden />
                    <span className="text-[11px] text-swu-cyan font-mono">Leyendo…</span></>
                ) : (
                  <span className="text-[11px] text-white/85 font-mono text-center px-2">
                    Encuadrá la <span className="text-swu-cyan">carta entera</span> en el marco
                  </span>
                )}
              </div>
              {catalogoDisponible && motor !== 'listo' && (
                <span className="text-[10px] text-white/40 font-mono text-center px-2">
                  {motor === 'cargando'
                    ? 'Preparando además el lector del código…'
                    : 'El lector de código no está listo. Podés reintentarlo.'}
                </span>
              )}
            </div>

            {tieneLinterna && estado === 'escaneando' && (
              <button
                onClick={() => { const n = !luz; setLuz(n); void linterna(streamRef.current, n) }}
                aria-pressed={luz}
                aria-label={luz ? 'Apagar linterna' : 'Encender linterna'}
                className={`absolute top-2 right-2 w-9 h-9 rounded-full flex items-center justify-center border ${
                  luz ? 'bg-swu-amber text-swu-bg border-swu-amber' : 'bg-black/60 text-white border-white/30'
                }`}
              >
                {luz ? <Zap size={16} aria-hidden /> : <ZapOff size={16} aria-hidden />}
              </button>
            )}

            {estado === 'pidiendo' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                <p className="text-xs text-swu-muted">Pidiendo permiso de cámara…</p>
              </div>
            )}
          </div>
        )}

        {(indice === 'error' || baseCartas === 'parcial' || baseCartas === 'vacia' || motor === 'error') && (
          <div role="status" className="rounded-xl border border-swu-amber/30 bg-swu-amber/5 p-3 space-y-2">
            {indice === 'error' && <p className="text-xs text-swu-amber">No se pudo preparar el reconocimiento por imagen. El código y la búsqueda manual siguen disponibles.</p>}
            {baseCartas === 'parcial' && <p className="text-xs text-swu-amber">La base está incompleta: podemos buscar las cartas descargadas. Actualizala para reconocer las demás.</p>}
            {baseCartas === 'vacia' && <p className="text-xs text-swu-amber">Necesitamos descargar la base de cartas para identificar tu carta.</p>}
            {motor === 'error' && <p className="text-xs text-swu-amber">No se pudo preparar el lector del código.</p>}
            <Button size="sm" onClick={() => setIntentoLectores(n => n + 1)}>Reintentar lectores y base</Button>
          </div>
        )}
        {motorError && <p role="status" className="text-xs text-swu-amber">{motorError}</p>}
        {leyendoTexto && !hallazgo && <p className="text-[11px] text-swu-muted text-center">Comprobando el código; podés seguir encuadrando la carta.</p>}

        {/* Disparo manual. El bucle automático es cómodo pero deja a la persona
            sin nada que hacer cuando no engancha; esto le devuelve el control. */}
        {estado === 'escaneando' && (
          <div className="flex gap-2">
            <Button
              size="sm"
              block
              loading={leyendo}
              disabled={!catalogoDisponible || leyendoFoto}
              onClick={() => void intentarLeer(true)}
            >
              <Camera size={14} aria-hidden /> Leer ahora
            </Button>
          </div>
        )}

        {/* Subir una foto. Va SIEMPRE, incluso sin cámara: la app de cámara del
            teléfono enfoca, hace zoom y tiene flash mucho mejor que nosotros, y
            esto funciona hasta donde el navegador no da acceso al vídeo. */}
        {estado !== 'manual' && (
          <>
            <input
              ref={fotoRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) void leerFoto(f)
                e.target.value = ''
              }}
            />
            <Button
              size="sm"
              block
              variant="secondary"
              loading={leyendoFoto}
              disabled={!catalogoDisponible || guardando}
              onClick={() => fotoRef.current?.click()}
            >
              <ImageUp size={14} aria-hidden /> Tomar o subir una foto
            </Button>
          </>
        )}

        {estado === 'sin-camara' && (
          <EmptyState
            icon={<CameraOff size={28} aria-hidden />}
            title="Sin cámara"
            hint={error ?? undefined}
            action={
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setIntentoCamara(n => n + 1)}>Reabrir cámara</Button>
                <Button size="sm" variant="secondary" onClick={() => setEstado('manual')}>Escribir el número</Button>
              </div>
            }
          />
        )}

        {/* ── Entrada manual ── */}
        {estado === 'manual' && (
          <div className="bg-swu-surface border border-swu-border rounded-xl p-3 space-y-3">
            <p className="text-[11px] text-swu-muted leading-relaxed">
              El código está impreso abajo a la derecha de la carta, así:{' '}
              <span className="font-mono text-swu-text">ASH·EN 1/264</span>. Elegí el set y
              escribí el primer número.
            </p>
            <div className="flex gap-2">
              <select
                value={mSet}
                onChange={e => setMSet(e.target.value)}
                aria-label="Set de la carta"
                className="flex-1 min-w-0 bg-swu-bg border border-swu-border rounded-lg px-2 py-2.5 text-sm text-swu-text"
              >
                {sets.map(s => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}
              </select>
              <input
                value={mNum}
                onChange={e => setMNum(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                placeholder="N.º"
                aria-label="Número de la carta"
                className="w-20 bg-swu-bg border border-swu-border rounded-lg px-2 py-2.5 text-sm text-swu-text text-center font-mono"
              />
            </div>
            {mError && <p className="text-[11px] text-swu-red-texto">{mError}</p>}
            <Button size="sm" block onClick={() => void buscarManual()}>Buscar</Button>
          </div>
        )}

        {/* ── Lo agregado en esta tanda ── */}
        {agregadas.length > 0 && (
          <section>
            <h2 className="text-[10px] font-mono tracking-wider uppercase text-swu-muted/60 mb-2">
              Agregadas · {agregadas.length}
            </h2>
            <div className="space-y-1">
              {agregadas.map((a, i) => (
                <div key={`${a.card.id}-${i}`} className="flex items-center gap-2 bg-swu-surface rounded-lg border border-swu-border px-2.5 py-1.5">
                  <Check size={13} className="text-swu-green flex-shrink-0" aria-hidden />
                  <span className="flex-1 min-w-0 text-xs text-swu-text truncate">{a.card.name}</span>
                  <span className="text-[10px] font-mono text-swu-muted flex-shrink-0">
                    {a.card.setCode} {a.card.setNumber} · +{a.qty}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Diagnóstico: si no engancha, esto dice si el OCR ve algo o nada. */}
        {estado === 'escaneando' && !hallazgo && ultimoCrudo && (
          <p className="text-[10px] text-swu-muted/70 font-mono text-center break-all">
            Última lectura: «{ultimoCrudo.slice(0, 60) || '(vacío)'}»
          </p>
        )}
      </div>

      {/* ── Confirmación ── */}
      {hallazgo && (
        <Sheet open onClose={cerrarHallazgo} title="Confirmar carta identificada" bare>
          <div className="w-full max-w-sm mx-auto bg-swu-surface rounded-xl overflow-hidden">
            <div className="flex items-start gap-3 p-3">
              <div className="w-20 flex-shrink-0 rounded-lg overflow-hidden bg-swu-bg">
                <CardImage
                  src={listFaceUrl(hallazgo.card)}
                  orientacion={listFaceIsLandscape(hallazgo.card) ? 'apaisada' : 'vertical'}
                  fit="cover"
                  elevacion="realce"
                  alt={hallazgo.card.name}
                  className={`w-full ${listFaceIsLandscape(hallazgo.card) ? 'aspect-[400/286]' : 'aspect-[286/400]'}`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-swu-text leading-tight">{hallazgo.card.name}</p>
                {hallazgo.card.subtitle && (
                  <p className="text-[11px] text-swu-muted leading-tight">{hallazgo.card.subtitle}</p>
                )}
                <p className="text-[10px] font-mono text-swu-muted mt-1">
                  {hallazgo.card.setCode} · {hallazgo.card.setNumber} · {hallazgo.card.rarity}
                </p>
                {yaTenia > 0 && (
                  <p className="text-[10px] text-swu-amber mt-1">Ya tenías {yaTenia}</p>
                )}
              </div>
              <button onClick={cerrarHallazgo} disabled={guardando || seleccionando} aria-label="Cancelar" className="text-swu-muted p-1">
                <X size={16} aria-hidden />
              </button>
            </div>

            {hallazgo.alternativas.length > 0 && (
              <div className="px-3 pb-2">
                <p className="text-[10px] text-swu-muted mb-1">
                  Hay varias impresiones posibles. Elegí la tuya.
                </p>
                <div className="flex gap-1 flex-wrap">
                  {[hallazgo.card, ...hallazgo.alternativas].map(c => (
                    <button
                      key={c.id}
                      onClick={() => void elegirAlternativa(c)}
                      disabled={guardando || seleccionando}
                      className={`text-[10px] font-mono px-2 py-1 rounded border ${
                        c.id === hallazgo.card.id
                          ? 'border-swu-cyan text-swu-cyan'
                          : 'border-swu-border text-swu-muted'
                      }`}
                    >
                      {c.setCode} · {c.variantType ?? 'Standard'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {errorGuardar && <p role="alert" className="px-3 pb-2 text-xs text-swu-red-texto">{errorGuardar}</p>}

            <div className="flex items-center gap-3 px-3 pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCantidad(q => Math.max(1, q - 1))}
                  disabled={guardando || seleccionando}
                  aria-label="Menos"
                  className="w-9 h-9 rounded-lg border border-swu-border text-swu-text flex items-center justify-center"
                >
                  <Minus size={14} aria-hidden />
                </button>
                <span className="w-6 text-center font-mono font-bold text-swu-text">{cantidad}</span>
                <button
                  onClick={() => setCantidad(q => Math.min(99, q + 1))}
                  disabled={guardando || seleccionando}
                  aria-label="Más"
                  className="w-9 h-9 rounded-lg border border-swu-border text-swu-text flex items-center justify-center"
                >
                  <Plus size={14} aria-hidden />
                </button>
              </div>
              <Button size="sm" block loading={guardando || seleccionando} onClick={() => void confirmar(hallazgo.card)}>
                <Check size={14} aria-hidden /> Agregar a Mi Botín
              </Button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  )
}

/**
 * ScanPage — apuntar la cámara a una carta y sumarla a la colección.
 *
 * Reconoce la carta por su ILUSTRACIÓN, comparándola contra un índice de
 * hashes que viaja con la app: 0,4 ms medidos, sin CDN y sin conexión. El
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
import { CardImage } from '../../components/CardImage'
import { listFaceUrl, listFaceIsLandscape } from '../../services/cardArt'
import { EmptyState } from '../../components/ui/EmptyState'
import {
  leerCodigo, leerCodigoDeImagen, buscarPorCodigo, parseCodigo, detenerOCR,
  iniciarOCR, abrirCamara, linterna, reconocerPorArte,
  BANDA, MARCO_VERTICAL, MARCO_APAISADO,
  type Coincidencia,
} from '../../services/cardScanner'
import { cargarIndice } from '../../services/cardHash'
import { updateCollectionQuantity, getCardQuantity } from '../../services/collectionService'
import { getMainSets, ensureCards } from '../../services/swuApi'
import { useAuth } from '../../hooks/useAuth'
import type { Card } from '../../types'

type Estado = 'pidiendo' | 'escaneando' | 'sin-camara' | 'manual'

/**
 * Cada cuánto se mira el fotograma.
 *
 * Son DOS ritmos distintos porque son dos costos distintos:
 *
 * - **Arte (450 ms).** Hashear y buscar entre 2.903 cartas cuesta 0,4 ms
 *   medidos. Se puede mirar casi continuo sin trabar la vista previa, y así
 *   la carta se reconoce apenas queda encuadrada.
 * - **Código impreso (2,5 s).** El OCR tarda de 1 a 5 s y bloquea. Solo entra
 *   cuando el arte NO resolvió, que es el caso de las cartas que comparten
 *   ilustración.
 */
const INTERVALO_MS = 450
const MINIMO_ENTRE_OCR_MS = 2500

export function ScanPage() {
  const navigate = useNavigate()
  const { currentProfile, supabaseUser } = useAuth()

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const ocupado = useRef(false)
  const vivo = useRef(true)
  /** Cuándo se corrió el OCR por última vez, para no encadenarlo. */
  const ultimoOCR = useRef(0)

  const [estado, setEstado] = useState<Estado>('pidiendo')
  const [error, setError] = useState<string | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [hallazgo, setHallazgo] = useState<Coincidencia | null>(null)
  const [cantidad, setCantidad] = useState(1)
  const [yaTenia, setYaTenia] = useState(0)
  const [agregadas, setAgregadas] = useState<{ card: Card; qty: number }[]>([])
  const [ultimoCrudo, setUltimoCrudo] = useState<string>('')
  const [motor, setMotor] = useState<'cargando' | 'listo' | 'error'>('cargando')
  /** Cartas locales. Sin esto el escáner leía el código bien y no encontraba
   *  NADA contra qué compararlo, con lo que parecía que el OCR fallaba. */
  const [baseCartas, setBaseCartas] = useState<'cargando' | 'lista' | 'vacia'>('cargando')
  /** Proporción real del vídeo. La caja se adapta a ella para que el recuadro
   *  de la guía caiga exactamente sobre las mismas fracciones del fotograma:
   *  con una proporción fija, `object-contain` deja bandas y la guía vuelve a
   *  señalar un pedazo distinto del que se lee. */
  const [proporcion, setProporcion] = useState(4 / 3)
  const [tieneLinterna, setTieneLinterna] = useState(false)
  const [luz, setLuz] = useState(false)
  const [leyendoFoto, setLeyendoFoto] = useState(false)
  const fotoRef = useRef<HTMLInputElement>(null)
  const [motorError, setMotorError] = useState<string | null>(null)

  // Entrada manual
  const [sets, setSets] = useState<{ code: string; name: string }[]>([])
  const [mSet, setMSet] = useState('')
  const [mNum, setMNum] = useState('')
  const [mError, setMError] = useState<string | null>(null)

  const pausado = hallazgo !== null

  // ── Cámara ──
  useEffect(() => {
    vivo.current = true
    if (estado === 'manual') return

    // `abrirCamara` prueba de la mejor opción a la más básica: pedir todo
    // junto y fallar dejaba al usuario sin cámara en navegadores que solo
    // aceptan restricciones simples.
    abrirCamara()
      .then(({ stream, tieneLinterna: luzOk }) => {
        if (!vivo.current) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        setTieneLinterna(luzOk)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play().catch(() => {})
        }
        setEstado('escaneando')
      })
      .catch((e: unknown) => {
        if (!vivo.current) return
        setError(e instanceof Error ? e.message : 'No se pudo abrir la cámara.')
        setEstado('sin-camara')
      })

    return () => {
      vivo.current = false
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [estado === 'manual']) // eslint-disable-line react-hooks/exhaustive-deps

  // El índice de arte pesa ~250 KB y viaja con la app: se carga apenas se
  // abre la pantalla y a partir de ahí el reconocimiento es instantáneo y
  // funciona sin conexión.
  useEffect(() => { void cargarIndice().catch(() => {}) }, [])

  // El motor de OCR pesa varios MB: se suelta al salir de la pantalla.
  useEffect(() => () => { void detenerOCR() }, [])

  const intentarLeer = useCallback(async (forzado = false) => {
    const v = videoRef.current
    if (!v || ocupado.current || v.videoWidth === 0) return
    // Con la app en segundo plano el vídeo se congela: releer el mismo
    // fotograma una y otra vez solo gasta batería.
    if (document.hidden) return
    ocupado.current = true
    setLeyendo(true)
    try {
      // Primero por ARTE: tarda menos de un milisegundo y no necesita el
      // motor de OCR ni conexión. El código impreso queda de respaldo.
      const porArte = await reconocerPorArte(v, v.videoWidth, v.videoHeight).catch(() => null)
      if (porArte && vivo.current) {
        setHallazgo({ card: porArte.card, alternativas: porArte.gemelas })
        setCantidad(1)
        setYaTenia(await getCardQuantity(porArte.card.id))
        navigator.vibrate?.(60)
        return
      }
      // El arte no dio. Recién ahí se paga el OCR, y espaciado: si se
      // encadenara a 450 ms la vista previa se trabaría, que es justo lo que
      // se arregló antes.
      if (motor !== 'listo' || !forzado) {
        const ahora = performance.now()
        if (ahora - ultimoOCR.current < MINIMO_ENTRE_OCR_MS) return
        if (motor !== 'listo') return
      }
      ultimoOCR.current = performance.now()
      const codigo = await leerCodigo(v, v.videoWidth, v.videoHeight)
      setUltimoCrudo(codigo.crudo)
      setMotor('listo')
      const m = await buscarPorCodigo(codigo)
      if (m && vivo.current) {
        setHallazgo(m)
        setCantidad(1)
        setYaTenia(await getCardQuantity(m.card.id))
        navigator.vibrate?.(60)
      }
    } catch (e) {
      // Un fotograma ilegible se ignora, pero un motor que no carga NO: eso
      // deja el escáner muerto y hay que decirlo, no seguir «leyendo» de
      // adorno para siempre.
      if (vivo.current) {
        setMotor('error')
        setMotorError(e instanceof Error ? e.message : 'no se pudo leer')
      }
    } finally {
      ocupado.current = false
      setLeyendo(false)
    }
  }, [motor])

  // El motor se carga apenas se abre la cámara, para que su descarga —varios
  // MB de CDN— sea visible como «Preparando lector» y no como un escáner que
  // no engancha nada.
  useEffect(() => {
    if (estado !== 'escaneando') return
    let vive = true
    setMotor('cargando')
    iniciarOCR()
      .then(() => { if (vive) { setMotor('listo'); setMotorError(null) } })
      .catch((e: unknown) => {
        if (!vive) return
        setMotor('error')
        setMotorError(e instanceof Error ? e.message : 'no se pudo cargar el lector')
      })
    return () => { vive = false }
  }, [estado])

  // ── Bucle de lectura ──
  useEffect(() => {
    // Ojo: NO se espera a `motor === 'listo'`. El reconocimiento por arte no
    // usa el OCR, y bloquear el bucle hasta que terminara de bajar varios MB
    // dejaba el escáner inerte durante toda esa descarga sin ninguna razón.
    if (estado !== 'escaneando' || pausado || baseCartas !== 'lista') return
    const id = setInterval(() => { void intentarLeer() }, INTERVALO_MS)
    return () => clearInterval(id)
  }, [estado, pausado, baseCartas, intentarLeer])

  // La base de cartas es la mitad del escáner: leer «ASH 1» no sirve de nada
  // si no hay contra qué resolverlo. /scan se abre directo desde Inicio, así
  // que nadie garantiza que esté cargada.
  useEffect(() => {
    let vive = true
    void (async () => {
      const { db } = await import('../../services/db')
      if ((await db.cards.count()) > 0) { if (vive) setBaseCartas('lista'); return }
      await ensureCards()
      if (!vive) return
      setBaseCartas((await db.cards.count()) > 0 ? 'lista' : 'vacia')
    })()
    return () => { vive = false }
  }, [])

  // Sets para el desplegable manual
  useEffect(() => {
    void getMainSets().then(s => {
      setSets(s.map(x => ({ code: x.code, name: x.name })))
      setMSet(prev => prev || s[0]?.code || '')
    }).catch(() => {})
  }, [])

  const confirmar = async (card: Card) => {
    const nueva = yaTenia + cantidad
    await updateCollectionQuantity(card.id, nueva, currentProfile?.id, supabaseUser?.id)
    setAgregadas(prev => [{ card, qty: cantidad }, ...prev].slice(0, 30))
    setHallazgo(null)
    navigator.vibrate?.(30)
  }

  /** Vía de compatibilidad: la foto la saca la app de cámara del teléfono,
   *  que enfoca, hace zoom y tiene flash mucho mejor que nosotros. */
  const leerFoto = async (archivo: File) => {
    setLeyendoFoto(true)
    setMotorError(null)
    try {
      // Igual que en vivo: primero el arte, que es rápido y no falla con la
      // letra chica.
      const img = await createImageBitmap(archivo).catch(() => null)
      if (img) {
        const lienzo = document.createElement('canvas')
        lienzo.width = img.width
        lienzo.height = img.height
        lienzo.getContext('2d')!.drawImage(img, 0, 0)
        const porArte = await reconocerPorArte(lienzo, img.width, img.height).catch(() => null)
        img.close?.()
        if (porArte) {
          setHallazgo({ card: porArte.card, alternativas: porArte.gemelas })
          setCantidad(1)
          setYaTenia(await getCardQuantity(porArte.card.id))
          navigator.vibrate?.(60)
          return
        }
      }
      const codigo = await leerCodigoDeImagen(archivo)
      setUltimoCrudo(codigo.crudo)
      const m = await buscarPorCodigo(codigo)
      if (!m) {
        setMotorError(
          codigo.numero != null
            ? `Leí la carta ${codigo.numero}${codigo.setCode ? ' de ' + codigo.setCode : ''} pero no está en la base.`
            : 'No se pudo leer el código en esa foto. Probá más cerca del pie de la carta.',
        )
        return
      }
      setHallazgo(m)
      setCantidad(1)
      setYaTenia(await getCardQuantity(m.card.id))
      navigator.vibrate?.(60)
    } catch (e) {
      setMotorError(e instanceof Error ? e.message : 'No se pudo leer la foto.')
    } finally {
      setLeyendoFoto(false)
    }
  }

  const buscarManual = async () => {
    setMError(null)
    const n = parseInt(mNum, 10)
    if (!Number.isFinite(n) || n <= 0) { setMError('Escribí el número de la carta.'); return }
    const m = await buscarPorCodigo(parseCodigo(`${mSet}·EN ${n}/999`))
    if (!m) { setMError(`No hay carta ${n} en ${mSet}.`); return }
    setHallazgo(m)
    setCantidad(1)
    setYaTenia(await getCardQuantity(m.card.id))
  }

  const elegirAlternativa = async (c: Card) => {
    setHallazgo({ card: c, alternativas: [] })
    setYaTenia(await getCardQuantity(c.id))
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
            onClick={() => setEstado(e => (e === 'manual' ? 'pidiendo' : 'manual'))}
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
              {[MARCO_VERTICAL, MARCO_APAISADO].map((mk, i) => (
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
              <div
                className="absolute border border-swu-amber/40 rounded"
                style={{
                  left: `${BANDA.x * 100}%`, top: `${BANDA.y * 100}%`,
                  width: `${BANDA.w * 100}%`, height: `${BANDA.h * 100}%`,
                }}
              />
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
                ) : leyendo ? (
                  <><Loader2 size={13} className="animate-spin text-swu-cyan" aria-hidden />
                    <span className="text-[11px] text-swu-cyan font-mono">Leyendo…</span></>
                ) : (
                  <span className="text-[11px] text-white/85 font-mono text-center px-2">
                    Encuadrá la <span className="text-swu-cyan">carta entera</span> en el marco
                  </span>
                )}
              </div>
              {baseCartas === 'lista' && motor !== 'listo' && (
                <span className="text-[10px] text-white/40 font-mono text-center px-2">
                  {motor === 'cargando'
                    ? 'Preparando además el lector del código…'
                    : `Sin lector de código (${motorError ?? 'no cargó'}): se reconoce por la ilustración`}
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

        {/* Disparo manual. El bucle automático es cómodo pero deja a la persona
            sin nada que hacer cuando no engancha; esto le devuelve el control. */}
        {estado === 'escaneando' && (
          <div className="flex gap-2">
            <Button
              size="sm"
              block
              loading={leyendo}
              disabled={baseCartas !== 'lista'}
              onClick={() => void intentarLeer(true)}
            >
              <Camera size={14} aria-hidden /> Leer ahora
            </Button>
            {motor === 'error' && (
              <Button size="sm" variant="secondary" onClick={() => { setMotor('cargando'); setEstado('pidiendo') }}>
                Reintentar
              </Button>
            )}
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
              disabled={baseCartas !== 'lista'}
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
              <Button size="sm" variant="secondary" onClick={() => setEstado('manual')}>
                Escribir el número
              </Button>
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
                onChange={e => setMNum(e.target.value.replace(/\D/g, '').slice(0, 3))}
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm bg-swu-surface border border-swu-border rounded-xl overflow-hidden">
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
              <button onClick={() => setHallazgo(null)} aria-label="Cancelar" className="text-swu-muted p-1">
                <X size={16} aria-hidden />
              </button>
            </div>

            {hallazgo.alternativas.length > 0 && (
              <div className="px-3 pb-2">
                <p className="text-[10px] text-swu-muted mb-1">
                  Ese número existe en varias impresiones. ¿Cuál es la tuya?
                </p>
                <div className="flex gap-1 flex-wrap">
                  {[hallazgo.card, ...hallazgo.alternativas].map(c => (
                    <button
                      key={c.id}
                      onClick={() => void elegirAlternativa(c)}
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

            <div className="flex items-center gap-3 px-3 pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCantidad(q => Math.max(1, q - 1))}
                  aria-label="Menos"
                  className="w-9 h-9 rounded-lg border border-swu-border text-swu-text flex items-center justify-center"
                >
                  <Minus size={14} aria-hidden />
                </button>
                <span className="w-6 text-center font-mono font-bold text-swu-text">{cantidad}</span>
                <button
                  onClick={() => setCantidad(q => Math.min(99, q + 1))}
                  aria-label="Más"
                  className="w-9 h-9 rounded-lg border border-swu-border text-swu-text flex items-center justify-center"
                >
                  <Plus size={14} aria-hidden />
                </button>
              </div>
              <Button size="sm" block onClick={() => void confirmar(hallazgo.card)}>
                <Check size={14} aria-hidden /> Agregar a Mi Botín
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

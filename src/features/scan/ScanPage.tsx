/**
 * ScanPage — apuntar la cámara a una carta y sumarla a la colección.
 *
 * Lee el código impreso al pie de la carta (set + número, ej. `ASH·EN 1/264`),
 * que identifica la carta sin ambigüedad. El detalle de por qué se lee eso y
 * no la ilustración está en services/cardScanner.ts.
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
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { CardImage } from '../../components/CardImage'
import { EmptyState } from '../../components/ui/EmptyState'
import {
  leerCodigo, buscarPorCodigo, parseCodigo, detenerOCR, iniciarOCR, BANDA,
  type Coincidencia,
} from '../../services/cardScanner'
import { updateCollectionQuantity, getCardQuantity } from '../../services/collectionService'
import { getMainSets, ensureCards } from '../../services/swuApi'
import { useAuth } from '../../hooks/useAuth'
import type { Card } from '../../types'

type Estado = 'pidiendo' | 'escaneando' | 'sin-camara' | 'manual'

/**
 * Cada cuánto se intenta leer.
 *
 * Subido de 1.4 s a 2.2 s a propósito: entre lectura y lectura la persona
 * necesita PODER MOVER la carta para encuadrar, y con el ciclo muy pegado la
 * vista previa se sentía trabada. El disparo manual «Leer ahora» cubre el caso
 * de «ya la tengo puesta, leela ahora».
 */
const INTERVALO_MS = 2200

export function ScanPage() {
  const navigate = useNavigate()
  const { currentProfile, supabaseUser } = useAuth()

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const ocupado = useRef(false)
  const vivo = useRef(true)

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

    navigator.mediaDevices?.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
    })
      .then(stream => {
        if (!vivo.current) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play().catch(() => {})
        }
        setEstado('escaneando')
      })
      .catch((e: unknown) => {
        if (!vivo.current) return
        const nombre = e instanceof Error ? e.name : ''
        setError(
          nombre === 'NotAllowedError'
            ? 'No diste permiso de cámara. Podés escribir el número a mano.'
            : nombre === 'NotFoundError'
              ? 'Este dispositivo no tiene cámara disponible.'
              : 'No se pudo abrir la cámara.',
        )
        setEstado('sin-camara')
      })

    return () => {
      vivo.current = false
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [estado === 'manual']) // eslint-disable-line react-hooks/exhaustive-deps

  // El motor de OCR pesa varios MB: se suelta al salir de la pantalla.
  useEffect(() => () => { void detenerOCR() }, [])

  const intentarLeer = useCallback(async () => {
    const v = videoRef.current
    if (!v || ocupado.current || v.videoWidth === 0) return
    // Con la app en segundo plano el vídeo se congela: releer el mismo
    // fotograma una y otra vez solo gasta batería.
    if (document.hidden) return
    ocupado.current = true
    setLeyendo(true)
    try {
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
  }, [])

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
    if (estado !== 'escaneando' || pausado || motor !== 'listo' || baseCartas !== 'lista') return
    const id = setInterval(() => { void intentarLeer() }, INTERVALO_MS)
    return () => clearInterval(id)
  }, [estado, pausado, motor, baseCartas, intentarLeer])

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
            {/* La guía se dibuja con BANDA, la MISMA constante que recorta el
                OCR. Antes cada lado tenía su número y se leía otro pedazo. */}
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              <div className="absolute inset-0 bg-black/45" />
              <div
                className="absolute border-2 border-swu-cyan rounded"
                style={{
                  left: `${BANDA.x * 100}%`, top: `${BANDA.y * 100}%`,
                  width: `${BANDA.w * 100}%`, height: `${BANDA.h * 100}%`,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                  background: 'transparent',
                }}
              />
            </div>

            {/* Estado siempre visible: sin esto, «el motor no cargó» y «la
                carta no engancha» se veían exactamente igual. */}
            <div className="absolute inset-x-0 bottom-0 p-2 flex items-center justify-center gap-2 bg-gradient-to-t from-black/85 to-transparent">
              {baseCartas === 'cargando' ? (
                <><Loader2 size={13} className="animate-spin text-swu-amber" aria-hidden />
                  <span className="text-[11px] text-swu-amber font-mono">Descargando la base de cartas…</span></>
              ) : baseCartas === 'vacia' ? (
                <span className="text-[11px] text-swu-red font-mono text-center px-2">
                  No se pudo descargar la base de cartas. Sin ella no hay con qué comparar.
                </span>
              ) : motor === 'cargando' ? (
                <><Loader2 size={13} className="animate-spin text-swu-amber" aria-hidden />
                  <span className="text-[11px] text-swu-amber font-mono">Preparando lector…</span></>
              ) : motor === 'error' ? (
                <span className="text-[11px] text-swu-red font-mono text-center px-2">
                  {motorError ?? 'El lector no cargó'}
                </span>
              ) : leyendo ? (
                <><Loader2 size={13} className="animate-spin text-swu-cyan" aria-hidden />
                  <span className="text-[11px] text-swu-cyan font-mono">Leyendo…</span></>
              ) : (
                <span className="text-[11px] text-white/85 font-mono text-center px-2">
                  Poné el código <span className="text-swu-cyan">ASH·EN 1/264</span> dentro del recuadro
                </span>
              )}
            </div>

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
              disabled={motor !== 'listo' || baseCartas !== 'lista'}
              onClick={() => void intentarLeer()}
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
            {mError && <p className="text-[11px] text-swu-red">{mError}</p>}
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
                <CardImage src={hallazgo.card.imageUrl} alt={hallazgo.card.name} className="w-full aspect-[5/7]" />
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

/** Bóveda de sobres. Cada apertura conserva su identificador hasta que
 * se conoce el resultado, incluso al recargar la pestaña. */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useSobres } from '../../hooks/useSobres'
import { Link } from 'react-router-dom'
import { ChevronLeft, Package, Library, Volume2, VolumeX, Trophy } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { useAuth, espejarXpEnDexie } from '../../hooks/useAuth'
import { ensureCards } from '../../services/swuApi'
import {
  abrirTandaSobres, ErrorAperturaDefinitivo, misSobres, tamanoBinder, totalColeccionable,
  type CantidadSobres, type SobreAbierto,
} from '../../services/sobres'
import { CajaDeSobres } from './CajaDeSobres'
import { useMenosMovimiento } from './efectos'
import { TiendaSobres } from './TiendaSobres'
import { AperturaSobre } from './AperturaSobre'
import { alternarSilencio, estaEnSilencio } from './sonido'

/** De dónde salen los sobres. Se enseña siempre: un juego sin forma de ganar aburre.
 *
 * ESTA LISTA TIENE QUE DECIR LO QUE DE VERDAD SE PAGA. Decía «Ganar un torneo →
 * 3 sobres / Jugar un torneo → 1 sobre» después de que `_repartir_premios` pasara
 * a dar 5 parejo para todos: la pantalla anunciaba un premio que ya no existía.
 * Es el mismo fallo que el §3m documenta en las misiones, donde la tarjeta
 * enseñaba `rewardXp` a secas y el cobro real era 20 o 60 XP más.
 *
 * Si tocás los montos del servidor, tocá esto en el mismo commit. */
const FUENTES = [
  { que: 'Al entrar a la comunidad', cuanto: '7 sobres, una sola vez' },
  { que: 'Cada mañana a las 8:00', cuanto: '1 sobre · 3 con los avisos puestos' },
  { que: 'Una amistosa confirmada', cuanto: '1 sobre para cada uno' },
  { que: 'Jugar un torneo', cuanto: '5 sobres y 500 XP' },
  { que: 'Comprándolos en la tienda', cuanto: '250 créditos cada uno' },
]

/** Lo que paga abrir UN sobre. Lo acredita `abrir_sobre()` en el servidor. */
const XP_POR_SOBRE = 50

interface SolicitudSobre {
  id: string
  cantidad: CantidadSobres
  indice: number
}

function leerSolicitud(clave: string): SolicitudSobre | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(clave) ?? 'null')
    return s && typeof s.id === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(s.id)
      && [1, 5, 10].includes(s.cantidad) && Number.isInteger(s.indice) ? s : null
  } catch { return null }
}

function recordarSolicitud(clave: string, solicitud: SolicitudSobre | null) {
  try {
    if (solicitud) sessionStorage.setItem(clave, JSON.stringify(solicitud))
    else sessionStorage.removeItem(clave)
  } catch { /* El intento todavía se conserva en la pestaña abierta. */ }
}

export function SobresPage() {
  const miId = useAuth(s => s.supabaseUser?.id)
  if (!miId) return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <EmptyState icon={<Package size={26} />} title="Los sobres son de tu cuenta"
        hint="Iniciá sesión para guardar lo que abrís. Las cartas quedan en tu binder." />
    </div>
  )
  return <BovedaCuenta key={miId} miId={miId} />
}

function BovedaCuenta({ miId }: { miId: string }) {
  const clave = `sobredosis-apertura:${miId}`
  const quieto = useMenosMovimiento()
  const [saldo, setSaldo] = useState<number | null>(null)
  const [piezas, setPiezas] = useState(0)
  const [total, setTotal] = useState(0)
  const [silencio, setSilencio] = useState(estaEnSilencio)

  const [solicitud, setSolicitud] = useState(() => leerSolicitud(clave))
  const [enPantalla, setEnPantalla] = useState(!!solicitud)
  const [enVuelo, setEnVuelo] = useState(false)
  const [resultado, setResultado] = useState<SobreAbierto | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [intento, setIntento] = useState(0)
  const eleccion = useRef(!!solicitud)
  const enRed = useRef<{ id: string; intento: number; respuesta: Promise<SobreAbierto> } | null>(null)
  const versionSaldo = useRef(0)
  /* Se sube para volver a consultar: al cerrar una apertura, o al tocar
   * «revisá otra vez». Es una dependencia real del efecto, que es como el
   * resto de la app hace las recargas — un `useCallback` llamado DESDE el
   * efecto cuenta como escritura síncrona de estado y además se queda sin la
   * guarda `vivo`. */
  const [recarga, setRecarga] = useState(0)
  const recargar = useCallback(() => setRecarga(n => n + 1), [])

  useEffect(() => {
    const version = versionSaldo.current
    let vivo = true
    void (async () => {
      const [s, p, t] = await Promise.all([
        misSobres(miId),
        tamanoBinder(miId),
        totalColeccionable(),
      ])
      if (!vivo) return
      /* Se llama por `getState()` y NO por un selector: la página ya lleva su
         propio `saldo` en estado, así que suscribirse al store solo agregaría
         renders — y de paso el selector devuelve una identidad nueva que le
         rompe la memoización al compilador de React. */
      if (version === versionSaldo.current) {
        setSaldo(s)
        useSobres.getState().fijar(s)
      }
      setPiezas(p)
      setTotal(t)
    })()
    return () => {
      vivo = false
    }
  }, [miId, recarga])

  useEffect(() => {
    // El catálogo tiene que estar en el teléfono ANTES de abrir: el servidor
    // manda uuid pelados y sin catálogo no habría ni nombre ni arte que
    // enseñar. Se pide al entrar, no al abrir, para que la espera no caiga
    // justo en el momento emocionante.
    void ensureCards()
  }, [])

  useEffect(() => {
    if (!enVuelo) return
    const reloj = window.setTimeout(() => setEnVuelo(false), quieto ? 0 : 520)
    return () => clearTimeout(reloj)
  }, [enVuelo, quieto])

  useEffect(() => {
    if (!solicitud || !enPantalla) return
    let vivo = true
    if (enRed.current?.id !== solicitud.id || enRed.current.intento !== intento) {
      enRed.current = { id: solicitud.id, intento,
        respuesta: abrirTandaSobres(solicitud.cantidad, solicitud.id, miId) }
    }
    const esActual = () => vivo && useAuth.getState().supabaseUser?.id === miId
    void enRed.current.respuesta.then(r => {
      if (!esActual()) return
      versionSaldo.current++
      setResultado(r)
      setSaldo(r.saldo)
      useSobres.getState().fijar(r.saldo)
      if (r.xp != null && r.nivel != null) void espejarXpEnDexie(r.xp, r.nivel).catch(() => {})
    }).catch((fallo: unknown) => {
      if (!esActual()) return
      setError(fallo instanceof Error ? fallo : new Error('No se pudo confirmar la apertura.'))
      if (fallo instanceof ErrorAperturaDefinitivo) recordarSolicitud(clave, null)
    })
    return () => { vivo = false }
  }, [solicitud, enPantalla, intento, miId, clave])

  function elegir(indice: number, cantidad: CantidadSobres = 1) {
    if (eleccion.current || saldo == null || saldo < cantidad) return
    eleccion.current = true
    const nueva = { id: crypto.randomUUID(), cantidad, indice }
    recordarSolicitud(clave, nueva)
    setSolicitud(nueva)
    setEnVuelo(cantidad === 1 && !quieto)
    setEnPantalla(true)
  }

  function reintentar() {
    if (!solicitud) return
    setError(null)
    setIntento(n => n + 1)
    setEnPantalla(true)
  }

  function cerrar() {
    if (resultado || error instanceof ErrorAperturaDefinitivo) {
      recordarSolicitud(clave, null)
      setSolicitud(null)
      eleccion.current = false
      enRed.current = null
    }
    setEnPantalla(false)
    setResultado(null)
    setError(null)
    recargar()
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-3 pb-24">
      {/* Cabecera */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/"
          className="-ml-1 flex items-center gap-1 p-1 text-sm text-swu-muted hover:text-swu-text"
        >
          <ChevronLeft size={18} />
          Inicio
        </Link>
        <button
          type="button"
          onClick={() => setSilencio(alternarSilencio())}
          className="rounded-lg p-2 text-swu-muted hover:text-swu-text"
          aria-label={silencio ? 'Activar sonido' : 'Silenciar'}
          aria-pressed={silencio}
        >
          {silencio ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {solicitud && enPantalla && !enVuelo ? (
        <AperturaSobre
          key={solicitud.id}
          indiceSobre={solicitud.indice}
          cantidadSobres={solicitud.cantidad}
          cartas={resultado?.cartas ?? null}
          fallo={error?.message ?? null}
          xpGanado={resultado?.xpGanado ?? 0}
          alReintentar={error && !(error instanceof ErrorAperturaDefinitivo) ? reintentar : undefined}
          alCerrar={cerrar}
          alRepetir={saldo && saldo > 0 ? cerrar : undefined}
        />
      ) : (
        <>
          <h1 className="text-center text-2xl font-black tracking-tight text-swu-text">
            SOBREDOSIS
          </h1>
          <p className="mt-1 mb-6 text-center text-sm text-swu-muted">
            Hiperespacio, foils, Prestige y Showcase. Nada de esto se compra en la tienda.
          </p>

          {/* Saldo y colección */}
          <div className="mb-7 grid grid-cols-2 gap-2.5">
            <div className="clip-hud bg-swu-surface p-3.5 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-swu-muted">
                Sobres
              </p>
              <p className="mt-0.5 text-3xl font-black text-swu-amber">{saldo ?? '—'}</p>
            </div>
            <Link to="/binder-digital" className="clip-hud block bg-swu-surface p-3.5 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-swu-muted">
                Tu binder
              </p>
              <p className="mt-0.5 text-3xl font-black text-swu-cyan">{piezas}</p>
              <p className="text-[10px] text-swu-muted">de {total || '—'}</p>
            </Link>
          </div>

          {solicitud && !enPantalla ? (
            <Button block onClick={reintentar}>
              Recuperar apertura de {solicitud.cantidad === 1 ? '1 sobre' : `${solicitud.cantidad} sobres`}
            </Button>
          ) : saldo === null ? (
            <p className="py-12 text-center text-sm text-swu-muted">Abriendo la bóveda…</p>
          ) : saldo > 0 || enVuelo ? (
            <>
              <CajaDeSobres alElegir={elegir} ocupado={enVuelo} />
              <div className="mt-5 grid grid-cols-2 gap-2">
                {([5, 10] as const).map(n => (
                  <Button key={n} disabled={!!solicitud || saldo < n}
                    onClick={() => elegir(0, n)}>Abrir {n} sobres</Button>
                ))}
              </div>
            </>
          ) : (
            <div className="clip-hud bg-swu-surface/60 px-5 py-9 text-center">
              <Package size={30} className="mx-auto mb-3 text-swu-muted" />
              <p className="font-bold text-swu-text">No te quedan sobres</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-swu-muted">
                Se ganan jugando —cada amistosa que tu rival confirme les da uno a los dos— y
                acá abajo se compran con créditos.
              </p>
              <Button variant="secondary" className="mt-4" onClick={() => void recargar()}>
                Ya jugué, revisá otra vez
              </Button>
            </div>
          )}

          {/* La tienda va DEBAJO de la caja: primero lo que ya tenés para
              abrir, después en qué gastar. Al revés, la pantalla te vende algo
              teniendo sobres sin abrir en la mano — y en esta comunidad hay 882
              esperando. */}
          <TiendaSobres alCambiarSobres={n => {
            versionSaldo.current++
            setSaldo(n)
            useSobres.getState().fijar(n)
          }} />

          {/* Cómo se ganan */}
          <div className="mt-8">
            <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-swu-muted">
              <Trophy size={13} />
              Cómo se ganan
            </h2>
            <div className="clip-hud divide-y divide-swu-border bg-swu-surface">
              {FUENTES.map(f => (
                <div key={f.que} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-swu-text">{f.que}</span>
                  <span className="text-xs font-bold text-swu-amber">{f.cuanto}</span>
                </div>
              ))}
            </div>
            {/* Va DEBAJO de la lista y no como una fila más: las de arriba
                dicen cómo se GANAN sobres, y esto es lo que paga ABRIRLOS —
                otra cosa. Y se dice, porque un premio que nadie sabe que
                existe no motiva a nadie. */}
            <p className="mt-2 px-1 text-[11px] leading-snug text-swu-muted">
              Y cada sobre que abrís te da{' '}
              <span className="font-bold text-swu-amber">{XP_POR_SOBRE} XP</span>.
            </p>
          </div>

          <Link
            to="/binder-digital"
            className="mt-4 flex items-center justify-center gap-2 py-3 text-sm text-swu-cyan"
          >
            <Library size={16} />
            Ver todo lo que llevás
          </Link>
        </>
      )}
    </div>
  )
}

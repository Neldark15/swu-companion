import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { liveQuery } from 'dexie'
import { AlertTriangle, CheckCircle2, ChevronRight, Layers, Loader2, RefreshCw, ShoppingBag } from 'lucide-react'
import { db } from '../../services/db'
import { isDatabaseComplete, loadFullDatabase, subscribeDbLoadProgress } from '../../services/swuApi'
import { useAuth } from '../../hooks/useAuth'
import { Sheet } from '../../components/ui/Sheet'
import { CardImage } from '../../components/CardImage'
import { listFaceFit, listFaceUrl } from '../../services/cardArt'
import type { Card, Deck } from '../../types'
import { calcularFaltantesMazo, type CopiasFisicas, type FaltantesDelMazo } from './faltantesMazo'

type EstadoComparacion = FaltantesDelMazo | { estado: 'cargando' | 'error' }
type Lectura =
  | { perfilId: string | null; estado: 'cargando' | 'error' }
  | { perfilId: string; estado: 'listo'; catalogo: Card[]; coleccion: CopiasFisicas[]; completo: boolean }

/** Suscripción local: también reacciona a otra pestaña, al escáner y al pull
 * de la nube. Nunca consulta el álbum ni mezcla los perfiles del dispositivo.
 * Los errores se conservan: getMyCollection convierte un fallo en [], y ese
 * valor aquí parecería una colección vacía. */
export function FaltantesMazo({ mazo }: { mazo: Deck }) {
  const perfilId = useAuth(s => s.currentProfileId)
  const [revision, setRevision] = useState(0)
  const [reintentando, setReintentando] = useState(false)
  const [lectura, setLectura] = useState<Lectura>({ perfilId: null, estado: 'cargando' })

  useEffect(() => subscribeDbLoadProgress(p => {
    // El sello de descarga se escribe después del bulkPut. Observar solo
    // cards podría ver las filas nuevas antes de que el catálogo esté listo.
    if (p.phase === 'done') setRevision(r => r + 1)
  }), [])

  useEffect(() => {
    if (!perfilId) return
    const suscripcion = liveQuery(() => db.transaction('r', db.cards, db.collection, async () => {
      const [catalogo, coleccion, completo] = await Promise.all([
        db.cards.toArray(),
        db.collection.where('profileId').equals(perfilId).toArray(),
        isDatabaseComplete(),
      ])
      return { perfilId, estado: 'listo' as const, catalogo, coleccion, completo }
    })).subscribe({
      next: setLectura,
      error: () => setLectura({ perfilId, estado: 'error' }),
    })
    return () => suscripcion.unsubscribe()
  }, [perfilId, revision])

  const resultado = useMemo<EstadoComparacion>(() => {
    if (!perfilId) return { estado: 'sin-perfil' }
    if (lectura.perfilId !== perfilId) return { estado: 'cargando' }
    if (lectura.estado !== 'listo') return { estado: lectura.estado }
    return calcularFaltantesMazo({ leaders: mazo.leaders, base: mazo.base, mainDeck: mazo.mainDeck, sideboard: mazo.sideboard },
      lectura.catalogo, lectura.coleccion, perfilId, lectura.completo)
  }, [mazo.leaders, mazo.base, mazo.mainDeck, mazo.sideboard, lectura, perfilId])

  const reintentar = async () => {
    if (reintentando) return
    setReintentando(true)
    try {
      if (resultado.estado !== 'error') await loadFullDatabase({ force: true })
    } catch {
      setLectura({ perfilId, estado: 'error' })
    } finally {
      setRevision(r => r + 1)
      setReintentando(false)
    }
  }

  return <ResumenFaltantesMazo resultado={resultado} reintentando={reintentando} alReintentar={() => void reintentar()} />
}

/** Vista compartida con el banco de pruebas; no lee ni escribe datos. */
export function ResumenFaltantesMazo({ resultado, reintentando = false, alReintentar }: {
  resultado: EstadoComparacion
  reintentando?: boolean
  alReintentar: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const listo = resultado.estado === 'listo' ? resultado : null
  const vacio = listo?.totalNecesarias === 0
  const completo = listo && !vacio && listo.totalFaltantes === 0
  const cargando = resultado.estado === 'cargando' || reintentando
  const resumen = cargando ? 'Comparando tu colección…'
    : vacio ? 'Agregá cartas para comparar tu colección'
      : completo ? 'Tenés todas las copias de esta lista'
        : listo ? `Te ${listo.totalFaltantes === 1 ? 'falta 1 copia' : `faltan ${listo.totalFaltantes} copias`}`
          : 'Comparación de colección pendiente'
  const mensaje = resultado.estado === 'catalogo-incompleto'
    ? 'El catálogo todavía no está completo. Actualizalo para identificar todas las impresiones antes de contar tus copias.'
    : resultado.estado === 'sin-resolver'
      ? `Falta identificar ${resultado.cartasMazo.length} referencias del mazo y ${resultado.cartasColeccion.length} de tu colección. Actualizá el catálogo para completar la comparación.`
      : resultado.estado === 'cantidades-invalidas'
        ? 'Hay cantidades que necesitan revisión en el mazo o en tu colección. Revisalas antes de comparar.'
        : resultado.estado === 'sin-perfil'
          ? 'Abrí tu perfil para comparar con tu colección física guardada en este dispositivo.'
          : 'No se pudo leer tu colección local. Podés reintentar sin modificar tus cartas.'

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)}
        className="w-full min-h-11 flex items-center gap-2 rounded-lg border border-swu-border bg-swu-surface px-3 py-2 text-left"
        aria-label={`${resumen}. Ver comparación de colección`}>
        {cargando ? <Loader2 size={16} className="shrink-0 animate-spin text-swu-muted" aria-hidden />
          : completo ? <CheckCircle2 size={16} className="shrink-0 text-swu-green" aria-hidden />
            : <Layers size={16} className="shrink-0 text-swu-accent-texto" aria-hidden />}
        <span className="min-w-0 flex-1 text-xs font-bold text-swu-text" aria-live="polite">{resumen}</span>
        <ChevronRight size={16} className="shrink-0 text-swu-muted" aria-hidden />
      </button>
      <Sheet open={abierto} onClose={() => setAbierto(false)} title="Cartas que te faltan">
        <div className="space-y-4 p-4">
          <p className="text-xs leading-relaxed text-swu-muted">
            Compara esta lista con tu colección física local: líderes, base, mazo y sideboard.
            Suma impresiones compatibles y cuenta cada copia una sola vez. No reserva cartas entre mazos.
          </p>
          {cargando ? (
            <p role="status" className="flex items-center gap-2 py-4 text-sm text-swu-muted">
              <Loader2 size={18} className="animate-spin" aria-hidden /> Comparando tu colección…
            </p>
          ) : !listo ? (
            <div className="space-y-3 rounded-lg border border-swu-amber/30 bg-swu-amber/10 p-3">
              <p role="status" className="flex items-start gap-2 text-sm text-swu-text">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-swu-amber" aria-hidden />{mensaje}
              </p>
              {resultado.estado === 'sin-perfil' ? (
                <Link to="/profile" className="min-h-11 inline-flex items-center text-xs font-bold text-swu-accent-texto">Abrir mi perfil <ChevronRight size={14} aria-hidden /></Link>
              ) : resultado.estado !== 'cantidades-invalidas' && (
                <button type="button" onClick={alReintentar} className="min-h-11 inline-flex items-center gap-2 rounded-lg border border-swu-border bg-swu-surface px-3 text-xs font-bold text-swu-text">
                  <RefreshCw size={14} aria-hidden />{resultado.estado === 'error' ? 'Reintentar lectura' : 'Actualizar catálogo'}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-swu-border bg-swu-bg p-3" role="status">
                <p className={`text-sm font-bold ${completo ? 'text-swu-green' : 'text-swu-text'}`}>{resumen}</p>
                {!vacio && <p className="mt-1 text-xs text-swu-muted">Tenés {listo.totalDisponibles} de {listo.totalNecesarias} copias necesarias.</p>}
              </div>
              <ul className="divide-y divide-swu-border">
                {listo.cartas.map(({ carta, necesarias, disponibles, faltantes }) => (
                  <li key={carta.id} className="flex gap-3 py-3">
                    <div className="aspect-[286/400] w-12 shrink-0 overflow-hidden rounded-md">
                      <CardImage src={listFaceUrl(carta)} alt={carta.name} className="h-full w-full" fit={listFaceFit(carta)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-swu-text">{carta.name}</p>
                      {carta.subtitle && <p className="text-xs text-swu-muted">{carta.subtitle}</p>}
                      <p className="mt-1 text-xs text-swu-muted">Tenés {disponibles} / necesitás {necesarias} · <span className="font-bold text-swu-amber">Faltan {faltantes}</span></p>
                      <Link to={`/explore?tab=market&carta=${encodeURIComponent(carta.id)}`}
                        className="min-h-11 inline-flex items-center gap-1.5 text-xs font-bold text-swu-accent-texto"
                        aria-label={`Buscar ${carta.name}${carta.subtitle ? `, ${carta.subtitle}` : ''} en el mercado`}>
                        <ShoppingBag size={14} aria-hidden /> Buscar en el mercado
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
              {completo && <p className="text-xs leading-relaxed text-swu-muted">La comparación indica disponibilidad de copias; la validez del mazo se revisa por separado en el editor.</p>}
            </>
          )}
        </div>
      </Sheet>
    </>
  )
}

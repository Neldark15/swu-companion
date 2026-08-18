/**
 * Lo que se ve dentro de una burbuja cuando el mensaje trae algo pegado.
 *
 * Se resuelve al PINTAR y no al guardar, a propósito. Un mensaje guarda la
 * referencia («la carta tal», «el mazo tal») y no una copia: así una carta se
 * dibuja con el arte que tenga hoy el catálogo, y un mazo que su dueño cambió
 * después se abre con los cambios. Guardar una copia habría congelado ambas en
 * el momento del envío y la conversación mentiría al releerla.
 *
 * El precio es que la referencia puede quedar colgada, y eso se dice: un mazo
 * borrado —o uno privado, que para quien mira es lo mismo— muestra que ya no
 * está en vez de un hueco.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, Loader2, EyeOff } from 'lucide-react'
import { CardImage } from '../../components/CardImage'
import { listFaceUrl, listFaceIsLandscape } from '../../services/cardArt'
import { getCardsByIds } from '../../services/swuApi'
import { verMazoCompartido, type MazoCompartible } from '../../services/galaxiaCompartir'
import type { AdjuntoMensaje } from '../../services/galaxiaChat'
import type { Card } from '../../types'

export function AdjuntoBurbuja({ adjunto }: { adjunto: AdjuntoMensaje }) {
  const navigate = useNavigate()
  const [carta, setCarta] = useState<Card | null>(null)
  const [mazo, setMazo] = useState<MazoCompartible | null>(null)
  /** El líder y la base del mazo, resueltos contra el catálogo local. */
  const [lider, setLider] = useState<Card | null>(null)
  const [base, setBase] = useState<Card | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    void (async () => {
      if (adjunto.tipo === 'carta') {
        const m = await getCardsByIds([adjunto.id])
        if (vivo) setCarta(m.get(adjunto.id) ?? null)
      } else {
        const d = await verMazoCompartido(adjunto.id)
        if (!vivo) return
        setMazo(d)
        // Una sola consulta a Dexie para los dos: son ids de carta como
        // cualquier otro, y el catálogo ya está en el aparato.
        const ids = [d?.lider, d?.base].filter((x): x is string => !!x)
        if (ids.length > 0) {
          const m = await getCardsByIds(ids)
          if (!vivo) return
          if (d?.lider) setLider(m.get(d.lider) ?? null)
          if (d?.base) setBase(m.get(d.base) ?? null)
        }
      }
      if (vivo) setCargando(false)
    })()
    return () => { vivo = false }
  }, [adjunto.tipo, adjunto.id])

  if (cargando) {
    return (
      <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-black/20 px-2 py-1.5">
        <Loader2 size={12} className="animate-spin text-swu-muted" />
        <span className="text-[10px] text-swu-muted">Cargando…</span>
      </div>
    )
  }

  if (adjunto.tipo === 'carta') {
    if (!carta) {
      return (
        <div className="mt-1.5 rounded-lg bg-black/20 px-2 py-1.5 text-[10px] text-swu-muted">
          Esta carta no está en tu catálogo
        </div>
      )
    }
    return (
      <button
        onClick={e => { e.stopPropagation(); navigate(`/cards/${carta.id}`) }}
        className="mt-1.5 block w-[132px] max-w-full text-left"
        title={carta.name}
      >
        <CardImage
          src={listFaceUrl(carta)}
          orientacion={listFaceIsLandscape(carta) ? 'apaisada' : 'vertical'}
          alt={carta.name}
          className="w-full"
        />
        <span className="mt-1 block truncate text-[10px] font-semibold text-swu-text">
          {carta.name}
        </span>
      </button>
    )
  }

  if (!mazo) {
    return (
      <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-black/20 px-2 py-1.5">
        <EyeOff size={12} className="text-swu-muted" />
        {/* Se dice lo que se sabe: no se puede ver. Si es porque lo borraron o
            porque es privado, no lo sabemos, y saberlo tampoco cambiaría nada
            de lo que se puede hacer. */}
        <span className="text-[10px] text-swu-muted">Este mazo ya no está disponible</span>
      </div>
    )
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); navigate(`/decks/${mazo.id}`) }}
      /* `w-[210px] max-w-full` y NO `w-full`.
         Con `w-full` la tarjeta se estiraba a lo que midiera su contenido más
         largo —el nombre del mazo— y arrastraba la burbuja con ella hasta
         salirse de la pantalla; en un teléfono el texto quedaba cortado por
         los dos lados. Un ancho fijo que se rinde ante el contenedor deja que
         el nombre se parta en vez de empujar. */
      className="mt-1.5 block w-[210px] max-w-full overflow-hidden rounded-lg
                 border border-swu-border bg-black/25 p-2 text-left"
    >
      {/* Líder y base: es lo que identifica un mazo de un vistazo. El nombre
          que la gente le pone suele ser una broma interna o el resultado de un
          torneo — informativo, pero no dice con qué se juega. */}
      <div className="flex items-center gap-2">
        <div className="flex flex-shrink-0 gap-1">
          {lider ? (
            <CardImage
              src={listFaceUrl(lider)}
              orientacion={listFaceIsLandscape(lider) ? 'apaisada' : 'vertical'}
              alt={lider.name}
              className="w-9"
            />
          ) : (
            <div className="grid h-12 w-9 place-items-center rounded bg-swu-bg">
              <Layers size={12} className="text-swu-muted" />
            </div>
          )}
          {base && (
            <CardImage
              src={listFaceUrl(base)}
              orientacion={listFaceIsLandscape(base) ? 'apaisada' : 'vertical'}
              alt={base.name}
              className="w-9"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {/* Los nombres del líder y la base van ARRIBA del nombre del mazo:
              son el dato, y el nombre propio es la etiqueta. */}
          <p className="truncate text-[11px] font-bold text-swu-text">
            {lider?.name ?? 'Mazo'}
          </p>
          {base && <p className="truncate text-[9px] text-swu-muted">{base.name}</p>}
          <p className="mt-0.5 text-[9px] text-swu-muted">{mazo.cartas} cartas · ver mazo</p>
        </div>
      </div>
      {/* El nombre del mazo, completo y partido en dos líneas si hace falta.
          `break-words` porque hay nombres de una sola palabra larguísima. */}
      <p className="mt-1.5 line-clamp-2 break-words border-t border-swu-border/60 pt-1.5
                    text-[10px] leading-snug text-swu-muted">
        {mazo.nombre}
      </p>
    </button>
  )
}

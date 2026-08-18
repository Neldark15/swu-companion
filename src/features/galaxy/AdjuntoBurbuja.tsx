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
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    void (async () => {
      if (adjunto.tipo === 'carta') {
        const m = await getCardsByIds([adjunto.id])
        if (vivo) setCarta(m.get(adjunto.id) ?? null)
      } else {
        const d = await verMazoCompartido(adjunto.id)
        if (vivo) setMazo(d)
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
      className="mt-1.5 flex w-full items-center gap-2 rounded-lg border border-swu-border
                 bg-black/20 px-2 py-1.5 text-left"
    >
      <Layers size={14} className="flex-shrink-0 text-swu-accent-texto" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-bold text-swu-text">{mazo.nombre}</span>
        <span className="block text-[9px] text-swu-muted">{mazo.cartas} cartas · ver mazo</span>
      </span>
    </button>
  )
}

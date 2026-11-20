import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { liveQuery } from 'dexie'
import { X } from 'lucide-react'
import { caraTrasera } from '../../services/caraCarta'
import { db } from '../../services/db'
import { getCardById } from '../../services/swuApi'
import { arteDeVariante } from '../../services/sobresArte'
import type { Card } from '../../types'
import { esApaisada, type CartaSacada, type CasillaAlbum, type Acabado as TipoAcabado } from '../../services/sobres'
import { AcabadoDeImagen } from './AcabadoDeImagen'
import { CartaGirable } from './CartaGirable'
import { ReversoCarta } from './ReversoCarta'
import { useMenosMovimiento } from './efectos'

type Props = {
  color: string
  alCerrar: () => void
  acabado?: TipoAcabado
} & (
  | { casilla: CasillaAlbum; hallazgo?: never; contexto?: never }
  | { hallazgo: CartaSacada; contexto: string; casilla?: never }
)

const VERTICAL = 286 / 400
const APAISADA = 400 / 286

export function LupaCarta({ casilla, hallazgo, contexto, color, alCerrar, acabado }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const titulo = useId()
  const reducido = useMenosMovimiento()
  const impresion = casilla ?? hallazgo
  const [intento, setIntento] = useState(0)
  const [lectura, setLectura] = useState<{
    id: string; intento: number; carta: Card | null; arte: string
  } | null>(null)
  const idPendiente = hallazgo && !hallazgo.carta ? hallazgo.cardId : undefined
  const variante = hallazgo?.variante
  const actual = lectura?.id === idPendiente && lectura?.intento === intento ? lectura : null
  const carta = impresion.carta ?? actual?.carta
  const pendiente = Boolean(idPendiente && !carta)

  useEffect(() => {
    if (!idPendiente || !variante) return
    let activo = true
    let encontrada = false
    const fallo = () => {
      if (activo && !encontrada) setLectura({ id: idPendiente, intento, carta: null, arte: '' })
    }
    const limite = window.setTimeout(fallo, 8000)
    const recuperar = async (ficha: Card | null | undefined) => {
      if (!activo || encontrada || !ficha) return
      encontrada = true
      clearTimeout(limite)
      const arte = await arteDeVariante(ficha, variante).catch(() => ficha.imageUrl)
      if (activo) setLectura({ id: idPendiente, intento, carta: ficha, arte })
    }
    // La sincronización inicial puede terminar mientras la lectura individual
    // sigue en la red. En cuanto Dexie recibe esta carta la lupa ya puede abrirla.
    const local = liveQuery(() => db.cards.get(idPendiente)).subscribe({
      next: ficha => { void recuperar(ficha) },
      error: () => { /* La consulta individual también puede resolverla. */ },
    })
    void getCardById(idPendiente).then(ficha => ficha ? recuperar(ficha) : fallo(), fallo)
    return () => {
      activo = false
      local.unsubscribe()
      clearTimeout(limite)
    }
  }, [idPendiente, variante, intento])
  const tenida = casilla?.tenida ?? true
  const trasera = caraTrasera(carta)
  const apaisada = esApaisada(carta)

  useLayoutEffect(() => {
    const el = dialogo.current
    if (!el) return
    const origen = document.activeElement
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    el.showModal()
    return () => {
      el.close()
      document.body.style.overflow = antes
      if (origen instanceof HTMLElement && origen.isConnected) origen.focus({ preventScroll: true })
    }
  }, [])

  return (
    <dialog ref={dialogo} aria-labelledby={titulo} className="lupa-carta-dialogo"
      onCancel={e => { e.preventDefault(); alCerrar() }}>
      <div className="lupa-carta-contenido" onClick={e => { if (e.target === e.currentTarget) alCerrar() }}>
        <button autoFocus type="button" onClick={alCerrar} aria-label="Cerrar"
          className="lupa-carta-cerrar grid size-11 place-items-center rounded-full bg-white/10 text-white">
          <X size={20} />
        </button>
        {pendiente ? (
          <div className="flex max-w-[300px] flex-col items-center gap-3 text-center">
            <p role="status" className="text-sm text-white/75">
              {actual ? 'Ya tenés esta carta. Su ficha todavía no está disponible.' : 'Buscando la carta en el catálogo…'}
            </p>
            {actual && (
              <button type="button" className="carta-girable-voltear" onClick={() => setIntento(n => n + 1)}>
                Volver a cargar la carta
              </button>
            )}
          </div>
        ) : tenida ? (
          <CartaGirable
            className="w-full max-w-[450px]"
            ratio={apaisada ? APAISADA : VERTICAL}
            ratioDorso={trasera.tipo === 'cara' && trasera.orientacion === 'apaisada' ? APAISADA : VERTICAL}
            frente={
              <AcabadoDeImagen
                src={actual?.arte || impresion.arte || carta?.imageUrl} alt={carta?.name ?? 'Cara de la carta'}
                orientacion={apaisada ? 'apaisada' : 'vertical'} elevacion="realce"
                relleno={false} fit="contain" className="h-full w-full" acabado={acabado}
              />
            }
            dorso={trasera.tipo === 'cara' ? (
              <AcabadoDeImagen
                src={trasera.url} alt={`${carta?.name ?? 'Carta'}, la otra cara`}
                orientacion={trasera.orientacion} elevacion="realce" relleno={false}
                fit="contain" className="h-full w-full" acabado={acabado}
              />
            ) : (
              <div className="size-full" role="img" aria-label="Dorso de Star Wars Unlimited"><ReversoCarta /></div>
            )}
          />
        ) : (
          <div style={{ width: 'min(100%, 38svh, 300px)', aspectRatio: String(VERTICAL) }}>
            <ReversoCarta />
          </div>
        )}
        <div className="mt-3 max-w-sm text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color }}>
            {contexto ?? (impresion.serializada ? 'Única en la comunidad' : `Nº ${casilla?.numero}`)}
          </p>
          <h2 id={titulo} className="mt-1 text-lg font-bold text-white">
            {carta?.name ?? (hallazgo ? 'Carta del sobre' : tenida ? 'Carta desconocida' : 'Casilla vacía')}
          </h2>
          {carta?.subtitle && <p className="text-sm text-white/75">{carta.subtitle}</p>}
          <p className="text-xs text-white/65">
            {carta && `${carta.setCode} ${carta.setNumber}`}
            {hallazgo && `${carta ? ' · ' : ''}${hallazgo.variante}`}
            {casilla && casilla.cantidad > 1 && ` · tenés ${casilla.cantidad}`}
          </p>
          {!tenida && <p className="mt-2 text-xs text-white/65">Todavía no te salió</p>}
          {tenida && !pendiente && !reducido && <p className="mt-2 text-xs text-white/65">Arrastrá para girarla</p>}
        </div>
      </div>
    </dialog>
  )
}

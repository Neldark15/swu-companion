/**
 * LUPA — la casilla del álbum abierta a pantalla completa.
 *
 * ── Qué hay del otro lado: la regla ──────────────────────────────────
 *
 * Por defecto el DORSO real del juego. Pero si la carta es de doble cara, del
 * otro lado va SU SEGUNDA CARA, porque esa carta no tiene dorso: un líder es
 * una sola cartulina con el líder de un lado y su unidad desplegada del otro.
 * Ponerle un dorso sería dibujar algo que no existe.
 *
 * Medido sobre el pool vivo (2.669 filas, las mismas que `select count(*) from
 * sobres_pool`): 144 tienen segunda cara, y son exactamente los 144 líderes de
 * la familia Showcase — o sea las 9 secciones Showcase del álbum ENTERAS. Las
 * otras 2.525 llevan dorso, incluidas las 25 bases del pool, que son de una
 * sola cara. La decisión vive en `caraTrasera()` (`services/caraCarta.ts`).
 *
 * ── Y por qué la caja no cambia de forma ─────────────────────────────
 *
 * Las dos caras de un líder tienen proporción OPUESTA: frente 400×286,
 * reverso 286×400 (bajadas y medidas, 6 de 6). No es que la carta cambie de
 * tamaño: es la misma cartulina con una cara impresa de lado. Así que la caja
 * es 286/400 —la del bolsillo— y la cara acostada se acomoda dentro. Cambiar
 * la proporción a mitad del giro reflowea el modal justo mientras la carta se
 * está moviendo.
 *
 * ── El hueco también se puede abrir ──────────────────────────────────
 *
 * Y muestra el dorso QUIETO, sin girar: si la carta no la tenés, no hay una
 * cara que enseñar. Se ve el nombre y el número, que es lo que hace querer
 * abrir otro sobre. Enseñarle el arte a quien no la tiene le quitaría el
 * sentido al sobre.
 */

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { CardImage } from '../../components/CardImage'
import { caraTrasera, esDobleCara } from '../../services/caraCarta'
import { esApaisada, type CasillaAlbum } from '../../services/sobres'
import { CartaGirable } from './CartaGirable'
import { ReversoCarta } from './ReversoCarta'

/** La caja de la carta: la misma del bolsillo, siempre. Ver la cabecera. */
const RATIO_BOLSILLO = 286 / 400

interface Props {
  casilla: CasillaAlbum
  /** El color de la sección. Solo tiñe el filo del dorso. */
  color: string
  alCerrar: () => void
  /** El brillo de la impresión, si el módulo ya lo tiene armado. */
  acabado?: React.ReactNode
}

export function LupaCarta({ casilla, color, alCerrar, acabado }: Props) {
  /* Las tres cosas que hacen los otros dos overlays del proyecto y que este no
   * hacía: cerrar con Escape, cerrar tocando el fondo, y que la página de
   * atrás no se desplace mientras la lupa está abierta. Copiado de
   * `CardZoom.tsx`, que es donde ya estaba resuelto. */
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') alCerrar() }
    window.addEventListener('keydown', alTeclear)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = antes
    }
  }, [alCerrar])

  const carta = casilla.carta
  const trasera = caraTrasera(carta)
  const dobleCara = esDobleCara(carta)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto
                 overscroll-contain bg-black/85 p-5"
      role="dialog"
      aria-modal="true"
      aria-label={carta?.name ?? `Casilla ${casilla.numero}`}
      onClick={alCerrar}
    >
      <button
        type="button"
        onClick={alCerrar}
        className="absolute top-4 right-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white"
        aria-label="Cerrar"
      >
        <X size={20} />
      </button>

      <div className="w-full max-w-[300px]" onClick={e => e.stopPropagation()}>
        {casilla.tenida ? (
          <CartaGirable
            ratio={RATIO_BOLSILLO}
            acabado={acabado}
            frente={
              /* `casilla.arte`, no `carta.imageUrl`: la impresión foil del API
                 trae los destellos quemados en el archivo. */
              <CardImage
                src={casilla.arte || carta?.imageUrl}
                alt={carta?.name ?? ''}
                orientacion={esApaisada(carta) ? 'apaisada' : 'vertical'}
                elevacion="realce"
                className="h-full w-full"
              />
            }
            dorso={
              trasera.tipo === 'cara' ? (
                <CardImage
                  src={trasera.url}
                  alt={carta ? `${carta.name}, la otra cara` : ''}
                  orientacion={trasera.orientacion}
                  elevacion="realce"
                  className="h-full w-full"
                />
              ) : (
                <ReversoCarta color={color} />
              )
            }
          />
        ) : (
          /* El hueco: el dorso quieto. No hay nada que girar. */
          <div className="mx-auto w-full" style={{ aspectRatio: String(RATIO_BOLSILLO) }}>
            <ReversoCarta color={color} />
          </div>
        )}
      </div>

      <div className="mt-4 max-w-[300px] text-center">
        <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color }}>
          {casilla.serializada ? 'ÚNICA EN LA COMUNIDAD' : `Nº ${casilla.numero}`}
        </p>
        <p className="mt-0.5 text-lg font-bold text-white">{carta?.name ?? 'Casilla vacía'}</p>
        {carta?.subtitle && <p className="text-sm text-white/70">{carta.subtitle}</p>}
        <p className="text-xs text-white/55">
          {carta ? `${carta.setCode} ${carta.setNumber}` : ''}
          {casilla.cantidad > 1 ? ` · tenés ${casilla.cantidad}` : ''}
        </p>

        <p className="mt-2 text-[11px] text-white/40">
          {!casilla.tenida
            ? 'Todavía no te salió'
            : dobleCara
              ? 'Arrastrá para ver la otra cara'
              : 'Arrastrá para girarla'}
        </p>
      </div>
    </div>
  )
}

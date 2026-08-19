/**
 * Las COPIAS de una carta del mazo, cada una con su impresión.
 *
 * ── Por qué una por copia y no una por carta ─────────────────────────
 *
 * Nadie tiene sus tres copias iguales. Lo normal es tener una foil que salió de
 * un sobre y dos normales compradas sueltas. Con un solo valor por carta había
 * que mentir en dos de las tres, y el precio del mazo salía mal por el mismo
 * motivo.
 *
 * ── Y por qué hay atajo Y control individual ─────────────────────────
 *
 * Porque los dos casos son frecuentes y ninguno cubre al otro: «las tres son
 * normales» es un toque en la fila de arriba, y «esta una es foil» es un toque
 * en esa carta. Dejar solo lo segundo obliga a tres toques para el caso más
 * común; dejar solo lo primero es justamente lo que había antes.
 *
 * ── El selector cicla, no despliega ──────────────────────────────────
 *
 * A 375 px tres copias dejan ~92 px por carta. Un desplegable de cuatro
 * opciones ahí no cabe, y un menú flotante taparía las otras dos. Un botón que
 * cicla con la etiqueta SIEMPRE visible ocupa una línea y no esconde el estado
 * actual, que es lo único que de verdad hay que poder leer.
 */

import { CardImage } from '../../components/CardImage'
import { Sheet } from '../../components/ui/Sheet'
import {
  CICLO_VARIANTE, NOMBRE_VARIANTE, siguienteVariante,
  type VarianteMazo,
} from '../../services/precioMazo'

/** El color de cada impresión. Normal va apagado: es el caso por defecto. */
const TONO: Record<VarianteMazo, string> = {
  normal: 'bg-swu-surface-hover text-swu-muted',
  foil: 'bg-swu-cyan/20 text-swu-cyan',
  hyperspace: 'bg-swu-amber/20 text-swu-amber',
  alterna: 'bg-purple-400/20 text-purple-300',
}

interface Props {
  abierto: boolean
  alCerrar: () => void
  nombre: string
  /** El arte, ya resuelto por la pantalla que llama. */
  imagen?: string
  apaisada?: boolean
  /** Una entrada por copia. Su largo ES la cantidad. */
  impresiones: VarianteMazo[]
  /** Cambia SOLO la copia `i`. */
  alCambiar: (i: number, v: VarianteMazo) => void
  /** Pone todas las copias en la misma. */
  alCambiarTodas: (v: VarianteMazo) => void
}

export function CopiasDeCarta({
  abierto, alCerrar, nombre, imagen, apaisada = false,
  impresiones, alCambiar, alCambiarTodas,
}: Props) {
  const n = impresiones.length

  return (
    <Sheet open={abierto} onClose={alCerrar} title={nombre}>
      <div className="space-y-3">
        {/* El atajo, para el caso más común: todas iguales. */}
        {n > 1 && (
          <div>
            <p className="mb-1 text-[10px] font-black tracking-widest text-swu-muted uppercase">
              Poner las {n} en
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CICLO_VARIANTE.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => alCambiarTodas(v)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${TONO[v]}`}
                >
                  {NOMBRE_VARIANTE[v]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Una carta por copia. Se dibujan de verdad porque el pedido era
            «que te muestre las 3 cartas»: ver tres láminas es lo que hace
            entender que son tres objetos distintos y no un número. */}
        <ul className="flex flex-wrap justify-center gap-2.5">
          {impresiones.map((v, i) => (
            <li key={i} className="w-[92px]">
              {/* La proporción la pone ESTE contenedor, no `CardImage`: la
                  raíz de CardImage es solo `${className} overflow-hidden …` y
                  no reserva alto. Con un `w-full` pelado la caja quedaba en
                  104×0 y no se dibujaba ni el esqueleto — medido.
                  El bolsillo es SIEMPRE vertical, también para un líder: es
                  como entra en el binder de verdad, y así las copias de una
                  misma hoja miden todas lo mismo. */}
              <div className="relative aspect-[286/400] w-full">
                {imagen ? (
                  <CardImage
                    src={imagen}
                    alt={`${nombre}, copia ${i + 1}`}
                    orientacion={apaisada ? 'apaisada' : 'vertical'}
                    className="h-full w-full"
                  />
                ) : (
                  <div className="h-full w-full rounded-lg bg-swu-surface" />
                )}
                <span className="absolute top-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-black text-white/90">
                  {i + 1}
                </span>
              </div>
              <button
                type="button"
                onClick={() => alCambiar(i, siguienteVariante(v))}
                aria-label={`Copia ${i + 1}: ${NOMBRE_VARIANTE[v]}. Tocá para cambiar de impresión.`}
                className={`mt-1 w-full rounded-lg py-1.5 text-[11px] font-bold transition-colors ${TONO[v]}`}
              >
                {NOMBRE_VARIANTE[v]}
              </button>
            </li>
          ))}
        </ul>

        {/* Lo que la impresión NO cambia. Sin esto, alguien puede pensar que
            marcar foil altera la legalidad del mazo o lo que exporta. */}
        <p className="border-t border-swu-border pt-2.5 text-[11px] leading-snug text-swu-muted">
          Solo cambia el precio estimado — para el juego una foil y una normal son la
          misma carta. La fuente solo publica precio de{' '}
          <strong className="text-swu-text">Normal</strong> y{' '}
          <strong className="text-swu-text">Foil</strong>; Hyper y Alterna van con el de la normal.
        </p>
      </div>
    </Sheet>
  )
}

/**
 * CajaDeSobres — elegir uno, como se elige de una caja de verdad.
 *
 * ── Por qué existe esta pantalla ─────────────────────────────────────
 *
 * Un botón que dijera «abrir sobre» haría exactamente lo mismo. Pero elegir
 * es la mitad de la gracia: en la tienda uno mete la mano, duda entre dos y
 * saca uno, y a partir de ese momento ese sobre es SUYO — lo que salga salió
 * porque lo eligió. Ese sentimiento es gratis de reproducir y no hay razón
 * para no hacerlo.
 *
 * ── Y la parte honesta ───────────────────────────────────────────────
 *
 * Cuál se elija NO cambia lo que sale: el servidor sortea después, con las
 * mismas probabilidades para los seis. Que quede claro acá porque es
 * exactamente igual que en la vida real —el sobre ya está sellado, elegir otro
 * tampoco te habría dado mejor suerte— y porque la tentación de fingir lo
 * contrario (un sobre «con más brillo» que en realidad tuviera mejores
 * probabilidades ocultas) sería una mentira al jugador.
 *
 * Los seis se ven distintos (sello de otro color, plateado en otro ángulo)
 * porque en la caja de verdad tampoco hay dos iguales de posición. Es adorno,
 * y el adorno no miente sobre las probabilidades.
 */

import { useState, useRef, useCallback } from 'react'
import { SobreArte } from './SobreArte'
import { sonar } from './sonido'
import { useMenosMovimiento } from './efectos'

/** Cuántos se ofrecen. Seis caben en un teléfono sin quedar de sellos de correo. */
export const CUANTOS = 6

interface Props {
  /** Se llama con el índice elegido. */
  alElegir: (indice: number) => void
  /** Bloquea la elección mientras se resuelve la anterior. */
  ocupado?: boolean
}

/**
 * Dónde va cada sobre del abanico. `t` va de -1 (izquierda) a 1 (derecha).
 *
 * El desplazamiento es del 58% del ancho del sobre y no del 32%: con el 32%
 * quedaban unos 18 px de cada sobre a la vista y los seis se leían como UNO
 * con sombra. Si no se distinguen, elegir no significa nada, que es justo lo
 * único que esta pantalla tiene que lograr.
 */
function sitio(i: number) {
  const t = (i - (CUANTOS - 1) / 2) / ((CUANTOS - 1) / 2)
  return {
    t,
    // El giro 2D arma el abanico; el 3D lo gira hacia quien mira, como si la
    // caja estuviera de frente y los de los lados se vieran de canto.
    estilo: {
      transform:
        `translateX(${t * 58}%) translateY(${Math.abs(t) * 16}px) ` +
        `rotate(${t * 15}deg) rotateY(${t * -22}deg)`,
      // Los del centro por delante: es el orden en que están en la caja.
      zIndex: CUANTOS - Math.round(Math.abs(t) * CUANTOS),
    } as React.CSSProperties,
  }
}

export function CajaDeSobres({ alElegir, ocupado = false }: Props) {
  const [elegido, setElegido] = useState<number | null>(null)
  const [tocando, setTocando] = useState<number | null>(null)
  const quieto = useMenosMovimiento()
  // Una sola elección por montaje: sin esto, dos toques rápidos disparaban dos
  // aperturas y se cobraban dos sobres por una sola animación.
  const yaEligio = useRef(false)

  const elegir = useCallback(
    (i: number) => {
      if (yaEligio.current || ocupado) return
      yaEligio.current = true
      setElegido(i)
      sonar('tomar')
      // Se avisa YA, no al final de la animación: así la llamada al servidor
      // corre mientras el sobre sale de la caja y el rasgado no tiene que
      // esperar a la red. Si falla, quien llama vuelve a montar esta caja.
      alElegir(i)
    },
    [alElegir, ocupado],
  )

  return (
    <div className="select-none">
      <p className="mb-1 text-center text-[11px] font-black uppercase tracking-[0.2em] text-swu-muted">
        Meté la mano
      </p>
      <p className="mb-6 text-center text-sm text-swu-muted">
        Sacá uno. El que elijas es el tuyo.
      </p>

      <div
        className="carta3d-escena relative mx-auto h-[270px] w-full max-w-md"
        role="group"
        aria-label="Sobres para elegir"
      >
        {Array.from({ length: CUANTOS }, (_, i) => {
          const { estilo } = sitio(i)
          const esteEsElegido = elegido === i
          const otroFueElegido = elegido !== null && !esteEsElegido

          return (
            <button
              key={i}
              type="button"
              disabled={ocupado || elegido !== null}
              onPointerDown={() => setTocando(i)}
              onPointerUp={() => setTocando(null)}
              onPointerLeave={() => setTocando(null)}
              onClick={() => elegir(i)}
              aria-label={`Sobre ${i + 1} de ${CUANTOS}`}
              className="absolute top-0 left-1/2 h-[210px] w-[140px] -translate-x-1/2 rounded-lg
                         focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-swu-cyan
                         disabled:cursor-default"
              style={{
                ...estilo,
                transformStyle: 'preserve-3d',
                // Se compone con el sitio de arriba en una sola cadena para no
                // pelear con `transform`: el elegido sube y crece, los otros se
                // hunden y se van.
                ...(esteEsElegido
                  ? {
                      transform:
                        'translateX(0) translateY(-26px) rotate(0deg) rotateY(0deg) scale(1.12)',
                      zIndex: 50,
                    }
                  : {}),
                ...(otroFueElegido ? { opacity: 0, transform: `${estilo.transform} translateY(90px)` } : {}),
                ...(tocando === i && elegido === null
                  ? { transform: `${estilo.transform} translateY(-14px)` }
                  : {}),
                transition: quieto
                  ? 'opacity 200ms linear'
                  : 'transform 520ms cubic-bezier(0.22,1,0.36,1), opacity 380ms ease',
                // Solo mientras hay movimiento: una capa por sobre, permanente,
                // es memoria de vídeo tirada.
                willChange: elegido !== null || tocando === i ? 'transform, opacity' : 'auto',
              }}
            >
              <span className="pointer-events-none block h-full w-full drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]">
                <SobreArte indice={i} />
              </span>
            </button>
          )
        })}
      </div>

      <p className="mt-5 text-center text-[11px] text-swu-muted/70">
        Los seis tienen exactamente las mismas probabilidades.
      </p>
    </div>
  )
}

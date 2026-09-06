/**
 * ACTUALIZAR, al lado de la campana.
 *
 * La app ya se actualiza sola: comprueba cada 15 minutos, al volver a la
 * pestaña y al enfocar la ventana, y si estás en una pantalla segura la aplica
 * sin preguntar (§2g). Pero todo eso pasa **por su cuenta**, y quien acaba de
 * ver un cambio anunciado y no lo tiene no tenía dónde tocar: la única
 * comprobación manual vivía dentro de Ajustes, a cuatro toques.
 *
 * ── Cuelga del MISMO registro, no de uno nuevo ───────────────────────
 *
 * `registerSW` se llama UNA vez, desde `UpdatePrompt`, que está montado siempre
 * en el caparazón. Este botón solo lee `useActualizacion` y usa las funciones
 * que ese registro dejó guardadas. Registrar otro service worker desde acá
 * dejaría dos compitiendo, y el que aplicara la actualización no sería
 * necesariamente el que la detectó.
 *
 * ── Y NO es `location.reload()` ──────────────────────────────────────
 *
 * Recargar a mano vuelve a pedir el mismo `index.html` que el service worker
 * viejo tiene precacheado: se ve igual de rápido y no actualiza nada. Es
 * exactamente el síntoma que el §2g documenta —«cada deploy quedaba invisible»—
 * y por eso aplicar tiene que pasar por `updateSW(true)`, que le dice a la
 * versión en espera que tome el control y recién entonces recarga.
 *
 * ── UN BOTÓN QUE NO ACUSA RECIBO SE TOCA CINCO VECES ─────────────────
 *
 * Si no hay nada nuevo, comprobar no cambia nada en pantalla y la persona
 * concluye que el botón está roto. Por eso, cuando termina sin novedad, dice
 * «Al día» durante unos segundos. Es el mismo motivo por el que el store marca
 * `ultimaComprobacion` aunque no haya encontrado nada.
 */

import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Check } from 'lucide-react'
import { useActualizacion } from '../../services/actualizacion'

/** Cuánto se queda el acuse de «Al día» antes de volver al estado normal. */
const ACUSE_MS = 2600

export function BotonActualizar() {
  const hayVersionNueva = useActualizacion(s => s.hayVersionNueva)
  const comprobando = useActualizacion(s => s.comprobando)
  const aplicar = useActualizacion(s => s.aplicar)
  const comprobarAhora = useActualizacion(s => s.comprobarAhora)

  const [alDia, setAlDia] = useState(false)
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (reloj.current) clearTimeout(reloj.current) }, [])

  /* El registro tarda un instante en dejar sus funciones. Mientras tanto el
     botón no se dibuja: uno que existe y no hace nada es peor que uno que
     todavía no está. */
  if (!aplicar) return null

  const tocar = async () => {
    if (hayVersionNueva) {
      // Esto RECARGA. Es lo que la persona pidió al tocarlo.
      await aplicar()
      return
    }
    setAlDia(false)
    await comprobarAhora()
    /* Se lee el estado FRESCO del store, no el `hayVersionNueva` del cierre:
       ese es el de antes de comprobar, así que una versión recién encontrada
       se anunciaría como «Al día» — el peor resultado posible, porque es
       exactamente al revés. */
    if (useActualizacion.getState().hayVersionNueva) return
    setAlDia(true)
    if (reloj.current) clearTimeout(reloj.current)
    reloj.current = setTimeout(() => setAlDia(false), ACUSE_MS)
  }

  const etiqueta = hayVersionNueva
    ? 'Hay una versión nueva. Tocá para actualizar; la app se va a recargar.'
    : comprobando ? 'Buscando actualizaciones…'
    : alDia ? 'La app está al día'
    : 'Buscar actualizaciones'

  return (
    <div className="relative">
      <button
        onClick={() => void tocar()}
        disabled={comprobando}
        aria-label={etiqueta}
        title={etiqueta}
        className={`relative rounded-lg p-1.5 transition-colors ${
          hayVersionNueva
            ? 'text-swu-accent-texto hover:bg-swu-surface-hover'
            : 'text-swu-muted hover:bg-swu-surface-hover hover:text-swu-text'
        }`}
      >
        {alDia
          ? <Check size={22} className="text-swu-green" aria-hidden />
          : <RefreshCw
              size={22}
              aria-hidden
              className={comprobando ? 'animate-spin motion-reduce:animate-none' : ''}
            />}

        {/* El punto solo cuando hay algo que aplicar. Anclado al ÍCONO y no al
            botón: colgado del botón cae en el borde de la pantalla y se lee
            como una mancha suelta (§3v). */}
        {hayVersionNueva && !comprobando && !alDia && (
          <span
            className="absolute right-0.5 top-0.5 block h-2 w-2 rounded-full bg-swu-accent ring-2 ring-swu-bg"
            aria-hidden
          />
        )}
      </button>

      {/* El acuse, VISIBLE. Un cambio de ícono solo se nota si estabas mirando
          justo ahí; esto se lee sin buscarlo y se va solo. */}
      {alDia && (
        <span
          role="status"
          className="pointer-events-none absolute right-0 top-full z-20 mt-1 whitespace-nowrap rounded-lg
                     border border-swu-border bg-swu-surface px-2 py-1 text-[10px] font-bold text-swu-text"
        >
          Al día
        </span>
      )}
    </div>
  )
}

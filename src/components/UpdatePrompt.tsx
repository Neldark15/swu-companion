/**
 * UpdatePrompt — avisa que hay una versión nueva y la aplica cuando el
 * usuario quiere.
 *
 * ── Por qué existe ────────────────────────────────────────────────────
 *
 * La PWA instalada se quedaba con la versión vieja indefinidamente. El
 * service worker precacheaba el index.html y nunca cedía el control, así que
 * un deploy podía ser invisible: medido en producción, el navegador cargaba
 * `index-BSkwW_Gc.css` mientras el servidor ya servía `index-1H8UJgmK.css`.
 *
 * ── Cuándo se aplica SOLA y cuándo pregunta ───────────────────────────
 *
 * Antes preguntaba SIEMPRE, y eso resolvía mal el problema: «se me quedan
 * versiones viejas». Tres cosas fallaban a la vez —solo comprobaba cada 60
 * minutos, no comprobaba al volver a la app, y pedía permiso incluso cuando no
 * había nada que interrumpir—, así que quedarse atrás era el resultado normal.
 *
 * La razón de preguntar es real y se conserva: actualizar RECARGA, y una
 * recarga puede cortar un tracker de partida en curso o un mazo a medio armar.
 * Pero eso solo pasa en unas pocas pantallas.
 *
 *   · La app está OCULTA  → se aplica sola. Nadie está mirando y no hay nada
 *     escribiéndose; es el mejor momento posible para recargar.
 *   · Estás en una pantalla de la LISTA BLANCA → se aplica sola.
 *   · En cualquier otra → pregunta, como antes.
 *
 * LISTA BLANCA Y NO NEGRA, a propósito: con una lista negra, cada pantalla
 * nueva quedaría marcada como segura por omisión, que es la dirección
 * peligrosa. Acá lo que no está declarado PREGUNTA — molesta un poco, que es
 * el fallo barato, en vez de recargarte encima, que es el caro. Es la misma
 * corrección que se le hizo hoy a la tabla de posiciones de la liga.
 *
 * Y las pantallas de verdad delicadas —el overlay de OBS, el estudio, el panel
 * de admin, el Centro de Temporada y el panel de liga— ni siquiera montan este
 * componente: viven fuera del caparazón. Ahí no hay riesgo por estructura.
 *
 * El botón "Después" solo lo esconde en esta sesión: no se guarda un "nunca
 * más", porque quedarse atrás en silencio es justamente el problema original.
 */

import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { RefreshCw, X } from 'lucide-react'
import { useActualizacion } from '../services/actualizacion'

/**
 * Dónde recargar sin avisar no le cuesta nada a nadie.
 *
 * Son pantallas de LECTURA o de estado ya guardado: si se recargan, se vuelven
 * a pintar igual. Lo que NO está acá pregunta — el tracker, el Contador, el
 * constructor de mazos y el tablero de torneo tienen algo a medio hacer que
 * solo vive en la pantalla.
 */
const SEGURAS = [
  '/', '/explore', '/collection', '/binder-digital', '/cards', '/rank',
  '/community', '/galaxy', '/galaxia', '/blog', '/rulings', '/meta',
  '/calendario', '/torneos', '/sedes', '/misiones', '/sobres', '/trivia',
  '/aurebesh', '/profile', '/settings', '/credencial', '/espionaje',
  '/amistosas', '/prestamos', '/mensajes', '/envivo', '/u/', '/liga/',
  '/laboratorio', '/scan', '/terraformar', '/sable', '/c/',
]

/** El panel de liga NO es seguro aunque empiece con `/liga/`. */
const NO_SEGURAS = ['/liga/', '/panel']

function esSegura(ruta: string): boolean {
  const limpia = ruta.split('?')[0]
  if (limpia.startsWith(NO_SEGURAS[0]) && limpia.endsWith(NO_SEGURAS[1])) return false
  if (limpia === '/') return true
  return SEGURAS.some(r => r !== '/' && (limpia === r || limpia.startsWith(r.endsWith('/') ? r : r + '/')))
}

export function UpdatePrompt() {
  const { pathname } = useLocation()
  /* La ruta va en una `ref` además del render: el callback del service worker
     se crea UNA vez y capturaría el `pathname` del primer pintado. Sin esto,
     alguien que abrió la app en Inicio y se fue al Contador se comería una
     recarga a mitad de partida — el caso exacto que este componente evita. */
  const ruta = useRef(pathname)
  // Se escribe en un efecto y no en el render: escribir una ref durante el
  // render es lo que la regla `react-hooks/refs` prohíbe, y con razón.
  useEffect(() => { ruta.current = pathname }, [pathname])

  const [needRefresh, setNeedRefresh] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null)

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        // Se avisa al store SIEMPRE: Ajustes tiene que saberlo aunque acá se
        // resuelva solo o se cierre con «Después».
        useActualizacion.getState()._setVersionNueva(true)

        // Oculta o en pantalla de lectura: se aplica sola y no se pregunta
        // nada. `updateSW(true)` recarga en cuanto la versión nueva toma el
        // control; con la app oculta, eso pasa sin que nadie lo vea.
        if (document.hidden || esSegura(ruta.current)) {
          void updateSW(true).catch(() => {
            // Si falla, no se pierde el aviso: se cae al camino de siempre.
            setNeedRefresh(true)
            setDismissed(false)
          })
          return
        }
        setNeedRefresh(true)
        setDismissed(false) // una versión NUEVA vuelve a mostrar el aviso
      },
      onRegisteredSW(_url, registration) {
        // El navegador solo revisa el sw.js al navegar o cada 24 h. En una
        // PWA instalada uno puede pasarse días sin "navegar", así que se
        // busca actualización cada hora estando la app abierta.
        if (!registration) return
        const buscar = () => { registration.update().catch(() => {}) }

        /* CADA 15 MINUTOS, no cada hora. El navegador solo revisa el sw.js al
           navegar o cada 24 h, y en una PWA instalada uno puede pasarse días
           sin «navegar». Una hora era demasiado para alguien que despliega y
           quiere ver el cambio. */
        setInterval(buscar, 15 * 60 * 1000)

        /* Y AL VOLVER A LA APP, que es el momento natural: se mira el teléfono,
           se vuelve, y ahí es cuando conviene enterarse. Sin esto, una pestaña
           abierta desde ayer no se entera hasta la próxima hora en punto. */
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) buscar()
        })
        window.addEventListener('focus', buscar)
        buscar()   // y una al arrancar, sin esperar el primer intervalo
        // Y se deja la comprobación MANUAL al alcance de Ajustes. Es el mismo
        // `registration` que detectó la versión: registrar otro desde Ajustes
        // dejaría dos compitiendo, y el que aplicara no sería el que detectó.
        useActualizacion.getState()._setFunciones({
          aplicar: () => updateSW(true),
          comprobar: async () => { await registration.update() },
        })
      },
    })
    // `registerSW` devuelve la función que aplica la actualización. Se
    // guarda en un microtask: hacerlo en el cuerpo del efecto encadena un
    // render antes de la primera pintada, y esto es un aviso que casi nunca
    // se muestra.
    queueMicrotask(() => setUpdate(() => updateSW))
  }, [])

  if (!needRefresh || dismissed) return null

  return (
    // CENTRADO, no pegado abajo.
    //
    // Abajo competía con la barra de pestañas y con la barra del navegador
    // móvil, que es donde ya se apilan tres cosas; encima, un aviso ahí se lee
    // como una notificación pasajera y se descarta sin leer. En el centro,
    // sobre un velo, es lo único que hay en pantalla y se decide una vez.
    //
    // El velo NO cierra al tocarlo: la decisión es «ahora» o «después», y un
    // toque perdido no debería contar como ninguna de las dos.
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl border border-swu-accent/40 bg-swu-surface p-4 shadow-2xl shadow-black/60">
        <div className="flex items-start gap-2.5">
          <RefreshCw
            size={16}
            className={`mt-0.5 flex-shrink-0 text-swu-accent-texto ${updating ? 'animate-spin' : ''}`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-swu-text">Hay una versión nueva</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-swu-muted">
              Actualizar recarga la app. Si estás en medio de una partida,
              podés hacerlo al terminar.
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Ahora no"
            disabled={updating}
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-swu-muted hover:text-swu-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="mt-2.5 flex gap-2">
          <button
            onClick={() => setDismissed(true)}
            disabled={updating}
            className="min-h-11 flex-1 rounded-xl border border-swu-border bg-swu-bg text-xs font-semibold text-swu-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent disabled:opacity-50"
          >
            Después
          </button>
          <button
            onClick={async () => {
              setUpdating(true)
              // `true` = recargar en cuanto la versión nueva tome el control.
              try { await update?.() } catch { setUpdating(false) }
            }}
            disabled={updating || !update}
            className="min-h-11 flex-1 rounded-xl border border-transparent bg-swu-accent text-xs font-bold text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent focus-visible:ring-offset-2 focus-visible:ring-offset-swu-bg disabled:opacity-50"
          >
            {updating ? 'Actualizando…' : 'Actualizar ahora'}
          </button>
        </div>
      </div>
    </div>
  )
}

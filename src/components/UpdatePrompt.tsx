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
 * ── Por qué se PREGUNTA en vez de actualizar solo ─────────────────────
 *
 * Actualizar recarga la página. Hacerlo sin avisar puede cortar algo a la
 * mitad — un tracker de partida en curso, un mazo a medio armar, un torneo
 * en juego. El aviso se queda quieto hasta que la persona elija el momento.
 *
 * El botón "Después" solo lo esconde en esta sesión: no se guarda un "nunca
 * más", porque quedarse atrás en silencio es justamente el problema original.
 */

import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { RefreshCw, X } from 'lucide-react'

export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null)

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true)
        setDismissed(false) // una versión NUEVA vuelve a mostrar el aviso
      },
      onRegisteredSW(_url, registration) {
        // El navegador solo revisa el sw.js al navegar o cada 24 h. En una
        // PWA instalada uno puede pasarse días sin "navegar", así que se
        // busca actualización cada hora estando la app abierta.
        if (!registration) return
        setInterval(() => { registration.update().catch(() => {}) }, 60 * 60 * 1000)
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
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[70] pb-safe lg:inset-x-auto lg:right-4 lg:bottom-4 lg:max-w-sm"
    >
      <div className="m-3 rounded-xl border border-swu-accent/40 bg-swu-surface p-3 shadow-xl shadow-black/40">
        <div className="flex items-start gap-2.5">
          <RefreshCw
            size={16}
            className={`mt-0.5 flex-shrink-0 text-swu-accent ${updating ? 'animate-spin' : ''}`}
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

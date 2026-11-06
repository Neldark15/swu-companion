/** Registro global y aviso de actualización. La decisión usa la ruta actual,
 * incluso cuando se sale del caparazón hacia el contador de pantalla completa. */
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { RefreshCw, X } from 'lucide-react'
import { useActualizacion } from '../services/actualizacion'
import { iniciarRegistroPwa, aplicarActualizacionSegura } from '../services/registroPwa'
import { esSeguraParaActualizar, omitirRegistroPwa, posponerAvisoActualizacion } from '../services/politicaActualizacion'

export function UpdatePrompt() {
  const { pathname } = useLocation()
  const needRefresh = useActualizacion(s => s.hayVersionNueva)
  const update = useActualizacion(s => s.aplicar)
  const [dismissed, setDismissed] = useState(false)
  const [updating, setUpdating] = useState(false)
  const omitir = omitirRegistroPwa(pathname)

  useEffect(() => {
    if (!omitir) return iniciarRegistroPwa()
  }, [omitir])

  useEffect(() => {
    if (needRefresh && !omitir) void aplicarActualizacionSegura()
  }, [pathname, needRefresh, omitir])

  if (!needRefresh || dismissed || posponerAvisoActualizacion(pathname) || esSeguraParaActualizar(pathname)) return null

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
            className="-mr-1 -mt-1 grid min-h-11 min-w-11 place-items-center rounded-lg p-1.5 text-swu-muted hover:text-swu-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
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

/**
 * Sheet — panel inferior en móvil, diálogo centrado en escritorio.
 *
 * Es el contenedor de la vista rápida de carta del binder: aparece sobre la
 * cuadrícula sin sacarte de ella, que es justo lo que se pierde al navegar a
 * una ruta nueva.
 *
 * Hace lo que un diálogo modal tiene que hacer y la app no hacía en ningún
 * lado: mueve el foco adentro al abrir, cicla el Tab dentro del panel, lo
 * devuelve al cerrar, cierra con Escape y bloquea el scroll del fondo.
 */

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  /** Oculta el encabezado y deja el contenido a ras (útil para arte grande). */
  bare?: boolean
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

export function Sheet({ open, onClose, title, children, bare = false }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // `onClose` suele venir como flecha en línea, o sea identidad nueva en cada
  // render del padre. Si estuviera en las dependencias del efecto, TODO el
  // efecto (listener, bloqueo de scroll, captura y devolución de foco) se
  // desmontaría y rearmaría con cada '+' que tocás dentro del panel — y la
  // devolución de foco te sacaría del botón que acabás de usar.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // El foco entra al panel; si no, el teclado sigue en el fondo tapado.
    requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? panelRef.current)?.focus()
    })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCloseRef.current(); return }
      if (e.key !== 'Tab') return
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (!nodes || nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus?.()
    }
  }, [open])

  if (!open) return null

  // Va por PORTAL a <body>, y no donde se monte el componente.
  //
  // Medido en móvil (375x812): la TabBar es `z-50` igual que este panel y es
  // un hermano POSTERIOR del contenido en el DOM, así que con el mismo
  // z-index ganaba ella y se comía los últimos 57 px del panel — justo donde
  // caen los botones. Se veía en las 10 pantallas que usan Sheet, pero dolía
  // sobre todo en el asistente de «Terminá tu perfil», donde lo tapado era el
  // botón de continuar y el asistente quedaba sin salida.
  //
  // Subir el z-index a mano lo tapaba a medias: el panel seguiría dependiendo
  // de en qué árbol lo monten y de si algún ancestro futuro trae un
  // `transform` (que convertiría el `fixed` en relativo a ese ancestro).
  // Sacándolo a <body> el diálogo es independiente de su sitio de montaje,
  // que es lo que un modal tiene que ser.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        /* `sheet-alto` es `88dvh` con `88vh` de respaldo. En el navegador de un
           teléfono, `vh` mide la ventana COMO SI la barra de direcciones
           estuviera oculta, así que 88vh puede ser más alto que lo que de
           verdad se ve y el final del panel queda fuera de la pantalla. El
           caparazón de la app ya usa `100dvh`; esto lo pone de acuerdo. */
        className="
          sheet-alto w-full sm:max-w-md flex flex-col overflow-hidden
          bg-swu-surface border border-swu-border
          rounded-t-2xl sm:rounded-2xl animate-slide-up sm:animate-none
          focus-visible:outline-none
        "
      >
        {!bare && (
          <div className="relative flex flex-shrink-0 items-center gap-2 px-4 py-3 bg-swu-surface border-b border-swu-border">
            {/* Asa visual del panel en móvil */}
            <span className="absolute left-1/2 -translate-x-1/2 -top-0 h-1 w-10 rounded-full bg-swu-border sm:hidden" aria-hidden />
            <h2 className="flex-1 text-sm font-bold text-swu-text truncate">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="p-2 -mr-2 rounded-lg text-swu-muted hover:text-swu-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        )}
        {/* El que scrollea es el CUERPO, no el panel: así el título se queda
            quieto y el contenido largo nunca empuja el panel más allá de su
            alto máximo. El `pb-safe` va acá para que la última línea no quede
            bajo la barra de gestos del teléfono. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-safe">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}

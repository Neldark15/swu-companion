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
      if (e.key === 'Escape') { onClose(); return }
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
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="
          w-full sm:max-w-md max-h-[88vh] overflow-y-auto overscroll-contain
          bg-swu-surface border border-swu-border
          rounded-t-2xl sm:rounded-2xl animate-slide-up sm:animate-none
          focus-visible:outline-none pb-safe
        "
      >
        {!bare && (
          <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 bg-swu-surface border-b border-swu-border">
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
        {children}
      </div>
    </div>
  )
}

/**
 * ErrorBoundary — convierte una pantalla en blanco en algo que se puede leer
 * y arreglar.
 *
 * ── Por qué existe ────────────────────────────────────────────────────
 *
 * La app no tenía NINGUNO. En React, un error de render que nadie captura
 * desmonta el árbol entero: la persona ve una pantalla vacía, sin mensaje, sin
 * botón y sin ninguna pista de qué pasó. En una PWA instalada es peor todavía,
 * porque no hay barra de direcciones a la que volver.
 *
 * Hay un caso concreto que lo vuelve casi inevitable: las rutas se cargan con
 * `lazy()`. Si el `import()` de un chunk falla —conexión que se corta a mitad,
 * o un service worker viejo pidiendo un archivo que ya no existe— el error
 * llega como error de render. Por eso ese caso se detecta aparte y ofrece
 * recargar, que es lo único que lo resuelve.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Un chunk que no se pudo bajar. El mensaje varía según el navegador. */
function esErrorDeCarga(e: Error): boolean {
  return /dynamically imported module|Importing a module script failed|Failed to fetch dynamically/i
    .test(`${e.message} ${e.name}`)
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Queda en la consola para poder diagnosticar sin tener el dispositivo
    // delante — que es la situación normal con esta app.
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private recargar = () => {
    // Se limpian las cachés del service worker: si el error fue un chunk que
    // ya no existe, recargar sin esto vuelve a servir el mismo HTML viejo y el
    // error se repite para siempre.
    const limpiar = async () => {
      try {
        if ('caches' in window) {
          await Promise.all((await caches.keys()).map(k => caches.delete(k)))
        }
      } catch { /* recargar igual */ }
      window.location.reload()
    }
    void limpiar()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const deCarga = esErrorDeCarga(error)

    return (
      <div className="min-h-screen bg-swu-bg flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-swu-surface border border-swu-border rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-swu-amber flex-shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="text-sm font-bold text-swu-text">
                {deCarga ? 'No se pudo cargar esta pantalla' : 'Algo se rompió en esta pantalla'}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-swu-muted">
                {deCarga
                  ? 'Suele pasar cuando quedó una versión vieja de la app guardada. Recargar la actualiza.'
                  : 'El resto de la app sigue funcionando. Si vuelve a pasar, contámelo con el detalle de abajo.'}
              </p>
            </div>
          </div>

          <button
            onClick={this.recargar}
            className="w-full min-h-11 rounded-xl bg-swu-accent text-xs font-bold text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent focus-visible:ring-offset-2 focus-visible:ring-offset-swu-bg flex items-center justify-center gap-1.5"
          >
            <RefreshCw size={14} aria-hidden /> Recargar la app
          </button>

          {/* El detalle va plegado: no asusta, pero está a un toque cuando
              alguien tiene que reportar el problema. */}
          <details className="text-[10px] text-swu-muted">
            <summary className="cursor-pointer select-none">Detalle técnico</summary>
            <pre className="mt-1.5 whitespace-pre-wrap break-words font-mono text-[9px] leading-relaxed text-swu-muted/80">
              {error.name}: {error.message}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}

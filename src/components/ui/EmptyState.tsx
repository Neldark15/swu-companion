/**
 * EmptyState — pantalla vacía que dice qué pasó y qué hacer.
 *
 * La app tenía estados vacíos repetidos a mano, algunos sin acción: "No se
 * encontraron cartas" y nada más. Un vacío sin salida se lee como un error.
 */

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  hint?: string
  /** La acción para salir del vacío. Sin esto, el usuario queda encerrado. */
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, hint, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`text-center py-10 px-4 ${className}`}>
      {icon && <div className="mx-auto mb-3 text-swu-muted/40 w-fit" aria-hidden>{icon}</div>}
      <p className="text-sm font-semibold text-swu-text">{title}</p>
      {hint && <p className="text-xs text-swu-muted mt-1 max-w-xs mx-auto leading-relaxed">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

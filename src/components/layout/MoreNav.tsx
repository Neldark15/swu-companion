import { useNavigate } from 'react-router-dom'
import { InsigniaSobres } from '../ui/InsigniaSobres'
import { AnuncioIcon, EmpireIcon, HelmetIcon } from '../SWIcons'
import { useAuth } from '../../hooks/useAuth'
import { GRUPOS_NAVEGACION, type ModuloNavegacion } from './gruposNavegacion'

/** El mismo mapa de módulos de Inicio y escritorio, adaptado al teléfono. */
export function MoreNav() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const tile = (item: ModuloNavegacion) => (
    <button
      key={item.to}
      onClick={() => navigate(item.to)}
      className="relative flex flex-col items-start gap-1.5 p-3 rounded-xl bg-swu-bg border border-swu-border
                 text-left min-h-20 active:scale-[0.98] transition-transform
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
    >
      {item.to === '/sobres' && (
        <InsigniaSobres className="absolute right-2 top-2" />
      )}
      <item.icon size={20} className="text-swu-muted" />
      <span className="text-xs font-semibold text-swu-text leading-tight">{item.label}</span>
      <span className="text-[10px] text-swu-muted leading-tight">{item.sub}</span>
    </button>
  )

  return (
    <div className="lg:hidden space-y-4">
      {GRUPOS_NAVEGACION.map(group => (
        <section key={group.title}>
          <h3 className="text-[10px] font-mono tracking-[0.2em] uppercase text-swu-muted/60 mb-2 px-1">
            {group.title}
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {group.items.map(tile)}
          </div>
        </section>
      ))}

      {isAdmin && (
        <section>
          <h3 className="text-[10px] font-mono tracking-[0.2em] uppercase text-swu-amber/70 mb-2 px-1">
            Cuartel General
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {tile({ to: '/estudio', label: 'Transmisión', sub: 'Centro de mando', icon: HelmetIcon })}
            {tile({ to: '/admin', label: 'Admin', sub: 'Panel de control', icon: EmpireIcon })}
            {tile({ to: '/admin/announcements', label: 'Anuncios', sub: 'Comunicaciones', icon: AnuncioIcon })}
          </div>
        </section>
      )}
    </div>
  )
}

import { useLocation, useNavigate } from 'react-router-dom'
import { InsigniaSobres } from '../ui/InsigniaSobres'
import { AnuncioIcon, BaseIcon, EmpireIcon, HelmetIcon } from '../SWIcons'
import { GRUPOS_NAVEGACION } from './gruposNavegacion'
import { NotificationBell } from '../ui/NotificationBell'
import { useAuth } from '../../hooks/useAuth'
import type { ComponentType, ReactNode } from 'react'

type IconComp = ComponentType<{ size?: number; className?: string; strokeWidth?: number }>

/**
 * El rótulo de una familia del menú, PEGADO ARRIBA mientras se recorre.
 *
 * Con 31 entradas en una sola columna, la pregunta que se hace cualquiera a
 * mitad del scroll es «¿de qué grupo es esto?». El rótulo pegajoso la responde
 * sin ocupar sitio. Lleva su propio fondo porque si no, las entradas se leen a
 * través de él al pasar por debajo.
 */
function Rotulo({ children, tono = 'muted' }: { children: ReactNode; tono?: 'muted' | 'amber' }) {
  return (
    <div className="sticky top-0 z-10 -mx-3 mt-5 mb-2 bg-swu-surface px-6 pt-2 pb-1.5 first:mt-0">
      <span
        className={`font-mono text-[9px] uppercase tracking-[0.25em] ${
          tono === 'amber' ? 'text-swu-amber/70' : 'text-swu-muted/60'
        }`}
      >
        {children}
      </span>
    </div>
  )
}

type NavItem =
  | { id: string; label: string; sub: string; icon: IconComp; img?: undefined }
  | { id: string; label: string; sub: string; img: string; icon?: undefined }

const mainNav: NavItem[] = [
  { id: '/', label: 'Inicio', sub: 'Centro de mando', icon: BaseIcon },
  { id: '/profile', label: 'Mi Perfil', sub: 'Holocrón', img: '/holocron-icon.png' },
]

export function SideNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    /* El id puede traer query («/explore?tab=market»): se compara solo la RUTA.
       `pathname` nunca incluye el query, así que sin este corte la entrada del
       Mercado jamás se marcaría activa — y una barra que no marca dónde estás
       es una barra que miente por omisión. */
    return location.pathname.startsWith(path.split('?')[0])
  }

  const renderItem = (item: NavItem) => {
    const active = isActive(item.id)
    return (
      <button
        key={item.id}
        onClick={() => navigate(item.id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group ${
          active
            ? 'bg-swu-accent/15 text-swu-accent-texto border border-swu-accent/30'
            : 'text-swu-muted hover:bg-swu-surface-hover hover:text-swu-text border border-transparent'
        }`}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          active ? 'bg-swu-accent/20' : 'bg-swu-surface group-hover:bg-swu-surface-hover'
        }`}>
          {item.img ? (
            <img
              src={item.img}
              alt={item.label}
              className={`w-5 h-5 object-contain transition-opacity ${active ? 'opacity-100 brightness-125' : 'opacity-60 group-hover:opacity-80'}`}
            />
          ) : item.icon ? (
            <item.icon size={18} />
          ) : null}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold truncate ${active ? 'text-swu-accent-texto' : ''}`}>{item.label}</div>
          <div className="text-[10px] text-swu-muted font-mono tracking-wider truncate">{item.sub}</div>
        </div>
        {/* La insignia solo en Sobredosis: es el único módulo que acumula algo
            que se pierde de vista. Ponerla en más sitios la volvería decoración. */}
        {item.id === '/sobres' && <InsigniaSobres className="flex-shrink-0" />}
        {active && <div className="w-1 h-6 rounded-full bg-swu-accent flex-shrink-0" />}
      </button>
    )
  }

  return (
    /* ALTO DEFINIDO, no `min-h-screen`.
     *
     * Estuvo en `fixed top-0` + `min-h-screen`, o sea SIN alto: la barra crecía
     * con su contenido, y por eso el `flex-1 overflow-y-auto` del `<nav>` nunca
     * se veía obligado a encoger y no llegaba a scrollear jamás. Medido en una
     * ventana de 820 px: el aside medía 2.175 y `nav.scrollHeight === clientHeight`.
     * Como es `fixed`, esos 1.355 px que colgaban por debajo no se podían
     * alcanzar de ninguna forma —el documento no scrollea— así que de 31
     * entradas se llegaba a once. Un admin, que tiene tres más, perdía el panel.
     *
     * Es el MISMO gotcha que el `min-h-0` de AppLayout, con otra cara: allá
     * faltaba dejar encoger, acá falta decir hasta dónde. */
    <aside className="hidden lg:flex flex-col w-64 xl:w-72 bg-swu-surface shadow-[4px_0_10px_#111118] h-[100dvh] fixed left-0 top-0 z-40">
      {/* Logo + Notification Bell */}
      <div className="px-5 py-5 flex items-center gap-3 border-b border-swu-border">
        <img src="/swu-logo-title.png" alt="SWU" className="w-10 h-12 object-contain" />
        <div className="flex-1">
          <h1 className="text-base font-extrabold text-swu-amber tracking-tight leading-tight">
            HOLOCRON SWU
          </h1>
          <p className="text-[9px] tracking-[0.2em] uppercase text-swu-muted font-mono">
            Centro de Mando
          </p>
        </div>
        <NotificationBell />
      </div>

      {/* Main Navigation.
          `min-h-0` es lo que deja que este hijo se encoja por debajo de su
          contenido; sin él, `overflow-y-auto` es decorativo. */}
      <nav className="flex-1 min-h-0 px-3 py-4 space-y-1 overflow-y-auto barra-fina">
        <Rotulo>Principal</Rotulo>
        {mainNav.map(renderItem)}

        {GRUPOS_NAVEGACION.map(grupo => (
          <div key={grupo.id}>
            <Rotulo>{grupo.title}</Rotulo>
            {grupo.items.map(item => renderItem({ ...item, id: item.to }))}
          </div>
        ))}

        {/* Admin-only quick utility (lives in Sistemas section but only visible to admins) */}
        {isAdmin && (
          <button
            onClick={() => navigate('/admin/announcements')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group ${
              location.pathname === '/admin/announcements'
                ? 'bg-swu-accent/15 text-swu-accent-texto border border-swu-accent/30'
                : 'text-swu-muted hover:bg-swu-surface-hover hover:text-swu-text border border-transparent'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              location.pathname === '/admin/announcements' ? 'bg-swu-accent/20' : 'bg-swu-surface group-hover:bg-swu-surface-hover'
            }`}>
              <AnuncioIcon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold truncate ${location.pathname === '/admin/announcements' ? 'text-swu-accent-texto' : ''}`}>Anuncios</div>
              <div className="text-[10px] text-swu-muted font-mono tracking-wider truncate">Centro de comunicaciones</div>
            </div>
          </button>
        )}

        {isAdmin && (
          <>
            <Rotulo tono="amber">Cuartel General</Rotulo>
            <button
              onClick={() => navigate('/estudio')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group mb-1 ${
                location.pathname.startsWith('/estudio')
                  ? 'bg-swu-accent/15 text-swu-accent-texto border border-swu-accent/30'
                  : 'text-swu-muted hover:bg-swu-surface-hover hover:text-swu-text border border-transparent'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                location.pathname.startsWith('/estudio') ? 'bg-swu-accent/20' : 'bg-swu-surface group-hover:bg-swu-surface-hover'
              }`}>
                <HelmetIcon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold truncate ${location.pathname.startsWith('/estudio') ? 'text-swu-accent-texto' : ''}`}>Transmisión</div>
                <div className="text-[10px] text-swu-muted font-mono tracking-wider truncate">Centro de mando en vivo</div>
              </div>
            </button>
            <button
              onClick={() => navigate('/admin')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group ${
                location.pathname.startsWith('/admin') && location.pathname !== '/admin/announcements'
                  ? 'bg-swu-amber/15 text-swu-amber border border-swu-amber/30'
                  : 'text-swu-muted hover:bg-swu-surface-hover hover:text-swu-text border border-transparent'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                location.pathname.startsWith('/admin') && location.pathname !== '/admin/announcements' ? 'bg-swu-amber/20' : 'bg-swu-surface group-hover:bg-swu-surface-hover'
              }`}>
                <EmpireIcon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold truncate ${location.pathname.startsWith('/admin') && location.pathname !== '/admin/announcements' ? 'text-swu-amber' : ''}`}>Admin</div>
                <div className="text-[10px] text-swu-muted font-mono tracking-wider truncate">Panel de control</div>
              </div>
            </button>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-swu-border">
        <p className="text-[9px] text-swu-muted/40 font-mono tracking-widest text-center">
          SWU COMPANION v1.0
        </p>
      </div>
    </aside>
  )
}

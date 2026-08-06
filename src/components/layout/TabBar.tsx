import { useLocation, useNavigate } from 'react-router-dom'
import { Hexagon, type LucideIcon } from 'lucide-react'
import { CargoIcon, BountyIcon, HolonetIcon } from '../SWIcons'
import { useUIStore } from '../../hooks/useUIStore'
import type { ComponentType } from 'react'

/**
 * TabBar — navegación principal en móvil.
 *
 * Dos cosas que arregla:
 *
 * 1. Este componente existía pero NUNCA se montaba: en móvil no había
 *    navegación principal de ningún tipo. Se llegaba a todo desde los mosaicos
 *    de la Base o por el menú de ajustes.
 *
 * 2. Los cinco destinos son los de la colección, no los del juego:
 *    Inicio · Explorar · Binder · Mercado · Perfil. Lo demás (Duelo, Torneo,
 *    Holocrón, Circuito, Mazos, Misiones, Comunidad, Consejo, Galaxia,
 *    Espionaje, Utilidades) vive agrupado dentro de Perfil, y en escritorio
 *    sigue entero en el sidebar.
 */

type IconComp = ComponentType<{ size?: number; className?: string; strokeWidth?: number }>

type TabDef =
  | { id: string; label: string; icon: LucideIcon | IconComp; img?: undefined }
  | { id: string; label: string; img: string; icon?: undefined }

const tabs: TabDef[] = [
  { id: '/', label: 'Inicio', icon: Hexagon },
  { id: '/cards', label: 'Explorar', icon: HolonetIcon },
  { id: '/collection', label: 'Binder', icon: CargoIcon },
  { id: '/explore', label: 'Mercado', icon: BountyIcon },
  { id: '/profile', label: 'Perfil', img: '/holocron-icon.png' },
]

export function TabBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const hideTabBar = useUIStore((s) => s.hideTabBar)

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  // Pantallas que YA tienen su propia barra de acciones fija abajo. La TabBar
  // es `z-50` con fondo opaco, así que se les montaba encima y se comía los
  // clics: en el lobby de evento, "Abandonar Evento" quedaba intocable.
  // Verificado con grep: el lobby es la única pantalla con `fixed bottom-0`
  // propia (EventLobbyPage.tsx:365). El tracker se oculta por pantalla completa.
  const OWN_BOTTOM_BAR = ['/play/tracker/', '/events/lobby/']
  if (OWN_BOTTOM_BAR.some(p => location.pathname.includes(p))) return null
  if (hideTabBar) return null

  return (
    <nav
      aria-label="Navegación principal"
      /* Ya NO es `fixed`: es el último hijo del caparazón, que tiene alto
         fijo y no se desplaza. Estando fija, en el teléfono se movía con la
         barra del navegador al aparecer y desaparecer. En flujo normal, no
         puede moverse.
         Sin `backdrop-blur` tampoco: el desenfoque solo hacía falta porque el
         contenido pasaba POR DEBAJO. Ahora no pasa nada por detrás, y era una
         capa que se repintaba en cada desplazamiento. */
      className="flex-shrink-0 z-50 bg-swu-surface
                 border-t border-swu-border shadow-[0_-4px_10px_#111118] pb-safe lg:hidden"
    >
      <div className="max-w-lg mx-auto flex justify-around items-stretch">
        {tabs.map((tab) => {
          const active = isActive(tab.id)
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={`
                flex-1 flex flex-col items-center justify-center gap-0.5 min-h-14 px-1 py-1.5
                transition-colors relative
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-swu-accent
                ${active ? 'text-swu-accent' : 'text-swu-muted'}
              `}
            >
              {/* Indicador arriba: no depende solo del color para marcar el activo */}
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-swu-accent" aria-hidden />
              )}
              {tab.img ? (
                <img
                  src={tab.img}
                  alt=""
                  aria-hidden
                  className={`w-[22px] h-[22px] object-contain transition-opacity ${
                    active ? 'opacity-100 brightness-125' : 'opacity-50'
                  }`}
                />
              ) : tab.icon ? (
                <tab.icon size={22} strokeWidth={active ? 2.5 : 2} />
              ) : null}
              <span className={`text-[10px] leading-none ${active ? 'font-bold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

import { useLocation, useNavigate } from 'react-router-dom'
import { InsigniaSobres } from '../ui/InsigniaSobres'
import { type LucideIcon } from 'lucide-react'
import { CargoIcon, BountyIcon, HolonetIcon, BaseIcon } from '../SWIcons'
import { useT } from '../../services/i18n'
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
  { id: '/', label: 'Inicio', icon: BaseIcon },
  { id: '/cards', label: 'Explorar', icon: HolonetIcon },
  { id: '/collection', label: 'Binder', icon: CargoIcon },
  { id: '/explore', label: 'Mercado', icon: BountyIcon },
  { id: '/profile', label: 'Perfil', img: '/holocron-icon.png' },
]

const TAB_EN: Record<string, string> = {
  'Inicio': 'Home', 'Explorar': 'Explore', 'Binder': 'Binder', 'Mercado': 'Market', 'Perfil': 'Profile',
}

export function TabBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const hideTabBar = useUIStore((s) => s.hideTabBar)
  const t = useT()

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
                ${active ? 'text-swu-accent-texto' : 'text-swu-muted'}
              `}
            >
              {/* Indicador arriba: no depende solo del color para marcar el activo */}
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-swu-accent" aria-hidden />
              )}
              {/* Un PUNTO en Perfil, no una cifra.
                  Sobredosis vive dentro de Perfil → Más, así que sin esto la
                  insignia queda a dos toques de distancia: existiría y no se
                  vería, que es exactamente el problema que vino a arreglar.
                  Va sin número porque acá no se puede decir de qué es; el
                  número está donde se puede leer, un nivel más adentro. */}
              {/* El punto se ancla al ÍCONO, no al botón.
                  Colgado del botón —que ocupa todo el ancho de la pestaña— el
                  punto se iba a la esquina superior derecha de la celda y se
                  leía como una mancha suelta en el borde de la pantalla, no
                  como una insignia de Perfil. */}
              <span className="relative inline-flex">
                {tab.id === '/profile' && <InsigniaSobres forma="punto" />}
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
              </span>
              <span className={`text-[10px] leading-none ${active ? 'font-bold' : 'font-medium'}`}>
                {t(tab.label, TAB_EN[tab.label] ?? tab.label)}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

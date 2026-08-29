/**
 * CentroLayout — la puerta del Centro de Temporada.
 *
 * ── Por qué no alcanza con `isAdmin` ──────────────────────────────────
 *
 * Hoy hay CUATRO admins. El Centro se pidió para UNO mientras se prueba,
 * así que la regla no puede ser el rol: es una asignación explícita en
 * `centro_curadores`, igual que `stream_operadores` («Ser admin NO
 * alcanza»). Comprobado contra la base: Rodorigo, que es admin, da
 * `es_curador() = false`, no ve las temporadas, no puede escribirlas y no
 * puede darse acceso.
 *
 * ── Y por qué la puerta de verdad está en Postgres ────────────────────
 *
 * Esta pantalla es una CORTINA, no una cerradura: `isAdmin` y el rol viven
 * en localStorage y se pueden editar a mano. Lo que de verdad cierra son
 * las policies de `temporadas_competitivas` / `temporada_fechas` y el
 * guardia dentro de `temporada_tabla()`. Si alguna vez alguien llega a
 * pintar esta pantalla, la va a ver vacía y no va a poder escribir nada.
 *
 * ── Tres estados, no dos ──────────────────────────────────────────────
 *
 * `curador` es `true | false | null`, y `null` —«no se pudo averiguar»—
 * **no se trata como permiso**. Hay pantallas en esta app que ante un error
 * de red dan el beneficio de la duda; acá eso sería exactamente lo
 * prohibido. Se ofrece reintentar.
 *
 * ── Va montado FUERA de AppLayout ─────────────────────────────────────
 *
 * Igual que `/admin`. Así se salta la puerta de instalación, el Header, la
 * TabBar y el SideNav **por estructura** y no por una lista de excepciones
 * que alguien tenga que acordarse de mantener. Y no hay entrada de menú en
 * ningún lado: se entra tecleando la dirección.
 */

import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, RefreshCw } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { soyCurador } from '../../services/centroTemporada'
import { MandoTrophyIcon, BeskarIcon, DatapadIcon } from '../../components/SWIcons'

const NAV = [
  { to: '/temporada', label: 'Temporadas', icon: BeskarIcon, end: true },
  { to: '/temporada/torneos', label: 'Torneos', icon: MandoTrophyIcon },
  { to: '/temporada/ayuda', label: 'Cómo se usa', icon: DatapadIcon },
]

function Centrado({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-swu-bg flex items-center justify-center p-6">
      <div className="text-center space-y-3 max-w-sm">{children}</div>
    </div>
  )
}

export function CentroLayout() {
  const navigate = useNavigate()
  const { currentProfile, initAuth, authListo } = useAuth()
  const [curador, setCurador] = useState<boolean | null>(null)
  const [consultando, setConsultando] = useState(true)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    initAuth()
  }, [initAuth])

  /* La consulta vive DENTRO del efecto, con bandera de vida: llamar desde el
   * cuerpo a algo que escribe estado dispara renders en cascada, y la bandera
   * evita responder sobre una pantalla que ya se cerró. `intento` es lo que
   * sube el botón de reintentar. */
  useEffect(() => {
    // Sin sesión no hay a quién preguntarle: la RPC devolvería false y se
    // vería como «no tenés acceso» en vez de «iniciá sesión».
    if (!authListo || !currentProfile) return
    let vivo = true
    void (async () => {
      const r = await soyCurador()
      if (!vivo) return
      setCurador(r)
      setConsultando(false)
    })()
    return () => { vivo = false }
  }, [authListo, currentProfile, intento])

  // Solo se expulsa cuando YA SE SABE que no. `null` no es `false`.
  useEffect(() => {
    if (curador === false) navigate('/', { replace: true })
  }, [curador, navigate])

  if (!authListo) {
    return <Centrado><p className="text-sm text-swu-muted animate-pulse">Cargando…</p></Centrado>
  }

  if (!currentProfile) {
    return (
      <Centrado>
        <ShieldCheck size={32} className="mx-auto text-swu-muted" />
        <p className="text-swu-text font-semibold">Iniciá sesión para entrar al Centro</p>
        <button
          onClick={() => navigate('/profile')}
          className="px-4 py-2 rounded-lg bg-swu-accent text-white text-sm font-semibold min-h-[44px]"
        >
          Iniciar sesión
        </button>
      </Centrado>
    )
  }

  if (consultando) {
    return <Centrado><p className="text-sm text-swu-muted animate-pulse">Comprobando acceso…</p></Centrado>
  }

  if (curador === null) {
    return (
      <Centrado>
        <ShieldCheck size={32} className="mx-auto text-swu-amber" />
        <p className="text-swu-text font-semibold">No se pudo comprobar el acceso</p>
        <p className="text-xs text-swu-muted">
          Puede ser la conexión. No se entra sin comprobar.
        </p>
        <button
          onClick={() => { setConsultando(true); setIntento(n => n + 1) }}
          className="mx-auto flex items-center gap-2 px-4 py-2 rounded-lg border border-swu-border
                     text-sm font-semibold text-swu-text min-h-[44px]"
        >
          <RefreshCw size={14} /> Reintentar
        </button>
      </Centrado>
    )
  }

  if (!curador) return null // el efecto ya está redirigiendo

  return (
      /* ALTO DEFINIDO Y SCROLL PROPIO.
       *
       * `index.css` pone `html, body { overflow: hidden }` para que el
       * caparazón de la app maneje su propio desplazamiento —así la barra del
       * navegador móvil no mueve lo que está anclado abajo—. Pero esta
       * pantalla vive FUERA de ese caparazón, y con el documento bloqueado un
       * `min-h-screen` que crece hacia abajo queda **inalcanzable**: no hay
       * nada que scrollee.
       *
       * Reportado por Nel sobre crear un torneo: «no puedo bajar para
       * seleccionar todas las opciones». Es la tercera vez que aparece esta
       * misma forma —el menú lateral (§4n) fue la anterior— y siempre es lo
       * mismo: algo que TIENE que desplazarse sin nadie que lo desplace.
       *
       * Toda pantalla fuera de `AppLayout` tiene que traer su propio scroll.
       */
    <div className="h-[100dvh] overflow-hidden bg-swu-bg text-swu-text flex">
      <aside className="hidden md:flex flex-col w-56 bg-black/30 border-r border-swu-border/40 h-full">
        <div className="px-4 py-5 border-b border-swu-border/40">
          <div className="flex items-center gap-2">
            <BeskarIcon size={15} className="text-swu-amber" />
            <span className="text-[10px] tracking-[0.3em] uppercase text-swu-muted font-mono">
              Centro
            </span>
          </div>
          <h1 className="mt-1 text-base font-bold text-swu-text">Temporada</h1>
        </div>

        <button
          onClick={() => navigate('/')}
          className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-swu-muted
                     hover:text-swu-text hover:bg-swu-surface/40 transition-colors min-h-[44px]"
        >
          <ArrowLeft size={14} />
          <span>Volver a la app</span>
        </button>

        <nav className="flex-1 min-h-0 overflow-y-auto barra-fina px-3 py-4 space-y-0.5">
          {NAV.map(i => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors min-h-[44px] ${
                  isActive
                    ? 'bg-swu-amber/15 text-swu-amber'
                    : 'text-swu-muted hover:text-swu-text hover:bg-swu-surface/40'
                }`
              }
            >
              <i.icon size={16} />
              <span>{i.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-swu-border/40">
          <p className="text-[10px] text-swu-muted truncate">{currentProfile.name}</p>
          <p className="text-[9px] text-swu-amber/70 font-mono mt-0.5">CURADOR</p>
        </div>
      </aside>

      {/* Barra de móvil */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-black/40 backdrop-blur border-b border-swu-border/40">
        <div className="px-3 py-2.5 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs text-swu-muted min-h-[44px]"
          >
            <ArrowLeft size={14} />
            <span>App</span>
          </button>
          <div className="flex items-center gap-1.5">
            <BeskarIcon size={14} className="text-swu-amber" />
            <span className="text-xs font-bold text-swu-text">Temporada</span>
          </div>
          <div className="w-12" />
        </div>
        <nav className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-none">
          {NAV.map(i => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] whitespace-nowrap transition-colors ${
                  isActive ? 'bg-swu-amber/15 text-swu-amber' : 'text-swu-muted hover:text-swu-text'
                }`
              }
            >
              <i.icon size={12} />
              <span>{i.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <main className="flex-1 min-w-0 min-h-0 overflow-y-auto overscroll-contain barra-fina
                       pt-24 md:pt-0 px-4 md:px-6 py-6">
        <Outlet />
      </main>
    </div>
  )
}

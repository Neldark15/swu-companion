import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Orbit } from 'lucide-react'
import { PlanetaEscena } from './PlanetaEscena'
import { rasgosDe, nombrePorDefecto } from './semilla'
import { getGalaxia, type PlanetaJugador } from '../../services/galaxiaService'
import { useAuth } from '../../hooks/useAuth'

/**
 * Modo planeta: el mundo de un jugador, a pantalla completa.
 *
 * ── Ruta y no superposición ──────────────────────────────────────────
 *
 * `/planeta/:userId` cuelga del mismo layout que el resto, así que al entrar
 * React Router DESMONTA la Galaxia y su limpieza corre sola —incluido el
 * `forceContextLoss()`—. Si esto fuera un overlay encima de `/galaxia`,
 * quedarían dos contextos WebGL vivos y la Galaxia seguiría dibujando detrás:
 * su pausa mira `isIntersecting`, que mide intersección con el viewport y NO
 * oclusión, así que un lienzo totalmente tapado sigue gastando cuadros.
 *
 * ── La pantalla completa es CSS ──────────────────────────────────────
 *
 * `fixed inset-0` por encima de la cabecera y la barra, y no la Fullscreen API:
 * en iPhone no existe sobre elementos, y en la PWA instalada (`standalone`) no
 * hay cromo del navegador que esconder. Además el botón atrás del teléfono
 * sigue funcionando, que con la Fullscreen API se vuelve confuso.
 */
export function PlanetaPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { supabaseUser } = useAuth()

  const [planeta, setPlaneta] = useState<PlanetaJugador | null>(null)
  const [cargando, setCargando] = useState(true)
  const [sinWebGL, setSinWebGL] = useState(false)

  /**
   * Los rasgos salen del id, y se AFINAN cuando llegan los ajustes del dueño.
   *
   * El primer render no espera a la red: el mundo ya se dibuja con lo que da la
   * semilla. Cuando llega el perfil —familia elegida, mares, cráteres, acento—
   * se reconstruye una sola vez con lo suyo. Es un retrabajo de una malla, y a
   * cambio nadie mira una pantalla vacía mientras viaja la consulta.
   */
  const rasgos = useMemo(
    () => rasgosDe(userId ?? '', planeta?.ajustesPlaneta ?? undefined),
    [userId, planeta?.ajustesPlaneta],
  )

  useEffect(() => {
    if (!userId) return
    let vivo = true
    void (async () => {
      const g = await getGalaxia(supabaseUser?.id)
      if (!vivo) return
      setPlaneta(g.planetas.find(p => p.id === userId) ?? null)
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [userId, supabaseUser?.id])

  // Mientras esta pantalla vive, el documento no se desplaza: en móvil un
  // arrastre sobre el lienzo arrastraba la página entera por debajo.
  useEffect(() => {
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previo }
  }, [])

  if (!userId) {
    navigate('/galaxia', { replace: true })
    return null
  }

  const nombreMundo = planeta?.nombrePlaneta || nombrePorDefecto(userId)
  const esMio = !!supabaseUser && supabaseUser.id === userId

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#03040a]">
      {sinWebGL ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center">
          <div className="space-y-2">
            <Orbit size={32} className="mx-auto text-swu-muted" />
            <p className="text-sm text-swu-text">Este navegador no puede dibujar en 3D.</p>
            <button onClick={() => navigate('/galaxia')} className="text-xs text-swu-cyan underline">
              Volver a la galaxia
            </button>
          </div>
        </div>
      ) : (
        <PlanetaEscena rasgos={rasgos} onSinWebGL={() => setSinWebGL(true)} className="flex-1" />
      )}

      {/* Todo lo de arriba flota sobre el lienzo. `pointer-events-none` en el
          contenedor y `auto` en lo que se toca: si no, la barra entera se come
          los arrastres que tendrían que girar el planeta. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
        <button
          onClick={() => navigate(-1)}
          className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/15
                     bg-black/55 px-3 py-2 text-xs font-semibold text-white backdrop-blur"
        >
          <ArrowLeft size={14} /> Volver
        </button>

        <div className="pointer-events-none rounded-2xl border border-white/10 bg-black/55 px-3 py-2
                        text-right backdrop-blur">
          <p className="text-sm font-bold leading-tight text-white">{nombreMundo}</p>
          <p className="text-[11px] leading-tight text-white/60">
            {cargando ? 'cargando…' : planeta ? `de ${planeta.nombre}` : 'mundo sin registrar'}
            {esMio && <span className="ml-1 text-swu-cyan">· tuyo</span>}
          </p>
        </div>
      </div>

      {/* Pista de uso, solo la primera vez que se toca la pantalla. Un rótulo
          fijo tapando el planeta sería peor que no tenerlo. */}
      <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-[11px] text-white/45">
        Arrastrá para girar · pellizcá para acercarte
      </p>
    </div>
  )
}

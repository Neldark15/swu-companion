/**
 * El torneo en el que estás inscrito, arriba de todo.
 *
 * ── Por qué acá y no en la franja de abajo ───────────────────────────
 *
 * «Próximos eventos» es una lista para curiosear: lo que hay, por si te
 * interesa. Pero cuando ya te inscribiste deja de ser una opción y pasa a ser
 * un compromiso — hay una hora, un lugar y una mesa esperándote—, y estaba al
 * fondo de la pantalla, después de los módulos y del marcador.
 *
 * El día del torneo eso es lo único que la persona abre la app a mirar. Va
 * pegado a la acción principal.
 *
 * ── Se dibuja solo si estás inscrito ─────────────────────────────────
 *
 * Sin inscripción no aparece nada: ni un recuadro vacío ni un «no tenés
 * torneos». Que no haya torneo esta semana es lo normal, no una carencia que
 * haya que anunciar. Y por eso tampoco hay esqueleto mientras carga — un
 * hueco que casi siempre termina en nada hace parpadear el Inicio en cada
 * entrada.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronRight, MapPin } from 'lucide-react'
import { HudPanel, HudCorners } from '../../components/Hud'
import { miTorneoEnCurso, getLogosPorFormato, logoDe, type OfficialEvent } from '../../services/events'
import { fechaYHora, esHoySV, esMananaSV } from '../../services/horaSV'
import { useAuth } from '../../hooks/useAuth'
import { LogoTorneo } from '../torneos/LogoTorneo'

/** «HOY» / «MAÑANA» por DÍA de El Salvador, no por horas de diferencia. */
function etiquetaDia(iso: string | null): string | null {
  if (!iso) return null
  if (esHoySV(iso)) return 'HOY'
  if (esMananaSV(iso)) return 'MAÑANA'
  return null
}

export function MiTorneo() {
  const navigate = useNavigate()
  const { supabaseUser } = useAuth()
  const [torneo, setTorneo] = useState<OfficialEvent | null>(null)
  const [logo, setLogo] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    void (async () => {
      // Sin sesión no hay torneo propio que buscar. El `null` se resuelve en
      // el render de abajo y no escribiendo estado en seco desde el efecto,
      // que encadena un render antes de que React pinte.
      const t = supabaseUser ? await miTorneoEnCurso(supabaseUser.id) : null
      if (!vivo) return
      setTorneo(t)
      if (t) setLogo(logoDe(t, await getLogosPorFormato()))
    })()
    return () => { vivo = false }
  }, [supabaseUser])

  if (!supabaseUser || !torneo) return null

  const dia = etiquetaDia(torneo.date)
  const enCurso = torneo.status === 'active'

  return (
    <div className="px-4 pt-3">
      <button
        /* Al LOBBY y no al archivo: es la pantalla donde se ve quién llegó, la
           rifa de mesas y —una vez sorteadas— en cuál te tocó. */
        onClick={() => navigate(`/events/lobby/${torneo.code}`)}
        className="w-full text-left active:scale-[0.99] transition-transform"
      >
        <HudPanel tone="amber" glow fill="bg-swu-amber/[0.06]">
          <div className="relative flex items-center gap-3 p-3">
            <HudCorners tone="amber" />

            {logo
              ? <LogoTorneo src={logo} lado={44} />
              : <div className="h-11 w-11 shrink-0 rounded-xl bg-swu-amber/15" />}

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.2em] text-swu-amber/80">
                {enCurso ? 'Tu torneo · en curso' : 'Estás inscrito'}
                {enCurso && (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-swu-green" />
                )}
              </p>
              <p className="truncate text-[14px] font-extrabold leading-tight text-white">
                {torneo.name}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-swu-muted">
                {torneo.date && (
                  <span className="flex items-center gap-1">
                    <CalendarDays size={11} />
                    {/* «HOY» reemplaza a la fecha, no la acompaña: leer
                        «HOY · 5 sept» obliga a comprobar que son lo mismo. */}
                    {dia ?? fechaYHora(torneo.date)}
                    {dia && <span className="font-bold text-swu-amber">{fechaYHora(torneo.date).split(' ').pop()}</span>}
                  </span>
                )}
                {torneo.location && (
                  <span className="flex items-center gap-1"><MapPin size={11} />{torneo.location}</span>
                )}
              </p>
            </div>

            <ChevronRight size={16} className="shrink-0 text-swu-amber" aria-hidden />
          </div>
        </HudPanel>
      </button>
    </div>
  )
}

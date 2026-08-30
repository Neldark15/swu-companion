/**
 * ProximosEventos — lo que se juega pronto, en la primera pantalla.
 *
 * Un torneo que nadie sabe que existe no se llena. Los eventos vivían solo en
 * /events, a dos toques de distancia dentro de Perfil en el teléfono: para
 * enterarte tenías que ir a buscar. Acá aparecen sin buscarlos.
 *
 * ── Qué se muestra y hasta cuándo ─────────────────────────────────────
 *
 * Los `open` y `active` cuya fecha no pasó, del más cercano al más lejano, y
 * dejan de verse **al día siguiente** de jugarse (el corte vive en
 * `getUpcomingOfficialEvents`). Un evento que arrancó hace dos horas SIGUE en
 * el Inicio: es el que más interesa mirar.
 *
 * Si no hay ninguno, no se dibuja NADA — ni un recuadro vacío ni un «no hay
 * eventos». Que no haya torneo esta semana es lo normal en una comunidad de
 * dieciséis personas, no una carencia que haya que anunciar.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, MapPin, Users, ChevronRight } from 'lucide-react'
import { HudPanel, HudCorners, HexIcon } from '../../components/Hud'
import { getUpcomingOfficialEvents, type OfficialEvent } from '../../services/events'
import { fechaYHora, esHoySV, esMananaSV } from '../../services/horaSV'

/**
 * «Hoy» / «Mañana» cuando corresponde.
 *
 * Se compara por DÍA del calendario, no por horas de diferencia: un evento a
 * las 9 de la mañana de mañana está a menos de 24 h, y decir «hoy» sería
 * mentir.
 *
 * Y el día es el de El Salvador. Antes las dos fechas se llevaban a medianoche
 * con `setHours(0,0,0,0)`, que es la medianoche **del dispositivo**: con el
 * teléfono en Tokio el torneo de esta noche decía «MAÑANA».
 */
function etiquetaDia(iso: string): string | null {
  if (esHoySV(iso)) return 'HOY'
  if (esMananaSV(iso)) return 'MAÑANA'
  return null
}

export function ProximosEventos() {
  const navigate = useNavigate()
  const [eventos, setEventos] = useState<OfficialEvent[] | null>(null)

  useEffect(() => {
    let vivo = true
    getUpcomingOfficialEvents(3)
      .then(e => { if (vivo) setEventos(e) })
      .catch(() => { if (vivo) setEventos([]) })
    return () => { vivo = false }
  }, [])

  // Mientras carga tampoco se dibuja nada: un esqueleto que casi siempre
  // termina en vacío hace parpadear la pantalla de inicio en cada entrada.
  if (!eventos || eventos.length === 0) return null

  return (
    <section className="px-4 pt-6 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-swu-amber/40" />
        <span className="text-[9px] text-swu-amber/70 font-mono tracking-[0.35em]">PRÓXIMOS EVENTOS</span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-swu-amber/40" />
      </div>

      <div className="space-y-2.5">
        {eventos.map(ev => {
          const hoy = ev.date ? etiquetaDia(ev.date) : null
          return (
            <button
              key={ev.id}
              onClick={() => navigate('/torneos?t=proximos')}
              className="w-full text-left active:scale-[0.99] transition-transform"
            >
              <HudPanel tone="amber" glow>
                <div className="relative flex items-center gap-3 p-3">
                  <HudCorners tone="amber" />
                  <HexIcon tone="amber" size={38}>
                    <CalendarDays size={17} aria-hidden />
                  </HexIcon>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] font-bold text-white truncate">{ev.name}</p>
                      {/* «HOY» en verde porque es una oportunidad abierta, no
                          una urgencia: el rótulo va con texto, nunca solo color. */}
                      {hoy && (
                        <span className={`flex-shrink-0 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          hoy === 'HOY'
                            ? 'bg-swu-green/20 text-swu-green'
                            : 'bg-swu-cyan/20 text-swu-cyan'
                        }`}>
                          {hoy}
                        </span>
                      )}
                      {ev.status === 'active' && (
                        <span className="flex-shrink-0 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-swu-amber/20 text-swu-amber">
                          EN CURSO
                        </span>
                      )}
                    </div>

                    {ev.date && (
                      <p className="text-[11px] font-mono text-swu-amber truncate">{fechaYHora(ev.date)}</p>
                    )}

                    <div className="flex items-center gap-2.5 text-[10px] text-swu-muted mt-0.5 min-w-0">
                      {ev.location && (
                        <span className="flex items-center gap-1 min-w-0">
                          <MapPin size={10} className="flex-shrink-0" aria-hidden />
                          <span className="truncate">{ev.location}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <Users size={10} aria-hidden />
                        {/* «—» y no 0: `undefined` es «no se pudo contar». Ver
                            `registered_count` en events.ts. */}
                        <span className="font-mono">
                          {ev.registered_count ?? '—'}/{ev.max_players}
                        </span>
                      </span>
                    </div>
                  </div>

                  <ChevronRight size={14} className="text-swu-muted flex-shrink-0" aria-hidden />
                </div>
              </HudPanel>
            </button>
          )
        })}
      </div>
    </section>
  )
}

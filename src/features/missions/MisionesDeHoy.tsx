/**
 * MisionesDeHoy — la franja de Inicio con las cuatro del día.
 *
 * ── Por qué existe ───────────────────────────────────────────────────
 *
 * Fuera de `/misiones` no había NI UN sitio en la app donde se viera el
 * progreso del día: la casilla de Inicio era un enlace pelado sin insignia, y
 * los contadores de misiones completadas y de racha se guardaban en la base sin
 * que ninguna pantalla los pintara.
 *
 * Eso cierra el círculo del arreglo: las misiones ahora se acreditan solas, y
 * un premio que se paga solo pero que nadie ve tampoco existe. Acá se ve que
 * hay cuatro, cuántas van y qué son, sin entrar a ningún lado.
 *
 * ── Compacta a propósito ─────────────────────────────────────────────
 *
 * Inicio acaba de bajar de 1.146 a 452 px de módulos plegando las categorías.
 * Meterle una lista de cuatro tarjetas devolvería la mitad de eso. Es UNA fila
 * de 56 px: el emoji de cada misión, encendido o apagado, y la cuenta.
 *
 * ── Y desaparece cuando ya está ──────────────────────────────────────
 *
 * Con las cuatro hechas la franja se va: un cartel que dice «4/4» todos los
 * días es ruido, y lo que quedaba por hacer era justamente su único motivo.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { getUserMissions, type UserMission } from '../../services/missionService'

interface Props {
  /** Sin sesión no hay misiones que mostrar. */
  userId: string | null | undefined
}

export function MisionesDeHoy({ userId }: Props) {
  const navigate = useNavigate()
  const [diarias, setDiarias] = useState<UserMission[]>([])

  useEffect(() => {
    if (!userId) return
    let vivo = true
    void (async () => {
      const { daily } = await getUserMissions(userId)
      if (vivo) setDiarias(daily)
    })()
    return () => { vivo = false }
  }, [userId])

  if (!userId || diarias.length === 0) return null

  const hechas = diarias.filter(m => m.completed).length
  if (hechas === diarias.length) return null

  return (
    <button
      onClick={() => navigate('/misiones')}
      className="mx-4 mb-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-xl border
                 border-swu-amber/30 bg-swu-amber/5 px-3 py-2.5 text-left
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-black text-swu-text">Misiones de hoy</span>
        {/* Se nombra la primera que falta, no las cuatro: un renglón con cuatro
            títulos no se lee, y lo único accionable es la que sigue. */}
        <span className="block truncate text-[11px] text-swu-muted">
          {diarias.find(m => !m.completed)?.template.description ?? ''}
        </span>
      </span>

      <span className="flex flex-shrink-0 items-center gap-1" aria-hidden>
        {diarias.map(m => (
          <span
            key={m.missionId}
            title={`${m.template.name} · ${m.progress}/${m.template.objectiveValue}`}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px]
                        transition-opacity ${
              m.completed ? 'bg-swu-amber/25' : 'bg-swu-bg opacity-40 grayscale'
            }`}
          >
            {m.template.icon}
          </span>
        ))}
      </span>

      <span className="flex flex-shrink-0 items-center gap-1">
        <span className="font-mono text-[11px] font-bold tabular-nums text-swu-amber">
          {hechas}/{diarias.length}
        </span>
        <ChevronRight size={15} className="text-swu-muted" />
      </span>
    </button>
  )
}

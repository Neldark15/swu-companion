/**
 * TorneosLista — todos los torneos, para entrar a operar cualquiera.
 *
 * El Centro se organiza por temporada, pero un torneo puede existir sin
 * estar enlazado a ninguna —los históricos, o uno suelto— y aun así hacer
 * falta exportarle la tabla o redactarle el artículo. Esta pantalla es la
 * puerta de atrás a esos.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { HudPanel } from '../../components/Hud'
import { MandoTrophyIcon } from '../../components/SWIcons'
import { getOfficialEvents, type OfficialEvent } from '../../services/events'

const ESTADO: Record<string, { texto: string; clase: string }> = {
  open: { texto: 'inscripción', clase: 'text-swu-cyan' },
  active: { texto: 'en curso', clase: 'text-swu-green' },
  finished: { texto: 'cerrado', clase: 'text-swu-amber' },
  cancelled: { texto: 'cancelado', clase: 'text-swu-red-texto' },
}

export function TorneosLista() {
  const [eventos, setEventos] = useState<OfficialEvent[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    void (async () => {
      const e = await getOfficialEvents()
      if (vivo) { setEventos(e); setCargando(false) }
    })()
    return () => { vivo = false }
  }, [])

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-swu-amber">
          Centro de temporada
        </p>
        <h1 className="text-2xl font-black text-swu-text">Torneos</h1>
        <p className="text-sm text-swu-muted">
          Todos los torneos, estén o no en una temporada.
        </p>
      </header>

      {cargando ? (
        <p className="text-sm text-swu-muted animate-pulse">Cargando…</p>
      ) : eventos.length === 0 ? (
        <p className="text-sm text-swu-muted">No hay torneos todavía.</p>
      ) : (
        <div className="space-y-2">
          {eventos.map(e => {
            const est = ESTADO[e.status]
            return (
              <Link key={e.id} to={`/temporada/torneo/${e.code}`} className="block">
                <HudPanel compact className="transition-colors hover:bg-swu-surface-hover">
                  <div className="flex items-center gap-3 p-3.5">
                    <MandoTrophyIcon size={19} className="flex-shrink-0 text-swu-amber" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-swu-text">{e.name}</p>
                      <p className="font-mono text-[11px] text-swu-muted">
                        {e.code} · <span className={est?.clase}>{est?.texto}</span>
                        {' · '}
                        {/* `undefined` es «no se sabe», NO cero: pintar 0 acá
                            anunciaría vacío un torneo que puede tener 12. */}
                        {e.registered_count === undefined ? '—' : e.registered_count} inscritos
                      </p>
                    </div>
                    <ChevronRight size={16} className="flex-shrink-0 text-swu-muted" />
                  </div>
                </HudPanel>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

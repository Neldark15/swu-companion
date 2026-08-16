/**
 * TORNEOS — el archivo de los torneos que ya se jugaron.
 *
 * Antes esto no existía: un torneo terminado se caía de toda la app. Acá se
 * listan del más nuevo al más viejo, con su campeón a la vista, y cada uno
 * abre a su clasificación y sus partidas completas.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Trophy, Users, CalendarDays } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { fechaConDiaLarga } from '../../services/horaSV'
import { listarTorneos, type TorneoResumen } from '../../services/torneosHistoricos'

export function TorneosPage() {
  const navigate = useNavigate()
  const [torneos, setTorneos] = useState<TorneoResumen[] | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vivo = true
    void (async () => {
      const r = await listarTorneos()
      if (!vivo) return
      if (r.ok) { setTorneos(r.datos); setFallo(null) }
      else { setTorneos([]); setFallo(r.mensaje) }
    })()
    return () => { vivo = false }
  }, [recarga])

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 p-4 pb-10">
      <header className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} aria-label="Volver" className="rounded-lg p-1 text-swu-muted hover:text-swu-text">
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black tracking-tight text-swu-text">Torneos</h2>
          <p className="text-[10px] font-mono uppercase tracking-wider text-swu-muted">
            El archivo de la comunidad
          </p>
        </div>
      </header>

      {torneos === null && (
        <div className="space-y-2">
          {[0, 1].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-swu-surface" />)}
        </div>
      )}

      {torneos !== null && fallo && (
        <EmptyState
          icon={<Trophy size={26} />}
          title="No se pudieron cargar los torneos"
          hint={fallo}
          action={<Button variant="secondary" onClick={() => setRecarga(n => n + 1)}>Reintentar</Button>}
        />
      )}

      {torneos !== null && !fallo && torneos.length === 0 && (
        <EmptyState
          icon={<Trophy size={26} />}
          title="Todavía no hay torneos en el archivo"
          hint="Cuando se cargue un torneo, queda acá con su clasificación y todas sus partidas."
        />
      )}

      {torneos !== null && !fallo && torneos.length > 0 && (
        <ul className="space-y-2.5">
          {torneos.map(t => (
            <li key={t.id}>
              <Link
                to={`/torneos/${t.code}`}
                className="block rounded-2xl border border-swu-border bg-swu-surface p-4 transition-colors hover:border-swu-accent/40"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-swu-amber/15 text-swu-amber">
                    <Trophy size={19} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-black tracking-tight text-swu-text">{t.nombre}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-swu-muted">
                      <span className="inline-flex items-center gap-1"><CalendarDays size={12} />{fechaConDiaLarga(t.fecha)}</span>
                      <span className="inline-flex items-center gap-1"><Users size={12} />{t.jugadores} jugadores</span>
                    </div>
                    {t.campeon && (
                      <p className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-swu-amber/10 px-2 py-0.5 text-[11px] font-bold text-swu-amber">
                        <Trophy size={11} /> {t.campeon}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={18} className="mt-2 shrink-0 text-swu-muted" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

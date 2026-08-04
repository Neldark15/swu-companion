/**
 * SedesPage — dónde se juega.
 *
 * El directorio de sedes de la comunidad. Pública: quien busca dónde jugar
 * todavía no tiene por qué tener cuenta.
 */

import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Store, MapPin, ChevronRight } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { HudPanel } from '../../components/Hud'
import { HUD_TEXTO, type HudTone } from '../../components/hudTones'
import { listarSedes, type Sede } from '../../services/venuesService'

export function SedesPage() {
  const navigate = useNavigate()
  const [sedes, setSedes] = useState<Sede[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    void listarSedes().then(s => {
      if (!vivo) return
      setSedes(s)
      setCargando(false)
    })
    return () => { vivo = false }
  }, [])

  return (
    <div className="min-h-screen bg-swu-bg pb-8">
      <div className="sticky top-0 z-40 bg-swu-bg/95 backdrop-blur border-b border-swu-border">
        <div className="max-w-lg lg:max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-swu-muted" aria-label="Atrás">
            <ArrowLeft size={20} aria-hidden />
          </button>
          <h1 className="text-lg font-bold text-swu-text flex-1">Dónde se juega</h1>
        </div>
      </div>

      <div className="max-w-lg lg:max-w-3xl mx-auto px-4 py-4 space-y-3">
        {cargando && <p className="text-center text-xs text-swu-muted py-10">Cargando sedes…</p>}

        {!cargando && sedes.length === 0 && (
          <EmptyState
            icon={<Store size={28} aria-hidden />}
            title="Todavía no hay sedes"
            hint="Las tiendas que organizan torneos van a aparecer acá."
          />
        )}

        {sedes.map(s => {
          const tono = (s.accent ?? 'cyan') as HudTone
          return (
            <Link key={s.id} to={`/sede/${s.id}`} className="block active:scale-[0.99] transition-transform">
              <HudPanel tone={tono} glow>
                <div className="flex items-center gap-3 p-2.5">
                  <div className="w-14 h-14 clip-hud-sm p-px flex-shrink-0 bg-swu-border">
                    <div className="clip-hud-sm w-full h-full bg-swu-bg overflow-hidden flex items-center justify-center">
                      {s.logo_url
                        ? <img src={s.logo_url} alt="" className="w-full h-full object-cover" />
                        : <Store size={20} className={HUD_TEXTO[tono]} aria-hidden />}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate leading-tight">{s.name}</p>
                    <p className="text-[11px] text-swu-muted flex items-center gap-1 truncate">
                      <MapPin size={10} className="flex-shrink-0" aria-hidden />
                      {s.city ?? s.address}
                    </p>
                    {s.schedule && (
                      <p className={`text-[10px] ${HUD_TEXTO[tono]} truncate mt-0.5`}>
                        {s.schedule.split('\n')[0]}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-swu-muted flex-shrink-0" aria-hidden />
                </div>
              </HudPanel>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

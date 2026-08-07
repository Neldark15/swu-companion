/**
 * SedePage — la sede vista por la comunidad.
 *
 * Pública y sin sesión: el objetivo de registrar una sede es que la gente sepa
 * dónde se juega, así que pedir cuenta para verla iría en contra.
 *
 * Los datos que muestra son de un COMERCIO —tienda, dirección, teléfono—, no
 * de una persona. Por eso se pueden enseñar; no hay nada acá del perfil de
 * quien la administra.
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, MapPin, Phone, Clock, Instagram, MessageCircle, ExternalLink,
  CalendarDays, Store,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Chip } from '../../components/ui/Chip'
import { EmptyState } from '../../components/ui/EmptyState'
import { HudPanel } from '../../components/Hud'
import { HUD_TEXTO, type HudTone } from '../../components/hudTones'
import { SedeCabecera } from './SedeCabecera'
import { getSede, eventosDeSede, type Sede, type EventoDeSede } from '../../services/venuesService'
import { fechaCorta } from '../../services/horaSV'

/**
 * La fecha del torneo, en hora de El Salvador.
 *
 * Salía de `getDate()/getMonth()/getFullYear()`, que son los del dispositivo:
 * un torneo de las 7 de la noche se anunciaba con la fecha del día siguiente
 * en cualquier teléfono al este de nosotros.
 */
function fecha(iso: string | null): string {
  return fechaCorta(iso) || 'Sin fecha'
}

export function SedePage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [sede, setSede] = useState<Sede | null>(null)
  const [eventos, setEventos] = useState<EventoDeSede[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    void (async () => {
      const s = await getSede(id)
      if (!vivo) return
      setSede(s)
      setCargando(false)
      if (s) {
        const e = await eventosDeSede(s.id)
        if (vivo) setEventos(e)
      }
    })()
    return () => { vivo = false }
  }, [id])

  const tono = (sede?.accent ?? 'cyan') as HudTone

  return (
    <div className="min-h-screen bg-swu-bg pb-8">
      <div className="sticky top-0 z-40 bg-swu-bg/95 backdrop-blur border-b border-swu-border">
        <div className="max-w-lg lg:max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-swu-muted" aria-label="Atrás">
            <ArrowLeft size={20} aria-hidden />
          </button>
          <h1 className="text-lg font-bold text-swu-text flex-1 truncate">
            {sede?.name ?? 'Sede'}
          </h1>
        </div>
      </div>

      <div className="max-w-lg lg:max-w-3xl mx-auto px-4 py-4 space-y-4">
        {cargando && <p className="text-center text-xs text-swu-muted py-10">Cargando…</p>}

        {!cargando && !sede && (
          <EmptyState
            icon={<Store size={28} aria-hidden />}
            title="Esta sede no existe"
            hint="Puede que se haya dado de baja."
            action={<Button size="sm" variant="secondary" onClick={() => navigate('/sedes')}>Ver todas</Button>}
          />
        )}

        {sede && (
          <>
            <SedeCabecera sede={sede} />

            {sede.description && (
              <p className="text-xs text-swu-text leading-relaxed whitespace-pre-line">
                {sede.description}
              </p>
            )}

            {/* ── Cómo llegar y contactar ── */}
            <HudPanel tone={tono}>
              <div className="p-3 space-y-2.5">
                <div className="flex items-start gap-2">
                  <MapPin size={14} className={`${HUD_TEXTO[tono]} flex-shrink-0 mt-0.5`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-swu-text leading-snug">{sede.address}</p>
                    {sede.city && <p className="text-[11px] text-swu-muted">{sede.city}</p>}
                  </div>
                </div>

                {sede.schedule && (
                  <div className="flex items-start gap-2">
                    <Clock size={14} className={`${HUD_TEXTO[tono]} flex-shrink-0 mt-0.5`} aria-hidden />
                    <p className="text-xs text-swu-text whitespace-pre-line leading-snug">{sede.schedule}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {sede.phone && (
                    <a href={`tel:${sede.phone.replace(/[\s()-]/g, '')}`}
                      className="flex items-center gap-1.5 text-[11px] text-swu-text border border-swu-border rounded-lg px-2.5 py-1.5">
                      <Phone size={12} aria-hidden /> {sede.phone}
                    </a>
                  )}
                  {sede.whatsapp && (
                    <a href={`https://wa.me/${sede.whatsapp.replace(/\D/g, '')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] text-swu-green border border-swu-green/40 rounded-lg px-2.5 py-1.5">
                      <MessageCircle size={12} aria-hidden /> WhatsApp
                    </a>
                  )}
                  {sede.instagram && (
                    <a href={`https://instagram.com/${sede.instagram}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] text-swu-coral border border-swu-coral/40 rounded-lg px-2.5 py-1.5">
                      <Instagram size={12} aria-hidden /> @{sede.instagram}
                    </a>
                  )}
                  {sede.maps_url && (
                    <a href={sede.maps_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] text-swu-cyan border border-swu-cyan/40 rounded-lg px-2.5 py-1.5">
                      <MapPin size={12} aria-hidden /> Cómo llegar <ExternalLink size={10} aria-hidden />
                    </a>
                  )}
                </div>
              </div>
            </HudPanel>

            {/* ── Torneos de esta sede ── */}
            <section>
              <h2 className="text-[10px] font-mono tracking-wider uppercase text-swu-muted/60 mb-2">
                Torneos acá {eventos.length > 0 && `· ${eventos.length}`}
              </h2>
              {eventos.length === 0 ? (
                <p className="text-[11px] text-swu-muted">
                  Todavía no hay torneos ligados a esta sede.
                </p>
              ) : (
                <div className="space-y-1">
                  {eventos.map(e => (
                    <div key={e.id}
                      className="flex items-center gap-2.5 bg-swu-surface rounded-lg border border-swu-border px-2.5 py-2">
                      <CalendarDays size={14} className="text-swu-muted flex-shrink-0" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-swu-text truncate leading-tight">{e.name}</p>
                        <p className="text-[10px] text-swu-muted font-mono">
                          {fecha(e.date)} · {e.format}
                        </p>
                      </div>
                      <Chip tone={e.status === 'finished' ? 'neutral' : 'green'}>
                        {e.status === 'finished' ? 'Terminado' : e.status === 'active' ? 'En curso' : 'Abierto'}
                      </Chip>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Link to="/sedes" className="block text-center text-[11px] text-swu-cyan py-2">
              Ver todas las sedes
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

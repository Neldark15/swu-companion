/**
 * NewsPage — noticias y agenda de eventos oficiales.
 *
 * La tabla `news`, su servicio y el editor en /news/manage existían desde
 * hace tiempo, pero NO había ninguna pantalla donde leerlas: se publicaba a
 * un lugar al que nadie podía entrar. Esta es esa pantalla.
 *
 * Dos pestañas, porque son dos preguntas distintas:
 * - Agenda: "¿cuándo es el Galactic?" → ordenada por fecha de evento, con
 *   cuenta regresiva y separando lo que viene de lo que ya pasó.
 * - Anuncios: "¿qué hay de nuevo?" → ordenado por publicación, fijados arriba.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CalendarDays, Megaphone, MapPin, ExternalLink,
  Pin, Settings, Trophy,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Chip } from '../../components/ui/Chip'
import { EmptyState } from '../../components/ui/EmptyState'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useAuth } from '../../hooks/useAuth'
import {
  getOfficialEvents, getAnnouncements,
  EVENT_TYPE_LABELS, type NewsItem, type EventType,
} from '../../services/news'

/** Los de mayor jerarquía se ven distinto: un Galactic no es un Weekly. */
const EVENT_TONE: Record<EventType, 'amber' | 'cyan' | 'green' | 'neutral'> = {
  galactic: 'amber',
  planetary: 'amber',
  sector: 'cyan',
  regional: 'cyan',
  showdown: 'green',
  prerelease: 'green',
  weekly: 'neutral',
  other: 'neutral',
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-SV', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  })
}

/** Cuántos días faltan. Es el dato que uno busca de un vistazo. */
function daysUntil(iso: string): number {
  const target = new Date(iso); target.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

function countdownLabel(iso: string): string {
  const d = daysUntil(iso)
  if (d === 0) return 'Hoy'
  if (d === 1) return 'Mañana'
  if (d > 1) return `En ${d} días`
  if (d === -1) return 'Ayer'
  return `Hace ${Math.abs(d)} días`
}

function EventCard({ item, past }: { item: NewsItem; past?: boolean }) {
  const type = (item.event_type ?? 'other') as EventType
  return (
    <article className={`rounded-xl border p-3 space-y-2 ${
      past ? 'bg-swu-surface/50 border-swu-border/50 opacity-70' : 'bg-swu-surface border-swu-border'
    }`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <Chip tone={EVENT_TONE[type]} active>{EVENT_TYPE_LABELS[type]}</Chip>
            {item.event_format && <Chip tone="neutral" active>{item.event_format}</Chip>}
          </div>
          <h3 className="text-sm font-bold text-swu-text leading-tight">{item.title}</h3>
        </div>
        {!past && item.event_date && (
          <span className={`text-[10px] font-bold font-mono px-2 py-1 rounded-lg flex-shrink-0 ${
            daysUntil(item.event_date) <= 7
              ? 'bg-swu-amber/15 text-swu-amber'
              : 'bg-swu-bg text-swu-muted'
          }`}>
            {countdownLabel(item.event_date)}
          </span>
        )}
      </div>

      {item.summary && (
        <p className="text-[11px] text-swu-muted leading-relaxed">{item.summary}</p>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-swu-muted">
        {item.event_date && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={11} aria-hidden /> {formatEventDate(item.event_date)}
          </span>
        )}
        {item.event_location && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={11} aria-hidden /> {item.event_location}
          </span>
        )}
      </div>

      {!past && (item.registration_url || item.url) && (
        <div className="flex gap-2 pt-0.5">
          {item.registration_url && (
            <Button
              size="xs"
              variant="primary"
              onClick={() => window.open(item.registration_url!, '_blank', 'noopener,noreferrer')}
            >
              Inscribirme <ExternalLink size={11} aria-hidden />
            </Button>
          )}
          {item.url && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => window.open(item.url!, '_blank', 'noopener,noreferrer')}
            >
              Más info <ExternalLink size={11} aria-hidden />
            </Button>
          )}
        </div>
      )}
    </article>
  )
}

function AnnouncementCard({ item }: { item: NewsItem }) {
  return (
    <article className="bg-swu-surface rounded-xl border border-swu-border p-3 space-y-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        {item.pinned && (
          <span className="text-swu-amber" title="Fijada"><Pin size={12} aria-hidden /></span>
        )}
        {item.tag && <Chip tone="neutral" active>{item.tag}</Chip>}
        <span className="text-[10px] text-swu-muted font-mono">
          {new Date(item.created_at).toLocaleDateString('es-SV', { day: 'numeric', month: 'short' })}
        </span>
      </div>
      <h3 className="text-sm font-bold text-swu-text leading-tight">{item.title}</h3>
      {item.summary && (
        <p className="text-[11px] text-swu-muted leading-relaxed">{item.summary}</p>
      )}
      {item.url && (
        <Button
          size="xs"
          variant="ghost"
          onClick={() => window.open(item.url!, '_blank', 'noopener,noreferrer')}
        >
          Leer más <ExternalLink size={11} aria-hidden />
        </Button>
      )}
    </article>
  )
}

export function NewsPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState<'agenda' | 'anuncios'>('agenda')
  const [upcoming, setUpcoming] = useState<NewsItem[]>([])
  const [past, setPast] = useState<NewsItem[]>([])
  const [announcements, setAnnouncements] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([getOfficialEvents(), getAnnouncements()])
      .then(([ev, an]) => {
        if (cancelled) return
        setUpcoming(ev.upcoming)
        setPast(ev.past)
        setAnnouncements(an)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-screen bg-swu-bg">
      <div className="sticky top-0 z-40 bg-swu-bg/95 backdrop-blur border-b border-swu-border">
        <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-swu-muted" aria-label="Atrás">
            <ArrowLeft size={20} aria-hidden />
          </button>
          <h1 className="text-lg font-bold text-swu-text flex-1">Noticias</h1>
          {isAdmin && (
            <Button size="xs" variant="ghost" onClick={() => navigate('/news/manage')}>
              <Settings size={13} aria-hidden /> Gestionar
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 py-4 space-y-4">
        <SegmentedControl
          label="Qué mostrar"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'agenda', label: 'Agenda', icon: <CalendarDays size={13} aria-hidden />, count: upcoming.length },
            { value: 'anuncios', label: 'Anuncios', icon: <Megaphone size={13} aria-hidden />, count: announcements.length },
          ]}
        />

        {loading && (
          <div className="space-y-2" aria-busy>
            {[0, 1, 2].map(i => (
              <div key={i} className="h-24 rounded-xl bg-swu-surface border border-swu-border animate-pulse" />
            ))}
          </div>
        )}

        {!loading && tab === 'agenda' && (
          upcoming.length === 0 && past.length === 0 ? (
            <EmptyState
              icon={<Trophy size={28} aria-hidden />}
              title="Todavía no hay eventos cargados"
              hint={isAdmin
                ? 'Cargá el Galactic, los Qualifiers y los Store Showdown desde Gestionar para que el grupo los vea acá.'
                : 'Cuando se anuncien los próximos torneos oficiales, van a aparecer acá con fecha y lugar.'}
              action={isAdmin
                ? <Button size="sm" variant="primary" onClick={() => navigate('/news/manage')}>Cargar evento</Button>
                : undefined}
            />
          ) : (
            <div className="space-y-4">
              {upcoming.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-[10px] font-mono tracking-[0.2em] uppercase text-swu-muted/60 px-1">
                    Próximos
                  </h2>
                  {upcoming.map(e => <EventCard key={e.id} item={e} />)}
                </section>
              )}
              {past.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-[10px] font-mono tracking-[0.2em] uppercase text-swu-muted/60 px-1">
                    Ya pasaron
                  </h2>
                  {past.map(e => <EventCard key={e.id} item={e} past />)}
                </section>
              )}
            </div>
          )
        )}

        {!loading && tab === 'anuncios' && (
          announcements.length === 0 ? (
            <EmptyState
              icon={<Megaphone size={28} aria-hidden />}
              title="Sin anuncios por ahora"
              hint={isAdmin
                ? 'Publicá acá lo que el grupo tiene que saber: cambios de reglas, banlist, lanzamientos.'
                : 'Acá van a aparecer los avisos del grupo.'}
            />
          ) : (
            <div className="space-y-2">
              {announcements.map(a => <AnnouncementCard key={a.id} item={a} />)}
            </div>
          )
        )}
      </div>
    </div>
  )
}

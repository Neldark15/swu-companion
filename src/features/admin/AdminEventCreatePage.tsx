/**
 * AdminEventCreatePage — crear eventos oficiales desde dentro del admin panel.
 * Route: /admin/events/new
 *
 * Vive dentro de AdminLayout. Después de crear redirige al listado bulk
 * en /admin/events (o muestra el código de éxito si querés copiarlo antes).
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Calendar, MapPin, Users, Swords, Trophy, Zap,
  Loader2, CheckCircle2, Copy, Check, Share2, AlertTriangle,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { createOfficialEvent, type OfficialEvent } from '../../services/events'
import { miSede, subirImagen, type Sede } from '../../services/venuesService'
import { logAdminAction } from '../../services/adminService'
import { aISOdesdeSV, fechaCortaYHora } from '../../services/horaSV'

type ViewState = 'form' | 'creating' | 'created'

const FORMAT_OPTIONS = [
  { value: 'premier', label: 'Premier', desc: 'Formato estándar competitivo' },
  { value: 'twin_suns', label: 'Twin Suns', desc: 'Singleton, 2 líderes, 80+ cartas' },
  { value: 'trilogy', label: 'Trilogy', desc: '3 decks, sin sideboard, Bo3' },
  { value: 'sealed', label: 'Sealed', desc: 'Abrir packs y construir deck' },
  { value: 'draft', label: 'Draft', desc: 'Selección de cartas en ronda' },
]
const MATCH_OPTIONS = [
  { value: 'bo1', label: 'Bo1', desc: 'Mejor de 1' },
  { value: 'bo3', label: 'Bo3', desc: 'Mejor de 3' },
]
const PLAYER_LIMITS = [4, 8, 16, 24, 32, 48, 64]
const TOURNAMENT_TYPE_OPTIONS = [
  { value: 'swiss' as const, label: 'Suizo', desc: 'Todos juegan, ranking por puntos' },
  { value: 'elimination' as const, label: 'Eliminación', desc: 'Bracket directo, pierdes y sales' },
]

export function AdminEventCreatePage() {
  const navigate = useNavigate()
  const { supabaseUser, currentProfile } = useAuth()

  const [view, setView] = useState<ViewState>('form')
  const [created, setCreated] = useState<OfficialEvent | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)
  const [error, setError] = useState('')

  // Form fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [format, setFormat] = useState('premier')
  const [matchType, setMatchType] = useState('bo1')
  const [tournamentType, setTournamentType] = useState<'swiss' | 'elimination'>('swiss')
  const [maxPlayers, setMaxPlayers] = useState(16)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  /** La sede del organizador, si la tiene. Ligar el torneo a ella es lo que
   *  lo hace aparecer en su página pública. */
  const [sede, setSede] = useState<Sede | null>(null)
  /** El afiche del evento. Se sube ANTES de crear: si la subida falla, el
   *  torneo no nace a medias con una foto rota. */
  const [afiche, setAfiche] = useState<{ url: string; previa: string } | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [usarSede, setUsarSede] = useState(true)

  useEffect(() => {
    const uid = supabaseUser?.id
    if (!uid) return
    let vivo = true
    void miSede(uid).then(s => { if (vivo) setSede(s) })
    return () => { vivo = false }
  }, [supabaseUser?.id])

  const handleCreate = async () => {
    setError('')
    if (!name.trim()) { setError('Ingresa un nombre para el evento'); return }
    if (!supabaseUser) { setError('Sesión expirada'); return }

    // La hora que se teclea es la de la tienda donde se juega, siempre.
    //
    // Acá vivía el mismo bug que ya se cerró en CreateEventPage y que a esta
    // pantalla se le pasó: `${date}T${time}:00` va sin zona, así que Postgres
    // lo leía como UTC y el torneo quedaba guardado seis horas antes de la
    // hora anunciada. `aISOdesdeSV` interpreta lo tecleado como hora de El
    // Salvador y devuelve el instante UTC que corresponde.
    // La rama sin hora tampoco puede mandar el día pelado. `date || undefined`
    // dejaba salir un `2026-08-08` a una columna **timestamptz**, y Postgres
    // (que corre en UTC) lo lee como medianoche UTC: el mismo torneo se
    // anunciaba como el **7 de agosto a las 6:00 p. m.**, un día antes de la
    // fecha que el admin escogió. La sección se titula «Logística (opcional)» y
    // ninguno de los dos campos es obligatorio, así que llenar la fecha y
    // dejar la hora vacía es un estado alcanzable, no una hipótesis.
    //
    // `aISOdesdeSV` ya toma la hora vacía como las 00:00 de El Salvador, así
    // que un día sin hora queda anclado a SU día, que es lo que se pidió.
    const dateStr = date ? (aISOdesdeSV(date, time) ?? undefined) : undefined

    // Devuelve `null` ante una fecha imposible (un 31 de febrero). Sin este
    // corte se crearía el torneo sin fecha y en silencio.
    if (date && !dateStr) {
      setError('La fecha o la hora no son válidas')
      setView('form')
      return
    }

    const result = await createOfficialEvent({
      name: name.trim(),
      description: description.trim() || undefined,
      format,
      matchType,
      tournamentType,
      maxPlayers,
      date: dateStr,
      location: usarSede && sede ? `${sede.name} · ${sede.address}` : location.trim() || undefined,
      venueId: usarSede && sede ? sede.id : null,
      imageUrl: afiche?.url ?? null,
      organizerId: supabaseUser.id,
    })

    if (!result.ok || !result.event) {
      setError(result.error || 'Error al crear evento')
      setView('form')
      return
    }

    logAdminAction('event.create', {
      actorId: supabaseUser.id,
      actorName: currentProfile?.name ?? null,
      targetType: 'event',
      targetId: result.event.id,
      metadata: {
        name: result.event.name,
        code: result.event.code,
        format,
        matchType,
        tournamentType,
        maxPlayers,
      },
    })

    setCreated(result.event)
    setView('created')
  }

  const copyCode = () => {
    if (created?.code) {
      navigator.clipboard?.writeText(created.code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    }
  }

  const shareEvent = () => {
    if (created) {
      navigator.share?.({
        title: created.name,
        text: `¡Únete al evento ${created.name}! Código: ${created.code}`,
        url: `${window.location.origin}/events/join?code=${created.code}`,
      }).catch(() => undefined)
    }
  }

  // ── CREATED VIEW ──────────────────────────────────────
  if (view === 'created' && created) {
    return (
      <div className="space-y-5 max-w-2xl">
        <header className="flex items-center justify-between">
          <button onClick={() => navigate('/admin/events')} className="flex items-center gap-1 text-xs text-swu-muted">
            <ArrowLeft size={14} /> Volver a eventos
          </button>
          <button
            onClick={() => { setCreated(null); setView('form'); setName(''); setDescription(''); setDate(''); setTime(''); setLocation('') }}
            className="text-xs text-swu-accent-texto font-semibold"
          >
            Crear otro
          </button>
        </header>

        <div className="bg-gradient-to-br from-swu-green/15 to-swu-accent/5 rounded-2xl p-6 border border-swu-green/30 text-center space-y-4">
          <CheckCircle2 size={40} className="mx-auto text-swu-green" />
          <div>
            <h2 className="text-xl font-extrabold text-swu-text">Evento creado</h2>
            <p className="text-sm text-swu-muted mt-1">{created.name}</p>
          </div>

          <div className="bg-swu-bg rounded-xl p-4 space-y-1">
            <p className="text-[10px] text-swu-muted font-medium uppercase tracking-wider">Código del evento</p>
            <p className="text-4xl font-mono font-extrabold tracking-[0.3em] text-swu-accent-texto">
              {created.code}
            </p>
            <p className="text-[11px] text-swu-muted">Comparte este código con los jugadores</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={copyCode}
              className="flex-1 py-2.5 rounded-lg font-bold text-xs bg-swu-surface border border-swu-border flex items-center justify-center gap-1.5 active:scale-[0.98]"
            >
              {codeCopied ? <Check size={14} className="text-swu-green" /> : <Copy size={14} />}
              {codeCopied ? 'Copiado' : 'Copiar'}
            </button>
            <button
              onClick={shareEvent}
              className="flex-1 py-2.5 rounded-lg font-bold text-xs bg-swu-accent text-white flex items-center justify-center gap-1.5 active:scale-[0.98]"
            >
              <Share2 size={14} /> Compartir
            </button>
            <button
              onClick={() => navigate(`/events/dashboard/${created.code}`)}
              className="flex-1 py-2.5 rounded-lg font-bold text-xs bg-swu-amber/20 text-swu-amber flex items-center justify-center gap-1.5 active:scale-[0.98]"
            >
              <Trophy size={14} /> Abrir dashboard
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-swu-surface rounded-xl border border-swu-border p-4 space-y-1.5 text-sm">
          <Row label="Formato" value={created.format} />
          <Row label="Match" value={(created.match_type || '').toUpperCase()} />
          <Row label="Tipo de torneo" value={tournamentType === 'swiss' ? 'Suizo' : 'Eliminación'} />
          <Row label="Máx. jugadores" value={String(created.max_players)} />
          {created.date && (
            <Row label="Fecha" value={fechaCortaYHora(created.date)} />
          )}
          {created.location && <Row label="Ubicación" value={created.location} />}
        </div>
      </div>
    )
  }

  // ── FORM VIEW ─────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-2xl">
      <header>
        <button onClick={() => navigate('/admin/events')} className="flex items-center gap-1 text-xs text-swu-muted mb-2">
          <ArrowLeft size={14} /> Volver a eventos
        </button>
        <h1 className="text-2xl font-bold text-swu-text">Nuevo evento</h1>
        <p className="text-sm text-swu-muted mt-1">Crea un torneo con código único para invitar jugadores</p>
      </header>

      {/* Name + description */}
      <Section title="Información básica">
        <div className="space-y-3">
          <Field label="Nombre del evento" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="Ej: Liga Mensual Mayo 2026"
              className="w-full px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text"
            />
          </Field>
          <Field label="Descripción (opcional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Premios, reglas especiales, dress code…"
              className="w-full px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text resize-none"
            />
          </Field>
        </div>
      </Section>

      {/* Format */}
      <Section title="Formato de juego" icon={Swords}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FORMAT_OPTIONS.map(f => (
            <ChoiceCard
              key={f.value}
              active={format === f.value}
              label={f.label}
              desc={f.desc}
              onClick={() => setFormat(f.value)}
            />
          ))}
        </div>
      </Section>

      {/* Match + Type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Section title="Match" icon={Zap}>
          <div className="grid grid-cols-2 gap-2">
            {MATCH_OPTIONS.map(m => (
              <ChoiceCard
                key={m.value}
                active={matchType === m.value}
                label={m.label}
                desc={m.desc}
                onClick={() => setMatchType(m.value)}
              />
            ))}
          </div>
        </Section>

        <Section title="Estructura" icon={Trophy}>
          <div className="grid grid-cols-1 gap-2">
            {TOURNAMENT_TYPE_OPTIONS.map(t => (
              <ChoiceCard
                key={t.value}
                active={tournamentType === t.value}
                label={t.label}
                desc={t.desc}
                onClick={() => setTournamentType(t.value)}
              />
            ))}
          </div>
        </Section>
      </div>

      {/* Max players */}
      <Section title="Cupo de jugadores" icon={Users}>
        <div className="space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-swu-muted mb-1.5">Atajos rápidos</p>
            <div className="flex flex-wrap gap-1.5">
              {PLAYER_LIMITS.map(n => (
                <button
                  key={n}
                  onClick={() => setMaxPlayers(n)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-colors ${
                    maxPlayers === n
                      ? 'bg-swu-accent/15 border-swu-accent text-swu-accent-texto'
                      : 'bg-swu-bg border-swu-border text-swu-muted hover:text-swu-text'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-swu-muted font-medium">
                O ingresar número exacto (2–256)
              </label>
              <input
                type="number"
                min={2}
                max={256}
                value={maxPlayers}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  if (Number.isFinite(v)) setMaxPlayers(Math.max(2, Math.min(256, v)))
                }}
                className="w-full mt-1 px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text font-mono"
              />
            </div>
            <div className="text-right pb-1">
              <p className="text-3xl font-extrabold font-mono text-swu-accent-texto leading-none">{maxPlayers}</p>
              <p className="text-[9px] text-swu-muted uppercase tracking-wider mt-0.5">jugadores</p>
            </div>
          </div>

          {maxPlayers % 2 !== 0 && (
            <div className="bg-swu-amber/10 border border-swu-amber/30 rounded-lg p-2 text-[11px] text-swu-amber flex items-start gap-2">
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
              <span>
                Número impar: en formato Suizo, cada ronda un jugador recibirá BYE automático
                (gana 2-0 esa ronda). Es completamente válido y soportado.
              </span>
            </div>
          )}
        </div>
      </Section>

      {/* Date + location */}
      <Section title="Logística (opcional)" icon={Calendar}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text"
            />
          </Field>
          <Field label="Hora">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text"
            />
          </Field>
        </div>
        {/* El afiche. Va al mismo bucket que las sedes, en la carpeta del uid:
            es lo que la política de Storage exige para dejar escribir, y lo
            que impide pisarle la imagen a otro. */}
        <div className="rounded-2xl border border-swu-border bg-swu-surface p-4">
          <p className="mb-2 text-sm font-semibold text-swu-text">Foto del evento</p>
          {afiche ? (
            <div className="space-y-2">
              <img src={afiche.previa} alt="" className="h-32 w-full rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => setAfiche(null)}
                className="text-xs text-swu-muted underline"
              >
                Quitar
              </button>
            </div>
          ) : (
            <label className="flex h-11 cursor-pointer items-center justify-center rounded-lg border border-dashed border-swu-border text-sm text-swu-muted">
              {subiendo ? 'Subiendo…' : 'Elegir una imagen'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="hidden"
                disabled={subiendo}
                onChange={async (ev) => {
                  const f = ev.target.files?.[0]
                  // El input se limpia SIEMPRE: sin esto, elegir el mismo
                  // archivo tras un fallo no vuelve a disparar el change.
                  ev.target.value = ''
                  if (!f || !supabaseUser) return
                  setSubiendo(true)
                  setError('')
                  const r = await subirImagen(supabaseUser.id, f, 'evento')
                  setSubiendo(false)
                  if (!r.ok || !r.url) { setError(r.error ?? 'No se pudo subir la imagen'); return }
                  setAfiche({ url: r.url, previa: r.url })
                }}
              />
            </label>
          )}
          <p className="mt-2 text-[11px] leading-snug text-swu-muted">
            Opcional. Si no ponés ninguna, el calendario usa el banner de la sede.
            JPG, PNG, WebP o AVIF, hasta 3 MB.
          </p>
        </div>

        {sede && (
          <label className="flex items-start gap-2 bg-swu-bg border border-swu-border rounded-lg p-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={usarSede}
              onChange={e => setUsarSede(e.target.checked)}
              className="mt-0.5 accent-swu-cyan"
            />
            <span className="min-w-0">
              <span className="block text-[12px] font-semibold text-swu-text">
                En mi sede: {sede.name}
              </span>
              <span className="block text-[11px] text-swu-muted">
                {sede.address}. El torneo va a aparecer en la página pública de tu sede.
              </span>
            </span>
          </label>
        )}

        {!(sede && usarSede) && (
        <Field label="Ubicación" icon={MapPin}>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={120}
            placeholder="Ej: Tienda Geek Zone, San Salvador"
            className="w-full px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text"
          />
        </Field>
        )}
      </Section>

      {error && (
        <div className="bg-swu-red/10 border border-swu-red/30 rounded-lg p-3 flex items-center gap-2 text-[12px] text-swu-red-texto">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={view === 'creating' || !name.trim()}
        className="w-full py-3 rounded-xl bg-swu-accent text-white font-bold text-sm active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {view === 'creating' ? (
          <><Loader2 size={16} className="animate-spin" /> Creando…</>
        ) : (
          <>Crear evento</>
        )}
      </button>
    </div>
  )
}

// ─── Subcomponents ──────────────────────────────────────

function Section({
  title, icon: Icon, children,
}: {
  title: string
  icon?: typeof Calendar
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="text-[10px] uppercase tracking-wider text-swu-muted font-bold mb-2 flex items-center gap-1.5">
        {Icon && <Icon size={11} />}
        {title}
      </h3>
      <div className="bg-swu-surface rounded-xl border border-swu-border p-4">
        {children}
      </div>
    </section>
  )
}

function Field({
  label, required, icon: Icon, children,
}: {
  label: string
  required?: boolean
  icon?: typeof Calendar
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-swu-muted font-medium flex items-center gap-1 mb-1">
        {Icon && <Icon size={10} />}
        {label} {required && <span className="text-swu-red-texto">*</span>}
      </label>
      {children}
    </div>
  )
}

function ChoiceCard({
  active, label, desc, onClick,
}: {
  active: boolean
  label: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-3 rounded-lg border transition-colors ${
        active
          ? 'bg-swu-accent/10 border-swu-accent'
          : 'bg-swu-bg border-swu-border hover:border-swu-accent/30'
      }`}
    >
      <p className={`text-sm font-bold ${active ? 'text-swu-accent-texto' : 'text-swu-text'}`}>{label}</p>
      <p className="text-[11px] text-swu-muted mt-0.5">{desc}</p>
    </button>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-swu-muted">{label}</span>
      <span className="text-swu-text font-semibold">{value}</span>
    </div>
  )
}

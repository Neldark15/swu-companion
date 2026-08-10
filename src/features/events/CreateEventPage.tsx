import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  Crown,
  Loader2,
  CheckCircle2,
  Copy,
  Check,
  Share2,
  Calendar,
  MapPin,
  Users,
  Swords,
  Trophy,
  Zap,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { createOfficialEvent, type OfficialEvent } from '../../services/events'
import { aISOdesdeSV, fechaCortaYHora } from '../../services/horaSV'
import { leerBorrador, guardarBorrador, borrarBorrador, LLAVES_BORRADOR } from '../../services/borradores'

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

const PLAYER_LIMITS = [8, 16, 24, 32, 48, 64]

const TOURNAMENT_TYPE_OPTIONS = [
  { value: 'swiss', label: 'Suizo', desc: 'Todos juegan, ranking por puntos' },
  { value: 'elimination', label: 'Eliminación', desc: 'Bracket directo, pierdes y sales' },
]

export function CreateEventPage() {
  const navigate = useNavigate()
  const auth = useAuth()
  const [viewState, setViewState] = useState<ViewState>('form')
  const [createdEvent, setCreatedEvent] = useState<OfficialEvent | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)
  const [error, setError] = useState('')

  /* Borrador: son nueve campos y se perdían enteros si la pantalla se
     remontaba —atender un WhatsApp mientras se carga un torneo alcanzaba—.
     Se lee UNA vez, sincrónico, en los inicializadores perezosos: leerlo en un
     efecto y llamar a los `setX` sería un render encadenado y además lo rechaza
     el lint de este repo. */
  // Dentro de un `useState` y no suelto en el cuerpo: suelto se releía y
  // reparseaba localStorage en CADA render, o sea en cada tecla.
  const [b] = useState(() => leerBorrador<{
    name: string; description: string; format: string; matchType: string
    tournamentType: 'swiss' | 'elimination'; maxPlayers: number
    date: string; time: string; location: string
  }>(LLAVES_BORRADOR.evento))

  // Form state
  const [name, setName] = useState(b?.name ?? '')
  const [description, setDescription] = useState(b?.description ?? '')
  const [format, setFormat] = useState(b?.format ?? 'premier')
  const [matchType, setMatchType] = useState(b?.matchType ?? 'bo1')
  const [tournamentType, setTournamentType] = useState<'swiss' | 'elimination'>(b?.tournamentType ?? 'swiss')
  const [maxPlayers, setMaxPlayers] = useState(b?.maxPlayers ?? 32)
  const [date, setDate] = useState(b?.date ?? '')
  const [time, setTime] = useState(b?.time ?? '')
  const [location, setLocation] = useState(b?.location ?? '')

  /* Se guarda en cada tecla. Un `setItem` de nueve campos cortos no se nota, y
     evita tener que adivinar cuál es el «buen momento» para guardar. */
  useEffect(() => {
    guardarBorrador(LLAVES_BORRADOR.evento, {
      name, description, format, matchType, tournamentType, maxPlayers, date, time, location,
    })
  }, [name, description, format, matchType, tournamentType, maxPlayers, date, time, location])

  // Guard: only admins
  if (!auth.isAdmin) {
    return (
      <div className="p-4 space-y-5">
        <button onClick={() => navigate('/events')} className="flex items-center gap-1 text-sm text-swu-muted">
          <ChevronLeft size={18} /> Volver
        </button>
        <div className="bg-swu-red/10 border border-swu-red/30 rounded-2xl p-8 text-center space-y-2">
          <Crown size={40} className="mx-auto text-swu-red-texto/50" />
          <p className="text-swu-red-texto font-bold">Acceso Restringido</p>
          <p className="text-xs text-swu-muted">Solo los administradores pueden crear eventos.</p>
        </div>
      </div>
    )
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Ingrese un nombre para el evento')
      return
    }
    if (!auth.supabaseUser) {
      setError('Debe iniciar sesión')
      return
    }
    // La fecha y la hora ahora son OBLIGATORIAS. Un evento sin hora de inicio
    // no se puede anunciar: la gente necesita saber a qué hora llegar, y el
    // Inicio lo ordena por cuándo empieza.
    if (!date) {
      setError('Elegí la fecha del evento')
      return
    }
    if (!time) {
      setError('Elegí la hora de inicio')
      return
    }

    setError('')
    setViewState('creating')

    /**
     * Lo que se teclea es la hora DE LA TIENDA, no la del organizador.
     *
     * Esto ya se arregló una vez a medias. La versión original mandaba
     * `2026-08-08T15:30:00` pelado, sin zona: Postgres lo leía como UTC y
     * escribir 15:30 guardaba las 09:30 de El Salvador — seis horas de
     * corrimiento, medidas en el navegador. Se cambió a
     * `new Date(...).toISOString()`, que sí pone zona, pero la del
     * DISPOSITIVO. Medido corriendo el mismo código con el reloj en Tokio:
     * escribir 15:30 guardaba `2026-08-08T06:30:00.000Z`, que acá son las
     * 00:30 — nueve horas, y en silencio.
     *
     * `aISOdesdeSV` fija la zona en `America/El_Salvador`, así que el evento
     * se guarda igual lo teclee quien lo teclee y desde donde sea.
     */
    const dateStr = aISOdesdeSV(date, time)
    if (!dateStr) {
      setError('La fecha o la hora no son válidas')
      setViewState('form')
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
      location: location.trim() || undefined,
      organizerId: auth.supabaseUser.id,
    })

    if (!result.ok) {
      setError(result.error || 'Error al crear evento')
      setViewState('form')
      return
    }

    // El borrador se descarta acá y no antes: si `createOfficialEvent` falla,
    // quien lo escribió tiene que conservar los nueve campos.
    borrarBorrador(LLAVES_BORRADOR.evento)
    setCreatedEvent(result.event!)
    setViewState('created')
  }

  const copyCode = () => {
    if (createdEvent?.code) {
      navigator.clipboard?.writeText(createdEvent.code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    }
  }

  const shareEvent = () => {
    if (createdEvent) {
      navigator.share?.({
        title: createdEvent.name,
        text: `¡Únete al evento ${createdEvent.name}! Código: ${createdEvent.code}`,
        url: window.location.origin,
      }).catch(() => {})
    }
  }

  // ─── CREATED VIEW ──────────────────────────────────────────
  if (viewState === 'created' && createdEvent) {
    return (
      <div className="p-4 space-y-5">
        <button onClick={() => navigate('/events')} className="flex items-center gap-1 text-sm text-swu-muted">
          <ChevronLeft size={18} /> Eventos
        </button>

        <div className="bg-gradient-to-br from-swu-green/20 to-swu-accent/10 rounded-2xl p-6 border border-swu-green/30 text-center space-y-4">
          <CheckCircle2 size={48} className="mx-auto text-swu-green" />
          <div>
            <h2 className="text-xl font-extrabold text-swu-text">Evento Creado</h2>
            <p className="text-sm text-swu-muted mt-1">{createdEvent.name}</p>
          </div>

          {/* Code display */}
          <div className="bg-swu-bg rounded-xl p-4 space-y-2">
            <p className="text-xs text-swu-muted font-medium">Código del evento</p>
            <p className="text-4xl font-mono font-extrabold tracking-[0.3em] text-swu-accent-texto">
              {createdEvent.code}
            </p>
            <p className="text-xs text-swu-muted">Comparta este código con los jugadores</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={copyCode}
              className="flex-1 py-3 rounded-xl font-bold text-sm bg-swu-surface border border-swu-border flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              {codeCopied ? <Check size={16} className="text-swu-green" /> : <Copy size={16} />}
              {codeCopied ? 'Copiado' : 'Copiar'}
            </button>
            <button
              onClick={shareEvent}
              className="flex-1 py-3 rounded-xl font-bold text-sm bg-swu-accent text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <Share2 size={16} /> Compartir
            </button>
          </div>
        </div>

        {/* Event details summary */}
        <div className="bg-swu-surface rounded-xl p-4 border border-swu-border space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-swu-muted">Formato</span>
            <span className="text-swu-text font-semibold capitalize">{createdEvent.format}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-swu-muted">Match</span>
            <span className="text-swu-text font-semibold uppercase">{createdEvent.match_type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-swu-muted">Máx. Jugadores</span>
            <span className="text-swu-text font-semibold">{createdEvent.max_players}</span>
          </div>
          {createdEvent.date && (
            <div className="flex justify-between">
              <span className="text-swu-muted">Fecha</span>
              <span className="text-swu-text font-semibold">
                {fechaCortaYHora(createdEvent.date)}
              </span>
            </div>
          )}
          {createdEvent.location && (
            <div className="flex justify-between">
              <span className="text-swu-muted">Lugar</span>
              <span className="text-swu-text font-semibold">{createdEvent.location}</span>
            </div>
          )}
        </div>

        <button
          onClick={() => navigate('/events')}
          className="w-full py-3.5 rounded-xl font-bold text-base bg-swu-accent text-white active:scale-[0.98] transition-transform"
        >
          Volver a Eventos
        </button>
      </div>
    )
  }

  // ─── FORM VIEW ─────────────────────────────────────────────
  return (
    <div className="p-4 space-y-5 pb-8">
      <button onClick={() => navigate('/events')} className="flex items-center gap-1 text-sm text-swu-muted">
        <ChevronLeft size={18} /> Volver
      </button>

      <div className="flex items-center gap-2">
        <Crown size={20} className="text-swu-amber" />
        <h2 className="text-lg font-bold text-swu-text">Crear Evento</h2>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-swu-muted uppercase tracking-wider">Nombre del Evento *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Torneo SWU #1 - El Salvador"
          className="w-full bg-swu-surface border border-swu-border rounded-xl px-4 py-3 text-swu-text text-sm placeholder:text-swu-muted/50 focus:border-swu-accent focus:outline-none"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-swu-muted uppercase tracking-wider">Descripción</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detalles adicionales del evento..."
          rows={3}
          className="w-full bg-swu-surface border border-swu-border rounded-xl px-4 py-3 text-swu-text text-sm placeholder:text-swu-muted/50 focus:border-swu-accent focus:outline-none resize-none"
        />
      </div>

      {/* Format */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-swu-muted uppercase tracking-wider flex items-center gap-1">
          <Swords size={12} /> Formato
        </label>
        <div className="grid grid-cols-2 gap-2">
          {FORMAT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFormat(opt.value)}
              className={`p-3 rounded-xl border text-left transition-colors ${
                format === opt.value
                  ? 'bg-swu-accent/10 border-swu-accent text-swu-accent-texto'
                  : 'bg-swu-surface border-swu-border text-swu-text'
              }`}
            >
              <p className="text-sm font-bold">{opt.label}</p>
              <p className="text-[11px] text-swu-muted mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Match Type */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-swu-muted uppercase tracking-wider flex items-center gap-1">
          <Zap size={12} /> Tipo de Match
        </label>
        <div className="flex gap-2">
          {MATCH_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setMatchType(opt.value)}
              className={`flex-1 p-3 rounded-xl border text-center transition-colors ${
                matchType === opt.value
                  ? 'bg-swu-accent/10 border-swu-accent text-swu-accent-texto'
                  : 'bg-swu-surface border-swu-border text-swu-text'
              }`}
            >
              <p className="text-sm font-bold">{opt.label}</p>
              <p className="text-[11px] text-swu-muted">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Tournament Type */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-swu-muted uppercase tracking-wider flex items-center gap-1">
          <Trophy size={12} /> Sistema de Torneo
        </label>
        <div className="flex gap-2">
          {TOURNAMENT_TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTournamentType(opt.value as 'swiss' | 'elimination')}
              className={`flex-1 p-3 rounded-xl border text-center transition-colors ${
                tournamentType === opt.value
                  ? 'bg-swu-accent/10 border-swu-accent text-swu-accent-texto'
                  : 'bg-swu-surface border-swu-border text-swu-text'
              }`}
            >
              <p className="text-sm font-bold">{opt.label}</p>
              <p className="text-[11px] text-swu-muted">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Max Players */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-swu-muted uppercase tracking-wider flex items-center gap-1">
          <Users size={12} /> Máximo de Jugadores
        </label>
        <div className="flex gap-2 flex-wrap">
          {PLAYER_LIMITS.map(n => (
            <button
              key={n}
              onClick={() => setMaxPlayers(n)}
              className={`px-4 py-2.5 rounded-xl border font-bold text-sm transition-colors ${
                maxPlayers === n
                  ? 'bg-swu-accent/10 border-swu-accent text-swu-accent-texto'
                  : 'bg-swu-surface border-swu-border text-swu-muted'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <label className="text-[10px] text-swu-muted uppercase tracking-wider">O exacto:</label>
          <input
            type="number"
            min={2}
            max={256}
            value={maxPlayers}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              if (Number.isFinite(v)) setMaxPlayers(Math.max(2, Math.min(256, v)))
            }}
            className="w-20 px-2 py-1.5 bg-swu-surface border border-swu-border rounded-lg text-sm text-swu-text font-mono text-center"
          />
          {maxPlayers % 2 !== 0 && (
            <span className="text-[10px] text-swu-amber">⚠ Impar: 1 BYE por ronda</span>
          )}
        </div>
      </div>

      {/* Date & Time */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-swu-muted uppercase tracking-wider flex items-center gap-1">
          <Calendar size={12} /> Fecha y hora de inicio <span className="text-swu-red-texto">*</span>
        </label>
        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            aria-label="Fecha del evento"
            className="flex-1 bg-swu-surface border border-swu-border rounded-xl px-4 py-3 text-swu-text text-sm focus:border-swu-accent focus:outline-none"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            aria-label="Hora de inicio"
            className="w-28 bg-swu-surface border border-swu-border rounded-xl px-4 py-3 text-swu-text text-sm focus:border-swu-accent focus:outline-none"
          />
        </div>
        {/* Se dice para qué sirve: sin hora, el evento no se puede anunciar
            en el Inicio ni ordenar por cuándo empieza. */}
        <p className="text-[11px] text-swu-muted leading-snug">
          Con la hora puesta, el evento aparece en la pantalla de Inicio de toda
          la comunidad hasta el día que se juega.
        </p>
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-swu-muted uppercase tracking-wider flex items-center gap-1">
          <MapPin size={12} /> Lugar
        </label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Ej: Tienda El Refugio, San Salvador"
          className="w-full bg-swu-surface border border-swu-border rounded-xl px-4 py-3 text-swu-text text-sm placeholder:text-swu-muted/50 focus:border-swu-accent focus:outline-none"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-swu-red/10 border border-swu-red/30 rounded-xl p-3 text-center">
          <p className="text-sm text-swu-red-texto font-semibold">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleCreate}
        disabled={viewState === 'creating' || !name.trim()}
        className={`w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
          name.trim()
            ? 'bg-swu-amber text-black active:scale-[0.98]'
            : 'bg-swu-border text-swu-muted cursor-not-allowed'
        }`}
      >
        {viewState === 'creating' ? (
          <><Loader2 size={18} className="animate-spin" /> Creando evento...</>
        ) : (
          <><Crown size={18} /> Crear Evento</>
        )}
      </button>
    </div>
  )
}

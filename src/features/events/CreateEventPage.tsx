import { useState } from 'react'
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

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [format, setFormat] = useState('premier')
  const [matchType, setMatchType] = useState('bo1')
  const [tournamentType, setTournamentType] = useState<'swiss' | 'elimination'>('swiss')
  const [maxPlayers, setMaxPlayers] = useState(32)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')

  // Guard: only admins
  if (!auth.isAdmin) {
    return (
      <div className="p-4 space-y-5">
        <button onClick={() => navigate('/events')} className="flex items-center gap-1 text-sm text-swu-muted">
          <ChevronLeft size={18} /> Volver
        </button>
        <div className="bg-swu-red/10 border border-swu-red/30 rounded-2xl p-8 text-center space-y-2">
          <Crown size={40} className="mx-auto text-swu-red/50" />
          <p className="text-swu-red font-bold">Acceso Restringido</p>
          <p className="text-xs text-swu-muted">Solo los administradores pueden crear eventos oficiales.</p>
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

    setError('')
    setViewState('creating')

    const dateStr = date && time ? `${date}T${time}:00` : date || undefined

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
            <p className="text-4xl font-mono font-extrabold tracking-[0.3em] text-swu-accent">
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
                {new Date(createdEvent.date).toLocaleDateString('es-SV', {
                  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
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
        <h2 className="text-lg font-bold text-swu-text">Crear Evento Oficial</h2>
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
                  ? 'bg-swu-accent/10 border-swu-accent text-swu-accent'
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
                  ? 'bg-swu-accent/10 border-swu-accent text-swu-accent'
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
                  ? 'bg-swu-accent/10 border-swu-accent text-swu-accent'
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
      <div className="space-y-1.5">
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
                  ? 'bg-swu-accent/10 border-swu-accent text-swu-accent'
                  : 'bg-swu-surface border-swu-border text-swu-muted'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Date & Time */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-swu-muted uppercase tracking-wider flex items-center gap-1">
          <Calendar size={12} /> Fecha y Hora
        </label>
        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 bg-swu-surface border border-swu-border rounded-xl px-4 py-3 text-swu-text text-sm focus:border-swu-accent focus:outline-none"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-28 bg-swu-surface border border-swu-border rounded-xl px-4 py-3 text-swu-text text-sm focus:border-swu-accent focus:outline-none"
          />
        </div>
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
          <p className="text-sm text-swu-red font-semibold">{error}</p>
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
          <><Crown size={18} /> Crear Evento Oficial</>
        )}
      </button>
    </div>
  )
}

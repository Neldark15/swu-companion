import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Link2, Save, Trophy, ExternalLink, Info } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  saveMeleeTournament,
  parseMeleeUrl,
  buildMeleeUrl,
  TOURNAMENT_TAGS,
  FORMAT_LABELS,
} from '../../services/meleeService'
import type { TournamentFormat } from '../../types'
import { db } from '../../services/db'

export function MeleeAddPage() {
  const navigate = useNavigate()
  const { supabaseUser } = useAuth()
  const [params] = useSearchParams()

  // Form state
  const [meleeUrl, setMeleeUrl] = useState(params.get('url') || '')
  const [name, setName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [location, setLocation] = useState('')
  const [organizer, setOrganizer] = useState('')
  const [format, setFormat] = useState<TournamentFormat>('premier')
  const [playerCount, setPlayerCount] = useState('')
  const [standing, setStanding] = useState('')
  const [wins, setWins] = useState('')
  const [losses, setLosses] = useState('')
  const [draws, setDraws] = useState('')
  const [deckName, setDeckName] = useState('')
  const [deckLeader, setDeckLeader] = useState('')
  const [deckBase, setDeckBase] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Available decks from Dexie
  const [myDecks, setMyDecks] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    db.decks.toArray().then(decks => {
      setMyDecks(decks.map(d => ({ id: d.id, name: d.name })))
    })
  }, [])

  // Parse melee URL for validation indicator
  const parsedMeleeId = meleeUrl ? parseMeleeUrl(meleeUrl) : null
  const isValidMeleeUrl = !!parsedMeleeId

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    )
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)

    try {
      await saveMeleeTournament({
        userId: supabaseUser?.id,
        name: name.trim(),
        meleeUrl: meleeUrl.trim() || undefined,
        meleeId: parsedMeleeId || undefined,
        date,
        location: location.trim() || undefined,
        organizer: organizer.trim() || undefined,
        format,
        playerCount: playerCount ? parseInt(playerCount) : undefined,
        standing: standing ? parseInt(standing) : undefined,
        wins: parseInt(wins) || 0,
        losses: parseInt(losses) || 0,
        draws: parseInt(draws) || 0,
        deckName: deckName.trim() || undefined,
        deckLeader: deckLeader.trim() || undefined,
        deckBase: deckBase.trim() || undefined,
        notes: notes.trim() || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        recordedAt: Date.now(),
      })

      navigate('/melee', { replace: true })
    } catch (e) {
      console.error('[Melee] Save failed:', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-swu-bg pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-swu-bg/95 backdrop-blur border-b border-swu-border">
        <div className="max-w-lg lg:max-w-3xl mx-auto px-4 lg:px-6 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-swu-muted">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-swu-text">Registrar Torneo</h1>
            <p className="text-[10px] text-swu-muted font-mono tracking-wider">MELEE.GG</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              name.trim()
                ? 'bg-swu-accent text-white active:scale-95'
                : 'bg-swu-surface text-swu-muted border border-swu-border'
            }`}
          >
            <Save size={14} />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="max-w-lg lg:max-w-3xl mx-auto px-4 lg:px-6 py-4 space-y-4">
        {/* Melee Link Section */}
        <div className="bg-swu-surface rounded-xl border border-swu-amber/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-swu-amber" />
            <span className="text-sm font-bold text-swu-amber">Link de Melee.gg</span>
            <span className="text-[10px] text-swu-muted">(opcional)</span>
          </div>

          <div className="relative">
            <input
              type="url"
              value={meleeUrl}
              onChange={e => setMeleeUrl(e.target.value)}
              placeholder="https://melee.gg/Tournament/View/123456"
              className={`w-full bg-swu-bg border rounded-xl px-3 py-2.5 text-sm text-swu-text
                         placeholder:text-swu-muted focus:outline-none ${
                           meleeUrl
                             ? isValidMeleeUrl
                               ? 'border-swu-green focus:border-swu-green'
                               : 'border-red-500/50 focus:border-red-500'
                             : 'border-swu-border focus:border-swu-amber'
                         }`}
            />
            {meleeUrl && (
              <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium ${
                isValidMeleeUrl ? 'text-swu-green' : 'text-red-400'
              }`}>
                {isValidMeleeUrl ? '✓ Válido' : '✗ URL inválida'}
              </div>
            )}
          </div>

          {isValidMeleeUrl && (
            <a
              href={buildMeleeUrl(parsedMeleeId!)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-swu-amber hover:underline"
            >
              <ExternalLink size={12} /> Ver en Melee.gg (ID: {parsedMeleeId})
            </a>
          )}

          <div className="flex items-start gap-2 bg-swu-bg/50 rounded-lg p-2.5">
            <Info size={14} className="text-swu-muted flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-swu-muted leading-relaxed">
              Pegue el link del torneo desde melee.gg para vincularlo. Los datos del torneo
              (nombre, fecha, standings) se ingresan manualmente.
            </p>
          </div>
        </div>

        {/* Event Info */}
        <div className="bg-swu-surface rounded-xl border border-swu-border p-4 space-y-3">
          <div className="text-xs text-swu-muted font-mono tracking-wider mb-1">DATOS DEL EVENTO</div>

          <div>
            <label className="text-xs text-swu-muted mb-1 block">Nombre del torneo *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="ej: Store Showdown - Game Planet"
              className="w-full bg-swu-bg border border-swu-border rounded-xl px-3 py-2.5 text-sm text-swu-text
                         placeholder:text-swu-muted focus:border-swu-accent outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-swu-muted mb-1 block">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-swu-bg border border-swu-border rounded-xl px-3 py-2.5 text-sm text-swu-text
                           focus:border-swu-accent outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-swu-muted mb-1 block">Jugadores</label>
              <input
                type="number"
                value={playerCount}
                onChange={e => setPlayerCount(e.target.value)}
                placeholder="ej: 32"
                min="2"
                className="w-full bg-swu-bg border border-swu-border rounded-xl px-3 py-2.5 text-sm text-swu-text
                           placeholder:text-swu-muted focus:border-swu-accent outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-swu-muted mb-1 block">Ubicación</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="ej: San Salvador, El Salvador"
              className="w-full bg-swu-bg border border-swu-border rounded-xl px-3 py-2.5 text-sm text-swu-text
                         placeholder:text-swu-muted focus:border-swu-accent outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-swu-muted mb-1 block">Organizador</label>
            <input
              type="text"
              value={organizer}
              onChange={e => setOrganizer(e.target.value)}
              placeholder="ej: Game Planet SV"
              className="w-full bg-swu-bg border border-swu-border rounded-xl px-3 py-2.5 text-sm text-swu-text
                         placeholder:text-swu-muted focus:border-swu-accent outline-none"
            />
          </div>

          {/* Format */}
          <div>
            <label className="text-xs text-swu-muted mb-1.5 block">Formato</label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(FORMAT_LABELS) as [TournamentFormat, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFormat(key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    format === key
                      ? 'bg-swu-accent text-white'
                      : 'bg-swu-bg text-swu-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs text-swu-muted mb-1.5 block">Tipo de evento</label>
            <div className="flex flex-wrap gap-1.5">
              {TOURNAMENT_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleToggleTag(tag)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-swu-amber text-white'
                      : 'bg-swu-bg text-swu-muted'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="bg-swu-surface rounded-xl border border-swu-border p-4 space-y-3">
          <div className="text-xs text-swu-muted font-mono tracking-wider mb-1">MI RESULTADO</div>

          {/* Standing */}
          <div>
            <label className="text-xs text-swu-muted mb-1 block">
              Standing final
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={standing}
                onChange={e => setStanding(e.target.value)}
                placeholder="ej: 3"
                min="1"
                className="w-24 bg-swu-bg border border-swu-border rounded-xl px-3 py-2.5 text-sm text-swu-text
                           placeholder:text-swu-muted focus:border-swu-accent outline-none text-center"
              />
              <span className="text-sm text-swu-muted">
                {standing
                  ? `de ${playerCount || '?'} jugadores`
                  : '(posición en el torneo)'}
              </span>
            </div>
          </div>

          {/* Record */}
          <div>
            <label className="text-xs text-swu-muted mb-1.5 block">Record (W-L-D)</label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  value={wins}
                  onChange={e => setWins(e.target.value)}
                  placeholder="W"
                  min="0"
                  className="w-full bg-swu-green/10 border border-swu-green/30 rounded-xl px-3 py-2.5 text-sm
                             text-swu-green text-center placeholder:text-swu-green/40 focus:border-swu-green outline-none"
                />
                <div className="text-[9px] text-swu-muted text-center mt-0.5">Victorias</div>
              </div>
              <span className="text-swu-muted font-bold">-</span>
              <div className="flex-1">
                <input
                  type="number"
                  value={losses}
                  onChange={e => setLosses(e.target.value)}
                  placeholder="L"
                  min="0"
                  className="w-full bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5 text-sm
                             text-red-400 text-center placeholder:text-red-400/40 focus:border-red-500 outline-none"
                />
                <div className="text-[9px] text-swu-muted text-center mt-0.5">Derrotas</div>
              </div>
              <span className="text-swu-muted font-bold">-</span>
              <div className="flex-1">
                <input
                  type="number"
                  value={draws}
                  onChange={e => setDraws(e.target.value)}
                  placeholder="D"
                  min="0"
                  className="w-full bg-swu-surface border border-swu-border rounded-xl px-3 py-2.5 text-sm
                             text-swu-muted text-center placeholder:text-swu-muted/40 focus:border-swu-accent outline-none"
                />
                <div className="text-[9px] text-swu-muted text-center mt-0.5">Empates</div>
              </div>
            </div>
          </div>

          {/* Quick record buttons */}
          <div className="flex flex-wrap gap-1.5">
            {['4-0', '3-1', '3-0', '2-1', '2-2', '1-2', '1-3', '0-3', '0-4'].map(r => {
              const [w, l] = r.split('-')
              return (
                <button
                  key={r}
                  onClick={() => { setWins(w); setLosses(l); setDraws('0') }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                    wins === w && losses === l
                      ? 'bg-swu-accent text-white'
                      : 'bg-swu-bg text-swu-muted'
                  }`}
                >
                  {r}
                </button>
              )
            })}
          </div>
        </div>

        {/* Deck Info */}
        <div className="bg-swu-surface rounded-xl border border-swu-border p-4 space-y-3">
          <div className="text-xs text-swu-muted font-mono tracking-wider mb-1">DECK UTILIZADO</div>

          <div>
            <label className="text-xs text-swu-muted mb-1 block">Nombre del deck</label>
            {myDecks.length > 0 ? (
              <select
                value={deckName}
                onChange={e => setDeckName(e.target.value)}
                className="w-full bg-swu-bg border border-swu-border rounded-xl px-3 py-2.5 text-sm text-swu-text
                           focus:border-swu-accent outline-none"
              >
                <option value="">Seleccionar o escribir abajo...</option>
                {myDecks.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            ) : null}
            <input
              type="text"
              value={deckName}
              onChange={e => setDeckName(e.target.value)}
              placeholder="ej: Sabine Aggro"
              className="w-full bg-swu-bg border border-swu-border rounded-xl px-3 py-2.5 text-sm text-swu-text
                         placeholder:text-swu-muted focus:border-swu-accent outline-none mt-1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-swu-muted mb-1 block">Líder</label>
              <input
                type="text"
                value={deckLeader}
                onChange={e => setDeckLeader(e.target.value)}
                placeholder="ej: Sabine Wren"
                className="w-full bg-swu-bg border border-swu-border rounded-xl px-3 py-2.5 text-sm text-swu-text
                           placeholder:text-swu-muted focus:border-swu-accent outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-swu-muted mb-1 block">Base</label>
              <input
                type="text"
                value={deckBase}
                onChange={e => setDeckBase(e.target.value)}
                placeholder="ej: Chopper Base"
                className="w-full bg-swu-bg border border-swu-border rounded-xl px-3 py-2.5 text-sm text-swu-text
                           placeholder:text-swu-muted focus:border-swu-accent outline-none"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-swu-surface rounded-xl border border-swu-border p-4 space-y-2">
          <label className="text-xs text-swu-muted font-mono tracking-wider block">NOTAS</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notas sobre el torneo, matchups difíciles, cambios de sideboard..."
            rows={3}
            className="w-full bg-swu-bg border border-swu-border rounded-xl px-3 py-2.5 text-sm text-swu-text
                       placeholder:text-swu-muted focus:border-swu-accent outline-none resize-none"
          />
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
            name.trim()
              ? 'bg-swu-accent text-white active:scale-[0.98]'
              : 'bg-swu-surface text-swu-muted border border-swu-border'
          }`}
        >
          <Trophy size={16} />
          {saving ? 'Guardando...' : 'Guardar Torneo'}
        </button>
      </div>
    </div>
  )
}

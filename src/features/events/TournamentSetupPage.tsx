import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, X, Users, Trophy } from 'lucide-react'
import { db } from '../../services/db'
import { suggestedRounds, generateTournamentId, createPlayer } from '../../services/swiss'
import type { TournamentFormat, MatchType, Tournament } from '../../types'

const formats: { id: TournamentFormat; label: string; desc: string }[] = [
  { id: 'premier', label: 'Premier', desc: 'Construido estándar' },
  { id: 'sealed', label: 'Sealed', desc: 'Limitado (sobres)' },
  { id: 'draft', label: 'Draft', desc: 'Limitado (draft)' },
  { id: 'twin_suns', label: 'Twin Suns', desc: 'Singleton, 2 leaders' },
]

export function TournamentSetupPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [format, setFormat] = useState<TournamentFormat>('premier')
  const [matchType, setMatchType] = useState<MatchType>('bo3')
  const [avoidRematches, setAvoidRematches] = useState(true)
  const [playerNames, setPlayerNames] = useState<string[]>(['', ''])
  const [error, setError] = useState('')

  const addPlayer = () => setPlayerNames((prev) => [...prev, ''])
  const removePlayer = (idx: number) => {
    if (playerNames.length <= 2) return
    setPlayerNames((prev) => prev.filter((_, i) => i !== idx))
  }
  const updatePlayerName = (idx: number, val: string) => {
    setPlayerNames((prev) => prev.map((n, i) => (i === idx ? val : n)))
  }

  const validPlayers = playerNames.filter((n) => n.trim().length > 0)
  const rounds = suggestedRounds(validPlayers.length)

  const handleCreate = async () => {
    setError('')
    const trimmed = playerNames.map((n) => n.trim()).filter((n) => n.length > 0)

    if (!name.trim()) {
      setError('Nombre del torneo requerido')
      return
    }
    if (trimmed.length < 2) {
      setError('Se necesitan al menos 2 jugadores')
      return
    }

    // Check for duplicate names
    const uniqueNames = new Set(trimmed.map((n) => n.toLowerCase()))
    if (uniqueNames.size !== trimmed.length) {
      setError('Los nombres de jugadores deben ser únicos')
      return
    }

    // Generate a shareable event code
    const eventCode = name.trim().slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X') +
      Math.random().toString(36).slice(2, 5).toUpperCase()

    const tournament: Tournament = {
      id: generateTournamentId(),
      name: name.trim(),
      format,
      matchType,
      maxRounds: rounds,
      avoidRematches,
      players: trimmed.map((n) => createPlayer(n)),
      rounds: [],
      status: 'active',
      eventCode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await db.tournaments.put(tournament)
    navigate(`/events/tournament/${tournament.id}`)
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      <button onClick={() => navigate('/events')} className="flex items-center gap-1 text-sm text-swu-muted">
        <ChevronLeft size={18} /> Eventos
      </button>

      <h2 className="text-lg font-bold text-swu-text flex items-center gap-2">
        <Trophy size={22} className="text-swu-amber" /> Nuevo Torneo Casero
      </h2>

      {/* Tournament Name */}
      <div>
        <label className="text-xs font-bold text-swu-muted block mb-1">Nombre del Torneo</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Torneo del Viernes"
          className="w-full bg-swu-surface border border-swu-border rounded-xl px-4 py-3 text-swu-text text-sm placeholder:text-swu-muted/50 focus:border-swu-accent focus:outline-none"
        />
      </div>

      {/* Format */}
      <div>
        <label className="text-xs font-bold text-swu-muted block mb-2">Formato</label>
        <div className="grid grid-cols-2 gap-2">
          {formats.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={`rounded-xl p-3 text-left border-2 transition-colors ${
                format === f.id
                  ? 'bg-swu-accent/10 border-swu-accent/40 text-swu-accent'
                  : 'bg-swu-surface border-swu-border text-swu-muted'
              }`}
            >
              <p className="text-sm font-bold">{f.label}</p>
              <p className="text-[10px] mt-0.5 opacity-70">{f.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Match Type */}
      <div>
        <label className="text-xs font-bold text-swu-muted block mb-2">Tipo de Match</label>
        <div className="flex gap-2">
          {(['bo1', 'bo3'] as MatchType[]).map((mt) => (
            <button
              key={mt}
              onClick={() => setMatchType(mt)}
              className={`flex-1 rounded-xl py-3 text-center font-bold text-sm border-2 transition-colors ${
                matchType === mt
                  ? 'bg-swu-accent/10 border-swu-accent/40 text-swu-accent'
                  : 'bg-swu-surface border-swu-border text-swu-muted'
              }`}
            >
              {mt === 'bo1' ? 'Best of 1' : 'Best of 3'}
            </button>
          ))}
        </div>
      </div>

      {/* Avoid rematches */}
      <div className="flex items-center justify-between bg-swu-surface rounded-xl p-3 border border-swu-border">
        <span className="text-sm text-swu-text">Evitar rematches</span>
        <button
          onClick={() => setAvoidRematches(!avoidRematches)}
          className={`w-12 h-7 rounded-full transition-colors ${avoidRematches ? 'bg-swu-accent' : 'bg-swu-border'}`}
        >
          <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-1 ${avoidRematches ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {/* Players */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-swu-muted flex items-center gap-1">
            <Users size={14} /> Jugadores ({validPlayers.length})
          </label>
          <span className="text-[10px] text-swu-muted">{rounds} rondas sugeridas</span>
        </div>

        <div className="space-y-2">
          {playerNames.map((pn, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                value={pn}
                onChange={(e) => updatePlayerName(idx, e.target.value)}
                placeholder={`Jugador ${idx + 1}`}
                className="flex-1 bg-swu-surface border border-swu-border rounded-lg px-3 py-2.5 text-swu-text text-sm placeholder:text-swu-muted/50 focus:border-swu-accent focus:outline-none"
              />
              {playerNames.length > 2 && (
                <button
                  onClick={() => removePlayer(idx)}
                  className="p-2 rounded-lg bg-swu-red/10 border border-swu-red/30 text-swu-red"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addPlayer}
          className="w-full mt-2 py-2.5 rounded-xl bg-swu-surface border-2 border-dashed border-swu-border text-swu-muted text-sm font-medium flex items-center justify-center gap-1 active:scale-[0.98] transition-transform"
        >
          <Plus size={16} /> Agregar Jugador
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-swu-red bg-swu-red/10 rounded-lg p-3 border border-swu-red/30">{error}</p>
      )}

      {/* Create button */}
      <button
        onClick={handleCreate}
        disabled={validPlayers.length < 2 || !name.trim()}
        className="w-full py-4 rounded-xl bg-swu-amber text-black font-extrabold text-base active:scale-[0.97] transition-transform disabled:opacity-40 disabled:pointer-events-none"
      >
        Crear Torneo ({validPlayers.length} jugadores · {rounds} rondas)
      </button>
    </div>
  )
}

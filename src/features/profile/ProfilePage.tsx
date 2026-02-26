import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, History, Heart, Star, Pencil, Layers, BookOpen, Trophy } from 'lucide-react'
import { db } from '../../services/db'
import { useSettings } from '../../hooks/useSettings'

export function ProfilePage() {
  const navigate = useNavigate()
  const { playerName, setPlayerName } = useSettings()
  const [editingName, setEditingName] = useState(false)

  const [matchCount, setMatchCount] = useState(0)
  const [tournamentCount, setTournamentCount] = useState(0)
  const [deckCount, setDeckCount] = useState(0)
  const [favCount, setFavCount] = useState(0)

  useEffect(() => {
    Promise.all([
      db.matches.count(),
      db.tournaments.count(),
      db.decks.count(),
      db.favoriteCards.count(),
    ]).then(([m, t, d, f]) => {
      setMatchCount(m)
      setTournamentCount(t)
      setDeckCount(d)
      setFavCount(f)
    })
  }, [])

  const displayName = playerName || 'Jugador'
  const initial = displayName.charAt(0).toUpperCase()

  const stats = [
    { n: String(matchCount), label: 'Partidas' },
    { n: String(tournamentCount), label: 'Torneos' },
    { n: String(deckCount), label: 'Decks' },
  ]

  const menuItems = [
    { icon: History, label: 'Partidas Guardadas', desc: `${matchCount} partidas`, to: '/play/saved' },
    { icon: Trophy, label: 'Mis Torneos', desc: `${tournamentCount} torneos`, to: '/events/tournament' },
    { icon: BookOpen, label: 'Mis Decks', desc: `${deckCount} decks`, to: '/decks' },
    { icon: Layers, label: 'Buscar Cartas', desc: 'Base de datos SWU', to: '/cards' },
    { icon: Heart, label: 'Favoritos', desc: `${favCount} cartas guardadas`, to: '/cards' },
    { icon: Star, label: 'Utilidades', desc: 'Dados, moneda, iniciativa', to: '/utilities' },
  ]

  const saveName = (name: string) => {
    setPlayerName(name || 'Jugador')
    setEditingName(false)
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Avatar + Name */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-swu-accent to-swu-amber flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
          {initial}
        </div>
        <div className="flex-1">
          {editingName ? (
            <input
              autoFocus
              className="bg-swu-surface border border-swu-border rounded-lg px-3 py-2 text-lg text-swu-text font-bold w-full"
              defaultValue={displayName}
              onBlur={(e) => saveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveName((e.target as HTMLInputElement).value) }}
              placeholder="Tu nombre"
            />
          ) : (
            <button onClick={() => setEditingName(true)} className="flex items-center gap-2 group">
              <h2 className="text-xl font-bold text-swu-text">{displayName}</h2>
              <Pencil size={14} className="text-swu-muted opacity-0 group-active:opacity-100" />
            </button>
          )}
          <p className="text-sm text-swu-muted">Jugador SWU Companion</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-swu-surface rounded-xl p-3.5 text-center border border-swu-border">
            <p className="text-3xl font-extrabold text-swu-accent font-mono">{s.n}</p>
            <p className="text-[11px] text-swu-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Menu */}
      <div className="space-y-1.5">
        {menuItems.map((m) => {
          const Icon = m.icon
          return (
            <button
              key={m.label}
              onClick={() => navigate(m.to)}
              className="w-full bg-swu-surface rounded-xl p-3.5 border border-swu-border flex items-center justify-between active:bg-swu-bg transition-colors"
            >
              <div className="flex items-center gap-3">
                <Icon size={20} className="text-swu-muted" />
                <div className="text-left">
                  <p className="font-semibold text-sm text-swu-text">{m.label}</p>
                  <p className="text-xs text-swu-muted">{m.desc}</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-swu-muted" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

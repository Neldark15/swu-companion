import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Swords, Users, Settings2, History } from 'lucide-react'

const modes = [
  {
    id: 'premier' as const,
    label: 'Premier 1v1',
    desc: '2 jugadores · 30 HP · Estándar competitivo',
    icon: Swords,
    color: 'border-swu-accent/40 text-swu-accent',
  },
  {
    id: 'twin_suns' as const,
    label: 'Twin Suns',
    desc: '2-4 jugadores · 30 HP · Singleton, 2 leaders',
    icon: Users,
    color: 'border-swu-amber/40 text-swu-amber',
  },
  {
    id: 'custom' as const,
    label: 'Custom',
    desc: '2-4 jugadores · HP editable · Variantes caseras',
    icon: Settings2,
    color: 'border-purple-400/40 text-purple-400',
  },
]

export function PlayPage() {
  const navigate = useNavigate()
  const [savedCount] = useState(3)

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-swu-text">Seleccionar Modo</h2>

      {modes.map((m) => {
        const Icon = m.icon
        return (
          <button
            key={m.id}
            onClick={() => navigate(`/play/tracker/${m.id}`)}
            className={`w-full bg-swu-surface border-2 ${m.color} rounded-2xl p-5 text-left active:scale-[0.98] transition-transform`}
          >
            <div className="flex items-center gap-3">
              <Icon size={24} />
              <div>
                <p className="text-lg font-bold">{m.label}</p>
                <p className="text-sm text-swu-muted mt-0.5">{m.desc}</p>
              </div>
            </div>
          </button>
        )
      })}

      <button
        onClick={() => navigate('/play/saved')}
        className="w-full bg-swu-surface border border-swu-border rounded-xl p-4 flex items-center justify-between text-swu-muted"
      >
        <div className="flex items-center gap-3">
          <History size={20} />
          <span className="text-sm font-medium">Partidas Guardadas</span>
        </div>
        <span className="text-sm font-bold text-swu-accent">{savedCount}</span>
      </button>
    </div>
  )
}

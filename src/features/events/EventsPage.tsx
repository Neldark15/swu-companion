import { useNavigate } from 'react-router-dom'
import { QrCode, Trophy } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'

const recentEvents = [
  { name: 'FNM - Tienda El Refugio', date: '21 Feb 2026', result: '3-1', pos: '2do de 12' },
  { name: 'Torneo Casero #5', date: '15 Feb 2026', result: '2-1', pos: '1ro de 6' },
]

export function EventsPage() {
  const navigate = useNavigate()

  return (
    <div className="p-4 space-y-5">
      <h2 className="text-lg font-bold text-swu-text">Eventos</h2>

      <div className="flex gap-3">
        <button
          onClick={() => navigate('/events/join')}
          className="flex-1 bg-swu-accent/10 border-2 border-swu-accent/30 rounded-2xl p-5 text-center active:scale-[0.97] transition-transform"
        >
          <QrCode size={28} className="mx-auto text-swu-accent mb-2" />
          <p className="font-bold text-swu-accent">Unirse a Evento</p>
          <p className="text-[11px] text-swu-muted mt-1">Código o QR</p>
        </button>
        <button
          onClick={() => navigate('/events/tournament')}
          className="flex-1 bg-swu-amber/10 border-2 border-swu-amber/30 rounded-2xl p-5 text-center active:scale-[0.97] transition-transform"
        >
          <Trophy size={28} className="mx-auto text-swu-amber mb-2" />
          <p className="font-bold text-swu-amber">Torneo Casero</p>
          <p className="text-[11px] text-swu-muted mt-1">Swiss offline</p>
        </button>
      </div>

      <div>
        <h3 className="text-sm font-bold text-swu-text mb-3">Eventos Recientes</h3>
        <div className="space-y-2">
          {recentEvents.map((e) => (
            <div key={e.name} className="bg-swu-surface rounded-xl p-3 border border-swu-border">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-swu-text">{e.name}</span>
                <Badge variant="green">{e.result}</Badge>
              </div>
              <p className="text-xs text-swu-muted mt-1">{e.date} · {e.pos}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

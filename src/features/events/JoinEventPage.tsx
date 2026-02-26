import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, QrCode } from 'lucide-react'

export function JoinEventPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')

  return (
    <div className="p-4 space-y-5">
      <button onClick={() => navigate('/events')} className="flex items-center gap-1 text-sm text-swu-muted">
        <ChevronLeft size={18} /> Volver
      </button>

      <h2 className="text-lg font-bold text-swu-text">Unirse a Evento</h2>

      <div className="bg-swu-surface rounded-2xl p-5 border border-swu-border">
        <p className="text-sm text-swu-muted mb-2">Ingrese el código del evento</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          maxLength={8}
          className="w-full bg-swu-bg border border-swu-border rounded-xl p-4 text-2xl font-mono font-bold tracking-[0.3em] text-center text-swu-text outline-none focus:border-swu-accent transition-colors"
        />
        <button
          disabled={code.length < 4}
          className={`w-full mt-3 py-3.5 rounded-xl font-bold text-base transition-all ${
            code.length >= 4
              ? 'bg-swu-accent text-white active:scale-[0.98]'
              : 'bg-swu-surface-hover text-swu-muted cursor-not-allowed'
          }`}
        >
          Unirse
        </button>
      </div>

      <div className="text-center text-swu-muted text-sm">o</div>

      <button className="w-full border-2 border-dashed border-swu-border rounded-2xl p-6 flex flex-col items-center gap-2 text-swu-muted active:bg-swu-surface transition-colors">
        <QrCode size={32} />
        <span className="font-semibold">Escanear código QR</span>
        <span className="text-xs">Use la cámara para escanear el código del evento</span>
      </button>
    </div>
  )
}

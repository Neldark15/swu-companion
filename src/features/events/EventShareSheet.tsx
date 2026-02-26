import { useState } from 'react'
import { QrCode, Copy, Check, Share2, X } from 'lucide-react'

interface EventShareSheetProps {
  eventCode: string
  eventName: string
  onClose: () => void
}

export function EventShareSheet({ eventCode, eventName, onClose }: EventShareSheetProps) {
  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    navigator.clipboard?.writeText(eventCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareEvent = () => {
    if (navigator.share) {
      navigator.share({
        title: eventName,
        text: `¡Únete al evento "${eventName}" en SWU Companion! Código: ${eventCode}`,
        url: window.location.origin,
      }).catch(() => {})
    } else {
      copyCode()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-md bg-swu-surface rounded-t-3xl border-t border-swu-border p-6 pb-10 space-y-5 animate-slide-up">
        {/* Handle */}
        <div className="w-12 h-1 bg-swu-border rounded-full mx-auto" />

        <button onClick={onClose} className="absolute right-4 top-4 p-2 text-swu-muted">
          <X size={20} />
        </button>

        <div className="text-center">
          <h3 className="text-lg font-bold text-swu-text">Compartir Evento</h3>
          <p className="text-sm text-swu-muted mt-0.5">{eventName}</p>
        </div>

        {/* Big code display */}
        <div className="bg-swu-bg rounded-2xl p-6 text-center border border-swu-border">
          <p className="text-[11px] text-swu-muted uppercase tracking-widest mb-2">Código del Evento</p>
          <p className="text-4xl font-extrabold font-mono tracking-[0.3em] text-swu-accent">{eventCode}</p>
        </div>

        {/* QR placeholder */}
        <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3">
          <div className="w-40 h-40 bg-gray-100 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-300">
            <QrCode size={64} className="text-gray-400" />
          </div>
          <p className="text-xs text-gray-500">QR code (disponible en versión futura)</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={copyCode}
            className="flex-1 py-3 rounded-xl bg-swu-accent text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
          >
            {copied ? <><Check size={18} /> Copiado</> : <><Copy size={18} /> Copiar Código</>}
          </button>
          <button
            onClick={shareEvent}
            className="flex-1 py-3 rounded-xl bg-swu-bg border border-swu-border text-swu-text font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
          >
            <Share2 size={18} /> Compartir
          </button>
        </div>
      </div>
    </div>
  )
}

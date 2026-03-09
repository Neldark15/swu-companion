import { useState, useEffect } from 'react'
import { X, Copy, Check, FileJson, FileText } from 'lucide-react'
import { exportDeckAsSwudbJson, exportDeckAsMeleeText } from '../../services/deckImportExport'
import type { Deck } from '../../types'

interface Props {
  open: boolean
  deck: Deck | null
  onClose: () => void
}

type Format = 'json' | 'melee'

export function ExportDeckModal({ open, deck, onClose }: Props) {
  const [format, setFormat] = useState<Format>('json')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open || !deck) { setText(''); return }
    setLoading(true)
    setCopied(false)
    ;(async () => {
      try {
        const result = format === 'json'
          ? await exportDeckAsSwudbJson(deck)
          : exportDeckAsMeleeText(deck)
        setText(result)
      } catch {
        setText('Error al exportar')
      } finally {
        setLoading(false)
      }
    })()
  }, [open, deck, format])

  if (!open || !deck) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-swu-surface border border-swu-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-swu-border">
          <h3 className="text-base font-bold text-swu-text">Exportar: {deck.name}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-swu-bg text-swu-muted active:scale-95">
            <X size={16} />
          </button>
        </div>

        {/* Format toggle */}
        <div className="px-4 pt-3 flex gap-2">
          <button
            onClick={() => setFormat('json')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
              format === 'json'
                ? 'bg-swu-accent/15 border-swu-accent/40 text-swu-accent'
                : 'bg-swu-bg border-swu-border text-swu-muted'
            }`}
          >
            <FileJson size={14} /> SWUDB JSON
          </button>
          <button
            onClick={() => setFormat('melee')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
              format === 'melee'
                ? 'bg-swu-amber/15 border-swu-amber/40 text-swu-amber'
                : 'bg-swu-bg border-swu-border text-swu-muted'
            }`}
          >
            <FileText size={14} /> Melee Texto
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <textarea
            readOnly
            value={loading ? 'Generando...' : text}
            className="w-full h-48 p-3 bg-swu-bg border border-swu-border rounded-xl text-xs text-swu-text font-mono resize-none focus:outline-none"
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-swu-border flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-swu-border text-swu-muted text-sm font-bold active:scale-95"
          >
            Cerrar
          </button>
          <button
            onClick={handleCopy}
            disabled={loading || !text}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all ${
              copied
                ? 'bg-swu-green/20 text-swu-green border border-swu-green/40'
                : 'bg-swu-accent text-white'
            }`}
          >
            {copied ? <><Check size={16} /> Copiado</> : <><Copy size={16} /> Copiar</>}
          </button>
        </div>
      </div>
    </div>
  )
}

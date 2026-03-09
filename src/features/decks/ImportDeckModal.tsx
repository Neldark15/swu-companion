import { useState } from 'react'
import { X, Upload, Loader2, AlertTriangle, CheckCircle2, ClipboardPaste } from 'lucide-react'
import { importDeckFromText } from '../../services/deckImportExport'
import type { DeckImportResult } from '../../services/deckImportExport'

interface Props {
  open: boolean
  onClose: () => void
  onImport: (result: DeckImportResult) => void
}

export function ImportDeckModal({ open, onClose, onImport }: Props) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DeckImportResult | null>(null)

  if (!open) return null

  const handlePaste = async () => {
    try {
      const clip = await navigator.clipboard.readText()
      if (clip) setText(clip)
    } catch {
      // clipboard API not available
    }
  }

  const handleImport = async () => {
    if (!text.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await importDeckFromText(text)
      setResult(res)
      if (res.success) {
        setTimeout(() => {
          onImport(res)
          onClose()
          setText('')
          setResult(null)
        }, 1200)
      }
    } catch (e: any) {
      setResult({ success: false, errors: [e.message || 'Error desconocido'], warnings: [], matchedCards: 0, totalCards: 0 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-swu-surface border border-swu-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-swu-border">
          <h3 className="text-base font-bold text-swu-text">Importar Deck</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-swu-bg text-swu-muted active:scale-95">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <p className="text-xs text-swu-muted">
            Pegue un deck en formato <span className="text-swu-accent font-bold">SWUDB JSON</span> o{' '}
            <span className="text-swu-amber font-bold">Melee texto</span> (copiado desde swudb.com u otra fuente).
          </p>

          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'Pegue aquí el deck...\n\nEjemplo JSON:\n{"metadata":{"name":"Mi Deck"},"leader":{"id":"SOR_017",...},...}\n\nEjemplo Melee:\nLeader\n1 | Han Solo | Audacious Smuggler\nBase\n1 | Echo Base\nMainDeck\n3 | Battlefield Marine'}
              className="w-full h-40 p-3 bg-swu-bg border border-swu-border rounded-xl text-xs text-swu-text font-mono resize-none focus:outline-none focus:border-swu-accent/50"
            />
            <button
              onClick={handlePaste}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-swu-accent/15 text-swu-accent active:scale-95 transition-transform"
              title="Pegar del portapapeles"
            >
              <ClipboardPaste size={14} />
            </button>
          </div>

          {/* Result feedback */}
          {result && (
            <div className={`p-3 rounded-xl border text-xs space-y-1 ${
              result.success
                ? 'bg-swu-green/10 border-swu-green/30 text-swu-green'
                : 'bg-swu-red/10 border-swu-red/30 text-swu-red'
            }`}>
              <div className="flex items-center gap-2 font-bold">
                {result.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                {result.success
                  ? `Importado: ${result.matchedCards}/${result.totalCards} cartas`
                  : 'Error en importación'}
              </div>
              {result.errors.map((e, i) => <p key={i} className="text-swu-red">{e}</p>)}
              {result.warnings.slice(0, 5).map((w, i) => <p key={i} className="text-swu-amber">{w}</p>)}
              {result.warnings.length > 5 && (
                <p className="text-swu-amber">...y {result.warnings.length - 5} advertencias más</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-swu-border flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-swu-border text-swu-muted text-sm font-bold active:scale-95"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={!text.trim() || loading}
            className="flex-1 py-2.5 rounded-xl bg-swu-accent text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Importar
          </button>
        </div>
      </div>
    </div>
  )
}

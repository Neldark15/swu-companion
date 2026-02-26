import { useState, useRef } from 'react'
import { ChevronLeft, Moon, Sun, Type, Vibrate, Download, Upload, MessageSquare, Shield, Trash2, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../../hooks/useSettings'
import { db } from '../../services/db'

export function SettingsPage() {
  const navigate = useNavigate()
  const { theme, setTheme, fontSize, setFontSize, hapticFeedback, toggleHaptic } = useSettings()
  const [exportFlash, setExportFlash] = useState(false)
  const [importFlash, setImportFlash] = useState(false)
  const [importError, setImportError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    try {
      const data = {
        version: 1,
        exportedAt: new Date().toISOString(),
        matches: await db.matches.toArray(),
        tournaments: await db.tournaments.toArray(),
        decks: await db.decks.toArray(),
        favoriteCards: await db.favoriteCards.toArray(),
        collection: await db.collection.toArray(),
        wishlist: await db.wishlist.toArray(),
        settings: localStorage.getItem('swu-settings'),
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `swu-companion-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)

      setExportFlash(true)
      setTimeout(() => setExportFlash(false), 2000)
    } catch (err) {
      console.error('Export error:', err)
    }
  }

  const handleImport = async (file: File) => {
    setImportError('')
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      if (!data.version || !data.matches) {
        setImportError('Archivo no válido')
        return
      }

      if (!confirm('¿Importar datos? Esto reemplazará los datos actuales.')) return

      // Clear existing data
      await Promise.all([
        db.matches.clear(),
        db.tournaments.clear(),
        db.decks.clear(),
        db.favoriteCards.clear(),
        db.collection.clear(),
        db.wishlist.clear(),
      ])

      // Import
      if (data.matches?.length) await db.matches.bulkPut(data.matches)
      if (data.tournaments?.length) await db.tournaments.bulkPut(data.tournaments)
      if (data.decks?.length) await db.decks.bulkPut(data.decks)
      if (data.favoriteCards?.length) await db.favoriteCards.bulkPut(data.favoriteCards)
      if (data.collection?.length) await db.collection.bulkPut(data.collection)
      if (data.wishlist?.length) await db.wishlist.bulkPut(data.wishlist)
      if (data.settings) localStorage.setItem('swu-settings', data.settings)

      setImportFlash(true)
      setTimeout(() => setImportFlash(false), 2000)
    } catch {
      setImportError('Error al leer el archivo')
    }
  }

  const handleClearData = async () => {
    if (!confirm('¿Eliminar TODOS los datos? Esta acción no se puede deshacer.')) return
    if (!confirm('¿Está seguro? Se eliminarán partidas, torneos, decks y favoritos.')) return

    await Promise.all([
      db.matches.clear(),
      db.tournaments.clear(),
      db.decks.clear(),
      db.favoriteCards.clear(),
      db.collection.clear(),
      db.wishlist.clear(),
      db.cards.clear(),
    ])
    localStorage.removeItem('swu-settings')
    window.location.reload()
  }

  return (
    <div className="p-4 space-y-5 pb-24">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-swu-muted">
        <ChevronLeft size={18} /> Volver
      </button>

      <h2 className="text-lg font-bold text-swu-text">Configuración</h2>

      {/* Appearance */}
      <div className="bg-swu-surface rounded-xl border border-swu-border overflow-hidden">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme === 'dark' ? <Moon size={20} className="text-swu-accent" /> : <Sun size={20} className="text-swu-amber" />}
            <span className="text-sm font-medium text-swu-text">Tema</span>
          </div>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="bg-swu-bg px-3 py-1.5 rounded-lg text-xs font-semibold text-swu-muted"
          >
            {theme === 'dark' ? 'Oscuro' : 'Claro'}
          </button>
        </div>

        <div className="border-t border-swu-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Type size={20} className="text-swu-muted" />
            <span className="text-sm font-medium text-swu-text">Tamaño de fuente</span>
          </div>
          <div className="flex gap-1">
            {(['sm', 'md', 'lg', 'xl'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFontSize(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  fontSize === s ? 'bg-swu-accent text-white' : 'bg-swu-bg text-swu-muted'
                }`}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-swu-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Vibrate size={20} className="text-swu-muted" />
            <span className="text-sm font-medium text-swu-text">Haptic feedback</span>
          </div>
          <button
            onClick={toggleHaptic}
            className={`w-12 h-7 rounded-full transition-colors ${hapticFeedback ? 'bg-swu-accent' : 'bg-swu-border'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-1 ${hapticFeedback ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-swu-surface rounded-xl border border-swu-border overflow-hidden">
        <button
          onClick={handleExport}
          className="w-full p-4 flex items-center gap-3 active:bg-swu-bg transition-colors"
        >
          {exportFlash ? <Check size={20} className="text-swu-green" /> : <Download size={20} className="text-swu-green" />}
          <span className="text-sm font-medium text-swu-text">
            {exportFlash ? '¡Exportado!' : 'Exportar datos (JSON)'}
          </span>
        </button>

        <div className="border-t border-swu-border" />

        <button
          onClick={() => fileRef.current?.click()}
          className="w-full p-4 flex items-center gap-3 active:bg-swu-bg transition-colors"
        >
          {importFlash ? <Check size={20} className="text-swu-green" /> : <Upload size={20} className="text-swu-amber" />}
          <span className="text-sm font-medium text-swu-text">
            {importFlash ? '¡Importado!' : 'Importar datos'}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleImport(file)
            e.target.value = ''
          }}
        />

        {importError && (
          <p className="px-4 pb-3 text-xs text-swu-red">{importError}</p>
        )}

        <div className="border-t border-swu-border" />

        <button
          onClick={handleClearData}
          className="w-full p-4 flex items-center gap-3 active:bg-swu-bg transition-colors"
        >
          <Trash2 size={20} className="text-swu-red" />
          <span className="text-sm font-medium text-swu-red">Borrar todos los datos</span>
        </button>
      </div>

      {/* About */}
      <div className="bg-swu-surface rounded-xl border border-swu-border overflow-hidden">
        <button className="w-full p-4 flex items-center gap-3 active:bg-swu-bg transition-colors">
          <MessageSquare size={20} className="text-swu-muted" />
          <span className="text-sm font-medium text-swu-text">Feedback</span>
        </button>
        <div className="border-t border-swu-border" />
        <button className="w-full p-4 flex items-center gap-3 active:bg-swu-bg transition-colors">
          <Shield size={20} className="text-swu-muted" />
          <span className="text-sm font-medium text-swu-text">Legal / Privacidad</span>
        </button>
      </div>

      <p className="text-[11px] text-swu-muted text-center pt-2">
        SWU Companion v1.0.0 · Fan-made · No afiliado a FFG/Lucasfilm/Disney
      </p>
    </div>
  )
}

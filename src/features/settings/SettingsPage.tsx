import { ChevronLeft, Moon, Sun, Type, Vibrate, Download, Upload, MessageSquare, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../../hooks/useSettings'

export function SettingsPage() {
  const navigate = useNavigate()
  const { theme, setTheme, fontSize, setFontSize, hapticFeedback, toggleHaptic } = useSettings()

  return (
    <div className="p-4 space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-swu-muted">
        <ChevronLeft size={18} /> Volver
      </button>

      <h2 className="text-lg font-bold text-swu-text">Configuración</h2>

      {/* Theme */}
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
            className={`w-11 h-6 rounded-full transition-colors relative ${hapticFeedback ? 'bg-swu-accent' : 'bg-swu-border'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${hapticFeedback ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Data */}
      <div className="bg-swu-surface rounded-xl border border-swu-border overflow-hidden">
        <button className="w-full p-4 flex items-center gap-3 active:bg-swu-surface-hover transition-colors">
          <Download size={20} className="text-swu-green" />
          <span className="text-sm font-medium text-swu-text">Exportar datos (JSON)</span>
        </button>
        <div className="border-t border-swu-border" />
        <button className="w-full p-4 flex items-center gap-3 active:bg-swu-surface-hover transition-colors">
          <Upload size={20} className="text-swu-amber" />
          <span className="text-sm font-medium text-swu-text">Importar datos</span>
        </button>
      </div>

      {/* Other */}
      <div className="bg-swu-surface rounded-xl border border-swu-border overflow-hidden">
        <button className="w-full p-4 flex items-center gap-3 active:bg-swu-surface-hover transition-colors">
          <MessageSquare size={20} className="text-swu-muted" />
          <span className="text-sm font-medium text-swu-text">Feedback</span>
        </button>
        <div className="border-t border-swu-border" />
        <button className="w-full p-4 flex items-center gap-3 active:bg-swu-surface-hover transition-colors">
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

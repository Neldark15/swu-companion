import { useState } from 'react'
import { ChevronLeft, Palette, Type, Vibrate, MessageSquare, Shield, Info, Smartphone, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSettings, ACCENT_COLORS, ACCENT_LABELS } from '../../hooks/useSettings'
import type { AccentColor } from '../../hooks/useSettings'

export function SettingsPage() {
  const navigate = useNavigate()
  const { accentColor, setAccentColor, fontSize, setFontSize, hapticFeedback, toggleHaptic } = useSettings()
  const [showAbout, setShowAbout] = useState(false)

  return (
    <div className="p-4 lg:p-6 space-y-5 pb-8 lg:pb-8 max-w-5xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-swu-muted">
        <ChevronLeft size={18} /> Volver
      </button>

      <h2 className="text-lg font-bold text-swu-text">Configuración</h2>

      {/* Appearance */}
      <div>
        <p className="text-[10px] text-swu-muted uppercase tracking-wider font-bold mb-2 px-1">Apariencia</p>
        <div className="bg-swu-surface rounded-2xl overflow-hidden">
          {/* Accent Color Picker */}
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Palette size={20} className="text-swu-accent" />
              <span className="text-sm font-medium text-swu-text">Color de acento</span>
            </div>
            <div className="flex gap-3 justify-center">
              {(Object.keys(ACCENT_COLORS) as AccentColor[]).map((color) => (
                <button
                  key={color}
                  onClick={() => setAccentColor(color)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 ${
                      accentColor === color
                        ? 'scale-110'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: ACCENT_COLORS[color],
                      boxShadow: accentColor === color
                        ? `0 0 20px ${ACCENT_COLORS[color]}50, 0 0 0 3px var(--color-swu-surface), 0 0 0 5px ${ACCENT_COLORS[color]}`
                        : 'var(--neu-shadow-sm)',
                    }}
                  >
                    {accentColor === color && <Check size={18} className="text-white" strokeWidth={3} />}
                  </div>
                  <span className={`text-[10px] font-mono tracking-wider ${
                    accentColor === color ? 'text-swu-text font-bold' : 'text-swu-muted'
                  }`}>
                    {ACCENT_LABELS[color]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-swu-border/30 p-4 flex items-center justify-between">
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
                    fontSize === s ? 'bg-swu-accent text-white' : 'bg-swu-bg text-swu-muted neu-inset'
                  }`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-swu-border/30 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Vibrate size={20} className="text-swu-muted" />
              <span className="text-sm font-medium text-swu-text">Haptic feedback</span>
            </div>
            <button
              onClick={toggleHaptic}
              className={`w-12 h-7 rounded-full transition-colors ${hapticFeedback ? 'bg-swu-accent' : 'bg-swu-bg neu-inset'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-1 ${hapticFeedback ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* App Info */}
      <div>
        <p className="text-[10px] text-swu-muted uppercase tracking-wider font-bold mb-2 px-1">Aplicación</p>
        <div className="bg-swu-surface rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowAbout(!showAbout)}
            className="w-full p-4 flex items-center gap-3 active:bg-swu-bg transition-colors"
          >
            <Info size={20} className="text-swu-accent" />
            <span className="flex-1 text-left text-sm font-medium text-swu-text">Acerca de</span>
            <ChevronLeft size={16} className={`text-swu-muted transition-transform ${showAbout ? '-rotate-90' : ''}`} />
          </button>

          {showAbout && (
            <div className="border-t border-swu-border px-4 py-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-swu-muted">Versión</span>
                <span className="text-swu-text font-mono">1.0.0</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-swu-muted">Plataforma</span>
                <span className="text-swu-text font-mono">PWA</span>
              </div>
              <p className="text-[10px] text-swu-muted pt-1">
                Todos los datos se sincronizan automáticamente con su cuenta en la nube.
              </p>
            </div>
          )}

          <div className="border-t border-swu-border" />

          <button className="w-full p-4 flex items-center gap-3 active:bg-swu-bg transition-colors">
            <Smartphone size={20} className="text-swu-muted" />
            <div className="flex-1 text-left">
              <span className="text-sm font-medium text-swu-text block">Instalar App</span>
              <span className="text-[10px] text-swu-muted">Agregue al inicio para acceso rápido</span>
            </div>
          </button>

          <div className="border-t border-swu-border" />

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
      </div>

      <p className="text-[11px] text-swu-muted text-center pt-2">
        HOLOCRON SWU v1.0.0 · Fan-made · No afiliado a FFG/Lucasfilm/Disney
      </p>
    </div>
  )
}

import { useState } from 'react'
import { ChevronLeft, Palette, Type, Vibrate, MessageSquare, Shield, Info, Smartphone, Check, KeyRound, Eye, EyeOff, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSettings, ACCENT_COLORS, ACCENT_LABELS, SABER_COLORS } from '../../hooks/useSettings'
import type { AccentColor, SaberColor } from '../../hooks/useSettings'
import { useAuth } from '../../hooks/useAuth'

export function SettingsPage() {
  const navigate = useNavigate()
  const { accentColor, setAccentColor, fontSize, setFontSize, hapticFeedback, toggleHaptic, saberColor, setSaberColor } = useSettings()
  const auth = useAuth()
  const [showAbout, setShowAbout] = useState(false)

  // Change password state
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [newPwd, setNewPwd] = useState('')
  const [newPwdConfirm, setNewPwdConfirm] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const [pwdLoading, setPwdLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  const handleChangePassword = async () => {
    setPwdError('')
    if (newPwd.length < 6) { setPwdError('La contraseña debe tener al menos 6 caracteres'); return }
    if (newPwd !== newPwdConfirm) { setPwdError('Las contraseñas no coinciden'); return }
    setPwdLoading(true)
    const result = await auth.updatePassword(newPwd)
    setPwdLoading(false)
    if (!result.ok) { setPwdError(result.error || 'Error al actualizar'); return }
    setPwdSuccess(true)
    setNewPwd('')
    setNewPwdConfirm('')
  }

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

          {/* Saber Color Picker */}
          <div className="border-t border-swu-border/30 p-4">
            <div className="flex items-center gap-3 mb-3">
              <Zap size={20} className="text-swu-accent" />
              <span className="text-sm font-medium text-swu-text">Color de sable de luz</span>
            </div>
            <div className="flex gap-2 justify-center flex-wrap">
              {(Object.keys(SABER_COLORS) as SaberColor[]).map((color) => (
                <button
                  key={color}
                  onClick={() => setSaberColor(color)}
                  className="flex flex-col items-center gap-1"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                      saberColor === color ? 'scale-110' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{
                      background: `radial-gradient(circle, ${SABER_COLORS[color].core} 40%, ${SABER_COLORS[color].glow} 100%)`,
                      boxShadow: saberColor === color
                        ? `0 0 16px ${SABER_COLORS[color].core}80, 0 0 0 2px var(--color-swu-surface), 0 0 0 4px ${SABER_COLORS[color].core}`
                        : `0 0 8px ${SABER_COLORS[color].core}30`,
                    }}
                  >
                    {saberColor === color && <Check size={16} className="text-white" strokeWidth={3} style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))' }} />}
                  </div>
                  <span className={`text-[9px] font-mono ${saberColor === color ? 'text-swu-text font-bold' : 'text-swu-muted'}`}>
                    {SABER_COLORS[color].label}
                  </span>
                </button>
              ))}
            </div>
            {/* Mini preview bar */}
            <div className="mt-3 mx-4 h-2 rounded-full overflow-hidden bg-black/40">
              <div
                className="h-full rounded-full w-3/4 transition-all duration-500"
                style={{
                  background: `linear-gradient(90deg, ${SABER_COLORS[saberColor].glow}, ${SABER_COLORS[saberColor].core} 60%, white)`,
                  boxShadow: `0 0 8px ${SABER_COLORS[saberColor].core}, 0 0 16px ${SABER_COLORS[saberColor].core}60`,
                }}
              />
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

      {/* Change Password — only for logged-in users */}
      {auth.currentProfile && auth.supabaseUser && (
        <div>
          <p className="text-[10px] text-swu-muted uppercase tracking-wider font-bold mb-2 px-1">Seguridad</p>
          <div className="bg-swu-surface rounded-2xl overflow-hidden">
            <button
              onClick={() => { setShowChangePassword(!showChangePassword); setPwdSuccess(false); setPwdError(''); setNewPwd(''); setNewPwdConfirm('') }}
              className="w-full p-4 flex items-center gap-3 active:bg-swu-bg transition-colors"
            >
              <KeyRound size={20} className="text-swu-accent" />
              <span className="flex-1 text-left text-sm font-medium text-swu-text">Cambiar Contraseña</span>
              <ChevronLeft size={16} className={`text-swu-muted transition-transform ${showChangePassword ? '-rotate-90' : ''}`} />
            </button>

            {showChangePassword && (
              <div className="border-t border-swu-border/30 px-4 py-4 space-y-3">
                {!pwdSuccess ? (
                  <>
                    <div>
                      <p className="text-xs text-swu-muted mb-1.5">Nueva Contraseña (mínimo 6 caracteres)</p>
                      <div className="relative">
                        <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
                        <input type={showPwd ? 'text' : 'password'} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="••••••••"
                          className="w-full bg-swu-bg border border-swu-border rounded-xl p-2.5 pl-9 pr-10 text-sm text-swu-text outline-none focus:border-swu-accent" />
                        <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-swu-muted">
                          {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-swu-muted mb-1.5">Confirmar Nueva Contraseña</p>
                      <input type={showPwd ? 'text' : 'password'} value={newPwdConfirm} onChange={(e) => setNewPwdConfirm(e.target.value)} placeholder="••••••••"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleChangePassword() }}
                        className="w-full bg-swu-bg border border-swu-border rounded-xl p-2.5 text-sm text-swu-text outline-none focus:border-swu-accent" />
                    </div>
                    {pwdError && <p className="text-xs text-swu-red text-center font-medium">{pwdError}</p>}
                    <button onClick={handleChangePassword} disabled={pwdLoading}
                      className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${!pwdLoading ? 'bg-swu-accent text-white active:scale-[0.98]' : 'bg-swu-border text-swu-muted'}`}>
                      {pwdLoading ? 'Actualizando...' : 'Cambiar Contraseña'}
                    </button>
                  </>
                ) : (
                  <div className="bg-swu-green/10 rounded-lg p-3 border border-swu-green/30 text-center">
                    <p className="text-sm text-swu-green font-bold">Contraseña actualizada</p>
                    <p className="text-[10px] text-swu-muted mt-0.5">Su nueva contraseña ya está activa</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, History, Heart, Star, Layers, BookOpen, Trophy,
  LogOut, UserPlus, Lock, User, Trash2, Shield, Palette,
  Fingerprint, Mail, Key, ChevronLeft, Eye, EyeOff, AlertTriangle,
} from 'lucide-react'
import { db } from '../../services/db'
import { useAuth } from '../../hooks/useAuth'
import { isPasskeyReady } from '../../services/crypto'
import type { UserProfile } from '../../services/db'

const avatarOptions = ['🎯', '⚔️', '🛡️', '🚀', '🌟', '💎', '🔥', '🌙', '👾', '🎲', '🐉', '🦅', '⭐', '🎭', '🏆', '🌀']

type View = 'select' | 'register-info' | 'register-pin' | 'register-passkey' | 'login' | 'profile' | 'customize' | 'security' | 'change-pin'

export function ProfilePage() {
  const navigate = useNavigate()
  const auth = useAuth()
  const { currentProfile, profiles, loadProfiles, logout } = auth

  const [view, setView] = useState<View>(currentProfile ? 'profile' : 'select')
  const [stats, setStats] = useState({ matches: 0, tournaments: 0, decks: 0, favorites: 0 })
  const [passkeySupported, setPasskeySupported] = useState(false)

  // Register state (multi-step)
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regAvatar, setRegAvatar] = useState('🎯')
  const [regPin, setRegPin] = useState('')
  const [regPinConfirm, setRegPinConfirm] = useState('')
  const [regError, setRegError] = useState('')
  const [showPin, setShowPin] = useState(false)

  // Login state
  const [loginProfile, setLoginProfile] = useState<UserProfile | null>(null)
  const [loginPin, setLoginPin] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Customization state
  const [customAvatar, setCustomAvatar] = useState(currentProfile?.avatar || '🎯')
  const [customName, setCustomName] = useState(currentProfile?.name || '')
  const [customEmail, setCustomEmail] = useState(currentProfile?.email || '')

  // Change PIN state
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newPinConfirm, setNewPinConfirm] = useState('')
  const [pinChangeError, setPinChangeError] = useState('')
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false)

  useEffect(() => { loadProfiles() }, [loadProfiles])
  useEffect(() => { isPasskeyReady().then(setPasskeySupported) }, [])

  useEffect(() => {
    if (currentProfile) {
      setView('profile')
      setCustomAvatar(currentProfile.avatar)
      setCustomName(currentProfile.name)
      setCustomEmail(currentProfile.email || '')
      Promise.all([
        db.matches.count(),
        db.tournaments.count(),
        db.decks.count(),
        db.favoriteCards.count(),
      ]).then(([matches, tournaments, decks, favorites]) => {
        setStats({ matches, tournaments, decks, favorites })
      })
    } else {
      setView('select')
    }
  }, [currentProfile])

  // ─── HANDLERS ───

  const goToRegister = () => {
    setRegName(''); setRegEmail(''); setRegPin(''); setRegPinConfirm('')
    setRegError(''); setRegAvatar('🎯'); setShowPin(false)
    setView('register-info')
  }

  const handleRegisterStep1 = () => {
    setRegError('')
    if (!regName.trim() || regName.trim().length < 2) {
      setRegError('El nombre debe tener al menos 2 caracteres'); return
    }
    if (regEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) {
      setRegError('Correo electrónico inválido'); return
    }
    setView('register-pin')
  }

  const handleRegisterStep2 = async () => {
    setRegError('')
    if (regPin.length < 4) { setRegError('El PIN debe tener al menos 4 dígitos'); return }
    if (regPin !== regPinConfirm) { setRegError('Los PIN no coinciden'); return }

    await auth.createProfile({
      name: regName.trim(),
      pin: regPin,
      avatar: regAvatar,
      email: regEmail.trim() || undefined,
    })

    if (passkeySupported) {
      setView('register-passkey')
    }
    // If no passkey support, createProfile already sets currentProfile → useEffect → 'profile'
  }

  const handleRegisterPasskey = async () => {
    const ok = await auth.registerPasskey()
    if (!ok) {
      // User cancelled or error — proceed anyway, they already have PIN
    }
    setView('profile')
  }

  const handleSkipPasskey = () => setView('profile')

  const startLogin = (p: UserProfile) => {
    setLoginProfile(p); setLoginPin(''); setLoginError(''); setLoginLoading(false)
    setView('login')
  }

  const handleLogin = async () => {
    setLoginError('')
    if (!loginProfile || !loginPin) { setLoginError('Ingrese su PIN'); return }
    setLoginLoading(true)
    const ok = await auth.login(loginProfile.id, loginPin)
    setLoginLoading(false)
    if (!ok) { setLoginError('PIN incorrecto'); return }
    setLoginPin(''); setLoginProfile(null)
  }

  const handlePasskeyLogin = async (profile: UserProfile) => {
    setLoginLoading(true)
    const ok = await auth.loginWithPasskey(profile.id)
    setLoginLoading(false)
    if (!ok) {
      startLogin(profile) // Fallback to PIN
    }
  }

  const handleAnyPasskeyLogin = async () => {
    setLoginLoading(true)
    const ok = await auth.loginWithAnyPasskey()
    setLoginLoading(false)
    if (!ok) {
      setLoginError('No se pudo autenticar. Intente con PIN.')
    }
  }

  const handleDelete = async (profileId: string) => {
    if (!confirm('¿Eliminar este perfil? Esta acción no se puede deshacer.')) return
    await auth.deleteProfile(profileId)
  }

  const saveCustomization = async () => {
    await auth.updateProfile({
      name: customName.trim() || currentProfile?.name,
      avatar: customAvatar,
      email: customEmail.trim() || undefined,
    })
    setView('profile')
  }

  const handleChangePin = async () => {
    setPinChangeError(''); setPinChangeSuccess(false)
    if (!oldPin) { setPinChangeError('Ingrese su PIN actual'); return }
    if (newPin.length < 4) { setPinChangeError('El nuevo PIN debe tener al menos 4 dígitos'); return }
    if (newPin !== newPinConfirm) { setPinChangeError('Los PIN no coinciden'); return }
    const ok = await auth.changePin(oldPin, newPin)
    if (!ok) { setPinChangeError('PIN actual incorrecto'); return }
    setPinChangeSuccess(true)
    setOldPin(''); setNewPin(''); setNewPinConfirm('')
    setTimeout(() => setView('security'), 1500)
  }

  const handleRegisterPasskeySecurity = async () => {
    await auth.registerPasskey()
    // Profile will update via store
  }

  const handleRemovePasskey = async () => {
    if (!confirm('¿Eliminar la passkey? Necesitará usar su PIN para ingresar.')) return
    await auth.removePasskey()
  }

  // ─── PIN input component ───
  const PinInput = ({ value, onChange, placeholder, autoFocus, onSubmit }: {
    value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; onSubmit?: () => void
  }) => (
    <div className="relative">
      <input
        type={showPin ? 'text' : 'password'}
        inputMode="numeric"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        placeholder={placeholder || '••••'}
        maxLength={8}
        className="w-full bg-swu-bg border border-swu-border rounded-xl p-3.5 text-xl font-mono tracking-[0.3em] text-center text-swu-text outline-none focus:border-swu-accent pr-12"
        onKeyDown={(e) => { if (e.key === 'Enter' && onSubmit) onSubmit() }}
      />
      <button type="button" onClick={() => setShowPin(!showPin)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-swu-muted p-1">
        {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )

  // ─── BACK BUTTON ───
  const BackButton = ({ to, label }: { to: View; label?: string }) => (
    <button onClick={() => setView(to)} className="flex items-center gap-1 text-sm text-swu-muted mb-1">
      <ChevronLeft size={16} /> {label || 'Volver'}
    </button>
  )

  // ═══════════════════════════════════════════════════════════════════
  // SELECT PROFILE
  // ═══════════════════════════════════════════════════════════════════
  if (view === 'select') {
    const profilesWithPasskey = profiles.filter(p => p.credentialId)
    return (
      <div className="p-4 space-y-5 pb-24">
        <div className="text-center pt-2">
          <User size={40} className="mx-auto text-swu-accent mb-2" />
          <h2 className="text-lg font-bold text-swu-text">Perfiles</h2>
          <p className="text-xs text-swu-muted mt-0.5">Seleccione un perfil o cree uno nuevo</p>
        </div>

        {/* Quick Passkey Login */}
        {passkeySupported && profilesWithPasskey.length > 0 && (
          <button onClick={handleAnyPasskeyLogin} disabled={loginLoading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-swu-accent/20 to-purple-500/20 border border-swu-accent/40 font-bold text-sm flex items-center justify-center gap-2 text-swu-accent active:scale-[0.98] transition-transform disabled:opacity-50">
            <Fingerprint size={20} />
            {loginLoading ? 'Verificando...' : 'Iniciar con Passkey'}
          </button>
        )}

        {loginError && !loginProfile && (
          <p className="text-sm text-swu-red text-center">{loginError}</p>
        )}

        {/* Profile list */}
        {profiles.length > 0 && (
          <div className="space-y-2">
            {profiles.map((p) => (
              <div key={p.id} className="bg-swu-surface rounded-xl p-3.5 border border-swu-border flex items-center gap-3">
                <span className="text-3xl">{p.avatar}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-swu-text truncate">{p.name}</p>
                  {p.email && <p className="text-[10px] text-swu-muted truncate">{p.email}</p>}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-swu-muted">{new Date(p.createdAt).toLocaleDateString()}</span>
                    {p.credentialId && <Fingerprint size={10} className="text-swu-accent" />}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {p.credentialId && passkeySupported && (
                    <button onClick={() => handlePasskeyLogin(p)}
                      className="p-2.5 rounded-lg bg-swu-accent/10 text-swu-accent active:scale-95 transition-transform" title="Passkey">
                      <Fingerprint size={18} />
                    </button>
                  )}
                  <button onClick={() => startLogin(p)}
                    className="px-3.5 py-2 rounded-lg bg-swu-accent text-white text-sm font-bold active:scale-95 transition-transform">
                    <Lock size={14} />
                  </button>
                  <button onClick={() => handleDelete(p.id)}
                    className="p-2 rounded-lg bg-swu-red/10 text-swu-red active:scale-95 transition-transform">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {profiles.length === 0 && (
          <div className="bg-swu-surface rounded-2xl p-8 border border-swu-border text-center space-y-3">
            <User size={48} className="mx-auto text-swu-muted/40" />
            <h3 className="text-base font-bold text-swu-text">Sin perfiles</h3>
            <p className="text-sm text-swu-muted">Cree un perfil para guardar su progreso</p>
          </div>
        )}

        <button onClick={goToRegister}
          className="w-full py-3.5 rounded-xl bg-swu-green text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
          <UserPlus size={20} /> Crear Nueva Cuenta
        </button>

        <button onClick={() => navigate('/')} className="w-full py-2 text-sm text-swu-muted text-center">
          Continuar sin perfil
        </button>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // REGISTER STEP 1: Info
  // ═══════════════════════════════════════════════════════════════════
  if (view === 'register-info') {
    return (
      <div className="p-4 space-y-5 pb-24">
        <BackButton to="select" />
        <div className="text-center">
          <span className="text-5xl block mb-2">{regAvatar}</span>
          <h2 className="text-lg font-bold text-swu-text">Crear Cuenta</h2>
          <p className="text-xs text-swu-muted mt-0.5">Paso 1 de {passkeySupported ? '3' : '2'} — Información</p>
        </div>
        <div className="bg-swu-surface rounded-2xl p-5 border border-swu-border space-y-4">
          {/* Avatar */}
          <div>
            <p className="text-xs text-swu-muted mb-2">Avatar</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {avatarOptions.map((a) => (
                <button key={a} onClick={() => setRegAvatar(a)}
                  className={`w-11 h-11 rounded-xl text-xl flex items-center justify-center border-2 transition-colors ${regAvatar === a ? 'border-swu-accent bg-swu-accent/20' : 'border-swu-border bg-swu-bg'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          {/* Name */}
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Nombre de Jugador *</p>
            <input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Su nombre o nickname" maxLength={30}
              className="w-full bg-swu-bg border border-swu-border rounded-xl p-3 text-sm text-swu-text outline-none focus:border-swu-accent" />
          </div>
          {/* Email */}
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Correo Electrónico (opcional)</p>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
              <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="correo@ejemplo.com"
                className="w-full bg-swu-bg border border-swu-border rounded-xl p-3 pl-10 text-sm text-swu-text outline-none focus:border-swu-accent" />
            </div>
            <p className="text-[10px] text-swu-muted mt-1">Para identificar su cuenta y futuras funciones</p>
          </div>

          {regError && <p className="text-sm text-swu-red text-center font-medium">{regError}</p>}

          <button onClick={handleRegisterStep1}
            className="w-full py-3.5 rounded-xl bg-swu-accent text-white font-bold text-base active:scale-[0.98] transition-transform">
            Siguiente →
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // REGISTER STEP 2: PIN
  // ═══════════════════════════════════════════════════════════════════
  if (view === 'register-pin') {
    return (
      <div className="p-4 space-y-5 pb-24">
        <BackButton to="register-info" />
        <div className="text-center">
          <Lock size={40} className="mx-auto text-swu-accent mb-2" />
          <h2 className="text-lg font-bold text-swu-text">Crear PIN</h2>
          <p className="text-xs text-swu-muted mt-0.5">Paso 2 de {passkeySupported ? '3' : '2'} — Seguridad</p>
        </div>
        <div className="bg-swu-surface rounded-2xl p-5 border border-swu-border space-y-4">
          <div>
            <p className="text-xs text-swu-muted mb-1.5">PIN (4-8 dígitos)</p>
            <PinInput value={regPin} onChange={setRegPin} autoFocus />
          </div>
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Confirmar PIN</p>
            <PinInput value={regPinConfirm} onChange={setRegPinConfirm} onSubmit={handleRegisterStep2} />
          </div>

          <div className="bg-swu-bg rounded-lg p-3 flex items-start gap-2">
            <Shield size={14} className="text-swu-accent mt-0.5 shrink-0" />
            <p className="text-[11px] text-swu-muted">Su PIN se almacena encriptado con PBKDF2. Nadie puede ver su PIN real.</p>
          </div>

          {regError && <p className="text-sm text-swu-red text-center font-medium">{regError}</p>}

          <button onClick={handleRegisterStep2}
            className={`w-full py-3.5 rounded-xl font-bold text-base transition-all ${regPin.length >= 4 && regPinConfirm.length >= 4 ? 'bg-swu-green text-white active:scale-[0.98]' : 'bg-swu-border text-swu-muted cursor-not-allowed'}`}
            disabled={regPin.length < 4 || regPinConfirm.length < 4}>
            Crear Cuenta
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // REGISTER STEP 3: Passkey (optional)
  // ═══════════════════════════════════════════════════════════════════
  if (view === 'register-passkey') {
    return (
      <div className="p-4 space-y-5 pb-24">
        <div className="text-center pt-4">
          <Fingerprint size={56} className="mx-auto text-swu-accent mb-3" />
          <h2 className="text-lg font-bold text-swu-text">Inicio Rápido</h2>
          <p className="text-xs text-swu-muted mt-0.5">Paso 3 de 3 — Passkey (opcional)</p>
        </div>
        <div className="bg-swu-surface rounded-2xl p-5 border border-swu-border space-y-4">
          <p className="text-sm text-swu-text text-center">
            ¿Desea usar huella digital o reconocimiento facial para iniciar sesión rápidamente?
          </p>

          <div className="space-y-2">
            {['Su passkey se sincroniza con iCloud/Google automáticamente',
              'Más seguro que un PIN',
              'Inicie sesión en un toque'
            ].map((t) => (
              <div key={t} className="flex items-center gap-2 text-xs text-swu-muted">
                <Shield size={12} className="text-swu-green shrink-0" />
                <span>{t}</span>
              </div>
            ))}
          </div>

          <button onClick={handleRegisterPasskey}
            className="w-full py-3.5 rounded-xl bg-swu-accent text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
            <Fingerprint size={20} /> Registrar Passkey
          </button>

          <button onClick={handleSkipPasskey}
            className="w-full py-2 text-sm text-swu-muted text-center">
            Omitir por ahora
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════════
  if (view === 'login' && loginProfile) {
    return (
      <div className="p-4 space-y-5 pb-24">
        <BackButton to="select" />
        <div className="text-center">
          <span className="text-5xl block mb-2">{loginProfile.avatar}</span>
          <h2 className="text-lg font-bold text-swu-text">{loginProfile.name}</h2>
          {loginProfile.email && <p className="text-xs text-swu-muted mt-0.5">{loginProfile.email}</p>}
        </div>
        <div className="bg-swu-surface rounded-2xl p-5 border border-swu-border space-y-4">
          <div className="flex items-center gap-2 text-sm text-swu-muted"><Lock size={14} /><span>Ingrese su PIN</span></div>
          <PinInput value={loginPin} onChange={setLoginPin} autoFocus onSubmit={handleLogin} />

          {loginError && <p className="text-sm text-swu-red text-center font-medium">{loginError}</p>}

          <button onClick={handleLogin} disabled={loginPin.length < 4 || loginLoading}
            className={`w-full py-3.5 rounded-xl font-bold text-base transition-all ${loginPin.length >= 4 && !loginLoading ? 'bg-swu-accent text-white active:scale-[0.98]' : 'bg-swu-border text-swu-muted cursor-not-allowed'}`}>
            {loginLoading ? 'Verificando...' : 'Ingresar'}
          </button>

          {loginProfile.credentialId && passkeySupported && (
            <button onClick={() => handlePasskeyLogin(loginProfile)} disabled={loginLoading}
              className="w-full py-3 rounded-xl bg-swu-accent/10 border border-swu-accent/30 text-swu-accent font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50">
              <Fingerprint size={18} /> Usar Passkey
            </button>
          )}

          {/* Forgot PIN info */}
          <div className="bg-swu-bg rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle size={14} className="text-swu-amber mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] text-swu-muted">
                ¿Olvidó su PIN? {loginProfile.credentialId ? 'Use su passkey para ingresar y cambie el PIN desde Seguridad.' : 'Si no tiene passkey registrada, los datos locales no pueden recuperarse.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // CUSTOMIZE
  // ═══════════════════════════════════════════════════════════════════
  if (view === 'customize') {
    return (
      <div className="p-4 space-y-5 pb-24">
        <BackButton to="profile" />
        <div className="text-center">
          <span className="text-6xl block mb-2">{customAvatar}</span>
          <h2 className="text-lg font-bold text-swu-text">Personalizar Perfil</h2>
        </div>
        <div className="bg-swu-surface rounded-2xl p-5 border border-swu-border space-y-5">
          <div>
            <p className="text-xs text-swu-muted mb-2">Avatar</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {avatarOptions.map((a) => (
                <button key={a} onClick={() => setCustomAvatar(a)}
                  className={`w-12 h-12 rounded-xl text-2xl flex items-center justify-center border-2 transition-colors ${customAvatar === a ? 'border-swu-accent bg-swu-accent/20' : 'border-swu-border bg-swu-bg'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Nombre</p>
            <input value={customName} onChange={(e) => setCustomName(e.target.value)} maxLength={30}
              className="w-full bg-swu-bg border border-swu-border rounded-xl p-3 text-sm text-swu-text outline-none focus:border-swu-accent" />
          </div>
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Correo Electrónico</p>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
              <input type="email" value={customEmail} onChange={(e) => setCustomEmail(e.target.value)} placeholder="correo@ejemplo.com"
                className="w-full bg-swu-bg border border-swu-border rounded-xl p-3 pl-10 text-sm text-swu-text outline-none focus:border-swu-accent" />
            </div>
          </div>
          <button onClick={saveCustomization}
            className="w-full py-3.5 rounded-xl bg-swu-accent text-white font-bold text-base active:scale-[0.98] transition-transform">
            Guardar Cambios
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // SECURITY
  // ═══════════════════════════════════════════════════════════════════
  if (view === 'security') {
    return (
      <div className="p-4 space-y-5 pb-24">
        <BackButton to="profile" />
        <div className="text-center">
          <Shield size={40} className="mx-auto text-swu-accent mb-2" />
          <h2 className="text-lg font-bold text-swu-text">Seguridad</h2>
        </div>

        {/* PIN Section */}
        <div className="bg-swu-surface rounded-2xl p-4 border border-swu-border space-y-3">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-swu-accent" />
            <p className="text-sm font-bold text-swu-text">PIN de Acceso</p>
          </div>
          <p className="text-xs text-swu-muted">Su PIN está protegido con encriptación PBKDF2</p>
          <button onClick={() => { setOldPin(''); setNewPin(''); setNewPinConfirm(''); setPinChangeError(''); setPinChangeSuccess(false); setView('change-pin') }}
            className="w-full py-2.5 rounded-xl bg-swu-bg border border-swu-border text-swu-text text-sm font-medium active:scale-[0.98] transition-transform">
            Cambiar PIN
          </button>
        </div>

        {/* Passkey Section */}
        <div className="bg-swu-surface rounded-2xl p-4 border border-swu-border space-y-3">
          <div className="flex items-center gap-2">
            <Fingerprint size={16} className="text-swu-accent" />
            <p className="text-sm font-bold text-swu-text">Passkey (Biometría)</p>
          </div>

          {currentProfile?.credentialId ? (
            <>
              <div className="flex items-center gap-2 bg-swu-green/10 rounded-lg px-3 py-2">
                <Shield size={14} className="text-swu-green" />
                <p className="text-xs text-swu-green font-medium">Passkey registrada y activa</p>
              </div>
              <button onClick={handleRemovePasskey}
                className="w-full py-2.5 rounded-xl bg-swu-red/10 border border-swu-red/30 text-swu-red text-sm font-medium active:scale-[0.98] transition-transform">
                Eliminar Passkey
              </button>
            </>
          ) : passkeySupported ? (
            <>
              <p className="text-xs text-swu-muted">Use huella/rostro para iniciar sesión más rápido</p>
              <button onClick={handleRegisterPasskeySecurity}
                className="w-full py-2.5 rounded-xl bg-swu-accent text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                <Fingerprint size={16} /> Registrar Passkey
              </button>
            </>
          ) : (
            <p className="text-xs text-swu-muted">Su dispositivo no soporta passkeys (WebAuthn)</p>
          )}
        </div>

        {/* Info */}
        <div className="bg-swu-bg rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-swu-muted">Acerca de la seguridad</p>
          <p className="text-[11px] text-swu-muted">Todos sus datos se almacenan localmente en su dispositivo. Si tiene una passkey, esta se sincroniza automáticamente vía iCloud Keychain (Apple) o Google Password Manager (Android/Chrome).</p>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // CHANGE PIN
  // ═══════════════════════════════════════════════════════════════════
  if (view === 'change-pin') {
    return (
      <div className="p-4 space-y-5 pb-24">
        <BackButton to="security" />
        <div className="text-center">
          <Key size={40} className="mx-auto text-swu-accent mb-2" />
          <h2 className="text-lg font-bold text-swu-text">Cambiar PIN</h2>
        </div>
        <div className="bg-swu-surface rounded-2xl p-5 border border-swu-border space-y-4">
          <div>
            <p className="text-xs text-swu-muted mb-1.5">PIN Actual</p>
            <PinInput value={oldPin} onChange={setOldPin} autoFocus />
          </div>
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Nuevo PIN (4-8 dígitos)</p>
            <PinInput value={newPin} onChange={setNewPin} />
          </div>
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Confirmar Nuevo PIN</p>
            <PinInput value={newPinConfirm} onChange={setNewPinConfirm} onSubmit={handleChangePin} />
          </div>

          {pinChangeError && <p className="text-sm text-swu-red text-center font-medium">{pinChangeError}</p>}
          {pinChangeSuccess && <p className="text-sm text-swu-green text-center font-medium">PIN cambiado exitosamente</p>}

          <button onClick={handleChangePin} disabled={oldPin.length < 4 || newPin.length < 4}
            className={`w-full py-3.5 rounded-xl font-bold text-base transition-all ${oldPin.length >= 4 && newPin.length >= 4 ? 'bg-swu-accent text-white active:scale-[0.98]' : 'bg-swu-border text-swu-muted cursor-not-allowed'}`}>
            Guardar Nuevo PIN
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // PROFILE VIEW (logged in)
  // ═══════════════════════════════════════════════════════════════════
  const menuItems = [
    { icon: History, label: 'Historial de Partidas', to: '/play/saved', count: stats.matches },
    { icon: Trophy, label: 'Mis Torneos', to: '/events/tournament', count: stats.tournaments },
    { icon: Layers, label: 'Mis Decks', to: '/decks', count: stats.decks },
    { icon: Heart, label: 'Cartas Favoritas', to: '/cards', count: stats.favorites },
    { icon: BookOpen, label: 'Base de Datos', to: '/cards' },
    { icon: Star, label: 'Ajustes', to: '/settings' },
  ]

  return (
    <div className="p-4 space-y-5 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-swu-accent/20 to-swu-green/10 rounded-2xl p-5 border border-swu-accent/30 flex items-center gap-4">
        <span className="text-5xl">{currentProfile?.avatar || '🎯'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-swu-accent font-bold uppercase tracking-widest">Perfil</p>
          <h2 className="text-xl font-extrabold text-swu-text truncate">{currentProfile?.name || 'Jugador'}</h2>
          {currentProfile?.email && (
            <p className="text-[11px] text-swu-muted truncate">{currentProfile.email}</p>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[11px] text-swu-muted">Desde {currentProfile ? new Date(currentProfile.createdAt).toLocaleDateString() : '—'}</p>
            {currentProfile?.credentialId && <Fingerprint size={10} className="text-swu-accent" />}
          </div>
        </div>
        <div className="flex items-center gap-1 bg-swu-green/20 px-2.5 py-1 rounded-full shrink-0">
          <Shield size={12} className="text-swu-green" />
          <span className="text-[11px] font-bold text-swu-green">Activo</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Partidas', value: stats.matches, color: 'text-swu-accent' },
          { label: 'Torneos', value: stats.tournaments, color: 'text-swu-amber' },
          { label: 'Decks', value: stats.decks, color: 'text-swu-green' },
          { label: 'Favoritos', value: stats.favorites, color: 'text-purple-400' },
        ].map((s) => (
          <div key={s.label} className="bg-swu-surface rounded-xl p-3 border border-swu-border text-center">
            <p className={`text-2xl font-extrabold font-mono ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-swu-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setView('customize')}
          className="bg-swu-surface rounded-xl px-4 py-3.5 border border-swu-accent/30 flex items-center gap-2 active:scale-[0.98] transition-transform">
          <Palette size={16} className="text-swu-accent" />
          <span className="text-sm font-medium text-swu-accent">Personalizar</span>
        </button>
        <button onClick={() => setView('security')}
          className="bg-swu-surface rounded-xl px-4 py-3.5 border border-swu-accent/30 flex items-center gap-2 active:scale-[0.98] transition-transform">
          <Shield size={16} className="text-swu-accent" />
          <span className="text-sm font-medium text-swu-accent">Seguridad</span>
        </button>
      </div>

      {/* Menu */}
      <div className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <button key={item.label} onClick={() => navigate(item.to)}
              className="w-full bg-swu-surface rounded-xl px-4 py-3.5 border border-swu-border flex items-center gap-3 active:scale-[0.99] transition-transform">
              <Icon size={18} className="text-swu-muted" />
              <span className="flex-1 text-left text-sm font-medium text-swu-text">{item.label}</span>
              {item.count !== undefined && <span className="text-xs text-swu-muted font-mono">{item.count}</span>}
              <ChevronRight size={16} className="text-swu-muted" />
            </button>
          )
        })}
      </div>

      {/* Logout */}
      <button onClick={() => { logout(); setView('select') }}
        className="w-full py-3 rounded-xl bg-swu-red/10 border border-swu-red/30 text-swu-red font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
        <LogOut size={18} /> Cerrar Sesión
      </button>
    </div>
  )
}

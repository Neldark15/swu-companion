import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, History, Heart, Star, Layers, BookOpen, Trophy,
  LogOut, UserPlus, User, Shield, Palette, Package, Globe,
  Fingerprint, Mail, ChevronLeft, Eye, EyeOff, Lock, KeyRound,
} from 'lucide-react'
import { db } from '../../services/db'
import { useAuth } from '../../hooks/useAuth'
import { syncStatsToCloud } from '../../services/sync'
import { isPasskeyReady } from '../../services/crypto'
import { createDefaultStats, getAspectBars, checkAchievements, calculateLevel, type PlayerStats } from '../../services/gamification'
import { XpBar } from './components/XpBar'
import { AspectBars } from './components/AspectBars'
import { AchievementGrid } from './components/AchievementGrid'
import { TriviaSection } from './components/TriviaSection'

/* ── Star Wars avatar options (images in /avatars/) ── */
const swAvatars = [
  { id: 'chewbacca', name: 'Chewbacca' },
  { id: 'r2d2', name: 'R2-D2' },
  { id: 'c3po', name: 'C-3PO' },
  { id: 'bb8', name: 'BB-8' },
  { id: 'pilot', name: 'Piloto' },
  { id: 'boba-fett', name: 'Boba Fett' },
  { id: 'stormtrooper', name: 'Stormtrooper' },
  { id: 'darth-vader', name: 'Darth Vader' },
  { id: 'phasma', name: 'Phasma' },
  { id: 'kylo-ren', name: 'Kylo Ren' },
  { id: 'jedi-order', name: 'Orden Jedi' },
  { id: 'phoenix', name: 'Fénix' },
  { id: 'rebel-alliance', name: 'Alianza Rebelde' },
  { id: 'galactic-empire', name: 'Imperio' },
  { id: 'first-order', name: 'Primera Orden' },
  { id: 'first-order-2', name: 'Primera Orden Alt' },
  { id: 'starfighter', name: 'Caza Estelar' },
  { id: 'sith-empire', name: 'Imperio Sith' },
  { id: 'rebel-alliance-2', name: 'Rebelde Alt' },
  { id: 'jedi-order-2', name: 'Jedi Alt' },
  { id: 'new-republic', name: 'Nueva República' },
  { id: 'empire-gear', name: 'Engranaje Imperial' },
  { id: 'separatist', name: 'Separatistas' },
  { id: 'galactic-republic', name: 'República Galáctica' },
]

/** Get avatar src from avatar string (supports old emojis + new ids) */
function getAvatarSrc(avatar: string): string | null {
  if (swAvatars.some(a => a.id === avatar)) {
    return `/avatars/${avatar}.png`
  }
  return null // it's an emoji
}

/** Render avatar: image or emoji fallback */
function AvatarDisplay({ avatar, size = 'md' }: { avatar: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const src = getAvatarSrc(avatar)
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
    xl: 'w-24 h-24',
  }
  const textSizes = { sm: 'text-xl', md: 'text-3xl', lg: 'text-5xl', xl: 'text-6xl' }

  if (src) {
    return <img src={src} alt={avatar} className={`${sizeClasses[size]} object-contain`} />
  }
  return <span className={textSizes[size]}>{avatar}</span>
}

type View = 'select' | 'register' | 'login' | 'forgot-password' | 'reset-password' | 'profile' | 'customize' | 'security' | 'register-passkey'

export function ProfilePage() {
  const navigate = useNavigate()
  const auth = useAuth()
  const { currentProfile, profiles, loadProfiles, logout, supabaseUser } = auth

  const [view, setView] = useState<View>(currentProfile ? 'profile' : 'select')
  const [stats, setStats] = useState({ matches: 0, tournaments: 0, decks: 0, favorites: 0 })
  const [passkeySupported, setPasskeySupported] = useState(false)
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null)

  // Register state
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('')
  const [regAvatar, setRegAvatar] = useState('darth-vader')
  const [regError, setRegError] = useState('')
  const [regLoading, setRegLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotSuccess, setForgotSuccess] = useState(false)

  // Reset password state (after recovery link)
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  // Customization state
  const [customAvatar, setCustomAvatar] = useState(currentProfile?.avatar || 'darth-vader')
  const [customName, setCustomName] = useState(currentProfile?.name || '')

  useEffect(() => { loadProfiles(); auth.initAuth() }, [])
  useEffect(() => { isPasskeyReady().then(setPasskeySupported) }, [])

  // Detect password recovery mode from Supabase link
  useEffect(() => {
    if (auth.isRecoveryMode) {
      setView('reset-password')
      setNewPassword('')
      setNewPasswordConfirm('')
      setResetError('')
      setResetSuccess(false)
    }
  }, [auth.isRecoveryMode])

  useEffect(() => {
    if (currentProfile) {
      setView('profile')
      setCustomAvatar(currentProfile.avatar)
      setCustomName(currentProfile.name)

      // Load basic stats
      Promise.all([
        db.matches.count(),
        db.tournaments.count(),
        db.decks.count(),
        db.favoriteCards.count(),
      ]).then(([matches, tournaments, decks, favorites]) => {
        setStats({ matches, tournaments, decks, favorites })
      })

      // Load or create player stats for gamification
      const loadPlayerStats = async () => {
        let ps = await db.playerStats.get(currentProfile.id)
        if (!ps) {
          ps = createDefaultStats(currentProfile.id)
          await db.playerStats.put(ps)
        }

        // Sync real counts from DB
        const [matchCount, tournamentCount, finishedTournaments, deckCount, validDecks, collectionCount, favCount] = await Promise.all([
          db.matches.count(),
          db.tournaments.count(),
          db.tournaments.where('status').equals('finished').count(),
          db.decks.count(),
          db.decks.filter(d => d.isValid).count(),
          db.collection.count(),
          db.favoriteCards.count(),
        ])

        ps = {
          ...ps,
          matchesPlayed: matchCount,
          tournamentsCreated: tournamentCount,
          tournamentsFinished: finishedTournaments,
          decksCreated: deckCount,
          decksValid: validDecks,
          cardsCollected: collectionCount,
          cardsFavorited: favCount,
        }

        // Check for passkey achievement
        if (currentProfile.credentialId && !ps.unlockedAchievements.includes('vil_2')) {
          ps.unlockedAchievements.push('vil_2')
          ps.achievementDates['vil_2'] = Date.now()
        }

        // Check all achievements
        const newUnlocks = checkAchievements(ps)
        if (newUnlocks.length > 0) {
          ps.unlockedAchievements = [...ps.unlockedAchievements, ...newUnlocks]
          for (const id of newUnlocks) {
            ps.achievementDates[id] = Date.now()
          }
        }

        // Recalculate XP from real activity
        const baseXp = matchCount * 10 + finishedTournaments * 50 + tournamentCount * 20 +
          deckCount * 15 + validDecks * 30 + favCount * 2 + collectionCount * 1
        if (baseXp > ps.xp) ps.xp = baseXp
        ps.level = calculateLevel(ps.xp).level

        await db.playerStats.put(ps)
        setPlayerStats(ps)

        // Sync updated stats to cloud so other users see them in Espionaje
        const { supabaseUser } = useAuth.getState()
        if (supabaseUser) {
          syncStatsToCloud(supabaseUser.id, ps).catch(() => {})
        }
      }

      loadPlayerStats()
    } else {
      setView('select')
      setPlayerStats(null)
    }
  }, [currentProfile])

  // ─── HANDLERS ───

  const handleRegister = async () => {
    setRegError('')
    if (!regName.trim() || regName.trim().length < 2) { setRegError('El nombre debe tener al menos 2 caracteres'); return }
    if (!regEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) { setRegError('Correo electrónico inválido'); return }
    if (regPassword.length < 6) { setRegError('La contraseña debe tener al menos 6 caracteres'); return }
    if (regPassword !== regPasswordConfirm) { setRegError('Las contraseñas no coinciden'); return }

    setRegLoading(true)
    const result = await auth.register({
      name: regName.trim(),
      email: regEmail.trim(),
      password: regPassword,
      avatar: regAvatar,
    })
    setRegLoading(false)

    if (!result.ok) {
      setRegError(result.error || 'Error al crear la cuenta')
      return
    }

    // Offer passkey registration
    if (passkeySupported) {
      setView('register-passkey')
    }
    // If no passkey, register already sets currentProfile → useEffect → 'profile'
  }

  const handleLogin = async () => {
    setLoginError('')
    if (!loginEmail.trim()) { setLoginError('Ingrese su correo electrónico'); return }
    if (!loginPassword) { setLoginError('Ingrese su contraseña'); return }

    setLoginLoading(true)
    const result = await auth.login(loginEmail.trim(), loginPassword)
    setLoginLoading(false)

    if (!result.ok) {
      setLoginError(result.error || 'Error al iniciar sesión')
      return
    }
    // login sets currentProfile → useEffect → 'profile'
    setLoginEmail(''); setLoginPassword('')
  }

  const handleForgotPassword = async () => {
    setForgotError(''); setForgotSuccess(false)
    if (!forgotEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail)) {
      setForgotError('Ingrese un correo electrónico válido'); return
    }
    const result = await auth.resetPassword(forgotEmail.trim())
    if (!result.ok) { setForgotError(result.error || 'Error al enviar correo'); return }
    setForgotSuccess(true)
  }

  const handleResetPassword = async () => {
    setResetError('')
    if (newPassword.length < 6) { setResetError('La contraseña debe tener al menos 6 caracteres'); return }
    if (newPassword !== newPasswordConfirm) { setResetError('Las contraseñas no coinciden'); return }

    setResetLoading(true)
    const result = await auth.updatePassword(newPassword)
    setResetLoading(false)

    if (!result.ok) {
      setResetError(result.error || 'Error al actualizar la contraseña')
      return
    }
    setResetSuccess(true)
  }

  const handleRegisterPasskey = async () => {
    await auth.registerPasskey()
    setView('profile')
  }

  const handleAnyPasskeyLogin = async () => {
    setLoginLoading(true)
    const ok = await auth.loginWithAnyPasskey()
    setLoginLoading(false)
    if (!ok) setLoginError('No se pudo autenticar con passkey')
  }

  const saveCustomization = async () => {
    await auth.updateProfile({ name: customName.trim() || currentProfile?.name, avatar: customAvatar })
    setView('profile')
  }

  // ─── BACK BUTTON ───
  const BackButton = ({ to, label }: { to: View; label?: string }) => (
    <button onClick={() => setView(to)} className="flex items-center gap-1 text-sm text-swu-muted mb-1">
      <ChevronLeft size={16} /> {label || 'Volver'}
    </button>
  )

  // ═══════════════════════════════════════════════════════════════════
  // SELECT (Landing)
  // ═══════════════════════════════════════════════════════════════════
  if (view === 'select') {
    const profilesWithPasskey = profiles.filter(p => p.credentialId)
    return (
      <div className="p-4 lg:p-6 space-y-5 pb-8 lg:pb-8 max-w-5xl mx-auto">
        <div className="text-center pt-2">
          <User size={40} className="mx-auto text-swu-accent mb-2" />
          <h2 className="text-lg font-bold text-swu-text">Bienvenido</h2>
          <p className="text-xs text-swu-muted mt-0.5">Inicie sesión o cree una cuenta nueva</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => { setLoginEmail(''); setLoginPassword(''); setLoginError(''); setView('login') }}
            className="bg-swu-surface rounded-xl p-4 border border-swu-accent/40 flex flex-col items-center gap-2 active:scale-[0.97] transition-transform">
            <div className="w-12 h-12 rounded-full bg-swu-accent/20 flex items-center justify-center">
              <Lock size={22} className="text-swu-accent" />
            </div>
            <span className="text-sm font-bold text-swu-accent">Iniciar Sesión</span>
            <span className="text-[10px] text-swu-muted">Email + contraseña</span>
          </button>
          <button onClick={() => { setRegName(''); setRegEmail(''); setRegPassword(''); setRegPasswordConfirm(''); setRegError(''); setRegAvatar('darth-vader'); setView('register') }}
            className="bg-swu-surface rounded-xl p-4 border border-swu-green/40 flex flex-col items-center gap-2 active:scale-[0.97] transition-transform">
            <div className="w-12 h-12 rounded-full bg-swu-green/20 flex items-center justify-center">
              <UserPlus size={22} className="text-swu-green" />
            </div>
            <span className="text-sm font-bold text-swu-green">Crear Cuenta</span>
            <span className="text-[10px] text-swu-muted">Registro gratuito</span>
          </button>
        </div>

        {/* Quick Passkey Login */}
        {passkeySupported && profilesWithPasskey.length > 0 && (
          <button onClick={handleAnyPasskeyLogin} disabled={loginLoading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-swu-accent/20 to-purple-500/20 border border-swu-accent/40 font-bold text-sm flex items-center justify-center gap-2 text-swu-accent active:scale-[0.98] transition-transform disabled:opacity-50">
            <Fingerprint size={20} />
            {loginLoading ? 'Verificando...' : 'Iniciar con Passkey'}
          </button>
        )}

        {/* Info about cloud accounts */}
        <div className="bg-swu-bg rounded-xl p-3 flex items-start gap-2">
          <Shield size={14} className="text-swu-green mt-0.5 shrink-0" />
          <p className="text-[11px] text-swu-muted">
            Las cuentas se guardan en la nube. Puede iniciar sesión desde cualquier dispositivo con su correo y contraseña.
          </p>
        </div>

        <button onClick={() => navigate('/')} className="w-full py-2 text-sm text-swu-muted text-center">
          Continuar sin cuenta
        </button>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // REGISTER
  // ═══════════════════════════════════════════════════════════════════
  if (view === 'register') {
    return (
      <div className="p-4 lg:p-6 space-y-5 pb-8 lg:pb-8 max-w-5xl mx-auto">
        <BackButton to="select" />
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <AvatarDisplay avatar={regAvatar} size="xl" />
          </div>
          <h2 className="text-lg font-bold text-swu-text">Crear Cuenta</h2>
          <p className="text-xs text-swu-muted mt-0.5">Su cuenta se sincroniza en todos sus dispositivos</p>
        </div>
        <div className="bg-swu-surface rounded-2xl p-5 border border-swu-border space-y-4">
          {/* Avatar selector */}
          <div>
            <p className="text-xs text-swu-muted mb-2">Elige tu avatar</p>
            <div className="grid grid-cols-5 gap-2 justify-items-center">
              {swAvatars.map((a) => (
                <button key={a.id} onClick={() => setRegAvatar(a.id)}
                  className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 transition-all p-1 ${regAvatar === a.id ? 'border-swu-accent bg-swu-accent/20 scale-110' : 'border-swu-border bg-swu-bg'}`}>
                  <img src={`/avatars/${a.id}.png`} alt={a.name} className="w-10 h-10 object-contain" />
                </button>
              ))}
            </div>
            {regAvatar && (
              <p className="text-[10px] text-swu-accent text-center mt-1.5 font-mono tracking-wider">
                {swAvatars.find(a => a.id === regAvatar)?.name}
              </p>
            )}
          </div>
          {/* Name */}
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Nombre de Jugador *</p>
            <input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Su nombre o nickname" maxLength={30}
              className="w-full bg-swu-bg border border-swu-border rounded-xl p-3 text-sm text-swu-text outline-none focus:border-swu-accent" />
          </div>
          {/* Email */}
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Correo Electrónico *</p>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
              <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="correo@ejemplo.com"
                className="w-full bg-swu-bg border border-swu-border rounded-xl p-3 pl-10 text-sm text-swu-text outline-none focus:border-swu-accent" />
            </div>
          </div>
          {/* Password */}
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Contraseña * (mínimo 6 caracteres)</p>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
              <input type={showPassword ? 'text' : 'password'} value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="••••••••"
                className="w-full bg-swu-bg border border-swu-border rounded-xl p-3 pl-10 pr-12 text-sm text-swu-text outline-none focus:border-swu-accent" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-swu-muted p-1">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {/* Confirm Password */}
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Confirmar Contraseña *</p>
            <input type={showPassword ? 'text' : 'password'} value={regPasswordConfirm} onChange={(e) => setRegPasswordConfirm(e.target.value)} placeholder="••••••••"
              onKeyDown={(e) => { if (e.key === 'Enter') handleRegister() }}
              className="w-full bg-swu-bg border border-swu-border rounded-xl p-3 text-sm text-swu-text outline-none focus:border-swu-accent" />
          </div>

          {regError && <p className="text-sm text-swu-red text-center font-medium">{regError}</p>}

          <button onClick={handleRegister} disabled={regLoading}
            className={`w-full py-3.5 rounded-xl font-bold text-base transition-all ${!regLoading ? 'bg-swu-green text-white active:scale-[0.98]' : 'bg-swu-border text-swu-muted'}`}>
            {regLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
          </button>

          <p className="text-[10px] text-swu-muted text-center">
            Al crear una cuenta, acepta que sus datos se almacenan de forma segura en la nube.
          </p>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // REGISTER PASSKEY (optional, after signup)
  // ═══════════════════════════════════════════════════════════════════
  if (view === 'register-passkey') {
    return (
      <div className="p-4 lg:p-6 space-y-5 pb-8 lg:pb-8 max-w-5xl mx-auto">
        <div className="text-center pt-4">
          <Fingerprint size={56} className="mx-auto text-swu-accent mb-3" />
          <h2 className="text-lg font-bold text-swu-text">Inicio Rápido</h2>
          <p className="text-xs text-swu-muted mt-0.5">Passkey (opcional)</p>
        </div>
        <div className="bg-swu-surface rounded-2xl p-5 border border-swu-border space-y-4">
          <p className="text-sm text-swu-text text-center">
            ¿Usar huella digital o reconocimiento facial para iniciar sesión rápidamente en este dispositivo?
          </p>
          {['Su passkey se sincroniza con iCloud/Google', 'Más rápido que escribir contraseña', 'Inicie sesión en un toque'
          ].map((t) => (
            <div key={t} className="flex items-center gap-2 text-xs text-swu-muted">
              <Shield size={12} className="text-swu-green shrink-0" /><span>{t}</span>
            </div>
          ))}
          <button onClick={handleRegisterPasskey}
            className="w-full py-3.5 rounded-xl bg-swu-accent text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
            <Fingerprint size={20} /> Registrar Passkey
          </button>
          <button onClick={() => setView('profile')} className="w-full py-2 text-sm text-swu-muted text-center">
            Omitir por ahora
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════════
  if (view === 'login') {
    return (
      <div className="p-4 lg:p-6 space-y-5 pb-8 lg:pb-8 max-w-5xl mx-auto">
        <BackButton to="select" />
        <div className="text-center">
          <Lock size={40} className="mx-auto text-swu-accent mb-2" />
          <h2 className="text-lg font-bold text-swu-text">Iniciar Sesión</h2>
          <p className="text-xs text-swu-muted mt-0.5">Ingrese con su correo y contraseña</p>
        </div>
        <div className="bg-swu-surface rounded-2xl p-5 border border-swu-border space-y-4">
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Correo Electrónico</p>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
              <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="correo@ejemplo.com" autoFocus
                className="w-full bg-swu-bg border border-swu-border rounded-xl p-3 pl-10 text-sm text-swu-text outline-none focus:border-swu-accent" />
            </div>
          </div>
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Contraseña</p>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
              <input type={showPassword ? 'text' : 'password'} value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••"
                onKeyDown={(e) => { if (e.key === 'Enter') handleLogin() }}
                className="w-full bg-swu-bg border border-swu-border rounded-xl p-3 pl-10 pr-12 text-sm text-swu-text outline-none focus:border-swu-accent" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-swu-muted p-1">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {loginError && <p className="text-sm text-swu-red text-center font-medium">{loginError}</p>}

          <button onClick={handleLogin} disabled={loginLoading}
            className={`w-full py-3.5 rounded-xl font-bold text-base transition-all ${!loginLoading ? 'bg-swu-accent text-white active:scale-[0.98]' : 'bg-swu-border text-swu-muted'}`}>
            {loginLoading ? 'Verificando...' : 'Ingresar'}
          </button>

          <button onClick={() => { setForgotEmail(loginEmail); setForgotError(''); setForgotSuccess(false); setView('forgot-password') }}
            className="w-full py-2 text-sm text-swu-accent text-center font-medium">
            ¿Olvidó su contraseña?
          </button>

          {passkeySupported && profiles.some(p => p.credentialId) && (
            <button onClick={handleAnyPasskeyLogin} disabled={loginLoading}
              className="w-full py-3 rounded-xl bg-swu-accent/10 border border-swu-accent/30 text-swu-accent font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50">
              <Fingerprint size={18} /> Usar Passkey
            </button>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // FORGOT PASSWORD
  // ═══════════════════════════════════════════════════════════════════
  if (view === 'forgot-password') {
    return (
      <div className="p-4 lg:p-6 space-y-5 pb-8 lg:pb-8 max-w-5xl mx-auto">
        <BackButton to="login" />
        <div className="text-center">
          <Mail size={40} className="mx-auto text-swu-accent mb-2" />
          <h2 className="text-lg font-bold text-swu-text">Recuperar Contraseña</h2>
          <p className="text-xs text-swu-muted mt-0.5">Le enviaremos un enlace para restablecer su contraseña</p>
        </div>
        <div className="bg-swu-surface rounded-2xl p-5 border border-swu-border space-y-4">
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Correo Electrónico</p>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
              <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="correo@ejemplo.com" autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleForgotPassword() }}
                className="w-full bg-swu-bg border border-swu-border rounded-xl p-3 pl-10 text-sm text-swu-text outline-none focus:border-swu-accent" />
            </div>
          </div>

          {forgotError && <p className="text-sm text-swu-red text-center font-medium">{forgotError}</p>}
          {forgotSuccess && (
            <div className="bg-swu-green/10 rounded-lg p-3 border border-swu-green/30">
              <p className="text-sm text-swu-green text-center font-medium">Correo enviado exitosamente</p>
              <p className="text-[10px] text-swu-muted text-center mt-1">Revise su bandeja de entrada (y spam) para el enlace de recuperación.</p>
            </div>
          )}

          <button onClick={handleForgotPassword} disabled={forgotSuccess}
            className={`w-full py-3.5 rounded-xl font-bold text-base transition-all ${!forgotSuccess ? 'bg-swu-accent text-white active:scale-[0.98]' : 'bg-swu-border text-swu-muted'}`}>
            Enviar Enlace
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // RESET PASSWORD (after clicking recovery link)
  // ═══════════════════════════════════════════════════════════════════
  if (view === 'reset-password') {
    return (
      <div className="p-4 lg:p-6 space-y-5 pb-8 lg:pb-8 max-w-5xl mx-auto">
        <div className="text-center">
          <KeyRound size={40} className="mx-auto text-swu-accent mb-2" />
          <h2 className="text-lg font-bold text-swu-text">Nueva Contraseña</h2>
          <p className="text-xs text-swu-muted mt-0.5">Ingrese su nueva contraseña para restablecer el acceso</p>
        </div>
        <div className="bg-swu-surface rounded-2xl p-5 border border-swu-border space-y-4">
          {!resetSuccess ? (
            <>
              <div>
                <p className="text-xs text-swu-muted mb-1.5">Nueva Contraseña * (mínimo 6 caracteres)</p>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
                  <input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" autoFocus
                    className="w-full bg-swu-bg border border-swu-border rounded-xl p-3 pl-10 pr-12 text-sm text-swu-text outline-none focus:border-swu-accent" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-swu-muted p-1">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs text-swu-muted mb-1.5">Confirmar Nueva Contraseña *</p>
                <input type={showPassword ? 'text' : 'password'} value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} placeholder="••••••••"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleResetPassword() }}
                  className="w-full bg-swu-bg border border-swu-border rounded-xl p-3 text-sm text-swu-text outline-none focus:border-swu-accent" />
              </div>

              {resetError && <p className="text-sm text-swu-red text-center font-medium">{resetError}</p>}

              <button onClick={handleResetPassword} disabled={resetLoading}
                className={`w-full py-3.5 rounded-xl font-bold text-base transition-all ${!resetLoading ? 'bg-swu-accent text-white active:scale-[0.98]' : 'bg-swu-border text-swu-muted'}`}>
                {resetLoading ? 'Actualizando...' : 'Cambiar Contraseña'}
              </button>
            </>
          ) : (
            <>
              <div className="bg-swu-green/10 rounded-lg p-4 border border-swu-green/30 text-center">
                <Shield size={28} className="mx-auto text-swu-green mb-2" />
                <p className="text-sm text-swu-green font-bold">Contraseña actualizada exitosamente</p>
                <p className="text-[10px] text-swu-muted mt-1">Ya puede iniciar sesión con su nueva contraseña</p>
              </div>
              <button onClick={() => { auth.clearRecoveryMode(); setView(currentProfile ? 'profile' : 'select') }}
                className="w-full py-3.5 rounded-xl bg-swu-accent text-white font-bold text-base active:scale-[0.98] transition-transform">
                Continuar
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // CUSTOMIZE
  // ═══════════════════════════════════════════════════════════════════
  if (view === 'customize') {
    return (
      <div className="p-4 lg:p-6 space-y-5 pb-8 lg:pb-8 max-w-5xl mx-auto">
        <BackButton to="profile" />
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <AvatarDisplay avatar={customAvatar} size="xl" />
          </div>
          <h2 className="text-lg font-bold text-swu-text">Personalizar Perfil</h2>
        </div>
        <div className="bg-swu-surface rounded-2xl p-5 border border-swu-border space-y-5">
          <div>
            <p className="text-xs text-swu-muted mb-2">Elige tu avatar</p>
            <div className="grid grid-cols-5 gap-2 justify-items-center">
              {swAvatars.map((a) => (
                <button key={a.id} onClick={() => setCustomAvatar(a.id)}
                  className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 transition-all p-1 ${customAvatar === a.id ? 'border-swu-accent bg-swu-accent/20 scale-110' : 'border-swu-border bg-swu-bg'}`}>
                  <img src={`/avatars/${a.id}.png`} alt={a.name} className="w-10 h-10 object-contain" />
                </button>
              ))}
            </div>
            {customAvatar && (
              <p className="text-[10px] text-swu-accent text-center mt-1.5 font-mono tracking-wider">
                {swAvatars.find(a => a.id === customAvatar)?.name || customAvatar}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Nombre</p>
            <input value={customName} onChange={(e) => setCustomName(e.target.value)} maxLength={30}
              className="w-full bg-swu-bg border border-swu-border rounded-xl p-3 text-sm text-swu-text outline-none focus:border-swu-accent" />
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
      <div className="p-4 lg:p-6 space-y-5 pb-8 lg:pb-8 max-w-5xl mx-auto">
        <BackButton to="profile" />
        <div className="text-center">
          <Shield size={40} className="mx-auto text-swu-accent mb-2" />
          <h2 className="text-lg font-bold text-swu-text">Seguridad</h2>
        </div>

        {/* Account info */}
        <div className="bg-swu-surface rounded-2xl p-4 border border-swu-border space-y-3">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-swu-accent" />
            <p className="text-sm font-bold text-swu-text">Cuenta</p>
          </div>
          <p className="text-xs text-swu-muted">{currentProfile?.email || 'Sin correo'}</p>
          <div className="flex items-center gap-2 bg-swu-green/10 rounded-lg px-3 py-2">
            <Shield size={14} className="text-swu-green" />
            <p className="text-xs text-swu-green font-medium">Cuenta sincronizada en la nube</p>
          </div>
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
              <button onClick={async () => { if (confirm('¿Eliminar la passkey?')) await auth.removePasskey() }}
                className="w-full py-2.5 rounded-xl bg-swu-red/10 border border-swu-red/30 text-swu-red text-sm font-medium active:scale-[0.98] transition-transform">
                Eliminar Passkey
              </button>
            </>
          ) : passkeySupported ? (
            <>
              <p className="text-xs text-swu-muted">Use huella/rostro para iniciar sesión más rápido</p>
              <button onClick={() => auth.registerPasskey()}
                className="w-full py-2.5 rounded-xl bg-swu-accent text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                <Fingerprint size={16} /> Registrar Passkey
              </button>
            </>
          ) : (
            <p className="text-xs text-swu-muted">Su dispositivo no soporta passkeys</p>
          )}
        </div>

        <div className="bg-swu-bg rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-swu-muted">Acerca de la seguridad</p>
          <p className="text-[11px] text-swu-muted">Su cuenta está protegida por Supabase Auth. La contraseña se almacena encriptada en la nube. La passkey es local de este dispositivo para acceso rápido.</p>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // PROFILE VIEW (logged in) — GAMIFIED
  // ═══════════════════════════════════════════════════════════════════
  const levelInfo = playerStats ? calculateLevel(playerStats.xp) : null
  const aspectBars = playerStats ? getAspectBars(playerStats) : []

  const menuItems = [
    { icon: Package, label: 'Mi Botín de Cartas', to: '/collection', count: undefined, highlight: true },
    { icon: Globe, label: 'Contrabando de Cartas', to: '/explore' },
    { icon: History, label: 'Historial de Partidas', to: '/play/saved', count: stats.matches },
    { icon: Trophy, label: 'Mis Torneos', to: '/events/tournament', count: stats.tournaments },
    { icon: Layers, label: 'Mis Decks', to: '/decks', count: stats.decks },
    { icon: Heart, label: 'Cartas Favoritas', to: '/cards', count: stats.favorites },
    { icon: BookOpen, label: 'Base de Datos', to: '/cards' },
    { icon: Star, label: 'Ajustes', to: '/settings' },
  ]

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-8 lg:pb-8 max-w-5xl mx-auto">
      {/* Header with level */}
      <div className="bg-gradient-to-br from-swu-accent/15 to-amber-500/10 rounded-2xl p-4 border border-swu-accent/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative">
            <AvatarDisplay avatar={currentProfile?.avatar || 'darth-vader'} size="lg" />
            {levelInfo && (
              <div className={`absolute -bottom-1 -right-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md ${levelInfo.rank.bgColor} ${levelInfo.rank.color} ${levelInfo.rank.borderColor} border`}>
                {levelInfo.level}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-extrabold text-swu-text truncate">{currentProfile?.name || 'Jugador'}</h2>
            <div className="flex items-center gap-2">
              {levelInfo && <span className={`text-[11px] font-bold ${levelInfo.rank.color}`}>{levelInfo.rank.name}</span>}
              {currentProfile?.credentialId && <Fingerprint size={10} className="text-swu-accent" />}
              {supabaseUser && (
                <span className="text-[9px] bg-swu-green/20 text-swu-green px-1.5 py-0.5 rounded-full font-bold">Online</span>
              )}
            </div>
          </div>
        </div>
        {playerStats && <XpBar xp={playerStats.xp} />}
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { label: 'Partidas', value: stats.matches, color: 'text-blue-400' },
          { label: 'Victorias', value: playerStats?.wins || 0, color: 'text-red-400' },
          { label: 'Decks', value: stats.decks, color: 'text-yellow-400' },
          { label: 'Racha', value: playerStats?.bestStreak || 0, color: 'text-amber-400' },
        ].map((s) => (
          <div key={s.label} className="bg-swu-surface rounded-lg p-2 border border-swu-border text-center">
            <p className={`text-xl font-extrabold font-mono ${s.color}`}>{s.value}</p>
            <p className="text-[9px] text-swu-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Aspect Bars */}
      {aspectBars.length > 0 && (
        <div className="bg-swu-surface rounded-2xl p-4 border border-swu-border">
          <AspectBars bars={aspectBars} />
        </div>
      )}

      {/* Achievements */}
      {playerStats && (
        <div className="bg-swu-surface rounded-2xl p-4 border border-swu-border">
          <AchievementGrid unlockedIds={playerStats.unlockedAchievements} achievementDates={playerStats.achievementDates} />
        </div>
      )}

      {/* Archivos Jedi — Trivia diaria */}
      {auth.supabaseUser && (
        <div className="bg-swu-surface rounded-2xl p-4 border border-swu-border">
          <TriviaSection
            userId={auth.supabaseUser.id}
            onXpGained={(xp) => {
              if (playerStats) {
                const updated = { ...playerStats, xp: playerStats.xp + xp }
                setPlayerStats(updated)
              }
            }}
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setView('customize')}
          className="bg-swu-surface rounded-xl px-3 py-3 border border-swu-accent/30 flex items-center gap-2 active:scale-[0.98] transition-transform">
          <Palette size={16} className="text-swu-accent" />
          <span className="text-sm font-medium text-swu-accent">Personalizar</span>
        </button>
        <button onClick={() => setView('security')}
          className="bg-swu-surface rounded-xl px-3 py-3 border border-swu-accent/30 flex items-center gap-2 active:scale-[0.98] transition-transform">
          <Shield size={16} className="text-swu-accent" />
          <span className="text-sm font-medium text-swu-accent">Seguridad</span>
        </button>
      </div>

      {/* Menu */}
      <div className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isHighlight = 'highlight' in item && item.highlight
          return (
            <button key={item.label} onClick={() => navigate(item.to)}
              className={`w-full rounded-xl px-4 py-3 border flex items-center gap-3 active:scale-[0.99] transition-transform ${
                isHighlight
                  ? 'bg-swu-accent/10 border-swu-accent/30'
                  : 'bg-swu-surface border-swu-border'
              }`}>
              <Icon size={18} className={isHighlight ? 'text-swu-accent' : 'text-swu-muted'} />
              <span className={`flex-1 text-left text-sm font-medium ${isHighlight ? 'text-swu-accent' : 'text-swu-text'}`}>{item.label}</span>
              {item.count !== undefined && <span className="text-xs text-swu-muted font-mono">{item.count}</span>}
              <ChevronRight size={16} className="text-swu-muted" />
            </button>
          )
        })}
      </div>

      {/* Logout */}
      <button onClick={async () => { await logout(); setView('select') }}
        className="w-full py-3 rounded-xl bg-swu-red/10 border border-swu-red/30 text-swu-red font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
        <LogOut size={18} /> Cerrar Sesión
      </button>
    </div>
  )
}

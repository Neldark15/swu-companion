import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, History, Heart, Star, Layers, BookOpen, Trophy,
  LogOut, UserPlus, User, Shield, Palette, Package, Globe,
  Fingerprint, Mail, ChevronLeft, Eye, EyeOff, Lock, KeyRound,
  Camera,
} from 'lucide-react'
import { db } from '../../services/db'
import { useAuth } from '../../hooks/useAuth'
import { useSettings } from '../../hooks/useSettings'
import { PersonalizarPerfil } from './PersonalizarPerfil'
import { syncStatsToCloud } from '../../services/sync'
import { isPasskeyReady } from '../../services/crypto'
import { createDefaultStats, getAspectBars, checkAchievements, calculateLevel, type PlayerStats } from '../../services/gamification'
import { announceProgression, takeProgressionSnapshot } from '../../services/progressionService'
import { LightsaberXpBar } from './components/LightsaberXpBar'
import { ProfileFrame } from './components/ProfileFrame'
import { BannerPortadaUsuario } from './BannerPortada'
import { AspectBars } from './components/AspectBars'
import { AchievementGrid } from './components/AchievementGrid'
import { TriviaSection } from './components/TriviaSection'
import { CONTINENTS, getCountryByCode } from '../../data/regions'
import { MoreNav } from '../../components/layout/MoreNav'
import { WhatsappSetting } from './WhatsappSetting'
import { swAvatars } from '../../data/avatars'
import { isPhotoAvatar, urlAvatarSW } from '../../services/avatars'
import { MeleeSetting } from './MeleeSetting'
import { MeleeRecord } from './MeleeRecord'
import { leerEnlaceMelee } from '../../services/meleeProfileService'
import { Avatar } from '../../components/ui/Avatar'

/** Compress and resize image to a max dimension, returns data URI */
async function compressImage(file: File, maxSize = 200, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > height) {
        if (width > maxSize) { height *= maxSize / width; width = maxSize }
      } else {
        if (height > maxSize) { width *= maxSize / height; height = maxSize }
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

type View = 'select' | 'register' | 'login' | 'forgot-password' | 'reset-password' | 'profile' | 'customize' | 'security' | 'register-passkey'

/**
 * Volver.
 *
 * Estaba declarado DENTRO de ProfilePage, así que se recreaba en cada
 * pintada: React lo veía como un tipo de componente nuevo, desmontaba el
 * anterior y montaba otro. En un botón no se nota el estado perdido, pero sí
 * el trabajo tirado — y la regla existe porque en un componente con estado
 * eso es un fallo silencioso muy caro de encontrar.
 */
function BackButton({ to, label, onIr }: { to: View; label?: string; onIr: (v: View) => void }) {
  return (
    <button onClick={() => onIr(to)} className="flex items-center gap-1 text-sm text-swu-muted mb-1">
      <ChevronLeft size={16} /> {label || 'Volver'}
    </button>
  )
}

export function ProfilePage() {
  // El marco que la persona ELIGIÓ en Ajustes: es SU perfil, así que acá sí
  // se pasa al ProfileFrame (en perfiles ajenos se queda el 'auto' por nivel).
  const marcoElegido = useSettings((s) => s.marcoElegido)
  const navigate = useNavigate()
  const auth = useAuth()
  const { currentProfile, profiles, loadProfiles, logout, supabaseUser } = auth

  // `?editar=perfil` abre directo la personalización (portada, vitrina…). Lo usa
  // el asistente de «terminá tu perfil» para no dejar al usuario buscando dónde
  // se elige el banner. Se lee en el inicializador —una sola vez, al montar— en
  // vez de en un efecto: setear el estado dentro de un efecto dispara la regla
  // `set-state-in-effect`. Llega acá por navegación DENTRO de la app, con la
  // sesión ya cargada, así que `currentProfile` existe.
  const [view, setView] = useState<View>(() => {
    const editar = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('editar')
      : null
    if (currentProfile && editar === 'perfil') return 'customize'
    return currentProfile ? 'profile' : 'select'
  })
  // Limpia el `?editar` para que un refresco no reabra la personalización, y
  // para no dejar un query que la restauración de ruta (gotcha 2w) rechaza.
  // Se usa `navigate` y NO un setState, justamente para no volver a chocar con
  // la regla del efecto.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('editar')) {
      navigate('/profile', { replace: true })
    }
  }, [navigate])
  const [stats, setStats] = useState({ matches: 0, tournaments: 0, decks: 0, favorites: 0 })
  const [passkeySupported, setPasskeySupported] = useState(false)
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null)
  /** Enlace a melee. Se lee acá y no dentro de MeleeRecord para que la
   *  sección del historial ni siquiera se monte si nadie enlazó nada. */
  const [melee, setMelee] = useState<{ usuario: string | null; verificado: boolean }>(
    { usuario: null, verificado: false },
  )

  useEffect(() => {
    // Sin sesión no se limpia con un `setState` acá: eso es un render en
    // cascada dentro del efecto. La sección ya está condicionada a
    // `auth.supabaseUser`, así que un valor viejo no se dibuja igual.
    if (!supabaseUser) return
    let vivo = true
    void leerEnlaceMelee(supabaseUser.id).then(r => { if (vivo) setMelee(r) })
    return () => { vivo = false }
  }, [supabaseUser])

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
  const [customCountry, setCustomCountry] = useState(currentProfile?.country || '')
  const [customContinent, setCustomContinent] = useState(currentProfile?.continent || '')

  /**
   * ¿Se entró pidiendo la personalización? (`?editar=perfil`, el enlace del
   * aviso «terminá tu perfil» de Inicio.)
   *
   * El inicializador de `view` de arriba ya lo mira, pero en arranque FRÍO
   * `currentProfile` todavía es null y devuelve 'select'; después llega el
   * perfil y el efecto de más abajo mandaba a 'profile' sin excepción. O sea
   * que el ÚNICO camino que ese aviso ofrece para poner el país no llegaba
   * nunca a la pantalla que lo pone.
   *
   * Va en un ref y no en estado porque se consume UNA vez: si el deseo
   * sobreviviera, cada cambio del perfil —incluido guardar— reabriría la
   * personalización que se acaba de cerrar.
   */
  const pidioEditar = useRef(
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('editar') === 'perfil',
  )

  /* Acá había también un `auth.initAuth()`. AppLayout —que es ancestro de esta
     página— ya lo llama al montar, así que este solo repetía `getSession` +
     el rol + `pullAllFromCloud` en CADA visita, y Perfil es uno de los cinco
     destinos de la barra de abajo: entrar y salir tres veces eran tres rondas
     de consultas sobre datos móviles. `loadProfiles()` sí hace falta, y es
     local. (El de AdminLayout NO es redundante: /admin cuelga fuera de
     AppLayout.) */
  useEffect(() => { loadProfiles() }, [])
  useEffect(() => { isPasskeyReady().then(setPasskeySupported) }, [])

  // Detect password recovery mode from Supabase link
  useEffect(() => {
    if (!auth.isRecoveryMode) return
    // El modo recuperación llega de fuera —Supabase lo detecta en el enlace
    // del correo—, así que sincronizarlo con un efecto es correcto. Lo que no
    // lo es es hacerlo de forma SÍNCRONA: eso encadena un render antes de que
    // React pinte. Con el microtask se aplica igual de rápido, en el mismo
    // ciclo, pero después del pintado.
    queueMicrotask(() => {
      setView('reset-password')
      setNewPassword('')
      setNewPasswordConfirm('')
      setResetError('')
      setResetSuccess(false)
    })
  }, [auth.isRecoveryMode])

  useEffect(() => {
    if (currentProfile) {
      // Mismo caso: el perfil activo lo decide el almacén de sesión, que es
      // un sistema externo. Se aplica en un microtask para no encadenar un
      // render dentro del efecto.
      queueMicrotask(() => {
        if (pidioEditar.current) { pidioEditar.current = false; setView('customize') }
        else setView('profile')
        setCustomAvatar(currentProfile.avatar)
        setCustomName(currentProfile.name)
        /* Y el país y el continente, que faltaban.
         *
         * Los cuatro campos del borrador se siembran en el `useState` de
         * montaje, que en arranque frío corre con `currentProfile` en null.
         * Avatar y nombre se reponían acá; país y continente no. Resultado
         * medido en el código: entrar directo a /profile con la app recién
         * abierta y guardar CUALQUIER cosa mandaba `country: undefined`, y la
         * pantalla quedaba mostrando «sin región» a alguien que sí la tenía.
         *
         * La nube se salva por el guardián de `syncProfileToCloud` (no escribe
         * si viene vacío), así que el dato no se perdía de verdad — pero el
         * selector mentía hasta la siguiente bajada de la nube, y para quien
         * lo mira eso es exactamente igual que haberlo perdido. */
        setCustomCountry(currentProfile.country || '')
        setCustomContinent(currentProfile.continent || '')
      })

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
        const isFirstRun = !ps
        if (!ps) {
          ps = createDefaultStats(currentProfile.id)
          await db.playerStats.put(ps)
        }

        // Snapshot BEFORE recomputation so we can announce what changed.
        // Skipped on a brand-new profile — nothing to celebrate yet.
        const before = isFirstRun ? null : takeProgressionSnapshot(ps)

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

        // Announce every milestone crossed (achievements, level, aspect tiers,
        // titles) and persist newly earned titles — they were computed but
        // never stored before. With a cloud session, the milestone also
        // publishes itself to the community feed.
        const { supabaseUser: feedUser } = useAuth.getState()
        const feedAuthor = feedUser
          ? { userId: feedUser.id, userName: currentProfile.name, userAvatar: currentProfile.avatar }
          : null
        const { newTitleIds } = announceProgression(before, ps, feedAuthor)
        if (newTitleIds.length > 0) {
          ps.unlockedTitles = Array.from(new Set([...(ps.unlockedTitles || []), ...newTitleIds]))
        }

        await db.playerStats.put(ps)
        setPlayerStats(ps)

        // Sync updated stats to cloud so other users see them in Espionaje
        const { supabaseUser } = useAuth.getState()
        if (supabaseUser) {
          syncStatsToCloud(supabaseUser.id, ps).catch(() => {})
        }
      }

      void loadPlayerStats()
    } else {
      // Sin perfil se vuelve a la pantalla de selección. Igual que arriba: es
      // sincronizar con el almacén de sesión, y va en un microtask para no
      // encadenar un render dentro del efecto.
      queueMicrotask(() => {
        setView('select')
        setPlayerStats(null)
      })
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
    await auth.updateProfile({
      name: customName.trim() || currentProfile?.name,
      avatar: customAvatar,
      country: customCountry || undefined,
      continent: customContinent || undefined,
    })
    setView('profile')
  }

  // ─── BACK BUTTON ───

  // ═══════════════════════════════════════════════════════════════════
  // SELECT (Landing)
  // ═══════════════════════════════════════════════════════════════════
  if (view === 'select') {
    const profilesWithPasskey = profiles.filter(p => p.credentialId)
    return (
      <div className="p-4 lg:p-6 space-y-5 pb-8 lg:pb-8 max-w-5xl mx-auto">
        <div className="text-center pt-2">
          <User size={40} className="mx-auto text-swu-accent-texto mb-2" />
          <h2 className="text-lg font-bold text-swu-text">Bienvenido</h2>
          <p className="text-xs text-swu-muted mt-0.5">Inicie sesión o cree una cuenta nueva</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => { setLoginEmail(''); setLoginPassword(''); setLoginError(''); setView('login') }}
            className="bg-swu-surface rounded-xl p-4 border border-swu-accent/40 flex flex-col items-center gap-2 active:scale-[0.97] transition-transform">
            <div className="w-12 h-12 rounded-full bg-swu-accent/20 flex items-center justify-center">
              <Lock size={22} className="text-swu-accent-texto" />
            </div>
            <span className="text-sm font-bold text-swu-accent-texto">Iniciar Sesión</span>
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
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-swu-accent/20 to-purple-500/20 border border-swu-accent/40 font-bold text-sm flex items-center justify-center gap-2 text-swu-accent-texto active:scale-[0.98] transition-transform disabled:opacity-50">
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
        <BackButton to="select" onIr={setView} />
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <Avatar avatar={regAvatar} size={96} caja="circulo" escalaIcono={0.82} />
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
                  <img src={urlAvatarSW(a.id)} alt={a.name} className="w-10 h-10 object-contain" />
                </button>
              ))}
            </div>
            {regAvatar && (
              <p className="text-[10px] text-swu-accent-texto text-center mt-1.5 font-mono tracking-wider">
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

          {regError && <p className="text-sm text-swu-red-texto text-center font-medium">{regError}</p>}

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
          <Fingerprint size={56} className="mx-auto text-swu-accent-texto mb-3" />
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
        <BackButton to="select" onIr={setView} />
        <div className="text-center">
          <Lock size={40} className="mx-auto text-swu-accent-texto mb-2" />
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

          {loginError && <p className="text-sm text-swu-red-texto text-center font-medium">{loginError}</p>}

          <button onClick={handleLogin} disabled={loginLoading}
            className={`w-full py-3.5 rounded-xl font-bold text-base transition-all ${!loginLoading ? 'bg-swu-accent text-white active:scale-[0.98]' : 'bg-swu-border text-swu-muted'}`}>
            {loginLoading ? 'Verificando...' : 'Ingresar'}
          </button>

          <button onClick={() => { setForgotEmail(loginEmail); setForgotError(''); setForgotSuccess(false); setView('forgot-password') }}
            className="w-full py-2 text-sm text-swu-accent-texto text-center font-medium">
            ¿Olvidó su contraseña?
          </button>

          {passkeySupported && profiles.some(p => p.credentialId) && (
            <button onClick={handleAnyPasskeyLogin} disabled={loginLoading}
              className="w-full py-3 rounded-xl bg-swu-accent/10 border border-swu-accent/30 text-swu-accent-texto font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50">
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
        <BackButton to="login" onIr={setView} />
        <div className="text-center">
          <Mail size={40} className="mx-auto text-swu-accent-texto mb-2" />
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

          {forgotError && <p className="text-sm text-swu-red-texto text-center font-medium">{forgotError}</p>}
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
          <KeyRound size={40} className="mx-auto text-swu-accent-texto mb-2" />
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

              {resetError && <p className="text-sm text-swu-red-texto text-center font-medium">{resetError}</p>}

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
    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (!file.type.startsWith('image/')) return
      try {
        const dataUri = await compressImage(file, 200, 0.7)
        setCustomAvatar(dataUri)
      } catch {
        console.warn('Failed to process image')
      }
    }

    const customizeLevelInfo = playerStats ? calculateLevel(playerStats.xp) : null

    return (
      <div className="p-4 lg:p-6 space-y-5 pb-8 lg:pb-8 max-w-5xl mx-auto">
        <BackButton to="profile" onIr={setView} />
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <ProfileFrame level={customizeLevelInfo?.level || 1} size={88} marcoId={marcoElegido}>
              {/* El tamaño lo manda el MARCO. La copia vieja pintaba 96 px
                  dentro de un marco de 88 y el recorte se comía el borde. */}
              <Avatar avatar={customAvatar} size={88} caja="marco" escalaIcono={1} />
            </ProfileFrame>
          </div>
          <h2 className="text-lg font-bold text-swu-text">Personalizar Perfil</h2>
        </div>
        <div className="bg-swu-surface rounded-2xl p-5 border border-swu-border space-y-5">
          {/* Photo upload */}
          <div>
            <p className="text-xs text-swu-muted mb-2">Subir foto de perfil</p>
            <label className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-swu-border hover:border-swu-accent/50 bg-swu-bg cursor-pointer transition-colors active:scale-[0.98]">
              <Camera size={18} className="text-swu-accent-texto" />
              <span className="text-sm font-medium text-swu-accent-texto">Elegir imagen</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </label>
            {isPhotoAvatar(customAvatar) && (
              <button onClick={() => setCustomAvatar('darth-vader')} className="w-full mt-2 text-[11px] text-swu-red-texto text-center">
                Quitar foto y usar icono
              </button>
            )}
          </div>

          {/* Icon avatars */}
          <div>
            <p className="text-xs text-swu-muted mb-2">O elige un icono</p>
            <div className="grid grid-cols-6 gap-1.5 justify-items-center">
              {swAvatars.map((a) => (
                <button key={a.id} onClick={() => setCustomAvatar(a.id)}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all p-0.5 ${customAvatar === a.id ? 'border-swu-accent bg-swu-accent/20 scale-110' : 'border-swu-border bg-swu-bg'}`}>
                  <img src={urlAvatarSW(a.id)} alt={a.name} className="w-9 h-9 object-contain" />
                </button>
              ))}
            </div>
            {customAvatar && !isPhotoAvatar(customAvatar) && (
              <p className="text-[10px] text-swu-accent-texto text-center mt-1.5 font-mono tracking-wider">
                {swAvatars.find(a => a.id === customAvatar)?.name || customAvatar}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs text-swu-muted mb-1.5">Nombre</p>
            <input value={customName} onChange={(e) => setCustomName(e.target.value)} maxLength={30}
              className="w-full bg-swu-bg border border-swu-border rounded-xl p-3 text-sm text-swu-text outline-none focus:border-swu-accent" />
          </div>

          {/* Lo que ve la comunidad en /u/:id. Guarda por su cuenta porque va
              a otras columnas y no depende del resto del formulario. */}
          <div className="pt-1 border-t border-swu-border">
            <p className="text-xs text-swu-muted mb-2 mt-3">Mi perfil público</p>
            <PersonalizarPerfil />
          </div>

          {/* La credencial vive en su propia pantalla: tiene demasiada
              personalización (tema, emblema, mazo, impresión) para caber acá. */}
          <button
            onClick={() => navigate('/credencial')}
            className="w-full flex items-center justify-between py-3 px-4 rounded-xl border border-swu-border bg-swu-bg hover:border-swu-accent/50 transition-colors active:scale-[0.98]"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-swu-accent-texto">
              <Fingerprint size={16} /> Mi Credencial
            </span>
            <ChevronRight size={16} className="text-swu-muted" />
          </button>

          {/* Region selector: Continent → Country */}
          <div>
            <p className="text-xs text-swu-muted mb-1.5 flex items-center gap-1.5">
              <Globe size={13} /> Región / Comunidad
            </p>
            {/* Continent selector */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {CONTINENTS.map((cont) => (
                <button
                  key={cont.id}
                  onClick={() => {
                    if (customContinent === cont.id) {
                      setCustomContinent('')
                      setCustomCountry('')
                    } else {
                      setCustomContinent(cont.id)
                      setCustomCountry('')
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    customContinent === cont.id
                      ? 'bg-swu-accent/15 border-swu-accent text-swu-accent-texto'
                      : 'bg-swu-bg border-swu-border text-swu-muted hover:border-swu-accent/30'
                  }`}
                >
                  {cont.icon} {cont.name}
                </button>
              ))}
            </div>

            {/* Country selector (shows when continent is selected) */}
            {customContinent && (
              <div className="bg-swu-bg rounded-xl border border-swu-border p-3">
                <p className="text-[10px] text-swu-muted mb-2 uppercase tracking-wider">
                  Seleccione su país
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {CONTINENTS.find(c => c.id === customContinent)?.countries.map((country) => (
                    <button
                      key={country.code}
                      onClick={() => setCustomCountry(country.code)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium border transition-all text-left ${
                        customCountry === country.code
                          ? 'bg-swu-accent/15 border-swu-accent text-swu-accent-texto'
                          : 'bg-swu-surface border-swu-border text-swu-text hover:border-swu-accent/30'
                      }`}
                    >
                      <span className="text-base">{country.flag}</span>
                      <span className="truncate">{country.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Current selection display */}
            {customCountry && (
              <div className="mt-2 flex items-center justify-between bg-swu-accent/5 border border-swu-accent/20 rounded-lg px-3 py-2">
                <span className="text-xs text-swu-accent-texto font-medium">
                  {getCountryByCode(customCountry)?.flag} {getCountryByCode(customCountry)?.name}
                </span>
                <button
                  onClick={() => { setCustomCountry(''); setCustomContinent('') }}
                  className="text-[10px] text-swu-red-texto"
                >
                  Quitar
                </button>
              </div>
            )}
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
        <BackButton to="profile" onIr={setView} />
        <div className="text-center">
          <Shield size={40} className="mx-auto text-swu-accent-texto mb-2" />
          <h2 className="text-lg font-bold text-swu-text">Seguridad</h2>
        </div>

        {/* Account info */}
        <div className="bg-swu-surface rounded-2xl p-4 border border-swu-border space-y-3">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-swu-accent-texto" />
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
            <Fingerprint size={16} className="text-swu-accent-texto" />
            <p className="text-sm font-bold text-swu-text">Passkey (Biometría)</p>
          </div>
          {currentProfile?.credentialId ? (
            <>
              <div className="flex items-center gap-2 bg-swu-green/10 rounded-lg px-3 py-2">
                <Shield size={14} className="text-swu-green" />
                <p className="text-xs text-swu-green font-medium">Passkey registrada y activa</p>
              </div>
              <button onClick={async () => { if (confirm('¿Eliminar la passkey?')) await auth.removePasskey() }}
                className="w-full py-2.5 rounded-xl bg-swu-red/10 border border-swu-red/30 text-swu-red-texto text-sm font-medium active:scale-[0.98] transition-transform">
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
      {/* Header with level frame + portada de fondo (si eligió una) */}
      <div className="relative overflow-hidden bg-gradient-to-br from-swu-accent/15 to-amber-500/10 rounded-2xl p-4 border border-swu-accent/20">
        {/* La portada elegida en Personalizar, detrás del contenido. Si no hay,
            no dibuja nada y el header se ve como siempre. */}
        <BannerPortadaUsuario userId={supabaseUser?.id} className="absolute inset-0 h-full w-full opacity-60" />
        <div className="relative flex items-center gap-3 mb-3">
          <ProfileFrame level={levelInfo?.level || 1} size={72} marcoId={marcoElegido}>
            <Avatar avatar={currentProfile?.avatar || 'darth-vader'} size={72} caja="marco" escalaIcono={1} />
          </ProfileFrame>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-extrabold text-swu-text truncate">{currentProfile?.name || 'Jugador'}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {levelInfo && <span className={`text-[11px] font-bold ${levelInfo.rank.color}`}>{levelInfo.rank.name}</span>}
              {currentProfile?.country && (
                <span className="text-[10px] bg-swu-surface/80 px-1.5 py-0.5 rounded-full text-swu-muted font-medium">
                  {getCountryByCode(currentProfile.country)?.flag} {getCountryByCode(currentProfile.country)?.name}
                </span>
              )}
              {currentProfile?.credentialId && <Fingerprint size={10} className="text-swu-accent-texto" />}
              {supabaseUser && (
                <span className="text-[9px] bg-swu-green/20 text-swu-green px-1.5 py-0.5 rounded-full font-bold">Online</span>
              )}
            </div>
          </div>
        </div>
        <div className="relative">{playerStats && <LightsaberXpBar xp={playerStats.xp} />}</div>
      </div>

      {/* Country nudge — only if not set; unlocks Comunidades feed */}
      {!currentProfile?.country && (
        <button
          onClick={() => setView('customize')}
          className="w-full flex items-center gap-3 bg-gradient-to-r from-swu-accent/10 to-swu-accent/5 rounded-2xl p-3 border border-swu-accent/30 active:scale-[0.99] transition-transform text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-swu-accent/15 flex items-center justify-center flex-shrink-0">
            <Globe size={18} className="text-swu-accent-texto" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-swu-text">Configura tu región</p>
            <p className="text-[11px] text-swu-muted">
              Únete a la comunidad de tu país y aparece en rankings regionales
            </p>
          </div>
          <ChevronRight size={16} className="text-swu-accent-texto flex-shrink-0" />
        </button>
      )}

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
          <Palette size={16} className="text-swu-accent-texto" />
          <span className="text-sm font-medium text-swu-accent-texto">Personalizar</span>
        </button>
        <button onClick={() => setView('security')}
          className="bg-swu-surface rounded-xl px-3 py-3 border border-swu-accent/30 flex items-center gap-2 active:scale-[0.98] transition-transform">
          <Shield size={16} className="text-swu-accent-texto" />
          <span className="text-sm font-medium text-swu-accent-texto">Seguridad</span>
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
              <Icon size={18} className={isHighlight ? 'text-swu-accent-texto' : 'text-swu-muted'} />
              <span className={`flex-1 text-left text-sm font-medium ${isHighlight ? 'text-swu-accent-texto' : 'text-swu-text'}`}>{item.label}</span>
              {item.count !== undefined && <span className="text-xs text-swu-muted font-mono">{item.count}</span>}
              <ChevronRight size={16} className="text-swu-muted" />
            </button>
          )
        })}
      </div>

      {/* Los torneos de melee: primero el historial si ya está enlazado, y
          después el campo para enlazarlo o cambiarlo. */}
      {auth.supabaseUser && melee.usuario && (
        <MeleeRecord usuario={melee.usuario} verificado={melee.verificado} esPropio />
      )}
      {auth.supabaseUser && <MeleeSetting userId={auth.supabaseUser.id} />}

      {/* Compartir el WhatsApp es opcional y reversible. */}
      {auth.supabaseUser && <WhatsappSetting userId={auth.supabaseUser.id} />}

      {/* Todo lo que no entra en las 5 pestañas de móvil. En escritorio no se
          dibuja: el sidebar sigue mostrando las 16 entradas. */}
      <MoreNav />

      {/* Logout */}
      <button onClick={async () => { await logout(); setView('select') }}
        className="w-full py-3 rounded-xl bg-swu-red/10 border border-swu-red/30 text-swu-red-texto font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
        <LogOut size={18} /> Cerrar Sesión
      </button>
    </div>
  )
}

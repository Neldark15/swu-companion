import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, History, Heart, Star, Layers, BookOpen, Trophy,
  LogOut, UserPlus, Lock, User, Trash2, Shield,
} from 'lucide-react'
import { db } from '../../services/db'
import { useAuth } from '../../hooks/useAuth'
import type { UserProfile } from '../../services/db'

const avatarOptions = ['🎯', '⚔️', '🛡️', '🚀', '🌟', '💎', '🔥', '🌙', '👾', '🎲']

type View = 'profile' | 'login' | 'register' | 'select'

export function ProfilePage() {
  const navigate = useNavigate()
  const { currentProfile, profiles, loadProfiles, createProfile, login, logout, deleteProfile } = useAuth()

  const [view, setView] = useState<View>(currentProfile ? 'profile' : 'select')
  const [stats, setStats] = useState({ matches: 0, tournaments: 0, decks: 0, favorites: 0 })

  // Register form state
  const [regName, setRegName] = useState('')
  const [regPin, setRegPin] = useState('')
  const [regPinConfirm, setRegPinConfirm] = useState('')
  const [regAvatar, setRegAvatar] = useState('🎯')
  const [regError, setRegError] = useState('')

  // Login form state
  const [loginProfile, setLoginProfile] = useState<UserProfile | null>(null)
  const [loginPin, setLoginPin] = useState('')
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  useEffect(() => {
    if (currentProfile) {
      setView('profile')
      // Load stats
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

  const handleRegister = async () => {
    setRegError('')
    if (!regName.trim()) { setRegError('Ingrese su nombre'); return }
    if (regName.trim().length < 2) { setRegError('Nombre muy corto'); return }
    if (regPin.length < 4) { setRegError('El PIN debe tener al menos 4 dígitos'); return }
    if (regPin !== regPinConfirm) { setRegError('Los PIN no coinciden'); return }

    await createProfile(regName.trim(), regPin, regAvatar)
    setRegName('')
    setRegPin('')
    setRegPinConfirm('')
  }

  const handleLogin = async () => {
    setLoginError('')
    if (!loginProfile) return
    if (!loginPin) { setLoginError('Ingrese su PIN'); return }

    const ok = await login(loginProfile.id, loginPin)
    if (!ok) {
      setLoginError('PIN incorrecto')
      return
    }
    setLoginPin('')
    setLoginProfile(null)
  }

  const handleDelete = async (profileId: string) => {
    if (!confirm('¿Eliminar este perfil? Esta acción no se puede deshacer.')) return
    await deleteProfile(profileId)
  }

  // ─── SELECT PROFILE VIEW ───
  if (view === 'select') {
    return (
      <div className="p-4 space-y-5 pb-24">
        <h2 className="text-lg font-bold text-swu-text">Perfiles</h2>

        {profiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-swu-muted">Seleccione su perfil para ingresar</p>
            {profiles.map((p) => (
              <div key={p.id} className="bg-swu-surface rounded-xl p-4 border border-swu-border flex items-center gap-3">
                <span className="text-3xl">{p.avatar}</span>
                <div className="flex-1">
                  <p className="font-bold text-swu-text">{p.name}</p>
                  <p className="text-[11px] text-swu-muted">Creado: {new Date(p.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setLoginProfile(p); setLoginPin(''); setLoginError(''); setView('login') }}
                    className="px-4 py-2 rounded-lg bg-swu-accent text-white text-sm font-bold active:scale-95 transition-transform"
                  >
                    Entrar
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-2 rounded-lg bg-swu-red/10 text-swu-red active:scale-95 transition-transform"
                  >
                    <Trash2 size={16} />
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
            <p className="text-sm text-swu-muted">Cree un perfil para guardar sus datos de juego</p>
          </div>
        )}

        <button
          onClick={() => { setRegName(''); setRegPin(''); setRegPinConfirm(''); setRegError(''); setView('register') }}
          className="w-full py-3.5 rounded-xl bg-swu-green text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <UserPlus size={20} /> Crear Nuevo Perfil
        </button>

        {/* Skip (use without profile) */}
        <button
          onClick={() => navigate('/')}
          className="w-full py-2 text-sm text-swu-muted text-center"
        >
          Continuar sin perfil
        </button>
      </div>
    )
  }

  // ─── REGISTER VIEW ───
  if (view === 'register') {
    return (
      <div className="p-4 space-y-5 pb-24">
        <button onClick={() => setView('select')} className="text-sm text-swu-muted">← Volver</button>

        <div className="text-center">
          <UserPlus size={40} className="mx-auto text-swu-green mb-2" />
          <h2 className="text-lg font-bold text-swu-text">Crear Perfil</h2>
          <p className="text-xs text-swu-muted mt-0.5">Su perfil guarda partidas, decks y favoritos</p>
        </div>

        <div className="bg-swu-surface rounded-2xl p-5 border border-swu-border space-y-4">
          {/* Avatar selection */}
          <div>
            <p className="text-xs text-swu-muted mb-2">Avatar</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {avatarOptions.map((a) => (
                <button
                  key={a}
                  onClick={() => setRegAvatar(a)}
                  className={`w-12 h-12 rounded-xl text-2xl flex items-center justify-center border-2 transition-colors ${
                    regAvatar === a ? 'border-swu-accent bg-swu-accent/20' : 'border-swu-border bg-swu-bg'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Nombre de Jugador</p>
            <input
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              placeholder="Su nombre o nickname"
              maxLength={30}
              className="w-full bg-swu-bg border border-swu-border rounded-xl p-3 text-sm text-swu-text outline-none focus:border-swu-accent"
            />
          </div>

          {/* PIN */}
          <div>
            <p className="text-xs text-swu-muted mb-1.5">PIN (4+ dígitos)</p>
            <input
              type="password"
              inputMode="numeric"
              value={regPin}
              onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              maxLength={8}
              className="w-full bg-swu-bg border border-swu-border rounded-xl p-3 text-lg font-mono tracking-[0.3em] text-center text-swu-text outline-none focus:border-swu-accent"
            />
          </div>

          {/* Confirm PIN */}
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Confirmar PIN</p>
            <input
              type="password"
              inputMode="numeric"
              value={regPinConfirm}
              onChange={(e) => setRegPinConfirm(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              maxLength={8}
              className="w-full bg-swu-bg border border-swu-border rounded-xl p-3 text-lg font-mono tracking-[0.3em] text-center text-swu-text outline-none focus:border-swu-accent"
            />
          </div>

          {regError && (
            <p className="text-sm text-swu-red text-center font-medium">{regError}</p>
          )}

          <button
            onClick={handleRegister}
            className="w-full py-3.5 rounded-xl bg-swu-green text-white font-bold text-base active:scale-[0.98] transition-transform"
          >
            Crear Perfil
          </button>
        </div>
      </div>
    )
  }

  // ─── LOGIN VIEW ───
  if (view === 'login' && loginProfile) {
    return (
      <div className="p-4 space-y-5 pb-24">
        <button onClick={() => { setView('select'); setLoginProfile(null) }} className="text-sm text-swu-muted">← Volver</button>

        <div className="text-center">
          <span className="text-5xl block mb-2">{loginProfile.avatar}</span>
          <h2 className="text-lg font-bold text-swu-text">{loginProfile.name}</h2>
          <p className="text-xs text-swu-muted mt-0.5">Ingrese su PIN para continuar</p>
        </div>

        <div className="bg-swu-surface rounded-2xl p-5 border border-swu-border space-y-4">
          <div className="flex items-center gap-2 text-sm text-swu-muted">
            <Lock size={14} />
            <span>PIN de acceso</span>
          </div>

          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={loginPin}
            onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
            maxLength={8}
            className="w-full bg-swu-bg border border-swu-border rounded-xl p-4 text-2xl font-mono tracking-[0.3em] text-center text-swu-text outline-none focus:border-swu-accent"
            onKeyDown={(e) => { if (e.key === 'Enter') handleLogin() }}
          />

          {loginError && (
            <p className="text-sm text-swu-red text-center font-medium">{loginError}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={loginPin.length < 4}
            className={`w-full py-3.5 rounded-xl font-bold text-base transition-all ${
              loginPin.length >= 4
                ? 'bg-swu-accent text-white active:scale-[0.98]'
                : 'bg-swu-border text-swu-muted cursor-not-allowed'
            }`}
          >
            Ingresar
          </button>
        </div>
      </div>
    )
  }

  // ─── PROFILE VIEW (logged in) ───
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
      {/* Profile header */}
      <div className="bg-gradient-to-br from-swu-accent/20 to-swu-green/10 rounded-2xl p-5 border border-swu-accent/30 flex items-center gap-4">
        <span className="text-5xl">{currentProfile?.avatar || '🎯'}</span>
        <div className="flex-1">
          <p className="text-[11px] text-swu-accent font-bold uppercase tracking-widest">Perfil</p>
          <h2 className="text-xl font-extrabold text-swu-text">{currentProfile?.name || 'Jugador'}</h2>
          <p className="text-xs text-swu-muted mt-0.5">
            Desde {currentProfile ? new Date(currentProfile.createdAt).toLocaleDateString() : '—'}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-swu-green/20 px-2.5 py-1 rounded-full">
          <Shield size={12} className="text-swu-green" />
          <span className="text-[11px] font-bold text-swu-green">Activo</span>
        </div>
      </div>

      {/* Stats grid */}
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

      {/* Menu items */}
      <div className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.to)}
              className="w-full bg-swu-surface rounded-xl px-4 py-3.5 border border-swu-border flex items-center gap-3 active:scale-[0.99] transition-transform"
            >
              <Icon size={18} className="text-swu-muted" />
              <span className="flex-1 text-left text-sm font-medium text-swu-text">{item.label}</span>
              {item.count !== undefined && (
                <span className="text-xs text-swu-muted font-mono">{item.count}</span>
              )}
              <ChevronRight size={16} className="text-swu-muted" />
            </button>
          )
        })}
      </div>

      {/* Logout */}
      <button
        onClick={() => { logout(); setView('select') }}
        className="w-full py-3 rounded-xl bg-swu-red/10 border border-swu-red/30 text-swu-red font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
      >
        <LogOut size={18} /> Cerrar Sesión
      </button>
    </div>
  )
}

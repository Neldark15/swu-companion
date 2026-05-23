/**
 * WelcomeHome — pantalla principal cuando el usuario NO ha iniciado sesión.
 *
 * Diseñada como entry point estilo app: hero corto, form de login inline,
 * tarjeta de instalar PWA, opción de continuar sin cuenta.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogIn, UserPlus, Eye, EyeOff, AlertTriangle, Loader2, ArrowRight,
  CircleArrowDown,
} from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { PWAInstallCard } from './PWAInstallCard'

export function WelcomeHome() {
  const navigate = useNavigate()
  const login = useAuth(s => s.login)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Email y contraseña son obligatorios')
      return
    }
    setLoading(true)
    const result = await login(email.trim(), password)
    setLoading(false)
    if (!result.ok) {
      setError(result.error || 'Email o contraseña incorrectos')
      return
    }
    // Auth state updates — HomePage re-renders into the logged-in view
  }

  return (
    <div className="min-h-screen bg-swu-bg pb-10">
      {/* ── Hero con banner ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/banner-base.png" alt="" className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/70 to-swu-bg" />
        </div>
        <div
          className="absolute inset-0 z-10 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.08) 2px, rgba(255,255,255,0.08) 4px)',
          }}
        />

        <div className="relative z-20 px-5 pt-10 pb-6 text-center">
          <img
            src="/icon-192.png"
            alt="HOLOCRON SWU"
            className="w-20 h-20 mx-auto rounded-2xl shadow-2xl border border-swu-amber/30 mb-4"
          />
          <h1 className="text-2xl font-extrabold text-white tracking-tight drop-shadow">
            HOLOCRON SWU
          </h1>
          <p className="text-[10px] tracking-[0.35em] uppercase text-swu-amber font-bold mt-1">
            Centro de Mando
          </p>
          <p className="text-[12px] text-swu-text/80 mt-3 max-w-xs mx-auto leading-snug">
            Tu companion oficial para <span className="text-swu-amber font-semibold">Star Wars: Unlimited</span> —
            tracker, torneos, colección y comunidad.
          </p>

          <div className="flex items-center justify-center gap-1.5 mt-4">
            <CircleArrowDown size={12} className="text-swu-amber/60 animate-bounce" />
            <span className="text-[10px] text-swu-amber/60 font-mono tracking-wider uppercase">
              Iniciá sesión o instalá la app
            </span>
          </div>
        </div>
      </div>

      {/* ── Login form (principal) ── */}
      <div className="px-5 pt-4">
        <div className="bg-swu-surface rounded-2xl border border-swu-accent/30 p-5 space-y-4 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-swu-accent/15 flex items-center justify-center">
              <LogIn size={16} className="text-swu-accent" />
            </div>
            <div>
              <h2 className="text-base font-bold text-swu-text">Iniciar sesión</h2>
              <p className="text-[11px] text-swu-muted">Sincroniza tu progreso entre dispositivos</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-swu-muted font-medium block mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="tu@email.com"
                className="w-full px-3 py-2.5 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text placeholder-swu-muted focus:border-swu-accent outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-swu-muted font-medium block mb-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 pr-10 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text placeholder-swu-muted focus:border-swu-accent outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-swu-muted hover:text-swu-text p-1"
                  aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-swu-red/10 border border-swu-red/30 rounded-lg p-2 text-[11px] text-swu-red flex items-center gap-1.5">
                <AlertTriangle size={12} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-swu-accent text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              {loading ? 'Entrando…' : 'Entrar'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="w-full text-[11px] text-swu-muted hover:text-swu-text"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </form>

          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1 h-px bg-swu-border" />
            <span className="text-[10px] text-swu-muted font-mono">o</span>
            <div className="flex-1 h-px bg-swu-border" />
          </div>

          <button
            onClick={() => navigate('/profile')}
            className="w-full py-2.5 rounded-lg bg-swu-surface border border-swu-accent/30 text-swu-accent font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <UserPlus size={14} />
            Crear cuenta nueva
          </button>
        </div>
      </div>

      {/* ── PWA install card ── */}
      <div className="px-5 pt-4">
        <PWAInstallCard />
      </div>

      {/* ── Continue without account ── */}
      <div className="px-5 pt-5 text-center">
        <button
          onClick={() => navigate('/cards')}
          className="text-[11px] text-swu-muted hover:text-swu-text underline underline-offset-4 decoration-dotted"
        >
          Continuar sin cuenta · solo ver cartas
        </button>
        <p className="text-[10px] text-swu-muted/60 mt-1.5">
          Sin sesión podés explorar la base de datos pero no guardás colección, decks ni stats.
        </p>
      </div>

      {/* ── Footer ── */}
      <div className="px-5 pt-6 text-center">
        <p className="text-[9px] text-swu-muted/40 font-mono tracking-widest">
          HOLOCRON SWU v1.0 — EL SALVADOR
        </p>
      </div>
    </div>
  )
}

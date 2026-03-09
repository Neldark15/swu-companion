import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Shield, UserPlus, Sparkles, Swords, ScrollText, Trophy, Target } from 'lucide-react'

const features = [
  { icon: ScrollText, label: 'Holocrón de Duelos', desc: 'Registre y analice sus combates' },
  { icon: Swords, label: 'Tracker en Vivo', desc: 'Contadores de vida en tiempo real' },
  { icon: Trophy, label: 'Torneos', desc: 'Organice y participe en eventos' },
  { icon: Target, label: 'Misiones Diarias', desc: 'Gane XP completando objetivos' },
]

interface AuthGateProps {
  children: React.ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const { currentProfile } = useAuth()
  const navigate = useNavigate()

  if (currentProfile) return <>{children}</>

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-swu-accent/10 border border-swu-accent/20 flex items-center justify-center">
          <Shield size={32} className="text-swu-accent" />
        </div>

        {/* Title */}
        <div>
          <h2 className="text-xl font-extrabold text-swu-text mb-1">Acceso Restringido</h2>
          <p className="text-sm text-swu-muted">
            Necesita una cuenta para acceder a este módulo
          </p>
        </div>

        {/* Features preview */}
        <div className="bg-swu-surface rounded-xl border border-swu-border p-4 space-y-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles size={12} className="text-swu-amber" />
            <span className="text-[10px] text-swu-amber font-bold uppercase tracking-widest">
              Al registrarse obtiene
            </span>
          </div>
          {features.map((f) => {
            const Icon = f.icon
            return (
              <div key={f.label} className="flex items-center gap-3 text-left">
                <div className="w-8 h-8 rounded-lg bg-swu-bg border border-swu-border flex items-center justify-center shrink-0">
                  <Icon size={14} className="text-swu-accent" />
                </div>
                <div>
                  <p className="text-xs font-bold text-swu-text">{f.label}</p>
                  <p className="text-[10px] text-swu-muted">{f.desc}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate('/profile')}
          className="w-full py-3 rounded-xl bg-swu-accent text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <UserPlus size={16} />
          Crear Cuenta / Iniciar Sesión
        </button>

        <p className="text-[10px] text-swu-muted">
          Es gratis · Solo necesita un correo electrónico
        </p>
      </div>
    </div>
  )
}

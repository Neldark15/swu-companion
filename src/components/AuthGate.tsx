import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { HolocronLoader } from './PageTransition'
import { Shield, UserPlus, Sparkles, Swords, Trophy, Target, Gift } from 'lucide-react'

/* La app entera habla de VOS. Este muro hablaba de usted —«Necesita una
   cuenta», «Organice», «Gane XP»— y es la primera pantalla que ve quien llega
   de afuera por un enlace compartido: el único sitio donde el tuteo formal se
   lee como que llegaste a otra aplicación. */
const features = [
  { icon: Gift, label: '3 sobres al día', desc: 'Con la app instalada y los avisos puestos' },
  { icon: Swords, label: 'Tracker en vivo', desc: 'Contadores de vida en tiempo real' },
  { icon: Trophy, label: 'Torneos', desc: 'Organizá y jugá eventos de verdad' },
  { icon: Target, label: 'Misiones diarias', desc: 'Ganá XP completando objetivos' },
]

interface AuthGateProps {
  children: React.ReactNode
  /**
   * Por qué esta persona está viendo el muro AHORA.
   *
   * El muro cubre 38 rutas y decía siempre lo mismo: «Acceso Restringido ·
   * Necesita una cuenta para acceder a este módulo». Para quien llega desde el
   * video de un creador a `/liga/:code`, eso no menciona la liga por ningún
   * lado: la promesa que lo trajo desaparece justo en el paso donde hay que
   * decidir si vale la pena registrarse.
   */
  motivo?: string
}

export function AuthGate({ children, motivo }: AuthGateProps) {
  const { currentProfile, authListo } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  /* «Todavía no sé» NO es «no tenés cuenta».
   *
   * Este muro cubre 38 rutas y decidía solo con `currentProfile`, que arranca
   * en null porque no se persiste. Resultado: en cada arranque en frío la app
   * te ofrecía Iniciar Sesión aunque estuvieras logueado, hasta que respondía
   * la nube. Mientras `initAuth` no termine se muestra el cargador; el muro
   * queda para cuando de verdad no hay cuenta. */
  if (!authListo) return <HolocronLoader />

  if (currentProfile) return <>{children}</>

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-swu-accent/10 border border-swu-accent/20 flex items-center justify-center">
          <Shield size={32} className="text-swu-accent-texto" />
        </div>

        {/* Title */}
        <div>
          <h2 className="text-xl font-extrabold text-swu-text mb-1">
            {motivo ? 'Te falta la cuenta' : 'Acceso restringido'}
          </h2>
          <p className="text-sm text-swu-muted">
            {motivo ?? 'Necesitás una cuenta de HOLOCRON para entrar acá.'}
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
                  <Icon size={14} className="text-swu-accent-texto" />
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
        {/* EL DESTINO SE RECUERDA.
            Antes esto era `navigate('/profile')` pelado: quien llegaba desde un
            enlace, creaba la cuenta y quedaba en su perfil, sin ninguna pista
            de que había venido a otra cosa. Volver a buscar la liga exige
            acordarse de la URL, y nadie se acuerda de una URL que abrió una vez.

            Va la ruta MÁS el query: `/rulings?regla=…` se comparte así, y sin
            el search se vuelve a la pantalla correcta con el contexto perdido.
            El hash NO viaja: ahí es donde Supabase deja el token del correo de
            recuperación (gotcha 2w), y eso no se copia a ningún lado. */}
        <button
          onClick={() => navigate(
            `/profile?next=${encodeURIComponent(location.pathname + location.search)}`,
          )}
          className="w-full py-3 rounded-xl bg-swu-accent text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <UserPlus size={16} />
          Crear Cuenta / Iniciar Sesión
        </button>

        <p className="text-[10px] text-swu-muted">
          Es gratis · Solo necesitás un correo
        </p>
      </div>
    </div>
  )
}

/**
 * TarjetaJugador — quién sos, de un vistazo.
 *
 * Vive acá y no dentro de ProfilePage porque la usan DOS pantallas: el perfil
 * y el inicio. Tenerla duplicada garantizaba que se fueran separando —una
 * ganaría la bandera del país, la otra el nivel— y que la app se contradijera
 * consigo misma según por dónde entrás.
 *
 * En Inicio reemplaza al panel «CENTRO DE MANDO», que decía el nombre de la
 * app —algo que ya sabés, porque la abriste vos— en vez de decir cómo vas.
 */

import { useNavigate } from 'react-router-dom'
import type { CSSProperties } from 'react'
import { Fingerprint } from 'lucide-react'
import { ProfileFrame } from './components/ProfileFrame'
import { LightsaberXpBar } from './components/LightsaberXpBar'
import { useSettings } from '../../hooks/useSettings'
import { TINTES_TARJETA } from '../../services/personalizacion'
import { Avatar } from '../../components/ui/Avatar'
import { getCountryByCode } from '../../data/regions'
import { calculateLevel, type PlayerStats } from '../../services/gamification'
import type { UserProfile } from '../../services/db'

interface Props {
  perfil: UserProfile
  stats: PlayerStats | null
  /** Hay sesión en la nube: se muestra «Online». */
  enLinea?: boolean
  /** En Inicio la tarjeta lleva al perfil; dentro del perfil no lleva a ningún lado. */
  alTocar?: 'perfil' | 'nada'
  size?: number
}


export function TarjetaJugador({
  perfil, stats, enLinea = false, alTocar = 'nada', size = 72,
}: Props) {
  const navigate = useNavigate()
  const tinteTarjeta = useSettings((s) => s.tinteTarjeta)
  const marcoElegido = useSettings((s) => s.marcoElegido)
  const nivel = stats ? calculateLevel(stats.xp) : null
  const pais = perfil.country ? getCountryByCode(perfil.country) : null

  // 'auto' es la ausencia de tinte: el color del RANGO pinta, como siempre.
  // Con tinte, las variables viajan por CSS desde el root de la tarjeta y
  // los hijos las leen con var() — ni un estado ni un re-render extra.
  const tinte = tinteTarjeta === 'auto' ? null : TINTES_TARJETA[tinteTarjeta]
  const estiloTinte = tinte
    ? ({ '--tinte': tinte.nucleo, '--tinte-brillo': tinte.brillo } as CSSProperties)
    : undefined

  const cuerpo = (
    <>
      <div className="flex items-center gap-3 mb-3">
        <ProfileFrame level={nivel?.level || 1} size={size} marcoId={marcoElegido}>
          {/* `caja="marco"` llena el hueco que deja el ProfileFrame en vez de
              imponer un tamaño propio. Antes el <img> era `w-20 h-20` (80 px)
              fijo dentro de un marco de `size` (72 por defecto), así que el
              `overflow-hidden` del marco le comía el borde a toda foto. */}
          <Avatar avatar={perfil.avatar || 'darth-vader'} size={size} caja="marco" escalaIcono={1} />
        </ProfileFrame>
        <div className="flex-1 min-w-0">
          <h2
            className="text-lg font-extrabold text-swu-text truncate"
            style={tinte ? { color: 'var(--tinte)', textShadow: '0 0 12px var(--tinte-brillo)' } : undefined}
          >
            {perfil.name || 'Jugador'}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            {nivel && (
              <span
                className={`text-[11px] font-bold ${tinte ? '' : nivel.rank.color}`}
                style={tinte ? { color: 'var(--tinte)' } : undefined}
              >
                {nivel.rank.name}
              </span>
            )}
            {pais && (
              <span className="text-[10px] bg-swu-surface/80 px-1.5 py-0.5 rounded-full text-swu-muted font-medium">
                {pais.flag} {pais.name}
              </span>
            )}
            {perfil.credentialId && <Fingerprint size={10} className="text-swu-accent-texto" aria-hidden />}
            {enLinea && (
              <span className="text-[9px] bg-swu-green/20 text-swu-green px-1.5 py-0.5 rounded-full font-bold">
                Online
              </span>
            )}
          </div>
        </div>
      </div>
      {stats && <LightsaberXpBar xp={stats.xp} />}
    </>
  )

  const envoltura = 'bg-gradient-to-br from-swu-accent/15 to-amber-500/10 rounded-2xl p-4 border border-swu-accent/20'

  if (alTocar === 'nada') return <div className={envoltura} style={estiloTinte}>{cuerpo}</div>

  return (
    <button
      onClick={() => navigate('/profile')}
      aria-label="Ver mi perfil"
      style={estiloTinte}
      className={`${envoltura} w-full text-left active:scale-[0.99] transition-transform
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent`}
    >
      {cuerpo}
    </button>
  )
}

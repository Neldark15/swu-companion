/**
 * LightsaberXpBar — XP progress bar styled as a lightsaber blade
 * with customizable color, glow effects, and hilt.
 */
import { calculateLevel } from '../../../services/gamification'
import { useSettings, SABER_COLORS } from '../../../hooks/useSettings'

interface LightsaberXpBarProps {
  xp: number
}

export function LightsaberXpBar({ xp }: LightsaberXpBarProps) {
  const { level, rank, xpCurrent, xpNeeded, progress } = calculateLevel(xp)
  const { saberColor } = useSettings()
  const { core, glow } = SABER_COLORS[saberColor]

  const pct = Math.max(progress * 100, 3)

  return (
    <div className="space-y-2">
      {/* Level + Rank */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${rank.bgColor} ${rank.color} ${rank.borderColor} border`}>
            Nv. {level}
          </span>
          <span className={`text-sm font-bold ${rank.color}`}>{rank.name}</span>
        </div>
        <span className="text-[11px] text-swu-muted font-mono">{xpCurrent}/{xpNeeded} XP</span>
      </div>

      {/* El sable.
          
          La hoja medía 16 px de grosor, y a lo ancho de una tarjeta de móvil
          eso daba una proporción de ~11:1: se leía como una pastilla luminosa
          con un adorno a la izquierda, no como una hoja. Un sable de verdad
          ronda 30:1 —larguísimo y delgado— y esa proporción es TODA la
          diferencia entre las dos lecturas.

          Por eso la hoja baja a 8 px y la empuñadura se encoge con ella: si la
          empuñadura se quedaba en 24 px de alto, pasaba a ser tres veces más
          gruesa que la hoja y parecía un martillo. Los colores no se tocan. */}
      <div className="relative flex items-center h-5">
        {/* Empuñadura */}
        <div className="relative z-20 flex-shrink-0">
          <svg width="30" height="14" viewBox="0 0 30 14" fill="none" aria-hidden>
            {/* Cuerpo */}
            <rect x="5" y="2.5" width="19" height="9" rx="1.5" fill="#2A2A2E" stroke="#555" strokeWidth="0.8" />
            {/* Estrías del mango */}
            <line x1="11" y1="3.2" x2="11" y2="10.8" stroke="#444" strokeWidth="0.8" />
            <line x1="14" y1="3.2" x2="14" y2="10.8" stroke="#444" strokeWidth="0.8" />
            <line x1="17" y1="3.2" x2="17" y2="10.8" stroke="#444" strokeWidth="0.8" />
            {/* Emisor: se estrecha hacia la hoja, que es de donde sale */}
            <rect x="23" y="3.8" width="7" height="6.4" rx="0.8" fill="#3A3A3E" stroke="#666" strokeWidth="0.5" />
            {/* Botón de encendido, del color del sable elegido */}
            <circle cx="8" cy="7" r="1.5" fill={core} opacity="0.85">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
            </circle>
            {/* Pomo */}
            <rect x="0" y="4" width="4.5" height="6" rx="1" fill="#222" stroke="#555" strokeWidth="0.5" />
          </svg>
        </div>

        {/* La hoja */}
        <div className="flex-1 relative h-2 -ml-1.5">
          {/* Background track */}
          <div className="absolute inset-0 rounded-r-full bg-black/60 border border-white/5" />

          {/* Blade (filled portion) */}
          <div
            className="absolute inset-y-0 left-0 rounded-r-full transition-all duration-1000 ease-out"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${glow} 0%, ${core} 30%, ${core} 90%, white 100%)`,
              boxShadow: `0 0 8px ${core}, 0 0 16px ${core}80, 0 0 32px ${glow}40, inset 0 1px 2px rgba(255,255,255,0.3)`,
            }}
          >
            {/* El núcleo blanco. En una hoja de 8 px no cabe un `inset-y-0.5`
                por lado: quedaba una línea de 1 px que no se veía. Va como una
                banda central, que es donde de verdad está el núcleo caliente. */}
            <div
              className="absolute inset-x-0 top-0 h-1/2 rounded-tr-full"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, transparent 100%)',
              }}
            />
            {/* Animated shimmer */}
            <div
              className="absolute inset-0 rounded-r-full overflow-hidden"
              style={{ opacity: 0.3 }}
            >
              <div
                className="xp-shimmer w-6 h-full bg-gradient-to-r from-transparent via-white to-transparent"
                style={{
                  animation: 'shimmer 3s ease-in-out infinite',
                }}
              />
            </div>
            {/* La punta. Una hoja de sable no termina en un corte plano:
                termina en un punto blanco incandescente. Con la hoja delgada,
                una bola de 12 px la deformaba — ahora es proporcional. */}
            {pct > 5 && (
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                style={{
                  background: 'white',
                  boxShadow: `0 0 5px white, 0 0 11px ${core}`,
                  opacity: 0.85,
                }}
              />
            )}
          </div>

          {/* Percentage marks */}
          {[25, 50, 75].map((tick) => (
            <div
              key={tick}
              className="absolute top-0 bottom-0 w-px"
              style={{ left: `${tick}%`, background: 'rgba(255,255,255,0.08)' }}
            />
          ))}
        </div>
      </div>

      {/* Total XP */}
      <div className="flex justify-between text-[10px] text-swu-muted">
        <span>XP Total: {xp.toLocaleString()}</span>
        <span>{Math.round(progress * 100)}%</span>
      </div>

      {/* Shimmer keyframes (injected via style tag).
          El barrido recorre la barra entera, así que es de los que hay que
          apagar cuando se pide menos movimiento. La compuerta va acá y no en
          index.css porque la animación se declara acá: medido, era una de las
          dos que seguían corriendo con `prefers-reduced-motion: reduce`. */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(400%); }
          100% { transform: translateX(400%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .xp-shimmer { animation: none !important; opacity: 0; }
        }
      `}</style>
    </div>
  )
}

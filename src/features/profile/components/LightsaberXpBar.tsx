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

      {/* Lightsaber bar */}
      <div className="relative flex items-center h-6">
        {/* Hilt (left side) */}
        <div className="relative z-20 flex-shrink-0">
          <svg width="28" height="24" viewBox="0 0 28 24" fill="none">
            {/* Main hilt body */}
            <rect x="4" y="4" width="20" height="16" rx="2" fill="#2A2A2E" stroke="#555" strokeWidth="1" />
            {/* Grip lines */}
            <line x1="10" y1="5" x2="10" y2="19" stroke="#444" strokeWidth="1" />
            <line x1="14" y1="5" x2="14" y2="19" stroke="#444" strokeWidth="1" />
            <line x1="18" y1="5" x2="18" y2="19" stroke="#444" strokeWidth="1" />
            {/* Emitter */}
            <rect x="22" y="6" width="6" height="12" rx="1" fill="#3A3A3E" stroke="#666" strokeWidth="0.5" />
            {/* Power button */}
            <circle cx="8" cy="12" r="2" fill={core} opacity="0.8">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
            </circle>
            {/* Pommel */}
            <rect x="0" y="6" width="5" height="12" rx="1.5" fill="#222" stroke="#555" strokeWidth="0.5" />
          </svg>
        </div>

        {/* Blade track */}
        <div className="flex-1 relative h-4 -ml-1">
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
            {/* Inner white core glow */}
            <div
              className="absolute inset-y-0.5 left-0 right-0 rounded-r-full"
              style={{
                background: `linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 50%, rgba(255,255,255,0.1) 100%)`,
              }}
            />
            {/* Animated shimmer */}
            <div
              className="absolute inset-0 rounded-r-full overflow-hidden"
              style={{ opacity: 0.3 }}
            >
              <div
                className="w-8 h-full bg-gradient-to-r from-transparent via-white to-transparent"
                style={{
                  animation: 'shimmer 3s ease-in-out infinite',
                }}
              />
            </div>
            {/* Blade tip glow */}
            {pct > 5 && (
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                style={{
                  background: 'white',
                  boxShadow: `0 0 6px white, 0 0 12px ${core}`,
                  opacity: 0.7,
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

      {/* Shimmer keyframes (injected via style tag) */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(400%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  )
}

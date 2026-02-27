import type { AspectBar } from '../../../services/gamification'
import { TIER_CONFIG, type AspectTier } from '../../../services/gamification'
import { AspectIcon } from '../../../components/icons/AspectIcon'

interface AspectBarsProps {
  bars: AspectBar[]
}

/** Tier indicator: small badge below bar */
function TierBadge({ tier, tierIndex }: { tier: AspectTier; tierIndex: number }) {
  const cfg = TIER_CONFIG[tier]
  const filled = tierIndex + 1 // 1-4

  return (
    <div className="flex items-center gap-1 mt-0.5">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full transition-all duration-500"
          style={{
            backgroundColor: i < filled ? cfg.borderColor : 'rgba(255,255,255,0.1)',
            boxShadow: i < filled ? `0 0 4px ${cfg.glowColor}` : 'none',
          }}
        />
      ))}
      <span className="text-[8px] font-bold ml-0.5 uppercase tracking-wider" style={{ color: cfg.borderColor }}>
        {cfg.label}
      </span>
    </div>
  )
}

export function AspectBars({ bars }: AspectBarsProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-swu-muted uppercase tracking-widest">Estadísticas por Aspecto</p>
      {bars.map((bar) => {
        const tierCfg = TIER_CONFIG[bar.tier]
        const isKyber = bar.tier === 'kyber' && bar.progress >= 1
        const isMaxed = bar.tierIndex === 3 && bar.progress >= 1

        return (
          <div key={bar.aspect} className="flex items-center gap-2.5">
            {/* Aspect icon with tier border */}
            <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
              {/* Tier border ring */}
              <div
                className={`absolute inset-0 rounded-lg transition-all duration-700 ${isKyber ? 'animate-kyber-glow' : ''}`}
                style={{
                  border: `2px solid ${tierCfg.borderColor}`,
                  boxShadow: isMaxed
                    ? `0 0 8px ${tierCfg.glowColor}, inset 0 0 4px ${tierCfg.glowColor}`
                    : `0 0 4px ${tierCfg.glowColor}`,
                }}
              />
              {/* Inner bg */}
              <div className={`absolute inset-[2px] rounded-md ${bar.bgColor}`} />
              {/* Icon */}
              <div className="relative z-10">
                <AspectIcon aspect={bar.aspect} size={22} />
              </div>
            </div>

            {/* Bar content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-[11px] font-bold ${bar.textColor}`}>{bar.label}</span>
                <span className="text-[10px] text-swu-muted font-mono">{bar.displayValue}</span>
              </div>

              {/* Progress bar */}
              <div className="relative h-2.5 bg-swu-bg rounded-full overflow-hidden border border-swu-border/50">
                {/* Fill */}
                <div
                  className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${bar.color} transition-all duration-700 ease-out`}
                  style={{ width: `${Math.max(bar.progress * 100, 1)}%` }}
                />
                {/* Shine */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-b from-white/15 to-transparent transition-all duration-700 ease-out"
                  style={{ width: `${Math.max(bar.progress * 100, 1)}%` }}
                />
                {/* Tick marks at 25% intervals */}
                {[25, 50, 75].map((tick) => (
                  <div key={tick} className="absolute top-0 bottom-0 w-px bg-black/20" style={{ left: `${tick}%` }} />
                ))}
              </div>

              {/* Tier indicator */}
              <TierBadge tier={bar.tier} tierIndex={bar.tierIndex} />
            </div>
          </div>
        )
      })}

      {/* Kyber glow animation */}
      <style>{`
        @keyframes kyber-glow {
          0%, 100% { box-shadow: 0 0 6px rgba(0,191,255,0.4), inset 0 0 3px rgba(0,191,255,0.2); border-color: #00BFFF; }
          50% { box-shadow: 0 0 14px rgba(0,191,255,0.7), inset 0 0 6px rgba(0,191,255,0.3); border-color: #66D9FF; }
        }
        .animate-kyber-glow { animation: kyber-glow 2s ease-in-out infinite; }
      `}</style>
    </div>
  )
}

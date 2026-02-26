import { calculateLevel } from '../../../services/gamification'

interface XpBarProps {
  xp: number
}

export function XpBar({ xp }: XpBarProps) {
  const { level, rank, xpCurrent, xpNeeded, progress } = calculateLevel(xp)

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

      {/* XP Bar */}
      <div className="relative h-3 bg-swu-bg rounded-full overflow-hidden border border-swu-border">
        {/* Background glow */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-700 ease-out"
          style={{ width: `${Math.max(progress * 100, 2)}%` }}
        />
        {/* Shine overlay */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-b from-white/20 to-transparent transition-all duration-700 ease-out"
          style={{ width: `${Math.max(progress * 100, 2)}%` }}
        />
        {/* Tick marks */}
        {[25, 50, 75].map((tick) => (
          <div key={tick} className="absolute top-0 bottom-0 w-px bg-white/10" style={{ left: `${tick}%` }} />
        ))}
      </div>

      {/* Total XP */}
      <div className="flex justify-between text-[10px] text-swu-muted">
        <span>XP Total: {xp.toLocaleString()}</span>
        <span>{Math.round(progress * 100)}%</span>
      </div>
    </div>
  )
}

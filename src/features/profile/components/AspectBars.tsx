import type { AspectBar } from '../../../services/gamification'
import { SWU_ICON_MAP } from '../../../components/icons/SWUIcons'

interface AspectBarsProps {
  bars: AspectBar[]
}

export function AspectBars({ bars }: AspectBarsProps) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-bold text-swu-muted uppercase tracking-widest">Estadísticas por Aspecto</p>
      {bars.map((bar) => {
        const SvgIcon = SWU_ICON_MAP[bar.svgIcon || bar.aspect.toLowerCase()]
        return (
          <div key={bar.aspect} className="flex items-center gap-2.5">
            {/* Aspect icon in frame */}
            <div className={`relative w-9 h-9 shrink-0 ${bar.bgColor} border rounded-lg flex items-center justify-center`}>
              {SvgIcon ? (
                <SvgIcon size={18} className={bar.textColor} />
              ) : (
                <span className="text-base">{bar.icon}</span>
              )}
            </div>

            {/* Bar content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-[11px] font-bold ${bar.textColor}`}>{bar.label}</span>
                <span className="text-[10px] text-swu-muted font-mono">{bar.displayValue}</span>
              </div>

              {/* Health bar */}
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
                {/* Damage markers (like Predecessor) — decorative ticks */}
                {[20, 40, 60, 80].map((tick) => (
                  <div key={tick} className="absolute top-0 bottom-0 w-px bg-black/20" style={{ left: `${tick}%` }} />
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

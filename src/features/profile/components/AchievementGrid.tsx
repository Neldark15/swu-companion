import { useState } from 'react'
import { ACHIEVEMENTS, ASPECT_CONFIG, type Aspect } from '../../../services/gamification'
import { SWU_ICON_MAP, IconLocked } from '../../../components/icons/SWUIcons'
import { AspectIcon } from '../../../components/icons/AspectIcon'

interface AchievementGridProps {
  unlockedIds: string[]
  achievementDates: Record<string, number>
}

const ASPECTS: Aspect[] = ['Vigilance', 'Command', 'Aggression', 'Cunning', 'Heroism', 'Villainy', 'Progress']

export function AchievementGrid({ unlockedIds, achievementDates }: AchievementGridProps) {
  const [selectedAspect, setSelectedAspect] = useState<Aspect | 'all'>('all')
  const [selectedAch, setSelectedAch] = useState<string | null>(null)

  const filtered = selectedAspect === 'all'
    ? ACHIEVEMENTS
    : ACHIEVEMENTS.filter(a => a.aspect === selectedAspect)

  const unlockedCount = unlockedIds.length
  const totalCount = ACHIEVEMENTS.length

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-swu-muted uppercase tracking-widest">Logros</p>
        <span className="text-[11px] text-swu-muted font-mono">{unlockedCount}/{totalCount}</span>
      </div>

      {/* Aspect filter tabs — uses official SWU aspect icons */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setSelectedAspect('all')}
          className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
            selectedAspect === 'all'
              ? 'bg-swu-accent/20 text-swu-accent border border-swu-accent/30'
              : 'bg-swu-surface text-swu-muted border border-swu-border'
          }`}
        >
          Todos
        </button>
        {ASPECTS.map((asp) => {
          const config = ASPECT_CONFIG[asp]
          const isActive = selectedAspect === asp
          const aspUnlocked = ACHIEVEMENTS.filter(a => a.aspect === asp && unlockedIds.includes(a.id)).length
          const aspTotal = ACHIEVEMENTS.filter(a => a.aspect === asp).length
          return (
            <button
              key={asp}
              onClick={() => setSelectedAspect(asp)}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 ${
                isActive
                  ? `${config.bgColor} ${config.textColor} ${config.borderColor} border`
                  : 'bg-swu-surface text-swu-muted border border-swu-border'
              }`}
            >
              <AspectIcon aspect={asp} size={14} />
              <span>{config.label}</span>
              <span className="opacity-60 font-mono">{aspUnlocked}/{aspTotal}</span>
            </button>
          )
        })}
      </div>

      {/* Achievement grid */}
      <div className="grid grid-cols-3 gap-2">
        {filtered.map((ach) => {
          const unlocked = unlockedIds.includes(ach.id)
          const config = ASPECT_CONFIG[ach.aspect]
          const AchIcon = SWU_ICON_MAP[ach.svgIcon]
          return (
            <button
              key={ach.id}
              onClick={() => setSelectedAch(selectedAch === ach.id ? null : ach.id)}
              className={`relative rounded-xl p-3 border transition-all active:scale-95 ${
                unlocked
                  ? `${config.bgColor} ${config.borderColor} border`
                  : 'bg-swu-surface/50 border-swu-border/50 opacity-50'
              }`}
            >
              {/* Diamond frame icon */}
              <div className={`w-10 h-10 mx-auto mb-1.5 rounded-lg rotate-45 flex items-center justify-center border ${
                unlocked
                  ? `${config.bgColor} ${config.borderColor}`
                  : 'bg-swu-bg border-swu-border'
              }`}>
                <div className="-rotate-45">
                  {unlocked ? (
                    AchIcon ? <AchIcon size={20} className={config.textColor} /> : <span className="text-lg">{ach.icon}</span>
                  ) : (
                    <IconLocked size={18} className="text-swu-muted" />
                  )}
                </div>
              </div>

              <p className={`text-[10px] font-bold text-center truncate ${unlocked ? config.textColor : 'text-swu-muted'}`}>
                {ach.name}
              </p>

              {/* Glow effect for unlocked */}
              {unlocked && (
                <div className={`absolute inset-0 rounded-xl bg-gradient-to-t ${config.color} opacity-5 pointer-events-none`} />
              )}
            </button>
          )
        })}
      </div>

      {/* Detail popover */}
      {selectedAch && (() => {
        const ach = ACHIEVEMENTS.find(a => a.id === selectedAch)
        if (!ach) return null
        const unlocked = unlockedIds.includes(ach.id)
        const config = ASPECT_CONFIG[ach.aspect]
        const date = achievementDates[ach.id]
        const DetailIcon = SWU_ICON_MAP[ach.svgIcon]

        return (
          <div className={`rounded-xl p-4 border ${config.bgColor} ${config.borderColor} space-y-1`}>
            <div className="flex items-center gap-3">
              {/* Show official aspect icon + achievement SVG icon */}
              <div className="relative">
                <AspectIcon aspect={ach.aspect} size={28} />
              </div>
              {DetailIcon && (
                <DetailIcon size={22} className={config.textColor} />
              )}
              <div>
                <p className={`text-sm font-bold ${config.textColor}`}>{ach.name}</p>
                <p className="text-[11px] text-swu-muted">{ach.description}</p>
              </div>
            </div>
            {unlocked && date && (
              <p className="text-[10px] text-swu-muted">Desbloqueado: {new Date(date).toLocaleDateString()}</p>
            )}
            {!unlocked && (
              <p className="text-[10px] text-swu-muted italic">Bloqueado — {ach.description}</p>
            )}
          </div>
        )
      })()}
    </div>
  )
}

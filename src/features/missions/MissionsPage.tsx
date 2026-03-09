/**
 * Missions Page — "Órdenes del Día" + "Campañas Semanales"
 * Shows daily/weekly missions with progress, claim buttons, and reset timers
 */

import { useState, useEffect, useCallback } from 'react'
import { Target, Clock, Gift, CheckCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  getUserMissions,
  claimMissionReward,
  getTimeUntilDailyReset,
  getTimeUntilWeeklyReset,
  type UserMission,
} from '../../services/missionService'

export default function MissionsPage() {
  const { supabaseUser } = useAuth()
  const [daily, setDaily] = useState<UserMission[]>([])
  const [weekly, setWeekly] = useState<UserMission[]>([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [dailyTimer, setDailyTimer] = useState({ hours: 0, minutes: 0 })
  const [weeklyTimer, setWeeklyTimer] = useState({ days: 0, hours: 0 })

  const loadMissions = useCallback(async () => {
    if (!supabaseUser?.id) return
    setLoading(true)
    const data = await getUserMissions(supabaseUser.id)
    setDaily(data.daily)
    setWeekly(data.weekly)
    setLoading(false)
  }, [supabaseUser?.id])

  useEffect(() => { loadMissions() }, [loadMissions])

  // Timer countdown
  useEffect(() => {
    function tick() {
      setDailyTimer(getTimeUntilDailyReset())
      setWeeklyTimer(getTimeUntilWeeklyReset())
    }
    tick()
    const interval = setInterval(tick, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleClaim = async (missionId: string) => {
    if (!supabaseUser?.id || claiming) return
    setClaiming(missionId)
    const result = await claimMissionReward(supabaseUser.id, missionId)
    if (result.success) {
      // Update local state
      const update = (missions: UserMission[]) =>
        missions.map(m => m.missionId === missionId ? { ...m, claimed: true } : m)
      setDaily(prev => update(prev))
      setWeekly(prev => update(prev))
    }
    setClaiming(null)
  }

  const dailyCompleted = daily.filter(m => m.completed).length
  const weeklyCompleted = weekly.filter(m => m.completed).length

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] to-[#1a1a2e] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a1a]/90 backdrop-blur-md border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center">
            <Target size={18} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Misiones</h1>
            <p className="text-[11px] text-white/40">Órdenes del Día y Campañas Semanales</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-white/30" size={24} />
        </div>
      ) : (
        <div className="px-4 py-4 space-y-6">
          {/* Daily Missions */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-cyan-400">Órdenes del Día</span>
                <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
                  {dailyCompleted}/{daily.length}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-white/30">
                <Clock size={10} />
                <span>Reinicio en {dailyTimer.hours}h {dailyTimer.minutes}m</span>
              </div>
            </div>

            <div className="space-y-2">
              {daily.map(m => (
                <MissionCard
                  key={m.missionId}
                  mission={m}
                  onClaim={handleClaim}
                  claiming={claiming === m.missionId}
                />
              ))}
            </div>
          </section>

          {/* Weekly Missions */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-amber-400">Campañas Semanales</span>
                <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
                  {weeklyCompleted}/{weekly.length}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-white/30">
                <Clock size={10} />
                <span>Reinicio en {weeklyTimer.days}d {weeklyTimer.hours}h</span>
              </div>
            </div>

            <div className="space-y-2">
              {weekly.map(m => (
                <MissionCard
                  key={m.missionId}
                  mission={m}
                  onClaim={handleClaim}
                  claiming={claiming === m.missionId}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function MissionCard({ mission, onClaim, claiming }: {
  mission: UserMission
  onClaim: (id: string) => void
  claiming: boolean
}) {
  const { template, progress, completed, claimed } = mission
  const pct = Math.min((progress / template.objectiveValue) * 100, 100)

  return (
    <div className={`rounded-xl border p-3 transition-all ${
      claimed
        ? 'border-white/5 bg-white/[0.02] opacity-60'
        : completed
        ? 'border-green-500/30 bg-green-500/5'
        : 'border-white/10 bg-white/[0.03]'
    }`}>
      <div className="flex items-start gap-3">
        <span className="text-lg shrink-0">{template.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-white/90 truncate">{template.name}</p>
            <span className="text-[10px] text-amber-400 font-medium shrink-0">+{template.rewardXp} XP</span>
          </div>
          <p className="text-[11px] text-white/40 mt-0.5">{template.description}</p>

          {/* Progress bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  completed ? 'bg-green-500' : 'bg-cyan-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] text-white/40 shrink-0 w-12 text-right">
              {progress}/{template.objectiveValue}
            </span>
          </div>
        </div>

        {/* Action button */}
        <div className="shrink-0 ml-1">
          {claimed ? (
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <CheckCircle size={14} className="text-green-400/60" />
            </div>
          ) : completed ? (
            <button
              onClick={() => onClaim(mission.missionId)}
              disabled={claiming}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30 text-green-300 text-[10px] font-bold hover:bg-green-500/30 transition-colors"
            >
              {claiming ? <Loader2 size={12} className="animate-spin" /> : <Gift size={12} />}
              <span>Reclamar</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

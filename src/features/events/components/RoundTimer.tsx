/**
 * RoundTimer — Countdown timer for tournament rounds
 */

import { useState, useEffect } from 'react'

interface Props {
  endTime: string | null
  large?: boolean
}

export function RoundTimer({ endTime, large }: Props) {
  const [remaining, setRemaining] = useState<number>(0)

  useEffect(() => {
    if (!endTime) {
      setRemaining(0)
      return
    }

    const update = () => {
      const diff = new Date(endTime).getTime() - Date.now()
      setRemaining(Math.max(0, diff))
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [endTime])

  if (!endTime) {
    return (
      <div className={`text-swu-muted ${large ? 'text-2xl' : 'text-sm'}`}>
        Sin timer
      </div>
    )
  }

  const totalSeconds = Math.floor(remaining / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const isUrgent = minutes < 5 && remaining > 0
  const isExpired = remaining === 0

  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <div className="text-center">
      <div
        className={`font-mono font-bold tracking-wider ${
          large ? 'text-5xl' : 'text-2xl'
        } ${
          isExpired
            ? 'text-red-500 animate-pulse'
            : isUrgent
            ? 'text-red-400'
            : 'text-swu-accent'
        }`}
      >
        {isExpired ? '00:00' : display}
      </div>
      {isExpired && (
        <div className="text-red-400 text-xs mt-1 animate-pulse">
          ¡Tiempo terminado!
        </div>
      )}
      {isUrgent && !isExpired && (
        <div className="text-red-400 text-xs mt-1">
          ¡Últimos minutos!
        </div>
      )}
    </div>
  )
}

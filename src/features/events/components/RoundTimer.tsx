/**
 * El reloj de la ronda.
 *
 * Cuenta contra la hora del SERVIDOR, no contra la del aparato. El plazo ya se
 * guardaba bien —un instante absoluto en UTC—, pero medirlo con `Date.now()`
 * hacía que un teléfono adelantado tres minutos mostrara tres minutos menos
 * que la mesa de al lado, y cada pantalla se veía coherente consigo misma.
 */

import { useState, useEffect } from 'react'
import { ahora, medirDesfase } from '../../../services/horaServidor'

interface Props {
  endTime: string | null
  large?: boolean
}

export function RoundTimer({ endTime, large }: Props) {
  const [remaining, setRemaining] = useState<number>(0)

  useEffect(() => {
    // Sin `endTime` no hay nada que contar y el componente devuelve null más
    // abajo, así que poner el resto en 0 no lo veía nadie.
    if (!endTime) return

    const update = () => {
      const diff = new Date(endTime).getTime() - ahora()
      setRemaining(Math.max(0, diff))
    }

    // Se mide una vez y se vuelve a pintar: hasta que llegue la medición se
    // cuenta con el reloj local, que es lo mismo que se hacía antes.
    void medirDesfase().then(update)
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
            : 'text-swu-accent-texto'
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

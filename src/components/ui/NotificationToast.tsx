/**
 * Global notification toast — renders at top of App
 * Slides in from top, auto-dismisses after 5s
 */

import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useNotificationStore } from '../../services/notificationService'
import { esRutaInterna } from '../../services/rutaInterna'

const TYPE_STYLES: Record<string, string> = {
  achievement: 'border-yellow-500/40 bg-yellow-500/10',
  gift: 'border-indigo-500/40 bg-indigo-500/10',
  level_up: 'border-green-500/40 bg-green-500/10',
  tier_up: 'border-amber-500/40 bg-amber-500/10',
  mission: 'border-cyan-500/40 bg-cyan-500/10',
  bond: 'border-purple-500/40 bg-purple-500/10',
  title: 'border-yellow-400/40 bg-yellow-400/10',
  info: 'border-gray-500/40 bg-gray-500/10',
}

export function NotificationToast() {
  const navigate = useNavigate()
  const toast = useNotificationStore((s) => s.currentToast)
  const dismiss = useNotificationStore((s) => s.dismissToast)
  const markRead = useNotificationStore((s) => s.markRead)

  if (!toast) return null

  const style = TYPE_STYLES[toast.type] || TYPE_STYLES.info
  // Se comprueba ANTES de dibujar: la flecha y la etiqueta tienen que decir lo
  // mismo que va a hacer el toque. El `link` sale de localStorage y uno se arma
  // con datos del servidor, así que no es texto de esta pantalla — ver
  // `services/rutaInterna.ts`.
  const destino = esRutaInterna(toast.link) ? toast.link : null

  /* Con destino, tocar el aviso LLEVA ahí y lo marca leído: es lo que hace un
   * aviso del sistema en cualquier teléfono, y es lo que la persona espera
   * cuando lee «Te espera en La Bóveda».
   *
   * Sin destino se comporta como antes, o sea que solo se cierra. Eso NO es un
   * caso raro: los cuatro avisos de mesa de TournamentPlayerView van a
   * propósito sin `link` —ya estás en esa pantalla—, y ahí navegar sería sacar
   * a alguien de su partida. */
  const alTocar = () => {
    if (destino) {
      markRead(toast.id)
      dismiss()
      navigate(destino)
      return
    }
    dismiss()
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[90vw] max-w-sm animate-slide-in-top pointer-events-auto">
      <button
        onClick={alTocar}
        aria-label={destino ? `${toast.title}. ${toast.message}. Tocá para ir.` : `${toast.title}. ${toast.message}. Tocá para cerrar.`}
        className={`w-full flex items-center gap-3 rounded-xl border p-3 shadow-lg backdrop-blur-md ${style}`}
      >
        <span className="text-xl shrink-0">{toast.icon || '📢'}</span>
        <div className="flex-1 text-left min-w-0">
          <p className="text-xs font-bold text-white/90 truncate">{toast.title}</p>
          <p className="text-[11px] text-white/60 truncate">{toast.message}</p>
        </div>
        {destino && <ChevronRight size={16} className="text-white/50 shrink-0" />}
      </button>
    </div>
  )
}

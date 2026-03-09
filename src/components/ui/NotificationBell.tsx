/**
 * Notification Bell — shows unread count badge + dropdown of recent notifications
 */

import { useState, useRef, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { useNotificationStore, type AppNotification } from '../../services/notificationService'

const TYPE_ICON: Record<string, string> = {
  achievement: '🏆',
  gift: '🎁',
  level_up: '⬆️',
  tier_up: '🏅',
  mission: '✅',
  bond: '🤝',
  title: '👑',
  info: '📢',
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const markRead = useNotificationStore((s) => s.markRead)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const recent = notifications.slice(0, 15)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
        aria-label="Notificaciones"
      >
        <Bell size={18} className="text-white/60" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 max-h-80 overflow-y-auto rounded-xl border border-white/10 bg-[#1a1a2e]/95 backdrop-blur-xl shadow-2xl z-50">
          <div className="flex items-center justify-between p-3 border-b border-white/10">
            <span className="text-xs font-bold text-white/80">Notificaciones</span>
            {unreadCount > 0 && (
              <button
                onClick={() => { markAllRead(); }}
                className="text-[10px] text-indigo-400 hover:text-indigo-300"
              >
                Marcar leídas
              </button>
            )}
          </div>

          {recent.length === 0 ? (
            <div className="p-6 text-center text-xs text-white/40">
              Sin notificaciones
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {recent.map((n: AppNotification) => (
                <button
                  key={n.id}
                  onClick={() => { markRead(n.id); setOpen(false); }}
                  className={`w-full flex items-start gap-2.5 p-3 text-left hover:bg-white/5 transition-colors ${
                    !n.read ? 'bg-white/[0.03]' : ''
                  }`}
                >
                  <span className="text-base shrink-0 mt-0.5">{TYPE_ICON[n.type] || '📢'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-semibold truncate ${!n.read ? 'text-white' : 'text-white/60'}`}>
                      {n.title}
                    </p>
                    <p className="text-[10px] text-white/40 truncate">{n.message}</p>
                  </div>
                  <span className="text-[9px] text-white/30 shrink-0 mt-0.5">{timeAgo(n.timestamp)}</span>
                  {!n.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1.5" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

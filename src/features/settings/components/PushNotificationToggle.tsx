/**
 * PushNotificationToggle — UI para suscribirse/desuscribirse a Web Push.
 *
 * Maneja:
 * - Permiso del navegador (granted / denied / default)
 * - Estado actual de la suscripción
 * - Mensajes de error claros (especialmente iOS)
 */

import { useEffect, useState } from 'react'
import { Bell, BellOff, Loader2, ShieldAlert, Smartphone, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import {
  checkPushSupport,
  getNotificationPermission,
  isUserSubscribed,
  subscribeToPush,
  unsubscribeFromPush,
} from '../../../services/pushService'

export function PushNotificationToggle() {
  const { supabaseUser } = useAuth()
  const support = checkPushSupport()
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [subscribed, setSubscribed] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const refresh = async () => {
    setPermission(getNotificationPermission())
    setSubscribed(await isUserSubscribed())
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  if (!supabaseUser) {
    return (
      <div className="bg-swu-surface rounded-2xl p-4 border border-swu-border space-y-2">
        <div className="flex items-center gap-2 text-swu-muted">
          <Bell size={16} />
          <p className="text-sm font-semibold text-swu-text">Notificaciones Push</p>
        </div>
        <p className="text-[11px] text-swu-muted">Inicia sesión para activar notificaciones push.</p>
      </div>
    )
  }

  if (!support.supported) {
    const ua = navigator.userAgent
    const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isAndroid = /Android/.test(ua)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true

    return (
      <div className="bg-swu-amber/5 border border-swu-amber/30 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-swu-amber">
          <ShieldAlert size={16} />
          <p className="text-sm font-semibold text-swu-text">Notificaciones Push no disponibles</p>
        </div>

        {/* Specific reason */}
        <p className="text-[12px] text-swu-text">{humanReason(support.reason)}</p>

        {/* Diagnostic detail */}
        <div className="bg-black/20 rounded-lg p-2.5 text-[10px] text-swu-muted leading-relaxed space-y-0.5 font-mono">
          <p>código: <span className="text-swu-amber">{support.reason || 'unknown'}</span></p>
          <p>secureContext: {String(window.isSecureContext)}</p>
          <p>serviceWorker: {String('serviceWorker' in navigator)}</p>
          <p>PushManager: {String('PushManager' in window)}</p>
          <p>Notification: {String('Notification' in window)}</p>
          <p>standalone (PWA): {String(isStandalone)}</p>
          <p>plataforma: {isIOS ? 'iOS' : isAndroid ? 'Android' : 'Desktop/Other'}</p>
        </div>

        {/* iOS-specific guidance */}
        {isIOS && !isStandalone && (
          <div className="bg-swu-accent/10 border border-swu-accent/20 rounded-lg p-3 text-[11px] text-swu-text leading-relaxed">
            <p className="font-semibold mb-1 flex items-center gap-1">
              <Smartphone size={12} className="text-swu-accent" /> Esto es lo que pasa en iOS
            </p>
            <p className="mb-2">
              Apple solo permite Web Push si la PWA está <strong>instalada desde Safari</strong>
              (no funciona en pestañas normales del navegador).
            </p>
            <p className="font-semibold mb-1">Pasos:</p>
            <ol className="list-decimal list-inside space-y-0.5 ml-1">
              <li>En Safari (no Chrome iOS), tocá <strong>Compartir</strong> 􀈂 abajo</li>
              <li>Bajá y tocá <strong>Añadir a pantalla de inicio</strong></li>
              <li>Confirmá <strong>Añadir</strong></li>
              <li>Cerrá Safari y abrí HOLOCRON SWU desde el ícono nuevo</li>
              <li>Volvé acá y activá Push desde la PWA</li>
            </ol>
            <p className="mt-2 text-swu-muted">
              Requiere iOS 16.4 o más reciente. Si estás en iOS anterior, no hay forma de activar push.
            </p>
          </div>
        )}

        {/* Android-specific guidance (rare to fail but possible with FF Focus or strict modes) */}
        {isAndroid && !isStandalone && support.reason === 'no-push' && (
          <div className="bg-swu-accent/10 border border-swu-accent/20 rounded-lg p-3 text-[11px] text-swu-text leading-relaxed">
            <p className="font-semibold mb-1">Android sin PushManager</p>
            <p>Tu navegador podría tener Push deshabilitado. Probá con Chrome o instalá
            la PWA (3 puntos → "Instalar aplicación") y reabrí desde el ícono.</p>
          </div>
        )}

        {/* Reload helper */}
        <button
          onClick={() => window.location.reload()}
          className="w-full py-2 rounded-lg bg-swu-surface border border-swu-border text-[11px] text-swu-muted hover:text-swu-text"
        >
          Recargar y reintentar
        </button>
      </div>
    )
  }

  const handleToggle = async () => {
    setError(null)
    setActionLoading(true)
    if (subscribed) {
      const r = await unsubscribeFromPush(supabaseUser.id)
      if (!r.ok) setError(r.error ?? 'Error al desactivar')
    } else {
      const r = await subscribeToPush(supabaseUser.id)
      if (!r.ok) setError(r.error ?? 'Error al activar')
    }
    setActionLoading(false)
    await refresh()
  }

  return (
    <div className="bg-swu-surface rounded-2xl p-4 border border-swu-border space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-swu-text flex items-center gap-1.5">
            {subscribed ? <Bell size={14} className="text-swu-accent" /> : <BellOff size={14} className="text-swu-muted" />}
            Notificaciones Push
          </p>
          <p className="text-[11px] text-swu-muted mt-0.5">
            Recibe avisos del torneo y otras transmisiones aunque la app esté cerrada.
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={actionLoading || loading || permission === 'denied'}
          className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
            subscribed ? 'bg-swu-accent' : 'bg-swu-border'
          } disabled:opacity-50`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${
            subscribed ? 'translate-x-6' : ''
          }`}>
            {actionLoading && (
              <Loader2 size={12} className="absolute inset-0 m-auto animate-spin text-swu-accent" />
            )}
          </span>
        </button>
      </div>

      {/* Status */}
      {!loading && (
        <div className="flex items-center gap-2">
          <PermissionPill perm={permission} subscribed={subscribed} />
        </div>
      )}

      {error && (
        <div className="bg-swu-red/10 border border-swu-red/30 rounded-lg p-2 text-[11px] text-swu-red">{error}</div>
      )}

      {permission === 'denied' && (
        <p className="text-[11px] text-swu-muted leading-relaxed">
          Bloqueaste las notificaciones de este sitio. Para reactivar, abrí la configuración
          del navegador, buscá HOLOCRON SWU / swusv.com y permití las notificaciones.
        </p>
      )}
    </div>
  )
}

function PermissionPill({ perm, subscribed }: { perm: NotificationPermission | 'unsupported'; subscribed: boolean }) {
  if (subscribed) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-swu-green bg-swu-green/15 px-2 py-0.5 rounded-full">
        <CheckCircle2 size={10} /> Activo
      </span>
    )
  }
  if (perm === 'denied') {
    return <span className="text-[10px] font-bold text-swu-red bg-swu-red/15 px-2 py-0.5 rounded-full">BLOQUEADO</span>
  }
  return <span className="text-[10px] font-bold text-swu-muted bg-swu-muted/15 px-2 py-0.5 rounded-full">INACTIVO</span>
}

function humanReason(r?: ReturnType<typeof checkPushSupport>['reason']): string {
  switch (r) {
    case 'insecure-context': return 'Web Push requiere HTTPS — esta página debe servirse vía HTTPS.'
    case 'no-sw':            return 'Tu navegador no soporta Service Workers.'
    case 'no-push':          return 'Tu navegador no soporta la Push API.'
    case 'no-notification':  return 'Tu navegador no soporta notificaciones del sistema.'
    case 'no-vapid':         return 'El servidor aún no está configurado para enviar push (VAPID).'
    case 'no-supabase':      return 'Sin conexión al backend.'
    default:                 return 'Push no disponible.'
  }
}

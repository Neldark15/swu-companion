/**
 * Web Push client — Fase C.
 *
 * Maneja el subscribe/unsubscribe del navegador al servidor de push,
 * y persiste la suscripción en Supabase para que el serverless
 * /api/send-push pueda enviarle notificaciones al device.
 */

import { supabase, isSupabaseReady } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

// ─── Capability check ──────────────────────────────────────────

export interface PushSupport {
  supported: boolean
  reason?: 'no-sw' | 'no-push' | 'no-notification' | 'no-vapid' | 'no-supabase' | 'insecure-context'
}

export function checkPushSupport(): PushSupport {
  if (typeof window === 'undefined') return { supported: false, reason: 'no-sw' }
  if (!window.isSecureContext) return { supported: false, reason: 'insecure-context' }
  if (!('serviceWorker' in navigator)) return { supported: false, reason: 'no-sw' }
  if (!('PushManager' in window)) return { supported: false, reason: 'no-push' }
  if (!('Notification' in window)) return { supported: false, reason: 'no-notification' }
  if (!VAPID_PUBLIC_KEY) return { supported: false, reason: 'no-vapid' }
  if (!isSupabaseReady()) return { supported: false, reason: 'no-supabase' }
  return { supported: true }
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

// ─── Subscription state ────────────────────────────────────────

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!checkPushSupport().supported) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function isUserSubscribed(): Promise<boolean> {
  const sub = await getCurrentSubscription()
  return sub !== null
}

// ─── Subscribe / Unsubscribe ───────────────────────────────────

export async function subscribeToPush(
  userId: string
): Promise<{ ok: boolean; error?: string; subscription?: PushSubscription }> {
  const support = checkPushSupport()
  if (!support.supported) {
    return { ok: false, error: humanReason(support.reason) }
  }

  try {
    // Ask permission (must be called from a user gesture)
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') {
      return { ok: false, error: 'Permiso de notificaciones denegado por el usuario' }
    }

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // TS5 stricter typing — Uint8Array<ArrayBufferLike> vs BufferSource expecting ArrayBuffer
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY as string) as unknown as BufferSource,
      })
    }

    const json = sub.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, error: 'Suscripción del navegador inválida' }
    }

    // Upsert in Supabase (on conflict endpoint, refresh user_id + last_used_at)
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          user_agent: navigator.userAgent.slice(0, 250),
          last_used_at: new Date().toISOString(),
          failure_count: 0,
        },
        { onConflict: 'endpoint' }
      )

    if (error) return { ok: false, error: error.message }

    return { ok: true, subscription: sub }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al suscribirse' }
  }
}

export async function unsubscribeFromPush(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!checkPushSupport().supported) return { ok: false, error: 'Push no soportado' }

  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return { ok: true } // already unsubscribed

    const endpoint = sub.endpoint
    await sub.unsubscribe()

    // Remove from Supabase
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint)

    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al desuscribirse' }
  }
}

// ─── Helpers ───────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function humanReason(reason?: PushSupport['reason']): string {
  switch (reason) {
    case 'insecure-context': return 'Web Push requiere HTTPS'
    case 'no-sw':            return 'Tu navegador no soporta Service Workers'
    case 'no-push':          return 'Tu navegador no soporta Push API'
    case 'no-notification':  return 'Tu navegador no soporta notificaciones'
    case 'no-vapid':         return 'Servidor sin configurar (VAPID_PUBLIC_KEY ausente)'
    case 'no-supabase':      return 'Sin conexión al backend'
    default:                 return 'Push no disponible'
  }
}

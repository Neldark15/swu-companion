/// <reference lib="webworker" />
/**
 * HOLOCRON SWU — Custom Service Worker
 *
 * Generated via vite-plugin-pwa's injectManifest strategy.
 * Manages: precache, runtime cache for the cards API, push notifications.
 */

import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

// ─── Precache (manifest injected at build time) ──────────
precacheAndRoute(self.__WB_MANIFEST)

// ─── Runtime cache for SWU cards API ─────────────────────
registerRoute(
  ({ url }) => url.href.startsWith('https://api.swuapi.com/'),
  new StaleWhileRevalidate({
    cacheName: 'swu-api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
      }),
    ],
  })
)

// ─── Web Push handler ────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload: {
    title?: string
    body?: string
    icon?: string
    badge?: string
    link?: string
    tag?: string
    type?: string
  } = {}

  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'HOLOCRON SWU', body: event.data.text() }
  }

  const title = payload.title || 'HOLOCRON SWU'
  const options: NotificationOptions & { actions?: Array<{ action: string; title: string }> } = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    tag: payload.tag,        // tag groups same-tag notifications
    data: {
      link: payload.link || '/',
      type: payload.type,
    },
    // requireInteraction: false, // dismiss on its own
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ─── Notification click ─────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = (event.notification.data?.link as string) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open at the link or app root, focus it
      for (const client of clientList) {
        const clientUrl = new URL(client.url)
        if (clientUrl.pathname === link || clientUrl.origin === self.location.origin) {
          ;(client as WindowClient).focus()
          ;(client as WindowClient).navigate(link).catch(() => undefined)
          return
        }
      }
      // No matching window — open new one
      return self.clients.openWindow(link)
    })
  )
})

// ─── Skip waiting on message (autoUpdate behavior) ───────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

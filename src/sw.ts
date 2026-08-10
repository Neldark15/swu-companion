/// <reference lib="webworker" />
/**
 * HOLOCRON SWU — Custom Service Worker
 *
 * Generated via vite-plugin-pwa's injectManifest strategy.
 * Manages: precache, runtime cache for the cards API, push notifications.
 */

import { precacheAndRoute, createHandlerBoundToURL, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { clientsClaim } from 'workbox-core'

declare const self: ServiceWorkerGlobalScope

// ─── Ciclo de vida ────────────────────────────────────────────────────
//
// NO se llama a `skipWaiting()` en el arranque a propósito. La app usa
// `registerType: 'prompt'`: cuando hay una versión nueva, esta se queda EN
// ESPERA y la app muestra el aviso "hay una actualización". Recién cuando el
// usuario toca Actualizar llega el mensaje SKIP_WAITING de más abajo.
//
// Si se hiciera skipWaiting acá, nunca existiría una versión en espera y el
// aviso no aparecería jamás.
//
// `clientsClaim` sí va: una vez activada, toma el control de las pestañas
// abiertas en el acto. Sin esto, la versión nueva quedaba activa pero sin
// controlar nada, y el navegador seguía sirviendo el index.html viejo —
// medido en producción: cargaba `index-BSkwW_Gc.css` con el servidor ya
// sirviendo `index-1H8UJgmK.css`.
clientsClaim()

// Borra los precaches de versiones anteriores; si no, se acumulan.
cleanupOutdatedCaches()

// ─── Precache (manifest injected at build time) ──────────
precacheAndRoute(self.__WB_MANIFEST)

// ─── SPA navigation fallback ──────────────────────────────
// Any client-side route (/admin, /events, /profile, etc.) should be served
// by the cached index.html so React Router can handle it. Without this,
// refreshing /admin while offline (or before Vercel rewrites kick in) would 404.
//
// Excludes:
// - /api/* → must hit the network (Vercel serverless)
// - /assets/* → handled by precacheAndRoute
// - files with extensions (favicon.ico, manifest.webmanifest, etc.) → network
const navigationHandler = createHandlerBoundToURL('/index.html')
registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [
      /^\/api\//,
      /^\/assets\//,
      /* Archivos con extensión → a la red, no al index.html.
       *
       * `NavigationRoute` prueba estas regex contra `pathname + search`, no
       * contra el pathname solo. La versión vieja (`/\.[a-z0-9]+$/i`) miraba el
       * final de TODA la URL, así que `/rulings?regla=7.4.2` parecía «archivo
       * con extensión .2» y se quedaba sin fallback offline. No era un caso
       * raro: 923 de los 935 ids de regla llevan punto, y ese enlace es el que
       * se comparte por WhatsApp y el que un juez abre en el local sin señal.
       *
       * Ahora el punto tiene que estar en el PATHNAME (antes del `?`).
       * Descartada la variante `{2,5}`: dejaba de excluir /manifest.webmanifest. */
      /^[^?]+\.[a-z0-9]+(\?|$)/i,
    ],
  })
)

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

// ─── Datos propios que el precache NO agarra ─────────────
//
// `globPatterns` lista js, css, html, ico, png, svg y woff2 — ni .json ni .bin.
// Resultado comprobado sobre dist: de las 173 entradas precacheadas, cero son
// de `/datos-cr/`. Y /rulings es una pantalla 100% local (solo hace fetch de
// archivos propios), o sea que debería ser LA pantalla que mejor funciona sin
// señal, que es cuando un juez la necesita en el local. Hoy queda vacía con un
// botón de «Reintentar».
//
// Van por regla runtime y no metidos al precache a propósito: el precache es
// una instalación atómica y sumarle 1,3 MB hace más frágil cada actualización.
//
// `StaleWhileRevalidate` y NO `CacheFirst`: estas rutas son fijas —viven en
// public/ y no llevan hash de contenido en el nombre— pero su contenido SÍ
// cambia. Con CacheFirst y 30 días de vigencia, publicar el CR v8.1 no habría
// servido de nada: una PWA ya instalada seguiría entregando el v8.0 hasta un mes
// después, y un juez citaría en torneo una regla derogada desde la pantalla que
// la app presenta como el reglamento. Lo mismo con el índice de arte: al salir
// un set nuevo, el escáner no reconocería las cartas nuevas durante un mes.
//
// Con SWR se responde al instante desde la caché (que es lo que se buscaba para
// el uso sin señal) y en paralelo se refresca, así que la carga siguiente ya
// trae lo nuevo. Un deploy NO invalida las cachés de runtime —`cleanupOutdatedCaches()`
// solo purga el precache—, así que esto no es opcional.
registerRoute(
  ({ url }) => url.origin === self.location.origin
    && (url.pathname.startsWith('/datos-cr/') || url.pathname === '/card-hashes.bin'),
  new StaleWhileRevalidate({
    cacheName: 'swu-datos-locales',
    plugins: [new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 * 30 })],
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
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      /* Antes esto navegaba SIEMPRE, incluso si la ventana ya estaba donde el
         aviso quería llevarla. Con el destino por defecto `/`, tocar una
         difusión sin enlace te sacaba de donde estuvieras y te tiraba a Inicio
         recargando todo el estado de React. Ahora:
           1. si hay una ventana ya en el destino, solo se enfoca;
           2. si no, se navega la primera del mismo origen, y solo si el destino
              dice algo (no el `/` de relleno) y no es donde ya está.
         La primera rama del `if` viejo (`pathname === link`) convivía con un
         `|| origin === ...` que la volvía inútil: cualquier ventana entraba. */
      const propias = clientList.filter(c => new URL(c.url).origin === self.location.origin)

      const yaEnDestino = propias.find(c => new URL(c.url).pathname === link)
      if (yaEnDestino) return (yaEnDestino as WindowClient).focus()

      const primera = propias[0]
      if (primera) {
        await (primera as WindowClient).focus()
        if (link !== '/') {
          /* El `return` viejo salía del bucle aunque `navigate()` fallara, y
             por spec puede rechazar (ventana no controlada, por ejemplo). Si
             falla, se abre una ventana nueva en vez de no hacer nada. */
          try {
            await (primera as WindowClient).navigate(link)
            return
          } catch {
            return void self.clients.openWindow(link)
          }
        }
        return
      }

      /* Ventana nueva. Si el aviso no traía destino, se marca la URL: el
         restaurador de ruta se salta cualquier arranque con query, así que
         este `?desde=push` evita que un aviso sin enlace termine reabriendo
         la última pantalla en vez de Inicio. */
      return void self.clients.openWindow(link === '/' ? '/?desde=push' : link)
    })
  )
})

// ─── Skip waiting on message (autoUpdate behavior) ───────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

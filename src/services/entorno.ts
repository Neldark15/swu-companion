/**
 * Dónde se está ejecutando la app. Datos, no componentes.
 *
 * Lo usa la puerta de instalación para decidir si alguien puede instalar la
 * PWA, si ya la tiene, o si está en un sitio donde instalar es IMPOSIBLE y por
 * lo tanto exigirlo sería dejarlo encerrado.
 */

export type Plataforma = 'ios' | 'android' | 'escritorio' | 'desconocida'

/**
 * Navegadores EMBEBIDOS dentro de otra app (el de Instagram, el de Facebook,
 * TikTok…). Importan porque **desde ahí no se puede instalar una PWA**:
 *
 * - En iOS, «Añadir a inicio» solo existe en Safari. El navegador de Instagram
 *   es un WKWebView sin ese menú: no hay ningún gesto que instale la app.
 * - En Android son WebViews que no disparan `beforeinstallprompt`.
 *
 * O sea que exigir la instalación ahí no es «más estricto», es una pared sin
 * puerta: la persona no tiene forma de cumplir. Por eso se los deja pasar.
 *
 * La detección es por cadena de agente, que es lo único que exponen:
 *   Instagram → «Instagram 300.0.0.29.110»
 *   Facebook  → «FBAN/FBIOS» o «FB_IAB»
 *   TikTok    → «BytedanceWebview» / «musical_ly»
 */
export function navegadorEmbebido(): 'instagram' | 'facebook' | 'tiktok' | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return 'facebook'
  if (/BytedanceWebview|musical_ly|TikTok/i.test(ua)) return 'tiktok'
  return null
}

export function plataforma(): Plataforma {
  if (typeof navigator === 'undefined') return 'desconocida'
  const ua = navigator.userAgent

  // ANDROID SE COMPRUEBA PRIMERO, y no es un detalle de estilo.
  //
  // El iPad moderno miente en su cadena de agente y dice «Macintosh»; el truco
  // conocido para delatarlo es `platform === 'MacIntel'` con táctil. Pero esa
  // regla también da verdadero en un Android emulado sobre un Mac —medido:
  // ua «Linux; Android 14; Pixel 8», platform «MacIntel», maxTouchPoints 5— y
  // seguramente en más de un aparato real. Con la regla del iPad primero, a un
  // Android se le enseñaban los pasos de iPhone: «tocá Compartir en Safari»,
  // instrucciones imposibles de seguir en una pantalla que además NO deja
  // pasar. La peor combinación posible.
  if (/Android/.test(ua)) return 'android'

  const esIOS = /iPhone|iPad|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (esIOS) return 'ios'

  if (/Mobi/i.test(ua)) return 'desconocida'
  return 'escritorio'
}

/** ¿Se está ejecutando ya como app instalada? */
export function esStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true
  if (window.matchMedia('(display-mode: minimal-ui)').matches) return true
  // iOS Safari no implementa display-mode: usa esta propiedad suya de siempre.
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true
}

/**
 * Rutas que NUNCA pasan por la puerta, y por qué.
 *
 * No son excepciones de conveniencia: en estas la instalación es imposible o
 * el bloqueo rompería algo que está en el aire.
 *
 * - `/overlay/:code` lo carga OBS como fuente de navegador. Es un Chromium
 *   headless: no tiene menú, no puede instalar nada, y si le tapamos la
 *   pantalla se cae la transmisión del torneo EN VIVO.
 * - `/estudio/:code` es el panel de control de esa transmisión.
 * - `/events/live/:code` es la vista pública para quien mira desde afuera.
 * - Lo demás son páginas públicas: es lo que hace que un enlace compartido
 *   —la credencial, un torneo, una regla— traiga gente nueva. Ponerles una
 *   pared delante mata la cadena que queremos que corra.
 */
const RUTAS_LIBRES = [
  // Los bancos son solo de desarrollo y se podan del bundle de producción.
  // Van libres porque la puerta hacía imposible revisar un diseño MÓVIL en un
  // teléfono: tapaba justo la pantalla que hay que mirar.
  /^\/banco-/,
  /^\/overlay\//,
  /^\/estudio/,
  /^\/events\/live\//,
  /^\/rulings/,
  /^\/meta/,
  /^\/torneos/,
  // El calendario es la pantalla de «cuándo jugamos»: es lo que se comparte
  // por WhatsApp para invitar, así que taparla con la puerta de instalación
  // sería cerrarle la puerta justo a quien todavía no tiene la app.
  /^\/calendario/,
  /^\/aurebesh/,
  // El Taller de sables: pantalla 3D que hay que poder revisar en un teléfono
  // sin la puerta de instalación encima, igual que los bancos. Está abierto a
  // toda la comunidad, pero el que no tenga sesión igual no puede comprar ni
  // guardar: eso lo decide `sable_abierto()` DENTRO de cada RPC, no esta lista.
  /^\/sable/,
  // Terraformar, por lo mismo que /sable: es una pantalla 3D que hay que poder
  // revisar en un teléfono sin la puerta de instalación encima. La propia
  // pantalla se rinde con un mensaje claro si no hay sesión.
  /^\/terraformar/,
  // El Espacio de Creadores: Alejo tiene que poder abrir su enlace en el
  // teléfono sin el muro de instalación. La cerradura real está en las
  // policies del servidor (demo cerrado), no acá.
  /^\/c\//,
  /^\/liga\//,
  /^\/u\//,
  /^\/blog/,
  /^\/sedes?/,
]

export function rutaLibre(ruta: string): boolean {
  return RUTAS_LIBRES.some((r) => r.test(ruta))
}

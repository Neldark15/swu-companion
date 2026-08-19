import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { esRutaInterna } from '../services/rutaInterna'

/**
 * Guarda dónde estabas y te devuelve ahí cuando el sistema mató la app.
 *
 * ── El problema ──────────────────────────────────────────────────────
 *
 * Minimizar y volver YA funciona: es la misma pestaña, el mismo heap, la misma
 * URL. Lo que se pierde es otra cosa — cuando iOS o Android matan el proceso
 * de la PWA para recuperar memoria, muere la tarea entera: no queda historial,
 * ni heap, ni `sessionStorage`. El siguiente toque al ícono es una navegación
 * NUEVA al `start_url` del manifiesto, que es `/`.
 *
 * O sea que la pérdida ocurre ANTES de que corra una línea de código nuestro.
 * No se puede evitar que el sistema mate el proceso, y `start_url` es estático
 * por especificación: no puede ser «la última ruta». Lo único que está en
 * nuestras manos es RESTAURAR.
 *
 * ── Por qué localStorage y no sessionStorage ─────────────────────────
 *
 * Un proceso matado abre un contexto de navegación nuevo, y `sessionStorage`
 * llegaría vacío exactamente en el único caso que queremos cubrir.
 *
 * ── Por qué se guarda en cada navegación ─────────────────────────────
 *
 * Y no en `visibilitychange` ni `pagehide`: cuando el sistema mata el proceso
 * puede no entregar NINGÚN evento. Una escritura por navegación es barata y no
 * depende de que nos avisen. (`unload` además rompería el bfcache que hoy
 * funciona, y `beforeunload` no dispara al morir en segundo plano.)
 */

const LLAVE = 'swu_ruta_v1'

/** Media hora. Si volvés al otro día querés Inicio, no la pantalla de ayer. */
const VIGENCIA_MS = 30 * 60 * 1000

interface RutaGuardada {
  ruta: string
  ts: number
}

function leer(): RutaGuardada | null {
  try {
    const crudo = localStorage.getItem(LLAVE)
    if (!crudo) return null
    const d: unknown = JSON.parse(crudo)
    if (typeof d !== 'object' || d === null) return null
    const { ruta, ts } = d as Partial<RutaGuardada>
    if (typeof ruta !== 'string' || typeof ts !== 'number' || !Number.isFinite(ts)) return null
    // La ruta tiene que ser interna y absoluta, o un valor manipulado en
    // localStorage sería un redirector abierto. La regla vive en
    // `services/rutaInterna.ts` porque ahora también la necesita el `link` de
    // las notificaciones; tenerla en dos sitios es cómo una de las dos se
    // queda vieja. Esa versión además tapa `"/<TAB>/evil.com"`, que esta
    // comprobación dejaba pasar: el navegador borra el tabulador ANTES de
    // mirar la forma, así que terminaba siendo `//evil.com`.
    if (!esRutaInterna(ruta)) return null
    return { ruta, ts }
  } catch {
    return null
  }
}

/** ¿Corriendo como app instalada, y no como pestaña normal del navegador? */
function esAppInstalada(): boolean {
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true
    // iOS no implementa display-mode y usa esta bandera propia.
    return (navigator as Navigator & { standalone?: boolean }).standalone === true
  } catch {
    return false
  }
}

export function useRutaPersistente() {
  const location = useLocation()
  const navigate = useNavigate()
  const yaRestaure = useRef(false)

  // ── Restaurar: UNA sola vez, al montar, y solo si pasa las cinco guardas ──
  useEffect(() => {
    if (yaRestaure.current) return
    yaRestaure.current = true

    // (1) Solo desde la raíz. Si entraste por un enlace a una ruta concreta,
    //     ese enlace manda. Protege los deep links que la app declara como
    //     intencionales: /rulings?regla=..., /events/live/:code, /blog/:slug.
    if (window.location.pathname !== '/') return

    // (2) Sin query ni hash. `detectSessionInUrl` está activo, así que el hash
    //     del correo de recuperación viaja acá y un navigate se lo comería;
    //     también protege los ?code= de un solo uso y el ?desde=push con que
    //     el service worker marca los avisos sin destino.
    if (window.location.search || window.location.hash) return

    // (3) Solo la app instalada: en el navegador normal, secuestrar una
    //     pestaña recién abierta sería un despropósito.
    if (!esAppInstalada()) return

    const guardado = leer()
    if (!guardado) return

    // (4) Vigencia.
    if (Date.now() - guardado.ts > VIGENCIA_MS) return

    // (5) Si lo guardado ya es la raíz, no hay nada que restaurar.
    if (guardado.ruta === '/') return

    // (6) Rutas que NO se restauran aunque pasen todo lo demás.
    //
    //     El tracker se identifica por `?resume=<id>`: sin ese parámetro,
    //     TrackerPage genera un id nuevo y crea una partida VACÍA marcada como
    //     activa. Restaurar `/play/tracker/premier` a secas no te devolvería tu
    //     partida, te abriría otra en blanco y dejaría dos activas en la lista.
    //     Para volver a una partida está `/play/saved`, que sí las lista.
    if (/^\/play\/tracker/.test(guardado.ruta) && !guardado.ruta.includes('resume=')) return

    // `replace` para no dejar una entrada de historial que haga que el botón
    // Atrás te devuelva a Inicio, un sitio donde nunca estuviste.
    navigate(guardado.ruta, { replace: true })
  }, [navigate])

  // ── Guardar en cada cambio de ruta, y refrescar la hora al irse ──
  useEffect(() => {
    // Solo la app instalada escribe. Si no, tener la app instalada Y abierta en
    // una pestaña normal del navegador hacía que las navegaciones de la pestaña
    // pisaran la ruta guardada de la PWA — y esa es la única que se restaura.
    if (!esAppInstalada()) return

    const ruta = location.pathname + location.search

    const guardar = () => {
      try {
        localStorage.setItem(LLAVE, JSON.stringify({ ruta, ts: Date.now() }))
      } catch {
        // Safari en modo privado y cuota llena. Perder la restauración es
        // molesto; tirar la app por eso, mucho peor.
      }
    }

    guardar()

    /* La vigencia tiene que contar desde el último USO, no desde la última
     * navegación.
     *
     * Si te quedás cuarenta minutos leyendo una misma pantalla —revisando un
     * mazo, siguiendo una ronda— y ahí el sistema mata la app, con la hora de
     * la navegación ya habrían pasado los treinta minutos y no te devolvería a
     * ningún lado, justo después de haber estado usándola todo ese rato.
     *
     * El momento en que la app pasa a segundo plano es lo más cerca que se
     * puede estar del «último uso», así que ahí se vuelve a sellar la hora.
     * `pagehide` va de refuerzo porque en iOS `visibilitychange` no siempre
     * llega; ninguno de los dos es el mecanismo principal —eso lo cubre el
     * guardado por navegación— y por eso da igual si el sistema no los entrega. */
    const alOcultarse = () => { if (document.visibilityState === 'hidden') guardar() }
    document.addEventListener('visibilitychange', alOcultarse)
    window.addEventListener('pagehide', guardar)
    return () => {
      document.removeEventListener('visibilitychange', alOcultarse)
      window.removeEventListener('pagehide', guardar)
    }
  }, [location.pathname, location.search])
}

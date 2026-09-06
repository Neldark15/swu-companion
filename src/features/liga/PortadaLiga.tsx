/**
 * La portada de la Liga Internacional PUENTE 3.
 *
 * Es lo primero que se ve al entrar al módulo, mientras la liga carga. No es
 * un adorno: entrar a la liga tiene que sentirse como entrar a otro sitio, y
 * el afiche hace ese trabajo en el medio segundo que tarda la consulta.
 *
 * ── Tres decisiones que la hacen funcionar en un teléfono ────────────
 *
 * 1. **El afiche es un FONDO, no una imagen en el flujo.** Mide 1080×1920
 *    (9:16) y ninguna pantalla real tiene esa proporción exacta: puesto como
 *    `<img>` dejaría franjas arriba y abajo, o se cortaría por donde caiga.
 *    Como fondo con `cover` y anclado al centro, la cruz de sables queda
 *    siempre en cuadro — que es lo único que no se puede perder.
 *
 * 2. **Tapa el caparazón entero, cabecera y barra de pestañas incluidas.**
 *    Medido en un teléfono de 375×812: con la cabecera de la app encima, la
 *    palabra «LIGA» del afiche quedaba cortada — el rótulo del propio afiche
 *    escondido detrás del rótulo de la app. Es un momento de pantalla
 *    completa, así que va por encima de todo (z-[60], sobre la cabecera y la
 *    TabBar) y se va sola.
 *
 * 3. **El aviso de carga va en una franja SÓLIDA abajo, no flotando.** Primero
 *    estaba centrado sobre un degradado y caía justo encima del logo de
 *    PUENTE 3, que vive en el tercio inferior del afiche. Una franja opaca no
 *    compite con el arte: lo apoya.
 *
 * Nada de texto grande encima: el afiche YA dice «Liga Internacional» y lleva
 * el logo abajo. Escribir el nombre otra vez sería repetirlo sobre sí mismo.
 *
 * Y **se va sola y no se puede tocar.** Es un estado de carga, no una
 *    bienvenida con botón. Con `prefers-reduced-motion` el latido se apaga.
 *
 * ── La barra, y por qué NO miente ────────────────────────────────────
 *
 * El afiche se llevaba medio segundo de pantalla: se veía un parpadeo, no una
 * portada. Ahora hay un mínimo de 2 s (`MINIMO_MS` en `LigaSeccion`) para que
 * el arte se lea, con una barra que lo acompaña.
 *
 * Esa barra NO dice «cuánto falta de la consulta» —eso no se sabe— sino
 * **cuánto falta de los 2 segundos**, que es un plazo real y nuestro. Si la
 * consulta tarda MÁS, la barra llega al final y se queda ahí, latiendo: el
 * plazo se cumplió y lo que falta es el servidor. Una barra que fingiera
 * avanzar durante una espera que no controla es la clase de progreso que
 * nadie vuelve a creer.
 *
 * Va con `transform: scaleX`, no con `width`: es la única forma de que la
 * anime el compositor en vez de recalcular el diseño por cuadro (§3u).
 *
 * El peso: 154 KB en WebP, y solo lo baja quien entra a la liga. La misma
 * imagen sirve de fondo del encabezado una vez cargada, así que la segunda
 * vez sale de la caché del navegador.
 */

import { Loader2 } from 'lucide-react'

export function PortadaLiga(
  { mensaje = 'Entrando a la liga…', ms = 0 }: { mensaje?: string; ms?: number },
) {
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-[#05050A]"
      style={{
        backgroundImage: 'url(/liga/portada.webp)',
        backgroundSize: 'cover',
        // Anclado ARRIBA, no al centro: el rótulo «LIGA INTERNACIONAL» es lo
        // primero que tiene que leerse, y en una pantalla más alta que el
        // afiche el centrado se lo come por arriba.
        backgroundPosition: 'top center',
        backgroundRepeat: 'no-repeat',
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex-1" />

      {/* La barra va PEGADA arriba de la franja, del ancho entero: es lo único
          que se mueve en la pantalla y ahí no le pisa nada al afiche. */}
      {ms > 0 && (
        <div className="h-[3px] w-full overflow-hidden bg-white/10" aria-hidden>
          <div
            className="portada-barra h-full w-full origin-left"
            style={{ background: 'var(--liga-acento, #3B82F6)', animationDuration: `${ms}ms` }}
          />
        </div>
      )}

      {/* Franja sólida: el logo de PUENTE 3 vive en el tercio inferior del
          afiche y cualquier texto flotando ahí se le monta encima. */}
      <p
        className="flex items-center justify-center gap-2 border-t border-white/10 bg-[#05050A]
                   py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white/60"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden />
        {mensaje}
      </p>
    </div>
  )
}

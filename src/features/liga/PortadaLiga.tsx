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
 *    bienvenida con botón: si la liga ya cargó, quedarse mirando el afiche es
 *    tiempo perdido. Con `prefers-reduced-motion` el latido se apaga.
 *
 * El peso: 154 KB en WebP, y solo lo baja quien entra a la liga. La misma
 * imagen sirve de fondo del encabezado una vez cargada, así que la segunda
 * vez sale de la caché del navegador.
 */

import { Loader2 } from 'lucide-react'

export function PortadaLiga({ mensaje = 'Entrando a la liga…' }: { mensaje?: string }) {
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

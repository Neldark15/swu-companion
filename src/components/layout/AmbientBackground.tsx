/**
 * AmbientBackground — capa atmosférica sci-fi global.
 *
 * Renderiza una rejilla holográfica tenue, scanlines, una viñeta de borde
 * y una línea de barrido que recorre la pantalla. Está pensada para añadir
 * sensación tecnológica/HUD sin ser invasiva: opacidades muy bajas, sin
 * captura de clics (pointer-events-none vía CSS) y respeta
 * `prefers-reduced-motion` (ver index.css).
 *
 * Se monta en AppLayout con z-index bajo el header (z-50) y el sidenav
 * (z-40), por lo que el chrome de navegación permanece nítido.
 */
export function AmbientBackground() {
  return (
    <div className="holo-ambient" aria-hidden="true">
      <div className="holo-ambient__sweep" />
    </div>
  )
}

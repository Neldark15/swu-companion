/**
 * El logo de un torneo, con su destello.
 *
 * ── Por qué el destello va enmascarado ───────────────────────────────
 *
 * Lo obvio es poner una banda de luz encima con un degradado. Pero el logo
 * tiene FONDO TRANSPARENTE y no es rectangular: una banda sobre la caja
 * dibujaría un brillo flotando en el aire alrededor del escudo, y se vería
 * como un error de recorte, no como un reflejo.
 *
 * Por eso la banda se recorta con el propio logo (`mask-image`): la luz solo
 * existe donde hay metal. La imagen se pasa por una variable CSS porque cada
 * torneo tiene la suya.
 *
 * ── Y por qué no brilla todo el tiempo ───────────────────────────────
 *
 * Un destello continuo en una lista de torneos es una luz parpadeando junto a
 * cada renglón mientras alguien intenta leer una fecha. Barre una vez y
 * descansa. Con `prefers-reduced-motion` no barre nunca.
 */

interface Props {
  src: string
  /** Lado en píxeles. La tarjeta usa 64; el lobby, 80. */
  lado: number
  className?: string
}

export function LogoTorneo({ src, lado, className = '' }: Props) {
  return (
    <span
      className={`logo-torneo ${className}`}
      style={{ width: lado, height: lado, ['--logo' as string]: `url("${src}")` }}
    >
      <img src={src} alt="" loading="lazy" className="h-full w-full object-contain" />
      {/* Decorativo: no lo anuncia un lector de pantalla. */}
      <span className="logo-destello" aria-hidden="true" />
    </span>
  )
}

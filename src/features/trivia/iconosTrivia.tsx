/**
 * Los íconos de TEMA de la trivia — dibujados, no emoji.
 *
 * Mismo motivo que las misiones (§3t): un emoji lo dibuja el sistema operativo,
 * así que 🟢 y 🪐 eran distintos en cada teléfono y los que un Android viejo no
 * tiene salen como cuadrito. Era la última superficie de la app con emojis de
 * sistema en una lista que se abre a diario.
 *
 * Tres se dibujan acá; los otros tres temas reusan íconos que la app ya tiene
 * (sable, caza estelar, cartas — ver `iconoTema.ts`), porque el ícono de un
 * tema es el de la COSA que nombra, no un adorno nuevo.
 */

interface Props { size?: number; className?: string }

/** SITH: el sable de guardia cruzada. La cruceta es lo que lo separa del Jedi. */
export function SableSithIcon({ size = 18, className = '' }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
         className={className} aria-hidden="true">
      {/* La hoja, en diagonal. */}
      <path d="M14.5 9.5 21 3" />
      {/* Las dos hojas cortas de la cruceta. */}
      <path d="M12.2 7.6 9.4 4.8" />
      <path d="M16.4 11.8l2.8 2.8" />
      {/* La empuñadura, maciza. */}
      <path d="M13.2 10.8 6 18" strokeWidth="3.1" />
      <path d="M5.2 18.8 3.4 20.6" strokeWidth="1.7" />
    </svg>
  )
}

/** CRIATURAS: el zarpazo. Tres garras — se lee como bestia sin dibujar ninguna. */
export function GarrazoIcon({ size = 18, className = '' }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round"
         className={className} aria-hidden="true">
      <path d="M5 4c2.5 4.5 3.5 9.5 3 16" />
      <path d="M12 3c1.5 5 1.8 11 .8 18" transform="translate(0.4 0)" />
      <path d="M19 4c-2.5 4.5-3.5 9.5-3 16" />
    </svg>
  )
}

/** PLANETAS: el mundo anillado. El anillo pasa POR DELANTE abajo: sin ese corte
 *  el dibujo es un círculo con una elipse encima, no un planeta. */
export function PlanetaAnilladoIcon({ size = 18, className = '' }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.7"
         className={className} aria-hidden="true">
      {/* La bola: dos arcos, dejando el hueco por donde cruza el anillo. */}
      <path d="M6.6 14.8a6 6 0 1 1 10.8 0" />
      {/* El anillo, inclinado. */}
      <path d="M2.5 16.5c3-1.2 8-2.3 12.5-2.7 3.4-.3 6.2-.1 6.5.8.3 1-2.3 2.3-6.5 3.2-4.3.9-9.3 1.2-12 .7" strokeWidth="1.4" />
    </svg>
  )
}

/**
 * EL CRÉDITO — el escudo imperial, dibujado por nosotros.
 *
 * ── El error que hubo que deshacer, porque es instructivo ─────────────
 *
 * La primera versión lo dibujó con `stroke` sobre fondo transparente: un aro
 * punteado y ocho rayos. Salió un SOL DE ALAMBRE que no se parecía en nada, y
 * Nel lo dijo derecho.
 *
 * El escudo imperial es lo contrario: un **disco MACIZO con huecos**. No hay una
 * sola línea — hay negro y hay hueco. Dibujarlo con trazos es dibujar otra cosa,
 * y ninguna cantidad de ajuste de grosores lo arregla. Por eso acá todo va con
 * `fill` y CERO `stroke`.
 *
 * ── Las cuatro capas, de adentro hacia afuera ────────────────────────
 *
 * 1. El cubo del centro: un disco lleno.
 * 2. El campo interior: anillo lleno con SEIS cuñas huecas que se abren hacia
 *    afuera. Se dibujan los sectores NEGROS que quedan entre las cuñas, no las
 *    cuñas — así no hace falta `fill-rule` y no hay forma de que un hueco se
 *    rellene por un cruce de subtrazos mal contado.
 * 3. El vano: el hueco que separa el campo del aro. Es ausencia, no dibujo.
 * 4. El aro exterior: ocho arcos separados por ocho ranuras.
 *
 * Son 15 formas rellenas y aditivas. Nada depende de reglas de relleno ni del
 * orden en que el navegador las pinte.
 *
 * ── El detalle se apaga en chico, y el umbral está MEDIDO ─────────────
 *
 * Contando tinta sobre el ícono ya rasterizado en `/banco-credito`: por encima
 * del ~52 % de la caja el dibujo es una mancha. La versión completa no entra
 * abajo de ~28 px, así que debajo de eso se dibuja OTRA: menos ranuras, cuñas
 * más gruesas y sin vano. No se encoge el dibujo grande.
 *
 * ── `currentColor` en todo ────────────────────────────────────────────
 *
 * Ni un color quemado. El crédito se pinta ámbar en la tienda y apagado en una
 * pieza que no se puede pagar, y eso lo decide quien lo usa (§3t).
 */

interface Props {
  size?: number
  className?: string
  /**
   * `sello` (por defecto) es SOLO el escudo: es el símbolo de la moneda y es lo
   * que va junto a una cifra, a 14-16 px.
   *
   * `placa` es el lingote completo — el escudo grabado en la chapa con **700M**
   * al pie, como la pieza de verdad. Es un objeto, no un símbolo: pide espacio.
   * Por debajo de 40 px el pie no se lee y la chapa solo le roba sitio al
   * escudo, así que ahí se degrada sola a `sello`.
   */
  variante?: 'sello' | 'placa'
}

/** Debajo de esto se dibuja la versión simplificada. Medido, no elegido. */
const MIN_DETALLE = 28

const C = 12 // centro del viewBox 24×24
const G = Math.PI / 180

/**
 * Un sector de anillo: de `a0` a `a1` grados, entre los radios `r0` y `r1`.
 *
 * Los ángulos de la cara interior pueden ser distintos de los de la exterior, y
 * eso es lo que hace que una cuña se ABRA hacia afuera: el hueco entre dos
 * sectores negros crece con el radio.
 */
function sector(a0: number, a1: number, r0: number, r1: number, a0i = a0, a1i = a1): string {
  const p = (r: number, a: number) => `${(C + r * Math.cos(a * G)).toFixed(3)} ${(C + r * Math.sin(a * G)).toFixed(3)}`
  const arco = (r: number, ini: number, fin: number, sentido: 0 | 1) =>
    `A ${r} ${r} 0 ${Math.abs(fin - ini) > 180 ? 1 : 0} ${sentido} ${p(r, fin)}`
  return `M ${p(r1, a0)} ${arco(r1, a0, a1, 1)} L ${p(r0, a1i)} ${arco(r0, a1i, a0i, 0)} Z`
}

/** El aro exterior: `n` arcos separados por ranuras de `ranura` grados. */
function aro(n: number, ranura: number, r0: number, r1: number): string {
  const paso = 360 / n
  let d = ''
  for (let i = 0; i < n; i++) {
    const centro = -90 + i * paso
    d += sector(centro + ranura / 2, centro + paso - ranura / 2, r0, r1) + ' '
  }
  return d.trim()
}

/**
 * El campo interior: `n` cuñas HUECAS que se abren hacia afuera.
 * Se dibujan los sectores negros de en medio.
 */
function campo(n: number, cunaFuera: number, cunaDentro: number, r0: number, r1: number): string {
  const paso = 360 / n
  let d = ''
  for (let i = 0; i < n; i++) {
    // La cuña hueca está centrada en `centro`; el sector negro va de una cuña a
    // la siguiente. Con la cuña más ancha AFUERA, el negro se angosta afuera.
    const centro = -90 + i * paso
    d += sector(
      centro + cunaFuera / 2, centro + paso - cunaFuera / 2, r0, r1,
      centro + cunaDentro / 2, centro + paso - cunaDentro / 2,
    ) + ' '
  }
  return d.trim()
}

/** El pie mínimo para que «700M» se lea. Debajo, la placa degrada a sello. */
const MIN_PLACA = 40

export function CreditoIcon({ size = 16, className = '', variante = 'sello' }: Props) {
  const detalle = size >= MIN_DETALLE
  const placa = variante === 'placa' && size >= MIN_PLACA

  /* En chico: SIN vano, sin ranuras finas y con cuñas gruesas. Todo lo que a 14
     px mide menos de un píxel deja de ser detalle y pasa a ser suciedad. */
  const d = detalle
    ? `${aro(8, 9, 9.3, 11.5)} ${campo(6, 30, 12, 3.5, 8.3)}`
    : `${aro(6, 16, 8.4, 11.4)} ${campo(6, 40, 20, 3.9, 7.4)}`

  if (placa) {
    /* La pieza de verdad, leída de la foto que mandó Nel:
       · chapa VERTICAL (más alta que ancha) de esquinas apenas redondeadas;
       · DOS marcos, uno al borde y otro por dentro — es lo que le da el relieve
         de lingote fundido y lo que más se echa de menos si falta;
       · el escudo grabado ocupando la parte de arriba;
       · al pie, CUATRO celdas con marco propio, una por carácter: 7 0 0 M.
       El pie no son glifos inventados: la pieza dice 700M. */
    const CELDA = 3.55, HUECO = 0.55
    const anchoPie = CELDA * 4 + HUECO * 3
    const x0 = 12 - anchoPie / 2
    const yPie = 17.15

    return (
      <svg
        width={size} height={size} viewBox="0 0 24 24"
        fill="currentColor" stroke="none"
        className={className} aria-hidden="true"
      >
        <g fill="none" stroke="currentColor" strokeLinejoin="round">
          {/* Marco exterior y marco interior. */}
          <rect x="3.1" y="0.9" width="17.8" height="22.2" rx="1.1" strokeWidth="1.35" />
          <rect x="4.75" y="2.5" width="14.5" height="19" rx="0.6" strokeWidth="0.8" />
          {/* Las cuatro celdas del pie. */}
          {[0, 1, 2, 3].map(i => (
            <rect
              key={i}
              x={x0 + i * (CELDA + HUECO)} y={yPie}
              width={CELDA} height={4.05} rx="0.35" strokeWidth="0.72"
            />
          ))}
        </g>

        {/* El escudo, arriba y a escala para dejarle el pie libre. */}
        <g transform="translate(0 -3.15) scale(0.72)" transform-origin="12 12">
          <path d={`${aro(8, 9, 9.3, 11.5)} ${campo(6, 30, 12, 3.5, 8.3)}`} />
          <circle cx={C} cy={C} r="3.1" />
        </g>

        {/* 7 0 0 M, uno por celda. Va como TEXTO y no como paths a mano: a este
            tamaño el texto se lee y un glifo dibujado no. Se puede porque este
            ícono se pinta EN la página y la fuente de la app está disponible —
            distinto del PNG exportado del §3b, donde el SVG suelto no alcanza
            las @font-face y hay que empotrar la fuente en base64. */}
        <g
          fontSize="3.05" fontWeight="700" textAnchor="middle"
          fontFamily="var(--font-mono), ui-monospace, monospace"
          fill="currentColor"
        >
          {['7', '0', '0', 'M'].map((ch, i) => (
            <text key={i} x={x0 + i * (CELDA + HUECO) + CELDA / 2} y={yPie + 2.95}>{ch}</text>
          ))}
        </g>
      </svg>
    )
  }

  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="currentColor" stroke="none"
      className={className} aria-hidden="true"
    >
      <path d={d} />
      {/* El cubo del centro. Es lo único que sobrevive a cualquier tamaño, así
          que es lo que sostiene la silueta. */}
      <circle cx={C} cy={C} r={detalle ? 3.1 : 3.4} />
    </svg>
  )
}

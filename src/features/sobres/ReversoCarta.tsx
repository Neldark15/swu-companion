/**
 * ReversoCarta — el dorso real del juego.
 *
 * ── De dónde salió ───────────────────────────────────────────────────
 *
 * La aportó Nel. Antes acá había un dorso REDIBUJADO en SVG, porque no existe
 * ninguna imagen del dorso oficial que se pueda conseguir sola: el CDN del
 * juego devuelve 403 a toda clave que no venga referenciada, el sitio oficial
 * no la menciona en ninguno de sus 26 chunks, el listado de su Strapi está
 * cerrado, y la única foto descargable (Wikipedia, 250×349) está marcada
 * «fair use / no libre».
 *
 * Con el archivo en mano el dibujo sobra: se ve el dorso de verdad, con su
 * logotipo, su campo de estrellas y su horizonte.
 *
 * ── El recorte, que no fue trivial ───────────────────────────────────
 *
 * El original es una foto de producto de 1000×1000 sobre blanco, y la carta
 * sale con PERSPECTIVA: medida a tres alturas ocupa 685 px de ancho arriba y
 * 699 abajo. Un recorte al rectángulo exterior habría metido blanco en las
 * esquinas, así que se recortó al rectángulo INTERIOR y se ajustó al alto para
 * caer en la proporción de la carta (0,7152 contra 286/400 = 0,715).
 *
 * Sale a 572×800 — exactamente 2× de 286×400, que es lo que pide un teléfono a
 * dpr 2 con la carta a 300 px CSS. Más grande es peso tirado. 30 KB en WebP, y
 * comprobado que las cuatro esquinas quedan en azul marino.
 *
 * ── Por qué es un <img> y ya no un <svg> ─────────────────────────────
 *
 * Porque no queda nada que dibujar. Lo único que va encima es el barrido del
 * misterio, que es un `<span>` moviéndose con `transform`.
 */

interface Props {
  /**
   * El color de la impresión que hay del otro lado.
   *
   * Ya NO tiñe el dorso: es el dorso de verdad y teñirlo sería ensuciarlo. La
   * prop se queda porque el aviso sin espóiler sigue existiendo —el aura que
   * late por DETRÁS de la carta en el revelado— y ese lo pinta quien llama.
   */
  color?: string
  /** Le pasa un barrido de luz: algo grande viene. */
  misterio?: boolean
}

export function ReversoCarta({ misterio = false }: Props) {
  return (
    <span className="radio-carta relative block h-full w-full overflow-hidden">
      <img
        src="/dorso-swu.webp"
        alt=""
        aria-hidden="true"
        draggable={false}
        className="block h-full w-full object-cover"
      />
      {misterio && <span aria-hidden className="dorso-barrido-luz" />}
    </span>
  )
}

/**
 * Acabado — el brillo que se le pinta ENCIMA al arte.
 *
 * ── Por qué el brillo lo pone la app y no el archivo ─────────────────
 *
 * Porque el foil del API está QUEMADO en el PNG. Medido bajando las dos
 * imágenes y comparándolas píxel a píxel: la «Standard Foil» de Chopper contra
 * la Standard da MAE 5,62 — son tres estrellitas blancas arriba a la derecha y
 * otro número de coleccionista. Igual la Hyperspace Foil contra la Hyperspace
 * (MAE 6,00) y la Foil Prestige contra la Standard Prestige (MAE 4,49).
 *
 * Ese destello pintado no reacciona al gesto, siempre está en el mismo sitio y
 * encima tapa el arte. Así que se usa la lámina SIN foil (`sobresArte.ts`) y el
 * brillo se pinta acá, donde sí puede seguir al dedo.
 *
 * ── Dos calidades, y la barata no es una versión pobre ───────────────
 *
 * `completo` son cuatro capas con `mix-blend-mode` moviéndose en paralaje. Se
 * ve muchísimo y cuesta: cada capa con mezcla obliga al navegador a leer lo
 * que hay debajo.
 *
 * `plano` es UN degradado sin mezcla. Va en las rejillas, donde hay nueve
 * cartas a la vez — la regla del proyecto es un solo efecto caro por PANTALLA,
 * nunca por fila, y ya costó caro una vez (la vitrina de 819 cartas mataba la
 * pestaña por exceso de capas compuestas).
 */

import type { Acabado as TipoAcabado } from '../../services/sobres'

interface Props {
  acabado: TipoAcabado
  /**
   * `completo` para la carta protagonista, `plano` para las rejillas.
   * No es «bueno y malo»: son dos presupuestos distintos.
   */
  calidad?: 'completo' | 'plano'
  /**
   * Quién mueve el brillo.
   *
   * - `gesto`: lo mueven `--px`/`--py`, que escribe quien arrastra la carta.
   * - `solo`: se mueve con su propia animación. Para la carta del revelado,
   *   que no se arrastra —se toca— y sin esto quedaría mate justo en el
   *   momento en que tiene que impresionar.
   */
  movimiento?: 'gesto' | 'solo'
  /**
   * ¿La carta es APAISADA?
   *
   * Sin esto el brillo se pintaba del alto entero del bolsillo aunque la carta
   * fuera horizontal: una lámina vertical sobre una carta acostada, encima del
   * relleno desenfocado. Son las 144 Showcase del pool, que son los 144
   * líderes — o sea las nueve secciones Showcase enteras.
   *
   * Ojo: es la orientación de la CARA que se está viendo. El frente de un líder
   * es apaisado (400×286) pero su reverso es vertical (286×400, medido 6/6):
   * son la misma cartulina con una cara impresa de lado.
   */
  apaisada?: boolean
}

export function Acabado({ acabado, calidad = 'completo', movimiento = 'gesto', apaisada = false }: Props) {
  // La GEOMETRÍA vive acá y en un solo sitio: qué superficie cubre el brillo.
  const marco = apaisada ? 'foil-marco-apaisado' : 'foil-marco'

  if (calidad === 'plano') {
    // Tres clases, no dos. Mandar `metal` a la dorada teñía de oro las 211
    // Standard Prestige justo en la pantalla donde se ve la colección entera.
    const clase =
      acabado === 'foil' ? 'foil-plano' : acabado === 'metal' ? 'foil-plano-metal' : 'foil-plano-oro'
    return (
      <span aria-hidden className={marco}>
        <span className={clase} />
      </span>
    )
  }

  return (
    <span aria-hidden className={marco}>
    <span className={`foil-caja${movimiento === 'solo' ? ' foil-solo' : ''}`}>
      {/* El material. Solo uno de los tres. */}
      <span className={acabado === 'foil' ? 'foil-arcoiris' : acabado === 'metal' ? 'foil-metal' : 'foil-oro'} />
      {/* La trama va en los tres: es lo que hace que se lea como lámina
          impresa y no como una capa de color. */}
      <span className="foil-trama" />
      {/* Y el lustre encima de todo, con el paralaje más fuerte. */}
      <span className="foil-lustre" />
    </span>
    </span>
  )
}

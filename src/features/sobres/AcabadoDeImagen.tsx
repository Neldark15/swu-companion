/**
 * AcabadoDeImagen — el brillo, con la forma de la carta que tiene debajo.
 *
 * ── Por qué la orientación se MIDE y no se deduce ────────────────────
 *
 * Antes salía de `carta.isLeader || carta.isBase`. Parecía seguro y no lo es:
 * un líder Showcase tiene sus dos caras con proporciones OPUESTAS, y cuál de
 * las dos termina en pantalla depende de qué URL le tocó a cada lado. Medido
 * sobre Obi-Wan Kenobi Showcase (LOF 1012), que es exactamente la carta donde
 * apareció el fallo:
 *
 *   front_image_url  400×286  apaisada   (…_Leader_85186449a0.png)
 *   back_image_url   286×400  vertical   (…_Leader_Unit_3196d94aa3.png)
 *
 * O sea que la MISMA carta necesita el brillo apaisado de un lado y vertical
 * del otro. Un solo `isLeader` no puede responder eso, y encima respondía lo
 * mismo para las dos caras: se veía una lámina vertical sobre una carta
 * acostada y al revés.
 *
 * Así que la pregunta se le hace a la imagen. `naturalWidth`/`naturalHeight`
 * son la verdad —es el archivo que se está pintando— y no hay dato que se
 * pueda desincronizar.
 *
 * No cuesta una descarga extra: es la MISMA URL que el `<img>` de al lado ya
 * pidió, así que sale de la caché del navegador.
 */

import { useEffect, useState } from 'react'
import { Acabado } from './Acabado'
import type { Acabado as TipoAcabado } from '../../services/sobres'

interface Props {
  /** La MISMA URL que se le pasó al `CardImage` de al lado. */
  src: string | null | undefined
  acabado: TipoAcabado
  calidad?: 'completo' | 'plano'
  movimiento?: 'gesto' | 'solo'
}

export function AcabadoDeImagen({ src, acabado, calidad, movimiento }: Props) {
  /* Se guarda JUNTO con la url que se midió. Si solo se guardara el booleano,
   * al cambiar de carta el brillo se pintaría un instante con la forma de la
   * anterior — que es exactamente el fallo que este componente vino a matar. */
  const [medida, setMedida] = useState<{ src: string; apaisada: boolean } | null>(null)

  useEffect(() => {
    if (!src) return
    let vivo = true
    const im = new Image()
    // `onload` va ANTES de `src`: así dispara también cuando la imagen ya está
    // en caché, y no hace falta mirar `complete` a mano (que sería un `setState`
    // síncrono dentro del efecto).
    im.onload = () => {
      if (vivo) setMedida({ src, apaisada: im.naturalWidth > im.naturalHeight })
    }
    im.src = src
    return () => {
      vivo = false
    }
  }, [src])

  // Hasta que no se sepa NO se pinta nada: un brillo con la forma equivocada
  // durante medio segundo se ve peor que ninguno.
  if (!src || medida?.src !== src) return null
  return (
    <Acabado acabado={acabado} calidad={calidad} movimiento={movimiento} apaisada={medida.apaisada} />
  )
}

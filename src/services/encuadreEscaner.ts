export interface MarcoEscaner { x: number; y: number; w: number; h: number }

/** Fracciones del vídeo, conservando la proporción física de cada orientación.
 * Una fracción fija de ancho/alto de pantalla deforma el recorte al girar el móvil.
 * Esta misma función gobierna tanto el visor como el reconocedor. */
export function marcosDeCamara(ancho: number, alto: number): MarcoEscaner[] {
  if (!(ancho > 0 && alto > 0)) return []
  return [286 / 400, 400 / 286].map(proporcion => {
    const h = Math.min(alto * .80, ancho * .84 / proporcion)
    const w = h * proporcion
    return { x: (ancho - w) / (2 * ancho), y: (alto - h) / (2 * alto), w: w / ancho, h: h / alto }
  })
}

/** El número impreso está al pie de LA CARTA, no al pie del vídeo. */
export function bandaDelMarco(marco: MarcoEscaner): MarcoEscaner {
  return { x: marco.x + marco.w * .03, y: marco.y + marco.h * .92, w: marco.w * .94, h: marco.h * .075 }
}

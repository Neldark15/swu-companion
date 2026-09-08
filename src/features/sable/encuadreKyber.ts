/** Inclinación fija de la cámara; debe coincidir con colocarCamara. */
export const INCLINACION_CAMARA = 0.16
export const FOV_KYBER = 38

interface Medidas {
  /** Extremos sobre el eje local del sable, incluyendo la hoja solo en completo. */
  fondo: number
  punta: number
  radio: number
  aspecto: number
  eje: { x: number; y: number; z: number }
}

/**
 * Cota conservadora del cilindro orientado en los ejes REALES de la cámara.
 * Sumar la profundidad antes del fit impide recortes al inclinar el objeto.
 * Pura: no crea objetos Three ni consulta DOM; también sirve a las pruebas.
 */
export function medirEncuadreKyber({ fondo, punta, radio, aspecto, eje }: Medidas) {
  const mitad = (punta - fondo) / 2
  const medio = (punta + fondo) / 2
  const coseno = Math.cos(INCLINACION_CAMARA)
  const seno = Math.sin(INCLINACION_CAMARA)
  const x = eje.x
  const y = eje.y * coseno - eje.z * seno
  const z = eje.y * seno + eje.z * coseno
  const ancho = Math.abs(x) * mitad + radio * Math.sqrt(Math.max(0, 1 - x * x))
  const alto = Math.abs(y) * mitad + radio * Math.sqrt(Math.max(0, 1 - y * y))
  const cerca = Math.abs(z) * mitad + radio * Math.sqrt(Math.max(0, 1 - z * z))
  const tangente = Math.tan(FOV_KYBER * Math.PI / 360)
  const distancia = Math.max(10, cerca + Math.max(ancho / (tangente * Math.max(0.1, aspecto)), alto / tangente) * 1.1)
  return { distancia, medio, mitad, cerca, ancho, alto }
}

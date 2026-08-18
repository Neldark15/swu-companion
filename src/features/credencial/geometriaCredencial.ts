/**
 * La GEOMETRÍA de la credencial: siluetas, banda y los cálculos deterministas
 * (hash, código de barras, id de placa).
 *
 * Son DATOS, no componentes. Separados de los .tsx a propósito: el anverso, el
 * reverso y el envoltorio 3D los comparten, y mezclar datos con componentes
 * rompe el refresco en caliente (misma regla que obligó a sacar
 * `colorDePersona` de Avatar y los `GLIFOS` de aurebesh.tsx).
 */

/** Silueta exterior: escalonada, biselada, con el agujero de llavero. */
export const SILUETA_BASE = [
  'M 24 0',
  'L 148 0 L 156 10 L 244 10 L 252 0', // muesca escalonada superior
  'L 416 0 L 428 14 L 512 14',         // escalón hacia la esquina derecha
  'L 512 118 L 504 126 L 504 192 L 512 200', // muesca del borde derecho
  'L 512 298 L 490 320',               // bisel inferior derecho
  'L 328 320 L 320 310 L 212 310 L 204 320', // muesca inferior
  'L 18 320 L 0 302',
  'L 0 24 Z',
  // Subcamino del agujero de llavero (evenodd lo convierte en recorte).
  'M 42 30 A 10 10 0 1 0 22 30 A 10 10 0 1 0 42 30 Z',
].join(' ')

/** Panel interior oscuro, con su propia silueta escalonada (esquiva el agujero). */
export const SILUETA_PANEL = [
  'M 76 24 L 408 24 L 420 38 L 496 38',
  'L 496 114 L 488 122 L 488 196 L 496 204',
  'L 496 286 L 478 304',
  'L 332 304 L 324 294 L 216 294 L 208 304',
  'L 30 304 L 14 288',
  'L 14 82 L 28 68 L 60 68 L 76 52 Z',
].join(' ')

/** Banda del nombre: cruza la placa entera y sobresale del panel. */
export const BANDA = 'M 4 206 L 508 206 L 508 244 L 496 252 L 18 252 L 4 240 Z'

/** La mono de la app: la credencial es técnica, no editorial. */
export const FUENTE = 'var(--font-mono)'

/**
 * Hash chiquito y determinista: alimenta el «código de barras» del borde y
 * el ID corto de la placa. Determinista a propósito — la credencial de una
 * persona tiene que imprimirse IGUAL hoy y el mes que viene.
 */
export function hashCadena(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Anchos del código de barras del borde: pseudoaleatorios pero DETERMINISTAS
 * (mismo nombre = mismas barras, también impreso el mes que viene).
 *
 * `>>>` y NO `>>`. El corrimiento con signo convierte el hash a int32, y con
 * el bit alto prendido el resultado es NEGATIVO: `6 + (neg % 13)` daba anchos
 * de hasta -6, y un `<rect>` de ancho ≤ 0 sencillamente no se dibuja. Medido
 * con los nombres reales de la comunidad: Vara perdía 5 de 13 barras, ElDaigo
 * 8, Marlin 7. Se veía como una credencial a medio grabar, y solo para
 * algunas personas — que es la peor clase de bug, porque el que lo prueba con
 * su propio nombre puede no verlo nunca.
 */
export function barrasDe(semilla: number, cuantas = 13): number[] {
  const r: number[] = []
  for (let i = 0; i < cuantas; i++) r.push(6 + (((semilla >>> (i % 27)) * (i + 3)) >>> 0) % 13)
  return r
}

/** ID corto de la placa, derivado del nombre: decorativo pero estable. */
export function idPlacaDe(semilla: number): string {
  return `ID-${(semilla % 0x10000).toString(16).toUpperCase().padStart(4, '0')}`
}

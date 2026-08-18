/**
 * Los ACABADOS de la credencial: lo que se le desbloquea a la placa al subir de
 * nivel.
 *
 * ── Por qué atados al RANGO y no a un número suelto ──────────────────
 *
 * La app ya tiene siete rangos (`RANKS` de gamification.ts) y toda la interfaz
 * los usa. Inventar una segunda escala solo para esto habría creado dos
 * verdades sobre «cuánto has avanzado» que se contradirían en cuanto alguien
 * tocara una de las dos. Acá se leen los mismos rangos.
 *
 * ── Por qué el acabado NO puede ser solo brillo ──────────────────────
 *
 * Si la única diferencia entre el nivel 1 y el 26 fuera «más brillo», en una
 * captura de pantalla comprimida no se distinguirían, y quien tenga el monitor
 * en modo ahorro no vería nada. Cada peldaño AGREGA UNA PIEZA identificable:
 * un cepillado, un borde de color, una veta prismática. Se nota en blanco y
 * negro, que es la misma regla que ya siguen los marcos de la foto.
 *
 * ── Y por qué el movimiento es opcional ──────────────────────────────
 *
 * El barrido de los dos acabados más altos recorre la placa entera. Se apaga
 * con `prefers-reduced-motion`, igual que el resto de la app.
 */

export interface AcabadoCredencial {
  id: string
  nombre: string
  /** Nivel al que se gana. Coincide con el `minLevel` de su rango. */
  desde: number
  /** Una línea que dice qué le pasa a la placa. */
  detalle: string
  // ── Qué enciende cada acabado ──
  /** Cepillado metálico: microrrayas paralelas, como el aluminio real. */
  cepillado: boolean
  /** Canto de luz de color en el borde superior de la placa. */
  cantoLuz: boolean
  /** Veta prismática: la mancha de aceite del laminado holográfico. */
  prisma: boolean
  /** Chapa de cromo en la banda del nombre. */
  cromo: boolean
  /** Barrido de luz que recorre la placa (se apaga con reduced-motion). */
  barrido: boolean
  /** Halo exterior: la placa proyecta luz sobre lo que tiene detrás. */
  halo: boolean
}

/**
 * Los siete acabados, del primero al último.
 *
 * El orden es el de `RANKS`, y los `desde` son sus `minLevel`: 1, 4, 7, 11, 16,
 * 21 y 26. Si algún día se recalibran los rangos, esto hay que moverlo con
 * ellos — por eso está escrito con los números a la vista y no calculado, para
 * que el desajuste se vea al leer en vez de esconderse en una fórmula.
 */
export const ACABADOS: AcabadoCredencial[] = [
  { id: 'mate',      nombre: 'Mate',        desde: 1,
    detalle: 'Placa lisa, sin tratamiento.',
    cepillado: false, cantoLuz: false, prisma: false, cromo: false, barrido: false, halo: false },

  { id: 'cepillado', nombre: 'Cepillado',   desde: 4,
    detalle: 'Metal cepillado: microrrayas en el material.',
    cepillado: true,  cantoLuz: false, prisma: false, cromo: false, barrido: false, halo: false },

  { id: 'canto',     nombre: 'Canto de luz', desde: 7,
    detalle: 'El borde superior gana un filo de color.',
    cepillado: true,  cantoLuz: true,  prisma: false, cromo: false, barrido: false, halo: false },

  { id: 'cromado',   nombre: 'Cromado',     desde: 11,
    detalle: 'La banda del nombre pasa a chapa de cromo.',
    cepillado: true,  cantoLuz: true,  prisma: false, cromo: true,  barrido: false, halo: false },

  { id: 'prisma',    nombre: 'Prismático',  desde: 16,
    detalle: 'Veta holográfica: la placa tira colores al girarla.',
    cepillado: true,  cantoLuz: true,  prisma: true,  cromo: true,  barrido: false, halo: false },

  { id: 'kyber',     nombre: 'Kyber',       desde: 21,
    detalle: 'Un barrido de luz recorre la placa.',
    cepillado: true,  cantoLuz: true,  prisma: true,  cromo: true,  barrido: true,  halo: false },

  { id: 'holocron',  nombre: 'Holocrón',    desde: 26,
    detalle: 'La placa proyecta su propia luz.',
    cepillado: true,  cantoLuz: true,  prisma: true,  cromo: true,  barrido: true,  halo: true },
]

/** El acabado que corresponde a un nivel: el más alto ya ganado. */
export function acabadoDe(nivel: number): AcabadoCredencial {
  let ganado = ACABADOS[0]
  for (const a of ACABADOS) if (nivel >= a.desde) ganado = a
  return ganado
}

/** El siguiente por ganar, o `null` si ya están todos. */
export function proximoAcabado(nivel: number): AcabadoCredencial | null {
  return ACABADOS.find(a => a.desde > nivel) ?? null
}

/**
 * El TIPO y las ayudas de los filtros avanzados del constructor.
 *
 * Viven aparte de `FiltrosBusqueda.tsx` porque un módulo que exporta
 * componentes Y constantes rompe el Fast Refresh de Vite: al guardar se
 * recarga la página entera en vez de recomponer. Es la tercera vez que hace
 * falta esta separación en el repo (`piezas.tsx`/`estado.ts` del Contador,
 * `MisionIcons`/`iconoMision`), así que conviene hacerla de entrada.
 */

export interface FiltrosAvanzados {
  tipo: string | null
  arena: string | null
  palabraClave: string | null
  rasgo: string | null
  /**
   * Solo cartas cuyos aspectos estén DENTRO de los que da el líder + la base.
   *
   * No se llama «sin penalización» a propósito: el CR 8.1.2 cuenta los íconos
   * REPETIDOS —Protector lleva dos de Vigilance y con uno solo en el mazo
   * cuesta +2— y el API no expone ese conteo (`aspects` viene sin repetidos;
   * verificado: 0 de 9.185 impresiones traen un aspecto duplicado). El filtro
   * dice lo que puede saber.
   */
  soloMisAspectos: boolean
}

export const SIN_FILTROS: FiltrosAvanzados = {
  tipo: null, arena: null, palabraClave: null, rasgo: null, soloMisAspectos: false,
}

export function contarActivos(f: FiltrosAvanzados): number {
  return (f.tipo ? 1 : 0) + (f.arena ? 1 : 0) + (f.palabraClave ? 1 : 0) +
         (f.rasgo ? 1 : 0) + (f.soloMisAspectos ? 1 : 0)
}

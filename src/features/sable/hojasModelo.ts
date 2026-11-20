import type { Diseno } from './partesSable'

export const LARGO_HOJA_CLASICA = 78

export function longitudesDeHoja(diseno: Pick<Diseno, 'cuerpo' | 'pomo'>) {
  const principal = diseno.cuerpo === 'cue_shoto' ? 41 : LARGO_HOJA_CLASICA
  return { principal, secundaria: diseno.pomo === 'pom_gemelo' ? principal : 0 }
}

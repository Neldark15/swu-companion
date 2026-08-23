/**
 * La REGLA del sub-nombre. Pura, sin red — por eso se puede probar.
 *
 * Va aparte de `subnombre.ts` por lo mismo que `misionesCatalogo.ts` va aparte
 * de `missionService.ts`: ese importa `supabase`, que en Node revienta al leer
 * `import.meta.env`, y una regla que no se puede correr fuera del navegador es
 * una regla que nadie va a probar.
 *
 * La AUTORIDAD es Postgres (`trg_profiles_subnombre`). Esto solo se adelanta,
 * para poder decir que no antes de mandar. Que las dos no se separen lo cuida
 * `scripts/subnombre-espejo.mjs`, que corre la misma lista de casos contra las
 * dos implementaciones.
 */

/** Lo que entra en la placa sin partirse. Igual al CHECK de la base. */
export const MAX_SUBNOMBRE = 24

/**
 * Las raíces reservadas para el creador de la plataforma.
 *
 * Son RAÍCES y no frases: así «The Creator», «el creador», «Creador de la
 * plataforma» y «xXcreatorXx» caen todas con una sola entrada.
 */
const RAICES_RESERVADAS = [
  'creator', 'creador', 'creater', 'kreator', 'kreador', 'creatore', 'criador',
]

/**
 * Deja el texto en letras a secas, para poder compararlo.
 *
 * `lower()` no alcanza: deja pasar «Cre4dor», «C R E A T O R», «Créator» y
 * «the-creator». Se quitan tildes, se traducen los números que se usan como
 * letras y se borra todo lo demás.
 */
export function normalizarSubnombre(texto: string): string {
  const NUM_A_LETRA: Record<string, string> = {
    '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's',
  }
  return (texto ?? '')
    // NFD parte «é» en «e» + tilde suelta, y el rango U+0300–U+036F barre las
    // tildes sueltas. Es lo que hace `unaccent_simple` del lado de Postgres.
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[01345 7@$]/g, c => NUM_A_LETRA[c] ?? c)
    .replace(/[^a-z]/g, '')
}

/** ¿Apunta al creador de la plataforma? */
export function subnombreReservado(texto: string): boolean {
  const n = normalizarSubnombre(texto)
  return RAICES_RESERVADAS.some(r => n.includes(r))
}


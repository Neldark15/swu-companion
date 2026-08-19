/**
 * CARA CARTA — qué hay del OTRO lado de una carta cuando se la gira.
 *
 * ── Hay dos respuestas distintas y una sola pregunta ─────────────────
 *
 * Casi toda carta tiene el DORSO del juego atrás: es el mismo para todas, y por
 * eso se puede barajar. Pero los líderes no: un líder es una carta de DOBLE
 * CARA — de un lado el líder, del otro su unidad desplegada — y por lo tanto no
 * tiene dorso. Enseñarle un dorso a un líder no es una simplificación: es
 * afirmar algo falso sobre el cartón.
 *
 * Medido sobre `https://api.swuapi.com/export/all` (9.185 filas, 2026-08-19),
 * restringido a las cinco variantes vivas del pool de sobres (2.669 filas, que
 * es exactamente el `count(*)` de `sobres_pool`):
 *
 *   · 144 tienen `backImageUrl` — y las 144 son Líderes, y las 144 son la
 *     familia Showcase COMPLETA. `doubleSided` es `true` en las 144.
 *   · Las otras 2.525 no tienen segunda cara. Entre ellas las 25 Bases del
 *     pool, que son de una sola cara (`backImageUrl` null, `doubleSided`
 *     false): una base lleva dorso normal.
 *
 * O sea que la regla no tiene casos raros: `backImageUrl` presente ⇒ segunda
 * cara propia; ausente ⇒ el dorso del juego.
 *
 * ── Por qué la caja NO cambia de forma al girar ──────────────────────
 *
 * Las dos caras de un líder tienen proporciones OPUESTAS. Bajadas y medidas
 * con PIL, 6 líderes Showcase de 6 sets distintos (The Armorer ASH, Mon Mothma
 * SEC, Agent Kallus LAW, Bossk SHD, Ezra Bridger ASH, Rose Tico JTL):
 *
 *   frente  400×286  (apaisado)
 *   reverso 286×400  (vertical)
 *
 * 6 de 6, sin excepción. Y eso NO significa que la carta cambie de tamaño al
 * girarla: significa que es el MISMO rectángulo con una de las dos caras
 * impresa de lado. Un líder en un bolsillo de binder entra vertical como
 * cualquier otra carta, con el arte del líder acostado.
 *
 * Por eso la caja del álbum es 286/400 SIEMPRE y la cara apaisada se acomoda
 * dentro con `object-contain` (`CardImage` ya rellena el hueco con su propio
 * arte desenfocado). La alternativa —cambiar la proporción de la caja a mitad
 * del giro— reflowea el modal justo mientras la carta está en movimiento.
 */

import type { Card } from '../types'

/** Lo que va del otro lado. */
export type CaraTrasera =
  | {
      tipo: 'cara'
      /** La segunda cara IMPRESA de esta carta. */
      url: string
      /**
       * Medido 6/6: el reverso de un líder es vertical (286×400) aunque su
       * frente sea apaisado. Va explícito y no deducido de `isLeader` porque
       * son dos preguntas distintas sobre la misma carta.
       */
      orientacion: 'vertical' | 'apaisada'
    }
  | { tipo: 'dorso' }

/**
 * Qué mostrar del otro lado.
 *
 * Sin carta resuelta —Dexie a medio hidratar— devuelve el dorso: es la
 * respuesta correcta para el 94,6% del pool y nunca deja un hueco.
 */
export function caraTrasera(carta: Card | null | undefined): CaraTrasera {
  const url = carta?.backImageUrl
  if (!url) return { tipo: 'dorso' }
  // El frente apaisado implica reverso vertical y al revés: es la misma
  // cartulina girada 90°.
  return {
    tipo: 'cara',
    url,
    orientacion: carta.isLeader || carta.isBase ? 'vertical' : 'apaisada',
  }
}

/** `true` si la carta se puede ver por sus dos caras impresas. */
export function esDobleCara(carta: Card | null | undefined): boolean {
  return Boolean(carta?.backImageUrl)
}

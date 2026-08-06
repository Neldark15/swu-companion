/**
 * El contenedor que de verdad scrollea.
 *
 * La app es un caparazón de alto fijo que NO se desplaza: el que scrollea es
 * el `<main>`. Eso es lo que evita que en el teléfono la barra del navegador
 * aparezca y desaparezca al desplazar —y con ella se mueva todo lo que está
 * anclado abajo—, que es exactamente la sensación de «esto es una web, no una
 * app».
 *
 * El precio es que `window.scrollTo` ya no hace nada, así que todo lo que
 * necesite mover el scroll pasa por acá.
 */

export const ID_SCROLL = 'app-scroll'

function contenedor(): HTMLElement | null {
  return document.getElementById(ID_SCROLL)
}

/** Al alto de la pantalla, o al documento si el caparazón aún no montó. */
export function irArriba(): void {
  const el = contenedor()
  if (el) el.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  else window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
}

export function irA(y: number): void {
  const el = contenedor()
  if (el) el.scrollTop = y
  else window.scrollTo(0, y)
}

export function posicion(): number {
  return contenedor()?.scrollTop ?? window.scrollY
}

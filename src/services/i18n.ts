/**
 * Idioma de la PWA — la fundación de la traducción por fases.
 *
 * La app nació 100% en español, con el texto escrito directo en cada
 * componente (146 archivos). No se puede internacionalizar de un golpe sin
 * romper cosas, así que esto es el andamio para migrar POR PARTES sin dejar
 * la app a medias en ningún momento.
 *
 * ── Cómo se traduce, en la práctica ──────────────────────────────────
 *
 * `useT()` devuelve una función `t(es, en)`: el ESPAÑOL es la fuente (queda a
 * la vista en el código, legible) y el inglés se pasa al lado. Un componente
 * migrado se lee `t('Guardar', 'Save')`. Uno todavía sin migrar sigue con su
 * string en español y no se rompe: simplemente aún no cambia de idioma. Así la
 * migración avanza pantalla por pantalla.
 *
 * ── Por qué recarga al cambiar ───────────────────────────────────────
 *
 * Cambiar el idioma recarga la PWA a propósito. El idioma lo lee también código
 * que NO es React —`translations.ts`, que traduce el texto de las CARTAS— desde
 * un espejo de módulo. Recargar garantiza que TODO —cada render y ese código
 * suelto— tome el idioma nuevo de una, sin plomería de re-render repartida por
 * media app. Es una acción rarísima (se hace una vez), así que el costo de una
 * recarga no importa, y a cambio no quedan rincones en el idioma viejo.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Idioma = 'es' | 'en'

interface EstadoIdioma {
  idioma: Idioma
  /** Cambia el idioma y recarga: ver la cabecera. */
  cambiarIdioma: (i: Idioma) => void
}

export const useIdioma = create<EstadoIdioma>()(
  persist(
    (set) => ({
      // Español por defecto: es la comunidad para la que nació la app.
      idioma: 'es',
      cambiarIdioma: (idioma) => {
        set({ idioma })
        // Deja que `persist` escriba antes de recargar; si no, la recarga
        // podría ganarle a la escritura y volver al idioma anterior.
        if (typeof window !== 'undefined') {
          setTimeout(() => window.location.reload(), 30)
        }
      },
    }),
    { name: 'swu-idioma' },
  ),
)

/**
 * Espejo del idioma a nivel de módulo, para el código que NO es React.
 *
 * `translations.ts` (texto de cartas) no puede usar hooks. Lee esto. Se
 * mantiene en sincronía con el store, y arranca con lo que `persist` haya
 * hidratado —o el default— así que un `getIdioma()` temprano nunca devuelve
 * `undefined`.
 */
let idiomaActual: Idioma = useIdioma.getState().idioma
useIdioma.subscribe((s) => { idiomaActual = s.idioma })

/** El idioma actual, para código fuera de React. */
export function getIdioma(): Idioma {
  return idiomaActual
}

/**
 * Hook de traducción para componentes: `const t = useT()` y luego
 * `t('Guardar', 'Save')`. Se re-suscribe al idioma, así que la parte migrada
 * también reacciona en vivo (aunque el camino normal sea la recarga).
 */
export function useT(): (es: string, en: string) => string {
  const idioma = useIdioma((s) => s.idioma)
  return (es, en) => (idioma === 'en' ? en : es)
}

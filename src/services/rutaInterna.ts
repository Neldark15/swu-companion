/**
 * ¿Este texto es una ruta INTERNA de la app, y no un redirector a otro sitio?
 *
 * ── Por qué hace falta preguntarlo ───────────────────────────────────
 *
 * Los dos sitios que la usan navegan a un valor que NO escribió esta pantalla:
 *
 *   · `useRutaPersistente` lee la última ruta de `localStorage`.
 *   · La campana y el toast navegan al `link` de una notificación, y las
 *     notificaciones también viven en `localStorage` (`swu-notifications`).
 *     Además uno de esos enlaces se ARMA con datos del servidor:
 *     `/events/live/${b.event_code}` en TournamentBroadcastListener.
 *
 * Todo eso es texto editable desde las herramientas del navegador. Sin control,
 * `navigate(link)` con `//evil.com` es un redirector abierto con nuestro
 * dominio de trampolín.
 *
 * ── Las tres formas de escaparse, y por qué se rechazan las tres ─────
 *
 *   · `//evil.com`   — URL protocolo-relativa: el navegador la resuelve como
 *                      `https://evil.com`, no como una ruta nuestra.
 *   · `/\evil.com`   — los navegadores normalizan la barra invertida a barra
 *                      normal, así que equivale a la anterior. En una ruta
 *                      legítima de esta app no aparece NUNCA una barra
 *                      invertida, así que se rechaza cualquiera.
 *   · `/<TAB>/evil.com` — el más silencioso. El parseo de URL BORRA tabulador,
 *                      salto de línea y retorno de carro ANTES de mirar la
 *                      forma, así que `"/\t/evil.com"` llega a ser `//evil.com`
 *                      y un `startsWith('//')` a secas lo deja pasar. Por eso
 *                      acá se limpian primero esos tres y se comprueba DESPUÉS,
 *                      que es el orden en que lo ve el navegador.
 *
 * ── Una sola copia ──────────────────────────────────────────────────
 *
 * Esta regla vivía suelta dentro de `leer()` en useRutaPersistente. Al aparecer
 * el segundo sitio que la necesita, se saca acá: en este repo ya pasó tres
 * veces que una lógica duplicada en dos pantallas se separó y solo una quedó
 * bien (ver el despacho de avatares, §2x de CLAUDE.md).
 */

/** Lo que el navegador borra de una URL antes siquiera de parsearla. */
const INVISIBLES = /[\t\n\r]/g

/**
 * `true` solo si es una ruta absoluta de ESTA app.
 *
 * Devuelve un predicado de tipo para que quien la use pueda pasar el valor a
 * `navigate()` sin un `as string` de por medio.
 */
export function esRutaInterna(valor: unknown): valor is string {
  if (typeof valor !== 'string') return false

  // Primero se quitan los invisibles, porque es lo que hace el navegador.
  const limpia = valor.replace(INVISIBLES, '')

  if (limpia === '') return false
  if (!limpia.startsWith('/')) return false
  if (limpia.startsWith('//')) return false
  if (limpia.includes('\\')) return false
  return true
}

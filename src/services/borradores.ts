/**
 * Borradores de formularios: que atender un mensaje no te borre 17 campos.
 *
 * ── Por qué existe ───────────────────────────────────────────────────
 *
 * Cuando el sistema operativo mata la PWA en segundo plano —o simplemente
 * cuando una pantalla se desmonta— todo el estado de React se va. En los
 * formularios largos eso significa empezar de cero: el caso feo es un
 * organizador cargando un torneo de melee con dieciséis campos que atiende un
 * WhatsApp y vuelve a la nada.
 *
 * ── Por qué esta forma y no un hook que restaure ─────────────────────
 *
 * La tentación es un `useEffect` que lea el borrador y llame a los `setX`. No:
 * eso es `setState` dentro de un efecto, encadena un render extra y además el
 * lint de este repo lo rechaza (`react-hooks/set-state-in-effect`).
 *
 * `leerBorrador` es una función normal, síncrona, pensada para el
 * INICIALIZADOR PEREZOSO de cada `useState` — el mismo molde que ya usa el
 * Contador con su duelo. Así el valor guardado está presente desde el primer
 * render y no hay ni parpadeo ni render de más.
 *
 *   const b = leerBorrador<Campos>('swu_borrador_evento')
 *   const [name, setName] = useState(b?.name ?? '')
 *
 * ── Qué NO hace ──────────────────────────────────────────────────────
 *
 * No valida el contenido campo por campo: eso lo sabe cada formulario. Solo
 * garantiza que lo devuelto es un objeto y que no está vencido. Cada campo se
 * lee con `?? valorPorDefecto`, así que un borrador viejo al que le falte una
 * clave nueva no rompe nada.
 */

/** Una semana. Un borrador más viejo que eso ya no es lo que estabas haciendo. */
const VIGENCIA_POR_DEFECTO_MS = 7 * 24 * 60 * 60 * 1000

interface Sobre<T> {
  datos: T
  ts: number
}

/**
 * Lee un borrador para usar en inicializadores perezosos. Devuelve `null` si no
 * hay, si está vencido o si el contenido no es utilizable.
 */
export function leerBorrador<T extends object>(
  llave: string,
  vigenciaMs: number = VIGENCIA_POR_DEFECTO_MS,
): Partial<T> | null {
  try {
    const crudo = localStorage.getItem(llave)
    if (!crudo) return null
    const sobre: unknown = JSON.parse(crudo)
    if (typeof sobre !== 'object' || sobre === null) return null
    const { datos, ts } = sobre as Partial<Sobre<T>>
    if (typeof ts !== 'number' || !Number.isFinite(ts)) return null
    if (Date.now() - ts > vigenciaMs) { localStorage.removeItem(llave); return null }
    if (typeof datos !== 'object' || datos === null || Array.isArray(datos)) return null
    return datos as Partial<T>
  } catch {
    // JSON corrupto, Safari en modo privado, cuota. Nunca vale tirar la
    // pantalla por no poder recuperar un borrador.
    return null
  }
}

/** Guarda el borrador. Silencioso ante cuota llena o modo privado. */
export function guardarBorrador<T extends object>(llave: string, datos: T): void {
  try {
    localStorage.setItem(llave, JSON.stringify({ datos, ts: Date.now() } satisfies Sobre<T>))
  } catch { /* ídem */ }
}

/**
 * Borra el borrador. Llamalo cuando el formulario se envía CON ÉXITO —no antes:
 * si el guardado falla, el usuario tiene que conservar lo que escribió.
 */
export function borrarBorrador(llave: string): void {
  try { localStorage.removeItem(llave) } catch { /* ídem */ }
}

/** Llaves versionadas, todas juntas para que no se dupliquen ni se pisen. */
export const LLAVES_BORRADOR = {
  evento: 'swu_borrador_evento_v1',
  meleeAdd: 'swu_borrador_melee_v1',
  laboratorio: 'swu_borrador_lab_v1',
} as const

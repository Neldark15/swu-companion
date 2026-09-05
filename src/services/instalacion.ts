/**
 * La instalación en Android, capturada ANTES de que arranque React.
 *
 * ── El fallo que arregla ─────────────────────────────────────────────
 *
 * Chrome dispara `beforeinstallprompt` apenas decide que la app se puede
 * instalar — normalmente en cuanto procesa el manifiesto y el service worker,
 * que es ANTES de que el bundle de React monte el árbol. El evento **no se
 * vuelve a disparar**: si en ese momento nadie está escuchando, se perdió para
 * toda la visita.
 *
 * Y los dos lugares que lo escuchaban lo hacían desde un `useEffect`, o sea
 * después de montar. En un teléfono lento eso llega tarde casi siempre. El
 * resultado era el botón «Instalar la app» que no aparecía nunca y la persona
 * cayendo en las instrucciones de «tocá el menú ⋮», que es justo lo que se
 * quería evitar.
 *
 * Este módulo se importa PRIMERO en `main.tsx`, así que el escuchador queda
 * puesto en cuanto se evalúa el bundle: lo más temprano que se puede desde
 * JavaScript propio.
 *
 * ── Lo que NO se puede hacer, y conviene saberlo ─────────────────────
 *
 * No se puede instalar sola. `prompt()` exige un gesto de la persona: llamarlo
 * sin que haya tocado algo lo rechaza el navegador. Un toque es el piso que
 * pone la plataforma; lo que sí se puede es que ese toque esté SIEMPRE
 * disponible y no se pierda.
 *
 * En iOS no existe nada de esto: `beforeinstallprompt` no está implementado y
 * «Añadir a inicio» solo vive en el menú de Safari.
 */

export interface EventoInstalacion extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let guardado: EventoInstalacion | null = null
let yaInstalada = false
const oyentes = new Set<() => void>()

const avisar = () => { for (const f of oyentes) f() }

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // `preventDefault` evita el cartel propio de Chrome: la app ofrece el suyo
    // dentro de la puerta, con el contexto de por qué conviene instalar.
    e.preventDefault()
    guardado = e as EventoInstalacion
    avisar()
  })

  // Cuando la instalación termina, el prompt guardado ya no sirve: usarlo
  // otra vez no hace nada y el botón se quedaría ofreciendo algo hecho.
  window.addEventListener('appinstalled', () => {
    guardado = null
    yaInstalada = true
    avisar()
  })
}

/** El evento guardado, o `null` si el navegador todavía no lo ofreció. */
export function promptDisponible(): EventoInstalacion | null {
  return guardado
}

/** `true` si se instaló durante ESTA visita (el evento `appinstalled`). */
export function seInstaloRecien(): boolean {
  return yaInstalada
}

/** Avisa cuando aparece el prompt o cuando la app queda instalada. */
export function alCambiarInstalacion(cb: () => void): () => void {
  oyentes.add(cb)
  return () => { oyentes.delete(cb) }
}

/**
 * Lanza el cuadro de instalación de Android.
 *
 * Tiene que llamarse DENTRO del manejador de un toque: el navegador rechaza un
 * `prompt()` que no venga de un gesto.
 */
export async function instalar(): Promise<'accepted' | 'dismissed' | 'sin-prompt'> {
  if (!guardado) return 'sin-prompt'
  await guardado.prompt()
  const { outcome } = await guardado.userChoice
  // El evento es de un solo uso: Chrome no acepta un segundo `prompt()` sobre
  // el mismo. Si lo rechazaron, volverá a dispararse en otra visita.
  guardado = null
  avisar()
  return outcome
}

/** Alta SWU para una identidad compartida. El servidor decide el usuario y sus permisos. */
export interface MembershipUser {
  id: string
  user_metadata?: Record<string, unknown>
}

export interface MembershipParams {
  display_name: string
  profile_avatar: string
}

type MembershipRpc = (
  params: MembershipParams,
  signal: AbortSignal,
) => PromiseLike<{ error: unknown | null }>

export type MembershipResult = { ok: true } | { ok: false; error: string }

export const ERROR_MEMBRESIA_SWU = 'No pudimos preparar tu perfil de SWU. Revisá tu conexión y volvé a intentar.'

function texto(valor: unknown, fallback: string): string {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : fallback
}

/** Éxitos y solicitudes compartidos solo durante esta carga; los errores nunca se cachean. */
export function createEnsureSwuMembership(rpc: MembershipRpc, timeoutMs = 8000) {
  const listos = new Set<string>()
  const pendientes = new Map<string, Promise<MembershipResult>>()

  return function ensureSwuMembership(user: MembershipUser): Promise<MembershipResult> {
    if (!user.id) return Promise.resolve({ ok: false, error: ERROR_MEMBRESIA_SWU })
    // Las cuentas históricas de SWU ya reciben sus filas mediante el trigger.
    // Este metadata decide incorporación, nunca identidad ni autorización.
    if (user.user_metadata?.origin_app !== 'memento') return Promise.resolve({ ok: true })
    if (listos.has(user.id)) return Promise.resolve({ ok: true })
    const pendiente = pendientes.get(user.id)
    if (pendiente) return pendiente

    const controlador = new AbortController()
    let temporizador: ReturnType<typeof setTimeout>
    const limite = new Promise<never>((_, rechazar) => {
      temporizador = setTimeout(() => {
        controlador.abort()
        rechazar(new Error('La membresía SWU no respondió a tiempo'))
      }, timeoutMs)
    })
    const tarea = (async (): Promise<MembershipResult> => {
      try {
        const { error } = await Promise.race([
          rpc({
            display_name: texto(user.user_metadata?.name, 'Jugador'),
            profile_avatar: texto(user.user_metadata?.avatar, '🎯'),
          }, controlador.signal),
          limite,
        ])
        if (error) return { ok: false, error: ERROR_MEMBRESIA_SWU }
        listos.add(user.id)
        return { ok: true }
      } catch {
        return { ok: false, error: ERROR_MEMBRESIA_SWU }
      } finally {
        clearTimeout(temporizador!)
      }
    })()
    pendientes.set(user.id, tarea)
    void tarea.finally(() => {
      if (pendientes.get(user.id) === tarea) pendientes.delete(user.id)
    })
    return tarea
  }
}

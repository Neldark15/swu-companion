/**
 * El saldo de sobres, en UN solo sitio.
 *
 * ── El problema que esto viene a resolver ─────────────────────────────
 *
 * Medido el 2026-08-23: **333 sobres esperando sin abrir**, y **26 de 38
 * personas nunca abrieron ni uno** — con un promedio de 9 acumulados y alguien
 * con 21. Y no es que esa gente se haya ido: 24 de 38 estuvieron activas esa
 * misma semana. Publican en el muro y no recogen el regalo.
 *
 * La causa no es el reparto —el cron funciona y los sobres están en la
 * cuenta— sino que **el saldo era invisible**. El aviso de Inicio
 * (`AvisoSobreDiario`) salta UNA vez, la mañana que cae el sobre, y se marca
 * en `localStorage` para no repetirse. Después de eso los 9 sobres guardados
 * no aparecían en ningún lado: ni insignia en el menú, ni número en Inicio,
 * ni nada. Había que acordarse de entrar a Sobredosis.
 *
 * ── Por qué es un store y no un `useEffect` por pantalla ──────────────
 *
 * El número se dibuja en cuatro sitios (sidebar, menú de móvil, la pestaña
 * Perfil y la franja de Inicio). Con una consulta por sitio serían cuatro
 * viajes por navegación y —peor— cuatro respuestas que se pueden separar: la
 * insignia diciendo 3 y la franja 2. Una fuente, un número.
 *
 * ── Y se descuenta SOLO ───────────────────────────────────────────────
 *
 * `abrirSobre()` avisa acá con `descontar()`. Sin eso, abrir un sobre dejaba
 * la insignia con el número viejo hasta la próxima recarga completa — y una
 * insignia que no baja al hacer lo que pide es peor que no tenerla: enseña a
 * ignorarla.
 */

import { create } from 'zustand'
import { misSobres } from '../services/sobres'

interface EstadoSaldo {
  saldo: number
  /** `false` hasta la primera respuesta: sirve para no pintar un 0 falso. */
  listo: boolean
  cargar: (userId: string) => Promise<void>
  descontar: (cuantos?: number) => void
  /** El saldo que devolvió el servidor. Manda sobre cualquier resta local. */
  fijar: (saldo: number) => void
  /** Para cuando cae el diario y hay que volver a preguntar. */
  refrescar: (userId: string) => Promise<void>
}

/**
 * A quién corresponde el saldo que hay en memoria.
 *
 * Sin esto, cerrar sesión y entrar con otra cuenta enseñaría el saldo del
 * anterior hasta que respondiera la red — y el saldo de sobres es lo que la
 * gente va a mirar para decidir si entra a Sobredosis.
 */
let dueño = ''

export const useSobres = create<EstadoSaldo>((set) => ({
  saldo: 0,
  listo: false,

  cargar: async (userId) => {
    if (!userId) { dueño = ''; set({ saldo: 0, listo: true }); return }
    // Ya cargado para esta misma persona: no se vuelve a pedir en cada
    // pantalla. El número cambia por `descontar` o por `refrescar`.
    if (dueño === userId) return
    dueño = userId
    const n = await misSobres(userId)
    // La respuesta puede llegar después de un cambio de cuenta: si el dueño
    // ya no es el mismo, se descarta en vez de pintar el saldo de otro.
    if (dueño !== userId) return
    set({ saldo: n, listo: true })
  },

  refrescar: async (userId) => {
    if (!userId) return
    dueño = userId
    const n = await misSobres(userId)
    if (dueño !== userId) return
    set({ saldo: n, listo: true })
  },

  descontar: (cuantos = 1) =>
    set((s) => ({ saldo: Math.max(0, s.saldo - cuantos) })),

  fijar: (saldo) => set({ saldo: Math.max(0, saldo), listo: true }),
}))

/** Se llama al cerrar sesión: el saldo no es de nadie hasta que alguien entre. */
export function olvidarSaldoSobres(): void {
  dueño = ''
  useSobres.setState({ saldo: 0, listo: false })
}

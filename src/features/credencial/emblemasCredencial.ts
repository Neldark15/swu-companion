/**
 * Emblemas de la credencial — id → etiqueta y archivo.
 *
 * Son los avatares del perfil, que viven como PNG en `public/avatars/`. No hay
 * componente que importar: en un SVG se pintan con `<image>`, y la etiqueta
 * sale del mismo catálogo que usa el selector de avatar, para que un ícono
 * nuevo aparezca en los dos sitios sin tocar nada acá.
 */

import { swAvatars } from '../../data/avatars'
import { urlAvatarSW } from '../../services/avatars'
import type { EmblemaCredencialId } from './credencialTemas'

export interface EmblemaCredencial {
  etiqueta: string
  url: string
}

export const EMBLEMAS_CREDENCIAL = Object.fromEntries(
  swAvatars.map(a => [a.id, { etiqueta: a.name, url: urlAvatarSW(a.id) }]),
) as Record<EmblemaCredencialId, EmblemaCredencial>

/** El emblema por defecto cuando el guardado ya no existe. */
export const EMBLEMA_POR_DEFECTO: EmblemaCredencialId = 'jedi-order'

/**
 * El emblema de un id, SIEMPRE.
 *
 * Un id guardado puede haber sido retirado del catálogo —pasó: la credencial
 * nació con un juego de iconografía propio y después se cambió por los íconos
 * del perfil, y las cuentas que ya habían elegido se quedaron con ids como
 * `calavera` o `rebelde`—. Destructurar de un `undefined` tiraba la pantalla
 * entera con «Cannot destructure property 'url'».
 *
 * Un catálogo que cambia es normal; una pantalla que se cae por eso, no. Acá
 * se cae al de por defecto y se sigue.
 */
export function emblemaDe(id: string): EmblemaCredencial {
  return EMBLEMAS_CREDENCIAL[id as EmblemaCredencialId] ?? EMBLEMAS_CREDENCIAL[EMBLEMA_POR_DEFECTO]
}

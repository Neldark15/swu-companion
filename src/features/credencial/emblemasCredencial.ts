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

/**
 * avatars — resolver la imagen de un avatar.
 *
 * Un avatar puede ser tres cosas distintas guardadas en el mismo campo de
 * texto: una foto subida (data URI), el id de uno de los íconos del juego, o
 * un emoji suelto. Estas dos funciones estaban dentro de ProfilePage y las
 * necesita también la tarjeta de jugador que ahora se muestra en Inicio;
 * duplicarlas garantizaba que se fueran separando.
 */

import { swAvatars } from '../data/avatars'

/** ¿Es una foto subida por la persona? */
export function isPhotoAvatar(avatar: string): boolean {
  return avatar.startsWith('data:image/')
}

/** ¿Es uno de los íconos del juego que trae la app? */
export function esAvatarSW(avatar: string): boolean {
  return swAvatars.some(a => a.id === avatar)
}

/** Dónde vive el ícono del juego con ese id. */
export function urlAvatarSW(id: string): string {
  return `/avatars/${id}.png`
}

/** La URL de la imagen, o null si es un emoji y hay que pintarlo como texto. */
export function getAvatarSrc(avatar: string): string | null {
  if (isPhotoAvatar(avatar)) return avatar
  if (esAvatarSW(avatar)) return urlAvatarSW(avatar)
  return null
}

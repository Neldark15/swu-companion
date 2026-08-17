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

/**
 * La paleta del anillo. Son los tokens de la app, no colores sueltos: así el
 * avatar sigue perteneciendo al mismo mundo visual que el resto de la pantalla.
 */
const COLORES_ANILLO = [
  '#22D3EE', // cyan
  '#F59E0B', // ámbar
  '#22C55E', // verde
  '#FB7185', // coral
  '#A78BFA', // violeta
  '#38BDF8', // azul
  '#FB923C', // naranja
  '#F472B6', // rosa
] as const

/**
 * El color de una persona, siempre el mismo.
 *
 * Se deriva de su id (o de su nombre, si es alguien sin cuenta) con un hash
 * estable: la gracia es que Vara sea SIEMPRE del mismo color en la Galaxia, en
 * Amistosas y en el ranking. Un color al azar por render sería ruido bonito;
 * uno estable es información — se reconoce a alguien antes de leer su nombre.
 */
export function colorDePersona(semilla: string): string {
  // FNV-1a más la avalancha de murmur3. La avalancha NO es adorno: la semilla
  // real es un UUID, y 23 UUIDs comparten tanta estructura que quedarse con
  // los 3 bits bajos de un `h*31` amontonaba 5 personas en un color y 8 en
  // otro. Medido sobre los 23 perfiles de producción, así los 8 colores se
  // usan y el más repetido cae a 5.
  let h = 0x811c9dc5
  for (let i = 0; i < semilla.length; i++) {
    h ^= semilla.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return COLORES_ANILLO[(h >>> 0) % COLORES_ANILLO.length]
}

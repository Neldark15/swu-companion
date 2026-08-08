/**
 * Avatar — las tres formas de un avatar, en un solo lugar.
 *
 * El campo `avatar` de un perfil guarda tres cosas distintas: una foto subida
 * (data URI), el id de uno de los íconos del juego, o un emoji suelto. El
 * despacho de esas tres ramas estaba copiado en OCHO pantallas, y con él la
 * lista de los 24 ids: agregar un ícono nuevo obligaba a acordarse de los ocho
 * sitios, y el que se olvidara pintaba el id crudo como si fuera un emoji.
 * Ahora la lista vive en `data/avatars.ts` y de dónde sale la imagen lo decide
 * `services/avatars.ts`; acá solo está el cómo se pinta.
 *
 * Los TAMAÑOS sí son de cada pantalla —el avatar de una fila de lista no mide
 * lo mismo que el de una cabecera— así que se piden por props, con las
 * proporciones que cada sitio ya traía. Y el marco no se impone: Comunidad y
 * Espionaje envuelven el avatar en un `ProfileFrame`, así que `caja="marco"`
 * pinta solo el fondo que llena ese marco y `caja="ninguna"` no pinta nada
 * alrededor.
 */

import { getAvatarSrc, isPhotoAvatar } from '../../services/avatars'

/** Qué pinta el componente alrededor del avatar. */
type CajaAvatar =
  /** Burbuja redonda propia — listas y cabeceras. */
  | 'circulo'
  /** Caja de esquinas suaves — La Galaxia. */
  | 'redondeada'
  /** Llena la caja de quien llama, sin forma propia — dentro de un ProfileFrame. */
  | 'marco'
  /** Sin caja: la imagen va suelta en el flujo. */
  | 'ninguna'

interface AvatarProps {
  /** Foto (data URI), id de ícono del juego, o emoji. */
  avatar: string | null | undefined
  /**
   * Lado de la caja, en px. Con `caja="marco"` la caja la da el marco, pero el
   * número sigue haciendo falta para escalar el ícono y el emoji.
   */
  size: number
  caja?: CajaAvatar
  /** El ícono del juego se dibuja más chico que la caja para que respire. */
  escalaIcono?: number
  escalaEmoji?: number
  /** Clases extra para la caja (posicionamiento del sitio que llama). */
  className?: string
}

export function Avatar({
  avatar,
  size,
  caja = 'circulo',
  escalaIcono = 0.75,
  escalaEmoji = 0.5,
  className = '',
}: AvatarProps) {
  // Un perfil viejo puede no tener avatar guardado; sin caer, se pinta vacío.
  const valor = avatar ?? ''
  const src = getAvatarSrc(valor)

  let contenido
  if (src && isPhotoAvatar(valor)) {
    // La foto llena la caja. Sin caja propia hay que redondearla acá mismo, o
    // quedaría cuadrada en medio de una fila.
    contenido = caja === 'ninguna'
      ? <img src={src} alt="" className="object-cover rounded-full" style={{ width: size, height: size }} />
      : <img src={src} alt="" className="w-full h-full object-cover" />
  } else if (src) {
    const lado = size * escalaIcono
    contenido = <img src={src} alt="" className="object-contain" style={{ width: lado, height: lado }} />
  } else {
    contenido = <span style={{ fontSize: size * escalaEmoji, lineHeight: 1 }}>{valor}</span>
  }

  if (caja === 'ninguna') return contenido

  const forma = caja === 'circulo' ? 'rounded-full' : caja === 'redondeada' ? 'rounded-xl' : ''
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 overflow-hidden bg-swu-bg
                  ${forma} ${caja === 'marco' ? 'w-full h-full' : ''} ${className}`}
      style={caja === 'marco' ? undefined : { width: size, height: size }}
    >
      {contenido}
    </div>
  )
}

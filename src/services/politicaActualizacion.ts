/** Solo las pantallas declaradas de lectura pueden recargarse automáticamente.
 * Ocultar la app NO convierte una partida o un editor en una pantalla segura. */
const SEGURAS = [
  '/', '/explore', '/collection', '/binder-digital', '/cards', '/rank',
  '/community', '/galaxy', '/galaxia', '/blog', '/rulings', '/meta',
  '/calendario', '/torneos', '/sedes', '/misiones', '/sobres', '/trivia',
  '/aurebesh', '/profile', '/settings', '/credencial', '/espionaje',
  '/amistosas', '/prestamos', '/mensajes', '/envivo', '/u/', '/liga/',
  '/laboratorio', '/scan', '/terraformar', '/sable', '/c/',
]

function esRuta(ruta: string, prefijo: string): boolean {
  return ruta === prefijo || ruta.startsWith(prefijo.endsWith('/') ? prefijo : `${prefijo}/`)
}

export function esSeguraParaActualizar(ruta: string): boolean {
  const limpia = ruta.split(/[?#]/)[0].replace(/\/$/, '') || '/'
  if (limpia.startsWith('/liga/') && limpia.endsWith('/panel')) return false
  return SEGURAS.some(prefijo => prefijo === '/' ? limpia === '/' : esRuta(limpia, prefijo))
}

/** Las pantallas de transmisión conservan su navegación por red y nunca
 * instalan la PWA solo porque un operador abrió un enlace. */
export function omitirRegistroPwa(ruta: string): boolean {
  return ['/overlay', '/estudio', '/events/live'].some(prefijo => esRuta(ruta, prefijo))
}

/** No tapar una partida, proyección o panel de operación con un diálogo. La
 * versión queda pendiente en el estado global y en el botón de Ajustes. */
export function posponerAvisoActualizacion(ruta: string): boolean {
  return omitirRegistroPwa(ruta)
    || ['/contador', '/calculadora', '/play', '/jugar', '/admin', '/temporada'].some(prefijo => esRuta(ruta, prefijo))
    || (ruta.startsWith('/liga/') && ruta.endsWith('/panel'))
}

export type ModoAcceso = 'select' | 'register' | 'login' | 'forgot-password'

/** El query solo puede abrir formularios públicos, nunca el cambio de contraseña. */
export function leerModoAcceso(search: string): ModoAcceso {
  const modo = new URLSearchParams(search).get('modo')
  return modo === 'register' || modo === 'login' || modo === 'forgot-password'
    ? modo
    : 'select'
}

/** Mantiene la ruta pedida por AuthGate y descarta destinos externos. */
export function destinoTrasAcceso(search: string): string | null {
  const destino = new URLSearchParams(search).get('next')
  if (!destino) return null
  return esRutaInterna(destino) ? destino : '/profile'
}

export function rutaAccesoPerfil(modo: Exclude<ModoAcceso, 'select'>, search = ''): string {
  const params = new URLSearchParams({ modo })
  const destino = destinoTrasAcceso(search)
  if (destino && destino !== '/profile') params.set('next', destino)
  return `/profile?${params.toString()}`
}
import { esRutaInterna } from '../../services/rutaInterna'

/**
 * Sonda de WebGL, en su propio módulo.
 *
 * Va separada de `GalaxiaEscena.tsx` por la misma razón que `hudTones.ts` está
 * separado de `Hud.tsx`: un archivo que exporta componentes Y funciones rompe
 * el Fast Refresh de Vite (`react-refresh/only-export-components`), y editar la
 * escena dejaría de recargar en caliente.
 */

let soporte: boolean | null = null

/**
 * ¿Se puede dibujar en 3D acá?
 *
 * El resultado se cachea a nivel de módulo: cada sonda crea un contexto de
 * verdad y los navegadores topan cuántos contextos vivos aceptan (16 en
 * Chrome). Sondear en cada render los quemaría, y el primero en morir sería el
 * más viejo — el de la propia escena. Por eso además se suelta a mano en vez de
 * dejárselo al recolector.
 */
export function hayWebGL(): boolean {
  if (soporte !== null) return soporte
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') ?? c.getContext('webgl')
    soporte = !!gl
    if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    soporte = false
  }
  return soporte
}

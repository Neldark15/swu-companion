/**
 * Tonos del HUD, en su propio módulo.
 *
 * Van separados de Hud.tsx a propósito: un archivo que exporta componentes Y
 * constantes rompe el Fast Refresh de Vite (react-refresh/only-export-components),
 * y editar la consola dejaría de recargar en caliente.
 */

export type HudTone = 'cyan' | 'amber' | 'green' | 'red' | 'purple' | 'neutral'

/** Color de texto de cada tono. */
export const HUD_TEXTO: Record<HudTone, string> = {
  cyan: 'text-swu-cyan',
  amber: 'text-swu-amber',
  green: 'text-swu-green',
  red: 'text-swu-red',
  purple: 'text-purple-400',
  neutral: 'text-swu-muted',
}

/** Color de la línea de contorno. */
export const HUD_LINEA: Record<HudTone, string> = {
  cyan: 'bg-swu-cyan/45',
  amber: 'bg-swu-amber/45',
  green: 'bg-swu-green/45',
  red: 'bg-swu-red/45',
  purple: 'bg-purple-400/45',
  neutral: 'bg-swu-border',
}

/** Resplandor exterior del panel. */
export const HUD_RESPLANDOR: Record<HudTone, string> = {
  cyan: 'shadow-[0_0_20px_-4px_rgba(34,211,238,0.35)]',
  amber: 'shadow-[0_0_20px_-4px_rgba(245,158,11,0.30)]',
  green: 'shadow-[0_0_20px_-4px_rgba(34,197,94,0.30)]',
  red: 'shadow-[0_0_20px_-4px_rgba(239,68,68,0.30)]',
  purple: 'shadow-[0_0_20px_-4px_rgba(192,132,252,0.30)]',
  neutral: '',
}

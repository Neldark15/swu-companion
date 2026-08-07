import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { syncSettingsToCloud } from '../services/sync'
import { aplicarTemaFondo, esTemaFondo, esTinteTarjeta, esMarcoElegido } from '../services/personalizacion'
import type { TemaFondoId, TinteTarjetaId, MarcoElegido } from '../services/personalizacion'
import { useAuth } from './useAuth'

// ── Accent Color System ──
export type AccentColor = 'red' | 'green' | 'blue' | 'purple' | 'yellow' | 'white'

export const ACCENT_COLORS: Record<AccentColor, string> = {
  // Era #EF4444. Medido: con texto blanco encima daba 3,76:1, por debajo del
  // 4,5 de WCAG. #DC2626 es el rojo más cercano que sí pasa (4,83) y así los
  // botones principales conservan el texto BLANCO, que es lo que se espera de
  // un botón rojo. Los otros cinco acentos no tienen esa salida — ver abajo.
  red:    '#DC2626',
  green:  '#22C55E',
  blue:   '#60A5FA',
  purple: '#A78BFA',
  yellow: '#FACC15',
  white:  '#E2E8F0',
}

/** Negro de la marca para texto sobre un acento claro. No es #000: ese vibra
 *  sobre un color saturado. */
const TINTA_OSCURA = '#0B0B12'

function luminancia(hex: string): number {
  const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2])
}

/**
 * Qué color de texto se lee encima de este acento.
 *
 * Se prefiere el BLANCO y solo se cae al oscuro cuando el blanco no llega a
 * 4,5:1, porque un botón de color con letra blanca es lo convencional y
 * cambiarlo sin necesidad se nota.
 *
 * Hacía falta de verdad: medido, los SEIS acentos elegibles fallaban con
 * blanco fijo —rojo 3,76 · verde 2,28 · azul 2,54 · púrpura 2,72 · blanco
 * 1,23— y el amarillo daba **1,53:1**, o sea texto invisible en todos los
 * botones principales de quien eligiera ese color. No era un problema del
 * rojo: era de la paleta entera.
 */
export function tintaSobreAcento(acento: string): string {
  const l = luminancia(acento)
  const conBlanco = 1.05 / (l + 0.05)
  return conBlanco >= 4.5 ? '#FFFFFF' : TINTA_OSCURA
}

export const ACCENT_LABELS: Record<AccentColor, string> = {
  red:    'Rojo',
  green:  'Verde',
  blue:   'Azul',
  purple: 'Púrpura',
  yellow: 'Amarillo',
  white:  'Blanco',
}

export function applyAccentColor(color: AccentColor) {
  const acento = ACCENT_COLORS[color]
  document.documentElement.style.setProperty('--color-swu-accent', acento)
  // La tinta que se lee ENCIMA del acento. `--color-swu-accent-texto` (el
  // acento aclarado, para leerlo sobre el fondo oscuro) se deriva solo con
  // color-mix en index.css; esta no se puede derivar en CSS porque hay que
  // mirar la luminancia para decidir, y eso CSS no lo sabe hacer.
  document.documentElement.style.setProperty('--color-swu-accent-fg', tintaSobreAcento(acento))
}

// ── Saber Colors (for XP bar lightsaber) ──
export type SaberColor = 'blue' | 'green' | 'red' | 'purple' | 'yellow' | 'white' | 'orange'

export const SABER_COLORS: Record<SaberColor, { core: string; glow: string; label: string }> = {
  blue:   { core: '#4FC3F7', glow: '#1565C0', label: 'Azul' },
  green:  { core: '#81C784', glow: '#2E7D32', label: 'Verde' },
  red:    { core: '#EF5350', glow: '#B71C1C', label: 'Rojo' },
  purple: { core: '#CE93D8', glow: '#6A1B9A', label: 'Púrpura' },
  yellow: { core: '#FFF176', glow: '#F9A825', label: 'Amarillo' },
  white:  { core: '#F5F5F5', glow: '#B0BEC5', label: 'Blanco' },
  orange: { core: '#FFB74D', glow: '#E65100', label: 'Naranja' },
}

interface SettingsState {
  theme: 'dark' | 'light'
  fontSize: 'sm' | 'md' | 'lg' | 'xl'
  hapticFeedback: boolean
  showShields: boolean
  showExperience: boolean
  showResources: boolean
  playerName: string
  accentColor: AccentColor
  saberColor: SaberColor
  // ── Personalización (catálogos en services/personalizacion.ts) ──
  temaFondo: TemaFondoId
  tinteTarjeta: TinteTarjetaId
  marcoElegido: MarcoElegido

  setTheme: (t: 'dark' | 'light') => void
  setFontSize: (s: 'sm' | 'md' | 'lg' | 'xl') => void
  toggleHaptic: () => void
  toggleCounter: (counter: 'showShields' | 'showExperience' | 'showResources') => void
  setPlayerName: (name: string) => void
  setAccentColor: (c: AccentColor) => void
  setSaberColor: (c: SaberColor) => void
  setTemaFondo: (t: TemaFondoId) => void
  setTinteTarjeta: (t: TinteTarjetaId) => void
  setMarcoElegido: (m: MarcoElegido) => void
}

/** Debounced cloud sync for settings */
let syncTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSyncSettings() {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    const { supabaseUser } = useAuth.getState()
    if (!supabaseUser) return
    const state = useSettings.getState()
    const settingsData = {
      theme: state.theme,
      fontSize: state.fontSize,
      hapticFeedback: state.hapticFeedback,
      showShields: state.showShields,
      showExperience: state.showExperience,
      showResources: state.showResources,
      playerName: state.playerName,
      accentColor: state.accentColor,
      saberColor: state.saberColor,
      temaFondo: state.temaFondo,
      tinteTarjeta: state.tinteTarjeta,
      marcoElegido: state.marcoElegido,
    }
    syncSettingsToCloud(supabaseUser.id, settingsData).catch(() => {})
  }, 1500)
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      fontSize: 'md',
      hapticFeedback: true,
      showShields: true,
      showExperience: true,
      showResources: true,
      playerName: '',
      accentColor: 'red',
      saberColor: 'blue',
      temaFondo: 'holocron',
      tinteTarjeta: 'auto',
      marcoElegido: 'auto',

      setTheme: (theme) => { set({ theme }); debouncedSyncSettings() },
      setFontSize: (fontSize) => { set({ fontSize }); debouncedSyncSettings() },
      toggleHaptic: () => { set((s) => ({ hapticFeedback: !s.hapticFeedback })); debouncedSyncSettings() },
      toggleCounter: (counter) => { set((s) => ({ [counter]: !s[counter] })); debouncedSyncSettings() },
      setPlayerName: (playerName) => { set({ playerName }); debouncedSyncSettings() },
      setAccentColor: (accentColor) => { set({ accentColor }); applyAccentColor(accentColor); debouncedSyncSettings() },
      setSaberColor: (saberColor) => { set({ saberColor }); debouncedSyncSettings() },
      setTemaFondo: (temaFondo) => { set({ temaFondo }); aplicarTemaFondo(temaFondo); debouncedSyncSettings() },
      setTinteTarjeta: (tinteTarjeta) => { set({ tinteTarjeta }); debouncedSyncSettings() },
      setMarcoElegido: (marcoElegido) => { set({ marcoElegido }); debouncedSyncSettings() },
    }),
    { name: 'swu-settings' }
  )
)

/**
 * Aplica al store EN MEMORIA los settings que llegan de la nube, campo por
 * campo y VALIDADOS — un valor corrupto o desconocido se ignora y queda el
 * default, nunca entra al estado.
 *
 * Existe para la restauración de `pullAllFromCloud` (sync.ts): escribir el
 * JSON crudo a localStorage no servía, porque el store ya rehidrató con
 * defaults al arrancar — el tema/tinte/marco restaurados no se veían hasta
 * recargar y, peor, el primer ajuste que la persona tocara subía a la nube
 * los defaults en memoria, pisando la elección hecha en su otro dispositivo.
 * Pasar por `setState` arregla las dos cosas: se aplica al instante (persist
 * escribe el localStorage solo) y lo que se sincronice después ya lleva lo
 * restaurado. Los efectos visuales (acento, tema) se disparan acá mismo.
 */
export function aplicarSettingsDeNube(nube: Record<string, unknown>): void {
  const parche: Partial<SettingsState> = {}
  if (nube.theme === 'dark' || nube.theme === 'light') parche.theme = nube.theme
  if (nube.fontSize === 'sm' || nube.fontSize === 'md' || nube.fontSize === 'lg' || nube.fontSize === 'xl') parche.fontSize = nube.fontSize
  if (typeof nube.hapticFeedback === 'boolean') parche.hapticFeedback = nube.hapticFeedback
  if (typeof nube.showShields === 'boolean') parche.showShields = nube.showShields
  if (typeof nube.showExperience === 'boolean') parche.showExperience = nube.showExperience
  if (typeof nube.showResources === 'boolean') parche.showResources = nube.showResources
  if (typeof nube.playerName === 'string') parche.playerName = nube.playerName
  if (typeof nube.accentColor === 'string' && nube.accentColor in ACCENT_COLORS) parche.accentColor = nube.accentColor as AccentColor
  if (typeof nube.saberColor === 'string' && nube.saberColor in SABER_COLORS) parche.saberColor = nube.saberColor as SaberColor
  if (esTemaFondo(nube.temaFondo)) parche.temaFondo = nube.temaFondo
  if (esTinteTarjeta(nube.tinteTarjeta)) parche.tinteTarjeta = nube.tinteTarjeta
  if (esMarcoElegido(nube.marcoElegido)) parche.marcoElegido = nube.marcoElegido
  if (Object.keys(parche).length === 0) return
  useSettings.setState(parche)
  if (parche.accentColor) applyAccentColor(parche.accentColor)
  if (parche.temaFondo) aplicarTemaFondo(parche.temaFondo)
}

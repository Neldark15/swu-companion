import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { syncSettingsToCloud } from '../services/sync'
import { useAuth } from './useAuth'

// ── Accent Color System ──
export type AccentColor = 'red' | 'green' | 'blue' | 'purple' | 'yellow' | 'white'

export const ACCENT_COLORS: Record<AccentColor, string> = {
  red:    '#EF4444',
  green:  '#22C55E',
  blue:   '#60A5FA',
  purple: '#A78BFA',
  yellow: '#FACC15',
  white:  '#E2E8F0',
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
  document.documentElement.style.setProperty('--color-swu-accent', ACCENT_COLORS[color])
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

  setTheme: (t: 'dark' | 'light') => void
  setFontSize: (s: 'sm' | 'md' | 'lg' | 'xl') => void
  toggleHaptic: () => void
  toggleCounter: (counter: 'showShields' | 'showExperience' | 'showResources') => void
  setPlayerName: (name: string) => void
  setAccentColor: (c: AccentColor) => void
  setSaberColor: (c: SaberColor) => void
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

      setTheme: (theme) => { set({ theme }); debouncedSyncSettings() },
      setFontSize: (fontSize) => { set({ fontSize }); debouncedSyncSettings() },
      toggleHaptic: () => { set((s) => ({ hapticFeedback: !s.hapticFeedback })); debouncedSyncSettings() },
      toggleCounter: (counter) => { set((s) => ({ [counter]: !s[counter] })); debouncedSyncSettings() },
      setPlayerName: (playerName) => { set({ playerName }); debouncedSyncSettings() },
      setAccentColor: (accentColor) => { set({ accentColor }); applyAccentColor(accentColor); debouncedSyncSettings() },
      setSaberColor: (saberColor) => { set({ saberColor }); debouncedSyncSettings() },
    }),
    { name: 'swu-settings' }
  )
)

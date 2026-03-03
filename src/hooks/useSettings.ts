import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { syncSettingsToCloud } from '../services/sync'
import { useAuth } from './useAuth'

interface SettingsState {
  theme: 'dark' | 'light'
  fontSize: 'sm' | 'md' | 'lg' | 'xl'
  hapticFeedback: boolean
  showShields: boolean
  showExperience: boolean
  showResources: boolean
  playerName: string

  setTheme: (t: 'dark' | 'light') => void
  setFontSize: (s: 'sm' | 'md' | 'lg' | 'xl') => void
  toggleHaptic: () => void
  toggleCounter: (counter: 'showShields' | 'showExperience' | 'showResources') => void
  setPlayerName: (name: string) => void
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

      setTheme: (theme) => { set({ theme }); debouncedSyncSettings() },
      setFontSize: (fontSize) => { set({ fontSize }); debouncedSyncSettings() },
      toggleHaptic: () => { set((s) => ({ hapticFeedback: !s.hapticFeedback })); debouncedSyncSettings() },
      toggleCounter: (counter) => { set((s) => ({ [counter]: !s[counter] })); debouncedSyncSettings() },
      setPlayerName: (playerName) => { set({ playerName }); debouncedSyncSettings() },
    }),
    { name: 'swu-settings' }
  )
)

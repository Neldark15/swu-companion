import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { db, type UserProfile } from '../services/db'

interface AuthState {
  currentProfileId: string | null
  currentProfile: UserProfile | null
  profiles: UserProfile[]

  setCurrentProfile: (profile: UserProfile | null) => void
  loadProfiles: () => Promise<void>
  createProfile: (name: string, pin: string, avatar: string) => Promise<UserProfile>
  login: (profileId: string, pin: string) => Promise<boolean>
  logout: () => void
  deleteProfile: (profileId: string) => Promise<void>
}

function generateId() {
  return `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      currentProfileId: null,
      currentProfile: null,
      profiles: [],

      loadProfiles: async () => {
        const profiles = await db.profiles.toArray()
        set({ profiles })
        // Restore current profile if id is set
        const { currentProfileId } = get()
        if (currentProfileId) {
          const profile = profiles.find(p => p.id === currentProfileId) || null
          set({ currentProfile: profile })
        }
      },

      createProfile: async (name: string, pin: string, avatar: string) => {
        const profile: UserProfile = {
          id: generateId(),
          name,
          pin,
          avatar,
          createdAt: Date.now(),
        }
        await db.profiles.put(profile)
        const profiles = await db.profiles.toArray()
        set({ profiles, currentProfile: profile, currentProfileId: profile.id })
        return profile
      },

      login: async (profileId: string, pin: string) => {
        const profile = await db.profiles.get(profileId)
        if (!profile || profile.pin !== pin) return false
        set({ currentProfile: profile, currentProfileId: profile.id })
        return true
      },

      logout: () => {
        set({ currentProfile: null, currentProfileId: null })
      },

      deleteProfile: async (profileId: string) => {
        await db.profiles.delete(profileId)
        const profiles = await db.profiles.toArray()
        const { currentProfileId } = get()
        if (currentProfileId === profileId) {
          set({ profiles, currentProfile: null, currentProfileId: null })
        } else {
          set({ profiles })
        }
      },

      setCurrentProfile: (profile) => {
        set({ currentProfile: profile, currentProfileId: profile?.id || null })
      },
    }),
    {
      name: 'swu-auth',
      partialize: (state) => ({ currentProfileId: state.currentProfileId }),
    }
  )
)

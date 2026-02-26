import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { db, type UserProfile } from '../services/db'
import { hashPin, verifyPin, createPasskey, authenticateWithPasskey, authenticateWithAnyPasskey } from '../services/crypto'

interface AuthState {
  currentProfileId: string | null
  currentProfile: UserProfile | null
  profiles: UserProfile[]

  // Core
  setCurrentProfile: (profile: UserProfile | null) => void
  loadProfiles: () => Promise<void>
  logout: () => void

  // Registration
  createProfile: (data: {
    name: string
    pin: string
    avatar: string
    email?: string
  }) => Promise<UserProfile>

  // Login
  login: (profileId: string, pin: string) => Promise<boolean>
  loginWithPasskey: (profileId: string) => Promise<boolean>
  loginWithAnyPasskey: () => Promise<boolean>

  // Profile management
  updateProfile: (data: Partial<Pick<UserProfile, 'name' | 'avatar' | 'email'>>) => Promise<void>
  changePin: (oldPin: string, newPin: string) => Promise<boolean>
  registerPasskey: () => Promise<boolean>
  removePasskey: () => Promise<void>
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
        const { currentProfileId } = get()
        if (currentProfileId) {
          const profile = profiles.find(p => p.id === currentProfileId) || null
          set({ currentProfile: profile })
        }
      },

      createProfile: async ({ name, pin, avatar, email }) => {
        const { hash, salt } = await hashPin(pin)
        const profile: UserProfile = {
          id: generateId(),
          name,
          email: email || undefined,
          pin: hash,
          pinSalt: salt,
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
        if (!profile) return false

        // Legacy migration: plaintext PIN → hashed
        if (profile.pinPlain && !profile.pinSalt) {
          if (profile.pinPlain !== pin) return false
          // Migrate to hashed PIN
          const { hash, salt } = await hashPin(pin)
          const updated: UserProfile = {
            ...profile,
            pin: hash,
            pinSalt: salt,
            pinPlain: undefined,
          }
          await db.profiles.put(updated)
          const profiles = await db.profiles.toArray()
          set({ profiles, currentProfile: updated, currentProfileId: updated.id })
          return true
        }

        // Normal hashed PIN verification
        if (!profile.pin || !profile.pinSalt) return false
        const valid = await verifyPin(pin, profile.pin, profile.pinSalt)
        if (!valid) return false

        set({ currentProfile: profile, currentProfileId: profile.id })
        return true
      },

      loginWithPasskey: async (profileId: string) => {
        const profile = await db.profiles.get(profileId)
        if (!profile?.credentialId) return false

        const ok = await authenticateWithPasskey(profile.credentialId)
        if (!ok) return false

        set({ currentProfile: profile, currentProfileId: profile.id })
        return true
      },

      loginWithAnyPasskey: async () => {
        const matchedCredId = await authenticateWithAnyPasskey()
        if (!matchedCredId) return false

        const allProfiles = await db.profiles.toArray()
        const profile = allProfiles.find(p => p.credentialId === matchedCredId)
        if (!profile) return false

        set({
          profiles: allProfiles,
          currentProfile: profile,
          currentProfileId: profile.id,
        })
        return true
      },

      updateProfile: async (data) => {
        const { currentProfile } = get()
        if (!currentProfile) return
        const updated = { ...currentProfile, ...data }
        await db.profiles.put(updated)
        const profiles = await db.profiles.toArray()
        set({ profiles, currentProfile: updated })
      },

      changePin: async (oldPin: string, newPin: string) => {
        const { currentProfile } = get()
        if (!currentProfile) return false

        // Verify old PIN
        if (currentProfile.pinPlain) {
          if (currentProfile.pinPlain !== oldPin) return false
        } else if (currentProfile.pin && currentProfile.pinSalt) {
          const valid = await verifyPin(oldPin, currentProfile.pin, currentProfile.pinSalt)
          if (!valid) return false
        } else {
          return false
        }

        const { hash, salt } = await hashPin(newPin)
        const updated: UserProfile = {
          ...currentProfile,
          pin: hash,
          pinSalt: salt,
          pinPlain: undefined,
        }
        await db.profiles.put(updated)
        const profiles = await db.profiles.toArray()
        set({ profiles, currentProfile: updated })
        return true
      },

      registerPasskey: async () => {
        const { currentProfile } = get()
        if (!currentProfile) return false

        try {
          const { credentialId, publicKey } = await createPasskey(
            currentProfile.id,
            currentProfile.name
          )
          const updated: UserProfile = {
            ...currentProfile,
            credentialId,
            credentialPublicKey: publicKey,
          }
          await db.profiles.put(updated)
          const profiles = await db.profiles.toArray()
          set({ profiles, currentProfile: updated })
          return true
        } catch {
          return false
        }
      },

      removePasskey: async () => {
        const { currentProfile } = get()
        if (!currentProfile) return
        const updated: UserProfile = {
          ...currentProfile,
          credentialId: undefined,
          credentialPublicKey: undefined,
        }
        await db.profiles.put(updated)
        const profiles = await db.profiles.toArray()
        set({ profiles, currentProfile: updated })
      },

      logout: () => {
        set({ currentProfile: null, currentProfileId: null })
      },

      setCurrentProfile: (profile) => {
        set({ currentProfile: profile, currentProfileId: profile?.id || null })
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
    }),
    {
      name: 'swu-auth',
      partialize: (state) => ({ currentProfileId: state.currentProfileId }),
    }
  )
)

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { db, type UserProfile } from '../services/db'
import { supabase, isSupabaseReady } from '../services/supabase'
import { syncProfileToCloud, syncStatsToCloud, pullAllFromCloud, addMonthlyXp } from '../services/sync'
import { createPasskey, authenticateWithPasskey, authenticateWithAnyPasskey } from '../services/crypto'
import { createDefaultStats } from '../services/gamification'
import { getUserRole } from '../services/events'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  // Cloud auth
  supabaseUser: User | null
  isOnline: boolean
  role: 'user' | 'admin'
  isAdmin: boolean

  // Local profile (Dexie cache)
  currentProfileId: string | null
  currentProfile: UserProfile | null
  profiles: UserProfile[]

  // Core
  setCurrentProfile: (profile: UserProfile | null) => void
  loadProfiles: () => Promise<void>
  logout: () => Promise<void>
  initAuth: () => Promise<void>

  // Registration (email + password)
  register: (data: {
    name: string
    email: string
    password: string
    avatar: string
  }) => Promise<{ ok: boolean; error?: string }>

  // Login (email + password)
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>

  // Passkey (local quick login, still works)
  loginWithPasskey: (profileId: string) => Promise<boolean>
  loginWithAnyPasskey: () => Promise<boolean>
  registerPasskey: () => Promise<boolean>
  removePasskey: () => Promise<void>

  // Password recovery
  resetPassword: (email: string) => Promise<{ ok: boolean; error?: string }>

  // Profile management
  updateProfile: (data: Partial<Pick<UserProfile, 'name' | 'avatar' | 'email'>>) => Promise<void>
  deleteProfile: (profileId: string) => Promise<void>
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      supabaseUser: null,
      isOnline: isSupabaseReady(),
      role: 'user',
      isAdmin: false,
      currentProfileId: null,
      currentProfile: null,
      profiles: [],

      // ─── INIT: Listen for Supabase auth changes ───
      initAuth: async () => {
        if (!isSupabaseReady()) return

        // Check existing session
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const user = session.user
          set({ supabaseUser: user })

          // Ensure local profile exists for this user
          let profile = await db.profiles.get(user.id)
          if (!profile) {
            profile = {
              id: user.id,
              name: user.user_metadata?.name || 'Jugador',
              email: user.email || '',
              avatar: user.user_metadata?.avatar || '🎯',
              createdAt: Date.now(),
            }
            await db.profiles.put(profile)
          }

          const profiles = await db.profiles.toArray()

          // Check role from Supabase
          const role = await getUserRole(user.id) as 'user' | 'admin'

          set({
            profiles,
            currentProfile: profile,
            currentProfileId: profile.id,
            role,
            isAdmin: role === 'admin',
          })

          // Sync from cloud
          pullAllFromCloud(user.id, profile.id).catch(() => {})
        }

        // Listen for future auth changes
        supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            set({ supabaseUser: session.user })
          } else if (event === 'SIGNED_OUT') {
            set({ supabaseUser: null, currentProfile: null, currentProfileId: null })
          }
        })
      },

      loadProfiles: async () => {
        const profiles = await db.profiles.toArray()
        set({ profiles })
        const { currentProfileId } = get()
        if (currentProfileId) {
          const profile = profiles.find(p => p.id === currentProfileId) || null
          set({ currentProfile: profile })
        }
      },

      // ─── REGISTER (Supabase Auth) ───
      register: async ({ name, email, password, avatar }) => {
        if (!isSupabaseReady()) {
          return { ok: false, error: 'Sin conexión al servidor' }
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name, avatar },
          },
        })

        if (error) {
          // Map common errors to Spanish
          if (error.message.includes('already registered')) {
            return { ok: false, error: 'Este correo ya está registrado' }
          }
          if (error.message.includes('password')) {
            return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres' }
          }
          return { ok: false, error: error.message }
        }

        if (!data.user) {
          return { ok: false, error: 'Error al crear la cuenta' }
        }

        const user = data.user

        // Create local profile
        const profile: UserProfile = {
          id: user.id,
          name,
          email,
          avatar,
          createdAt: Date.now(),
        }
        await db.profiles.put(profile)

        // Create local player stats
        const stats = createDefaultStats(user.id)
        await db.playerStats.put(stats)

        // Sync profile to cloud
        syncProfileToCloud(user.id, name, avatar).catch(() => {})
        syncStatsToCloud(user.id, stats).catch(() => {})

        const profiles = await db.profiles.toArray()
        set({
          supabaseUser: user,
          profiles,
          currentProfile: profile,
          currentProfileId: profile.id,
        })

        return { ok: true }
      },

      // ─── LOGIN (Supabase Auth) ───
      login: async (email: string, password: string) => {
        if (!isSupabaseReady()) {
          return { ok: false, error: 'Sin conexión al servidor' }
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          if (error.message.includes('Invalid login')) {
            return { ok: false, error: 'Correo o contraseña incorrectos' }
          }
          if (error.message.includes('Email not confirmed')) {
            return { ok: false, error: 'Debe confirmar su correo primero. Revise su bandeja.' }
          }
          return { ok: false, error: error.message }
        }

        if (!data.user) {
          return { ok: false, error: 'Error al iniciar sesión' }
        }

        const user = data.user

        // Ensure local profile exists
        let profile = await db.profiles.get(user.id)
        if (!profile) {
          // Pull profile info from cloud
          const { data: cloudProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

          profile = {
            id: user.id,
            name: cloudProfile?.name || user.user_metadata?.name || 'Jugador',
            email: user.email || '',
            avatar: cloudProfile?.avatar || user.user_metadata?.avatar || '🎯',
            createdAt: Date.now(),
          }
          await db.profiles.put(profile)
        }

        const profiles = await db.profiles.toArray()

        // Check role from Supabase
        const role = await getUserRole(user.id) as 'user' | 'admin'

        set({
          supabaseUser: user,
          profiles,
          currentProfile: profile,
          currentProfileId: profile.id,
          role,
          isAdmin: role === 'admin',
        })

        // Pull all data from cloud in background
        pullAllFromCloud(user.id, profile.id).catch(() => {})

        return { ok: true }
      },

      // ─── PASSKEY LOGIN (local, for convenience) ───
      loginWithPasskey: async (profileId: string) => {
        const profile = await db.profiles.get(profileId)
        if (!profile?.credentialId) return false
        const ok = await authenticateWithPasskey(profile.credentialId)
        if (!ok) return false

        // If we have a Supabase session, great. Otherwise just set local profile.
        set({ currentProfile: profile, currentProfileId: profile.id })
        return true
      },

      loginWithAnyPasskey: async () => {
        const matchedCredId = await authenticateWithAnyPasskey()
        if (!matchedCredId) return false

        const allProfiles = await db.profiles.toArray()
        const profile = allProfiles.find(p => p.credentialId === matchedCredId)
        if (!profile) return false

        set({ profiles: allProfiles, currentProfile: profile, currentProfileId: profile.id })
        return true
      },

      // ─── PASSWORD RECOVERY ───
      resetPassword: async (email: string) => {
        if (!isSupabaseReady()) {
          return { ok: false, error: 'Sin conexión al servidor' }
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/profile`,
        })
        if (error) return { ok: false, error: error.message }
        return { ok: true }
      },

      // ─── PROFILE MANAGEMENT ───
      updateProfile: async (data) => {
        const { currentProfile, supabaseUser } = get()
        if (!currentProfile) return
        const updated = { ...currentProfile, ...data }
        await db.profiles.put(updated)
        const profiles = await db.profiles.toArray()
        set({ profiles, currentProfile: updated })

        // Sync to cloud
        if (supabaseUser) {
          syncProfileToCloud(supabaseUser.id, updated.name, updated.avatar).catch(() => {})
        }
      },

      registerPasskey: async () => {
        const { currentProfile } = get()
        if (!currentProfile) return false
        try {
          const { credentialId, publicKey } = await createPasskey(currentProfile.id, currentProfile.name)
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

      logout: async () => {
        if (isSupabaseReady()) {
          await supabase.auth.signOut().catch(() => {})
        }
        set({ currentProfile: null, currentProfileId: null, supabaseUser: null, role: 'user', isAdmin: false })
      },

      setCurrentProfile: (profile) => {
        set({ currentProfile: profile, currentProfileId: profile?.id || null })
      },

      deleteProfile: async (profileId: string) => {
        await db.profiles.delete(profileId)
        await db.playerStats.delete(profileId)
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

// ─── HELPER: Add XP with cloud sync ─────────────────────────────

export async function addXpWithSync(profileId: string, xpAmount: number) {
  const stats = await db.playerStats.get(profileId)
  if (!stats) return

  stats.xp += xpAmount
  await db.playerStats.put(stats)

  // Sync to cloud
  const { supabaseUser } = useAuth.getState()
  if (supabaseUser) {
    syncStatsToCloud(supabaseUser.id, stats).catch(() => {})
    addMonthlyXp(supabaseUser.id, xpAmount).catch(() => {})
  }
}

import { create } from 'zustand'
import { useSobres, olvidarSaldoSobres } from './useSobres'
import { diaCalendarioSV } from '../services/horaSV'
import { updateMissionProgress } from '../services/missionService'
import { persist } from 'zustand/middleware'
import { db, type UserProfile } from '../services/db'
import { supabase, isSupabaseReady } from '../services/supabase'
import { syncProfileToCloud, syncStatsToCloud, pullAllFromCloud, addMonthlyXp, sumarXpEnLaNube } from '../services/sync'
import { createPasskey, authenticateWithPasskey, authenticateWithAnyPasskey } from '../services/crypto'
import { createDefaultStats, registrarVisita } from '../services/gamification'
import { getPermisos } from '../services/events'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  // Cloud auth
  supabaseUser: User | null
  isOnline: boolean
  role: 'user' | 'admin'
  isAdmin: boolean
  /**
   * Puede escribir artículos SIN ser administrador.
   *
   * Existe porque escribir en el blog exigía `role = 'admin'`, y admin en esta
   * app abre 13 tablas y 5 funciones —torneos, sedes, avisos push, y
   * `set_user_role`—. Un colaborador que escribe no necesita nada de eso.
   */
  esAutorBlog: boolean
  isRecoveryMode: boolean
  /**
   * ¿Terminó ya el primer `initAuth`?
   *
   * Sin esto, AuthGate no puede distinguir «no hay sesión» de «todavía no sé»,
   * y como decide con `currentProfile` —el único campo de sesión que
   * `partialize` NO guarda— en CADA arranque en frío las 38 rutas privadas
   * pintaban «Acceso Restringido» con botón de Iniciar Sesión hasta que
   * respondía la nube. Con datos móviles eso son segundos, y se ve idéntico a
   * haberse deslogueado. Nunca se persiste: al arrancar siempre es `false`.
   */
  authListo: boolean
  /**
   * ¿Terminó ya de averiguarse el rol? Distinto de saberlo: es `true` también
   * cuando la consulta falló.
   *
   * Existe porque el rol dejó de publicarse en el mismo `set` que el perfil
   * (antes bloqueaba la app entera esperando una consulta a la nube). Eso abrió
   * una ventana donde hay perfil pero `isAdmin` todavía es el valor persistido,
   * y AdminLayout expulsa justo con esa combinación —con `replace`, así que ni
   * el botón Atrás devuelve—. Un admin recién promovido, o cualquiera cuyo
   * aparato tenga `isAdmin:false` guardado, quedaba fuera de su propio panel.
   */
  rolListo: boolean

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
  updatePassword: (newPassword: string) => Promise<{ ok: boolean; error?: string }>
  clearRecoveryMode: () => void

  // Profile management
  updateProfile: (data: Partial<Pick<UserProfile, 'name' | 'avatar' | 'email' | 'country' | 'continent'>>) => Promise<void>
  deleteProfile: (profileId: string) => Promise<void>
}

/**
 * El `onAuthStateChange` se engancha UNA sola vez por carga de la app.
 *
 * `initAuth()` se llama desde tres sitios (AppLayout, ProfilePage y
 * AdminLayout) y el retorno de `onAuthStateChange` nunca se asignaba, así que
 * cada visita a /perfil apilaba una suscripción más. La bandera vive a nivel de
 * módulo y no en un ref de componente para que también cubra el doble montaje
 * del modo estricto de React 19.
 */
let escuchaEnganchada = false

/**
 * Último usuario para el que ya se hizo el trabajo pesado (Dexie + rol + pull).
 * Evita repetirlo cuando llegan eventos que hablan de la MISMA sesión.
 * Se limpia al cerrar sesión para que volver a entrar sí rehaga todo.
 */
let usuarioAplicado: string | null = null

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      supabaseUser: null,
      isOnline: isSupabaseReady(),
      role: 'user',
      isAdmin: false,
      esAutorBlog: false,
      isRecoveryMode: false,
      authListo: false,
      rolListo: false,
      currentProfileId: null,
      currentProfile: null,
      profiles: [],

      // ─── INIT: Listen for Supabase auth changes ───
      initAuth: async () => {
        /**
         * Deja el perfil local publicado y arranca el rol aparte.
         *
         * El rol sale de una consulta a `profiles` en la nube, y antes iba en
         * el MISMO `set` que el perfil: mientras esa consulta viajaba, la app
         * seguía mostrando el muro de «Acceso Restringido». Ahora el perfil se
         * publica apenas se tiene y el rol llega cuando llega.
         */
        const aplicarSesion = async (user: User) => {
          /**
           * Idempotente por usuario, y no por gusto.
           *
           * `onAuthStateChange` le emite INITIAL_SESSION a TODO suscriptor nuevo
           * (auth-js `_emitInitialSession`), con la misma sesión que
           * `getSession()` acaba de aplicar acá abajo. Sin este corte, cada
           * arranque en frío hacía DOS veces la consulta de rol y DOS veces
           * `pullAllFromCloud` —que se baja la colección entera paginada, más de
           * 2.000 filas—: el doble de datos móviles en cada apertura.
           */
          if (usuarioAplicado === user.id) {
            set({ supabaseUser: user })
            return
          }
          usuarioAplicado = user.id

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
          set({ supabaseUser: user, profiles, currentProfile: profile, currentProfileId: profile.id })

          void (async () => {
            const permisos = await getPermisos(user.id)
            const role = permisos?.role ?? null
            // `null` = no se pudo averiguar (red mala, RLS, timeout). En ese
            // caso NO se toca el rol: se conserva el persistido, que es el
            // último dato bueno. Pisarlo con una suposición es lo que echaba
            // del panel al organizador en medio del torneo.
            //
            // `rolListo` se marca IGUAL, con rol o sin él: significa «ya
            // terminé de averiguar», no «sé la respuesta». Quien decide
            // expulsar (AdminLayout) necesita distinguir eso de «todavía no
            // pregunté», o echa al admin en la ventana intermedia.
            if (role !== null) {
              set({
                role: role as 'user' | 'admin',
                isAdmin: role === 'admin',
                esAutorBlog: permisos?.blogAutor === true,
              })
            }
            set({ rolListo: true })
          })()

          pullAllFromCloud(user.id, profile.id).catch(() => {})
          void contarVisita(user.id, profile.id)
          void useSobres.getState().cargar(user.id)
        }

        try {
          /**
           * Hidratación local ANTES de tocar la red.
           *
           * `currentProfileId` sí se persiste; el perfil entero no. Cruzarlos
           * contra Dexie no cuesta red y quita el muro de encima en el primer
           * pintado. Es optimista a propósito: si más abajo el servidor
           * confirma que NO hay sesión, se deshace.
           *
           * Va antes del guard de `isSupabaseReady()` — si no, con las env
           * vars vacías no correría nunca.
           */
          const idGuardado = get().currentProfileId
          if (idGuardado) {
            const guardado = await db.profiles.get(idGuardado)
            if (guardado) set({ currentProfile: guardado, profiles: await db.profiles.toArray() })
          }

          if (!isSupabaseReady()) return

          /**
           * La escucha se engancha ANTES de sondear la sesión, y a propósito.
           *
           * Estaba después del `try/finally`, y ahí tenía un agujero: si
           * `getSession()` lanzaba —sin señal, por ejemplo—, el `finally`
           * marcaba `authListo` pero la excepción PROPAGA y el registro de
           * abajo nunca corría. La app quedaba sin nadie escuchando
           * `TOKEN_REFRESHED` por el resto de su vida, que es exactamente el
           * evento con el que se recupera la sesión al volver la red. O sea
           * que el caso que más necesita el arreglo era el que lo perdía.
           *
           * Enganchada primero, el sondeo puede fallar tranquilo: la sesión se
           * recupera sola cuando vuelva la señal.
           */
          if (!escuchaEnganchada) {
            escuchaEnganchada = true
            supabase.auth.onAuthStateChange(async (event, session) => {
              if (event === 'PASSWORD_RECOVERY' && session?.user) {
                set({ supabaseUser: session.user, isRecoveryMode: true })
              } else if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
                await aplicarSesion(session.user)
              } else if (event === 'TOKEN_REFRESHED' && session?.user) {
                /**
                 * El que faltaba, y el que explica el caso feo: sin señal y con
                 * el token vencido, `getSession()` devuelve null y la app se
                 * queda con el muro puesto. Cuando vuelve la señal la sesión SÍ
                 * se recupera sola, pero lo anuncia con TOKEN_REFRESHED —no con
                 * SIGNED_IN—, y la cadena de antes solo miraba tres eventos. El
                 * store nunca se enteraba y el muro no se iba hasta reiniciar.
                 *
                 * `aplicarSesion` corta solo si ya se aplicó este usuario, así
                 * que la renovación de cada hora (y la que dispara volver al
                 * frente con el token vencido) NO rebaja la colección otra vez:
                 * solo refresca el usuario. El trabajo pesado queda para
                 * cuando de verdad cambia quién está logueado.
                 */
                await aplicarSesion(session.user)
              } else if (event === 'SIGNED_OUT') {
                usuarioAplicado = null
                set({
                  supabaseUser: null, currentProfile: null, currentProfileId: null,
                  isRecoveryMode: false, rolListo: false, esAutorBlog: false,
                })
              }
            })
          }

          /**
           * Con tope de tiempo, porque el `finally` cubre las EXCEPCIONES pero
           * no los cuelgues.
           *
           * `getSession()` espera por dentro a `_recoverAndRefresh()` → un
           * `fetch` sin timeout. En un portal cautivo o con la conexión a medio
           * abrir —el wifi de la tienda donde se juega— esa promesa no resuelve
           * ni rechaza: el `finally` nunca corre, `authListo` se queda en false
           * y las 38 rutas privadas muestran el cargador para siempre. El muro
           * viejo era feo pero al menos tenía botón; el cargador no ofrece nada.
           *
           * El timeout se trata como `error`, o sea que NO deshace la
           * hidratación: se sigue con el último dato bueno y la sesión termina
           * de resolverse por TOKEN_REFRESHED cuando la red se decida.
           */
          const { data: { session }, error } = await Promise.race([
            supabase.auth.getSession(),
            new Promise<Awaited<ReturnType<typeof supabase.auth.getSession>>>(resolver =>
              setTimeout(() => resolver({
                data: { session: null },
                error: new Error('getSession no respondió a tiempo'),
              } as Awaited<ReturnType<typeof supabase.auth.getSession>>), 6000)
            ),
          ])
          if (session?.user) {
            await aplicarSesion(session.user)
          } else if (!error) {
            /**
             * El servidor respondió y NO hay sesión: se deshace la hidratación
             * optimista de arriba. Este `else if` es lo que hace que hidratar
             * sea seguro.
             *
             * Con `error` (sin señal, token vencido) NO se toca nada: ahí
             * `getSession()` devuelve null sin borrar la sesión del disco, y
             * lo hidratado es el último dato bueno que tenemos. La sesión se
             * recupera sola al volver la señal, vía TOKEN_REFRESHED.
             */
            set({ currentProfile: null, currentProfileId: null, supabaseUser: null })
          }
        } finally {
          /**
           * En `finally` y no al final del `try`: si `getSession()` revienta,
           * saltarse esto dejaría a AuthGate en un spinner eterno, que es peor
           * que el muro que vinimos a quitar.
           */
          set({ authListo: true })
        }
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

        // Check role
        // Acá venís de autenticarte recién, o sea que la red anda; si aun así
        // no se pudo leer el rol, `'user'` es el default seguro y el próximo
        // `initAuth` lo corrige.
        const permisos = await getPermisos(user.id)
        const role = (permisos?.role ?? 'user') as 'user' | 'admin'

        set({
          supabaseUser: user,
          profiles,
          currentProfile: profile,
          currentProfileId: profile.id,
          role,
          isAdmin: role === 'admin',
          esAutorBlog: permisos?.blogAutor === true,
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
          // Columnas EXPLÍCITAS, no `select('*')`.
          //
          // Con un grant por columnas (que es como hay que tapar `email`, ver
          // gotcha 2j), `select=*` pide TODAS y PostgREST responde
          // «permission denied for table profiles» — o sea que un `*` acá
          // convierte el cierre de privacidad en una caída del login. De este
          // perfil solo se usan `name` y `avatar`; el correo sale de
          // `user.email`, que lo da Auth.
          const { data: cloudProfile } = await supabase
            .from('profiles')
            .select('name, avatar')
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
        // Acá venís de autenticarte recién, o sea que la red anda; si aun así
        // no se pudo leer el rol, `'user'` es el default seguro y el próximo
        // `initAuth` lo corrige.
        const permisos = await getPermisos(user.id)
        const role = (permisos?.role ?? 'user') as 'user' | 'admin'

        set({
          supabaseUser: user,
          profiles,
          currentProfile: profile,
          currentProfileId: profile.id,
          role,
          isAdmin: role === 'admin',
          esAutorBlog: permisos?.blogAutor === true,
        })

        // Pull all data from cloud in background
        pullAllFromCloud(user.id, profile.id).catch(() => {})
        void contarVisita(user.id, profile.id)
        void useSobres.getState().cargar(user.id)

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

      // ─── UPDATE PASSWORD (after recovery link) ───
      updatePassword: async (newPassword: string) => {
        if (!isSupabaseReady()) {
          return { ok: false, error: 'Sin conexión al servidor' }
        }
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        if (error) {
          if (error.message.includes('should be different')) {
            return { ok: false, error: 'La nueva contraseña debe ser diferente a la actual' }
          }
          return { ok: false, error: error.message }
        }
        set({ isRecoveryMode: false })
        return { ok: true }
      },

      clearRecoveryMode: () => {
        set({ isRecoveryMode: false })
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
          syncProfileToCloud(
            supabaseUser.id,
            updated.name,
            updated.avatar,
            updated.country,
            updated.continent,
          ).catch(() => {})
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
          /**
           * `scope: 'local'` — sin él, `signOut()` usa `'global'` por defecto
           * (auth-js 2.99.2) y REVOCA el refresh token de todos los aparatos.
           * O sea: cerrar sesión en la compu dejaba al teléfono deslogueado sin
           * que nadie lo tocara, y ése era el único camino que producía un
           * deslogueo de verdad. Se pierde «cerrar sesión en todas partes»,
           * que la UI nunca ofreció.
           */
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        }
        // Sin esto, volver a entrar con la misma cuenta sin recargar se saltaría
        // el trabajo pesado (Dexie + rol + pull) por creerlo ya hecho.
        usuarioAplicado = null
        // El saldo de sobres no es de nadie hasta que alguien entre: sin esto,
        // la insignia seguiría mostrando los sobres de la cuenta anterior.
        olvidarSaldoSobres()
        set({ currentProfile: null, currentProfileId: null, supabaseUser: null, role: 'user', isAdmin: false, esAutorBlog: false, isRecoveryMode: false, rolListo: false })
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
      partialize: (state) => ({
        currentProfileId: state.currentProfileId,
        role: state.role,
        isAdmin: state.isAdmin,
      }),
    }
  )
)

// ─── HELPER: Add XP with cloud sync ─────────────────────────────

/**
 * Acredita XP: lo suma en el SERVIDOR y baja el total resultante al aparato.
 *
 * ── Por qué el orden es ese y no al revés ─────────────────────────────
 *
 * Esta función se llamaba `addXpWithSync`, sumaba en Dexie y subía la fila
 * ENTERA de `player_stats` con `syncStatsToCloud`. Eso es el fallo que se
 * midió en las misiones: el upsert de la fila completa pisa lo que otro
 * camino ya había escrito en la nube (§3c, dos casas para una verdad).
 * Nelson tenía 7 misiones cobradas y 2 registradas — 5 pagos perdidos, y
 * como la misión queda `claimed`, irrecuperables.
 *
 * Ahora manda `sumar_xp` (`xp = xp + n`, atómico) y lo que devuelve se
 * ESCRIBE encima de lo local. La nube es la autoridad y el aparato la copia,
 * así que dos teléfonos de la misma persona no pueden divergir.
 *
 * ── Y no tenía un solo llamador ───────────────────────────────────────
 *
 * Cero, en toda la app. Era exactamente la función que las misiones
 * necesitaban para que el número subiera en pantalla, y nunca se enchufó —
 * la misma forma que «una misión sin llamador es una tarea imposible».
 *
 * No recibe `profileId`: lo saca del store, que es lo que la vuelve
 * llamable desde un servicio (los servicios no conocen el id local de
 * Dexie, solo el de Supabase).
 *
 * Devuelve el total nuevo, o `null` si NO se pudo acreditar — quien llame
 * tiene que poder deshacer lo que hubiera marcado por adelantado.
 */
/**
 * Cuenta que hoy entraste: racha de días, y la misión «Pasar lista».
 *
 * Se llama desde los DOS sitios donde queda sesión establecida —el arranque
 * con sesión guardada y el ingreso explícito—. Es idempotente por día:
 * `registrarVisita` devuelve `null` si `lastLoginDate` ya es hoy, y
 * `updateMissionProgress` se salta la misión si ya está completada.
 *
 * Existe porque `loginDays` y `currentStreak` estaban MUERTOS: se escribían
 * una vez en `createDefaultStats` y nadie los volvía a tocar. Los 38 perfiles
 * de producción tenían `login_days = 1` y `current_streak = 0`, sin
 * excepción — o sea que tres logros (7, 30 y 100 días), tres cosméticos y el
 * número de racha que Inicio enseña llevaban muertos desde el primer día.
 *
 * Se traga sus errores: no poder contar una visita jamás puede impedir entrar.
 */
async function contarVisita(userId: string, profileId: string): Promise<void> {
  try {
    const stats = await db.playerStats.get(profileId)
    if (!stats) return

    const hoy = diaCalendarioSV(new Date())
    const nuevos = registrarVisita(stats, hoy)
    if (nuevos) {
      await db.playerStats.put(nuevos)
      syncStatsToCloud(userId, nuevos).catch(() => {})
    }

    // Va SIEMPRE, no solo cuando la racha cambió: la misión vive en
    // `user_missions` con su propia clave de día y su propia idempotencia.
    void updateMissionProgress(userId, 'dia_visitado').catch(() => {})
  } catch { /* contar la visita nunca puede romper el ingreso */ }
}

/**
 * Copia a Dexie el XP y el nivel que dijo el SERVIDOR. No suma nada.
 *
 * Hace falta porque el número que se ve en pantalla sale de Dexie: sin bajar el
 * total, el XP no se mueve hasta el próximo inicio de sesión, y eso se ve igual
 * que si el pago no hubiera ocurrido (§3m).
 *
 * Está aparte de `acreditarXp` porque hay pagos que el servidor hace SOLO, sin
 * que el cliente los pida: `abrir_sobre()` acredita 50 XP dentro de la misma
 * transacción que consume el sobre. Ese camino no necesita sumar —ya está
 * sumado— pero sí necesita el espejo.
 */
export async function espejarXpEnDexie(xp: number, nivel: number): Promise<void> {
  const { currentProfileId } = useAuth.getState()
  if (!currentProfileId) return
  const stats = await db.playerStats.get(currentProfileId)
  if (!stats) return
  stats.xp = xp
  stats.level = nivel
  await db.playerStats.put(stats)
}

export async function acreditarXp(
  cantidad: number,
  motivo?: string,
): Promise<{ xp: number; nivel: number } | null> {
  const { supabaseUser, currentProfileId } = useAuth.getState()
  if (!supabaseUser) return null

  const resultado = await sumarXpEnLaNube(cantidad, motivo)
  if (!resultado) return null

  // El aparato copia lo que dijo el servidor; no vuelve a sumar por su cuenta.
  if (currentProfileId) await espejarXpEnDexie(resultado.xp, resultado.nivel)

  // El ranking mensual va aparte y sí es un delta: mide lo GANADO este mes.
  addMonthlyXp(supabaseUser.id, cantidad).catch(() => {})

  return resultado
}

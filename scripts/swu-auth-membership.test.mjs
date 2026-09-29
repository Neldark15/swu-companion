// Ejecuta el store real con Auth/RPC/Dexie simulados; nunca usa red ni variables privadas.
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const carpeta = await mkdtemp(join(tmpdir(), 'swu-auth-membership-'))
const perfiles = new Map()
const pendientes = []
const prueba = {
  usuario: null,
  escucha: null,
  perfiles,
  pulls: [],
  permisos: [],
  sobres: [],
  rpc: [],
  memoria: new Map(),
  sondear: null,
}
globalThis.__membresiaSwuPrueba = prueba
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: key => prueba.memoria.get(key) ?? null,
  setItem: (key, value) => { prueba.memoria.set(key, value) },
  removeItem: key => { prueba.memoria.delete(key) },
} })
globalThis.window = { localStorage: globalThis.localStorage }
prueba.solicitar = (nombre, params) => ({ abortSignal: () => {
  prueba.rpc.push({ nombre, params })
  return new Promise(resolve => pendientes.push(resolve))
} })
const falsa = `
  const p = globalThis.__membresiaSwuPrueba;
  export const supabase = {
    rpc: (...args) => p.solicitar(...args),
    from: () => ({ select: () => ({ eq: (_, id) => ({ maybeSingle: async () => ({ data: { name: id, avatar: '🎯' }, error: null }) }) }) }),
    auth: {
      onAuthStateChange: fn => { p.escucha = fn },
      getSession: async () => p.sondear ? p.sondear() : ({ data: { session: p.usuario ? { user: p.usuario } : null }, error: null }),
      signInWithPassword: async () => { p.escucha?.('SIGNED_IN', { user: p.usuario }); return { data: { user: p.usuario }, error: null } },
      signOut: async () => { p.usuario = null; p.escucha?.('SIGNED_OUT', null) },
      updateUser: async () => ({ data: { user: p.usuario }, error: null }),
    },
  };
  export const isSupabaseReady = () => true;
  export const db = {
    profiles: { get: async id => p.perfiles.get(id), put: async item => p.perfiles.set(item.id, item), toArray: async () => [...p.perfiles.values()] },
    playerStats: { get: async () => undefined },
  };
  export const getPermisos = async id => { p.permisos.push(id); return { role: 'user', blogAutor: false } };
  export const pullAllFromCloud = async id => { p.pulls.push(id) };
  export const useSobres = { getState: () => ({ cargar: async id => { p.sobres.push(id) } }) };
  export const olvidarSaldoSobres = () => {};
  export const diaCalendarioSV = () => '';
  export const updateMissionProgress = async () => {};
  export const syncProfileToCloud = async () => {};
  export const syncStatsToCloud = async () => {};
  export const addMonthlyXp = async () => {};
  export const sumarXpEnLaNube = async () => {};
  export const createPasskey = async () => {};
  export const authenticateWithPasskey = async () => false;
  export const authenticateWithAnyPasskey = async () => false;
  export const createDefaultStats = () => ({});
  export const registrarVisita = () => null;
`
const avanzar = () => new Promise(resolve => setTimeout(resolve, 0))
const esperarRpc = async cantidad => {
  for (let i = 0; i < 30 && prueba.rpc.length < cantidad; i++) await avanzar()
  assert.equal(prueba.rpc.length, cantidad)
}
const usuario = id => ({ id, email: `${id}@example.test`, user_metadata: { origin_app: 'memento', name: id } })

try {
  const salida = join(carpeta, 'auth.mjs')
  await build({
    entryPoints: ['src/hooks/useAuth.ts'], outfile: salida, bundle: true, platform: 'node', format: 'esm',
    plugins: [{ name: 'solo-dobles-locales', setup(builder) {
      builder.onResolve({ filter: /^\.\.?\// }, args => {
        if (args.importer.endsWith('/src/hooks/useAuth.ts') && !args.path.endsWith('/swuMembership')) {
          return { path: 'servicios-falsos', namespace: 'prueba' }
        }
      })
      builder.onLoad({ filter: /.*/, namespace: 'prueba' }, () => ({ contents: falsa, loader: 'js' }))
    } }],
  })
  const { useAuth } = await import(pathToFileURL(salida).href)
  prueba.usuario = usuario('a')
  const uno = useAuth.getState().initAuth()
  const dos = useAuth.getState().initAuth()
  await esperarRpc(1)
  assert.equal(useAuth.getState().currentProfile, null)
  assert.deepEqual(prueba.pulls, [])
  assert.deepEqual(prueba.permisos, [])
  pendientes.shift()({ error: null })
  await Promise.all([uno, dos])
  assert.equal(useAuth.getState().currentProfile.id, 'a')
  assert.deepEqual(prueba.pulls, ['a'])
  prueba.escucha('TOKEN_REFRESHED', { user: prueba.usuario })
  await avanzar()
  assert.equal(prueba.rpc.length, 1)
  assert.deepEqual(prueba.pulls, ['a'])

  prueba.usuario = usuario('b')
  const salidaPendiente = useAuth.getState().initAuth()
  await esperarRpc(2)
  await useAuth.getState().logout()
  pendientes.shift()({ error: null })
  await salidaPendiente
  assert.equal(useAuth.getState().currentProfile, null, 'una respuesta tardía no restaura sesión cerrada')
  assert.equal(useAuth.getState().supabaseUser, null)
  assert.equal(useAuth.getState().isAdmin, false)
  assert.deepEqual(prueba.pulls, ['a'])

  prueba.usuario = usuario('c')
  const login = useAuth.getState().login('c@example.test', 'no-real')
  await esperarRpc(3)
  pendientes.shift()({ error: { message: 'denegado' } })
  assert.equal((await login).ok, false)
  assert.ok(useAuth.getState().errorMembresia)
  assert.equal(useAuth.getState().currentProfile, null)
  assert.deepEqual(prueba.permisos, ['a'])
  const reintento = useAuth.getState().initAuth()
  await esperarRpc(4)
  pendientes.shift()({ error: null })
  await reintento
  assert.equal(useAuth.getState().currentProfile.id, 'c')
  assert.equal(useAuth.getState().errorMembresia, null)
  assert.deepEqual(prueba.pulls, ['a', 'c'])

  const cache = { id: 'd', name: 'Perfil guardado', avatar: '🎯', email: '', createdAt: 0 }
  perfiles.set('d', cache)
  useAuth.setState({ currentProfile: cache, currentProfileId: 'd', role: 'admin', isAdmin: true, authListo: false })
  prueba.usuario = usuario('d')
  const offline = useAuth.getState().initAuth()
  await esperarRpc(5)
  assert.equal(useAuth.getState().authListo, true, 'la copia existente se puede usar mientras responde la RPC')
  assert.equal(useAuth.getState().supabaseUser, null, 'no se publica una cuenta cloud anterior al abrir la caché')
  pendientes.shift()({ error: { message: 'sin red' } })
  await offline
  assert.equal(useAuth.getState().currentProfile.id, 'd', 'se conserva la copia existente de la misma cuenta')
  assert.equal(useAuth.getState().isAdmin, true, 'no se inventa ni se borra el último rol de la misma cuenta')
  assert.equal(useAuth.getState().supabaseUser, null)

  prueba.usuario = usuario('e')
  const nueva = useAuth.getState().initAuth()
  await esperarRpc(6)
  assert.equal(useAuth.getState().currentProfile, null)
  assert.equal(useAuth.getState().isAdmin, false, 'la cuenta nueva jamás hereda el rol del usuario anterior')
  pendientes.shift()({ error: { message: 'sin red' } })
  await nueva
  assert.deepEqual(prueba.pulls, ['a', 'c'])
  assert.deepEqual(prueba.sobres, ['a', 'c'])

  // Un sondeo iniciado antes de salir no puede reabrir su cuenta antigua.
  let resolverSondeo
  prueba.sondear = () => new Promise(resolve => { resolverSondeo = resolve })
  const sondeoViejo = useAuth.getState().initAuth()
  await avanzar()
  await useAuth.getState().logout()
  resolverSondeo({ data: { session: { user: usuario('a') } }, error: null })
  await sondeoViejo
  assert.equal(useAuth.getState().currentProfile, null)
  assert.equal(useAuth.getState().supabaseUser, null)
  assert.equal(prueba.rpc.length, 6)

  // Un SIGNED_IN más reciente gana a getSession aunque la consulta vieja termine después.
  const sondeoOtraCuenta = useAuth.getState().initAuth()
  await avanzar()
  prueba.usuario = usuario('f')
  prueba.escucha('SIGNED_IN', { user: prueba.usuario })
  resolverSondeo({ data: { session: { user: usuario('a') } }, error: null })
  await esperarRpc(7)
  pendientes.shift()({ error: null })
  await sondeoOtraCuenta
  assert.equal(useAuth.getState().currentProfile.id, 'f')
  assert.equal(useAuth.getState().supabaseUser.id, 'f')
  assert.deepEqual(prueba.pulls, ['a', 'c', 'f'])
  prueba.sondear = null

  prueba.usuario = usuario('g')
  const cuentaAnterior = useAuth.getState().initAuth()
  await esperarRpc(8)
  prueba.usuario = usuario('h')
  prueba.escucha('SIGNED_IN', { user: prueba.usuario })
  pendientes.shift()({ error: null })
  await cuentaAnterior
  assert.equal(useAuth.getState().currentProfile, null, 'el evento nuevo invalida el alta antigua antes del callback diferido')
  assert.deepEqual(prueba.pulls, ['a', 'c', 'f'])
  await esperarRpc(9)
  pendientes.shift()({ error: null })
  await avanzar()
  assert.equal(useAuth.getState().currentProfile.id, 'h')

  // Recuperación es otra identidad Auth y también invalida el sondeo anterior.
  prueba.sondear = () => new Promise(resolve => { resolverSondeo = resolve })
  const antesRecuperacion = useAuth.getState().initAuth()
  await avanzar()
  prueba.usuario = usuario('i')
  prueba.escucha('PASSWORD_RECOVERY', { user: prueba.usuario })
  resolverSondeo({ data: { session: { user: usuario('h') } }, error: null })
  await antesRecuperacion
  assert.equal(useAuth.getState().currentProfile, null)
  assert.equal(useAuth.getState().supabaseUser.id, 'i')
  assert.equal(useAuth.getState().isRecoveryMode, true)
  assert.equal(useAuth.getState().preparandoMembresia, false)
  prueba.sondear = null
  assert.equal((await useAuth.getState().updatePassword('no-real')).ok, true)
  await esperarRpc(10)
  pendientes.shift()({ error: null })
  await avanzar()
  assert.equal(useAuth.getState().currentProfile.id, 'i')

  // La cuenta nativa SWU no necesita ni siquiera una RPC que responda.
  prueba.usuario = { ...usuario('historica'), user_metadata: { name: 'Histórica' } }
  await useAuth.getState().initAuth()
  assert.equal(prueba.rpc.length, 10)
  assert.equal(useAuth.getState().currentProfile.id, 'historica')
  assert.equal(useAuth.getState().errorMembresia, null)
  console.log('Auth SWU: gate real, concurrencia, logout tardío, login fallido/reintento y caché aislada verificados.')
} finally {
  await rm(carpeta, { recursive: true, force: true })
  delete globalThis.__membresiaSwuPrueba
  delete globalThis.localStorage
  delete globalThis.window
}

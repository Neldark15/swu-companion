/**
 * Prueba de la guarda de repetidos de notificationService.
 *
 * No hay corredor de pruebas en este repo (ni vitest ni jest), así que esto es
 * un programa: se ejecuta y o pasa en silencio o lanza. Mismo formato que
 * features/mesa/reproductor.test.ts.
 *
 *   npx tsx src/services/notificaciones.test.ts
 *
 * Cubre lo que el arreglo promete y lo que NO debe romper:
 *   1. misma clave dos veces  → un solo aviso
 *   2. SIN clave dos veces    → dos avisos (los acuses de acción se repiten)
 *   3. claves distintas       → dos avisos
 *   4. clave podada (50 / 7 días) → vuelve a sonar (decisión escrita en el código)
 *   5. los helpers siguen deduplicando después de sacarles la consulta
 */

// El store usa `persist` con localStorage; en Node no existe.
const _mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => _mem.get(k) ?? null,
  setItem: (k: string, v: string) => { _mem.set(k, v) },
  removeItem: (k: string) => { _mem.delete(k) },
  clear: () => { _mem.clear() },
  key: (i: number) => Array.from(_mem.keys())[i] ?? null,
  get length() { return _mem.size },
} as Storage

function afirmar(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FALLÓ: ${msg}`)
  console.log(`  ok — ${msg}`)
}

const { useNotificationStore, notifyLevelUp, notifyTierUp } = await import('./notificationService')

const store = () => useNotificationStore.getState()
const limpiar = () => useNotificationStore.setState({ notifications: [], unreadCount: 0, currentToast: null })

// 1. misma clave → un solo aviso
limpiar()
store().addNotification({ type: 'info', title: 'A', message: 'a', dedupKey: 'k:1' })
store().addNotification({ type: 'info', title: 'A', message: 'a', dedupKey: 'k:1' })
afirmar(store().notifications.length === 1, 'misma dedupKey dos veces deja UN aviso')
afirmar(store().unreadCount === 1, 'el suprimido tampoco sube unreadCount')

// 2. sin clave → se repite (acuse de acción propia)
limpiar()
store().addNotification({ type: 'info', title: 'Resultado enviado', message: 'x' })
store().addNotification({ type: 'info', title: 'Resultado enviado', message: 'x' })
afirmar(store().notifications.length === 2, 'sin dedupKey NUNCA se suprime, aunque el texto sea idéntico')

// 3. claves distintas
limpiar()
store().addNotification({ type: 'info', title: 'A', message: 'a', dedupKey: 'k:1' })
store().addNotification({ type: 'info', title: 'A', message: 'a', dedupKey: 'k:2' })
afirmar(store().notifications.length === 2, 'claves distintas no se estorban')

// 4. clave fuera de la ventana → vuelve a sonar
limpiar()
store().addNotification({ type: 'info', title: 'Tier', message: 't', dedupKey: 'tier:Progreso:kyber' })
useNotificationStore.setState({
  notifications: store().notifications.map(n => ({ ...n, timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000 })),
})
store().clearOld()
afirmar(store().notifications.length === 0, 'clearOld poda a los 7 días')
store().addNotification({ type: 'info', title: 'Tier', message: 't', dedupKey: 'tier:Progreso:kyber' })
afirmar(store().notifications.length === 1, 'un hito RE-GANADO vuelve a sonar tras la poda (decidido, no accidental)')

limpiar()
for (let i = 0; i < 50; i++) store().addNotification({ type: 'info', title: `n${i}`, message: '', dedupKey: `k:${i}` })
afirmar(store().notifications.length === 50, 'tope de 50')
store().addNotification({ type: 'info', title: 'nuevo', message: '', dedupKey: 'k:nuevo' })
afirmar(!store().notifications.some(n => n.dedupKey === 'k:0'), 'la más vieja se cayó del array')
store().addNotification({ type: 'info', title: 'n0 otra vez', message: '', dedupKey: 'k:0' })
afirmar(store().notifications[0].dedupKey === 'k:0', 'una clave desalojada por el tope vuelve a pasar')

// 5. los helpers siguen deduplicando sin consultar ellos la guarda
limpiar()
notifyLevelUp(7, 'Maestro Jedi')
notifyLevelUp(7, 'Maestro Jedi')
afirmar(store().notifications.length === 1, 'notifyLevelUp sigue deduplicando por lvl:7')
notifyTierUp('Vigilancia', 'silver')
notifyTierUp('Vigilancia', 'silver')
afirmar(store().notifications.length === 2, 'notifyTierUp sigue deduplicando por tier:Vigilancia:silver')

console.log('\nTodo bien.')

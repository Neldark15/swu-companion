/**
 * La racha de días conectados, probada simulando el calendario.
 *
 *   npx tsx scripts/racha-visitas.test.mts
 *
 * Existe porque el primer intento tenía un desfase de UN día —«ayer» se
 * calculaba pasando la clave `YYYY-MM-DD` por un conversor de zona, y una
 * medianoche UTC en El Salvador todavía es el día anterior—, así que la racha
 * nunca pasaba de 1. Leyendo el código no se ve; simulando 30 días sí.
 */
import { registrarVisita } from '../src/services/gamification'
import type { PlayerStats } from '../src/services/gamification'

const base = (over: Partial<PlayerStats>): PlayerStats =>
  ({ loginDays: 1, currentStreak: 0, bestStreak: 0, lastLoginDate: '2026-08-20', ...over } as PlayerStats)

let fallos = 0
const ok = (nombre: string, cond: boolean, extra = '') => {
  if (!cond) { fallos++; console.log(`  FALLO  ${nombre} ${extra}`) } else console.log(`  ok     ${nombre} ${extra}`)
}

// 1. La MISMA persona de produccion: login_days 1, racha 0
let s = base({ lastLoginDate: '2026-06-01' })
let r = registrarVisita(s, '2026-08-23')!
ok('perfil de produccion arranca racha en 1', r.currentStreak === 1 && r.loginDays === 2, `racha=${r.currentStreak} dias=${r.loginDays}`)

// 2. Dos veces el mismo dia no cuenta dos veces
ok('segunda visita del mismo dia = null', registrarVisita(r, '2026-08-23') === null)

// 3. Dias seguidos: la racha sube
s = base({ lastLoginDate: '2026-08-19', currentStreak: 3, bestStreak: 5, loginDays: 10 })
r = registrarVisita(s, '2026-08-20')!
ok('dia seguido suma racha', r.currentStreak === 4 && r.loginDays === 11, `racha=${r.currentStreak}`)
ok('mejor racha se conserva si es mayor', r.bestStreak === 5, `mejor=${r.bestStreak}`)

// 4. Se rompe la racha
s = base({ lastLoginDate: '2026-08-15', currentStreak: 9, bestStreak: 9 })
r = registrarVisita(s, '2026-08-20')!
ok('hueco reinicia a 1', r.currentStreak === 1, `racha=${r.currentStreak}`)
ok('pero la mejor NO se pierde', r.bestStreak === 9, `mejor=${r.bestStreak}`)

// 5. CAMBIO DE MES (lo que rompia restando ms)
s = base({ lastLoginDate: '2026-08-31', currentStreak: 6, bestStreak: 6 })
r = registrarVisita(s, '2026-09-01')!
ok('31 ago -> 1 sep mantiene la racha', r.currentStreak === 7, `racha=${r.currentStreak}`)

// 6. CAMBIO DE AÑO
s = base({ lastLoginDate: '2026-12-31', currentStreak: 12, bestStreak: 12 })
r = registrarVisita(s, '2027-01-01')!
ok('31 dic -> 1 ene mantiene la racha', r.currentStreak === 13, `racha=${r.currentStreak}`)

// 7. AÑO BISIESTO
s = base({ lastLoginDate: '2028-02-28', currentStreak: 2, bestStreak: 2 })
r = registrarVisita(s, '2028-02-29')!
ok('28 feb -> 29 feb bisiesto', r.currentStreak === 3, `racha=${r.currentStreak}`)
s = base({ lastLoginDate: '2028-02-29', currentStreak: 3, bestStreak: 3 })
r = registrarVisita(s, '2028-03-01')!
ok('29 feb -> 1 mar bisiesto', r.currentStreak === 4, `racha=${r.currentStreak}`)

// 8. 30 dias seguidos llegan al logro vig_7
s = base({ lastLoginDate: '2026-08-01', currentStreak: 0, bestStreak: 0, loginDays: 1 })
let cur = s
for (let d = 2; d <= 31; d++) {
  const hoy = `2026-08-${String(d).padStart(2,'0')}`
  cur = registrarVisita(cur, hoy) ?? cur
}
ok('30 dias seguidos: logro de 30 alcanzable', cur.loginDays >= 30 && cur.currentStreak === 30, `dias=${cur.loginDays} racha=${cur.currentStreak}`)

// 9. Nunca deja la racha en 0
s = base({ lastLoginDate: '2020-01-01', currentStreak: 0, bestStreak: 0 })
r = registrarVisita(s, '2026-08-23')!
ok('nunca queda en 0', r.currentStreak >= 1, `racha=${r.currentStreak}`)

console.log(fallos === 0 ? `\n${'='.repeat(40)}\nTODAS PASAN` : `\n${fallos} FALLOS`)
process.exit(fallos ? 1 : 0)

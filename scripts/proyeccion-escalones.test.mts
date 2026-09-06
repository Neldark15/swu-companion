/**
 * Las cuentas de la pantalla de proyección.
 *
 * Esta pantalla se enciende delante de 40 personas y nadie la puede tocar. No
 * hay forma de probarla «usándola»: cuando falla, falla en una pared, en vivo,
 * y con el torneo encima. Lo único que se puede verificar de antemano son las
 * cuentas, así que se verifican todas.
 *
 *   npx tsx scripts/proyeccion-escalones.test.mts
 */

import {
  ESCALONES, TOPE_SIN_PAGINAR, escalonPara, capacidad,
  nombreCorto, inicial, repartirEnColumnas, clavePersona,
  puestoDenso, ordenFinal,
} from '../src/features/events/proyeccion/escalones.ts'

let fallos = 0
function ok(cond: boolean, que: string, detalle = '') {
  if (cond) { console.log(`  ✓ ${que}`); return }
  fallos++
  console.log(`  ✗ ${que}${detalle ? ' — ' + detalle : ''}`)
}

// ── El piso legible ────────────────────────────────────────────────────
// La regla madre: PRIMERO el piso, después cuántos caben. Si algún escalón
// baja de 42 px, el diseño dejó de cumplir su única promesa.
console.log('\nPiso de legibilidad')
for (const e of ESCALONES) {
  ok(e.nombrePx >= 42, `escalón desde ${e.desde}: nombre a ${e.nombrePx}px ≥ 42`)
}
ok(Math.min(...ESCALONES.map(e => e.chapaPx)) >= 40, 'ninguna chapa baja de 40px')

// ── La capacidad declarada ─────────────────────────────────────────────
// El encargo dice «8 a 40 jugadores». Si el último escalón no llega a 40, la
// pantalla pagina dentro del rango normal y rompe su premisa de no rotar.
console.log('\nCapacidad')
const ultimo = ESCALONES[ESCALONES.length - 1]
ok(capacidad(ultimo) >= 40, `el último escalón aguanta ${capacidad(ultimo)} ≥ 40`)
ok(capacidad(ultimo) === TOPE_SIN_PAGINAR, 'el tope declarado coincide con la capacidad real')
for (let n = 1; n <= TOPE_SIN_PAGINAR; n++) {
  const e = escalonPara(n)
  if (capacidad(e) < n) { ok(false, `con ${n} personas el escalón elegido solo aguanta ${capacidad(e)}`); break }
  if (n === TOPE_SIN_PAGINAR) ok(true, `de 1 a ${TOPE_SIN_PAGINAR} nadie queda afuera`)
}

// Los escalones tienen que estar ordenados o el selector devuelve cualquier cosa.
console.log('\nOrden de la tabla')
ok(ESCALONES.every((e, i) => i === 0 || e.desde > ESCALONES[i - 1].desde),
   'los umbrales suben de forma estricta')
ok(ESCALONES[0].desde === 0, 'el primer escalón arranca en 0 (siempre hay uno elegible)')

// ── La tele chica ──────────────────────────────────────────────────────
// En una de 43" el pixel mide menos, asi que hace falta letra MAS GRANDE. La
// primera version lo tenia al reves y elegia la disposicion mas apretada justo
// donde menos se podia — leyendo el codigo no se ve, comparando si.
console.log('\nTele chica')
/* La propiedad que se mide es la DENSIDAD, no el cuerpo de la letra: la tabla
   NO es monotona en px —el escalon de 37-44 usa 44 px, mas que los 42 de los
   dos anteriores, porque en modo lleno se apaga la franja y sobra alto—. Lo
   que de verdad tiene que cumplirse es que la tele chica nunca quede MAS
   apretada que la grande. */
{
  let nuncaMasDenso = true
  let algunaVezMasSuelto = false
  for (let n = 8; n <= 44; n++) {
    const normal = escalonPara(n, false)
    const chica = escalonPara(n, true)
    if (capacidad(chica) > capacidad(normal)) nuncaMasDenso = false
    if (capacidad(chica) < capacidad(normal)) algunaVezMasSuelto = true
    if (chica.cols > normal.cols) nuncaMasDenso = false
  }
  ok(nuncaMasDenso, 'en tele chica la disposicion nunca queda MAS apretada')
  ok(algunaVezMasSuelto, 'y en la mayoria de las salas queda de verdad mas suelta')
  ok(escalonPara(27, true).nombrePx > escalonPara(27, false).nombrePx,
     `con 27 personas la tele chica agranda la letra (${escalonPara(27, true).nombrePx} vs ${escalonPara(27, false).nombrePx} px)`)
}

// ── Nombres ────────────────────────────────────────────────────────────
console.log('\nNombres')
ok(nombreCorto('Nelson', 14) === 'Nelson', 'un nombre corto pasa tal cual')
ok(nombreCorto('Nelson Martínez Portillo', 12) === 'Nelson M.',
   'un nombre largo se abrevia por apellido', nombreCorto('Nelson Martínez Portillo', 12))
ok(!nombreCorto('Nelson Martínez', 12).includes('…'),
   'no se recorta con puntos si se puede abreviar')

// El caso que importa: dos personas que abrevian igual.
const usados = new Set<string>()
const a = nombreCorto('Nelson Martínez', 12, usados)
const b = nombreCorto('Nelson Meléndez', 12, usados)
ok(a !== b, `dos homónimos no colapsan en el mismo texto («${a}» vs «${b}»)`)
// Y no basta con que difieran: el segundo NO puede quedar como el nombre de
// pila pelado, que a cuatro metros se lee como una persona distinta.
ok(b !== 'Nelson', `el segundo conserva apellido («${b}»), no cae a «Nelson»`)
ok(a.includes('M') && b.includes('M'), 'los dos siguen mostrando su apellido')

// Un solo nombre larguísimo sin apellido: no queda otra que recortar, pero
// nunca puede devolver algo más largo que el máximo.
const largo = nombreCorto('Supercalifragilistico', 12)
ok(largo.length <= 12, `un nombre sin apellido se recorta a ${largo.length} ≤ 12 («${largo}»)`)
ok(nombreCorto('', 12) === '—', 'un nombre vacío da «—» y no una fila en blanco')
ok(nombreCorto('   ', 12) === '—', 'un nombre de puros espacios también')

// ── Agrupación alfabética ──────────────────────────────────────────────
console.log('\nAgrupación')
ok(inicial('Ávila') === 'A', 'las tildes agrupan con su letra base')
/* La Ñ se agrupa bajo N a propósito, y NO en «#». Quien se llama Ñoño busca
   su nombre en la N; «#» es el único sitio donde no va a mirar. La regla real
   no es «solo A-Z», es «que se encuentre». */
ok(inicial('ñoño') === 'N', 'la ñ se agrupa bajo N, que es donde la gente la busca')
ok(inicial('3PO') === '#', 'lo que empieza con número cae en «#»')
ok(inicial('') === '#', 'un nombre vacío no revienta')

// ── El reparto en columnas ─────────────────────────────────────────────
// Esta es la cuenta de la que depende que la cabecera «A – F» sea verdad.
console.log('\nReparto en columnas')
const gente = (ns: string[]) => ns.map(n => ({ player_name: n }))

{
  const cols = repartirEnColumnas(
    gente(['Ana', 'Beto', 'Carlos', 'Dario', 'Elena', 'Fito', 'Gaby', 'Hugo', 'Isura']),
    3, 3)
  ok(cols.length <= 3, `no se pasa de 3 columnas (dio ${cols.length})`)
  const total = cols.reduce((s, c) => s + c.gente.length, 0)
  ok(total === 9, `no se pierde ni se duplica nadie (${total} de 9)`)
}

{
  // Un grupo de letra que NO cabe en una columna: se parte, y las dos
  // cabeceras muestran la misma letra para que se note.
  const muchosM = gente(Array.from({ length: 8 }, (_, i) => `Mario ${i}`))
  const cols = repartirEnColumnas(muchosM, 3, 5)
  const partidas = cols.filter(c => c.rango === 'M')
  ok(partidas.length >= 2, 'un grupo que no cabe se parte y ambas cabeceras dicen «M»')
  ok(cols.reduce((s, c) => s + c.gente.length, 0) === 8, 'sin perder a nadie al partir')
}

{
  // LA propiedad que sostiene el diseño: si una cabecera dice un RANGO
  // («A – F»), ninguna letra de ese rango puede estar en otra columna.
  const nombres = ['Ana','Aldo','Beto','Bruno','Carlos','Dario','Elena','Fito',
                   'Gaby','Hugo','Isura','Jaime','Karla','Luis','Mario','Nora']
  const cols = repartirEnColumnas(gente(nombres), 3, 7)
  let honesto = true
  for (const c of cols) {
    if (!c.rango.includes('–')) continue        // una sola letra: nada que probar
    for (const otra of cols) {
      if (otra === c) continue
      const letrasDeC = new Set(c.gente.map(p => inicial(p.player_name)))
      if (otra.gente.some(p => letrasDeC.has(inicial(p.player_name)))) honesto = false
    }
  }
  ok(honesto, 'una cabecera de rango no miente: sus letras no aparecen en otra columna')
}

{
  const vacio = repartirEnColumnas(gente([]), 3, 7)
  ok(vacio.length === 0, 'cero personas da cero columnas y no una columna vacía')
}

// ── El cruce entre tablas ──────────────────────────────────────────────
console.log('\nCruce de personas')
ok(clavePersona(null, 'Winnie') === clavePersona(null, '  winnie  '),
   'un invitado se cruza por nombre normalizado')
ok(clavePersona(null, 'Winnie') !== clavePersona(null, 'Dario'),
   'dos invitados distintos NO colapsan en la misma llave')
ok(clavePersona('uuid-1', 'Winnie') !== clavePersona('uuid-2', 'Winnie'),
   'dos cuentas distintas con el mismo nombre no colapsan')

// ── Puestos ────────────────────────────────────────────────────────────
console.log('\nPuestos')
const std = (id: string, pts: number, puesto: number | null = null) => ({
  id, event_id: 'e', user_id: null, player_name: id, points: pts,
  match_wins: 0, match_losses: 0, match_draws: 0, game_wins: 0, game_losses: 0,
  byes: 0, omw_pct: 0, gw_pct: 0, dropped: false, seed: null, puesto,
})

{
  // En mesas omw y gw son 0 para todos: el empate DEBE compartir ordinal en
  // vez de decidirse por el orden del array.
  const p = puestoDenso([std('a', 9), std('b', 9), std('c', 6)], false)
  ok(p.get('a') === 1 && p.get('b') === 1, 'dos empatados comparten el 1º')
  ok(p.get('c') === 2, 'el siguiente es 2º, no 3º (ranking denso)')
}

{
  const orden = ordenFinal([std('sin', 30, null), std('cuarto', 0, 4), std('primero', 1, 1)])
  ok(orden[0].id === 'primero' && orden[1].id === 'cuarto',
     'el puesto fijado manda sobre los puntos')
  ok(orden[2].id === 'sin', 'quien no tiene puesto fijado va al final aunque tenga más puntos')
}

console.log(fallos === 0
  ? '\n✅ las cuentas de la proyección cierran\n'
  : `\n❌ ${fallos} cuenta(s) que no cierran\n`)
process.exit(fallos === 0 ? 0 : 1)

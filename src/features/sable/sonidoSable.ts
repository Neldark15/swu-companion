/**
 * EL SONIDO DEL SABLE — sintetizado, sin un solo archivo de audio.
 *
 * Mismo criterio que `features/sobres/sonido.ts`: todo son osciladores y ruido
 * de la Web Audio API. Cero bytes que descargar, cero licencias que revisar, y
 * funciona sin conexión — que importa en una PWA que se abre en la mesa de juego.
 *
 * ── El zumbido es lo que hace que sea un sable ─────────────────────────
 *
 * Un sable de luz no suena a «tono»: suena a **batido**. Son dos ondas de
 * sierra desafinadas entre sí unos pocos hercios, y ese desajuste produce el
 * pulso característico. Con un solo oscilador se oye un zumbador de puerta.
 *
 * Encima va un armónico agudo muy bajo de volumen (el «filo») y un LFO lento
 * que mueve el volumen: es lo que hace que el sable parezca vivo en vez de
 * sostenido.
 *
 * ── El encendido es un BARRIDO, no un golpe ───────────────────────────
 *
 * Sube la frecuencia de golpe y se abre un filtro de ruido: el «snap-hiss». Y el
 * apagado es el mismo barrido al revés, más corto — apagar cuesta menos que
 * encender.
 *
 * ── La regla del gesto, y por qué acá SÍ hay que cuidarla ─────────────
 *
 * El navegador no deja sonar nada hasta que la persona toca algo, y el contexto
 * se crea perezoso en el primer sonido. En Sobredosis todo sonido venía de un
 * toque; acá el zumbido arranca cuando la pantalla entra al paso «Prueba», que
 * TAMBIÉN es un toque — pero si algún día se enciende solo al cargar, el
 * navegador lo va a bloquear y el contexto va a quedar en `suspended`. Por eso
 * `arrancarZumbido` intenta `resume()` antes de nada.
 *
 * ── Y se apaga SIEMPRE al desmontar ───────────────────────────────────
 *
 * Un zumbido que sigue sonando después de salir de la pantalla es el peor error
 * posible de este archivo: no hay botón que lo calle y la persona no sabe de
 * dónde sale. `pararZumbido()` va en la limpieza del efecto, sin excepción.
 */

const CLAVE = 'swu.sable.silencio'

let ctx: AudioContext | null = null

/**
 * El silencio es propio y NO comparte llave con Sobredosis.
 *
 * Compartir una sola preferencia para toda la app sería mejor, pero la llave de
 * Sobredosis ya tiene gente con su elección guardada y reusarla significaría
 * que silenciar el sable silencia los sobres sin avisar. Dos llaves, dos
 * decisiones.
 */
let silencio = (() => {
  try { return localStorage.getItem(CLAVE) === '1' } catch { return false }
})()

export function sableEnSilencio(): boolean { return silencio }

export function alternarSilencioSable(): boolean {
  silencio = !silencio
  try { localStorage.setItem(CLAVE, silencio ? '1' : '0') } catch { /* incógnito */ }
  if (silencio) pararZumbido()
  return silencio
}

function audio(): AudioContext | null {
  if (silencio) return null
  try {
    // @ts-expect-error — webkitAudioContext sigue vivo en Safari viejo.
    const AC: typeof AudioContext = window.AudioContext ?? window.webkitAudioContext
    if (!AC) return null
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** Ruido blanco de un segundo, reusado por todos los siseos. */
let bufferRuido: AudioBuffer | null = null
function ruido(c: AudioContext): AudioBuffer {
  if (bufferRuido) return bufferRuido
  const largo = c.sampleRate
  const b = c.createBuffer(1, largo, c.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < largo; i++) d[i] = Math.random() * 2 - 1
  bufferRuido = b
  return b
}

/* ── El zumbido continuo ──────────────────────────────────────────── */

interface Zumbido {
  osc: OscillatorNode[]
  lfo: OscillatorNode
  gan: GainNode
}
let zumbido: Zumbido | null = null

/**
 * Arranca el zumbido. Idempotente: llamarla dos veces no apila dos sables.
 * `tono` mueve la nota — un cristal distinto puede sonar distinto.
 */
export function arrancarZumbido(tono = 1): void {
  const c = audio()
  if (!c) return
  if (zumbido) { afinarZumbido(tono); return }

  const gan = c.createGain()
  gan.gain.value = 0
  gan.connect(c.destination)

  // Dos sierras DESAFINADAS: el batido entre las dos es el sable. Con una sola
  // suena a zumbador de puerta.
  const base = 88 * tono
  const osc = [base, base * 1.006, base * 2.01].map((f, i) => {
    const o = c.createOscillator()
    o.type = i === 2 ? 'triangle' : 'sawtooth'
    o.frequency.value = f
    const g = c.createGain()
    // El armónico agudo va muy bajo: es el filo, no la voz.
    g.gain.value = i === 2 ? 0.12 : 0.5
    o.connect(g); g.connect(gan)
    o.start()
    return o
  })

  // Un LFO lento sobre el volumen: es lo que lo hace parecer vivo.
  const lfo = c.createOscillator()
  lfo.frequency.value = 5.5
  const lfoGan = c.createGain()
  lfoGan.gain.value = 0.022
  lfo.connect(lfoGan); lfoGan.connect(gan.gain)
  lfo.start()

  gan.gain.linearRampToValueAtTime(0.055, c.currentTime + 0.35)
  zumbido = { osc, lfo, gan }
}

export function afinarZumbido(tono: number): void {
  const c = ctx
  if (!c || !zumbido) return
  const base = 88 * tono
  const fs = [base, base * 1.006, base * 2.01]
  zumbido.osc.forEach((o, i) => {
    o.frequency.linearRampToValueAtTime(fs[i], c.currentTime + 0.18)
  })
}

/** Para el zumbido con un desvanecido corto. Segura de llamar siempre. */
export function pararZumbido(): void {
  const c = ctx
  const z = zumbido
  if (!c || !z) { zumbido = null; return }
  zumbido = null
  const fin = c.currentTime + 0.22
  z.gan.gain.cancelScheduledValues(c.currentTime)
  z.gan.gain.setValueAtTime(z.gan.gain.value, c.currentTime)
  z.gan.gain.linearRampToValueAtTime(0, fin)
  for (const o of z.osc) o.stop(fin + 0.02)
  z.lfo.stop(fin + 0.02)
}

/* ── Encender y apagar ────────────────────────────────────────────── */

function barrido(desde: number, hasta: number, dur: number, vol: number): void {
  const c = audio()
  if (!c) return
  const t = c.currentTime

  const o = c.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(desde, t)
  o.frequency.exponentialRampToValueAtTime(hasta, t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur)
  o.connect(g); g.connect(c.destination)
  o.start(t); o.stop(t + dur + 0.02)

  // El siseo: ruido por un pasa-banda que se abre con el barrido. Es la mitad
  // del «snap-hiss»; sin él el encendido suena a videojuego de los 80.
  const s = c.createBufferSource()
  s.buffer = ruido(c)
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = 0.9
  f.frequency.setValueAtTime(desde * 4, t)
  f.frequency.exponentialRampToValueAtTime(Math.max(200, hasta * 3), t + dur)
  const gs = c.createGain()
  gs.gain.setValueAtTime(vol * 0.5, t)
  gs.gain.exponentialRampToValueAtTime(0.0008, t + dur)
  s.connect(f); f.connect(gs); gs.connect(c.destination)
  s.start(t); s.stop(t + dur + 0.02)
}

export function sonarEncendido(): void { barrido(120, 780, 0.42, 0.16) }
export function sonarApagado(): void { barrido(700, 90, 0.3, 0.13) }

/** Un clic seco al cambiar de pieza. Confirma el gesto sin gritar. */
export function sonarPieza(): void {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  const s = c.createBufferSource()
  s.buffer = ruido(c)
  const f = c.createBiquadFilter()
  f.type = 'highpass'
  f.frequency.value = 1800
  const g = c.createGain()
  g.gain.setValueAtTime(0.09, t)
  g.gain.exponentialRampToValueAtTime(0.0008, t + 0.07)
  s.connect(f); f.connect(g); g.connect(c.destination)
  s.start(t); s.stop(t + 0.09)
}

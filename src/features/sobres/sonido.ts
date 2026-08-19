/**
 * SONIDO — el ruido de abrir un sobre, sintetizado.
 *
 * ── Por qué no hay archivos de audio ─────────────────────────────────
 *
 * Porque no hacen falta. Todo lo que suena acá son tonos y ruido blanco
 * generados con la Web Audio API: cero bytes que descargar, cero licencias que
 * revisar, y funciona sin conexión — que importa, porque la app es una PWA que
 * la gente abre en la mesa de juego con el dato justo.
 *
 * ── La regla del gesto ───────────────────────────────────────────────
 *
 * El navegador no deja sonar nada hasta que la persona toca algo. No es un
 * problema acá: TODO lo que suena en este módulo pasa después de un toque
 * (elegir el sobre, rasgarlo, girar una carta). El contexto se crea perezoso
 * en el primer sonido, que por definición ya viene de un gesto.
 *
 * Aun así el silencio se puede pedir, y se recuerda entre sesiones: hay quien
 * abre sobres en el trabajo.
 */

const CLAVE = 'swu.sobres.silencio'

let ctx: AudioContext | null = null
let silencio = (() => {
  try {
    return localStorage.getItem(CLAVE) === '1'
  } catch {
    return false
  }
})()

export function estaEnSilencio(): boolean {
  return silencio
}

export function alternarSilencio(): boolean {
  silencio = !silencio
  try {
    localStorage.setItem(CLAVE, silencio ? '1' : '0')
  } catch {
    // Modo incógnito con el almacenamiento cerrado: se queda solo en memoria.
  }
  return silencio
}

/**
 * El contexto, creado a la primera y reutilizado.
 *
 * Se llama `resume()` siempre: en iOS el contexto se SUSPENDE cuando la app
 * pasa a segundo plano, y al volver seguiría creado pero mudo. Sin esto, el
 * sonido se moría en cuanto alguien atendía un mensaje a mitad de la apertura.
 */
function audio(): AudioContext | null {
  if (silencio) return null
  try {
    type ConAudio = typeof globalThis & { webkitAudioContext?: typeof AudioContext }
    const Ctor = window.AudioContext ?? (globalThis as ConAudio).webkitAudioContext
    if (!Ctor) return null
    ctx ??= new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** Un tono con envolvente. `tipo` decide si suena a metal o a madera. */
function tono(freq: number, dur: number, vol: number, tipo: OscillatorType, retraso = 0) {
  const a = audio()
  if (!a) return
  const t = a.currentTime + retraso
  const osc = a.createOscillator()
  const gan = a.createGain()
  osc.type = tipo
  osc.frequency.setValueAtTime(freq, t)
  // Ataque muy corto y caída exponencial: es la forma de una campana. Con
  // `linearRamp` se oye un corte seco al final, como un clic.
  gan.gain.setValueAtTime(0.0001, t)
  gan.gain.exponentialRampToValueAtTime(vol, t + 0.012)
  gan.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(gan).connect(a.destination)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

/** Ruido blanco filtrado: el papel del sobre al rasgarse. */
function ruido(dur: number, vol: number, corte: number, retraso = 0) {
  const a = audio()
  if (!a) return
  const t = a.currentTime + retraso
  const marcos = Math.floor(a.sampleRate * dur)
  const buf = a.createBuffer(1, marcos, a.sampleRate)
  const datos = buf.getChannelData(0)
  for (let i = 0; i < marcos; i++) {
    // El ruido se apaga hacia el final: un rasgado no termina de golpe.
    datos[i] = (Math.random() * 2 - 1) * (1 - i / marcos)
  }
  const src = a.createBufferSource()
  src.buffer = buf
  const filtro = a.createBiquadFilter()
  filtro.type = 'bandpass'
  filtro.frequency.setValueAtTime(corte, t)
  filtro.Q.setValueAtTime(0.7, t)
  const gan = a.createGain()
  gan.gain.setValueAtTime(vol, t)
  gan.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(filtro).connect(gan).connect(a.destination)
  src.start(t)
}

export type Efecto = 'tomar' | 'rasgar' | 'carta' | 'premio' | 'unica' | 'fallo'

/**
 * Suena un efecto.
 *
 * `nota` solo la usa 'carta': cada carta suena un grado más alta que la
 * anterior, así que las cinco del sobre arman una escala que sube. Es la
 * misma idea que hace que contar puntos en un videojuego se sienta bien.
 */
export function sonar(efecto: Efecto, nota = 440) {
  if (silencio) return
  switch (efecto) {
    case 'tomar':
      // Un roce corto y grave: la mano tocando el sobre.
      ruido(0.09, 0.16, 900)
      break
    case 'rasgar':
      // Dos rasgados encadenados, que es como suena de verdad: el tirón y el
      // desgarro largo.
      ruido(0.1, 0.3, 2600)
      ruido(0.34, 0.24, 1500, 0.06)
      break
    case 'carta':
      tono(nota, 0.16, 0.09, 'triangle')
      break
    case 'premio':
      // Acorde mayor arpegiado hacia arriba.
      tono(nota, 0.5, 0.1, 'triangle')
      tono(nota * 1.26, 0.5, 0.09, 'triangle', 0.07)
      tono(nota * 1.5, 0.7, 0.09, 'triangle', 0.14)
      break
    case 'unica':
      // La fanfarria de la serializada: quinta, octava y una campana encima.
      tono(nota / 2, 1.2, 0.12, 'sawtooth')
      tono(nota, 1.1, 0.1, 'triangle', 0.08)
      tono(nota * 1.5, 1.0, 0.09, 'triangle', 0.18)
      tono(nota * 2, 1.6, 0.07, 'sine', 0.28)
      ruido(0.9, 0.06, 5200, 0.05)
      break
    case 'fallo':
      tono(220, 0.18, 0.07, 'square')
      tono(165, 0.26, 0.06, 'square', 0.09)
      break
  }
}

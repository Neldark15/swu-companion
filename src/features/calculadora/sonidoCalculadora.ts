/** Impactos breves con armónicos audibles también en altavoces de teléfono. */
export function sonarConsola(contexto: BaseAudioContext, curar: boolean, volumen: number): void {
  const nivel = Math.max(0, Math.min(100, volumen)) / 100
  if (!Number.isFinite(nivel) || nivel === 0) return
  const ahora = contexto.currentTime
  const capas: Array<{ tipo: OscillatorType; inicio: number; fin: number; pico: number; duracion: number }> = curar
    ? [
      { tipo: 'sine', inicio: 440, fin: 820, pico: .14, duracion: .18 },
      { tipo: 'sine', inicio: 880, fin: 1230, pico: .05, duracion: .13 },
    ]
    : [
      { tipo: 'triangle', inicio: 260, fin: 95, pico: .24, duracion: .19 },
      { tipo: 'sawtooth', inicio: 560, fin: 145, pico: .065, duracion: .10 },
    ]
  for (const capa of capas) {
    const oscilador = contexto.createOscillator()
    const filtro = contexto.createBiquadFilter()
    const ganancia = contexto.createGain()
    oscilador.type = capa.tipo
    oscilador.frequency.setValueAtTime(capa.inicio, ahora)
    oscilador.frequency.exponentialRampToValueAtTime(capa.fin, ahora + capa.duracion)
    filtro.type = 'lowpass'
    filtro.frequency.value = 1800
    filtro.Q.value = .6
    ganancia.gain.setValueAtTime(0, ahora)
    ganancia.gain.linearRampToValueAtTime(capa.pico * nivel, ahora + .006)
    ganancia.gain.exponentialRampToValueAtTime(.0001, ahora + capa.duracion)
    oscilador.connect(filtro).connect(ganancia).connect(contexto.destination)
    oscilador.onended = () => { oscilador.disconnect(); filtro.disconnect(); ganancia.disconnect() }
    oscilador.start(ahora)
    oscilador.stop(ahora + capa.duracion + .01)
  }
}

import { useCallback, useEffect, useRef, useState } from 'react'

export function useConsola(activa: boolean, sonido: boolean) {
  const audio = useRef<AudioContext | null>(null)
  const propiaPantalla = useRef(false)
  const montada = useRef(false)
  const [completa, setCompleta] = useState(false)
  const [visible, setVisible] = useState(() => !document.hidden)

  useEffect(() => {
    montada.current = true
    const actualizar = () => setCompleta(Boolean(document.fullscreenElement))
    const visibilidad = () => {
      setVisible(!document.hidden)
      if (document.hidden) void audio.current?.suspend().catch(() => {})
    }
    document.addEventListener('fullscreenchange', actualizar)
    document.addEventListener('visibilitychange', visibilidad)
    return () => {
      montada.current = false
      document.removeEventListener('fullscreenchange', actualizar)
      document.removeEventListener('visibilitychange', visibilidad)
      void audio.current?.close().catch(() => {})
      audio.current = null
      if (propiaPantalla.current && document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    }
  }, [])

  // Reobtener al volver a la pestaña. Una solicitud que termina después del
  // desmontaje también se libera, para no dejar la pantalla encendida.
  useEffect(() => {
    if (!activa || !visible || !('wakeLock' in navigator)) return
    let cancelada = false
    let bloqueo: WakeLockSentinel | null = null
    void navigator.wakeLock.request('screen').then(lock => {
      if (cancelada) void lock.release().catch(() => {})
      else bloqueo = lock
    }).catch(() => {})
    return () => { cancelada = true; void bloqueo?.release().catch(() => {}) }
  }, [activa, visible])

  const pulso = useCallback((curar = false) => {
    if (!sonido || document.hidden) return
    try {
      const contexto = audio.current ?? new AudioContext()
      audio.current = contexto
      void contexto.resume().catch(() => {})
      const oscilador = contexto.createOscillator()
      const ganancia = contexto.createGain()
      oscilador.type = 'sine'
      oscilador.frequency.setValueAtTime(curar ? 420 : 180, contexto.currentTime)
      oscilador.frequency.exponentialRampToValueAtTime(curar ? 740 : 70, contexto.currentTime + 0.12)
      ganancia.gain.setValueAtTime(0.045, contexto.currentTime)
      ganancia.gain.exponentialRampToValueAtTime(0.001, contexto.currentTime + 0.16)
      oscilador.connect(ganancia).connect(contexto.destination)
      oscilador.onended = () => { oscilador.disconnect(); ganancia.disconnect() }
      oscilador.start()
      oscilador.stop(contexto.currentTime + 0.17)
    } catch { /* Audio opcional; el contador funciona sin AudioContext. */ }
  }, [sonido])

  const pantallaCompleta = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen()
    else {
      await document.documentElement.requestFullscreen()
      if (!montada.current) {
        if (document.fullscreenElement) await document.exitFullscreen()
        return
      }
      propiaPantalla.current = true
    }
  }, [])

  return { completa, visible, pantallaCompleta, pulso }
}

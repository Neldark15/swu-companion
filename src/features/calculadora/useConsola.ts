import { useCallback, useEffect, useRef, useState } from 'react'
import { sonarConsola } from './sonidoCalculadora'

export function useConsola(activa: boolean, sonido: boolean, volumen = 80) {
  const audio = useRef<AudioContext | null>(null)
  const ultimoPulso = useRef(-Infinity)
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

  // Desbloquear desde el gesto inicial también permite sonar a los pulsos
  // posteriores del temporizador en navegadores con restricciones de audio.
  const prepararAudio = useCallback(() => {
    if (!sonido || document.hidden) return null
    try {
      const contexto = audio.current ?? new AudioContext()
      audio.current = contexto
      void contexto.resume().catch(() => {})
      return contexto
    } catch { return null }
  }, [sonido])

  const pulso = useCallback((curar = false) => {
    const contexto = prepararAudio()
    if (!contexto) return
    try {
      // Evita apilar golpes al tocar varios controles muy rápido.
      if (contexto.currentTime - ultimoPulso.current < .06) return
      ultimoPulso.current = contexto.currentTime
      sonarConsola(contexto, curar, volumen)
    } catch { /* Audio opcional; el contador funciona sin AudioContext. */ }
  }, [prepararAudio, volumen])

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

  return { completa, visible, pantallaCompleta, pulso, prepararAudio }
}

# Prueba rápida en OBS 32.2.1

Fecha: 2026-08-21  
Equipo: macOS, lienzo 1920×1080 a 30 fps.

Se creó la escena aislada `PRUEBA SWU ANIMACIONES`; no se cambiaron las fuentes ni la configuración de las escenas de producción.

## Resultado

- Fondo H.264 y marco de energía VP9 con alfa reproducidos juntos durante más de 10 minutos.
- Estado observado al cierre: 30.00 / 30.00 FPS y 4.8% de CPU.
- Los dos bucles completaron múltiples ciclos sin detenerse ni mostrar un fotograma negro.
- El fondo siguió visible bajo el WebM superior: OBS decodificó correctamente su transparencia, sin matte negro ni borde cian visible.
- VP9 se probó con decodificación por hardware desactivada; el MP4 funcionó tanto con decodificación normal como por hardware.
- El stinger se decodificó 20 veces consecutivas sin error; su punto de corte validado es el frame 15, equivalente a 500 ms.
- No se inició transmisión, grabación ni cámara virtual.

La escena temporal quedó disponible en OBS para inspección; puede eliminarse cuando ya no se necesite.

# SWU SV — guía de animaciones para OBS

## Ajustes base

- Lienzo y tamaño de cada fuente animada: 1920×1080 a 30 fps.
- Coloque cada fuente animada a pantalla completa en x=0, y=0 y bloquéela.
- Orden en vivo de abajo hacia arriba: ambient → camera → energy frame → Marcador (Browser Source existente) → holographic logo → alerts.
- Conserve la cámara en x=420, y=37, 1080×1043 y el Marcador en 1920×1080.
- La escena conserva la live URL y los datos existentes. Estos videos no sustituyen el marcador dinámico.

## Media Sources

- MP4: loop ON, restart playback when source becomes active ON, hardware decode ON y close file when inactive OFF.
- VP9 WebM: loop ON, restart playback when source becomes active ON, hardware decode OFF y close file when inactive OFF.
- Stinger: corte en frame 15 = 500 ms, preload to RAM ON, track matte OFF. Audio monitoring no aplica porque no hay audio.
- Hide rather than delete los recursos estáticos anteriores; ocúltelos para poder volver atrás.

## Transparencia y compatibilidad

Si se pierde el alfa, confirme que el archivo sea el WebM VP9 local, desactive hardware decode y retire cualquier filtro de color. Pruebe sobre gris claro y azul marino. El alfa VP9 ya fue validado automáticamente. Use ProRes 4444 únicamente si la prueba posterior de Task 10 en OBS muestra bordes negros, pérdida de transparencia o un inicio tardío del stinger; en ese caso genere solo el respaldo afectado desde MASTER-FUENTES.

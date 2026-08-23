# Escena OBS — SWU El Salvador

Este paquete añade una escena nueva sin modificar las dos escenas originales.

## Archivos

- `SWU-EN-VIVO-EL-SALVADOR.json` — colección de escenas lista para importar.
- `SWU-El-Salvador-Fondo-v2-Camara-16x9.png` — fondo final ajustado a la
  cámara real, a resolución nativa.
- `SWU-El-Salvador-Fondo-1920x1080.png` — versión original conservada como
  respaldo.
- `SWU-SV-Logo-Original.png` — logo recibido, conservado sin cambios.
- `SWU-SV-Logo-OBS-1024.png` — versión cuadrada con transparencia, optimizada
  para usar como fuente de imagen en OBS.

## Importar en OBS

1. Abre **Colección de escenas → Importar**.
2. Selecciona `SWU-EN-VIVO-EL-SALVADOR.json`.
3. Activa la colección **SWU EN VIVO · EL SALVADOR**.
4. Selecciona la escena **SWU · EL SALVADOR**.
5. Si OBS muestra **Archivos faltantes**, localiza
   `SWU-El-Salvador-Fondo-v2-Camara-16x9.png` en esta misma carpeta.
6. Abre las propiedades de **Cámara (iPhone)** y elige el dispositivo.

La escena usa este orden, de abajo hacia arriba:

1. `Fondo · SWU El Salvador`
2. `Cámara (iPhone)`
3. `Marcador`
4. `Logo · SWU SV`

El logo está bloqueado en la esquina superior izquierda, a 128×128 px. Es una
fuente independiente: puedes ocultarlo o desbloquearlo para moverlo sin editar
el fondo.

El marcador conserva la URL `https://www.swusv.com/overlay/SV01`. Para probar
con datos de demostración puedes añadir temporalmente `?debug=1` a esa URL.

## Ajustes esperados

- Resolución base: **1920×1080**
- FPS: **30**
- La fuente de cámara queda en una caja de **1080×1043**, en `x=420`, `y=37`.
- Como la señal es 16:9, la imagen visible ocupa aproximadamente
  **1080×608**, desde `x=420`, `y=255` hasta `x=1500`, `y=863`.
- El fondo queda bloqueado para evitar moverlo por accidente.

## Prompt final del fondo v2

```text
Use case: precise-object-edit
Asset type: final 1920x1080 OBS livestream background for SWU El Salvador
Input images: Image 1 is the edit target and visual style source; Image 2 is a
layout reference only showing the real camera placement inside OBS
Primary request: change only the center architecture of Image 1 so it
accurately frames the real 16:9 camera feed shown by Image 2
Composition/framing: exact full canvas 16:9. Preserve the two outer side rails
of Image 1, including stars, blue nebula, volcanoes, floor reflections, metal
structures, blue and red lights. The visible camera region must read as a
centered horizontal 16:9 opening spanning approximately x=420 to x=1500 and
y=255 to y=863 on a 1920x1080 canvas. Replace the current full-height
portrait-shaped central opening with a wide horizontal camera bay. Place slim
dark-metal bevels immediately outside the camera opening. Fill the central area
above the opening with restrained smoked-glass and brushed-metal sci-fi
architecture, leaving a calm zone for the scoreboard. Fill the central area
below the opening with low-detail dark technological decking that will sit
behind the legal strip.
Style/medium: preserve the exact premium cinematic sci-fi broadcast style of
Image 1; dark navy brushed metal, smoked glass, cobalt illumination, subtle
holographic grid, restrained red live accents
Lighting/mood: low-key, elegant, professional tournament broadcast; the camera
remains the visual focus
Constraints: preserve Image 1 side rails and their composition as aggressively
as possible; change only the central architecture; do not include the camera
photograph from Image 2; do not include OBS interface elements, red measurement
guides, measurement labels, text, logos, watermarks, cards, characters, ships,
helmets, weapons, or faction insignia; no decorative object may overlap the
16:9 camera opening; the opening must be clean and dark because live video will
cover it
```

Generado con la herramienta visual integrada en modo de edición y ajustado
geométricamente a 1920×1080 para OBS. La versión v1 no fue reemplazada.

## Nota

La colección guarda rutas absolutas hacia los PNG. Si mueves esta carpeta, OBS
te pedirá relocalizar el fondo y el logo; no se pierde la composición.

# Calculadora casual de Premier y Twin Suns

Solicitud de Nel: una calculadora digital, muy animada, a pantalla completa para partidas casuales con cartas físicas, priorizando el teléfono.

## Alcance implementado

Ruta pública `/calculadora`, fuera de AppLayout para ocupar el viewport sin navegación ni avisos de actualización encima de la mesa. Accesos desde Mini Juegos, menú de escritorio y preparación del Contador de daños. Los contadores anteriores conservan sus partidas y funciones.

Premier tiene dos bases; Twin Suns permite tres o cuatro. Los nombres y la vida máxima se configuran antes de empezar (30 por defecto, editable según la base impresa, entero de 1 a 999). Pantalla dividida, modo frente a frente, ajustes de 1/5 y entrada de cantidades exactas al tocar la vida. En paneles con poca altura los saltos de 5 quedan en el ajuste exacto para conservar botones accesibles.

Números de siete segmentos en SVG, anillos orbitales, encendido escalonado, partículas y ondas ante daño, pulso de curación y fichas iluminadas. Sonido sintetizado opcional, apagado por defecto. Se respeta movimiento reducido, hay interruptor de efectos y las animaciones se pausan al ocultar la pestaña. Wake Lock y Fullscreen se usan cuando están disponibles; la vista ocupa `100dvh` aunque el navegador no admita Fullscreen.

## Estado y reglas

Modelo puro independiente en `estadoCalculadora.ts`. La vida está limitada a 0..vida máxima; una base destruida solo se recupera deshaciendo un error. Historial de hasta 100 movimientos con snapshots sin recursión: Deshacer restaura vida, ronda, dueños de fichas y reclamaciones. Cada acción escribe el guardado local; se advierte si falla el almacenamiento. Las cargas corruptas se rechazan y se permite preparar otra mesa.

Las fichas son marcadores manuales: reclamar no aplica daño ni efectos sobre cartas. Una ficha por jugador y ronda; se conserva iniciativa en reagrupamiento, y Explosión/Plan vuelven al centro. En Twin Suns, al caer el dueño de iniciativa esta se libera, incluso durante la fase final. La primera eliminación muestra que la partida termina al cerrar la fase actual, con victoria por mayor vida y empates compartidos; el usuario anota la curación de 5 al eliminador correspondiente. No se inventa quién causó un daño manual.

Reglas contrastadas con [CR v8.0 oficial, §§11.3.4 y 12.5–12.7](https://cdn.starwarsunlimited.com//SWH_Comp_Rules_v8_0_e26603c6e1.pdf). Esto es una herramienta para la mesa física, no otro motor de juego online.

Persistencia propia: `holocron-calculadora-casual-v1`; opciones en `swu_calculadora_opciones_v1`. Sin cuenta, SQL, estadísticas, llamadas a servicios ni dependencias nuevas. Reemplazar una partida requiere confirmación explícita dentro de la interfaz.

## Verificación

- `npx tsx scripts/calculadora-estado.test.mts`: límites, valores inválidos, fichas, iniciativa retenida y liberada por eliminación, undo, límite de historial y guardados corruptos.
- `npm run lint` y `npm run build`.
- Navegador Chromium: configuración, toques rápidos, ajuste exacto, undo, recarga, Twin Suns 3/4, fichas, nueva mesa cancelable, Escape en diálogos y error de almacenamiento.
- Móvil 320×568, 360×740 y 390×844; horizontal 812×375; escritorio 1280×900. Comprobar que los botones no se solapan ni quedan recortados, incluidos los controles de bases supervivientes en fase final.
- Efectos apagados y movimiento reducido; partida ya cargada con red desconectada. Teléfono físico, sonido de altavoz y políticas Wake Lock/Fullscreen de Safari requieren comprobación en dispositivo real.
- Traza independiente de Chrome 152 en Mac, Premier 390×844, 1,8 segundos con órbitas activas tras la entrada: 108 DrawFrame y cero eventos de Layout, Paint o RasterTask. Es evidencia de composición en ese navegador, no una promesa de FPS o consumo en teléfonos físicos.

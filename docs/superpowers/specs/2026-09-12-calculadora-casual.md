# Calculadora casual de Premier y Twin Suns

Solicitud de Nel: una calculadora digital, muy animada, a pantalla completa para partidas casuales con cartas físicas, priorizando el teléfono.

## Alcance implementado

La visual reemplaza el acceso principal **Contador de daños** en `/contador`, fuera de AppLayout para ocupar el viewport sin navegación ni avisos de actualización encima de la mesa. Inicio, menú móvil y escritorio comparten ese destino, sin una segunda casilla de Calculadora. `/calculadora` redirige al contador; `/contador/mesa` prepara Twin Suns y conserva la partida guardada hasta confirmar una nueva.

Los contadores anteriores conservan partidas y funciones en `/contador/registrado` y `/contador/registrado/mesa`, dentro de AppLayout. El acceso **Duelo registrado**, visible desde preparación y ajustes, mantiene el historial, el guardado anterior y los flujos de Amistosas y Misiones. Las misiones de jugar/ganar apuntan directamente allí.

Premier tiene dos bases; Twin Suns permite tres o cuatro. Cada jugador puede buscar su carta de base por nombre, subtítulo o expansión. La selección carga nombre, imagen y vida impresa; la vida inicial queda protegida mientras haya una carta elegida. **Usar vida manual** permite volver al ajuste libre (30 por defecto, entero de 1 a 999). La ilustración aparece de fondo y se puede ver la carta completa al tocar el contador. Pantalla dividida, modo frente a frente, ajustes de 1/5 y entrada de cantidades exactas. En paneles con poca altura los saltos de 5 quedan en el ajuste exacto para conservar botones accesibles.

El selector se carga al abrirlo. Consulta las bases canónicas en Dexie antes de usar la red; verifica si el catálogo está completo y recupera los faltantes con el servicio existente `loadFullDatabase`, manteniendo las opciones guardadas durante la descarga o si falla. Se puede actualizar el catálogo, reintentar y usar una vida manual sin conexión. La búsqueda tiene paginación accesible, sin ocultar resultados tras un tope fijo. Imágenes mediante CardImage y el proxy existente en producción.

El fondo de cada jugador muestra la ilustración de su base con un recorte del arte y velos locales que protegen nombre, números y botones.

Números de siete segmentos en SVG, anillos orbitales, encendido escalonado, partículas y ondas ante daño, pulso de curación y fichas iluminadas. Sonido sintetizado opcional, apagado por defecto. Se respeta movimiento reducido, hay interruptor de efectos y las animaciones se pausan al ocultar la pestaña. Wake Lock y Fullscreen se usan cuando están disponibles; la vista ocupa `100dvh` aunque el navegador no admita Fullscreen.

## Estado y reglas

Modelo puro independiente en `estadoCalculadora.ts`. La vida está limitada a 0..vida máxima; una base destruida solo se recupera deshaciendo un error. Historial de hasta 100 movimientos con snapshots sin recursión: Deshacer restaura vida, ronda, dueños de fichas y reclamaciones. Cada acción escribe el guardado local; se advierte si falla el almacenamiento. Las cargas corruptas se rechazan y se permite preparar otra mesa.

Las fichas son marcadores manuales: reclamar no aplica daño ni efectos sobre cartas. Una ficha por jugador y ronda; se conserva iniciativa en reagrupamiento, y Explosión/Plan vuelven al centro. En Twin Suns, al caer el dueño de iniciativa esta se libera, incluso durante la fase final. La primera eliminación muestra que la partida termina al cerrar la fase actual, con victoria por mayor vida y empates compartidos; el usuario anota la curación de 5 al eliminador correspondiente. No se inventa quién causó un daño manual.

**Fuerza en Premier:** las bases compatibles muestran una ficha propia por jugador. Se detecta por la habilidad de creación, incluidas bases de 25 y 28 de vida. Un toque crea la ficha cuando corresponde y otro la gasta; máximo una, sin creación automática al preparar la mesa ni al pasar de ronda. Permanece hasta gastarla; derrota la retira y Deshacer la recupera. Las condiciones y límites de la habilidad se resuelven con las cartas físicas. Los guardados anteriores conservan la partida y reconocen las doce bases canónicas verificadas aunque antes no guardaran esa capacidad.

El botón explícito **Siguiente ronda · Restablecer fichas** está junto a las fichas y dentro de cada panel de ficha. Requiere confirmar que la mesa terminó el reagrupamiento. Tomada/Disponible depende de la reclamación de la ronda actual: una iniciativa que conserva su dueño vuelve a mostrarse Disponible. Se conserva toda la vida al avanzar; Deshacer recupera fichas y ronda. Durante la fase final los accesos quedan bloqueados; el botón principal se omite en teléfonos cortos para dejar espacio a las bases supervivientes.

Reglas contrastadas con [CR v8.0 oficial, §§11.3.4 y 12.5–12.7](https://cdn.starwarsunlimited.com//SWH_Comp_Rules_v8_0_e26603c6e1.pdf). Esto es una herramienta para la mesa física, no otro motor de juego online.

Persistencia propia: `holocron-calculadora-casual-v1`; opciones en `swu_calculadora_opciones_v1`. Se guarda una copia validada de los datos de cada base, conservada por Deshacer y recarga. Los guardados anteriores sin base se migran a base nula sin perder vida ni historial. Sin cuenta obligatoria, SQL, estadísticas ni dependencias nuevas. Reemplazar una partida requiere confirmación explícita dentro de la interfaz.

## Verificación

- `npx tsx scripts/calculadora-estado.test.mts`: límites, valores inválidos, fichas, iniciativa retenida y liberada por eliminación, undo, límite de historial y guardados corruptos.
- `npx tsx scripts/calculadora-bases.test.mts`: catálogo, filtrado y metadatos de base; pruebas de estado incluyen vida impresa, copias, URLs válidas y migración compatible.
- `npm run lint`, `npm run build`, `npm run misiones` y `node scripts/actualizacion-rutas.test.mjs`.
- Navegador Chromium: configuración, toques rápidos, ajuste exacto, undo, recarga, Twin Suns 3/4, fichas, nueva mesa cancelable, Escape en diálogos y error de almacenamiento.
- Móvil 320×568, 360×740 y 390×844; horizontal 812×375; escritorio 1280×900. Comprobar que los botones no se solapan ni quedan recortados, incluidos los controles de bases supervivientes en fase final.
- Efectos apagados y movimiento reducido; partida ya cargada con red desconectada. Teléfono físico, sonido de altavoz y políticas Wake Lock/Fullscreen de Safari requieren comprobación en dispositivo real.
- Traza independiente de Chrome 152 en Mac, Premier 390×844, 1,8 segundos con órbitas activas tras la entrada: 108 DrawFrame y cero eventos de Layout, Paint o RasterTask. Es evidencia de composición en ese navegador, no una promesa de FPS o consumo en teléfonos físicos.
- Catálogo real de 91 bases: Energy Conversion Lab inicia en 25 y Data Vault en 33. Se verifican selección, imágenes cargadas, HP automático, cuatro bases independientes, recarga, undo, búsqueda offline con caché, recuperación de una caché parcial con una sola base tras fallo de red, retorno manual y rutas principal/Twin/registrado. Sin escrituras de prueba a cuentas o base cloud.

- Fuerza: creación/gasto independiente, máximo una, persistencia entre rondas, recarga, Deshacer y migración con historial; base normal sin control y Twin Suns sin cambios de fichas.

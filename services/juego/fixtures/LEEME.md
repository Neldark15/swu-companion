# Fixtures privados del motor real

`catalogo-cartas.json.gz` es un snapshot de los JSON normalizados por el descargador de Forceteki fijado. Su SHA-256 está en `motor-lock.json`. Preparar el motor no vuelve a consultar Fantasy Flight Games ni Karabast. Las cartas con habilidades sin implementación se rechazan; las cartas sin texto de habilidad usan legítimamente las reglas generales de tipos/keywords del motor.

`mazos.mjs` exporta dos mazos Premier válidos para desarrollo, en formato `{id,nombre,mazo}`. El contenido no procede de usuarios reales. `estados-privados.json` contiene vistas de cada piloto, obtenidas con `Game.getState(id)` durante partidas reales locales. No importarlos al bundle de producción.

## Contrato del tablero

- `players` usa IDs autenticados como claves. `players[id].promptState` es privado: el oponente recibe `{}`.
- `cardPiles` contiene `hand`, `resources`, `groundArena`, `spaceArena`, `discard`, `outsideTheGame`, `capturedZone` y `credits`; `leader` y `base` están separados. Las cartas ocultas no llevan identidad.
- Cartas en mesa/mano: enviar `cardClicked` con `[carta.uuid]` solo si `selectable` (la ficha de Fuerza usa `selectionState.selectable`).
- Botones: `menuButton` con `[boton.arg, prompt.promptUuid, boton.method]`; el último valor es opcional y suele omitirse. Respetar `disabled` y `command`.
- `displayCards`: cada entrada lleva `cardUuid`, `setId`, `internalName`, `selectionState` textual (`selectable`, `selected`, `unselectable`, `invalid`, `viewOnly`). Selección: `menuButton` con `[cardUuid,promptUuid]`.
- `perCardButtons`: `perCardMenuButton` con `[boton.arg,cardUuid,promptUuid]`.
- `selectNumber`: escoger entero entre `min` y `max`; `menuButton` con `[String(numero),promptUuid]`.
- `dropdownListOptions`: `menuButton` con `[opcion,promptUuid]`.
- `distributeAmongTargets`: `statefulPromptResults` con `[{type:prompt.distributeAmongTargets.type,valueDistribution:[{uuid,amount}]},promptUuid]`. Solo objetivos seleccionables; enteros positivos; sin UUID repetidos. Se puede omitir un objetivo con cero. Respetar `amount`, `canChooseNoTargets`, `canDistributeLess`, `maxTargets` y vida restante para daño indirecto.
- `batchTriggerResolution`, `optionalTrigger`, `triggerWindow` y `passDelay` se resuelven por los botones recibidos. `sourceCard`/`label` son metadatos de visualización, nunca comandos.
- Conceder: `concede` con `[]`. Después del resultado se rechazan más elecciones.

La interfaz no presupone el turno activo para todas las elecciones: algunas habilidades eligen con el oponente. La autoridad es el prompt y la selección del motor para ese usuario. `menuTitle`/`promptTitle` y texto de reglas provienen del motor en inglés; los controles generales de HOLOCRON se mantienen en español.

# Jugar online en HOLOCRON

Diseño aprobado por Nel · 8 de septiembre de 2026

Aprobación: «Sí, empecemos con esa versión». Implementación autorizada en rama; publicación en producción pendiente de validación y autorización de esta entrega.

## Qué construiremos

Un módulo integrado en Companion para disputar partidas virtuales de Star Wars Unlimited entre dos usuarios. Cada persona entra con su cuenta, elige un mazo, comparte un código de sala y juega desde su teléfono o computadora. El servidor aplica las reglas y resuelve las habilidades. Se conserva la tarjeta de jugador y el estilo de HOLOCRON.

La propuesta inicial es **Premier casual BO1 (una partida por sala), 1 contra 1 y salas privadas**. Después se puede añadir búsqueda pública de oponente, historial ampliado y clasificación. Twin Suns requiere una evaluación diferente: el motor examinado trabaja con dos jugadores.

## Opciones y recomendación

| Camino | Ventaja | Trabajo y límite |
| --- | --- | --- |
| Adaptar Forceteki, motor abierto de Karabast — recomendado | Reutiliza reglas, elecciones, habilidades y pruebas de un simulador interactivo | Adaptar cuentas, almacenamiento, protocolo y despliegue; verificar cobertura de cartas |
| Crear un motor propio a partir de las piezas de SWUSIM | Control completo de su arquitectura | SWUSIM decide por ambos jugadores y devuelve una simulación terminada; requiere reconstruir reglas, elecciones y persistencia |

Usaríamos un fork versionado del motor con sus avisos de licencia MIT. HOLOCRON tendrá su propia interfaz y su propio servicio de partidas; no dependerá de una sala alojada en karabast.net.

## Primera entrega jugable

1. **Jugar online:** acceso desde Companion, sesión cloud válida y selección de mazo. El servidor verifica su legalidad y compatibilidad antes de permitir comenzar. Indica las cartas concretas incompatibles.
2. **Sala privada:** crear, entrar por código, ver al oponente y marcarse preparado. Dos asientos, mazos congelados al iniciar y entrada simultánea resuelta por el servidor.
3. **Partida completa:** preparación, mulligan, recursos, iniciativa, arenas terrestre y espacial, ataques, objetivos, mejoras, eventos, despliegue de líder, habilidades y victoria según el motor validado. Permite conceder y muestra el resultado.
4. **Tablero móvil:** diseño táctil que funcione en vertical, cartas ampliables, zonas claramente separadas, mano propia accesible y opciones legales visibles. En horizontal o computadora utiliza el espacio adicional. Una primera prueba real de juego decidirá los ajustes de disposición.
5. **Conexión:** aviso al perder red, recuperación del asiento y del estado al volver. Una jugada sin respuesta no se vuelve a ejecutar por duplicado. El rival recibe únicamente información pública.

La beta permitirá solo mazos cuyas cartas estén implementadas y verificadas. No basta con que una carta aparezca en el catálogo. El lanzamiento inicial no incluye clasificación, recompensas ni espectadores.

## Integración

- Nuevo módulo `/jugar`, con sala y partida propias. Las rutas actuales `/mesa` y `/arena` mantienen sus usos existentes.
- React/Vite y los componentes de HOLOCRON para la interfaz. Adaptador de mazos desde nuestro catálogo al identificador del motor.
- Servicio Node persistente con Forceteki y Socket.IO. Se conserva el motor y se sustituyen las dependencias de cuentas/servicios de Karabast por adaptadores propios.
- Autenticación Supabase validada en servidor. El nombre y el asiento se derivan de la cuenta verificada, no de datos de identidad enviados por el navegador.
- Cada acción pasa por una lista explícita de comandos, validación, validación del actor y de las acciones/elecciones permitidas por el motor, y deduplicación. Cada usuario recibe su propia vista autorizada.

El VPS actual comparte recursos con otros servicios. Hay que medir su capacidad antes de decidir dónde alojar el motor. Esta propuesta no contrata infraestructura ni modifica producción.

## Orden de construcción y criterio de aceptación

**1. Prueba integrada local:** dos cuentas aisladas de desarrollo y dos mazos compatibles completan una partida real a través de Companion. Verificar ataques, habilidades con elección y ocultación de la mano rival. Esta prueba valida que el motor se puede desacoplar de los servicios de Karabast.

**2. Beta privada:** selección de mazos, sala por código, tablero móvil, reconexión, errores claros y resultados idempotentes. Probar dos dispositivos/sesiones, unión simultánea, doble envío, sesión expirada y acceso de un tercero.

**3. Preparación para producción:** medir consumo y partidas concurrentes, comprobar respaldo/recuperación y despliegues. La reconexión de Forceteki funciona mientras vive el proceso; sus snapshots de deshacer no prueban recuperación tras un reinicio. Hasta implementar y verificar recuperación duradera, una interrupción del servidor debe marcar la partida como interrumpida, sin inventar ganador ni alterar estadísticas. Los despliegues deberán drenar las partidas activas.

Los cambios de base de datos se preparan como migraciones aditivas para revisión. Su aplicación seguirá el protocolo compartido del proyecto. La beta no se presentará como terminada ni se publicará antes de pasar las pruebas correspondientes.

## Evidencia revisada

- [Karabast](https://karabast.net): salas, emparejamiento y juego virtual de SWU.
- [Forceteki](https://github.com/SWU-Karabast/forceteki), revisión `139c14a240b75498b403ccdb06144a136972ecb6`: motor interactivo, validación de mazos, vistas privadas y reconexión en memoria; licencia MIT.
- [Forceteki client](https://github.com/SWU-Karabast/forceteki-client), revisión `f2b82f1ddfae3adb08bb17a8066fa152109aa8b0`: cliente independiente Next.js/React; licencia MIT. Su interfaz no se puede insertar directamente en nuestra aplicación Vite sin adaptación.
- Código local de Companion y SWUSIM: cuentas, mazos y componentes reutilizables; el módulo Mesa es un reproductor de simulaciones, no un motor PvP.

La implementación parte de este diseño aprobado. Los resultados y límites comprobados se registrarán en el plan y en BITACORA.md; no se presupone una publicación en producción.

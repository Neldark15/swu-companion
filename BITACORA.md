# Bitácora — HOLOCRON SWU (swu-companion)

Registro compartido entre Claude y ChatGPT. **La entrada más nueva va arriba.** Formato:

```
## AAAA-MM-DD · Claude | ChatGPT · <título corto>
**Qué cambió:** ...
**Archivos:** ...
**Cómo verificar:** ...
**Pendiente / notas para el siguiente:** ...
```

---

## 2026-09-09 · ChatGPT · Jugar online: módulo y uniones rápidas
**Qué cambió:** Se movió el acceso rápido a **Jugar online** dentro de **Mini Juegos** (`/jugar`) para que aparezca en esa grilla, y se mejoró el ingreso por código en sala para evitar intentos inválidos. El campo ahora acepta solo `A-Z2-9`, lo normaliza a 10 caracteres, muestra feedback cuando el formato no es correcto y bloquea el botón de unión hasta que el código sea válido y el mazo esté listo.
**Archivos:** `src/features/home/HomePage.tsx`, `src/features/jugar/JugarPage.tsx`.
**Cómo verificar:** `npm run lint` (0 errores, 6 advertencias preexistentes), `npm run build` exitoso; sin cambios de servicios ni schema. En móvil y escritorio, probar `/` → Mini Juegos → Jugar online y validar que el botón de “Entrar a la sala” no habilita hasta pegar un código de 10 chars válidos.
**Pendiente / notas para el siguiente:** Confirmar configuración de producción de juego en `services/juego` (`VITE_JUEGO_URL`, `JUEGO_ORIGENES`, SSL/proxy) y desplegar; el front ahora tiene la nueva ruta visual pero depende de ese servicio activo para funcionar.

## 2026-09-08 · ChatGPT · Jugar online Premier privado
**Qué cambió:** Primera beta aprobada por Nel: partidas reales Premier casual BO1 entre dos usuarios, salas por código, mazos propios o JSON, preparación, tablero móvil/escritorio y reconexión. Motor automático Forceteki fijado y servicio propio autenticado, con vistas privadas y resultado. Tarjeta de jugador, HomePage, módulos previos y estadísticas conservados.
**Archivos:** `services/juego/`, `src/features/jugar/`, rutas/menús, pruebas y fixtures, `scripts/vite-jugar.config.mts`, variables de ejemplo e ignores. Diseño/plan en `docs/superpowers/`; operación en README del servicio, reglas en CLAUDE §5n y AGENTS.
**Cómo verificar:** Node24: build y lint pasan (0 errores, 6 avisos previos); 29 pruebas motor+salas sin skips, programas mazos/cliente/vistas y 7 pruebas de reconexión Socket.IO pasan. Revisiones independientes cerraron fallos de comando por carta Improvise, cupo concurrente de sockets y respuesta vieja al iniciar otra partida. Dos usuarios en navegador: setup, recursos, unidades, habilidad Han, cambio de ronda, ataque/daño de base, ampliación, recarga, concesión y regreso al lobby. Móvil 390×844 y escritorio 1280×900 revisados; banco/identidades de prueba/servicio fuera del build.
**Pendiente / notas para el siguiente:** Rama `feature/jugar-online`, PR borrador [#3](https://github.com/Neldark15/swu-companion/pull/3), implementación `7bb3422` + `032db71`; no está publicado el servicio ni se aplicó SQL/DNS. Necesita proceso Node24 único con volumen, HTTPS, Auth/orígenes y VITE_JUEGO_URL para habilitar producción. Reinicios interrumpen partidas sin adjudicar ganador, mientras la desconexión de red sí permite volver al proceso vivo. Docker incluido, despliegue Docker no probado. Compatibilidad limitada al pin/sets y cartas implementadas; rechazos explícitos. Sin cuentas ni datos de prueba en Supabase real. No se midió teléfono físico.

## 2026-09-07 · ChatGPT · Publicación autorizada del escáner y funciones
**Qué cambió:** Nel autoriza explícitamente publicar la tanda del PR #2: escáner automático, faltantes del mazo y accesos. Se prepara la integración de `feature/escaner-y-funciones` en `main`, conservando la tarjeta de jugador. La autorización sustituye el estado de borrador descrito en la entrada anterior.
**Archivos:** Implementación `400ed32`, esta constancia y corrección del enlace a `/profile` en el estado sin perfil de PanelFaltantesMazo. Sin SQL ni cambios de configuración del servicio de datos.
**Cómo verificar:** Se repiten build y lint (0 errores; 6 advertencias previas), las cinco pruebas del escáner/acceso/faltantes y la exclusión de banco/fixtures del build. El preview de Vercel pasa. Antes de integrar se verifica que el proyecto `swu-companion` enlaza `Neldark15/swu-companion`, producción `main`, dominios `swusv.com` y `www.swusv.com`. La publicación se confirma por SHA integrado y estado READY/PROMOTED en la API de Vercel.
**Pendiente / notas para el siguiente:** La validación física de cámara, fundas y reflejos sigue pendiente; las pruebas simuladas no se presentan como precisión real en todos los móviles. No se crearon cuentas ni guardados cloud durante pruebas. La cola durable offline sigue fuera de esta tanda. El resultado final del despliegue se consulta en el PR #2 y sus comprobaciones.

## 2026-09-07 · ChatGPT · Escáner automático y funciones sin rediseño
**Qué cambió:** Se conserva la tarjeta de jugador. El escáner corrige el encuadre físico en móvil y separa arte/OCR, confirma con dos fotogramas, descarta lecturas antiguas, recupera cámara/lectores y evita reofrecer la misma carta hasta retirarla/cambiarla. El modal ahora usa Sheet para que la barra móvil no tape Agregar. Guardado local con resultado verificable y lectura de existencias por perfil. También: faltantes de copias físicas en mazos con enlaces a mercado filtrado, Mercado móvil correcto y formularios de registro/recuperación directos.
**Archivos:** ScanPage, cardScanner/cardHash, encuadreEscaner/cicloEscaner, collectionService, PanelFaltantesMazo/faltantesMazo, DeckBuilderPage, ExplorePage, TabBar, WelcomeHome y ProfilePage/accesoPerfil. BancoEscaner y cinco fixtures oficiales solo DEV; plan y reglas en CLAUDE §5m y AGENTS.
**Cómo verificar:** Build y lint completos pasan (0 errores, las mismas 6 advertencias previas). Pasan escaner-imagen, escaner-encuadre, escaner-ciclo, acceso-perfil y deck-faltantes. Reproducción antes: 2/20 fotogramas centrados reconocidos; después: 80/80 incluyendo pequeñas variaciones, más cinco imágenes recortadas. Banco a 390×844: detección automática de unidad/líder, confirmación y guardado en memoria, panel de faltantes y enlace a mercado; registro y recuperación directos. Se verifica que banco y cinco imágenes no entran en build/precache. Revisión independiente sin bloqueantes pendientes.
**Pendiente / notas para el siguiente:** No se ha publicado esta tanda en producción ni aplicado SQL. La cámara física, reflejos, fundas y latencia en teléfonos necesitan validación real. No se crearon cuentas ni escrituras cloud en pruebas; el mercado queda protegido por AuthGate. La cola durable offline se pospuso al priorizar el escáner; el envío de colección a nube sigue siendo de mejor esfuerzo. La precisión simulada no es una tasa real de reconocimiento de cualquier carta.

## 2026-09-07 · ChatGPT · Publicación autorizada del Taller Kyber
**Qué cambió:** Nel autorizó llevar las mejoras visuales a producción. Se prepara la integración de `feature/taller-kyber-materiales` mediante PR a `main`, que dispara el despliegue automático de Vercel. Alcance del código: el taller y su cabecera; sin SQL ni cambios de datos.
**Archivos:** Implementación de `836457c` y esta entrada de publicación.
**Cómo verificar:** Se repitieron build, lint (0 errores; 6 advertencias fuera del taller) y las tres pruebas de perfiles, geometría y encuadre; todas pasan. Revisión independiente confirmó el banco solo DEV. Antes de publicar se verificó que Vercel enlaza `Neldark15/swu-companion`, rama de producción `main`, con `swusv.com` entre sus dominios. Confirmar el SHA integrado y estado `READY`/`PROMOTED` mediante la API de Vercel.
**Pendiente / notas para el siguiente:** La entrada anterior describe el estado previo a esta autorización. La evidencia final del despliegue queda en el PR y sus comprobaciones de Vercel. El rendimiento en un teléfono físico aún no fue medido; no se realizaron compras ni guardados de cuenta durante las pruebas.

## 2026-09-07 · ChatGPT · Taller Kyber: materiales 3D y editor móvil
**Qué cambió:** Prueba limitada al taller, basada en la maqueta móvil aprobada. Metal cepillado y agarres con mapas deterministas, microbiseles, herrajes redondeados, alojamiento del cristal, iluminación de estudio y halo suave. Más detalle en Faro/Blindaje. Editor compartido con el banco DEV, cuatro pasos, carrusel horizontal y encuadres Detalle/Completo. Recuperación de saldo/inventario sin perder la edición. Se incorpora el contexto compartido creado por Claude conservando su entrada anterior.
**Archivos:** `src/features/sable/` (editor, escena, geometría, materiales, entorno y miniaturas); `Header.tsx` omite la cabecera duplicada solo en el taller; pruebas `kyber-geometria.test.mts` y `kyber-encuadre.test.mts`; plan en `docs/superpowers/plans/2026-09-07-taller-kyber.md`; contexto en CLAUDE.md §5l y AGENTS.md.
**Cómo verificar:** `npm run build`, `npm run lint` (0 errores; 6 advertencias preexistentes fuera del taller), `npx tsx scripts/sable-perfiles.test.mts`, `npx tsx scripts/kyber-geometria.test.mts`, `npx tsx scripts/kyber-encuadre.test.mts`. Todas pasan. Banco revisado a 360×740, 390×844, 820×1180 y 1280×900, con cambios de pieza/material/cristal/color, encuadre y guardado local. Revisión independiente sin bloqueantes pendientes.
**Pendiente / notas para el siguiente:** Rama `feature/taller-kyber-materiales`, prueba local en `/banco-sable-3d`; sin publicar ni aplicar SQL. No se hicieron compras ni guardados de cuenta reales. Medir rendimiento en un teléfono físico antes de prometer FPS; movimiento reducido, WebGL fallback y liberación GPU revisados en código. El shell exige `.env.local` válido incluso para el banco (detalle §5l). Catálogo oculto, reglas de créditos y RPC se conservan.

## 2026-09-07 · Claude · Se crea el contexto compartido para agentes
**Qué cambió:** Se agregan `AGENTS.md` (resumen autocontenido que remite al `CLAUDE.md` por §) y esta `BITACORA.md`; al `CLAUDE.md` solo se le antepone una cabecera que apunta a los dos. Sin cambios de código ni de base.
**Archivos:** `AGENTS.md`, `BITACORA.md`, cabecera de `CLAUDE.md`.
**Cómo verificar:** `npm run build` sigue pasando (no se tocó código); leer `AGENTS.md` §3–§5 y confirmar que los comandos existen en `package.json`.
**Pendiente / notas para el siguiente:** Estado al día de hoy: `main` == `origin/main` en 8b91159 (2026-09-06, «la tienda — repetidas a créditos y sobres que se compran»), árbol limpio. Liga PUENTE 3 en demo cerrado con `publica = false` y 120 inscritos `[demo]`: borrarlos con el SQL de CLAUDE.md §5j antes de abrirla. `docs/torneo-2026-08-15-datos.md` no se carga a Supabase hasta tener las 12 partidas. TODOs en código: QR real en `JoinEventPage.tsx` y Realtime en `EventLobbyPage.tsx`. Rama remota `claude/app-scifi-design-lkdx1i` sin merge (decidir). La «Estructura de carpetas» del `CLAUDE.md` está vieja; el resto del archivo es la fuente de verdad.

# Jugar online Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Dos usuarios de HOLOCRON juegan una partida virtual Premier BO1 completa en una sala privada desde móvil o computadora.

**Architecture:** Forceteki fijado a una revisión, detrás de un servicio Node propio y persistente. Companion incorpora cliente, mazos, sala y tablero táctil; solo recibe la vista del jugador autenticado. La primera beta recupera desconexiones al proceso vivo y registra explícitamente partidas interrumpidas tras un reinicio.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Supabase Auth, Node 24, Socket.IO, Forceteki `139c14a240b75498b403ccdb06144a136972ecb6`, almacenamiento local persistente del servicio para salas/resultados.

## Global Constraints

- Premier casual BO1 (una partida por sala), 1 contra 1 y salas privadas.
- Conservar tarjeta de jugador, `/mesa`, `/arena`, laboratorio, torneos y estadísticas existentes.
- Código nuevo y rótulos en español; sin `any` ni `@ts-ignore` en código propio.
- El servidor aplica reglas, congela mazos y entrega vistas privadas por usuario.
- Rechazar cartas no implementadas, identidades del cliente y acciones no permitidas.
- Las cuentas de prueba pertenecen a un entorno local de desarrollo, nunca a producción.
- Sin SQL, DNS, despliegue de producción ni datos de prueba en Supabase real.
- Mantener licencia/atribución MIT del motor; no contactar servicios privados de Karabast.
- Tablero móvil vertical funcional; todas las elecciones que el motor ofrezca deben poder resolverse.

---

### Task 1: Motor real desacoplado

**Files:** `services/juego/motor.mjs`, `services/juego/preparar-motor.mjs`, `services/juego/motor-lock.json`, `services/juego/fixtures/`, `services/juego/tests/motor.test.mjs`, `services/juego/THIRD_PARTY_NOTICES.md`.

**Interfaces:** exportar `crearProveedorMotor()` asíncrono que devuelve:

```js
// jugador = { id: string, nombre: string, mazo: MazoMotor }
// MazoMotor = { leader:{id,count}, base:{id,count}, deck:[{id,count}], sideboard:[{id,count}] }
// errores = [{ codigo: string, mensaje: string, cartas?: string[] }]
// comando = { nombre: string, args: unknown[] }
const proveedor = {
  version: '139c14a240b75498b403ccdb06144a136972ecb6',
  validarMazo: async (mazo) => errores,
  crearPartida: async ({ id, jugadores, alCambiar, alFallar }) => motor,
};
// motor.vista(usuarioId) -> estado serializable upstream privado
// motor.ejecutar(usuarioId, comando) -> void | Promise<void>
// motor.resultado() -> null | { ganadorId: string|null, motivo: string }
// motor.cerrar() -> void
```

- [x] Preparar código upstream fijado y reproducible fuera del bundle Vite; conservar avisos de licencia. Usar caché gitignorada, sin versionar `node_modules` ni artefactos de compilación.
- [x] Instanciar `Game`, `Deck` y datos de cartas mediante adaptador propio, sin arrancar GameServer ni integraciones AWS/NextAuth.
- [x] Validar formato, límites, IDs y habilidades implementadas antes de construir jugadores. Exportar dos mazos legales compatibles para pruebas locales.
- [x] Despachar solamente comandos permitidos (`cardClicked`, `menuButton`, `perCardMenuButton`, `statefulPromptResults`, `concede` y elecciones adicionales comprobadas), con validación de argumentos y actor según prompt.
- [x] Probar setup real, selección de recursos, juego de unidad, ataque/objetivo, habilidad con elección, concesión/victoria y vistas distintas de ambas manos.

Prueba inicial reproducible (usar mazos del fixture una vez descargados sus datos):

```js
import assert from 'node:assert/strict';
const motor = await proveedor.crearPartida({id:'partida-prueba', jugadores, alCambiar(){}, alFallar(e){throw e;}});
assert.notDeepEqual(motor.vista(jugadores[0].id), motor.vista(jugadores[1].id));
assert.equal(motor.resultado(), null);
await motor.ejecutar(jugadores[0].id, {nombre:'concede', args:[]});
assert.equal(motor.resultado().ganadorId, jugadores[1].id);
motor.cerrar();
```

Run: `npm --prefix services/juego run preparar-motor` y `npm --prefix services/juego run test:motor`. Deben ejecutarse sin cuentas, secretos ni servicios de Karabast.

### Task 2: Servicio autenticado de salas

**Files:** `services/juego/servidor.mjs`, `auth.mjs`, `salas.mjs`, `persistencia.mjs`, `package.json`, `package-lock.json`, `.env.example`, `Dockerfile`, `tests/salas.test.mjs`.

**Consumes:** proveedor de Task 1 inyectable en pruebas. **Produces:** HTTP JSON `/health`, `/api/configuracion`, `/api/salas`, `/api/salas/:codigo`, `/api/salas/:codigo/unirse`, `/api/salas/:codigo/mazo`, `/api/salas/:codigo/preparado`, `/api/salas/:codigo/salir`, `/api/salas/:codigo/acciones`.

```js
// Sala: { codigo, estado:'espera'|'jugando'|'finalizada'|'interrumpida', revision,
//   jugadores:[{id,nombre,preparado,conectado,mazoNombre}], resultado, juego?: unknown }
// crear/unirse/cambiar mazo body: { mazo: MazoMotor, mazoNombre: string }
// preparado body: { preparado: boolean }
// acción: { id: UUID, revision: number, comando: {nombre:string,args:unknown[]} }
// respuesta correcta: { sala: Sala }; errores HTTP: {error:{codigo,mensaje}}
// Socket.IO path /ws, auth {token,codigo}; emite 'sala' con {sala} personalizada.
```

- [x] Validar token Supabase y derivar ID/perfil en servidor. Modo local explícito con usuarios aislados, prohibido en producción y escuchando solo loopback.
- [x] Crear/entrar/confirmar atómicamente en proceso único; máximo dos asientos y una partida activa por cuenta. Código criptográfico, límites de solicitudes y expiración de salas vacías.
- [x] Verificar mazos antes de guardarlos, congelarlos al iniciar y omitir mazo/mano rival de HTTP y Socket.IO.
- [x] Serializar comandos por sala, deduplicar por usuario+UUID con payload inmutable; rechazar revisión obsoleta y devolver estado autorizado. No reintentar una jugada con otro UUID.
- [x] Reconexionar mismo asiento, tolerar red móvil sin inferir derrota por presencia; persistir metadatos/resultados, marcar partidas activas como interrumpidas al reiniciar y drenar al apagar.
- [x] Probar tercer usuario, token inválido, unión simultánea, doble comando, revisión vieja, reconexión, reinicio y resultados idempotentes.

```js
const respuestas = await Promise.all([unirse('usuario-b'), unirse('usuario-c')]);
assert.deepEqual(respuestas.map(r => r.status).sort(), [200, 409]);
const repetida = await enviarAccion(accionOriginal);
assert.equal(repetida.sala.revision, respuestaOriginal.sala.revision);
assert.equal((await leerSala('tercero')).status, 403);
```

Run: `npm --prefix services/juego test`. Las pruebas usan puertos efímeros, directorios temporales y proveedor inyectado, además de integración con motor real.

### Task 3: Sala y tablero de Companion

**Files:** `src/features/jugar/{tipos,cliente,mazos,vistaJuego}.ts`, `{JugarPage,TableroJuego,OpcionesJuego,BancoJugar}.tsx`, `jugar.css`; `scripts/jugar-mazos.test.mts`, `scripts/jugar-vista.test.mts`.

**Consumes:** contrato HTTP/Socket.IO de Task 2 y estado privado del motor de Task 1. **Produces:** named export `JugarPage`, banco DEV `BancoJugar`; mazos convertidos a IDs de edición/número mediante catálogo, sin confiar en costes/texto del navegador.

- [x] Obtener sesión válida para HTTP/socket; manejar refresco y limpieza al cambiar cuenta. Cargar mazos propios cloud, permitir importación explícita validada y explicar incompatibilidades.
- [x] Mostrar entrada sin configurar el servicio, error recuperable, crear/unirse, preparación, partida en curso y resultado. Evitar anunciar éxito si el servidor no confirma.
- [x] Interpretar estado upstream desde `unknown` con tipos propios; separar zonas/manos, cartas agotadas, daño, base/líder, recursos y prompt. Nunca inventar estado reglamentario.
- [x] Implementar elecciones de menú, selección de cartas, distribución, listas/números y selección múltiple según los contratos reales. Selección por toque y ampliación accesible; todos los controles desactivados al perder conexión o enviar comando.
- [x] Guardar únicamente el código de sala por cuenta para volver; manos/mazos ocultos no van a almacenamiento persistente del navegador. Recuperar revisiones omitidas con GET.
- [x] Banco de desarrollo con dos identidades aisladas contra el mismo servicio real y fixture de mazos; nunca importarlo fuera de DEV.

```ts
assert.throws(() => convertirMazo(mazoConCartaDesconocida, catalogo));
assert.equal(convertirMazo(mazoConDosImpresiones, catalogo).deck[0].count, 3);
assert.equal(normalizarVista(vistaJugadorA, 'b').jugador, null);
```

Run: `npx tsx scripts/jugar-mazos.test.mts` y `npx tsx scripts/jugar-vista.test.mts`. Probar en navegador 390×844 y 1280×900 con dos sesiones independientes y partida completa real.

### Task 4: Integración, revisión y entrega

**Files:** `src/App.tsx`, `src/components/layout/SideNav.tsx`, ubicación apropiada en menú móvil, `.gitignore`, `.vercelignore`, `.env.example`, `AGENTS.md`, `CLAUDE.md`, `BITACORA.md`, `services/juego/README.md`.

- [x] Registrar rutas lazy `/jugar`, `/jugar/sala/:codigo`, `/jugar/partida/:codigo` y banco DEV. Conservar HomePage/tarjeta y redirecciones históricas.
- [x] Mantener servicio/fixtures fuera de build/precache; documentar configuración, arranque, datos persistentes, compatibilidad, drenaje y límites de beta.
- [x] Ejecutar `npm run build`, `npm run lint`, pruebas anteriores y revisión independiente de privacidad, comandos y UX móvil. Corregir hallazgos y repetir solo pruebas afectadas.
- [x] Actualizar documentación compartida con evidencia real, registrar límites de reinicio/hosting y crear commits `[chatgpt]` y PR de borrador. No fusionar a `main` ni anunciar servicio disponible en producción.

## Registro de progreso

- Diseño aprobado; investigación local y upstream terminada.
- Tasks 1–3 implementadas y revisadas. Motor 6/6; servicio 23/23, incluyendo integración real y límite concurrente de sockets. Frontend: 7/7 SDK de conexión más cliente/mazos y 10 vistas + 16 prompts nativos.
- Build/lint Node24 pasan (0 errores, 6 avisos previos). DEV/banco, tokens ficticios, catálogo y servicio excluidos del bundle/precache.
- QA navegador: 2 usuarios; preparación, recursos, unidades, Han, ronda, ataque a base (2 daño), ampliar, recarga, concesión y otra partida. Móvil390×844; escritorio1280×900. Sin teléfono físico ni cuentas/escrituras reales.
- Hallazgos P1 motor perCardMenu, P2 reserva simultánea sockets y P2 respuesta tardía al iniciar otra partida corregidos y cerrados por revisión independiente.
- Documentación actualizada; commits de implementación `7bb3422` y `032db71`. PR borrador #3: https://github.com/Neldark15/swu-companion/pull/3. Sin publicación de producción.

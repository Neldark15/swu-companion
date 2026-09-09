# Servicio de partidas de HOLOCRON

Servicio Node persistente para salas privadas **Premier BO1, uno contra uno**. Usa Forceteki local como autoridad de reglas y envía a cada usuario únicamente su vista de la partida. Esta documentación describe la implementación y su ejecución; no implica que el servicio esté publicado.

## Desarrollo local

Requiere **Node 24**, npm y Git. `node:sqlite` viene incluido en Node 24; no hay que instalar un servidor de base de datos. Ejecutar desde la raíz del repositorio:

```sh
node --version
npm ci --prefix services/juego
npm --prefix services/juego run preparar-motor
cp services/juego/.env.example services/juego/.env
npm --prefix services/juego run dev
```

`preparar-motor` descarga la revisión Git fijada, verifica su lock de dependencias y el SHA-256 del catálogo incluido, instala dependencias y compila en `.motor/`. Necesita acceso a GitHub y npm; no inicia servicios de Karabast ni vuelve a descargar el catálogo de Fantasy Flight Games. La preparación elimina primero el sello `.motor/preparado.json`, para que una preparación incompleta no se use como válida. No ejecutarla mientras este mismo directorio sirve partidas.

El servicio escucha en **http://127.0.0.1:3001**. `npm run dev` activa `JUEGO_DEV_AUTH=1`; ese modo exige bind `127.0.0.1` o `::1` y está prohibido con `NODE_ENV=production`. No acepta tokens Supabase en ese modo.

| Token local | ID del jugador | Nombre |
| --- | --- | --- |
| `dev:alpha` | `dev-alpha` | Piloto Alfa |
| `dev:beta` | `dev-beta` | Piloto Beta |
| `dev:gamma` | `dev-gamma` | Piloto Gamma |

En otra terminal, instalar las dependencias del frontend y ejecutar Vite desde la raíz:

```sh
npm ci
npm run dev:jugar
```

El shell de la aplicación necesita su configuración habitual de Supabase en `.env.local`; el banco no crea cuentas ni escribe partidas en Supabase. Abrir **http://127.0.0.1:5173/banco-jugar?jugador=alpha**, elegir un mazo de ejemplo y crear la sala. El enlace «Abrir rival en otra pestaña» abre Beta con el código; Gamma permite comprobar el rechazo del tercer usuario. `dev:jugar` añade solo el proxy de imágenes públicas `/api/img` hacia HOLOCRON, porque Vite no ejecuta las funciones de Vercel; conserva el resto de la configuración habitual.

`/banco-jugar` solo existe bajo Vite DEV y actualmente apunta de forma fija a `http://127.0.0.1:3001`. Si Vite elige otro puerto, añadir su origen exacto a `JUEGO_ORIGENES` y reiniciar el servicio. El banco loopback no permite probar desde otro dispositivo mediante la IP de la computadora.

La ruta normal `/jugar` usa `VITE_JUEGO_URL` en el `.env.local` de la raíz, por ejemplo `http://127.0.0.1:3001` para un servicio local con la autenticación adecuada. La ruta normal usa la sesión Supabase del usuario; para los tokens locales usar el banco. Reiniciar Vite después de cambiar sus variables. En un build, `VITE_JUEGO_URL` queda incorporada al bundle.

## Configuración del servicio

`npm start` y `npm run dev` leen `services/juego/.env` mediante Node. Las variables existentes del proceso prevalecen sobre ese archivo.

| Variable | Valor inicial / función |
| --- | --- |
| `JUEGO_HOST` | `127.0.0.1`; usar una interfaz apropiada para el proxy en un entorno alojado. |
| `JUEGO_PORT` | `3001`. |
| `JUEGO_ORIGENES` | Lista de orígenes exactos separados por coma; inicialmente `http://localhost:5173,http://127.0.0.1:5173`. Sin comodines. |
| `JUEGO_DATOS` | Archivo SQLite. Sin variable: `.datos/salas.sqlite` dentro del servicio. El ejemplo usa `./.datos/salas.sqlite`, relativo al directorio de trabajo. Usar ruta absoluta en un entorno alojado. |
| `JUEGO_DEV_AUTH` | `0` normalmente; `1` habilita únicamente las tres identidades locales. |
| `SUPABASE_URL` | URL del proyecto Supabase que autentica a los usuarios. |
| `SUPABASE_ANON_KEY` | Clave pública anon del mismo proyecto. No usar `service_role`. |
| `NODE_ENV` | Usar `production` fuera del banco local. |

Con autenticación Supabase, el servicio verifica el token contra `/auth/v1/user` y consulta `profiles.id,name` con ese mismo token y sus permisos RLS. ID y nombre se derivan del servidor; no acepta identidades del cuerpo de la solicitud. Se necesita un perfil legible para la sesión autenticada. Esta integración no requiere crear cuentas de prueba ni cambiar SQL.

Para un entorno alojado, configurar `JUEGO_DEV_AUTH=0`, `NODE_ENV=production`, URL y anon de Supabase, `JUEGO_ORIGENES` con los orígenes **HTTPS** del frontend autorizado y `VITE_JUEGO_URL` con el origen **HTTPS** del servicio. El proceso Node sirve HTTP: el proxy debe terminar TLS y reenviar HTTP y Socket.IO en `/ws`, incluidos polling y upgrade WebSocket. El frontend rechaza HTTP remoto. Esto es configuración pendiente del entorno, no una instrucción para publicar esta rama.

El límite por IP usa la dirección del socket TCP y no confía en `X-Forwarded-For`: detrás de un proxy compartido, las solicitudes pueden compartir ese límite. Tenerlo en cuenta al dimensionar y configurar el entorno; no habilitar réplicas para sortearlo.

## Docker

Construir con **`services/juego` como contexto**, por ejemplo desde la raíz:

```sh
docker build -t holocron-juego:local services/juego
```

La imagen usa Node 24, prepara el motor durante el build y ejecuta el servicio como usuario `node`. `.dockerignore` excluye credenciales, dependencias locales, caché del motor y datos SQLite.

Para ejecutar una imagen construida, preparar primero `services/juego/.env` con los valores reales del entorno descritos arriba. Ejemplo de comando con publicación del puerto únicamente en loopback del host, para un proxy local:

```sh
docker run --rm --name holocron-juego \
  --env-file services/juego/.env \
  -e NODE_ENV=production \
  -e JUEGO_DEV_AUTH=0 \
  -e JUEGO_HOST=0.0.0.0 \
  -e JUEGO_DATOS=/datos/salas.sqlite \
  -p 127.0.0.1:3001:3001 \
  -v holocron-juego-datos:/datos \
  holocron-juego:local
```

El volumen conserva SQLite y sus archivos WAL. Mantener permisos de escritura para el usuario `node`. La receta Docker está incluida; las pruebas automatizadas descritas abajo no equivalen a una validación de despliegue de la imagen.

## Persistencia y operación

**Un proceso por archivo/volumen.** Las salas, sus colas de comandos, mazos y motores viven en memoria del proceso. No usar Node cluster, varios workers ni réplicas concurrentes contra el mismo archivo. SQLite no coordina las salas entre procesos y el arranque de otro proceso puede marcar registros activos como interrumpidos.

SQLite usa WAL, `synchronous=FULL` y transacciones para guardar metadatos de sala y resultados. El resultado es idempotente por código de sala. No persiste tokens, mazos, manos, cartas ni el estado interno del motor. Al finalizar, se cierra el motor; sus últimas vistas privadas se conservan solo en memoria.

Una pérdida de red permite reconectar al mismo asiento mientras siga vivo el proceso. La presencia no concede victorias ni derrota por timeout. Al **reiniciar**, tanto las salas guardadas en `espera` como las que estaban `jugando` pasan a `interrumpida`, sin ganador; las finalizadas conservan su resultado. No se recupera la partida jugable ni la mano tras el reinicio. Los recibos de deduplicación también son solo memoria.

`SIGINT` y `SIGTERM` activan el cierre: se rechazan nuevas operaciones, se detiene la limpieza periódica, se cierra Socket.IO/HTTP y se espera su cierre; después se drena la cola de salas, se marcan las partidas en curso como interrumpidas y se cierran motores y SQLite. No existe un período para que los jugadores terminen la partida ni un plazo propio de apagado forzado. `SIGKILL` omite ese drenaje; el siguiente arranque interrumpe los registros activos que quedaron guardados.

Para respaldar la base con un procedimiento simple, detener primero el único proceso y copiar su directorio de datos. Una copia aislada del archivo SQLite mientras está en uso puede omitir datos del WAL.

Límites implementados por defecto:

- Dos asientos por sala y una sala en `espera` o `jugando` por cuenta.
- Cinco conexiones por usuario, contando admisiones pendientes; rechazo y desconexión liberan el cupo.
- 240 solicitudes autenticadas por usuario y 480 por IP en ventanas de 60 segundos. Los handshakes también consumen límites; HTTP informa 429 al superarlos y una conexión de transporte puede ser rechazada antes de autenticar.
- JSON HTTP y mensajes de transporte: máximo 64 KiB. HTTP tiene `requestTimeout` de 15 segundos y `headersTimeout` de 10 segundos.
- Máximo 10.000 identificadores de acción por sala. Usuario + UUID identifican un payload inmutable; una respuesta perdida se reintenta con el mismo UUID y cuerpo. Una revisión obsoleta devuelve 409.
- Revalidación de Auth de sockets cada 60 segundos. El cliente obtiene token fresco al reconectar, espera un GET de estado antes de habilitar acciones y limita la espera entre reintentos a cinco segundos.
- Limpieza cada 60 segundos: elimina salas en `espera` sin sockets conectados cuya última actualización supera 30 minutos. Puede expirar una sala con asientos ocupados pero desconectados. No expira partidas en curso ni adjudica ganadores; no hay purga automática de resultados finalizados.

## Comprobaciones y API

`GET /health` devuelve el estado del proceso y `motorDisponible`. Un HTTP 200 en esa ruta **no garantiza** que el motor esté preparado. `GET /api/configuracion` informa `disponible`, versión, formato y modo. Sin motor preparado, la creación de salas devuelve 503 y no se ofrece una partida ficticia.

HTTP usa `Authorization: Bearer TOKEN`. Las respuestas de sala tienen forma `{sala}`; los errores, `{error:{codigo,mensaje,detalles?}}`. Rutas de sesión: `/api/usuario`, `/api/salas/mia`; crear: `POST /api/salas`; leer: `GET /api/salas/:codigo`; mutaciones: `POST` a los sufijos `unirse`, `mazo`, `preparado`, `salir` y `acciones`. `/api/mazos-ejemplo` solo está habilitada en DEV autenticado. Socket.IO usa `path: '/ws'`, auth `{token,codigo}` y evento `sala` con la vista privada. Los comandos se envían por HTTP.

Desde la raíz, con el motor ya preparado:

```sh
npm --prefix services/juego test
npm --prefix services/juego run test:motor
npx tsx --test scripts/jugar-conexion.test.mts
npx tsx scripts/jugar-cliente.test.mts
npx tsx scripts/jugar-mazos.test.mts
npx tsx scripts/jugar-vista.test.mts
npm run build
npm run lint
```

La suite del servicio tiene **23 pruebas**; incluye integración HTTP/Socket.IO con el motor real y doce handshakes concurrentes con solo cinco admisiones. Sin `.motor/preparado.json`, las integraciones con motor real de esa suite se omiten: preparar primero para obtener una verificación completa. Las **6 pruebas del motor** cubren legalidad, privacidad, elecciones, partida hasta victoria, Han y la regresión de Improvise. Las **7 pruebas del SDK de conexión** usan HTTP/Socket.IO efímeros y EventTarget exclusivamente dentro del programa de prueba; cubren token fresco, GET fallido, cancelación, logout y respuestas tardías.

Para ejecutar específicamente con Node 24 aunque el Node del shell sea otro, después de instalar dependencias:

```sh
npx --yes --package=node@24 node --test services/juego/tests/salas.test.mjs
npx --yes --package=node@24 node --test services/juego/tests/motor.test.mjs
npx --yes --package=node@24 node --import tsx --test scripts/jugar-conexion.test.mts
```

Estas pruebas no requieren cuentas reales ni escriben datos en Supabase. La prueba con servidor efímero no mide rendimiento en teléfonos físicos.

## Motor, catálogo y legalidad

[El lock del motor](./motor-lock.json) fija Forceteki a **`139c14a240b75498b403ccdb06144a136972ecb6`** y el snapshot oficial normalizado del **8 de septiembre de 2026**, con 2.358 cartas y verificación SHA-256. El validador aplica el Premier `current` de ese pin: JTL, LOF, IBH, SEC, LAW y ASH; considera reimpresiones por identidad, suspensión de Cad Bane y límites especiales de copias del lock.

Esta legalidad no se actualiza automáticamente con publicaciones futuras. Actualizar pin, catálogo o reglas exige revisar juntos `motor-lock.json`, la validación y las pruebas. Un mazo legal en papel puede ser rechazado si incluye cartas cuyo comportamiento todavía no implementa esta revisión. Los fixtures comprobados no garantizan compatibilidad con todas las cartas, mazos o interacciones.

Forceteki conserva su licencia MIT y atribución en [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) y en la caché de código original. [Los fixtures](./fixtures/LEEME.md) describen el catálogo y las vistas locales. La licencia del motor no concede derechos sobre ilustraciones, marcas o cartas de Fantasy Flight Games/Lucasfilm. El adaptador no contacta servicios privados de Karabast.

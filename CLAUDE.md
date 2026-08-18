# HOLOCRON SWU — Contexto para Claude Code

> Este archivo lo lee Claude Code automáticamente al abrir el repo. Mantenerlo al día.

---

## ¿Qué es este proyecto?

**HOLOCRON SWU** (a.k.a. SWU Companion) es una Progressive Web App (PWA) para el juego de cartas *Star Wars: Unlimited*. Permite a los jugadores gestionar colecciones, llevar trackers de partidas, organizar torneos, ver rankings, explorar la comunidad global, y un sistema completo de gamificación (XP, niveles, logros, misiones, arena, melee.gg).

- **Producción:** https://swusv.com
- **Alias Vercel:** https://swu-companion-steel.vercel.app, https://www.swusv.com
- **GitHub:** https://github.com/Neldark15/swu-companion (público)
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime + PostgREST)
- **Hosting:** Vercel (auto-deploy desde rama `main`)

---

## Stack tecnológico real

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | React + TypeScript + Vite | React 19, Vite 7, TS 5.9 |
| PWA | vite-plugin-pwa | 1.2 |
| Estado global | Zustand | 5.x |
| Caché local | Dexie (IndexedDB) | 4.x |
| Backend | Supabase JS | 2.99 |
| Estilos | Tailwind CSS | 4.x (`@tailwindcss/vite`) |
| Animación | framer-motion | 12.x |
| Iconos | lucide-react + custom `SWIcons.tsx` | 0.575 |
| Routing | React Router | 7.x (lazy + Suspense) |
| Deploy | Vercel | Node 24.x |

---

## Estructura de carpetas

```
.
├── CLAUDE.md                  ← este archivo
├── README.md
├── package.json
├── vite.config.ts
├── tsconfig*.json
├── eslint.config.js
├── index.html
├── .env.example               ← plantilla (sin valores reales)
├── .env.local                 ← valores reales (gitignored)
├── .nvmrc                     ← versión Node
│
├── public/                    ← assets estáticos
│   ├── avatars/
│   ├── icons/aspects/
│   ├── icon-*.png
│   └── export/                ← datos estáticos de cartas (JSON)
│
├── supabase/
│   └── migrations/            ← TODOS los .sql del proyecto
│
└── src/
    ├── App.tsx                ← router con 46 rutas lazy + AuthGate
    ├── main.tsx               ← entry point
    ├── index.css              ← Tailwind directives
    │
    ├── components/
    │   ├── AuthGate.tsx       ← guard de rutas autenticadas
    │   ├── CardImage.tsx      ← imagen de carta con fallback
    │   ├── PageTransition.tsx ← HolocronLoader
    │   ├── SWIcons.tsx        ← íconos custom del juego
    │   ├── icons/
    │   ├── layout/
    │   │   ├── AppLayout.tsx
    │   │   └── SideNav.tsx    ← navegación principal
    │   └── ui/                ← componentes compartidos (NotificationBell, etc.)
    │
    ├── features/              ← 17 módulos de feature
    │   ├── arena/             ← /arena, /arena/log, /history, /stats, /feed
    │   ├── cards/             ← /cards, /cards/:id
    │   ├── collection/        ← /collection (Mi Botín), /explore, /u/:userId
    │   ├── community/         ← /community (Comunidades)
    │   ├── decks/             ← /decks, /decks/:id (builder)
    │   ├── espionaje/         ← /espionaje/:userId + DeckVisualViewer
    │   ├── events/            ← lobby, join, create, tournaments (Swiss + elim)
    │   ├── galaxy/            ← /galaxy (La Galaxia)
    │   ├── home/              ← /, ManageNews
    │   ├── melee/             ← /melee (Melee.gg integration)
    │   ├── missions/          ← /misiones
    │   ├── play/              ← /play (tracker en vivo)
    │   ├── profile/           ← /profile + sub-componentes (ProfileFrame, TriviaSection...)
    │   ├── rank/              ← /rank (Consejo Jedi)
    │   ├── settings/          ← /settings
    │   └── utilities/         ← /utilities
    │
    ├── hooks/
    │   ├── useAuth.ts         ← Zustand: currentProfileId, supabaseUser, signOut
    │   ├── useMatchPersistence.ts
    │   ├── useSettings.ts
    │   └── useUIStore.ts
    │
    ├── services/              ← ~30 servicios
    │   ├── supabase.ts        ← cliente Supabase configurado
    │   ├── swuApi.ts          ← API de cartas (Dexie cache + network fallback)
    │   ├── sync.ts            ← rankings globales (patrón de referencia para joins)
    │   ├── galaxyService.ts   ← La Galaxia (gotcha de single<T>)
    │   ├── collectionService.ts, collectionImport.ts, collectionExport.ts
    │   ├── communityService.ts, cosmeticsService.ts
    │   ├── tournamentCloud.ts, tournamentPoints.ts, swiss.ts, elimination.ts
    │   ├── arenaService.ts, meleeService.ts, missionService.ts
    │   ├── deckImportExport.ts, deckValidator.ts
    │   ├── gamification.ts, trivia.ts, news.ts, giftService.ts
    │   ├── notificationService.ts, relationshipService.ts
    │   ├── playerSearch.ts, pricing.ts, translations.ts, crypto.ts
    │   ├── events.ts
    │   └── db/                ← Dexie schema
    │
    ├── data/
    │   └── regions.ts         ← continentes + países
    │
    └── types/
        └── index.ts           ← tipos TS compartidos
```

---

## Navegación (SideNav.tsx)

### Móvil: 5 destinos ([TabBar.tsx](src/components/layout/TabBar.tsx))
`Inicio · Explorar · Binder · Mercado · Perfil`. Las otras 11 rutas viven en [MoreNav.tsx](src/components/layout/MoreNav.tsx), agrupadas por intención (Jugar / Construir / Comunidad) dentro de Perfil. **En escritorio el sidebar sigue mostrando las 16** — no colapsarlo.

### Escritorio: sidebar completo (SideNav.tsx)

**Principal:**
- `/` Base (Hexagon) — centro de mando
- `/play` Duelo (Swords) — tracker en vivo
- `/arena` Holocrón (DatapadIcon) — registro de duelos
- `/melee` Circuito (MedalIcon) — Melee.gg
- `/laboratorio` Laboratorio (LabIcon) — simulador de mazos contra el meta
- `/rulings` Rulings (HolocronIcon) — reglamento oficial, PÚBLICO
- `/events` Torneo (MandoTrophyIcon) — eventos organizados
- `/profile` Mi Perfil

**Secundaria:**
- `/collection` Mi Botín (CargoIcon)
- `/explore` Contrabando (BountyIcon)
- `/espionaje` Espionaje (SpyIcon)
- `/misiones` Misiones (DeathStarIcon)
- `/decks` Mis Decks (DeckCardsIcon)
- `/galaxy` La Galaxia (StarfighterIcon)
- `/community` Comunidades (RebelIcon)
- `/rank` Consejo Jedi (BeskarIcon) — leaderboard
- `/cards` Buscar Cartas (HolonetIcon)
- `/contador` Contador (ChanceCubeIcon) — duelo en mesa real (la vieja `/utilities` redirige acá; la moneda se retiró, `Dice3D` vive dentro del Contador)

---

## Gotchas críticos

### 1. Joins one-to-many de Supabase devuelven arrays
Cuando se hace `select('*, player_stats(*)')` desde `profiles`, `player_stats` llega como **array** (no como objeto), incluso si la relación lógica es 1:1. Causa silenciosa de `undefined` en todos los campos.

```ts
// ✅ CORRECTO
.select('*, player_stats!inner(xp, wins, losses, level)')
const stats = single(row.player_stats)  // helper en galaxyService.ts

// ❌ INCORRECTO (campos undefined sin error)
.select('*, player_stats(xp, wins, losses, level)')
const stats = row.player_stats as PlayerStats
```

Helper canónico:
```ts
function single<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null
  if (Array.isArray(val)) return val[0] ?? null
  return val
}
```

Patrón de referencia ya probado: `getGlobalLeaderboard()` en [src/services/sync.ts](src/services/sync.ts).

### 2. Cartas promo no están en Dexie local
Sets como JTLP no estaban en la DB local de Dexie y aparecían placeholders. Fix ya shippeado en [src/services/swuApi.ts](src/services/swuApi.ts):
- Cache memoria → Dexie → fallback de red en chunks de 8 → `loadFullDatabase()` si la base está incompleta.

Si reaparecen los placeholders, verificar que `loadFullDatabase()` se está disparando.

### 2b. El buscador es LOCAL-FIRST. El API ignora casi todos los filtros.
`searchCards()` **nunca** va al API. Verificado empíricamente: `/cards?aspect=Vigilance` devuelve una respuesta **byte a byte idéntica** a `/cards` sin filtro, y acepta valores inventados sin error. El API solo respeta `set`, `type` y `rarity`.

Antes existía una ruta al API para el modo "explorar" y producía dos bugs: el contador mostraba el total del API (9,057) con 3 filas debajo, y "Cargar más" mandaba como offset la cantidad ya filtrada, repitiendo cartas.

**No reintroducir la ruta al API.** Todo se resuelve sobre las 9,057 cartas en Dexie.

### 2c. Centinela de completitud (`isDatabaseComplete`)
La base local es la única fuente de verdad, así que **no alcanza con "hay algo"**. El control viejo era `count < 2000`: una descarga cortada en 4,500 lo pasaba. Ahora se guardan en localStorage:

- `swu_db_data_version` — `DB_DATA_VERSION` en swuApi.ts. **Súbela** cuando la ingesta empiece a calcular un campo nuevo; las cachés viejas se reconstruyen solas sin tocar el esquema de Dexie.
- `swu_db_expected_total` — cuántas cartas dijo haber guardado la última carga exitosa.

### 2d. `isCanonical` vs `isCollectible` — parecidos, NO intercambiables
El 74% de las 9,057 filas son impresiones alternativas de la misma carta.

- **`Card.isCanonical`** (buscador, calculado en `markCanonical`): "¿es la fila que representa a esta carta?" → 2,316. Rescata las 2 cartas que no tienen ninguna impresión Standard (Zam Wesell "Not What She Seems", R2-D2 "Full Of Solutions") para que ninguna desaparezca de la búsqueda.
- **`isCollectible`** ([collectionProgress.ts](src/services/collectionProgress.ts)): "¿es parte del set oficial que se completa?" → exige `variantType === 'Standard'` → **2,089**.

Si el progreso usara `isCanonical`, TWI daría 258 y un playset completo se quedaría en 99% para siempre.

### 2e. `total_cards` de `/sets` está MAL — no usarlo como denominador
Verificado contra el export: SOR/SHD/TWI vienen +10 de más, LAW -6, y TWIP/SHDP/SORP llegan en `null`. Por eso el denominador del progreso se cuenta local.

### 2g. Actualización de la PWA: `skipWaiting()` va en el mensaje, NO en el arranque
El síntoma original fue que **cada deploy quedaba invisible** para quien tuviera la PWA instalada: el SW seguía sirviendo el `index.html` precacheado viejo. Medido: el navegador cargaba `index-BSkwW_Gc.css` con el servidor sirviendo `index-1H8UJgmK.css`.

**Esta sección decía lo contrario de lo que hace el código y hay que leerla con cuidado.** Hoy:

- `vite.config.ts` usa `registerType: 'prompt'` (no `'autoUpdate'`) con `injectRegister: null`; el registro es manual desde [UpdatePrompt.tsx](src/components/UpdatePrompt.tsx).
- [src/sw.ts](src/sw.ts) llama `clientsClaim()` en el arranque — eso **sí** hace falta.
- **`skipWaiting()` NO va en el arranque**, va dentro del listener de mensajes, **a propósito**: si se activara sola, nunca existiría una versión «en espera» y el aviso de actualizar no tendría de qué avisar. Peor: la recarga podía caer en medio de un torneo.

Si movés `skipWaiting()` al arranque «para arreglar la caché», rompés el aviso y volvés a las recargas sorpresa. El comentario en [sw.ts](src/sw.ts) lo explica en el sitio.

### 2h. `isCanonical` ≠ `isCollectible` ≠ oferta de intercambio
Tres preguntas parecidas con respuestas distintas:
- **`isCanonical`** — ¿es la fila que representa a esta carta en el buscador? → 2,316
- **`isCollectible`** ([collectionProgress.ts](src/services/collectionProgress.ts)) — ¿cuenta para el progreso del set? Exige `variantType === 'Standard'` → **2,089**
- **oferta** ([tradeService.ts](src/services/tradeService.ts)) — ¿se puede cambiar? Exige `for_sale` **o** `quantity > 3`. Tener una carta NO es ofrecerla: la colección más grande son 2,089 filas con `quantity=3` de una importación, y si "tener" contara, el cruce diría "Nelson tiene todo" para siempre.

### 2i. Intercambios sin mensajería y sin teléfonos
No hay tablas de mensajes ni números guardados. La app arma el mensaje con las cartas de las dos patas y usa `navigator.share` (o el portapapeles); el contacto lo elige la persona en su propio WhatsApp. Eso **elimina** la decisión de privacidad en vez de resolverla. No agregar un campo de teléfono sin volver a discutirlo.

### 2j. Grants a nivel de tabla vencen a los revokes por columna
Para tapar `profiles.email` a `anon` NO sirve `revoke select (email)`: un grant de SELECT a nivel de tabla cubre todas las columnas, presentes y futuras. Hay que `revoke select on <tabla>` y después `grant select (col1, col2, …)` con la lista explícita. Ver [privacy-close-email-and-honor-is-public.sql](supabase/migrations/privacy-close-email-and-honor-is-public.sql).

### 2k. tcgcsv.com NO manda CORS — los precios van por `/api/tcg-prices`
`tcgcsv.com` responde 200 por curl pero **sin `Access-Control-Allow-Origin`**, así que desde el navegador da `Failed to fetch`. Por eso la función de precios **nunca funcionó para ningún set** y `card_prices` estuvo en 0 filas desde su creación — el mapa de sets equivocado (`SOP`/`ALT`) era un segundo problema apilado encima, no la causa.

Toda petición a tcgcsv va por el proxy serverless [api/tcg-prices.ts](api/tcg-prices.ts). Es un proxy **cerrado**: solo categoría 79, un `groupId` de una lista fija y los recursos `products`/`prices`. **Si se agrega una expansión a `SET_GROUP_MAP` en [pricing.ts](src/services/pricing.ts), hay que agregar su groupId también a `ALLOWED_GROUPS` del proxy** o esa expansión devolverá 400.

Segunda trampa, dentro del mismo proxy: **tcgcsv responde 401 a toda petición sin `User-Agent`**, y el `fetch` de Node no manda uno (curl sí). Por eso el proxy recién desplegado daba 502 mientras el mismo URL a mano daba 200. El header va explícito en el `fetch` — no quitarlo.

La escritura a `card_prices` exige sesión (`auth.uid() IS NOT NULL`): un visitante anónimo ve precios igual —se guardan en Dexie— pero no llena la caché compartida, y en consola deja `saveCloudPrices: new row violates row-level security policy`. Es lo esperado, no un bug.

### 2l. Los torneos del meta son datos DE OTRA GENTE
La pestaña «Torneos» de `/meta` sale de [swu-competitivehub.com](https://www.swu-competitivehub.com) vía el proxy [api/swu-events.ts](api/swu-events.ts), que parsea su HTML (no tienen API: el `/wp-json/` está cerrado con 401).

Reglas que NO se pueden relajar sin volver a pensarlas:
- **Atribución visible con enlace** en toda vista que use esos datos. El campo `source` viaja en cada respuesta para eso.
- **No se expone `range=0` ni `12`.** El sitio los acepta, pero `range=0` es un único documento de ~1.5 MB sin paginar con todo el histórico: bajárselo es extracción de una parte sustancial de una base ajena. Solo 3 y 6 meses.
- **Rechazar, no degradar, y POR MODO.** La CDN cachea por URL completa, así que `?range=3&range=0` o `?x=1` serían claves nuevas y cada una un viaje al sitio ajeno. Cualquier parámetro inesperado, repetido o vacío es 400. Y la lista de permitidos es **por modo**: `slug` solo existe en `mode=evento`, `range`/`category` solo en `mode=lista`. Una lista global parece equivalente y no lo es — `?mode=lista&slug=loquesea` pasaba el filtro, nunca se validaba (el slug solo se mira en la rama de evento) y daba claves de CDN ilimitadas. Verificado en producción con `x-vercel-cache: MISS` por cada valor nuevo.
- **Toda descarga paga token, incluida la interna.** `knownSlugs()` se colaba gratis y ANTES del cubo, así que el 429 que veía el cliente ya había costado la petición; y sin promesa compartida, N invocaciones simultáneas eran N descargas de la lista entera.
- **Un parseo vacío con filas presentes es 502, no un 200.** Si la fuente cambia de formato y devolviéramos «no hay torneos», la CDN congelaría la sección vacía 6 h.
- **El slug se valida con una gramática de lista blanca** sobre el valor decodificado, y se re-codifica con hex en minúscula al pedirlo (hay 2 eventos con CJK en el slug). Sin esto, `slug=..%2f..%2fwp-admin` alcanza el WordPress ajeno desde nuestro dominio.
- Se contrasta el slug contra la lista publicada antes de tocar el origen: el regex solo no frena la amplificación, porque un slug inventado válido igual provoca un GET.

Trampas del HTML, todas medidas: 5 de 165 filas son `<tr class="highlight-event">` (un `/<tr>/` pelado las pierde); en las páginas de evento el rank viene **de peor a mejor**, así que la primera fila es el último puesto; el sitio escribe **«Unknow»** (sin n) cuando no hay mazo publicado, y la frase cambia entre la lista y el evento. Los `alt` de las dos imágenes son la fuente fiable, no el texto visible.

Y una que afecta a la UI: la mitad de las «bases» que publica la fuente no son cartas sino **clases** (`Blue`, `Red Force`, `Blue 27hp Multiaspect`) que agrupan bases equivalentes. Se muestra un representante y se rotula como clase — afirmar el nombre de una carta sería inventar cuál se jugó.

### 2m. El escáner reconoce por ARTE, no por el código impreso

`/scan` compara la **ilustración** contra `public/card-hashes.bin` (2.903 cartas, 249 KB, viaja con la app). El OCR del código quedó de respaldo. Medido: 0,4 ms contra 1-5 s, sin descargar nada de un CDN y sin conexión. Es lo que hacen los escáneres que funcionan — ManaBox lo declara explícitamente.

**Los dos redimensionadores TIENEN que dar el mismo resultado.** El índice se construye en Python ([scripts/build-card-hashes.py](scripts/build-card-hashes.py)) y se consulta en TypeScript ([src/services/cardHash.ts](src/services/cardHash.ts)). Los dos implementan a mano una DCT-II y un promedio por áreas. **No cambiarlos por `Image.resize` ni por `drawImage`**: el filtro de `drawImage` ni siquiera está especificado —cada navegador usa el suyo— y medido contra LANCZOS la MISMA imagen hasheaba con 58-92 bits de diferencia, casi todo el margen que separa una carta de otra. Con el promedio por áreas la diferencia es de **0 bits**. Si se toca uno, hay que tocar el otro y volver a medir la paridad.

**Rechazar es una función, no un fallo.** `MAX_DISTANCIA = 220` y `MARGEN_MINIMO = 28` salen de medir 25 cartas reales × 5 degradaciones: 110/125 aciertos, **1 equivocación**, y una mesa vacía se rechaza. Bajar los umbrales para «acertar más» convierte los silencios en respuestas inventadas, que es peor: la carta entra mal a la colección de alguien.

**Hyperspace comparte arte con Standard** (12-28 bits). Por eso el índice solo lleva `Standard`, `Showcase` y las Prestige — meter las demás solo añade colisiones que la imagen no puede resolver. Al reconocer se ofrecen las otras impresiones como alternativas para elegir; no se decide por la persona.

**El pie de la carta tiene tres formatos, no uno.** Verificado sobre las imágenes oficiales:

| Impresión | Pie impreso |
|---|---|
| Standard | `ASH·EN 10/264` |
| Hyperspace | `ASH·EN 265` — **sin denominador** |
| Token | `ASH·EN T01` |

Exigir `N/M` dejaba fuera las 2.095 Hyperspace y sus Foil. `parseCodigo` acepta el número suelto, pero **solo después del código del set**: suelto en cualquier parte del pie sería el año o la mitad de un logo.

**El bucle NO espera al OCR.** Estuvo gateado en `motor === 'listo'`, así que el escáner quedaba inerte durante toda la descarga de tesseract sin razón: el arte no lo usa. Son dos ritmos, 450 ms el arte y 2,5 s mínimo entre OCR.

### 2n. Melee: qué se toma, qué NO, y por qué el puesto solo miente

El historial de torneos del perfil sale de melee.gg por [api/melee-profile.ts](api/melee-profile.ts). Todo esto está **medido contra su servidor**, no supuesto:

- El endpoint es `POST /Profile/GetResults/{usuario}`, un DataTables del lado del servidor. Es **completamente público**: responde sin una sola cookie. Pero **sin el juego COMPLETO de las 7 columnas devuelve 500**.
- Su `robots.txt` permite `/Profile/` y **prohíbe** `/Decklist/View/`, `/Decklist/Index/` y todos los `/Tournament/Search*`. Los mazos se **enlazan, nunca se descargan**. Si alguna vez hace falta su contenido, se pide permiso primero.
- Pide `Crawl-Delay: 5`. Se respeta con un mínimo real de 5 s entre descargas salientes, además del cubo de tokens y la caché de CDN.
- **El User-Agent tiene que empezar con `Mozilla`.** Medido: `swu-companion/1.0 (+url)` → 403; `Mozilla/5.0 (compatible; swu-companion/1.0; +url)` → 200. Su filtro solo mira ese prefijo; no bloquea robots identificados a propósito. Se usa el formato estándar de robot bien portado —el mismo de Googlebot—, que sigue diciendo quiénes somos. **No cambiarlo por un UA de navegador inventado.**
- **Un usuario inexistente devuelve `200` con lista vacía**, igual que uno que nunca jugó. Y `/Profile/Index/{quien-sea}` devuelve **200 con una página de error** («Oops! Something Went Wrong»), así que el código de estado tampoco sirve. Se distingue por el campo oculto `User_UserName`, que la página real lleva y la de error no.
- Se filtra a `StarWarsUnlimited`: melee aloja muchos juegos y mezclar el Magic de alguien con su SWU haría que los agregados no signifiquen nada.

**El puesto, solo, miente.** Un puesto 399 en el Galactic Open es 399 de 1022 —mejor que media sala— y un puesto 3 en un Weekly Play puede ser 3 de 4. Toda la UI muestra siempre «puesto **de N**» más un percentil, y cuando la fuente no dice cuántos jugaron **no se inventa un percentil**: se deja el puesto y se calla.

**No hay forma de verificar de quién es una cuenta.** El perfil público de melee no expone ningún campo editable —ni biografía ni descripción, solo el usuario— así que no hay dónde poner un código de confirmación. Por eso `profiles.melee_verified` lo pone un admin a mano vía `set_melee_verified()`, la columna **no es escribible desde el cliente**, y la interfaz dice «sin verificar» en vez de dar la propiedad por cierta. Cambiar de usuario baja la insignia (disparador `trg_melee_username_cambio`).

### 2o. `profiles`: `role` NO es escribible desde el cliente

Había una escalada de privilegios: `UPDATE` estaba concedido a nivel de **tabla** —y un grant de tabla cubre todas las columnas, presentes y futuras, ver 2j— con la única política `USING (auth.uid() = id)` y sin `WITH CHECK`. Cualquiera logueado podía correr `update({ role: 'admin' }).eq('id', miId)` y quedar admin: crear torneos, mandar push a toda la comunidad y editar sedes.

Ahora `authenticated` tiene una **lista explícita** de columnas actualizables que **excluye `role` y `melee_verified`**, y `anon` no tiene `UPDATE` (con RLS nunca podría escribir nada, así que era riesgo sin uso). Ver [melee-profile-link-and-role-lockdown.sql](supabase/migrations/melee-profile-link-and-role-lockdown.sql).

**Si se agrega una columna que el cliente deba escribir, hay que añadirla a ese `grant update (...)`** o fallará con «permission denied for table profiles».

Efecto secundario que también estaba roto: la pantalla de administración cambiaba roles con un update directo que, por esa misma política `auth.uid() = id`, afectaba **0 filas** al tocar la fila de otro. PostgREST devuelve éxito con 0 filas, `error` venía null y la UI decía «listo» sin cambiar nada. Ahora va por `set_user_role()`, que comprueba admin del lado del servidor, impide cambiarse el rol a uno mismo y no deja quitar al último admin.

### 2p. Meta nacional: la ingesta de melee y sus trampas, todas medidas

La pestaña «SV» de `/meta` sale de tablas propias (`meta_tournaments`, `meta_standings`) que llena [api/meta-ingesta.ts](api/meta-ingesta.ts) — cron cada 6 h (`vercel.json`, protegido con `CRON_SECRET`) o a mano desde la vista. El descubrimiento parte de los `profiles.melee_username` enlazados: **un jugador enlazado abre el torneo completo** (16 en la sala → 16 arquetipos).

Reglas que no se pueden relajar sin re-medir:

- **`/Standing/GetRoundStandings` topa `length` en 500 exactos y recorta EN SILENCIO** (`length=2000` devuelve 500, byte a byte igual). Se pagina por `start` avanzando por lo que VINO (`desde += crudas`), no por lo pedido.
- **La ronda final es el último `.round-selector` de `#standings-round-selector-container`** — hay un SEGUNDO contenedor (`pairings-…`) que duplica ids. `roundId` **no es monotónico** (Round 11 = 1420227 > Finals = 1419188): ordenar por id da el campeón equivocado. Tampoco por `Points`: en playoffs el campeón puede tener menos puntos que el segundo. `Rank` es la única verdad, y es único **por ronda** — por eso la PK de `meta_standings` lleva `round_id`.
- **Hay torneos que melee reconoce pero cuya clasificación NO publica**: el LCQ 2026 declara 1.486 jugadores y 8 rondas cerradas y devuelve `recordsTotal: 0`. Eso es `SinClasificacion` → `descartado` en la cola, NO se reintenta y NO se marca `listo`. Con `total = 0`, `desde >= total` es `0 >= 0`: sin ese caso aparte, el torneo quedaba archivado como ingerido con cero filas.
- **El Crawl-Delay de 5 s es COMPARTIDO en la base** (`meta_fetch_lease` + RPC `meta_tomar_turno`/`meta_devolver_turno`): cada archivo de `api/` es una lambda con su propio estado de módulo, así que dos relojes en memoria le pegarían a melee cada 2,5 s. `melee-profile.ts` también toma ese turno (con su reloj viejo de respaldo si la RPC falla).
- **El arquetipo se parsea en el CLIENTE** ([meleeArchetype.ts](src/services/meleeArchetype.ts)) desde `decklist_name`; el servidor guarda el nombre crudo. Partir por `" - "` con los DOS espacios (9 cartas llevan guion pegado); el lado derecho se busca ENTERO — cortar la coma de `Nevarro City, Restored` da OTRA carta real. 13.860/13.860 combinaciones verificadas; ante duda devuelve `null`, y los `null` se CUENTAN (contador visible «listas sin arquetipo»): un 0 ahí con muestra grande delata un parser roto, no un éxito.
- **`ux_profiles_melee_username`** (único, sobre `lower()`): nadie puede reclamar el usuario de melee de otro — el cruce de «Los nuestros» es por nombre, así que reclamar el nombre era reclamar el historial. El 23505 se traduce en `guardarUsuarioMelee`.
- **Bajo quórum (20 listas) o con datos parciales NO se muestran porcentajes.** Conteos y «de N», siempre.
- La cola (`meta_ingest_queue`) y el turno tienen **RLS activa y CERO policies** a propósito: solo entra `service_role`. `intentos` se incrementa al RECLAMAR y se devuelve si la fila vuelve intacta; el único corte es el barrido SQL en `intentos >= 5`.

### 2u. Torneos: los organizadores SON los administradores, y el cierre reparte

Tras el torneo de Sonsonate (8/8/26) no quedó nada en los perfiles. Tres cosas,
todas medidas contra producción:

- **Nadie repartía nada al cerrar.** `finishTournament()` solo hacía
  `update official_events set status='finished'`. `awardTournamentFinish()`
  existe pero solo lo llama el tracker local viejo.
- **Y desde el cliente era imposible.** `player_stats` y `tournament_results`
  son `auth.uid() = user_id`: el organizador solo puede escribirse A SÍ MISMO.
  El tracker viejo recorre a todos desde su aparato — los updates ajenos
  afectan **0 filas SIN error** y los inserts rebotan dentro de un `catch`
  vacío. La prueba quedó en la base: del torneo de marzo hay UNA fila de
  resultado, la del propio organizador.
- Por eso el reparto vive en **`cerrar_torneo()`**, SECURITY DEFINER: es el
  único sitio desde donde se escriben stats de terceros sin abrirle RLS al
  cliente. Transición atómica `<> 'finished'` — llamarla dos veces NO premia
  dos veces (verificado: 4 filas, no 8).

**Un organizador que no sea admin NO PUEDE EXISTIR**, y no por costumbre: crear
un evento exige admin (`events_insert`), y `tournament_rounds`, `_pairings` y
`_standings` también. El panel corta a los no-admin de entrada. Toda capa nueva
tiene que usar **una sola regla: admin**; una rama `organizer_id = auth.uid()`
sugiere un rol que el sistema no puede producir.

Eso destapó el bug que de verdad bloqueaba: **`reg_select` no tenía rama de
admin**. Medido sobre el evento con 4 inscritos — Rodorigo (admin Y organizador)
veía 4, Nelson (admin, no organizador) veía **0**. Como
`initializeTournament()` lee esa tabla desde el cliente, cualquier admin que no
fuera el creador chocaba con «Se necesitan al menos 2 jugadores registrados»
teniendo 4. El jugador normal sigue viendo solo la suya (verificado: 1).

### 2q. El laboratorio mide con OTRO pool de cartas que la app

La app tiene la base **completa** (9.057 impresiones, 28 sets); el simulador del
VPS solo el **Premier vigente** (1.324 cartas: SEC, LAW, JTL, LOF, ASH). Medido:
**3.720 filas — el 41 %** — están fuera del pool del motor.

Por eso el buscador de mejoras proponía cartas rotadas (Clone Deserter, de SHD) y
el motor las rechazaba con «no existe en el Premier actual» *después* de gastar
el viaje. Los sets se **preguntan** al motor (`GET /pool` → `simApi.pool()`), no
se escriben en el cliente: la rotación cambia y una lista quemada quedaría
mintiendo. Si `/pool` falla no se filtra y el rechazo del motor sigue de red.

**Umbrales del laboratorio, todos medidos — no elegidos:**
- `EMPATE_TECNICO` 45-55: a 400 partidas/rival el margen es ±5. Dentro de esa
  franja NO se ordena por win rate: sería ordenar ruido.
- `DELTA_MINIMO` 5: el MISMO cambio de cartas midió **+3,0 a 100 partidas,
  +0,0 a 400 y −4,9 a 3.000** — el signo se da vuelta. Por debajo de 5 puntos
  un delta no se reporta como mejora; se cuenta aparte y se dice.
- El motor **no rastrea cartas**: agrega por partida (ganador, rondas, vida de
  las bases). Nunca afirmar que una carta «falla»; solo «cambiar X por Y midió
  N puntos contra tal rival».
- `/probar` exige mazos de **50 cartas exactas** (tope duro de swusim.py): los
  de base Data Vault (mínimo 66) no pueden usar el probador. Se avisa, no revienta.

### 2r. RULLINGS: los datos NO pueden vivir en `public/rulings/`

`/rulings` sirve el Comprehensive Rules **v8.0 (7/8/26)** parseado por
[scripts/build-rulings.py](scripts/build-rulings.py). Los JSON viven en
**`public/datos-cr/`** y no en `public/rulings/`: Vercel resuelve el sistema de
archivos ANTES que el rewrite de la SPA, así que con la carpeta homónima la ruta
`/rulings` devolvía el índice crudo en vez de la pantalla (medido:
`content-type: application/json`).

- `index.json` — 923 entradas, cotejadas contra el CONTENTS del propio PDF y
  contra un extractor independiente (PDFKit). Ese cruce cazó un bug real: el
  em-dash WinAnsi fuera del CMap pegaba palabras («them—viewing» → «themviewing»).
- `es.json` — 935 traducciones. **El texto normativo es el inglés**; el español
  es de cortesía y la UI lo dice. Terminología oficial verificada contra la API
  localizada de FFG: **Exploit = «Sacrificio»** (no «Explotar»), **Plot =
  «Treta»**, **Overwhelm = «Formidable»**, Agresividad (no «Agresión»), Maldad
  (no «Villanía»). `may`→puede y `must`→debe se validan por script: confundirlos
  cambia la regla.
- `cartas.json` — 978 cartas con rulings oficiales (1.638 en total) de
  `api.swuapi.com` (`additionalRulings`). **La paginación por cursor del API
  está rota con `limit` alto** (salta filas): se pagina por `offset` avanzando
  por lo que VINO. `variant_of_uuid` tiene cadenas anidadas — resolver
  transitivamente hasta la raíz o salen duplicados.
- La ruta es **pública** (sin `<P>`): un juez en torneo no se loguea.

### 2s. Las tres pantallas 3D comparten UN three.js — y el contexto WebGL se suelta

`three` va en `manualChunks` de [vite.config.ts](vite.config.ts). Medido: estaba
DENTRO de `UtilitiesPage` (508 KB de chunk para dados y una moneda), y con tres
pantallas 3D —Utilidades, `/galaxia`, `/mesa`— habrían sido tres copias de
~450 KB. Separado: **522 KB compartidos** y cada pantalla pesa 17-25 KB.

**three PELADO**, sin `@react-three/fiber` ni `drei` (200 KB más). El patrón de
montaje/limpieza canónico es [Dice3D.tsx](src/features/utilities/Dice3D.tsx).

**`renderer.forceContextLoss()` en la limpieza es obligatorio**, y va DESPUÉS de
quitar el listener de `webglcontextlost` — si va antes, la pérdida provocada
dispara el fallback y la pantalla dice «este navegador no puede dibujar en 3D»
para siempre. Sin esto se fugaba **1 contexto y 4 texturas por visita**, y
reproducido con 20 contextos, Chrome mata **los más viejos**: el de la Galaxia
sería el primero en morir y se llevaría el 3D del resto de la app.

Otras reglas medidas de las escenas: una geometría y un material COMPARTIDOS
(19 planetas con material propio son 19 programas de shader);
`setPixelRatio(Math.min(devicePixelRatio, 2))`; rAF pausado con
`document.hidden` **y** `IntersectionObserver`; `transparent + DoubleSide`
dibuja DOS veces y la pasada trasera se descarta entera por winding —cero
píxeles y paga la llamada—.

### 2t. Las imágenes de carta pasan por `/api/img`, no por el CDN directo

Medido: la lista de Mi Botín muestra las cartas a 56×78 css y descargaba el PNG
de 286×400. **45 MB para pintar 1,4 MB de píxeles.** Una sesión que abría tres
pantallas bajaba **88 MB**; ahora **6 MB**.

[api/img.ts](api/img.ts) es un proxy CERRADO (host exacto, ruta verificada
contra 431 URLs reales, escalera fija de 128/224/288/448, cualquier otro ancho
es 400 sin tocar la red) que devuelve **WebP con el alfa intacto** — `drop-shadow`
y `radio-carta` dependen de las esquinas transparentes. `Cache-Control:
immutable` un año: cada carta se convierte UNA vez para toda la comunidad.

Antes de construirlo se verificó que no hubiera salida gratis: las miniaturas de
Strapi dan **403**, las 8 convenciones de redimensionado por query devuelven los
**mismos 204.214 bytes** (es CloudFront pelado sobre S3) y el API de cartas no
tiene ningún campo de miniatura.

`CardImage` **mide su propia caja** y elige el peldaño, así que los 23 sitios que
dibujan cartas no se tocaron: ninguno sabía a cuántos píxeles termina la carta
en el teléfono de quien mira.

**Trampa de método al medir mejoras**: verificar con el MISMO perfil de Chrome da
números idénticos porque el service worker sirve la app vieja desde su precaché.
Perfil nuevo en cada corrida, o los arreglos parecen inútiles y se descartan.

### 2f. supabase-js NO lanza excepción ante error de PostgREST
`const { data } = await supabase...` sin mirar `error` deja `data` en `null`, el `try/catch` nunca se activa y el fallo se ve igual que "no hay datos". Así estuvo **100% muerta** la caché de precios en la nube (0 filas de por vida): la tabla tenía 6 columnas y el código leía 9. Siempre desestructurar `error`.

### 2v. La sesión en la PWA: dónde estaba el «se desloguea» y qué NO tocar
El síntoma que reportaban los jugadores («el logueo no es permanente») casi nunca era una sesión perdida: era el **espejo local del perfil**. [AuthGate](src/components/AuthGate.tsx) cubre 38 rutas y decide con `currentProfile`, que es el único campo de sesión que `partialize` NO persiste ([useAuth.ts](src/hooks/useAuth.ts)). En cada arranque en frío valía `null` y la app pintaba «Acceso Restringido» **con botón de Iniciar Sesión** hasta que respondía la nube.

Lo que hay ahora y por qué, para no deshacerlo sin querer:

- **`authListo`** distingue «todavía no sé» de «no hay cuenta». Se pone en un `try/finally`: si algún camino se lo saltara, el muro se cambia por un **spinner eterno**, que es peor. Nunca se persiste.
- **La hidratación desde Dexie va ANTES de la red** y es optimista. Es segura solo por su contrapeso: si `getSession()` responde **sin error** y sin sesión, se deshace. Si sacás ese `else if (!error)`, quedás con usuarios «logueados» de mentira cuya sesión ya venció.
- **NO persistir `currentProfile` en `partialize`** como atajo: nada lo revalidaría. La hidratación tiene que vivir dentro de `initAuth`, donde el mismo flujo puede corregirse.
- **`onAuthStateChange` se engancha ANTES de sondear la sesión**, con bandera de módulo (no un ref, para cubrir el doble montaje del modo estricto). Si se engancha después, una excepción en `getSession()` deja la app sin nadie escuchando `TOKEN_REFRESHED` — que es el evento con el que la sesión se recupera sola al volver la señal, o sea justo el caso que se quería arreglar.
- **`signOut({ scope: 'local' })`**: el default de auth-js es `'global'` y revoca el refresh token de TODOS los aparatos. Cerrar sesión en la compu dejaba el teléfono deslogueado.
- **`getUserRole` devuelve `string | null`**: `null` es «no se pudo averiguar», y en ese caso NO se pisa el rol persistido. Volver a devolver `'user'` ante un error vuelve a expulsar del panel al organizador con mala señal (ver 2u).

### 2w. La ruta se restaura sola, y las cinco guardas son todas necesarias
Cuando el sistema operativo mata el proceso de la PWA en segundo plano, muere la tarea entera y el siguiente toque al ícono es una navegación nueva a `start_url` (`/`). Eso pasa **antes** de que corra una línea de código nuestro: no se puede evitar, y `start_url` es estático por especificación. Lo único arreglable es restaurar, y de eso se encarga [useRutaPersistente](src/hooks/useRutaPersistente.ts).

Guarda la ruta en **cada navegación** (no en `visibilitychange`: al morir el proceso puede no llegar ningún evento) y en **`localStorage`**, nunca `sessionStorage` — un proceso matado abre un contexto nuevo y `sessionStorage` llegaría vacío justo en el único caso que se quiere cubrir.

Las cinco guardas de la restauración no son decorativas:
1. **solo desde `/`** — si no, se rompen los deep links que la app declara intencionales (`/rulings?regla=…` que se comparte por WhatsApp, `/events/live/:code`, `/blog/:slug`);
2. **sin query ni hash** — `detectSessionInUrl` está activo y el hash del correo de recuperación viaja ahí; también protege los `?code=` de un solo uso;
3. **solo PWA instalada** — en el navegador normal secuestraría una pestaña recién abierta;
4. **vigencia de 30 min** — si volvés al otro día querés Inicio;
5. **ruta interna** — se rechaza `//loquesea`, o un valor manipulado en localStorage sería un redirector abierto.

El service worker abre los avisos sin destino en **`/?desde=push`** justamente para caer en la guarda 2. Si algún día quitás ese marcador, un push sin enlace va a reabrir la última pantalla en vez de Inicio.

### 2x. `profiles.avatar` NO es un emoji — se pinta con `<Avatar>`, nunca crudo

El campo guarda **tres** cosas en la misma columna de texto: una foto subida
(`data:image/…`), el id de uno de los 24 íconos del juego (`boba-fett`, que
resuelve a `/avatars/<id>.png`), o un emoji suelto. Escribir `{perfil.avatar}`
en el JSX solo funciona para el tercer caso.

Medido en producción: **22 perfiles con id de ícono, 1 con foto, CERO emojis**.
O sea que el caso «emoji» —el único que el código crudo dibujaba bien— no lo usa
nadie. La Galaxia, el ranking mensual y la línea «Org:» de `/events` mostraban
«boba-fett» en letras enormes y, para quien tiene foto, un chorro de base64
desbordando la fila. No era un caso raro: eran las 23 filas.

Todo avatar va por [`components/ui/Avatar.tsx`](src/components/ui/Avatar.tsx),
que despacha las tres ramas. Reglas que ya costaron un bug cada una:

- **No hacer una copia local del despacho.** Había tres (`ProfilePage`,
  `TarjetaJugador`, y la lógica inline de `/galaxy`) y las tres se habían
  separado. La lista de ids vive en `data/avatars.ts` y la resolución en
  `services/avatars.ts`; agregar un ícono no debe obligar a tocar pantallas.
- **Dentro de un `ProfileFrame` va `caja="marco"`, no un tamaño propio.** Las
  copias pintaban `w-20 h-20` (80 px) dentro de un marco de 72: el
  `overflow-hidden` del marco le comía el borde a toda foto.
- **`caja="ninguna"` IGNORA `className`** — devuelve el contenido pelado, sin
  caja donde colgar clases. Si necesitás margen o centrado, envolvé.
- **El anillo de color se deriva con FNV-1a + la avalancha de murmur3**, no con
  un `h*31 % 8`. La semilla real es un UUID y los 23 UUIDs de producción
  comparten tanta estructura que los 3 bits bajos amontonaban 5 y 8 personas en
  dos colores; con la avalancha se usan los 8 y el máximo baja a 5. El color
  tiene que ser **estable por persona en toda la app** — es información, no
  decoración.
- **Y el avatar puede faltar por el SERVICIO, no por el dibujo.** Dos bugs así:
  `listarAmistosas()` resolvía el perfil del creador y no el del rival (el
  círculo negro de `/amistosas`), y el podio de `/torneos/:code` tenía
  `avatar={null}` cableado teniendo `user_id` a mano. Antes de culpar a la UI,
  mirá si el `select(...)` trae `avatar`.

Banco de pruebas en **`/banco-avatares`** (solo desarrollo, se poda del bundle):
las tres formas × 6 tamaños × las 3 cajas × dentro del marco. Si alguna celda
sale como texto, alguien volvió a saltarse el componente.

### 2y. El Mercado no tiene tabla propia, y su orden le da la portada a uno solo

No existe tabla de publicaciones: el mercado son **5 columnas colgadas de
`collection`** (`for_sale`, `sale_price`, `sale_notes`, `listed_at`,
`sale_quantity`). La PK es `(user_id, card_id)`, así que **nadie puede publicar
dos veces la misma carta** ni publicar algo que no tenga en su colección — eso
no es un límite accidental, es lo que mantiene honesto el inventario.

Tres cosas medidas que hay que tener presentes al tocar esta pantalla:

- **El orden por `listed_at desc` con tope de render 24 le regala la portada a
  quien publicó de último.** Medido dos veces con días de diferencia: las 24
  que se ven al abrir eran las 24 de una sola persona, y al publicar otra, el
  monopolio se mudó entero. No es de alguien: es del orden. Por eso el filtro
  por vendedor no es un adorno.
- **Nada de topes fijos al leer el mercado.** Estuvo en `limit: 200` y se pasó
  en silencio: con 207 publicaciones, 7 dejaron de existir para todos y el
  encabezado seguía afirmando un total ya recortado. Se pagina con `.range()`.
  Y filtrar sobre un conjunto truncado es peor que perder filas: da respuestas
  que **parecen** completas.
- **Postgres no sabe qué es un Líder.** No hay tabla `cards` en Supabase — el
  catálogo vive solo en Dexie, en el navegador. Filtrar por tipo o aspecto se
  resuelve en el cliente contra el `Map` hidratado, y el vocabulario compartido
  está en [filtrosCarta.ts](src/services/filtrosCarta.ts). Para poder filtrar
  en el servidor algún día habría que copiar el metadato a la fila **en el
  momento de publicar**; después ya no se puede sin un navegador que resuelva
  los ids contra Dexie.

Y la trampa de la hidratación: una publicación cuya carta todavía no llegó de
Dexie **no se puede juzgar** por tipo ni aspecto. Se excluye si hay un filtro de
carta activo (mostrarla afirmaría que cumple algo que no se sabe) y se conserva
si no lo hay (o se pierden filas por una carrera de carga). Eso dura
milisegundos en pantalla y no se comprueba mirando: por eso el predicado es una
función pura en `filtrosCarta.ts` y no vive dentro del componente.

### 3. Named exports en rutas lazy
Algunas features exportan con nombre (`export const GalaxyPage`). Importar lazy requiere:
```tsx
const GalaxyPage = lazy(() =>
  import('./features/galaxy/GalaxyPage').then(m => ({ default: m.GalaxyPage }))
)
```

### 4. Variables de entorno
`src/services/supabase.ts` no lanza error si faltan las env vars — solo hace `console.warn`. Para que `npm run dev` se conecte al backend real, `.env.local` necesita valores reales (no los placeholders).

---

## Variables de entorno

```bash
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Setup automatizado (recomendado):**
```bash
vercel link --yes --project=swu-companion
vercel env pull .env.local --environment=production --yes
```

**Manual:** Supabase → proyecto SWU Companion → Settings → API → copiar URL + anon key.

**Producción:** Vercel Dashboard → swu-companion → Settings → Environment Variables.

---

## Comandos

```bash
npm install                 # Instalar
npm run dev                 # Dev server (http://localhost:5173)
npm run build               # tsc -b && vite build (verifica TS estricto)
npm run preview             # Preview del build
npm run lint                # eslint .
```

**Antes de cada push:**
```bash
npm run build && git add -A && git commit -m "feat: descripcion" && git push
```

El push a `main` dispara Vercel auto-deploy. ~1-2 min hasta swusv.com.

---

## Pipeline de deploy

```
local → git push origin main → GitHub webhook → Vercel (npm run build) → swusv.com
```

No hay CI separado. Si el build falla en Vercel:
1. `vercel ls swu-companion` o dashboard → último deploy
2. Ver logs del build
3. Error típico: TypeScript strict mode. Reproducir local con `npm run build`.

---

## Tablas Supabase clave

| Tabla | Descripción |
|-------|-------------|
| `profiles` | Perfil de usuario (name, avatar, country, settings JSON) |
| `player_stats` | XP, wins, losses, level, achievements |
| `monthly_xp` | XP ganado por mes (rankings mensuales) |
| `collection` | Cartas en colección personal. PK `(user_id, card_id)` — no hay columna `id`. Lleva colgado el MERCADO en 5 columnas: `for_sale`, `sale_price`, `sale_notes`, `listed_at`, `sale_quantity` |
| `community_posts` | Feed de actividad / comunidad |
| `leaderboard_entries` | Rankings globales |

Migraciones en `supabase/migrations/`. Aplicarlas vía SQL Editor en Supabase dashboard.

**Auth:** Supabase Auth, cuenta admin `arq.nel@outlook.com`. Store Zustand `useAuth` expone `currentProfileId`, `supabaseUser`, `signOut()`. Rutas protegidas via componente `<P>` (AuthGate wrapper).

---

## Convenciones

- **No commitear `.env.local`** — ya está en `.gitignore` vía `*.local`.
- **Siempre `npm run build`** antes de push.
- **Build estricto** — TS strict mode, no `any`, no `@ts-ignore`.
- **Lazy load** todas las rutas en `App.tsx` para chunks separados.
- **Helper `single<T>()`** para joins de Supabase con relaciones 1:N.
- **Named exports** en feature pages (excepto `TournamentDashboard`, `TournamentPublicView`, `MissionsPage` que usan default).

---

## TODOs activos en código

- [src/features/events/JoinEventPage.tsx:113](src/features/events/JoinEventPage.tsx:113) — Implementar QR scanning real (`@zxing/browser`).
- [src/features/events/EventLobbyPage.tsx:105](src/features/events/EventLobbyPage.tsx:105) — Suscripción Supabase Realtime a cambios de jugadores en lobby.

---

## Notas para Claude Code

- **Antes de cambiar joins Supabase**, leer `getGlobalLeaderboard()` en `sync.ts` como referencia.
- **Antes de tocar `ProfilePage.tsx` (1025 LOC)**, considerar partir en sub-componentes — ya hay `ProfileFrame`, `TriviaSection` separados, hay margen.
- **Dominio `swusv.com`** apunta a Vercel vía DNS. No tocar configuración DNS sin razón explícita.
- **Brand real es "HOLOCRON SWU"** (no "SWU Companion") — visible en manifest PWA y SideNav.
- Variables `VITE_*` son públicas (van al bundle del cliente). El anon key de Supabase está protegido por RLS, no por secrecía.

---

*Última actualización: 2026-08-07*

### 2y. La credencial ES la tarjeta de jugador, y se gira en 3D

`TarjetaJugador` ya no dibuja una fila con el avatar y el nombre: dibuja la
**credencial** (`features/credencial/`). Antes había dos identidades del mismo
jugador compitiendo —la tarjeta de Inicio y la placa de `/credencial`— y la
segunda estaba escondida en una pantalla a la que había que ir a propósito.

Lo que hay que saber antes de tocarla:

- **Los datos salen de un solo lugar**: `useDatosCredencial(perfil, stats)`.
  Inicio, Perfil, Ajustes y `/credencial` lo llaman todos. Armar el objeto
  `DatosCredencial` a mano en una pantalla nueva es cómo la tarjeta vieja se
  fue separando de sí misma.
- **La fecha de despliegue NO es `perfil.createdAt`** (ese lo estampa Dexie con
  `Date.now()` la primera vez que abrís la cuenta EN ESE APARATO: cambia por
  aparato y se resetea al borrar los datos del sitio). Es `profiles.created_at`,
  y el hook la cachea en un mapa de módulo para no pedirla por pantalla.
- **El acabado del metal se GANA por nivel** (`acabadosCredencial.ts`, siete
  acabados atados a los siete RANKS). Cada uno agrega algo *identificable*
  —veta, filo, cromo, tinte, barrido, halo— y no solo «más brillo»: la placa se
  imprime en blanco y negro y ahí un brillo extra no existe.
- **El giro**: `CredencialInteractiva` mueve el nodo escribiendo `style` a mano
  en cada `pointermove`, sin `setState` (60 renders/segundo arrastrando se
  siente pegajoso en el teléfono). Va con `touch-action: pan-y` para no comerse
  el scroll vertical de la página, y el gesto se descarta si el dedo va más en
  vertical que en horizontal.
- **Al soltar se acomoda a la media vuelta MÁS CERCANA conservando el signo**
  (`Math.round(y/180) * 180`), y la cara visible sale de la PARIDAD. Normalizar
  a «0 o 180» a secas hacía que soltar en −162° se fuera a +180: 342 grados de
  viaje para corregir 18, o sea un tirón hacia el lado contrario al que
  arrastraste.
- **La impresión toma `svg[data-cara="frente"]`**, no el primer `svg` de la
  zona: desde que hay dorso hay dos, y depender del orden del DOM es apostar a
  que nadie los reordene.
- **`geometriaCredencial.ts` y `DefsCredencial.tsx`** los comparten anverso y
  reverso. Si el dorso deja de parecer la misma tarjeta, es porque alguien
  duplicó un degradado en vez de usarlos.

Banco visual en `/banco-credencial` (solo desarrollo): los siete acabados sobre
el mismo tema, el dorso, los catorce temas y los casos límite (emoji, textos
largos). Si dos acabados se ven iguales, uno de los dos no existe.

### 2z. Antes de mover algo en la credencial, MEDÍ: `/banco-credencial`

«Hay textos encima del diseño» no se puede verificar leyendo el código. Dónde
termina una caja depende de la fuente, del `letterSpacing`, del escalado del
glifo y de las MUESCAS de las siluetas — y las siluetas de esta placa tienen
tres. El `DetectorChoques` del banco mide las placas ya pintadas con tres
reglas, y cada una nació de un choque que las otras dos no veían:

1. **Ningún texto pisa decoración** (remaches, sello, circuitos, barras,
   emblema). Cazó los remaches pintados sobre las letras Aurebesh.
2. **Ningún texto pisa a otro texto.** Cazó dos sublíneas de la fila inferior
   que, estando las dos sobre el panel y sin tocar decoración, se leían como
   una sola palabra corrida.
3. **Todo texto cae dentro de su fondo** (`[data-fondo]`). Cazó el peor: la
   sublínea de DESPLEGADO caía por la muesca del panel y quedaba partida a
   media altura, mitad sobre el panel oscuro y mitad sobre la chapa clara.

Cuatro trampas del propio detector, todas ya pagadas:

- **Un verde puede no haber medido nada.** La primera versión saltaba las
  placas sin ancho y devolvía «limpio» habiendo medido cero. Ahora informa
  cuántas midió y cuántas saltó.
- **`getBBox()` no sirve**: devuelve coordenadas locales, antes del
  `transform`. Las sublíneas son grupos trasladados y salían todas apiladas en
  el origen.
- **`isPointInFill` interpreta el punto en el sistema LOCAL del elemento**, o
  sea antes de su propio `transform`. Hay que llevar el punto con
  `getScreenCTM().inverse()` o los fondos transformados mienten.
- **Los filtros inflan `getBoundingClientRect`**: devuelve la región del
  filtro, no la tinta. El nombre repujado declaraba 160% de su alto. El
  detector los apaga mientras mide y los repone.

Marcá `data-deco` en cada grupo decorativo nuevo y `data-fondo` en cada fondo
legítimo de texto, o el detector no los ve — y no verlos se parece mucho a que
no haya problema.

### 3a. Amistosas: nadie publica la partida de otro

Una amistosa la anota UNA persona pero la jugaron DOS. La tabla
`duelos_amistosos` tiene por eso una máquina de estados chica y una regla que
no se negocia: el creador anota, al rival le cae **pendiente**, y solo si él
acepta la fila pasa a `confirmada` — que es el único estado público y el único
que cuenta para el meta.

- `pendiente` · `confirmada` · `rechazada` · `sin_rival`. La última es para el
  invitado sin cuenta: no hay a quién preguntarle, así que nunca se publica.
  Hay un CHECK que impide que una fila sin `rival_id` quede pendiente, porque
  una pendiente que nadie puede resolver es basura que ensucia el contador.
- **La confirmación va por RPC, no por policy.** RLS es por FILA, no por
  columna: una policy de UPDATE para el rival lo dejaría cambiar también el
  marcador y el mazo del creador. `confirmar_amistosa` es SECURITY DEFINER,
  comprueba `auth.uid() = rival_id` y toca exactamente cuatro campos.
- **El mazo se adjunta cada uno el suyo.** El creador el propio al anotar; el
  rival el propio al confirmar. La función verifica que el `deck` sea de quien
  llama. Probado: adjuntar un mazo ajeno devuelve `insufficient_privilege`.
- **`decks.id` es TEXT, no uuid.** Una foreign key declarada `uuid` ni se puede
  crear («Key columns are of incompatible types»). Se descubrió probando la
  migración en una transacción revertida antes de aplicarla, que es como se
  hacen acá.
- **`meta_amistoso` agrega los DOS lados** de cada duelo con un `union all`.
  Con un solo lado el meta saldría sesgado hacia los mazos de quien lleva el
  teléfono a la mesa, que siempre es la misma persona.
- **El winrate se calla cuando no tiene con qué.** 8 de los 10 duelos de
  producción están 0-0: se usó el Contador para llevar la vida y nadie marcó
  quién ganó. El denominador son las partidas CON marcador; si son cero, no se
  muestra porcentaje. Un «0%» ahí es una mentira con cara de dato.

Las cinco reglas de seguridad están probadas contra la base real dentro de una
transacción revertida: tercero rechazado, creador no puede autoconfirmar, mazo
ajeno rechazado, rival confirma, segunda confirmación rechazada.

### 3b. Exportar la credencial a PNG: tres trampas medidas

`exportarCredencial` clona el SVG que está EN PANTALLA y lo pasa por un canvas.
Las tres cosas que rompen esto ya se midieron en el navegador, no se supusieron:

1. **Las imágenes con `href` relativo NO se dibujan.** El SVG se pinta metido
   en un `data:` URL, y un `data:` no tiene base contra la cual resolver
   `/avatars/boba-fett.png`. Medido: con href relativo la ventana de la foto
   sale con **0 píxeles de color**; con las imágenes en data URI, **7646**. Y
   lo peor es que `toDataURL` **no falla** en el primer caso: devuelve un PNG
   impecable con la foto vacía. Un error que se ve como éxito.
2. **`var(--font-mono)` no existe dentro del SVG suelto**, y poner
   `font-family:'JetBrains Mono'` tampoco alcanza: el SVG serializado no tiene
   acceso a las `@font-face` de la página. Hay que **empotrar la fuente en
   base64** (75 KB, solo los subconjuntos latinos). Comprobado que cambia el
   dibujo: 7347 píxeles de tinta con la mono de reserva contra 6635 con la de
   verdad. Las URLs de los .woff2 se descubren leyendo `document.styleSheets`
   EN VIVO, porque el empaquetador les cambia el hash en cada build.
3. **El canvas queda limpio** justamente porque todo va en data URI: no hay
   recurso de otro origen, así que `toBlob` no lanza `SecurityError`.

Y dos de producto:

- **`navigator.share` con archivos es el único camino que llega a las cinco
  redes.** WhatsApp, Telegram y Facebook tienen intent web pero solo llevan
  TEXTO; Instagram y Discord no tienen ninguno. Los botones por red dicen
  explícitamente que mandan texto — prometer que mandan la imagen es el bug
  clásico de esta pantalla.
- **Se genera y se ve ANTES de compartir, en dos clics.** Safari exige que
  `navigator.share()` salga de una activación del usuario, y generar el PNG
  lleva `await`. Encadenado en un botón, Safari tira `NotAllowedError` justo en
  el teléfono donde la hoja del sistema es el único camino. Misma lección que
  ya estaba escrita en `CompartirArticulo`.

La firma `swusv.com` va DENTRO de la placa, sobre su propia plaquita oscura: un
texto blanco al 45% desaparece en los dos temas de chapa clara, y una imagen
reenviada pierde el texto que la acompañaba — sin la firma, la tarjeta no puede
traer a nadie de vuelta.

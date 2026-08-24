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
    │   ├── meleeService.ts, missionService.ts
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

*Última actualización: 2026-08-23*

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

### 3c. El ranking es UNO, y mide jugar

Había **14 tablas de posiciones** y **6 sistemas de puntos** que no hablaban
entre sí. Medido en producción antes de tocar nada:

- El primero del «ranking» tenía **3180 puntos con CERO partidas jugadas** —le
  venían de 2900 cartas registradas y 8 logros—, y el que ganó el torneo real
  3-0 **no aparecía en el top 6**. La suma de `matches_played` de los 25
  perfiles era **2**. O sea que la tabla titulada «Mejores Jugadores del Juego»
  ordenaba por coleccionar.
- El número grande de la lista era `torneos*1000 + victorias*100 + xp`: una
  fórmula que **no existía en ninguna tabla ni en ningún servicio**, inventada
  en la línea que la pintaba.
- **«Consejo Jedi» nombraba DOS tablas distintas**: la de `/community` ordenaba
  por XP y la de `/rank` por torneos. Mismos jugadores, distinto orden, y un
  botón «Ranking completo» que hacía creer que una era la versión larga de la
  otra.
- `MonthlyRank` (194 líneas) era un TERCER nombre para la pestaña Mensual y **no
  estaba montado en ninguna ruta**.

Ahora: `ranking_unificado()` es la única fuente. Sale de `tournament_standings`
y de las amistosas en estado `confirmada` — las dos únicas tablas donde hay
partidas de verdad. **3 por victoria en torneo, 1 por empate, 1 por victoria en
amistosa**; la amistosa vale menos porque la anota el propio jugador, y vale
algo porque el rival tiene que confirmarla.

**Los jugadores sin cuenta entran.** En el torneo real 3 de 8 no estaban
enlazados a un perfil, entre ellos el ganador; se agrupan por nombre
normalizado (`'nombre:'||lower(trim(player_name))`) y el día que se registren su
historial se une solo. Un ranking que se come al campeón no lo cree nadie.

Reglas que quedan, para no volver atrás:
- El XP **no es un ranking**. Vive en la pestaña «Progreso» de `/rank` con un
  cartel que dice literalmente «Esto no es el ranking».
- Las seis listas de `/galaxy` se llaman **«Estadísticas»**, no «Rankings».
- El número de puesto del «Explorador» va **sin oro/plata/bronce**:
  `consultarGalaxyPlayers()` no tiene `.order()`, así que ese número es el orden
  que devolvió la base y cambia al escribir en el buscador.
- «Consejo Jedi» sobrevive **solo** como el título del podio de los tres
  primeros de esa única tabla.

### 3d. La puerta de instalación: qué NO se puede exigir

`PuertaInstalacion` bloquea la app hasta que esté instalada como PWA y con
avisos activos. Tres cosas hacen que un requisito sea imposible de cumplir, y
exigirlo ahí no es «más estricto»: es una pared sin puerta.

1. **Desde el navegador de Instagram / Facebook / TikTok NO se puede
   instalar.** En iOS «Añadir a inicio» solo existe en Safari, y el de
   Instagram es un WKWebView sin ese menú; en Android son WebViews que nunca
   disparan `beforeinstallprompt`. Se los detecta por cadena de agente
   (`Instagram`, `FBAN|FBAV|FB_IAB|FBIOS`, `BytedanceWebview|musical_ly`) y se
   los deja pasar con una barra que ofrece abrir en el navegador de verdad.
2. **En iOS el permiso de avisos solo se puede pedir DESPUÉS de instalar.** Por
   eso el orden es instalar → abrir instalada → activar avisos, y no al revés.
3. **Un «Bloquear» es irreversible desde código.** El permiso queda en `denied`
   y `requestPermission()` ya no vuelve a preguntar. Se enseñan los pasos de
   los ajustes del teléfono, con un botón para volver a comprobar, y hay salida
   («entrar sin avisos»): echar a alguien para siempre por un botón mal tocado
   es un bug, no una regla más dura.

**Rutas que nunca pasan por la puerta** (`rutaLibre` en `services/entorno.ts`):
`/overlay/:code` y `/estudio/:code` —los carga OBS, que es un Chromium sin menú
y no puede instalar nada; taparlos tumba la transmisión EN VIVO—,
`/events/live/:code`, y las páginas públicas (`/rulings`, `/meta`, `/torneos`,
`/aurebesh`, `/u/:id`, `/blog`, `/sedes`), que son las que hacen que un enlace
compartido traiga gente nueva.

**Android se comprueba ANTES que iOS en `plataforma()`.** El truco conocido
para delatar al iPad —`platform === 'MacIntel'` con táctil— también da
verdadero en Android: medido, ua «Linux; Android 14; Pixel 8» con platform
«MacIntel» y `maxTouchPoints` 5. Con la regla del iPad primero, a un Android se
le enseñaban los pasos de iPhone («tocá Compartir en Safari») en una pantalla
que además no lo dejaba pasar. `PWAInstallCard.detectPlatform` tiene el mismo
orden invertido y el mismo defecto latente.

### 3e. La credencial como OBJETO: luz real y espesor

Dos cosas que faltaban para que la placa dejara de parecer un dibujo bien hecho.

**Luz de verdad, no degradados.** Hasta acá todo el «metal» eran degradados
pintados a mano: un degradado dice DÓNDE hay brillo, un modelo de luz dice POR
QUÉ. `${uid}-especular` toma la misma turbulencia estirada del cepillado —las
microrrayas del material— como mapa de relieve y calcula con
`feSpecularLighting` + `feDistantLight` el reflejo sobre ellas: la veta brilla
en las crestas y se apaga en los valles. Tres cuidados:
- `feSpecularLighting` devuelve RGBA con alfa propio. **Sin `feComposite
  operator="in"` contra `SourceAlpha` el brillo se sale de la silueta.**
- `lighting-color` va tibio (`#fff6e0`), no blanco puro: un 255 quema el borde
  en los temas de chapa clara.
- Es el filtro **más caro** de la placa, así que solo se aplica desde el
  acabado cromado (nivel 11) hacia arriba. En `/banco-credencial` hay catorce
  credenciales a la vez.

**Espesor: el canto va como CONTORNO, nunca como relleno.** Cuatro copias de
`SILUETA_BASE` empujadas en Z, con `fill="none"` y `stroke` grueso.

Esto ya rompió el dorso una vez y vale la pena saber por qué. Con relleno, cada
capa es una losa opaca del tamaño de la placa; al girar la tarjeta media vuelta
esas losas quedan por delante de la cara de atrás y **el dorso desaparece**. Se
intentaron dos arreglos de ORDENAMIENTO antes de ver que el error era de
concepto —mover las caras a las superficies externas (±7) con el canto en medio
(±6), y duplicar el canto con `backfaceVisibility` por lado— y **ninguno de los
dos funcionó**: medido en el navegador apagando capas una por una, el
compositor no ordena por profundidad entre los `<svg>` del canto y los `<div>`
de las caras.

Como contorno el problema no existe: el canto de una tarjeta ES solo el borde,
el interior queda transparente, ninguna capa puede tapar a ninguna cara y no
hace falta que nadie ordene nada. El `strokeWidth` tiene que ser mayor que la
separación entre capas o el canto se ve como cuatro líneas sueltas.

**Paralaje.** Los dos reflejos flotan por DELANTE de la placa (`translateZ` 14
y 26 px) y se corren a distinta velocidad con la inclinación. Esa separación es
lo que hace leer un vidrio encima; pegados a z=0 se ven como manchas pintadas.

Medido durante un arrastre de 60 frames: **mediana 1,1 ms por frame, p95 2 ms**
contra un presupuesto de 16,7. El primer frame cuesta 30 ms (promoción de
capas) y es de una sola vez.

**Trampa al verificar:** el `DetectorChoques` mide con
`getBoundingClientRect`, que bajo una rotación 3D devuelve la caja
**proyectada**. Si inclinás la tarjeta a mano y medís, salen siete choques
falsos. Hay que medir con la placa de frente.

### 3f. El ranking con el lenguaje de la placa: qué se traslada y qué NO

La gramática de la credencial se REDIBUJA, no se encoge. La placa es un path en
un viewBox de 512×320; a la altura de una fila el factor es 0,175 y una muesca
de 10 unidades mide 1,7 px, o sea nada. Se conserva la REGLA —ninguna esquina
de 90°, todo escalón entre 5 y 14 px REALES— y por eso las siluetas
(`clip-placa`, `clip-placa-podio`, `clip-chapa` en index.css) van en px y no
en %: un % estira los escalones con el ancho.

**Cero filtros SVG por fila.** Los materiales son `background-image` con
degradados copiados parada por parada de `DefsCredencial`. Un degradado es
pintura directa; un filtro promueve capa de composición, y acá hay hasta 25
filas — en la credencial el especular está limitado al nivel 11+ justamente
por lo que cuesta, y ahí hay UNA placa en pantalla. Regla: **un solo efecto
caro por PANTALLA, nunca por fila**.

**`clip-path` se come el `border`, la sombra EXTERIOR y el `outline` de foco
del propio elemento.** De ahí el sándwich de dos divs (`p-px`: el de abajo es
el canto) y que el foco tenga que ir en un envoltorio sin recorte. Sí crea
contexto de apilado, aunque no capa de composición.

**El acabado se gana por PUESTO, nunca por tener cuenta.** Es la corrección
más importante del diseño: hoy el campeón real del torneo no está registrado.
Quien no tiene cuenta lleva su INICIAL grabada en el retrato, con el mismo
anillo `colorDePersona` que todos —son 3 de cada 10 filas y sin eso la ventana
queda como un agujero negro.

Lo que se descartó y por qué:
- **Texto sobre el degradado cromado.** Medido parada por parada, deja la tinta
  entre 1,13:1 y 1,74:1 en la franja del medio, que es justo donde cae un
  número grande. Las bandas de puntos van con LUSTRE.
- **El destello diagonal en la fila propia.** En una fila de 341 px el eje de
  100° pone la banda clara en x≈131-189: exactamente encima del nombre.
- **Los nombres en versalitas.** La credencial va en caja alta porque son seis
  datos cortos; 25 nombres en mayúsculas son un muro que cuesta escanear.
- **La sublínea Aurebesh y el código de barras por fila.** ~250 `<path>` de 5 px
  de alto es pelusa gris.
- **Reusar el vocabulario de acabados del nivel** (prisma, kyber, halo) para el
  puesto: las mismas palabras significarían dos cosas en dos pantallas.

**La pestaña Progreso va en MATE, a propósito.** Metal sin barnizar, esquinas
rectas, sin chapa de puntos. Si se viera con el mismo metal que el ranking,
las dos tablas volverían a parecer lo mismo — que es exactamente el problema
que esta pantalla vino a arreglar. El material dice «esto no es el ranking»
antes de que nadie lea el cartel.

Medido en el banco (`/banco-ranking`, solo desarrollo, con los datos reales):
**51 textos, ninguno por debajo de 11 px, ninguno por debajo del mínimo de
contraste y ningún botón por debajo de 44×44; el peor contraste es 5,8:1.** Los bancos están en `rutaLibre` porque la puerta
de instalación tapaba justo la pantalla que hay que mirar para revisar un
diseño móvil.

### 3g. Vista previa en vivo = la gente cree que ya guardó

El panel del planeta (`PersonalizarPerfil`) tiene una vista previa 3D que
cambia AL INSTANTE al mover un deslizador o elegir un tipo de mundo. Pero esos
controles solo tocaban estado local y esperaban al botón «Guardar» del final.

Resultado medido en producción: **7 personas le pusieron nombre a su planeta y
solo 2 tenían los colores.** El campo del nombre está pegado al botón, así que
ese sí se guardaba; los colores están arriba, con la vista previa cambiando en
vivo, y cinco personas eligieron su mundo y lo perdieron.

Es el MISMO fallo que ya se había arreglado para la portada de la vitrina —el
comentario de `elegirPortada` lo documenta— y volvió a aparecer en el control
de al lado. La regla: **si un control tiene vista previa en vivo, guarda solo.**
Los deslizadores con antirrebote de 600 ms, y con la escritura forzada al
desmontar para no perder el último movimiento.

### 3h. La miniatura para compartir habla el idioma de la placa

`CompartirArticulo` dibujaba un chasis genérico: degradado, halo, una rejilla
cian y un `strokeRect`. Nada de eso venía de la app — el cian en particular no
existe en la credencial ni en el ranking, y era lo que más delataba la
plantilla.

Ahora el lienzo ES una placa: silueta escalonada con muesca superior y muesca
del canto derecho, canto de espesor, veta del cepillado, barniz, remaches en
las esquinas, código de barras del borde y el titular sobre la **banda del
nombre** de la credencial. La marca y el título van **grabados** (sombra
arriba, filo de luz abajo, sin desenfoque).

Reglas heredadas de las otras dos pantallas, y que acá también costaron:
- **La gramática se REDIBUJA a la escala del lienzo.** La muesca superior
  empezó en 22 px y a 1020 de ancho se leía como un redondeo; va en 40. Es lo
  mismo que en el ranking, donde el problema era el opuesto (10 unidades del
  viewBox medían 1,7 px y desaparecían). Nunca escalar el path de la
  credencial.
- **El código de barras arrancó invisible.** 4-13 px de ancho por 6 de alto es
  pelusa a 1080. La credencial las lleva a ~3,7% del ancho: acá son 14-40 px.
- **La semilla del dibujo sale del TÍTULO**, con el mismo FNV-1a y el mismo
  `>>>` que la credencial. Determinista: dos previsualizaciones del mismo
  artículo salen idénticas. Con `>>` los anchos se vuelven negativos y las
  barras no se dibujan.
- **El texto grabado solo de 26 px para arriba.** Por debajo el filo claro
  engorda el glifo en vez de hundirlo.
- **Nada de degradado cromado detrás de un texto**: en la credencial se midió
  que deja la tinta entre 1,13:1 y 1,74:1 en la franja del medio. La banda del
  titular va con lustre.

### 3h-bis. El Holocrón de Duelos se retiró, y por qué el número mandó

`/arena` y sus cinco pantallas se fueron el 2026-08-19. La decisión no fue de
gusto: **`match_logs` terminó con CERO filas y cero autores** en toda la vida de
la app. No es «poco uso», es que nadie registró jamás un combate ahí.

Y estaba a medio cablear desde el principio: `logMatch` escribía en Dexie y en
`match_logs`, y **no tocaba `player_stats`, ni el XP, ni el ranking**. Los tres
logros del aspecto Progreso y el título «Cronista del Holocrón» colgaban de
`arenaMatchesLogged`, un contador que **ningún código incrementaba** — nacieron
inalcanzables. Lo mismo tres misiones diarias.

Lo que hay que saber si aparece un enlace viejo:

- **`/arena/*` redirige a `/amistosas`** con un `<Navigate>` EXPLÍCITO en
  App.tsx, no por el comodín del final: ese manda a Inicio en silencio, que para
  quien tenga la ruta guardada se ve como que la app se rompió. Se puede quitar
  a partir de noviembre de 2026.
- **La casilla «Duelo» de Inicio entró ANTES de que saliera «Holocrón».** Esa
  casilla era el único salto de un toque desde Inicio hacia el tracker en el
  teléfono (la TabBar no lleva `/play` y el sidebar es de escritorio). Quitarla
  sin reemplazo habría empeorado el acceso al módulo que la gente sí usa.
- **La barra del aspecto «Progreso» ahora mide `level`**, no `matchesPlayed`:
  esa última ES Vigilancia (barra y logros `vig_1..5`) y las dos habrían dicho
  el mismo número con distinto nombre.
- **Las tablas NO se borraron.** `match_logs` en Postgres queda vacía y cuesta
  cero; la tabla `matchLogs` de Dexie sigue DECLARADA a propósito — Dexie solo
  borra una tabla si le escribís `matchLogs: null`, y tocar los bloques de
  versión rompe la base de quien ya tiene la app instalada.
- Lo que sí se quitó de la base es la policy `"Public read logs"`, que dejaba el
  nombre y el mazo del rival legibles por cualquiera sin pedirle permiso —la
  única grieta contra §3a.

**Misiones, de paso.** `updateMissionProgress` tenía UN solo llamador en toda la
app (los regalos), así que de 12 diarias solo 3 podían completarse **y se
sortean 4 por día**: la mayoría de los días la lista entera era imposible. Se
comprobó en la base: las únicas filas que existen en `user_missions` son
`d_gift1`, `d_gift2` y `w_gift3`. Ahora hay llamador para `match_played`,
`match_won` (TrackerPage), `deck_created` (DeckListPage) y `card_favorited`
(CardDetailPage), y se retiraron las que no lo tienen: las 3 del Holocrón, las 2
de «validar mazo» y la de «finalizar torneo» —esa la cierra el organizador
server-side y acreditarla en el cliente premiaría a quien no jugó—. **Regla: una
misión sin llamador es una tarea imposible en pantalla; si agregás un
`objectiveType`, agregá el `updateMissionProgress` en el mismo commit.**

### 3h-ter. El bot de noticias: qué puede afirmar y qué no

`/api/bot-noticias` (cron `31 13 * * *` = 07:31 SV) compara el catálogo de
api.swuapi.com contra una foto propia (`bot_catalogo_foto`) y deja un
**borrador** en `news` cuando aparecen cartas que antes no estaban.

**No hay una sola línea de texto generada por IA.** Los títulos y resúmenes son
plantillas con huecos rellenados por campos literales del catálogo. No es
tacañería: así no existe ningún punto del sistema donde algo pueda alucinar una
carta que no existe.

**El bot NO dice «spoiler» ni «revelada hoy».** No hay fuente para eso: el
único campo candidato del API oficial (`publishedAt`) trae el mismo valor
centinela `2025-03-05T06:00:00.000Z` en **4.840 de 9.185 cartas**. Lo único que
el bot sabe —y lo único que afirma— es que el catálogo incorporó cartas que
antes no tenía.

Cuatro trampas medidas, cada una capaz de hacerlo mentir:

- **`?since=` no sirve.** Devuelve 8.661 de 9.185 filas «modificadas» cada día y
  **cero** son nuevas: el scraper de swuapi reescribe casi todo el catálogo en
  cada corrida. El diff va contra la foto propia, nunca contra `updated_at`.
- **Se cuenta la CARTA, no la lámina.** 9.185 impresiones son 2.189 cartas;
  6.996 filas son variantes y promos. Sin `variantType === 'Standard'` + clave
  `(nombre|subtítulo)`, el día que entraron 838 variantes el bot habría
  publicado 838 «cartas nuevas» falsas.
- **La primera corrida siembra y se calla.** Con la tabla vacía el diff vería
  2.189 altas y el estreno sería una noticia falsa.
- **Piso de cordura de 8.000 cartas.** Si el API devuelve menos, no se publica
  NI se toca la foto — si no, una respuesta parcial haría que la corrida
  siguiente viera como «nuevas» todas las que faltaron (§2c otra vez).

**Todo entra como borrador** (`published: false` explícito: la tabla viene
DEFAULT true). El modo de fallo de un bot honesto no es que el dato sea falso,
es que la frase alrededor lo sea, y eso solo lo ve una persona. La política
`news_select` ya deja a los admin ver los no publicados.

**Freno sin redeploy:** `BOT_NOTICIAS_OFF=1` y el endpoint responde 200 sin
hacer nada.

**El autor va CLAVADO en el archivo** (`AUTOR_BOT`), nunca leído de la
petición: el endpoint escribe con service_role, que se salta la RLS entera. Si
el autor viniera de afuera, quien adivinara el secreto podría publicar firmando
como una persona real. `news.author_id` es NOT NULL pero sin clave foránea, así
que el bot tiene identidad propia sin necesitar una cuenta.

**Lo que NO se hizo, y por qué:** las fechas de salida y los avisos de artículo
existen y son públicos en `admin.starwarsunlimited.com` (`/api/products` trae
`releaseDate` limpio; `/api/articles` sin `populate` trae titular y resumen en
345 bytes). Pero los términos de uso de FFG dicen textualmente «You will not
transmit any bugs, viruses, trojan horses, **bots, scrapers**, or any like or
related programming through or to the Star Wars: Unlimited Website», y Nel
decidió no tocar ese sitio. `api.swuapi.com/sets` **no** los reemplaza: su
`release_date` viene null en 25 de 28 sets y los 3 poblados están mal
atribuidos (le cuelgan la fecha del set base a la fila del Weekly Play).

**La carta del día** (`features/home/CartaDelDia.tsx`) es lo otro que se pidió
—«algo casi todos los días»— resuelto sin inventar novedad: una carta del
catálogo YA publicado, elegida con FNV-1a sobre el día SV, la misma para los 27
y sin guardar una sola fila. No es un spoiler y no se rotula como tal.

### 3h-quater. El calendario es una VISTA, no una tabla

`/calendario` lee `official_events` con la sede unida. **No hay tabla de
calendario y no debe haberla**: esa tabla ya tenía fecha, `venue_id`, formato,
estado y organizador. Un segundo sitio donde exista «el torneo del sábado» es
cómo la comunidad termina con dos respuestas a la misma pregunta (§3c).

Tres cosas que costó descubrir y no hay que deshacer:

- **`venues` ya no tiene `unique(owner_id)`.** Modelaba «una tienda, su dueño»;
  la comunidad necesita una lista curada entre admins. Se pudo cambiar sin
  riesgo porque la tabla estaba en CERO filas. Lo único de `venues` es ahora el
  NOMBRE. Y `accent` **no es un hex**: un CHECK solo acepta
  cyan/amber/green/red/purple.
- **`anon` ve TODOS los eventos, no solo los terminados.** Antes
  `events_public_finished` lo limitaba a `status='finished'` y el calendario
  público salía con los sábados pasados y sin los que vienen — medido en el
  navegador. El `code` queda expuesto y no importa: inscribirse exige sesión
  (`event_registrations` es `auth.uid() = user_id`) y `/torneos/:code` ya era
  pública.
- **Los sábados son FILAS CONCRETAS**, no una regla de repetición: se pidieron
  editables, y con una regla, cambiarle la hora a un sábado obliga a inventar
  excepciones. `sembrar_sabados(n)` las repone, es idempotente por `code` y solo
  la llama `service_role`. **Hay que volver a correrla** cuando se acaben las
  12 semanas sembradas.

Del diseño: el color es la **sede** y el estado va en **texto**. Si el color
hiciera las dos cosas, un torneo cancelado en Sonsonate y uno abierto en San
Salvador serían indistinguibles. Y la rejilla es de **seis semanas siempre**,
aunque el mes entre en cinco: si el alto cambiara al pasar de mes, la lista de
abajo daría un brinco a mitad del gesto (§3i).

### 3h-quinquies. El Mercado: carrito, reserva y por qué los cruces dan cero

`/pedidos` y la burbuja del Mercado leen `pedidos` + `pedido_lineas`. Lo
reservado **se deriva**, nunca se escribe en `collection`: la RLS de esa tabla
es `auth.uid() = user_id` sin excepción.

**La trampa que costó descubrir y que hay que recordar:** un
`select … for update` sobre `collection` desde el cliente devuelve **las filas
ajenas vacías, sin error**. Medido: 206 filas sin candado, 45 con `for update`.
Postgres aplica el USING de la policy de UPDATE a los SELECT con candado. Por
eso **toda** RPC del mercado es SECURITY DEFINER; una SECURITY INVOKER vería
«esta carta no está en venta» para toda publicación ajena.

Reglas que no se pueden relajar:

- **`carrito` NO reserva.** Reservan `enviado` y `aceptado`. Es toda la
  diferencia entre poner algo en el carrito y bloquearle la carta a alguien, y
  la UI lo dice con todas las letras en los dos sitios.
- **El candado va sobre la fila del VENDEDOR**, y lo reservado se suma DESPUÉS
  del candado, en la misma transacción. Ahí se resuelve que dos compradores
  peleen por la última copia.
- **Nada de FK de `pedido_lineas` a `collection`**: `collectionService` BORRA la
  fila cuando la cantidad baja a 0 — con CASCADE le borra el carrito al
  comprador, con RESTRICT le impide al vendedor bajar su carta.
- **El tope es `coalesce(sale_quantity, quantity)`**, y `listing.quantity` ya
  viene con esa regla aplicada. `sale_quantity` NULL significa TODAS.
- **Si al enviar algo cambió, no se manda NADA** y se dice qué línea y por qué.
  Mandar medio carrito en silencio es el fallo que se ve como éxito.

**LOS CRUCES DE INTERCAMBIO DAN CERO, Y NO ES POR LA REGLA DE «OFRECER».** La
cabecera de `tradeService.ts` explica que exigir `for_sale` o `quantity > 3` es
estricto a propósito. Pero medido: **`wishlist` tiene CERO filas** — nadie ha
añadido nunca una carta. El lado de la OFERTA sí está poblado (203
publicaciones, 493 filas con repetidas de 8 personas); el que está vacío es el
de la DEMANDA. El cruce lee **667 filas en cada visita al Mercado** para
cruzarlas contra 0.

Eso se arregló por los dos lados:

- **El corazón «la busco» está ahora EN la vitrina del Mercado**, arriba a la
  izquierda de cada carta. Antes el único sitio era dentro de `/cards/:id`, a
  tres toques de donde uno mira mercancía — nadie entra al detalle de una carta
  para marcar que la quiere. La clave que se guarda es el **uuid canónico**
  (`card.id`), no el `card_id` de la fila: la colección vive en dos espacios de
  ids y con el crudo la misma carta se marca dos veces y el cruce no casa.
- **El bloque vacío ya no se dibuja.** Ocupaba cerca de un TERCIO de la primera
  pantalla del Mercado —rótulo, ícono, tres renglones y un botón— para no decir
  nada, y empujaba las 237 publicaciones abajo del pliegue. Tampoco se dibuja
  mientras carga: un esqueleto que SIEMPRE termina en nada es un parpadeo en
  cada visita. Aparece solo cuando hay un cruce de verdad.
- **Y `getTradeMatches` se corta antes de leer nada** si `wishlist` está vacía
  en toda la base (una cuenta con `head`, sin traer filas). Con la tabla en
  cero ningún cruce es posible para nadie, así que las 667 filas de oferta no
  se leían para nada.

Si en unas semanas el corazón sigue sin usarse, la respuesta es quitar el cruce
entero: son tres líneas en `ExplorePage` y un archivo.

### 3h-sexies. El chat: un ALCANCE mas, y tres cosas que hay que tocar juntas

`galaxia_mensajes` sirve a TODO el chat: las salas de pais/tienda/global, la de
un pedido (`pedido`) y la de a dos (`dm`). Una conversacion privada no es un
sistema aparte — por eso los adjuntos de carta y mazo, el borrado suave, la
moderacion y el tiempo real vienen ya puestos.

**Agregar un alcance necesita TRES cosas, y saltarse una falla distinto:**

1. el tipo `AlcanceSala` en `galaxiaChat.ts`
2. su rama en `galaxia_pertenece` — si falta, la sala **nace cerrada** (el CASE
   del servidor termina en `else false`)
3. su valor en el CHECK `galaxia_mensajes_alcance_check` — si falta, **se entra
   y el primer mensaje rebota con un 23514**

El 2 sin el 3 ya pasó con `pedido`: la sala dejaba entrar a las dos partes y
rechazaba todo lo que escribieran. **Probar `galaxia_pertenece()` NO es probar
el chat; hay que INSERTAR.**

**El ambito no puede llevar un par de uuids.** El CHECK `ambito_coherente` lo
topa en 64 caracteres y un par con separador son 73 — medido. Por eso la
conversacion de a dos tiene fila propia (`conversaciones`), con el par ORDENADO
(`check (a < b)` + unico): sin eso, A abriendo con B y B abriendo con A crean
DOS salas y cada uno habla solo en la suya, sin ningun error a la vista.

**Leer y escribir se separan.** `galaxia_pertenece` decide quien LEE y
`galaxia_puede_escribir` quien ESCRIBE. Cortar a alguien no lo saca de la sala:
sigue leyendo el historial y deja de poder escribir. Borrarselo al bloquear le
quitaria a quien bloquea la prueba de lo que paso.

**Las salas privadas NO usan presencia.** `escucharPresencia` abre un canal de
Realtime identificado por NOMBRE, y esos canales **no los protege la RLS de
`galaxia_mensajes`**: quien conozca el id de la sala podria unirse y ver quien
esta conectado sin pertenecer. En `pais:SV` es inofensivo; en un chat de a dos
es una fuga. Y en un 1:1 tampoco aporta: ya sabes con quien hablas.

**Un admin NO puede leer una sala privada** (la policy de SELECT es
`galaxia_pertenece`, sin rama de admin) pero SI puede borrar un mensaje que no
puede leer. Eso es moderar sin espiar, y esta bien asi. Medido con `set local
role authenticated` de verdad — poner solo el JWT no aplica RLS.

**El puente con el Mercado:** `/mensajes?con=<uuid>&carta=<uuid>` abre la
conversacion con la carta YA enganchada (`adjuntoInicial` de `SalaChat`). La
clave que viaja es el uuid CANONICO de la carta, no el `card_id` de la fila: la
coleccion vive en dos espacios de ids y con el crudo no resolveria del otro lado.

### 3i. Sobres y álbum: la colección es SOLO brillante, y el brillo lo pone la app

`/sobres` (Sobredosis) y `/binder-digital` (El Álbum). El sorteo vive ENTERO en
`abrir_sobre()`, SECURITY DEFINER: el cliente no escribe ni una fila en las
cinco tablas. Las serializadas son de UNA persona en toda la comunidad y los
sobres son la moneda, así que un INSERT desde el navegador sería el juego
entero regalado.

**Dos trampas de permisos, y son DISTINTAS:**
- **Tablas**: Supabase concede ALL por defecto a `anon`/`authenticated` en toda
  tabla nueva de `public` (§2j). Conceder SELECT no basta — hay que REVOCAR.
- **Funciones**: Postgres concede EXECUTE a **PUBLIC** en toda función nueva, y
  `anon` es miembro de PUBLIC. `revoke ... from anon` NO lo quita. Se ve en el
  ACL como una entrada con beneficiario vacío (`=X/postgres`). Los dos RPC del
  álbum quedaron abiertos a `anon` por esto, con la migración de revoke ya
  aplicada.

**El pool son 2.669 filas en CINCO familias** (Hyperspace Foil 1.850,
Serializada 253, Foil Prestige 211, Standard Prestige 211, Showcase 144). La
Hyperspace pelada y la Standard Foil se BORRARON el 2026-08-19. El sobre es
4 Hyperspace Foil + la ranura de premio (62 / 16 / 11 / 8 / 3 %, medido sobre
300 aperturas). **Si hay que retirar otra variante con gente jugando, NO se
borra**: `cartas_desbloqueadas.card_id` es ON DELETE CASCADE y le arrancaría
cartas a todo el mundo. Se marca como retirada y se deja de sortear.

**El «foil» del API está QUEMADO en el PNG.** Medido bajando las imágenes y
comparándolas píxel a píxel: Standard vs Standard Foil da MAE 5,62 — son tres
estrellitas blancas arriba a la derecha y otro número de coleccionista. Igual
Hyperspace Foil vs Hyperspace (6,00) y Foil Prestige vs Standard Prestige
(4,49). Por eso `sobresArte.ts` resuelve la lámina SIN foil (por nombre +
subtítulo + **mismo setCode**) y el brillo lo pinta `Acabado.tsx`, que sí sigue
al dedo. Showcase y Prestige SÍ son arte propio (MAE 81-109): esas usan su
imagen. Y **nunca caer a la lámina de otro set**: las 6 Hyperspace Foil de GG
son exclusivas con otro ilustrador (MAE 53,8 contra la de SOR).

**`backImageUrl` NO es el dorso**: es la SEGUNDA CARA. En el pool la tienen 144
cartas, que son exactamente los 144 líderes Showcase. Sus dos caras miden al
revés (frente 400×286, reverso 286×400, medido 6/6), así que el bolsillo se
queda en 286/400 SIEMPRE y la cara acostada se acomoda dentro. No existe imagen
usable del dorso oficial (CDN 403, sitio oficial sin referencia, Strapi cerrado,
Wikipedia marcada fair use): `ReversoCarta.tsx` lo redibuja, y el logotipo de
Lucasfilm a propósito NO se copia.

**La casilla del álbum NO es el número impreso.** Por número serían 2.930
casillas para 2.669 cartas: **305 imposibles de llenar** —TWI Hyperspace Foil
sola aporta 295, o sea 33 hojas de vacío inalcanzable— y 23 casillas con 2 o 3
cartas distintas peleando (SEC Serialized repite CADA número tres veces). Es la
posición ordinal que calcula `album_seccion()` con `row_number()`, y el número
va de etiqueta; en 29 de las 33 secciones coinciden. Las secciones se ordenan
por ESCALA, nunca por `min(set_number)`: en TWI la Hyperspace Foil arranca en
el #3 y en SOR/SHD arranca antes la Showcase.

**La hoja SIEMPRE dibuja nueve celdas.** 13 secciones terminan con 1 a 3
casillas y tres con UNA: sin celdas de cierre, pasar de la hoja 5 a la 6
encogía la página de 471,8 a 150,6 px — 321 px de brinco a mitad del gesto.

**Un solo acabado caro por PANTALLA** (§3f). Las cuatro capas con
`mix-blend-mode` van en la carta protagonista; en las rejillas va `foil-plano`,
un degradado sin mezcla.

**Dos trampas del CSS, las dos pagadas:**
- **`@utility` solo emite la regla si Tailwind DETECTA la clase en el código.**
  Los 8 bloques `@utility foil-*` no llegaron nunca a la hoja de estilos:
  medido en el navegador, `foil-caja` salía `position: static` con `overflow:
  visible` y las capas de -75% bañaban la página entera. Los estilos de
  COMPONENTE van como CSS plano, igual que `.dorso-barrido`.
- **Nunca reemplazar reglas de este archivo con regex de selector.** El patrón
  `\.foil-arcoiris \{` también casa dentro de `.foil-solo .foil-arcoiris {`, y
  `\.foil-lustre \{` es el último selector de dos listas dentro de bloques
  `@media` — se comió sus llaves de cierre. Reemplazos por cadena literal
  completa, y **verificar contra el CSS CONSTRUIDO**, no contra el fuente: así
  se descubrió que `@keyframes foil-barre` había desaparecido y la carta del
  revelado salía con el brillo clavado.

`ReversoCarta` lleva ids SVG con `useId`: con ids fijos, dos dorsos en pantalla
resuelven sus `url(#…)` contra el primero y el segundo sale negro plano, sin
un solo error en consola.

Banco en **`/banco-sobres`** (solo desarrollo): se elige qué premio sale, los
tres acabados uno al lado del otro y el dorso. Sin él, revisar cómo se ve una
serializada es esperar 1 de cada 33 sobres.

**El SOBRE DIARIO son TRES con los avisos puestos, uno sin ellos.**

El criterio es tener fila en `push_subscriptions`, y NO una «bandera de
instalado», porque es lo único que el servidor puede comprobar de verdad: que
la app esté instalada no se ve desde Postgres, una suscripción sí. En iOS
además el push EXIGE la app instalada, así que en la práctica quien cobra tres
hizo las dos cosas.

Se premia un ESTADO, no un acto: quien apague los avisos vuelve a uno solo sin
que nadie revoque nada, y las suscripciones muertas las borra `enviarPush` con
los 410/404 — como el cron manda un aviso cada mañana, la lista se limpia sola.

**Lo que se anuncia tiene que ser lo que se reparte.** Los carteles dicen
«avisos activados», no «app instalada», porque eso es lo que decide la función.
Y dicen que empieza «en el reparto siguiente»: el reparto es una foto que se
toma a las 8:00, así que quien active a mediodía ya cobró el de hoy.

Dónde se anuncia (`OfertaSobresDiarios.tsx`): tarjeta en la puerta de
instalación, en el muro de acceso y en la bienvenida; y un EMERGENTE en Inicio
para quien ya está dentro sin avisos —el único caso sin pantalla propia, y el
más numeroso—. **El emergente decide con `Notification.permission` primero**:
`isUserSubscribed()` espera a `navigator.serviceWorker.ready`, y esa promesa
**no resuelve nunca** si no hay service worker registrado. Medido en el banco:
el efecto se colgaba y el cartel no salía jamás. Va con reloj de 3 s, y si el
reloj gana se decide NO mostrar — decirle «cobrás 1» a alguien que cobra 3 es
peor que un cartel que no salió.

**El SOBRE DIARIO cae a las 8:00 y el aviso NO puede ser solo push.** El reparto
es `dar_sobre_diario()` (solo `service_role`), que lo dispara el cron
`/api/sobre-diario` a las `0 14 * * *` — 14:00 UTC son las 8:00 de El Salvador,
que es UTC-6 todo el año. El día lo calcula la función con la zona SV y **no se
pasa por parámetro**: si viniera de afuera, cualquiera con la llave del cron
podría pedir «el sobre de ayer» y repartir otra tanda. Idempotente por el WHERE
del ON CONFLICT sobre `diario_en`, igual que `bienvenida_en` — probado en
transacción revertida: 26 la primera corrida, **0** la segunda y la tercera del
mismo día, y 26 otra vez con el día retrocedido.

El aviso llega por DOS caminos porque uno solo no alcanza: **medido, 4 de 26
perfiles tienen suscripción de push**. El cron pushea a esos 4 y la app le avisa
al resto con la franja de Inicio (`AvisoSobreDiario`) y la campana. Los dos leen
el MISMO hecho —`sobres_saldo.diario_en`—, así que si el cron no corrió, la app
tampoco anuncia nada.

Dos cosas que se descubrieron construyéndolo y valen para toda la app:

- **`dedupKey` de las notificaciones YA funciona — y su memoria es la campana.**
  Estuvo inerte: el tipo prometía «evita re-anunciar» y `addNotification` no lo
  miraba; solo cinco helpers deduplicaban aparte, y los seis llamadores directos
  del store se inventaron cada uno su defensa (un `useRef` que muere al
  desmontar, una marca en `localStorage`). Hoy la guarda vive DENTRO de
  `addNotification` en [notificationService.ts](src/services/notificationService.ts)
  y es la única. Dos reglas que no se pueden relajar: **sin clave no hay dedup**
  —un acuse de acción propia («Resultado enviado») debe sonar cada vez— y la
  clave **nunca** se deriva del texto. Y caduca a propósito con la campana (50
  avisos / 7 días): el dedup durable vive río arriba (Dexie, `user_missions`,
  `swu_gifts_last_seen`) y hay hitos que se RE-GANAN —el tier baja si borrás
  mazos— que con memoria eterna quedarían mudos para siempre.
- **`npm run build` NO comprueba tipos de `api/`.** `tsconfig.app.json` cubre
  `src/` y `tsconfig.node.json` solo `vite.config.ts`: un error de tipos en un
  endpoint aparece recién en el build de Vercel. Se comprueba a mano con
  `./node_modules/.bin/tsc --noEmit --strict --skipLibCheck --module esnext
  --moduleResolution bundler --target es2023 --types node api/*.ts`.

El envío de push vive en **`api/_push.ts`** (el guion bajo es lo que hace que
Vercel no lo convierta en una función). Lo comparten `/api/send-push` y el cron:
la parte que no conviene duplicar es el borrado de las suscripciones muertas
(410/404) — con dos copias, la segunda se olvida y el «enviados» empieza a
mentir.

### 3i-bis. El Centro de Temporada: una puerta que NO es `role = 'admin'`

`/temporada` reúne lo de llevar una temporada de torneos —inscritos, llaves,
tabla de puntos exportable, borrador del artículo— y **lo ve una sola
persona**. Hay CUATRO admins (Nelson, Jbeltramirez, ElDaigo, Rodorigo), así
que el rol no servía de puerta: la regla es estar en `centro_curadores`,
igual que `stream_operadores` («Ser admin NO alcanza»).

Con **una diferencia deliberada**: acá no hay escotilla de admin para
repartir accesos. Un admin que pueda darse el suyo vuelve la restricción
decorativa. Se reparte insertando la fila desde el SQL Editor.

**El gate de cliente es una cortina, no una cerradura.** `isAdmin` y el rol
viven en localStorage. Lo que cierra de verdad son las policies de
`temporadas_competitivas` / `temporada_fechas` y —esto costó una prueba— el
**guardia dentro de `temporada_tabla()`**: es SECURITY DEFINER con EXECUTE
concedido a `authenticated` entero, así que sin el `where es_curador()` de
adentro cualquier logueado que adivinara el uuid leía la temporada completa.
Medido antes de taparlo: Rodorigo, admin y no curador, la leyó sin problema.
Las diez pruebas están hechas con `set local role authenticated` — poner solo
los claims del JWT corre como dueño de tabla y la RLS nunca se aplica.

**Los puntos se CALCULAN, no se guardan.** `temporada_tabla()` los deriva de
`tournament_standings.puesto` en cada lectura. Un ledger sería una segunda
copia de una verdad que ya existe (§3c) y habría que acordarse de recalcularlo
cada vez que se corrige un puesto. Derivado no puede quedar viejo.

**La clave de jugador NO es `user_id`.** De los 8 del torneo del 15/8, **3 no
tienen cuenta y uno lo ganó**. Se agrupa por nombre normalizado igual que
`ranking_unificado()`. Escribir «Marlin» y «marlín» son dos personas
distintas: la pantalla lo advierte.

**La tabla de SP tiene una corrección medida.** 15/12/10/8/6, pero con **8
jugadores o menos el peldaño 5.º-8.º paga 6**: si no, seis últimos lugares
(48) le ganan a tres campeonatos (45), que es exactamente lo que el sistema
dice querer evitar. Va como columna (`ajuste_sala_chica`), no cableada.

**Solo cuenta lo `finished`.** Un torneo a medias tiene puestos provisionales.

**Cerrar va SOLO por `finishTournament()`** → RPC `cerrar_torneo`.
`advanceSwissRound` y `advanceEliminationRound` también ponen
`status='finished'`, pero con un update de cliente y **sin repartir nada**.

**El módulo no reconstruye el motor.** Importa `tournamentCloud`,
`swiss`/`elimination` y los componentes `BracketView` / `StandingsTable` tal
cual, y para reportar resultados **enlaza** a `/events/dashboard/:code`. Lo
único nuevo es `fijarSemillas()`: `initializeTournament` siembra con el orden
de INSCRIPCIÓN (`seed: idx+1`), que para un cuadro no significa nada.

**El borrador de artículo se escribe en el dialecto del blog**, y hay dos
reglas que si se rompen degradan el bloque a texto plano *sin un solo error
visible*: línea en blanco obligatoria a los dos lados de cada `[[…]]`, y
parseo todo-o-nada. Verificado contra el parser REAL (`parsearBloqueEstadistico`),
no a ojo. **No emite `[[carta:]]`**: el líder es texto libre y sin `|SET-NUM`
el bloque elegiría una impresión al azar («Cad Bane» son 5 cartas). Y por
debajo de **20 listas publica conteos, no porcentajes** — sobre 8 listas un
punto porcentual es media persona.

**El CSV escapa según RFC 4180, y los dos generadores que ya existían no.**
`collectionExport` y `deckImportExport` funcionan porque sus campos son
códigos de set; un nombre como «Vara, Christian» parte la fila en silencio.

**Está montado FUERA de `AppLayout`**, como `/admin`: así se salta la puerta
de instalación, el Header y la TabBar por estructura y no por una lista de
excepciones. **Y no hay entrada en ningún menú**: se entra tecleando
`/temporada`.

### 3j. Twin Suns (TS26) y por qué «estaba en la base» y aun así no existía

Reporte: «las cartas de Twin Suns no están en nuestra base». Medido: **sí
estaban**. Las 88 impresiones de TS26 llevaban tiempo en Dexie —9.185 filas,
las 88 canónicas y con `searchBlob`— y escribir «Ahsoka» ya las encontraba.

Lo que no existía era la forma de LLEGAR a ellas, y eran dos sitios:

- **Explorar** (`/cards`) armaba los chips de set con
  `sets.filter(s => s.cardCount >= MAIN_SET_MIN_CARDS)`, o sea 500. TS26 son
  88 cartas: no había chip, y sin chip no hay forma de pedir «todo el set».
- **El Binder** decide qué se puede coleccionar con `isCollectible()`, que usa
  `MAIN_SET_LABELS` como lista blanca. TS26 no estaba: sus cartas no contaban
  para ningún progreso y el set no tenía barra.

**La lección de nombres:** había dos preguntas distintas usando el mismo
criterio. «¿Es una expansión grande?» (para saber cuál es la más nueva) y
«¿se puede coleccionar?» no son lo mismo, y TS26 —88 cartas, pero con 8
líderes y 4 bases propios— las separa. Ahora `MAIN_SET_LABELS` responde la
segunda y `MAIN_SET_MIN_CARDS` la primera. Si se mezclan otra vez, el próximo
producto suplementario vuelve a desaparecer.

Denominadores del Binder tras el cambio: 252/262/257/262/265/264/265/264 +
**TS26 84** = **2.175** coleccionables (antes 2.089). Los 4 tokens de TS26 no
cuentan, como en todos los sets.

Dos comprobaciones que valió la pena hacer antes de tocar nada:
- **Choques de nombre.** De las 88, solo 4 repiten (nombre, subtítulo) con una
  Standard ya existente, y las 4 son fichas —Battle Droid, Clone Trooper,
  Experience, Shield— que ya se repetían entre sets. **84 son nuevas de
  verdad.** No es una regresión: sin TS26 ya había 97 grupos repetidos y 121
  filas de más.
- **Precios.** `SET_GROUP_MAP` y `ALLOWED_GROUPS` del proxy YA tenían
  `TS26: 24622` (verificado contra tcgcsv: grupo 24622 = «Twin Suns»), así que
  los precios de TS26 son reales, no heredados de otra carta.

**El centinela de completitud NO detecta que el catálogo creció.**
`isDatabaseComplete()` compara `count >= expected`, y `expected` es lo que
guardó la última carga: si el API pasa de 9.057 a 9.185, una caché de 9.057
sigue dando `true`. Lo que salva la situación es el refresco semanal de
`ensureFreshDatabase()`, así que un set nuevo tarda **hasta 7 días** en
aparecer. Si alguna vez hay que hacerlo inmediato, la sonda barata existe: la
suma de `total_cards` de `/sets` da exactamente el total del export (9.185
verificado) y pesa **5,8 KB contra 9,9 MB**. Guardar esa suma y comparar por
DESIGUALDAD —nunca por «es mayor»— evita el bucle si el API alguna vez la
infla.

### 3j-bis. «Todas las impresiones» viene encendido

Explorar arrancaba mostrando solo la impresión canónica: **2.316 filas de
9.185**. Las Hyperspace, Showcase y foil —con lo que la gente abre sobres y
arma binder— quedaban detrás de una casilla dentro del panel de filtros.

Ahora el valor inicial es `true`. **Cuesta 3,97× más filas** y entran también
~400 promos de torneo (GC Top 64, SQ Prize Wall…) que casi nadie tiene; está
aceptado a propósito. Si algún día estorban, lo que hay que filtrar son esas
variantes concretas, **no volver a esconder las Hyperspace**.

La instantánea del buscador (`_snapshot`, a nivel de módulo) sigue mandando
dentro de la sesión: quien lo apague lo mantiene apagado mientras navega. Y
`clearFilters()` **no** lo toca, así que «Limpiar» no lo apaga.

### 3k. Torneos de MESAS (Twin Suns) y el else que escribía pareos

Twin Suns es multijugador: mesas de 3 o 4. Eso **no cabe en
`tournament_pairings`**, que tiene dos columnas de jugador y un ganador. Una
mesa de 4 solo entraría como filas con `player2_id` NULL — y `PairingsView`
lee eso como **BYE**: dibujaría partidas que nunca se jugaron, en las tres
pantallas que comparten ese componente. Tabla nueva (`tournament_mesas`, un
asiento por fila); `tournament_pairings` no se toca.

**Se llama `mesas`, no `twin_suns`.** Ese valor YA existe como *formato de
mazo*; con el mismo nombre, una fila tendría `format='twin_suns'` y
`tournament_type='twin_suns'` significando cosas distintas. Son dos ejes:
el formato dice con qué mazo se juega, el tipo cómo se estructura el torneo.

**La aritmética está cerrada, no es heurística.** M mesas sirven si y solo si
`3M ≤ N ≤ 4M`; de ahí salen las de 4 (`N−3M`) y las de 3 (`4M−N`). El único
número entre 3 y 32 que **no cierra es el 5**. Y elegir mesas importa: con 12
se puede jugar 3 de 4 o 4 de 3, y son torneos distintos. Todo en
`services/mesas.ts`, puro y probado sobre 3..40.

**El servidor VALIDA, no recalcula.** El reparto lo calcula el cliente y
`armar_mesas()` comprueba que sea legal (la gente activa exacta, nadie dos
veces, toda mesa con 3 o 4, numeradas sin saltos). Dos algoritmos de siembra
se separarían; un validador y un generador, no.

**El else que ESCRIBÍA.** `TournamentDashboard` tenía
`tournament_type === 'elimination' ? … : generateSwissPairings(…)`. Cualquier
tipo nuevo caía en la rama suiza: apretar «Generar ronda» en un torneo de
mesas **escribía pareos 1v1 en la base** y decía «Ronda N generada» en verde.
Era el único else del sistema que escribe. Y dos rótulos se contradecían
sobre el mismo torneo: la vista pública llamaba «Eliminación» a todo lo que
no fuera suizo y la del jugador «SWISS» a todo lo que no fuera eliminación.
Todo sale ahora de `services/tipoTorneo.ts`, que además tiene la lista de
opciones que estaba **copiada** en las dos pantallas de creación.

**`_repartir_premios` no leía `puesto` — y eso ya estaba roto en producción.**
Ordenaba por `points, omw_pct, gw_pct, player_name`. Medido en el torneo del
15/8: la columna dice Vara 2.º / Christian 3.º y el reparto daba Christian
2.º / Vara 3.º — el podio que la gente vio y el que reparte XP y sobres eran
distintos. En un torneo de mesas sería peor: nadie escribe `omw_pct` ni
`gw_pct`, quedan en 0 y el desempate real pasa a ser **el abecedario**. Ahora
manda `coalesce(puesto, 32767)` y donde no hay puesto se conserva el orden
viejo.

**Dónde se opera un torneo de mesas: `/events/dashboard/:code`, pestaña
«Mesas».** Estuvo un rato dentro del Centro de Temporada y estaba mal por dos
motivos: llevar un torneo multijugador es una función de TORNEOS, no de
temporada; y el Centro lo ve **una sola persona**, así que ningún otro
organizador podía operar un Twin Suns. El Centro solo enlaza. `MesasPanel`
vive por eso en `features/events/`, no en `features/temporada/`.

**Y la pestaña se ofrece SIEMPRE, no solo si el torneo ya es de tipo
`mesas`.** Estuvo escondida detrás del tipo y el resultado fue que la
herramienta existía y no aparecía en ningún lado para quien no hubiera
acertado al crear el torneo — que es exactamente lo que pasó con los torneos
del sábado, creados como suizos. Adentro se ofrece `cambiar_tipo_torneo()`,
que solo funciona ANTES de sembrar.

**El torneo del 15/8 (SV150826) se queda como está — DECISIÓN DE NEL.**
Tiene `premios_en` marcado y **cero filas en `tournament_results`**: se cerró
sin repartir, así que 5 jugadores con cuenta quedaron sin XP y sin sobres, y
el pestillo impide reintentar. Parece un bug abierto y **no hay que
arreglarlo**: destrabarlo repartiría premios reales meses después, y Nel
decidió el 2026-08-22 dejarlo así. Si aparece otra vez en una auditoría, esta
línea es la respuesta.

**Hay que llamar `fijar_puestos_finales()` ANTES de cerrar.** Si `puesto`
queda NULL, `temporada_tabla()` filtra `puesto is not null` y el torneo
entero desaparece de la temporada **sin un solo error**.

**Y `getEventByCode` filtra `status in ('open','active')`** — es correcto para
inscribirse, pero el Centro de Temporada decía «no se encontró el torneo»
para todos los ya cerrados. Para operarlos está `getEventByCodeAnyStatus`.

### 3k-bis. El Contador de MESA, y por qué el panel necesitó variante

`/contador/mesa` es el Contador para 3 o 4 jugadores. Es **otra pantalla** y
no un parámetro del duelo: el duelo está construido sobre dos lados
enfrentados (`{a, b}`, `lado: 'a'|'b'`, `juegos: {ganador}`), y generalizarlo
a N tocaba guardado, subida a la nube de amistosas, misiones e historial —
todo por una mesa que no usa ninguna de esas cosas.

Lo que sí comparten son las piezas: `MitadJugador` y `SelectorLado` se
extrajeron a `features/contador/piezas.tsx` **sin cambiarles una línea**, y
los tipos/ayudas a `estado.ts` (separados porque un archivo que exporta
componentes Y funciones rompe el Fast Refresh).

**La variante `compacta` no es cosmética.** El panel reparte la pantalla en
tres tercios táctiles y dibuja círculos de 80 px. A ancho completo el tercio
mide ~125 px y entran; en una rejilla 2×2 el panel es la mitad de ancho, el
tercio baja a ~62 px y **el botón de sumar quedaba cortado por el borde** —
verificado en pantalla. Compacta encoge círculos, cifra y adornos; las zonas
tocables siguen siendo el tercio entero.

**Rotaciones:** con 4, rejilla 2×2 y los DOS de arriba a 180°. Con 3, uno
arriba a 180° a todo el ancho y dos abajo. No se rota 90° a los laterales a
propósito: una cifra en vertical no se lee de reojo, que es justo lo que hay
que hacer en medio de un turno.

**El resultado se anota por ORDEN DE CAÍDA**, no eligiendo puestos: se marca
quién queda fuera y el último en pie es el 1.º. Verificado — cayendo 2, 4 y 1
la barra dice «1.º Asiento 3 · 2.º Vos · 3.º Asiento 4 · 4.º Asiento 2», que
es exactamente lo que el organizador copia a la pestaña Mesas del torneo.

Banco en `/banco-mesa-contador` (solo desarrollo): la puerta de instalación
tapa `/contador/mesa` en un navegador normal.

### 3l. `/torneos` es la puerta para ORGANIZAR, no solo el archivo

Reporte de Nel: «el modulo de Torneos parece que muestra los torneos que se han
realizado pero necesito un modulo donde hacer los torneos». Diagnóstico:
**faltaba puerta, no capacidad.** Todo lo de llevar un torneo ya vivía en
`/events/dashboard/:code` —sembrar, suizo, cuadro, mesas, temporizador, cerrar
y repartir— **sin una sola entrada de menú**: se llegaba desde `/admin/events`
o tecleando el código.

**Y había un candado circular.** El botón hacia el tablero estaba gateado por
`status === 'active'` en las DOS listas que lo ofrecían (`EventsPage.tsx:419`,
`AdminEventsPage.tsx:170`), pero activar un torneo requiere entrar al tablero.
Un torneo «activado» desde el panel quedaba inarrancable. En `/torneos` →
Organizar, «Llevar el torneo» **no mira el estado**.

**El botón «Iniciar Torneo» se decide por DATOS.** Era
`isNotStarted && status === 'open'`. No se puede relajar a `!isFinished`:
`initializeTournament` termina dejando `current_round: 0`, así que el botón
reaparecería tras sembrar y un segundo toque insertaría la clasificación DOS
veces. La condición correcta es `standings.length === 0`.

**El conteo de inscritos SOLO se muestra a un admin.** Medido con RLS real:
`reg_select` deja ver `event_registrations` únicamente a los admin — un jugador
normal y un visitante anónimo ven **0 filas de 8**. La consulta no falla,
devuelve 0, así que pintarlo anuncia vacío un torneo con gente. **El mismo
defecto sigue vivo en `EventsPage`**, que es anterior.

**Dos enlaces que expulsaban en silencio:** el «Ir al Torneo» del lobby iba a
`/events/tournament/live`, que cae en la ruta del motor LOCAL y dice «Torneo no
encontrado»; y el «Editar» de melee iba a una ruta inexistente y te dejaba en
Inicio. El primero corregido, el segundo retirado.

**«Mis Torneos» del Perfil llevaba a una pantalla que NUNCA carga.**
`TournamentListPage` ordena por `updatedAt` y ninguna de las 10 versiones del
esquema Dexie lo indexa: SchemaError, sin `.catch()`, spinner eterno. Repuntado
a `/torneos`.

**El motor LOCAL (Dexie) se congela, no se retira.** Uso medido: 2 sesiones en
toda la vida de la app. Pero una fue Rodorigo el 8/8 — la noche en que el
evento `SWUDYP5` quedó en la nube con 4 inscritos y **0 rondas / 0 pareos / 0
clasificación**. No eligió el motor local por gusto: **el de la nube no sabe
emparejar a un jugador sin cuenta en vivo** (`tournamentCloud.ts:213` llavea el
suizo por `s.user_id`, y dos invitados colapsan en `null`). Se retira cuando
ese hueco esté cerrado y haya corrido un sábado con invitados, no antes.

**Y lo local NO se puede migrar desde el servidor.** Vive en el IndexedDB del
aparato de quien lo corrió; en la nube no dejó rastro (`tournaments_finished`
sigue en 0 para todos). Recuperarlo exige una exportación desde ESE aparato.

### 3m. Misiones: el XP tenía DOS casas, y las hazañas casi nacen mudas

Reporte de Nel: «no está subiendo la XP». No era la pantalla: el XP se pagaba
y se perdía.

**`claimMissionReward` leía el XP de la nube, sumaba y escribía de vuelta.**
`syncStatsToCloud` hace un upsert de la fila ENTERA de `player_stats` desde el
Dexie del aparato, así que el siguiente sincronizado devolvía el XP al valor
viejo. §3c otra vez: dos fuentes de una verdad.

La prueba estaba en la base y se puede repetir: `daily_missions_completed` se
escribía en el MISMO update que `xp`, y **8 de 11 personas** con misiones
cobradas tenían el contador por debajo de sus cobros reales. Nelson: 7
cobradas, 2 registradas → **5 pagos perdidos**. Y como la misión queda
`claimed`, eran irrecuperables.

Hoy:
- **`sumar_xp(n, motivo)`** hace `xp = xp + n` del lado del servidor, deriva el
  nivel y topa en **500 por llamada** — sin ese tope, un cliente manipulado se
  regala el ranking.
- **`statsToSnake` dejó de mandar `xp`, `level` y los dos contadores de
  misión.** Un upsert no puede pisar lo que no envía. La bajada
  (`statsFromSnake`) sí los sigue leyendo: la nube manda, el aparato copia.
- **Si el pago falla, la misión se DESMARCA.** Dejarla `claimed` sin haber
  pagado es exactamente cómo se perdieron los 15 pagos.

**`acreditarXp` (en useAuth.ts) es el único camino, y hay que llamarlo.** Se
llamaba `addXpWithSync`, hacía justo lo contrario (sumaba local y subía la fila
entera) y **no tenía un solo llamador en toda la app** — la misma forma que
«una misión sin llamador es una tarea imposible». Suma en el servidor y BAJA el
total resultante a Dexie: las dos mitades hacen falta, porque el número de la
pantalla sale de Dexie y sin la bajada no se mueve hasta el próximo inicio de
sesión, que se ve igual que si no se hubiera pagado.

**Quedan dos leer-sumar-escribir vivos y NO se pueden convertir**:
`awardMatchResult` y `awardTournamentFinish` reciben un `supabaseUserId` que
puede ser de OTRA persona (el tracker local recorre a todos), y `acreditarXp`
escribe en el Dexie de quien está sentado al teclado. Están en el motor local
congelado (§3l); se arreglan cuando ese motor se retire.

**Las HAZAÑAS (`type: 'unique'`, `period_key = 'once'`).** Irrepetibles por el
único `(user_id, mission_id, period_key)` — no hace falta una columna de «ya la
hizo». Tres cosas medidas:

- **El CHECK las habría dejado mudas.** `user_missions_mission_type_check` solo
  aceptaba `daily` y `weekly`: cada insert rebotaba con 23514, y
  `updateMissionProgress` **no desestructuraba `error`** (§2f), así que el
  fallo se veía IDÉNTICO a «esta misión todavía no avanza». Toda la función
  construida, desplegada y muerta sin un solo mensaje. Es el mismo par del
  §3h-sexies: **tocar el tipo en el cliente sin ampliar el CHECK no falla al
  entrar, falla al escribir.** El CHECK ya está ampliado y el `error` ya se
  mira — lo segundo era el bug de verdad.
- **Van TODAS a pantalla, no una selección sorteada.** Son hitos: esconder uno
  ya cumplido le quita a alguien la prueba de haberlo hecho. Las pendientes se
  ordenan primero.
- **`clavePeriodo(tipo)` vive en un solo sitio.** La regla estaba escrita como
  `type === 'daily' ? dayKey : weekKey` en cuatro lugares, y con un tercer tipo
  ese ternario mandaba las hazañas al cajón semanal: habrían caducado cada
  lunes.

**Se sembraron desde la historia real** (101 filas, 30 personas, 62 ya
cumplidas). Sin sembrar, las 26 personas que ya publicaron en el muro abrirían
Misiones y verían «Primera señal 0/1», desbloqueable solo al publicar OTRA vez
— un contador que miente. Se sembró el PROGRESO, nunca el cobro: `claimed`
queda en false y cada quien reclama y ve su número. **Consecuencia a la vista:
al reclamar, `acreditarXp` también suma al ranking MENSUAL**, así que el mes de
la siembra recibe hasta 905 XP viejos de una persona. El ranking de verdad no
se toca — `ranking_unificado()` mide jugar, no XP (§3c).

**`u_play10` no se siembra**: las partidas del Contador viven en el Dexie del
aparato y la nube no las conoce. Arranca en 0, que es lo único afirmable.

**Y lo que se anuncia es lo que se paga.** La tarjeta enseñaba `rewardXp` a
secas y el cobro real es `rewardXp + BONUS_POR_TIPO[type]`: 20 XP de menos en
cada diaria y 60 en cada semanal.

Banco en **`/banco-misiones`** (solo desarrollo): la página entera sin sesión,
con el catálogo en cero. Antes el efecto salía con `if (!userId) return` y
dejaba un spinner eterno.

### 3n. Misiones fáciles: el barajado no barajaba y el sorteo no garantizaba nada

Pedido de Nel: «aumenta las misiones que sean fáciles». El catálogo pasó de
**26 a 54** (21 diarias, 13 semanales, 20 hazañas; 31 de un toque) y se sortean
**6 diarias** en vez de 4. Pero antes de agrandar el montón había tres cosas
rotas, y las tres se midieron.

**`sort(() => rng() - 0.5)` NO es un barajado.** Un comparador aleatorio le da
al motor de ordenamiento respuestas incoherentes y el resultado depende de su
algoritmo interno. Corriendo el sorteo REAL sobre 365 días:

| montón | se sortean | la que más sale | la que menos | sesgo |
|---|---|---|---|---|
| 10 | 4 | 190 | 117 | 1,6× |
| 25 | 6 | 154 | **66** | **2,3×** |

**Empeora cuanto más grande es el montón, y el sesgo es POSICIONAL**: las de
más abajo del arreglo son las que menos salen. O sea que agregar 28 misiones al
final habría sido agregarlas para que casi no aparecieran — la ampliación
entera fallando en silencio. Con Fisher-Yates el mismo experimento da 1,2×.

**El sorteo no garantizaba nada hacible.** Medido sobre 365 días con el
catálogo viejo: **22 días al año no salía NINGUNA misión** que la mayoría
pudiera hacer, y el **38 % de los días** salía como mucho una. No es raro
—«enviar un regalo» lo hicieron **3** personas de 38 y «jugar una partida» 7, y
competían de igual a igual con «publicar en Comunidades», que hicieron 26—.

El resultado estaba en la base: **19 de 38 personas con 0 XP**. Cada plantilla
lleva ahora `dificultad` (`toque` / `rato` / `reto`) y `sortearMisiones`
garantiza un piso: **3 fáciles al día, 2 a la semana**. 0 días sin el piso en
365. Las fáciles entran dos veces al sorteo, así que salen más seguido a
propósito; dentro de cada nivel el reparto queda entre 1,1× y 1,5×.

**Cuánta gente HIZO cada acción alguna vez** (de 38, y es el criterio para
poner `dificultad`): Comunidades 26 · mazo 14 · sobre 11 · favorita 10 ·
amistosa 8 · partida 7 · chat 5 · **regalo 3**.

**Ninguna misión decía DÓNDE se hace.** «Publicar algo en el muro» usaba una
palabra que **no existe en ninguna pantalla de la app**: la sección se llama
«Comunidades», está a tres toques (Perfil → Más → Comunidad) y el botón dice
«Escribir al grupo…». Nel, que construyó la app, no supo cómo cumplirla — si no
la encuentra él, no la encuentra nadie. Cada plantilla lleva `ruta` y `donde`
(**el nombre de la pantalla tal como se lee en el menú**) y la tarjeta es un
botón que lleva ahí. Si agregás una misión, el `donde` se copia del menú, no se
inventa.

**El catálogo salió a `misionesCatalogo.ts`**, puro y sin red, como `mesas.ts`.
Que estuviera pegado a `supabase` es *la razón* de que el sesgo del barajado no
se viera nunca: para medirlo había que levantar medio backend.

**`scripts/misiones-tienen-llamador.mjs` vuelve COMPROBABLE la regla del
§3h-ter.** Cruza tipos declarados / usados por una plantilla / disparados por
alguien, y falla si los tres números no coinciden. Acordarse no alcanzó: ya se
rompió dos veces. Corrélo al tocar el catálogo.

**Y `loginDays`/`currentStreak` estaban MUERTOS.** Se escribían una vez en
`createDefaultStats` y nadie los volvía a tocar: los **38** perfiles tenían
`login_days = 1` y racha 0, sin excepción. Tres logros (7/30/100 días), tres
cosméticos y el número de racha que Inicio enseña llevaban muertos desde el
primer día. `registrarVisita` (en gamification.ts) es **pura** y está probada
en `scripts/racha-visitas.test.mts` sobre cambio de mes, cambio de año y 29 de
febrero — el primer intento tenía un desfase de UN día (calculaba «ayer»
pasando la clave `YYYY-MM-DD` por un conversor de zona, y una medianoche UTC en
El Salvador todavía es el día anterior) y la racha nunca pasaba de 1. Leyendo
el código no se ve; simulando 30 días sí. Para correr una clave de día usá
**`diaSinZonaMas`**, nunca `diaCalendarioSVMas`: esa toma un INSTANTE.

### 3ñ. El sub-nombre de la credencial, y dónde cabe de verdad

Debajo del apodo de la placa va una línea chica: «The Creator» en la de Nelson,
la que cada quien elija en la suya, y nadie más puede ponerse nada que apunte
al creador.

**Es COLUMNA (`profiles.subnombre`) con disparador, no una llave del JSON de
`settings`** como el apodo y la ubicación. La credencial se exporta a PNG y se
comparte (§3b): una regla que solo vive en el navegador se salta editando
`localStorage`. No es una regla, es una sugerencia.

**«The Creator» no se teclea: se DERIVA** de estar en `centro_curadores`, la
tabla que ya significa «solo Nelson» y que a propósito no tiene escotilla de
admin (§3i-bis). Si el título se pudiera escribir, la prohibición sería
decorativa.

**La normalización no es `lower()`.** Quita tildes, traduce los números que se
usan como letras (0→o, 1→i, 3→e, 4→a, 5→s, 7→t) y borra todo lo que no sea
letra, así que «Cre4dor», «C R E A T O R», «Créator», «Th3 Cr34t0r» y
«c.r.e.a.d.o.r» caen igual. Se bloquean RAÍCES (`creator`, `creador`,
`creater`, `kreator`, `kreador`, `creatore`, `criador`), **no** `creado` ni
`crear`: la regla es no apuntar al creador, no prohibir un verbo — «Creativo» y
«Creado en SV» son sub-nombres legítimos.

**La regla existe DOS veces y hay una prueba que impide que se separen.**
`services/subnombreRegla.ts` (puro, para responder sin viaje) y
`subnombre_reservado()` en Postgres (la que manda).
`scripts/subnombre-espejo.mjs` tiene la ÚNICA lista de casos y la corre contra
las dos: **32/32 en los dos lados**. `--sql` escupe la consulta para la base.

**Dónde va en la placa lo decidió el DetectorChoques, no la aritmética** (§2z,
otra vez). El primer intento lo puso en y=140 a cuerpo 10 y el detector lo cazó
en las **27** placas: pisaba la sublínea Aurebesh por 2,6 y UBICACION por 2,1.
Las cajas reales: apodo 104,4→121,8 · Aurebesh 124→132 · UBICACION 140,9→153.
Entre la Aurebesh y UBICACION quedan **8,9 unidades** y un renglón de cuerpo 10
mide 13,6: no entraba, y no era cuestión de apretar.

Solución: **cuando hay sub-nombre, ocupa el lugar de la Aurebesh del apodo** —
que es el mismo texto transliterado, o sea adorno, mientras que el sub-nombre
es un dato. Quien no se ponga uno conserva su sublínea intacta. Sin la Aurebesh
el hueco es 121,8→140,9 y a cuerpo 12 la caja mide 16,3: 1,4 de aire arriba y
abajo. **27 placas medidas, limpio.**

### 3o. Préstamos: estuvo a medias meses y el síntoma era «0 filas»

`/prestamos` anota quién tiene tus cartas y a quién le debés vos. Es un
RECORDATORIO: **no toca `collection`**, la carta sigue siendo de quien la
prestó — si la moviera, una devolución mal anotada le borraría cartas a
alguien.

**Cómo quedó a medias, que es la lección.** La primera parte dejó la tabla,
`cerrar_prestamo` y `prestamos_pendientes` aplicados y probados… y `prestamos`
con **UNA sola policy, la de SELECT**. Se podía leer, cerrar y contar préstamos
que nadie podía crear. Tampoco había una línea de frontend. La tabla llevaba
**0 filas** en toda su vida, y eso se lee como «nadie lo usa» cuando en realidad
era «no hay por dónde». Y el archivo de migración era **100 % comentario**: el
DDL se aplicó por MCP y nunca se escribió al repo, así que el proyecto
documentaba un módulo cuyo esquema no estaba en ningún lado.

**Prestar va por RPC, no por una policy de INSERT.** Un insert con policy deja
al cliente elegir `estado`, `prestado_en`, `cerrado_en` y `cerrado_por`: con
`estado` en la mano se escribe un préstamo ya «devuelto» —o «disputado» en
nombre del otro—, que es exactamente lo que los permisos asimétricos de
`cerrar_prestamo` cuidan.

**Si quien recibe TIENE cuenta, el nombre lo pone el servidor** desde su perfil,
nunca lo que se teclee. Es un dato sobre otra persona y esa fila la ve ella:
poder escribirlo a mano sería poder anotar «Fulano me debe» con el nombre
cambiado.

**No se exige tener la carta registrada**, a diferencia del Mercado
(`markCardForSale` pide `quantity > 0`). Publicar es ofrecer algo; esto es un
recordatorio, y si prestaste una carta que nunca cargaste el sistema no tiene
por qué llamarte mentiroso. La pantalla ofrece tu colección primero, que
resuelve el caso normal sin convertir el raro en un muro.

**Permisos asimétricos, a propósito:** cancelar SOLO quien presta (es deshacer
una anotación propia), disputar SOLO quien recibe, devuelto LOS DOS (si solo
pudiera uno, el otro se queda con un recordatorio que no puede apagar). **La UI
sigue esa regla en los botones** en vez de mostrarlos todos y dejar que el
servidor rechace: un botón que siempre falla se lee como que la app está rota.

15/15 probado con `set local role authenticated`, incluido el insert directo
saltándose el RPC.

### 3p. El emergente de ubicación no contradice al AvisoPerfil: lo acota

`AvisoPerfil` es una tarjeta y **no** un modal a propósito, y su comentario
explica por qué. `AvisoUbicacion` sí es emergente, y la diferencia es que son
dos cosas distintas metidas en el mismo bulto:

- la bio, los aspectos y el nombre del planeta son **adorno**;
- el país es **funcional**: sin él quedás fuera del ranking por país, de la sala
  de chat de tu país y de la pestaña SV del meta.

Medido: **3 de 38** perfiles no tienen país (28 SV, 5 ES, 1 MX, 1 AR). Con esos
números el emergente no es invasivo, es el único momento en que se le va a
preguntar a esas tres personas.

**Lleva su propia llave en `localStorage`** y no la del otro aviso: el «No me lo
recuerdes» de `AvisoPerfil` lo calla PARA SIEMPRE, y colgando de esa marca quien
la haya tocado alguna vez nunca vería la pregunta. Pospone 3 días, no 7 y no
eterno.

**Espera a que HAYA perfil antes de juzgar.** `currentProfile` arranca en null
en cada arranque en frío (§2v): sin esa guarda el emergente saltaría un instante
en cada apertura para TODO el mundo, que es justo lo que enseña a cerrar avisos
sin leerlos.

### 3q. La identidad de un jugador DENTRO de un torneo no es su cuenta

`tournament_pairings.player1_id` / `player2_id` / `winner_id` son FK a
**auth.users**, y hasta 2026-08-23 todo el motor llaveaba a los jugadores por
`user_id` — que es NULL para quien juega sin cuenta, y en la sala real es un
tercio de la gente. **No es que «no se pudiera»: el motor INVENTABA
resultados.** Tres fallos, los tres sin un solo error a la vista:

1. **Un invitado en el lado 2 se leía como BYE.** Se guardaba con
   `player2_id = NULL`, que es exactamente la condición de bye: ganador
   automático 2-0 y +3 puntos, +1 victoria, +2 juegos y +1 bye acreditados por
   una partida que hay que jugar.
2. **Con N invitados, las N filas colapsan en la clave `null`.** Medido con el
   algoritmo real sobre 8 jugadores con 3 invitados: **solo 5 quedaban
   sentados y salían 2 byes falsos**. Tres personas desaparecían de la ronda —
   sin mesa, sin bye y sin error. Con la llave nueva: 8 de 8, 4 mesas, 0 byes,
   0 revanchas en la ronda 2 (`scripts/suizo-invitados.test.mts`).
3. **Si ganaba el invitado, el rival cobraba EMPATE.** `winner_id` quedaba
   NULL y el código deducía el empate de `winner_id === null`: +1 punto y +1
   empate por una partida perdida. Es literalmente el torneo del 8/8, donde el
   campeón no tenía cuenta — por eso esa noche se usó el motor local de Dexie.

**La identidad pasa a ser `tournament_standings.id`**: una fila por jugador y
por evento, existe con cuenta o sin ella, **nunca es null**. Así `null`
recupera su único significado honesto: no hay rival.

**Las columnas viejas se quedan y NO son una copia.** Responden otra pregunta:

| columna | pregunta |
|---|---|
| `player*_standing`, `winner_standing` | **quién juega** |
| `player*_id`, `winner_id` | **qué cuenta** puede reportar / confirmar / disputar (`auth.uid()`) |

Un invitado tiene lo primero y no lo segundo. `winner_standing` es
imprescindible y no un adorno: sin él no hay forma de decir «ganó el invitado»
y el empate sigue siendo indistinguible (fallo 3).

**`swiss.ts` y `elimination.ts` NO se tocaron**, y eso es lo que confirma el
diagnóstico: a esos archivos nunca les importó qué SIGNIFICA el id, solo que
fuera único. El fallo estaba en lo que se les pasaba. La verificación
adversarial refutó 3 de 10 hallazgos justamente ahí.

**Si tocás pareos, la regla es una:** todo lo que pregunte «¿hay rival?»,
«¿quién ganó?» o «¿de quién es este nombre?» va por `*_standing`. Solo los
permisos van por `*_id`. Un `player2_id is null` en una condición de BYE es el
bug volviendo.

Backfill verificado: 12 pareos históricos, **0 divergencias** entre la llave
vieja y la nueva.

Y `CloudStanding.user_id` pasó a `string | null`, que es lo que la columna
siempre admitió. Esa mentira de tipos es la razón de que el compilador jamás
señalara el caso del invitado: `Map.get(null)` y `id: null` pasaban sin una
advertencia. Al corregirla salieron 5 sitios, ninguno sospechado antes.

**Un torneo cerrado SIN resultados sigue siendo anotable** (`MesasPanel`): el
del 22/8 se cerró con las 2 mesas armadas y los 8 puestos en NULL, y la
pantalla tapaba la única forma de recuperarlo aunque el servidor sí lo
permitía. Se reabre solo mientras no haya un puesto anotado; con uno, el
torneo vuelve a estar cerrado de verdad.

### 3r. Verificar el deploy con `curl` en bucle dispara el escudo de Vercel

Sondear `https://swusv.com` cada 15 s para comparar el hash del bundle acaba
en **403 «Vercel Security Checkpoint»**. Es el escudo antibots contra **la IP
que sondea**, no una configuración del proyecto —`swusv.com` no tiene
protección de despliegue, solo la SSO de los dominios de vista previa— así que
la comunidad no lo ve. Pero deja de servir para verificar, y encima confunde:
parece que el sitio se cayó.

**Verificá por la API de Vercel**, no golpeando el dominio: la lista de
despliegues da `state: READY` y el `githubCommitSha`, que es la prueba directa
de que ese commit está en producción.

Y si igual comparás hashes: **`ls dist/assets/index-*.js | head -1` agarra el
archivo equivocado.** Hay dos que empiezan con `index-` (el de entrada de
~385 KB y un chunk de ~16 KB), y el orden alfabético no distingue. El bueno es
el que referencia `dist/index.html`:
`grep -o 'assets/index-[A-Za-z0-9_-]*\.js' dist/index.html`.

### 3s. Ranking por SEDE, y la trampa de las sobrecargas de Postgres

`ranking_unificado` acepta `p_sede`. Con sede puesta la tabla es la de esa
tienda; sin ella, la de siempre. El selector vive arriba del de ventana de
tiempo en `/rank`, y **solo aparece con más de una sede** (un selector de un
botón es ruido).

**Con sede, las AMISTOSAS quedan fuera, y no es un olvido.** Una amistosa se
juega en la casa de cualquiera y **no tiene sede**: `duelos_amistosos` no tiene
columna para eso y no debería tenerla. Repartirlas entre tiendas sería inventar
dónde se jugaron, y ponerlas en TODAS haría que la suma de los rankings por
sede no diera nunca el global. La leyenda lo dice con todas las letras cuando
hay una sede elegida — quien vea menos puntos en la tabla de su tienda que en
la general merece saber por qué.

**AGREGAR UN PARÁMETRO CON DEFAULT NO REEMPLAZA LA FUNCIÓN: CREA UNA SEGUNDA.**
`create or replace function f(a, b, c default null)` deja conviviendo `f(a,b)`
y `f(a,b,c)`, y entonces `f()` es ambiguo: Postgres se niega con **«function
… is not unique»** y la app deja de poder llamarla. Hay que `drop function` de
la firma vieja, **en el mismo archivo y antes del create**.

Y una del MCP de Supabase que conviene saber: **cada llamada es UNA
transacción**. Si el `select` de verificación al final falla, el `drop` y el
`create` de arriba se revierten con él — el susto de «dejé el ranking sin
función» no era real, pero tampoco había quedado aplicado nada. Migración en
una llamada, verificación en otra.

### 3t. Los íconos de misión: uno por OBJETIVO, y cuatro que no se leían

El catálogo llevaba **27 emoji**, y un emoji **lo dibuja el sistema
operativo**: 🛰️ en un iPhone y en un Android son dos dibujos distintos, y los
que un Android no tiene salen como un cuadrito. Era la única superficie donde
la app no controlaba su propio aspecto — justo la lista que se abre a diario.

Son **16 íconos, uno por `objectiveType`**, no uno por misión: antes «abrir 1
sobre» y «abrir 3 sobres» tenían dos dibujos para la MISMA acción. Cuántas
veces ya lo dice el contador de al lado.

**El ícono de una misión es el de LA PANTALLA donde se hace.** Eso identifica
en vez de decorar, y es coherente con el botón que ya dice el nombre de la
pantalla. Por eso la mayoría reusa `SWIcons` / `SWUIcons`.

**Pero reusar no siempre sirve, y solo se ve MIRANDO.** Cuatro se redibujaron:

| ícono reusado | qué se leía a 15-22 px |
|---|---|
| `SobreIcon` | un **calendario** (dentado + banda diagonal = hoja arrancada) |
| `SalasIcon` | una **molécula** — es un grafo de nodos, no «hablar» |
| `IconDualBlades` | un **aspa suelta**: no se ve dónde empieza cada hoja |
| `BountyIcon` | un **casco** — sirve para «Contrabando», no para «marcá una carta que querés» |

Lo que arregla cada uno: el sobre lleva una **carta asomando** (un sobre
cerrado es un rectángulo; uno abierto es un rectángulo con algo saliendo); el
chat es un bocadillo con cola; la amistosa marca las **dos empuñaduras** para
que se lea «dos cosas cruzadas» y no «una X»; y «la busco» es una carta con una
**mira**.

**UN ÍCONO NO PUEDE DEPENDER DEL COLOR DE FONDO.** El primer «la busco»
rellenaba la mira con `var(--color-swu-bg)` para tapar el borde de la carta que
tenía debajo. Sobre la chapa clara ese disco salía oscuro y se comía la cruz.
Se redibujó sin solapamiento. La fila «sobre fondo claro» del banco existe
exactamente para cazar eso.

Banco en **`/banco-iconos-mision`** (solo desarrollo): los 16 en los tres
tamaños reales (15 la franja de Inicio, 22 la tarjeta, 34 para ver el
balance del trazo) y la fila sobre fondo claro.

**El mapa `ICONO_POR_OBJETIVO` vive en `iconoMision.ts`, aparte.** Un módulo
que exporta componentes Y una constante rompe el Fast Refresh de Vite — la
misma separación que ya hubo que hacer entre `piezas.tsx` y `estado.ts` del
Contador. Y tampoco puede vivir en `misionesCatalogo.ts`: ese es puro y sin
red, y meterle JSX lo ataría a React, que es lo que impide probarlo en Node.

**El sorteo NO repite objetivo en un mismo día.** «Abrir 1 sobre» y «abrir 3
sobres» juntos son la misma tarea dos veces —haciendo la segunda se cumple la
primera sola— así que una de las seis ranuras no pedía nada nuevo. Y con un
ícono por objetivo, además, se verían dos tarjetas con el mismo dibujo: eso se
lee como un error de la app, no como dos misiones. Si el filtro dejara ranuras
sin llenar se completa permitiendo repetir: preferir una lista corta a una con
repetidos sería castigar al que juega por una regla de presentación.

### 3u. La animación de Misiones: CSS propio, y qué se apaga con movimiento reducido

Va en **CSS plano** en `index.css`, no en `@utility` —Tailwind solo emite una
utilidad si DETECTA la clase escrita, y las armadas con plantilla no las ve
(§3i)— y no con framer-motion, que en este repo solo se usa en el overlay.

**Todo se apoya en `transform` y `opacity`.** Son las dos propiedades que el
compositor anima sin recalcular el diseño. La barra de progreso usa
`transform: scaleX(var(--p))` sobre una barra al 100 % de ancho y **no**
`width`: animar el ancho es un reflow por frame, y acá hay hasta 20 filas.

Las cinco piezas: entrada escalonada (`--i` con tope de 12, o la fila 20
tardaría dos segundos), la barra que crece, el ícono que **respira** solo
cuando la misión está completa y sin cobrar —lo único que se mueve solo, así
que señala sin competir—, un destello que cruza la tarjeta al reclamar, y el
**XP que despega**: sin eso, cobrar solo apaga un botón y no se ve que el pago
ocurrió.

**El destello se dispara UNA vez**, comparando contra un `useRef` del estado
anterior. Con `claimed` a secas volvería a correr en cada repintado de la lista
y la tarjeta parpadearía sola para siempre.

**`prefers-reduced-motion` da MENOS movimiento, no cero.** La entrada queda en
un fundido sin desplazamiento y la barra se acorta a 1 ms; lo que se apaga es
lo que **se repite solo** —el latido y el giro largo—, que es lo que de verdad
marea. Las seis clases tienen su regla.

**Verificar contra el CSS CONSTRUIDO, nunca contra el fuente ni contra el dev
server** (§3i otra vez). El servidor de desarrollo sirve el CSS sin pasar por
el empaquetador: una clase puede estar ahí y no llegar al bundle.
`grep -c` con un glob y `awk` da cero por el formato de salida, no porque falte
— usá `grep -o PATRÓN archivo | wc -l` sobre el `.css` que referencia
`dist/index.html`.

### 3v. El saldo de sobres tenía que VERSE — 333 esperando y 26 personas sin abrir ninguno

Censo del 2026-08-23, y es el número que ordenó todo lo demás:

| | |
|---|---|
| sobres esperando sin abrir | **333** |
| personas que nunca abrieron ninguno | **26 de 38** |
| promedio acumulado | 9 · el que más, **21** |
| activos esa misma semana | **24 de 38** |

O sea que **no se habían ido**: publicaban en el muro y no recogían el regalo.
La causa no era el reparto —el cron de las 8:00 funciona y los sobres están en
la cuenta— sino que **el saldo era invisible fuera de `/sobres`**. Verificado:
no había insignia en ningún menú ni número en Inicio.

**DOS AVISOS, NO UNO. La distinción es de fondo y conviene no borrarla:**

- **`AvisoSobreDiario` anuncia un HECHO NUEVO** («hoy cayó tu sobre»). Salta
  una vez, la mañana que cae, y se marca en `localStorage` para no repetirse.
  **Está bien que se calle**: una novedad se agota al leerla.
- **`SobresAcumulados` anuncia un ESTADO** («tenés N guardados»). Un estado no
  se agota al leerlo, así que **no se marca, no se descarta y no tiene botón de
  cerrar**. Desaparece sola al abrir un sobre, que es la única forma honesta de
  que un recordatorio se vaya. Arranca en **2**: con 1 ya está el otro aviso.

**El saldo vive en UN store (`useSobres`)** y se dibuja en cuatro sitios
(sidebar, menú de móvil, un punto en la pestaña Perfil y la franja de Inicio).
Con una consulta por sitio serían cuatro viajes por navegación y —peor— cuatro
respuestas que se pueden separar: la insignia diciendo 3 y la franja 2.

**Baja EN EL ACTO al abrir**, con el `saldo` que devuelve `abrir_sobre()` (el
del servidor, no una resta local). Una insignia que no baja al hacer justo lo
que pide enseña a ignorarla. Lo fija la PÁGINA y no el servicio: `sobres.ts`
importando el store sería un ciclo. Y se olvida al cerrar sesión, o mostraría
los sobres de la cuenta anterior.

**El punto va en la pestaña Perfil** porque Sobredosis vive dentro de
Perfil → Más: sin eso la insignia quedaría a dos toques, o sea existiendo sin
verse — que es exactamente el problema que vino a arreglar. Va **sin número**
porque ahí no se puede decir de qué es; el número está un nivel más adentro,
donde se puede leer.

**Dos bugs que SOLO se vieron mirando la pantalla:**

- **Un `/* */` suelto en posición de hijo de JSX es TEXTO, no comentario.** Mi
  nota salió impresa en el menú lateral, tres veces. En posición de *atributo*
  sí es contexto JS y es válido — por eso el de `TabBar` está bien y el de
  `SideNav` no lo estaba. Comentario en JSX: `{/* … */}`.
- **El punto colgaba del BOTÓN de la pestaña**, que ocupa todo el ancho de la
  celda: caía en el borde de la pantalla y se leía como una mancha suelta.
  Va anclado al ÍCONO, dentro de su propio `<span className="relative">`.

**«25 cartas brillantes esperando» no es una cifra inventada**: son 5 cartas
por sobre, medido sobre las 183 aperturas reales (min 5, máx 5). Si el sobre
cambia de tamaño, ese texto miente.

Banco en **`/banco-saldo`** (solo desarrollo): 0, 1, 2, 5, 9 y 21 a un toque.
Ver la insignia con 9 de verdad sería esperar nueve días.

### 3w. Más filtros en el constructor, y la penalización de aspecto que NO se puede calcular

`searchCards` ya aceptaba tipo, arena, palabra clave, rasgo, rareza y set — y
el constructor exponía **tres** (texto, aspecto, coste). Otra vez: la capacidad
estaba y no se veía.

Se agregan tipo, arena, palabra clave, rasgo y «de mis aspectos» detrás de un
**«Más filtros» que lleva el NÚMERO de activos adentro**. Un panel plegado que
no avisa que hay algo puesto es cómo alguien busca diez minutos sin entender
por qué no aparece su carta. Aspecto y coste se quedan a la vista.

**Las listas se DERIVAN de la base** (`vocabularioDeCartas`), no se escriben a
mano: una lista fija se queda vieja con cada set y el filtro deja de ofrecer lo
nuevo **sin dar ningún error** — que es cómo Twin Suns desapareció de Explorar
(§3j).

Medido sobre las 2.314 canónicas: **58 rasgos** y **16 palabras clave**, todas
con 23 cartas o más. Por eso las palabras clave van como fichas y los rasgos
llevan buscador; se ordenan **por cuántas cartas los llevan**, no alfabético.

**«DE MIS ASPECTOS» NO ES «SIN PENALIZACIÓN», Y NO PUEDE SERLO.**

La pregunta de verdad al armar es «¿qué puedo jugar sin pagar de más?». No se
puede responder con estos datos, y conviene que quede escrito para que nadie
lo intente:

- **CR 8.1.2**: un ícono REPETIDO cuenta doble. *Protector* (SOR #41) lleva
  **dos** de Vigilance, y con un solo ícono en el mazo cuesta +2.
- **El API no expone el conteo.** Devuelve `aspects: ['Vigilance']` para
  Protector — una lista **sin repetidos**. Verificado: 0 de 9.185 impresiones
  traen un aspecto duplicado.

Así que el filtro se llama por lo que hace y la línea de ayuda dice que las
demás se pueden jugar igual pagando 2 de más por ícono. **Si algún día el API
expone los íconos, ESE es el momento de convertirlo en penalización**; antes,
renombrarlo es mentir.

Ese filtro se aplica en la PANTALLA y no en `searchCards`: el motor filtra por
UN aspecto y esto pregunta que **todos** los de la carta estén entre los del
mazo. Y solo aparece si el mazo ya tiene líder o base — un control que no puede
filtrar nada enseña a desconfiar del resto.

**Ahora basta CUALQUIER filtro para buscar.** Antes hacía falta texto, aspecto
o coste: elegir «Evento» y no ver nada se habría leído como que el filtro no
funciona.

Verificado contra el catálogo real, 7 combinaciones, **ninguna vacía**: unidad
terrestre con Sentinel 109 · evento de Command coste 2 → 21 · vehículo espacial
394 · mejora con rasgo Weapon 46 · Rebel con Ambush 10 · solo Vigilance+Heroism
516, y de esas 71 unidades de coste 3.

El tipo y las ayudas viven en `filtrosAvanzados.ts`. Un módulo que exporta
componentes Y constantes rompe el Fast Refresh — **y RE-EXPORTARLAS lo rompe
igual**, cosa que costó descubrir. Tercera vez que hace falta esta separación.

Banco en **`/banco-filtros`**.

### 3x. La credencial ajena, y el acento que no pasaba contraste

**Espionaje enseña la CREDENCIAL, y primero.** Es la identidad de jugador de
esta app y hasta 2026-08-23 solo se veía la propia: entrar al perfil de alguien
daba una ficha genérica —avatar, nombre y cuatro números— que no se parecía a
lo que esa persona armó.

**`useDatosCredencial` NO sirve para otra persona.** Lee apodo, ubicación, tema
y mazo de `useSettings`, que son los ajustes de ESTE aparato: usarlo para mirar
a otro le pondría a su placa MI apodo y MI tema, y como los dos son textos
plausibles **no se vería como un error** sino como que esa persona eligió lo
mismo que yo.

Los ajustes ajenos salen de `profiles.settings`, donde la app ya los sincroniza
(medido: de 38 perfiles, **12 con tema, 8 con apodo, 4 con ubicación**). El
ARMADO se extrajo a **`armarCredencial()`**, pura y sin hooks, y las dos
pantallas la comparten. Duplicarlo es exactamente lo que el §2y advierte.

Tres cuidados en `useCredencialAjena`, cada uno un bug evitado:
- **El join de `player_stats` devuelve ARRAY** aunque sea 1:1 (gotcha 1). Sin
  desenvolverlo, la placa dice nivel 1 para alguien de nivel 8, sin error.
- **El tema y el emblema se VALIDAN** contra sus listas: vienen de un JSON que
  escribe el cliente, y un emblema inexistente deja un hueco negro.
- **Si apagó «mostrar mazo», no se muestra.** Publicar lo que decidió esconder
  no es un detalle de implementación.

**VEINTE TEMAS.** Seis nuevos —Dagobah, Hermanas de la Noche, Tatooine,
Kashyyyk, Mustafar, Coruscante— elegidos por MATIZ que no existía: verde puro,
magenta, arena clara, verde azulado, naranja encendido y añil.

**Y al medirlos apareció un problema viejo.** El archivo afirma que «el `texto`
sobre `panel` pasa AA en las catorce» y **es cierto** (13,07 a 16,49). Pero el
**`acento` sobre `panel`** daba **3,17 en Sith, 3,06 en Rebelde y 3,67 en
Hoth** — bajo el 4,5 de WCAG— y ahí van cuatro textos reales: el encabezado,
el sub-nombre (§3ñ), la línea del dorso y el rótulo del nivel.

Los temas ganan **`acentoTexto`**: el mismo acento con más luz, conservando
matiz y saturación exactos (Sith sigue en 358°, Rebelde en 4°, Hoth en 207°).
El acento crudo se queda para las FORMAS y para el número de nivel, que a 26 px
es texto grande (umbral 3,0) y todos lo pasan.

**`scripts/contraste-credencial.mjs`** lo vuelve comprobable: mide los tres
pares, exige 4,5 al texto y 3,0 al grabado, y avisa si dos temas comparten
acento. **20/20 pasan.** Corrélo al agregar un tema.

**Y ese guion casi miente.** Al agregar `acentoTexto` su patrón dejó de casar y
dijo **«0 temas · TODOS PASAN»** — verde sobre nada medido, que es el peor
resultado posible porque parece el mejor. Ahora se planta si lee cero. Es el
mismo fallo que ya tuvo el DetectorChoques (§2z) — que esta vez lo hizo bien y
avisó «0 placas medidas, este resultado no dice nada» en vez de dar verde.

**Trampa del banco:** con la pestaña del navegador en segundo plano
`window.innerWidth` es **0** y todas las placas miden 0 — el detector dice que
no midió nada y parece un bug del código. Hay que traer la pestaña al frente.

### 3y. La Galaxia trababa por RECOMPILAR shaders, no por memoria

Reporte de Nel: «traba algunos celulares con menos memoria, pero no le quités
calidad». Medido antes de tocar nada: la escena es **diminuta** —4 soles (SV 28,
ES 5, MX 1, AR 1), ~35 planetas de 20 gajos, 620 estrellas y dos texturas de 32²
y 128²—. El búfer de dibujo son ~2,2 MB. **La memoria de GPU no era el cuello.**

Eran dos cosas distintas, y ninguna es «menos memoria»:

- **`Dice3D` fugaba un contexto WebGL por cada apertura.** Era el ÚNICO de los
  cuatro renderers del repo sin `forceContextLoss()` — y `dispose()` NO suelta el
  contexto. El panel vive dentro de `{dado.abierto && …}` en `ContadorPage`, así
  que fugaba por cada abrir/cerrar, no por visita. Chrome corta a los 16 y mata
  **los más viejos**: por eso la Galaxia terminaba en el fallback «este navegador
  no puede dibujar en 3D». Eso no la trababa, la **mataba**.
- **Tocar una lente reconstruía la escena entera.** `conLente` hace `.map()`, así
  que `sistemas` cambia de identidad en cada toque, y estaba en las dependencias
  del efecto de montaje: limpieza completa, contexto nuevo, texturas resubidas y
  three recompilando y ENLAZANDO los ~6 programas. `glLinkProgram` es **síncrono**
  —decenas de ms por programa en un Adreno/Mali— con el hilo principal parado.
  Las cuatro pestañas están pegadas encima del lienzo.

**La dependencia es ahora una CLAVE ESTRUCTURAL** (quién está, su nivel, sus
logros, su nombre; los planetas ordenados **por id** antes de serializar, o la
clave cambiaría con cada lente y no se arreglaría nada). La lente entra por
`mando.reacomodar()`.

**Y ahí la regla que no se puede relajar: `reacomodar` empareja por ID, NUNCA por
índice.** `conLente` REORDENA `s.planetas`, pero el color por instancia
(`setColorAt`, una vez al construir) y el reparto de lunas (`planeta: i`) se
hornean con el orden original. Por índice, cada planeta quedaría pintado con el
rango de un vecino y el de 9 logros mostraría 3 lunas — sin un solo error.

Los anillos NO se rehacen a propósito: la lente es una **permutación** (reasigna
`orbita = i` dentro de cada sistema), así que `kMax`, el búfer de `geoOrbitas`,
la opacidad y `gajos` son invariantes entre lentes.

**Las lunas guardan `desfase`, no `rLocal`.** La distancia se deriva del radio
VIGENTE del planeta en cada cuadro. Copiada al construir quedaba vieja en cuanto
la lente cambiaba el tamaño, y las lunas se metían dentro de la bola.

**`renderer.compileAsync()` NO SE PUEDE USAR ACÁ.** Revienta con esta escena:
`checkMaterialsReady` lee `properties.get(material).currentProgram` y llama
`program.isReady()` sobre un `undefined` (three 0.185.1, three.module.js:17497).
Y **el error no se puede atrapar** —three lo tira desde su propio `setTimeout`,
fuera de la promesa— así que ni un `.catch()` lo contiene: queda error rojo en
consola y la promesa nunca resuelve. Se probó, se verificó en `/banco-galaxia` y
se echó para atrás. Lo que sí queda es que `arrancar()` **programa** el primer
cuadro en vez de pintarlo síncrono dentro del efecto.

**Trampa al verificar en el banco:** leer `document.querySelector('canvas')` en
el MISMO tick del `.click()` da un falso positivo — React todavía no re-renderizó.
Hay que separar el clic y la lectura en dos llamadas. Con la medición bien hecha:
cambiar de lente conserva el lienzo, y cambiar de 5 a 2 soles lo reemplaza (que
es lo correcto: eso sí es estructural).

**Lo que NO se hizo y por qué:** bajar el ritmo a 30 Hz en reposo tiene costo
visual y su premisa está razonada, no medida. Y estos arreglos atacan tirones
**discretos** (entrar, tocar una lente, morir); si algún teléfono va entrecortado
de forma continua, hace falta una grabación de 20 s del panel Performance en ESE
teléfono antes de tocar nada más.

### 3z. El aviso de «completá tu perfil» no pedía la credencial

La credencial es la pieza de identidad más vista de la app —Inicio, Mi Perfil,
Espionaje, el ranking y La Galaxia— y la única que se exporta a PNG y se comparte
por fuera (§3b). El catálogo de `perfilCompleto.ts` pedía país, aspectos, planeta,
bio y una carta destacada, y **nunca la mencionaba**.

Se ve en los números (38 perfiles, 2026-08-23): lo que el aviso pide ronda las
14-15 personas (aspectos 15, planeta 14, bio 14) y lo que no pide se queda atrás
(tema de credencial 12, apodo 8, **vitrina 0**).

**`credencialElegida` viene de FUERA y no de `personalizacion`**: tema, emblema y
apodo no son columnas, viven en el JSON de `settings` (en el aparato,
`useSettings`). Y se compara contra los VALORES POR DEFECTO (`jedi`,
`jedi-order`, vacío), no contra cadena vacía: el store siempre tiene valor, así
que «tiene tema» sería cierto para todos desde el primer arranque.

**El reparto asistente / fuera del asistente estaba cableado POR NOMBRE**
(`f !== 'cartas'`). Un pedido nuevo caía por descarte dentro del asistente —que
no sabe resolverlo— y el paso salía en blanco. Ahora sale de `enElAsistente`, y
todo lo que no está en el asistente lleva su propia `ruta`: el botón mandaba
siempre a `/profile`, y con dos pendientes distintos uno habría ido al sitio
equivocado sin decir nada. Probado en `scripts/perfil-completo.test.mts`.

**PERO EL NÚMERO QUE IMPORTA ES OTRO, Y CONVIENE NO OLVIDARLO:** los **19 de 38**
perfiles sin ninguna personalización tienen también **0 cartas registradas y 0
sobres abiertos**, y 14 de ellos 0 XP. Reciben su sobre diario todos los días y
ninguno lo abrió nunca. No es que la personalización esté escondida para quien
juega —de los activos, casi todos personalizaron—: es que **la mitad de la
comunidad nunca arrancó**. Ese es un problema distinto y más grande, y no lo
resuelve un aviso.

### 4a. Abrir un sobre da 50 XP — y el XP se acredita DENTRO de `abrir_sobre()`

Pedido de Nel: «abrir sobres debería dar 50 XP por booster».

**Se acredita en el servidor, no en el cliente.** El camino del cliente
(`acreditarXp` en useAuth.ts) existe y funciona, pero acá no sirve: acreditaría
50 XP cada vez que el NAVEGADOR lo pida, sin que nada compruebe que se abrió un
sobre. Dentro de `abrir_sobre()` el XP queda atado a la apertura real —el mismo
`update … where disponibles > 0` que ya cobró el sobre— y el cliente no puede
afirmar nada. Efecto secundario que conviene: si el reparto de XP reventara, la
transacción entera se revierte y **el sobre no se pierde**.

**Reusa `sumar_xp`, no copia la derivación del nivel.** Ya había TRES copias del
bucle que deriva el nivel (`sumar_xp`, `_repartir_premios`, el cliente viejo).
Una cuarta es el §3c otra vez. `sumar_xp` saca la cuenta de `auth.uid()` —el
mismo `yo`— y ya trae el tope de 500 por llamada.

**El mensual va aparte porque es un DELTA.** `player_stats.xp` es un total y
`monthly_xp.xp_gained` es lo ganado en el mes; `sumar_xp` no lo toca (su llamador
del cliente lo hace por su cuenta). Si algún día `sumar_xp` empieza a escribir el
mensual, hay que quitar el insert de `abrir_sobre` **y** el `addMonthlyXp` de
`acreditarXp` **a la vez**, o el mes se cuenta doble.

**`abrir_sobre` devuelve el TOTAL, no el delta** (`xp`, `nivel`, `xp_ganado`): el
número de la pantalla sale de Dexie, así que sin bajar el total no se mueve hasta
el próximo inicio de sesión — y eso se ve igual que si no se hubiera pagado
(§3m). El espejo lo hace **la PÁGINA** (`espejarXpEnDexie`), nunca `sobres.ts`:
que el servicio importara el store de sesión sería un ciclo, igual que con el
saldo (§3v).

**Y `xp` se lee con `?? null`, nunca con `Number(...)`.** `Number(null)` es 0, y
un XP de 0 es un número plausible que la pantalla copiaría a Dexie **borrándole
el XP real** a quien abrió el sobre. Nulo tiene que seguir siendo nulo: pasa
cuando la cuenta no tiene ficha de jugador, y en ese caso el sobre SÍ se abrió.

Probado con `set local role authenticated` en transacción revertida: xp
5491→5541 (+50), nivel 10→11, mensual 2430→2480 (+50), sobres 5→4, y el objeto
devuelto trae `xp_ganado=50` con las 5 cartas.

**LO QUE SE ANUNCIA TIENE QUE SER LO QUE SE PAGA, y `FUENTES` ya mentía.** La
lista de «Cómo se ganan» de `SobresPage` decía «Ganar un torneo → 3 sobres /
Jugar un torneo → 1 sobre» **después** de que `_repartir_premios` pasara a dar 5
parejo para todos (§4b). Si tocás los montos del servidor, tocá esa lista en el
mismo commit — es el mismo fallo que el §3m documenta en las misiones.

### 4b. El premio de torneo: 500 XP y 5 sobres, parejo

Decisión de Nel (2026-08-23). Antes: 50 XP a todos y 3 sobres al 1.º / 1 al
resto. Los dos montos van como **constantes nombradas** en
`_repartir_premios`, porque el conteo del resumen (`v_sobres`, lo que devuelve la
función) repetía la MISMA expresión cableada — con dos copias la segunda se
olvida y el número que informa el reparto empieza a mentir, igual que el
«enviados» de `enviarPush` (§3i).

**Ganar sigue valiendo, pero en otro sitio:** el puesto pesa en
`ranking_points` (10/7/5/3/1 + victorias*3 + empates) y en la tabla de la
temporada, que sale de `tournament_standings.puesto`. Lo que pasó a ser de
PARTICIPACIÓN es el XP y los sobres.

Verificado en SAN220826 (8 jugadores, todos con cuenta): `{ok:true,
premiados:8, sobres:40, sin_cuenta:0}`, los 8 subieron exactamente +500 XP y +5
sobres contra la foto previa, y el pestillo aguantó — segundo intento rechazado y
`tournament_results` en 8 filas, no 16.

### 4c. TALLER KYBER — armar un sable de luz (`/sable`)

Módulo en pruebas, **cerrado a una sola cuenta**. Es 3D, tiene economía y tiene
sonido, así que junta trampas de tres áreas distintas.

**LA PUERTA ES `sable_probadores`, NO `role = 'admin'`.** Hay cuatro admins y
esto lo ve uno. Y a propósito **no hay escotilla**: un admin que pueda darse la
llave vuelve la restricción decorativa (§3i-bis). Se reparte insertando la fila
desde el SQL Editor. El gate de la pantalla es una CORTINA; lo que cierra de
verdad es el `if not es_probador_sable()` que está DENTRO de cada RPC — sin él,
cualquier logueado leería el taller, que es exactamente lo que costó una prueba
en `temporada_tabla()`.

**Va DENTRO de `AppLayout` y con `<P>`, al revés que `/temporada`.** Fuera de la
cáscara no corre `initAuth()` y `auth.uid()` llegaría nulo a las RPC: el taller
diría «no está abierto» hasta al dueño. Está en `rutaLibre` para que la puerta de
instalación no tape una pantalla 3D que hay que revisar en un teléfono, como los
bancos. Sin entrada de menú: se entra tecleando `/sable`.

**SE PAGA CON CRÉDITOS, QUE SON EL XP.** Medido antes de decidirlo: el XP no
tenía sumidero en toda la app — solo entraba y lo único que hacía era subir el
nivel. Se llama «créditos» en pantalla porque en una tienda del universo la
moneda no se llama «puntos de experiencia», pero es el MISMO número: **no hay dos
economías**. Pagar con sobres se descartó: competiría con abrirlos, y con 333
sobres sin abrir eso es lo último que hace falta.

**Y GASTAR NO BAJA DE NIVEL.** `player_stats.level` se DERIVA de `xp`, así que
restar de ahí degradaría al que compra — comprar un pomo te bajaría de 11 a 10.
`xp` sigue siendo el total de por vida y el saldo se deriva:
`total − sum(sable_inventario.pagado_xp)`. El recibo de cada compra ES el cobro;
si esa fila no se escribe, la pieza queda gratis.

**Los STATS se suman de las piezas y no se guardan** (§3c), y **no afectan a nada
fuera del taller a propósito**: engancharlos al ranking convertiría gastar
créditos en comprar ventaja competitiva.

#### La geometría

**El mango son TRES `LatheGeometry`, no una.** Una sola se vería mejor (cero
costura) pero **una pieza torneada única no se puede abrir**, y la vista explotada
es el corazón de la pantalla. Van tres siempre, con separación 0 cuando está
armado: un solo camino de código para las dos vistas.

**`LatheGeometry` no perdona dos cosas y no avisa de ninguna:**
1. **El alto tiene que ir siempre hacia arriba.** Un `y` menor que el anterior
   invierte la normal y ese anillo sale **negro**. Para un escalón recto se
   repite el mismo `y` con otro radio, nunca se baja.
2. **El radio nunca es 0 en el medio**: pincha la malla.

`scripts/sable-perfiles.test.mts` corre las **64 combinaciones** y cazó a la
primera una **deriva de coma flotante**: el borde de un bulto cerraba en
`11.147272727272728` y el siguiente abría en `11.147272727272727`. El alto bajaba
1×10⁻¹⁵ y eso habría sido **un aro negro en una sola combinación de 64**, sin un
error en consola. Por eso `repetir()` calcula el borde de cada bulto con la MISMA
expresión que el principio del siguiente, y `perfilDeSable` lleva además una red
de seguridad que sujeta el alto.

**Las miniaturas salen del MISMO perfil que la malla** (`siluetaDePieza`): una
pieza girada 360° se ve de lado como su perfil espejado. No hay forma de que se
separen — lo contrario de la tarjeta de jugador, que se fue separando de sí misma
por tener dos dibujos del mismo dato (§2y).

**TRES materiales, y es lo que salva al mango de parecer un tubo:** acero en
emisor y pomo, agarre oscuro en la empuñadura, latón en los aros. Lo que hace que
se lea como objeto es el CONTRASTE de material, no el detalle de la silueta. Los
aros además marcan por dónde se separa: sin ellos la vista explotada parece que
se rompió. Y el radio de agarre es **1,6 y no 1,05** — a 1,05 la proporción era
25:1 y se veía como una varilla; un mango real ronda 8:1.

**La hoja son TRES capas** —núcleo casi blanco, halo y una bruma ancha y tenue—
porque el color de un sable vive en la bruma que lo rodea, no en el filo. Con dos
capas se leía como un tubo blanco con un borde de color.

#### Dos trampas que costaron tiempo

**SIN BUCLE, LA ANIMACIÓN TIENE QUE LLEGAR DE GOLPE.** `pintar` se llama desde
`bucle` (animando) y desde `pedirCuadro`, que dibuja UN cuadro y para. Suavizando
en el segundo caso, la hoja se quedaba a medio salir **para siempre**. Con
`prefers-reduced-motion` el bucle no corre nunca, así que era un bug de
accesibilidad de verdad: movimiento reducido es llegar sin transición, no
congelarse a mitad (§3u).

**EL NAVEGADOR DE PRUEBAS REPORTA `document.hidden === true` SIEMPRE.** La escena
pausa el bucle a propósito (§2s) y rAF ni dispara, así que el lienzo se queda con
un cuadro viejo y **parece que el código está roto**. Antes de juzgar una escena
3D acá hay que fingir visibilidad con `defineProperty` + `visibilitychange`. Es
primo del §3x, donde la pestaña de fondo daba `innerWidth` 0 y el detector medía
cero placas — el mismo error con otra cara: **una medición que no midió nada se
parece muchísimo a una medición que salió bien**.

#### El sonido

Sintetizado, sin un solo archivo (mismo criterio que Sobredosis). El zumbido son
**dos sierras desafinadas** entre sí unos hercios: ese batido es lo que suena a
sable — con un solo oscilador se oye un zumbador de puerta. El tono sale del
CRISTAL, y al cambiarlo se **afina** en vez de re-arrancar: cortar y volver a
encender por cambiar de color se oye como un fallo.

**El zumbido se apaga SIEMPRE al desmontar**, sin condición en el `return` del
efecto. Un sable que sigue sonando después de cerrar la pantalla no tiene botón
que lo calle y la persona no sabe de dónde sale el ruido.

#### El encuadre de la cámara MIDE, no supone

Nel, probándolo en su iPhone: «se corta el sable, el zoom podría ser más
pequeño». Las distancias fijas por estado (36/48/106) suponían una pose; con
arrastre libre + tres poses + hoja de 78, la horizontal desbordaba el visor
vertical. Ahora `encuadrar()` corre por cuadro: proyecta la media-longitud
actual (mango + separación + hoja) sobre los ejes de pantalla según el
cuaternión y pide la distancia que hace caber el peor eje en su FOV, moviendo
también el CENTRO al medio real del objeto (con hoja, el sable no está centrado
en el origen del grupo).

**La trampa que costó una iteración**: el fit lineal NO alcanza — el extremo
inclinado HACIA la cámara queda a `dist − cerca` de ella y la perspectiva lo
agranda. El término `cerca = |eje.z| · mitad` se **suma fuera** de la división
por el FOV. Y las estrellas arrancan en radio 150: con hoja horizontal la
cámara llega a ~210 y estrellas a 120 quedaban detrás de ella.

**Medir la escena desde el banco**: en DEV, `window.__sable` publica dist,
aspecto, eje y mitad por cuadro. Ojo con el navegador de pruebas: además de
`document.hidden`, su rAF a veces NO dispara ni con la pestaña al frente — el
remedio es un shim (`requestAnimationFrame = setTimeout`) + toggle de
visibilidad para reencender el bucle. Sin eso, cada screenshot enseña un cuadro
a MEDIO CAMINO y parece que el encuadre está roto cuando está bien.

#### La tira de piezas es horizontal

«Deslizar de izquierda a derecha para no escrolear hacia abajo y perder la
visual del sable» (Nel). Las tarjetas van en `-mx-4 flex snap-x overflow-x-auto`
con envoltorio `flex w-44 shrink-0 snap-start` (el `flex` iguala las alturas);
en los pasos de compra el visor cede altura (40vh vs 56vh) para que sable y
tira compartan pantalla.

#### La barra de XP lleva TU mango, en foto

«Esta barra podría ser la empuñadura que uno hace en el taller… que se vea 3D»
(Nel). `LightsaberXpBar` enseña un PNG del mango del propio usuario renderizado
con el motor del taller (`miniaturaSable3D.ts`): un renderer que nace, dibuja UN
cuadro, entrega `toDataURL` y muere con `forceContextLoss` — nada de contexto
vivo por un adorno de 72×22. Claves del arreglo:

- **El diseño se lee de la TABLA `sable_diseno`, no de `sable_taller()`**: la
  RPC exige probador, pero tu diseño es tuyo — la policy ya limita el SELECT a
  `auth.uid()`. Sin diseño forjado se renderiza el de fábrica: todos ven 3D.
- **`mangoBarra.ts` NO importa three**: la barra vive en el Home; el
  renderizador entra por `import()` dinámico y solo si el caché de localStorage
  (una sola entrada, clave = las tres piezas) no sirve.
- **VUELO ÚNICO obligatorio**: medido en `/banco-sable`, 20 barras montadas =
  20 contextos WebGL simultáneos y Chrome corta a ~16 — salía UNA foto y 19
  SVG. La promesa compartida renderiza una vez y todas esperan la misma.
- El SVG dibujado a mano queda de REPUESTO (sin WebGL, primer cuadro sin caché).

#### Los HERRAJES y los materiales por pieza

Nel: «que tengan botones algunos o detalles de cables más estéticos, que tengan
colores». Antes había TRES materiales cableados por tipo de pieza, o sea que
los diez cuerpos del catálogo eran diez siluetas del mismo gris. Ahora cada
pieza declara su `material` (de once) y sus `herrajes` (74 en 30 piezas):
anillo, botón, caja, cable, aleta y gema. El testigo del botón y las gemas usan
el material `luz`, que toma el color de TU cristal.

**Ningún herraje declara su radio.** Declara su altura como fracción y
`asientoDe()` mide el perfil ahí. Dos casos reales obligaron a que además
ENGORDE hasta cubrir el desnivel que tiene debajo: la campana de VÓRTICE
despega una aleta recta por abajo (0,07 de aire, un satélite), y las costillas
de VÉRTEBRA se tragan un riel anclado al centro. Anclar al máximo arregla uno y
rompe el otro; la cara interna va bajo el MÍNIMO del tramo y la externa sobre el
MÁXIMO. Aros y cables son la excepción: RUEDAN sobre las crestas, como un fleje.

**El criterio de «tapado» que parecía obvio estaba mal.** La primera versión
castigaba a todo herraje con un vecino más alto y marcó 17. Pero en una pieza
TORNEADA toda ranura da la vuelta completa y desde el costado se ve dentro —
el cable de CAUCE vive en su canal a propósito. Lo que sí esconde es un POZO
ESTRECHO, así que la medida es la línea de visión a 45°. Quedaron 2 fallos
reales, los dos de ANCLA.

**Un constructor, dos clientes** (`herrajesTres.ts`): la escena y la foto de la
barra de XP. La barra filtra por TAMAÑO REAL EN PANTALLA (`pxPorUnidad`): a 8 px
por unidad un aro de 0,10 mide 0,8 px y ensucia. No son dos mangos: es el mismo
dato mirado de lejos.

**Materiales una vez, geometrías por medidas.** Cambiar de pieza reconstruye
`Object3D` y nada más. Los once materiales se CALIENTAN con `renderer.compile()`
al montar: `glLinkProgram` es síncrono y ese tirón caía al tocar una pieza.

#### Abierto a la comunidad, y el color de la empuñadura

Desde 2026-08-24 el taller es de todos: `es_probador_sable()` fue reemplazada
por `sable_abierto()` en las tres RPC. **No se hizo que la vieja devolviera true
para todos** — una función llamada «es probador» que le dice que sí a cualquiera
es una mentira que el próximo lector va a creer. `sable_probadores` sigue vivo
para estrenar cosas con una cuenta. Lo que sigue cerrado son las piezas
`oculta`: los cinco legendarios y el cristal rojo.

El **acabado** (`sable_diseno.acabado` → `sable_acabados`) repinta las tres
piezas del mismo material; los herrajes NO, porque el latón de los aros es lo
que evita que un mango de un solo material se vea como un tubo pintado. NULL =
cada pieza con el suyo, y ese es el valor de fábrica. Gratis: el sumidero son
las piezas. Un acabado desconocido se guarda como NULL en vez de reventar —
perder el sable entero por el color sería el peor cambio posible (§2g).

**La barra de XP lleva al taller**: el sable entero es un botón, con su rótulo
debajo. Un destino que nadie descubre no existe (§3l, la Trivia enterrada).

Bancos: **`/banco-sable-3d`** (las combinaciones sin base ni saldo),
**`/banco-kyber`** (pasos, stats, la tira de tarjetas), **`/banco-credito`**
(el escudo imperial con el medidor de tinta) y **`/banco-sable`** (la barra de
XP con la foto del mango).

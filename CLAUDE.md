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

**PERO PREGUNTAR SIEMPRE TAMPOCO ERA LA RESPUESTA.** Reporte de Nel
(2026-08-27): «la página web se debería actualizar sola, me aparecen versiones
viejas». Tres cosas fallaban a la vez y ninguna era el `skipWaiting`:

1. **Solo comprobaba cada 60 minutos.** Quien despliega y mira enseguida no se
   entera. Ahora son **15**.
2. **No comprobaba al VOLVER a la app** — que es el momento natural: mirás el
   teléfono, volvés, y ahí conviene enterarse. Ahora hay `visibilitychange`,
   `focus` y una comprobación al arrancar. Sin eso, una pestaña abierta desde
   ayer esperaba a la próxima hora en punto.
3. **Pedía permiso incluso cuando no había nada que interrumpir.** La razón de
   preguntar es real —una recarga corta un tracker en curso o un mazo a medio
   armar— pero eso solo pasa en unas pocas pantallas.

Hoy: **oculta → se aplica sola** (nadie mira, nada se está escribiendo); **en
pantalla de la lista blanca → se aplica sola**; **en cualquier otra → pregunta**.

**LA LISTA ES BLANCA Y NO NEGRA**, y es la misma corrección que se le hizo el
mismo día a la tabla de la liga: con una lista negra cada pantalla nueva queda
marcada como segura por omisión, que es la dirección peligrosa. Lo que no está
declarado pregunta — molesta un poco, que es el fallo barato, en vez de
recargarte encima, que es el caro.

Dos detalles que costarían el bug que esto evita:
- **La ruta va en una `ref` escrita desde un efecto.** El callback del service
  worker se crea UNA vez y capturaría el `pathname` del primer pintado: quien
  abrió la app en Inicio y se fue al Contador se comería la recarga a mitad de
  partida. Y la `ref` se escribe en un efecto, no en el render (regla
  `react-hooks/refs`).
- **`/liga/:code` es segura y `/liga/:code/panel` NO**, aunque una sea prefijo
  de la otra. Es el caso que no se ve leyendo, y por eso está en la prueba.

`scripts/actualizacion-rutas.test.mjs` lee la lista **del propio componente**
—no la copia, que se separaría— y fija 18 casos. Corrélo al tocar `SEGURAS`.

Y las pantallas de verdad delicadas —overlay de OBS, estudio, `/admin`,
`/temporada` y el panel de liga— **ni siquiera montan `UpdatePrompt`**: viven
fuera del caparazón, así que ahí no hay riesgo por estructura.

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

**Y DECIR DÓNDE NO ALCANZA: EL DESTINO SE PUDRE SOLO.** La Trivia vivía DENTRO
del perfil (`TriviaSection`); cuando se mudó a `/trivia`, las **cinco** misiones
de trivia se quedaron apuntando a `/profile`. El botón dejaba a la persona en
una pantalla sin trivia — una tarea imposible otra vez, ahora por el destino en
vez de por el llamador. Igual «Enviar 1 regalo», que mandaba a La Galaxia cuando
los regalos se envían desde Espionaje, y cuatro que decían «Contador» cuando el
menú dice «Contador de daños».

**Y UN LLAMADOR EN UNA SOLA RAMA SE LEE IGUAL QUE NINGUNO.** La trivia tiene
DOS modos —la diaria y la práctica por tema— y el aviso de la misión vivía
dentro de `recordTriviaAnswer`, que es el camino de la diaria **únicamente**.
Quien jugaba por tema contestaba y la misión no se movía. Medido en producción
el mismo día: Nelson con **20 respuestas por tema y NI FILA** de `d_trivia1`,
Rodorigo con 10 por la diaria y todas contadas. El aviso vive ahora en
`handleAnswer`, que es el único punto por el que pasan los dos modos y corre
una vez por pregunta.

Es la misma forma del §3h-ter con otra cara: allá la misión no tenía llamador,
acá lo tenía en una rama de dos. `misiones-tienen-llamador.mjs` **no puede ver
esto** —encuentra el llamador y da verde—, así que al agregar un modo nuevo de
cumplir una misión la pregunta es *«¿por dónde pasan TODOS los caminos?»*, y el
aviso va ahí.

**Lo que NO se hizo: reponer el progreso perdido.** El único contador con el
que se podría (`trivia_temas.respondidas`) **no es de fiar**: está topado en 20
por tema y por día (§4j) y es más nuevo que `trivia_progress`, así que dos
personas dan hueco **negativo** —imposible— al cruzarlos. Escribir progreso a
partir de un número que no cuadra es peor que no escribirlo.

**Un destino equivocado NO FALLA**: navega, pinta algo, y quien lo tocó cree que
no encontró la sección. Por eso `scripts/misiones-llevan-donde-dicen.mjs` cruza
tres cosas —que la `ruta` exista en el router, que corresponda al
`objectiveType` (nunca al NOMBRE, que es de fantasía: «Archivos Jedi» es la
trivia) y que `donde` sea el rótulo tal como lo escribe el menú—. Ese tercer
cruce es el que caza una pantalla renombrada. Se planta si lee menos de 40
misiones: una lectura vacía se parece muchísimo a que todo está bien (§3x).

**`npm run misiones`** corre los dos guardianes. Corrélo al tocar el catálogo,
al mover una pantalla de ruta y al renombrar una entrada del menú.

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


### 4d. TRANSMISIONES DESTACADAS — los directos de fuera (`/envivo`)

`/envivo` nació para NUESTRAS partidas: cámara → OBS → YouTube → la página. Como
solo transmitimos en torneos, la pantalla estaba vacía casi siempre. Ahora arriba
va la transmisión destacada: un directo ajeno (el «Meta Check-In» de Fantasy
Flight fue el primero) con su hora, su cuenta atrás, su reproductor y el chat.

**El reproductor va desde ANTES de la hora.** Un directo programado, incrustado,
enseña su propia sala de espera y ARRANCA SOLO: quien deje la pestaña abierta ve
el comienzo sin recargar. La cuenta atrás grande es nuestra igual, porque la de
YouTube vive dentro del iframe y no se ve en la franja de Inicio.

**Los datos NO se suponen.** El título, el canal y la hora salieron de leer la
propia página de YouTube (`meta[itemprop="startDate"]` y `scheduledStartTime`),
no de lo que dijera nadie. El id de la fila lleva la fecha para que el siguiente
directo sea una fila nueva y no una edición del anterior.

#### El aviso, y la trampa que casi pasa

Dos avisos: uno **10 minutos antes** (el que hace que alguien llegue) y uno **al
arrancar** (el que se pidió). El cron corre cada 5 minutos y es idempotente por
SELLO — sin `aviso_previo_en`/`aviso_inicio_en`, la misma transmisión mandaría el
mismo push doce veces por hora.

**`.is(sello, null)` sin mirar el resultado NO protege nada.** La primera versión
sellaba con esa condición y seguía derecho al envío sin comprobar si el UPDATE
había tocado alguna fila. Con dos corridas simultáneas, la que perdía la carrera
mandaba el push igual. Cero filas es «otra ganó», no un error.

Se sella **antes** de enviar: el peor caso así es que alguien no reciba el aviso;
al revés es que todos lo reciban doce veces, que es cómo se desinstala una app. Y
hay ventana (`TOLERANCIA_MIN`): si el cron estuvo caído dos horas, al volver sella
y calla en vez de anunciar algo que ya pasó.

#### Por qué también hay franja en Inicio

Medido el día que se armó: **13 de 39 cuentas tienen push activado**. Un anuncio
que solo viaja por push llega a un tercio de la comunidad. La franja de Inicio es
el otro canal — mismo criterio que el sobre diario, donde el push tampoco puede
ser el único camino porque por definición solo alcanza a quien ya lo tiene puesto.

#### El chat es la sala GLOBAL de siempre

No se creó una sala «transmisión». La Galaxia ya tiene `global` con su RLS, su
tiempo real y su moderación, y una segunda partiría la conversación en dos: lo
que se comente viendo el directo se perdería en un cuarto que nadie vuelve a
abrir. Es la misma sala con otra ropa.

**Que no estorbe y que no haya que scrollear salen de lo mismo**: el chat tiene
alto propio y scrollea adentro. Y `min-h-0` en la caja de mensajes NO es opcional
— sin él un hijo de un flex no se deja encoger por debajo de su contenido y
empuja la barra de escribir fuera de la pantalla, que era exactamente el bug.

#### Lo que el service worker se queda

La app usa `registerType: 'prompt'`: avisa que hay versión nueva y la persona
decide cuándo recargar (§2g). O sea que **un módulo nuevo no aparece hasta que
cada quien acepte la actualización**. Para algo con hora —una transmisión— eso
importa: el push SÍ llega (lo manda el servidor y el SW viejo lo entrega igual),
pero al abrirlo, quien no haya actualizado cae en la pantalla vieja. Verificado
en producción el primer día: la página cacheada no traía la tarjeta hasta borrar
el SW a mano.


### 4e. `revoke from public` NO le quita el EXECUTE a `anon` en Supabase

El §3i mandaba revocar EXECUTE de PUBLIC «y no solo de `anon`», porque Postgres
concede a PUBLIC y `anon` es miembro. Es cierto y **está incompleto**: Supabase
además tiene `ALTER DEFAULT PRIVILEGES` que concede EXECUTE **directamente** a
`anon` y `authenticated` sobre toda función nueva de `public`. Un grant directo
no se quita revocando de PUBLIC — son dos concesiones distintas.

Medido el 2026-08-24: las siete funciones del Taller salían con
`anon=X/postgres` en `pg_proc.proacl` **pese al `revoke ... from public`** de su
propia migración. No era una fuga (las siete comprueban `auth.uid() is null`
adentro), pero la capa de grants no estaba haciendo su trabajo.

**La forma correcta es `revoke all on function ... from anon, public;`** y
después conceder a quien toca.

Y el alcance: **33 de las 94 funciones de `public` tienen `anon=X`**. Varias a
propósito —hay pantallas públicas (overlay, blog, sedes, `/envivo`)—, así que
esto NO se arregla en masa: se revisa función por función preguntando «¿alguien
sin sesión tiene algo que hacer acá?». Revocar las 33 de un saque rompería las
públicas.

Para auditarlo:

```sql
select p.proname, pg_get_function_identity_arguments(p.oid), p.proacl::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.proacl::text like '%anon=X%'
order by p.proname;
```


### 4f. Agregar un argumento con default a una RPC NO es compatible hacia atrás

Parece que sí y no lo es. `guardar_sable` pasó de 5 argumentos a 6 (`p_acabado`
con default) y eso creó una **sobrecarga**: quedaron las dos funciones, y la
vieja con el cuerpo viejo. PostgREST resuelve por NOMBRE de argumento, así que
la PWA instalada que todavía manda 5 caía en la vieja — que seguía exigiendo
`es_probador_sable()` y respondía «El taller todavia no esta abierto» **el día
que se abrió el taller**. Podía entrar y comprar (esas RPC no cambiaron de
firma) y no podía guardar: el peor final posible de una sesión de armado.

Dos salidas, y hay que tomar una a propósito:

1. **Soltar la vieja** (`drop function ... (firma vieja)`). PostgREST cae en la
   nueva y los argumentos que faltan toman su default. Es lo que se hizo acá.
2. **Reescribir la vieja para que delegue** en la nueva, si de verdad hace falta
   mantener las dos puertas.

Lo que NO se puede es dejar las dos con cuerpos distintos: son dos verdades, y
cuál te toca depende de cuándo actualizaste (§2g).


### 4g. Personalización del sable: la cadena de acabados y el cristal a la vista

Pedido de Nel («aumenta todo»): combinar colores POR PIEZA, más colores de
hoja, y el kyber visible en medio de la empuñadura.

**La cadena de resolución del material es una sola y vive en `piezasDeSable`:**
`acabado de la pieza → acabado global → material propio del catálogo`. El
global (`sable_diseno.acabado`) NO se retiró al llegar los por-pieza: es lo que
una PWA sin actualizar sigue guardando (§2g), y la cadena lo respeta. Cualquier
acabado desconocido cae al siguiente eslabón, nunca revienta.

**El cristal a la vista es un booleano, no una pieza.** `piezasDeSable` le
inyecta al cuerpo dos herrajes SINTÉTICOS (gema de plasma radio 0,44 ×2 + aro
de marco) cuando `cristalVisto` está puesto. Por eso lo dibujan gratis los DOS
renderizadores, el asiento lo apoya midiendo como a cualquier herraje, viaja
con la pieza en la vista explotada, y la prueba lo valida contra los 12
cuerpos. La primera versión (radio 0,3) se leía como un remache de color: la
ventana es EL punto del sable cuando está puesta, y a ese tamaño no lo era.

**Los 3 colores nuevos** (HIELO cian, FRAGUA naranja, AURORA ROSA magenta) son
épicos y ninguno se arrima al rojo: cian es hielo, naranja es fragua (canon),
magenta es rosa franco. El rojo sigue siendo solo del sangrado.

**Postgres escribe en serpiente y el cliente en camello** — la traducción vive
en `sableService.miDisenoSable`, en el borde, no en cada pantalla.


### 4h. El cristal kyber es una ROCA, y la tienda va de común a legendario

**La forma.** El cristal era una `LatheGeometry` de 6 lados: un huso hexagonal
perfecto, simétrico hasta el último micrón. Un cuarzo real no es eso — es un
prisma de seis caras DESPAREJAS rematado por una pirámide cuyo ápice casi nunca
cae en el centro. `cristalTres.geometriaDeCristal` lo construye a mano,
triángulo por triángulo, **sin índices**: así `computeVertexNormals` deja una
normal por cara y las aristas salen vivas. Indexada, three promedia y el
cristal sale redondeado como un caramelo.

**La irregularidad sale de una SEMILLA, nunca de `Math.random`.** La semilla se
deriva del id del color (FNV-1a), así que el ámbar es siempre la misma piedra y
—esto es lo que importa— la foto del mango que se cachea sale idéntica en cada
render. Con azar, el caché nunca acertaría.

**Las vetas** van como `emissiveMap`, no como `map`: se busca que la luz salga
por las grietas, no que la piedra tenga un dibujo encima. Como el emisivo
multiplica el color, **una sola textura sirve para los dieciséis colores**.

**Las esquirlas** (cinco astillas orbitando) comparten geometría y material con
la roca: cinco llamadas de dibujo y ni un shader más. Sin ellas el cristal es un
objeto de vitrina; con ellas, algo que irradia.

**Nada de transparencia.** `transmission` duplica el render (pasa la escena a un
target aparte por cuadro) y esto corre en gama baja. La ilusión son tres capas
opacas: roca facetada + cáscara aditiva + vetas emisivas.

#### Los colores se eligen por DISTANCIA, no por gusto

La prueba mide la distancia euclídea en RGB entre todos los pares de halos y
exige **28 mínimo**: dos cristales parecidos son dos piezas que nadie distingue
en una miniatura de 44 px, y una de las dos es plata gastada. Cazó un duplicado
real —turquesa a 26 del cian— y hubo que correrlo. El par más cercano hoy es
amarillo vs oro, a 34.

#### El orden de la tienda es DERIVADO

Las tiras van de común a legendario y, dentro de cada rareza, del más barato al
más caro. Se ordena en el cliente (`pesoDeRareza` + precio) y **no** con la
columna `orden` de la base: `orden` se asigna al dar de alta cada tanda, así que
las tandas nuevas quedaban al final aunque fueran comunes. Un derivado no puede
quedar viejo (§3c), y el orden correcto ES un derivado de rareza y precio.
`pesoDeRareza` deriva del orden de las claves de `RAREZAS`: si entra una rareza
nueva, ordena sola.


### 4i. TERRAFORMAR el planeta (`/terraformar`)

Se eligió ampliar el planeta antes que construir otro taller, y la medición lo
decidió: **19 de 39 cuentas ya habían tocado su planeta** contra 2 que habían
forjado un sable. Es la personalización más usada de la app. Ampliar lo que la
gente ya usa vale más que estrenar un módulo y esperar que prenda (§3l).

**La línea entre gratis y pago no es el precio, es el relato.** GEOLOGÍA
—familia, mares, cráteres, anillos, lunas— es lo que tu mundo ES: salió de la
semilla de tu id y sigue gratis, en Mi Perfil. TERRAFORMACIÓN —ciudades, nubes,
auroras— es lo que le HACÉS, y eso cuesta. **Nada que ya era gratis pasó a
costar**: mismo criterio que dejó visibles las piezas legendarias ya compradas.

#### Una sola billetera

`creditos_saldo()` resta lo gastado en piezas de sable **y** en el planeta. Con
dos cuentas separadas alguien gastaría los mismos créditos dos veces y las dos
pantallas cuadrarían por separado. `sable_saldo_xp()` queda como nombre viejo
que delega — lo llaman tres RPC y renombrarlo es riesgo sin ganancia.

#### El guardia va en un TRIGGER, no en la pantalla

`profiles` se escribe DIRECTO desde el cliente (hay policy de UPDATE), así que
sin trigger cualquiera se pone METRÓPOLIS desde la consola. `planeta_clampar`
**baja** `planet_cities/clouds/auroras` al grado que de verdad se posee. Clampa
en vez de rechazar: rechazar tumbaría la grabación entera del perfil —vitrina,
aspectos, acento— por un campo cosmético.

#### LOS GRANTS DE `profiles` SON POR COLUMNA

Esto costó un bug en producción y vale para cualquier columna nueva de esa
tabla. **La policy dice qué FILAS podés tocar; el grant dice qué COLUMNAS.**
Hacen falta las dos, y el error de Postgres habla de la TABLA, que despista:

```
permission denied for table profiles
```

`planet_rings` y `planet_moons` se desplegaron sin los grants y **no
guardaban**. Había una segunda causa superpuesta, del lado del cliente:
`guardarPersonalizacion` tiene una **lista blanca** de campos y tampoco estaban
ahí — un campo que no esté en esa lista se descarta EN SILENCIO. La pantalla
dejaba elegir, la vista previa cambiaba y nada llegaba a la base.

Al agregar una columna a `profiles` hay que tocar CUATRO sitios:
1. `alter table` + `check`
2. `grant select (col) ... to authenticated, anon`
3. `grant update (col) ... to authenticated`
4. la lista blanca de `guardarPersonalizacion` y `COLUMNAS` de lectura

**Y OLVIDARSE DEL PASO 2 PUEDE TUMBAR ALGO QUE NO TIENE NADA QUE VER.**
Pasó el 2026-08-27 con `blog_autor`: se agregó la columna sin `grant select`.
El daño no salió en el blog — salió en el **ROL**. `getPermisos()` pide `role`
y `blog_autor` en la MISMA consulta («rol y permisos en un solo viaje»), así
que una columna sin permiso tumba la consulta entera con **42501**, la función
devuelve `null`, y `initAuth` respeta ese `null` a propósito para no degradar a
nadie con mala señal (§2v). Resultado: el rol **nunca se resolvía** e `isAdmin`
quedaba congelado en lo que tuviera guardado el aparato — un admin desde un
teléfono nuevo perdía el panel para siempre, sin forma de recuperarlo desde la
app. El síntoma que se reporta es «desapareció la sección de administración»,
que no se parece en nada a la causa.

Tres cosas que lo hacen difícil de ver, y por eso están anotadas:
el error habla de la **tabla**, no de la columna; quien llama trata el fallo
como «no se pudo averiguar», que es lo correcto, así que **no hay un solo
mensaje rojo**; y el efecto depende de lo que cada aparato tenga persistido, o
sea que a unos les funciona y a otros no.

`scripts/profiles-columnas-con-permiso.mjs` junta las columnas de los 53
`.select()` sobre `profiles` que hay en el cliente y escupe la consulta lista
para pegar en el SQL Editor: lo que devuelva son columnas sin permiso.

#### El shader: espacio de MUNDO, no de vista

Las ciudades salen donde `dot(normal, dirSol) < 0`. `normalMatrix` lleva la
normal a espacio de VISTA y `dirSol` es una dirección del MUNDO: comparadas así
el lado nocturno se movía con la CÁMARA en vez de con el sol y las ciudades no
aparecían nunca. Va `mat3(modelMatrix) * normal`.

Y ojo con los comentarios dentro de un shader: viven en un template literal, y
una comilla invertida lo corta. Sin comillas invertidas ahí adentro.

#### El banco tiene modo NOCHE

Ciudades y auroras viven en la cara que no se ve, y girar la cámara no alcanza
porque el sol está fijo en el mundo: habría que dar media vuelta exacta.
`deNoche` pone el sol detrás. Sin eso no hay forma de revisar lo que esta
pantalla vende.


### 4j. LOS ASPECTOS = maestría de trivia (`/trivia`)

Eran ocho contadores renombrados (Vigilancia = partidas, Heroísmo = cartas) y
apuntados a cosas que en esta comunidad casi no pasan. **Seis de ocho no los
había alcanzado nadie**, y no por poco: Vigilancia pedía 100 partidas y el que
más jugó lleva 3. Una escalera cuyo primer escalón está 33 veces más arriba de
donde llega la gente es decorativa, no difícil.

Ahora son **seis** —los del juego de verdad— y se suben de una sola forma:
acertando preguntas de ese aspecto. Es la única progresión de la app que no se
compra ni se acumula por estar.

**Se DERIVAN de `trivia_temas`**, que ya existía y ya lo alimentan las dos
formas de jugar. Una tabla nueva habría arrancado a todos en cero; derivando,
el módulo se encendió con 498 aciertos ya acumulados y 6 personas rankeadas.

**El servidor razona en TEMAS; el aspecto es el nombre en pantalla.** El mapa es
1 a 1, y si el servidor razonara en aspectos ese mapa viviría en dos lados.

#### Tres agujeros que salieron midiendo, no leyendo

**1. La trivia se ganaba sin saber nada.** De 180 preguntas, la correcta caía
95 veces en la 1ª opción y UNA en la 4ª — contestar siempre la primera acertaba
el 53 %. `seededShuffle` barajaba las PREGUNTAS y nunca las OPCIONES. Se arregló
barajando al servir, con la semilla del día mezclada con el id de la pregunta
(si compartieran semilla, todas se moverían igual y el sesgo volvería).

Y hubo que mezclar bien: `s * 31 + char` dejó 34/17/26/23 % porque los ids se
parecen muchísimo (`u02`, `u03`, `n110`) y semillas casi iguales dan
permutaciones casi iguales. **FNV-1a + xorshift32 y `>>> 0`** — `& 0xFFFFFFFF`
devuelve un entero CON signo y `Math.abs` sobre él vuelve a sesgar el módulo.

**2. Cinco pares duplicados y nueve filtraciones, viejos.** El validador de la
ampliación anterior comparaba las nuevas contra las viejas pero **no las nuevas
entre sí**. `scripts/trivia-banco.test.mts` cruza TODAS contra todas.

Una *filtración* es un `funFact` que contiene la respuesta de otra pregunta. El
criterio exige DOS cosas: que el dato contenga la respuesta **y** que los dos
enunciados hablen de lo mismo. Sin la segunda, «Anakin Skywalker» —respuesta de
cinco preguntas— disparaba 70 avisos de los que 61 eran ruido.

**3. Le di valor económico a un contador sin defensa.** `trivia_sumar_tema`
sumaba sin tope. Mientras solo pintaba una medalla, era vanidad; desde que los
aspectos pagan 1.500 créditos por escalón, un bucle de consola imprime dinero.

**Esa es la forma más común de crear un agujero: no escribiendo código
inseguro, sino conectando algo que ya existía a algo que ahora vale.** Al
agregar un pago, la pregunta obligatoria es *«¿de qué número depende, y ese
número está defendido?»*.

El tope quedó en 20 por tema y por día (10 del modo por tema + 10 de la diaria
en el peor caso). Pasado el tope devuelve lo que había en vez de reventar: quien
llegó jugando no tiene por qué ver un error, y a quien esté en un bucle no hay
que avisarle que lo detectamos.

#### Lo que queda abierto

`sumar_xp` topa 500 por llamada pero **no limita cuántas llamadas**. Es
preexistente y afecta al XP y al ranking, no solo a la trivia. No se tocó
porque arreglarlo bien pide decidir qué acción puede pagar cuánto y cada cuánto
— es un trabajo aparte, no un parche.


### 4k. Ampliar el banco de trivia: 24 rincones y dos clases de revisor

El banco pasó de 286 a **689 preguntas** en una sola tanda. Lo que hizo que
saliera bien no fue el tamaño del enjambre sino dos decisiones:

**1. Repartir el TERRITORIO, no el tema.** A los 24 agentes no se les pidió
«veinte de jedi»: a cada uno se le dio un rincón —las precuelas, la animación,
los droides, las naves capitales, las reglas de combate—. Escribiendo a ciegas
en paralelo sobre el mismo tema, veinticuatro agentes escriben veinticuatro
preguntas sobre Yoda. Con el territorio repartido, casi no se pisan.

**2. Dos clases de revisor, cada una en lo suyo.**

- **Agentes** para HECHOS y AMBIGÜEDAD, que piden criterio. Cazaron 8 datos
  falsos: «Palpatine fue gobernador de Naboo» (fue senador), «eso no es una
  luna» atribuida a Obi-Wan cuando la dice Han, una escena inventada, un
  diálogo invertido.
- **Un guion** para REPETIDAS y FILTRACIONES, que piden exhaustividad. Cruza
  689 contra 689 y encontró 13 pares duplicados —dos «¿cuál es el planeta natal
  de los wookiees?» idénticas, de agentes distintos— y 17 funFacts que regalaban
  la respuesta de otra.

**Ninguno de los dos hace bien lo del otro.** Un agente no puede tener 689
preguntas en la cabeza a la vez; un guion no sabe si Palpatine fue gobernador.

#### El peso

El trozo de Trivia pasó de 35 a **83 KB comprimidos**. Solo lo baja quien abre
Trivia (el Inicio sigue en 15 KB) y el service worker lo cachea. Si algún día
molesta, el banco sale del bundle a un JSON aparte —cambia poco y el chunk de
UI cambia mucho, así que separarlos ahorraría re-descargas.

#### El campo `aspecto` de cada pregunta NO manda

El progreso se acredita por **TEMA** (`trivia_temas`), y el mapa tema→aspecto
traduce para la pantalla. El campo `aspecto` de las preguntas existe para el día
que una no encaje en el aspecto por defecto de su tema; hoy no lo usa nadie.
Está dicho así en `aspectos.ts` porque estaba escrito de forma que invitaba a
suponer lo contrario.


### 4l. ESPACIO DE CREADORES — la Liga (demo cerrado)

Pedido de Nel a partir de Alejo (canal PUENTE 3, cuenta **AlejoP3**): un espacio
donde un creador de contenido lleve SU liga — inscripción, calendario, tabla,
VODs de YouTube por partida — y a futuro transmita con su marca.

**Estado: DEMO CERRADO.** `puede_ver_creadores()` limita el SELECT de las 4
tablas a creadores + admins. Para abrirlo al público se cambia ESA función a
`true` y las policies no se tocan — la puerta es un punto, no veinte. Sin
entrada de menú: se entra por `/c/puente3` y `/liga/:code`.

#### Decisiones de diseño (del panel de 3 lentes + síntesis)

- **Las partidas de liga NO reusan `duelos_amistosos`.** Los duelos son
  PRIVADOS por policy (solo los ven los dos que juegan) y prometen
  estructuralmente no tocar ranking; una liga es espectáculo público y ES un
  ranking. Se reusan patrones (BO3 0-2, identidad-por-inscripción), no filas.
- **Round-robin con calendario COMPLETO al cerrar inscripción** (método del
  círculo, en la RPC). Alejo necesita anunciar «jornada 3: X vs Y» con semanas
  de antelación para producir contenido. Nada de suizo acá.
- **El motor jamás inventa resultados** (cicatriz de torneos-invitados):
  jornada vencida = `sin_jugar`, el WO lo da el creador a mano.
- **Contrato estructural sin XP**: las tablas de liga no tienen triggers ni
  tocan player_stats. El creador carga resultados → si la liga pagara por
  partida, dos coludidos serían impresora de créditos (§4j). El premio va SOLO
  al cierre por `liga_premiar()` (solo admin, preset 500/250/50, por
  `sable_bonos`, idempotente por motivo).
- **Consentimiento en la RPC, no en la UI**: hay menores y las partidas se
  publican en YouTube. `liga_inscribirse` rechaza sin `p_consiente = true`.
- **El VOD vive EN la partida** (`vod_youtube_id` de 11 chars normalizado
  server-side + `vod_t` en segundos): un solo video de la jornada sirve para
  todas sus partidas con `?start=`.
- **El logo del creador** es un data URI (mismo patrón que el avatar),
  subido por `creador_subir_logo` con tope de 200 KB DENTRO de la RPC.
- **Tabla de posiciones NUNCA almacenada**: `tablaDe()` en el cliente (§2y).
- **`canal_youtube` lo fija el ADMIN**, no el creador — anti-impersonación,
  la misma razón por la que `transmisiones` es service-role.

#### «MI LIGA» en el perfil, la cabina y la presentación al aire

Las tres piezas que faltaban entraron el 2026-08-27.

**`mi_liga()` es UNA consulta, y el perfil es la pantalla que más se abre.**
Devuelve liga + inscripciones + partidas de un viaje; con cuatro SELECT desde
el cliente serían cuatro viajes para pintar una tarjeta. Y devuelve lo tuyo
**aunque el demo siga cerrado**: tu liga es tuya, la veas o no en la casa del
creador. La tabla NO se calcula en el servidor — se computa con `tablaDe()`,
el mismo algoritmo que pinta la clasificación pública (§2y). La tarjeta no se
dibuja si no estás en ninguna liga, que es el caso de casi todo el mundo.

**El ALTA de una cabina es de ADMIN, no una policy de INSERT.** El motor de
transmisión ya existía entero; lo que faltaba eran las tres filas (sesión +
overlay + operador). El `code` de una cabina es su dirección pública
—`/overlay/PUENTE3` es lo que se pega en OBS— y `stream_operadores` es
exactamente la tabla que decide quién escribe el marcador que sale al aire:
con una policy de INSERT, un creador podría darse de alta con `SV01` y
quedarse operando la cabina de los torneos nacionales. `creador_abrir_cabina`
rechaza además un code que ya tenga OTRO operador — sin eso, abrir dos veces
la cabina de alguien le regala el mando a quien la abra de último.

**El atajo del creador se LISTA desde `stream_operadores`**, no se arma con
su code: si el admin le abrió la cabina con otro código, un enlace inventado
llevaría a `/estudio/PUENTE3`, una pantalla que existe y que NO es la suya.

**`creador_en_vivo()` no abre `stream_overlay` a `anon`**: esa fila lleva el
marcador completo en vivo —vidas, recursos, cartas en mano— y publicarlo
entero sería regalarle información de una partida en curso a quien la está
jugando. Salen tres campos. El interruptor es el MISMO que usa `/envivo`: no
hay un segundo sitio donde decir «estoy transmitiendo» que se pueda quedar
viejo (§3c).

**PRESENTAR A UN JUGADOR ES UN CAMPO (`ficha`), NUNCA UNA ESCENA.** Es la
regla que no se puede relajar: `normalizarEstado` colapsa toda escena
desconocida a `'pronto'`, así que con escena nueva un OBS con la PWA sin
actualizar mostraría la **pantalla de espera a mitad de partida** (§2g). Como
campo, un overlay viejo simplemente no dibuja la ficha y sigue transmitiendo.
`scripts/overlay-ficha.test.mts` fija el contrato con 8 casos, y el último
demuestra la diferencia: la escena inventada colapsa, la ficha no toca nada.

Dos detalles del campo: los `datos` se topan **en 4 en el normalizador**, no
en el dibujo (lo que llega es JSON escrito por un cliente, y veinte filas
serían una columna saliéndose de la transmisión de alguien); y va **fuera del
condicional de escena** porque presentar se hace en la pantalla de espera,
antes de que arranque la partida. Los números salen de `tablaDe()`, no de
campos de texto: al aire, delante de la comunidad, una segunda copia de la
tabla se separa en la primera jornada.

**Dos errores míos que solo cazó probar contra la base**, y valen para
cualquier RPC nueva acá: **`is_admin()` NO EXISTE** en esta base —la
comprobación se escribe como el `exists` sobre `profiles`— y **el fallo va en
la clave `error`, no `mensaje`**, porque el ayudante `rpc()` de `ligaService`
lee esa; con `mensaje`, todo fallo se habría leído en pantalla como el
genérico «No se pudo», con el servidor explicando el motivo y la persona sin
verlo nunca.

Y una trampa al PROBAR, la de siempre con otra cara: el `update` de prueba
sobre `stream_overlay` corrido como Nel tocó **0 filas sin error** —no es
operador de esa cabina— y eso se lee igual que «la función está rota» (§2u).
Hay que escribir como quien de verdad tiene el permiso.

Fases pendientes: confirmación dual de resultados, emblema de «Campeón Liga
PUENTE 3» en la credencial, temporadas.

### 4m. Imágenes que sube una persona: proporción, alfa y peso

Llegó el primer logo de creador de verdad —el rótulo de PUENTE 3, 2000×1125
(16:9) con 21,4 % de píxeles transparentes— y destapó una familia entera de
defectos. Auditados con cuatro lentes y verificación adversarial: 28
hallazgos, **14 confirmados, 13 refutados**.

**UNA MARCA NO ES UN AVATAR: no se recorta.** Un avatar redondo con
`object-cover` está bien —cortar la cara es correcto—; un logo recortado deja
de identificar, que es lo único que tenía que hacer. Un wordmark apaisado en
una caja cuadrada pierde el **44 % del ancho**: quedan dos letras del nombre.
Pasaba en la casa del creador, en la cabecera de la sede y en el directorio de
sedes. La regla: **alto fijo, ancho libre** (`h-N w-auto object-contain`), y la
caja se adapta a la marca en vez de al revés. Con tope de ancho donde comparte
fila con texto, o un logo muy apaisado empuja el texto fuera.

**Y EL AFICHE DE UN TORNEO ES VERTICAL.** Se sube del celular y sale de
Instagram: 4:5 o A4, con el nombre arriba, la fecha en medio y la dirección
abajo. En una banda de 112 px por todo el ancho (≈3,5:1) se veía el **22 %
central de su alto** — una tira de fondo sin un solo dato.

**UN LOGO NO PUEDE EXPORTARSE A JPEG.** `comprimirLogo` era una copia del
compresor del avatar. Una foto de perfil es opaca y el JPEG le sienta bien; un
logo de marca casi siempre trae fondo transparente, y el JPEG no tiene alfa:
al componer, el navegador pone **negro** donde había transparencia. Y el fallo
se ve como éxito —la subida contesta «Logo actualizado»— con el archivo
original intacto en la computadora de quien lo subió, así que nadie sospecha
del compresor: parece que «ya venía así». Va **WebP** (conserva alfa y pesa
menos), con escalera de reintentos bajando calidad y tamaño hasta entrar en el
tope del servidor, en vez de mandar algo que va a ser rechazado al final.

**UN DATA URI DENTRO DE UN JSON NO SE CACHEA.** Es el §2t otra vez, con otra
cara. `mi_liga()` mandaba el logo entero del creador en la respuesta que se
pide al ABRIR EL PERFIL, la pantalla más visitada, para pintarlo a 36 px de
alto. Una imagen por URL la guarda el navegador; metida en un JSON se
re-descarga cada vez. **Si una imagen viaja dentro de una fila, preguntá
cuántas veces se lee esa fila.** Quedan dos casos abiertos de la misma
familia, con tarea aparte: `community_posts` guarda una COPIA del data URI del
avatar en cada publicación y el muro lee 40 de un tirón, y el buscador de
`/contrabando` pide 30-50 perfiles con avatar por cada tecla.

**La lupa del álbum NO lleva relleno desenfocado.** Las dos caras de un líder
Showcase son la misma cartulina impresa de lado (frente 400×286, dorso
286×400). En una REJILLA el hueco se tapa con la misma imagen ampliada y
borrosa, y está bien: las celdas miden igual. En la lupa —una carta sola sobre
negro al 85 %— el hueco YA es un fondo, y el relleno solo agrega un muro gris
del doble de alto que la carta: se lee como que la imagen se rompió. De ahí el
prop `relleno` de `CardImage`, encendido por defecto.
Y `CartaGirable` tiene `ratioDorso`: la caja **morfa** al cruzar los 90°, que
es lo que hace la cartulina de verdad al girarla. Sin eso quedaban 200 px
muertos empujando el pie del modal. La paridad de la media vuelta es la misma
regla con la que la credencial decide su cara (§2y): `y` se acumula sin tope y
puede ser negativo.

Banco: `/banco-sobres`, sección del álbum, premio **Showcase** → casilla 769.
Es Obi-Wan Showcase (LOF 1012), el peor caso del módulo.

### 4n. El menú de escritorio: `fixed` sin alto NO scrollea

El `<aside>` era `fixed top-0` con `min-h-screen` y **sin alto definido**, así
que crecía con su contenido. Por eso el `flex-1 overflow-y-auto` del `<nav>`
nunca se veía obligado a encoger y **no llegaba a scrollear jamás**. Medido en
una ventana de 820 px: el aside medía **2.175** y
`nav.scrollHeight === nav.clientHeight`. Como es `fixed`, esos 1.355 px que
colgaban por debajo no se alcanzaban de ninguna forma —el documento tampoco
scrollea (el caparazón es `h-[100dvh] overflow-hidden`)— y de **31 entradas se
llegaba a once**. Un admin, que tiene tres más, perdía el panel entero.

Es el mismo gotcha que el `min-h-0` de `AppLayout` con la otra cara: allá
faltaba **dejar encoger**, acá faltaba **decir hasta dónde**. Los dos hacen
falta: `h-[100dvh]` en el aside y `min-h-0` en el nav.

**El aire de escritorio no es un ancho fijo.** El caparazón se diseñó para el
teléfono (`max-w-lg`) y en escritorio se soltaba a ancho completo: en un
monitor de 1.920 el formulario de acceso medía 1.632 px de lado a lado, que es
lo que hace que se lea como una app de celular a pantalla completa. Van
márgenes desde `lg` y tope solo en pantallas muy anchas — **nada de apretarlo
a una columna de lectura**, porque acá se miran rejillas de cartas y el ancho
se usa.

La barra de desplazamiento fina va como **CSS plano**, no `@utility` (§3i), y
se verifica contra el CSS **construido** (§3u).

### 4o. LA PROYECCIÓN — la tele de la tienda no es un teléfono grande

`/events/live/:code` se abre una vez, se deja tres horas y **nadie la toca**.
Eso cambia cuál es el peor modo de fallo: no es la pantalla en blanco —esa se
nota— sino **el tablero congelado que sigue pareciendo correcto**, la ronda 2
en la pared mientras la sala juega la 4.

Lo que había, medido: `max-w-2xl` (672 px = 35% de una tele de 1920, con dos
franjas negras a los lados), nombres a 14 px, cabecera a 12, y **pestañas** —
que en una tele nadie toca, así que se quedaba pegada en la primera vista toda
la tarde.

**El diseño en una frase: la mesa viaja EN LA MISMA FILA que el nombre.** Por
eso esta pantalla no tiene un estado que pueda quedar en el lugar equivocado.
El índice es el nombre en orden alfabético con cabecera de rango («A – F»),
porque la pregunta que la sala hace en voz alta es una búsqueda por nombre.

**«Mesa cerrada» es `reported_at`, NUNCA `confirmed_at`.** Medido: SV150826
terminó con 12 reportados y **cero** confirmados; SV290826 con 24 y 12.
`confirmed_at` lo escribe `confirmPairingResult`, que exige que el RIVAL abra
la app — con un tercio de la sala sin cuenta eso no pasa. Con el criterio
«correcto» el instrumento habría dicho «MESAS 0/4» toda la tarde con todos los
resultados adentro. `disputed_at` sí reabre la mesa.

**Los puntos solo se muestran si el orden SALIÓ de ellos.** Con `puesto` fijado
a mano —una final de mesas, un cuadro— el orden lo decidió la mesa, no los
puntos: en el torneo real 8º Winnie tiene 4 y 4º Nelson tiene 3, y ponerlos al
lado hace que el tablero se contradiga solo delante de quien acaba de jugar.

**La densidad es una TABLA de píxeles enteros, no `cqh`.** Si el Chromium viejo
de una smart TV no entiende `container-type`, la declaración se descarta **en
silencio** y el cuerpo cae al heredado: la pantalla se apaga tipográficamente
justo en el aparato donde más probable es que pase, y sin un error que lo
delate. Piso duro de 42 px; primero el piso, después cuántos caben.

**Overscan: 5% por lado.** Una tele por HDMI que no esté en «Just Scan» se come
hasta un 5% por borde — justo donde viven el reloj y el pie.

**El lienzo se CENTRA.** El patrón de `OverlayPage` no centra porque OBS
siempre entrega 16:9 exacto; una tele o un proyector con otra proporción dejan
todo pegado a la esquina superior izquierda.

**Va fuera de `AppLayout`** (junto a `/overlay` y `/estudio`) y **sin `<P>`**.
Adentro heredaba Header y SideNav y —lo grave— montaba `UpdatePrompt`, que
podía abrir un aviso de versión **encima de la proyección a mitad del torneo**.
Sin `<P>` porque fuera de AppLayout `initAuth()` no corre y AuthGate la dejaría
en «Cargando» para siempre (§3l). Tiene que seguir en `RUTAS_LIBRES`.

**La vista vieja NO se borró: es la de TELÉFONO**, por debajo de 900 px. La
misma URL se comparte por WhatsApp y se abre desde la mesa; una tele y un
teléfono no son la misma pantalla.

**Seis defectos que SOLO se vieron mirando la pantalla**, y por eso existe
`/banco-proyeccion` (17 estados sembrados, sin tocar la base):

1. **Un ancho declarado no es un ancho respetado.** «FINALIZADO» se dibujaba
   encima de «RONDA 2»: faltaban `flexShrink: 0` y `overflow: hidden`.
2. **`1fr` es `minmax(auto, 1fr)`**, y ese `auto` deja que una fila crezca por
   encima de su reparto: once nombres a 63 px desbordaban y la última se
   montaba sobre el pie. Va `minmax(0, 1fr)`.
3. **`nombreCorto` es para PERSONAS.** Aplicado al nombre del torneo convirtió
   «Torneo SWU · 12 jugadores» en **«Torneo S.»**: abrevia por apellido y un
   torneo no tiene apellido.
4. **Invertir el contraste no es contraste.** «TIEMPO» del color del fondo del
   tablero sobre la banda roja es oscuro sobre oscuro, y se apaga justo en el
   único momento urgente de la pantalla.
5. **El modo de tele de 43" estaba al revés**: multiplicaba por 1,45 y elegía
   la disposición **más apretada, con la letra más chica**, en el único sitio
   donde no se podía. Se finge que hay MENOS gente, no más.
6. **«RONDA 0» y «JUGADORES —»** son campos sin llenar asomados a una pared.

**`npm run proyeccion`** fija 36 cuentas. Una falló al escribirla y enseñó algo
de la propia tabla: **NO es monótona en píxeles** —el escalón de modo lleno usa
44, más que los 42 de los dos anteriores, porque al apagar la franja sobra
alto—, así que la propiedad que se mide para la tele chica es la **densidad**,
no el cuerpo de la letra.

**Cuatro capas de frescura, y la cuarta es la que importa:** tiempo real,
sondeo cada 30 s, relectura al volver la pestaña, y `location.reload()` a los
12 minutos sin una lectura buena. `subscribeToEvent` llama a `.subscribe()`
**sin callback de estado** (`tournamentCloud.ts:1477`), así que hoy un
`CHANNEL_ERROR` es completamente mudo y una tele congelada se ve igual que un
torneo tranquilo. El punto de frescura del pie es la única forma de notarlo
desde lejos.

**`wakeLock` no existe en Tizen ni webOS** — falla en silencio justo donde más
falta hace. La respuesta real es apagarle el ahorro de energía al televisor, y
eso va en la nota de operación, no en el código.

### 4p. El contador de vida: 24 px era el sintoma, no el problema

Se pidio agrandar los botones (median **24 px**, cuando los de puesto de la
MISMA fila ya median 44). Mirandolo apareció algo peor:

```
disabled={bloqueada || guardando}
```

**Cada toque se bloqueaba hasta que el servidor contestara.** Bajar de 30 a 25
eran cinco viajes de ida y vuelta EN FILA, cada uno frenando al siguiente. Con
la senal de una tienda eso no se lee como lentitud sino como un contador roto —
y termina en alguien que deja de anotar. Esa vida decide quien es el mejor
segundo y pasa a la final (§3k).

Ahora la pantalla obedece al instante y el servidor se entera **450 ms despues
del ULTIMO toque**: cinco toques seguidos son UNA escritura. Si rechaza, se
vuelve al ultimo valor **que el servidor confirmo** —no al inmediatamente
anterior, que con varios toques encadenados seria un numero intermedio que
nunca existio—. Al desmontar se manda lo pendiente: anotar la ultima vida y
cerrar el lobby en el mismo segundo perdia el dato.

**EL ARREGLO OBVIO NO ALCANZABA, Y ES LA LECCION DEL MODULO.** Con
`poner(valor - 1)` los cuatro toques leen el MISMO `valor` del cierre —React no
re-renderiza dentro del mismo tick— y los cuatro calculan 29. Medido en el
banco: **4 toques, 1 punto**. Va por DELTA contra una ref, que si se actualiza
al toque. Verificado: 30 → cuatro «−» → **26** → dos «+» → **28**.

**La palabra «vida» se retiro, y es una cuenta.** En un telefono de 375 px
quedan 327 utiles, los cuatro botones de puesto se llevan 156 y el contador
142: la etiqueta se pasa **13 px** y quedaba cortada a media palabra, que es
peor que no estar. Vive en el `aria-label` de cada boton.

**El contador salio de DENTRO del span que trunca el nombre**: ese
`overflow: hidden` le recortaba el borde derecho.

**Banco en `/banco-mesa-fila`** (solo desarrollo). La fila vive detras de
sesion de admin (el panel) o de inscripcion (el lobby), asi que la unica forma
de verla era estar en un torneo de verdad con gente esperando. Sin sesion la
escritura falla A PROPOSITO: eso prueba el camino de vuelta atras, que es el
unico que no se comprueba tocando bonito.

**DOS MEDICIONES QUE MINTIERON antes de que el codigo estuviera bien**, y las
dos se leyeron como «el codigo no funciona»:

1. **`innerText` DEPENDE del diseno.** Con el panel del navegador oculto
   devuelve valores viejos. Para leer un valor va `textContent`.
2. **Leer el DOM en el mismo tick del `.click()` da el valor anterior**, porque
   React confirma en microtarea. Hay que dejar pasar un tick.

Es el mismo par del §4c (`document.hidden` siempre true) y del §3x
(`innerWidth` 0 con la pestana de fondo): **el metodo falla y parece que falla
el codigo**.

### 4q. Los rotulos en ingles del modulo de torneos

Nueve, todos en el modulo que mas se usa: Standings, Pairings, Timer, Bracket
y Dashboard. En un torneo presencial en Santa Tecla, «Pairings» es la palabra
que hay que explicarle a alguien.

**Y uno estuvo a punto de salir mal.** Puse «Mesas» en la pestana `pairings`
para los torneos de ese tipo — y **ya existe una pestana «Mesas»**
(`TournamentDashboard`, §3k). Habrian quedado dos con el mismo rotulo, y en
movil el texto va oculto: solo se distinguirian por el icono. La pestana
`pairings` solo tiene sentido en torneos 1v1 (la propia pantalla la limita con
`!esDeMesas`), asi que va **«Emparejamientos»**, sin condicional.

**El build no lo habria cazado nunca**: dos rotulos iguales compilan igual de
bien que dos distintos.

Y el reloj de la vista de telefono de `/events/live/:code` dejo de mostrar
«00:00 ¡Tiempo terminado!» parpadeando sobre torneos cerrados hace semanas: el
plazo vencido de la ultima ronda no es un dato viejo, es **un dato falso**.

### 4r. «Fijar clasificación» conoce la MESA FINAL, no los puntos

`fijar_puestos_finales` ordenaba por `points desc, match_wins desc,
player_name asc`. Correcto en un suizo —ahí los puntos SON la clasificación—
y equivocado en un torneo de mesas: ahí hay una **mesa final**, y quien la
gana es el campeón aunque otro haya sumado más puntos en las rondas previas.

Medido contra el TWIN SUNS (SWUXF2W, 11 jugadores), el único torneo de mesas
cerrado que existe: los puestos reales son Jbeltramirez(5pts), iNelo(5),
Viaud(4), **Nelson(3)** — y por puntos los tres de 4 puntos (Vara,
Lemaster89, Winnie) quedaban por ENCIMA de Nelson, que fue 4º en la final.
Los once puestos hubo que corregirlos a mano antes de cerrar.

**No es cosmético:** `_repartir_premios` reparte por `coalesce(puesto, 32767)`
(§3k) y la escala de sobres es por posición. Un puesto mal fijado son sobres y
XP a quien no le tocan, sin un solo error a la vista.

**La estructura se LEYÓ de los datos, no se supuso.** Los puestos que declaró
el organizador caen en un patrón exacto:

| | |
|---|---|
| mesa 1 de la última ronda | → 1, 2, 3, 4 — **la final, en bloque** |
| los 1º de las otras mesas | → 5, 6 |
| los 2º de las otras mesas | → 7, 8 |
| los 3º de las otras mesas | → 9, 10 |
| el 4º | → 11 |

Dos reglas: **la mesa 1 de la última ronda es la final** y se lleva las
primeras posiciones en bloque; **el resto va INTERLINEADO** por el puesto que
sacó dentro de su mesa. Ganar tu mesa vale más que quedar segundo en otra —
sin interlinear, el último de la mesa 2 quedaría sobre el ganador de la mesa 3.

Verificado en transacción revertida: **los cuatro primeros exactos** y 7 de 11
en total, con las cuatro diferencias todas DENTRO de su bloque correcto.

**LO QUE NO SE PUDO DERIVAR, Y POR ESO SE DICE EN PANTALLA.** El orden dentro
de cada bloque (Vara antes que Lemaster89, isuraji antes que Winnie) no lo
explica ningún criterio: se probaron mesa, puntos y vida, y **cada uno falla
en al menos un caso**. Esos los tecleó una persona con la hoja delante. Se
desempata por puntos y después por vida —el mismo criterio con el que el
torneo elige al «mejor segundo»— y queda escrito como elección, no como
hallazgo.

Por eso entra también que el organizador **VEA el resultado**: la función
escribía once puestos y contestaba «Clasificación fijada para 11 jugadores»,
un número que no dice nada del único dato que importa. Ahora sale la lista
ordenada con la mesa de la que salió cada quien y la final marcada. Y cerrar
sin haber fijado **avisa**: hacerlo reparte por el orden viejo y saca el
torneo de la temporada, las dos cosas en silencio.

**Suizo y eliminación no cambian** (verificado: SV290826 da el mismo orden).
Y **el TWIN SUNS no se recalcula**: está cerrado y repartido, y volver a
fijarle los puestos movería su tabla de temporada meses después — mismo
criterio que el §3k tomó con el torneo del 15/8.

**Un fallo del propio banco, y vale la lección.** En `/banco-mesa-fila` le puse
`user_id: 'u'` literal a los once, así que el cruce contra la clasificación no
casaba con nadie y las once filas decían «sin mesa». El componente degradaba
honesto —«sin mesa» en vez de la mesa de otro— pero **un banco que miente
sobre lo que prueba es peor que no tenerlo**, que es la misma forma del §3x
(«0 temas · TODOS PASAN»).

### 4s. La escala de sobres se edita desde la app, no desde el SQL Editor

`torneo_escala_sobres` existía desde agosto y **no se escribía desde ningún
sitio de la app**: cero referencias en `src/`. La escala especial del Twin
Suns la puso una persona a mano en el SQL Editor a partir de un mensaje.

**Y por eso el 4º de la final se quedó con CERO sobres.** La escala se
escribió cuando la final todavía era de TRES personas; cuando creció a cuatro,
nadie volvió a tocarla. En ese mismo torneo los premios cambiaron **tres veces
en una tarde** (9, 10 y 11 inscritos, cada uno con un reparto distinto).

El premio de un torneo lo decide quien lo organiza — está escrito así en el
comentario de la propia migración— y esa decisión no puede necesitar a un
programador. Hay editor en el podio, para quien lleva el torneo.

**Es una LISTA de puesto → sobres, no una fórmula.** Los premios de esta
comunidad no siguen una curva: «3 al campeón, 1 al 2º, 1 al 3º, 1 al 4º, y 1 al
ganador de cada mesa que quedó». Cualquier fórmula que describiera eso sería
una mentira ordenada.

**Tiene salida a la escala de siempre.** Una escala propia con todo en cero NO
es lo mismo que no tener escala: la primera reparte cero, la segunda reparte
5/4/3/2/1. Sin deshacer, quien la abra por curiosidad deja el torneo sin
premios.

**Se borra y se reescribe, nunca upsert.** Quitar un puesto de la lista tiene
que QUITARLO; con upsert el puesto viejo sobrevive anunciando un premio que ya
nadie decidió dar. Y se cuenta lo que devuelve el insert (§2u): una escritura
frenada por RLS afecta 0 filas **sin error**, así que la pantalla diría
«guardado» con la escala vieja intacta — y el podio anunciaría una cosa
mientras el cierre reparte otra, que es justo lo que la tabla existe para
evitar.

**El banco apunta a un evento INVENTADO.** Con el id de uno real, tocar
«Guardar» desde `/banco-mesa-fila` le pisaría los premios a un torneo de
verdad.

Y una regla de operación: **un torneo cerrado no se re-escala.** Subirle el 4º
a 1 después de repartir no le da el sobre a nadie —el pestillo de premios
impide repartir dos veces— pero sí hace que el podio anuncie retroactivamente
algo que nunca se entregó.

### 4t. LIGA — Fase 0: lo que hacía imposible jugar, y lo que solo es gratis hoy

La liga estaba construida entera y **no se podía usar**. Fase 0 no agrega una
pantalla: destraba lo que estaba muerto y hace ahora los `alter` que con datos
vivos costarían una migración. Se pudo porque `puente3` tenía 0 inscritos y 0
partidas — el demo de 128 usuarios y 448 partidas era falso y se borró el
2026-09-06.

**ALEJO NO PODÍA VER SU PROPIA LIGA.** `liga_visible()` leía SOLO
`liga_probadores`, que tiene UNA fila (Nelson). El creador, su staff y cualquier
inscrito recibían «Esta liga todavía no es pública» — incluido el dueño. Ahora
son cinco puertas (pública · creador · staff · inscrito · probador) y **sigue
siendo UN punto**: las tres policies que la llaman no se tocaron. La de
probadores se conserva a propósito, que es la que deja estrenar con una cuenta.

**LA LIGA NO SE PODÍA CERRAR.** `liga_cerrar` escribe `estado = 'sin_jugar'` en
las jornadas que nadie jugó, y ese valor **no estaba en el CHECK**: 23514 y
rollback de todo. Con una sola partida sin jugar, la liga no cerraba nunca. Se
agregó el valor en vez de cambiar la RPC porque el estado es correcto — el motor
no inventa resultados (§3q). Es el mismo par del §3h-sexies y del §3m: **tocar el
estado en el servicio sin ampliar el CHECK no falla al entrar, falla al
escribir**, y ahí ya es tarde.

**`algo = NULL` NO ES FALSE, Y AHÍ SE CAÍA LA CONFIRMACIÓN DOBLE.**
`liga_reportar` dejaba pasar al staff sin plaza, así que
`reportada_por = coalesce(v_mia, reportada_por)` quedaba en NULL. Y
`liga_confirmar` guarda contra la autoconfirmación con
`if v_mia = v_p.reportada_por then rechazar`: contra NULL eso da NULL, que no es
TRUE, la guardia no dispara y **cualquiera de los dos jugadores confirma su
propio resultado**. La confirmación doble es toda la defensa que la liga tiene
contra un marcador inventado, y dejaba de existir en cuanto el staff tocaba una
partida. Se sacó `v_staff`: el staff usa `liga_corregir`, que además **deja
huella** — un staff reportando por `liga_reportar` era una acción administrativa
sin rastro.

**EL LAUDO PUBLICABA LA ACUSACIÓN.** `liga_correcciones` guardaba `to_jsonb(m)`
de la fila COMPLETA, incluido `disputa_motivo` — el texto libre donde un jugador
acusa a otro— y esa tabla tenía SELECT a nivel de tabla. Se guarda recortado. Y
`liga_es_staff(liga)` no miraba `grupo_id`: un árbitro del grupo 3 laudaba
partidas del grupo 7. El rol por grupo existía en la tabla desde el primer día y
no lo leía nadie.

**LOS GRANTS DE TABLA OTRA VEZ (§2j), Y ACÁ CON MENORES DE POR MEDIO.**
`liga_inscripciones`, `liga_partidas` y `liga_correcciones` tenían SELECT a nivel
de TABLA para `authenticated`. `liga_ver()` omite `user_id` a propósito y **la
tabla lo entregaba igual**: el día que la liga se abriera, cualquier cuenta con
sesión hacía un GET a `/rest/v1/liga_inscripciones` y se llevaba `user_id`,
`estado` (incluido un veto), `abandonos` y `consiente_perfil` de cada persona, y
de `liga_partidas` el `disputa_motivo`. Y un grant de tabla cubre las columnas
FUTURAS: la `pais` recién agregada se habría publicado sola. Costó **cero
TypeScript** —`grep "from('liga_inscripciones')"` en `src/` da 0: todo va por
RPC—, que es exactamente el momento de hacerlo.

**`puede_ver_creadores()` NO ES POR LIGA.** Significa «existe fila en `creadores`
O es admin». Con dos ligas vivas, cualquier creador registrado leía el padrón
completo de la liga del otro. Las tres policies pasan a `liga_visible()`, que sí
pregunta por ESTA liga.

**UN ÍNDICE ÚNICO QUE HACÍA DESAPARECER UNA LIGA.** `ligas_una_viva_por_creador`
impedía Puente 4 mientras Puente 3 siguiera abierta, y rompía en silencio:
`getLigaDeCreador` usaba `.maybeSingle()`, que con dos filas devuelve PGRST116, y
el servicio hace `if (error) return null`. La segunda liga no daba error — hacía
**desaparecer la primera**. Hoy `getLigasDeCreador` devuelve un arreglo y el tope
es BLANDO (5, dentro de `liga_crear`): un límite con mensaje en vez de un índice
que miente.

**EL PAÍS SE COPIA, NO SE UNE.** Vive en dos sitios con dos significados:
`liga_inscripciones.pais` es dónde estoy AHORA (sigue al perfil) y
`liga_plazas.pais` es dónde estaba cuando arrancó ESA temporada. Un join vivo
contra `profiles` reescribiría el pasado: quien se mude entre temporadas
cambiaría solo el ranking por países de una temporada ya cerrada. Es el mismo
patrón con el que `nombre_visible` ya se copia dos veces. Los llena
`liga_armar_grupos`, que es el único insertador de esas dos tablas y por eso el
único sitio donde se pueden llenar sin backfill.

**`tablaDe` SALIÓ A UN MÓDULO PURO Y TIENE PRUEBA.** `src/services/ligaTabla.ts`
no importa Supabase; `ligaService` lo re-exporta para que ninguna pantalla
cambie. **`npm run liga`** fija 21 cuentas. No es opcional: esa función ya tuvo
**dos bugs silenciosos en público** —la lista de estados que cuentan era NEGRA,
así que un estado nuevo entraba solo; y un 0-0 le regalaba la victoria a la
visita porque la rama del empate no existía— y de esta tabla salen los ascensos
de tier. Los dos se ven idénticos a una tabla correcta desde afuera: números
plausibles, orden plausible, cero errores. Que estuviera pegada a `supabase` es
*la razón* de que nadie los viera, igual que el sesgo del barajado de misiones
(§3n).

**`tonoDelTier` estaba TRES veces** (servicio, `LigaSeccion`, `PanelLiga`) y las
copias se habían separado. La canónica **deriva de `TONO_POR_RAREZA`** a
propósito: así el «Raro» de la liga y el «Rare» de las cartas comparten color.
Reescribirla a mano con un mapa inventado es lo primero que hice y lo cazó
`npm run build`.

**Dos cosas de la Fase 0 que NO se hicieron, a propósito:**
- **Abrir la inscripción** (`publica=true`, `estado='inscripcion'`). El alta
  todavía tiene el embudo roto que arregla la Fase 1; abrirla hoy es exponerlo.
  `liga_visible()` ya deja a Alejo ver su liga con `publica=false`.
- **Renombrar `ligas.code`** de `puente3` a algo definitivo. Es el URL público de
  la liga y una decisión de marca, no mía.

### 4u. LIGA — Fase 1: el alta, que ES el módulo

La liga se anuncia en YouTube y se entra por un enlace, así que para mucha gente
el alta es la **primera pantalla de la app**. Medido antes de tocar nada: el
embudo desde ese enlace convertía **0 %**, y no por una causa sino por seis
muros en fila.

**EL DESTINO SE PERDÍA.** `AuthGate.tsx:74` era `navigate('/profile')` pelado:
quien llegaba del video, chocaba con el muro y creaba la cuenta, terminaba en su
perfil **sin ninguna pista de que venía a otra cosa**. Volver exige acordarse de
una URL que abrió una vez. Ahora va `?next=` con la ruta **y el query** (un
`/rulings?regla=…` se comparte así), y el hash NO viaja — ahí es donde Supabase
deja el token del correo de recuperación (§2w). `ProfilePage` lo honra con las
mismas tres guardas de `useRutaPersistente`: solo con sesión resuelta, solo
rutas internas (un `//otrositio` en el query convertiría el perfil en un
redirector abierto) y con `replace`, o el botón de atrás devuelve al muro.

**EL MURO NO NOMBRABA LA LIGA.** Decía «Acceso Restringido · Necesita una cuenta
para acceder a este módulo», en usted, en una app que habla de vos. `AuthGate`
acepta ahora un `motivo` y `/liga/:code` pasa el suyo. La promesa que trajo a
esa persona sobrevive al muro.

**EL PAÍS SE PIDE EN EL ALTA, Y LO EXIGE EL SERVIDOR.** Decisión de Nel: los
países de la liga salen de los usuarios registrados. `liga_inscribirse` rechaza
sin nombre y sin país devolviendo una clave **`falta`**, y esa clave es la mitad
del valor: un error de texto dice QUÉ pasó, `falta` le dice a la pantalla QUÉ
HACER. Sin ella, «elegí tu país» es una pared — el mensaje es correcto y no hay
forma de actuar sin salir de la liga. **`rpc()` de `ligaService` tiraba `falta`
en la rama de fallo**; ese era el cable que faltaba.

**PASOS, PERO SOLO LOS QUE FALTAN.** El diseño pedía un asistente de cuatro
pasos que se saltan solos. Medido: 42 de 42 perfiles tienen nombre y 39 de 42
tienen país, así que para casi todo el mundo ese asistente son **cero pasos**.
Por eso no hay paginado ni barra de progreso: se pinta el primer dato que falte
y nada más. Menos ceremonia para los 39, el mismo camino guiado para los 3.

**EL BOTÓN OFRECÍA LO QUE EL SERVIDOR PROHÍBE.** Decía **«Entrar sin marcar
horarios»** y `liga_inscribirse` contesta «marcá al menos 6 horas». Peor: sin
tocar la rejilla mandaba `''` y el servidor respondía «la disponibilidad llegó
mal formada», un mensaje que no le sirve a nadie. Ahora el estado inicial es
`FRANJAS_VACIAS` (168 ceros, nunca `''`), el botón se apaga y debajo dice qué
falta, de a uno. Un botón que promete un camino cerrado es peor que uno
deshabilitado: el rechazo llega DESPUÉS de haber llenado todo lo demás.

**`consiente_perfil` ERA UNA PROMESA QUE EL SERVIDOR NO CUMPLÍA.** La pantalla
muestra tus iniciales y dice, textual, «si lo dejás sin marcar, en la tabla vas
a salir como N. D.» — y `liga_inscribirse` guardaba
`nombre_visible = coalesce(v_nombre,'Jugador')` **siempre**. De las 22 funciones
de liga, la única que mencionaba esa columna era la que la escribe: **nadie la
leía**. Y `nombre_visible` es justo lo que `liga_ver` le devuelve a cualquiera
que pase `liga_visible()`. Hay MENORES y las partidas se publican en YouTube.
Ahora el servidor calcula las iniciales con la MISMA regla que la vista previa
—si no coincidieran, la previa sería otra mentira— y `liga_nombre_publico()`
deja cambiar de opinión en los dos sentidos, tocando también las plazas vivas
(el nombre se copia a la plaza al armar grupos, así que sin esa segunda
escritura el cambio no se ve donde importa).

**DOS DETECTORES DE ZONA CON FALLBACKS DISTINTOS.** El alta caía en `'UTC'` y
era la que **guardaba**; la rejilla caía en `'America/El_Salvador'` y era la que
**pintaba**. En un aparato donde `Intl` no resuelve, la misma pantalla mostraba
una zona y mandaba otra: seis horas de corrimiento sin que nadie mienta, sobre
el dato del que cuelga el calendario. Un solo helper (`zonaDelAparato`). Y el
desplegable de 21 zonas curadas que YA estaba escrito **era código muerto**: la
rejilla se montaba sin `zona` ni `onZona`, así que caía siempre en la rama de
texto plano. Verificado en el banco: 21 opciones, «El Salvador · detectada».

**EL CUPO NO SE APLICABA Y NACÍA CAPADO.** `ligas.cupo` existía y la única
función que lo mencionaba era `liga_crear`, la que lo escribe: la liga no se
llenaba nunca. Y la columna tenía **`default 10`**, así que «sin tope» era
inexpresable —un null se convertía en diez— mientras el selector de la pantalla
topaba en **16**: crear la liga de 128 que se quiere crear era imposible por dos
sitios distintos. Sin default, NULL vuelve a ser sin tope, y ese es el valor de
fábrica: ahora que el cupo se aplica de verdad, un número bajo por omisión
rechazaría gente en silencio.

**EL CARNÉ: «estás dentro» antes de que existan los grupos.** Entre inscribirse
y el sorteo pasan SEMANAS, y en ese hueco `mi_liga()` devolvía `liga: null` —el
perfil de alguien recién inscrito se veía idéntico al de alguien que nunca
entró—. Ahí se cae la retención, no en el formulario. `mi_liga()` devuelve ahora
una clave **`carne`** en esa misma rama, y el cambio es **puramente aditivo a
propósito**: `getMiLiga` corta en `!r.grupo`, así que una PWA sin actualizar
sigue viendo exactamente lo de antes (§2g). El carné trae tu puesto en la cola,
el total, y **tu zona y tus franjas** — sin un camino de lectura, la pantalla de
editar horarios arrancaría en blanco y guardar borraría la semana.

**EDITAR LOS HORARIOS: faltaba el cable, no la capacidad.**
`guardarDisponibilidad` estaba exportada y **no la llamaba ni un componente**;
la RPC del servidor estaba entera, probada y granteada. Y la rejilla se montaba
en un solo sitio —el alta— que desaparece en el instante en que te inscribís, o
sea que la disponibilidad se declaraba **una vez en la vida**. Es el dato que
más se pudre (cambia el turno, el colegio) y el carné es permanente: lleva
`temporadas_jugadas`, así que lo que alguien declara hoy alimenta la temporada 5.

**Probado contra la base en transacción revertida, 10 casos:** sin país →
`falta:'pais'`; inscribe con `nombre_visible="N."` y `pais=SV`; repetida →
`falta:'repetida'`; `mi_liga` devuelve `liga:null` **y** carné con puesto 1 de 1,
zona y 6 h; mostrar el nombre → «Nelson»; esconderlo → «N.»; cupo lleno →
`falta:'cupo'`; una hora sola → `falta:'horarios'`; sin transmisión →
`falta:'transmision'`; zona inventada → NO rechaza, guarda `zona_desconocida`.

**Banco en `/banco-alta-liga`** (solo desarrollo). La auditoría marcó esta
pantalla como NO COMPROBADA —vive detrás de una liga en `inscripcion` y la liga
está en borrador, así que **nadie la había visto nunca**—. Y el banco **nació
mintiendo**, igual que el de `/banco-mesa-fila` (§4r): sin sesión
`currentProfile` es null, `InscripcionLiga` cae correctamente en el paso
«nombre» y los tres casos enseñaban la MISMA pantalla — medido, tres botones
«Seguir» y ningún «Entrar a la liga». Se siembra un perfil completo en el store
y se repone al desmontar.

**Y una medición que mintió, la tercera vez con la misma forma (§4p).** Leer el
botón 120 ms después de un `.click()` sobre la casilla dio `disabled: false`
mientras el aviso de al lado ya decía «marcá al menos 6 horas» — dos lecturas
del mismo DOM contradiciéndose. En limpio: `disabled: true` con 0 horas,
habilitado con 42. **Cuando dos mediciones del mismo instante se contradicen, la
que está mal es la medición, no el código.**

**Lo que la Fase 1 NO arregla, y hay que decirlo:** `repartir()` sigue armando
los grupos por tier y orden de inscripción, **sin mirar el horario**. Por eso el
texto del alta cambió: decía «los grupos se arman juntando a quienes coinciden
en horario, así que esto decide contra quién te toca» —que hoy es falso— y ahora
dice lo que el sistema hace de verdad. Prometer lo que no se cumple es la clase
de mentira que se descubre en la jornada 1.

### 4v. LIGA — Fase 2: el reloj, y por qué sellar sin avisar no vale

`liga_vencidas()` estaba escrita desde el primer día —sella por silencio lo
reportado que nadie confirmó y manda a la cola del árbitro lo que nadie jugó— y
**no la llamaba nadie**: cero archivos de liga en `api/`, cero entradas de liga
entre los seis crons de `vercel.json`. El `plazoTexto()` que la pantalla ya
pintaba era **un reloj sin maquinaria**.

Esta fase tenía una fecha límite que no la pone nadie: la primera partida
reportada, más cinco días. Ese día, o el reloj existe, o el silencio no confirma
nada y la primera disputa se atora sin salida.

**SELLAR POR SILENCIO SOLO ES JUSTO SI SE AVISÓ.** «No confirmar no puede ser
mejor negocio que perder» es correcto, y sin aviso previo el silencio deja de
ser una decisión y pasa a ser un descuido que el sistema cobra. Por eso el reloj
son DOS funciones: `liga_avisos()` (nueva) para lo de antes del plazo, y
`liga_vencidas()` para el plazo.

**Tres avisos, y el orden entre ellos es exclusivo:**

| tipo | cuándo | a quién |
|---|---|---|
| `confirmar` | reportada, con plazo de sobra | al que NO reportó |
| `ultima` | reportada y el plazo encima | al que NO reportó |
| `jugar` | programada y la jornada se acaba | **a los dos** |

`confirmar` exige `vence_el > hoy + días`, y eso hace que las dos primeras sean
**excluyentes**. Sin esa condición, una partida reportada con el cron caído
—o reportada ya sobre la fecha— disparaba las dos en la misma corrida: dos
avisos seguidos que dicen casi lo mismo, y el segundo le quita urgencia al
primero en vez de dársela.

**EL SELLO VA DENTRO DEL `where` DEL `update`.** Es la cicatriz del §4d: allá el
cron de transmisiones sellaba con `.is(sello, null)` y seguía derecho al envío
**sin mirar si el UPDATE había tocado alguna fila**, así que con dos corridas
simultáneas la perdedora mandaba el push igual. Acá el sello y la selección son
la MISMA sentencia y lo que devuelve el `returning` es, por construcción, lo que
esta corrida ganó: dos corridas reparten en vez de duplicar. Verificado — la
segunda llamada seguida devuelve **0 filas**.

Y la «última llamada» sella `aviso_en` con `coalesce` además del suyo: dejarlo
en null diría que no se avisó, y sí se avisó — con esa.

**El orden del cron es uno solo: avisos, después vencidas.** Al revés, una
partida podría quedar sellada por silencio en la misma corrida en que se le pide
a alguien que la confirme — un aviso para algo que ya no se puede hacer. Las tres
ramas de `liga_avisos` exigen además `vence_el >= hoy`, así que las dos guardas
apuntan al mismo sitio desde los dos lados.

**UN aviso por persona y por corrida.** Alguien con tres partidas abiertas
recibiría tres notificaciones seguidas, y tres seguidas de la misma app se leen
como ruido. Se manda una —la más urgente— y el resto se cuenta («y 2 más»). El
orden de urgencia no es de gusto: `silencio` (ya pasó y no lo podés deshacer) >
`ultima` (te quedan horas) > `confirmar` (te quedan días) > `jugar`.

**Y EL PUSH NO PUEDE SER EL ÚNICO CANAL.** Medido para `/envivo` (§4d): **13 de
39 cuentas** tienen push activado. Un aviso que solo viaja por push llega a un
tercio de la comunidad. La franja roja de `/liga/:code` es el otro canal —el que
cubre a los dos tercios restantes— y lee el MISMO hecho que el cron, así que si
el cron no corrió la app tampoco anuncia nada.

**`misPartidasAbiertas` reemplaza a «la próxima».** Era UNA tarjeta, y con grupos
de 8 son **siete partidas por persona**: quien tenía dos sin jugar y una
esperando su confirmación resolvía esa y las otras dos seguían invisibles con el
plazo corriendo. Vive en `ligaTabla.ts` —el módulo puro, sin `supabase`— por la
misma razón que `tablaDe` (§3n), y es **genérica en el grupo**: no le importa
qué más lleva un grupo, solo sus plazas y sus partidas, así que no hay que
arrastrar media capa de servicios al módulo puro. `miProximaPartida` **delega**
en ella: con dos copias de la regla de urgencia, la tarjeta de arriba y la lista
de abajo terminan discrepando sobre cuál partida es la importante.

`npm run liga` pasó de 21 a **31 cuentas**; las 10 nuevas fijan el orden, que es
lo único que hace útil a esta lista y lo que se rompe sin hacer ruido — una lista
mal ordenada sigue teniendo todas las filas.

**Probado contra la base con una liga sembrada en transacción revertida** (6
jugadores reales + 1 invitado sin cuenta, 6 partidas): `confirmar` al que no
reportó, `ultima` sin duplicar el `confirmar`, `jugar` a los DOS, segunda corrida
en 0 filas, `liga_vencidas` sellando la vencida, la de 9 días intacta, y **cero
avisos para el invitado sin cuenta** (la marca se pone igual: no hay a quién
avisarle, no es que falte hacerlo).

Tres cosas del esquema que costó descubrir sembrando: `liga_temporadas.estado`
no acepta `'activa'` (es `inscripcion`/`en_curso`/`cerrada`), `liga_grupos.tamano`
tiene piso, y hay un único **por PAR y por grupo** (`liga_un_encuentro_por_par`)
— round-robin: cada pareja juega una vez, así que una prueba con seis partidas
necesita seis parejas distintas, no dos jugadores repetidos.

**El cron corre `41 13 * * *`** = 7:41 de la mañana en El Salvador, separado de
los otros cinco a propósito: cinco lambdas arrancando en el mismo minuto compiten
por el mismo pool de conexiones.

**Y `npm run build` NO comprueba los tipos de `api/`** (§3i). Se verifican a mano
con el `tsc --noEmit` largo que está documentado ahí.

### 4w. LIGA — Fase 3: el lobby de la maqueta

La maqueta que mandó Nel: cabecera con logo sobre la portada, píldora de estado,
cinco cifras con ícono, cuenta atrás grande, VS con banderas, acciones rápidas,
Top 8 con medallas y una tira de anuncios. Con la TabBar de la app abajo, no la
de la maqueta.

**EL AZUL ENTRA COMO VARIABLE DE MÓDULO, NUNCA COMO TOKEN GLOBAL.** La app es
roja (`#DC2626` sobre `#181825`) y `hudTones.ts` tiene seis tonos, ninguno azul:
un séptimo global le cambia la cara a toda la app por una sola pantalla. Va en
`[data-modulo="liga"]`, y fuera de ese contenedor esas variables no existen.

**El contraste se mide y se anota, igual que el rojo.** El `#2563EB` de la
maqueta da **3,4:1** sobre `#181825` y no llega al 4,5 de WCAG; se sube al azul
500 `#3B82F6`, que da **5,1:1**. La maqueta manda en el MATIZ; quien decide la
luminancia es el fondo real de esta app. Y el acento de una liga nunca va a ser
un `<input type="color">`: cuando llegue la segunda, la elección es entre tonos
cerrados y medidos — un hex libre deja pasar azul marino sobre azul marino, que
es la cicatriz del acento de la credencial (§3x).

**CINCO CIFRAS EN FILA: LA REPARTICIÓN EN CINCO COLUMNAS IGUALES NO FUNCIONA, Y
ESTÁ MEDIDO.** A 375 px la fila mide 337, cada tarjeta 56 y quedan **46 px
útiles** — «Premier» necesita 59 y «120/120» necesita 58 a 13 px. Para que
entraran habría que bajar la letra a ~10 px, por debajo del piso de 11 que este
proyecto se fijó midiendo el ranking (§3f). La tarjeta declara entonces un ancho
**mínimo de 74 px** y crece si sobra: en un teléfono de 393 px las cinco entran,
en uno de 375 la fila se corre unos píxeles. **Correrse es honesto —se ve que hay
más—; truncar «Premier» a «Pre…» no: una cifra que no se puede leer no es una
cifra.** Verificado en el banco: los cinco valores y los cinco rótulos, enteros.

**«Ronda 4 de 8» sale de MI grupo, no de una ronda global.** Cada grupo lleva su
propio reloj (`liga_grupos.arranca/cierra`), así que una ronda global de 16
grupos no existe como concepto y no se puede inventar sin cambiar el motor. La
jornada actual es la más baja de mis partidas sin cerrar; el total, la más alta
que tengo.

**El «Top 8» dice DE QUÉ GRUPO es.** Un ranking cruzado entre grupos que nunca
se enfrentaron es ruido con cara de dato: el campeón de Legendario 1 con 15
puntos quedaría debajo de un Común 3 con 18 sin haberse cruzado jamás. Con un
solo grupo son exactamente lo mismo y el rótulo no molesta a nadie.

**Y LAS MEDALLAS SOLO SALEN SI ALGUIEN YA JUGÓ.** El día 1 la tabla está toda en
cero y el orden lo decide el desempate final —el abecedario—: un podio de oro
sobre ceros corona a quien tiene la A. Verificado en el banco con las dos
tablas, la jugada y la del día 1. Los tres colores son distinguibles de verdad
(medidos contra el fondo: 9,9 · 10,1 · 5,2 de contraste).

**Las banderas van PEGADAS al nombre, no en columna propia.** 3 de 42 perfiles no
tienen país, y una columna con huecos se lee como una tabla rota. `Bandera`
devuelve `null` sin país o con un código que no existe — un emoji genérico
afirmaría una nacionalidad que nadie declaró.

**`liga_anuncios`: Alejo no podía publicar NADA.** La policy `news_insert` exige
`role='admin'` y `news` no tiene columna de alcance, así que un aviso suyo habría
salido en el Inicio de toda la comunidad salvadoreña; y `tournament_broadcasts`
tampoco servía (su INSERT es `auth.uid() is not null`, o sea el megáfono de la
app para cualquier cuenta con sesión). Seis columnas y ninguna de más: sin
`temporada_id`, sin fijado, sin borradores, sin segmentación. `autor_id` **no
tiene grant** para `authenticated`: quién escribió el aviso es del servidor.
Y si no hay avisos y no sos staff, **el bloque no se dibuja** — uno vacío que
siempre termina en nada es un hueco en cada visita (§3h-quinquies).

**El bloque «Cómo funciona» es lo único a lo que la primera queja de la jornada
3 va a poder apuntar**, y hasta hoy estas reglas no estaban escritas en ningún
lado de la app: vivían en el código. Los números salen de la liga —«grupos de N,
jugás N−1 partidas»— porque con grupos de 6 un «jugás 7 partidas» sería una
mentira impresa.

**No se creó el `ProveedorLiga` que el documento proponía.** Su propósito era que
nada quedara cableado a PUENTE 3, y las props consiguen exactamente eso con un
consumidor por dato. Un contexto para un solo consumidor es la indirección que
el propio documento desaconseja dos líneas antes. El día que tres pantallas
pidan el color de la liga, ese día se agrega.

Banco en **`/banco-lobby-liga`** (solo desarrollo): la cabecera con las cinco
cifras, los tres estados de la cuenta atrás, las acciones, las banderas (con
país, sin país y con un código inventado), el Top 8 en sus dos estados, los
anuncios en sus tres, y el reglamento. Lo que NO se pudo ver es el lobby
ENSAMBLADO con datos reales: la liga sigue en `borrador` y no hay sesión en el
navegador de pruebas, así que el orden de los bloques está verificado leyendo,
no mirando.

### 4x. LIGA — el panel en teléfono, y `liga_configurar`

Cierra la Fase 3. `PanelLiga` nació como **escritorio metido en una app de
teléfono**: 1.131 líneas con **UN solo breakpoint**, la tabla de inscritos en
`min-w-[420px]` con scroll lateral y el mapa de calor en otro `min-w-[300px]`.
Y es la pantalla desde la que se arman los grupos de 128 personas.

**Las dos vistas CONVIVEN, no se reemplazan.** La tabla ordenable y la rejilla
de 168 casillas siguen siendo la forma correcta en una compu; lo que faltaba era
la forma correcta en una mano. `sm:hidden` / `hidden sm:block`.

**La ficha muestra lo que decide un grupo**: bandera, tier, líder, zona, horas
declaradas y **cuándo** puede. El cero de horas va en rojo con triángulo — es el
dato que decide si esa persona puede entrar a un grupo, y se ve de lejos o no se
ve.

**LOS HORARIOS VAN EN TRAMOS, NO HORA POR HORA.** Enumerarlos es lo que sale del
formato de 168 casillas y es ilegible: quien declara «los martes de 8 a 11 de la
noche» aparecía como **«Mar 20:00 · Mar 21:00 · Mar 22:00 +9»** — tres fichas
que dicen casi lo mismo y un «+9» que esconde toda su semana. `tramosDe` los
agrupa: **«Mar 20–23 · Jue 20–23 · Sáb 14–20»**. Dice lo mismo en un tercio del
espacio y además dice CUÁNTO dura, que es la mitad del dato. **Los tramos no
cruzan la medianoche a propósito**: «Dom 23–24» y «Lun 00–02» son dos ratos
distintos para quien tiene que ponerse de acuerdo, aunque en el arreglo de 168
sean consecutivos.

Y se llaman «sus franjas», no «sus mejores franjas»: sin cruzarlas contra las de
otro, todas valen lo mismo — «mejores» insinuaría un cálculo que ahí no se hizo.

**El mapa por día**: siete filas, la barra de 24 horas y el PICO de ese día.
El número es el máximo, **no la suma**: sumar las 24 horas daría un número
enorme y sin sentido, porque la misma persona cuenta en todas las horas que
declaró.

**`liga_configurar`: abrir la inscripción deja de ser un `UPDATE` a mano.** Es
la forma del §4s otra vez — la escala de sobres existió meses sin un escritor en
la app y por eso el 4.º de una final se quedó sin premio. Cambiar el nombre, el
cupo, el formato o **abrir la inscripción** eran hasta hoy un `update` suelto en
el SQL Editor.

Tres reglas de esa RPC:
- **Solo se manda lo que se tocó.** Todo lo que llega `null` queda como estaba.
  No es comodidad: mandando siempre los siete campos, dos personas editando
  cosas distintas se pisan y la segunda revierte a la primera sin un error.
- **El tamaño de grupo se congela con grupos armados.** El calendario se sembró
  con ese número; cambiarlo dejaría round-robins de largos distintos dentro de
  la misma temporada.
- **Abrir la inscripción va aparte, con el efecto escrito.** Es el único control
  del panel que cambia lo que ve gente de afuera, así que no puede tocarse sin
  querer mientras se corrige un nombre.

`liga_panel` pasó a devolver `pais` — se reescribió desde su propia `prosrc` con
un reemplazo que **se planta si no casa**, en vez de re-tipear 60 líneas de
`jsonb_build_object` y arriesgar una diferencia silenciosa.

Banco: **`/banco-lobby-liga`** lleva también las fichas del panel (con país, sin
país, sin horas y retirada) y el mapa por día.

### 4y. LIGA — dos vocabularios de estado, y un desfase congelado

Dos defectos del panel que no fallan, no avisan y **se leen como datos**.

**`liga_inscripciones.estado` ES MASCULINO Y `liga_plazas.estado` ES FEMENINO.**

| tabla | valores | pregunta |
|---|---|---|
| `liga_inscripciones` | activo · pausa · retirado · vetado | ¿sigue en la LIGA? |
| `liga_plazas` | activa · abandonada · anulada | ¿sigue en ESTE GRUPO? |

El panel comparaba el carné contra el vocabulario de la plaza —
`i.estado !== 'activa'`— y eso es **siempre cierto** para un carné, porque el
valor real es `'activo'`. Resultado: **todos** los inscritos se pintaban
apagados y con su estado a la vista, incluidos los que están perfectamente
activos. Con 128 personas, el panel se lee como una liga entera en problemas.

Son dos tablas y dos preguntas distintas; que las respuestas se parezcan tanto
es justo lo que hace que se mezclen. La comparación vive ahora en
`carneActivo()`, una sola vez, y no suelta en cada fila.

**Y EL BANCO TENÍA LA MISMA MENTIRA EN SUS DATOS.** El fixture usaba
`estado: 'activa'` — un valor que la base **no acepta**— así que habría dado
verde con el bug puesto. Es el §4r otra vez: un banco que miente sobre lo que
prueba es peor que no tenerlo.

**EL DESFASE DE UNA ZONA NO ES PROPIEDAD DE LA ZONA: ES DE LA ZONA EN UNA
FECHA.** `desfaseUTC` cacheaba por zona a secas y calculaba contra `AHORA`, un
`new Date()` capturado **al cargar el módulo** — con un comentario que afirmaba
que «el instante da igual». Es falso: `Europe/Madrid` es +1 en enero y +2 en
julio. Con el módulo cargado en septiembre y la temporada corriendo hasta
noviembre —Madrid cambia la hora el 26 de octubre— el mapa de calor quedaba
corrido una hora para toda la gente de España **durante media temporada, sin un
solo error**. Y una PWA instalada no recarga el módulo por su cuenta.

La clave de caché lleva ahora el día, así que se corrige sola a la medianoche.

**Lo que eso NO arregla, y queda dicho:** los husos de **media hora**. Kolkata
está en +5:30 y la rejilla es de horas enteras, así que el redondeo mueve a esa
persona a la hora más cercana — 30 minutos de error, que es lo menos malo sin
partir la rejilla en 336 casillas.

La forma de los dos es la misma y vale para todo el repo: **un valor plausible
en la pantalla equivocada no se distingue de un valor correcto.** Un inscrito
apagado parece un inscrito inactivo; un mapa corrido una hora parece un mapa.

### 4z. LIGA — cerrar la temporada, y el conteo del lobby

**LA LIGA ERA UN VIAJE DE IDA.** `liga_cerrar` existe desde el primer día pero
cierra **la LIGA entera** (`ligas.estado='cerrada'`), no la temporada. Y el
índice `liga_una_temporada_viva` es único por liga sobre `estado <> 'cerrada'`:
sin nadie que escribiera `liga_temporadas.estado='cerrada'`, **la Temporada 2
era imposible desde la app**. Verificado: cerrar la T1 y abrir la T2 ahora
funciona.

**`liga_cerrar_temporada` VALIDA, NO RECALCULA.** El cliente calcula la
clasificación con `tablaDe` —la única implementación, con prueba golden— y
manda `[{plazaId, puesto}]`; el servidor comprueba que estén TODAS las plazas
de la temporada, ninguna repetida y ninguna ajena, y aplica. Portar `tablaDe` a
SQL serían **dos verdades de la misma tabla**, y la que reparte los ascensos no
sería la que la gente vio. Es el mismo reparto de trabajo que `liga_armar_grupos`
(§3k).

**La escalera:** sube el 1.º de cada grupo, baja el último, y **quien abandonó
baja igual y suma un abandono** — dejar de jugar no puede salir mejor que jugar
y perder. Topada arriba y abajo: el último de un grupo que ya estaba en común se
queda en común.

**Y EL RESUMEN CUENTA LO QUE SE MOVIÓ, NO LO QUE SE INTENTÓ MOVER.** La primera
versión decía «bajan 2» cuando solo uno había cambiado de tier, porque contaba
las intenciones y no los movimientos. La segunda tenía un fallo peor y más
silencioso: el conteo leía `i.tier` **después** del `update`, o sea el tier
NUEVO. Ahora el movimiento se calcula una vez, en `_mov`, **antes** de tocar
nada, y de ahí salen el update y el resumen. Un número que el organizador lee y
cree no puede depender del orden de dos sentencias.

`drop table if exists` antes de cada temporal: dos cierres dentro de una misma
transacción —una prueba, o un llamador futuro— chocarían con «la tabla ya
existe», y ese error no tiene nada que ver con el cierre.

**`liga_temporadas.inscripcion_cierra`: cuándo cierra la ENTRADA.** La tabla
tenía `arranca` y `cierra` —el principio y el final del JUEGO— y nada para el
plazo de entrada. Sin esa fecha, quien llega del video el día 1 ve un lobby sin
ninguna cuenta atrás. Un CHECK impide que sea posterior a `arranca`: anunciar
que todavía se puede entrar cuando la liga ya empezó es prometer una plaza que
el sorteo ya repartió.

**La cuenta atrás tiene TRES estados y el orden no es cosmético** — se muestra el
plazo que de verdad obliga a hacer algo hoy:

1. **tu partida abierta** → su fecha límite (podés perder por no ir);
2. **la inscripción** → cuándo cierra (podés quedarte afuera);
3. **el arranque** → cuándo empieza (nada que hacer, pero es la pregunta que
   trae a alguien desde un video).

Sin el tercero, el día 1 la pantalla no tiene ninguna fecha.

**El arte del banner va DETRÁS y a la derecha**, con una máscara de degradado
comiéndoselo hacia el texto y al 45 % de opacidad. Una imagen a todo trapo bajo
una cuenta atrás es lo que el sistema de la credencial prohíbe (§3f): la cifra
es el dato y el arte no puede disputarle el contraste. Si el archivo
(`/liga/banner-liga.webp`) no está, **no se dibuja nada** y el banner queda
igual de legible.

**País es COLUMNA propia en el Top 8**, como la maqueta, y queda **vacía** sin
país: una bandera genérica afirmaría una nacionalidad que nadie declaró.

### 5a. LIGA — la puerta del cierre, y la portada con su piso

**LA FUNCIÓN DE CERRAR TEMPORADA NACIÓ SIN PUERTA — Y LA ESCRIBÍ YO ESE MISMO
DÍA.** `liga_cerrar_temporada` quedó probada contra la base y con **cero
llamadores en `src/`**: exactamente el patrón que este archivo documenta cuatro
veces (§3l, §4s, §3h-ter). Vale anotarlo justamente porque no es un descuido
ajeno: pasa cuando el trabajo del servidor se siente terminado.

**El ensayo es obligatorio y lo calcula el SERVIDOR.** Cerrar mueve el tier de
cada persona y no se deshace. La RPC toma `p_ensayo`: devuelve quién sube, quién
baja y cuántas partidas se sellan **sin escribir nada**, por el MISMO camino que
el cierre real. Un ensayo que use otro código enseña una maqueta del resultado,
no el resultado. Verificado: tras el ensayo, 0 carnés tocados y la temporada
sigue abierta.

**§3s, aplicado a tiempo:** agregar `p_ensayo` con default habría creado una
SEGUNDA función y una PWA sin actualizar caería en la vieja. Se soltó la firma
anterior con `drop function` en la misma migración, y la prueba comprueba que
quede **una sola sobrecarga viva**.

**El detalle lista SOLO a quien cambia de escalón.** Con 120 personas, poner a
todas con «se queda» al lado esconde a las 8 que importan.

**La clasificación la calcula `tablaDe` en el cliente** —la misma función que
pinta la tabla pública toda la temporada— y el servidor la valida. Así, lo que
reparte los ascensos es literalmente lo que la gente estuvo mirando.

**LA PORTADA TIENE UN PISO DE 2 SEGUNDOS.** La consulta tarda medio segundo, así
que el afiche era un parpadeo: se veía que algo pasó, no QUÉ. `MINIMO_MS` es un
piso, no un tope — si la consulta tarda más, se sigue esperando. Y arranca en
`false` SIEMPRE: si dependiera de si hay datos en caché, quien vuelve a entrar no
vería el afiche nunca y la portada existiría solo para la primera visita.

**Y LA BARRA NO MIENTE.** No dice «cuánto falta de la consulta» —eso no se sabe—
sino **cuánto falta de los 2 segundos**, que es un plazo real y nuestro. Si el
servidor tarda más, llega al final y espera ahí. Va con `transform: scaleX`, no
`width`, y con movimiento reducido llega de una vez en vez de recorrer la
pantalla: es información, no adorno (§3u).

**Y AL VERIFICARLA, EL MÉTODO MINTIÓ POR TERCERA VEZ EN EL DÍA.** La barra leía
`scaleX(0)` a los 900 ms y parecía muerta. Era el §4c: el navegador de pruebas
reporta `document.hidden === true` y el reloj de las animaciones no avanza hasta
que algo fuerza un cuadro. Midiendo con DOS lecturas separadas: `currentTime`
0 → 1000 ms y `scaleX(0.49998)` justo a la mitad. Las otras dos del mismo día
fueron leer el DOM en el mismo tick de un `.click()` y una aserción propia mal
escrita que abortó antes de escribir el archivo. **Antes de creerle a una
medición que dice que el código está roto, hay que comprobar que la medición
midió.**

### 5b. LIGA — el emblema, y por qué NO se aplana

`public/liga/emblema.webp`, de `simbolo.png` (1254×1254, 2 MB). Convertido a
256 px: **1992 KB → 27 KB, 73× más liviano**, y se pinta a 36.

**LA TRANSPARENCIA SE MIDIÓ ANTES DE DECIDIR, Y ACÁ SÍ HACÍA FALTA.** El banner
venía en RGBA con **0 píxeles no opacos** —el canal era decorativo y tirarlo no
costó nada—; el emblema tiene **1.572.202 de 1.572.516 con alfa**. Aplanarlo
—a JPEG, o a WebP sin alfa— lo compondría contra negro y el logo saldría dentro
de un cuadrado (§4m). Va con `exact=True` para que la conversión no toque los
píxeles totalmente transparentes.

**Una marca no se recorta:** `object-contain` y alto fijo. Recortada deja de
identificar, que es lo único que un logo tiene que hacer.

**`alt=""` y `aria-hidden`**, y no el nombre de la liga: el nombre está escrito
al lado en el `<h1>`. Un `alt` con el mismo texto se lo lee dos veces a quien
usa lector de pantalla.

**EL TÍTULO ENVUELVE, NO TRUNCA.** Con el emblema, la píldora de estado y el
botón del panel en la misma fila quedan ~150 px, y «Liga Internacional PUENTE»
salía **«Liga Internacion…»**. El nombre de la liga es lo último que se puede
cortar: es lo que le dice a alguien que llegó al sitio correcto. Dos renglones
a 15 px entran.

Y en la línea de abajo **la temporada va primero**: es la que se corta, y lo que
tiene que sobrevivir es en cuál temporada estás, no el descriptor.

Tercera vez en el día que la respuesta es la misma —cifras, atajos, título— y
conviene tenerla escrita como regla: **cuando algo no entra, primero se acorta
el texto redundante, después se deja envolver, y solo al final se trunca. Un
rótulo que no se puede leer no es un rótulo.**

### 5c. LIGA — ser admin de la app no es ser staff de la liga de otro

**`liga_es_staff` tenía una rama de admin sin acotar por liga**, y gatea **doce
funciones**: el panel, el padrón, las 168 franjas de cada persona, los avisos,
la configuración y el cierre de temporada. Es decir que los cuatro admins
globales eran staff de TODAS las ligas — podían leer `user_id`, `abandonos`,
`disputa_motivo` y el horario semanal de gente que incluye MENORES, en una liga
que no es suya.

Con una liga no se nota. Con la segunda, un creador lee y opera la del otro. Es
la mitad que faltaba del agujero que la Fase 0 tapó del lado de los creadores
(`puede_ver_creadores()` tampoco era por liga).

El repo ya tomó esta decisión dos veces —`centro_curadores` (§3i-bis) y
`sable_probadores` (§4c)—: **«ser admin NO alcanza»**, y a propósito sin
escotilla, porque un admin que puede darse el acceso vuelve la restricción
decorativa. Se reparte insertando la fila en `liga_staff` desde el SQL Editor.

**EL ORDEN DE LA MIGRACIÓN NO ES UN DETALLE: PRIMERO LA FILA, DESPUÉS EL
REVOKE.** Medido antes de tocar nada: el creador de PUENTE es **Alejo**, y
Nelson **no** era creador ni estaba en `liga_staff` — su acceso al panel venía
ENTERO de la rama de admin. Quitarla primero lo habría dejado afuera de la liga
que está construyendo. Verificado después: Alejo `true`, Nelson `true`, **otro
admin global `false`**, un tercero `false`.

**EL MAPA DE CALOR Y EL ENSAYO DE GRUPOS HABLABAN DE GENTE DISTINTA.**
`liga_panel` devuelve a todos los inscritos —activos, en pausa, retirados y
vetados— y `liga_plan_grupos` reparte **solo** a los `activo`. Así el mapa decía
«los martes pueden 18» contando a tres que ya se retiraron, y el reparto de
abajo armaba con 15. Dos números correctos que juntos mienten. Ahora los
contadores y el mapa describen la MISMA población que se va a agrupar, el rótulo
dice «Activos», y **quien queda fuera se dice**: si el número bajara de 34 a 31
sin explicación, el organizador buscaría un bug que no existe.

**EL NÚMERO DEL MAPA VIVÍA SOLO EN UN `title`** — o sea en un hover, que en un
teléfono no existe. Y la intensidad es **relativa al máximo**: 1 de 1 persona se
pinta igual de oscuro que 20 de 20, así que sin una cifra a la vista el mapa se
puede leer al revés. Ahora cada día lleva su pico escrito, en las dos vistas.

### 5d. LIGA — el botón de Inicio, y `liga_para_inicio()`

Alejo ya tenía **acceso** a su liga —es el `creador_id`, así que `liga_visible()`
y `liga_es_staff()` le dan `true`— y no tenía **por dónde**: había que teclear
el URL. Es el §3l otra vez, y esta vez le tocaba al creador de la liga, que es
quien más la abre.

**Va debajo de La Galaxia, en su propio botón, y NO en la cuadrícula de
módulos.** Ahí es una casilla de 60 px entre veinte, y una liga con fecha límite
no es un módulo más: va donde está la acción principal.

**`liga_para_inicio()` en vez de un `puente3` cableado.** El día que exista
Puente 4 —o la liga de otro creador— un code escrito a mano manda a todo el
mundo a la liga equivocada. La pregunta es «cuál es MI liga» y la contesta el
servidor, con un orden que no es arbitrario: primero donde TENGO algo que hacer
(staff o inscrito), y solo si no, una pública. Devuelve **seis campos**, no la
liga entera: `liga_ver` trae grupos, plazas y partidas, y eso en la pantalla que
más se abre serían cientos de filas para pintar un botón.

Verificado: Alejo `puente3`, Nelson `puente3`, alguien de afuera **nada** — y
entonces el botón no se dibuja. Ni un esqueleto: un hueco que casi siempre
termina en nada es un parpadeo en cada apertura de Inicio (§3h-quinquies).

**La segunda línea dice el PLAZO, no el estado.** «En curso» no le pide nada a
nadie; lo que hace entrar es «cierra en 21 días». Cuando no hay plazo se cae al
estado, que es lo único cierto que queda.

**Y LOS DOS NÚMEROS NO COINCIDÍAN.** El botón redondeaba hacia arriba —«cierra
en 22 días»— y la cuenta atrás del lobby hacia abajo —«21 días 10 h»—. Dos
números para la misma fecha, los dos defendibles, y quien ve los dos concluye
que uno está mal, que es peor que si uno lo estuviera. La cuenta vive ahora en
`restanHasta` (`componentes/tiempo.ts`) y la usan los dos. Verificado en
pantalla: 21 y 21.

**El olvido al cambiar de cuenta va en el RENDER, no en un efecto.** Un
`setState` síncrono dentro de un `useEffect` encadena un render de más y el
linter lo marca como error; el patrón correcto —el mismo del contador de vida de
las mesas— es comparar contra el id anterior durante el render. Sin eso, cerrar
sesión dejaba en pantalla el botón de la liga de la cuenta anterior.

### 5e. LIGA — los seis que bloqueaban, y una verificación mía que era falsa

Una auditoría adversarial de los diez commits del día (7 lentes, 2 escépticos por
hallazgo) encontró seis cosas que bloqueaban. **Cinco eran de la capa de arriba:
el servidor hacía bien su trabajo y el cliente no lo leía.** Y tres las había
metido yo ese mismo día.

**UNA VERIFICACIÓN MÍA ERA FALSA, Y LA TRAMPA ESTÁ ESCRITA EN ESTE ARCHIVO.**
Parcheé `liga_ver` para que mandara `inscripcionCierra`, lo comprobé y dio
`2026-09-27`. Nunca llegó a producción: **puse el parche y la comprobación en la
MISMA llamada MCP**, y esa comprobación terminaba en `raise exception` — que
revirtió el parche junto con ella. Es el §3s al pie de la letra: *cada llamada
del MCP es UNA transacción*. **La migración va en una llamada y la verificación
en OTRA**, o se está comprobando algo que no va a existir.

**`liga_visible()` NO RECIBÍA LIGA.** La Fase 0 tituló su sección «un creador no
lee el padrón de las ligas ajenas» y reemplazó una función global
(`puede_ver_creadores()`) por **otra función global**. Una expresión booleana que
no mira la fila no puede discriminar filas: las 8 policies eran
`using (liga_visible())` a secas, así que el día que se tocara «Abrir la
inscripción», `exists (... where l.publica)` se volvía true **para todas las
ligas** y cualquier cuenta se llevaba el padrón de cualquiera —incluido `estado`,
que admite `'vetado'`—. Ahora es `liga_visible(p_liga)` y las 8 policies pasan la
liga de su fila. La global se dropeó: dejarla viva es la puerta de atrás para el
próximo que escriba una policy sin pensar.

**HABÍA DOS BOTONES DE «ABRIR» Y CADA UNO HACÍA LA MITAD.**
`liga_abrir_inscripcion` (la casa del creador) escribía `estado` y **no
`publica`**, y `liga_visible` mira `publica`: Alejo tocaba abrir, la liga quedaba
abierta **para él y cerrada para todo el mundo**, sin un solo error. Ahora esa RPC
escribe los dos campos.

**Y «CERRAR LA INSCRIPCIÓN» MANDABA LA LIGA A `borrador`.** Mío, del panel.
Cerrar la inscripción es pasar a JUGAR, no volver al cajón: con
`borrador + publica=false` la liga desaparecía para todo el que no estuviera
inscrito, justo cuando se anuncian los grupos. Va a `'activa'`, y con la liga en
juego el panel **ya no ofrece reabrir** — antes `abierta` tenía dos ramas y en
`'activa'` invitaba a reabrir a un toque y sin confirmación.

**`'sin_jugar'` EXISTÍA EN LA BASE Y NO EN EL TIPO DEL CLIENTE.** La Fase 0 lo
agregó al CHECK porque `liga_cerrar` lo ESCRIBE; `EstadoPartida` no se enteró.
`rotuloDe` termina en `ROTULO[m.estado]` → `undefined`, y la línea siguiente lee
`.clase`: **TypeError y pantalla en blanco para toda la liga**. El `as` de
`verLiga` es lo que impide que TypeScript lo cace — el servidor puede mandar lo
que quiera y el tipo es una promesa, no una comprobación.

**EL ENSAYO DEL CIERRE VENÍA ENVUELTO.** `rpc()` devuelve `{ok, extra}` y yo
guardé `r` en vez de `r.extra`: `ensayo.detalle` era `undefined` y la pantalla
reventaba al leer `.length`. O sea que cerrar la temporada quedaba inalcanzable
—justo lo que ese botón vino a resolver— y el resto del repo ya lo leía bien.

**EL REPARTO EN GRUPOS SE TRABABA CON 10 U 11 PERSONAS.** `repartir()` cortaba de
`tamano` en `tamano` y solo fusionaba el sobrante si quedaba en **menos de 2**:
con grupos de 8, n=10 daba `[8,2]` y n=11 daba `[8,3]`, y el servidor exige 4 a
12. Falla en **9 de las 39 poblaciones posibles**, y con 42 cuentas la franja de
10-11 no es la cola. Peor: `liga_armar_grupos` valida y **devuelve**, no lanza —
no hay rollback, así que el primer grupo queda escrito, el reintento choca contra
el único de `(temporada, tier, orden)` y **no existe `liga_borrar_grupo`**: se
destraba desde el SQL Editor.

`tamanosDeGrupo` vive ahora en el módulo puro y elige el NÚMERO de grupos, no el
corte: `tamano` pasa de ser un tope a ser un objetivo. Con 10 y objetivo 8, un
grupo de 10 es mejor liga que uno de 8 y uno de 2 — y es la única legal.
`npm run liga` barre **de 4 a 200 personas × objetivos de 4 a 12**: todo grupo cae
entre 4 y 12 y nunca hay más de 1 de diferencia entre el mayor y el menor. Y el
botón se apaga ANTES, diciendo cuánta gente no entra.

**Tres más, de la misma familia:**
- El banner decía **«ARRANCA LA LIGA — el plazo ya venció»** en rojo toda la
  temporada: la condición era `estado !== 'cerrada'` y una temporada pasa meses
  en `'en_curso'` con su arranque ya atrás. Un plazo vencido que no exige nada
  enseña a ignorar los que sí exigen.
- **3,3 MB de PNG que no usa nadie viajaban en el precache de todos**, y
  `globPatterns` tenía `png` pero **no `webp`** — o sea que entraba lo que sobra
  y no entraba lo que la liga sí usa. Los originales salieron del repo y al
  `.gitignore`; `webp` entró al glob.
- **Quitar el cupo era inexpresable**: `coalesce(p_cupo, cupo)` hace que `null`
  signifique «no lo toques», y para el cupo `null` es TAMBIÉN el valor válido
  «sin tope». El sentinela es **0**, que no significa nada como cupo.

### 5f. El botón de actualizar, al lado de la campana

La app ya se actualiza sola —cada 15 min, al volver a la pestaña y al enfocar, y
sola en pantallas seguras (§2g)— pero todo eso pasa **por su cuenta**: quien
acababa de ver un cambio anunciado y no lo tenía no tenía dónde tocar. La
comprobación manual existía y vivía **dentro de Ajustes, a cuatro toques**.

**Cuelga del MISMO registro, no de uno nuevo.** `registerSW` se llama una vez,
desde `UpdatePrompt`, que está montado siempre en el caparazón. El botón solo lee
`useActualizacion` y usa las funciones que ese registro dejó. Registrar otro
service worker desde el encabezado dejaría dos compitiendo, y el que aplicara no
sería el que detectó.

**Y NO es `location.reload()`.** Recargar a mano vuelve a pedir el mismo
`index.html` que el service worker viejo tiene precacheado: se ve rápido y no
actualiza nada. Es el síntoma exacto del §2g —«cada deploy quedaba invisible»—.
Aplicar pasa por `updateSW(true)`, que le dice a la versión en espera que tome el
control y recién entonces recarga.

**UN BOTÓN QUE NO ACUSA RECIBO SE TOCA CINCO VECES.** Si no hay nada nuevo,
comprobar no cambia nada en pantalla y quien lo tocó concluye que está roto. Al
terminar sin novedad dice **«Al día»** unos segundos, con el ícono en verde.

**El estado se lee FRESCO del store, no del cierre.** `hayVersionNueva` capturado
en el render es el de ANTES de comprobar: una versión recién encontrada se
anunciaría como «Al día», que es exactamente al revés. Se lee con
`useActualizacion.getState()` después del `await`.

**Si el registro todavía no dejó sus funciones, el botón no se dibuja.** Uno que
existe y no hace nada es peor que uno que todavía no está. Efecto secundario a
tener presente: **en desarrollo no hay service worker** (`devOptions.enabled:
false`), así que el botón nunca aparece ahí — por eso el banco de la liga trae
tres controles que le inyectan las funciones al store y dejan mirarlo. Es el
mismo seam que usa Ajustes, no una copia del componente.

### 5g. LIGA — el lobby durante la inscripción, y el padrón

**El lobby lista GRUPOS, y durante toda la inscripción no hay ninguno.** La
pantalla a la que apunta el enlace del video mostraba el número en la cabecera y
**un párrafo**, tres semanas. Quiénes van entrando es lo único que hay para
mostrar en ese período — y es lo que hace ver que la liga es de verdad y que es
internacional.

`liga_ver` devuelve ahora `padron` con **cuatro campos y ninguno de más**:
`nombre_visible` (que ya respeta `consiente_perfil`, resuelto en el alta), `pais`
para la bandera, y `lider`/`base`, que es lo mismo que se ve en la tabla una vez
armados los grupos.

**NO va `estado`, aunque el grant por columna lo permita:** admite `'vetado'`, y
publicar que alguien está vetado es exactamente el dato que el producto esconde a
propósito. Tampoco `user_id`, `tier`, `abandonos` ni `inscrito_en` — y **la lista
no se numera**: poner el puesto de llegada convierte una lista de gente en una
carrera por entrar primero, y entrar primero no da ninguna ventaja en esta liga.

Tope de 200 y el contador de la cabecera sigue diciendo el total real. Se dibuja
**solo mientras no hay grupos**: en cuanto se arman, la tabla del grupo dice lo
mismo y mejor —con puntos— y esta lista sobra.

**Dónde se ve cada cosa, que era la confusión:** el LOBBY es para jugar (tu
partida, tu grupo, la tabla) y el PANEL es para organizar. El padrón completo
—con zona horaria, horas declaradas y estado— vive en el panel, pestaña
Inscritos; el lobby muestra la versión pública.

### 5h. LIGA — inscribirse estaba ROTO, y el mazo entra al alta

**DROPEAR UNA FUNCIÓN SIN BARRER QUIÉN LA LLAMABA.** Al hacer `liga_visible`
por liga (§5e) se soltó la versión sin argumento — y `liga_inscribirse` la
llamaba. La función quedó **reventando entera**: nadie podía inscribirse, y no
se habría descubierto hasta que la primera persona lo intentara, porque
PL/pgSQL resuelve la llamada recién al ejecutarse.

El barrido que hay que correr al dropear una función es una línea:

```sql
select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosrc ~ 'nombre_de_la_funcion\(\s*\)';
```

**Y ROMPÍ `liga_panel` EN LA MISMA MIGRACIÓN**, escribiendo un cuerpo de relleno
(`return null`) al final del archivo por copiar mal. Se restauró desde
`supabase/migrations/liga-internacional-rpcs.sql` — que es exactamente para lo
que sirve tener el DDL versionado en el repo, y por qué el §3o marca como error
haber aplicado un esquema por MCP sin escribirlo a un archivo.

**EL MAZO ENTRA AL ALTA.** `liga_plazas.deck_id` existía desde el primer día y
nadie lo llenaba: el alta pedía líder y base en **texto libre**. Ahora:

- `liga_inscripciones.deck_id` → FK a `decks(id)`, que es **TEXT** (§3a: una FK
  declarada `uuid` ni se puede crear) y va `ON DELETE SET NULL` — borrar un mazo
  no puede borrarle a nadie su inscripción.
- **El servidor comprueba que el mazo sea TUYO**, el mismo guardia que
  `confirmar_amistosa`. Sin eso, alguien se inscribe con el mazo de otro — y el
  mazo es lo que se publica en el VOD.
- `liga_armar_grupos` lo copia a la plaza.
- **Lo ve el PANEL, no el padrón público.** Publicar el mazo durante la
  inscripción es scouting gratis para el rival.

**Elegir el mazo llena líder y base con los NOMBRES, no con los ids.**
`misMazos` devuelve `cardId` y lo que el resto del módulo guarda y muestra son
nombres: la tabla del grupo, la ficha del overlay y el padrón. Guardar un id ahí
pondría un uuid al lado del nombre de la persona, al aire. Los campos quedan
editables, y si no tiene mazos cargados **el selector no se dibuja**: a nadie se
le enseña una lista vacía con un «no tenés mazos».

**La liga quedó en `inscripcion` con `publica = false`**: el formulario se abre
para el creador y el staff —para probarlo— y la liga sigue invisible para las
otras 40 cuentas. Son dos interruptores distintos y esa es la razón de que lo
sean.

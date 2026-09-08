# HOLOCRON SWU (swu-companion) — Contexto para agentes (Claude / ChatGPT)

> Leé esto antes de tocar nada. Luego leé `BITACORA.md` (qué se hizo últimamente y qué quedó pendiente) y, si existe, `CLAUDE.md` (detalle profundo).
> Protocolo de colaboración entre IAs e índice de todos los proyectos: viven en un repo privado del mismo dueño (no en este).

## 1. Qué es
PWA para el juego de cartas **Star Wars: Unlimited**, hecha para la comunidad de El Salvador (marca real: **HOLOCRON SWU**; el repo se llama `swu-companion`). Producción: **https://swusv.com** (también `www.swusv.com` y un alias `*.vercel.app`). El repo en GitHub es **PÚBLICO**: nada sensible en ningún archivo.
Módulos LIVE: colección (`/collection`, escáner `/scan`), La Bóveda (sobres + álbum + tienda de repetidas, `/sobres`), misiones/XP (`/misiones`), torneos con invitados (`/torneos`, `/events/*`, proyección en `/events/live/:code`), amistosas (`/amistosas`), préstamos (`/prestamos`), mercado (`/explore`, `/pedidos`), meta con pestaña SV (`/meta`), rulings CR v8.0 (`/rulings`, público), 3D (`/galaxia`, `/mesa`, `/utilities`, `/sable`, `/terraformar`), streaming para OBS (`/overlay/:code`, `/estudio/:code`), laboratorio de simulación (`/laboratorio`, tras login), Espacio de Creadores / Liga PUENTE 3 (`/c/:code`, `/liga/:code`, demo cerrado), credencial 3D (`/credencial`), blog, calendario, trivia, mensajes.

## 2. Stack y mapa rápido
Vite 7 + React 19 + TypeScript 5.9 (strict, `noUnusedLocals/Parameters`) + Tailwind 4 + Zustand 5 + Dexie 4 (IndexedDB, **local-first**) + React Router 7 (lazy) + framer-motion + three.js pelado (sin R3F). Backend: Supabase (Postgres + Auth + Storage + Realtime + PostgREST). Hosting: Vercel, Node 24.
- `src/App.tsx` — router (~130 rutas lazy). `<P>` = AuthGate (ruta con login). Los `/banco-*` son bancos de prueba visuales SOLO en dev (`import.meta.env.DEV`, se podan del bundle).
- `src/features/<módulo>/` — 41 carpetas de feature (cards, collection, sobres, torneos, events, liga, creadores, meta, rulings, galaxia, mesa, stream, lab, sable, planeta, mercado, etc.).
- `src/services/` — ~120 servicios. Claves: `supabase.ts` (cliente), `swuApi.ts` (catálogo Dexie + red), `db/` (esquema Dexie), `sync.ts` (patrón de referencia para joins), `sobres.ts`, `ligaService.ts`, `tournamentCloud.ts`, `swiss.ts`, `pricing.ts`, `cardHash.ts`, `rulingsService.ts`.
- `src/hooks/useAuth.ts` — sesión (Zustand persist), `useRutaPersistente.ts` — restaura la ruta en la PWA.
- `src/sw.ts` — service worker propio (`injectManifest`); `src/components/UpdatePrompt.tsx` — aviso de versión nueva.
- `api/*.ts` — 19 funciones serverless de Vercel: proxies cerrados (`img`, `tcg-prices`, `swu-events`, `swu-stats`, `melee-profile`, `sim`), push (`_push`, `send-push`, `avisar-*`, `notify-listing`, `sable-recordatorio`) y crons (`meta-ingesta`, `torneos-vencidos`, `sobre-diario`, `bot-noticias`, `vencer-pedidos`, `transmision-avisar`, `liga-reloj`).
- `supabase/migrations/` — 118 `.sql` con nombre descriptivo, **sin numerar**; se aplican a mano (ver §5).
- `public/datos-cr/` — rulings (`index.json`, `es.json`, `cartas.json`); `public/card-hashes.bin` — índice del escáner (252 KB).
- `scripts/` — pruebas-programa (`*.test.mts`, `*.test.mjs`) y constructores Python (`build-rulings.py`, `build-card-rulings.py`, `build-card-hashes.py`, `build-meta-json.py`).
- `vercel.json` — rewrite SPA (todo menos `/api/`), 7 crons, `maxDuration: 300` para `meta-ingesta`. `vite.config.ts` — `manualChunks` (three separado, compartido), VitePWA `registerType: 'prompt'`.
- `obs/` — escenas y LEEMEs de OBS para transmitir torneos. `docs/` — datos de un torneo presencial aún sin cargar.
- `CLAUDE.md` (~4.700 líneas) — fuente de verdad: gotchas numerados §1–§5k. `README.md` — resumen público.

## 3. Cómo correr en local
Node 24 (`.nvmrc`; `engines >=20`). Vite dev NO sirve las funciones de `api/`: imágenes, precios, meta y laboratorio necesitan `vercel dev` o apuntar a producción (verificar).
```
nvm use
npm install
cp .env.example .env.local
npm run dev
```
`.env.local` lleva `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (públicas, protegidas por RLS). Alternativa con Vercel CLI: `vercel link --yes --project=swu-companion` y `vercel env pull .env.local --environment=production --yes`. Sin esos valores `supabase.ts` avisa, pero `createClient` después lanza: el shell no arranca desconectado por omitirlos (ver §5l). Servidor en http://localhost:5173.

## 4. Cómo probar / verificar un cambio antes de darlo por hecho
- **Siempre** `npm run build` (= `tsc -b && vite build`, TS estricto) y `npm run lint` antes de commitear. Un error de tipos rompe el deploy.
- No hay test runner (ni vitest ni jest): las pruebas son programas que pasan en silencio o lanzan. Por área: `npm run misiones`, `npm run ranking-fuentes`, `npm run liga`, `npm run torneos-puerta`, `npm run torneo-vivo`, `npm run precon`, `npm run proyeccion`, `npm run agrupar-coste`, `npm run foto-perfil`, `npm run embebidos-perfil`, `npm run medir-precache`. Sueltos: `npx tsx src/services/notificaciones.test.ts`, `node scripts/actualizacion-rutas.test.mjs` (obligatorio al tocar `SEGURAS` de UpdatePrompt), `npx tsx scripts/<archivo>.test.mts` para el resto.
- Bancos visuales en dev: `/banco-sobres`, `/banco-credencial`, `/banco-avatares`, `/banco-lobby-liga`, etc. (lista en `App.tsx`).
- Verificar el deploy por la API/dashboard de Vercel (`state: READY` + commit sha), **nunca** con `curl` en bucle al dominio (dispara el escudo antibots, CLAUDE.md §3r).
- Para medir cambios de peso/red, usar un perfil de Chrome NUEVO: el service worker sirve la app vieja desde su precaché (§2t).
- Si tocaste SQL: probarlo en transacción revertida en el SQL Editor antes de aplicarlo.

## 5. Cómo se despliega
`git push origin main` → webhook GitHub → Vercel (`npm run build`) → swusv.com en ~1–2 min. **`main` = producción**, no hay CI ni staging. Un PR genera preview (con SSO de Vercel). Los crons de `vercel.json` corren solos en producción (protegidos por `CRON_SECRET`).
Lo que NO se publica solo: las migraciones SQL (`supabase/migrations/`) se aplican **a mano** en el SQL Editor de Supabase y las variables de entorno se cargan en Vercel → Settings → Environment Variables. Nombres usados por `api/`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SWUSIM_URL`, `SWUSIM_TOKEN`, `BOT_NOTICIAS_OFF`; cliente: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`. Antes de pushear, confirmar que el proyecto Vercel `swu-companion` sigue enlazado a ESTE repo.

## 6. Reglas duras
- Producción tiene datos reales de decenas de jugadores (perfiles, colecciones, XP, sobres, torneos). Nada de datos de prueba en prod salvo los `[demo]` de la liga (§8).
- Migraciones: aditivas, idempotentes, con nombre descriptivo; no hay registro en el repo de cuáles están aplicadas → antes de aplicar, consultar la base. Cambiar un estado en el servicio exige ampliar el `CHECK` en SQL (falla al escribir, no al compilar).
- RLS: nunca abrirla «para que funcione». Escribir stats/XP/sobres de terceros solo por RPC `SECURITY DEFINER` ya existentes (`cerrar_torneo()`, `abrir_sobre()`, `canjear_repetidas()`, `liga_*`). `anon` solo lee. Grants por columna explícita, no por tabla (§2j).
- `profiles.role` y `profiles.melee_verified` NO se escriben desde el cliente: roles solo vía `set_user_role()`. Columna nueva escribible por el cliente → agregarla al `grant update (...)` de `profiles` (§2o).
- Secretos: jamás en el repo ni en estos `.md`. `.env.local`, `.vercel/`, `.claude/` están gitignorados. La service role y `SWUSIM_TOKEN` viven solo en `api/`; las `VITE_*` van al bundle.
- No tocar DNS de swusv.com. No mover `skipWaiting()` al arranque de `sw.ts`. No reintroducir la ruta al API en `searchCards()`. No relajar los proxies cerrados de `api/` (listas blancas, atribución visible, `Crawl-Delay`, `User-Agent`): son datos de terceros.
- Repetidas se canjean desde `cartas_desbloqueadas`, nunca desde `collection` (§5k).
- No agregar teléfono/mensajería a intercambios sin volver a discutirlo (§2i). Consentimiento de liga va en la RPC, no en la UI (§4l).
- Código y rótulos en español; sin `any` ni `@ts-ignore`; rutas lazy con named exports (`.then(m => ({ default: m.X }))`).

## 7. Gotchas conocidos (detalle en CLAUDE.md por §)
- §1 Joins de Supabase devuelven **arrays** aun en 1:1 → helper `single<T>()` (patrón: `getGlobalLeaderboard()` en `sync.ts`).
- §2f supabase-js NO lanza excepción: desestructurar `error` siempre, o el fallo parece «no hay datos».
- §2b/§2c Buscador LOCAL-FIRST sobre ~9.000 filas en Dexie; el API ignora casi todos los filtros. Centinela `isDatabaseComplete` + `DB_DATA_VERSION` (subirla al calcular un campo nuevo).
- §2d/§2h `isCanonical` (buscador, 2.316) ≠ `isCollectible` (progreso, `Standard`, 2.089) ≠ oferta de intercambio. `total_cards` del API está mal (§2e).
- §2g PWA: `registerType: 'prompt'`, `skipWaiting()` solo al recibir `SKIP_WAITING`; se aplica sola si la app está oculta o en ruta de la lista BLANCA `SEGURAS`; el resto pregunta.
- §2v/§2w Sesión: `authListo`, hidratación desde Dexie antes de la red, `signOut({ scope: 'local' })`; la ruta se restaura con cinco guardas que son todas necesarias.
- §2k Precios vía `/api/tcg-prices` (tcgcsv sin CORS, exige `User-Agent`); set nuevo → `SET_GROUP_MAP` + `ALLOWED_GROUPS`.
- §2l/§2n/§2p Datos de melee.gg y swu-competitivehub son ajenos: atribución, `Crawl-Delay` 5 s compartido en la base (`meta_tomar_turno`), UA que empiece con `Mozilla`, paginar por lo que VINO, `Rank` es la única verdad por ronda.
- §2m Escáner reconoce por ARTE (`card-hashes.bin`); el redimensionador Python y el TS deben dar 0 bits de diferencia. Rechazar es función, no fallo.
- §2q Laboratorio: el simulador usa solo el Premier vigente (41 % de la base queda fuera); sets se preguntan a `/pool`; umbrales medidos, no elegidos.
- §2r Los JSON de rulings viven en `public/datos-cr/`, no en `public/rulings/` (Vercel resuelve archivos antes que el rewrite).
- §2s three.js en chunk propio; `renderer.forceContextLoss()` en la limpieza, DESPUÉS de quitar el listener de `webglcontextlost`.
- §2t Imágenes por `/api/img` (WebP, escalera fija de anchos, `immutable`), nunca al CDN directo.
- §2u/§3q Torneos: organizador = admin (una sola regla); identidad dentro del torneo = fila de clasificación; el motor jamás inventa resultados; `cerrar_torneo()` reparte.
- §2x `profiles.avatar` guarda foto/id/emoji → siempre `<Avatar>`. §2y El mercado son 5 columnas de `collection`; paginar con `.range()`, sin topes fijos.
- §4e/§4f `revoke from public` no le quita EXECUTE a `anon`; agregar argumento con default a una RPC no es compatible hacia atrás.
- §4l–§5j Liga: `puede_ver_creadores()` es la única puerta; `estado` y `publica` son interruptores distintos; tabla de posiciones nunca almacenada.
- §5l Taller Kyber: `TallerKyber` comparte producción y banco DEV; dos columnas recién a 1024px. Materiales/texturas/torneado/entorno compartidos con miniaturas. `SableEscena` distingue Detalle y Completo, conserva limpieza GPU y movimiento reducido. La recarga de inventario no rehidrata la edición; fallo de saldo bloquea nuevas compras con reintento visible.

## 8. Estado actual y pendientes
- 2026-09-06: `main` == `origin/main`, árbol limpio. Última tanda: Liga PUENTE 3 fases 0–3 (alta, reloj, lobby, panel móvil, cierre de temporada, «Qué sigue») y la Tienda de sobres (repetidas → créditos, 250 por sobre, tope 5/día).
- Liga PUENTE 3 sigue en **demo cerrado** y `publica = false`, con **120 inscritos `[demo]`** sembrados (`user_id` NULL). Antes de abrirla: borrar con el SQL de CLAUDE.md §5j (orden importa) y cambiar `puede_ver_creadores()`.
- `docs/torneo-2026-08-15-datos.md`: torneo presencial de 8 jugadores, datos incompletos a propósito; NO tocar Supabase hasta tener las 12 partidas.
- TODOs en código: QR real en `JoinEventPage.tsx`, Realtime en `EventLobbyPage.tsx`.
- Pendientes de módulos (verificar): lista de cartas suspendidas en `/rulings`; escenas de 9 cartas y sobre de bienvenida en La Bóveda (el arte lo aporta el dueño del proyecto).
- Rama remota `origin/claude/app-scifi-design-lkdx1i` sin merge: decidir si se integra o se borra (verificar).
- La sección «Estructura de carpetas» del CLAUDE.md está desactualizada (menciona `public/export/` y `features/melee/`, que no existen); el resto del archivo sí está al día.

## 9. Protocolo de colaboración
- `git pull` antes de empezar; commits chicos; prefijo `[claude]` o `[chatgpt]` en el mensaje.
- Cambios grandes o riesgosos: rama `feature/...` + PR (Vercel genera preview). Cambios chicos y seguros: directo a la rama principal.
- Un archivo grande, una IA a la vez. Coordinar por área (`App.tsx`, `CLAUDE.md`, `sw.ts`, `useAuth.ts` y las migraciones son los que más chocan).
- Al terminar una sesión: entrada arriba de todo en `BITACORA.md` (fecha · IA · qué cambió · archivos · cómo verificar · pendiente).
- Nunca secretos en el repo ni en estos .md.
- Todo hallazgo medido que cambie una regla va también al `CLAUDE.md`, como sección nueva al final con el § siguiente; no reescribir secciones ajenas.

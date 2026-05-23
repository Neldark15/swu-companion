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

**Principal:**
- `/` Base (Hexagon) — centro de mando
- `/play` Duelo (Swords) — tracker en vivo
- `/arena` Holocrón (DatapadIcon) — registro de duelos
- `/melee` Circuito (MedalIcon) — Melee.gg
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
- `/utilities` Utilidades (ChanceCubeIcon)

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
- Cache memoria → Dexie → fallback de red en chunks de 8 → `loadFullDatabase()` si conteo local < 2000.

Si reaparecen los placeholders, verificar que `loadFullDatabase()` se está disparando.

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
| `collection_items` | Cartas en colección personal (userId, cardId, qty) |
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

*Última actualización: 2026-05-22*

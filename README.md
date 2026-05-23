# HOLOCRON SWU

Progressive Web App (PWA) companion para el juego de cartas **Star Wars: Unlimited**.

🌐 **Producción:** [swusv.com](https://swusv.com)

---

## Features

- 🃏 **Mi Botín** — colección personal con import/export CSV/JSON/TXT
- ⚔️ **Tracker en vivo** — partidas con persistencia y log de movimientos
- 🏟️ **Holocrón / Arena** — historial completo de duelos + estadísticas
- 🏆 **Sistema de Torneos** — Swiss, eliminación, dashboard live, vista pública
- 🎯 **Circuito** — integración con Melee.gg
- 🌌 **La Galaxia** — explorador global de jugadores (rankings, actividad, mapa)
- 🕵️ **Espionaje** — perfiles públicos + visualizador de decks ajenos
- 🌍 **Comunidades** — por país/continente con feed propio
- 🎮 **Gamificación** — XP, niveles, achievements, misiones, trivia, frames animados
- 📦 **Constructor de Decks** — builder visual + validador + import/export
- 🔍 **Base de cartas** — búsqueda con caché local (Dexie/IndexedDB)
- 📲 **PWA** — instalable, funciona offline parcialmente

---

## Stack

| | |
|---|---|
| Frontend | React 19 + TypeScript 5.9 + Vite 7 |
| UI | Tailwind CSS 4 + framer-motion + lucide-react |
| Estado | Zustand 5 |
| Caché local | Dexie 4 (IndexedDB) |
| Routing | React Router 7 (lazy + Suspense) |
| PWA | vite-plugin-pwa |
| Backend | Supabase (Postgres + Auth + Storage + Realtime) |
| Hosting | Vercel (auto-deploy desde `main`) |

---

## Setup local

Requiere Node ≥ 20.

```bash
# 1. Clonar
git clone https://github.com/Neldark15/swu-companion.git
cd swu-companion

# 2. Dependencias
npm install

# 3. Variables de entorno (automático con Vercel CLI)
vercel link --yes --project=swu-companion
vercel env pull .env.local --environment=production --yes

# o manual: copiar .env.example a .env.local y rellenar
cp .env.example .env.local

# 4. Dev server
npm run dev
# http://localhost:5173
```

---

## Comandos

```bash
npm run dev       # Vite dev server con HMR
npm run build     # tsc -b && vite build (chequea TS estricto)
npm run preview   # preview del build de producción
npm run lint      # eslint .
```

---

## Deploy

`git push origin main` → webhook GitHub → Vercel build → swusv.com (~1-2 min).

No hay CI adicional. **Siempre correr `npm run build` localmente antes de pushear** para evitar romper el deploy.

---

## Estructura

```
src/
├── App.tsx              # 46 rutas lazy + AuthGate
├── components/          # AuthGate, CardImage, SWIcons, layout, ui
├── features/            # 17 módulos (arena, cards, collection, community, decks, ...)
├── services/            # ~30 servicios (supabase, swuApi, sync, galaxyService, ...)
├── hooks/               # useAuth, useMatchPersistence, useSettings, useUIStore
├── data/                # regions.ts (continentes + países)
└── types/               # tipos TS compartidos

supabase/migrations/     # Esquemas y migraciones SQL
public/                  # Assets estáticos + íconos PWA
```

Más detalle técnico en [CLAUDE.md](./CLAUDE.md).

---

## Licencia

Privado. © NOVA ARQUITECTOS / Nel.

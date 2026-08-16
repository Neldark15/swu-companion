# Torneo presencial — 8 jugadores (agosto 2026)

Datos dictados por Nel el 2026-08-16. **Incompletos a propósito**: se irán
completando. Este archivo existe para que no se pierdan mientras se decide
dónde viven en la base.

## Decisiones tomadas por Nel

1. **Este torneo NO reparte puntos ni XP.** Es registro histórico.
2. **No se construye en la base hasta tener las 12 partidas** (2026-08-16). Hoy
   hay 9. Mientras tanto, los datos se acumulan en este archivo y **no se toca
   Supabase**: ni la migración de jugadores sin cuenta ni el INSERT del evento.

Cuando estén las 12, el orden de trabajo es: migración → INSERT del evento con
`premios_en = now()` → arreglos de la vista (ver el final del archivo).

## Jugadores

| Nombre real | Usuario en la app | `profiles.id` |
|---|---|---|
| Nelson Morales | Nelson | `4a7167d2-ffef-4607-8426-d3cfbcfa4c2d` |
| Vara | Vara | `445f1119-af59-4583-b1b2-7354cc2f2ba0` |
| Jaime Beltrán | Jbeltramirez | `e91c6998-9ccc-4ebc-af61-2cd10291e76a` |
| Christian García | iNelo | `f36db540-51d4-441a-9053-052201fc2494` |
| Luis Castillo | LuisG05 | `a5f00ea2-a90a-44f7-9a84-bef2e450ef01` |
| César | **sin identificar** ⚠️ | — |
| Marlin José Ardón Martínez | — sin cuenta — | — |
| Erasmo Zaldaña | — sin cuenta — | — |

⚠️ **El octavo jugador es CÉSAR, no Felipe.** La lista inicial decía «Felipe»
y sobre esa base le asigné el perfil «Allister Yashiro» (correo
`felipequintanillaguzman@`). Nel corrigió el 2026-08-16: **el nombre es César**,
así que ese perfil queda descartado y César está **sin identificar**. No hay
ningún perfil obviamente suyo entre los 23 — puede que no tenga cuenta, como
Marlin y Erasmo.

⚠️ Aparte, sin relación con el torneo: hay DOS cuentas casi idénticas —
«Allister» (correo `allisteryashiro@`) y «Allister Yashiro» (correo
`felipequintanillaguzman@`). Se ven iguales en standings, en el buscador de
rivales y en el cara a cara. Conviene que Felipe se cambie el nombre.

## Partidas conocidas (11 de 12)

Con 8 jugadores y 3 rondas suizas son 12 partidas. **Falta 1.**

| # | Jugador A | Marcador | Jugador B |
|---|---|---|---|
| 1 | Nelson | **1–1** | Luis |
| 2 | Nelson | **2–0** | Erasmo |
| 3 | Vara | **2–1** | Nelson |
| 4 | Vara | **2–0** | Jaime Beltrán |
| 5 | Christian García | **2–1** | Vara |
| 6 | Jaime Beltrán | **2–0** | César |
| 7 | Jaime Beltrán | **2–0** | Luis |
| 8 | Christian García | **2–0** | César |
| 9 | Marlin | **2–0** | Christian García |
| 10 | Marlin | **2–0** | Erasmo Zaldaña |
| 11 | Marlin | **2–1** | Luis Castillo |
| 12 | **César** | **?** | **Erasmo** ← la única que falta |

Las partidas 3 y 5 vienen del relato de Vara; la 3 la confirma Nelson desde su
lado («perdí 1-2»), y coinciden. La 4 la confirman los dos (Vara «ganó 2-0»,
Jaime «perdió 0-2»).

**Los conteos cierran.** Nelson, Vara, Jaime y Christian ya tienen sus 3
partidas. Faltan 3, y reparten exactamente lo pendiente: Luis (1),
César (1), Erasmo (2), Marlin (2). No sobra ni falta nadie.

### La última partida está forzada: César vs Erasmo

Marlin jugó contra Christian, Erasmo y Luis — eso cerró a Luis y descartó el
escenario en que Luis jugaba contra Erasmo. Recuento verificado por script:

| Jugador | Rondas | Contra |
|---|---|---|
| Marlin | 3/3 | Christian, Erasmo, Luis |
| Nelson | 3/3 | Luis, Erasmo, Vara |
| Vara | 3/3 | Nelson, Jaime, Christian |
| Jaime | 3/3 | Vara, César, Luis |
| Christian | 3/3 | Vara, César, Marlin |
| Luis | 3/3 | Nelson, Jaime, Marlin |
| **César** | **2/3** | Jaime, Christian |
| **Erasmo** | **2/3** | Nelson, Marlin |

Solo quedan dos jugadores con un turno libre cada uno, así que **la partida que
falta es César vs Erasmo**. No hay otra posibilidad: el script confirma un único
escenario.

## Clasificación

Calculada con la regla real de la app (victoria +3, empate +1, derrota +0) y
verificada por script sobre las 11 partidas conocidas.

**El resultado de César–Erasmo NO mueve el podio.** Los primeros cinco puestos
son idénticos en los tres desenlaces posibles; esa partida solo decide entre el
6º y el 8º.

| # | Jugador | Pts | Récord | Juegos |
|---|---|---|---|---|
| 1 | **Marlin** 🏆 | 9 | 3-0-0 | 6-1 |
| 2 | Christian García | 6 | 2-1-0 | 4-3 |
| 3 | Vara | 6 | 2-1-0 | 5-3 |
| 4 | Jaime Beltrán | 6 | 2-1-0 | 4-2 |
| 5 | Nelson | 4 | 1-1-1 | 4-3 |
| 6-8 | Luis, César, Erasmo | — | — | depende de la partida que falta |

Nel confirmó que **Marlin quedó top 1**, lo que coincide con el cálculo hecho de
forma independiente. Es un buen chequeo cruzado de que los resultados están bien
anotados.

El desempate entre Christian, Vara y Jaime (los tres con 6 pts) sale por OMW%,
que la app calcula a su manera — el orden de arriba usa mi cálculo y hay que
recalcularlo con `tournamentCloud.ts` al construir el torneo.

## Mazos

Todos confirmados por Nel el 2026-08-16 y verificados contra el API de cartas.

| Jugador | Líder | Base |
|---|---|---|
| Nelson | Cad Bane — *Still Faster than You* (ASH) | ? |
| Jaime Beltrán | Mother Talzin — *Power Through Magick* (LOF) | Starlight Temple (28, Command) |
| César | Luke Skywalker — *I Can Save Him* (ASH) | ? |
| Erasmo Zaldaña | Luke *(¿cuál?)* | Strangled Cliffs (28, Aggression) |
| Luis | Luthen Rael — *Don't You Want to Fight For Real?* (SEC) | ? |
| Christian García | Boba Fett — *Any Methods Necessary* (JTL) | Lake Country (34, sin aspecto) |
| Marlin | Luke Skywalker — *Hero of Yavin* (JTL) | Data Vault (33, Command) |
| Vara | — | — |

**«Lake City» no existe como carta.** La única base que encaja es **Lake
Country** (34 vidas, JTL, sin aspecto) — la hermana mayor de Data Vault (33).

Líderes verificados: hay **una sola** Mother Talzin (LOF, Vigilance/Villainy) y
**un solo** Luthen Rael (SEC, Aggression/Heroism), así que esos nombres no son
ambiguos. De Luke hay tres (SOR, JTL, ASH).

### Contradicción resuelta: el mazo de Luis

Hubo dos relatos incompatibles — «Luis jugó Luke de ASH» y «el deck de Luis es
Luthen Rael». **Nel confirmó: Luthen Rael.** El «Luke de ASH» del primer relato
era el de César, que sí está confirmado con ese líder.

Queda pendiente **cuál Luke jugó Erasmo**: se sabe la base (Strangled Cliffs,
roja) pero no la impresión del líder.

### Lo que NO se sabe

- **El resultado de César vs Erasmo** — la única partida que falta.
- Qué partida fue de qué ronda.
- Fecha del torneo y sede.
- El mazo de Vara, las bases de Nelson y César, y cuál de los tres Luke jugó
  Erasmo.
- **Qué perfil de la app es César** (o si no tiene cuenta).

**No inventar nada de esto.** Un torneo con puestos deducidos de datos
parciales sería un ranking falso con aire de oficial.

## Por qué todavía no está en la base

`tournament_standings.user_id` es `NOT NULL` y FK a `auth.users`; lo mismo
`tournament_pairings.player1_id` / `player2_id` / `winner_id`. Marlin y Erasmo
no tienen cuenta, así que **hoy no se pueden registrar** — y el índice único
`(event_id, user_id)` tampoco serviría con NULLs, porque en Postgres dos NULL
no colisionan.

Además, medido contra producción:

- La vista «pública» `/events/live/:code` **no es pública**: la policy
  `events_select` de `official_events` está limitada a `{authenticated}`. Un
  visitante deslogueado ve «Evento no encontrado».
- Un torneo en `status='finished'` **desaparece de la app**: `getOfficialEvents`
  y `getEventByCode` filtran `status in ('open','active')`. Solo se llega
  tecleando el código a mano.
- La pestaña de pairings muestra **solo la ronda actual**; las anteriores no se
  pueden ver desde ningún lado.
- Insertar `status='finished'` por SQL **no reparte nada** (no hay triggers),
  pero deja el torneo listado por `torneos_pendientes()` como «falta repartir»,
  o sea a un clic de premiar. Y con `status='open'`/`'active'` el cron de las
  5:23 lo puede cerrar solo.

## El cerrojo del reparto es UNA columna: `premios_en`

Leído de `pg_proc.prosrc` en producción, no supuesto:

- `_repartir_premios()` sale de entrada con `if v_evento.premios_en is not null
  then return … 'ya repartio sus premios'`, **antes de tocar nada**.
- `cerrar_torneo()` **no** protege sola: su `update … where status <> 'finished'`
  no aborta cuando no toca filas, y cae igual en `_repartir_premios()`. El
  único muro real es `premios_en`.
- `torneos_pendientes()` exige `premios_en is null`, así que con la columna
  puesta el torneo **nunca aparece** en `/admin` y el botón «Repartir premios»
  ni se dibuja.
- `vencer_torneos()` (cron 5:23 SV) excluye `status <> 'finished'`, así que un
  torneo insertado ya cerrado queda fuera para siempre.
- Red de seguridad: `monthly_xp.user_id` es NOT NULL. Si alguien forzara el
  reparto, las filas de Marlin y Erasmo lo harían explotar y revertir.

O sea: **insertar con `status='finished'` Y `premios_en = now()` da cero
reparto de forma estructural**, no por promesa. Es la diferencia entre «nadie
va a tocar el botón» y «el botón no existe».

## Para admitir jugadores sin cuenta

El repo YA resolvió esto en otra tabla: `duelos_amistosos` usa `rival_id uuid
NULL` + `rival_nombre text NOT NULL default ''`. El mismo patrón acá:

```sql
alter table public.tournament_standings alter column user_id drop not null;
alter table public.tournament_standings alter column player_name set not null;
create unique index if not exists tournament_standings_invitado_uk
  on public.tournament_standings (event_id, lower(player_name))
  where user_id is null;
alter table public.tournament_pairings
  add column if not exists player1_invitado text,
  add column if not exists player2_invitado text;
```

El índice parcial repone lo que `UNIQUE(event_id, user_id)` deja de cubrir: en
Postgres dos NULL no colisionan, así que sin él dos «Erasmo» entrarían dos
veces. `player_name set not null` sale gratis hoy (0 filas) y evita que
`getStandings` reviente en `a.player_name.localeCompare(...)`.

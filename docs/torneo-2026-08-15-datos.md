# Torneo presencial — 8 jugadores (agosto 2026)

Datos dictados por Nel el 2026-08-16. **Incompletos a propósito**: se irán
completando. Este archivo existe para que no se pierdan mientras se decide
dónde viven en la base.

Decisión tomada por Nel: **este torneo NO reparte puntos ni XP.** Es registro
histórico.

## Jugadores

| Nombre real | Usuario en la app | `profiles.id` |
|---|---|---|
| Nelson Morales | Nelson | `4a7167d2-ffef-4607-8426-d3cfbcfa4c2d` |
| Vara | Vara | `445f1119-af59-4583-b1b2-7354cc2f2ba0` |
| Jaime Beltrán | Jbeltramirez | `e91c6998-9ccc-4ebc-af61-2cd10291e76a` |
| Christian García | iNelo | `f36db540-51d4-441a-9053-052201fc2494` |
| Luis | LuisG05 | `a5f00ea2-a90a-44f7-9a84-bef2e450ef01` |
| Felipe Quintanilla | «Allister Yashiro» ⚠️ | `c643f7b9-54d2-4ec8-8014-4dee2ab442b7` |
| Marlin José Ardón Martínez | — sin cuenta — | — |
| Erasmo Zaldaña | — sin cuenta — | — |

⚠️ **Ojo con Felipe.** Su perfil se llama «Allister Yashiro» pero el correo es
`felipequintanillaguzman@`. Y existe OTRO perfil, llamado «Allister», cuyo
correo sí es `allisteryashiro@`. Dos cuentas que se ven casi iguales en toda la
app: en standings, en el buscador de rivales y en el cara a cara. Conviene que
Felipe se cambie el nombre antes de que esto se muestre en público.

## Partidas conocidas (5 de ~12)

Con 8 jugadores y 3 rondas suizas serían 12 partidas. Faltan 7.

| # | Jugador A | Marcador | Jugador B | Detalle de mazos |
|---|---|---|---|---|
| 1 | Nelson | **1–1** | Luis | Nelson: Cad Bane · Luis: Luke de ASH |
| 2 | Nelson | **2–0** | Erasmo | Erasmo: Luke con base roja de 28 vidas |
| 3 | Vara | **2–1** | Nelson | — |
| 4 | Vara | **2–0** | Jaime Beltrán | — |
| 5 | Christian García | **2–1** | Vara | — |

Las partidas 3 y 5 vienen del relato de Vara; la 3 la confirma Nelson desde su
lado («perdí 1-2»), y coinciden. La 5 está dicha como «Vara perdió 1-2», o sea
Christian 2 – Vara 1.

### Lo que NO se sabe

- Las 7 partidas restantes.
- El emparejamiento por ronda: no se sabe qué partida fue de qué ronda.
- La clasificación final y el campeón.
- Fecha exacta del torneo, sede y formato.
- Los mazos de Vara, Jaime, Christian, Felipe y Marlin.

**No inventar nada de esto.** Un torneo con puestos deducidos de 5 de 12
partidas sería un ranking falso con aire de oficial.

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

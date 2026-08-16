-- Torneos HISTÓRICOS: los que se jugaron afuera y se cargan después
--
-- El sistema de torneos nació para llevar un evento EN VIVO desde la app: se
-- inscribe gente con cuenta, se generan emparejamientos y la clasificación se
-- calcula sola. Eso deja fuera el caso más común de una comunidad chica: el
-- torneo ya se jugó, se llevó en otra herramienta, y alguien quiere dejarlo
-- registrado.
--
-- Tres cosas lo impedían, todas medidas contra producción:
--
--  1. `tournament_standings.user_id` era NOT NULL y clave foránea a
--     `auth.users`. En el torneo del 15/8 hay tres jugadores sin cuenta
--     (Marlin, Erasmo y César): literalmente no se podían registrar.
--  2. Lo mismo en `tournament_pairings.player1_id` / `player2_id`.
--  3. **No existe columna de puesto.** La posición es el índice del arreglo ya
--     ordenado (`StandingsTable.tsx:50` pinta `idx + 1`, y `getStandings`
--     ordena por `puntos → omw_pct → gw_pct → nombre`).
--
-- El punto 3 es el que de verdad importa, y merece explicación.
--
-- ── Por qué hace falta guardar el puesto ─────────────────────────────
--
-- El torneo del 15/8 se corrió en Challonge, y Challonge desempata distinto que
-- el estándar competitivo. Con los MISMOS resultados:
--
--   · cadena estándar (puntos → OMW% → GW% → OGW%, piso 33,33 %) → Christian 2º
--   · Challonge (familia Buchholz / juegos ganados)              → Vara 2º
--
-- La diferencia entera sale de UN número: Christian jugó contra el único 0-3
-- del torneo, y el piso del 33,33 % le regala a ese rival un 33,3 % que no
-- ganó. Sin piso, el OMW de Christian baja de 66,67 % a 55,56 % y queda debajo
-- de Vara (59,26 %).
--
-- Ninguno de los dos está «mal»: el piso es el estándar de MTG y de melee.gg
-- —existe para no castigarte por un emparejamiento que no elegiste— y Buchholz
-- viene del ajedrez. Son criterios distintos, no un error.
--
-- Pero la gente vio **Vara 2º** en la pantalla el día del torneo. Reescribir
-- eso ahora sería contradecir lo que vivieron. Y forzar el orden escribiendo un
-- `omw_pct` falso sería peor: esa columna se MUESTRA como porcentaje, así que
-- se estaría publicando un número inventado.
--
-- De ahí `puesto`: guarda el orden que se anunció, y las columnas de
-- porcentajes siguen llevando los valores REALES calculados de las partidas.
-- Se respeta lo que pasó sin mentir en ningún número.

-- ── 1. Jugadores sin cuenta ──────────────────────────────────────────
--
-- Mismo patrón que ya usa `duelos_amistosos` (`rival_id` nulo +
-- `rival_nombre` obligatorio), para no inventar una convención nueva.

alter table public.tournament_standings alter column user_id drop not null;
alter table public.tournament_standings alter column player_name set not null;

-- `UNIQUE (event_id, user_id)` NO alcanza para los invitados: en Postgres dos
-- NULL nunca colisionan, así que sin este índice el mismo «Erasmo» entraría
-- dos veces al mismo torneo. Va sobre `lower()` porque «erasmo» y «Erasmo»
-- son la misma persona.
create unique index if not exists ux_standings_invitado
  on public.tournament_standings (event_id, lower(player_name))
  where user_id is null;

alter table public.tournament_pairings
  alter column player1_id drop not null,
  alter column player2_id drop not null,
  add column if not exists player1_nombre text,
  add column if not exists player2_nombre text;

comment on column public.tournament_pairings.player1_nombre is
  'Nombre cuando el jugador no tiene cuenta. Si player1_id viene, este se ignora.';
comment on column public.tournament_pairings.player2_nombre is
  'Nombre cuando el jugador no tiene cuenta. Si player2_id viene, este se ignora.';

-- ── 2. El puesto anunciado ───────────────────────────────────────────

alter table public.tournament_standings
  add column if not exists puesto smallint;

comment on column public.tournament_standings.puesto is
  'Puesto ANUNCIADO por el organizador. NULL = calcularlo del orden estándar. '
  'Cuando viene, manda sobre el desempate: es lo que vieron los jugadores.';

-- ── 3. De dónde salió el torneo y cómo desempató ─────────────────────
--
-- Sin esto, dos torneos con los mismos puntos saldrían en distinto orden sin
-- que nadie pueda saber por qué. La pantalla lo dice en voz alta.

alter table public.official_events
  add column if not exists fuente text,
  add column if not exists fuente_url text,
  add column if not exists desempate text;

comment on column public.official_events.fuente is
  'Herramienta donde se corrio el torneo (challonge, melee, la propia app...). NULL = esta app.';
comment on column public.official_events.desempate is
  'Criterio de desempate del organizador, en palabras. Se muestra junto a la clasificacion.';

-- ── 4. Que un torneo terminado se pueda ENCONTRAR ────────────────────
--
-- `getOfficialEvents` y `getEventByCode` filtran `status in ('open','active')`,
-- así que hoy un torneo `finished` desaparece de toda la app: solo se llega
-- tecleando el código a mano. Un índice por fecha para poder listarlos.

create index if not exists ix_events_terminados
  on public.official_events (date desc)
  where status = 'finished';

-- ── 5. Lectura ───────────────────────────────────────────────────────
--
-- `events_select` está limitada a `authenticated`, así que un visitante sin
-- cuenta ve «Evento no encontrado». NO se toca acá a propósito: abrir la tabla
-- entera al público es una decisión de privacidad aparte —expone sedes y
-- organizadores de eventos que todavía no ocurrieron— y merece discutirse sola,
-- no colarse dentro de una migración sobre torneos viejos.

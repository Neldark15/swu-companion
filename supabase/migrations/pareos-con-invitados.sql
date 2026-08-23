-- ═══════════════════════════════════════════════════════════════════════
--  LA IDENTIDAD DE UN JUGADOR DENTRO DE UN TORNEO YA NO ES SU CUENTA
-- ═══════════════════════════════════════════════════════════════════════
--
--  ── El fallo, medido ─────────────────────────────────────────────────
--
--  `tournament_pairings.player1_id` / `player2_id` / `winner_id` son FK a
--  **auth.users**, y todo el motor llavea a los jugadores por `user_id`. Para
--  quien juega sin cuenta ese campo es NULL — y en la sala real es un tercio
--  de la gente. No es que «no se pueda»: el motor INVENTA resultados. Tres
--  cosas distintas, las tres sin un solo error a la vista:
--
--  1. Un invitado en el lado 2 se guarda con `player2_id = NULL`, y esa es
--     exactamente la condición de BYE: se escribe ganador automático 2-0 y se
--     acreditan +3 puntos, +1 victoria, +2 juegos y +1 bye por una partida que
--     hay que jugar.
--
--  2. Con N invitados, las N filas colapsan en la única clave `null` del
--     `Set` de emparejados de `swiss.ts`. Al emparejar al primero, todos los
--     demás quedan marcados como «ya tienen mesa»: con 3 invitados de 8, dos
--     jugadores DESAPARECEN de la ronda — sin mesa, sin bye y sin error.
--
--  3. Si el que gana es el invitado no hay uuid que poner en `winner_id`, así
--     que queda NULL — y el código deduce el empate de `winner_id === null`.
--     El rival con cuenta cobra +1 punto y +1 empate por una partida que
--     PERDIÓ. Es literalmente el torneo del 8/8, donde el campeón no tenía
--     cuenta.
--
--  Por eso esa noche el organizador tuvo que usar el motor local de Dexie
--  —dos usos en toda la vida de la app— y el torneo quedó en la nube con 4
--  inscritos y 0 rondas.
--
--  ── El arreglo ───────────────────────────────────────────────────────
--
--  Dentro de un torneo, la identidad pasa a ser `tournament_standings.id`:
--  hay exactamente una fila por jugador y por evento, y existe igual con
--  cuenta o sin ella. Nunca es NULL, así que `null` recupera su único
--  significado honesto: **no hay rival**.
--
--  Las columnas viejas SE QUEDAN y no son una copia redundante: responden
--  otra pregunta. `player*_standing` dice QUIÉN JUEGA; `player*_id` dice QUÉ
--  CUENTA puede reportar, confirmar o disputar ese resultado — y eso sigue
--  siendo `auth.uid()`. Un invitado tiene lo primero y no lo segundo.
--
--  `winner_standing` es imprescindible y no un adorno: sin él no existe forma
--  de decir «ganó el invitado», y el empate sigue siendo indistinguible de
--  «ganó alguien que no tiene cuenta» (fallo 3).
-- ═══════════════════════════════════════════════════════════════════════

begin;

alter table public.tournament_pairings
  add column if not exists player1_standing uuid references public.tournament_standings(id) on delete set null,
  add column if not exists player2_standing uuid references public.tournament_standings(id) on delete set null,
  add column if not exists winner_standing  uuid references public.tournament_standings(id) on delete set null;

-- Rellenar lo que ya existe. Todos los pareos de hoy son de gente con cuenta
-- (un invitado no cabía en la columna), así que el cruce por user_id es exacto
-- para el histórico. Lo que no se puede rellenar queda NULL, que en las filas
-- viejas significa lo mismo que significaba: BYE.
update public.tournament_pairings p
   set player1_standing = s.id
  from public.tournament_standings s
 where s.event_id = p.event_id and s.user_id = p.player1_id
   and p.player1_id is not null and p.player1_standing is null;

update public.tournament_pairings p
   set player2_standing = s.id
  from public.tournament_standings s
 where s.event_id = p.event_id and s.user_id = p.player2_id
   and p.player2_id is not null and p.player2_standing is null;

update public.tournament_pairings p
   set winner_standing = s.id
  from public.tournament_standings s
 where s.event_id = p.event_id and s.user_id = p.winner_id
   and p.winner_id is not null and p.winner_standing is null;

create index if not exists ix_pairings_standing1 on public.tournament_pairings (player1_standing);
create index if not exists ix_pairings_standing2 on public.tournament_pairings (player2_standing);

-- §2o: `authenticated` tiene lista explícita de columnas escribibles en las
-- tablas de torneo. Columna nueva no entra sola.
grant update (player1_standing, player2_standing, winner_standing)
  on public.tournament_pairings to authenticated;

commit;

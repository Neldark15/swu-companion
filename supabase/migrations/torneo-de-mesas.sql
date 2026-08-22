-- ─────────────────────────────────────────────────────────────────────
-- TORNEO DE MESAS (Twin Suns)
--
-- Twin Suns es multijugador: se juega en mesas de 3 o 4, no uno contra
-- uno. Eso no cabe en `tournament_pairings`, que tiene DOS columnas de
-- jugador y UN ganador. Y no es cuestión de gusto:
--
--   · una mesa de 4 solo entraría como filas con `player2_id` NULL, y
--     `PairingsView` lee eso como BYE y lo pinta en amarillo — dibujaría
--     partidas que nunca se jugaron;
--   · los puestos 2.º, 3.º y 4.º no tienen dónde vivir con un solo
--     `winner_id`;
--   · la policy `pairings_participant_update` es
--     `auth.uid() = player1_id or player2_id`: la pertenencia a una mesa
--     de cuatro no es expresable ahí.
--
-- Y esas vistas las comparten tres pantallas en producción, así que cada
-- mentira se reproduciría tres veces. Tabla nueva; `tournament_pairings`
-- no se toca.
--
-- ── Se llama 'mesas', no 'twin_suns' ─────────────────────────────────
--
-- `twin_suns` YA existe como FORMATO DE MAZO. Si el tipo de torneo se
-- llamara igual, la misma fila tendría `format='twin_suns'` y
-- `tournament_type='twin_suns'` queriendo decir cosas distintas.
-- ─────────────────────────────────────────────────────────────────────

begin;

-- ══ 1. El CHECK, que es el único que hoy revienta de verdad ══════════
alter table public.official_events
  drop constraint if exists official_events_tournament_type_check;
alter table public.official_events
  add constraint official_events_tournament_type_check
  check (tournament_type in ('swiss', 'elimination', 'mesas'));


-- ══ 2. Un asiento = una fila ═════════════════════════════════════════
-- Misma forma POR JUGADOR que `tournament_standings`, que es la que ya
-- sabe convivir con gente sin cuenta.
create table if not exists public.tournament_mesas (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.official_events(id) on delete cascade,
  round_id    uuid not null references public.tournament_rounds(id) on delete cascade,
  mesa        smallint not null check (mesa >= 1),
  -- NULL = juega sin cuenta. Medido: 3 de 8 en el torneo real.
  user_id     uuid references auth.users(id) on delete set null,
  player_name text not null,
  puesto      smallint check (puesto between 1 and 4),
  -- Los puntos NO se escriben: se derivan del puesto. Una columna escrita
  -- a mano se puede separar de su puesto; una generada, no.
  puntos      smallint generated always as
              (case puesto when 1 then 3 when 2 then 2 when 3 then 1 when 4 then 0 else null end) stored,
  anotado_por uuid references auth.users(id) on delete set null,
  anotado_en  timestamptz,
  creado_en   timestamptz not null default now()
);

comment on table public.tournament_mesas is
  'Un asiento por fila. El numero de mesas de una ronda es count(distinct mesa), no una columna.';

-- Nadie se sienta dos veces en la misma ronda, tenga cuenta o no.
create unique index if not exists ux_mesas_nombre
  on public.tournament_mesas (round_id, lower(trim(player_name)));
create unique index if not exists ux_mesas_user
  on public.tournament_mesas (round_id, user_id) where user_id is not null;
-- Dentro de una mesa no puede haber dos primeros puestos.
create unique index if not exists ux_mesas_puesto
  on public.tournament_mesas (round_id, mesa, puesto) where puesto is not null;
create index if not exists ix_mesas_evento
  on public.tournament_mesas (event_id, round_id, mesa);

alter table public.tournament_mesas enable row level security;

-- §2j: Supabase concede ALL por defecto en toda tabla nueva. Revocar ANTES.
revoke all on public.tournament_mesas from anon, authenticated;
grant select on public.tournament_mesas to anon, authenticated;

-- Lectura pública, igual que los pareos: un torneo se comparte por link.
drop policy if exists mesas_public_select on public.tournament_mesas;
create policy mesas_public_select on public.tournament_mesas
  for select using (true);

-- CERO escritura desde el cliente. Todo pasa por las RPC de abajo.


-- ══ 3. Quién puede operar un torneo ══════════════════════════════════
-- Admin de siempre, o curador del Centro de Temporada. Hace falta porque
-- `tournament_standings` es admin-only para escribir, así que un curador
-- que no fuera admin no podría ni sembrar semillas.
create or replace function public.puede_operar_torneo()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
      or public.es_curador()
$$;

revoke all on function public.puede_operar_torneo() from public, anon;
grant execute on function public.puede_operar_torneo() to authenticated;


-- ══ 4. Armar las mesas de una ronda ══════════════════════════════════
--
-- El reparto lo calcula el cliente (`services/mesas.ts`, probado sobre
-- 3..32 jugadores) y acá se VALIDA. Validar en vez de recalcular evita
-- tener dos algoritmos de siembra que se separen: el servidor no necesita
-- saber repartir, necesita saber si el reparto es legal.
create or replace function public.armar_mesas(
  p_evento   uuid,
  p_asientos jsonb   -- [{ "user_id": uuid|null, "player_name": text, "mesa": int }]
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_evento public.official_events%rowtype;
  v_ronda  uuid;
  v_num    int;
  v_jug    int;
  v_asi    int;
  v_mesas  int;
  v_maxmesa int;
  v_malas  int;
begin
  if not public.puede_operar_torneo() then
    return jsonb_build_object('ok', false, 'error', 'No tenes permiso para operar este torneo.');
  end if;

  select * into v_evento from public.official_events where id = p_evento;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'El torneo no existe.');
  end if;
  if v_evento.tournament_type <> 'mesas' then
    return jsonb_build_object('ok', false, 'error',
      'Este torneo no es de mesas: es de tipo ' || coalesce(v_evento.tournament_type, '?') || '.');
  end if;
  if v_evento.status = 'finished' then
    return jsonb_build_object('ok', false, 'error', 'El torneo ya esta cerrado.');
  end if;

  -- Los asientos propuestos se validan con CTEs, sin tabla temporal: una
  -- temp table dentro de una funcion revienta si la funcion se llama dos
  -- veces en la misma transaccion.
  select count(*),
         count(distinct lower(trim(player_name))),
         count(distinct mesa),
         max(mesa)
    into v_asi, v_malas, v_mesas, v_maxmesa
    from jsonb_to_recordset(p_asientos) as a(user_id uuid, player_name text, mesa int);

  if v_asi = 0 then
    return jsonb_build_object('ok', false, 'error', 'No se recibio ningun asiento.');
  end if;

  -- Nadie repetido dentro de la propuesta.
  if v_malas <> v_asi then
    return jsonb_build_object('ok', false, 'error', 'Hay un jugador sentado dos veces.');
  end if;

  -- Mesas numeradas 1..M sin huecos.
  if v_maxmesa <> v_mesas then
    return jsonb_build_object('ok', false, 'error',
      'Las mesas tienen que ir de 1 a ' || v_mesas || ' sin saltos.');
  end if;

  -- Toda mesa entre 3 y 4.
  select count(*) into v_malas from (
    select mesa, count(*) k
      from jsonb_to_recordset(p_asientos) as a(user_id uuid, player_name text, mesa int)
     group by mesa
  ) t where t.k < 3 or t.k > 4;
  if v_malas > 0 then
    return jsonb_build_object('ok', false, 'error',
      'Hay ' || v_malas || ' mesa(s) que no quedaron con 3 ni 4 jugadores.');
  end if;

  -- Tiene que sentarse EXACTAMENTE la gente que sigue en el torneo.
  select count(*) into v_jug
    from public.tournament_standings
   where event_id = p_evento and coalesce(dropped, false) = false;

  if v_asi <> v_jug then
    return jsonb_build_object('ok', false, 'error',
      format('Se recibieron %s asientos para %s jugadores activos.', v_asi, v_jug));
  end if;

  -- La ronda. Si la ultima ronda existe y NADIE tiene puesto todavia, se
  -- rehace: el organizador puede volver a armar antes de que se juegue.
  select r.id, r.round_number into v_ronda, v_num
    from public.tournament_rounds r
   where r.event_id = p_evento
   order by r.round_number desc limit 1;

  if v_ronda is not null
     and not exists (select 1 from public.tournament_mesas
                      where round_id = v_ronda and puesto is not null) then
    delete from public.tournament_mesas where round_id = v_ronda;
  else
    v_num := coalesce(v_num, 0) + 1;
    insert into public.tournament_rounds (event_id, round_number, started_at)
    values (p_evento, v_num, now())
    returning id into v_ronda;
  end if;

  insert into public.tournament_mesas (event_id, round_id, mesa, user_id, player_name)
  select p_evento, v_ronda, a.mesa, a.user_id, trim(a.player_name)
    from jsonb_to_recordset(p_asientos) as a(user_id uuid, player_name text, mesa int);

  update public.official_events
     set current_round = v_num, status = 'active', updated_at = now()
   where id = p_evento;

  return jsonb_build_object('ok', true, 'ronda', v_num, 'mesas', v_mesas, 'asientos', v_asi);
end;
$$;

revoke all on function public.armar_mesas(uuid, jsonb) from public, anon;
grant execute on function public.armar_mesas(uuid, jsonb) to authenticated;


-- ══ 5. Anotar los puestos de UNA mesa ════════════════════════════════
create or replace function public.guardar_puestos_mesa(
  p_ronda   uuid,
  p_mesa    int,
  p_puestos jsonb   -- [{ "player_name": text, "puesto": 1..4 }]
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_evento uuid;
  v_k      int;
  v_n      int;
  v_dist   int;
  v_min    int;
  v_max    int;
begin
  if not public.puede_operar_torneo() then
    return jsonb_build_object('ok', false, 'error', 'No tenes permiso para operar este torneo.');
  end if;

  select event_id into v_evento from public.tournament_rounds where id = p_ronda;
  if v_evento is null then
    return jsonb_build_object('ok', false, 'error', 'Esa ronda no existe.');
  end if;

  select count(*) into v_k from public.tournament_mesas
   where round_id = p_ronda and mesa = p_mesa;
  if v_k = 0 then
    return jsonb_build_object('ok', false, 'error', 'Esa mesa no existe en esta ronda.');
  end if;

  select count(*), count(distinct puesto), min(puesto), max(puesto)
    into v_n, v_dist, v_min, v_max
    from jsonb_to_recordset(p_puestos) as x(player_name text, puesto int);

  -- Los puestos tienen que ser la permutación COMPLETA de 1..k. Aceptar
  -- una mesa a medias dejaría puntos derivados de un orden incompleto, y
  -- eso ordena la tabla del torneo con datos que nadie revisó.
  if v_n <> v_k or v_dist <> v_k or v_min <> 1 or v_max <> v_k then
    return jsonb_build_object('ok', false, 'error',
      format('La mesa %s tiene %s jugadores: hay que darle a cada uno un puesto distinto del 1 al %s.',
             p_mesa, v_k, v_k));
  end if;

  update public.tournament_mesas m
     set puesto = p.puesto, anotado_por = auth.uid(), anotado_en = now()
    from jsonb_to_recordset(p_puestos) as p(player_name text, puesto int)
   where m.round_id = p_ronda and m.mesa = p_mesa
     and lower(trim(m.player_name)) = lower(trim(p.player_name));

  if (select count(*) from public.tournament_mesas
       where round_id = p_ronda and mesa = p_mesa and puesto is null) > 0 then
    return jsonb_build_object('ok', false, 'error',
      'Algun nombre no coincide con los de la mesa; no se guardo nada.');
  end if;

  -- La clasificación se RECALCULA entera, no se le suma. Así corregir un
  -- puesto mal anotado es volver a guardar, y no queda deuda acumulada.
  update public.tournament_standings s
     -- Ojo: `tournament_standings` NO tiene `updated_at`. Ponerlo acá
     -- revienta en tiempo de ejecución, no de compilación.
     set points       = t.pts,
         match_wins   = t.ganadas,
         match_losses = t.otras
    from (
      select coalesce(m.user_id::text, 'n:' || lower(trim(m.player_name))) as clave,
             sum(m.puntos)::int                          as pts,
             count(*) filter (where m.puesto = 1)::int   as ganadas,
             count(*) filter (where m.puesto > 1)::int   as otras
        from public.tournament_mesas m
       where m.event_id = v_evento and m.puesto is not null
       group by 1
    ) t
   where s.event_id = v_evento
     and coalesce(s.user_id::text, 'n:' || lower(trim(s.player_name))) = t.clave;

  return jsonb_build_object('ok', true, 'mesa', p_mesa, 'jugadores', v_k);
end;
$$;

revoke all on function public.guardar_puestos_mesa(uuid, int, jsonb) from public, anon;
grant execute on function public.guardar_puestos_mesa(uuid, int, jsonb) to authenticated;


-- ══ 6. Fijar la clasificación final ══════════════════════════════════
-- Escribe `tournament_standings.puesto`. Hay que llamarla ANTES de cerrar:
-- si `puesto` queda NULL, `temporada_tabla()` filtra el torneo entero y
-- desaparece de la temporada sin un solo error.
create or replace function public.fijar_puestos_finales(p_evento uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_n int;
begin
  if not public.puede_operar_torneo() then
    return jsonb_build_object('ok', false, 'error', 'No tenes permiso para operar este torneo.');
  end if;

  with orden as (
    select id, row_number() over (
             order by points desc, match_wins desc, player_name asc
           ) as pos
      from public.tournament_standings
     where event_id = p_evento and coalesce(dropped, false) = false
  )
  update public.tournament_standings s
     set puesto = o.pos
    from orden o where o.id = s.id;

  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'jugadores', v_n);
end;
$$;

revoke all on function public.fijar_puestos_finales(uuid) from public, anon;
grant execute on function public.fijar_puestos_finales(uuid) to authenticated;


-- ══ 7. El reparto de premios respeta `puesto` ════════════════════════
--
-- ARREGLO DE UN FALLO YA EN PRODUCCIÓN, no solo una preparación para
-- mesas. `_repartir_premios` ordenaba por
-- `points, omw_pct, gw_pct, player_name` y NUNCA leía la columna `puesto`.
-- Medido en el torneo del 15 de agosto: la columna dice Vara 2.º /
-- Christian 3.º y el reparto daba Christian 2.º / Vara 3.º. O sea que el
-- podio que la gente vio en /torneos y el podio que reparte XP y sobres
-- eran distintos.
--
-- Y en un torneo de MESAS sería peor: nadie escribe omw_pct ni gw_pct
-- (se calculan recorriendo pareos 1v1), así que quedarían en 0 para todos
-- y el desempate real pasaría a ser `player_name asc` — el abecedario
-- repartiendo premios.
--
-- Con `coalesce(puesto, 32767)` el que tenga puesto anotado manda, y el
-- que no lo tenga cae al orden calculado de antes: el comportamiento
-- viejo se conserva donde no hay puesto.
create or replace function public._repartir_premios(p_evento uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_evento   public.official_events%rowtype;
  v_fila     record;
  v_pos      int := 0;
  v_total    int;
  v_xp       constant int := 50;
  v_pts      int;
  v_nuevo_xp int;
  v_nivel    int;
  v_resto    int;
  v_mes      text := to_char(now() at time zone 'America/El_Salvador', 'YYYY-MM');
  v_premiados int := 0;
  v_sobres    int := 0;
  v_sin_cuenta int := 0;
begin
  select * into v_evento from public.official_events where id = p_evento;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'El evento no existe.');
  end if;

  if v_evento.premios_en is not null then
    return jsonb_build_object('ok', false, 'error',
      'Este torneo ya repartio sus premios; no se reparte dos veces.');
  end if;

  select count(*) into v_total
    from public.tournament_standings where event_id = p_evento;

  if v_total = 0 then
    return jsonb_build_object('ok', false, 'error',
      'El torneo no tiene clasificacion registrada: no hay a quien premiar.');
  end if;

  update public.official_events
     set premios_en = now(), updated_at = now()
   where id = p_evento and premios_en is null;
  if not found then
    return jsonb_build_object('ok', false, 'error',
      'Otro reparto se adelanto; no se reparte dos veces.');
  end if;

  for v_fila in
    select * from public.tournament_standings
     where event_id = p_evento
     -- `puesto` manda cuando existe; si no, el orden calculado de siempre.
     order by coalesce(puesto, 32767) asc,
              points desc, omw_pct desc, gw_pct desc, player_name asc
  loop
    -- La posicion se cuenta SIEMPRE, tenga cuenta o no: quien jugo ocupa su
    -- puesto y corre a los de abajo.
    v_pos := v_pos + 1;

    if v_fila.user_id is null then
      v_sin_cuenta := v_sin_cuenta + 1;
      continue;
    end if;

    v_pts := (case v_pos when 1 then 10 when 2 then 7 when 3 then 5
                         when 4 then 3 else 1 end)
             + v_fila.match_wins * 3 + v_fila.match_draws;

    insert into public.tournament_results
      (user_id, tournament_name, position, total_players,
       ranking_points, match_wins, match_draws, xp_earned, played_at)
    values
      (v_fila.user_id, v_evento.name, v_pos, v_total,
       v_pts, v_fila.match_wins, v_fila.match_draws, v_xp, now());

    select coalesce(xp, 0) + v_xp into v_nuevo_xp
      from public.player_stats where user_id = v_fila.user_id;
    if found then
      v_nivel := 1; v_resto := v_nuevo_xp;
      while v_resto >= v_nivel * 100 loop
        v_resto := v_resto - v_nivel * 100;
        v_nivel := v_nivel + 1;
      end loop;
      update public.player_stats
         set xp = v_nuevo_xp,
             level = v_nivel,
             tournaments_finished = coalesce(tournaments_finished, 0) + 1,
             updated_at = now()
       where user_id = v_fila.user_id;
    end if;

    insert into public.monthly_xp (user_id, month, xp_gained, updated_at)
    values (v_fila.user_id, v_mes, v_xp, now())
    on conflict (user_id, month)
    do update set xp_gained = coalesce(public.monthly_xp.xp_gained, 0) + excluded.xp_gained,
                  updated_at = now();

    -- Sobres: 3 al campeon, 1 a cada quien mas.
    perform public.acreditar_sobres(
      v_fila.user_id,
      case when v_pos = 1 then 3 else 1 end,
      'torneo:' || v_evento.name);
    v_sobres := v_sobres + case when v_pos = 1 then 3 else 1 end;

    v_premiados := v_premiados + 1;
  end loop;

  return jsonb_build_object('ok', true, 'premiados', v_premiados,
                            'total', v_total, 'sobres', v_sobres,
                            'sin_cuenta', v_sin_cuenta);
end;
$$;

commit;

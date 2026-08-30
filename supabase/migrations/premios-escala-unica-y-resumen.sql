-- Premios de torneo: un sobre para todos, extras por podio, y la escala
-- escrita UNA sola vez.
--
-- Antes `_repartir_premios` daba 5 sobres PLANOS a cada jugador con cuenta,
-- sin mirar el puesto: un torneo premiaba igual al campeon invicto que al
-- 0-4, asi que ganarlo no valia nada distinto a presentarse. La escala nueva
-- la fijo Nel: 1 por participar, mas 4/3/2/1 al 1o/2o/3o/4o.
--
-- El aviso de resultados tiene que decirle a cada quien cuantos sobres gano.
-- Si el cliente vuelve a escribir «1 + 4/3/2/1», el dia que cambie la escala
-- van a existir dos verdades y la de la notificacion va a ser la vieja: la
-- gente leeria un numero distinto al que tiene en el saldo.
--
-- Asi que la escala es una funcion, `_repartir_premios` la usa para ACREDITAR
-- y `premios_de_torneo` la usa para CONTAR. Misma fuente, un solo cambio.

create or replace function public.sobres_por_puesto(p_pos int)
returns int
language sql
immutable
as $$
  select 1 + (case p_pos when 1 then 4 when 2 then 3
                         when 3 then 2 when 4 then 1 else 0 end);
$$;

create or replace function public._repartir_premios(p_evento uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_evento   public.official_events%rowtype;
  v_fila     record;
  v_pos      int := 0;
  v_total    int;
  v_xp       constant int := 500;
  v_sob      int;
  v_pts      int;
  v_nuevo_xp int;
  v_nivel    int;
  v_resto    int;
  v_mes      text := to_char(now() at time zone 'America/El_Salvador', 'YYYY-MM');
  v_premiados int := 0;
  v_sobres    int := 0;
  v_sin_cuenta text[] := '{}';
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
     order by coalesce(puesto, 32767) asc,
              points desc, omw_pct desc, gw_pct desc, player_name asc
  loop
    -- El contador sube ANTES de saltarse al que no tiene cuenta: si el
    -- tercero es un invitado, el cuarto sigue siendo cuarto.
    v_pos := v_pos + 1;

    if v_fila.user_id is null then
      v_sin_cuenta := v_sin_cuenta || v_fila.player_name;
      continue;
    end if;

    v_sob := public.sobres_por_puesto(v_pos);

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

    perform public.acreditar_sobres(v_fila.user_id, v_sob,
      'torneo:' || v_evento.name);
    v_sobres := v_sobres + v_sob;

    v_premiados := v_premiados + 1;
  end loop;

  return jsonb_build_object('ok', true, 'premiados', v_premiados,
                            'total', v_total, 'sobres', v_sobres,
                            'sin_cuenta', to_jsonb(v_sin_cuenta));
end;
$function$;

-- Lo que hace falta para redactar el aviso de cada jugador: su puesto, de
-- cuantos, y cuanto se llevo. `sin_cuenta` va incluido a proposito, con
-- `user_id` nulo: el que organiza tiene que VER a quien no le va a llegar
-- nada, en vez de que desaparezca de la lista.
create or replace function public.premios_de_torneo(p_code text)
returns table (user_id uuid, nombre text, puesto int, total int, sobres int, xp int)
language plpgsql
security definer
set search_path to ''
as $function$
declare v_ev uuid; v_total int;
begin
  if not exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin') then
    raise exception 'Solo un administrador puede ver el reparto.';
  end if;

  select id into v_ev from public.official_events where code = upper(p_code);
  if v_ev is null then raise exception 'No existe ese torneo.'; end if;

  select count(*) into v_total from public.tournament_standings where event_id = v_ev;

  return query
  with ordenado as (
    select s.user_id, s.player_name,
           row_number() over (order by coalesce(s.puesto, 32767),
                              s.points desc, s.omw_pct desc, s.gw_pct desc,
                              s.player_name)::int as pos
      from public.tournament_standings s
     where s.event_id = v_ev
  )
  select o.user_id, o.player_name, o.pos, v_total,
         public.sobres_por_puesto(o.pos),
         coalesce((select r.xp_earned from public.tournament_results r
                    where r.user_id = o.user_id
                      and r.tournament_name = (select name from public.official_events where id = v_ev)
                    order by r.played_at desc limit 1), 0)
    from ordenado o
   order by o.pos;
end;
$function$;

revoke all on function public.premios_de_torneo(text) from public, anon;
grant execute on function public.premios_de_torneo(text) to authenticated;

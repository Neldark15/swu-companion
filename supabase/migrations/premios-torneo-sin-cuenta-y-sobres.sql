-- Cerrar un torneo: tolerar jugadores SIN cuenta, y repartir sobres.
--
-- ── El fallo que había (anterior a los sobres) ────────────────────────
--
-- `_repartir_premios` reventaba si algún jugador de la clasificación no tenía
-- cuenta: `monthly_xp.user_id` es NOT NULL, el insert lanzaba 23502 y se caía
-- el cierre ENTERO — nadie cobraba nada, ni los que sí tenían cuenta.
--
-- No era hipotético: al medirlo, 3 de las 8 filas de `tournament_standings`
-- eran de jugadores sin cuenta. El único torneo afectado ya estaba cerrado, o
-- sea que el fallo estaba esperando al siguiente torneo con un invitado.
--
-- A quien no tiene cuenta no se le puede dar XP (no hay dónde guardarlo) pero
-- SÍ ocupa su puesto: la posición se sigue contando, que es lo que hace que el
-- de abajo sea tercero y no segundo. Comprobado: con el 2º sin cuenta, el
-- tercero queda registrado como 3º.
--
-- ── Y los sobres ─────────────────────────────────────────────────────
--
-- 3 al campeón, 1 a cada quien más. Va dentro de la misma guarda, porque es
-- exactamente la misma pregunta: ¿hay una cuenta a la que acreditarle esto?
--
-- El cuerpo completo de la función está en la migración
-- `premios_torneo_tolera_jugador_sin_cuenta_y_da_sobres` aplicada el
-- 2026-08-19; este archivo la documenta y la deja versionada.
--
-- Ojo al tocarla: `search_path` es '' , así que TODO va con esquema por
-- delante o no se resuelve.

create or replace function public._repartir_premios(p_evento uuid)
returns jsonb language plpgsql security definer set search_path to '' as $function$
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
     order by points desc, omw_pct desc, gw_pct desc, player_name asc
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
$function$;

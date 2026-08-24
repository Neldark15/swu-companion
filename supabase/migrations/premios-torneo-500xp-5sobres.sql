-- Premio de torneo: 500 XP y 5 sobres, PAREJO para todos los clasificados.
--
-- Aplicada en producción el 2026-08-23.
--
-- ── Qué cambia ───────────────────────────────────────────────────────
--
-- Antes: 50 XP a todos y 3 sobres al 1.º / 1 al resto. Decisión de Nel: el
-- premio sube y deja de escalonarse por puesto.
--
-- Lo que NO cambia, y conviene tenerlo presente antes de discutir si «ganar ya
-- no vale»: el puesto sigue pesando en `ranking_points` (10/7/5/3/1 +
-- victorias*3 + empates) y en la tabla de la temporada, que sale de
-- `tournament_standings.puesto`. Lo que pasa a ser de PARTICIPACIÓN es el XP y
-- los sobres.
--
-- ── Por qué van como constantes nombradas ────────────────────────────
--
-- El conteo del resumen (`v_sobres`, lo que devuelve la función) se calculaba
-- aparte repitiendo la MISMA expresión cableada. Con dos copias, la segunda se
-- olvida y el número que informa el reparto empieza a mentir — el mismo fallo
-- que el «enviados» de `enviarPush` (§3i). Un solo sitio, `v_xp` y `v_sob`.
--
-- ── Verificado en producción ─────────────────────────────────────────
--
-- Sobre SAN220826 (8 jugadores, todos con cuenta):
--   · devolvió {ok:true, premiados:8, sobres:40, sin_cuenta:0}
--   · los 8 subieron EXACTAMENTE +500 XP y +5 sobres contra la foto previa
--   · el pestillo aguanta: segundo intento → «ya repartio sus premios», y
--     `tournament_results` quedó en 8 filas, no 16.

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
  v_sob      constant int := 5;
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

  -- El pestillo. Un torneo reparte UNA vez y no hay reintento: destrabarlo a
  -- mano meses después premiaría a destiempo (ver el caso SV150826 en §3k).
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

  -- Transición atómica: si dos llamadas entran a la vez, solo una ve la fila.
  update public.official_events
     set premios_en = now(), updated_at = now()
   where id = p_evento and premios_en is null;
  if not found then
    return jsonb_build_object('ok', false, 'error',
      'Otro reparto se adelanto; no se reparte dos veces.');
  end if;

  -- Manda `puesto`. Ordenar por points/omw/gw dejaba que el desempate real
  -- fuera el ABECEDARIO en los torneos donde nadie escribe omw ni gw (§3k).
  for v_fila in
    select * from public.tournament_standings
     where event_id = p_evento
     order by coalesce(puesto, 32767) asc,
              points desc, omw_pct desc, gw_pct desc, player_name asc
  loop
    v_pos := v_pos + 1;

    -- Un invitado sin cuenta se cuenta y se salta: no hay a quién acreditarle.
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

    perform public.acreditar_sobres(v_fila.user_id, v_sob,
      'torneo:' || v_evento.name);
    v_sobres := v_sobres + v_sob;

    v_premiados := v_premiados + 1;
  end loop;

  return jsonb_build_object('ok', true, 'premiados', v_premiados,
                            'total', v_total, 'sobres', v_sobres,
                            'sin_cuenta', v_sin_cuenta);
end;
$function$;

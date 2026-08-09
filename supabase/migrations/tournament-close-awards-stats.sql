-- Cerrar un torneo REPARTE las estadísticas — antes no lo hacía nadie
--
-- ── Qué se encontró (torneo de Sonsonate, 2026-08-08) ────────────────
--
-- Tres fallos apilados, medidos contra la base de producción:
--
-- 1. El torneo del evento nunca corrió por la nube: `tournament_standings`,
--    `tournament_rounds` y `tournament_pairings` en CERO filas, el evento
--    seguía `open` con `current_round 0`. No hubo nada que guardar porque
--    nada se registró.
--
-- 2. Aunque hubiera corrido completo, `finishTournament()` solo hacía
--    `update official_events set status='finished'`. **Nadie repartía XP,
--    `tournaments_finished` ni `tournament_results`** en el flujo de nube:
--    `awardTournamentFinish()` existe pero solo lo llama el tracker local
--    viejo (TournamentLivePage).
--
-- 3. Y ese tracker local tiene su propia trampa: recorre a TODOS los
--    jugadores desde el dispositivo DEL ORGANIZADOR, pero las políticas son
--    `auth.uid() = user_id` («Update own stats», `tournament_results_insert_own`).
--    El update ajeno afecta 0 filas sin error (PostgREST devuelve éxito) y el
--    insert ajeno rebota por RLS dentro de un try/catch «best effort».
--    La prueba está en la base: `tournament_results` tiene UNA fila (marzo)
--    — la del propio organizador. Los demás jugadores de aquel torneo no
--    recibieron nada y nadie lo notó.
--
-- ── El arreglo ───────────────────────────────────────────────────────
--
-- El reparto se muda al SERVIDOR: `cerrar_torneo(evento)` es SECURITY DEFINER
-- —el único lugar desde donde se puede escribir stats de terceros sin abrirle
-- RLS al cliente— y hace todo en una transacción:
--
--   · verifica que quien llama sea ADMIN (ver la nota adentro: un
--     organizador que no sea admin no puede existir en este sistema)
--   · transición atómica open/active → finished (`where status <> 'finished'`):
--     llamarla dos veces NO premia dos veces
--   · por cada fila de `tournament_standings`, en el orden que ya usa la UI
--     (puntos ↓, OMW ↓, GW ↓, nombre ↑):
--       - `tournament_results` (posición, puntos de ranking, XP)
--       - `player_stats`: xp +50, `tournaments_finished` +1, nivel recalculado
--         con la MISMA curva de gamification.ts (resto >= nivel·100)
--       - `monthly_xp` del mes calendario DE EL SALVADOR (mesCalendarioSV)
--
-- Puntos de ranking: posición {1:10, 2:7, 3:5, 4:3, resto:1} + 3·victorias
-- + 1·empates — los mismos números de tournamentPoints.ts.

create or replace function public.cerrar_torneo(p_evento uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento   public.official_events%rowtype;
  v_fila     record;
  v_pos      int := 0;
  v_total    int;
  v_xp       constant int := 50;                  -- XP_VALUES.tournament_finished
  v_pts      int;
  v_nuevo_xp int;
  v_nivel    int;
  v_resto    int;
  v_mes      text := to_char(now() at time zone 'America/El_Salvador', 'YYYY-MM');
  v_premiados int := 0;
begin
  select * into v_evento from public.official_events where id = p_evento;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'El evento no existe.');
  end if;

  -- ADMIN, sin rama de organizador.
  --
  -- Un organizador que no sea admin NO PUEDE EXISTIR, y no por costumbre sino
  -- por construcción: crear un evento exige admin (`events_insert`), y llevar
  -- rondas, emparejamientos y clasificación también (las tres tablas piden
  -- role='admin'). El panel corta a los no-admin de entrada. Comprobado sobre
  -- la base: 0 eventos con organizador que no sea admin.
  --
  -- La rama `organizer_id = auth.uid()` sugería un rol que el sistema no puede
  -- producir; alguien podía construir encima de esa premisa falsa. Una sola
  -- regla en todas las capas: los torneos los llevan los administradores.
  if not exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin') then
    return jsonb_build_object('ok', false, 'error',
      'Solo un administrador puede cerrar el torneo.');
  end if;

  -- Atómico: si dos pestañas cierran a la vez, solo una reparte.
  update public.official_events
     set status = 'finished', updated_at = now()
   where id = p_evento and status <> 'finished';
  if not found then
    return jsonb_build_object('ok', false, 'error',
      'El torneo ya estaba cerrado; no se reparte dos veces.');
  end if;

  select count(*) into v_total
    from public.tournament_standings where event_id = p_evento;

  -- Sin standings el torneo nunca se inicializó: se cierra el evento pero se
  -- dice la verdad — no hay a quién premiar.
  if v_total = 0 then
    return jsonb_build_object('ok', true, 'premiados', 0, 'total', 0,
      'aviso', 'El torneo no tenía clasificación registrada: no hay stats que repartir.');
  end if;

  for v_fila in
    select * from public.tournament_standings
     where event_id = p_evento
     order by points desc, omw_pct desc, gw_pct desc, player_name asc
  loop
    v_pos := v_pos + 1;
    v_pts := (case v_pos when 1 then 10 when 2 then 7 when 3 then 5
                         when 4 then 3 else 1 end)
             + v_fila.match_wins * 3 + v_fila.match_draws;

    insert into public.tournament_results
      (user_id, tournament_name, position, total_players,
       ranking_points, match_wins, match_draws, xp_earned, played_at)
    values
      (v_fila.user_id, v_evento.name, v_pos, v_total,
       v_pts, v_fila.match_wins, v_fila.match_draws, v_xp, now());

    -- La curva de nivel de gamification.ts, tal cual: subir de nivel cuesta
    -- nivel·100 y el resto arrastra.
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

    v_premiados := v_premiados + 1;
  end loop;

  return jsonb_build_object('ok', true, 'premiados', v_premiados, 'total', v_total);
end;
$$;

-- Ejecutable solo con sesión; el chequeo de admin vive adentro.
revoke all on function public.cerrar_torneo(uuid) from public, anon;
grant execute on function public.cerrar_torneo(uuid) to authenticated;

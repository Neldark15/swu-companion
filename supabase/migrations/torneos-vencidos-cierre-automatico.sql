-- Cierre automático de torneos vencidos, con el reparto SEPARADO del cierre
--
-- ── El problema ──────────────────────────────────────────────────────
--
-- Un torneo que ya se jugó se quedaba `open` para siempre: nadie lo cerraba.
-- Medido sobre producción el 2026-08-10: el único evento que existe,
-- «Sonsonate SWU 08 Ago», seguía `open` dos días después de su fecha, con 4
-- inscritos y CERO clasificación, rondas o emparejamientos — el torneo se jugó
-- en la mesa pero nunca se registró en la app.
--
-- Ese caso es justamente el que obliga a distinguir dos situaciones que a
-- simple vista parecen la misma:
--
--   · **Vencido CON clasificación** — el torneo se llevó en la app y hay
--     resultados. Se puede cerrar.
--   · **Vencido SIN clasificación** — se jugó afuera y no quedó registro.
--     Cerrarlo lo entierra: pasaría a «Finalizado» sin resultados que ver, y
--     los cuatro que se inscribieron no aparecerían en ningún lado nunca más.
--     A este NO se lo cierra: se lo marca para que alguien cargue lo que pasó.
--
-- ── Por qué cerrar y repartir dejan de ser lo mismo ──────────────────
--
-- `cerrar_torneo()` hacía las dos cosas de un saque, y para el botón de
-- «Finalizar» eso está bien: el organizador está ahí mirando la clasificación.
-- Pero un cron repartiendo XP, puntos de ranking y subidas de nivel sin que
-- nadie mire es otra cosa — si la clasificación quedó torcida, el premio ya
-- salió. Así que el cron CIERRA y el reparto queda a un toque de un admin, que
-- lo confirma viendo la tabla.
--
-- `premios_en` es lo que hace posible esa separación: marca CUÁNDO se repartió,
-- y su ausencia distingue «cerrado, falta repartir» de «cerrado y repartido».
-- Sin esa columna, el `where status <> 'finished'` que evita el doble premio
-- también habría bloqueado el reparto diferido.

alter table public.official_events
  add column if not exists premios_en timestamptz;

comment on column public.official_events.premios_en is
  'Cuándo se repartieron XP y puntos de ranking. NULL = todavía no. Permite '
  'cerrar un torneo sin premiar y premiar después, con alguien mirando.';

-- Los torneos cerrados ANTES de esta migración ya repartieron dentro de
-- `cerrar_torneo`, así que se marcan como repartidos: si no, aparecerían como
-- pendientes y un segundo reparto duplicaría el XP.
update public.official_events
   set premios_en = coalesce(updated_at, now())
 where status = 'finished' and premios_en is null;


-- ── El reparto, una sola vez y en un solo lugar ──────────────────────
--
-- Interno: lo llaman `cerrar_torneo` (botón del organizador) y
-- `repartir_premios` (confirmación diferida). Tener DOS copias de esta lógica
-- era la forma segura de que se separaran con el tiempo.
create or replace function public._repartir_premios(p_evento uuid)
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

  -- Cerrojo del doble premio. Antes lo hacía la transición de estado; ahora que
  -- cerrar y repartir son pasos distintos, el cerrojo tiene que estar acá.
  if v_evento.premios_en is not null then
    return jsonb_build_object('ok', false, 'error',
      'Este torneo ya repartió sus premios; no se reparte dos veces.');
  end if;

  select count(*) into v_total
    from public.tournament_standings where event_id = p_evento;

  if v_total = 0 then
    return jsonb_build_object('ok', false, 'error',
      'El torneo no tiene clasificación registrada: no hay a quién premiar.');
  end if;

  -- Se marca ANTES del bucle: si dos pestañas confirman a la vez, la segunda
  -- encuentra `premios_en` puesto y sale por el cerrojo de arriba.
  update public.official_events
     set premios_en = now(), updated_at = now()
   where id = p_evento and premios_en is null;
  if not found then
    return jsonb_build_object('ok', false, 'error',
      'Otro reparto se adelantó; no se reparte dos veces.');
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

revoke all on function public._repartir_premios(uuid) from public, anon, authenticated;


-- ── Cerrar (botón del organizador): cierra Y reparte ─────────────────
--
-- Se conserva el comportamiento de siempre porque el organizador está delante
-- de la clasificación cuando lo toca. Lo único que cambia es que el reparto
-- ahora vive en `_repartir_premios`.
create or replace function public.cerrar_torneo(p_evento uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- ADMIN, sin rama de organizador: crear un evento y llevar rondas ya exigen
  -- admin, así que un organizador que no sea admin no puede existir. Una sola
  -- regla en todas las capas (gotcha 2u).
  if not exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin') then
    return jsonb_build_object('ok', false, 'error',
      'Solo un administrador puede cerrar el torneo.');
  end if;

  -- Sin `if not found`: da igual si el UPDATE tocó una fila o cero. Que ya
  -- estuviera cerrado NO es motivo para no repartir — puede haberlo cerrado el
  -- cron, que a propósito no premia. Quien decide si corresponde premiar es
  -- `_repartir_premios`, que tiene su propio cerrojo (`premios_en`) y dice que
  -- no cuando ya se repartió.
  update public.official_events
     set status = 'finished', updated_at = now()
   where id = p_evento and status <> 'finished';

  return public._repartir_premios(p_evento);
end;
$$;

revoke all on function public.cerrar_torneo(uuid) from public, anon;
grant execute on function public.cerrar_torneo(uuid) to authenticated;


-- ── Repartir después (confirmación del admin) ────────────────────────
create or replace function public.repartir_premios(p_evento uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin') then
    return jsonb_build_object('ok', false, 'error',
      'Solo un administrador puede repartir los premios.');
  end if;
  return public._repartir_premios(p_evento);
end;
$$;

revoke all on function public.repartir_premios(uuid) from public, anon;
grant execute on function public.repartir_premios(uuid) to authenticated;


-- ── El cron: cierra los vencidos CON clasificación, y no premia ──────
create or replace function public.vencer_torneos()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Doce horas desde la hora de inicio. Un suizo de 16 personas son unas cuatro
  -- rondas de 50 minutos más descansos: cuatro o cinco horas. Doce da margen de
  -- sobra sin dejar el torneo abierto hasta el otro día.
  v_gracia constant interval := interval '12 hours';
  -- Y además: si el evento se tocó hace poco, algo está pasando ahí. No se
  -- cierra por debajo de las manos de nadie.
  v_quieto constant interval := interval '3 hours';
  v_cerrados uuid[];
  v_sin_datos int;
begin
  with vencidos as (
    update public.official_events e
       set status = 'finished', updated_at = now()
     where e.status <> 'finished'
       and e.status <> 'cancelled'
       and e.date < now() - v_gracia
       and coalesce(e.updated_at, e.created_at) < now() - v_quieto
       -- SOLO los que tienen clasificación. Sin ella, cerrar es enterrar: el
       -- evento pasaría a «Finalizado» sin nada que mostrar y los inscritos
       -- desaparecerían de la vista. Esos quedan abiertos y se reportan abajo
       -- para que alguien cargue lo que pasó.
       and exists (select 1 from public.tournament_standings s where s.event_id = e.id)
     returning e.id
  )
  select array_agg(id) into v_cerrados from vencidos;

  select count(*) into v_sin_datos
    from public.official_events e
   where e.status <> 'finished'
     and e.status <> 'cancelled'
     and e.date < now() - v_gracia
     and not exists (select 1 from public.tournament_standings s where s.event_id = e.id);

  return jsonb_build_object(
    'ok', true,
    'cerrados', coalesce(array_length(v_cerrados, 1), 0),
    'ids', coalesce(to_jsonb(v_cerrados), '[]'::jsonb),
    -- Cuántos quedaron vencidos y vacíos. Es el número que hay que mirar: si
    -- crece, hay torneos jugándose fuera de la app.
    'sin_resultados', v_sin_datos
  );
end;
$$;

-- Solo el cron (service role). Sin `auth.uid()` no puede haber chequeo de
-- admin adentro, así que la puerta es el GRANT.
revoke all on function public.vencer_torneos() from public, anon, authenticated;
grant execute on function public.vencer_torneos() to service_role;


-- ── Lo que el panel necesita ver ─────────────────────────────────────
--
-- Dos listas distintas, no una: «falta cargar los resultados» y «falta
-- confirmar el reparto» piden acciones diferentes.
create or replace function public.torneos_pendientes()
returns table (
  id uuid,
  -- El panel del torneo se abre por CODIGO (/events/dashboard/:code), no por
  -- id: sin este campo el boton «Cargar resultados» apuntaba a una ruta que no
  -- existe y el comodin lo mandaba a Inicio.
  code text,
  name text,
  date timestamptz,
  status text,
  inscritos bigint,
  clasificados bigint,
  premios_en timestamptz,
  motivo text
)
language sql
security definer
set search_path = ''
as $$
  select
    e.id, e.code, e.name, e.date, e.status,
    (select count(*) from public.event_registrations r where r.event_id = e.id),
    (select count(*) from public.tournament_standings s where s.event_id = e.id),
    e.premios_en,
    case
      when not exists (select 1 from public.tournament_standings s where s.event_id = e.id)
        then 'faltan_resultados'
      else 'falta_repartir'
    end
  from public.official_events e
  where exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role = 'admin')
    and e.status <> 'cancelled'
    and (
      -- Vencido y sin clasificación: nadie cargó lo que pasó.
      (e.status <> 'finished' and e.date < now() - interval '12 hours'
        and not exists (select 1 from public.tournament_standings s where s.event_id = e.id))
      -- O cerrado con clasificación pero sin repartir todavía.
      or (e.status = 'finished' and e.premios_en is null
        and exists (select 1 from public.tournament_standings s where s.event_id = e.id))
    )
  order by e.date asc;
$$;

revoke all on function public.torneos_pendientes() from public, anon;
grant execute on function public.torneos_pendientes() to authenticated;

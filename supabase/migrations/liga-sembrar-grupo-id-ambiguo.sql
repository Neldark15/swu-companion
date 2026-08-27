-- ═══ LIGA — el `id` ambiguo que rompía el sorteo del calendario ═══
--
-- Reemplaza public.liga_sembrar_grupo: el array_agg que ordena el sorteo
-- calificaba `id` sin decir de qué tabla, y las tres del join (liga_plazas,
-- liga_grupos, liga_temporadas) tienen una. Aplicada en producción el
-- 2026-08-27, encima de `liga-internacional-rpcs.sql`.

-- `array_agg(id ...)` era ambiguo: liga_plazas, liga_grupos y liga_temporadas
-- tienen las tres una columna `id`. Postgres corta con 42702 — ruidoso, que es
-- lo bueno; lo peligroso habría sido que eligiera una.
create or replace function public.liga_sembrar_grupo(p_grupo uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_liga uuid; v_ids uuid[]; n int; i int; j int; ronda int; mitad int;
  v_gira uuid[]; v_dias int; v_arranca date; v_cierra date; v_creadas int := 0;
begin
  select t.liga_id, g.arranca, g.cierra into v_liga, v_arranca, v_cierra
    from public.liga_grupos g join public.liga_temporadas t on t.id = g.temporada_id
   where g.id = p_grupo;
  if v_liga is null then return jsonb_build_object('ok', false, 'error', 'No existe ese grupo.'); end if;
  if not public.liga_es_staff(v_liga) then
    return jsonb_build_object('ok', false, 'error', 'Esa liga no es tuya.');
  end if;

  update public.liga_grupos set sembrado_en = now(), estado = 'en_curso'
   where id = p_grupo and sembrado_en is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ese grupo ya tiene calendario.');
  end if;

  -- El orden sale de md5(semilla || plaza): puro, estable entre versiones de
  -- Postgres y comprobable por cualquiera con una calculadora de md5. La
  -- semilla se publica en la temporada.
  select array_agg(p.id order by md5(t.semilla || p.id::text)) into v_ids
    from public.liga_plazas p
    join public.liga_grupos g on g.id = p.grupo_id
    join public.liga_temporadas t on t.id = g.temporada_id
   where p.grupo_id = p_grupo;

  n := coalesce(array_length(v_ids, 1), 0);
  if n < 4 then
    return jsonb_build_object('ok', false, 'error', 'Ese grupo no tiene plazas suficientes.');
  end if;
  if n % 2 = 1 then v_ids := v_ids || null::uuid; n := n + 1; end if;
  mitad := n / 2;
  v_gira := v_ids;
  v_dias := greatest(1, ((v_cierra - v_arranca) / greatest(1, n - 1))::int);

  for ronda in 1..(n - 1) loop
    for i in 1..mitad loop
      j := n + 1 - i;
      if v_gira[i] is not null and v_gira[j] is not null then
        insert into public.liga_partidas
          (liga_id, grupo_id, jornada, local_plaza, visita_plaza, estado, vence_el)
        values (v_liga, p_grupo, ronda,
                case when ronda % 2 = 0 then v_gira[j] else v_gira[i] end,
                case when ronda % 2 = 0 then v_gira[i] else v_gira[j] end,
                'programada', v_arranca + (v_dias * ronda));
        v_creadas := v_creadas + 1;
      end if;
    end loop;
    v_gira := v_gira[1:1] || v_gira[n:n] || v_gira[2:n-1];
  end loop;

  return jsonb_build_object('ok', true, 'partidas', v_creadas, 'jornadas', n - 1);
end;
$function$;
revoke all on function public.liga_sembrar_grupo(uuid) from anon, public;
grant execute on function public.liga_sembrar_grupo(uuid) to authenticated;

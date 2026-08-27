-- Aplicada en produccion el 2026-08-27. Ver supabase_migrations.schema_migrations.

-- `mi_liga()` quedó ROTA al rehacer la forma de la liga: seguía armando su
-- JSON con `p.local_insc` y `p.visita_insc`, columnas que la migración del
-- esquema dropeó. Devolvía 42703, el cliente se lo tragaba en un
-- `console.warn` y la tarjeta del perfil dejaba de dibujarse **para todos**,
-- sin un solo error a la vista. El fallo que se ve como «no tenés liga».
--
-- Verificado antes de tocar nada, con una inscripción de prueba en
-- transacción revertida: `42703 — column p.local_insc does not exist`.
--
-- Y de paso se RECORTA A MI GRUPO. Antes traía la liga entera; a 120 plazas
-- eso son ~145 KB de JSON no cacheable en cada apertura del Perfil, que es la
-- pantalla que más se abre (§4m). Mi grupo son 8 plazas y 28 partidas: ~9 KB.

create or replace function public.mi_liga()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_yo uuid := auth.uid();
  v_plaza uuid; v_grupo uuid; v_liga uuid;
begin
  if v_yo is null then
    return jsonb_build_object('ok', false, 'error', 'Sin sesion.');
  end if;

  -- La plaza viva más reciente. La identidad dentro de la competencia es la
  -- PLAZA, no la cuenta (§3q).
  select p.id, p.grupo_id, t.liga_id
    into v_plaza, v_grupo, v_liga
    from public.liga_plazas p
    join public.liga_grupos g on g.id = p.grupo_id
    join public.liga_temporadas t on t.id = g.temporada_id
    join public.liga_inscripciones i on i.id = p.inscripcion_id
   where i.user_id = v_yo and p.estado = 'activa' and t.estado <> 'cerrada'
   order by p.sentada_en desc
   limit 1;

  if v_plaza is null then
    -- Sin plaza no es un error: es el caso normal de casi todo el mundo.
    return jsonb_build_object('ok', true, 'liga', null);
  end if;

  return jsonb_build_object(
    'ok', true,
    'miPlaza', v_plaza,
    'liga', (select jsonb_build_object('id', l.id, 'code', l.code, 'nombre', l.nombre,
                                       'estado', l.estado)
               from public.ligas l where l.id = v_liga),
    'grupo', (select jsonb_build_object('id', g.id, 'tier', g.tier, 'orden', g.orden,
                                        'estado', g.estado, 'cierra', g.cierra)
                from public.liga_grupos g where g.id = v_grupo),
    'plazas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'grupoId', p.grupo_id, 'nombre', p.nombre_visible,
        'lider', p.lider_card_id, 'base', p.base_card_id, 'estado', p.estado,
        'esMia', p.id = v_plaza) order by p.sentada_en)
        from public.liga_plazas p where p.grupo_id = v_grupo), '[]'::jsonb),
    'partidas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'grupoId', m.grupo_id, 'jornada', m.jornada,
        'localPlaza', m.local_plaza, 'visitaPlaza', m.visita_plaza,
        'vl', m.victorias_local, 'vv', m.victorias_visita,
        'estado', m.estado, 'origen', m.origen, 'venceEl', m.vence_el,
        'vod', m.vod_youtube_id, 'reportadaPor', m.reportada_por) order by m.jornada)
        from public.liga_partidas m where m.grupo_id = v_grupo), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.mi_liga() from anon, public;
grant execute on function public.mi_liga() to authenticated;

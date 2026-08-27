-- Aplicada en produccion el 2026-08-27. Ver supabase_migrations.schema_migrations.

-- `liga_ver` emitía `local`/`visita` y `mi_liga` `localPlaza`/`visitaPlaza`:
-- dos nombres para el mismo dato, y el cliente lee la forma larga. Cada
-- partida se habría pintado VACÍA —sin rival, sin marcador— y sin un solo
-- error, porque un campo ausente en JSON llega como `undefined`.
--
-- Se unifica en la forma larga, que es la que ya usaba `mi_liga`. Un mismo
-- dato con dos nombres es el §3c en su versión más barata de arreglar y más
-- cara de descubrir.
create or replace function public.liga_ver(p_code text)
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_liga uuid; v_temp uuid;
begin
  if not public.liga_visible() then
    return jsonb_build_object('ok', true, 'liga', null, 'aviso', 'todavia no esta abierta');
  end if;
  select id into v_liga from public.ligas where code = p_code;
  if v_liga is null then return jsonb_build_object('ok', true, 'liga', null); end if;
  select id into v_temp from public.liga_temporadas
   where liga_id = v_liga and estado <> 'cerrada' limit 1;

  return jsonb_build_object(
    'ok', true,
    'liga', (select jsonb_build_object('id', l.id, 'code', l.code, 'nombre', l.nombre,
                                       'estado', l.estado, 'descripcion', l.descripcion,
                                       'tamanoGrupo', l.tamano_grupo,
                                       'esStaff', public.liga_es_staff(l.id))
               from public.ligas l where l.id = v_liga),
    'temporada', (select jsonb_build_object('id', t.id, 'nombre', t.nombre, 'numero', t.numero,
                                            'estado', t.estado, 'arranca', t.arranca, 'cierra', t.cierra)
                    from public.liga_temporadas t where t.id = v_temp),
    'miInscripcion', (select i.id from public.liga_inscripciones i
                       where i.liga_id = v_liga and i.user_id = auth.uid()),
    'grupos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'tier', g.tier, 'orden', g.orden, 'estado', g.estado,
        'arranca', g.arranca, 'cierra', g.cierra,
        'plazas', (select coalesce(jsonb_agg(jsonb_build_object(
              'id', p.id, 'grupoId', p.grupo_id, 'nombre', p.nombre_visible,
              'lider', p.lider_card_id, 'base', p.base_card_id, 'estado', p.estado,
              'esMia', exists (select 1 from public.liga_inscripciones ii
                                where ii.id = p.inscripcion_id and ii.user_id = auth.uid()))
              order by p.sentada_en), '[]'::jsonb)
            from public.liga_plazas p where p.grupo_id = g.id),
        'partidas', (select coalesce(jsonb_agg(jsonb_build_object(
              'id', m.id, 'grupoId', m.grupo_id, 'jornada', m.jornada,
              'localPlaza', m.local_plaza, 'visitaPlaza', m.visita_plaza,
              'vl', m.victorias_local, 'vv', m.victorias_visita,
              'estado', m.estado, 'origen', m.origen, 'venceEl', m.vence_el,
              'vod', m.vod_youtube_id, 'reportadaPor', m.reportada_por)
              order by m.jornada), '[]'::jsonb)
            from public.liga_partidas m where m.grupo_id = g.id))
        order by case g.tier when 'legendario' then 0 when 'raro' then 1
                             when 'infrecuente' then 2 else 3 end, g.orden)
        from public.liga_grupos g where g.temporada_id = v_temp), '[]'::jsonb)
  );
end;
$function$;
revoke all on function public.liga_ver(text) from anon, public;
grant execute on function public.liga_ver(text) to authenticated;

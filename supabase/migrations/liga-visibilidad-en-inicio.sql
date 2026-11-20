-- Controla la promoción en Inicio independientemente de la gestión de la liga.
alter table public.ligas
  add column if not exists mostrar_en_inicio boolean not null default true;

update public.ligas set mostrar_en_inicio = false
where code = 'puente3' and mostrar_en_inicio;

create or replace function public.liga_para_inicio()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(
    (select jsonb_build_object(
       'code', l.code,
       'nombre', l.nombre,
       'estado', l.estado,
       'emblemaUrl', l.emblema_url,
       'esStaff', public.liga_es_staff(l.id),
       'inscrito', exists (select 1 from public.liga_inscripciones i
                            where i.liga_id = l.id and i.user_id = auth.uid()),
       'temporada', (select jsonb_build_object('estado', t.estado,
                                               'inscripcionCierra', t.inscripcion_cierra,
                                               'arranca', t.arranca)
                       from public.liga_temporadas t
                      where t.liga_id = l.id and t.estado <> 'cerrada' limit 1))
       from public.ligas l
      where l.mostrar_en_inicio and l.estado in ('borrador','inscripcion','activa')
        and (
          public.liga_es_staff(l.id)
          or exists (select 1 from public.liga_inscripciones i
                      where i.liga_id = l.id and i.user_id = auth.uid())
          or l.publica
          or exists (select 1 from public.liga_probadores p where p.user_id = auth.uid())
        )
      order by (public.liga_es_staff(l.id)) desc,
               (exists (select 1 from public.liga_inscripciones i
                         where i.liga_id = l.id and i.user_id = auth.uid())) desc,
               l.creado_en
      limit 1),
    jsonb_build_object('code', null));
$function$;

-- El ranking, desglosado por fuente.
--
-- La funcion juntaba torneos y amistosas con un union all y sumaba todo en una
-- sola columna de puntos. Eso responde «quien gana mas», pero no deja
-- responder «quien gana en TORNEO», que es otra pregunta. Medido el dia que se
-- separo: quien encabezaba tenia 27 puntos con 6 salidos de 10 amistosas,
-- mientras la que gano el torneo invicta tenia 12 de puro torneo.
--
-- En vez de un parametro de filtro, cada fila trae el desglose. Asi la
-- pantalla muestra las tres vistas sin volver a preguntarle al servidor, y
-- sobre todo sin que existan DOS consultas que puedan dejar de coincidir.
--
-- Un p_fuente seria una CUARTA firma conviviendo; PostgREST resuelve por
-- nombre de argumento y una PWA sin actualizar seguiria cayendo en la vieja.
--
-- Hay que DROP antes del CREATE (§3s): cambia el RETURNS TABLE, y
-- `create or replace` no puede cambiar la forma de lo que devuelve. Se dropea
-- la MISMA firma de tres argumentos que se recrea abajo.

drop function if exists public.ranking_unificado(timestamptz, timestamptz, uuid);

create or replace function public.ranking_unificado(
  p_desde timestamptz default '2000-01-01 00:00:00+00'::timestamptz,
  p_hasta timestamptz default 'infinity'::timestamptz,
  p_sede  uuid default null
)
returns table (
  clave text, nombre text, user_id uuid, avatar text,
  puntos bigint, victorias bigint, derrotas bigint, empates bigint,
  torneos bigint, amistosas bigint,
  puntos_torneo bigint, victorias_torneo bigint, derrotas_torneo bigint, empates_torneo bigint,
  puntos_amistosa bigint, victorias_amistosa bigint, derrotas_amistosa bigint
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with de_torneo as (
    select
      coalesce(s.user_id::text, 'nombre:'||lower(trim(s.player_name))) as clave,
      s.user_id,
      coalesce(pr.name, s.player_name) as nombre,
      coalesce(s.match_wins,0)::bigint   as v,
      coalesce(s.match_losses,0)::bigint as d,
      coalesce(s.match_draws,0)::bigint  as e,
      coalesce(s.match_wins,0)::bigint * 3 + coalesce(s.match_draws,0)::bigint as pts,
      1::bigint as torneos, 0::bigint as amistosas
    from tournament_standings s
    join official_events ev on ev.id = s.event_id
    left join profiles pr on pr.id = s.user_id
    where (coalesce(trim(s.player_name),'') <> '' or s.user_id is not null)
      and coalesce(ev.date, ev.created_at) >= p_desde
      and coalesce(ev.date, ev.created_at) <  p_hasta
      and (p_sede is null or ev.venue_id = p_sede)
  ),
  de_amistosa as (
    select creador_id::text, creador_id, null::text,
           (case when victorias_creador > victorias_rival then 1 else 0 end)::bigint,
           (case when victorias_rival > victorias_creador then 1 else 0 end)::bigint,
           0::bigint,
           (case when victorias_creador > victorias_rival then 1 else 0 end)::bigint,
           0::bigint, 1::bigint
    from duelos_amistosos
    where p_sede is null and estado = 'confirmada' and created_at >= p_desde and created_at < p_hasta
    union all
    select rival_id::text, rival_id, null::text,
           (case when victorias_rival > victorias_creador then 1 else 0 end)::bigint,
           (case when victorias_creador > victorias_rival then 1 else 0 end)::bigint,
           0::bigint,
           (case when victorias_rival > victorias_creador then 1 else 0 end)::bigint,
           0::bigint, 1::bigint
    from duelos_amistosos
    where p_sede is null and estado = 'confirmada' and rival_id is not null
      and created_at >= p_desde and created_at < p_hasta
  ),
  todo as (select * from de_torneo union all select * from de_amistosa)
  select t.clave,
         coalesce(max(t.nombre), max(pr.name), 'Jugador'),
         (array_agg(t.user_id) filter (where t.user_id is not null))[1],
         max(pr.avatar),
         sum(t.pts)::bigint,
         sum(t.v)::bigint, sum(t.d)::bigint, sum(t.e)::bigint,
         sum(t.torneos)::bigint, sum(t.amistosas)::bigint,
         -- El desglose sale del MISMO union all que el total, marcado por la
         -- columna que ya distinguia el origen. Sumar aparte en otra consulta
         -- seria la forma de que un dia el total no cuadre con las partes.
         coalesce(sum(t.pts) filter (where t.torneos = 1), 0)::bigint,
         coalesce(sum(t.v)   filter (where t.torneos = 1), 0)::bigint,
         coalesce(sum(t.d)   filter (where t.torneos = 1), 0)::bigint,
         coalesce(sum(t.e)   filter (where t.torneos = 1), 0)::bigint,
         coalesce(sum(t.pts) filter (where t.amistosas = 1), 0)::bigint,
         coalesce(sum(t.v)   filter (where t.amistosas = 1), 0)::bigint,
         coalesce(sum(t.d)   filter (where t.amistosas = 1), 0)::bigint
  from todo t
  left join profiles pr on pr.id = t.user_id
  group by t.clave
  having sum(t.v) + sum(t.d) + sum(t.e) > 0
  order by 5 desc, 6 desc, 2;
$function$;

revoke all on function public.ranking_unificado(timestamptz, timestamptz, uuid) from public;
grant execute on function public.ranking_unificado(timestamptz, timestamptz, uuid) to anon, authenticated;

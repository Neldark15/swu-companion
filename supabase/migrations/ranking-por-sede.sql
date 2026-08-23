-- ═══════════════════════════════════════════════════════════════════════
--  RANKING POR SEDE
-- ═══════════════════════════════════════════════════════════════════════
--
--  `ranking_unificado` gana `p_sede`. Con sede puesta, la tabla es la de esa
--  tienda; sin ella, sigue siendo la de siempre.
--
--  ── Con sede, las AMISTOSAS quedan fuera ─────────────────────────────
--
--  Y no es un olvido. Una amistosa se juega en la casa de cualquiera y no
--  tiene sede: `duelos_amistosos` no tiene columna para eso y no debería
--  tenerla. Repartir las amistosas entre las sedes seria inventar dónde se
--  jugaron, y dejarlas en TODAS las sedes haria que la suma de los rankings
--  por sede no diera nunca el global.
--
--  Así que el ranking de una sede mide lo que pasó EN esa sede: torneos. Y el
--  global sigue midiendo todo. La pantalla lo dice con todas las letras,
--  porque un jugador que ve menos puntos en la tabla de su tienda que en la
--  general merece saber por qué.
--
--  ── Ojo con las sobrecargas ──────────────────────────────────────────
--
--  Agregar un tercer parámetro con default NO reemplaza a la función vieja:
--  crea una SEGUNDA función, y entonces `ranking_unificado()` sin argumentos
--  es ambiguo y Postgres se niega con «is not unique». Hay que DROP de la
--  firma de dos parámetros. Por eso el drop va primero y en el mismo archivo.
-- ═══════════════════════════════════════════════════════════════════════

begin;

drop function if exists public.ranking_unificado(timestamptz, timestamptz);

create or replace function public.ranking_unificado(
  p_desde timestamptz default '2000-01-01',
  p_hasta timestamptz default 'infinity',
  p_sede  uuid        default null
)
returns table(clave text, nombre text, user_id uuid, avatar text, puntos bigint,
              victorias bigint, derrotas bigint, empates bigint,
              torneos bigint, amistosas bigint)
language sql stable security definer set search_path to 'public'
as $fn$
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
         sum(t.torneos)::bigint, sum(t.amistosas)::bigint
  from todo t
  left join profiles pr on pr.id = t.user_id
  group by t.clave
  having sum(t.v) + sum(t.d) + sum(t.e) > 0
  order by 5 desc, 6 desc, 2;
$fn$;

-- §3i: Postgres concede EXECUTE a PUBLIC en toda funcion nueva.
revoke all on function public.ranking_unificado(timestamptz, timestamptz, uuid) from public;
grant execute on function public.ranking_unificado(timestamptz, timestamptz, uuid) to anon, authenticated;

commit;

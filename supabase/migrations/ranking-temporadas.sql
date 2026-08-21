-- ═══════════════════════════════════════════════════════════════════════
-- Ranking por periodo: temporada (de set a set), año y mes.
--
-- ── EL FALLO QUE ESTO ARREGLA, Y QUE ESTABA VIVO ────────────────────────
--
-- `ranking_unificado(p_desde)` ya existía y la pantalla ya ofrecía ventanas
-- de «90 días» y «30 días». Pero el parámetro solo se aplicaba a las
-- AMISTOSAS: el bloque `de_torneo` no tenía ni una condición de fecha, y
-- `tournament_standings` ni siquiera tiene columna de fecha —vive en
-- `official_events.date`, a un join de distancia.
--
-- Medido antes de tocar nada:
--
--     ranking_unificado('2000-01-01')      → 11 filas · 8 torneos · 12 amistosas
--     ranking_unificado(now() - 1 hora)    →  8 filas · 8 torneos ·  0 amistosas
--
-- Los MISMOS 8 torneos en una ventana de una hora. O sea que «30 días»
-- mostraba todos los torneos de la historia con las amistosas del mes: dos
-- criterios distintos sumados en una sola columna de puntos. No es que
-- faltara una función, es que la que había mentía.
--
-- ── POR QUÉ LAS TEMPORADAS SE ESCRIBEN A MANO ──────────────────────────
--
-- Una temporada va de la salida de un set a la del siguiente, así que hacen
-- falta las fechas de salida. NO se pueden bajar. Medido hoy contra
-- api.swuapi.com/sets: de 28 sets, solo 3 traen `release_date`, y los tres
-- son sets «Weekly Play» que además cargan la fecha del set BASE (SORP dice
-- 2024-03-08, que es la salida de Spark of Rebellion, no la suya).
--
-- El sitio oficial sí las publica limpias, pero sus términos de uso prohíben
-- textualmente los «bots, scrapers», y esa puerta ya se cerró a propósito
-- cuando se hizo el bot de noticias. Ver §3h-ter de CLAUDE.md.
--
-- Son cuatro fechas al año y las sabe cualquiera que juegue. Se escriben.
-- Inventarlas para que la pestaña no salga vacía sería exactamente el error
-- que el bot de noticias evita: publicar un dato que nadie verificó.
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ── Las temporadas ─────────────────────────────────────────────────────

create table if not exists public.temporadas (
  id         uuid primary key default gen_random_uuid(),
  -- El código del set que la abre (ASH, LAW, SEC…). Es la identidad de la
  -- temporada para quien juega: nadie dice «la temporada 3», dice «Ashes».
  set_code   text not null,
  nombre     text not null,
  empieza    date not null,
  -- Abierta mientras no salga el set siguiente. La consulta lo trata como
  -- «hasta el infinito», así que una temporada en curso no necesita que
  -- nadie la cierre a mano el día que sale el próximo set.
  termina    date,
  creada_en  timestamptz not null default now(),
  constructor uuid references public.profiles(id) on delete set null,

  -- Una temporada que termina antes de empezar no es un rango, es un error
  -- de tecleo. Y sin esto, `empieza <= hoy < termina` no encuentra nada y la
  -- pestaña sale vacía sin decir por qué.
  constraint temporada_rango_valido check (termina is null or termina > empieza),
  constraint temporada_set_unico unique (set_code)
);

-- Un solo índice y hace las dos preguntas que se hacen: «¿cuál es la de
-- hoy?» y «¿cuáles hubo?».
create index if not exists ix_temporadas_empieza on public.temporadas (empieza desc);

alter table public.temporadas enable row level security;

-- §2j: Supabase concede ALL por defecto en toda tabla nueva de `public`.
-- Conceder no basta: hay que REVOCAR primero o `anon` puede escribir.
revoke all on public.temporadas from anon, authenticated;
grant select on public.temporadas to anon, authenticated;

drop policy if exists temporadas_select on public.temporadas;
create policy temporadas_select on public.temporadas
  for select using (true);   -- el calendario de temporadas es público

-- Escribir es de admin, y va por RPC (abajo). Sin policy de insert/update
-- nadie escribe desde el cliente, ni siquiera un admin: la tabla solo se
-- toca por una función que comprueba el rol del lado del servidor.

-- ── El ranking, ahora con las DOS puntas del periodo ───────────────────
--
-- Hay que soltar la versión de un argumento: en Postgres `f(a)` y
-- `f(a, b default)` son funciones DISTINTAS, y dejando las dos, una llamada
-- con un solo argumento queda ambigua y falla. Con la vieja fuera, las
-- llamadas que solo mandan `p_desde` siguen funcionando por el default.

drop function if exists public.ranking_unificado(timestamptz);

create or replace function public.ranking_unificado(
  p_desde timestamptz default '2000-01-01'::timestamptz,
  p_hasta timestamptz default 'infinity'::timestamptz
)
returns table (
  clave text, nombre text, user_id uuid, avatar text,
  puntos bigint, victorias bigint, derrotas bigint, empates bigint,
  torneos bigint, amistosas bigint
)
language sql stable security definer set search_path to 'public'
as $$
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
    -- LA LÍNEA QUE FALTABA. La fecha de un resultado de torneo no está en
    -- `tournament_standings`: está en el evento. Sin este join no había
    -- contra qué comparar `p_desde`, y por eso el filtro no existía.
    join official_events ev on ev.id = s.event_id
    left join profiles pr on pr.id = s.user_id
    where (coalesce(trim(s.player_name),'') <> '' or s.user_id is not null)
      -- `created_at` de respaldo: un evento sin fecha puesta igual ocurrió, y
      -- dejarlo fuera de TODOS los periodos lo borraría del ranking entero.
      and coalesce(ev.date, ev.created_at) >= p_desde
      and coalesce(ev.date, ev.created_at) <  p_hasta
  ),
  de_amistosa as (
    select creador_id::text, creador_id, null::text,
           (case when victorias_creador > victorias_rival then 1 else 0 end)::bigint,
           (case when victorias_rival > victorias_creador then 1 else 0 end)::bigint,
           0::bigint,
           (case when victorias_creador > victorias_rival then 1 else 0 end)::bigint,
           0::bigint, 1::bigint
    from duelos_amistosos
    where estado = 'confirmada' and created_at >= p_desde and created_at < p_hasta
    union all
    select rival_id::text, rival_id, null::text,
           (case when victorias_rival > victorias_creador then 1 else 0 end)::bigint,
           (case when victorias_creador > victorias_rival then 1 else 0 end)::bigint,
           0::bigint,
           (case when victorias_rival > victorias_creador then 1 else 0 end)::bigint,
           0::bigint, 1::bigint
    from duelos_amistosos
    where estado = 'confirmada' and rival_id is not null
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
$$;

-- §3i: Postgres concede EXECUTE a PUBLIC en toda función nueva, y `anon` es
-- miembro de PUBLIC. Quitárselo a `anon` NO alcanza: hay que quitárselo a
-- PUBLIC. El ranking es público a propósito, así que se vuelve a conceder
-- explícitamente — pero pasando por el revoke, que es lo que deja el ACL
-- diciendo la verdad.
revoke all on function public.ranking_unificado(timestamptz, timestamptz) from public;
grant execute on function public.ranking_unificado(timestamptz, timestamptz) to anon, authenticated;

-- ── La temporada de una fecha ──────────────────────────────────────────

create or replace function public.temporada_de(p_cuando date default current_date)
returns table (id uuid, set_code text, nombre text, empieza date, termina date)
language sql stable security definer set search_path to 'public'
as $$
  select t.id, t.set_code, t.nombre, t.empieza, t.termina
  from temporadas t
  where t.empieza <= p_cuando
    and (t.termina is null or t.termina > p_cuando)
  -- Si dos temporadas se solaparan por un error de tecleo, gana la que
  -- empezó más tarde: es la que alguien acaba de crear.
  order by t.empieza desc
  limit 1;
$$;

revoke all on function public.temporada_de(date) from public;
grant execute on function public.temporada_de(date) to anon, authenticated;

-- ── Crear o corregir una temporada (solo admin) ────────────────────────
--
-- Va por función y no por policy por la misma razón que `confirmar_amistosa`:
-- RLS es por FILA, no por columna. Acá además se cierra sola la temporada
-- anterior, que es la parte que a mano se olvida y deja dos abiertas.

create or replace function public.guardar_temporada(
  p_set_code text, p_nombre text, p_empieza date, p_termina date default null
)
returns uuid
language plpgsql volatile security definer set search_path to 'public'
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'solo un administrador puede definir temporadas'
      using errcode = 'insufficient_privilege';
  end if;

  if coalesce(trim(p_set_code), '') = '' or coalesce(trim(p_nombre), '') = '' then
    raise exception 'la temporada necesita código de set y nombre'
      using errcode = 'check_violation';
  end if;

  insert into temporadas (set_code, nombre, empieza, termina, constructor)
  values (upper(trim(p_set_code)), trim(p_nombre), p_empieza, p_termina, auth.uid())
  on conflict (set_code) do update
    set nombre = excluded.nombre,
        empieza = excluded.empieza,
        termina = excluded.termina
  returning id into v_id;

  -- La anterior se cierra el día que empieza esta. Sin esto quedan dos
  -- abiertas y `temporada_de` tiene que desempatar por orden, que es una
  -- red de seguridad, no un diseño.
  update temporadas
     set termina = p_empieza
   where id <> v_id
     and empieza < p_empieza
     and (termina is null or termina > p_empieza);

  return v_id;
end;
$$;

revoke all on function public.guardar_temporada(text, text, date, date) from public;
grant execute on function public.guardar_temporada(text, text, date, date) to authenticated;

commit;

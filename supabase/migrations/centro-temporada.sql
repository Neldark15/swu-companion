-- ─────────────────────────────────────────────────────────────────────
-- CENTRO DE TEMPORADA — la capa que convierte torneos sueltos en una
-- temporada, y la puerta que la deja ver a UNA sola persona.
--
-- ── Por qué una tabla de curadores y no `role = 'admin'` ─────────────
--
-- Hoy hay CUATRO admins (Nelson, Jbeltramirez, ElDaigo, Rodorigo). El
-- Centro se pidió explícitamente para uno solo mientras se prueba, así
-- que la regla no puede ser el rol: tiene que ser una asignación
-- explícita, exactamente como `stream_operadores` («Ser admin NO
-- alcanza»).
--
-- Y a diferencia de `stream_operadores`, acá NO hay escotilla de admin
-- para repartir accesos: un admin que pueda darse acceso a sí mismo
-- vuelve la restricción decorativa. Se reparte desde el SQL Editor.
--
-- ── Por qué los puntos se CALCULAN y no se guardan ───────────────────
--
-- Un ledger de puntos es una segunda copia de una verdad que ya existe
-- en `tournament_standings.puesto`, y dos copias se separan (§3c). Los
-- SP son una función pura del puesto y del tamaño de la sala, así que
-- `temporada_tabla()` los deriva en cada lectura: no hay nada que
-- sincronizar, corregir un puesto corrige la temporada sola, y no
-- existe el estado «el ledger quedó viejo».
-- ─────────────────────────────────────────────────────────────────────

begin;

-- ══ 1. La puerta ═════════════════════════════════════════════════════

create table if not exists public.centro_curadores (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  nota      text,
  creado_en timestamptz not null default now()
);

comment on table public.centro_curadores is
  'Quién entra al Centro de Temporada. Ser admin NO alcanza y NO hay forma de repartirse acceso desde la app: se inserta a mano.';

alter table public.centro_curadores enable row level security;

-- §2j: Supabase concede ALL por defecto en toda tabla nueva de `public`.
-- Conceder no basta — hay que REVOCAR primero.
revoke all on public.centro_curadores from anon, authenticated;
grant select on public.centro_curadores to authenticated;

-- Cada quien ve SOLO su propia fila: nadie puede enumerar la lista para
-- averiguar quién tiene acceso. Sin policies de insert/update/delete.
drop policy if exists curadores_select on public.centro_curadores;
create policy curadores_select on public.centro_curadores
  for select to authenticated
  using (user_id = auth.uid());

insert into public.centro_curadores (user_id, nota)
values ('4a7167d2-ffef-4607-8426-d3cfbcfa4c2d', 'Nelson — dueño')
on conflict (user_id) do nothing;

create or replace function public.es_curador()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.centro_curadores where user_id = auth.uid())
$$;

-- §3i: Postgres concede EXECUTE a PUBLIC en toda función nueva, y `anon`
-- es miembro de PUBLIC. `revoke ... from anon` NO lo quita.
revoke all on function public.es_curador() from public, anon;
grant execute on function public.es_curador() to authenticated;


-- ══ 2. La temporada ══════════════════════════════════════════════════

create table if not exists public.temporadas_competitivas (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  empieza           date not null,
  termina           date not null,
  -- Cuántos clasifican a la final. Medido: con la sala real de 8, un
  -- Top 8 clasifica al 100 % y el corte no corta a nadie.
  corte_final       smallint not null default 4 check (corte_final between 2 and 32),
  -- Cuántas fechas cuentan para el total. NULL = todas. Con 3 fechas,
  -- descartar la peor deja solo dos contando y regala una ausencia.
  cuentan           smallint check (cuentan is null or cuentan > 0),
  -- Con 8 jugadores o menos, el peldaño «5.º-8.º» paga 6 en vez de 8.
  -- Sin esto, seis últimos lugares (48) le ganan a tres campeonatos (45).
  ajuste_sala_chica boolean not null default true,
  estado            text not null default 'borrador'
                    check (estado in ('borrador','activa','cerrada')),
  creada_en         timestamptz not null default now(),
  check (termina >= empieza)
);

comment on table public.temporadas_competitivas is
  'La temporada competitiva (fechas + final). NO confundir con `temporadas`, que es la rotación de sets.';

create table if not exists public.temporada_fechas (
  id           uuid primary key default gen_random_uuid(),
  temporada_id uuid not null references public.temporadas_competitivas(id) on delete cascade,
  numero       smallint not null check (numero > 0),
  fecha        date not null,
  formato      text not null,
  -- El torneo que la materializa. NULL mientras la fecha solo está planeada.
  event_id     uuid references public.official_events(id) on delete set null,
  es_final     boolean not null default false,
  nota         text,
  unique (temporada_id, numero)
);

comment on table public.temporada_fechas is
  'Cada sábado de la temporada. `event_id` la enlaza con el torneo real; mientras es null la fecha existe pero todavía no se jugó.';

-- Un torneo no puede ser dos fechas de la temporada a la vez.
create unique index if not exists ux_temporada_fechas_evento
  on public.temporada_fechas(event_id) where event_id is not null;

create index if not exists ix_temporada_fechas_temporada
  on public.temporada_fechas(temporada_id, numero);

alter table public.temporadas_competitivas enable row level security;
alter table public.temporada_fechas        enable row level security;

revoke all on public.temporadas_competitivas from anon, authenticated;
revoke all on public.temporada_fechas        from anon, authenticated;
grant select, insert, update, delete on public.temporadas_competitivas to authenticated;
grant select, insert, update, delete on public.temporada_fechas        to authenticated;

-- Todo el módulo es del curador. Cuando la temporada se publique se
-- agregará una policy de lectura pública APARTE; hoy no existe a propósito.
drop policy if exists temporadas_comp_curador on public.temporadas_competitivas;
create policy temporadas_comp_curador on public.temporadas_competitivas
  for all to authenticated
  using (public.es_curador()) with check (public.es_curador());

drop policy if exists temporada_fechas_curador on public.temporada_fechas;
create policy temporada_fechas_curador on public.temporada_fechas
  for all to authenticated
  using (public.es_curador()) with check (public.es_curador());


-- ══ 3. Los puntos ════════════════════════════════════════════════════

-- La tabla de Season Points, pura. `p_jugadores` es el tamaño de la sala:
-- sin él no se puede aplicar la corrección de sala chica.
create or replace function public.sp_por_puesto(
  p_puesto     integer,
  p_jugadores  integer,
  p_ajuste     boolean default true
)
returns integer
language sql
immutable
as $$
  select case
    when p_puesto is null or p_puesto < 1 then 0
    when p_puesto = 1 then 15
    when p_puesto = 2 then 12
    when p_puesto <= 4 then 10
    when p_puesto <= 8 then
      -- Con 8 o menos en la sala, el peldaño 5.º-8.º es el ÚLTIMO lugar:
      -- pagarlo 8 hace que asistir rinda más que ganar.
      case when p_ajuste and coalesce(p_jugadores, 0) <= 8 then 6 else 8 end
    else 6
  end
$$;

revoke all on function public.sp_por_puesto(integer, integer, boolean) from public, anon;
grant execute on function public.sp_por_puesto(integer, integer, boolean) to authenticated;

-- La tabla de la temporada.
--
-- La clave NO es `user_id`: 3 de los 8 jugadores del torneo del 15 de
-- agosto no tienen cuenta, y uno de ellos GANÓ. Se agrupa por nombre
-- normalizado igual que `ranking_unificado()`, así el día que se
-- registran su historial se une solo.
create or replace function public.temporada_tabla(p_temporada uuid)
returns table (
  clave           text,
  user_id         uuid,
  nombre          text,
  avatar          text,
  fechas_jugadas  integer,
  sp_total        integer,
  mejor_puesto    integer,
  victorias_fecha integer,
  detalle         jsonb
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with guardia as (
    -- SECURITY DEFINER se salta la RLS de las tablas que lee por dentro, y
    -- EXECUTE está concedido a `authenticated` entero. Sin este guardia,
    -- cualquier logueado que adivinara el uuid leía la temporada completa —
    -- medido: Rodorigo, que es admin pero NO curador, la leyó sin problema.
    -- Devuelve vacío en vez de lanzar: un error confirmaría que existe.
    select 1 as pase where public.es_curador()
  ),
  cfg as (
    select t.ajuste_sala_chica, t.cuentan
    from temporadas_competitivas t, guardia
    where t.id = p_temporada
  ),
  fechas as (
    select f.id as fecha_id, f.numero, f.formato, f.event_id
    from temporada_fechas f, guardia
    where f.temporada_id = p_temporada and f.event_id is not null
  ),
  -- Tamaño de sala POR torneo: la corrección de sala chica lo necesita.
  sala as (
    select s.event_id, count(*)::int as jugadores
    from tournament_standings s
    join fechas f on f.event_id = s.event_id
    group by s.event_id
  ),
  filas as (
    select
      coalesce(s.user_id::text, 'nombre:' || lower(trim(s.player_name))) as clave,
      s.user_id,
      trim(s.player_name)                                               as nombre,
      f.numero,
      f.formato,
      s.puesto,
      sala.jugadores,
      sp_por_puesto(s.puesto, sala.jugadores, (select ajuste_sala_chica from cfg)) as sp
    from tournament_standings s
    join fechas f    on f.event_id = s.event_id
    join sala        on sala.event_id = s.event_id
    join official_events e on e.id = s.event_id
    -- Solo cuenta lo ya cerrado: un torneo a medias tiene puestos provisionales.
    where e.status = 'finished' and s.puesto is not null
  ),
  -- El descarte: se ordena por SP y se marca cuáles entran.
  numeradas as (
    select filas.*,
           row_number() over (partition by clave order by sp desc, numero) as orden
    from filas
  ),
  contadas as (
    select n.*,
           (select cuentan from cfg) is null
             or n.orden <= (select cuentan from cfg) as cuenta
    from numeradas n
  )
  select
    c.clave,
    -- Postgres no tiene max(uuid). Y no hace falta un máximo: todas las
    -- filas de una clave con cuenta comparten el MISMO user_id.
    (array_agg(c.user_id) filter (where c.user_id is not null))[1] as user_id,
    max(c.nombre)                                         as nombre,
    max(p.avatar)                                         as avatar,
    count(*)::int                                         as fechas_jugadas,
    coalesce(sum(c.sp) filter (where c.cuenta), 0)::int    as sp_total,
    min(c.puesto)::int                                    as mejor_puesto,
    count(*) filter (where c.puesto = 1)::int             as victorias_fecha,
    jsonb_agg(
      jsonb_build_object(
        'numero',  c.numero, 'formato', c.formato, 'puesto', c.puesto,
        'jugadores', c.jugadores, 'sp', c.sp, 'cuenta', c.cuenta
      ) order by c.numero
    )                                                     as detalle
  from contadas c
  left join profiles p on p.id = c.user_id
  group by c.clave
  order by sp_total desc, victorias_fecha desc, mejor_puesto asc, nombre asc
$$;

revoke all on function public.temporada_tabla(uuid) from public, anon;
grant execute on function public.temporada_tabla(uuid) to authenticated;

commit;

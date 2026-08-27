-- ESPACIO DE CREADORES — LA LIGA, en modo DEMO CERRADO.
--
-- Aplicada en producción el 2026-08-26 como `espacio_creadores_liga_demo`.
-- Se escribe acá porque el §3o lo exige: una migración aplicada por MCP y
-- nunca guardada en el repo deja al proyecto documentando un módulo cuyo
-- esquema no está en ningún lado — que es exactamente cómo Préstamos quedó
-- a medias durante meses.
--
-- Pedido de Nel: la plataforma completa (página del creador, liga, panel),
-- pero visible SOLO para AlejoP3 (el creador, canal PUENTE 3) y los admins,
-- hasta verificar que funciona. Alejo recibe un grado especial de «creador de
-- contenido»: puede armar su liga, cargar resultados/VODs y subir su logo.
--
-- ── El contrato estructural, heredado de amistosas ────────────────────
-- Estas tablas NO tienen triggers, NO escriben player_stats y NO dan XP. El
-- creador controla resultados: si la liga pagara por partida, dos personas
-- coludidas serían una impresora de créditos (la lección del §4j: no conectar
-- algo que paga a un número sin defensa). El premio va SOLO al cierre, por una
-- RPC de admin con preset fijo (500/250/50), pagada por sable_bonos.
--
-- ── La identidad en la liga es la INSCRIPCIÓN, no la cuenta ───────────
-- `liga_inscripciones.id` es la identidad dentro de la liga (patrón de
-- pareos-con-invitados, la lección del 8/8). `user_id` es nullable por
-- estructura, pero la RPC exige cuenta: los invitados sin cuenta rompieron la
-- integridad una vez y no vuelven a entrar por la puerta grande.

-- ── 1. Los creadores: allowlist, como sable_probadores ────────────────
create table if not exists public.creadores (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  code           text not null unique check (code ~ '^[a-z0-9-]{2,24}$'),
  nombre_publico text not null,
  -- El canal lo fija el ADMIN, no el creador: es el ancla anti-impersonación.
  -- Los VODs solo se aceptan si son de YouTube, y el «en vivo» de su página
  -- sale de SU overlay, nunca de un campo que él pueda apuntar a otro lado.
  canal_youtube  text,
  -- Logo como data URI (mismo patrón que los avatares). Lo sube el creador
  -- por RPC, con tope de tamaño DENTRO de la RPC.
  logo           text,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now()
);

-- ── 2. Las ligas ──────────────────────────────────────────────────────
create table if not exists public.ligas (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique check (code ~ '^[a-z0-9-]{2,32}$'),
  creador_id     uuid not null references public.creadores(user_id) on delete cascade,
  nombre         text not null,
  descripcion    text,
  cupo           int not null default 10 check (cupo between 4 and 24),
  estado         text not null default 'borrador'
                 check (estado in ('borrador','inscripcion','activa','cerrada','abandonada')),
  creado_en      timestamptz not null default now(),
  cerrada_en     timestamptz
);

-- Una sola liga viva por creador: con 39 personas, dos ligas simultáneas del
-- mismo creador se canibalizan. Índice parcial, no CHECK: los CHECK no pueden
-- mirar otras filas.
create unique index if not exists ligas_una_viva_por_creador
  on public.ligas (creador_id) where estado in ('borrador','inscripcion','activa');

-- ── 3. Las inscripciones ──────────────────────────────────────────────
create table if not exists public.liga_inscripciones (
  id            uuid primary key default gen_random_uuid(),
  liga_id       uuid not null references public.ligas(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  nombre_visible text not null,
  lider         text,
  base          text,
  -- Con menores en la comunidad esto NO es un checkbox de UI: la RPC lo exige.
  consiente_aparecer boolean not null,
  retirado      boolean not null default false,
  inscrito_en   timestamptz not null default now(),
  unique (liga_id, user_id)
);

-- ── 4. Las partidas ───────────────────────────────────────────────────
create table if not exists public.liga_partidas (
  id             uuid primary key default gen_random_uuid(),
  liga_id        uuid not null references public.ligas(id) on delete cascade,
  jornada        int not null check (jornada >= 1),
  local_insc     uuid not null references public.liga_inscripciones(id),
  visita_insc    uuid not null references public.liga_inscripciones(id),
  victorias_local  int not null default 0 check (victorias_local between 0 and 2),
  victorias_visita int not null default 0 check (victorias_visita between 0 and 2),
  estado         text not null default 'programada'
                 check (estado in ('programada','jugada','wo_local','wo_visita','sin_jugar')),
  programada_para timestamptz,
  -- El VOD vive EN la partida: un dato, un dueño (§2y). Id de 11 caracteres,
  -- normalizado por la RPC; `vod_t` = segundo donde empieza esta partida, así
  -- un solo video de la jornada sirve para todas con ?start=.
  vod_youtube_id text check (vod_youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  vod_t          int check (vod_t >= 0),
  check (local_insc <> visita_insc)
);

create index if not exists liga_partidas_por_liga on public.liga_partidas (liga_id, jornada);

-- ── Grants: revocar primero (§2j), y NADA de escritura directa ────────
revoke all on public.creadores, public.ligas, public.liga_inscripciones, public.liga_partidas
  from anon, authenticated;
grant select on public.creadores, public.ligas, public.liga_inscripciones, public.liga_partidas
  to authenticated;

alter table public.creadores enable row level security;
alter table public.ligas enable row level security;
alter table public.liga_inscripciones enable row level security;
alter table public.liga_partidas enable row level security;

-- ── LA PUERTA DEL DEMO ────────────────────────────────────────────────
-- Mientras dure el demo, TODO esto lo ven solo los creadores y los admins.
-- Cuando se abra al público, esta función pasa a `true` para SELECT y las
-- policies no se tocan — la puerta es un punto, no veinte.
create or replace function public.puede_ver_creadores()
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from public.creadores where user_id = auth.uid())
      or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;
revoke all on function public.puede_ver_creadores() from anon, public;
grant execute on function public.puede_ver_creadores() to authenticated;

drop policy if exists creadores_ver on public.creadores;
create policy creadores_ver on public.creadores
  for select to authenticated using (public.puede_ver_creadores());
drop policy if exists ligas_ver on public.ligas;
create policy ligas_ver on public.ligas
  for select to authenticated using (public.puede_ver_creadores());
drop policy if exists liga_insc_ver on public.liga_inscripciones;
create policy liga_insc_ver on public.liga_inscripciones
  for select to authenticated using (public.puede_ver_creadores());
drop policy if exists liga_partidas_ver on public.liga_partidas;
create policy liga_partidas_ver on public.liga_partidas
  for select to authenticated using (public.puede_ver_creadores());

-- ── RPCs, con el guardia ADENTRO (§3i-bis) ────────────────────────────

create or replace function public.creador_subir_logo(p_logo text)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_yo uuid := auth.uid();
begin
  if v_yo is null then return jsonb_build_object('ok', false, 'error', 'Sin sesion.'); end if;
  if not exists (select 1 from public.creadores where user_id = v_yo and activo) then
    return jsonb_build_object('ok', false, 'error', 'No sos creador.');
  end if;
  -- Data URI de imagen, con tope: 200 KB bastan para un logo comprimido en el
  -- cliente (mismo patrón que el avatar). Sin tope, un logo de 10 MB viaja en
  -- cada carga de la página del creador.
  if p_logo is not null and (p_logo !~ '^data:image/(png|jpeg|webp);base64,' or length(p_logo) > 280000) then
    return jsonb_build_object('ok', false, 'error', 'El logo tiene que ser una imagen de hasta 200 KB.');
  end if;
  update public.creadores set logo = p_logo where user_id = v_yo;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.liga_crear(p_code text, p_nombre text, p_descripcion text, p_cupo int)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_yo uuid := auth.uid(); v_id uuid;
begin
  if v_yo is null then return jsonb_build_object('ok', false, 'error', 'Sin sesion.'); end if;
  if not exists (select 1 from public.creadores where user_id = v_yo and activo) then
    return jsonb_build_object('ok', false, 'error', 'No sos creador.');
  end if;
  if exists (select 1 from public.ligas where creador_id = v_yo and estado in ('borrador','inscripcion','activa')) then
    return jsonb_build_object('ok', false, 'error', 'Ya tenes una liga en marcha. Cerrala antes de abrir otra.');
  end if;
  insert into public.ligas (code, creador_id, nombre, descripcion, cupo)
  values (lower(btrim(p_code)), v_yo, btrim(p_nombre), nullif(btrim(coalesce(p_descripcion,'')),''), coalesce(p_cupo, 10))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'Ese codigo de liga ya existe.');
end $$;

create or replace function public.liga_abrir_inscripcion(p_liga uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_yo uuid := auth.uid();
begin
  update public.ligas set estado = 'inscripcion'
   where id = p_liga and creador_id = v_yo and estado = 'borrador';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Esa liga no es tuya o no esta en borrador.');
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.liga_inscribirse(
  p_liga uuid, p_lider text, p_base text, p_consiente boolean
)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_yo uuid := auth.uid(); v_cupo int; v_inscritos int; v_nombre text;
begin
  if v_yo is null then return jsonb_build_object('ok', false, 'error', 'Sin sesion.'); end if;
  -- DEMO: inscribirse también está detrás de la puerta.
  if not public.puede_ver_creadores() then
    return jsonb_build_object('ok', false, 'error', 'El espacio de creadores esta en pruebas.');
  end if;
  if p_consiente is distinct from true then
    -- Con menores esto no es negociable, y va ACÁ y no solo en la UI: tus
    -- partidas van a transmitirse y publicarse en YouTube.
    return jsonb_build_object('ok', false, 'error', 'Para jugar la liga tenes que aceptar que tus partidas se transmitan y publiquen.');
  end if;
  select cupo into v_cupo from public.ligas where id = p_liga and estado = 'inscripcion';
  if v_cupo is null then
    return jsonb_build_object('ok', false, 'error', 'Esa liga no esta en inscripcion.');
  end if;
  select count(*) into v_inscritos from public.liga_inscripciones where liga_id = p_liga and not retirado;
  if v_inscritos >= v_cupo then
    return jsonb_build_object('ok', false, 'error', 'La liga esta llena.');
  end if;
  select name into v_nombre from public.profiles where id = v_yo;
  insert into public.liga_inscripciones (liga_id, user_id, nombre_visible, lider, base, consiente_aparecer)
  values (p_liga, v_yo, coalesce(v_nombre, 'Jugador'), nullif(btrim(coalesce(p_lider,'')),''), nullif(btrim(coalesce(p_base,'')),''), true);
  return jsonb_build_object('ok', true);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'Ya estas inscrito en esta liga.');
end $$;

create or replace function public.liga_cerrar_inscripcion(p_liga uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_yo uuid := auth.uid();
  v_ids uuid[]; n int; i int; j int; ronda int; mitad int;
  v_gira uuid[];
begin
  if not exists (select 1 from public.ligas where id = p_liga and creador_id = v_yo and estado = 'inscripcion') then
    return jsonb_build_object('ok', false, 'error', 'Esa liga no es tuya o no esta en inscripcion.');
  end if;

  select array_agg(id order by inscrito_en) into v_ids
    from public.liga_inscripciones where liga_id = p_liga and not retirado;
  n := coalesce(array_length(v_ids, 1), 0);
  if n < 4 then
    return jsonb_build_object('ok', false, 'error', format('Hacen falta al menos 4 inscritos (hay %s).', n));
  end if;

  /* ROUND-ROBIN COMPLETO, generado de una vez (método del círculo). Es la
     decisión de diseño clave: Alejo necesita anunciar «jornada 3: X vs Y» con
     semanas de antelación para producir contenido. Con n impar se agrega un
     hueco NULL: quien le toque descansa esa jornada (no se crea partida). */
  if n % 2 = 1 then
    v_ids := v_ids || null::uuid;
    n := n + 1;
  end if;
  mitad := n / 2;
  v_gira := v_ids;
  for ronda in 1..(n - 1) loop
    for i in 1..mitad loop
      j := n + 1 - i;
      if v_gira[i] is not null and v_gira[j] is not null then
        insert into public.liga_partidas (liga_id, jornada, local_insc, visita_insc)
        values (p_liga, ronda,
                case when ronda % 2 = 0 then v_gira[j] else v_gira[i] end,
                case when ronda % 2 = 0 then v_gira[i] else v_gira[j] end);
      end if;
    end loop;
    -- Girar: el primero queda fijo, el resto rota.
    v_gira := v_gira[1:1] || v_gira[n:n] || v_gira[2:n-1];
  end loop;

  update public.ligas set estado = 'activa' where id = p_liga;
  return jsonb_build_object('ok', true, 'jornadas', n - 1);
end $$;

create or replace function public.liga_reportar(
  p_partida uuid, p_victorias_local int, p_victorias_visita int,
  p_vod text default null, p_vod_t int default null
)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_yo uuid := auth.uid(); v_vod text;
begin
  -- Solo el creador DE ESA liga, y solo mientras esté activa.
  if not exists (
    select 1 from public.liga_partidas p join public.ligas l on l.id = p.liga_id
    where p.id = p_partida and l.creador_id = v_yo and l.estado = 'activa'
  ) then
    return jsonb_build_object('ok', false, 'error', 'Esa partida no es de una liga tuya activa.');
  end if;
  if p_victorias_local is null or p_victorias_visita is null
     or p_victorias_local < 0 or p_victorias_local > 2
     or p_victorias_visita < 0 or p_victorias_visita > 2
     or (p_victorias_local = p_victorias_visita) then
    return jsonb_build_object('ok', false, 'error', 'Un BO3 termina 2-0, 2-1, 1-0... sin empates.');
  end if;
  -- El VOD se normaliza ACÁ: URL completa o id pelado, sale el id de 11.
  if p_vod is not null and btrim(p_vod) <> '' then
    v_vod := substring(p_vod from '([A-Za-z0-9_-]{11})');
    if v_vod is null then
      return jsonb_build_object('ok', false, 'error', 'Ese enlace de YouTube no se entiende.');
    end if;
  end if;
  update public.liga_partidas
     set victorias_local = p_victorias_local,
         victorias_visita = p_victorias_visita,
         estado = 'jugada',
         vod_youtube_id = coalesce(v_vod, vod_youtube_id),
         vod_t = coalesce(p_vod_t, vod_t)
   where id = p_partida;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.liga_cerrar(p_liga uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_yo uuid := auth.uid();
begin
  update public.ligas set estado = 'cerrada', cerrada_en = now()
   where id = p_liga and creador_id = v_yo and estado = 'activa';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Esa liga no es tuya o no esta activa.');
  end if;
  -- Las partidas que quedaron sin jugar se sellan como tales: el motor no
  -- inventa resultados (la cicatriz de los torneos con invitados).
  update public.liga_partidas set estado = 'sin_jugar'
   where liga_id = p_liga and estado = 'programada';
  return jsonb_build_object('ok', true);
end $$;

-- El premio del cierre: SOLO admin, preset fijo, por sable_bonos (§4j: nada
-- de darle a un contador sin defensa el poder de emitir).
create or replace function public.liga_premiar(p_liga uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_liga record; v_campeon uuid; v_segundo uuid; v_pagados int := 0;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    return jsonb_build_object('ok', false, 'error', 'Solo un admin cierra premios.');
  end if;
  select * into v_liga from public.ligas where id = p_liga and estado = 'cerrada';
  if v_liga is null then
    return jsonb_build_object('ok', false, 'error', 'La liga tiene que estar cerrada.');
  end if;
  -- Idempotente por motivo: cerrar dos veces no paga dos veces.
  if exists (select 1 from public.sable_bonos where motivo = 'liga ' || v_liga.code || ' premio campeon') then
    return jsonb_build_object('ok', false, 'error', 'Esta liga ya repartio premios.');
  end if;

  with tabla as (
    select i.id, i.user_id,
           sum(case
             when (p.local_insc = i.id and (p.estado = 'jugada' and p.victorias_local > p.victorias_visita or p.estado = 'wo_visita'))
               or (p.visita_insc = i.id and (p.estado = 'jugada' and p.victorias_visita > p.victorias_local or p.estado = 'wo_local'))
             then 3 else 0 end) as puntos,
           sum(case when p.local_insc = i.id then p.victorias_local - p.victorias_visita
                    when p.visita_insc = i.id then p.victorias_visita - p.victorias_local
                    else 0 end) as dif
      from public.liga_inscripciones i
      left join public.liga_partidas p
        on p.liga_id = i.liga_id and p.estado in ('jugada','wo_local','wo_visita')
       and (p.local_insc = i.id or p.visita_insc = i.id)
     where i.liga_id = p_liga and not i.retirado
     group by i.id, i.user_id
     order by puntos desc, dif desc
  )
  select (select user_id from tabla limit 1),
         (select user_id from tabla offset 1 limit 1)
    into v_campeon, v_segundo;

  if v_campeon is not null then
    insert into public.sable_bonos (user_id, cantidad, motivo)
    values (v_campeon, 500, 'liga ' || v_liga.code || ' premio campeon');
    v_pagados := v_pagados + 1;
  end if;
  if v_segundo is not null then
    insert into public.sable_bonos (user_id, cantidad, motivo)
    values (v_segundo, 250, 'liga ' || v_liga.code || ' premio finalista');
    v_pagados := v_pagados + 1;
  end if;
  insert into public.sable_bonos (user_id, cantidad, motivo)
  select i.user_id, 50, 'liga ' || v_liga.code || ' premio participacion'
    from public.liga_inscripciones i
   where i.liga_id = p_liga and not i.retirado and i.user_id is not null
     and i.user_id not in (v_campeon, v_segundo);
  return jsonb_build_object('ok', true, 'podio_pagado', v_pagados);
end $$;

-- §4e: revocar de anon Y de public en cada función.
revoke all on function public.creador_subir_logo(text) from anon, public;
revoke all on function public.liga_crear(text, text, text, int) from anon, public;
revoke all on function public.liga_abrir_inscripcion(uuid) from anon, public;
revoke all on function public.liga_inscribirse(uuid, text, text, boolean) from anon, public;
revoke all on function public.liga_cerrar_inscripcion(uuid) from anon, public;
revoke all on function public.liga_reportar(uuid, int, int, text, int) from anon, public;
revoke all on function public.liga_cerrar(uuid) from anon, public;
revoke all on function public.liga_premiar(uuid) from anon, public;
grant execute on function public.creador_subir_logo(text) to authenticated;
grant execute on function public.liga_crear(text, text, text, int) to authenticated;
grant execute on function public.liga_abrir_inscripcion(uuid) to authenticated;
grant execute on function public.liga_inscribirse(uuid, text, text, boolean) to authenticated;
grant execute on function public.liga_cerrar_inscripcion(uuid) to authenticated;
grant execute on function public.liga_reportar(uuid, int, int, text, int) to authenticated;
grant execute on function public.liga_cerrar(uuid) to authenticated;
grant execute on function public.liga_premiar(uuid) to authenticated;

-- ── El primer creador: AlejoP3 (PUENTE 3) ─────────────────────────────
insert into public.creadores (user_id, code, nombre_publico, canal_youtube)
values ('a2118d18-0cb0-443e-ad23-1b0d5f17c974', 'puente3', 'PUENTE 3', 'https://www.youtube.com/@Puente3Podcast')
on conflict (user_id) do update set activo = true;

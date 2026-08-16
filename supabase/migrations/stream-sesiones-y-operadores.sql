-- ─────────────────────────────────────────────────────────────────────
-- TRANSMISIONES POR SEDE — varias sesiones, acceso explícito por persona
--
-- Antes había UNA sola transmisión (SV01) y la regla de escritura era
-- «cualquier admin». Con dos sedes eso ya no sirve: el operador de Sonsonate
-- no tiene por qué tocar el marcador de San Salvador, ni al revés.
--
-- La regla nueva es UNA sola y explícita: **se opera lo que se tiene asignado**.
-- Ser admin ya no alcanza para escribir un marcador; hay que estar en
-- `stream_operadores` de ESA transmisión.
--
-- Efecto secundario bueno: un operador NO necesita ser admin de la app. Diego
-- puede manejar el marcador sin poder crear torneos ni mandar push a toda la
-- comunidad. Antes, para dejarlo operar, había que hacerlo admin de todo.
-- ─────────────────────────────────────────────────────────────────────

-- ── Las transmisiones ─────────────────────────────────────────────────
create table if not exists public.stream_sesiones (
  code       text primary key,
  nombre     text not null,
  sede       text,
  activa     boolean not null default true,
  creado_en  timestamptz not null default now()
);

comment on table public.stream_sesiones is
  'Una fila por transmisión (una por sede). El code es el mismo de stream_overlay y el de las URLs /estudio/:code y /overlay/:code.';

-- ── Quién opera qué ───────────────────────────────────────────────────
create table if not exists public.stream_operadores (
  code      text not null references public.stream_sesiones(code) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  creado_en timestamptz not null default now(),
  primary key (code, user_id)
);

comment on table public.stream_operadores is
  'Quién puede operar cada transmisión. Ser admin NO alcanza: la asignación es explícita.';

create index if not exists ix_stream_operadores_user on public.stream_operadores(user_id);

alter table public.stream_sesiones   enable row level security;
alter table public.stream_operadores enable row level security;

-- ── Datos: las dos sedes ──────────────────────────────────────────────
insert into public.stream_sesiones (code, nombre, sede) values
  ('SV01',  'San Salvador', 'San Salvador'),
  ('SON01', 'Sonsonate',    'Sonsonate')
on conflict (code) do nothing;

-- La fila del marcador de Sonsonate (SV01 ya existe).
insert into public.stream_overlay (code, estado, version)
values ('SON01', '{}'::jsonb, 0)
on conflict (code) do nothing;

-- ── Datos: los operadores ─────────────────────────────────────────────
-- Se resuelven por id de perfil, verificados contra la base antes de escribir:
--   Nelson       4a7167d2-…  · Jbeltramirez (Jaime) e91c6998-…
--   Rodorigo     b4757401-…  · ElDaigo (Diego)      2ef1e26b-…
insert into public.stream_operadores (code, user_id) values
  ('SV01',  '4a7167d2-ffef-4607-8426-d3cfbcfa4c2d'),  -- Nelson
  ('SV01',  'e91c6998-9ccc-4ebc-af61-2cd10291e76a'),  -- Jaime
  ('SV01',  '2ef1e26b-bb10-428e-95ba-85c4e9ac49b5'),  -- Diego
  ('SON01', '4a7167d2-ffef-4607-8426-d3cfbcfa4c2d'),  -- Nelson
  ('SON01', 'b4757401-0e92-4540-95b7-a8e0ebcb71f8')   -- Rodrigo
on conflict (code, user_id) do nothing;

-- ── Políticas ─────────────────────────────────────────────────────────

-- Las sesiones se leen públicamente: el nombre de una sede no es secreto y
-- `/envivo` necesita listarlas sin sesión.
drop policy if exists "sesiones_select" on public.stream_sesiones;
create policy "sesiones_select" on public.stream_sesiones
  for select using (true);

-- Crear o renombrar transmisiones: solo admin.
drop policy if exists "sesiones_admin" on public.stream_sesiones;
create policy "sesiones_admin" on public.stream_sesiones
  for all to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Cada quien ve las asignaciones de las transmisiones que opera (para saber
-- con quién comparte cabina). Nada de leer el reparto de la otra sede.
drop policy if exists "operadores_select" on public.stream_operadores;
create policy "operadores_select" on public.stream_operadores
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.stream_operadores mio
      where mio.code = stream_operadores.code and mio.user_id = auth.uid()
    )
  );

-- Repartir accesos: solo admin. Es la escotilla de emergencia — si alguien se
-- queda fuera de su propia cabina, un admin lo vuelve a meter.
drop policy if exists "operadores_admin" on public.stream_operadores;
create policy "operadores_admin" on public.stream_operadores
  for all to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ── Y la regla que cambia: escribir el marcador ───────────────────────
--
-- Se reemplaza «cualquier admin» por «operador asignado a ESTA transmisión».
-- Con la tabla ya poblada arriba, el cambio no deja a nadie fuera.
drop policy if exists "overlay_admin_write" on public.stream_overlay;
drop policy if exists "overlay_operador_write" on public.stream_overlay;
create policy "overlay_operador_write" on public.stream_overlay
  for all to authenticated
  using (
    exists (
      select 1 from public.stream_operadores o
      where o.code = stream_overlay.code and o.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.stream_operadores o
      where o.code = stream_overlay.code and o.user_id = auth.uid()
    )
  );

-- ── Grants ────────────────────────────────────────────────────────────
-- Con RLS activa la política manda, pero el grant de tabla tiene que existir
-- igual o PostgREST responde «permission denied» antes de evaluarla (§2j).
grant select on public.stream_sesiones to anon, authenticated;
grant insert, update, delete on public.stream_sesiones to authenticated;
grant select on public.stream_operadores to authenticated;
grant insert, update, delete on public.stream_operadores to authenticated;

-- ── Realtime para el marcador nuevo ───────────────────────────────────
-- (stream_overlay ya está en la publicación; SON01 es una fila más.)

-- ── Endurecimiento (aplicado aparte tras el advisor de seguridad) ─────
--
-- `es_operador_stream` es SECURITY DEFINER —corre sin RLS para cortar la
-- recursión— así que NO debe quedar expuesta a visitantes sin sesión: por
-- /rest/v1/rpc se podría sondear quién opera qué transmisión.
--
-- El `revoke ... from public` NO alcanza: el proyecto tiene un grant amplio a
-- `anon` que sobrevive, y el advisor lo detectó. Hay que quitárselo explícito.
revoke all on function public.es_operador_stream(text, uuid) from anon;
revoke all on function public.es_operador_stream(text, uuid) from public;
grant execute on function public.es_operador_stream(text, uuid) to authenticated;

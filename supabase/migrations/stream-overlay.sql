-- ─────────────────────────────────────────────────────────────────────
-- STREAM OVERLAY — marcador en pantalla para transmitir torneos
--
-- Una fila por transmisión. `estado` es un JSONB con TODO lo que se pinta:
-- escena, jugadores, reloj, carta destacada. Tres razones para que sea un
-- solo blob y no columnas:
--
--   1. El payload de `postgres_changes` trae la fila entera, así que el
--      overlay recibe el estado completo y re-renderiza. Es idempotente: un
--      mensaje perdido no lo deja en un estado imposible, el siguiente lo
--      corrige entero.
--   2. Persistencia = recuperación. Si OBS refresca el Browser Source a media
--      partida, un SELECT lo devuelve exactamente a lo que estaba al aire.
--      Con Realtime Broadcast puro eso se perdería — y además el repo no tiene
--      un solo precedente de Broadcast: el patrón probado es postgres_changes
--      (ver tournamentCloud.ts).
--   3. La forma del estado va a cambiar entre el stream 1 y el 3. Con JSONB eso
--      es un cambio de TypeScript, no un ALTER en producción a las 11 PM.
--
-- `version` es para el control optimista: dos paneles abiertos (el celular y la
-- Mac) no se pisan. El cliente reintenta releyendo y re-aplicando la acción.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.stream_overlay (
  code       text primary key,
  estado     jsonb       not null default '{}'::jsonb,
  version    integer     not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.stream_overlay is
  'Marcador en vivo del stream. Lectura pública (lo consume OBS sin sesión); escritura solo admin.';

alter table public.stream_overlay enable row level security;

-- ── Lectura: pública y anónima ────────────────────────────────────────
--
-- El navegador de OBS no tiene sesión y no la va a tener: es un marcador de
-- daño y recursos, no hay nada sensible acá. Que sea `to public` y no
-- `to anon` es a propósito: la misma política sirve para el operador logueado
-- mirando la mini-vista.
drop policy if exists "overlay_select" on public.stream_overlay;
create policy "overlay_select"
  on public.stream_overlay
  for select
  using (true);

-- ── Escritura: solo admin ─────────────────────────────────────────────
--
-- Una sola regla: admin (CLAUDE.md §2u). NO se agrega una rama
-- `organizer_id = auth.uid()`: un organizador que no sea admin no puede
-- existir en este sistema, y esa rama sugeriría un rol que no se puede
-- producir. Mismo predicado que `events_insert` en supabase-schema.sql:246.
drop policy if exists "overlay_admin_write" on public.stream_overlay;
create policy "overlay_admin_write"
  on public.stream_overlay
  for all
  to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ── Grants ────────────────────────────────────────────────────────────
--
-- Con RLS activa la política manda, pero el grant de tabla tiene que existir
-- igual o PostgREST responde «permission denied» antes de evaluarla
-- (CLAUDE.md §2j: el grant de tabla es lo que abre o cierra la puerta).
grant select on public.stream_overlay to anon, authenticated;
grant insert, update, delete on public.stream_overlay to authenticated;

-- ── Realtime ──────────────────────────────────────────────────────────
--
-- Sin esto el overlay solo se enteraría por el poll de 10 s.
-- `if not exists` a mano: ALTER PUBLICATION no lo soporta y correr la
-- migración dos veces daría error.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'stream_overlay'
  ) then
    alter publication supabase_realtime add table public.stream_overlay;
  end if;
end $$;

-- `replica identity full` para que el payload de realtime traiga la fila
-- completa también en los UPDATE. Sin esto, `new` puede llegar con solo la
-- clave primaria y el overlay se quedaría sin estado que pintar.
alter table public.stream_overlay replica identity full;

-- ── Marca de tiempo ───────────────────────────────────────────────────
--
-- `updated_at` es lo que permite al overlay saber si el estado está fresco.
-- Se pone del lado del servidor: el reloj del celular del operador puede
-- estar corrido y la compuerta de frescura mentiría.
create or replace function public.stream_overlay_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_stream_overlay_touch on public.stream_overlay;
create trigger trg_stream_overlay_touch
  before update on public.stream_overlay
  for each row execute function public.stream_overlay_touch();

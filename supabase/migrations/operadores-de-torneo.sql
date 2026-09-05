-- Quien puede LLEVAR un torneo, en un solo lugar.
--
-- Nel: «aparte del organizador, Jaime tambien puede manipular el torneo para
-- llevarlo».
--
-- EL PROBLEMA no era darle permiso a una persona: era que la regla estaba
-- escrita a mano en DIECISIETE lugares (8 policies + 6 funciones), cada una
-- repitiendo `exists (select 1 from profiles where id = auth.uid() and role =
-- 'admin')`. Para sumar a alguien habia que acordarse de los 17, y el que se
-- olvidara no daria error: daria un boton que no hace nada.
--
-- Ya existia `puede_operar_torneo()` justo para esto y casi nada la usaba.
-- Ahora todas las reglas de torneo pasan por ella.
--
-- Y NO se le da rol de admin a la persona: eso le abriria el blog, los
-- usuarios y el resto del panel. Llevar torneos es un trabajo, no un rango.
--
-- El cuerpo completo esta aplicado en la base; este archivo lo reproduce.
-- Ver la migracion `operadores_de_torneo`.

create table if not exists public.torneo_operadores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  agregado_por uuid references auth.users(id),
  nota text,
  creado_en timestamptz not null default now()
);

revoke all on public.torneo_operadores from public, anon, authenticated;
grant select on public.torneo_operadores to authenticated;
alter table public.torneo_operadores enable row level security;

drop policy if exists operadores_select on public.torneo_operadores;
create policy operadores_select on public.torneo_operadores
for select to authenticated using (true);

-- Un operador que pudiera nombrar operadores es un admin con otro nombre.
drop policy if exists operadores_admin on public.torneo_operadores;
create policy operadores_admin on public.torneo_operadores
for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create or replace function public.puede_operar_torneo()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
      or exists (select 1 from public.torneo_operadores where user_id = auth.uid())
      or public.es_curador()
$function$;

grant execute on function public.puede_operar_torneo() to authenticated;

-- Rondas, pareos y clasificacion: todo pasa por la misma pregunta.
drop policy if exists rounds_admin_insert on public.tournament_rounds;
create policy rounds_admin_insert on public.tournament_rounds
for insert to authenticated with check (public.puede_operar_torneo());

drop policy if exists rounds_admin_update on public.tournament_rounds;
create policy rounds_admin_update on public.tournament_rounds
for update to authenticated using (public.puede_operar_torneo());

drop policy if exists pairings_admin_insert on public.tournament_pairings;
create policy pairings_admin_insert on public.tournament_pairings
for insert to authenticated with check (public.puede_operar_torneo());

drop policy if exists pairings_admin_update on public.tournament_pairings;
create policy pairings_admin_update on public.tournament_pairings
for update to authenticated using (public.puede_operar_torneo());

drop policy if exists pairings_admin_delete on public.tournament_pairings;
create policy pairings_admin_delete on public.tournament_pairings
for delete to authenticated using (public.puede_operar_torneo());

drop policy if exists standings_admin_insert on public.tournament_standings;
create policy standings_admin_insert on public.tournament_standings
for insert to authenticated with check (public.puede_operar_torneo());

drop policy if exists standings_admin_update on public.tournament_standings;
create policy standings_admin_update on public.tournament_standings
for update to authenticated using (public.puede_operar_torneo());

-- Crear y editar un torneo, si. BORRARLO no: se lleva por cascada las
-- inscripciones de todos, y eso no es «llevar el torneo», es deshacerlo.
drop policy if exists events_insert on public.official_events;
create policy events_insert on public.official_events
for insert to authenticated with check (public.puede_operar_torneo());

drop policy if exists events_update on public.official_events;
create policy events_update on public.official_events
for update to authenticated
using (organizer_id = auth.uid() or public.puede_operar_torneo());

drop policy if exists reg_select on public.event_registrations;
create policy reg_select on public.event_registrations
for select
using (
  user_id = auth.uid()
  or exists (select 1 from public.official_events oe
              where oe.id = event_registrations.event_id
                and oe.organizer_id = auth.uid())
  or public.puede_operar_torneo()
  or public.esta_inscrito(event_registrations.event_id, auth.uid())
);

-- El torneo en vivo: la cañeria que faltaba.
--
-- Seis cosas que se pidieron —inscribirse, ver quien llega, comenzar, reloj
-- por ronda, aviso de con quien te toca, contador para todos— y CINCO fallaban
-- por causas de servidor, no de pantalla.
--
-- ── 1. Las tablas que tienen que avisar no avisaban ──────────────────
--
-- Una tabla emite cambios en vivo SOLO si esta en la publicacion
-- `supabase_realtime`. `tournament_pairings`, `_rounds` y `_standings` estaban;
-- `official_events` y `event_registrations` NO. Y ahi vive justo lo que tiene
-- que llegar solo: `current_round` (en que ronda va) y `round_timer_end` (el
-- reloj). Un canal sobre una tabla no publicada se suscribe SIN ERROR y no
-- dispara nunca — por eso el hueco vivio dos años sin que nadie lo reportara.
--
-- ── 2. Pero primero la policy, o el arreglo no se nota ───────────────
--
-- `reg_select` solo dejaba ver TU propia fila. Un jugador en el lobby leia
-- «Jugadores (1)» en un torneo con doce adentro, con HTTP 200 y sin error.
-- Abrir el tiempo real sin arreglar esto haria que el canal emita y el jugador
-- siga viendo vacio: se leeria como que el arreglo no sirvio.
--
-- Ahora: si estas inscrito a un torneo, ves a los demas inscritos DE ESE
-- torneo. Es lo mismo que ves parado en el local.

-- La funcion evita que la policy se consulte a si misma (recursion): mira las
-- inscripciones SIN RLS, y por eso solo contesta la pregunta cerrada
-- «¿fulano esta inscrito acá?».
create or replace function public.esta_inscrito(p_evento uuid, p_persona uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.event_registrations
     where event_id = p_evento and user_id = p_persona
  );
$$;

revoke all on function public.esta_inscrito(uuid, uuid) from public, anon;
grant execute on function public.esta_inscrito(uuid, uuid) to authenticated;

drop policy if exists reg_select on public.event_registrations;
create policy reg_select on public.event_registrations
for select
using (
  user_id = auth.uid()
  or exists (select 1 from public.official_events oe
              where oe.id = event_registrations.event_id
                and oe.organizer_id = auth.uid())
  or exists (select 1 from public.profiles p
              where p.id = auth.uid() and p.role = 'admin')
  -- Los inscritos se ven entre ellos, dentro de SU torneo.
  or public.esta_inscrito(event_registrations.event_id, auth.uid())
);

-- ── 3. El check-in no podia existir: faltaba la policy de UPDATE ─────
--
-- «Estoy listo» movia estado de React y nada mas. Aunque el cliente hubiera
-- escrito, RLS lo frenaba: no habia policy de UPDATE, ninguna. Cada quien
-- marca SU propia llegada, y no puede tocar la de otro ni mudarse de evento.
create policy reg_update on public.event_registrations
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ── 4. El cupo era decorativo ────────────────────────────────────────
--
-- `max_players` aparecia UNA vez en 102 migraciones: en el create table. Un
-- torneo de 16 aceptaba 40 inscritos y nadie se enteraba hasta tener gente
-- parada en la tienda. La regla vive acá y no en la pantalla, porque hoy hay
-- dos pantallas que ya no se ponen de acuerdo (una exige 'open', la otra
-- acepta 'active').
create or replace function public.trg_inscripcion_valida()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_ev public.official_events%rowtype; v_hay int;
begin
  select * into v_ev from public.official_events where id = new.event_id;
  if not found then
    raise exception 'Ese torneo no existe.';
  end if;

  if v_ev.status <> 'open' then
    raise exception 'Las inscripciones de «%» ya cerraron.', v_ev.name
      using errcode = 'check_violation';
  end if;

  -- Se cuenta SIN RLS (la funcion es definer): contarlo con los ojos del que
  -- se inscribe daria 1 y el cupo no serviria de nada.
  select count(*) into v_hay from public.event_registrations where event_id = new.event_id;
  if v_ev.max_players is not null and v_hay >= v_ev.max_players then
    raise exception 'El torneo «%» ya esta lleno (% de %).', v_ev.name, v_hay, v_ev.max_players
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists inscripcion_valida on public.event_registrations;
create trigger inscripcion_valida
before insert on public.event_registrations
for each row execute function public.trg_inscripcion_valida();

-- ── 5. El reloj lo pone el SERVIDOR ──────────────────────────────────
--
-- El plazo se anclaba con `Date.now()` del navegador del admin y lo media el
-- `Date.now()` de cada espectador. Si el telefono del organizador va tres
-- minutos adelantado, la ronda entera dura tres minutos de mas y nadie se
-- entera. Acá el ancla es `now()` de la base: una sola fuente para todos.
--
-- Devuelve tambien la hora del servidor para que el cliente calcule su desfase
-- una sola vez y mida contra eso.
create or replace function public.arrancar_reloj(p_evento uuid, p_minutos int default null)
returns table (termina_en timestamptz, ahora timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_min int;
begin
  if not exists (select 1 from public.official_events oe
                  where oe.id = p_evento
                    and (oe.organizer_id = auth.uid()
                         or exists (select 1 from public.profiles p
                                     where p.id = auth.uid() and p.role = 'admin')))
  then
    raise exception 'Solo quien organiza puede mover el reloj.';
  end if;

  select coalesce(p_minutos, round_timer_minutes, 50) into v_min
    from public.official_events where id = p_evento;

  update public.official_events
     set round_timer_end = now() + make_interval(mins => v_min),
         round_timer_minutes = v_min,
         updated_at = now()
   where id = p_evento;

  return query select oe.round_timer_end, now() from public.official_events oe where oe.id = p_evento;
end;
$$;

/**
 * Estirar la ronda. Se suma sobre lo que quede, y si YA vencio se suma desde
 * ahora: sumarle 5 a un plazo vencido hace 20 minutos deja el final en el
 * pasado, y el organizador aprieta cinco veces sin entender por que sigue en
 * cero.
 */
create or replace function public.estirar_reloj(p_evento uuid, p_minutos int default 5)
returns table (termina_en timestamptz, ahora timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (select 1 from public.official_events oe
                  where oe.id = p_evento
                    and (oe.organizer_id = auth.uid()
                         or exists (select 1 from public.profiles p
                                     where p.id = auth.uid() and p.role = 'admin')))
  then
    raise exception 'Solo quien organiza puede mover el reloj.';
  end if;

  update public.official_events
     set round_timer_end = greatest(coalesce(round_timer_end, now()), now())
                           + make_interval(mins => p_minutos),
         updated_at = now()
   where id = p_evento;

  return query select oe.round_timer_end, now() from public.official_events oe where oe.id = p_evento;
end;
$$;

/** La hora del servidor, para calcular el desfase del aparato una sola vez. */
create or replace function public.hora_servidor()
returns timestamptz language sql stable as $$ select now(); $$;

revoke all on function public.arrancar_reloj(uuid, int) from public, anon;
revoke all on function public.estirar_reloj(uuid, int) from public, anon;
grant execute on function public.arrancar_reloj(uuid, int) to authenticated;
grant execute on function public.estirar_reloj(uuid, int) to authenticated;
grant execute on function public.hora_servidor() to anon, authenticated;

-- ── 6. Recien AHORA se abre la cañeria ───────────────────────────────
--
-- `official_events` ya era legible por cualquiera (`events_publicos` con
-- `using true`), asi que publicarla no expone nada nuevo. `event_registrations`
-- viaja filtrada por la policy de arriba, que ya quedo arreglada.
--
-- REPLICA IDENTITY FULL en registrations: sin eso, el payload de un DELETE
-- trae solo la llave primaria, y el filtro `event_id=eq.X` del cliente no
-- puede evaluarse — o sea que una baja no llegaria nunca.
alter table public.event_registrations replica identity full;

do $pub$
begin
  if not exists (select 1 from pg_publication_rel pr
                  join pg_class c on c.oid = pr.prrelid
                  join pg_publication p on p.oid = pr.prpubid
                 where p.pubname = 'supabase_realtime' and c.relname = 'official_events') then
    alter publication supabase_realtime add table public.official_events;
  end if;
  if not exists (select 1 from pg_publication_rel pr
                  join pg_class c on c.oid = pr.prrelid
                  join pg_publication p on p.oid = pr.prpubid
                 where p.pubname = 'supabase_realtime' and c.relname = 'event_registrations') then
    alter publication supabase_realtime add table public.event_registrations;
  end if;
end $pub$;

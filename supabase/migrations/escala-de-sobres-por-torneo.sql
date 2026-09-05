-- Una escala de sobres PROPIA por torneo.
--
-- Nel, para el Twin Suns de 9: «3 booster al ganador, 1 al segundo, 1 al
-- tercero; el ganador de cada una de las otras dos mesas 1 booster; 4 quedan
-- sin nada».
--
-- La escala por defecto (1 a todos + 4/3/2/1 al podio) no puede expresar eso:
-- da algo a los nueve y premia 5/4/3/2 arriba. Y el premio de un torneo lo
-- decide quien lo organiza, no el sistema.
--
-- POR QUE UNA TABLA Y NO UN NUMERO EN EL CLIENTE. Porque el podio ANUNCIA y
-- el cierre ACREDITA, y tienen que decir lo mismo. Si la escala especial
-- viviera en la pantalla, el podio prometeria 3 sobres al campeon y el cierre
-- le daria 5. Las dos leen de aca.
create table if not exists public.torneo_escala_sobres (
  event_id uuid not null references public.official_events(id) on delete cascade,
  puesto smallint not null check (puesto >= 1),
  sobres smallint not null check (sobres >= 0),
  primary key (event_id, puesto)
);

-- §2j: Supabase da todo por defecto en una tabla nueva. Primero se quita.
revoke all on public.torneo_escala_sobres from public, anon, authenticated;
grant select on public.torneo_escala_sobres to anon, authenticated;
grant insert, update, delete on public.torneo_escala_sobres to authenticated;
alter table public.torneo_escala_sobres enable row level security;

drop policy if exists escala_lee on public.torneo_escala_sobres;
create policy escala_lee on public.torneo_escala_sobres for select using (true);

drop policy if exists escala_escribe on public.torneo_escala_sobres;
create policy escala_escribe on public.torneo_escala_sobres
for all to authenticated
using (public.puede_operar_torneo()
       or exists (select 1 from public.official_events oe
                   where oe.id = torneo_escala_sobres.event_id and oe.organizer_id = auth.uid()))
with check (public.puede_operar_torneo()
       or exists (select 1 from public.official_events oe
                   where oe.id = torneo_escala_sobres.event_id and oe.organizer_id = auth.uid()));

-- Si el torneo tiene escala propia manda esa, y un puesto que NO figura en
-- ella recibe CERO —«los demas no llevan nada» es una decision, no un olvido—.
-- Si no tiene escala propia, la de siempre.
create or replace function public.sobres_de_torneo(p_evento uuid, p_puesto int)
returns int language sql stable security definer set search_path to 'public'
as $$
  select case
    when exists (select 1 from public.torneo_escala_sobres where event_id = p_evento)
      then coalesce((select sobres from public.torneo_escala_sobres
                      where event_id = p_evento and puesto = p_puesto), 0)
    else public.sobres_por_puesto(p_puesto)
  end;
$$;

grant execute on function public.sobres_de_torneo(uuid, int) to anon, authenticated;

-- El podio anuncia la MISMA escala que el cierre acredita.
create or replace function public.escala_de_premios_de(p_evento uuid, p_hasta int default 4)
returns table (puesto int, sobres int, xp int)
language sql stable
as $$
  select g, public.sobres_de_torneo(p_evento, g), 500
    from generate_series(1, greatest(1, least(p_hasta, 32))) g;
$$;

grant execute on function public.escala_de_premios_de(uuid, int) to anon, authenticated;

-- `_repartir_premios` pasa a preguntar `sobres_de_torneo(evento, puesto)` en
-- vez de `sobres_por_puesto(puesto)`. El cuerpo completo esta aplicado en la
-- base; ver la migracion `escala_de_sobres_por_torneo`.

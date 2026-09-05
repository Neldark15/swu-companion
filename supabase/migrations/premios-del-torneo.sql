-- El podio de premios de un torneo.
--
-- Nel: «muestra los premios virtuales que se tendran y los premios fisicos
-- los agregara Jaime; dale un apartado a eso, que decida costo y que premios
-- seran. Eso solo lo veran los administradores —la forma de AGREGARLOS—.
-- Los jugadores veremos el podio de premios».
--
-- DOS CLASES, Y SOLO UNA SE GUARDA ACA. Los VIRTUALES (sobres y XP) ya los
-- decide el sistema: salen de `sobres_por_puesto()` y se acreditan solos al
-- cerrar. Guardarlos otra vez seria tener dos verdades sobre lo mismo, y el
-- dia que cambie la escala el podio anunciaria algo distinto a lo que se
-- reparte. Los FISICOS no los puede saber el sistema —sobres de verdad,
-- playmats, efectivo— y van aca.
--
-- El podio es PUBLICO: anunciar los premios es como se llena un torneo. Solo
-- escribirlos pide permiso.
create table if not exists public.torneo_premios (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.official_events(id) on delete cascade,
  -- `null` = premio que no es de un puesto (rifa, mejor mazo, participacion).
  puesto smallint,
  descripcion text not null,
  -- Sin moneda en el numero: en la comunidad se habla en dolares, y meterla
  -- adentro obliga a parsearla despues.
  valor numeric(10,2),
  orden smallint not null default 0,
  creado_por uuid references auth.users(id),
  creado_en timestamptz not null default now()
);

create index if not exists torneo_premios_evento on public.torneo_premios (event_id, puesto, orden);

-- §2j: Supabase da todo por defecto en una tabla nueva. Primero se quita.
revoke all on public.torneo_premios from public, anon, authenticated;
grant select on public.torneo_premios to anon, authenticated;
grant insert, update, delete on public.torneo_premios to authenticated;

alter table public.torneo_premios enable row level security;

drop policy if exists premios_publicos on public.torneo_premios;
create policy premios_publicos on public.torneo_premios for select using (true);

drop policy if exists premios_escribe_organizador on public.torneo_premios;
create policy premios_escribe_organizador on public.torneo_premios
for all to authenticated
using (
  public.puede_operar_torneo()
  or exists (select 1 from public.official_events oe
              where oe.id = torneo_premios.event_id and oe.organizer_id = auth.uid())
)
with check (
  public.puede_operar_torneo()
  or exists (select 1 from public.official_events oe
              where oe.id = torneo_premios.event_id and oe.organizer_id = auth.uid())
);

-- Emite cambios: si el organizador agrega un premio mientras la sala mira el
-- podio, tiene que aparecer sin que nadie recargue — es justo el momento en
-- que la gente esta decidiendo si se anota.
alter table public.torneo_premios replica identity full;
do $pub$
begin
  if not exists (select 1 from pg_publication_rel pr
                  join pg_class c on c.oid = pr.prrelid
                  join pg_publication p on p.oid = pr.prpubid
                 where p.pubname = 'supabase_realtime' and c.relname = 'torneo_premios') then
    alter publication supabase_realtime add table public.torneo_premios;
  end if;
end $pub$;

-- La escala virtual, legible por cualquiera.
--
-- El podio anuncia «5 sobres al campeon» ANTES de que empiece, y esa escala
-- vive en `sobres_por_puesto()`. `premios_de_torneo()` no sirve: exige ser
-- admin y necesita que la clasificacion exista. Aca se pregunta la REGLA, no
-- el reparto.
create or replace function public.escala_de_premios(p_hasta int default 4)
returns table (puesto int, sobres int, xp int)
language sql stable
as $$
  select g, public.sobres_por_puesto(g), 500
    from generate_series(1, greatest(1, least(p_hasta, 32))) g;
$$;

grant execute on function public.escala_de_premios(int) to anon, authenticated;

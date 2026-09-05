-- Un logo por formato, para que los torneos nuevos lo tomen solos.
--
-- Nel: «este sera el logo para los torneos de Premier; ya dejalo listo para
-- cuando se creen nuevos torneos».
--
-- La alternativa era meter los archivos en el repo, y eso obliga a un
-- despliegue cada vez que cambie un logo. Asi lo sube quien organiza, una vez,
-- desde la app.
--
-- Es una tabla y no una columna de `official_events` porque responde OTRA
-- pregunta: `image_url` es «el logo DE ESTE torneo» y esto es «el logo por
-- omision de los torneos de este formato». Un torneo puede poner el suyo sin
-- tocar el de los demas, y el propio siempre gana.
create table if not exists public.torneo_logo_formato (
  formato text primary key,
  url text not null,
  actualizado_por uuid references auth.users(id),
  actualizado_en timestamptz not null default now()
);

-- §2j: Supabase da todo por defecto en una tabla nueva. Primero se quita.
revoke all on public.torneo_logo_formato from public, anon, authenticated;
grant select on public.torneo_logo_formato to anon, authenticated;
grant insert, update, delete on public.torneo_logo_formato to authenticated;

alter table public.torneo_logo_formato enable row level security;

-- Lo lee cualquiera: el logo se ve en la lista publica de torneos.
drop policy if exists logo_formato_lee on public.torneo_logo_formato;
create policy logo_formato_lee on public.torneo_logo_formato for select using (true);

drop policy if exists logo_formato_escribe on public.torneo_logo_formato;
create policy logo_formato_escribe on public.torneo_logo_formato
for all to authenticated
using (public.puede_operar_torneo())
with check (public.puede_operar_torneo());

-- Emite cambios: si se sube un logo nuevo, las listas abiertas lo toman sin
-- que nadie recargue.
alter table public.torneo_logo_formato replica identity full;
do $pub$
begin
  if not exists (select 1 from pg_publication_rel pr
                  join pg_class c on c.oid = pr.prrelid
                  join pg_publication p on p.oid = pr.prpubid
                 where p.pubname = 'supabase_realtime' and c.relname = 'torneo_logo_formato') then
    alter publication supabase_realtime add table public.torneo_logo_formato;
  end if;
end $pub$;

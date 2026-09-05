-- El logo de un torneo.
--
-- Nel mando el logo de TWIN SUNS y pidio verlo en el torneo y en el lobby.
-- `official_events.image_url` ya existia —viajaba en cada fila, la consulta es
-- `select('*')`— y NO se pintaba en ningun lado. Ni siquiera estaba en el tipo
-- de TypeScript, asi que ninguna pantalla podia pintarlo sin que el compilador
-- la parara. Otra capacidad entera sin puerta.
--
-- POR QUE STORAGE Y NO UN DATA URI EN LA FILA. La tentacion es guardarlo como
-- texto en `image_url`, que es lo que hacen los avatares. Aca seria caro: esa
-- fila se lee en CADA carga de la lista de torneos, y un data URI dentro de un
-- JSON no lo cachea el navegador (§4m). Un logo de 200 KB se bajaria entero
-- cada vez que alguien abre la lista, por cada torneo. En Storage se baja una
-- vez y queda cacheado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('torneos', 'torneos', true, 3145728,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do nothing;

-- Lo lee cualquiera: el logo se ve en la pantalla publica del torneo y en la
-- proyeccion, que se miran sin cuenta.
drop policy if exists torneos_logo_lee on storage.objects;
create policy torneos_logo_lee on storage.objects
for select using (bucket_id = 'torneos');

-- Escribe quien lleva torneos, y SOLO dentro de su propia carpeta. La carpeta
-- es el uid: es lo que impide tocar la de otro.
drop policy if exists torneos_logo_escribe on storage.objects;
create policy torneos_logo_escribe on storage.objects
for insert to authenticated
with check (
  bucket_id = 'torneos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.puede_operar_torneo()
);

drop policy if exists torneos_logo_borra on storage.objects;
create policy torneos_logo_borra on storage.objects
for delete to authenticated
using (
  bucket_id = 'torneos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

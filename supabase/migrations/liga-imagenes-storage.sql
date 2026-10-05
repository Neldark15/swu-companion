-- El emblema, la portada y el banner de cada liga, en Storage.
--
-- Eran archivos fijos de PUENTE 3 en `public/liga/`: cambiarlos exigía un
-- despliegue y una segunda liga habría salido con la cara de la primera.
--
-- La carpeta ES el id de la liga, y solo su staff escribe ahí. La comprobación
-- va en una función porque una policy no garantiza el orden de evaluación del
-- AND: sin la guarda del formato, una carpeta que no es un uuid tiraría un
-- error de conversión en vez de un «no».
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ligas', 'ligas', true, 3145728, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do nothing;

create or replace function public.liga_staff_de_carpeta(p_carpeta text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if p_carpeta is null
     or p_carpeta !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.liga_es_staff(p_carpeta::uuid);
end;
$function$;
revoke all on function public.liga_staff_de_carpeta(text) from anon, public;
grant execute on function public.liga_staff_de_carpeta(text) to authenticated;

drop policy if exists ligas_img_lee on storage.objects;
create policy ligas_img_lee on storage.objects
  for select using (bucket_id = 'ligas');

drop policy if exists ligas_img_sube on storage.objects;
create policy ligas_img_sube on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ligas' and public.liga_staff_de_carpeta((storage.foldername(name))[1]));

drop policy if exists ligas_img_actualiza on storage.objects;
create policy ligas_img_actualiza on storage.objects
  for update to authenticated
  using (bucket_id = 'ligas' and public.liga_staff_de_carpeta((storage.foldername(name))[1]));

drop policy if exists ligas_img_borra on storage.objects;
create policy ligas_img_borra on storage.objects
  for delete to authenticated
  using (bucket_id = 'ligas' and public.liga_staff_de_carpeta((storage.foldername(name))[1]));

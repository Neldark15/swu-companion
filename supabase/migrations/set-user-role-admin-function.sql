-- ═══════════════════════════════════════════════════════════════════
-- Cambiar el rol de otra persona: que funcione, y solo para admins
-- ═══════════════════════════════════════════════════════════════════
--
-- Esto NUNCA funcionó desde la app. La única política de UPDATE de `profiles`
-- es `auth.uid() = id`, así que un admin editando la fila de OTRO afectaba
-- **0 filas**. PostgREST devuelve éxito con 0 filas, `error` venía null, y la
-- pantalla de administración decía «listo» sin haber cambiado nada.
--
-- Lo único que sí escribía era la propia fila — que es exactamente la escalada
-- de privilegios que cierra melee-profile-link-and-role-lockdown.sql.
--
-- Ahora la comprobación de admin vive en el servidor, donde no se puede
-- saltar desde el cliente.

create or replace function public.set_user_role(
  objetivo uuid,
  nuevo_rol text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  quien uuid := auth.uid();
  rol   text;
  admins_restantes int;
begin
  if quien is null then
    raise exception 'no autenticado';
  end if;

  if nuevo_rol not in ('user', 'admin') then
    raise exception 'rol invalido: %', nuevo_rol;
  end if;

  select role into rol from public.profiles where id = quien;
  if rol is distinct from 'admin' then
    raise exception 'solo un admin puede cambiar roles';
  end if;

  -- Cambiarse el rol a uno mismo es la escalada que se cerró, y además es
  -- como un admin se deja afuera sin querer.
  if objetivo = quien then
    raise exception 'no podes cambiar tu propio rol';
  end if;

  -- Quedarse sin ningún admin deja a la comunidad sin quien cree torneos ni
  -- gestione nada, y desde la app no hay forma de arreglarlo.
  if nuevo_rol = 'user' then
    select count(*) into admins_restantes
      from public.profiles
     where role = 'admin' and id <> objetivo;
    if admins_restantes = 0 then
      raise exception 'no se puede quitar el ultimo admin';
    end if;
  end if;

  update public.profiles
     set role = nuevo_rol,
         updated_at = now()
   where id = objetivo;

  if not found then
    raise exception 'no existe ese usuario';
  end if;
end;
$$;

revoke all on function public.set_user_role(uuid, text) from public;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- Enlazar el perfil de melee.gg + cerrar la escalada de privilegios
-- ═══════════════════════════════════════════════════════════════════
--
-- Dos cosas que van juntas a propósito: la insignia de «verificado» no
-- significa nada si cualquiera puede hacerse admin y verificarse solo.
--
-- ── El agujero ────────────────────────────────────────────────────────
--
-- `profiles` tenía UPDATE concedido a nivel de TABLA a `authenticated` (y a
-- `anon`), y su única política era:
--
--     UPDATE  USING (auth.uid() = id)   -- sin WITH CHECK
--
-- Un grant de tabla cubre TODAS las columnas, presentes y futuras, así que
-- `role` entraba. Y como al omitir WITH CHECK Postgres reusa el USING, la
-- fila resultante seguía cumpliendo `auth.uid() = id`. O sea, cualquiera
-- logueado podía correr esto contra su propia fila:
--
--     supabase.from('profiles').update({ role: 'admin' }).eq('id', miId)
--
-- y quedar admin: crear torneos, mandar push a TODA la comunidad y editar
-- sedes. Es la misma trampa que ya está documentada en CLAUDE.md 2j para
-- `email`: no alcanza con revocar la columna, hay que revocar la tabla y
-- volver a conceder la lista explícita.
--
-- La lista de abajo es exactamente lo que la app escribe hoy —verificado
-- recorriendo las llamadas a `from('profiles')`: upsert de {id,name,avatar},
-- settings, whatsapp, showcase_cards, favorite_aspects, banner_card_id,
-- accent, is_public, bio— menos `role` y menos `melee_verified`.
-- `id` se queda porque el upsert lo manda.

-- ── Columnas nuevas ──────────────────────────────────────────────────

alter table public.profiles
  add column if not exists melee_username text,
  add column if not exists melee_verified boolean not null default false;

-- La gramática es la misma que valida el proxy: melee los usa como segmento
-- de ruta, así que una barra o un `..` acá se convertirían en una travesía de
-- directorios contra su servidor. Se frena en la base y no solo en el cliente.
alter table public.profiles
  drop constraint if exists profiles_melee_username_valido;
alter table public.profiles
  add constraint profiles_melee_username_valido
  check (
    melee_username is null
    or (melee_username ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$'
        and position('..' in melee_username) = 0)
  );

comment on column public.profiles.melee_username is
  'Usuario público de melee.gg. Solo el nombre, no la URL.';
comment on column public.profiles.melee_verified is
  'Un admin confirmó que la cuenta de melee es de esta persona. Melee no expone '
  'ningún campo editable en el perfil público, así que NO hay forma técnica de '
  'probarlo: es confirmación humana. Solo se cambia por set_melee_verified().';

-- ── Lectura ──────────────────────────────────────────────────────────
-- El usuario de melee es público por definición (es un perfil público de otro
-- sitio), así que lo ven anon y authenticated igual que el nombre o el avatar.

grant select (melee_username, melee_verified) on public.profiles to anon;
grant select (melee_username, melee_verified) on public.profiles to authenticated;

-- ── Escritura: se cierra `role` y `melee_verified` ───────────────────

revoke update on public.profiles from anon;
revoke update on public.profiles from authenticated;

-- `anon` no recupera UPDATE: con RLS `auth.uid() = id` nunca podría escribir
-- nada, así que tenerlo concedido era riesgo sin uso.

grant update (
  accent,
  avatar,
  banner_card_id,
  bio,
  created_at,
  email,
  favorite_aspects,
  id,
  is_public,
  melee_username,
  name,
  settings,
  showcase_cards,
  updated_at,
  whatsapp
) on public.profiles to authenticated;

-- ── Verificación: solo admins, y nunca sobre uno mismo ───────────────

create or replace function public.set_melee_verified(
  objetivo uuid,
  verificado boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  quien uuid := auth.uid();
  rol   text;
begin
  if quien is null then
    raise exception 'no autenticado';
  end if;

  select role into rol from public.profiles where id = quien;
  if rol is distinct from 'admin' then
    raise exception 'solo un admin puede verificar cuentas de melee';
  end if;

  -- Verificarse a uno mismo no es verificación, es afirmación. Un admin que
  -- quiera su propia insignia se la pide a otro admin.
  if objetivo = quien then
    raise exception 'un admin no puede verificarse a sí mismo';
  end if;

  update public.profiles
     set melee_verified = verificado,
         updated_at = now()
   where id = objetivo;
end;
$$;

revoke all on function public.set_melee_verified(uuid, boolean) from public;
grant execute on function public.set_melee_verified(uuid, boolean) to authenticated;

-- Enlazar una cuenta ajena que ya estaba verificada volvería a valer como
-- verificada sin que nadie lo revise. Cambiar el usuario baja la insignia.
create or replace function public.melee_username_cambio()
returns trigger
language plpgsql
as $$
begin
  if new.melee_username is distinct from old.melee_username then
    new.melee_verified := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_melee_username_cambio on public.profiles;
create trigger trg_melee_username_cambio
  before update on public.profiles
  for each row execute function public.melee_username_cambio();
